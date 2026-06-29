from rest_framework.views import APIView
from BaseApp.serializer import IPMonitorSerializer, IPMonitorCSVSerializer
from rest_framework.response import Response
from rest_framework import status
from django.http import Http404
import csv
import io
from BaseApp.models.ipmonitor import IPMonitor,IPMonitorCheckpoint
from django.db import transaction
from django.db.models import Q,Subquery,OuterRef
import ipaddress
import logging
import uuid
import os
import json
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from BaseApp.utils import JWTCookieAuthentication
from django.shortcuts import get_object_or_404
from django.db.models import Prefetch
from BaseApp.utils import check_permission
from rest_framework.decorators import authentication_classes
from BaseApp.models import PriorityGroup,AuditLog
from ipware import get_client_ip
from BaseApp.services.webapp_services.license_management_service.license_validation import validate_license_request
from BaseApp.models.jobs import Job
from django.conf import settings
settings.JOB_RESULTS_DIR.mkdir(parents=True, exist_ok=True)
logger = logging.getLogger('agent_monitoring')

class Pagination(PageNumberPagination):
    page_size = 10  
    page_size_query_param = 'page_size'
    max_page_size = 100
   
class IPMonitorView(APIView):   
    authentication_classes =[JWTCookieAuthentication]
    
    @check_permission(module="ip_monitoring",allowed_action="create")
    def post(self, request):
        """Handle JSON or CSV upload for IPMonitor entries"""
        content_type = request.content_type
        if 'application/json' in content_type:
            return self._handle_json(request)
        elif 'multipart/form-data' in content_type:
            return self._handle_csv_upload(request)
        else:   
            return Response(
                {"error": "Unsupported Content-Type. Use application/json or multipart/form-data."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
    def _handle_json(self, request):
        try:
            # license_ok, msg = validate_license_request(resource="ip_monitor",new_items_count=1)
            # if not license_ok:
            #     return Response({"error": msg}, status=status.HTTP_403_FORBIDDEN)
            
            ip_name=None
            serializer = IPMonitorSerializer(data=request.data,context={'request': request})
            if serializer.is_valid():
              
                ip_address = serializer.validated_data.get('ip_address', 'Unknown')
                ip_name = serializer.validated_data.get('name','Unknown')
                serializer.save()
            
                cleint_ip,routable=get_client_ip(request)
            
                AuditLog.objects.create(
                    user=request.user,  
                    action='IP ADDED',
                    model_name='IPMonitor',
                    description=f"IP '{ip_name}' ({ip_address}) added successfully.",
                    ip=cleint_ip
                )
                return Response(
                    {"message": "IP Monitoring entry created successfully", "data": serializer.data}, 
                    status=status.HTTP_201_CREATED
                )
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"JSON upload error: {e}", exc_info=True)
            return Response(
                {"error": f"Upload failed: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
                
    def _handle_csv_upload(self, request, mode="create"):
        csv_job = None
        try:
            serializer = IPMonitorCSVSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

            csv_file = serializer.validated_data['csv_file']

            csv_job = Job.objects.create(
                user=str(request.user),
                job_type=f"ip_monitor_{mode}",
                status="pending"
            )

            decoded_file = csv_file.read().decode('utf-8')
            reader = csv.DictReader(io.StringIO(decoded_file))

            # ===============================
            # COMMON COLLECTIONS
            # ===============================
            instance_tocreate = []
            instances_toupdate = []

            audit_logs_data = []          # created IPs
            updated_ips = []              # updated IPs

            duplicates_in_csv = []
            duplicates_in_db = []
            not_found_in_db = []
            errors = []

            seen_ips = set()
            row_num = 1

            existing_ips = set(
                IPMonitor.objects.values_list('ip_address', flat=True)
            )

            ip_map = {
                ip.ip_address: ip
                for ip in IPMonitor.objects.select_related("priority")
            }

            PRIORITY_MAP = {
                "p1": "p1", "priority 1": "p1",
                "p2": "p2", "priority 2": "p2",
                "p3": "p3", "priority 3": "p3",
                "p4": "p4", "priority 4": "p4",
                "np": "np", "": "np",
            }

            priority_cache = {}

            # ===============================
            # CSV LOOP
            # ===============================
            for row in reader:
                row_num += 1
                try:
                    name = row.get('name', '').strip()
                    ip_address = row.get('ip_address', '').strip()
                    priority_raw = row.get("priority")
                    priority_key = priority_raw.strip().lower() if priority_raw else "np"

                    if not name or not ip_address:
                        errors.append(f"Row {row_num}: 'name' and 'ip_address' are required.")
                        continue

                    ipaddress.ip_address(ip_address)

                    if ip_address in seen_ips:
                        duplicates_in_csv.append({
                            "row": row_num,
                            "ip": ip_address,
                            "name": name
                        })
                        continue

                    seen_ips.add(ip_address)

                    priority_code = PRIORITY_MAP.get(priority_key)
                    if not priority_code:
                        errors.append(f"Row {row_num}: Invalid priority '{priority_raw}'")
                        continue

                    if priority_code not in priority_cache:
                        priority_cache[priority_code], _ = PriorityGroup.objects.get_or_create(
                            priority_name=priority_code
                        )

                    priority_obj = priority_cache[priority_code]

                    # ===============================
                    # CREATE MODE
                    # ===============================
                    if mode == "create":
                        if ip_address in existing_ips:
                            duplicates_in_db.append({
                                "row": row_num,
                                "ip": ip_address,
                                "name": name
                            })
                            continue

                        audit_logs_data.append({
                            "row": row_num,
                            "name": name,
                            "ip_address": ip_address
                        })

                        instance_tocreate.append(
                            IPMonitor(
                                name=name,
                                ip_address=ip_address,
                                priority=priority_obj
                            )
                        )

                    # ===============================
                    # UPDATE MODE
                    # ===============================
                    else:
                        if ip_address not in ip_map:
                            not_found_in_db.append({
                                "row": row_num,
                                "ip_address": ip_address
                            })
                            continue

                        ip_obj = ip_map[ip_address]

                        updated_ips.append({
                            "row": row_num,
                            "ip_address": ip_address,
                            "old_name": ip_obj.name,
                            "new_name": name,
                            "old_priority": ip_obj.priority.priority_name,
                            "new_priority": priority_code
                        })

                        ip_obj.name = name
                        ip_obj.priority = priority_obj
                        instances_toupdate.append(ip_obj)

                except ValueError:
                    errors.append(f"Row {row_num}: Invalid IP address '{ip_address}'")

            # ===============================
            # DB SAVE
            # ===============================
            affected_count = 0

            with transaction.atomic():

                if mode == "create" and instance_tocreate:
                    # license_ok, msg = validate_license_request(
                    #     resource="ip_monitor",
                    #     new_items_count=len(instance_tocreate)
                    # )
                    # if not license_ok:
                    #     return Response({"error": msg}, status=status.HTTP_403_FORBIDDEN)

                    IPMonitor.objects.bulk_create(
                        instance_tocreate,
                        ignore_conflicts=True,
                        batch_size=1000
                    )
                    affected_count = len(instance_tocreate)

                if mode == "update" and instances_toupdate:
                    IPMonitor.objects.bulk_update(
                        instances_toupdate,
                        fields=["name", "priority"],
                        batch_size=1000
                    )
                    affected_count = len(instances_toupdate)

            # ===============================
            # AUDIT LOG
            # ===============================
            if affected_count:
                client_ip, _ = get_client_ip(request)
                AuditLog.objects.create(
                    user=request.user,
                    action=f"BULK_IP_CSV_{mode.upper()}",
                    model_name="IPMonitor",
                    description=f"Bulk CSV {mode}: {affected_count} IPs",
                    ip=client_ip
                )

            # ===============================
            # JOB UPDATE
            # ===============================
            csv_job.total_rows = row_num - 1
            csv_job.error_count = len(errors)

            if mode == "create":
                csv_job.created_count = affected_count
            else:
                csv_job.updated_count = affected_count

            csv_job.status = "partial" if (errors or duplicates_in_db or not_found_in_db) else "completed"
            csv_job.save()

          
            file_path = settings.JOB_RESULTS_DIR / f"job_{csv_job.uuid}.json"

            json_result = {
                "mode": mode,
                "summary": {
                    "total_rows": row_num - 1,
                    "created": affected_count if mode == "create" else 0,
                    "updated": affected_count if mode == "update" else 0,
                    "duplicates_in_csv": len(duplicates_in_csv),
                    "duplicates_in_database": len(duplicates_in_db),
                    "not_found_in_database": len(not_found_in_db),
                    "errors": len(errors),
                },

                # CREATE
                "created_ips": audit_logs_data if mode == "create" else [],

                # UPDATE
                "updated_ips": updated_ips if mode == "update" else [],
                "not_found_in_database_details": not_found_in_db,

                # COMMON
                "duplicates_in_csv_details": duplicates_in_csv,
                "duplicates_in_database_details": duplicates_in_db,
                "error_details": errors,
            }

            with open(file_path, "w") as f:
                json.dump(json_result, f, indent=2)

            response_data = {
                "message": (
                    f"Successfully created {affected_count} IP Monitor entries."
                    if mode == "create" and affected_count > 0
                    else (
                        f"Successfully updated {affected_count} IP Monitor entries."
                        if mode == "update" and affected_count > 0
                        else "No new IP Monitor entries were created."
                    )
                ),
                "created": affected_count if mode == "create" else 0,
                "total_rows": row_num - 1,
                "duplicates_in_csv": len(duplicates_in_csv),
                "duplicates_in_database": len(duplicates_in_db),
            }

            return Response(
                response_data,
                status=status.HTTP_201_CREATED if affected_count else status.HTTP_200_OK
            )
        except Exception as e:
            logger.error(f"CSV upload error: {e}", exc_info=True)
            if csv_job:
                csv_job.status = "failed"
                csv_job.save(update_fields=["status"])

            return Response(
                {"error": f"Upload failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
            
    @check_permission(module="ip_monitoring",allowed_action="read")     
    def get(self, request):
        try:
          # Get latest checkpoint for each IP monitor using subquery
            latest_checkpoint = IPMonitorCheckpoint.objects.filter(
                ip_monitor=OuterRef('pk')
            ).order_by('-created_at')
            
            # Annotate IP monitors with latest checkpoint data
            ip_monitors = IPMonitor.objects.annotate(
            status=Subquery(latest_checkpoint.values('status')[:1]),
            min_latency=Subquery(latest_checkpoint.values('min_latency')[:1]),
            max_latency=Subquery(latest_checkpoint.values('max_latency')[:1]),
            jitter=Subquery(latest_checkpoint.values('jitter')[:1]),
            created_at=Subquery(latest_checkpoint.values('created_at')[:1])
            ).all()
            
            search_query=request.query_params.get('search','')
            status_filter=request.query_params.get('status','')
            priority_filter=request.query_params.get('priority','')
            if search_query:
                ip_monitors=ip_monitors.filter(
                Q(status__icontains=search_query) |
                Q(ip_address__icontains=search_query) |
                Q(name__icontains=search_query) |
                Q(priority__priority_name__icontains=search_query) 
                ).distinct()
                
            if status_filter:
                ip_monitors=ip_monitors.filter(Q(status__icontains=status_filter))  
            if priority_filter:
                ip_monitors=ip_monitors.filter(Q(priority__priority_name__icontains=priority_filter))  
                
            pageinator=Pagination()
            page=pageinator.paginate_queryset(ip_monitors, request)
            serializer = IPMonitorSerializer(page, many=True)
            return pageinator.get_paginated_response(serializer.data)
        except Exception as e:
            logger.error(f"Error fetching IP Monitor entries: {e}", exc_info=True)
            return Response(
                {"error": f"Failed to retrieve entries: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
            
    @check_permission(module="ip_monitoring", allowed_action="update")
    def patch(self, request):
        try:
            content_type = request.content_type

            if 'multipart/form-data' in content_type:
                return self._handle_csv_upload(request, mode="update")

            data = request.data
            
            if isinstance(data, list):
                return self._bulk_update_ipmonitors(request, data)
            else:
                return self._single_update_ipmonitor(request, data)

        except Http404:
            logger.error("IPMonitor not found")
            return Response(
                {"error": "IPMonitor not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error updating IP Monitor entry: {e}", exc_info=True)
            return Response(
                {"error": f"Update failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            
            
    def _single_update_ipmonitor(self, request, data):
        """Handle single IPMonitor update - Priority direct, others via serializer"""
        uuid = data.get('uuid')
        if not uuid:
            raise Http404("UUID required")

        logger.info(f"Updating IP UUID {uuid}")
        ipmonitor = get_object_or_404(IPMonitor, uuid=uuid)
        
        old_ip_address = ipmonitor.ip_address
        old_name = ipmonitor.name
        old_priority = ipmonitor.priority.priority_name
        client_ip, _ = get_client_ip(request)
        changes = []

        # PRIORITY: Handle DIRECTLY (no serializer)
        priority_value = data.pop('priority', None)  # Remove from data!
        if priority_value:
            priority_group = PriorityGroup.objects.get(priority_name=priority_value)
            ipmonitor.priority = priority_group
            ipmonitor.save()
            if old_priority != priority_value:
                changes.append(f"Priority: from '{old_priority}' to '{priority_value}'")

            # Priority audit log
            AuditLog.objects.create(
                user=request.user,
                action='IP_PRIORITY_UPDATED',
                model_name='IPMonitor',
                description=f"IP Priority Update: {changes[-1]}",
                ip=client_ip,
            )

        # 2️ OTHER FIELDS: Use serializer (name, ip_address, etc.)
        serializer = IPMonitorSerializer(ipmonitor, data=data, partial=True)
        
        if serializer.is_valid():
            serializer.save()
            
            # Detect changes from serializer fields
            new_ip_address = serializer.validated_data.get('ip_address', old_ip_address)
            new_name = serializer.validated_data.get('name', old_name)
            
            if old_ip_address != new_ip_address:
                changes.append(f"IP: '{old_ip_address}' → '{new_ip_address}'")
            if old_name != new_name:
                changes.append(f"Name: '{old_name}' → '{new_name}'")
            
            # Main update audit log (non-priority changes)
            if changes and 'Priority' not in changes[0]:  # Skip if only priority changed
                AuditLog.objects.create(
                    user=request.user,
                    action='IP_UPDATED',
                    model_name='IPMonitor',
                    description=" | ".join(changes),
                    ip=client_ip,
                )
            
            return Response({
                "message": "IP Monitor updated successfully", 
                "data": serializer.data
            }, status=status.HTTP_200_OK)
        
        logger.warning(f"Serializer Errors: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

            
    def _bulk_update_ipmonitors(self, request, data):
        """Handle bulk IPMonitor updates"""
        results = {'success': [], 'errors': [], 'updated_count': 0}
        
        for item in data:
            uuid = item.get('uuid')
            priority_value = item.get('priority')
            
            if not uuid or not priority_value:
                results['errors'].append({
                    'uuid': uuid or 'missing',
                    'error': 'Missing uuid or priority'
                })
                continue
            
            try:
                # Get IPMonitor
                ipmonitor = IPMonitor.objects.get(uuid=uuid)
                if priority_value:
                    
                    priority_group=PriorityGroup.objects.get(priority_name=priority_value)
                    # Update priority
                    ipmonitor.priority = priority_group
                    ipmonitor.save()
                    
                    results['success'].append({
                        'uuid': str(uuid),
                        'priority': priority_value,
                        'priority_group': priority_group.priority_name
                    })
                results['updated_count'] += 1
                
            except IPMonitor.DoesNotExist:
                results['errors'].append({
                    'uuid': str(uuid),
                    'error': 'IPMonitor not found'
                })
            except PriorityGroup.DoesNotExist:
                results['errors'].append({
                    'uuid': str(uuid),
                    'error': f'Priority "{priority_value}" not found'
                })
        
        return Response({
            'message': f'Bulk update completed ({results["updated_count"]} updated)',
            'results': results
        }, status=status.HTTP_200_OK)

    @check_permission(module="ip_monitoring",allowed_action="delete")  
    def delete(self, request):
        try:
            requested_uuid = request.data.get('uuid', None)
            if not requested_uuid:
                return Response(
                     {"error": "UUID is required for deletion."}, 
                     status=status.HTTP_400_BAD_REQUEST
                )
            if isinstance(requested_uuid, str):
                requested_uuid = [requested_uuid]
            else:
                requested_uuid = list(requested_uuid)
                
            valid_uuids = []
            for uid in requested_uuid:
                try:
                    valid_uuids.append(uuid.UUID(str(uid)))
                except (ValueError, TypeError):
                    logger.warning(f"Invalid UUID skipped: {uid}")
            if not valid_uuids:
                return Response(
                    {"error": "No valid UUIDs provided for deletion."}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            client_ip, _ = get_client_ip(request)    
            ips=IPMonitor.objects.filter(uuid__in=valid_uuids)
            if not ips.exists():
                return Response(
                    {"error": "No IP Monitor entries found for the provided UUIDs."}, 
                    status=status.HTTP_404_NOT_FOUND
                )
            count=ips.count()
            ip_names = [ip.name for ip in ips]
            ip_addresses = [ip.ip_address for ip in ips]
            
            AuditLog.objects.create(
                user=request.user,
                action='IP_DELETED',
                model_name='IPMonitor',
                description=f"Deleted {count}: {ip_addresses} IPs: {ip_names[:5]}{'...' if len(ip_names)>5 else ''}",
               
                ip=client_ip,
            )
            ips.delete()
            return Response(
                {"message": f"Successfully deleted {count} IP Monitor entries."}, 
                status=status.HTTP_200_OK
            )
        except Exception as e:
            logger.error(f"Error deleting IP Monitor entries: {e}", exc_info=True)
            return Response(
                {"error": f"Deletion failed: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
           
        