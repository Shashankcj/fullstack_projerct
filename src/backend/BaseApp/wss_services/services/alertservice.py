import logging
import json
from datetime import timedelta
from typing import Dict, Any, Optional, Union, Tuple
from django.utils import timezone
from channels.db import database_sync_to_async
from django.conf import settings


from ...models import Alert, MonitoringCheckpoint, Agent
from .email_service import EmailService


logger = logging.getLogger("agent_monitoring")


# ─────────── Configuration Loading ─────────────────────────────────────────────
_ALERT_CONFIG = getattr(settings, "ALERT_SERVICE_CONFIG", {})


# Load thresholds from your centralized configuration
ALERT_THRESHOLDS = _ALERT_CONFIG.get(
    "THRESHOLDS",
    getattr(settings, "COMMON_MONITORING_THRESHOLDS", {
        "INFO": 40.0,
        "WARNING": 60.0,
        "CRITICAL": 80.0,
    })
)


# Alert timing configuration
ALERT_THROTTLE_MINUTES = _ALERT_CONFIG.get(
    "THROTTLE_MINUTES",
    getattr(settings, "ALERT_THROTTLE_MINUTES", 5)
)


# Cache configuration
ALERT_CACHE_TTL = _ALERT_CONFIG.get(
    "CACHE_TTL",
    getattr(settings, "ALERT_CACHE_TTL", 3600)
)


ALERT_CACHE_HEALTH_THRESHOLD = _ALERT_CONFIG.get(
    "CACHE_HEALTH_THRESHOLD",
    1000
)


# Alert type mapping
ALERT_TYPE_MAPPING = _ALERT_CONFIG.get(
    "TYPE_MAPPING",
    {
        "cpu": "CPU Usage",
        "memory": "Memory Usage",
        "disk": "Disk Usage",
        "network": "Port Usage",
    }
)


