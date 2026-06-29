from django.db import models
import uuid
from django.db import models
from django.core.exceptions import ValidationError
from django.core.validators import validate_email, validate_ipv4_address, validate_ipv6_address
import re
import logging
import base64, json
from django.db.models.signals import post_save
from django.dispatch import receiver
from django_celery_beat.models import PeriodicTask, IntervalSchedule

from BaseApp.models.base_audit_model import BaseAuditModel
logger = logging.getLogger("agent_monitoring")

class GlobalConfig(BaseAuditModel):
    #  Generic key/value config storage.
    # - key: unique identifier
    # - value: stored as string (or JSON for structured)
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item_key = models.CharField(max_length=128)
    item_value = models.TextField()

    ALLOWED_KEYS = [
    # ── SMTP ───────────────────────────────────────
    'smtp.host',
    'smtp.port',
    'smtp.username',
    'smtp.password',
    'smtp.encryption_type',
    'smtp.from_email',

    # ── ALERT ──────────────────────────────────────
    'alert.to_emails',
    'alert.cc_emails',
    'alert.support_email',
    'alert.contact',
    'alert.enable_email_alerts',

    # ── MONITORING (default) ───────────────────────
    'monitoring.cpuThreshold',
    'monitoring.cpu_warning_threshold',       # NEW
    'monitoring.ramThreshold',
    'monitoring.ram_warning_threshold',       # NEW
    'monitoring.diskThreshold',
    'monitoring.disk_warning_threshold',      # NEW
    'monitoring.networkThreshold',
    'monitoring.network_warning_threshold',   # NEW
    'monitoring.repeatFrequency',
    'monitoring.warning_repeatFrequency',
    'monitoring.ip_ping_interval',
    'monitoring.ip_ping_count',
    'monitoring.ip_ping_timeout',

    # ── MONITORING P1 ──────────────────────────────
    'monitoring_p1.cpuThreshold',
    'monitoring_p1.cpu_warning_threshold',    # NEW
    'monitoring_p1.ramThreshold',
    'monitoring_p1.ram_warning_threshold',    # NEW
    'monitoring_p1.diskThreshold',
    'monitoring_p1.disk_warning_threshold',   # NEW
    'monitoring_p1.networkThreshold',
    'monitoring_p1.network_warning_threshold',# NEW
    'monitoring_p1.repeatFrequency',
    'monitoring_p1.warning_repeatFrequency',
    'monitoring_p1.ip_ping_interval',

    # ── MONITORING P2 ──────────────────────────────
    'monitoring_p2.cpuThreshold',
    'monitoring_p2.cpu_warning_threshold',    # NEW
    'monitoring_p2.ramThreshold',
    'monitoring_p2.ram_warning_threshold',    # NEW
    'monitoring_p2.diskThreshold',
    'monitoring_p2.disk_warning_threshold',   # NEW
    'monitoring_p2.networkThreshold',
    'monitoring_p2.network_warning_threshold',# NEW
    'monitoring_p2.repeatFrequency',
    'monitoring_p2.warning_repeatFrequency',
    'monitoring_p2.ip_ping_interval',

    # ── MONITORING P3 ──────────────────────────────
    'monitoring_p3.cpuThreshold',
    'monitoring_p3.cpu_warning_threshold',    # NEW
    'monitoring_p3.ramThreshold',
    'monitoring_p3.ram_warning_threshold',    # NEW
    'monitoring_p3.diskThreshold',
    'monitoring_p3.disk_warning_threshold',   # NEW
    'monitoring_p3.networkThreshold',
    'monitoring_p3.network_warning_threshold',# NEW
    'monitoring_p3.repeatFrequency',
    'monitoring_p3.warning_repeatFrequency',
    'monitoring_p3.ip_ping_interval',

    # ── MONITORING P4 ──────────────────────────────
    'monitoring_p4.cpuThreshold',
    'monitoring_p4.cpu_warning_threshold',    # NEW
    'monitoring_p4.ramThreshold',
    'monitoring_p4.ram_warning_threshold',    # NEW
    'monitoring_p4.diskThreshold',
    'monitoring_p4.disk_warning_threshold',   # NEW
    'monitoring_p4.networkThreshold',
    'monitoring_p4.network_warning_threshold',# NEW
    'monitoring_p4.repeatFrequency',
    'monitoring_p4.warning_repeatFrequency',
    'monitoring_p4.ip_ping_interval',

    # ── DATA RETENTION ─────────────────────────────
    'dataretention.monitoring',
    'dataretention.auditlogs',
    'dataretention.last_run',
    'dataretention.ipmonitoring',
]

    def __str__(self):
            return self.item_key
    
    @classmethod
    def validate_config(cls, key, value):
        """
        Single function to validate BOTH key and value
        
        Args:
            key: Configuration key
            value: Configuration value
        
        Returns:
            tuple: (is_valid, error_message, cleaned_value)
        """
        #  STEP 1: Validate key exists
        if key not in cls.ALLOWED_KEYS:
            return False, f"Invalid key '{key}'. Allowed: {', '.join(cls.ALLOWED_KEYS)}", None
        
        #  STEP 2: Validate value based on key
        str_value = str(value).strip()
        
        # Empty value check
        if not str_value:
            return False, f"{key}: Value cannot be empty", None
        
        # SMTP host - IP or domain
        if key == 'smtp.host':
            if cls._is_valid_hostname(str_value):
                return True, None, str_value
            return False, f"{key}: Must be a valid IP address or domain name", None
        
        # SMTP port - 1-65535
        elif key == 'smtp.port':
            try:
                port = int(str_value)
                if 1 <= port <= 65535:
                    return True, None, str(port)
                return False, f"{key}: Port must be between 1 and 65535", None
            except ValueError:
                return False, f"{key}: Must be a valid integer", None
        
        # Email fields
        elif key in ['smtp.from_email']:
            try:
                validate_email(str_value)
                return True, None, str_value
            except ValidationError:
                return False, f"{key}: Must be a valid email address", None
        

        
        # Encryption type - TLS/SSL/NONE
        elif key == 'smtp.encryption_type':
            if str_value.upper() in ['TLS', 'SSL', 'NONE']:
                return True, None, str_value.upper()
            return False, f"{key}: Must be TLS, SSL, or NONE", None
        
        # Email lists - comma-separated
        elif key in ['alert.to_emails', 'alert.cc_emails']:
            # Handle array input
            if isinstance(value, list):
                emails = [str(e).strip() for e in value if e]
            else:
                # Handle comma-separated string
                emails = [e.strip() for e in str_value.split(',') if e.strip()]
            
            if not emails:
                return False, f"{key}: At least one email required", None
            
            # Validate each email
            invalid_emails = []
            for email in emails:
                try:
                    validate_email(email)
                except ValidationError:
                    invalid_emails.append(email)
            
            if invalid_emails:
                return False, f"{key}: Invalid email(s): {', '.join(invalid_emails)}", None
            
            # Return as comma-separated string for storage
            return True, None, ','.join(emails)
        
        elif key == 'alert.enable_email_alerts':
            str_lower = str_value.lower().strip()
            if str_lower == 'true':
                return True, None, 'True'   # Store 'True' in DB 
            elif str_lower == 'false':
                return True, None, 'False'  # Store 'False' in DB 
            else:
                return False, f"{key}: Must be 'true' or 'false'", None
        # Monitoring thresholds - 0-100
        elif key in ['monitoring.cpuThreshold', 'monitoring.ramThreshold', 
                     'monitoring.diskThreshold', 'monitoring.networkThreshold']:
            try:
                threshold = int(str_value)
                if 0 <= threshold <= 100:
                    return True, None, str(threshold)
                return False, f"{key}: Must be between 0 and 100", None
            except ValueError:
                return False, f"{key}: Must be a valid integer", None
        
        # Repeat frequency - positive integer
        elif key == 'monitoring.repeatFrequency':
            try:
                freq = int(str_value)
                if freq > 0:
                    return True, None, str(freq)
                return False, f"{key}: Must be greater than 0", None
            except ValueError:
                return False, f"{key}: Must be a valid integer", None

        
        # Default: accept as string
        return True, None, str_value
    
   
    @staticmethod
    def _is_valid_hostname(hostname):
        """Helper: Check if valid IP or domain"""
        if not hostname:
            return False
        
        # IPv4
        try:
            validate_ipv4_address(hostname)
            return True
        except ValidationError:
            pass
        
        # IPv6
        try:
            validate_ipv6_address(hostname)
            return True
        except ValidationError:
            pass
        
        # Domain name
        domain_regex = re.compile(
            r'^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$'
        )
        simple_hostname = re.compile(r'^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$')
        
        return bool(domain_regex.match(hostname) or simple_hostname.match(hostname))
   
    

    @classmethod
    def get_smtp_config(cls):
        smtp_keys=[key for key in cls.ALLOWED_KEYS if key.startswith('smtp.')]
        smtp_config= {}
        for key in smtp_keys:
            try:
                config_obj=cls.objects.get(item_key=key)
                smtp_config[key]=config_obj.item_value
            except cls.DoesNotExist:
                logger.warning(f"SMTP config '{key}' not found in database.")
        return smtp_config


    @classmethod
    def get_config(cls, key, default=None):
        """Get a single config value"""
        try:
            return cls.objects.get(item_key=key).item_value
        except cls.DoesNotExist:
            logger.warning(f"Config '{key}' not found, using default: {default}")
            return default

    @classmethod
    def get_priority_dashboard_thresholds(cls, priority="p1"):
        priority = (priority or "p1").lower()

        prefix_map = {
            "p1": "monitoring_p1",
            "p2": "monitoring_p2",
            "p3": "monitoring_p3",
            "p4": "monitoring_p4",
            "np": "monitoring",
        }

        prefix = prefix_map.get(priority, "monitoring")

        return {
            "cpu": {
                "warning": int(cls.get_config(f"{prefix}.cpu_warning_threshold", 75)),
                "critical": int(cls.get_config(f"{prefix}.cpuThreshold", 90)),
            },
            "memory": {
                "warning": int(cls.get_config(f"{prefix}.ram_warning_threshold", 70)),
                "critical": int(cls.get_config(f"{prefix}.ramThreshold", 85)),
            },
            "disk": {
                "warning": int(cls.get_config(f"{prefix}.disk_warning_threshold", 75)),
                "critical": int(cls.get_config(f"{prefix}.diskThreshold", 89)),
            },
            "network": {
                "warning": int(cls.get_config(f"{prefix}.network_warning_threshold", 5)),
                "critical": int(cls.get_config(f"{prefix}.networkThreshold", 80)),
            },
        }

    @classmethod
    def get_mon_thresholds(cls):
        monitoring_keys = [k for k in cls.ALLOWED_KEYS if k.startswith('monitoring.') or k.startswith('monitoring_p')]
        monitoring_keys += [f"{x}.partition_monitoring" for x in ['monitoring', 'monitoring_p1', 'monitoring_p2', 'monitoring_p3', 'monitoring_p4']]

        def change_key(key):
            key_map = {
                'cpuThreshold': 'cpu_monitoring',
                'ramThreshold': 'memory_monitoring',
                'diskThreshold': 'disk_monitoring',
                'networkThreshold': 'network_monitoring',
                'repeatFrequency': 'repeatFrequency',
            }
            new_key = key.split('.')
            for old, new in key_map.items():
                if new_key[-1] == old:
                    new_key[-1] = new
            return '.'.join(new_key)

        return {
                    change_key(x): int(
                        # ✅ FIX: derive the correct disk threshold key from the partition key
                        cls.get_config(x.replace("partition_monitoring", "diskThreshold"), 90)
                    )
                    if "partition_monitoring" in x
                    else int(cls.get_config(x, 90))
                    for x in monitoring_keys
                }  


            # "cpu_monitoring": int(cls.get_config('monitoring.cpuThreshold', 90)),
            # "memory_monitoring": int(cls.get_config('monitoring.ramThreshold', 90)),
            # "disk_monitoring": int(cls.get_config('monitoring.diskThreshold', 90)),
            # "network_monitoring": int(cls.get_config('monitoring.networkThreshold', 90)),
            # "partition_monitoring": int(cls.get_config('monitoring.diskThreshold', 90)),  # Using disk threshold for partition
            # "repeatFrequency": int(cls.get_config('monitoring.repeatFrequency', 30)),
        # }

    @classmethod
    def set_license_key(cls, license_key):
        obj, _ = cls.objects.update_or_create(
            item_key="license.key",
            defaults={"item_value": license_key},
        )
        return obj

    @classmethod
    def get_license_key(cls):
        try:
            return cls.objects.get(item_key="license.key").item_value
        except cls.DoesNotExist:
            return None

    @staticmethod
    def load_global_config_to_redis(rdb):
        logger = logging.getLogger('agent_consumer')
        # Initialize Redis connection for the app, rdb is Redis DB
        # rdb = redis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, db=1)
        logger.info(f"BaseApp is ready. Redis -> {rdb}")
        thresholds = GlobalConfig.get_mon_thresholds()
        logger.info(f"Loaded monitoring thresholds: {thresholds}")
        for key, value in thresholds.items():
            a = rdb.set(f"monitoring:thresholds:{key}", value)
            print(f"Set Redis key monitoring:thresholds:{key} -> {a}")
            logger.info(f"Set Redis key monitoring:thresholds:{key} -> {a}")

