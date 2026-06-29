from BaseApp.models.ipmonitor import IPMonitor,IPMonitorCheckpoint
from rest_framework.response import Response
from concurrent.futures import ThreadPoolExecutor, as_completed
from pythonping import ping
import statistics
from rest_framework import status
# from ping3 import ping
from django.utils import timezone
from celery import shared_task
from BaseApp.signals import broadcast_ip_monitoring_update
import datetime
import logging, redis
from django.conf import settings
from django.http import JsonResponse
logger = logging.getLogger('agent_monitoring')

def get_optimal_workers(ip_count):
    """Calculate optimal worker count - never exceed IP count"""
    logger.info("Ready to return maxworkers")
    if ip_count <= 10:
        return ip_count  # 10 IPs = 10 workers max
    elif ip_count <= 50:
        return min(20, ip_count)
    elif ip_count <= 100:
        return min(50, ip_count)
    elif ip_count <= 500:
        return min(100, ip_count)
    elif ip_count <= 1000:
        return min(200, ip_count)
    else:
        return min(500, ip_count)
    
def ping_with_statistics(ip_address, count=5, timeout=5):
    """
    Ping with complete statistics: latency, jitter, MRT, packet loss.
    
    Args:
        ip_address: IP address to ping
        count: Number of ping attempts
        timeout: Timeout per ping in seconds
    
    Returns:
        dict: Complete ping statistics
    """
    try:
        # Execute ping
        result = ping(target=ip_address, count=count, timeout=timeout)
        
        # Get all response times from successful pings
        response_times = [
            r.time_elapsed_ms 
            for r in result._responses 
            if r.success
        ]
        
        # Check if all pings failed
        if not response_times:
            logger.warning(f"ping failed for {ip_address}")
            return {
                'status': 'Down',
                'min_latency': None,
                'max_latency': None,
                'jitter': None,
            }
        # Calculate Jitter (standard deviation of latency)
        if len(response_times) > 1:
            jitter = statistics.stdev(response_times)
        else:
            jitter = 0.0
        
        # Get min/max latency
        min_latency = min(response_times)
        max_latency = max(response_times)
            
        return {
            'status':'Up',
            'min_latency': round(min_latency, 2),
            'max_latency': round(max_latency, 2),
            'jitter': round(jitter, 2),  # Network jitter
        }
    
    except PermissionError:
        logger.error(f"Permission denied for {ip_address} - need CAP_NET_RAW")
        return {
            'status': 'error',
            'response_time':None,
            'min_latency': None,
            'max_latency': None,
            'jitter': None,
        }
    
    except Exception as e:
        logger.error(f"Ping error for {ip_address}: {e}")
        return {
            'status': 'timeout',
            'response_time':None,
            'min_latency': None,
            'max_latency': None,
            'jitter': None,
        }



from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync


def parallel_ping_ips(ip_monitors_queryset=None):
    """Ping all IPs in parallel using ping3"""
    logger.info("Starting parallel IP pinging...")
    from BaseApp.tasks import broadcast_batch_task
    try:
        if ip_monitors_queryset is None:
            ip_list= IPMonitor.objects.all()      
        else:
            ip_list = ip_monitors_queryset
            
        total=ip_list.count()
        if total==0:
            return Response({"message":"No IPs to ping"}, status=200)
        max_workers = get_optimal_workers(total)
        checkpoints_to_create = []    
        logger.info(f"Pinging {total} IPs with {max_workers} workers")
        
        # Adjust ping parameters based on IP count
        if total <= 10:
            ping_count, ping_timeout = 4, 5
        elif total <= 100:
            ping_count, ping_timeout = 3, 3
        elif total <= 500:
            ping_count, ping_timeout = 2, 2
        else:
            ping_count, ping_timeout = 1, 1
        
        checkpoints_to_create = []
        logger.info(f"Pinging {total} IPs with {max_workers} workers (count={ping_count}, timeout={ping_timeout}s)")
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_ip = {executor.submit(ping_with_statistics, ip.ip_address,count=ping_count, timeout=ping_timeout): ip for ip in ip_list}
            for future in as_completed(future_to_ip):
                ip_entry = future_to_ip[future]
                try:
                    result = future.result()
                    now = datetime.datetime.now(datetime.timezone.utc)
                    # Create checkpoint object (not saved yet)
                    checkpoint = IPMonitorCheckpoint(
                        ip_monitor=ip_entry,
                        status=result['status'],
                        status_value=(result['status']=='Up')*100,  # 100 for up, 0 for down/error/timeout
                        min_latency=result['min_latency'],
                        max_latency=result['max_latency'],
                        jitter=result['jitter'],
                        created_at=now
                    )
                    checkpoints_to_create.append(checkpoint)

                    async_to_sync(get_channel_layer().group_send)(
                        f"webapp.{checkpoint.ip_monitor.uuid}",
                        {
                            "type": "send.mon.data.to.frontend",
                            "data": {
                                "timestamp": checkpoint.getTimestampInTimezone(settings.TIME_ZONE), 
                                "agent_uuid": str(checkpoint.ip_monitor.uuid), 
                                "ip_monitoring": {
                                    "ip_status": checkpoint.status_value, 
                                    "min_latency": checkpoint.min_latency, 
                                    "max_latency": checkpoint.max_latency, 
                                    "jitter": checkpoint.jitter
                                }
                            }
                        }
                    )
                    
                except Exception as e:
                    logger.error(f"Failed to process {ip_entry.ip_address}: {str(e)}")
                   
                    checkpoint = IPMonitorCheckpoint(
                        ip_monitor=ip_entry,
                        status='error',
                        status_value=0,
                        min_latency=None,
                        max_latency=None,
                        jitter=None,
                        created_at=now
                    )
                    checkpoints_to_create.append(checkpoint)
                   
        created_checkpoints = IPMonitorCheckpoint.objects.bulk_create(
            checkpoints_to_create,
            batch_size=500
        )
        logger.info(f"Saved {len(checkpoints_to_create)} checkpoints")
        
        broadcast_batch_task.delay(checkpoint_ids=[cp.id for cp in created_checkpoints])
        
        # Calculate statistics
        online = sum(1 for c in checkpoints_to_create if c.status == 'Up')
        offline = sum(1 for c in checkpoints_to_create if c.status == 'Down')
        timeout = sum(1 for c in checkpoints_to_create if c.status == 'timeout')
        
        logger.info(f"Completed: {total} IPs ({online} Up, {offline} Down, {timeout} timeout)")
        logger.info(f"Created {len(created_checkpoints)} checkpoints")
        
        return JsonResponse({
        'total': total,
        'updated': total,
        'Up': online,
        'Down': offline,
        'timeout': timeout
       })
        
    except Exception as e:  
       return Response({"error": str(e)}, status=500)