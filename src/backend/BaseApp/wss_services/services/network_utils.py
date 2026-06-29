import asyncio
import uuid
import logging
from typing import Dict, List, Set, Optional, Callable, Union

from django.core.cache import cache
from asgiref.sync import sync_to_async

# ─────────────────────────────────────────────────────── #
#                     ASYNC CACHE WRAPPERS               #
# ─────────────────────────────────────────────────────── #

async def cache_get(key):
    return await asyncio.to_thread(cache.get, key)

async def cache_set(key, value, timeout):
    await asyncio.to_thread(cache.set, key, value, timeout)

async def cache_delete(key):
    await asyncio.to_thread(cache.delete, key)

async def cache_delete_many(keys):
    await asyncio.to_thread(cache.delete_many, keys)

# ─────────────────────────────────────────────────────── #
#                     ASYNC LOGGING WRAPPERS             #
# ─────────────────────────────────────────────────────── #

logger = logging.getLogger("agent_monitoring")

async def _alog(level: str, msg: str, *args, exc_info=None):
    log_func = getattr(logger, level)
    await asyncio.to_thread(log_func, msg, *args, exc_info=exc_info)

async def log_debug(msg: str, *args):   
    await _alog("debug", msg, *args)

async def log_info(msg: str, *args):    
    await _alog("info", msg, *args)

async def log_warn(msg: str, *args):    
    await _alog("warning", msg, *args)

async def log_error(msg: str, *args, exc_info=None):
    await _alog("error", msg, *args, exc_info=exc_info)

# ─────────────────────────────────────────────────────── #
#                     UTILITY FUNCTIONS                  #
# ─────────────────────────────────────────────────────── #

def ensure_list(data):
    """Ensure data is a list."""
    return data if isinstance(data, list) else [data]

def is_valid_uuid(uuid_str):
    """Validate UUID format."""
    try:
        uuid.UUID(uuid_str)
        return True
    except (ValueError, AttributeError, TypeError):
        return False

def get_nic_identifier(nic_obj):
    """Get human-readable NIC identifier."""
    if not nic_obj:
        return "unknown"
    
    try:
        if hasattr(nic_obj, 'make') and hasattr(nic_obj, 'model'):
            make = getattr(nic_obj, 'make', '').strip()
            model = getattr(nic_obj, 'model', '').strip()
            if make and model:
                identifier = f"{make} {model}"
                if hasattr(nic_obj, 'mac_address'):
                    mac = getattr(nic_obj, 'mac_address', '').strip()
                    if mac:
                        identifier += f" ({mac})"
                return identifier
        
        if hasattr(nic_obj, 'mac_address'):
            mac = getattr(nic_obj, 'mac_address', '').strip()
            if mac:
                return f"NIC {mac}"
        
        if hasattr(nic_obj, 'uuid'):
            return f"NIC-{str(nic_obj.uuid)[:8]}"
            
    except Exception as e:
        asyncio.create_task(log_warn("Error getting NIC identifier: %s", e))
    
    return "unknown_nic"

async def send_response_with_logging(response_sender, response: Dict):
    """Send WebSocket response with logging."""
    if response_sender:
        try:
            await response_sender(response)
            await log_debug("[Network] Response sent: %s", response)
        except Exception as e:
            await log_warn("[Network] Failed to send response: %s", e)
    else:
        await log_debug("[Network] No response sender configured")

# ─────────────────────────────────────────────────────── #
#                     ALERT LEVEL HELPERS                #
# ─────────────────────────────────────────────────────── #

def determine_alert_level(utilization: float, info_threshold=40.0, warning_threshold=60.0, critical_threshold=80.0) -> Optional[str]:
    """Determine alert level based on utilization percentage."""
    if utilization >= critical_threshold:
        return 'critical'
    elif utilization >= warning_threshold:
        return 'warning'
    elif utilization >= info_threshold:
        return 'info'
    return None

async def execute_cache_operations(cache_ops):
    """Execute cache operations non-blocking."""
    try:
        for op, key, value, timeout in cache_ops:
            if op == 'set':
                await cache_set(key, value, timeout)
            elif op == 'delete':
                await cache_delete(key)
    except Exception as e:
        await log_error("[Network] Failed to execute cache operations: %s", e)

async def clear_lower_threshold_alerts(port_uuid: str, current_level: str, cache_ops: List):
    """Clear lower threshold alerts when a higher threshold is reached."""
    hierarchy = ['info', 'warning', 'critical']
    try:
        current_index = hierarchy.index(current_level)
        for level in hierarchy[:current_index]:
            cache_key = f"network_util_alert:{port_uuid}:{level}"
            cache_ops.append(('delete', cache_key, None, None))
            await log_debug("Cleared lower threshold %s for port %s", level, port_uuid)
    except ValueError:
        await log_warn("Unknown alert level: %s", current_level)

async def clear_all_threshold_alerts(port_uuid: str, cache_ops: List):
    """Clear all threshold alerts for a port when utilization is normal."""
    for level in ['info', 'warning', 'critical']:
        cache_key = f"network_util_alert:{port_uuid}:{level}"
        cache_ops.append(('delete', cache_key, None, None))