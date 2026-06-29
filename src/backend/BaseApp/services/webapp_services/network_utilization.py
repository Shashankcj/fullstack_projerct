from django.utils.timezone import localtime
from django.db.models import Avg, FloatField
from django.db.models.functions import Cast
from django.http import JsonResponse, HttpResponseBadRequest
from datetime import timedelta
from ...models import NetworkPortMonitoring, Port
 
def network_utilization(request, uuid):
    interval = request.GET.get('interval')
    if interval is None:
        return HttpResponseBadRequest("Missing 'interval' parameter")
 
    try:
        bucket_size_minutes = int(interval)
    except ValueError:
        return HttpResponseBadRequest("'interval' must be an integer")
 
    now = localtime().replace(second=0, microsecond=0)
    total_buckets = 7
    result = {}
 
    ports = Port.objects.filter(nic__device__agent__uuid=uuid)
    for port in ports:
        port_name = port.name 
        result[port_name] = []
 
        for i in range(total_buckets):
            bucket_end = now - timedelta(minutes=i * bucket_size_minutes)
            bucket_start = bucket_end - timedelta(minutes=bucket_size_minutes)
 
            avg_data = NetworkPortMonitoring.objects.filter(
                component=port,
                checkpoint__timestamp_utc__gte=bucket_start,
                checkpoint__timestamp_utc__lt=bucket_end
            ).annotate(
                util_float=Cast('network_utilization', FloatField())
            ).aggregate(
                avg_util=Avg('util_float')
            )
 
            # Format label with hour conversion 
            total_minutes = (i + 1) * bucket_size_minutes
            if total_minutes >= 60:
                hours = total_minutes / 60
                if hours == int(hours):
                    name = f"{int(hours)}hr"
                else:
                    name = f"{hours:.1f}hr"
            else:
                name = f"{total_minutes}min"
            
            avg_value = round(float(avg_data['avg_util'] or 0), 1)
 
            result[port_name].append({
                "name": name,
                "value": avg_value
            })
        
        result[port_name].reverse()
    return JsonResponse(result, safe=False)
