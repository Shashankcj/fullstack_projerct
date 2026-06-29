
from BaseApp.models.audit_logs import AuditLog
from rest_framework.response import Response
from BaseApp.utils import JWTCookieAuthentication 
from rest_framework.decorators import api_view, permission_classes,authentication_classes
from rest_framework.permissions import IsAuthenticated
from BaseApp.serializer import AuditLogSerializer,AuditLog
from rest_framework.pagination import PageNumberPagination
from .audit_log_filter import AuditLogFilter
import logging
import csv
from BaseApp.utils import check_permission
from django.http import HttpResponse
from datetime import datetime
from ipware import get_client_ip

logger=logging.getLogger('agent_monitoring')

class AuditLogPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100

@api_view(['GET'])
@check_permission(module="audit_logs",allowed_action="read")
def get_audit_logs(request):
    try:
        # Check if filters are applied
        filter_params = ['user', 'action', 'model_name', 'severity_display', 
                        'ip', 'start_date', 'end_date', 'search']
        
        has_filters = any(request.query_params.get(param) for param in filter_params)
        
        # Get queryset
        queryset = AuditLog.objects.all().order_by('-timestamp')
        
        # Limit unfiltered requests to last 100 logs
        if not has_filters:
            queryset = queryset[:200]
       
        #  Apply filters
        filterset = AuditLogFilter(request.query_params, queryset=queryset)
       
        # Paginate filtered results
        paginator = AuditLogPagination()
        page = paginator.paginate_queryset(filterset.qs, request)
        
        serializer = AuditLogSerializer(page, many=True)

        return paginator.get_paginated_response({"audit_logs": serializer.data})
      
    except Exception as e:
        return Response({"error": str(e)}, status=500)
 
@api_view(['GET'])
@check_permission(module="audit_logs",allowed_action="read")
def get_audit_log_filters(request):
    """Return available filter options"""

    try:  
        severity_choices=AuditLog._meta.get_field('severity').choices
        users = AuditLog.objects.values_list('user',flat=True).distinct()
        resources = AuditLog.objects.values_list('model_name',flat=True).distinct()
        actions = AuditLog.objects.values_list('action',flat=True).distinct()
       
        severities =[
            {"value":value,"label":label}
            for value,label in severity_choices
        ]
            
        
        return Response({
            "users" : list(users),
            "resources": list(resources),
            "actions":list(actions),
            "severities":severities
        })

    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['GET'])
@check_permission(module="audit_logs",allowed_action="read")
def download_audit_logs(request):
    """Download audit logs as CSV with applied filters"""
    try:
        # Filter queryset
        filterset = AuditLogFilter(
            request.query_params,
            queryset=AuditLog.objects.all().order_by('-timestamp')
        )
        filtered_qs = filterset.qs
        if not filterset.is_valid():
            return HttpResponse("Invalid filter parameters", status=400)
        
        # Log download
        ip_address, _ = get_client_ip(request)
        filters = ', '.join(f"{k}: {v}" for k, v in request.query_params.items() if k not in ['page', 'page_size']) or 'None'
        
        AuditLog.objects.create(
            model_name="AuditLog",
            action="DOWNLOAD",
            user=request.user.username,
            description=f"Downloaded {filtered_qs.count()} audit logs as CSV" + 
                       (f" with filters: {filters}" if filters != 'No filters' else ""),
            ip=ip_address
        )
        
        # Generate CSV
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="audit_logs_{datetime.now():%Y%m%d_%H%M%S}.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['Date/Time', 'User', 'Action', 'Model', 'Description', 'IP', 'Severity'])
        
        severity_map = dict(getattr(AuditLog, 'SEVERITY_CHOICES', []))
        writer.writerows([
            [log.timestamp, log.user, log.action, log.model_name, 
             log.description, log.ip or 'N/A', severity_map.get(log.action, 'Info')]
            for log in filterset.qs
        ])
        
        return response
        
    except Exception as e:
        return HttpResponse(f"Error: {str(e)}", status=500)
