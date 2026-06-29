from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated
from BaseApp.utils import JWTCookieAuthentication
from BaseApp.models import Alert
from rest_framework.response import Response
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from BaseApp.serializer import AlertSerializer
import django_filters
from BaseApp.utils import check_permission
from django.db.models import Q,OuterRef,Exists
import  logging
from BaseApp.models import AuditLog,Agent
from ipware import get_client_ip
logger=logging.getLogger('agent_monitoring')

class Pagination(PageNumberPagination):
    page_size = 10  
    page_size_query_param = 'page_size'
    max_page_size = 100
    
@api_view(["GET"])
@check_permission(module="monitoring",allowed_action="read")
def get_latest_alert(request):
    """Retrieve the latest alerts for the dashboard."""
    try:
        filter_params=['severity','alert_type','device_name','start_date','uuid','end_date','search','priority']
        
        has_filters = any(request.query_params.get(param) for param in filter_params)

        
        # Base queryset with read status annotation
        queryset = Alert.objects.select_related('agent').order_by('-created_at')
        
        if not has_filters:
            queryset=queryset[:200]
            
        filterset=AlertFilter(request.query_params, queryset=queryset)
        
        paginator=Pagination()
        page = paginator.paginate_queryset(filterset.qs, request)
        
        serializer = AlertSerializer(page, many=True)
        return paginator.get_paginated_response({'alerts':serializer.data})
   
    except Exception as e:
        import traceback
        print("="*50)
        print("FULL TRACEBACK:")
        traceback.print_exc()
        print("="*50)
        return Response({"error": str(e)}, status=500)
    
@api_view(["GET"])
@check_permission(module="monitoring",allowed_action="read")
def get_filter_options(request):
    """Retrieve filter options for alerts."""
    # Get distinct values and convert to set to ensure uniqueness
    try:
        
        queryset = Alert.objects.all()
        
        agent_uuid = request.query_params.get('uuid')
        if agent_uuid:
            queryset = queryset.filter(agent__uuid=agent_uuid)
          
        severities = set(queryset.values_list('severity', flat=True))
        types = set(queryset.values_list('alert_type', flat=True))
        device_names = set(queryset.values_list('device_name', flat=True))
        agent_priorities=set(queryset.filter(agent__isnull=False).values_list('agent__priority__priority_name',flat=True))
        ip_priorities=set(queryset.filter(ip_source__isnull=False).values_list('ip_source__priority__priority_name',flat=True))
        
        all_priorities=sorted(list(agent_priorities | ip_priorities))
        # Convert back to sorted lists
        return Response({
            'severity': sorted(list(severities)),
            'component': sorted(list(types)),
            'device': sorted(list(device_names)),
            'priority':all_priorities
        })
        
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    
@api_view(["PATCH"])
@check_permission(module="monitoring",allowed_action="update")
def mark_alert_as_read(request):
    """Mark a specific alert as read."""
    try:
        alert_id=request.data.get('uuid')
        alert = Alert.objects.get(uuid=alert_id)
        
        # Add current user to read_by list
        alert.is_read=True
        alert.save()
        
        agent_hostname=None
        if alert.agent:
            agent_hostname = alert.agent.hostname
        else:
            print("No agent associated with this alert")
        ip_address,reachable=get_client_ip(request)
        
        AuditLog.objects.create(
            user=request.user,
            action='MARK_ALERTS_READ',
            model_name='Alert',
            description=f"Marked alert as read for device {agent_hostname}",
            ip=ip_address
        )
        return Response({
            'success': True,
            'message': 'Alert marked as read'
        })
        
    except Alert.DoesNotExist:
        return Response({'error': 'Alert not found'}, status=404)
    except Exception as e:
        return Response({'error': str(e)}, status=500)
@api_view(["PATCH"])
@check_permission(module="monitoring", allowed_action="update")
def mark_all_alerts_as_read(request):
    """Mark all unread alerts as read for agent or globally."""
    try:
        agent_uuid = request.query_params.get('uuid')
        logger.info(f"Marking alerts as read - agent_uuid: {agent_uuid}")
        
        # Base: ALL unread alerts
        unread_alerts = Alert.objects.filter(is_read=False)
        
        # Filter by agent IF UUID provided
        if agent_uuid:
            unread_alerts = unread_alerts.filter(agent__uuid=agent_uuid)
            logger.info(f"Filtering alerts for agent: {agent_uuid}")
        else:
            logger.info("Marking ALL unread alerts globally")
        
        #  Bulk update (fast!)
        updated_count = unread_alerts.update(is_read=True)
        
        #  Agent hostname (SAFE - no crash)
        agent_hostname = "ALL agents and IP alerts"
        if agent_uuid:
            try:
                agent = Agent.objects.get(uuid=agent_uuid)
                agent_hostname = agent.hostname
            except Agent.DoesNotExist:
                agent_hostname = f"Agent-{agent_uuid[:8]}"
        
        ip_address, _ = get_client_ip(request)
        
        # AuditLog
        AuditLog.objects.create(
            user=request.user,
            action='MARK_ALERTS_READ',
            model_name='Alert',
            description=f"Marked {updated_count} alerts as read for {agent_hostname}",
            ip=ip_address,
        )
        
        return Response({
            'success': True,
            'marked_read': updated_count,
            'agent_uuid': agent_uuid or 'global',
            'agent_hostname': agent_hostname
        })
        
    except Exception as e:
        logger.error(f"Mark alerts failed: {str(e)}")
        return Response({'error': str(e)}, status=500)

    
@api_view(["GET"])
@check_permission(module="monitoring",allowed_action="read")
def get_unread_alert_count(request):
    """Get count of unread alerts for current user."""
    try:
        # Filter unread alerts
        unread_alerts = Alert.objects.filter(is_read=False)
        agent_uuid=request.query_params.get('uuid')
        
        if agent_uuid:
            unread_alerts=unread_alerts.filter(agent__uuid=agent_uuid)
        return Response({'unread_count': unread_alerts.count()})
    
    except Exception as e:
        return Response({'error': str(e)}, status=500)
    
class AlertFilter(django_filters.FilterSet):
    severity=django_filters.CharFilter(field_name='severity', lookup_expr='iexact')
    alert_type=django_filters.CharFilter(field_name='alert_type', lookup_expr='exact')
    device_name=django_filters.CharFilter(field_name='device_name', lookup_expr='iexact')
    start_date = django_filters.DateTimeFilter(
        field_name='created_at',
        lookup_expr='gte',
    )
    
    end_date = django_filters.DateTimeFilter(
        field_name='created_at',
        lookup_expr='lte',
    )
    search = django_filters.CharFilter(method='filter_search', label='Search All Fields')
    # Priority filter
    priority = django_filters.CharFilter(method='filter_priority')
   
    uuid=django_filters.UUIDFilter(field_name='agent__uuid',lookup_expr='exact')
    def filter_search(self, queryset, name, value):
        
        if not value:
            return queryset
        
        q_objects=(
            Q(device_name__icontains=value) |
            Q(alert_type__icontains=value) |
            Q(severity__icontains=value) | 
            Q(details__icontains=value) 
        )
        return queryset.filter(q_objects)
    def filter_priority(self,queryset,name,value):
        """Filter alerts by priority"""
        return queryset.filter(
            Q(agent__priority__priority_name=value)|
            Q(ip_source__priority__priority_name=value)
        )
    class Meta:
        model = Alert
        fields = ['severity', 'alert_type', 'device_name','uuid','created_at']    
     