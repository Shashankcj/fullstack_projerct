from rest_framework.response import Response
from django.core.cache import cache
from django.utils import timezone
import logging
from .....models import CPU
from ..helper_services_to__handle_stats.get_resource import get_resource_or_404
from ..helper_services_to__handle_stats.unified_response import build_unified_response
from BaseApp.services.webapp_services.stats.unified_metric_stats import (
    # CPU Functions
    get_cpu_minutely_stats, get_cpu_hourly_stats, get_cpu_daily_stats,
    get_cpu_weekly_stats, get_cpu_monthly_stats, get_cpu_custom_date_stats_with_granularity,
)
logger = logging.getLogger("agent_monitoring")

def cpu_hourly_stats(request,agent_uuid):
    try:
        cache_key = f"cpu_hourly_stats_{agent_uuid}"
        cached_data = cache.get(cache_key)
        if cached_data:
            return Response(cached_data)
        
        cpu_qs, error = get_resource_or_404('cpu', agent_uuid)
        if error:
            return error
            
        data = get_cpu_hourly_stats(cpu_qs.first())
        response_data = build_unified_response('cpu', cpu_qs, "hourly", data)
        
        if response_data.status_code == 200:
            cache.set(cache_key, response_data.data, timeout=300)
            
        return response_data
        
    except Exception as e:
        logger.error(f"Error in cpu_hourly_stats for agent {agent_uuid}: {str(e)}")
        return Response({
            "status": "error",
            "message": "Internal server error while fetching hourly stats"
        }, status=500)
    

    
