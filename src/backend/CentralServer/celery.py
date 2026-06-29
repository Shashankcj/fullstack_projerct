import os
import json
import logging
import traceback
from celery import Celery
from celery.signals import beat_init

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CentralServer.settings')

logger = logging.getLogger('agent_monitoring') 

app = Celery('CentralServer')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.conf.update(
    enable_utc=True,
    beat_scheduler='django_celery_beat.schedulers:DatabaseScheduler',
)
app.autodiscover_tasks(['BaseApp'])


@app.task(bind=True)   
def debug_task(self):
    print(f'Request: {self.request!r}')


@beat_init.connect
def setup_periodic_tasks(sender, **kwargs):
    try:
        from BaseApp.models import GlobalConfig, PriorityGroup
        from django_celery_beat.models import PeriodicTask, IntervalSchedule

        priority_config_keys = {
            'P1': 'monitoring_p1.ip_ping_interval',
            'P2': 'monitoring_p2.ip_ping_interval',
            'P3': 'monitoring_p3.ip_ping_interval',
            'P4': 'monitoring_p4.ip_ping_interval',
            'default': 'monitoring.ip_ping_interval'
        }
        priority_choice_map = {
            'P1': 'p1', 'P2': 'p2',
            'P3': 'p3', 'P4': 'p4',
            'default': 'np'
        }

        # ── Priority ping setup ───────────────────────────────────
        for short_name, config_key in priority_config_keys.items():
            try:
                ping_config = GlobalConfig.objects.get(item_key=config_key)
                interval_seconds = int(ping_config.item_value)
                if interval_seconds <= 0:
                    logger.warning(f"{short_name} ping disabled (interval={interval_seconds}s)")
                    continue
            except GlobalConfig.DoesNotExist:
                logger.warning(f"GlobalConfig '{config_key}' not found, skipping {short_name}")
                continue

            choice_value = priority_choice_map[short_name]
            try:
                priority_group = PriorityGroup.objects.get(priority_name=choice_value)
                logger.info(f"Found {short_name} → '{choice_value}' (UUID: {priority_group.uuid})")
            except PriorityGroup.DoesNotExist:
                logger.warning(f"PriorityGroup '{choice_value}' not found, skipping {short_name}")
                continue

            schedule, _ = IntervalSchedule.objects.get_or_create(
                every=interval_seconds,
                period=IntervalSchedule.SECONDS,
            )
            task_name = f'Ping Priority {short_name} IPs'
            task_args = json.dumps([str(priority_group.uuid)])
            task, created = PeriodicTask.objects.get_or_create(
                name=task_name,
                defaults={
                    'task': 'BaseApp.tasks.ping_priority_ips',
                    'interval': schedule,
                    'args': task_args,
                    'enabled': True,
                }
            )
            if not created:
                task.task     = 'BaseApp.tasks.ping_priority_ips'  # ✅ sync task name
                task.interval = schedule
                task.args     = task_args
                task.enabled  = True
                task.save()
            logger.info(f"{task_name}: {'Created' if created else 'Updated'}")

        # ── Auto Disable Expired Maintenance (every 30s) ─────────
        maintenance_schedule, _ = IntervalSchedule.objects.get_or_create(
            every=30, period=IntervalSchedule.SECONDS,
        )

        maintenance_task, created = PeriodicTask.objects.get_or_create(
            name="Auto Disable Expired Maintenance",
            defaults={
                "task": "BaseApp.tasks.disable_expired_maintenance",
                "interval": maintenance_schedule,
                "args": "[]",
                "enabled": True,
            }
        )
        if not created:
            maintenance_task.task     = "BaseApp.tasks.disable_expired_maintenance"   # ✅
            maintenance_task.interval = maintenance_schedule
            maintenance_task.enabled  = True
            maintenance_task.save()
        logger.info(f"Auto Disable Maintenance: {'Created' if created else 'Updated'} — every 30s")

        # ── Auto Enable Scheduled Maintenance (every 60s) ─────────
        enable_task, created = PeriodicTask.objects.get_or_create(
            name="Auto Enable Scheduled Maintenance",
            defaults={
                "task": "BaseApp.tasks.enable_scheduled_maintenance",
                "interval": maintenance_schedule,
                "args": "[]",
                "enabled": True,
            }
        )
        if not created:
            enable_task.task     = "BaseApp.tasks.enable_scheduled_maintenance"  
            enable_task.interval = maintenance_schedule
            enable_task.enabled  = True
            enable_task.save()
        logger.info(f"Auto Enable Maintenance: {'Created' if created else 'Updated'} — every 30s")

    except Exception as e:
        logger.error(f"Priority ping setup failed: {e}")   # ✅ logger always defined
        traceback.print_exc()
