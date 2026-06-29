from rest_framework.response import Response
from BaseApp.models import Device, Agent, IPAddress
from BaseApp.serializer import WebAgentSerializer, WebAgentserializer, DeviceInfoSerializer
from rest_framework import status
from django.db.models import Q
from rest_framework.pagination import PageNumberPagination
import django_filters
import logging

logger = logging.getLogger('agent_monitoring')

class Pageination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100


def get_all_device_details(request):
    try:
        qs = Agent.objects.all()

        search_query    = request.query_params.get('search', '')
        status_filter   = request.query_params.get('status', '')
        os_filter       = request.query_params.get('os', '')
        device_type_filter = request.query_params.get('device_type', '')
        priority_filter = request.query_params.get('priority')
        health_filter   = request.query_params.get('health', '') 

        if search_query:
            health_search_map = {
                'healthy':     'green',
                'warning':     'amber',
                'critical':    'red',
                'maintenance': 'maintenance', 
            }
            health_search_value = health_search_map.get(
                search_query.lower(), search_query
            )
            qs = qs.filter(
                Q(hostname__icontains=search_query) |
                Q(os__icontains=search_query) |
                Q(status__iexact=search_query) |
                Q(device__dev_phy_vm__icontains=search_query) |
                Q(device__nic__port__ip__address__icontains=search_query) |
                Q(priority__priority_name__icontains=search_query)|
                Q(health_status__iexact=health_search_value)
            ).distinct()

        if status_filter:
            qs = qs.filter(status=status_filter)

        if os_filter:
            if os_filter.lower() == 'linux':
                qs = qs.filter(os__in=[
                    'Red Hat Enterprise Linux',
                    'Ubuntu', 'centos', 'debian', 'fedora'
                ])
            elif os_filter.lower() == 'windows':
                qs = qs.filter(os='Windows')
            else:
                qs = qs.filter(os=os_filter)

        if device_type_filter:
            qs = qs.filter(device__dev_phy_vm__icontains=device_type_filter)

        if priority_filter:
            qs = qs.filter(priority__priority_name__icontains=priority_filter)

        # Health status filter
        if health_filter:
            hf = health_filter.lower()

            if hf == 'unknown':
                # Catch both NULL and empty string as "no data"
                qs = qs.filter(Q(health_status__isnull=True) | Q(health_status=""))

            else:
                health_map = {
                    'healthy':     'green',
                    'warning':     'amber',
                    'critical':    'red',
                    'maintenance': 'maintenance',
                }

                db_value = health_map.get(hf)

                if db_value:
                    qs = qs.filter(
                        health_status__iexact=db_value
                    ).exclude(
                        Q(health_status__isnull=True) | Q(health_status="")
                    )
                else:
                    # Unknown filter value — return nothing instead of everything
                    qs = qs.none()
                

        paginator  = Pageination()
        page       = paginator.paginate_queryset(qs, request)
        serializer = WebAgentserializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    except Exception as e:
        return Response({"error": str(e)}, status=500)


# def get_device_by_uuid(request, uuid):
#     try:
#         device     = Agent.objects.get(uuid=uuid)
#         serializer = WebAgentSerializer(device)
#         return Response({"device": serializer.data}, status=status.HTTP_200_OK)
#     except Agent.DoesNotExist:
#         return Response({"error": "Device not found"}, status=status.HTTP_404_NOT_FOUND)

def get_device_by_uuid(request, uuid):
    try:
        device = Agent.objects.select_related(
            'device',
            'priority',
        ).prefetch_related(
            'device__cpu',
            'device__nic__port__ip',
        ).get(uuid=uuid)

        serializer = DeviceInfoSerializer(device)   # ← swap here only
        return Response(serializer.data, status=status.HTTP_200_OK)

    except Agent.DoesNotExist:
        return Response({"error": "Device not found"}, status=status.HTTP_404_NOT_FOUND)
