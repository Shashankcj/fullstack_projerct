from rest_framework.response import Response
from rest_framework import status
from BaseApp.models import WebUser
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
@api_view(['POST'])
@permission_classes([AllowAny])
def check_username(request):
    """
    Validates the username to ensure it meets specific criteria.
    """
    username = request.data.get('username')
    if not username:
        return Response({'error': 'Username is required'}, status=status.HTTP_400_BAD_REQUEST)
    if WebUser.objects.filter(username__iexact=username).exists():
        return Response({'available': False, 'message': 'This username is already exists.'})
    return Response({'available': True})

@api_view(['POST'])
@permission_classes([AllowAny])
def check_email(request):
    email = request.data.get('email')
    if not email:
        return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)
    if WebUser.objects.filter(email__iexact=email).exists():
            return Response({'available': False, 'message': 'This email is already registered.'})
    return Response({'available': True})