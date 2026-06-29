from django.utils import timezone
from rest_framework.response import Response
import logging
from django.core.cache import cache
from .....models import Storage
from ..helper_services_to__handle_stats.get_resource import get_resource_or_404
from ..helper_services_to__handle_stats.unified_response import build_unified_response
from BaseApp.services.webapp_services.stats.unified_metric_stats import get_disk_custom_date_stats_with_granularity
logger = logging.getLogger("agent_monitoring")

def disk_custom_range_stats(request, agent_uuid):
    try:
        disk_qs, error = get_resource_or_404('disk', agent_uuid)
        if error:
            return error

        start_date_str = request.data.get('start_date')
        end_date_str = request.data.get('end_date')
        granularity = request.data.get('granularity', 'daily')

        if not start_date_str or not end_date_str:
            return Response({
                "status": "error",
                "message": "Both 'start_date' and 'end_date' are required in the request body.",
                "required_format": "YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS for minutely"
            }, status=400)

        valid_granularities = ['minutely', 'hourly', 'daily', 'weekly', 'monthly']
        if granularity not in valid_granularities:
            return Response({
                "status": "error",
                "message": f"Invalid granularity. Must be one of: {', '.join(valid_granularities)}"
            }, status=400)

        cache_key = f"disk_custom_{agent_uuid}_{start_date_str}_{end_date_str}_{granularity}"
        cached_data = cache.get(cache_key)
        if cached_data:
            logger.info(f"Returning cached Disk custom range data for {agent_uuid}")
            return Response(cached_data)

        logger.info(f"Disk custom range request: agent={agent_uuid}, range={start_date_str} to {end_date_str}, granularity={granularity}")

        try:
            data = {}
            for disk in disk_qs:
                try:
                    # ✅ FIXED: Now uses unified service with absolute time ranges
                    disk_data = get_disk_custom_date_stats_with_granularity(
                        disk, start_date_str, end_date_str, granularity
                    )
                    data[str(disk.uuid)] = disk_data
                except Exception as disk_error:
                    logger.error(f"Error getting custom stats for disk {disk.uuid}: {str(disk_error)}")
                    
                    error_message = str(disk_error)
                    validation_errors = ["60 minutes maximum", "same day", "Invalid datetime"]
                    if any(err in error_message for err in validation_errors):
                        return Response({
                            "status": "error",
                            "message": error_message
                        }, status=400)
                    
                    # For other errors, continue with empty data for this disk
                    data[str(disk.uuid)] = {}
            
            if not any(data.values()):
                return Response({
                    "status": "success",
                    "data": {granularity: {}},
                    "message": "No data available for the specified date range",
                    "meta": {
                        "disk_uuid": str(disk_qs.first().uuid) if disk_qs.exists() else None,
                        "device_uuid": str(disk_qs.first().device.uuid) if disk_qs.exists() else None,
                        "total_disks": disk_qs.count(),
                        "date_range": f"{start_date_str} to {end_date_str}",
                        "granularity": granularity,
                        "fetched_at": timezone.now().isoformat()
                    }
                })
                
        except Exception as data_error:
            logger.error(f"Error getting custom Disk stats: {str(data_error)}")
            error_message = str(data_error)
            validation_errors = ["60 minutes maximum", "same day", "Invalid datetime"]
            if any(err in error_message for err in validation_errors):
                return Response({
                    "status": "error",
                    "message": error_message
                }, status=400)
            
            return Response({
                "status": "error",
                "message": "Error retrieving Disk statistics for the specified date range"
            }, status=500)

        response_data = build_unified_response('disk', disk_qs, granularity, data, is_multi_resource=True)
        
        if response_data.status_code == 200:
            cache_timeout = 60 if granularity == 'minutely' else 600
            cache.set(cache_key, response_data.data, timeout=cache_timeout)
            
        return response_data

    except Exception as e:
        logger.error(f"Critical error in disk_custom_range_stats for agent {agent_uuid}: {str(e)}")
        return Response({
            "status": "error",
            "message": "Internal server error while processing custom range request"
        }, status=500)
