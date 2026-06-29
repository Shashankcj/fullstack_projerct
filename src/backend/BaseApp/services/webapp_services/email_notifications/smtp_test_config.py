# BaseApp/services/webapp_services/global_config/test_smtp_view.py
from rest_framework.response import Response
from rest_framework import status
from django.utils.decorators import method_decorator
from BaseApp.utils import check_permission
from BaseApp.utils import JWTCookieAuthentication
import logging
from BaseApp.models.global_config import GlobalConfig
from .Sendemail_service import EmailService
from .Emailtemplates import EmailTemplates
from rest_framework.decorators import api_view
logger = logging.getLogger("agent_monitoring")

@api_view(['POST'])
@check_permission(module='globalconfig', allowed_action='update')
def test_email_configuration(request):
    """
    Test SMTP configuration

    """
    try:

        data = request.data
        
        #  Extract test email properly
        to_email = (
            data.get('test_email') 
        )
        logger.info(f"Using test email: {to_email}")

      

        cleaned_dict=GlobalConfig.get_smtp_config()
        logger.info(f"Testing SMTP configuration with: {cleaned_dict}")

        subject,html_context,plain_Ttext=EmailTemplates.get_smtp_test_email(cleaned_dict,to_email)

        result=EmailService.send_email(
            to_emails = to_email,
            html_content=html_context,
            plain_text=plain_Ttext,
            subject=subject
        )
        
        if not result['success']:
            return Response({
                'success': False,
                'message': 'SMTP connection failed',
                'error': result['error'],
                'step_failed': 'connection',
            }, status=status.HTTP_502_BAD_GATEWAY)
        
        # Test sending email
        elif result['success']:
            return Response({
                'success': True,
                'message': 'SMTP Email test configuration successful!',
                'details': {
                    'connection': 'Success',
                    'authentication': 'Success',
                    'email_sent': 'Success',
                }

            }, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f" SMTP test error: {e}", exc_info=True)
        return Response({
            'success': False,
            'message': 'An unexpected error occurred',
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

