from email.mime import message
from celery import shared_task
from django.utils import timezone
from datetime import timedelta
from django.db.models import Q               
from .models import Agent
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .serializer import WebAgentSerializer
from uuid import UUID
from django.core.management import call_command
from django.core.cache import cache

import logging
logger = logging.getLogger('agent_monitoring_tasks')

def convert_uuids(obj):
    if isinstance(obj, UUID):
        return str(obj)
    elif isinstance(obj, dict):
        return {
            (str(k) if isinstance(k, UUID) else k): convert_uuids(v)
            for k, v in obj.items()
        }
    elif isinstance(obj, list):
        return [convert_uuids(item) for item in obj]
    elif isinstance(obj, tuple):
        return tuple(convert_uuids(item) for item in obj)
    return obj


@shared_task
def mark_inactive_agents():
    print("=== CELERY: Starting mark_inactive_agents ===")
    threshold = timezone.now() - timedelta(minutes=1)
    inactive_agents = Agent.objects.filter(last_seen__lt=threshold, status=Agent.STATUS_ACTIVE)
    channel_layer = get_channel_layer()

    for agent in inactive_agents:
        if agent.is_in_maintenance:              
            logger.info(f"Skipping inactive mark for {agent.hostname} — in maintenance")
            continue                                  
        agent.mark_inactive()
        try:
            serializer = WebAgentSerializer(agent)
            safe_data = convert_uuids(serializer.data)
            async_to_sync(channel_layer.group_send)(
                "monitoring_all",
                {"type": "agent_update", "data": safe_data}
            )
        except Exception as e:
            print(f"Failed to send WebSocket update for agent {agent.uuid}: {e}")

    print("Completed marking inactive agents.")


@shared_task(name='BaseApp.tasks.run_dataretention_cleanup', soft_time_limit=3600, time_limit=3700, max_retries=3)
def run_dataretention_cleanup():
    start_time = timezone.now()
    logger.info(f"[{start_time}] Starting Data Retention Cleanup command...")
    try:
        call_command('cleanup_data')
        end_time = timezone.now()
        duration = (end_time - start_time).total_seconds()
        logger.info(f"[{end_time}] Data retention cleanup completed.")
        logger.info(f"Total execution time: {duration:.2f} seconds.")
        return "Cleanup completed"
    except Exception as e:
        logger.info(f"[{timezone.now()}] ERROR during cleanup: {e}")
        raise e


@shared_task(name='BaseApp.tasks.ping_priority_ips', bind=True, time_limit=60, soft_time_limit=50, max_retries=3)
def ping_priority_ips_task(self, priority_group_uuid):
    from BaseApp.services.webapp_services.ip_monitoring.ping_service import parallel_ping_ips 
    from BaseApp.models import PriorityGroup, IPMonitor
    from celery.exceptions import SoftTimeLimitExceeded

    lock_key = f"ping_lock_{priority_group_uuid}"
    if not cache.add(lock_key, "locked", timeout=70):
        logger.warning(f"Ping already running for {priority_group_uuid}, skipping")
        return "Skipped overlapping ping"

    start_time = timezone.now()
    logger.info(f"[{start_time}] Starting ping cycle for priority group...")

    try:
        priority_group = PriorityGroup.objects.get(uuid=priority_group_uuid)
        ip_monitors = IPMonitor.objects.filter(priority=priority_group)
        logger.info(f"Found {ip_monitors.count()} IPs for {priority_group.priority_name}")
        result = parallel_ping_ips(ip_monitors)
        end_time = timezone.now()
        duration = (end_time - start_time).total_seconds()
        logger.info(f"Execution time: {duration:.2f}s for {ip_monitors.count()} IPs")
        return f"{priority_group.priority_name}: {result}"

    except PriorityGroup.DoesNotExist:
        logger.error(f"PriorityGroup UUID {priority_group_uuid} not found")
        return "Error: Priority group not found"
    except SoftTimeLimitExceeded:
        logger.warning(f"Soft time limit exceeded for group {priority_group_uuid}. Cleaning up...")
        return "Error: Timeout reached"
    except Exception as e:
        logger.error(f"[{timezone.now()}] ERROR: {e}", exc_info=True)
        raise 

    finally:
        cache.delete(lock_key)



