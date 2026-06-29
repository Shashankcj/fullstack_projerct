from pyexpat import model
from time import timezone
from django.db import models
from datetime import timedelta
from django.utils import timezone
import uuid, logging
from simple_history.models import HistoricalRecords
from oauth2_provider.models import Application, get_access_token_model
from simple_history.utils import update_change_reason
from .roles import Role
from .base_audit_model import BaseAuditModel
from BaseApp.models.priority_group import PriorityGroup
from django.contrib.contenttypes.fields import GenericForeignKey, GenericRelation
from django.contrib.contenttypes.models import ContentType
logger = logging.getLogger('agent_consumer')

def update_storage_view(request):
    storage = Storage.objects.get(...)
    update_change_reason(storage, "Updated disk usage based on monitoring data.")
    storage.total_disk_usage = "..."
    storage.save()


def convert_bytes_to_human_readable(num_bytes, preferred_unit):
    """
    Convert bytes to a human-readable format.
    """
    try:
        num_bytes = float(num_bytes)

        unit_map = {
            "BYTES": 1,
            "KB": 1024,
            "MB": 1024 ** 2, 
            "GB": 1024 ** 3,
            "TB": 1024 ** 4
        }
        
        if preferred_unit:
            preferred_unit = preferred_unit.upper()
            if preferred_unit not in unit_map:
                return f"Error: Unsupported unit '{preferred_unit}'"

            value = num_bytes / unit_map[preferred_unit]
            return f"{value:.2f} {preferred_unit}"
        
        else:

            if num_bytes >= 1024 ** 3:
                value = num_bytes / (1024 ** 3)
                unit = "GB"
            elif num_bytes >= 1024 ** 2:
                value = num_bytes / (1024 ** 2)
                unit = "MB"
            elif num_bytes >= 1024:
                value = num_bytes / 1024
                unit = "KB"
            else:
                value = num_bytes
                unit = "Bytes"

            return f"{value:.2f} {unit}"
    except (ValueError, TypeError) as e:
        return "Error: Invalid input value."
    
def parse_operating_speed(speed_str):
    """Convert '1.0 Gbps', '100.0 Mbps', etc. into bits per second (int)."""
    import re

    if not speed_str:
        return None

    match = re.match(r'([\d.]+)\s*(gbps|mbps|kbps|bps)', speed_str.strip().lower())
    if not match:
        return None

    value, unit = match.groups()
    value = float(value)

    unit_map = {
        'bps': 1,
        'kbps': 1_000,
        'mbps': 1_000_000,
        'gbps': 1_000_000_000,
    }
    value = int(value * unit_map[unit])
    return value

def convert_speed_str_to_bps(speed_str: str) -> int:
    """
    Convert a speed string like '1Gbps' to bits per second.
    """
    units = {
        'bps': 1,
        'Kbps': 1_000,
        'Mbps': 1_000_000,
        'Gbps': 1_000_000_000,
        'Tbps': 1_000_000_000_000
    }
    try:
        for unit, multiplier in units.items():
            if unit.lower() in speed_str.lower():
                value = float(speed_str.lower().replace(unit.lower(), '').strip())
                return int(value * multiplier)
    except Exception as e:
        print(f"Invalid speed format '{speed_str}': {e}")
    return 0
    
def convert_speed(speed,unit):
    """
    Convert speed to a human-readable format.
    """
    try:
        if unit == "Hz":
            # convert from hz to MHz
            return f"{speed / 1e6} {unit}"
        elif unit == "GHz":
            # Convert from GHz to MHz
            return f"{speed * 1000} {unit}"
        elif unit == "MHz":
            # Already in MHz, so return as is.
            return f"{speed} {unit}"
        else:
            raise ValueError("Unsupported speed unit. Use 'Hz', 'MHz', or 'GHz'.")
    except (ValueError, TypeError) as e:
        print(f"Error: Invalid input value. Details: {e}")
        return "Error: Invalid input value."
    
def convert_bandwidth(bits_per_sec):
    """
    Convert bits per second into Kbps, Mbps, or Gbps.
    """
    try:
        bits_per_sec = float(bits_per_sec)
        
        if bits_per_sec >= 1_000_000_000:
            return f"{round(bits_per_sec / 1_000_000_000, 2)} Gbps"
        elif bits_per_sec >= 1_000_000:
            return f"{round(bits_per_sec / 1_000_000, 2)} Mbps"
        elif bits_per_sec >= 1_000:
            return f"{round(bits_per_sec / 1_000, 2)} Kbps"
        else:
            return f"{round(bits_per_sec)} Bps"
    except (ValueError, TypeError) as e:
        print(f"Error: Invalid input value. Details: {e}")
        return "Error: Invalid input value."
            
def add_percentage(value):
    """
    Add percentage symbol to a value.
    """
    try:    
        return f"{value} %"
    except (ValueError, TypeError) as e:
        return "Error: Invalid input."
def is_valid_uuid(val):
    try:
        uuid.UUID(str(val))
        return True
    except Exception:
        return False
# models/monitoring_session.py



class PendingDeletion(models.Model):
    uuid = models.CharField(max_length=100, unique=True)
    entity_type = models.CharField(max_length=50)
    device_uuid = models.CharField(max_length=100)
    missing_count = models.PositiveIntegerField(default=0)  # Incremented each monitoring cycle 
    created_at = models.DateTimeField(auto_now_add=True)
    
