import json
import logging
import hashlib
import time
from typing import Dict, Any, Optional, List
from django.utils import timezone
from django.core.cache import cache
from django.conf import settings
from asgiref.sync import sync_to_async

from ...models import Event, Agent

logger = logging.getLogger("agent_monitoring")

# Load configuration from Django settings
EVENT_SERVICE_CONFIG = getattr(settings, 'EVENT_SERVICE_CONFIG', {})

# Configuration constants from settings with fallback defaults
EVENT_CACHE_TIMEOUT = EVENT_SERVICE_CONFIG.get('EVENT_CACHE_TIMEOUT', 60)
MAX_DESCRIPTION_LENGTH = EVENT_SERVICE_CONFIG.get('MAX_DESCRIPTION_LENGTH', 500)
RATE_LIMIT_WINDOW = EVENT_SERVICE_CONFIG.get('RATE_LIMIT_WINDOW', 60)
MIN_EVENT_INTERVAL = EVENT_SERVICE_CONFIG.get('MIN_EVENT_INTERVAL', 1)
SLOW_OPERATION_THRESHOLD = EVENT_SERVICE_CONFIG.get('SLOW_OPERATION_THRESHOLD', 1.0)
MAX_EVENTS_LIMIT = EVENT_SERVICE_CONFIG.get('MAX_EVENTS_LIMIT', 100)
CLEANUP_BATCH_SIZE = EVENT_SERVICE_CONFIG.get('CLEANUP_BATCH_SIZE', 1000)
DEFAULT_CLEANUP_DAYS = EVENT_SERVICE_CONFIG.get('DEFAULT_CLEANUP_DAYS', 30)

