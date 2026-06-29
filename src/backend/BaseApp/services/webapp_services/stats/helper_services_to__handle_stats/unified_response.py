from rest_framework.response import Response
from django.utils import timezone
import logging

logger = logging.getLogger("agent_monitoring")
def build_unified_response(resource_type, resource_qs, key, data, is_multi_resource=False):
    """Unified response builder for any resource type"""
    try:
        resource = resource_qs.first()
        if not resource:
            return Response({
                "status": "error",
                "message": f"{resource_type.title()} instance not found"
            }, status=404)
            
        base_meta = {
            f"{resource_type}_uuid": str(resource.uuid),
            "device_uuid": str(resource.device.uuid),
            "fetched_at": timezone.now().isoformat(),
        }
        
        if is_multi_resource:
            base_meta[f"total_{resource_type}s"] = resource_qs.count()
            base_meta["total_data_points"] = sum(len(d) if isinstance(d, dict) else 0 for d in data.values()) if isinstance(data, dict) else 0
        else:
            base_meta["total_data_points"] = len(data) if isinstance(data, dict) else 0
            
        return Response({
            "status": "success",
            "data": {key: data},
            "meta": base_meta
        })
        
    except Exception as e:
        logger.error(f"Error building {resource_type} response: {str(e)}")
        return Response({
            "status": "error",
            "message": f"Internal server error while building {resource_type} response"
        }, status=500)