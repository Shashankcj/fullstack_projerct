import logging
from django.conf import settings

logger = logging.getLogger('agent_consumer')


def check_threshold_and_alert(
    rdb, source, threshold, utilization, component_uuid,
    monitoring_type, critical_repeat_freq, warning_repeat_freq, 
    description=None, component_name='', warning_threshold=None
):
    if utilization is None:
        return

    util_val     = float(utilization)
    critical_val = float(threshold)
    warning_val  = float(warning_threshold) if warning_threshold is not None else None

    # ── Determine severity ────────────────────────────────────────────────
    if util_val > critical_val:
        severity    = "critical"
        repeat_freq = critical_repeat_freq    # critical uses its own cooldown
    elif warning_val is not None and util_val > warning_val:
        severity    = "warning"
        repeat_freq = warning_repeat_freq     # warning uses its own cooldown
    else:
        # Neither threshold breached — reset both streaks and exit
        _reset_streak(rdb, source.uuid, monitoring_type, component_uuid)
        return

    # ── Build alert payload ───────────────────────────────────────────────
    component_label = f"{monitoring_type.split('_')[0].upper()}{' ' + component_name if component_name else ''}"
    email_alert_payload = {
        'component_type': component_label,
        'utilization': utilization,
        'severity': severity,
    }

    threshold_used = critical_val if severity == "critical" else warning_val

    logger.info(
        f"[{severity.upper()}] Threshold breached for {monitoring_type} "
        f"on {source.uuid}: {util_val}% > {threshold_used}%"
    )

    # Severity-scoped keys — warning and critical track completely independently
    streak_key   = f"alert:streak:{source.uuid}:{monitoring_type}:{component_uuid}:{severity}"
    cooldown_key = f"alert:cooldown:{source.uuid}:{monitoring_type}:{component_uuid}:{severity}"

    # Strike count per severity — critical fires faster than warning
    strike_count = (
        settings.UTIL_CRITICAL_STRIKE_COUNT
        if severity == "critical"
        else settings.UTIL_WARNING_STRIKE_COUNT
    )

    # ── Streak logic ──────────────────────────────────────────────────────
    if rdb.exists(streak_key):
        streak = rdb.incr(streak_key)
        rdb.expire(streak_key, 3600)  # refresh TTL on every increment

        logger.info(
            f"[{severity.upper()}] Streak={streak}/{strike_count} for {monitoring_type} "
            f"on {source.uuid}-{component_uuid}"
        )

        if streak >= strike_count:
            logger.warning(
                f"[{severity.upper()}] ALERT: {monitoring_type} on {source.uuid} "
                f"breached for {streak} consecutive times! utilization={util_val}%"
            )

            if description is None:
                description = (
                    f"{component_label} has breached {severity} threshold "
                    f"({threshold_used}%) for {streak} consecutive times. "
                    f"Reported utilization: {util_val}%"
                )

            # Only fire if no active cooldown for this severity
            if not rdb.exists(cooldown_key):
                source.create_event(
                    event_type="Alert",
                    description=description,
                    severity=severity.capitalize(),
                    component_type=monitoring_type.split("_")[0].upper(),
                    email_alert_payload=email_alert_payload,
                )
                rdb.set(cooldown_key, "1", ex=repeat_freq * 60)  # severity-correct cooldown
                logger.info(
                    f"[{severity.upper()}] Alert fired + cooldown set for "
                    f"{source.uuid}-{monitoring_type}-{component_uuid}"
                )
    else:
        rdb.set(streak_key, "1", ex=3600)
        logger.info(
            f"[{severity.upper()}] Streak started for "
            f"{source.uuid}-{monitoring_type}-{component_uuid}"
        )


def _reset_streak(rdb, source_uuid, monitoring_type, component_uuid):
    """Clears both warning and critical streaks when utilization drops to green."""
    for severity in ("critical", "warning"):
        streak_key = f"alert:streak:{source_uuid}:{monitoring_type}:{component_uuid}:{severity}"
        if rdb.exists(streak_key):
            rdb.delete(streak_key)
            logger.info(
                f"[GREEN] {severity} streak reset for "
                f"{source_uuid}-{monitoring_type}-{component_uuid}"
            )