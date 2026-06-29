from BaseApp.models.models import *
from BaseApp.models.global_config import GlobalConfig
from BaseApp.serializer import *
from django.http import JsonResponse
from channels.db import database_sync_to_async
from channels.layers import get_channel_layer
from asgiref.sync import sync_to_async, async_to_sync
from django.conf import settings
from django.utils import timezone
from BaseApp.Services.AgentMonitoring.monUtils import check_threshold_and_alert
import json, logging, datetime as dt, redis
from django.core.cache import cache

logger = logging.getLogger('agent_consumer')

class AgentMonitoringHandler:
    rdb = redis.Redis(
        host=settings.REDIS_HOST, 
        port=int(settings.REDIS_PORT), 
        db=settings.REDIS_MON_DB
    )

    SerializerMap = {
        'cpu_monitoring': CpuMonitoringSerializer,
        'memory_monitoring': MemoryMonitoringSerializer,
        'disk_monitoring': DiskMonitoringSerializer,
        'network_monitoring': InterfaceMonitoringSerializer,
        'partition_monitoring': PartitionMonitoringSerializer,
    }

    UUIDKeyMap = {
        'cpu_monitoring': 'cpu_uuid',
        'memory_monitoring': 'memory_uuid',
        'disk_monitoring': 'disk_uuid',
        'network_monitoring': 'port_uuid',
        'partition_monitoring': 'partition_uuid',
    }

    # ── Streak configuration ──────────────────────────────────────────────────
    # N consecutive breaches required before escalating health state
    HEALTH_STREAK_REQUIRED = {
        "red": 1,    # 2 consecutive critical readings → RED
        "amber": 2,  # 3 consecutive warning readings  → AMBER
    }
    HEALTH_STREAK_TTL = 300  # 5 min — streak auto-resets if agent goes silent

    # ─────────────────────────────────────────────────────────────────────────
    # SAFE REDIS JSON READER
    # ─────────────────────────────────────────────────────────────────────────

    @classmethod
    def _safe_redis_json(cls, key, expected_type=dict, default=None):
        """Safely reads a Redis key and parses JSON to prevent type-crashes."""
        raw = cls.rdb.get(key)
        if raw is None:
            return default
        try:
            parsed = json.loads(raw.decode())
            if not isinstance(parsed, expected_type):
                logger.warning(f"Redis key '{key}' expected {expected_type.__name__}, got {type(parsed).__name__}")
                return default
            return parsed
        except (json.JSONDecodeError, UnicodeDecodeError):
            return default

    # ─────────────────────────────────────────────────────────────────────────
    # STREAK HELPERS
    # ─────────────────────────────────────────────────────────────────────────

    @classmethod
    def _update_and_get_streak(cls, agent_uuid, metric_type, raw_state, component_uuid=None):
        """Increments the correct streak counter and resets others."""
        suffix = f":{component_uuid}" if component_uuid else ""
        key = f"agent:health:streak:{agent_uuid}:{metric_type}{suffix}"

        streak = cls._safe_redis_json(key, expected_type=dict, default={"red": 0, "amber": 0})

        if raw_state == "red":
            streak["red"] += 1
            streak["amber"] = 0
        elif raw_state == "amber":
            streak["amber"] += 1
            streak["red"] = 0
        else:
            streak["red"] = 0
            streak["amber"] = 0

        cls.rdb.setex(key, cls.HEALTH_STREAK_TTL, json.dumps(streak))
        return streak["red"], streak["amber"]

    @classmethod
    def check_thresholds_and_alert(cls, agent, monitoring_type, data):
        threshold_key_map = {
            'cpu_monitoring':       {"data_key": 'cpu_utilization',    "uuid": "cpu_uuid"},
            'memory_monitoring':    {"data_key": 'memory_utilization', "uuid": "memory_uuid"},
            'disk_monitoring':      {"data_key": 'disk_utilization',   "uuid": "disk_uuid"},
            'network_monitoring':   {"data_key": 'network_utilization',"uuid": "port_uuid"},
            'partition_monitoring': {"data_key": 'used_space_perc',    "uuid": "partition_uuid"},
        }

        warning_key_map = {
            'cpu_monitoring':       'cpu_warning_threshold',
            'memory_monitoring':    'ram_warning_threshold',
            'disk_monitoring':      'disk_warning_threshold',
            'network_monitoring':   'network_warning_threshold',
            'partition_monitoring': 'disk_warning_threshold',
        }

        pg_func = agent.priority.get_monitoring_key

        threshold = cls.rdb.get(f"monitoring:thresholds:{pg_func(monitoring_type)}")

        # ✅ Fetch both repeat frequencies separately
        critical_repeat_freq = int(cls.rdb.get(f"monitoring:thresholds:{pg_func('repeatFrequency')}") or 30)
        warning_repeat_freq  = int(cls.rdb.get(f"monitoring:thresholds:{pg_func('warning_repeatFrequency')}") or 60)

        # Fetch warning threshold
        warning_key       = warning_key_map.get(monitoring_type)
        warning_threshold = cls.rdb.get(f"monitoring:thresholds:{pg_func(warning_key)}") if warning_key else None

        if threshold is None:
            logger.warning(f"No threshold found in Redis for {monitoring_type}")
            return

        utilization    = data.get(threshold_key_map[monitoring_type]["data_key"])
        component_uuid = data.get(threshold_key_map[monitoring_type]["uuid"])

        component_name = ''
        if monitoring_type == 'disk_monitoring':
            component_name = agent.device.get_disk_name(component_uuid)
        elif monitoring_type == 'partition_monitoring':
            component_name = agent.device.get_partition_name(component_uuid)
        elif monitoring_type == 'network_monitoring':
            component_name = agent.device.get_port_name(component_uuid)

        check_threshold_and_alert(
            rdb=cls.rdb,
            source=agent,
            threshold=threshold,
            warning_threshold=warning_threshold,
            utilization=utilization,
            component_uuid=component_uuid,
            monitoring_type=monitoring_type,
            critical_repeat_freq=critical_repeat_freq,  
            warning_repeat_freq=warning_repeat_freq,     # ✅ new
            component_name=component_name,
        )

    @classmethod
    def evaluate_agent_health(cls, agent, entry):
        health_state = "green"

        health_map = {
            "cpu_monitoring":       "cpu_utilization",
            "memory_monitoring":    "memory_utilization",
            "disk_monitoring":      "disk_utilization",
            "network_monitoring":   "network_utilization",
            "partition_monitoring": "used_space_perc"
        }

        # critical → uses monitoring_type key (same as check_thresholds_and_alert)
        # warning  → uses the new config key
        threshold_key_map = {
            "cpu_monitoring":       ("cpu_monitoring",       "cpu_warning_threshold"),
            "memory_monitoring":    ("memory_monitoring",    "ram_warning_threshold"),
            "disk_monitoring":      ("disk_monitoring",      "disk_warning_threshold"),
            "network_monitoring":   ("network_monitoring",   "network_warning_threshold"),
            "partition_monitoring": ("partition_monitoring", "disk_warning_threshold"),
        }  

        pg_func = agent.priority.get_monitoring_key

        for key, data in entry.items():
            if key not in health_map:
                continue

            critical_config_key, warning_config_key = threshold_key_map[key]

            raw_critical = cls.rdb.get(f"monitoring:thresholds:{pg_func(critical_config_key)}")
            raw_warning  = cls.rdb.get(f"monitoring:thresholds:{pg_func(warning_config_key)}")

            if raw_critical is None or raw_warning is None:
                logger.warning(
                    f"[Health] Missing threshold for {key} — "
                    f"critical={pg_func(critical_config_key)}({raw_critical}) "
                    f"warning={pg_func(warning_config_key)}({raw_warning})"
                )
                continue

            critical = float(raw_critical.decode())
            warning  = float(raw_warning.decode())

            records = data if isinstance(data, list) else [data]

            for record in records:
                value = record.get(health_map[key])
                if value is None:
                    continue
                value = float(value)

                if value >= critical:
                    raw_state = "red"
                elif value >= warning:
                    raw_state = "amber"
                else:
                    raw_state = "green"

                logger.debug(
                    f"[Health] {key} value={value} warning={warning} "
                    f"critical={critical} → {raw_state}"
                )

                comp_uuid = record.get(cls.UUIDKeyMap.get(key))
                red_s, amb_s = cls._update_and_get_streak(
                    str(agent.uuid), key, raw_state, comp_uuid
                )

                if red_s >= cls.HEALTH_STREAK_REQUIRED["red"]:
                    return "red"
                elif amb_s >= cls.HEALTH_STREAK_REQUIRED["amber"]:
                    health_state = "amber"

        return health_state

    @staticmethod
    def generalizeDataToModel(data):
        gen = {"cpu_uuid": "component", "disk_uuid": "component", "memory_uuid": "component", 
               "port_uuid": "component", "partition_uuid": "component", "disk_utilization": "disk_usage_percent"}
        return {gen.get(k, k): v for k, v in data.items()}

    @classmethod
    def createMonitoringObjects(cls, serializer_class, ck, data):
        serializer = serializer_class(data=cls.generalizeDataToModel(data))
        if serializer.is_valid():
            serializer.save(checkpoint=ck)
            return True
        logger.error(f"Invalid data for {serializer_class.__name__}: {serializer.errors}")
        return False

    @classmethod
    def process_monitoring_data(cls, agent_uuid, data):
        logger.info(f"Processing monitoring data for agent {agent_uuid}")
        try:
            agent = Agent.objects.get(uuid=agent_uuid)

            for entry in data:
                timestamp = entry.pop("timestamp")
                # Using your original get_or_create logic
                cp, created = agent.checkpoints.get_or_create(
                    timestamp_utc=dt.datetime.fromisoformat(timestamp.get("datetime")), 
                    timestamp_rao=timestamp.get("datetime"), 
                    timestamp_tz=timestamp.get("timezone")
                )

                saved_any = False
                for key, records in entry.items():
                    serializer_class = cls.SerializerMap.get(key)
                    if not serializer_class: continue
                    
                    recs = records if isinstance(records, list) else [records]
                    for record in recs:
                        agent.device.check_component_if_flagged_and_unflag(key.split("_")[0], record.get(cls.UUIDKeyMap.get(key)))
                        if cls.createMonitoringObjects(serializer_class, cp, record):
                            saved_any = True
                            cls.check_thresholds_and_alert(agent, key, record)

                if not saved_any: continue

                # Evaluate REAL metric health
                health = cls.evaluate_agent_health(agent, entry)

                # Persist real health to checkpoint (always — historical record)
                cp.health_status = health
                cp.save(update_fields=["health_status"])

                # ✅ Skip agent health update if device is in maintenance
                if agent.is_in_maintenance:
                    logger.info(
                        f"[Health] Skipping agent health update for {agent.hostname} — in maintenance"
                    )
                    display_health = "maintenance"
                else:
                    # Persist current machine health to agent
                    agent.last_health_updated = timezone.now()
                    if agent.health_status != health:
                        agent.health_status = health
                    agent.save(update_fields=["health_status", "last_health_updated"])

                    # Invalidate dashboard caches for this priority
                    priority_name = agent.priority.priority_name if agent.priority else "P1"
                    cache.delete(f"dashboard:{priority_name}")
                    cache.delete(f"alerts:{priority_name}")

                    display_health = health

                payload = {
                    **entry,
                    "timestamp": cp.getTimestampInTimezone(settings.TIME_ZONE),
                    "agent_uuid": str(agent_uuid),
                    "health": display_health,
                }

                async_to_sync(get_channel_layer().group_send)(
                    f"webapp.{agent_uuid}",
                    {"type": "send.mon.data.to.frontend", "data": payload}
                )

        except Agent.DoesNotExist:
            logger.error(f"Agent with UUID {agent_uuid} does not exist.")
        except Exception as e:
            logger.error(f"Error in monitoring handler for {agent_uuid}: {e}")

        return JsonResponse({"message": "Monitoring data processed."})