class EventService:
    """Service to handle system event creation with deduplication and logging."""

    def __init__(self):
        self._cache_stats = {
            'hits': 0,
            'misses': 0,
            'creates': 0,
            'errors': 0
        }
        # Use configurable max description length
        self._max_description_length = MAX_DESCRIPTION_LENGTH
        self._rate_limit_cache = {}  # For rate limiting per agent

    def _generate_event_key(
        self,
        event_type: str,
        description: str,
        agent,
        component_type: str = None,
        component_uuid: str = None
    ) -> str:
        """Generate a unique cache key for deduplication based on agent identifiers."""
        try:
            agent_id = str(agent.uuid) if agent else "no-agent"
            
            # Truncate description to prevent excessive key lengths (configurable)
            truncated_desc = description[:200] if description else ""
            
            base_key = f"{event_type}:{truncated_desc}:{agent_id}:{component_type or 'none'}:{component_uuid or 'none'}"
            return "event_dedupe:" + hashlib.md5(base_key.encode()).hexdigest()
        except Exception as e:
            logger.error(f"[EventService] Failed to generate event key: {e}")
            # Fallback key
            return f"event_dedupe:fallback_{hash(str(time.time()))}"

    def _validate_event_data(self, event_type: str, description: str, agent) -> tuple:
        """Validate event creation data with configurable limits."""
        errors = []
        
        if not event_type or not isinstance(event_type, str):
            errors.append("event_type must be a non-empty string")
        elif len(event_type) > 50:
            errors.append("event_type too long (max 50 characters)")
            
        if not description or not isinstance(description, str):
            errors.append("description must be a non-empty string")
        elif len(description) > self._max_description_length:
            errors.append(f"description too long (max {self._max_description_length} characters)")
            
        if not agent:
            errors.append("agent is required")
            
        return len(errors) == 0, errors

    def _check_rate_limit(self, agent, event_type: str) -> bool:
        """Check if agent is rate limited for this event type with configurable timing."""
        if not agent:
            return False
            
        try:
            rate_key = f"rate_limit:{agent.uuid}:{event_type}"
            current_time = time.time()
            
            # Clean old rate limit entries using configured window
            self._rate_limit_cache = {
                k: v for k, v in self._rate_limit_cache.items()
                if current_time - v < RATE_LIMIT_WINDOW
            }
            
            # Check if we're hitting the same event too frequently using configured interval
            last_time = self._rate_limit_cache.get(rate_key, 0)
            if current_time - last_time < MIN_EVENT_INTERVAL:
                return True
                
            self._rate_limit_cache[rate_key] = current_time
            return False
            
        except Exception as e:
            logger.error(f"[EventService] Rate limit check failed: {e}")
            return False

    async def create_event(
        self,
        event_type: str,
        description: str,
        agent,
        component_type: str = None,
        component_uuid: str = None,
        additional_data: Dict[str, Any] = None,
        force: bool = False,
        dedupe: bool = True,
        dedupe_timeout: int = None  # Now optional, will use configured default
    ) -> Optional[Event]:
        """Create a new event for the given agent with improved error handling."""
        
        # Use configured timeout if not specified
        if dedupe_timeout is None:
            dedupe_timeout = EVENT_CACHE_TIMEOUT
            
        start_time = time.time()
        
        try:
            # Validate input data first (uses configured limits)
            is_valid, validation_errors = self._validate_event_data(event_type, description, agent)
            if not is_valid:
                logger.warning(f"[EventService] Validation failed: {', '.join(validation_errors)}")
                self._cache_stats['errors'] += 1
                return None

            # Check rate limiting (uses configured intervals)
            if self._check_rate_limit(agent, event_type):
                logger.debug(f"[EventService] Rate limited: {event_type} for agent {agent.uuid}")
                return None

            logger.debug(f"[EventService] Creating event: {event_type} for agent {agent.uuid}")

            # Validate additional_data if provided
            if additional_data:
                try:
                    json.dumps(additional_data)  # Test serialization
                except (TypeError, ValueError) as e:
                    logger.warning(f"[EventService] Non-serializable additional_data, skipping: {e}")
                    additional_data = None

            # Generate cache key for deduplication
            cache_key = self._generate_event_key(
                event_type, description, agent, component_type, component_uuid
            )

            # Check deduplication
            if dedupe and not force:
                try:
                    cached_value = cache.get(cache_key)
                    if cached_value:
                        logger.debug(f"[EventService] Duplicate event skipped: {event_type}")
                        self._cache_stats['hits'] += 1
                        return None
                    else:
                        self._cache_stats['misses'] += 1
                except Exception as e:
                    logger.error(f"[EventService] Cache check failed: {e}")

            # Create event in database
            try:
                # Truncate description if too long (uses configured length)
                safe_description = description[:self._max_description_length]
                if len(description) > self._max_description_length:
                    safe_description += "... (truncated)"

                event_data = {
                    'event_type': event_type,
                    'description': safe_description,
                    'component_type': component_type,
                    'created_at': timezone.now(),
                    'agent': agent
                }

                event = await Event.objects.acreate(**event_data)
                self._cache_stats['creates'] += 1
                
                logger.debug(f"[EventService] Event created: ID={event.id}, type={event_type}")
                
            except Exception as e:
                logger.error(f"[EventService] Database creation failed: {e}", exc_info=True)
                self._cache_stats['errors'] += 1
                return None

            # Set cache for deduplication with configured timeout
            if dedupe:
                try:
                    cache.set(cache_key, time.time(), timeout=dedupe_timeout)
                except Exception as e:
                    logger.warning(f"[EventService] Cache set failed: {e}")

            processing_time = time.time() - start_time
            # Use configured slow operation threshold
            if processing_time > SLOW_OPERATION_THRESHOLD:
                logger.warning(f"[EventService] Slow event creation: {processing_time:.2f}s")

            return event

        except Exception as e:
            processing_time = time.time() - start_time
            logger.error(f"[EventService] Failed to create event after {processing_time:.2f}s: {e}", exc_info=True)
            self._cache_stats['errors'] += 1
            return None

    async def get_recent_events(self, agent, limit: int = 10) -> List[Event]:
        """Fetch recent events for an agent with improved error handling."""
        try:
            if not agent:
                logger.error("[EventService] Agent is required")
                return []

            # Validate limit using configured maximum
            limit = max(1, min(limit, MAX_EVENTS_LIMIT))

            # Use async iterator with proper error handling
            events = []
            try:
                async for event in Event.objects.filter(agent=agent).order_by('-created_at')[:limit]:
                    events.append(event)
            except Exception as e:
                logger.error(f"[EventService] Database query failed: {e}")
                return []

            return events

        except Exception as e:
            logger.error(f"[EventService] Failed to fetch recent events: {e}", exc_info=True)
            return []

    async def get_events_by_type(self, agent, event_type: str, limit: int = 10) -> List[Event]:
        """Fetch events of a specific type for an agent with improved error handling."""
        try:
            if not agent:
                logger.error("[EventService] Agent is required")
                return []

            if not event_type:
                logger.error("[EventService] Event type is required")
                return []

            # Validate limit using configured maximum
            limit = max(1, min(limit, MAX_EVENTS_LIMIT))

            events = []
            try:
                async for event in Event.objects.filter(
                    agent=agent, 
                    event_type=event_type
                ).order_by('-created_at')[:limit]:
                    events.append(event)
            except Exception as e:
                logger.error(f"[EventService] Database query failed: {e}")
                return []

            return events

        except Exception as e:
            logger.error(f"[EventService] Failed to fetch {event_type} events: {e}", exc_info=True)
            return []

    async def get_agent_events(self, agent, limit: int = 10) -> List[Event]:
        """Fetch recent events specifically for an agent."""
        return await self.get_recent_events(agent=agent, limit=limit)

    async def get_agent_events_by_type(self, agent, event_type: str, limit: int = 10) -> List[Event]:
        """Fetch events of a specific type for an agent."""
        return await self.get_events_by_type(agent=agent, event_type=event_type, limit=limit)

    def get_service_stats(self) -> Dict[str, Any]:
        """Get service statistics for monitoring."""
        return {
            "cache_stats": self._cache_stats.copy(),
            "rate_limit_entries": len(self._rate_limit_cache),
            "max_description_length": self._max_description_length,
            "configured_cache_timeout": EVENT_CACHE_TIMEOUT,
            "configured_rate_limit_window": RATE_LIMIT_WINDOW,
            "configured_min_event_interval": MIN_EVENT_INTERVAL,
            "service": "EventService"
        }

    def reset_stats(self):
        """Reset service statistics."""
        self._cache_stats = {
            'hits': 0,
            'misses': 0,
            'creates': 0,
            'errors': 0
        }

    async def cleanup_old_events(self, agent, days_old: int = None, limit: int = None) -> int:
        """Clean up old events for an agent (maintenance method) with configurable defaults."""
        try:
            # Use configured defaults if not specified
            if days_old is None:
                days_old = DEFAULT_CLEANUP_DAYS
            if limit is None:
                limit = CLEANUP_BATCH_SIZE
                
            if not agent or days_old < 1:
                return 0

            cutoff_date = timezone.now() - timezone.timedelta(days=days_old)
            
            # Get count first
            old_events_count = await sync_to_async(
                Event.objects.filter(agent=agent, created_at__lt=cutoff_date).count
            )()
            
            if old_events_count > 0:
                # Delete in chunks to avoid database locks (using configured batch size)
                deleted_count = await sync_to_async(
                    lambda: Event.objects.filter(
                        agent=agent, 
                        created_at__lt=cutoff_date
                    )[:limit].delete()[0]
                )()
                
                logger.info(f"[EventService] Cleaned up {deleted_count} old events for agent {agent.uuid}")
                return deleted_count
            
            return 0

        except Exception as e:
            logger.error(f"[EventService] Failed to cleanup old events: {e}")
            return 0

    def clear_cache_for_agent(self, agent) -> int:
        """Clear all cached events for a specific agent."""
        try:
            if not agent:
                return 0

            # This is a simplified version - in production you might want to track keys
            cleared_count = 0
            
            # Clear rate limit cache for this agent
            agent_keys = [k for k in self._rate_limit_cache.keys() if str(agent.uuid) in k]
            for key in agent_keys:
                del self._rate_limit_cache[key]
                cleared_count += 1

            logger.info(f"[EventService] Cleared {cleared_count} cache entries for agent {agent.uuid}")
            return cleared_count

        except Exception as e:
            logger.error(f"[EventService] Failed to clear cache for agent: {e}")
            return 0

    def get_configuration(self) -> Dict[str, Any]:
        """Get current service configuration for debugging."""
        return {
            "EVENT_CACHE_TIMEOUT": EVENT_CACHE_TIMEOUT,
            "MAX_DESCRIPTION_LENGTH": MAX_DESCRIPTION_LENGTH,
            "RATE_LIMIT_WINDOW": RATE_LIMIT_WINDOW,
            "MIN_EVENT_INTERVAL": MIN_EVENT_INTERVAL,
            "SLOW_OPERATION_THRESHOLD": SLOW_OPERATION_THRESHOLD,
            "MAX_EVENTS_LIMIT": MAX_EVENTS_LIMIT,
            "CLEANUP_BATCH_SIZE": CLEANUP_BATCH_SIZE,
            "DEFAULT_CLEANUP_DAYS": DEFAULT_CLEANUP_DAYS,
        }