from BaseApp.services.webapp_services.email_notifications.Emailtemplates import *
from BaseApp.services.webapp_services.email_notifications.Sendemail_service import EmailService
from BaseApp.models.global_config import GlobalConfig

class Agent(models.Model):
    uuid = models.UUIDField(primary_key=True, editable=False)
    hostname = models.CharField(max_length=100)
    os = models.CharField(max_length=100)
    os_version = models.CharField(max_length=100)
    device_fingerprint = models.CharField(max_length=64 ,null=True, blank=True)
    system_uuid = models.CharField(max_length=128, null=True, blank=True)
    oauth_application = models.OneToOneField(Application, null=True, blank=True, on_delete=models.CASCADE)
    master_key = models.CharField(max_length=260)
    created_at = models.DateTimeField(auto_now_add=True)
    is_reinstallation = models.BooleanField(default=False)
    
    STATUS_ACTIVE = "Active"
    STATUS_INACTIVE = "Inactive"
    STATUS_CHOICES = [
        (STATUS_ACTIVE, "Active"),
        (STATUS_INACTIVE, "Inactive"),
    ]
    # ── Health Status ───────────────────────────────────────────
    HEALTH_GREEN = "green"
    HEALTH_AMBER = "amber"
    HEALTH_RED = "red"
    HEALTH_MAINTENANCE = "maintenance" 
    HEALTH_CHOICES = [
        (HEALTH_GREEN, "Green"),
        (HEALTH_AMBER, "Amber"),
        (HEALTH_RED, "Red"),
        (HEALTH_MAINTENANCE, "Maintenance"),
    ]

    health_status = models.CharField(
        max_length=15,
        choices=HEALTH_CHOICES,
        null=True,      
        blank=True,
        default=None,
        db_index=True
    )
    last_health_updated = models.DateTimeField(null=True, blank=True)
    # ── Health Status end ───────────────────────────────────────────
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=STATUS_INACTIVE)
    last_seen = models.DateTimeField(null=True, blank=True)
    last_activated_at = models.DateTimeField(null=True, blank=True)
    uptime_started_at = models.DateTimeField(null=True, blank=True)
    last_uptime_duration = models.DurationField(null=True, blank=True)
    priority = models.ForeignKey(
        PriorityGroup,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        default=PriorityGroup.get_default,
        related_name='agents'
    )
    alerts = GenericRelation("BaseApp.Alert", related_query_name='agent_source')
    #Maintenance fields
    maintenance_mode  = models.BooleanField(default=False)
    maintenance_start = models.DateTimeField(null=True, blank=True)
    maintenance_end   = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Agent OS: {self.os} Status: {self.status} uuid-{self.uuid} priority-{self.priority}"
            
    def mark_active(self):
        now = timezone.now()
        
        if self.status != self.STATUS_ACTIVE:
            self.status = self.STATUS_ACTIVE
            self.last_activated_at = now
            self.uptime_started_at = now 
        self.last_seen = now
        self.save(update_fields=["status", "last_seen", "last_activated_at", 'uptime_started_at'])

    def mark_maintenance(self, send_email=True, create_alert=True):
        """
        Called when maintenance starts (Immediate or Scheduled).
        If send_email=False  → only alert record (no email)
        If create_alert=False → skip alert + email entirely (used in bulk mode)
        """

        # 1. Flip the flag
        self.maintenance_mode = True
        self.health_status = self.HEALTH_MAINTENANCE 
        self.last_health_updated = timezone.now() 
        self.save(update_fields=[
            "maintenance_mode",
            "health_status",
            "last_health_updated",
        ])

        # 2. Format times
        start_str = (
            timezone.localtime(self.maintenance_start).strftime('%Y-%m-%d %I:%M %p')
            if self.maintenance_start else "Immediate"
        )
        end_str = (
            timezone.localtime(self.maintenance_end).strftime('%Y-%m-%d %I:%M %p')
            if self.maintenance_end else "Indefinite"
        )

        # 3. Skip event + email entirely if bulk mode
        if not create_alert:
            return

        # 4. Prepare email payload ONLY if needed
        email_payload = None
        if send_email:
            email_payload = {
                "alert_type"     : "flagged_component",
                "component_type" : "Maintenance",
                "start_str"      : start_str,
                "end_str"        : end_str,
            }

        # 5. Create event (alert + optional email)
        self.create_event(
            "Alert",
            f"Device {self.hostname} entered maintenance. "
            f"Window: {start_str} → {end_str}.",
            component_type="Maintenance",
            severity='Info', 
            email_alert_payload=email_payload
        )

            
        #helper for maintenace 
    @property
    def is_in_maintenance(self):
        """
        Returns True in 2 cases:
        1. Immediate — maintenance_mode=True and end hasn't passed
        2. Scheduled — maintenance_mode=False but we're inside the window
        """
        now = timezone.now()

        # ── Immediate ───────────────────────────────────────────
        if self.maintenance_mode:
            # Already ON — check if expired (Celery hasn't cleaned up yet)
            if self.maintenance_end and self.maintenance_end <= now:
                return False   # expired
            return True

        # ── Scheduled ───────────────────────────────────────────
        # mode=False but a future window is defined
        if self.maintenance_start and self.maintenance_end:
            return self.maintenance_start <= now <= self.maintenance_end

        # ── Not in maintenance ───────────────────────────────────
        return False


    def mark_inactive(self):
        if self.status == self.STATUS_ACTIVE:
            duration = timezone.now() - self.last_activated_at
            self.last_uptime_duration = duration
        self.status = self.STATUS_INACTIVE
        self.save(update_fields=["status", "last_uptime_duration"])
        email_payload = {"alert_type": "agent_down", "component_type": "Agent",}
        self.create_event(
            "Alert", 
            f"Agent {self.hostname} marked as inactive. Last seen at {self.last_seen}. Uptime duration was {self.last_uptime_duration}.", 
            component_type="Agent",
            email_alert_payload=email_payload
            ) 
        
        try:
        # Optionally end active session if you’re tracking it
          pass
        except Exception as session_err:
            print(f"Warning: Could not end session: {session_err}")
        
    def validate_access_token(self, access_token):
        try:
            token_object = self.oauth_application.accesstoken_set.get(token=access_token)
            if not token_object.is_expired():
                return True, token_object.expires
                
        except Exception as e:
            print(f"Error validating access token: {e}")
        return False, None

    def create_event(self, event_type, description, component_type=None, 
                 email_alert_payload=None, severity='Critical'):  
        print(f'--- Creating {event_type} event for {self.hostname}...')
        self.event_set.create(
            event_type=event_type,
            description=description,
            component_type=component_type
        )

        if event_type.lower() == 'alert':
            if self.is_in_maintenance and component_type != 'Maintenance':
                logger.info(
                    f'MAINTENANCE: Alert suppressed for '
                    f'{self.hostname} {component_type} {description}'
                )
                self.alerts.create(
                    device_name=self.hostname,
                    alert_type=next(
                        (x[0] for x in Alert.ALERT_TYPE_CHOICES 
                        if component_type.lower() in x[0].lower()), 'Component Down'
                    ),
                    severity=severity,          # ✅ now defined
                    message=description,
                    content_type=ContentType.objects.get_for_model(self),
                    object_id=str(self.pk),
                    agent=self.uuid,
                    suppressed=True,
                )
                return

            logger.info(f'Creating alert for agent {self.hostname} - {component_type} - {description}')
            print(f'ALERT: Creating active alert record in database.')
            self.alerts.create(
                device_name=self.hostname,
                alert_type=next(
                    (x[0] for x in Alert.ALERT_TYPE_CHOICES 
                    if component_type.lower() in x[0].lower()), 'Component Down'
                ),
                severity=severity,              # ✅ now defined
                message=description,
                content_type=ContentType.objects.get_for_model(self),
                object_id=str(self.pk),
                agent=self.uuid,
            )

        if email_alert_payload:
            print(f'Preparing to send email alert for {component_type}')
            alert_type = email_alert_payload.get('alert_type')

            if alert_type == 'bulk_maintenance':
                html_content, plain_text, subject = EmailTemplates.get_bulk_maintenance_email_template(
                    device_list=email_alert_payload.get('device_list', ''),
                    start_str=email_alert_payload.get('start_str'),
                    end_str=email_alert_payload.get('end_str'),
                )
            elif alert_type in ['flagged_component', 'agent_down']:
                html_content, plain_text, subject = EmailTemplates.get_component_down_alert_email_template(
                    alert_level='Info' if alert_type == 'flagged_component' else 'Critical', 
                    component_type=email_alert_payload.get('component_type'),
                    device_name=self.hostname,
                    status='In Maintenance' if alert_type == 'flagged_component' else 'Down',
                    start_str=email_alert_payload.get('start_str'),
                    end_str=email_alert_payload.get('end_str'),
                )
            else:
                html_content, plain_text, subject = EmailTemplates.get_alert_email_template(
                    alert_level=severity, 
                    component_type=email_alert_payload.get('component_type'),
                    device_name=self.hostname,
                    utilization=email_alert_payload.get('utilization'),
                )

            EmailService.send_email(
                to_emails=GlobalConfig.get_config('alert.to_emails').split(','),
                html_content=html_content,
                plain_text=plain_text,
                subject=subject,
                cc_emails=GlobalConfig.get_config('alert.cc_emails').split(',') 
                        if GlobalConfig.get_config('alert.cc_emails') else None,
            )

