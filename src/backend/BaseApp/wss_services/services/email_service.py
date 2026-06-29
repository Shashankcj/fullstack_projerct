import logging
import asyncio
from datetime import timedelta
from typing import Dict, Any
from django.conf import settings
from django.core.mail import send_mail
from asgiref.sync import sync_to_async
from django.utils import timezone
from django.utils.timezone import localtime

logger = logging.getLogger("agent_monitoring")


class EmailService:
    """Service for handling alert email notifications."""

    def __init__(self):
        # Stores last sent time per alert key for throttling
        self._last_email_sent: dict[str, timezone.datetime] = {}
        self._email_lock = asyncio.Lock()

    # ------------------------------------------------------------------ #
    # Email Queue + Throttling
    # ------------------------------------------------------------------ #
    async def queue_alert_email(
        self,
        alert_level: str,
        component_type: str,
        device_name: str,
        utilization: float,
        alert_key: str
    ) -> None:
        """
        Queue and send an alert email (throttled to 1 minute per alert key).
        """
        try:
            async with self._email_lock:
                now = timezone.now()  # UTC (timezone-aware)
                last_sent = self._last_email_sent.get(alert_key)

                # Check cooldown window (1 min)
                if last_sent is None or now - last_sent >= timedelta(minutes=1):
                    html_content = self._generate_alert_html_email(
                        alert_level, component_type, device_name, utilization
                    )

                    subject_prefix = {
                        'Info': '[INFO ALERT]',
                        'Warning': '[WARNING ALERT]',
                        'Critical': '[CRITICAL ALERT]'
                    }.get(alert_level, '[ALERT]')

                    subject = f"{subject_prefix} {component_type.upper()} usage on {device_name}"

                    recipient_list = getattr(settings, 'ALERT_EMAIL_RECIPIENTS', [])
                    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@yourcompany.com')

                    if not recipient_list:
                        logger.warning("⚠️ No email recipients configured in ALERT_EMAIL_RECIPIENTS")
                        return

                    await sync_to_async(send_mail)(
                        subject=subject,
                        message='',  # Plain text fallback
                        from_email=from_email,
                        recipient_list=recipient_list,
                        fail_silently=False,
                        html_message=html_content,
                    )

                    self._last_email_sent[alert_key] = now
                    logger.info(f"✅ Alert email sent for '{alert_key}' at {localtime(now).strftime('%Y-%m-%d %H:%M:%S %Z')}")

                else:
                    logger.info(
                        f"⏳ Email throttled for '{alert_key}', last sent at {localtime(last_sent).strftime('%Y-%m-%d %H:%M:%S %Z')}"
                    )

        except Exception as ex:
            logger.error(f"❌ Failed to send alert email: {ex}", exc_info=True)

    # ------------------------------------------------------------------ #
    # HTML Email Template
    # ------------------------------------------------------------------ #
    def _generate_alert_html_email(
        self, 
        alert_level: str, 
        component_type: str, 
        device_name: str, 
        utilization: float
    ) -> str:
        """Generates professional HTML email for system alerts (local timezone)."""
        
        company_name = "GENESIS"
        company_site = "https://192.168.100.11/app/dashboard/"
        support_email = "support@genesis.com"
        phone = "+91 821-7239767"

        # Use local timezone (IST or whatever Django TIME_ZONE is)
        timestamp = localtime().strftime('%Y-%m-%d %H:%M:%S %Z')

        # Alert level color schemes
        colors = {
            'Info': "#04894b",      # Green for info
            'Warning': '#ffc107',   # Yellow for warning  
            'Critical': '#dc3545'   # Red for critical
        }
        primary_color = colors.get(alert_level, '#6c757d')

        # Background colors
        background_colors = {
            'Info': "#037a3f",
            'Warning': '#e0a800',
            'Critical': '#c82333'
        }
        background_color = background_colors.get(alert_level, '#5a6268')

        # Button colors
        button_colors = {
            'Info': "#28a745",
            'Warning': '#ffcd39',
            'Critical': '#ff4757'
        }
        button_color = button_colors.get(alert_level, '#868e96')

        # Header gradients
        header_gradients = {
            'Info': "linear-gradient(135deg, #04894b 0%, #037a3f 100%)",
            'Warning': "linear-gradient(135deg, #ffc107 0%, #e0a800 100%)",
            'Critical': "linear-gradient(135deg, #dc3545 0%, #c82333 100%)"
        }
        header_gradient = header_gradients.get(alert_level, "linear-gradient(135deg, #6c757d 0%, #5a6268 100%)")

        # Alert badges and icons
        badges = {
            'Info': "ℹ️ SYSTEM INFO",
            'Warning': "⚠️ SYSTEM WARNING",
            'Critical': "🚨 SYSTEM CRITICAL"
        }
        badge_text = badges.get(alert_level, "🔔 SYSTEM ALERT")

        alert_icons = {
            'Info': "📊",
            'Warning': "⚠️",
            'Critical': "🚨"
        }
        alert_icon = alert_icons.get(alert_level, "🔔")

        util_display = f"{utilization:.1f}%"

        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {{
                    margin: 0;
                    padding: 0;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    background-color: #f8f9fa;
                }}
                .email-container {{
                    max-width: 500px;
                    margin: 40px auto;
                }}
                .container {{
                    background: {background_color};
                    border-radius: 16px;
                    overflow: hidden;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
                }}
                .header {{
                    background: {header_gradient};
                    padding: 40px 30px 30px;
                    text-align: center;
                }}
                .logo {{
                    font-size: 28px;
                    font-weight: 700;
                    color: #ffffff;
                    letter-spacing: 1px;
                    margin-bottom: 8px;
                }}
                .logo-icon {{
                    font-size: 32px;
                    color: #ffffff;
                    display: block;
                    margin-bottom: 15px;
                }}
                .title {{
                    font-size: 22px;
                    font-weight: 600;
                    color: #ffffff;
                    margin: 20px 0 0 0;
                }}
                .alert-badge {{
                    background: rgba(255, 255, 255, 0.25);
                    padding: 6px 16px;
                    border-radius: 20px;
                    color: #ffffff;
                    font-size: 12px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    border: 1.5px solid rgba(255, 255, 255, 0.4);
                    display: inline-block;
                    margin-top: 10px;
                }}
                .content {{
                    background: #ffffff;
                    padding: 40px 30px;
                    text-align: center;
                }}
                .alert-info {{
                    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                    border-left: 3px solid {primary_color};
                    border-radius: 8px;
                    padding: 20px;
                    margin: 30px 0;
                    font-size: 14px;
                    color: #495057;
                    line-height: 1.5;
                    text-align: left;
                }}
                .utilization-display {{
                    background: {primary_color};
                    color: #ffffff;
                    font-size: 32px;
                    font-weight: 700;
                    padding: 20px;
                    border-radius: 8px;
                    margin: 20px 0;
                    display: inline-block;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                }}
                .device-info {{
                    background: #f8f9fa;
                    border: 1px solid #e9ecef;
                    border-radius: 8px;
                    padding: 15px;
                    margin: 20px 0;
                    font-size: 14px;
                    color: #495057;
                }}
                .action-button {{
                    display: inline-block;
                    background: {button_color};
                    color: #ffffff;
                    padding: 14px 32px;
                    border-radius: 8px;
                    text-decoration: none;
                    font-weight: 600;
                    font-size: 16px;
                    margin: 20px 0;
                    border-left: 3px solid {primary_color};
                }}
                .footer {{
                    background: #f8f9fa;
                    padding: 20px 30px;
                    border-top: 1px solid #e9ecef;
                    text-align: center;
                }}
                .company-info {{
                    font-size: 14px;
                    font-weight: 600;
                    color: #212529;
                    margin-bottom: 8px;
                }}
                .contact-links {{
                    font-size: 12px;
                    margin-bottom: 12px;
                }}
                .contact-links a {{
                    color: {primary_color};
                    text-decoration: none;
                    font-weight: 500;
                    margin: 0 8px;
                }}
                .timestamp {{
                    font-size: 10px;
                    color: #6c757d;
                    line-height: 1.3;
                }}
            </style>
        </head>
        <body>
            <div class="email-container">
                <div class="container">
                    <div class="header">
                        <div class="logo-icon">{alert_icon}</div>
                        <div class="logo">{company_name}</div>
                        <div class="title">{alert_level} Alert</div>
                        <div class="alert-badge">{badge_text}</div>
                    </div>
                    
                    <div class="content">
                        <div class="alert-info">
                            <strong>Alert Details:</strong><br>
                            • Device: {device_name}<br>
                            • Component: {component_type.upper()}<br>
                            • Alert Level: {alert_level}<br>
                            • Time: {timestamp}
                        </div>
                        
                        <div class="utilization-display">{util_display}</div>
                        
                        <div class="device-info">
                            <strong>{component_type.upper()} utilization on {device_name}</strong><br>
                            Current usage has reached {util_display}, triggering a {alert_level.lower()} alert.
                        </div>
                        
                        <a href="{company_site}" class="action-button">View Dashboard</a>
                    </div>
                    
                    <div class="footer">
                        <div class="company-info">{company_name} Monitoring</div>
                        <div class="contact-links">
                            <a href="{company_site}">🌐 Dashboard</a>
                            <a href="mailto:{support_email}">📧 Support</a>
                            <span style="color: #6c757d;">📞 {phone}</span>
                        </div>
                        <div class="timestamp">
                            🔔 Automated Alert System - Do Not Reply<br>
                            Generated: {timestamp}
                        </div>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """
        return html

    # ------------------------------------------------------------------ #
    # Cache Management
    # ------------------------------------------------------------------ #
    def clear_email_cache(self, alert_key: str = None):
        """Clear email throttling cache entries."""
        try:
            if alert_key:
                self._last_email_sent.pop(alert_key, None)
                logger.info(f"🧹 Cleared email cache for '{alert_key}'")
            else:
                self._last_email_sent.clear()
                logger.info("🧹 Cleared all email cache")
        except Exception as e:
            logger.error(f"❌ Failed to clear email cache: {e}")

    # ------------------------------------------------------------------ #
    # Statistics
    # ------------------------------------------------------------------ #
    def get_email_statistics(self) -> Dict[str, Any]:
        """Return email throttling statistics."""
        try:
            now = timezone.now()
            recent_emails = [
                {'key': key, 'timestamp': localtime(ts).strftime('%Y-%m-%d %H:%M:%S %Z')}
                for key, ts in self._last_email_sent.items()
                if now - ts < timedelta(hours=1)
            ]

            return {
                'total_email_cache_entries': len(self._last_email_sent),
                'recent_emails_last_hour': len(recent_emails),
                'email_lock_active': self._email_lock.locked(),
                'service_health': 'healthy'
            }
        except Exception as e:
            logger.error(f"❌ Failed to get email statistics: {e}")
            return {'error': str(e)}
