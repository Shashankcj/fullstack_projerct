from BaseApp.models.models import Agent, Device, Alert
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Count, Q
from BaseApp.models.ipmonitor import IPMonitor, IPMonitorCheckpoint
from django.db.models import Window, Sum, F
from django.db.models.functions import RowNumber
from django.db.models import OuterRef, Subquery
from django.utils import timezone
from BaseApp.serializer import AlertSerializer


@api_view(["GET"])
def dashboard_stats(request):
    try:
        now = timezone.now()

        # ── 1. DEVICES (Agents) ───────────────────────────────────────────
        devices_stats = Agent.objects.aggregate(
            total=Count('uuid'),
            active=Count('uuid', filter=Q(status='Active')),
            inactive=Count('uuid', filter=Q(status='Inactive')),
            linux=Count('uuid', filter=Q(os__in=[
                'Red Hat Enterprise Linux', 'Ubuntu', 'centos', 'debian', 'fedora'
            ])),
            windows=Count('uuid', filter=Q(os='Windows')),

            # Health status counts
            health_green=Count('uuid', filter=Q(health_status='green')),
            health_amber=Count('uuid', filter=Q(health_status='amber')),
            health_red=Count('uuid', filter=Q(health_status='red')),
            health_unknown=Count('uuid', filter=Q(health_status__isnull=True)),

            # Maintenance count (Celery manages the flag, so simple boolean check)
            in_maintenance=Count('uuid', filter=Q(maintenance_mode=True)),
        )

        # ── 2. Priority + Status breakdown ───────────────────────────────
        priority_status_stats = Agent.objects.values(
            'priority__priority_name',
            'status'
        ).annotate(
            count=Count('uuid')
        ).order_by('priority__priority_name', 'status')

        # Priority + Health breakdown
        priority_health_stats = Agent.objects.values(
            'priority__priority_name',
            'health_status'
        ).annotate(
            count=Count('uuid')
        ).order_by('priority__priority_name', 'health_status')

        # Build priority_dict with status breakdown
        priority_dict = {}
        for stat in priority_status_stats:
            priority_name = stat['priority__priority_name'] or 'No Priority'
            status_val = stat['status'] or 'unknown'

            if priority_name not in priority_dict:
                priority_dict[priority_name] = {
                    'active': 0,
                    'inactive': 0,
                    'total': 0,
                    'health': {'green': 0, 'amber': 0, 'critical': 0, 'unknown': 0}
                }

            priority_dict[priority_name][status_val.lower()] = stat['count']
            priority_dict[priority_name]['total'] += stat['count']

        # Merge health data into priority_dict
        for stat in priority_health_stats:
            priority_name = stat['priority__priority_name'] or 'No Priority'
            health = stat['health_status'] or 'unknown'

            if priority_name not in priority_dict:
                priority_dict[priority_name] = {
                    'active': 0,
                    'inactive': 0,
                    'total': 0,
                    'health': {'green': 0, 'amber': 0, 'critical': 0, 'unknown': 0}
                }

            # Map DB value 'red' → 'critical' for frontend consistency
            health_key = 'critical' if health == 'red' else health
            priority_dict[priority_name]['health'][health_key] = stat['count']

        # Format final priority_data
        total = devices_stats['total'] or 1  # Avoid division by zero
        priority_data = []
        for priority_name, stats in priority_dict.items():
            percent = round((stats['total'] / total * 100), 2)
            priority_data.append({
                'priority': priority_name,
                'count': stats['total'],
                'percentage': percent,
                'status': {
                    'active': stats.get('active', 0),
                    'inactive': stats.get('inactive', 0),
                },
                'health_status': {
                    'green': stats['health']['green'],
                    'amber': stats['health']['amber'],
                    'critical': stats['health']['critical'],
                    'unknown': stats['health']['unknown'],
                }
            })

        # ── 3. OS & Device Type ───────────────────────────────────────────
        devices_others = devices_stats['total'] - devices_stats['linux'] - devices_stats['windows']

        device_type = Device.objects.aggregate(
            physical=Count('uuid', filter=Q(dev_phy_vm='Physical Machine')),
            virtual=Count('uuid', filter=Q(dev_phy_vm='Virtual Machine'))
        )

        # ── 4. IP Monitoring ──────────────────────────────────────────────
        latest_checkpoint = IPMonitorCheckpoint.objects.filter(
            ip_monitor=OuterRef('pk')
        ).order_by('-created_at').values('status')[:1]

        ip_monitors = IPMonitor.objects.annotate(
            latest_status=Subquery(latest_checkpoint)
        )

        up_count = ip_monitors.filter(latest_status='Up').count()
        down_count = ip_monitors.filter(latest_status='Down').count()

        ip_stats = IPMonitor.objects.aggregate(total=Count('id'))

        # IP Priority + Latest Status breakdown
        ip_priority_status_stats = IPMonitor.objects.annotate(
            latest_status=Subquery(latest_checkpoint)
        ).values(
            'priority__priority_name',
            'latest_status'
        ).annotate(
            count=Count('uuid')
        ).order_by('priority__priority_name', 'latest_status')

        # Build IPMonitor priority_dict
        ip_priority_dict = {}
        for stat in ip_priority_status_stats:
            priority_name = stat['priority__priority_name'] or 'No Priority'
            status_val = stat['latest_status'] or 'unknown'

            if priority_name not in ip_priority_dict:
                ip_priority_dict[priority_name] = {'up': 0, 'down': 0, 'total': 0}

            ip_priority_dict[priority_name][status_val.lower()] = stat['count']
            ip_priority_dict[priority_name]['total'] += stat['count']

        # Format final IPMonitor priority_data
        total_ips = ip_stats['total'] or 1
        ip_priority_data = []
        for priority_name, stats in ip_priority_dict.items():
            percent = round((stats['total'] / total_ips * 100), 2)
            ip_priority_data.append({
                'priority': priority_name,
                'count': stats['total'],
                'percentage': percent,
                'status': {
                    'up': stats.get('up', 0),
                    'down': stats.get('down', 0),
                }
            })

        # ── 5. Final Response ─────────────────────────────────────────────
        response_data = {
            "devices": {
                "total": devices_stats['total'],
                "status": {
                    "Active": devices_stats['active'],
                    "Inactive": devices_stats['inactive'],
                },
                "health_status": {
                    "green": devices_stats['health_green'],
                    "amber": devices_stats['health_amber'],
                    "critical": devices_stats['health_red'],
                    "unknown": devices_stats['health_unknown'],
                },
                "maintenance": {
                    "in_maintenance": devices_stats['in_maintenance'],
                    "not_in_maintenance": devices_stats['total'] - devices_stats['in_maintenance'],
                },
                "os": {
                    "linux": devices_stats['linux'],
                    "windows": devices_stats['windows'],
                    "others": devices_others,
                },
                "types": {
                    "physical_machine": device_type['physical'],
                    "virtual_machine": device_type['virtual'],
                },
                "priority_breakdown": priority_data,
            },
            "ip_monitoring": {
                "total": ip_stats['total'],
                "status": {
                    "up": up_count,
                    "down": down_count,
                },
                "ip_priority_breakdown": ip_priority_data,
            }
        }

        return Response(response_data)

    except Exception as e:
        print(f"Dashboard error: {str(e)}")
        return Response({
            "error": "Failed to load dashboard stats",
            "message": str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
