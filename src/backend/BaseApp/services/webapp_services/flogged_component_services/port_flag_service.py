
from BaseApp.wss_services.services.nic_flag_service import PortFlagService
from rest_framework.response import Response 
from rest_framework import status

def flagged_port_devices(request):
    """
    GET: Returns all flagged port devices with Port model details
    PATCH: Mark port as viewed by providing uuid in request body
    """

    if request.method == 'GET':
        try:
            # Check if stats are requested
            if request.query_params.get('stats') == 'true':
                stats = PortFlagService.get_flagged_port_stats()
                return Response({
                    'success': True,
                    'data': stats
                }, status=status.HTTP_200_OK)

            # Check for port type filtering
            port_type = request.query_params.get('port_type')  # physical or logical
            logical_type = request.query_params.get('logical_type')  # bridge, vlan, etc.
            unviewed_only = request.query_params.get('unviewed_only', 'false').lower() == 'true'

            if port_type and logical_type:
                # Filter by both port type and logical type
                flagged_devices = PortFlagService.get_flagged_ports_by_type_and_logical(
                    port_type, logical_type, unviewed_only=unviewed_only
                )
            elif port_type:
                # Filter by port type only
                flagged_devices = PortFlagService.get_flagged_ports_by_type(
                    port_type, unviewed_only=unviewed_only
                )
            else:
                # Get all flagged ports
                flagged_devices = PortFlagService.get_flagged_port_devices(
                    unviewed_only=unviewed_only
                )

            # Ensure a consistent structure for frontend
            return Response({
                'success': True,
                'data': flagged_devices,
                'count': len(flagged_devices),
                'message': f'Found {len(flagged_devices)} flagged port devices'
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e),
                'data': [],
                'count': 0
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    elif request.method == 'PATCH':
        # Handle marking as viewed
        try:
            entity_uuid = request.data.get('uuid')
            action = request.data.get('action')  # 'mark_viewed' or 'mark_unviewed'

            if not entity_uuid:
                return Response({
                    'success': False,
                    'error': 'uuid is required'
                }, status=status.HTTP_400_BAD_REQUEST)

            if action not in ['mark_viewed', 'mark_unviewed']:
                return Response({
                    'success': False,
                    'error': 'action must be either "mark_viewed" or "mark_unviewed"'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Mark the port as viewed/unviewed - simplified without user authentication
            if action == 'mark_viewed':
                success = PortFlagService.mark_port_as_viewed(entity_uuid, user=None)
                message = 'Port device marked as viewed successfully'
            else:
                success = PortFlagService.mark_port_as_unviewed(entity_uuid)
                message = 'Port device marked as unviewed successfully'

            if success:
                return Response({
                    'success': True,
                    'message': message,
                    'action': action,
                    'uuid': entity_uuid
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    'success': False,
                    'error': 'Port device not found or not flagged'
                }, status=status.HTTP_404_NOT_FOUND)

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
