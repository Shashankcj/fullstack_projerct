from rest_framework.response import Response    
from rest_framework import status
from .....models import CPU, Memory, Storage
from logging import getLogger
logger = getLogger("agent_monitoring")

def get_resource_or_404(resource_type, agent_uuid):
    """Unified helper to get any resource type or return 404"""
    try:
        if not agent_uuid:
            return None, Response({
                "status": "error", 
                "message": "Agent UUID is required"
            }, status=400)
        
        if resource_type == 'cpu':
            resource_qs = CPU.objects.select_related('device', 'device__agent').filter(
                device__agent__uuid=agent_uuid
            )
        elif resource_type == 'memory':
            resource_qs = Memory.objects.select_related('device', 'device__agent').filter(
                device__agent__uuid=agent_uuid
            )
        elif resource_type == 'disk':
            resource_qs = Storage.objects.select_related('device', 'device__agent').filter(
                device__agent__uuid=agent_uuid
            )
        else:
            return None, Response({
                "status": "error",
                "message": f"Unknown resource type: {resource_type}"
            }, status=400)
            
        if not resource_qs.exists():
            return None, Response({
                "status": "error", 
                "message": f"{resource_type.title()} not found for the specified agent"
            }, status=404)
            
        return resource_qs, None
        
    except Exception as e:
        logger.error(f"Error in get_{resource_type}_or_404 for agent {agent_uuid}: {str(e)}")
        return None, Response({
            "status": "error",
            "message": f"Internal server error while fetching {resource_type} data"
        }, status=500)    