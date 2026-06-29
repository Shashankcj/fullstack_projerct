from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from ....models import Group

def delete_user_group(request, group_id):
    """Delete group and all related agent assignments automatically"""
    try:
        # Get the group owned by current user
        group = get_object_or_404(Group, group_id=group_id, user=request.user)
        
        group_name = group.group_name
        
        # This single line deletes the group AND all related assignments
        group.delete()  # Cascade delete happens automatically!
        
        return Response({
            'success': True,
            'message': f'Group "{group_name}" and all its agent assignments deleted successfully'
        })
        
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=500)
