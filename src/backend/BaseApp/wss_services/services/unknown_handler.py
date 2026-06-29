import asyncio
import logging
from typing import Dict, List, Set, Callable, Optional, Awaitable
from django.conf import settings

logger = logging.getLogger("agent_monitoring")


_CONFIG = getattr(settings, "UNKNOWN_ENTITIES_CONFIG", {})

MAX_UNKNOWN_KEYS = _CONFIG.get("MAX_UNKNOWN_KEYS", 1000)
UNKNOWN_EXPIRY_SECONDS = _CONFIG.get("UNKNOWN_EXPIRY_SECONDS", 300)


class UnknownEntitiesService:
    """Service for deduplicated and safe handling of unknown hardware entities."""
 
    def __init__(self, response_sender: Optional[Callable[[Dict], Awaitable[None]]] = None):
        self.reported_unknowns: Set[str] = set()
        self._send_response_with_logging: Optional[Callable[[Dict], Awaitable[None]]] = response_sender
        self.background_tasks: Set[asyncio.Task] = set()
 
    def set_response_sender(self, response_sender: Callable[[Dict], Awaitable[None]]):
        """Set or override the response sender function."""
        self._send_response_with_logging = response_sender
        logger.debug("Response sender configured for UnknownEntitiesService")
 
    async def handle_unknown_entities(self, device_uuid: str, unknowns: List[Dict]) -> None:
        """
        Process and respond to unknown hardware entities (disk, partition, port).
        Deduplicates and throttles unknowns using key tracking with expiry.
        """
        if not self._send_response_with_logging:
            logger.warning("UnknownEntitiesService: No response sender configured.")
            return
 
        if not unknowns:
            return
 
        logger.info(f"[UnknownEntities] Processing {len(unknowns)} unknown entities for device {device_uuid}")
 
        for item in unknowns:
            key = self._build_key(device_uuid, item)
            action = self._build_action(device_uuid, item)
 
            if not key or not action:
                logger.debug(f"[UnknownEntities] Skipping invalid item: {item}")
                continue
 
            if len(self.reported_unknowns) >= MAX_UNKNOWN_KEYS:
                logger.warning(f"[UnknownEntities] Skipping due to max key limit: {key}")
                continue
 
            if key in self.reported_unknowns:
                logger.debug(f"[UnknownEntities] Duplicate unknown ignored: {key}")
                continue
 
            self.reported_unknowns.add(key)
            logger.info(f"[UnknownEntities] Reporting unknown: {key} -> {action}")
 
            try:
                logger.warning(f"[RESPONSE DEBUG] Sending to agent: {action}")
                await self._send_response_with_logging(action)
                logger.debug(f"[UnknownEntities] Sent action for {key}")
            except Exception as e:
                logger.exception(f"[UnknownEntities] Failed to send unknown response for {key}: {e}")
 
            # Start expiry timer in background
            task = asyncio.create_task(self._expire_key_after_delay(key))
            self.background_tasks.add(task)
            task.add_done_callback(self.background_tasks.discard)
 
    def _build_key(self, device_uuid: str, item: Dict) -> Optional[str]:
        """Build unique tracking key for deduplication."""
        item_type = item.get("type")
        if item_type == "disk":
            return f"disk:{device_uuid}:{item.get('disk_name', 'unknown_disk')}"
        elif item_type == "partition":
            return f"partition:{item.get('disk_uuid', 'unknown_disk')}:{item.get('partition_uuid', 'unknown_partition')}"
        elif item_type == "port":
            return f"port:{item.get('device_uuid', device_uuid)}:{item.get('interface', 'unknown_interface')}"
        return None
 
    def _build_action(self, device_uuid: str, item: Dict) -> Optional[Dict]:
        """Construct the action payload to send to the agent."""
        item_type = item.get("type")
        if item_type == "disk":
            return {"action": "disk", "uuid": device_uuid}
        elif item_type == "partition":
            return {"action": "disk", "uuid": item.get("device_uuid", device_uuid)}
        elif item_type == "port":
            return {
                "action": "nic",
                "uuid": item.get("device_uuid", device_uuid),
                "interface": item.get("interface", "unknown_interface")
            }
        return None
 
    async def _expire_key_after_delay(self, key: str):
        """Expire the reported unknown key after the timeout window."""
        await asyncio.sleep(UNKNOWN_EXPIRY_SECONDS)
        self.reported_unknowns.discard(key)
        logger.debug(f"[UnknownEntities] Key expired and removed: {key}")