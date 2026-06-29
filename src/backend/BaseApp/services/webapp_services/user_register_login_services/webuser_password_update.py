from django.contrib.auth.hashers import make_password
from rest_framework.response import Response
from rest_framework import status
from BaseApp.models import WebUser
from django.conf import settings
from datetime import datetime
import jwt
import logging
from ..email_notifications.Emailtemplates import EmailTemplates
from ..email_notifications.Sendemail_service import EmailService
from BaseApp.serializer import WebUserSerializer

logger=logging.getLogger('agent_monitoring')
def update_password(request):
    try:
        token = request.query_params.get('token')
        password = request.data.get('password')
        confirm_password = request.data.get('confirm_password')
        
        if token:
            # Token based flow (forgot password)
            try:
                payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
                if payload.get('purpose') != 'password_reset':
                    return Response({'error': 'Invalid token purpose'}, status=status.HTTP_400_BAD_REQUEST)
                user_id = payload.get('user_id')
                user = WebUser.objects.get(id=user_id)
            except jwt.ExpiredSignatureError:
                return Response({'error': 'Token has expired'}, status=status.HTTP_400_BAD_REQUEST)
            except (jwt.InvalidTokenError, WebUser.DoesNotExist):
                return Response({'error': 'Invalid token or user'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response({'error': 'Token required'}, status=status.HTTP_400_BAD_REQUEST)

        if not password:
            return Response({'error': 'New password is required'}, status=status.HTTP_400_BAD_REQUEST)
        data= {
            'password': password,
            'confirm_password': confirm_password
        }
        serializer=WebUserSerializer(user,data=data,partial=True,context={'request': request})
        logger.info(f"Updating password for user ID: {user.username}")
        if not serializer.is_valid():
            logger.error(f"Password update validation failed: {serializer.errors}")
            return Response({'error': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
    
        change_time = datetime.now().strftime('%B %d, %Y at %I:%M %p')

        # Track password change
        changes = {}
        if password:
            changes['password'] = {
                'old': None,  # Don't expose old password
                'new': '********',  # Mask new password
                'time': change_time
            }
        
        html_content,plain_content,subject=EmailTemplates.send_account_update_email(user=user, changes_dict=changes)
        success, message = EmailService.send_email([user.email], html_content, plain_content,subject)

        if success:
         return Response({'message': 'Password updated successfully'}, status=status.HTTP_200_OK)
        else:
            return Response({'error': f'Password updated but email failed: {message}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
    except Exception as e:
        logger.error(f"Error updating password: {str(e)}")
        return Response({'error': 'An error occurred while updating the password'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)