class Device(models.Model):
    uuid = models.UUIDField(primary_key=True, editable=False)
    agent = models.OneToOneField(Agent, on_delete=models.CASCADE, related_name='device')
    make = models.CharField(max_length=255)
    model = models.CharField(max_length=255)
    serial_number = models.CharField(max_length=255)
    reboot_time=models.CharField(max_length=100, null=True, blank=True,default=None)
    
    DEVICE_CHOICES = [
        ('Physical Machine', 'Physical Machine'),
        ('Virtual Machine', 'Virtual Machine'),
    ]
    dev_phy_vm = models.CharField(max_length=20, choices=DEVICE_CHOICES, default='physical')

    def get_component_relational_mapper(self, component_name):
        """
        Map component names to their related model names.
        """
        mapping = {
            "cpu": self.cpu,
            "memory": self.memory,
            "storage": self.storage,
            "nic": self.nic,
            "gpu": self.gpu,
        } 

        return mapping.get(component_name.lower(), None)
    
    def get_component_count(self, component_name):
        related_component_map = {
            "disk": self.storage.count(),
            "nic": self.nic.count(),
            "port": sum(nic.port.count() for nic in self.nic.all()),
            "partition": sum(storage.partition.count() for storage in self.storage.all()),
        }

        return related_component_map.get(component_name.lower(), 0)

    def flag_component(self, component_name, data):
        # logger.info(f"Flagging missing components for {component_name} with data: {data}")
        related_component_attr_map = {
            "disk": {"attrs": ["storage"], "model": Storage},
            "network": {"attrs": ["nic", "port"], "model": Port},
            "partition": {"attrs": ["storage", "partition"], "model": Partition},
        }
        mon_data_key_map = {"disk": "disk_uuid", "network": "port_uuid", "partition": "partition_uuid"}
        component_uuids = []
        for p_comp in getattr(self, related_component_attr_map[component_name]["attrs"][0]).all():
            if len(related_component_attr_map[component_name]["attrs"]) == 2:
                for comp in getattr(p_comp, related_component_attr_map[component_name]["attrs"][1]).all():
                    component_uuids.append(str(comp.uuid))
            else:
                component_uuids.append(str(p_comp.uuid))

        # logger.info(f"Existing {component_name} UUIDs : {component_uuids}")

        received_uuids = [comp.get(mon_data_key_map[component_name]) for comp in data]
        missing_uuids = list(set(component_uuids) ^ set(received_uuids))

        # logger.info(f"Missing {component_name} UUIDs : {missing_uuids}")
        # logger.info(f"Received {component_name} UUIDs : {received_uuids}")

        for missing_uuid in missing_uuids:
            if related_component_attr_map[component_name]["model"].objects.filter(uuid=missing_uuid).exists():
                component_instance = related_component_attr_map[component_name]["model"].objects.get(uuid=missing_uuid)
                if not component_instance.is_flagged:
                    component_instance.is_flagged = True
                    component_instance.flagged_at = timezone.now()
                    component_instance.flagged_reason = f"Missing in latest monitoring data for agent {self.agent.uuid}"
                    component_instance.save()
                    email_payload = {"alert_type": "flagged_component", "component_type": f"{component_name.capitalize()} - {component_instance.name if hasattr(component_instance, 'name') else component_instance.uuid}"}
                    self.agent.create_event("Alert", f"Flagged missing {component_name} - {component_instance.name} for agent {self.agent.hostname}", component_type=component_name.capitalize(), email_alert_payload=email_payload)

    def check_component_if_flagged_and_unflag(self, component_name, component_uuid):
        # logger.info(f"Checking if {component_name} with UUID {component_uuid} is flagged for agent {self.agent.hostname}")
        component = None
        if "disk" in component_name.lower() and self.storage.filter(uuid=component_uuid).exists():
            component = self.storage.filter(uuid=component_uuid).first()
        elif "partition" in component_name.lower() and Partition.objects.filter(uuid=component_uuid, storage__device=self).exists():
            component = Partition.objects.filter(uuid=component_uuid, storage__device=self).first()
        elif "network" in component_name.lower() and Port.objects.filter(uuid=component_uuid, nic__device=self).exists():
            component = Port.objects.filter(uuid=component_uuid, nic__device=self).first()

        if component and component.is_flagged:
            component.is_flagged = False
            component.flagged_at = None
            component.flagged_reason = None
            component.save()
            self.agent.create_event("Info", f"Unflagged {component_name.capitalize()} - {component.name} for agent {self.agent.hostname} as it reappeared in monitoring data", component_type=component_name.capitalize())
            logger.info(f"Unflagged {component_name} - {component.name} for agent {self.agent.hostname} as it reappeared in monitoring data")

    def get_disk_name(self, component_uuid):
        if self.storage.filter(uuid=component_uuid).exists():
            return self.storage.get(uuid=component_uuid).name
        return None

    def get_partition_name(self, component_uuid):
        if self.storage.filter(partition__uuid=component_uuid).exists():
            return self.storage.get(partition__uuid=component_uuid).partition.get(uuid=component_uuid).name
        return None

    def get_port_name(self, component_uuid):
        if self.nic.filter(port__uuid=component_uuid).exists():
            return self.nic.get(port__uuid=component_uuid).port.get(uuid=component_uuid).name
        return None

    def __str__(self):
        return self.agent.hostname

