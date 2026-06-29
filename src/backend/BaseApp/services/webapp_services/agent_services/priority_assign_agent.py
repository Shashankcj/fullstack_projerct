from rest_framework.decorators import api_view, permission_classes,authentication_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from BaseApp.models import Agent, PriorityGroup
from BaseApp.utils import JWTCookieAuthentication
from BaseApp.serializer import IPMonitorCSVSerializer
import csv
import io

# @api_view(['PATCH'])
# @authentication_classes([JWTCookieAuthentication])
# @permission_classes([IsAuthenticated])
# def update_agent_priority(request):
#     """
#     Single OR Bulk priority update:
#     # Single
#     {"agent_uuid": "uuid1", "priority": "p1"}
    
#     # Bulk  
#     [
#         {"agent_uuid": "uuid1", "priority": "p1"},
#         {"agent_uuid": "uuid2", "priority": "p2"}
#     ]
#     """
#     try:
#         data = request.data
    
#         # Handle single assignment (dict)
#         if isinstance(data, dict):
#             data = [data]
        
#         if not isinstance(data, list):
#             return Response({'error': 'Expected object or array'}, status=status.HTTP_400_BAD_REQUEST)
        
#         results = {
#             'success': [],
#             'errors': [],
#             'updated_count': 0
#         }
        
#         for assignment in data:
#             agent_uuid = assignment.get('agent_uuid')
#             priority_value = assignment.get('priority')
            
#             if not agent_uuid or not priority_value:
#                 results['errors'].append({
#                     'agent_uuid': agent_uuid or 'missing',
#                     'error': 'Missing agent_uuid or priority'
#                 })
#                 continue
#             try:
#                 agent = Agent.objects.get(uuid=agent_uuid)
#                 priority_group = PriorityGroup.objects.get(priority_name=priority_value)
                
#                 agent.priority = priority_group
#                 agent.save()
                
#                 results['success'].append({
#                     'agent_uuid': str(agent_uuid),
#                     'priority': priority_value,  # "p1"
#                     'priority_display': dict(priority_group.Priority_Choice)[priority_value]  # "Priority 1 (P1)"
#                 })
#                 results['updated_count'] += 1
                
#             except Agent.DoesNotExist:
#                 results['errors'].append({
#                     'agent_uuid': str(agent_uuid),
#                     'error': 'Agent not found'
#                 })
#             except PriorityGroup.DoesNotExist:
#                 results['errors'].append({
#                     'agent_uuid': str(agent_uuid),
#                     'error': f'Priority group "{priority_value}" not found'
#                 })
        
#         status_code = status.HTTP_200_OK if results['updated_count'] > 0 else status.HTTP_400_BAD_REQUEST
#         return Response({
#             'message': f'Priority assignment completed ({results["updated_count"]} updated)',
#             'results': results
#         }, status=status_code)
        
#     except Exception as e:
#         return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

def process_priority_updates(assignments):
    results = {
        "success": [],
        "errors": [],
        "updated_count": 0,
    }

    for item in assignments:
        agent = item.get("agent")
        priority_value = item.get("priority")

        if not agent or not priority_value:
            results["errors"].append({
                "agent_uuid": str(getattr(agent, "uuid", "missing")),
                "error": "Missing agent or priority",
            })
            continue

        try:
            priority_group = PriorityGroup.objects.get(
                priority_name=priority_value
            )

            agent.priority = priority_group
            agent.save(update_fields=["priority"])

            results["success"].append({
                "agent_uuid": str(agent.uuid),
                "priority": priority_value,
                "priority_display": dict(priority_group.Priority_Choice)[priority_value],
            })
            results["updated_count"] += 1

        except PriorityGroup.DoesNotExist:
            results["errors"].append({
                "agent_uuid": str(agent.uuid),
                "error": f'Priority "{priority_value}" not found',
            })

    return results

@api_view(["PATCH"])
@authentication_classes([JWTCookieAuthentication])
@permission_classes([IsAuthenticated])
def update_agent_priority(request):
    data = request.data

    if isinstance(data, dict):
        data = [data]

    if not isinstance(data, list):
        return Response(
            {"error": "Expected object or array"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    assignments = []

    for item in data:
        try:
            agent = Agent.objects.get(uuid=item.get("agent_uuid"))
            assignments.append({
                "agent": agent,
                "priority": item.get("priority"),
            })
        except Agent.DoesNotExist:
            assignments.append({
                "agent": None,
                "priority": item.get("priority"),
                "error": f'Agent not found for uuid {item.get("agent_uuid")}',
            })

    results = process_priority_updates(assignments)

    return Response(
        {
            "message": f'Priority assignment completed ({results["updated_count"]} updated)',
            "results": results,
        },
        status=status.HTTP_200_OK if results["updated_count"] else status.HTTP_400_BAD_REQUEST,
    )
    
@api_view(["POST"])
@authentication_classes([JWTCookieAuthentication])
@permission_classes([IsAuthenticated])
def update_agent_priority_csv(request):
    # 1) Validate file
    serializer = IPMonitorCSVSerializer(
        data=request.data,
    )
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)

    csv_file = serializer.validated_data["csv_file"]

    # reset pointer (important)
    csv_file.seek(0)

    # 2) Mode switch
    validate_only = (
        str(request.query_params.get("validate_only", "false")).lower() == "true"
        or str(request.data.get("validate_only", "false")).lower() == "true"
    )

    decoded = csv_file.read().decode("utf-8")
    reader = csv.DictReader(io.StringIO(decoded))

    assignments = []
    validation_errors = []
    row_count = 0

    for row_no, row in enumerate(reader, start=2):
        row_count += 1

        hostname = row.get("hostname")
        ip_address=row.get("ip_address")
        priority = row.get("priority")

        if not hostname or not priority or not ip_address:
            validation_errors.append(
                f"Row {row_no}: hostname or priority or ip_address missing"
            )
            continue

        if not PriorityGroup.objects.filter(priority_name=priority).exists():
            validation_errors.append(
                f"Row {row_no}: invalid priority '{priority}'"
            )
            continue

        try:
            agent = Agent.objects.get(hostname=hostname)
            assignments.append({
                "agent": agent,
                "priority": priority,
            })
        except Agent.DoesNotExist:
            validation_errors.append(
                f'Row {row_no}: Agent not found for hostname "{hostname}"'
            )
        except Agent.MultipleObjectsReturned:
            validation_errors.append(
                f'Row {row_no}: Multiple agents found for hostname "{hostname}"'
            )

    # 3) VALIDATE ONLY
    if validate_only:
        return Response(
            {
                "mode": "validate_only",
                "total_rows": row_count,
                "valid_rows": len(assignments),
                "errors": validation_errors,
            },
            status=200,
        )

    # 4) UPDATE
    results = process_priority_updates(assignments)

    return Response(
        {
            "mode": "update",
            "message": f'CSV priority update completed ({results["updated_count"]} updated)',
            "validation_errors": validation_errors,
            "results": results,
        },
        status=status.HTTP_200_OK if results["updated_count"] else status.HTTP_400_BAD_REQUEST,
    )