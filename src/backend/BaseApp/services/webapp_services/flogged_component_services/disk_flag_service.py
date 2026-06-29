
from BaseApp.wss_services.services.disk_flag_service import FlagService
from rest_framework.response import Response  
from rest_framework import status 

def flagged_storage_devices(request):
    """
    GET: Returns all flagged storage entities with Storage model details
    PATCH: Mark device as viewed by providing uuid in request body
    """
    if request.method == 'GET':
        try:
            # Check if stats are requested
            if request.query_params.get('stats') == 'true':
                stats = FlagService.get_flagged_storage_stats()
                return Response({
                    'success': True,
                    'data': stats
                }, status=status.HTTP_200_OK)

            # Check for unviewed_only filter
            unviewed_only = request.query_params.get('unviewed_only', 'false').lower() == 'true'
            
            # Get flagged devices with optional filtering
            if unviewed_only:
                flagged_devices = FlagService.get_flagged_storage_devices(unviewed_only=True)
            else:
                flagged_devices = FlagService.get_flagged_storage_devices()
                
            return Response({
                'success': True,
                'data': flagged_devices,
                'count': len(flagged_devices),
                'message': f'Found {len(flagged_devices)} flagged storage devices'
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
            action = request.data.get('action')

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

            # Simplified - just pass None for user for now
            if action == 'mark_viewed':
                success = FlagService.mark_storage_as_viewed(entity_uuid, user=None)
                message = 'Storage device marked as viewed successfully'
            else:
                success = FlagService.mark_storage_as_unviewed(entity_uuid)
                message = 'Storage device marked as unviewed successfully'

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
                    'error': 'Storage device not found or not flagged'
                }, status=status.HTTP_404_NOT_FOUND)

        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
