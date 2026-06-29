
# BaseApp/services/welcome_email_service.py
from django.core.mail import EmailMultiAlternatives
from django.conf import settings
import logging
from django.core.mail import get_connection
from smtplib import SMTPException

logger = logging.getLogger("agent_monitoring")
from BaseApp.models.global_config import GlobalConfig

class EmailService:
    @staticmethod
    def _open_connection(smtp_config):
        """
        Create a django email connection configured from smtp_cfg dict.
        """
        try: 
            # Extract values from database
            host = smtp_config.get('smtp.host', 'smtp.gmail.com')
            port = int(smtp_config.get('smtp.port', 587))
            username = smtp_config.get('smtp.username', '')
            password = smtp_config.get('smtp.password', '')
            encryption = smtp_config.get('smtp.encryption_type', 'TLS')

            # choose backend and TLS/SSL flags as needed
            # We'll use SMTP backend and pass tls flag
            backend = "django.core.mail.backends.smtp.EmailBackend"
            connection = get_connection(
                backend=backend,
                host=host,
                port=port,
                username=username,
                password=password,
                use_tls=encryption,
                fail_silently=False
            )
            return connection
        except (ValueError, TypeError) as e:
            logger.error(f" Invalid SMTP configuration: {e}", exc_info=True)
        except Exception as e:
            logger.error(f" Failed to create SMTP connection: {e}", exc_info=True)
            raise

    @staticmethod
    def send_email(to_emails,html_content,plain_text,subject,cc_emails=None):
        """
        Send verification email with HTML and plain text content
        
        Args:
            user: User object with email and username attributes
            html_content (str): HTML version of email
            plain_text (str): Plain text version of email
            
        Returns:
            tuple: (success: bool, message: str)
        """
        connection = None
        logger.info(f"Preparing to send email to {to_emails} with subject '{subject}'")
        try:
          
            if not to_emails:
                return {
                    'success': False,
                    'error': 'No valid recipient email addresses'
                }
            
            if not subject:
                error_msg = "Email subject is required"
                return False, error_msg
         
            # Validate email content
            if not plain_text:
                error_msg = "Plain text email content is required"
                return False, error_msg
            
            # Get SMTP configuration from database
            logger.info(f"Preparing to send email to {to_emails}")
            smtp_config = GlobalConfig.get_smtp_config()
            
            if not smtp_config or not any(smtp_config.values()):
                error_msg = "SMTP configuration not found in database"
                logger.error(f" {error_msg}")
                return False, error_msg
            
            # Get connection
            connection = EmailService._open_connection(smtp_config)
            
            # Prepare email
            from_email = smtp_config.get('smtp.from_email')
           
            
            logger.info(f"Sending from: {from_email} to: {to_emails}")
            print(f"Email content preview - Subject: {subject}, To: {to_emails}, From: {from_email}")
            
            # Create email with both HTML and plain text
            email = EmailMultiAlternatives(
                subject=subject,
                body=plain_text,  # Plain text version
                from_email=from_email,
                to=to_emails,
                cc=cc_emails,
                connection=connection
            )
            
            # Attach HTML version if provided
            if html_content:
                email.attach_alternative(html_content, "text/html")
                logger.debug("HTML content attached to email")
            else:
                logger.warning("No HTML content provided, sending plain text only")
            
            # Send email
            result = email.send(fail_silently=False)
            
            if result == 1:
                logger.info(f"Email sent to {len(to_emails)} recipient(s)")
                print(f"Email sent to {len(to_emails)} recipient(s)")
                return {'success': True, 'error': None}
            else:
                print(f"Email sending failed, expected to send to {len(to_emails)} recipient(s) but got result: {result}")
                return {
                    'success': False,
                    'error': f'Expected {len(to_emails)} sent, got {result}'
                }
        except SMTPException as e:
            error_msg = str(e)
            logger.error(f" SMTP error: {error_msg}")
            
            if '535' in error_msg:
                error_msg = 'Authentication failed'
            elif '553' in error_msg:
                error_msg = 'Invalid recipient address'
            elif '550' in error_msg:
                error_msg = 'Recipient rejected'
            
            return {'success': False, 'error': error_msg}
    
        except Exception as e:
            logger.error(f"Error: {e}", exc_info=True)
            print(f"Unexpected error when sending email: {e}")
            return {'success': False, 'error': str(e)}