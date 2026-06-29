# views.py
from rest_framework.response import Response    
from django.db import transaction
from ....models import Group, GroupAgentAssignment, Agent

def save_user_groups(request):
    """Save groups using foreign key relationships"""
    try:
        data = request.data
        user = request.user  
        groups_data = data.get('groups', [])
        saved_groups = []

        with transaction.atomic():
            for group_data in groups_data:
                group, created = Group.objects.update_or_create(
                    user=user,
                    group_id=group_data['group_id'],
                    defaults={
                        'group_name': group_data['group_name'],
                        'group_description': group_data.get('group_description', ''),
                    }
                )

                # Clear existing agent assignments for this group
                GroupAgentAssignment.objects.filter(group=group).delete()

                # Add new agent assignments for devices
                for device_data in group_data.get('devices', []):
                    print("Processing device data:", device_data)
                    try:
                        agent = Agent.objects.get(uuid=device_data['uuid'])
                        print("Agent found:", agent)
                        # Create GroupAgentAssignment
                        GroupAgentAssignment.objects.create(
                            group=group,
                            agent=agent,
                            # priority=device_data['priority']
                        )
                    except Agent.DoesNotExist:
                        continue

                saved_groups.append({
                    'group_id': group.group_id,
                    'group_name': group.group_name,
                    'created': created
                })
        return Response({
            'success': True,
            'message': f'Successfully saved {len(saved_groups)} groups',
            'groups': saved_groups
        })

    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=500)
        
        

  