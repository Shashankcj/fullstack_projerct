from django.utils import timezone
import logging
from rest_framework.response import Response
from .....models import Memory
from ..helper_services_to__handle_stats.get_resource import get_resource_or_404
from ..helper_services_to__handle_stats.unified_response import build_unified_response
from BaseApp.services.webapp_services.stats.unified_metric_stats import get_memory_minutely_stats
logger = logging.getLogger("agent_monitoring")

def memory_minutely_stats(request, agent_uuid):
    try:
        logger.info(f"[Memory Minutely] Fetching fresh real-time data for agent {agent_uuid}")
        
        memory_qs, error = get_resource_or_404('memory', agent_uuid)
        if error:
            return error
            
        data = get_memory_minutely_stats(memory_qs.first())
        return build_unified_response('memory', memory_qs, "minutely", data)
        
    except Exception as e:
        logger.error(f"Error in memory_minutely_stats for agent {agent_uuid}: {str(e)}")
        return Response({
            "status": "error",
            "message": "Internal server error while fetching minutely stats"
        }, status=500)