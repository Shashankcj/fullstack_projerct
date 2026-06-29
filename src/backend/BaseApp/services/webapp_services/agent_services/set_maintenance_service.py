from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.shortcuts import get_object_or_404
from ipware import get_client_ip

from BaseApp.models import Agent
from BaseApp.models.audit_logs import AuditLog

import logging
logger = logging.getLogger("agent_monitoring")


# ── Audit Helper ───────────────────────────────────────────────────────────────
def _audit_maintenance(request, agent, m_mode, m_start, m_end):
    try:
        user     = request.user if request else None
        ip, _    = get_client_ip(request) if request else (None, None)
        username = user.username if user else "system"

        if m_mode:
            end_str = (
                timezone.localtime(m_end).strftime('%Y-%m-%d %I:%M %p')
                if m_end else "Indefinite"
            )
            start_str = (
                timezone.localtime(m_start).strftime('%Y-%m-%d %I:%M %p')
                if m_start else "Immediate"
            )
            description = (
                f"{username} enabled immediate maintenance for '{agent.hostname}'. "
                f"Window: {start_str} → {end_str}"
            )
        elif m_start and m_end:
            start_str = timezone.localtime(m_start).strftime('%Y-%m-%d %I:%M %p')
            end_str   = timezone.localtime(m_end).strftime('%Y-%m-%d %I:%M %p')
            description = (
                f"{username} scheduled maintenance for '{agent.hostname}'. "
                f"Window: {start_str} → {end_str}"
            )
        else:
            description = f"{username} disabled maintenance for '{agent.hostname}'"

        AuditLog.objects.create(
            model_name="Agent",
            action="UPDATE",
            user=username,
            description=description,
            ip=ip
        )
    except Exception as e:
        logger.warning(f"[AUDIT] Maintenance log failed for {agent.hostname}: {e}")


# ── Helpers ────────────────────────────────────────────────────────────────────
def get_mode_label(m_mode, m_start, m_end):
    if m_mode:
        return "enabled"
    elif m_start and m_end:
        return "scheduled"
    return "disabled"


def parse_and_validate(m_mode, m_start_raw, m_end_raw, identifier=""):
    start = parse_datetime(str(m_start_raw)) if m_start_raw else None
    end   = parse_datetime(str(m_end_raw))   if m_end_raw   else None

    if start and timezone.is_naive(start):
        start = timezone.make_aware(start)

    if end and timezone.is_naive(end):
        end = timezone.make_aware(end)

    if m_mode and not end:
        return None, None, f"{identifier}: maintenance_end is required when enabling maintenance"

    if m_mode and start:
        return None, None, f"{identifier}: Immediate maintenance should not have maintenance_start"

    if not m_mode and (start or end):
        if not (start and end):
            return None, None, f"{identifier}: Scheduled maintenance requires both start and end time"

    if start and end and end <= start:
        return None, None, f"{identifier}: maintenance_end must be after maintenance_start"

    return start, end, None


