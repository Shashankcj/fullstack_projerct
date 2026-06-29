from django.db.models.signals import post_save
from django.db import transaction
from django.dispatch import receiver
from .models import (
    MonitoringCheckpoint, CpuMonitoring, MemoryMonitoring,
    DiskMonitoring, PartitionMonitoring, NetworkPortMonitoring, Alert,Event,Agent,Device,WebUser,
    ApplicationDiskIO, ApplicationMemoryIO, ApplicationCPUIO,MonitoringCheckpoint,Port,Storage,Partition,WebUser)
from .models.roles import PermissionSet
import logging
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .serializer import WebAgentSerializer
from uuid import UUID
import time
from django.utils import timezone
import json
from django.core.serializers.json import DjangoJSONEncoder
from BaseApp.models.ipmonitor import IPMonitorCheckpoint
from django.conf import settings

logger=logging.getLogger('agent_monitoring')
webapp_logger = logging.getLogger('webapp_consumer')
def convert_uuids(obj):
    from uuid import UUID
    from datetime import datetime
    
    if isinstance(obj, dict):
        result = {}
        for k, v in obj.items():
            if isinstance(v, UUID):
                result[k] = str(v)
            elif isinstance(v, datetime):
                result[k] = v.isoformat()
            else:
                result[k] = v
        return result
    elif isinstance(obj, list):
        return [convert_uuids(item) for item in obj]
    return obj

def send_monitoring_data_to_ws():
    agents = Agent.objects.all()
    result = {}
    
    for agent in agents:
        checkpoint = MonitoringCheckpoint.objects.filter(agent=agent).order_by('-created_at').first()
        if not checkpoint:
            continue

        # SYSTEM MONITORING (single objects - use .first())
        cpu = convert_uuids(CpuMonitoring.objects.filter(checkpoint=checkpoint).values().first())
        memory = convert_uuids(MemoryMonitoring.objects.filter(checkpoint=checkpoint).values().first())
        
        # Disk and partition data (multiple objects)
        disk_qs = DiskMonitoring.objects.filter(checkpoint=checkpoint).values()
        partition_qs = PartitionMonitoring.objects.filter(checkpoint=checkpoint).values()
        
        disk_list = convert_uuids(list(disk_qs))
        partition_list = convert_uuids(list(partition_qs))

        # Group partitions by storage_id
        partition_map = {}
        for partition in partition_list:
            storage_id = partition.get("storage_id")
            if storage_id:
                partition_map.setdefault(storage_id, []).append(partition)

        for disk in disk_list:
            storage_disk_id = disk.get("storage_disk_id")
            disk["partitions"] = partition_map.get(storage_disk_id, [])
            
        # Network (multiple objects)
        network = convert_uuids(list(NetworkPortMonitoring.objects.filter(checkpoint=checkpoint).values()))
        try:
            application_disk_io = convert_uuids(
                list(ApplicationDiskIO.objects.filter(checkpoint=checkpoint).values())
            )  # Gets ALL disk processes for this checkpoint
        except Exception as e:
            print("ApplicationDiskIO query failed:", e)
            application_disk_io = []

        try:
            application_memory_io = convert_uuids(
                list(ApplicationMemoryIO.objects.filter(checkpoint=checkpoint).values())
            )  # Gets ALL memory processes for this checkpoint
        except Exception as e:
            print("ApplicationMemoryIO query failed:", e)
            application_memory_io = []

        try:
            application_cpu_io = convert_uuids(
                list(ApplicationCPUIO.objects.filter(checkpoint=checkpoint).values())
            )  
        except Exception as e:
            print("ApplicationCPUIO query failed:", e)
            application_cpu_io = []

        result[str(agent.uuid)] = {
            "cpu": cpu,                           
            "memory": memory,                     
            "disks": disk_list,                   
            "network": network,                   
            "application_disk_io": application_disk_io,    
            "application_memory_io": application_memory_io, 
            "application_cpu_io": application_cpu_io,      
            "timestamp": time.time()
        }

    safe_result = json.loads(json.dumps(result, cls=DjangoJSONEncoder))
    
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        "monitoring_all",
        {
            "type": "monitoring_realtime_update",
            "data": safe_result
        }
    )

