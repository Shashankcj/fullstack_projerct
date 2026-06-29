import logging
from datetime import datetime, timedelta
from django.conf import settings
from django.core.cache import cache
from django.core.mail import send_mail
from BaseApp.models import Alert, MonitoringCheckpoint
# from asgiref.sync import async_to_sync
# from monitoring_service import create_event
logger = logging.getLogger("agent_monitoring")

def trigger_utilization_alert(
    device_name: str,
    component_type: str,
    component_uuid: str,
    utilization: float,
    checkpoint: MonitoringCheckpoint
) -> None:
    """
    Trigger utilization alerts for CPU or memory if sustained for 5 minutes.
    """
    try:
       
        alert_type = f"{component_type} Usage"
        now = datetime.now()
        tolerance = 0.5  # Tolerance for float comparison
        spike_window = timedelta(minutes=5)
        cache_key = f"spike:{component_type}:{component_uuid}"

        cached = cache.get(cache_key)
        if cached:
            start_time, last_util = cached
            if abs(utilization - last_util) <= tolerance:
                if now - start_time >= spike_window:
                    cache.delete(cache_key)
                    logger.info(f"Sustained {component_type.upper()} spike detected for UUID: {component_uuid}")
                else:
                    # Still within window — wait longer
                    return
            else:
                # Utilization changed — reset spike window
                cache.set(cache_key, (now, utilization), timeout=360)
                return
        else:
            # First detection — set the spike window
            cache.set(cache_key, (now, utilization), timeout=360)
            return
        
        # Threshold classification
        if utilization >= 80:
            alert_level = 'Critical'
        elif utilization >= 60:
            alert_level = 'Warning'
        elif utilization >= 40: 
            alert_level = 'Info'
        else:
            return

        level_messages = {
            'Info': f"Info: {component_type.upper()} usage {utilization:.2f}% is between 40-60%",
            'Warning': f"Warning: {component_type.upper()} usage {utilization:.2f}% is between 60-80%",
            'Critical': f"CRITICAL:{component_type.upper()} usage {utilization:.2f}% exceeds 80%"
        }

        severity_levels = {
            'Info': 'Info',
            'Warning': 'Warning',
            'Critical': 'Critical'
        }
        # Create Alert
        Alert.objects.create(
            device_name=device_name,
            alert_type=alert_type,
            severity=severity_levels[alert_level],
            source_uuid=component_uuid,
            message=level_messages[alert_level],
            checkpoint=checkpoint,
            details={
                'utilization': utilization,
                'threshold_breached': alert_level,
                'component': component_type,
            }
        )
 
        logger.log({
            'warning': logging.WARNING,
            'alert': logging.ERROR,
            'critical': logging.CRITICAL
        }[alert_level], f"{component_type.upper()} {alert_level.upper()} for {component_uuid}: {utilization:.2f}% usage")

        if alert_level == 'warning':
            notify_operations_team(
                message=f"HIGH {component_type.upper()} USAGE on {component_uuid}",
                details=f"{component_type.upper()} usage at {utilization:.2f}%"
            )
        elif alert_level == 'info':
            notify_operations_team(
                message=f" MEDIUM {component_type.upper()} USAGE on {component_uuid}",
                details=f"{component_type.upper()} usage at {utilization:.2f}%"
            )
        elif alert_level == 'critical':
            notify_operations_team(
                message=f" CRITICAL {component_type.upper()} USAGE on {component_uuid}",
                details=f"{component_type.upper()} usage at {utilization:.2f}%"
            )
        logger.info("Ready to notify operation team")
    except Exception as e:
        logger.error(f"Failed to create {component_type} alert: {str(e)}")


def notify_operations_team(message: str, details: str) -> None:
    try:
        subject = f"[ALERT:] {message}"
        recipient_list = getattr(settings, 'ALERT_EMAIL_RECIPIENTS', [])
        from_email = settings.DEFAULT_FROM_EMAIL

        send_mail(
            subject=subject,
            message=details,
            from_email=from_email,
            recipient_list=recipient_list,
            fail_silently=False
        )
    except Exception as e:
        logger.error(f"Failed to send alert email: {e}")
 