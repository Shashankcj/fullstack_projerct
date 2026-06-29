from django.utils import timezone   
import logging 
from rest_framework.response import Response
from django.core.cache import cache
from .....models import Memory
from ..helper_services_to__handle_stats.get_resource import get_resource_or_404
from ..helper_services_to__handle_stats.unified_response import build_unified_response
from BaseApp.services.webapp_services.stats.unified_metric_stats import get_memory_weekly_stats
logger = logging.getLogger("agent_monitoring")

def memory_weekly_stats(request, agent_uuid):
    try:
        cache_key = f"memory_weekly_stats_{agent_uuid}"
        cached_data = cache.get(cache_key)
        if cached_data:
            return Response(cached_data)
            
        memory_qs, error = get_resource_or_404('memory', agent_uuid)
        if error:
            return error
            
        data = get_memory_weekly_stats(memory_qs.first())
        response_data = build_unified_response('memory', memory_qs, "weekly", data)
        
        if response_data.status_code == 200:
            cache.set(cache_key, response_data.data, timeout=21600)
            
        return response_data
        
    except Exception as e:
        logger.error(f"Error in memory_weekly_stats for agent {agent_uuid}: {str(e)}")
        return Response({
            "status": "error",
            "message": "Internal server error while fetching weekly stats"
        }, status=500)