class CPU(models.Model):
    uuid = models.UUIDField(primary_key=True, editable=False)
    device = models.ForeignKey(Device, on_delete=models.CASCADE, related_name='cpu')
    make = models.CharField(max_length=255)
    model = models.CharField(max_length=255)
    p_cores = models.IntegerField()
    l_cores = models.IntegerField()
    speed = models.CharField(max_length=50)
    
    def __str__(self):
        return f"{self.model}  - Device {self.device.uuid}"

class Memory(models.Model):
    uuid = models.UUIDField(primary_key=True, editable=False)
    device = models.ForeignKey(Device, on_delete=models.CASCADE, related_name='memory')
    make = models.CharField(max_length=255)
    model = models.CharField(max_length=255)
    speed = models.CharField(max_length=50)
    size = models.CharField(max_length=50)
    serial_number = models.CharField(max_length=255)
    history = HistoricalRecords(inherit=True) #enables who made the changes

    def __str__(self):
        return f"{self.make}  - Device {self.device.uuid}"
    def update_total_memory(self,data):
        self.size = data
        print("memory size updated")
        self.save()
        
class Storage(models.Model):
    uuid = models.UUIDField(primary_key=True, editable=False)
    device = models.ForeignKey(Device, on_delete=models.CASCADE, related_name='storage')
    name = models.CharField(max_length=255, null=True, blank=True)
    hw_disk_type = models.CharField(max_length=10)

    make = models.CharField(max_length=255)
    model = models.CharField(max_length=255)
    serial_number = models.CharField(max_length=255)
    base_fs_type = models.CharField(max_length=50,null=True)
    free_space = models.CharField(max_length=50)
    total_disk_usage = models.CharField(max_length=50)
    total_disk_size = models.CharField(max_length=50)
    allocated_disk_size = models.CharField(max_length=50)
    unallocated_disk_size = models.CharField(max_length=50)
    history = HistoricalRecords(inherit=True)
    
    is_flagged = models.BooleanField(default=False)
    flagged_at = models.DateTimeField(null=True, blank=True) 
    flagged_reason = models.TextField(null=True, blank=True) 
    
    # New viewing tracking fields
    is_viewed = models.BooleanField(default=False)
    viewed_at = models.DateTimeField(null=True, blank=True)
    viewed_by = models.ForeignKey(
        'auth.User', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='viewed_storage'
    )
    
    def mark_as_viewed(self, user=None):
        """Mark this storage as viewed"""
        self.is_viewed = True
        self.viewed_at = timezone.now()
        if user:
            self.viewed_by = user
        self.save(update_fields=['is_viewed', 'viewed_at', 'viewed_by'])
        return f"Storage {self.uuid} marked as viewed"
    
    def update_used_space(self, data):
        """
        Update used space and calculate free space.
        """
        self.total_disk_usage = data

        total_disk_size, total_size_unit = self.total_disk_size.split()
        print(total_disk_size)
        total_disk_usage, used_space_unit = self.total_disk_usage.split()
         
        if total_size_unit != used_space_unit:
             raise ValueError("Units do not match for total and used space.")
        update_change_reason("Updated disk usage based on monitoring data.")
        free_space = float(total_disk_size) - float(total_disk_usage)
        self.free_space = f"{free_space:.2f} {total_size_unit}"
        self.save()
        return f"disk updated successfully:free space {self.free_space}"
        