# ── Main Service ───────────────────────────────────────────────────────────────
def set_maintenance_mode(request):
    try:
        data = request.data

        # ============================
        # 🔹 BULK MODE
        # ============================
        if isinstance(data, list):
            if not data:
                return Response(
                    {"error": "Empty list provided"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            uuids  = [item.get("agent_uuid") for item in data]
            agents = {
                str(a.uuid): a
                for a in Agent.objects.filter(uuid__in=uuids)
            }

            updated      = []
            errors       = []
            bulk_devices = []
            bulk_end_str = "Indefinite"

            for item in data:
                agent_uuid = str(item.get("agent_uuid", ""))
                agent      = agents.get(agent_uuid)

                if not agent:
                    errors.append(f"Agent {agent_uuid} not found")
                    continue

                m_mode      = item.get("maintenance_mode", False)
                m_start_raw = item.get("maintenance_start")
                m_end_raw   = item.get("maintenance_end")

                m_start, m_end, err = parse_and_validate(
                    m_mode, m_start_raw, m_end_raw, agent.hostname
                )

                if err:
                    errors.append(err)
                    continue

                # ✅ Guard: skip devices already under maintenance
                if m_mode and agent.maintenance_mode:
                    errors.append({
                        "agent_uuid":             agent_uuid,
                        "hostname":               agent.hostname,
                        "error":                  "Already under maintenance",
                        "already_in_maintenance": True,
                        "maintenance_start":      agent.maintenance_start,
                        "maintenance_end":        agent.maintenance_end,
                    })
                    continue

                previous_mode = agent.maintenance_mode

                # ── Save to DB ─────────────────────────────────────────
                agent.maintenance_mode  = m_mode
                agent.maintenance_start = m_start
                agent.maintenance_end   = m_end

                # ✅ Reset health when disabling maintenance
                if not m_mode:
                    agent.health_status       = None
                    agent.last_health_updated = timezone.now()

                agent.save(update_fields=[
                    "maintenance_mode",
                    "maintenance_start",
                    "maintenance_end",
                    *( ["health_status", "last_health_updated"] if not m_mode else [] ),
                ])

                # ✅ Always sync health_status when enabling maintenance
                if m_mode:
                    if not agent.maintenance_start:
                        agent.maintenance_start = timezone.now()
                        agent.save(update_fields=["maintenance_start"])

                    agent.mark_maintenance(send_email=False, create_alert=False)

                # ✅ Alert + email only on FIRST entry into maintenance
                if m_mode and not previous_mode:
                    bulk_devices.append(agent.hostname)

                    if agent.maintenance_end:
                        bulk_end_str = timezone.localtime(
                            agent.maintenance_end
                        ).strftime('%Y-%m-%d %I:%M %p')

                _audit_maintenance(
                    request,
                    agent,
                    m_mode,
                    agent.maintenance_start,
                    agent.maintenance_end
                )

                updated.append(agent_uuid)
                logger.info(
                    f"[MAINTENANCE] {get_mode_label(m_mode, m_start, m_end).capitalize()} for {agent.hostname}"
                )

            # ── ONE combined alert + email for IMMEDIATE devices only ──
            if bulk_devices:
                first_agent    = agents.get(updated[0]) if updated else None
                bulk_start_str = (
                    timezone.localtime(first_agent.maintenance_start).strftime('%Y-%m-%d %I:%M %p')
                    if first_agent and first_agent.maintenance_start
                    else timezone.localtime(timezone.now()).strftime('%Y-%m-%d %I:%M %p')
                )

                description = (
                    f"{len(bulk_devices)} devices entered maintenance. "
                    f"Window: {bulk_start_str} → {bulk_end_str}.\n"
                    + "\n".join([f"- {d}" for d in bulk_devices])
                )

                if len(bulk_devices) == 1:
                    email_payload = {
                        "alert_type"     : "flagged_component",
                        "component_type" : "Maintenance",
                        "start_str"      : bulk_start_str,
                        "end_str"        : bulk_end_str,
                    }
                else:
                    email_payload = {
                        "alert_type"     : "bulk_maintenance",
                        "component_type" : "Maintenance",
                        "device_list"    : bulk_devices,
                        "start_str"      : bulk_start_str,
                        "end_str"        : bulk_end_str,
                    }

                if first_agent:
                    first_agent.create_event(
                        "Alert",
                        description,
                        component_type="Maintenance",
                        email_alert_payload=email_payload
                    )

            if updated and not errors:
                message = f"Maintenance updated for {len(updated)} device(s)"
            elif updated and errors:
                message = f"Maintenance updated for {len(updated)} device(s), {len(errors)} failed"
            else:
                message = f"No devices updated — {len(errors)} error(s)"

            return Response({
                "message" : message,
                "updated" : updated,
                "errors"  : errors,
            }, status=status.HTTP_200_OK)

        # ============================
        # 🔹 SINGLE MODE
        # ============================
        agent_uuid = data.get("agent_uuid")
        if not agent_uuid:
            return Response(
                {"error": "agent_uuid is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        agent = get_object_or_404(Agent, uuid=agent_uuid)

        m_mode      = data.get("maintenance_mode", False)
        m_start_raw = data.get("maintenance_start")
        m_end_raw   = data.get("maintenance_end")

        m_start, m_end, err = parse_and_validate(
            m_mode, m_start_raw, m_end_raw, agent.hostname
        )

        if err:
            return Response(
                {"error": err},
                status=status.HTTP_400_BAD_REQUEST
            )

        previous_mode = agent.maintenance_mode

        # ✅ Guard: reject if device is already under maintenance
        if m_mode and previous_mode:
            return Response(
                {
                    "error":                  f"Agent '{agent.hostname}' is already under maintenance.",
                    "already_in_maintenance": True,
                    "maintenance_start":      agent.maintenance_start,
                    "maintenance_end":        agent.maintenance_end,
                },
                status=status.HTTP_409_CONFLICT
            )

        # ── Save to DB ─────────────────────────────────────────────────
        agent.maintenance_mode  = m_mode
        agent.maintenance_start = m_start
        agent.maintenance_end   = m_end

        # ✅ Reset health when disabling maintenance
        if not m_mode:
            agent.health_status       = None
            agent.last_health_updated = timezone.now()

        agent.save(update_fields=[
            "maintenance_mode",
            "maintenance_start",
            "maintenance_end",
            *( ["health_status", "last_health_updated"] if not m_mode else [] ),
        ])

        # ✅ Always sync health_status when enabling maintenance
        if m_mode:
            if not agent.maintenance_start:
                agent.maintenance_start = timezone.now()
                agent.save(update_fields=["maintenance_start"])

            agent.mark_maintenance()  # always sets health_status = "maintenance"

        _audit_maintenance(
            request,
            agent,
            m_mode,
            agent.maintenance_start,
            agent.maintenance_end
        )

        mode_label = get_mode_label(m_mode, m_start, m_end)
        logger.info(f"[MAINTENANCE] {mode_label.capitalize()} for {agent.hostname}")

        return Response({
            "message"          : f"Maintenance {mode_label} for {agent.hostname}",
            "agent_uuid"       : str(agent.uuid),
            "maintenance_mode" : agent.maintenance_mode,
            "maintenance_start": agent.maintenance_start,
            "maintenance_end"  : agent.maintenance_end,
        }, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"[MAINTENANCE] Unexpected error: {str(e)}")
        return Response(
            {"error": "Internal server error", "message": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )