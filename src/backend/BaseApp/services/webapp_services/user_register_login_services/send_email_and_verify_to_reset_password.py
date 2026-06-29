
from rest_framework import status
from rest_framework.response import Response
from django.conf import settings
from BaseApp.models import WebUser
import jwt,datetime
from urllib.parse import quote
import logging
from BaseApp.services.webapp_services.email_notifications.Emailtemplates import EmailTemplates
from ..email_notifications.Sendemail_service import EmailService
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from BaseApp.models import GlobalConfig

HOST=settings.ALLOWED_HOSTS[0]
logger = logging.getLogger("agent_monitoring")

# token generation for password reset
def generate_password_reset_token(user):
    payload = {
        "user_id": str(user.id),
        "email": user.email,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=15),  # expiry in 15 mins
        "iat": datetime.datetime.utcnow(),
        "purpose": "password_reset"
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm='HS256')
    return token

@api_view(['POST'])
@permission_classes([AllowAny])
def sendemail_to_reset_password(request):
    try:
        email = request.data.get('email')
        if not email:
            return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Check if email exists
        if not WebUser.objects.filter(email=email).exists():
            return Response({'error': 'No user found with this email.'}, status=status.HTTP_404_NOT_FOUND)
        try:
            user = WebUser.objects.get(email=email)
        except WebUser.DoesNotExist:
            return Response({"error": "User with this email does not exist."}, status=status.HTTP_404_NOT_FOUND)
        
        try:
            user = WebUser.objects.get(email=email)
            token = generate_password_reset_token(user)
            token_encoded = quote(token)
            reset_link = f"https://{HOST}/app/reset-password/{user.id}?token={token_encoded}"
        except Exception as e:
            return Response({'error': 'Failed to generate reset token. Please try again later.'},status=status.HTTP_500_INTERNAL_SERVER_ERROR) 
        
        try:
            html_content, plain_text, subject=EmailTemplates.get_password_reset_email_template(email=user.email, reset_link=reset_link)
            
            success=EmailService.send_email([user.email],html_content,plain_text,subject)
            
        except Exception as e:
            return Response(
                {'error': 'Failed to send email. Please Try again later.'},status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        if success:
            return Response({'message': 'Reset email sent successfully.'},status=status.HTTP_200_OK)
        else:
            return Response(
                {'error': 'Failed to send reset email. Please try again later.'},status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except Exception as e:
        return Response({'error': 'An error occurred. Please try again later.'},status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def verify_reset_password_token(request):
    """
    Verify the reset password token before allowing password reset.
    Returns validation status without modifying user state.
    """
    try:
        # Decode the token
        token = request.query_params.get('token')
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
        
        # Check token purpose (optional but recommended for security)
        if payload.get('purpose') != 'password_reset':
            return Response(
                {"valid": False, "error": "Invalid token purpose"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verify user exists
        user_id = payload.get('user_id')
        user = WebUser.objects.get(id=user_id)
        
        # Token is valid
        return Response(
            {"valid": True, "message": "Token verified successfully"}, 
            status=status.HTTP_200_OK
        )
        
    except jwt.ExpiredSignatureError:
        return Response(
            {"valid": False, "error": "Reset password link expired"}, 
            status=status.HTTP_401_UNAUTHORIZED
        )
    except jwt.InvalidTokenError:
        return Response(
            {"valid": False, "error": "Invalid token"}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    except WebUser.DoesNotExist:
        return Response(
            {"valid": False, "error": "User not found"}, 
            status=status.HTTP_404_NOT_FOUND
        )

   