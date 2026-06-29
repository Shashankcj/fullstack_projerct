from django.utils import timezone
import logging
from rest_framework.response import Response
from django.core.cache import cache
from .....models import Storage
from ..helper_services_to__handle_stats.get_resource import get_resource_or_404
from ..helper_services_to__handle_stats.unified_response import build_unified_response
from BaseApp.services.webapp_services.stats.unified_metric_stats import get_disk_monthly_stats
logger = logging.getLogger("agent_monitoring")

def disk_monthly_stats(request, agent_uuid):
    try:
        cache_key = f"disk_monthly_stats_{agent_uuid}"
        cached_data = cache.get(cache_key)
        if cached_data:
            return Response(cached_data)
            
        disk_qs, error = get_resource_or_404('disk', agent_uuid)
        if error:
            return error
            
        data = {}
        for disk in disk_qs:
            try:
                disk_data = get_disk_monthly_stats(disk)
                data[str(disk.uuid)] = disk_data
            except Exception as disk_error:
                logger.error(f"Error getting monthly stats for disk {disk.uuid}: {str(disk_error)}")
                data[str(disk.uuid)] = {}
        
        response_data = build_unified_response('disk', disk_qs, "monthly", data, is_multi_resource=True)
        
        if response_data.status_code == 200:
            cache.set(cache_key, response_data.data, timeout=86400)
            
        return response_data
        
    except Exception as e:
        logger.error(f"Error in disk_monthly_stats for agent {agent_uuid}: {str(e)}")
        return Response({
            "status": "error",
            "message": "Internal server error while fetching monthly stats"
        }, status=500)