from django.http import JsonResponse
import json
from BaseApp.models.models import Agent
from django.db import transaction
from BaseApp.utils import check_permission
from oauth2_provider.models import Application
from rest_framework.decorators import api_view, permission_classes,authentication_classes
from rest_framework.permissions import IsAuthenticated
from BaseApp.utils import JWTCookieAuthentication
import logging
from BaseApp.models.audit_logs import AuditLog
from ipware import get_client_ip

logger=logging.getLogger('agent_monitoring')
@api_view(["DELETE"])
@check_permission(module="monitoring", allowed_action="delete")
def delete_agents(request):
    
    try:
        if not request.body:
            return JsonResponse({
                'status': 'error',
                'message': 'Request body required'
            }, status=400)
        
        data=json.loads(request.body)
        logger.info(f"agent delete uuid {data}")
        uuid_data = data['uuid']
        
        agent_uuids=[]
        # Convert to list if string (single UUID)
        if isinstance(uuid_data, str):
            agent_uuids = [uuid_data]
        elif isinstance(uuid_data, list):
            agent_uuids = uuid_data
        else:
            return JsonResponse({
                'status': 'error',
                'message': '"uuid" must be a string or array'
            }, status=400)
            
        if not agent_uuids:
            return JsonResponse({
                 'status': 'error',
                'message': 'No UUIDs provided'
            }, status=400)
            
        agents=Agent.objects.filter(uuid__in=agent_uuids).select_related('oauth_application')
        agent_count=agents.count()
        
        if agent_count == 0:
            return JsonResponse({
                'status': 'error',
                'message':'No agents found with provided UUID(s)',
                'provided_uuids': agent_uuids
            },status=404)
            
        # Collect OAuth applications to delete
        oauth_apps_to_delete = []
        deleted_info = []
        with transaction.atomic():
            for agent in agents:
                oauth_app = agent.oauth_application
                
                info={
                    'hostname': agent.hostname,
                    'os': agent.os,
                    'os_version': agent.os_version,
                }
                 # Check if OAuth application exists
                if agent.oauth_application:
                    oauth_app = agent.oauth_application
                    info['had_oauth'] = True
                    info['oauth_client_id'] = oauth_app.client_id
                    info['oauth_name'] = oauth_app.name
                    
                    # Collect OAuth app to delete
                    if oauth_app.id not in [o.id for o in oauth_apps_to_delete]:
                        oauth_apps_to_delete.append(oauth_app)
                
                deleted_info.append(info)
            
            # Delete OAuth applications first
            oauth_count = len(oauth_apps_to_delete)
            if oauth_count > 0:
                oauth_ids = [oauth.id for oauth in oauth_apps_to_delete]
                Application.objects.filter(id__in=oauth_ids).delete()
            
            # Delete agents (CASCADE will delete OAuth if not already deleted)
            agents.delete()
            if request:
                ip_address,routable=get_client_ip(request)
            # Create audit log entry
            agent_names = ', '.join([info['hostname'] for info in deleted_info[:5]])  # First 5
            if agent_count > 5:
                agent_names += f' and {agent_count - 5} more'
        
            AuditLog.objects.create(
                user=request.user,
                action='DELETE',
                model_name='Device',
                description=f"{request.user} deleted {agent_count} Device(s): {agent_names}",
                ip=ip_address
            )
        return JsonResponse({
            'status': 'success',
            'message': f'Successfully deleted {agent_count} Device(s)',
            'deleted_agents_count': agent_count,
            'deleted_oauth_count': oauth_count,
            'deleted_details': deleted_info,
            'not_found_count': len(agent_uuids) - agent_count
        })
    
    except json.JSONDecodeError:
        return JsonResponse({
            'status': 'error',
            'message': 'Invalid JSON format'
        }, status=400)
    
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': f'Server error: {str(e)}'
        }, status=500)
 