class Partition(models.Model):
    uuid = models.UUIDField(primary_key=True, editable=False)
    storage = models.ForeignKey(Storage, on_delete=models.CASCADE, related_name='partition')
    name = models.CharField(max_length=50)
    serial_number= models.CharField(max_length=50)
    fs_type = models.CharField(max_length=50,null=True)
    free_space = models.CharField(max_length=50)
    used_space = models.CharField(max_length=50)
    total_size = models.CharField(max_length=50)
    history = HistoricalRecords(inherit=True)
    
    is_flagged = models.BooleanField(default=False)  
    flagged_at = models.DateTimeField(null=True, blank=True)  
    flagged_reason = models.TextField(null=True, blank=True) 
    def __str__(self):
       return f"Partition {self.name} - Storage {self.storage.uuid}"
   
    is_viewed = models.BooleanField(default=False)
    viewed_at = models.DateTimeField(null=True, blank=True)
    viewed_by = models.ForeignKey(
        'auth.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='viewed_partitions'
    )
    
    def mark_as_viewed(self, user=None):
        """Mark this partition as viewed"""
        self.is_viewed = True
        self.viewed_at = timezone.now()
        if user:
            self.viewed_by = user
        self.save(update_fields=['is_viewed', 'viewed_at', 'viewed_by'])
        return f"Partition {self.name} marked as viewed"
    
    def update_partition_used_space(self, used_space_str):
        """
        Update the partition's used space and calculate free space.
        Both `used_space_str` and `self.total_size` are expected to be strings like '50.00 GB'.
        """
        try:
            # Split values and units
            total_size_val, total_unit = self.total_size.split()
            print(total_size_val)
            used_size_val, used_unit = used_space_str.split()
            print(used_size_val)

            # Validate units
            if total_unit != used_unit:
                raise ValueError(f"Unit mismatch: total size unit '{total_unit}' vs used space unit '{used_unit}'")

            # Store used space
            self.used_space = used_space_str

            # Calculate and store free space
            free_space = float(total_size_val) - float(used_size_val)
            self.free_space = f"{free_space:.2f} {total_unit}"

            self.save()
            return f"Partition updated successfully: free space = {self.free_space}"

        except ValueError as ve:
            print(f"[ValueError] {ve}")
            raise
        except Exception as e:
            print(f"Error updating partition used space: {e}")
            raise

class NIC(models.Model):
    uuid = models.UUIDField(primary_key=True, editable=False)
    device = models.ForeignKey(Device, on_delete=models.CASCADE, related_name='nic')
    make = models.CharField(max_length=255)
    model = models.CharField(max_length=255)
    number_of_ports = models.IntegerField()
    max_speed = models.CharField(max_length=50)
    supported_speeds = models.CharField(max_length=255)
    serial_number = models.CharField(max_length=255)
    mac_address = models.CharField(max_length=50)
    history = HistoricalRecords(inherit=True)
    
    is_flagged = models.BooleanField(default=False)
    flagged_at = models.DateTimeField(null=True, blank=True)
    flagged_reason = models.TextField(null=True, blank=True)
    def __str__(self):
        return f"{self.make}  - NIC {self.uuid}"
    
    # viewing tracking fields
    is_viewed = models.BooleanField(default=False)
    viewed_at = models.DateTimeField(null=True, blank=True)
    viewed_by = models.ForeignKey(
        'auth.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='viewed_nics'
    )
    
    def mark_as_viewed(self, user=None):
        """Mark this NIC as viewed"""
        self.is_viewed = True
        self.viewed_at = timezone.now()
        if user:
            self.viewed_by = user
        self.save(update_fields=['is_viewed', 'viewed_at', 'viewed_by'])
        return f"NIC {self.uuid} marked as viewed"
    