@shared_task
def broadcast_batch_task(checkpoint_ids):
    from BaseApp.Services.AgentMonitoring.monUtils import check_threshold_and_alert
    from BaseApp.models.ipmonitor import IPMonitorCheckpoint
    from BaseApp.redis_client import rdb

    repeat_freq = int(rdb.get("monitoring:thresholds:ip_monitoring:repeatFrequency") or 30)
    checkpoints = IPMonitorCheckpoint.objects.filter(
        id__in=checkpoint_ids
    ).select_related('ip_monitor')

    logger.info(f"Broadcasting updates for {len(checkpoints)} checkpoints")

    for cp in checkpoints:
        if cp.status_value == 0:
            logger.warning(f"IP {cp.ip_monitor.ip_address} is {cp.status}. Checking thresholds...")
            check_threshold_and_alert(
                rdb=rdb,
                source=cp.ip_monitor,
                threshold=0,
                utilization=1,
                component_uuid="",
                monitoring_type='ip_monitoring',
                critical_repeat_freq=repeat_freq,
                warning_repeat_freq=repeat_freq,
                description=f"IP {cp.ip_monitor.ip_address} is {cp.status}.",
            )


@shared_task(name="BaseApp.tasks.disable_expired_maintenance")
def disable_expired_maintenance():
    now = timezone.now()

    expired = Agent.objects.filter(
        Q(maintenance_mode=True,  maintenance_end__lte=now) |
        Q(maintenance_mode=False, maintenance_start__isnull=False,  
          maintenance_end__lte=now)
    )
    count = expired.count()

    if count > 0:
        channel_layer = get_channel_layer()

        for agent in expired:
            agent.maintenance_mode    = False
            agent.maintenance_start   = None
            agent.maintenance_end     = None
            agent.health_status       = None
            agent.last_health_updated = timezone.now()
            agent.save(update_fields=[
                "maintenance_mode",
                "maintenance_start",
                "maintenance_end",
                "health_status",
                "last_health_updated",
            ])

            try:
                serializer = WebAgentSerializer(agent)
                safe_data = convert_uuids(serializer.data)
                async_to_sync(channel_layer.group_send)(
                    "monitoring_all",
                    {"type": "agent_update", "data": safe_data}
                )
            except Exception as e:
                logger.warning(f"[Maintenance] WebSocket broadcast failed for {agent.uuid}: {e}")

        logger.info(f"[Maintenance] Cleared expired/stale maintenance for {count} agent(s)")

    return f"Cleared maintenance for {count} agent(s)"


