import asyncio
import uuid
import logging
import time
from datetime import timedelta
from typing import Dict, List, Union, Callable, Optional

from django.core.cache import cache
from django.utils.timezone import now
from django.db import transaction
from asgiref.sync import sync_to_async

from ...models import Memory, MemoryMonitoring, convert_bytes_to_human_readable
from .alertservice import AlertService
from .eventservice import EventService
from django.conf import settings


logger = logging.getLogger("agent_monitoring")

class MemoryService:
    """Process memory monitoring data with bulk operations and caching."""

   # ─────────── Configuration ─────────────────────────────────────────────
    _CONFIG = getattr(settings, "MEMORY_MONITORING_CONFIG", {})
    
    # Alert timing configuration
    CONTINUOUS_HIGH_MINUTES = _CONFIG.get(
        "ALERT_CONTINUOUS_MINUTES",
        getattr(settings, "MEMORY_ALERT_CONTINUOUS_MINUTES", 5)
    )
    
    # Cache configuration
    ALERT_CACHE_TTL = _CONFIG.get(
        "ALERT_CACHE_TTL",
        getattr(settings, "MEMORY_ALERT_CACHE_TTL", 3600)
    )
    
    CACHE_KEY_PREFIX = _CONFIG.get(
        "CACHE_KEY_PREFIX",
        "memory_util_alert"
    )
    
    # Threshold configuration
    THRESHOLDS = _CONFIG.get(
        "THRESHOLDS",
        getattr(settings, "MEMORY_UTILIZATION_THRESHOLDS", {
            "INFO": 40.0,
            "WARNING": 60.0,
            "CRITICAL": 80.0,
        })
    )

    def __init__(
        self,
        alert_service: Optional[AlertService] = None,
        event_service: Optional[EventService] = None,
        response_callback: Optional[Callable[[Dict], asyncio.Future]] = None,
    ):
        self.alert_service = alert_service or AlertService()
        self.event_service = event_service or EventService()
        self._send_response = response_callback
        
        # Cache for Memory objects to avoid repeated DB queries
        self._memory_cache = {}

    def set_response_sender(self, cb: Callable[[Dict], asyncio.Future]):
        self._send_response = cb

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

    # Bulk cache operations
    async def _get_multiple_cache_async(self, keys: List[str]) -> Dict[str, any]:
        """Get multiple cache keys at once."""
        return await sync_to_async(cache.get_many)(keys)

    async def _set_multiple_cache_async(self, data: Dict[str, any], timeout=None):
        """Set multiple cache keys at once."""
        return await sync_to_async(cache.set_many)(data, timeout)

    # ═══════════════════════════════════════════════════════════════
    # OPTIMIZED MAIN PROCESSING
    # ═══════════════════════════════════════════════════════════════

    async def process_memory_data(
        self,
        data: Dict,
        checkpoint,
        agent,
        device,
        response_callback: Callable[[Dict], asyncio.Future] = None,
    ) -> Union[List[Dict], str]:
        """Process memory data with bulk operations."""
        start_time = time.time()
        
        if "memory_monitoring" not in data:
            return "not provided"

        mem_list = data["memory_monitoring"]
        if not isinstance(mem_list, list):
            mem_list = [mem_list]

        # Validate and collect valid memory UUIDs
        valid_memories = []
        invalid_responses = []

        for mem_data in mem_list:
            mem_uuid = mem_data.get("memory_uuid", "").strip()
            
            # Validation
            if not mem_uuid or mem_uuid.lower() == "unknown":
                invalid_responses.append(self._build_error_response(
                    mem_uuid, "error: unknown memory",
                    {"map_memory_to_uuid": True, "device_uuid": str(device.uuid)},
                ))
                continue
                
            try:
                uuid.UUID(mem_uuid)
                valid_memories.append((mem_uuid, mem_data))
            except (ValueError, AttributeError):
                invalid_responses.append(self._build_error_response(mem_uuid, "error: invalid UUID"))

        if not valid_memories:
            return invalid_responses

        # Bulk fetch all Memory objects at once
        memory_uuids = [mem_uuid for mem_uuid, _ in valid_memories]
        memory_objects = await self._get_memories_bulk(memory_uuids)

        # Process all memories and prepare bulk operations
        monitoring_records = []
        memory_updates = []
        alert_data = []
        size_change_events = []
        responses = []

        for mem_uuid, mem_data in valid_memories:
            if mem_uuid not in memory_objects:
                invalid_responses.append(self._build_error_response(
                    mem_uuid, "error: memory not found",
                    {"device_uuid": str(device.uuid)},
                ))
                continue

            memory = memory_objects[mem_uuid]
            
            # Parse memory data
            used_gb = self._to_gb(mem_data.get("memory_used", 0))
            avail_gb = self._to_gb(mem_data.get("memory_available", 0))
            total_gb = self._to_gb(mem_data.get("total_memory", 0))
            util = self._parse_percentage(mem_data.get("memory_utilization", "0%"))

            # Check for size changes
            if total_gb > memory.size:
                size_change_events.append((mem_uuid, memory, total_gb, agent, checkpoint))

            if memory.size != total_gb:
                memory.size = total_gb
                memory_updates.append(memory)

            # Prepare monitoring record for bulk insert
            monitoring_record = MemoryMonitoring(
                uuid=mem_uuid,
                checkpoint=checkpoint,
                memory=memory,
                memory_used=used_gb,
                memory_available=avail_gb,
                total_memory=total_gb,
                memory_utilization=f"{util:.1f}%",
            )
            monitoring_records.append(monitoring_record)

            # Prepare alert evaluation data
            alert_data.append({
                'mem_uuid': mem_uuid,
                'util': util
            })

            # Prepare response
            responses.append({"uuid": mem_uuid, "status": "success"})

        # Execute bulk operations concurrently
        bulk_operations = []

        # Bulk update memory sizes
        if memory_updates:
            bulk_operations.append(self._bulk_update_memory_sizes(memory_updates))

        # Bulk insert monitoring records
        if monitoring_records:
            bulk_operations.append(self._bulk_create_monitoring_records(monitoring_records))

        # Create size change events
        if size_change_events:
            bulk_operations.extend([
                self._size_change_event(mem_uuid, memory, new_size, agent, checkpoint)
                for mem_uuid, memory, new_size, agent, checkpoint in size_change_events
            ])

        # Execute all bulk operations concurrently
        if bulk_operations:
            await asyncio.gather(*bulk_operations, return_exceptions=True)

        # Process alerts with controlled concurrency
        if alert_data:
            await self._process_bulk_alerts(alert_data, checkpoint, agent)

        # Send responses if callback provided
        if response_callback:
            for mem_uuid, mem_data in valid_memories:
                if mem_uuid in memory_objects:
                    util = self._parse_percentage(mem_data.get("memory_utilization", "0%"))
                    await response_callback({
                        "type": "MEMORY",
                        "uuid": str(mem_uuid),
                        "utilization": util,
                        "status": "success",
                        "message": f"Memory {mem_uuid[:8]} usage at {util:.1f}%",
                    })

        processing_time = time.time() - start_time
        logger.info(f"[Memory] Processing completed in {processing_time:.2f}s for agent {agent.uuid}")
        
        if processing_time > 2.0:
            logger.warning(f"[Memory] Slow processing: {processing_time:.2f}s for agent {agent.uuid}")

        return responses + invalid_responses

    # ═══════════════════════════════════════════════════════════════
    # OPTIMIZED DATABASE OPERATIONS
    # ═══════════════════════════════════════════════════════════════

    async def _get_memories_bulk(self, memory_uuids: List[str]) -> Dict[str, Memory]:
        """ Fetch all Memory objects in single query with caching."""
        # Check cache first
        uncached_uuids = []
        memory_objects = {}
        
        for uuid in memory_uuids:
            if uuid in self._memory_cache:
                memory_objects[uuid] = self._memory_cache[uuid]
            else:
                uncached_uuids.append(uuid)
        
        # Fetch uncached memories in bulk
        if uncached_uuids:
            @sync_to_async
            def fetch_memories_bulk():
                return {
                    str(memory.uuid): memory 
                    for memory in Memory.objects.filter(uuid__in=uncached_uuids).select_related('device')
                }
            
            fetched_memories = await fetch_memories_bulk()
            
            # Update cache and result
            self._memory_cache.update(fetched_memories)
            memory_objects.update(fetched_memories)
            
            # Clean cache if it gets too large
            if len(self._memory_cache) > 1000:
                # Keep only recent entries
                self._memory_cache = dict(list(self._memory_cache.items())[-500:])
        
        return memory_objects

    @sync_to_async
    def _bulk_create_monitoring_records(self, records: List[MemoryMonitoring]):
        """ Bulk insert monitoring records in single transaction."""
        with transaction.atomic():
            MemoryMonitoring.objects.bulk_create(records, batch_size=100)

    @sync_to_async
    def _bulk_update_memory_sizes(self, memories: List[Memory]):
        """Bulk update memory sizes in single transaction."""
        with transaction.atomic():
            Memory.objects.bulk_update(memories, ['size'], batch_size=100)

    # ═══════════════════════════════════════════════════════════════
    # OPTIMIZED ALERT PROCESSING
    # ═══════════════════════════════════════════════════════════════

    async def _process_bulk_alerts(self, alert_data: List[Dict], checkpoint, agent):
        """Process all alerts with controlled concurrency."""
        try:
            # Limit concurrent alert processing to avoid cache contention
            semaphore = asyncio.Semaphore(3)
            
            async def limited_alert_processing(alert_item):
                async with semaphore:
                    return await self._evaluate_alerts(
                        alert_item['mem_uuid'],
                        alert_item['util'],
                        checkpoint,
                        agent
                    )
            
            await asyncio.gather(
                *[limited_alert_processing(item) for item in alert_data],
                return_exceptions=True
            )
            
        except Exception as e:
            logger.error(f"[Memory] Bulk alert processing failed: {e}")

    async def _evaluate_alerts(
        self,
        mem_uuid: str,
        util: float,
        checkpoint,
        agent,
    ):
        """ Alert evaluation with batch cache operations."""
        now_time = now()

        # Decide current alert level (or None if below Info)
        if util >= self.THRESHOLDS["CRITICAL"]:
            level = "CRITICAL"
        elif util >= self.THRESHOLDS["WARNING"]:
            level = "WARNING"
        elif util >= self.THRESHOLDS["INFO"]:
            level = "INFO"
        else:
            await self._clear_all_levels_async(mem_uuid)
            return

        key = f"{self.CACHE_KEY_PREFIX}:{mem_uuid}:{level}"
        track = await self._get_cache_async(key)

        # Start new streak
        if not track:
            await self._set_cache_async(
                key, 
                {"start": now_time, "util": util}, 
                timeout=self.ALERT_CACHE_TTL
            )
            logger.debug("[Memory] %s %s streak started (%.1f%%)", mem_uuid, level, util)
            return

        streak = (now_time - track["start"]).total_seconds() / 60
        if streak < self.CONTINUOUS_HIGH_MINUTES:
            logger.debug(
                "[Memory] %s %s streak %.1f/%.0f min (%.1f%%)",
                mem_uuid, level, streak, self.CONTINUOUS_HIGH_MINUTES, util,
            )
            return

        # Fire alert
        try:
            await self.alert_service.trigger_utilization_alert(
                agent=agent,
                component_type="memory",
                component_uuid=mem_uuid,
                utilization=util,
                checkpoint=checkpoint,
                device_name=agent.hostname if agent else "Unknown Device",
            )
            logger.info("[Memory] %s %s alert fired at %.1f%%", mem_uuid, level, util)
        except Exception as exc:
            logger.error("[Memory] Alert trigger failed: %s", exc, exc_info=True)

        # Reset streak and clear lower levels efficiently
        cache_updates = {key: {"start": now_time, "util": util}}
        
        # Prepare lower level clears
        fired_threshold = self.THRESHOLDS[level]
        delete_keys = []
        for lvl, thr in self.THRESHOLDS.items():
            if thr < fired_threshold:
                delete_keys.append(f"{self.CACHE_KEY_PREFIX}:{mem_uuid}:{lvl}")

        # Batch cache operations
        await self._set_multiple_cache_async(cache_updates, timeout=self.ALERT_CACHE_TTL)
        
        if delete_keys:
            await asyncio.gather(
                *[self._delete_cache_async(k) for k in delete_keys],
                return_exceptions=True
            )

    async def _clear_all_levels_async(self, mem_uuid: str):
        """ Clear all alert levels concurrently."""
        tasks = [
            self._delete_cache_async(f"{self.CACHE_KEY_PREFIX}:{mem_uuid}:{lvl}")
            for lvl in self.THRESHOLDS
        ]
        await asyncio.gather(*tasks, return_exceptions=True)

    async def _clear_lower_levels_async(self, mem_uuid: str, fired_level: str):
        """ Clear lower levels concurrently."""
        fired_threshold = self.THRESHOLDS[fired_level]
        tasks = [
            self._delete_cache_async(f"{self.CACHE_KEY_PREFIX}:{mem_uuid}:{lvl}")
            for lvl, thr in self.THRESHOLDS.items()
            if thr < fired_threshold
        ]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    # ═══════════════════════════════════════════════════════════════
    # SIZE CHANGE EVENT HANDLING
    # ═══════════════════════════════════════════════════════════════

    async def _size_change_event(self, mem_uuid, memory, new_size, agent, checkpoint):
        """Handle memory size change events."""
        desc = (
            f"Memory size updated for {mem_uuid}: "
            f"{memory.size:.2f} GB → {new_size:.2f} GB"
        )
        try:
            await self.event_service.create_event(
                event_type="memory_update",
                description=desc,
                agent=agent,
                component_type="memory",
                component_uuid=mem_uuid,
                additional_data={
                    "old_size_gb": memory.size,
                    "new_size_gb": new_size,
                    "checkpoint": str(checkpoint) if checkpoint else None,
                },
            )
        except Exception as exc:
            logger.error("Failed to create memory-update event: %s", exc)

    # ═══════════════════════════════════════════════════════════════
    # DEPRECATED METHODS (kept for backward compatibility)
    # ═══════════════════════════════════════════════════════════════

    def _clear_all_levels(self, mem_uuid: str):
        """DEPRECATED: Use _clear_all_levels_async() instead"""
        logger.warning("[Memory] Using deprecated sync _clear_all_levels - should use async version")
        for lvl in self.THRESHOLDS:
            cache.delete(f"{self.CACHE_KEY_PREFIX}:{mem_uuid}:{lvl}")

    def _clear_lower_levels(self, mem_uuid: str, fired_level: str):
        """DEPRECATED: Use _clear_lower_levels_async() instead"""
        logger.warning("[Memory] Using deprecated sync _clear_lower_levels - should use async version")
        fired_threshold = self.THRESHOLDS[fired_level]
        for lvl, thr in self.THRESHOLDS.items():
            if thr < fired_threshold:
                cache.delete(f"{self.CACHE_KEY_PREFIX}:{mem_uuid}:{lvl}")

    # ═══════════════════════════════════════════════════════════════
    # UTILITY METHODS (UNCHANGED)
    # ═══════════════════════════════════════════════════════════════

    @staticmethod
    def _to_gb(value) -> float:
        try:
            return convert_bytes_to_human_readable(value, "GB")
        except Exception:
            return 0.0

    @staticmethod
    def _parse_percentage(val: Union[str, int, float]) -> float:
        try:
            return float(str(val).strip("%"))
        except Exception:
            return 0.0

    @staticmethod
    def _build_error_response(mem_uuid: str, status: str, action: Dict = None) -> Dict:
        resp = {"uuid": mem_uuid or "unknown", "status": status}
        if action:
            resp["action"] = action
        return resp