class Port(models.Model):
    uuid = models.UUIDField(primary_key=True, editable=False)
    nic = models.ForeignKey(NIC, on_delete=models.CASCADE, related_name='port')
    name = models.CharField(max_length=50)
    operating_speed = models.CharField(max_length=50)

    PHYSICAL_LOGICAL_CHOICES = [
        ('physical', 'Physical'),
        ('logical', 'Logical'),
    ]
    is_physical_logical = models.CharField(max_length=15, choices=PHYSICAL_LOGICAL_CHOICES, default='physical')

    LOGICAL_TYPE_CHOICES = [
        ('bridge', 'Bridge'),
        ('vlan', 'VLAN'),
        ('bond', 'Bond'),
        ('vxlan', 'VXLAN'),
        ('vtep', 'VTEP'),
        ('veth', 'VETH'),
    ]
    logical_type = models.CharField(max_length=20, choices=LOGICAL_TYPE_CHOICES, default='bridge')
    
    is_flagged = models.BooleanField(default=False)
    flagged_at = models.DateTimeField(null=True, blank=True)
    flagged_reason = models.TextField(null=True, blank=True)
    
    # New viewing tracking fields
    is_viewed = models.BooleanField(default=False)
    viewed_at = models.DateTimeField(null=True, blank=True)
    viewed_by = models.ForeignKey(
        'auth.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='viewed_ports'  
    )
    
    def mark_as_viewed(self, user=None):
        """Mark this port as viewed"""
        self.is_viewed = True
        self.viewed_at = timezone.now()
        if user:
            self.viewed_by = user
        self.save(update_fields=['is_viewed', 'viewed_at', 'viewed_by'])
        return f"Port {self.interface_name} marked as viewed"

    def __str__(self):
        return f"{self.name}  - NIC {self.nic.uuid}"
    
class IPAddress(models.Model):
    uuid = models.UUIDField(primary_key=True, editable=False)
    port = models.ForeignKey(Port, on_delete=models.CASCADE, related_name='ip')
    address = models.GenericIPAddressField()
    gateway = models.GenericIPAddressField(null=True)
    subnet_mask = models.CharField(max_length=50)
    dns = models.CharField(max_length=50)
    
    def __str__(self):
        return self.address

class GPU(models.Model):
    uuid = models.UUIDField(primary_key=True, editable=False)
    device = models.ForeignKey(Device, on_delete=models.CASCADE, related_name='gpu')
    make = models.CharField(max_length=255)
    model = models.CharField(max_length=255)
    serial_number = models.CharField(max_length=255)
    size = models.CharField(max_length=50)
    driver = models.CharField(max_length=255)

    def __str__(self):
        return f"{self.model}  - Device {self.device.uuid}"

#  ============================================================================================
#  ---------------Monitoring models-----------------

class Event(models.Model):
    EVENT_TYPES = [
        ("Monitoring Data", "MON_DATA"),
        ("Info", "INFO"),
        ("Alert", "ALERT"),
        ("Error", "ERROR"),
        ("Update","UPDATE"),
        ("Delete", "DELETE"),
        ("Create", "CREATE"),
        ("Connection", "CONNECTION"),
        ("Disconnect", "DISCONNECT"),
    ]
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE)
    event_type = models.CharField(max_length=20, choices=EVENT_TYPES)
    description = models.TextField()
    component_type = models.CharField(max_length=50, null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']
        
    def __str__(self):
        return self.event_type    
    
class MonitoringCheckpoint(models.Model):
    uuid = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE, related_name='checkpoints')
    event = models.ForeignKey(Event, on_delete=models.SET_NULL, null=True, blank=True, related_name='checkpoints')
    timestamp_utc = models.DateTimeField(verbose_name="Timestamp (UTC)", db_index=True)
    timestamp_rao = models.CharField(max_length=100, null=True, blank=True, verbose_name="Timestamp (Recorded at origin)")
    timestamp_tz = models.CharField(max_length=100, null=True, blank=True, verbose_name="Timestamp (Timezone)")
    # ── Health Status ───────────────────────────────────────────
    HEALTH_GREEN = "green"
    HEALTH_AMBER = "amber"
    HEALTH_RED = "red"
    HEALTH_MAINTENANCE = "maintenance"

    HEALTH_CHOICES = [
        (HEALTH_GREEN, "Green"),
        (HEALTH_AMBER, "Amber"),
        (HEALTH_RED, "Red"),
        (HEALTH_MAINTENANCE, "Maintenance"),
    ]

    health_status = models.CharField(
        max_length=15,
        choices=HEALTH_CHOICES,
        null=True,   
        blank=True,
        default=None,    
        db_index=True
    )
    
    class Meta:
        ordering = ['-timestamp_utc']
        unique_together = ('agent', 'timestamp_utc')
        verbose_name = "Monitoring Checkpoint"
        verbose_name_plural = "Monitoring Checkpoints"
    
    def __str__(self):
        return f"Checkpoint for {self.agent}"
    
    def getTimestampInTimezone(self, tz_name):
        """
        Convert UTC timestamp to specified timezone.
        """
        from pytz import timezone as pytz_timezone
        try:
            target_tz = pytz_timezone(tz_name)
            return self.timestamp_utc.astimezone(target_tz).isoformat()
        except Exception as e:
            print(f"Error converting timezone: {e}")
            return self.timestamp_utc.isoformat()