@receiver(post_save, sender=GlobalConfig)
def update_celery_schedule_on_ping_interval_change(sender, instance, created, **kwargs):
    logger.info("Auto-update Celery schedule when ping_interval changes")
    # List of keys that trigger schedule update
    PING_INTERVAL_MAPPING = {
        'monitoring.ip_ping_interval': 'default',
        'monitoring_p1.ip_ping_interval': 'P1', 
        'monitoring_p2.ip_ping_interval': 'P2',
        'monitoring_p3.ip_ping_interval': 'P3',
        'monitoring_p4.ip_ping_interval': 'P4'
    }
    
    if instance.item_key not in PING_INTERVAL_MAPPING:
        return  # Not a ping interval key, ignore
    
    try:
        interval_seconds = int(instance.item_value)
        short_name = PING_INTERVAL_MAPPING[instance.item_key]
        
        logger.info(f"Detected {instance.item_key} → {short_name} change to {interval_seconds}s")
       

        # Get or create the interval schedule
        schedule, _ = IntervalSchedule.objects.get_or_create(
            every=interval_seconds,
            period=IntervalSchedule.SECONDS,
        )
        
        # Update task directly (single query)
        task_name = f'Ping Priority {short_name} IPs'
        updated_count = PeriodicTask.objects.filter(name=task_name).update(
            interval=schedule,
            enabled=True
        )
        
        if updated_count > 0:
            logger.info(f"Updated '{task_name}' to {interval_seconds}s")
        else:
            logger.warning(f"Task '{task_name}' not found.")
    
    except ValueError:
        logger.error(f"Invalid ping_interval value: {instance.item_value}")
    except Exception as e:
        logger.error(f"Error updating Celery schedule: {e}", exc_info=True)