class AlertService:
    """Service for handling system alerts and notifications."""


    def __init__(self):
        # cache for throttling duplicate alerts
        self._last_alert_sent: Dict[str, timezone.datetime] = {}
        self.email_service = EmailService()


    # ------------------------------------------------------------------
    # Main entrypoint
    # ------------------------------------------------------------------


    async def trigger_utilization_alert(
        self,
        *,
        component_type: str,
        component_uuid: str,
        utilization: float,
        checkpoint: MonitoringCheckpoint,
        device_name: str,
        agent: Agent,
    ) -> None:
        """
        Trigger a utilization alert for CPU, Memory, Disk, or Network components.
        Will skip if utilization is below threshold or if throttling applies.
        """
        try:
            logger.info(f"🔍 Checking alert for {component_type}: {utilization:.2f}%")
            
            if component_type not in {"cpu", "memory", "disk", "network"}:
                logger.warning(f"Unknown component_type for alert: {component_type}")
                return


            if not all([component_uuid, utilization is not None, checkpoint, device_name, agent]):
                logger.warning("Missing required parameters for alert creation")
                return


            # Determine severity level using configured thresholds
            severity, message = self._get_severity_and_message(
                component_type, utilization, device_name
            )
            
            logger.info(f"🎯 Severity check result: severity={severity}, utilization={utilization:.2f}%")
            
            if not severity:
                logger.debug(
                    f"Utilization {utilization:.2f}% below alert threshold for {component_type}"
                )
                return


            alert_key = f"{component_type}:{component_uuid}:{severity}"
            now = timezone.now()


            # Throttle repeated alerts using configured duration
            if self._should_throttle_alert(alert_key, now):
                logger.info(f"⏳ Skipping alert (throttled): {alert_key}")
                return
            
            logger.info(f"✅ Creating alert: {alert_key}")
            self._last_alert_sent[alert_key] = now


            # Build alert data using configured mapping
            alert_data = {
                "agent": agent,
                "device_name": device_name,
                "alert_type": self._map_alert_type(component_type),
                "severity": severity,
                "source_uuid": component_uuid,
                "message": message,
                "checkpoint": checkpoint,
                "details": json.dumps(
                    {
                        "utilization": utilization,
                        "threshold_breached": severity,
                        "component": component_type,
                        "timestamp": now.isoformat(),
                        "device_name": device_name,
                        "alert_key": alert_key,
                        "configured_thresholds": ALERT_THRESHOLDS,
                    }
                ),
                "created_at": now,
            }


            # Save to DB
            alert = await self._create_alert(alert_data)
            if alert:
                logger.info(
                    f"✨ Created {severity} alert {alert.uuid} for {component_type} {component_uuid}"
                )
                # queue email notification (non-blocking)
                await self.email_service.queue_alert_email(
                    alert_level=severity,
                    component_type=component_type,
                    device_name=device_name,
                    utilization=utilization,
                    alert_key=alert_key,
                )
            else:
                logger.error(f"❌ Failed to create alert in database for {alert_key}")


            self._log_alert(component_type, severity, device_name, component_uuid, utilization)


        except Exception as e:
            logger.error(f"Failed to process {component_type} alert: {e}", exc_info=True)


    # ------------------------------------------------------------------
    # Updated helper methods using configuration
    # ------------------------------------------------------------------


    def _get_severity_and_message(
        self, component_type: str, utilization: float, device_name: str
    ) -> Union[Tuple[str, str], Tuple[None, str]]:
        """Return severity level and human-readable message using configured thresholds."""
        
        critical_threshold = ALERT_THRESHOLDS["CRITICAL"]
        warning_threshold = ALERT_THRESHOLDS["WARNING"]
        info_threshold = ALERT_THRESHOLDS["INFO"]
        
        if utilization >= critical_threshold:
            return (
                "Critical",
                f"{component_type.upper()} usage is {utilization:.2f}%, which exceeds {critical_threshold}% on device '{device_name}'.",
            )
        elif utilization >= warning_threshold:
            return (
                "Warning",
                f"{component_type.upper()} usage is {utilization:.2f}%, which is elevated ({warning_threshold}–{critical_threshold}%) on device '{device_name}'.",
            )
        # Only create alerts for Warning and Critical, not Info
        # elif utilization >= info_threshold:
        #     return (
        #         "Info",
        #         f"{component_type.upper()} usage is {utilization:.2f}%, which is within the optimal range ({info_threshold}–{warning_threshold}%) on device '{device_name}'.",
        #     )
        
        # Return None if below warning threshold
        return None, ""


    def _map_alert_type(self, component_type: str) -> str:
        """Map internal component type to Alert model choice using configuration."""
        return ALERT_TYPE_MAPPING.get(component_type, "Memory Usage")


    def _should_throttle_alert(self, alert_key: str, now: timezone.datetime) -> bool:
        """Check if alert should be throttled using configured duration."""
        last_sent = self._last_alert_sent.get(alert_key)
        return last_sent and (now - last_sent < timedelta(minutes=ALERT_THROTTLE_MINUTES))


    @database_sync_to_async
    def _create_alert(self, alert_data: Dict[str, Any]) -> Optional[Alert]:
        """Create alert in database safely (async-safe wrapper)."""
        try:
            return Alert.objects.create(**alert_data)
        except Exception as e:
            logger.error(
                f"Failed to create alert in database. Data={alert_data}, Error={e}",
                exc_info=True,
            )
            return None


    def _log_alert(
        self, component_type: str, severity: str, device_name: str, component_uuid: str, utilization: float
    ) -> None:
        """Log alert with severity-specific logging level."""
        level_map = {
            "Info": logging.INFO,
            "Warning": logging.WARNING,
            "Critical": logging.CRITICAL,
        }
        
        # Get the correct threshold for display
        threshold_key = severity.upper()
        threshold_value = ALERT_THRESHOLDS.get(threshold_key, "N/A")
        
        logger.log(
            level_map.get(severity, logging.WARNING),
            f"{component_type.upper()} {severity.upper()} alert for {device_name} "
            f"(Component: {component_uuid}): {utilization:.2f}% usage (Threshold: {threshold_value}%)",
        )


    # ------------------------------------------------------------------
    # Updated cache & statistics methods
    # ------------------------------------------------------------------


    def clear_alert_cache(
        self, component_type: str = None, component_uuid: str = None, severity: str = None
    ) -> None:
        """Clear throttling cache entries."""
        try:
            if component_type and component_uuid and severity:
                key = f"{component_type}:{component_uuid}:{severity}"
                self._last_alert_sent.pop(key, None)
                logger.info(f"Cleared specific alert cache: {key}")


            elif component_type and component_uuid:
                keys = [
                    k
                    for k in self._last_alert_sent.keys()
                    if k.startswith(f"{component_type}:{component_uuid}:")
                ]
                for k in keys:
                    self._last_alert_sent.pop(k, None)
                logger.info(f"Cleared alert cache for {component_type}:{component_uuid}")


            elif component_type:
                keys = [
                    k for k in self._last_alert_sent.keys() if k.startswith(f"{component_type}:")
                ]
                for k in keys:
                    self._last_alert_sent.pop(k, None)
                logger.info(f"Cleared alert cache for type {component_type}")


            else:
                self._last_alert_sent.clear()
                logger.info("Cleared all alert cache")


        except Exception as e:
            logger.error(f"Failed to clear alert cache: {e}")


    async def get_alert_statistics(self) -> Dict[str, Any]:
        """Get service and DB statistics including configuration details."""
        try:
            @database_sync_to_async
            def _fetch():
                return {
                    "total_alerts": Alert.objects.count(),
                    "alerts_last_24h": Alert.objects.filter(
                        created_at__gte=timezone.now() - timedelta(days=1)
                    ).count(),
                    "critical_alerts_last_24h": Alert.objects.filter(
                        created_at__gte=timezone.now() - timedelta(days=1),
                        severity="Critical",
                    ).count(),
                }


            stats = await _fetch()
            return {
                "database_stats": stats,
                "cache_size": len(self._last_alert_sent),
                "service_health": "healthy" if len(self._last_alert_sent) < ALERT_CACHE_HEALTH_THRESHOLD else "high_usage",
                "configuration": {
                    "thresholds": ALERT_THRESHOLDS,
                    "throttle_minutes": ALERT_THROTTLE_MINUTES,
                    "cache_ttl": ALERT_CACHE_TTL,
                    "health_threshold": ALERT_CACHE_HEALTH_THRESHOLD,
                }
            }


        except Exception as e:
            logger.error(f"Failed to get alert statistics: {e}", exc_info=True)
            return {"error": str(e)}
