# BaseApp/management/commands/cleanup_data.py
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import date
from django.db import transaction
from BaseApp.models import AuditLog, GlobalConfig, MonitoringCheckpoint # Add IPMonitoring
from BaseApp.models.ipmonitor import IPMonitorCheckpoint  # New import


BATCH_SIZE = 5000

def batch_delete(queryset, label):
    total_deleted = 0

    pk_name = queryset.model._meta.pk.name

    while True:
        ids = list(queryset.values_list(pk_name, flat=True)[:BATCH_SIZE])

        if not ids:
            break

        deleted_count, _ = (queryset.model.objects.filter(**{f"{pk_name}__in": ids}).delete())
        total_deleted += deleted_count

        print(f"{label}: Deleted {deleted_count} rows -(Total: {total_deleted})" )

    return total_deleted

class Command(BaseCommand):
    def handle(self, *args, **options):
        today_str = str(date.today())
        print(f"=== Starting data cleanup for {today_str} ===")
        
        # Check if it already ran today
        last_run_config = GlobalConfig.objects.get(item_key='dataretention.last_run')
        print(f"Last run date: {last_run_config.item_value}")
        if last_run_config.item_value == today_str:
            self.stdout.write(self.style.SUCCESS("Cleanup already completed for today. Skipping..."))
            return
        
        DEFAULT_RETENTION_DAYS = 30
        
        # Get retention days for each data type
        retention_configs = {
            'monitoring': DEFAULT_RETENTION_DAYS,
            'auditlogs': DEFAULT_RETENTION_DAYS,
            'ipmonitoring': DEFAULT_RETENTION_DAYS  # New!
        }
        
        config_keys = ['dataretention.monitoring', 'dataretention.auditlogs', 'dataretention.ipmonitoring']
        for key in config_keys:
            try:
                config = GlobalConfig.objects.get(item_key=key)
                retention_configs[key.split('.')[-1]] = int(config.item_value)
            except GlobalConfig.DoesNotExist:
                print(f"Warning: No config for {key}, using default {DEFAULT_RETENTION_DAYS}")
        
        # with transaction.atomic():
            # Cleanup MonitoringCheckpoint
            cutoff = timezone.now() - timezone.timedelta(days=retention_configs['monitoring'])
            deleted_count= batch_delete(MonitoringCheckpoint.objects.filter(timestamp_utc__lt=cutoff),"MonitoringCheckpoint")
            
            # Cleanup AuditLog
            audit_cutoff = timezone.now() - timezone.timedelta(days=retention_configs['auditlogs'])
            audit_deleted = batch_delete(AuditLog.objects.filter(timestamp__lt=audit_cutoff),"AuditLog")
            
            # NEW: Cleanup IPMonitoring
            ip_cutoff = timezone.now() - timezone.timedelta(days=retention_configs['ipmonitoring'])
            ip_deleted = batch_delete(IPMonitorCheckpoint.objects.filter(created_at__lt=ip_cutoff),"IPMonitorCheckpoint") # Adjust field name
            
            # Update last run date
            last_run_config.item_value = today_str
            last_run_config.save()
            
            self.stdout.write(
                self.style.SUCCESS(
                    f"Cleanup complete: "
                    f"Monitoring: {deleted_count}, "
                    f"AuditLogs: {audit_deleted}, "
                    f"IPMonitoring: {ip_deleted} records deleted"
                )
            )