class MemoryMonitoring(models.Model):
    component = models.ForeignKey(Memory,on_delete=models.CASCADE)
    checkpoint = models.ForeignKey(MonitoringCheckpoint, on_delete=models.CASCADE, related_name='memory_data',unique=False)
    memory_used = models.CharField(max_length=100)
    memory_available = models.CharField(max_length=100)
    total_memory = models.CharField(max_length=100)
    memory_utilization=models.DecimalField(max_digits=5, decimal_places=2)
    
    def __str__(self):
        return f"Memory monitoring for  - Device {self.component.device.uuid}"

class CpuMonitoring(models.Model):
    checkpoint = models.ForeignKey(MonitoringCheckpoint, on_delete=models.CASCADE, related_name='cpu_data',unique=False)
    p_cores_perc = models.JSONField(default=dict)
    l_cores_perc = models.JSONField(default=dict)
    # ctx_switches = models.IntegerField()
    # hw_irq = models.IntegerField()
    # sw_irq = models.IntegerField()
    # syscalls = models.IntegerField()
    ctx_switches = models.BigIntegerField(null=True)
    syscalls = models.BigIntegerField(null=True)
    hw_irq = models.BigIntegerField(null=True)
    sw_irq = models.BigIntegerField(null=True)
    cpu_utilization=models.DecimalField(max_digits=5, decimal_places=2)
    component = models.ForeignKey(CPU, on_delete=models.CASCADE, related_name='cpu_monitoring_data')

    # def save(self, *args, **kwargs):
    #     if "%" in str(self.cpu_utilization):
    #         self.cpu_utilization = str(self.cpu_utilization).replace("%", "")
    #     super().save(*args, **kwargs)
    
    def __str__(self):
        return f"CPU monitoring  - Device {self.component.device.uuid}"

class DiskMonitoring(models.Model):
    checkpoint = models.ForeignKey(MonitoringCheckpoint, on_delete=models.CASCADE, related_name='disk_data')
    total_disk_size = models.DecimalField(max_digits=20, decimal_places=2)
    total_disk_usage = models.CharField(max_length=100)
    unallocated_disk_space = models.DecimalField(max_digits=20, decimal_places=2)
    allocated_disk_space = models.DecimalField(max_digits=20, decimal_places=2)
    disk_usage_percent = models.DecimalField(max_digits=5, decimal_places=2)
    read_count_io = models.CharField(max_length=100)
    write_count_io = models.CharField(max_length=100)
    bytes_read_io = models.CharField(max_length=100) 
    bytes_write_io = models.CharField(max_length=100)
    read_time_io = models.CharField(max_length=100)
    write_time_io = models.CharField(max_length=100)
    component = models.ForeignKey(Storage, on_delete=models.CASCADE, related_name='monitoring_data')
    
    def __str__(self):
        return f"Disk monitoting - Storage {self.checkpoint.uuid}"


class PartitionMonitoring(models.Model):
    checkpoint = models.ForeignKey(MonitoringCheckpoint,on_delete=models.CASCADE,unique=False)
    # storage_disk= models.ForeignKey(Storage, on_delete=models.CASCADE, related_name='partition_data')
    free_space = models.BigIntegerField()
    used_space = models.BigIntegerField()
    used_space_perc = models.DecimalField(max_digits=5, decimal_places=2)
    component = models.ForeignKey(Partition, on_delete=models.CASCADE, related_name='monitoring_data')
    
    def __str__(self):
        return f"Partition monitoring  - Storage {self.component.storage.uuid}"


class NetworkPortMonitoring(models.Model):
    checkpoint = models.ForeignKey(MonitoringCheckpoint, on_delete=models.CASCADE, related_name='network_data')
    bytes_sent = models.BigIntegerField()  
    bytes_received = models.BigIntegerField()
    packets_sent = models.BigIntegerField()
    packets_received = models.BigIntegerField()
    error_in = models.IntegerField()
    error_out = models.IntegerField()
    drop_in = models.IntegerField()
    drop_out = models.IntegerField()
    network_utilization = models.DecimalField(max_digits=5, decimal_places=2)
    component = models.ForeignKey(Port, on_delete=models.CASCADE, related_name='monitoring_data')
   

    def __str__(self):
        return f"Networkport monitoring for NIC-{self.component.nic.uuid}"


class WebUser(BaseAuditModel):

    AUDIT_IGNORE_FIELDS = ["is_email_verified", "date_joined","last_login","is_email_override"]
    role = models.ForeignKey(Role, on_delete=models.PROTECT, null=True)
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = models.CharField(max_length=100, unique=True)
    password = models.CharField(max_length=128)
    email = models.EmailField(unique=True)
    is_user_enabled = models.BooleanField(default=True)
    date_joined = models.DateTimeField(auto_now_add=True)
    last_login = models.DateTimeField(null=True, blank=True)
    is_email_verified = models.BooleanField(default=False)
    is_email_override = models.BooleanField(default=False)
    # Helper methods for role checking
    @property
    def is_authenticated(self):
        return True
 
    @classmethod
    def get_available_roles(cls):
        """Get all unique roles currently in use"""
        return cls.objects.values_list('role', flat=True).distinct().order_by('role')
    
    def __str__(self):
        return f"{self.username} ({self.role})"
    
