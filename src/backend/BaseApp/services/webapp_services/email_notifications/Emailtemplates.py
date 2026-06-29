
# BaseApp/services/email_service.py
from datetime import datetime
from django.utils.timezone import localtime
from django.conf import settings

HOST_IP= settings.ALLOWED_HOSTS[0]
import logging
logger=logging.getLogger("agent_monitoring")
logger.info(f"load ip from Allowed Host {HOST_IP}")

def get_support_contact_details():
    from BaseApp.models import GlobalConfig
    
    configs = {
        'support_email': None,
        'contact': None
    }
    
    try:
        configs['support_email'] = GlobalConfig.objects.get(
            item_key='alert.support_email'
        ).item_value
    except GlobalConfig.DoesNotExist:
        configs['support_email'] = 'support@company.com'
    
    try:
        configs['contact'] = GlobalConfig.objects.get(
            item_key='alert.contact'
        ).item_value
    except GlobalConfig.DoesNotExist:
        configs['contact'] = 'Admin Team'
    
    return configs

class EmailTemplates():
    @staticmethod
    def get_user_verification_email(user, verify_url, raw_password):
       
        """Simple professional HTML email template for admin verification"""
        subject = f"Verify Your Account - {user.username}"
        html_content = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Account Verification</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            
            <div style="border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px;">
                <h2 style="margin: 0; color: #000;">Genesis</h2>
                <p style="margin: 5px 0 0 0; color: #666;">Account Verification</p>
            </div>
            
            <p>Dear <strong>{user.username}</strong>,</p>
            
            <p>Your account has been successfully created. Please verify your email address to activate your account.</p>
            
            <div style="background-color: #f5f5f5; border: 1px solid #ddd; padding: 15px; margin: 20px 0;">
                <h3 style="margin: 0 0 10px 0; font-size: 16px;">Account Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 5px 0; width: 40%;"><strong>Username:</strong></td>
                        <td style="padding: 5px 0;">{user.username}</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0;"><strong>Email:</strong></td>
                        <td style="padding: 5px 0;">{user.email}</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0;"><strong>Role:</strong></td>
                        <td style="padding: 5px 0;">{user.role}</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0;"><strong>Password:</strong></td>
                        <td style="padding: 5px 0; font-family: 'Courier New', monospace; background: #fff; padding: 5px; border: 1px solid #ccc;">{raw_password}</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0;"><strong>Created:</strong></td>
                        <td style="padding: 5px 0;">{datetime.now().strftime('%B %d, %Y at %I:%M %p')}</td>
                    </tr>
                </table>
            </div>
            
            <div style="background-color: #fff9e6; border-left: 4px solid #ffa500; padding: 15px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0;"><strong>Important Security Information:</strong></p>
                <ul style="margin: 0; padding-left: 20px;">
                    <li>This verification link expires in <strong>15 minutes</strong></li>
                    <li>You must verify your email before logging in</li>
                    <li>Keep your credentials secure at all times</li>
                </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{verify_url}" 
                style="display: inline-block; padding: 12px 30px; background-color: #000; color: #fff; text-decoration: none; border-radius: 4px; font-weight: bold;">
                    Verify Email Address
                </a>
            </div>
            
            <p style="font-size: 14px; color: #666;">
                If the button above doesn't work, copy and paste this link into your browser:
            </p>
            <p style="font-size: 12px; word-break: break-all; background: #f5f5f5; padding: 10px; border: 1px solid #ddd;">
                {verify_url}
            </p>
            
            <div style="border-top: 1px solid #ddd; margin-top: 30px; padding-top: 20px; font-size: 12px; color: #666;">
                <p><strong>Genesis</strong></p>
                <p>© {datetime.now().year} All rights reserved.</p>
                <p style="margin: 10px 0 0 0;">This is an automated message. Please do not reply to this email.</p>
            </div>
            
        </body>
        </html>
        """
        
        # Plain text version
        plain_text = f"""
    GENESIS
    Account Verification

    Dear {user.username},

    Your account has been successfully created. Please verify your email address to activate your account.

    ACCOUNT DETAILS
    ----------------
    Username: {user.username}
    Email: {user.email}
    Role: {user.role}
    Password: {raw_password}
    Created: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}

    IMPORTANT SECURITY INFORMATION
    -------------------------------
    • This verification link expires in 15 minutes
    • You must verify your email before logging in
    • Keep your credentials secure at all times

    VERIFICATION LINK
    -----------------
    {verify_url}
    

    ---
    Genesis
    © {datetime.now().year} All rights reserved.
    This is an automated message. Please do not reply to this email.
        """
        
        return html_content, plain_text,subject
    # BaseApp/utils/email_templates.py

    @staticmethod
    def send_account_update_email(user, changes_dict, changed_by=None):
        """
        Send email notification for account changes
        
        Args:
            user: User object
            changes_dict: Dictionary of changes, e.g. {
                'password': {'old': None, 'new': 'changed', 'time': datetime},
                'role': {'old': 'User', 'new': 'Admin', 'time': datetime},
                'is_active': {'old': True, 'new': False, 'time': datetime},
                'is_email_verified': {'old': False, 'new': True, 'time': datetime}
            }
            changed_by: Username of who made the changes (optional)
        
        Returns:
            tuple: (html_content, plain_content, subject)
        """
        
        # Determine email subject based on changes
        change_types = list(changes_dict.keys())
        if len(change_types) == 1 and 'password' in change_types:
            subject = "Password Changed - Security Alert"
            main_title = "Password Updated"
        elif len(change_types) == 1 and 'role' in change_types:
            subject = "Account Role Updated"
            main_title = "Role Update"
        elif len(change_types) == 1 and 'is_user_enabled' in change_types:
            subject = "Account Status Changed"
            main_title = "Status Update"
        else:
            subject = "Account Updated - Multiple Changes"
            main_title = "Account Update"
        
        # Get the latest change time
        change_time = max([c.get('time', datetime.now()) for c in changes_dict.values()])
    
        # Build changes HTML table rows
        changes_html_rows = ""
        changes_plain = ""
        
        if 'password' in changes_dict:
            new_password = changes_dict['password'].get('new', 'N/A')
            changes_html_rows += f"""
                <tr>
                    <td style="padding: 5px 0;"><strong>Password:</strong></td>
                    <td style="padding: 5px 0;">••••••••</td>
                    <td style="padding: 5px 0; font-family: 'Courier New', monospace; background: #fff; padding: 5px; border: 1px solid #ccc;">{new_password}</td>
                </tr>
            """
            changes_plain += f"  Password: ******** → {new_password}\n"
        
        if 'role' in changes_dict:
            old_role = changes_dict['role'].get('old', 'N/A')
            new_role = changes_dict['role'].get('new', 'N/A')
            changes_html_rows += f"""
                <tr>
                    <td style="padding: 5px 0;"><strong>Role:</strong></td>
                    <td style="padding: 5px 0;">{old_role}</td>
                    <td style="padding: 5px 0;">{new_role}</td>
                </tr>
            """
            changes_plain += f"  Role: {old_role} → {new_role}\n"
        
        if 'is_user_enabled' in changes_dict:
            old_status = "Active" if changes_dict['is_user_enabled'].get('old') else "Inactive"
            new_status = "Active" if changes_dict['is_user_enabled'].get('new') else "Inactive"
            changes_html_rows += f"""
                <tr>
                    <td style="padding: 5px 0;"><strong>Account Status:</strong></td>
                    <td style="padding: 5px 0;">{old_status}</td>
                    <td style="padding: 5px 0;">{new_status}</td>
                </tr>
            """
            changes_plain += f"  Account Status: {old_status} → {new_status}\n"
        
        if 'is_email_verified' in changes_dict:
            old_verified = "Verified" if changes_dict['is_email_verified'].get('old') else "Not Verified"
            new_verified = "Verified" if changes_dict['is_email_verified'].get('new') else "Not Verified"
            changes_html_rows += f"""
                <tr>
                    <td style="padding: 5px 0;"><strong>Email Verification:</strong></td>
                    <td style="padding: 5px 0;">{old_verified}</td>
                    <td style="padding: 5px 0;">{new_verified}</td>
                </tr>
            """
            changes_plain += f"  Email Verification: {old_verified} → {new_verified}\n"
        
        # Build changed by section
        changed_by_html = ""
        changed_by_plain = ""
        if changed_by:
            changed_by_html = f"""
                <div style="background-color: #f5f5f5; border: 1px solid #ddd; padding: 15px; margin: 20px 0;">
                    <p style="margin: 0;"><strong>Changed By:</strong> {changed_by}</p>
                </div>
            """
            changed_by_plain = f"\nChanged By: {changed_by}\n"
        
        # Security notice for sensitive changes
        security_notice = ""
        security_notice_plain = ""
        if 'password' in changes_dict or 'is_user_enabled' in changes_dict:
            security_notice = """
                <div style="background-color: #fff9e6; border-left: 4px solid #ffa500; padding: 15px; margin: 20px 0;">
                    <p style="margin: 0 0 10px 0;"><strong>Security Alert:</strong></p>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li>If you did not authorize these changes, contact your administrator immediately</li>
                        <li>Review your recent account activity</li>
                        <li>Change your password if you suspect unauthorized access</li>
                    </ul>
                </div>
            """
            security_notice_plain = """\n  SECURITY ALERT:\n  • If you did not authorize these changes, contact your administrator immediately\n  • Review your recent account activity\n  • Change your password if you suspect unauthorized access\n"""
        
        # HTML content
        html_content = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>{subject}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            
            <div style="border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px;">
                <h2 style="margin: 0; color: #000;">Genesis</h2>
                <p style="margin: 5px 0 0 0; color: #666;">{main_title}</p>
            </div>
            
            <p>Dear <strong>{user.username}</strong>,</p>
            
            <p>Your account has been updated. Please review the changes below.</p>
            
            {changed_by_html}
            
            <div style="background-color: #f5f5f5; border: 1px solid #ddd; padding: 15px; margin: 20px 0;">
                <h3 style="margin: 0 0 10px 0; font-size: 16px;">Changes Made</h3>
                <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Date: {change_time}</p>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="border-bottom: 2px solid #ccc;">
                            <th style="padding: 8px 0; text-align: left; width: 35%;">Field</th>
                            <th style="padding: 8px 0; text-align: left; width: 30%;">Previous</th>
                            <th style="padding: 8px 0; text-align: left; width: 35%;">New</th>
                        </tr>
                    </thead>
                    <tbody>
                        {changes_html_rows}
                    </tbody>
                </table>
            </div>
            
            {security_notice}
            
            <div style="background-color: #f5f5f5; border: 1px solid #ddd; padding: 15px; margin: 20px 0;">
                <h3 style="margin: 0 0 10px 0; font-size: 16px;">Current Account Information</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 5px 0; width: 40%;"><strong>Username:</strong></td>
                        <td style="padding: 5px 0;">{user.username}</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0;"><strong>Email:</strong></td>
                        <td style="padding: 5px 0;">{user.email}</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0;"><strong>Role:</strong></td>
                        <td style="padding: 5px 0;">{user.role if hasattr(user, 'role') else 'N/A'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0;"><strong>Account Status:</strong></td>
                        <td style="padding: 5px 0;">{'Active' if user.is_user_enabled else 'Inactive'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0;"><strong>Email Verified:</strong></td>
                        <td style="padding: 5px 0;">{'Yes' if user.is_email_verified else 'No'}</td>
                    </tr>
                </table>
            </div>
            
            <p style="font-size: 14px; color: #666;">
                If you have any questions about these changes, please contact your system administrator.
            </p>
            
            <div style="border-top: 1px solid #ddd; margin-top: 30px; padding-top: 20px; font-size: 12px; color: #666;">
                <p><strong>Genesis</strong></p>
                <p>© {datetime.now().year} All rights reserved.</p>
                <p style="margin: 10px 0 0 0;">This is an automated message. Please do not reply to this email.</p>
            </div>
            
        </body>
        </html>
        """
        
        # Plain text version
        plain_text = f"""
    GENESIS
    {main_title}


    Dear {user.username},


    Your account has been updated. Please review the changes below.
    {changed_by_plain}

    CHANGES MADE
    Date: {change_time}
    ----------------
    {changes_plain}
    {security_notice_plain}

    CURRENT ACCOUNT INFORMATION
    ---------------------------
    Username: {user.username}
    Email: {user.email}
    Role: {user.role if hasattr(user, 'role') else 'N/A'}
    Account Status: {'Active' if user.is_user_enabled else 'Inactive'}
    Email Verified: {'Yes' if user.is_email_verified else 'No'}


    If you have any questions about these changes, please contact your system administrator.


    ---
    Genesis 
    © {datetime.now().year} All rights reserved.
    This is an automated message. Please do not reply to this email.
        """
        
        return html_content, plain_text, subject

    
    @staticmethod
    def send_email_change_verification(user, new_email, old_email, verification_link):
        """
        Send verification email to new email address
        
        Args:
            user: User object
            new_email: New email address to verify
            old_email: Previous email address
            verification_link: Full verification URL
            
        Returns:
            tuple: (html_content, plain_content, subject)
        """
        
        subject = "Verify Your New Email Address"
        
        html_content = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verify Email Address</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            
            <div style="border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px;">
                <h2 style="margin: 0; color: #000;">Genesis</h2>
                <p style="margin: 5px 0 0 0; color: #666;">Email Verification Required</p>
            </div>
            
            <p>Dear <strong>{user.username}</strong>,</p>
            
            <p>Your email address has been changed and needs to be verified to continue using your account.</p>
            
            <div style="background-color: #f5f5f5; border: 1px solid #ddd; padding: 15px; margin: 20px 0;">
                <h3 style="margin: 0 0 10px 0; font-size: 16px;">Email Change Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 5px 0; width: 40%;"><strong>Previous Email:</strong></td>
                        <td style="padding: 5px 0; text-decoration: line-through; color: #999;">{old_email}</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0;"><strong>New Email:</strong></td>
                        <td style="padding: 5px 0;">{new_email}</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0;"><strong>Date:</strong></td>
                        <td style="padding: 5px 0;">{datetime.now().strftime('%B %d, %Y at %I:%M %p')}</td>
                    </tr>
                </table>
            </div>
            
            <div style="background-color: #fff9e6; border-left: 4px solid #ffa500; padding: 15px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0;"><strong>Important Security Information:</strong></p>
                <ul style="margin: 0; padding-left: 20px;">
                    <li>This verification link expires in <strong>24 hours</strong></li>
                    <li>Your account access is temporarily suspended until verification</li>
                    <li>If you didn't request this change, contact your administrator immediately</li>
                </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{verification_link}" 
                style="display: inline-block; padding: 12px 30px; background-color: #000; color: #fff; text-decoration: none; border-radius: 4px; font-weight: bold;">
                    Verify Email Address
                </a>
            </div>
            
            <p style="font-size: 14px; color: #666;">
                If the button above doesn't work, copy and paste this link into your browser:
            </p>
            <p style="font-size: 12px; word-break: break-all; background: #f5f5f5; padding: 10px; border: 1px solid #ddd;">
                {verification_link}
            </p>
            
            <p style="font-size: 14px; color: #666;">
                We'll never ask for your password via email. If you suspect unauthorized access, please contact support immediately.
            </p>
            
            <div style="border-top: 1px solid #ddd; margin-top: 30px; padding-top: 20px; font-size: 12px; color: #666;">
                <p><strong>Genesis</strong></p>
                <p>© {datetime.now().year} All rights reserved.</p>
                <p style="margin: 10px 0 0 0;">This is an automated message. Please do not reply to this email.</p>
            </div>
            
        </body>
        </html>
        """
        
        # Plain text version
        plain_text = f"""
    GENESIS
    Email Verification Required


    Dear {user.username},


    Your email address has been changed and needs to be verified to continue using your account.


    EMAIL CHANGE DETAILS
    --------------------
    Previous Email: {old_email}
    New Email: {new_email}
    Date: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}


    IMPORTANT SECURITY INFORMATION
    -------------------------------
    • This verification link expires in 24 hours
    • Your account access is temporarily suspended until verification
    • If you didn't request this change, contact your administrator immediately


    VERIFICATION LINK
    -----------------
    {verification_link}


    SECURITY NOTE
    We'll never ask for your password via email. If you suspect unauthorized access, please contact support immediately.


    ---
    Genesis
    © {datetime.now().year} All rights reserved.
    This is an automated message. Please do not reply to this email.
        """
        
        return subject, html_content, plain_text

    @staticmethod
    def get_smtp_test_email(config_details, recipient_email):
        """
        Generate SMTP test email content
        
        Args:
            config_details: dict with keys: host, port, encryption, from_email
            recipient_email: str - test email recipient
            
        Returns:
            tuple: (html_content, plain_text, subject)
        """
        
        subject = "SMTP Email Configuration Test - Successful"
        
        html_content = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>SMTP Test Email</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            
            <div style="border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px;">
                <h2 style="margin: 0; color: #000;">Genesis</h2>
                <p style="margin: 5px 0 0 0; color: #666;">SMTP Configuration Test</p>
            </div>
            
            <p>Congratulations! This test email confirms that your SMTP configuration is properly set up and functioning.</p>
            
            <div style="background-color: #f5f5f5; border: 1px solid #ddd; padding: 15px; margin: 20px 0;">
                <h3 style="margin: 0 0 10px 0; font-size: 16px;">Test Results</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 5px 0; width: 60%;"><strong>Connection Established:</strong></td>
                        <td style="padding: 5px 0;">Success</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0;"><strong>Authentication Verified:</strong></td>
                        <td style="padding: 5px 0;">Success</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0;"><strong>Email Delivered:</strong></td>
                        <td style="padding: 5px 0;">Success</td>
                    </tr>
                </table>
            </div>
            
            <div style="background-color: #f5f5f5; border: 1px solid #ddd; padding: 15px; margin: 20px 0;">
                <h3 style="margin: 0 0 10px 0; font-size: 16px;">Configuration Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 5px 0; width: 40%;"><strong>SMTP Host:</strong></td>
                        <td style="padding: 5px 0;">{config_details.get('smtp.host', 'N/A')}</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0;"><strong>SMTP Port:</strong></td>
                        <td style="padding: 5px 0;">{config_details.get('smtp.port', 'N/A')}</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0;"><strong>Encryption:</strong></td>
                        <td style="padding: 5px 0;">{config_details.get('smtp.encryption_type', 'N/A')}</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0;"><strong>From Email:</strong></td>
                        <td style="padding: 5px 0;">{config_details.get('smtp.from_email', 'N/A')}</td>
                    </tr>
                </table>
            </div>
            
            <div style="background-color: #f5f5f5; border: 1px solid #ddd; padding: 15px; margin: 20px 0;">
                <h3 style="margin: 0 0 10px 0; font-size: 16px;">Test Information</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 5px 0; width: 40%;"><strong>Test Date:</strong></td>
                        <td style="padding: 5px 0;">{datetime.now().strftime('%B %d, %Y at %I:%M %p')}</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0;"><strong>Recipient:</strong></td>
                        <td style="padding: 5px 0;">{recipient_email}</td>
                    </tr>
                </table>
            </div>
            
            <div style="background-color: #fff9e6; border-left: 4px solid #ffa500; padding: 15px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0;"><strong>Next Steps:</strong></p>
                <ul style="margin: 0; padding-left: 20px;">
                    <li>Your SMTP configuration is ready to use</li>
                    <li>You can now save these settings</li>
                    <li>Start sending emails from your application</li>
                </ul>
            </div>
            
            <p style="font-size: 14px; color: #666;">
                If you received this email, it means your SMTP server is configured correctly and ready for production use.
            </p>
            
            <div style="border-top: 1px solid #ddd; margin-top: 30px; padding-top: 20px; font-size: 12px; color: #666;">
                <p><strong>Genesis</strong></p>
                <p>Automated SMTP Configuration Test</p>
                <p style="margin: 10px 0 0 0;">© {datetime.now().year} - This is an automated test message.</p>
            </div>
            
        </body>
        </html>
        """
        
        # Plain text version
        plain_text = f"""
    GENESIS
    SMTP Configuration Test


    Congratulations! This test email confirms that your SMTP configuration is properly set up and functioning.


    TEST RESULTS
    ------------
    Connection Established: Success
    Authentication Verified: Success
    Email Delivered: Success


    CONFIGURATION DETAILS
    ---------------------
    SMTP Host: {config_details.get('smtp.host', 'N/A')}
    SMTP Port: {config_details.get('smtp.port', 'N/A')}
    Encryption: {config_details.get('smtp.encryption_type', 'N/A')}
    From Email: {config_details.get('smtp.from_email', 'N/A')}


    TEST INFORMATION
    ----------------
    Test Date: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}
    Recipient: {recipient_email}


    NEXT STEPS
    ----------
    • Your SMTP configuration is ready to use
    • You can now save these settings
    • Start sending emails from your application


    If you received this email, it means your SMTP server is configured correctly and ready for production use.


    ---
    Genesis
    Automated SMTP Configuration Test
    © {datetime.now().year} - This is an automated test message.
        """
        
        return subject, html_content, plain_text

    @staticmethod
    def get_alert_email_template(alert_level: str, component_type: str, device_name: str, utilization: float):
        """Simple professional HTML email template for system alerts with severity colors"""
        details = get_support_contact_details()
        # Severity colors
        severity_colors = {
            'Info': '#2563eb',      # Blue
            'Warning': '#f59e0b',   # Orange
            'Critical': '#dc2626'   # Red
        }
        severity_color = severity_colors.get(alert_level, '#6b7280')
        
        # Severity icons
        severity_icons = {
            'Info': '📊',
            'Warning': '⚠️',
            'Critical': '🚨'
        }
        severity_icon = severity_icons.get(alert_level, '🔔')
        
        timestamp = localtime().strftime('%B %d, %Y at %I:%M %p')
        
        subject = f"{severity_icon} {alert_level} Alert - {component_type.upper()} on {device_name}"
        
        html_content = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>System Alert</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            
            <div style="border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px;">
                <h2 style="margin: 0; color: #000;">Genesis</h2>
                <p style="margin: 5px 0 0 0; color: #666;">System Monitoring Alert</p>
            </div>
            
            <div style="background-color: {severity_color}; color: #fff; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <h3 style="margin: 0; font-size: 18px;">{severity_icon} {alert_level} Alert</h3>
                <p style="margin: 5px 0 0 0; font-size: 14px;">System utilization threshold exceeded</p>
            </div>
            
            <p>A <strong>{alert_level.lower()}</strong> alert has been triggered on your system.</p>
            
            <div style="background-color: #f5f5f5; border: 1px solid #ddd; padding: 15px; margin: 20px 0;">
                <h3 style="margin: 0 0 10px 0; font-size: 16px;">Alert Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 5px 0; width: 40%;"><strong>Device:</strong></td>
                        <td style="padding: 5px 0;">{device_name}</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0;"><strong>Component:</strong></td>
                        <td style="padding: 5px 0;">{component_type.upper()}</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0;"><strong>Utilization:</strong></td>
                        <td style="padding: 5px 0; color: {severity_color}; font-weight: bold; font-size: 18px;">{utilization:.1f}%</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0;"><strong>Alert Level:</strong></td>
                        <td style="padding: 5px 0;">
                            <span style="background-color: {severity_color}; color: #fff; padding: 3px 10px; border-radius: 3px; font-size: 12px; font-weight: bold;">
                                {alert_level.upper()}
                            </span>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0;"><strong>Time:</strong></td>
                        <td style="padding: 5px 0;">{timestamp}</td>
                    </tr>
                </table>
            </div>
            
            <div style="background-color: #fff9e6; border-left: 4px solid {severity_color}; padding: 15px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0;"><strong>Recommended Actions:</strong></p>
                <ul style="margin: 0; padding-left: 20px;">
                    <li>Review the system dashboard immediately</li>
                    <li>Check for any running processes causing high usage</li>
                    <li>Monitor the situation for any further escalation</li>
                    <li>Contact system administrator if the issue persists</li>
                </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="https://{HOST_IP}/app/dashboard/p1" 
                style="display: inline-block; padding: 12px 30px; background-color: #000; color: #fff; text-decoration: none; border-radius: 4px; font-weight: bold;">
                    View Dashboard
                </a>
            </div>
            
            <p style="font-size: 14px; color: #666;">
                If the button above doesn't work, copy and paste this link into your browser:
            </p>
            <p style="font-size: 12px; word-break: break-all; background: #f5f5f5; padding: 10px; border: 1px solid #ddd;">
                https://{HOST_IP}/app/dashboard/
            </p>
            
            <div style="border-top: 1px solid #ddd; margin-top: 30px; padding-top: 20px; font-size: 12px; color: #666;">
                <p><strong>Genesis</strong></p>
                
                <p>Email: {details['support_email']}| Phone: +91 {details['contact']}</p>
                <p>© {datetime.now().year} All rights reserved.</p>
                <p style="margin: 10px 0 0 0;">This is an automated message. Please do not reply to this email.</p>
            </div>
            
        </body>
        </html>
        """
        
        # Plain text version
        plain_text = f"""
    GENESIS
    System Monitoring Alert

    {severity_icon} {alert_level.upper()} ALERT
    System utilization threshold exceeded

    A {alert_level.lower()} alert has been triggered on your system.

    ALERT DETAILS
    --------------
    Device: {device_name}
    Component: {component_type.upper()}
    Utilization: {utilization:.1f}%
    Alert Level: {alert_level.upper()}
    Time: {timestamp}

    RECOMMENDED ACTIONS
    -------------------
    • Review the system dashboard immediately
    • Check for any running processes causing high usage
    • Monitor the situation for any further escalation
    • Contact system administrator if the issue persists

    DASHBOARD LINK
    --------------
    https://{HOST_IP}/app/dashboard/

    ---
    Genesis
    Email:{details['support_email']} | Phone: +91 {details['contact']}
    © {datetime.now().year} All rights reserved.
    This is an automated message. Please do not reply to this email.
        """
        print("Generated Alert Email Template - Email Alert.")
        return html_content, plain_text, subject


    @staticmethod
    def get_component_down_alert_email_template(
        alert_level: str,
        component_type: str,
        device_name: str,
        status: str,
        start_str: str = None,   # ✅ added
        end_str: str = None      # ✅ added
    ):
        """Simple professional HTML email template for system alerts with severity colors"""
        details = get_support_contact_details()
        alert_level = "Critical"

        severity_colors = {
            'Info': '#2563eb',
            'Warning': '#f59e0b',
            'Critical': '#dc2626'
        }
        severity_color = severity_colors.get("Critical", '#6b7280')

        severity_icons = {
            'Info': '📊',
            'Warning': '⚠️',
            'Critical': '🚨'
        }
        severity_icon = severity_icons.get(alert_level, '🔔')

        timestamp = localtime().strftime('%B %d, %Y at %I:%M %p')

        # ✅ Subject changes based on maintenance vs down
        if component_type == "Maintenance":
            subject = f"🔧 Maintenance Alert — {device_name} Entered Maintenance"
        else:
            subject = f"{severity_icon} Critical Alert - {component_type} {device_name} Down"

        # ✅ Maintenance window row — only shown for maintenance alerts
        maintenance_window_row = ""
        if start_str and end_str:
            maintenance_window_row = f"""
                        <tr>
                            <td style="padding: 5px 0;"><strong>Maintenance Window:</strong></td>
                            <td style="padding: 5px 0;">{start_str} → {end_str}</td>
                        </tr>
            """

        html_content = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>System Alert</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            
            <div style="border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px;">
                <h2 style="margin: 0; color: #000;">Genesis</h2>
                <p style="margin: 5px 0 0 0; color: #666;">System Monitoring Alert</p>
            </div>
            
            <div style="background-color: {severity_color}; color: #fff; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <h3 style="margin: 0; font-size: 18px;">{severity_icon} {alert_level} Alert</h3>
                <p style="margin: 5px 0 0 0; font-size: 14px;">Identified Agent/IP Monitor Down</p>
            </div>
            
            <p>A <strong>{alert_level.lower()}</strong> alert has been triggered on your system.</p>
            
            <div style="background-color: #f5f5f5; border: 1px solid #ddd; padding: 15px; margin: 20px 0;">
                <h3 style="margin: 0 0 10px 0; font-size: 16px;">Alert Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 5px 0; width: 40%;"><strong>Device:</strong></td>
                        <td style="padding: 5px 0;">{device_name}</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0;"><strong>Component:</strong></td>
                        <td style="padding: 5px 0;">{component_type.upper()}</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0;"><strong>Status:</strong></td>
                        <td style="padding: 5px 0; color: {severity_color}; font-weight: bold; font-size: 18px;">{status}</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0;"><strong>Alert Level:</strong></td>
                        <td style="padding: 5px 0;">
                            <span style="background-color: {severity_color}; color: #fff; padding: 3px 10px; border-radius: 3px; font-size: 12px; font-weight: bold;">
                                {alert_level.upper()}
                            </span>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0;"><strong>Time:</strong></td>
                        <td style="padding: 5px 0;">{timestamp}</td>
                    </tr>
                    {maintenance_window_row}
                </table>
            </div>
            
            <div style="background-color: #fff9e6; border-left: 4px solid {severity_color}; padding: 15px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0;"><strong>Recommended Actions:</strong></p>
                <ul style="margin: 0; padding-left: 20px;">
                    <li>Review the system dashboard immediately</li>
                    <li>Check for any running processes causing high usage</li>
                    <li>Monitor the situation for any further escalation</li>
                    <li>Contact system administrator if the issue persists</li>
                </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="https://{HOST_IP}/app/dashboard/p1" 
                style="display: inline-block; padding: 12px 30px; background-color: #000; color: #fff; text-decoration: none; border-radius: 4px; font-weight: bold;">
                    View Dashboard
                </a>
            </div>
            
            <p style="font-size: 14px; color: #666;">
                If the button above doesn't work, copy and paste this link into your browser:
            </p>
            <p style="font-size: 12px; word-break: break-all; background: #f5f5f5; padding: 10px; border: 1px solid #ddd;">
                https://{HOST_IP}/app/dashboard/
            </p>
            
            <div style="border-top: 1px solid #ddd; margin-top: 30px; padding-top: 20px; font-size: 12px; color: #666;">
                <p><strong>Genesis</strong></p>
                <p>Email: {details['support_email']} | Phone: +91 {details['contact']}</p>
                <p>© {datetime.now().year} All rights reserved.</p>
                <p style="margin: 10px 0 0 0;">This is an automated message. Please do not reply to this email.</p>
            </div>
            
        </body>
        </html>
        """

        # ✅ Plain text also includes window if available
        maintenance_window_text = (
            f"Maintenance Window: {start_str} → {end_str}\n"
            if start_str and end_str else ""
        )

        plain_text = f"""
    GENESIS 
    System Monitoring Alert


    {severity_icon} {alert_level.upper()} ALERT
    System utilization threshold exceeded


    A {alert_level.lower()} alert has been triggered on your system.


    ALERT DETAILS
    --------------
    Device: {device_name}
    Component: {component_type.upper()}
    Status: {status}
    Alert Level: {alert_level.upper()}
    Time: {timestamp}
    {maintenance_window_text}

    RECOMMENDED ACTIONS
    -------------------
    • Review the system dashboard immediately
    • Check for any running processes causing high usage
    • Monitor the situation for any further escalation
    • Contact system administrator if the issue persists


    DASHBOARD LINK
    --------------
    https://{HOST_IP}/app/dashboard/


    ---
    Genesis
    Email: {details['support_email']} | Phone: +91 {details['contact']}
    © {datetime.now().year} All rights reserved.
    This is an automated message. Please do not reply to this email.
        """
        print("Generated Alert Email Template - Email Alert.")
        return html_content, plain_text, subject


    @staticmethod
    def get_password_reset_email_template(email, reset_link):
        """Professional HTML email template for password reset"""
        details=get_support_contact_details()
        subject = 'Reset Your Password - Genesis '
        
        html_content = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Password Reset</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            
            <div style="border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px;">
                <h2 style="margin: 0; color: #000;">Genesis</h2>
                <p style="margin: 5px 0 0 0; color: #666;">Password Reset Request</p>
            </div>
            
            <p>Dear User,</p>
            
            <p>You recently requested to reset your password for your Genesis account. Click the button below to proceed with resetting your password.</p>
            
            <div style="background-color: #f5f5f5; border: 1px solid #ddd; padding: 15px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;"><strong>Account Information:</strong></p>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 5px 0; width: 40%;"><strong>Email:</strong></td>
                        <td style="padding: 5px 0;">{email}</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0;"><strong>Request Time:</strong></td>
                        <td style="padding: 5px 0;">{datetime.now().strftime('%B %d, %Y at %I:%M %p')}</td>
                    </tr>
                </table>
            </div>
            
            <div style="background-color: #fff9e6; border-left: 4px solid #ffa500; padding: 15px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0;"><strong>Important Security Information:</strong></p>
                <ul style="margin: 0; padding-left: 20px;">
                    <li>This password reset link expires in <strong>15 minutes</strong></li>
                    <li>If you did not request a password reset, please ignore this email</li>
                    <li>Your password will not be changed until you access the link and complete the process</li>
                    <li>Never share your password reset link with anyone</li>
                </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{reset_link}" 
                style="display: inline-block; padding: 12px 30px; background-color: #007bff; color: #fff; text-decoration: none; border-radius: 4px; font-weight: bold;">
                    Reset Password
                </a>
            </div>
            
            <p style="font-size: 14px; color: #666;">
                If the button above doesn't work, copy and paste this link into your browser:
            </p>
            <p style="font-size: 12px; word-break: break-all; background: #f5f5f5; padding: 10px; border: 1px solid #ddd;">
                {reset_link}
            </p>
            
            <p style="font-size: 14px; color: #666; margin-top: 20px;">
                If you did not request this password reset, please contact our support team immediately at <a href="mailto:support@genesis.com" style="color: #007bff;">{details['support_email']}</a>
            </p>
            
            <div style="border-top: 1px solid #ddd; margin-top: 30px; padding-top: 20px; font-size: 12px; color: #666;">
                <p><strong>Genesis</strong></p>
                <p>Email: {details['support_email']}| Phone:+91 {details['contact']}</p>
                <p>© {datetime.now().year} All rights reserved.</p>
                <p style="margin: 10px 0 0 0;">This is an automated message. Please do not reply to this email.</p>
            </div>
            
        </body>
        </html>
        """
        
        # Plain text version
        plain_text = f"""
    GENESIS
    Password Reset Request

    Dear User,

    You recently requested to reset your password for your Genesis account. Click the link below to proceed with resetting your password.

    ACCOUNT INFORMATION
    -------------------
    Email: {email}
    Request Time: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}

    IMPORTANT SECURITY INFORMATION
    -------------------------------
    • This password reset link expires in 15 minutes
    • If you did not request a password reset, please ignore this email
    • Your password will not be changed until you access the link and complete the process
    • Never share your password reset link with anyone
 
    RESET PASSWORD LINK
    -------------------
    {reset_link}

    If you did not request this password reset, please contact our support team immediately at support@genesis.com

    ---
    Genesis
    Email: support@genesis.com | Phone: +91 821-7239767
    © {datetime.now().year} All rights reserved.
    This is an automated message. Please do not reply to this email.
        """
        
        return html_content, plain_text, subject
    
    # This template is used for bulk maintenance notifications when multiple devices are put into maintenance mode at the same time.
    @staticmethod
    def get_bulk_maintenance_email_template(device_list: list, start_str: str, end_str: str):
        """Bulk maintenance email — styled to match Genesis alert templates"""
        details = get_support_contact_details()

        # Maintenance uses blue color (not red — it's planned, not an error)
        maintenance_color = "#0369a1"
        severity_icon     = "🔧"
        timestamp         = localtime().strftime('%B %d, %Y at %I:%M %p')

        subject = f"{severity_icon} Maintenance Alert — {len(device_list)} Device(s) Entered Maintenance"

        # Build device rows for the HTML table
        device_rows = "".join([
            f"""
            <tr>
                <td style="padding: 5px 8px; border-bottom: 1px solid #eee;">{i + 1}</td>
                <td style="padding: 5px 8px; border-bottom: 1px solid #eee;">{device}</td>
            </tr>
            """
            for i, device in enumerate(device_list)
        ])

        html_content = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Bulk Maintenance Alert</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

            <!-- ── HEADER ── -->
            <div style="border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px;">
                <h2 style="margin: 0; color: #000;">Genesis</h2>
                <p style="margin: 5px 0 0 0; color: #666;">System Monitoring Alert</p>
            </div>

            <!-- ── ALERT BANNER ── -->
            <div style="background-color: {maintenance_color}; color: #fff; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <h3 style="margin: 0; font-size: 18px;">{severity_icon} Maintenance Mode Activated</h3>
                <p style="margin: 5px 0 0 0; font-size: 14px;">{len(device_list)} device(s) have entered scheduled maintenance</p>
            </div>

            <p>A <strong>bulk maintenance window</strong> has been activated on your system. The following devices are now in maintenance mode and their alerts will be suppressed during this window.</p>

            <!-- ── MAINTENANCE WINDOW DETAILS ── -->
            <div style="background-color: #f5f5f5; border: 1px solid #ddd; padding: 15px; margin: 20px 0;">
                <h3 style="margin: 0 0 10px 0; font-size: 16px;">Maintenance Window Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 5px 0; width: 40%;"><strong>Start Time:</strong></td>
                        <td style="padding: 5px 0;">{start_str}</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0;"><strong>End Time:</strong></td>
                        <td style="padding: 5px 0;">{end_str}</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0;"><strong>Total Devices:</strong></td>
                        <td style="padding: 5px 0; color: {maintenance_color}; font-weight: bold; font-size: 18px;">{len(device_list)}</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0;"><strong>Alert Level:</strong></td>
                        <td style="padding: 5px 0;">
                            <span style="background-color: {maintenance_color}; color: #fff; padding: 3px 10px; border-radius: 3px; font-size: 12px; font-weight: bold;">
                                MAINTENANCE
                            </span>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0;"><strong>Triggered At:</strong></td>
                        <td style="padding: 5px 0;">{timestamp}</td>
                    </tr>
                </table>
            </div>

            <!-- ── DEVICE LIST TABLE ── -->
            <div style="background-color: #f5f5f5; border: 1px solid #ddd; padding: 15px; margin: 20px 0;">
                <h3 style="margin: 0 0 10px 0; font-size: 16px;">Affected Devices</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="border-bottom: 2px solid #ccc;">
                            <th style="padding: 8px; text-align: left; width: 10%; color: #555;">#</th>
                            <th style="padding: 8px; text-align: left; color: #555;">Device Name</th>
                        </tr>
                    </thead>
                    <tbody>
                        {device_rows}
                    </tbody>
                </table>
            </div>

            <!-- ── INFO BOX ── -->
            <div style="background-color: #fff9e6; border-left: 4px solid {maintenance_color}; padding: 15px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0;"><strong>What happens during maintenance?</strong></p>
                <ul style="margin: 0; padding-left: 20px;">
                    <li>All alerts for these devices will be <strong>suppressed</strong> during the window</li>
                    <li>Devices will resume normal monitoring once the window ends</li>
                    <li>Review the dashboard to verify device status after maintenance</li>
                    <li>Contact your system administrator if the window needs to be extended</li>
                </ul>
            </div>

            <!-- ── DASHBOARD BUTTON ── -->
            <div style="text-align: center; margin: 30px 0;">
                <a href="https://{HOST_IP}/app/dashboard/p1"
                style="display: inline-block; padding: 12px 30px; background-color: #000; color: #fff; text-decoration: none; border-radius: 4px; font-weight: bold;">
                    View Dashboard
                </a>
            </div>

            <p style="font-size: 14px; color: #666;">
                If the button above doesn't work, copy and paste this link into your browser:
            </p>
            <p style="font-size: 12px; word-break: break-all; background: #f5f5f5; padding: 10px; border: 1px solid #ddd;">
                https://{HOST_IP}/app/dashboard/p1
            </p>

            <!-- ── FOOTER ── -->
            <div style="border-top: 1px solid #ddd; margin-top: 30px; padding-top: 20px; font-size: 12px; color: #666;">
                <p><strong>Genesis</strong></p>
                <p>Email: {details['support_email']} | Phone: +91 {details['contact']}</p>
                <p>© {datetime.now().year} All rights reserved.</p>
                <p style="margin: 10px 0 0 0;">This is an automated message. Please do not reply to this email.</p>
            </div>

        </body>
        </html>
        """

        # Plain text version
        device_plain = "\n".join([f"  {i + 1}. {d}" for i, d in enumerate(device_list)])
        plain_text = f"""
    GENESIS
    System Monitoring Alert

    {severity_icon} MAINTENANCE MODE ACTIVATED
    {len(device_list)} device(s) have entered scheduled maintenance.

    MAINTENANCE WINDOW DETAILS
    --------------------------
    Start Time  : {start_str}
    End Time    : {end_str}
    Total Devices: {len(device_list)}
    Triggered At: {timestamp}

    AFFECTED DEVICES
    ----------------
    {device_plain}

    WHAT HAPPENS DURING MAINTENANCE?
    ---------------------------------
    • All alerts for these devices will be suppressed during the window
    • Devices will resume normal monitoring once the window ends
    • Review the dashboard to verify device status after maintenance
    • Contact your system administrator if the window needs to be extended

    DASHBOARD LINK
    --------------
    https://{HOST_IP}/app/dashboard/

    ---
    Genesis
    Email: {details['support_email']} | Phone: +91 {details['contact']}
    © {datetime.now().year} All rights reserved.
    This is an automated message. Please do not reply to this email.
        """

        print("Generated Bulk Maintenance Email Template.")
        return html_content, plain_text, subject

    @staticmethod
    def get_license_notification_template(remaining_days,license_type ):
        details = get_support_contact_details()
        from datetime import datetime
        severity_color = "#f59e0b"
        severity_icon = "⚠️"

        if remaining_days <= 7:
            severity_color = "#dc2626"
            severity_icon = "🚨"

        subject = (
            f"{severity_icon} "
            f"License Expiry Warning - "
            f"{remaining_days} Day(s) Remaining"
        )

        html_content = f"""
        <!DOCTYPE html>

        <html lang="en">

        <head>

            <meta charset="UTF-8">

            <meta
                name="viewport"
                content="width=device-width, initial-scale=1.0"
            >

            <title>{subject}</title>

        </head>

        <body style="
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        ">

            <!-- HEADER -->

            <div style="
                border-bottom: 2px solid #333;
                padding-bottom: 10px;
                margin-bottom: 20px;
            ">

                <h2 style="
                    margin: 0;
                    color: #000;
                ">
                    Genesis
                </h2>

                <p style="
                    margin: 5px 0 0 0;
                    color: #666;
                ">
                    License Notification
                </p>

            </div>

            <!-- ALERT -->

            <div style="
                background-color: {severity_color};
                color: #fff;
                padding: 15px;
                margin: 20px 0;
                border-radius: 4px;
            ">

                <h3 style="
                    margin: 0;
                    font-size: 18px;
                ">

                    {severity_icon}
                    License Expiry Warning

                </h3>

            </div>

            <p>

                Your
                <strong>{license_type.upper()}</strong>
                license will expire in

                <strong>{remaining_days}</strong>

                day(s).

            </p>

            <!-- DETAILS -->

            <div style="
                background-color: #f5f5f5;
                border: 1px solid #ddd;
                padding: 15px;
                margin: 20px 0;
            ">

                <h3 style="
                    margin: 0 0 10px 0;
                    font-size: 16px;
                ">
                    License Details
                </h3>

                <table style="
                    width: 100%;
                    border-collapse: collapse;
                ">

                    <tr>

                        <td style="
                            padding: 5px 0;
                            width: 40%;
                        ">
                            <strong>License Type:</strong>
                        </td>

                        <td style="padding: 5px 0;">
                            {license_type.upper()}
                        </td>

                    </tr>

                    <tr>

                        <td style="padding: 5px 0;">
                            <strong>Remaining Days:</strong>
                        </td>

                        <td style="
                            padding: 5px 0;
                            color: {severity_color};
                            font-weight: bold;
                            font-size: 18px;
                        ">
                            {remaining_days}
                        </td>

                    </tr>

                    <tr>

                        <td style="padding: 5px 0;">
                            <strong>Generated At:</strong>
                        </td>

                        <td style="padding: 5px 0;">
                            {datetime.now().strftime('%B %d, %Y at %I:%M %p')}
                        </td>

                    </tr>

                </table>

            </div>

            <!-- ACTIONS -->

            <!-- ACTIONS -->

                <div style="
                    background-color: #fff9e6;
                    border-left: 4px solid {severity_color};
                    padding: 15px;
                    margin: 20px 0;
                ">

                    <p style="
                        margin: 0;
                        font-size: 15px;
                    ">

                        Please contact your license seller
                        or support team to renew your
                        license before expiry.

                    </p>

                </div>

            <!-- BUTTON -->

            <div style="
                text-align: center;
                margin: 30px 0;
            ">

                <a
                    href="https://{HOST_IP}/app/settings/license"

                    style="
                        display: inline-block;
                        padding: 12px 30px;
                        background-color: #000;
                        color: #fff;
                        text-decoration: none;
                        border-radius: 4px;
                        font-weight: bold;
                    "
                >

                    Open License Settings

                </a>

            </div>

            <!-- FOOTER -->

            <div style="
                border-top: 1px solid #ddd;
                margin-top: 30px;
                padding-top: 20px;
                font-size: 12px;
                color: #666;
            ">

                <p>
                    <strong>Genesis</strong>
                </p>

                <p>
                    Email:
                    {details['support_email']}
                    |
                    Phone:
                    +91 {details['contact']}
                </p>

                <p>
                    © {datetime.now().year}
                    All rights reserved.
                </p>

                <p style="
                    margin: 10px 0 0 0;
                ">
                    This is an automated message.
                    Please do not reply to this email.
                </p>

            </div>

        </body>

        </html>
        """

        plain_text = f"""
    GENESIS LICENSE NOTIFICATION

    Your {license_type.upper()} license
    will expire in {remaining_days} day(s).

    Please renew your license immediately.

    Genesis
    """

        return html_content, plain_text, subject