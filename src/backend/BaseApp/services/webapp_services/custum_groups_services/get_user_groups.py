      
from rest_framework.response import Response
from django.utils import timezone
from ....serializer import UserGroupsSerializer
from ....models import Group

def get_user_groups(request):
    """Get all groups for the authenticated user using serializers"""
    try:
        user = request.user
        
        # Get all groups for this user with related data
        user_groups = Group.objects.filter(user=user).prefetch_related(
            'agent_assignments__agent'
        )
        
        # Build the complete response data
        response_data = {
            'groups': user_groups,  # Pass queryset, not serialized data
            'timestamp': timezone.now()
        }
        
        # Use UserGroupsSerializer to validate and serialize the entire response
        serializer = UserGroupsSerializer(
            response_data,
            context={'request': request}
        )
        
        return Response({
            'success': True,
            **serializer.data
        })
        
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=500)