class Alert(models.Model):
    SEVERITY_CHOICES = [
        ('Info', 'Info'),
        ('Warning', 'Warning'),
        ('Critical', 'Critical'),
    ]

    ALERT_TYPE_CHOICES = [
        ('CPU Usage', 'CPU Usage'),
        ('Memory Usage', 'Memory Usage'),
        ('Disk Usage', 'Disk Usage'),
        ('Port Usage', 'Port Usage'),
        ('Device Offline', 'Device Offline'),
        ('Component Down', 'Component Down'),
        ('IP Down', 'IP Down'),
        ('Partition Usage', 'Partition Usage'),
        ('Agent Down', 'Agent Down'),
        ('Maintenance',     'Maintenance'), 
    ]
    
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, blank=True, null=True)
    object_id = models.CharField(max_length=255, blank=True, null=True)
    source = GenericForeignKey('content_type', 'object_id')
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE, related_name='alerts', null=True, blank=True)
    uuid = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    device_name = models.CharField(max_length=100)
    alert_type = models.CharField(max_length=50, choices=ALERT_TYPE_CHOICES)
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES)
    source_uuid = models.CharField(max_length=100)  
    message = models.TextField()
    checkpoint = models.ForeignKey(MonitoringCheckpoint, on_delete=models.CASCADE, related_name='alerts', null=True, blank=True)
    details = models.TextField() 
    created_at = models.DateTimeField(default=timezone.now)
    is_read=models.BooleanField(default=False)
    #filed for maintenace
    suppressed   = models.BooleanField(default=False)

    class Meta:
        db_table = 'alerts'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.severity.upper()}] {self.alert_type} - {self.source_uuid}"
    
class Group(models.Model):
    user = models.ForeignKey(WebUser, on_delete=models.CASCADE,related_name="webuser")
    group_id=models.CharField(max_length=200)
    group_name = models.CharField(max_length=200)
    group_description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('user', 'group_name')
    
class GroupAgentAssignment(models.Model):
    """Just assign agents to groups with priority"""
    PRIORITY_CHOICES = [
        ('P1', 'Priority 1'),
        ('P2', 'Priority 2'), 
        ('P3', 'Priority 3'),
        ('P4', 'Priority 4'),
    ]
    
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='agent_assignments')
    agent = models.ForeignKey(Agent, on_delete=models.CASCADE, related_name='group_assignments')
    priority = models.CharField(max_length=2, choices=PRIORITY_CHOICES)
    added_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('group', 'agent')


class ApplicationDiskIO(models.Model):
    uuid = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    checkpoint = models.ForeignKey(MonitoringCheckpoint, on_delete=models.CASCADE, related_name='ApplicationDiskIO')
    storage = models.ForeignKey(Storage, on_delete=models.CASCADE, related_name='disk_io')
    name = models.CharField(max_length=255)
    file_path = models.CharField(max_length=255,null=True) 
    pid = models.PositiveIntegerField()
    read_b_sec = models.BigIntegerField(default=0)  
    write_b_sec = models.BigIntegerField(default=0)  
    total_b_sec = models.BigIntegerField(default=0)  
    io_priority = models.PositiveSmallIntegerField(default=0)  
    response_time = models.FloatField(default=0.0)  
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} (PID {self.pid}) on {self.storage.uuid}"
    
    class Meta:
        ordering = ['-read_b_sec']  
        verbose_name = "Application Disk I/O"
        verbose_name_plural = "Application Disk I/O"
        
class ApplicationMemoryIO(models.Model):
    uuid = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    checkpoint = models.ForeignKey(MonitoringCheckpoint, on_delete=models.CASCADE, related_name='ApplicationMemoryIO')
    memory = models.ForeignKey(Memory, on_delete=models.CASCADE, related_name='processes')
    name = models.CharField(max_length=255) 
    pid = models.PositiveIntegerField() 
    commit_kb = models.BigIntegerField(default=0)
    working_set_kb = models.BigIntegerField(default=0)
    private_kb = models.BigIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} (PID {self.pid}) on Memory {self.memory.uuid}"
    class Meta:
        ordering = ['-working_set_kb']
        verbose_name = "Application Memory"
        verbose_name_plural = "Application Memory"


class ApplicationCPUIO(models.Model):
    uuid = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    checkpoint = models.ForeignKey(MonitoringCheckpoint, on_delete=models.CASCADE, related_name='ApplicationCPUIO')
    cpu = models.ForeignKey(CPU, on_delete=models.CASCADE, related_name='processes')
    name = models.CharField(max_length=255) 
    pid = models.PositiveIntegerField()     
    status = models.CharField(max_length=50, default="running")
    threads = models.PositiveIntegerField(default=1)
    cpu_average = models.FloatField(default=0.0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} (PID {self.pid}) on CPU {self.cpu.uuid}"

    class Meta:
        ordering = ['-cpu_average']
        verbose_name = "Application CPU"
        verbose_name_plural = "Application CPU"        