def handle_network_monitoring(instance):
    # checkpoint = instance.checkpoint
    # agent = checkpoint.agent if checkpoint else None

    # if agent and agent.uuid:
    #     transaction.on_commit(lambda: send_monitoring_data_to_ws())
    pass


@receiver(post_save, sender=CpuMonitoring, dispatch_uid="cpu_monitoring_signal")
@receiver(post_save, sender=MemoryMonitoring, dispatch_uid="memory_monitoring_signal")  
@receiver(post_save, sender=DiskMonitoring, dispatch_uid="disk_monitoring_signal")
@receiver(post_save, sender=PartitionMonitoring, dispatch_uid="partition_monitoring_signal")
@receiver(post_save, sender=NetworkPortMonitoring, dispatch_uid="network_monitoring_signal")
@receiver(post_save, sender=ApplicationDiskIO, dispatch_uid="app_disk_monitoring_signal")
@receiver(post_save, sender=ApplicationMemoryIO, dispatch_uid="app_memory_monitoring_signal") 
@receiver(post_save, sender=ApplicationCPUIO, dispatch_uid="app_cpu_monitoring_signal")
def checkpoint_updated(sender, instance, **kwargs):
    try:
        handle_network_monitoring(instance)
    except Exception as e:
        print(f"[post_save ERROR] Failed to handle network monitoring: {e}")

from django.db.models.signals import post_save, post_delete

@receiver(post_save, sender=Agent)
@receiver(post_save, sender=Device)
@receiver(post_save,sender=Event)
@receiver(post_save,sender=Alert)
@receiver(post_delete, sender=Agent)   # ADD THIS   
@receiver(post_delete, sender=Device)  # ADD THIS
def broadcast_agent_update(sender, instance, created=None, **kwargs):
    try:
        if sender == Alert and getattr(instance, 'suppressed', False):
            return
        
        is_delete = kwargs.get('signal') == post_delete
        if sender == Agent:
            agent = instance
        elif sender == Device:
            agent = instance.agent 
        elif sender == Alert:
            agent = instance.checkpoint.agent 
        elif sender == Event:
            agent = instance.agent
        else:
            return 
        channel_layer = get_channel_layer()
        if is_delete:
            # Send delete message for your WebSocket to handle
            async_to_sync(channel_layer.group_send)(
                "monitoring_all",
                {
                    "type": "data_deleted",
                    "model": sender.__name__,
                    "instance_id": instance.id
                }
            )
        else:
            # Existing save logic - unchanged
            serializer = WebAgentSerializer(agent)
            async_to_sync(channel_layer.group_send)(
                "monitoring_all",
                {
                    "type": "agent_update",
                    "data": serializer.data
                }
            )
    except Exception as e:
       print(f"Error broadcasting agent update: {e}")

def get_device_name(instance):
    """Helper to get agent/hostname from instance"""
    try:
        if hasattr(instance, 'nic') and instance.nic and instance.nic.device and instance.nic.device.agent:
            return instance.nic.device.agent.hostname
        elif hasattr(instance, 'device') and instance.device and instance.device.agent:
            return instance.device.agent.hostname
        elif hasattr(instance, 'storage') and instance.storage and instance.storage.device and instance.storage.device.agent:
            return instance.storage.device.agent.hostname
        return "Unknown"
    except Exception:
        return "Unknown"