@shared_task(name="BaseApp.tasks.enable_scheduled_maintenance")
def enable_scheduled_maintenance():
    now = timezone.now()
    logger.info(f"[enable_scheduled_maintenance] TASK STARTED at {now}")

    channel_layer    = get_channel_layer()
    bulk_devices     = []
    processed_agents = []
    bulk_end_str     = "Indefinite"

    from django.db import transaction

    with transaction.atomic():
        due = Agent.objects.select_for_update().filter(
            maintenance_mode=False,
            maintenance_start__lte=now,
            maintenance_end__gt=now
        )

        count = due.count()
        logger.info(f"[enable_scheduled_maintenance] Found {count} agents due for maintenance")

        if count == 0:
            return "No agents due for scheduled maintenance."

        for agent in due:
            logger.info(f"[enable_scheduled_maintenance] Processing {agent.hostname}")

            if agent.maintenance_mode:
                logger.info(f"[enable_scheduled_maintenance] Already in maintenance — skipping {agent.hostname}")
                continue

            agent.mark_maintenance(send_email=False, create_alert=False)

            bulk_devices.append(agent.hostname)
            processed_agents.append(agent)

            if agent.maintenance_end:
                bulk_end_str = timezone.localtime(agent.maintenance_end).strftime('%Y-%m-%d %I:%M %p')

            try:
                serializer = WebAgentSerializer(agent)
                safe_data  = convert_uuids(serializer.data)
                async_to_sync(channel_layer.group_send)(
                    "monitoring_all",
                    {"type": "agent_update", "data": safe_data}
                )
                logger.info(f"[enable_scheduled_maintenance] WS SENT — {agent.hostname}")
            except Exception as e:
                logger.warning(f"[Maintenance] WebSocket broadcast failed for {agent.uuid}: {e}")

    if not processed_agents:
        return "No agents processed — all already in maintenance."

    first_agent    = processed_agents[0]
    bulk_start_str = (
        timezone.localtime(first_agent.maintenance_start).strftime('%Y-%m-%d %I:%M %p')
        if first_agent.maintenance_start
        else timezone.localtime(timezone.now()).strftime('%Y-%m-%d %I:%M %p')
    )

    description = (
        f"{len(bulk_devices)} devices entered maintenance. "
        f"Window: {bulk_start_str} → {bulk_end_str}.\n"
        + "\n".join([f"- {d}" for d in bulk_devices])
    )

    if len(processed_agents) == 1:
        email_payload = {
            "alert_type"     : "flagged_component",
            "component_type" : "Maintenance",
            "start_str"      : bulk_start_str,   # ← FIXED
            "end_str"        : bulk_end_str,      # ← FIXED
        }
    else:
        email_payload = {
            "alert_type"     : "bulk_maintenance",
            "component_type" : "Maintenance",
            "device_list"    : bulk_devices,
            "start_str"      : bulk_start_str,
            "end_str"        : bulk_end_str,
        }

    first_agent.create_event(
        "Alert",
        description,
        component_type="Maintenance",
        email_alert_payload=email_payload
    )

    logger.info(f"[Maintenance] Scheduled maintenance enabled for {len(processed_agents)} agent(s)")
    return f"Enabled scheduled maintenance for {len(processed_agents)} agent(s)"


@shared_task(name="BaseApp.tasks.send_license_notifications")
def send_license_notifications():

    logger.info("[License] Task Started")

    try:

        from django.conf import settings
        from django.core.mail import send_mail

        from BaseApp.models import (WebUser,GlobalConfig)

        from BaseApp.utils import get_license_status
        from BaseApp.services.webapp_services.email_notifications.Emailtemplates import EmailTemplates
        from BaseApp.services.webapp_services.email_notifications.Sendemail_service import EmailService
        # CHECK LICENSE EXISTS
        license_exists = GlobalConfig.objects.filter(item_key="license.key").exists()

        if not license_exists:
            return "No license"

        # GET LICENSE STATUS
        status_data = get_license_status()

        remaining_days = status_data.get("remaining_days",0)
        license_type = status_data.get( "license_type", "").lower()

        logger.info(f"[License] Remaining Days: {remaining_days}")

        logger.info(f"[License] License Type: {license_type}")

        should_send = False

        # ENTERPRISE
        if license_type == "enterprise":

            if remaining_days in [15, 7]:
                should_send = True

        # TRIAL
        elif license_type == "trial":

            if remaining_days in [7, 2]:
                should_send = True

        if not should_send:

            logger.info("[License] No mail needed today")

            return "No mail needed"

        # GET ADMIN EMAILS
        admin_emails = list(WebUser.objects.filter(
                role__role_name="Administrator",
                is_user_enabled=True,
                is_email_verified=True
            )
            .exclude(email__isnull=True)
            .exclude(email="")
            .values_list("email", flat=True)
        )

        if not admin_emails:
            return "No admin emails"

        html_content, plain_text, subject = (EmailTemplates.get_license_notification_template( remaining_days=remaining_days,license_type=license_type))
        # SEND MAIL
        EmailService.send_email(
            to_emails=admin_emails,
            html_content=html_content,
            plain_text=plain_text,
            subject=subject,
        )

        logger.info("[License] Mail sent successfully")
        return "Mail sent"

    except Exception as e:

        logger.error(f"[License] ERROR: {e}",exc_info=True)

        raise e