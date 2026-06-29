from django.db import models
import uuid
from django.utils import timezone
from BaseApp.models.priority_group import PriorityGroup
from django.contrib.contenttypes.fields import GenericRelation
from BaseApp.models.models import Alert

from BaseApp.services.webapp_services.email_notifications.Emailtemplates import *
from BaseApp.services.webapp_services.email_notifications.Sendemail_service import EmailService
from BaseApp.models.global_config import GlobalConfig

class IPMonitor(models.Model):
   
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    name = models.CharField(max_length=255)
    ip_address = models.GenericIPAddressField(unique=True)
    priority = models.ForeignKey(
        PriorityGroup,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        default=PriorityGroup.get_default,
        related_name='ipmonitors'
    )
    alerts = GenericRelation("BaseApp.Alert", related_query_name='ip_source')
    
    def __str__(self):
        return f"{self.ip_address}" 
    
    def create_event(self, event_type, description, component_type, email_alert_payload=None, severity=None):
        if event_type.lower() == "alert":
            self.alerts.create(
                device_name = self.ip_address,
                alert_type = "IP Down",
                severity = "Critical",
                message = description,
            )

            # if email_alert_payload:
            print(f"Preparing to send email alert for {component_type} status down - {self.ip_address}")
            html_content, plain_text, subject = EmailTemplates.get_component_down_alert_email_template(alert_level="Critical", component_type="IP Monitoring", device_name=self.ip_address, status="Down")
            EmailService.send_email(
                to_emails=GlobalConfig.get_config("alert.to_emails").split(","), 
                html_content=html_content, 
                plain_text=plain_text, 
                subject=subject,
                cc_emails=GlobalConfig.get_config("alert.cc_emails").split(",") if GlobalConfig.get_config("alert.cc_emails") else None
                )
    
class IPMonitorCheckpoint(models.Model):
    ip_monitor = models.ForeignKey(
        IPMonitor,
        on_delete=models.CASCADE,
        related_name='checkpoints'
    )
    status = models.CharField(max_length=20, default='unknown')
    status_value = models.IntegerField(default=0)  # 1 for up, 0 for down
    min_latency = models.FloatField(null=True, blank=True)    # Minimum latency
    max_latency = models.FloatField(null=True, blank=True)    # Maximum latency
    jitter = models.FloatField(null=True, blank=True)         # Network jitter (ms)
    created_at= models.DateTimeField(default=timezone.now, db_index=True)
    timestamp_utc = models.DateTimeField(verbose_name="Timestamp (UTC)", db_index=True)


    def getTimestampInTimezone(self, tz_name):
        """
        Convert UTC timestamp to specified timezone.
        """
        from pytz import timezone as pytz_timezone
        try:
            target_tz = pytz_timezone(tz_name)
            return self.created_at.astimezone(target_tz).isoformat()
        except Exception as e:
            print(f"Error converting timezone: {e}")
            return self.created_at.isoformat()

    def __str__(self):
        return f"Checkpoint for {self.ip_monitor.ip_address} at {self.created_at}"
  