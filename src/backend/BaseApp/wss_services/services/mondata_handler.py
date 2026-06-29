import logging
import time
import asyncio
from typing import Dict, Tuple, Union, Callable, Optional
from datetime import datetime
from channels.db import database_sync_to_async
from django.utils.timezone import now, make_aware, get_current_timezone
from django.core.cache import cache
from django.conf import settings
from ...models import Agent, Event, MonitoringCheckpoint, Device
from .eventservice import EventService
from .alertservice import AlertService
from .memoryservice import MemoryService
from .cpuservice import CpuService
from .diskservice import DiskMonitoringService
from .networkportservice import NetworkMonitoringService
from .unknown_handler import UnknownEntitiesService

# Correct service class imports
from BaseApp.wss_services.services.ApplicationResourceservices.DiskIO_service import DiskIOService
from BaseApp.wss_services.services.ApplicationResourceservices.CpuIO_service import CPUIOService
from BaseApp.wss_services.services.ApplicationResourceservices.MemoryIO_service import MemoryIOService

logger = logging.getLogger("agent_monitoring")

# Load configuration from Django settings
_CONFIG = getattr(settings, "MONITORING_HANDLER_CONFIG", {})

# Configuration constants from settings with fallback defaults
MAX_CONCURRENT_SERVICES = _CONFIG.get("MAX_CONCURRENT_SERVICES", 7)
DEFAULT_DEVICE_CACHE_TTL = _CONFIG.get("DEVICE_CACHE_TTL", 3600)
MAX_DEVICE_CACHE_SIZE = _CONFIG.get("MAX_DEVICE_CACHE_SIZE", 200)
SLOW_PROCESSING_THRESHOLD = _CONFIG.get("SLOW_PROCESSING_THRESHOLD", 5.0)
SERVICE_TIMEOUT = _CONFIG.get("SERVICE_TIMEOUT", 30.0)
PARALLEL_PROCESSING_TIMEOUT = _CONFIG.get("PARALLEL_PROCESSING_TIMEOUT", 60.0)
CACHE_CLEANUP_INTERVAL = _CONFIG.get("CACHE_CLEANUP_INTERVAL", 100)

class MonitoringHandler:
    """
    Optimized handler for processing monitoring data with parallel service execution.
    All configurations loaded from Django settings.
    """

    def __init__(self, response_sender: Callable[[Dict], asyncio.Future]):
        self.response_sender = response_sender

        self.event_service = EventService()
        self.alert_service = AlertService()
        self.unknown_entities_service = UnknownEntitiesService()
        self.unknown_entities_service.set_response_sender(response_sender)

        self.memory_service = MemoryService(alert_service=self.alert_service)
        self.cpu_service = CpuService(alert_service=self.alert_service)
        self.disk_service = DiskMonitoringService(
            alert_service=self.alert_service,
            unknown_service=self.unknown_entities_service
        )
        self.disk_service.set_response_sender(response_sender)

        self.network_service = NetworkMonitoringService(
            alert_service=self.alert_service,
            unknown_entities_service=self.unknown_entities_service
        )
        self.network_service.set_response_sender(response_sender)

        # Properly instantiate new resource service classes
        self.diskio_service = DiskIOService(
            alert_service=self.alert_service,
            unknown_service=self.unknown_entities_service
        )
        self.diskio_service.set_response_sender(response_sender)

        self.memoryio_service = MemoryIOService(
            alert_service=self.alert_service,
            unknown_service=self.unknown_entities_service
        )
        self.memoryio_service.set_response_sender(response_sender)

        self.cpuio_service = CPUIOService(
            alert_service=self.alert_service,
            unknown_service=self.unknown_entities_service
        )
        self.cpuio_service.set_response_sender(response_sender)

        # Device cache with timestamp for TTL (uses configured TTL)
        self._device_cache: Dict[str, Tuple[Device, float]] = {}
        self._device_cache_ttl = DEFAULT_DEVICE_CACHE_TTL
        self._cache_access_count = 0  # Track cache accesses for cleanup
        
        # Track active tasks for proper cleanup
        self._active_tasks = set()
        self._shutdown_requested = False

    # ═══════════════════════════════════════════════════════════════
    # OPTIMIZED DATABASE OPERATIONS
    # ═══════════════════════════════════════════════════════════════

    @database_sync_to_async
    def _get_device_from_db(self, agent: Agent) -> Optional[Device]:
        """Fetch device from database with proper async wrapper."""
        try:
            return Device.objects.select_related('agent').get(agent=agent)
        except Device.DoesNotExist:
            logger.error(f"[Monitoring] No device found for agent: {agent.uuid}")
            return None

    @database_sync_to_async
    def _cache_get(self, key):
        """Async cache get operation."""
        return cache.get(key)

    @database_sync_to_async
    def _cache_set(self, key, value, timeout=None):
        """Async cache set operation."""
        return cache.set(key, value, timeout)

    @database_sync_to_async
    def _cache_delete(self, key):
        """Async cache delete operation."""
        return cache.delete(key)

    async def _get_device_optimized(self, agent: Agent) -> Optional[Device]:
        """
        Get device with multi-layer caching:
        1. In-memory cache (fastest)
        2. Redis/Django cache (fast)
        3. Database (slowest)
        """
        agent_uuid = str(agent.uuid)
        current_time = time.time()
        
        # Increment cache access counter
        self._cache_access_count += 1

        # Check in-memory cache first with TTL
        if agent_uuid in self._device_cache:
            device, cached_time = self._device_cache[agent_uuid]
            if current_time - cached_time < self._device_cache_ttl:
                return device
            else:
                # Expired, remove from cache
                del self._device_cache[agent_uuid]

        # Check Django/Redis cache
        cache_key = f"device_agent_{agent_uuid}"
        cached_device_uuid = await self._cache_get(cache_key)

        if cached_device_uuid:
            try:
                device = await self._get_device_from_db(agent)
                if device:
                    self._device_cache[agent_uuid] = (device, current_time)
                    return device
            except Exception as e:
                logger.error(f"[Cache] Error retrieving cached device: {e}")
                await self._cache_delete(cache_key)

        # Fetch from database
        device = await self._get_device_from_db(agent)
        if device:
            # Update both caches
            self._device_cache[agent_uuid] = (device, current_time)
            await self._cache_set(cache_key, str(device.uuid), timeout=self._device_cache_ttl)
            
            # Cleanup old cache entries using configured size limit and interval
            if (len(self._device_cache) > MAX_DEVICE_CACHE_SIZE and 
                self._cache_access_count % CACHE_CLEANUP_INTERVAL == 0):
                await self._cleanup_device_cache(current_time)

        return device

    async def _cleanup_device_cache(self, current_time: float):
        """Remove expired entries from device cache using configured limits."""
        expired_keys = [
            key for key, (_, cached_time) in self._device_cache.items()
            if current_time - cached_time > self._device_cache_ttl
        ]
        for key in expired_keys:
            del self._device_cache[key]
        logger.debug(f"[Cache] Cleaned up {len(expired_keys)} expired device cache entries")
        
        # Reset counter after cleanup
        self._cache_access_count = 0

    @database_sync_to_async
    def _create_checkpoint(self, agent: Agent, event: Event, timestamp: datetime) -> Optional[MonitoringCheckpoint]:
        """Create monitoring checkpoint with proper async wrapper."""
        try:
            checkpoint = MonitoringCheckpoint.objects.create(
                agent=agent,
                event=event,
                created_at=timestamp
            )
            logger.debug(f"[Monitoring] Created checkpoint {checkpoint.uuid} for agent {agent.uuid}")
            return checkpoint
        except Exception as e:
            logger.error(f"[Monitoring] Failed to create checkpoint: {e}", exc_info=True)
            return None

    # ═══════════════════════════════════════════════════════════════
    # MAIN PROCESSING LOGIC - PARALLEL EXECUTION WITH TIMEOUT
    # ═══════════════════════════════════════════════════════════════

    async def process_monitoring_data(
        self,
        data: Dict,
        event: Event,
        agent: Agent
    ) -> Tuple[bool, Union[Dict, str]]:
        """
        Process monitoring data with PARALLEL service execution and configurable timeout.
        All services run concurrently for maximum throughput.
        """
        try:
            start = time.time()

            # Check if shutdown was requested
            if self._shutdown_requested:
                logger.warning(f"[Monitoring] Shutdown requested, skipping processing for agent {agent.uuid}")
                return False, "Shutdown in progress"

            # Validate device UUID
            input_device_uuid = (data.get("device_uuid") or "").strip().lower()
            if not input_device_uuid:
                return False, "Device UUID not provided in data"

            device = await self._get_device_optimized(agent)
            if not device:
                return False, "No device associated with this agent"

            actual_device_uuid = str(device.uuid).lower()
            if input_device_uuid != actual_device_uuid:
                logger.warning(f"[UUID Mismatch] Expected: {actual_device_uuid}, Got: {input_device_uuid}")
                return False, "Device UUID mismatch"

            # Parse timestamp
            timestamp = await self._parse_timestamp(data)

            # Create checkpoint
            checkpoint = await self._create_checkpoint(agent, event, timestamp)
            if not checkpoint:
                logger.warning("[Monitoring] Continuing without checkpoint due to creation failure")

            logger.info(f"[Monitoring] Starting PARALLEL service processing for agent {agent.uuid}")

            # ═══════════════════════════════════════════════════════════════
            # PARALLEL EXECUTION - All services run simultaneously with timeout
            # ═══════════════════════════════════════════════════════════════
            
            try:
                # Create tasks without wait_for wrapper to properly handle cancellation
                results = await asyncio.gather(
                    self._process_memory_data(data, checkpoint, agent, device),
                    self._process_cpu_data(data, checkpoint, agent, device),
                    self._process_disk_data(data, checkpoint, agent, device),
                    self._process_network_data(data, checkpoint, agent, device),
                    self._process_disk_io_data(data, checkpoint, agent, device),
                    self._process_memory_io_data(data, checkpoint, agent, device),
                    self._process_cpu_io_data(data, checkpoint, agent, device),
                    return_exceptions=True  # Catch all exceptions including CancelledError
                )
            except asyncio.CancelledError:
                logger.warning(f"[Monitoring] Processing cancelled for agent {agent.uuid}")
                # Don't re-raise, return gracefully
                return False, "Processing cancelled"
            except Exception as e:
                logger.error(f"[Monitoring] Unexpected error during gather: {e}", exc_info=True)
                return False, f"Gather error: {str(e)}"

            # Map results to service names
            service_names = ['memory', 'cpu', 'disk', 'network', 'disk_io', 'memory_io', 'cpu_io']
            final = {}
            
            for service_name, result in zip(service_names, results):
                if isinstance(result, asyncio.CancelledError):
                    logger.warning(f"[{service_name.upper()}Service] Task was cancelled")
                    final[service_name] = {"status": "cancelled"}
                elif isinstance(result, Exception):
                    logger.error(f"[{service_name.upper()}Service] Exception: {result}")
                    final[service_name] = {"error": str(result)}
                else:
                    final[service_name] = result

            processing_time = time.time() - start
            logger.info(
                f"[Monitoring] PARALLEL processing completed in {processing_time:.2f}s "
                f"for agent {agent.uuid} (7 services)"
            )

            # Use configured slow processing threshold
            if processing_time > SLOW_PROCESSING_THRESHOLD:
                logger.warning(
                    f"[Performance] Slow parallel processing: {processing_time:.2f}s "
                    f"for agent {agent.uuid} (threshold: {SLOW_PROCESSING_THRESHOLD}s)"
                )

            return True, final

        except asyncio.CancelledError:
            logger.info(f"[Monitoring] process_monitoring_data cancelled for agent {agent.uuid}")
            return False, "Processing cancelled"
        except Exception as e:
            logger.exception("[MonitoringHandler] Fatal error in process_monitoring_data")
            return False, str(e)

    # ═══════════════════════════════════════════════════════════════
    # SERVICE PROCESSING METHODS (called in parallel with individual timeouts)
    # ═══════════════════════════════════════════════════════════════

    async def _process_memory_data(self, data, checkpoint, agent, device):
        """Process memory monitoring data with configurable timeout."""
        try:
            return await asyncio.wait_for(
                self.memory_service.process_memory_data(data, checkpoint, agent, device),
                timeout=SERVICE_TIMEOUT
            )
        except asyncio.CancelledError:
            logger.debug(f"[MemoryService] Processing cancelled for agent {agent.uuid}")
            # Return a dict instead of re-raising to avoid "never retrieved" error
            return {"status": "cancelled", "service": "memory"}
        except asyncio.TimeoutError:
            logger.error(f"[MemoryService] Timeout ({SERVICE_TIMEOUT}s) for agent {agent.uuid}")
            return {"error": "timeout", "service": "memory"}
        except Exception as e:
            logger.error(f"[MemoryService] Error for agent {agent.uuid}: {e}", exc_info=True)
            return {"error": str(e), "service": "memory"}

    async def _process_cpu_data(self, data, checkpoint, agent, device):
        """Process CPU monitoring data with configurable timeout."""
        try:
            return await asyncio.wait_for(
                self.cpu_service.process_cpu_data(data, checkpoint, agent, device),
                timeout=SERVICE_TIMEOUT
            )
        except asyncio.CancelledError:
            logger.debug(f"[CpuService] Processing cancelled for agent {agent.uuid}")
            return {"status": "cancelled", "service": "cpu"}
        except asyncio.TimeoutError:
            logger.error(f"[CpuService] Timeout ({SERVICE_TIMEOUT}s) for agent {agent.uuid}")
            return {"error": "timeout", "service": "cpu"}
        except Exception as e:
            logger.error(f"[CpuService] Error for agent {agent.uuid}: {e}", exc_info=True)
            return {"error": str(e), "service": "cpu"}

    async def _process_disk_data(self, data, checkpoint, agent, device):
        """Process disk monitoring data with configurable timeout."""
        try:
            return await asyncio.wait_for(
                self.disk_service.process_disk_data(data, checkpoint, agent, device),
                timeout=SERVICE_TIMEOUT
            )
        except asyncio.CancelledError:
            logger.debug(f"[DiskService] Processing cancelled for agent {agent.uuid}")
            return {"status": "cancelled", "service": "disk"}
        except asyncio.TimeoutError:
            logger.error(f"[DiskService] Timeout ({SERVICE_TIMEOUT}s) for agent {agent.uuid}")
            return {"error": "timeout", "service": "disk"}
        except Exception as e:
            logger.error(f"[DiskService] Error for agent {agent.uuid}: {e}", exc_info=True)
            return {"error": str(e), "service": "disk"}

    async def _process_network_data(self, data, checkpoint, agent, device):
        """Process network monitoring data with configurable timeout."""
        try:
            return await asyncio.wait_for(
                self.network_service.process_network_data(data, checkpoint, agent, device),
                timeout=SERVICE_TIMEOUT
            )
        except asyncio.CancelledError:
            logger.debug(f"[NetworkService] Processing cancelled for agent {agent.uuid}")
            return {"status": "cancelled", "service": "network"}
        except asyncio.TimeoutError:
            logger.error(f"[NetworkService] Timeout ({SERVICE_TIMEOUT}s) for agent {agent.uuid}")
            return {"error": "timeout", "service": "network"}
        except Exception as e:
            logger.error(f"[NetworkService] Error for agent {agent.uuid}: {e}", exc_info=True)
            return {"error": str(e), "service": "network"}

    async def _process_disk_io_data(self, data, checkpoint, agent, device):
        """Process disk I/O resource monitoring data with configurable timeout."""
        try:
            disk_resource_data = data.get('disk_resource_monitoring', [])
            if not disk_resource_data:
                return {"status": "no_data"}
            
            device_uuid = str(device.uuid)
            return await asyncio.wait_for(
                self.diskio_service.process_disk_io_data(
                    device_uuid, disk_resource_data, checkpoint, agent, device
                ),
                timeout=SERVICE_TIMEOUT
            )
        except asyncio.CancelledError:
            logger.debug(f"[DiskIOService] Processing cancelled for agent {agent.uuid}")
            return {"status": "cancelled", "service": "disk_io"}
        except asyncio.TimeoutError:
            logger.error(f"[DiskIOService] Timeout ({SERVICE_TIMEOUT}s) for agent {agent.uuid}")
            return {"error": "timeout", "service": "disk_io"}
        except Exception as e:
            logger.error(f"[DiskIOService] Error for agent {agent.uuid}: {e}", exc_info=True)
            return {"error": str(e), "service": "disk_io"}

    async def _process_memory_io_data(self, data, checkpoint, agent, device):
        """Process memory I/O resource monitoring data with configurable timeout."""
        try:
            memory_resource_data = data.get('memory_resource_monitoring', [])
            if not memory_resource_data:
                return {"status": "no_data"}
            
            memory_monitoring = data.get('memory_monitoring', {})
            memory_uuid = memory_monitoring.get('memory_uuid')
            
            if not memory_uuid:
                logger.error("[MemoryIOService] No memory_uuid found in payload")
                return {"error": "memory_uuid_missing"}
            
            return await asyncio.wait_for(
                self.memoryio_service.process_memory_io_data(
                    memory_uuid, memory_resource_data, checkpoint, agent, device
                ),
                timeout=SERVICE_TIMEOUT
            )
        except asyncio.CancelledError:
            logger.debug(f"[MemoryIOService] Processing cancelled for agent {agent.uuid}")
            return {"status": "cancelled", "service": "memory_io"}
        except asyncio.TimeoutError:
            logger.error(f"[MemoryIOService] Timeout ({SERVICE_TIMEOUT}s) for agent {agent.uuid}")
            return {"error": "timeout", "service": "memory_io"}
        except Exception as e:
            logger.error(f"[MemoryIOService] Error for agent {agent.uuid}: {e}", exc_info=True)
            return {"error": str(e), "service": "memory_io"}

    async def _process_cpu_io_data(self, data, checkpoint, agent, device):
        """Process CPU I/O resource monitoring data with configurable timeout."""
        try:
            cpu_resource_data = data.get('cpu_resource_monitoring', [])
            if not cpu_resource_data:
                return {"status": "no_data"}
            
            cpu_monitoring = data.get('cpu_monitoring', {})
            cpu_uuid = cpu_monitoring.get('cpu_uuid')
            
            if not cpu_uuid:
                logger.error("[CPUIOService] No cpu_uuid found in payload")
                return {"error": "cpu_uuid_missing"}
            
            return await asyncio.wait_for(
                self.cpuio_service.process_cpu_io_data(
                    cpu_uuid, cpu_resource_data, checkpoint, agent, device
                ),
                timeout=SERVICE_TIMEOUT
            )
        except asyncio.CancelledError:
            logger.debug(f"[CPUIOService] Processing cancelled for agent {agent.uuid}")
            return {"status": "cancelled", "service": "cpu_io"}
        except asyncio.TimeoutError:
            logger.error(f"[CPUIOService] Timeout ({SERVICE_TIMEOUT}s) for agent {agent.uuid}")
            return {"error": "timeout", "service": "cpu_io"}
        except Exception as e:
            logger.error(f"[CPUIOService] Error for agent {agent.uuid}: {e}", exc_info=True)
            return {"error": str(e), "service": "cpu_io"}

    # ═══════════════════════════════════════════════════════════════
    # HELPER METHODS
    # ═══════════════════════════════════════════════════════════════

    async def _parse_timestamp(self, data: Dict) -> datetime:
        """Parse timestamp from data or use current time."""
        raw_date = data.get("date")
        raw_time = data.get("time")

        if raw_date and raw_time:
            try:
                naive_dt = datetime.strptime(f"{raw_date} {raw_time}", "%Y-%m-%d %H:%M:%S")
                return make_aware(naive_dt, timezone=get_current_timezone())
            except Exception as e:
                logger.warning(f"[Monitoring] Invalid date/time format: {e}. Using now().")

        return now()

    async def _safe_respond(self, payload: Dict):
        """Safely send response without blocking."""
        try:
            await self.response_sender(payload)
        except Exception as e:
            logger.error(f"[MonitoringHandler] Failed to send response: {e}")

    async def create_monitoring_event(self, event_type: str, description: str, agent: Agent):
        """Create a monitoring event."""
        try:
            return await self.event_service.create_event(
                event_type=event_type,
                description=description,
                agent=agent
            )
        except Exception as e:
            logger.error(f"[MonitoringHandler] Failed to create event: {e}")
            return None

    async def process_heartbeat(self, data: Dict, event: Event):
        """Process heartbeat message."""
        try:
            logger.debug(f"[Heartbeat] Received from event {event.id}")
            return {"status": "heartbeat_received", "timestamp": now().isoformat()}
        except Exception as e:
            logger.error(f"[Heartbeat] Processing error: {e}")
            raise

    async def process_alert(self, data: Dict, event: Event):
        """Process alert message."""
        try:
            alert_type = data.get("alert_type", "unknown")
            message = data.get("message", "No message provided")
            logger.info(f"[Alert] Type: {alert_type}, Message: {message}")
            return {"status": "alert_processed", "type": alert_type}
        except Exception as e:
            logger.error(f"[Alert] Processing error: {e}")
            raise

    # ═══════════════════════════════════════════════════════════════
    # LIFECYCLE MANAGEMENT
    # ═══════════════════════════════════════════════════════════════

    async def shutdown(self):
        """Gracefully shutdown handler and cancel all active tasks."""
        self._shutdown_requested = True
        
        if self._active_tasks:
            logger.info(f"[MonitoringHandler] Cancelling {len(self._active_tasks)} active tasks...")
            for task in self._active_tasks:
                if not task.done():
                    task.cancel()
            
            # Wait for all tasks to complete cancellation
            results = await asyncio.gather(*self._active_tasks, return_exceptions=True)
            
            # Log any unexpected exceptions (not CancelledError)
            for i, result in enumerate(results):
                if isinstance(result, Exception) and not isinstance(result, asyncio.CancelledError):
                    logger.error(f"[MonitoringHandler] Task {i} raised exception during shutdown: {result}")
            
            self._active_tasks.clear()
            logger.info("[MonitoringHandler] All tasks cancelled successfully")

    # ═══════════════════════════════════════════════════════════════
    # CACHE MANAGEMENT WITH CONFIGURATION SUPPORT
    # ═══════════════════════════════════════════════════════════════

    def clear_device_cache(self, agent_uuid: str = None):
        """Clear device cache for specific agent or all agents."""
        if agent_uuid:
            self._device_cache.pop(agent_uuid, None)
            logger.debug(f"Cleared device cache for agent {agent_uuid}")
        else:
            self._device_cache.clear()
            logger.debug("Cleared all device cache")

    def get_cache_stats(self) -> Dict:
        """Get cache statistics for monitoring with configuration info."""
        return {
            "device_cache_size": len(self._device_cache),
            "cached_agents": list(self._device_cache.keys()),
            "cache_ttl_seconds": self._device_cache_ttl,
            "max_cache_size": MAX_DEVICE_CACHE_SIZE,
            "cleanup_interval": CACHE_CLEANUP_INTERVAL,
            "cache_access_count": self._cache_access_count,
            "active_tasks": len(self._active_tasks),
            "shutdown_requested": self._shutdown_requested,
            "configuration": {
                "MAX_CONCURRENT_SERVICES": MAX_CONCURRENT_SERVICES,
                "SLOW_PROCESSING_THRESHOLD": SLOW_PROCESSING_THRESHOLD,
                "SERVICE_TIMEOUT": SERVICE_TIMEOUT,
                "PARALLEL_PROCESSING_TIMEOUT": PARALLEL_PROCESSING_TIMEOUT,
            }
        }

    def get_configuration(self) -> Dict:
        """Get current handler configuration for debugging."""
        return {
            "MAX_CONCURRENT_SERVICES": MAX_CONCURRENT_SERVICES,
            "DEFAULT_DEVICE_CACHE_TTL": DEFAULT_DEVICE_CACHE_TTL,
            "MAX_DEVICE_CACHE_SIZE": MAX_DEVICE_CACHE_SIZE,
            "SLOW_PROCESSING_THRESHOLD": SLOW_PROCESSING_THRESHOLD,
            "SERVICE_TIMEOUT": SERVICE_TIMEOUT,
            "PARALLEL_PROCESSING_TIMEOUT": PARALLEL_PROCESSING_TIMEOUT,
            "CACHE_CLEANUP_INTERVAL": CACHE_CLEANUP_INTERVAL,
        }