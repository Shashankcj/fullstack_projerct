from django.utils import timezone
import logging
from rest_framework.response import Response
from .....models import Storage
from ..helper_services_to__handle_stats.get_resource import get_resource_or_404
from ..helper_services_to__handle_stats.unified_response import build_unified_response
from BaseApp.services.webapp_services.stats.unified_metric_stats import get_disk_minutely_stats
logger = logging.getLogger("agent_monitoring")

def disk_minutely_stats(request, agent_uuid):
    try:
        logger.info(f"[Disk Minutely] Fetching fresh real-time data for agent {agent_uuid}")
        
        disk_qs, error = get_resource_or_404('disk', agent_uuid)
        if error:
            return error
            
        data = {}
        for disk in disk_qs:
            try:
                disk_data = get_disk_minutely_stats(disk)
                data[str(disk.uuid)] = disk_data
            except Exception as disk_error:
                logger.error(f"Error getting minutely stats for disk {disk.uuid}: {str(disk_error)}")
                data[str(disk.uuid)] = {}
        
        return build_unified_response('disk', disk_qs, "minutely", data, is_multi_resource=True)
        
    except Exception as e:
        logger.error(f"Error in disk_minutely_stats for agent {agent_uuid}: {str(e)}")
        return Response({
            "status": "error",
            "message": "Internal server error while fetching minutely stats"
        }, status=500)
