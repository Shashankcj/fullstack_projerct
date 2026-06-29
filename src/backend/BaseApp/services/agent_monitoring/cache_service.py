
# services/cache_service.py
from BaseApp.services.imports import cache, logging
 
logger = logging.getLogger("agent_monitoring")
 
class CacheService:
    """Service for managing cache operations and action throttling."""
    
    CACHE_TIMEOUTS = {
        'disk': 30,
        'port': 30,
        'memory': 30,
        'gpu': 30,
    }
    
    @classmethod
    def should_send_action(cls, action_type: str, component_key: str) -> bool:
        """
        Return True if this action should be sent (not cached), else False.
        """
        cache_key = f"triggered:{action_type}:{component_key}"
        
        if cache.get(cache_key):
            logger.debug(f"[SUPPRESS] Cached action: {action_type} for {component_key}")
            return False
 
        timeout = cls.CACHE_TIMEOUTS.get(action_type, 60)
        cache.set(cache_key, True, timeout=timeout)
        logger.info(f"[TRIGGER] New action: {action_type} for {component_key} (expires in {timeout}s)")
        return True