@receiver([post_save, post_delete], sender=Port)
@receiver([post_save, post_delete], sender=Storage)
@receiver([post_save, post_delete], sender=Partition)
def broadcast_flag_update(sender, instance, **kwargs):
    """
    Broadcast flag/unflag or view/unview changes of Port, Storage, or Partition
    to a single WebSocket group.
    """
    try:
       
        
        channel_layer = get_channel_layer()
        payload = {
            "uuid": str(instance.uuid),
            "entity_type": sender.__name__.lower(),
            "is_flagged": getattr(instance, 'is_flagged', False),
            "is_viewed": getattr(instance, 'is_viewed', False),
            "flagged_at": getattr(instance, 'flagged_at', None).isoformat() if getattr(instance, 'flagged_at', None) else None,
            "flagged_reason": getattr(instance, 'flagged_reason', None),
            "device_name": get_device_name(instance),
            "event_type": "deleted" if kwargs.get('signal') == post_delete else "updated"
        }

        safe_payload = json.loads(json.dumps(payload, cls=DjangoJSONEncoder))

        async_to_sync(channel_layer.group_send)(
            "webapp_broadcast",
            {
                "type": "flagged.entity.update",  
                "data": safe_payload
            }
        )

    except Exception as e:
        print(f"[FLAG SIGNAL ERROR] Failed to broadcast flag change: {e}")


@receiver([post_save,post_delete],sender=Alert)
def broadcast_alert_created(sender, instance, **kwargs):
    try:
        # if alerts suppression is enabled for this alert, skip broadcasting
        if getattr(instance, 'suppressed', False):
            logger.info(f"[MAINTENANCE] Bell suppressed for {instance.device_name} — {instance.alert_type}")
            return
         
        channel_layer = get_channel_layer()

        # Prepare payload data
        payload = {
            "uuid": instance.uuid,
            "entity_type": sender.__name__.lower(),
            "alert_type": instance.alert_type,
            "created_at": instance.created_at.isoformat() if hasattr(instance, 'created_at') else None,
            # add other relevant fields
            "severity":instance.severity,
            "device_name":instance.device_name,
            "message":instance.message,
            "event_type": "deleted" if kwargs.get('signal') == post_delete else "created"
        }

        # Serialize safely
        safe_payload = json.loads(json.dumps(payload, cls=DjangoJSONEncoder))

        # Send message to group
        async_to_sync(channel_layer.group_send)(
            "webapp_broadcast",  # your websocket group name
            {
                "type": "send.alert.to.frontend",
                "data": safe_payload
            }
        )
        logger.info(f"Signalling - Sent alert {payload['event_type']} to frontend for Alert {instance.uuid}")
    except Exception as e:
        print(f"[ALERT SIGNAL ERROR] Failed to broadcast alert change: {e}")        
        logger.error(f"Error broadcasting alert change: {e}", exc_info=True)


@receiver(post_save, sender=IPMonitorCheckpoint)
def broadcast_ip_monitoring_update(sender, instance, **kwargs):
    try:
        status_value = instance.status_value
        min_latency = instance.min_latency
        max_latency = instance.max_latency
        jitter = instance.jitter

        async_to_sync(get_channel_layer().group_send)(
            f"webapp.{instance.ip_monitor.uuid}",
            {
                "type": "send.mon.data.to.frontend",
                "data": {
                    "timestamp": instance.getTimestampInTimezone(settings.TIME_ZONE), 
                    "agent_uuid": str(instance.ip_monitor.uuid), 
                    "ip_monitoring": {
                        "ip_status": status_value, 
                        "min_latency": min_latency, 
                        "max_latency": max_latency, 
                        "jitter": jitter
                    }
                }
            }
        )
        webapp_logger.info(f"Signalling - Sent monitoring data to frontend for IP {instance.ip_monitor.uuid}")

    except Exception as e:
        webapp_logger.error(f"Error broadcasting IP monitoring update: {e}")


from BaseApp.models.global_config import GlobalConfig
@receiver(post_save, sender=GlobalConfig)
def update_redis_on_config_change(sender, instance, **kwargs):
    try:
        if instance.item_key.startswith('monitoring_'):
            from BaseApp.redis_client import rdb
            GlobalConfig.load_global_config_to_redis(rdb)
    except Exception as e:
        logger.error(f"Failed to update Redis on Monitoring Threshold Change: {e}", exc_info=True)
        print(f"[CONFIG SIGNAL ERROR] Failed to update Redis on config change: {e}")


