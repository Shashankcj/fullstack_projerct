import json
import logging
import time
from datetime import timedelta
from typing import Dict, List, Union, Callable, Optional

import asyncio
from django.core.cache import cache
from django.db import transaction

from ...models import CPU, CpuMonitoring
from .alertservice import AlertService
from .utils import now, sync_to_async
from django.conf import settings

logger = logging.getLogger("agent_monitoring")

class CpuService:
    """Service for processing CPU monitoring data with bulk operations."""

   # ─────────── Configuration ────────────────────────────────────────────────
    _CONFIG = getattr(settings, "CPU_MONITORING_CONFIG", {})
    
    CONTINUOUS_HIGH_MINUTES = _CONFIG.get(
        "ALERT_CONTINUOUS_MINUTES",
        getattr(settings, "CPU_ALERT_CONTINUOUS_MINUTES", 5)
    )
    
    ALERT_CACHE_TTL = _CONFIG.get(
        "ALERT_CACHE_TTL",
        getattr(settings, "CPU_ALERT_CACHE_TTL", 3600) 
    )
    
    CACHE_KEY_PREFIX = _CONFIG.get(
        "CACHE_KEY_PREFIX",
        "cpu_util_alert"
    )

    THRESHOLDS = _CONFIG.get(
        "THRESHOLDS",
        getattr(settings, "CPU_UTILIZATION_THRESHOLDS", {
            "INFO": 40.0,
            "WARNING": 60.0,
            "CRITICAL": 80.0,
        })
    )
    def __init__(
        self,
        alert_service: Optional[AlertService] = None,
        response_callback: Optional[Callable[[Dict], None]] = None,
    ):
        self.alert_service = alert_service or AlertService()
        self._send_response = response_callback
        
        # Cache for CPU objects to avoid repeated DB queries
        self._cpu_cache = {}

    # ═══════════════════════════════════════════════════════════════
    # OPTIMIZED CACHE OPERATIONS
    # ═══════════════════════════════════════════════════════════════

    async def _get_cache_async(self, key):
        """Non-blocking cache get operation."""
        return await sync_to_async(cache.get)(key)

    async def _set_cache_async(self, key, value, timeout=None):
        """Non-blocking cache set operation."""
        return await sync_to_async(cache.set)(key, value, timeout)

    async def _delete_cache_async(self, key):
        """Non-blocking cache delete operation."""
        return await sync_to_async(cache.delete)(key)

    #  Bulk cache operations
    async def _get_multiple_cache_async(self, keys: List[str]) -> Dict[str, any]:
        """Get multiple cache keys at once."""
        return await sync_to_async(cache.get_many)(keys)

    async def _set_multiple_cache_async(self, data: Dict[str, any], timeout=None):
        """Set multiple cache keys at once."""
        return await sync_to_async(cache.set_many)(data, timeout)

    # ═══════════════════════════════════════════════════════════════
    # OPTIMIZED MAIN PROCESSING - BULK OPERATIONS
    # ═══════════════════════════════════════════════════════════════

    async def process_cpu_data(
        self,
        data: Dict,
        checkpoint,
        agent,
        device,
        response_callback: Optional[Callable[[Dict], None]] = None,
    ) -> Union[List[Dict], str]:
        """ Process CPU monitoring data with bulk operations."""
        start_time = time.time()
        
        if "cpu_monitoring" not in data:
            logger.warning("[CPU] Missing 'cpu_monitoring' in payload")
            return "not provided"

        cpu_monitoring = data["cpu_monitoring"]
        if not isinstance(cpu_monitoring, list):
            cpu_monitoring = [cpu_monitoring]

        # Bulk fetch all CPU objects at once
        cpu_uuids = [cpu_data.get("cpu_uuid") for cpu_data in cpu_monitoring if cpu_data.get("cpu_uuid")]
        if not cpu_uuids:
            return []

        cpu_objects = await self._get_cpus_bulk(cpu_uuids)

        # Prepare all monitoring records for bulk insert
        monitoring_records = []
        alert_data = []
        results = []

        for cpu_data in cpu_monitoring:
            cpu_uuid = cpu_data.get("cpu_uuid")
            if not cpu_uuid or cpu_uuid not in cpu_objects:
                if cpu_uuid:
                    results.append({"uuid": cpu_uuid, "status": "not_found"})
                continue

            cpu_obj = cpu_objects[cpu_uuid]
            util = self._parse_cpu_utilization(cpu_data.get("cpu_utilization", "0%"))

            # Prepare monitoring record for bulk insert
            monitoring_record = self._create_monitoring_record_object(
                cpu_data, cpu_uuid, cpu_obj, checkpoint, util
            )
            monitoring_records.append(monitoring_record)

            # Prepare alert evaluation data
            alert_data.append({
                'cpu_uuid': cpu_uuid,
                'util': util,
                'cpu_obj': cpu_obj
            })

            results.append({"uuid": cpu_uuid, "status": "success"})

        # Bulk insert all monitoring records at once
        if monitoring_records:
            try:
                await self._bulk_create_monitoring_records(monitoring_records)
                logger.debug(f"[CPU] Bulk created {len(monitoring_records)} monitoring records")
            except Exception as e:
                logger.error(f"[CPU] Bulk insert failed: {e}")

        # Process alerts with controlled concurrency
        if alert_data:
            await self._process_bulk_alerts(alert_data, checkpoint, agent)

        # Send responses if callback provided
        if response_callback:
            for cpu_data in cpu_monitoring:
                cpu_uuid = cpu_data.get("cpu_uuid")
                if cpu_uuid in cpu_objects:
                    util = self._parse_cpu_utilization(cpu_data.get("cpu_utilization", "0%"))
                    await response_callback({
                        "type": "CPU",
                        "uuid": str(cpu_uuid),
                        "utilization": util,
                        "status": "success",
                        "message": f"CPU {cpu_uuid[:8]} usage at {util:.1f}%",
                    })

        processing_time = time.time() - start_time
        logger.info(f"[CPU] Processing completed in {processing_time:.2f}s for agent {agent.uuid}")
        
        if processing_time > 2.0:
            logger.warning(f"[CPU] Slow processing: {processing_time:.2f}s for agent {agent.uuid}")

        return results

    # ═══════════════════════════════════════════════════════════════
    # OPTIMIZED DATABASE OPERATIONS
    # ═══════════════════════════════════════════════════════════════

    async def _get_cpus_bulk(self, cpu_uuids: List[str]) -> Dict[str, CPU]:
        """ Fetch all CPU objects in single query with caching."""
        # Check cache first
        uncached_uuids = []
        cpu_objects = {}
        
        for uuid in cpu_uuids:
            if uuid in self._cpu_cache:
                cpu_objects[uuid] = self._cpu_cache[uuid]
            else:
                uncached_uuids.append(uuid)
        
        # Fetch uncached CPUs in bulk
        if uncached_uuids:
            @sync_to_async
            def fetch_cpus_bulk():
                return {
                    str(cpu.uuid): cpu 
                    for cpu in CPU.objects.filter(uuid__in=uncached_uuids).select_related()
                }
            
            fetched_cpus = await fetch_cpus_bulk()
            
            # Update cache and result
            self._cpu_cache.update(fetched_cpus)
            cpu_objects.update(fetched_cpus)
            
            # Clean cache if it gets too large
            if len(self._cpu_cache) > 1000:
                # Keep only recent entries
                self._cpu_cache = dict(list(self._cpu_cache.items())[-500:])
        
        return cpu_objects

    def _create_monitoring_record_object(self, cpu_data: Dict, cpu_uuid: str, cpu_obj: CPU, checkpoint, util: float):
        """ Create monitoring record object without database insertion."""
        return CpuMonitoring(
            uuid=cpu_uuid,
            cpu=cpu_obj,
            checkpoint=checkpoint,
            p_cores_perc=json.dumps(
                cpu_data["p_cores_perc"]
                if isinstance(cpu_data.get("p_cores_perc"), (list, dict))
                else [cpu_data.get("p_cores_perc")]
            ),
            l_cores_perc=json.dumps(cpu_data.get("l_cores_perc", {})),
            ctx_switches=self._to_int(cpu_data.get("ctx_switches")),
            hw_irq=self._to_int(cpu_data.get("hw_irq")),
            sw_irq=self._to_int(cpu_data.get("sw_irq")),
            syscalls=self._to_int(cpu_data.get("syscalls")),
            cpu_utilization=f"{util:.1f}%",
        )

    @sync_to_async
    def _bulk_create_monitoring_records(self, records: List[CpuMonitoring]):
        """ Bulk insert monitoring records in single transaction."""
        with transaction.atomic():
            CpuMonitoring.objects.bulk_create(records, batch_size=100)

    # ═══════════════════════════════════════════════════════════════
    # OPTIMIZED ALERT PROCESSING
    # ═══════════════════════════════════════════════════════════════

    async def _process_bulk_alerts(self, alert_data: List[Dict], checkpoint, agent):
        """Process all alerts with bulk cache operations."""
        try:
            # Limit concurrent alert processing to avoid cache contention
            semaphore = asyncio.Semaphore(3)
            
            async def limited_alert_processing(alert_item):
                async with semaphore:
                    return await self._evaluate_alerts(
                        alert_item['cpu_uuid'],
                        alert_item['util'],
                        checkpoint,
                        agent
                    )
            
            await asyncio.gather(
                *[limited_alert_processing(item) for item in alert_data],
                return_exceptions=True
            )
            
        except Exception as e:
            logger.error(f"[CPU] Bulk alert processing failed: {e}")

    async def _evaluate_alerts(
        self,
        cpu_uuid: str,
        util: float,
        checkpoint,
        agent,
    ) -> None:
        """Track utilisation streaks & trigger alerts with batch cache operations."""
        now_time = now()

        # Determine alert level for current utilisation
        if util >= self.THRESHOLDS["CRITICAL"]:
            level = "CRITICAL"
        elif util >= self.THRESHOLDS["WARNING"]:
            level = "WARNING"
        elif util >= self.THRESHOLDS["INFO"]:
            level = "INFO"
        else:
            # utilisation below 40% → clear all streaks
            await self._clear_all_levels_async(cpu_uuid)
            return

        key = f"{self.CACHE_KEY_PREFIX}:{cpu_uuid}:{level}"
        track = await self._get_cache_async(key)

        # Start or extend streak
        if not track:
            await self._set_cache_async(
                key,
                {"start": now_time, "util": util},
                timeout=self.ALERT_CACHE_TTL,
            )
            logger.debug("[CPU] %s: %s streak started (%.1f%%)", cpu_uuid, level, util)
            return

        streak = (now_time - track["start"]).total_seconds() / 60
        if streak < self.CONTINUOUS_HIGH_MINUTES:
            logger.debug(
                "[CPU] %s: %s streak %.1f/%.0f min (%.1f%%)",
                cpu_uuid,
                level,
                streak,
                self.CONTINUOUS_HIGH_MINUTES,
                util,
            )
            return

        # Sustained breach satisfied → fire alert
        try:
            await self.alert_service.trigger_utilization_alert(
                agent=agent,
                component_type="cpu",
                component_uuid=cpu_uuid,
                utilization=util,
                checkpoint=checkpoint,
                device_name=agent.hostname if agent else "Unknown Device",
            )
            logger.info("[CPU] %s: %s alert fired at %.1f%%", cpu_uuid, level, util)
        except Exception as exc:
            logger.error("[CPU] Alert trigger failed for %s: %s", cpu_uuid, exc)

        # Restart streak and clear lower levels efficiently
        cache_updates = {key: {"start": now_time, "util": util}}
        
        # Prepare lower level clears
        fired_threshold = self.THRESHOLDS[level]
        delete_keys = []
        for lvl, thr in self.THRESHOLDS.items():
            if thr < fired_threshold:
                delete_keys.append(f"{self.CACHE_KEY_PREFIX}:{cpu_uuid}:{lvl}")

        #  Batch cache operations
        await self._set_multiple_cache_async(cache_updates, timeout=self.ALERT_CACHE_TTL)
        
        if delete_keys:
            await asyncio.gather(
                *[self._delete_cache_async(k) for k in delete_keys],
                return_exceptions=True
            )

    async def _clear_all_levels_async(self, cpu_uuid: str) -> None:
        """ Remove tracking keys for every alert level concurrently."""
        tasks = [
            self._delete_cache_async(f"{self.CACHE_KEY_PREFIX}:{cpu_uuid}:{lvl}")
            for lvl in self.THRESHOLDS
        ]
        await asyncio.gather(*tasks, return_exceptions=True)

    async def _clear_lower_levels_async(self, cpu_uuid: str, fired_level: str) -> None:
        """ Delete streaks for levels below fired_level concurrently."""
        fired_threshold = self.THRESHOLDS[fired_level]
        tasks = [
            self._delete_cache_async(f"{self.CACHE_KEY_PREFIX}:{cpu_uuid}:{lvl}")
            for lvl, thr in self.THRESHOLDS.items()
            if thr < fired_threshold
        ]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    # ═══════════════════════════════════════════════════════════════
    # DEPRECATED METHODS (kept for backward compatibility)
    # ═══════════════════════════════════════════════════════════════

    def _clear_all_levels(self, cpu_uuid: str) -> None:
        """DEPRECATED: Use _clear_all_levels_async() instead"""
        logger.warning("[CPU] Using deprecated sync _clear_all_levels - should use async version")
        for lvl in self.THRESHOLDS:
            cache.delete(f"{self.CACHE_KEY_PREFIX}:{cpu_uuid}:{lvl}")

    def _clear_lower_levels(self, cpu_uuid: str, fired_level: str) -> None:
        """DEPRECATED: Use _clear_lower_levels_async() instead"""
        logger.warning("[CPU] Using deprecated sync _clear_lower_levels - should use async version")
        fired_threshold = self.THRESHOLDS[fired_level]
        for lvl, thr in self.THRESHOLDS.items():
            if thr < fired_threshold:
                cache.delete(f"{self.CACHE_KEY_PREFIX}:{cpu_uuid}:{lvl}")

    # ═══════════════════════════════════════════════════════════════
    # UTILITY METHODS (UNCHANGED)
    # ═══════════════════════════════════════════════════════════════

    @staticmethod
    def _parse_cpu_utilization(val: Union[str, int, float]) -> float:
        try:
            return float(str(val).strip("%"))
        except (ValueError, TypeError):
            return 0.0

    @staticmethod
    def _to_int(val: Union[str, int, float, None]) -> int:
        try:
            return int(float(val))
        except (ValueError, TypeError):
            return 0

    @staticmethod
    def _build_error_response(uuid_: str, reason: str) -> Dict:
        return {"uuid": uuid_, "status": "error", "reason": reason}
