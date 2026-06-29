from ping3 import ping
import statistics

def ping_statistics(host, count=10, timeout=5):
    """
    Calculate latency, jitter, and MRT (Mean Response Time).
    
    Args:
        host: IP address or hostname
        count: Number of pings to send
        timeout: Timeout per ping in seconds
    
    Returns:
        dict: Statistics including latency, jitter, MRT, packet loss
    """
    response_times = []
    failed_pings = 0
    
    print(f"Pinging {host} with {count} packets...")
    
    for i in range(count):
        try:
            response = ping(host, timeout=timeout, unit='ms')
            
            if response is not None:
                response_times.append(response)
                print(f"Reply from {host}: time={response:.2f}ms")
            else:
                failed_pings += 1
                print(f"Request timeout for {host}")
        
        except Exception as e:
            failed_pings += 1
            print(f"Error: {e}")
    
    # Calculate statistics
    if not response_times:
        return {
            'host': host,
            'status': 'offline',
            'packet_loss': 100.0,
            'packets_sent': count,
            'packets_received': 0
        }
    
    # Latency (Round-Trip Time)
    min_latency = min(response_times)
    max_latency = max(response_times)
    avg_latency = statistics.mean(response_times)
    
    # MRT (Mean Response Time) - same as average latency
    mrt = avg_latency
    
    # Jitter (variation in latency)
    # Calculate as standard deviation of response times
    if len(response_times) > 1:
        jitter = statistics.stdev(response_times)
    else:
        jitter = 0.0
    
    # Alternative jitter calculation (average difference between consecutive pings)
    if len(response_times) > 1:
        differences = [abs(response_times[i] - response_times[i-1]) 
                      for i in range(1, len(response_times))]
        jitter_avg = statistics.mean(differences)
    else:
        jitter_avg = 0.0
    
    # Packet loss percentage
    packet_loss = (failed_pings / count) * 100
    
    return {
        'host': host,
        'status': 'online',
        'packets_sent': count,
        'packets_received': len(response_times),
        'packet_loss': round(packet_loss, 2),
        'min_latency': round(min_latency, 2),
        'max_latency': round(max_latency, 2),
        'avg_latency': round(avg_latency, 2),
        'mrt': round(mrt, 2),  # Mean Response Time
        'jitter_stdev': round(jitter, 2),  # Jitter (standard deviation)
        'jitter_avg': round(jitter_avg, 2),  # Jitter (average difference)
        'response_times': [round(rt, 2) for rt in response_times]
    }

import random
import redis

rdb = redis.Redis(host='localhost', port=6379, db=1)



def spike_component(component_name, agent):
    component_payload = {
        "cpu": {
            "cpu_utilization": round(random.uniform(float(rdb.get('monitoring:threshold:cpu_monitoring') or 80), 100), 2),
            "cpu_uuid": str(agent.device.cpu.get().uuid) if agent.device.cpu.exists() else None
        },
        "memory": {
            "memory_utilization": round(random.uniform(float(rdb.get('monitoring:threshold:memory_monitoring') or 80), 100), 2),
        
        },
        "disk": {
            "disk_utilization": round(random.uniform(float(rdb.get('monitoring:threshold:disk_monitoring') or 80), 100), 2),
        },
        "network": {
            "network_utilization": round(random.uniform(float(rdb.get('monitoring:threshold:network_monitoring') or 80), 100), 2),
        },
        "partition": {
            "disk_utilization": round(random.uniform(float(rdb.get('monitoring:threshold:partition_monitoring') or 80), 100), 2),
        }
    }
    return component_payload.get(component_name, {})



# Usage
if __name__ == '__main__':
    result = ping_statistics('8.8.8.8', count=10)
    
    print("\n=== Ping Statistics ===")
    print(f"Host: {result['host']}")
    print(f"Status: {result['status']}")
    print(f"Packets: {result['packets_received']}/{result['packets_sent']} received")
    print(f"Packet Loss: {result['packet_loss']}%")
    print(f"\nLatency:")
    print(f"  Min: {result['min_latency']} ms")
    print(f"  Max: {result['max_latency']} ms")
    print(f"  Avg: {result['avg_latency']} ms")
    print(f"\nMRT (Mean Response Time): {result['mrt']} ms")
    print(f"Jitter (Standard Deviation): {result['jitter_stdev']} ms")
    print(f"Jitter (Average Difference): {result['jitter_avg']} ms")
