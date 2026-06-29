
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated
from BaseApp.utils import JWTCookieAuthentication
from BaseApp.models import Event
from rest_framework.response import Response
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from BaseApp.serializer import EventSerializer
import django_filters
from django.db.models import Q
from django.http import HttpResponse
import csv
from datetime import datetime
from BaseApp.utils import check_permission
from BaseApp.models.audit_logs import AuditLog
from ipware import get_client_ip
class Pagination(PageNumberPagination):
    page_size = 10  
    page_size_query_param = 'page_size'
    max_page_size = 100
    
@api_view(["GET"])
@check_permission(module="monitoring",allowed_action="read")
def get_latest_events(request):
    """Retrieve the latest events for the dashboard."""
    try:
       filter_params=['component_type','event_type','device_name','start_date','uuid','end_date','search']
       hasfilter=any(request.query_params.get(param) for param in filter_params) 
       query_set=Event.objects.select_related('agent').all().order_by('-created_at')
       
       if not hasfilter:
            query_set=query_set[:200] 
            
       EventFilterset=EventFilter(request.query_params,queryset=query_set)
          
       pageinator=Pagination()
       
       page = pageinator.paginate_queryset(EventFilterset.qs, request)
       serializer =  EventSerializer(page, many=True)
       return pageinator.get_paginated_response({'events':serializer.data})
   
    except Exception as e:
        return Response({'error': 'Failed to retrieve latest events'}, status=500)


@api_view(["GET"])
@check_permission(module="monitoring",allowed_action="read")
def get_evntlogs_filter_options(request):
    """Retrieve filter options for alerts."""
    try:
        query_set=Event.objects.all()
        agent_uuid=request.query_params.get('uuid')
        if agent_uuid:
            query_set=query_set.filter(agent__uuid=agent_uuid)
            
        component_types=set(query_set.values_list('component_type', flat=True))
        event_types = set(query_set.values_list('event_type', flat=True))
        device_names = set(query_set.values_list('agent__hostname', flat=True))
        
        
        return Response({
            'component_type': sorted(list(component_types)),
            'event_type': sorted(list(event_types)),
            'device':sorted(list(device_names))
        })
        
    except Exception as e:
        return Response({'error': 'Failed to retrieve filter options'}, status=500)


@api_view(['GET'])
@check_permission(module="monitoring",allowed_action="read")
def download_event_logs(request):
    """Download event logs as CSV with applied filters"""
    try:
        # Filter queryset
        filterset = EventFilter(
            request.query_params,
            queryset=Event.objects.select_related('agent').order_by('-created_at')
        )
        
        if not filterset.is_valid():
            return HttpResponse("Invalid filter parameters", status=400)
        
        # Log download action
        ip_address, _ = get_client_ip(request)
        filters = ', '.join(
            f"{k}: {v}" for k, v in request.query_params.items() 
            if k not in ['page', 'page_size']
        ) or 'None'
        
        AuditLog.objects.create(
            model_name="Event",
            action="DOWNLOAD",
            user=request.user.username,
            description=f"Downloaded {filterset.qs.count()} event logs (filters: {filters})",
            ip=ip_address
        )
        
        # Generate CSV
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="event_logs_{datetime.now():%Y%m%d_%H%M%S}.csv"'
        
        writer = csv.writer(response)
        writer.writerow([
            'Date/Time', 
            'Device Name', 
            'Event Type', 
            'Component', 
            'Description'
        ])
        
        for event in filterset.qs:
            writer.writerow([
                event.created_at,
                event.agent.hostname if event.agent else 'N/A',
                event.event_type,
                event.component_type or 'N/A',
                event.description
            ])
        
        return response
        
    except Exception as e:
        return HttpResponse(f"Error: {str(e)}", status=500)

class EventFilter(django_filters.FilterSet):
    component_type=django_filters.CharFilter(field_name='component_type', lookup_expr='iexact')
    event_type=django_filters.CharFilter(field_name='event_type', lookup_expr='iexact')
    device_name=django_filters.CharFilter(field_name='agent__hostname', lookup_expr='icontains')
    start_date=django_filters.DateTimeFilter(field_name='created_at', lookup_expr='gte')
    end_date=django_filters.DateTimeFilter(field_name='created_at', lookup_expr='lte')
    uuid=django_filters.CharFilter(field_name='agent__uuid',lookup_expr='exact')
    search=django_filters.CharFilter(method='filter_by_search', label='Search')

    def filter_by_search(self, queryset, name, value):
        if not value:
            return queryset
        
        q_objects=(
            Q(agent__hostname__icontains=value) |
            Q(event_type__icontains=value) |
            Q(component_type__icontains=value) | 
            Q(description__icontains=value) 
            
        )
        return queryset.filter(q_objects)
    
    class Meta:
        model = Event
        fields = ['component_type', 'event_type', 'device_name', 'start_date','uuid','end_date', 'search']
