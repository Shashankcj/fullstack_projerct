import json
import asyncio
import logging
import sys
import time
from typing import Dict, List, Optional
from uuid import UUID
from collections import deque
from django.core.cache import cache
from django.utils import timezone
from django.conf import settings
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from channels.layers import get_channel_layer

from BaseApp.wss_services.base_consumer import BaseConsumer
from BaseApp.wss_services.services.agent_auth import AuthenticationMixin
from BaseApp.wss_services.services.mondata_handler import MonitoringHandler
from BaseApp.wss_services.services.eventservice import EventService
from ..models import Event

logger = logging.getLogger("agent_monitoring")

# Load configuration from Django settings
WEBSOCKET_CONFIG = getattr(settings, 'WEBSOCKET_CONFIG', {})

# Configuration constants from settings with fallback defaults
EVENT_COOLDOWN_SECONDS = WEBSOCKET_CONFIG.get('EVENT_COOLDOWN_SECONDS', 60)
MAX_QUEUE_SIZE = WEBSOCKET_CONFIG.get('MAX_QUEUE_SIZE', 1000)
BATCH_PROCESSING_SIZE = WEBSOCKET_CONFIG.get('BATCH_PROCESSING_SIZE', 5)
PROCESSING_TIMEOUT = WEBSOCKET_CONFIG.get('PROCESSING_TIMEOUT', 30.0)
QUEUE_GET_TIMEOUT = WEBSOCKET_CONFIG.get('QUEUE_GET_TIMEOUT', 5.0)
SLOW_PROCESSING_THRESHOLD = WEBSOCKET_CONFIG.get('SLOW_PROCESSING_THRESHOLD', 5.0)
COOLDOWN_CACHE_MAX_SIZE = WEBSOCKET_CONFIG.get('COOLDOWN_CACHE_MAX_SIZE', 100)
COOLDOWN_CACHE_CLEANUP_MULTIPLIER = WEBSOCKET_CONFIG.get('COOLDOWN_CACHE_CLEANUP_MULTIPLIER', 2)

class AgentMonitoringConsumer(BaseConsumer, AuthenticationMixin):
    """Websocket consumer with configurable settings"""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.agent = None
        self.device = None 
        self.agent_uuid = None
        self.event_service = EventService()
        self.monitoring_handler = MonitoringHandler(response_sender=self._send_response)
        
        # Connection state management
        self.is_connected = False
        self.disconnect_logged = False
        self.connection_established = False
        self._shutdown_event = asyncio.Event()
        
        # Message queue for async processing (now uses configured size)
        self.message_queue = asyncio.Queue(maxsize=MAX_QUEUE_SIZE)
        self.processing_task = None
        
        # Performance metrics
        self.messages_received = 0
        self.messages_processed = 0
        self.messages_dropped = 0
        
        # Event tracking flags
        self.connection_event_sent = False
        self.disconnect_event_sent = False
        self.mon_data_event_sent = False
        
        # In-memory cache for cooldowns
        self._cooldown_cache = {}
        
        # CHANNEL LAYER FOR FRONTEND BROADCASTING
        self.channel_layer = get_channel_layer()

    # ═══════════════════════════════════════════════════════════════
    # CONNECTION LIFECYCLE
    # ═══════════════════════════════════════════════════════════════
    
    def _is_connection_active(self) -> bool:
        """Check if the WebSocket connection is still active."""
        return self.is_connected and not self._shutdown_event.is_set()

    async def _mark_disconnected(self):
        """Mark the connection as disconnected and stop all processing."""
        self.is_connected = False
        self._shutdown_event.set()

    async def connect(self):
        """Establish WebSocket connection and start message processing worker."""
        try:
            # Extract and validate credentials
            access_token, agent_uuid = self._extract_connection_headers()
            self.agent_uuid = agent_uuid
            logger.info(f"[CONNECT] Agent UUID: {agent_uuid}")

            # Authenticate
            if not await self._authenticate_connection(access_token, agent_uuid):
                logger.warning(f"[AUTH] Failed for agent: {agent_uuid}")
                await self.close(code=4001)
                return

            # Load agent from database
            self.agent = await self.get_agent(agent_uuid)

            # Accept connection
            await self.accept()
            
            # Set connection state
            self.is_connected = True
            self.connection_established = True
            self._shutdown_event.clear()
            
            # Start background worker for processing messages
            self.processing_task = asyncio.create_task(self._message_processing_worker())
            
            # Create connection event
            if not self.connection_event_sent:
                device_name = getattr(self.agent, 'hostname', 'Unknown Device') if self.agent else 'Unknown Device'
                await self.event_service.create_event(
                    event_type='CONNECTION', 
                    description=f'Agent connected - Device: {device_name}',
                    component_type="Agent",
                    agent=self.agent
                )
                self.connection_event_sent = True

            logger.info(f"[CONNECT] Connection established for agent: {agent_uuid}")

        except Exception as e:
            logger.exception(f"[CONNECT] Connection error: {e}")
            await self._mark_disconnected()
            await self.close_with_error("WebSocket connection failed")

    async def disconnect(self, close_code: int):
        """Handle WebSocket disconnection with graceful shutdown."""
        if self.disconnect_logged:
            return
        self.disconnect_logged = True
        
        logger.info(f"[DISCONNECT] Code: {close_code}, Agent: {self.agent_uuid}")
        
        # Mark as disconnected immediately
        await self._mark_disconnected()
        
        # Cancel processing task gracefully
        if self.processing_task and not self.processing_task.done():
            self.processing_task.cancel()
            try:
                await asyncio.wait_for(self.processing_task, timeout=5.0)
            except (asyncio.TimeoutError, asyncio.CancelledError):
                logger.warning("[DISCONNECT] Processing task cancellation timeout")
        
        # Log metrics
        logger.info(
            f"[DISCONNECT] Stats - Received: {self.messages_received}, "
            f"Processed: {self.messages_processed}, "
            f"Dropped: {self.messages_dropped}, "
            f"Queue size: {self.message_queue.qsize()}"
        )
        
        # Create disconnect event 
        try:
            if not self.agent and self.agent_uuid:
                self.agent = await self.get_agent(self.agent_uuid)

            if self.agent and not self.disconnect_event_sent:
                device_name = getattr(self.agent, 'hostname', 'Unknown Device') if self.agent else 'Unknown Device'
                await self.event_service.create_event(
                    event_type='DISCONNECT',
                    description=f'Agent disconnected - Device: {device_name}',
                    component_type="Agent",
                    agent=self.agent,
                    force=True,
                    dedupe=False
                )
                self.disconnect_event_sent = True
        except Exception as e:
            logger.error(f"[DISCONNECT] Event creation failed: {e}")
        finally:
            # Reset flags for potential reconnection
            self.connection_event_sent = False
            self.disconnect_event_sent = False
            self.mon_data_event_sent = False
            await super().disconnect(close_code)

    # ═══════════════════════════════════════════════════════════════
    # MESSAGE RECEPTION (NON-BLOCKING)
    # ═══════════════════════════════════════════════════════════════

    async def receive(self, text_data: str):
        """
        Receive message and queue it for async processing.
        Non-blocking - returns immediately after queuing.
        """
        if not self._is_connection_active():
            logger.warning("[RECEIVE] Message received on disconnected WebSocket")
            return

        self.messages_received += 1

        # logger.info(text_data)
        
        try:
            # Try to queue the message without blocking
            self.message_queue.put_nowait(text_data)
            logger.debug(f"[RECEIVE] Message queued (size: {sys.getsizeof(text_data)} bytes, queue: {self.message_queue.qsize()})")
            
        except asyncio.QueueFull:
            # Queue is full - log and drop message (uses configured MAX_QUEUE_SIZE)
            self.messages_dropped += 1
            logger.error(
                f"[RECEIVE] Queue full ({MAX_QUEUE_SIZE}) - Message dropped! "
                f"Dropped: {self.messages_dropped}, Agent: {self.agent_uuid}"
            )
            
            # Send error response to agent
            try:
                await self.send_json({
                    'status': 'error',
                    'message': 'Server queue full - message dropped',
                    'queue_size': MAX_QUEUE_SIZE
                })
            except Exception as e:
                logger.error(f"[RECEIVE] Failed to send queue full error: {e}")

    # ═══════════════════════════════════════════════════════════════
    # MESSAGE PROCESSING WORKER (BACKGROUND TASK)
    # ═══════════════════════════════════════════════════════════════

    async def _message_processing_worker(self):
        """
        Background worker that processes messages from the queue.
        Runs continuously until connection is closed.
        """
        logger.info(f"[WORKER] Started for agent: {self.agent_uuid}")
        
        try:
            while self._is_connection_active():
                try:
                    # Get message from queue with configured timeout
                    text_data = await asyncio.wait_for(
                        self.message_queue.get(),
                        timeout=QUEUE_GET_TIMEOUT
                    )
                    
                    # Process message with configured timeout
                    try:
                        await asyncio.wait_for(
                            self._process_and_respond(text_data, self.agent),
                            timeout=PROCESSING_TIMEOUT
                        )
                        self.messages_processed += 1
                        
                    except asyncio.TimeoutError:
                        logger.error(f"[WORKER] Processing timeout for agent: {self.agent_uuid}")
                        if self._is_connection_active():
                            await self.send_json({
                                'status': 'error',
                                'message': 'Processing timeout'
                            })
                    
                except asyncio.TimeoutError:
                    # Queue.get() timeout - just check if still connected and continue
                    continue
                    
                except asyncio.CancelledError:
                    logger.info(f"[WORKER] Cancelled for agent: {self.agent_uuid}")
                    break
                    
                except Exception as e:
                    logger.exception(f"[WORKER] Unexpected error: {e}")
                    # Continue processing other messages
                    
        finally:
            logger.info(f"[WORKER] Stopped for agent: {self.agent_uuid}")

    # ═══════════════════════════════════════════════════════════════
    # MESSAGE PROCESSING LOGIC
    # ═══════════════════════════════════════════════════════════════

    async def _process_and_respond(self, text_data: str, agent):
        """Process a single message and send response."""
        start = time.time()
        
        try:
            if not self._is_connection_active():
                return

            # Mark agent as active (async database call)
            await self._mark_agent_active(agent)
            
            # Process the message
            response = await self._process_incoming_message(text_data, agent)
            
            # Send response if still connected
            if self._is_connection_active():
                await self._send_response(response)
                
        except Exception as e:
            logger.exception(f"[PROCESS] Error: {e}")
            if self._is_connection_active():
                await self.send_json({
                    'status': 'error',
                    'message': 'Internal server error'
                })
        finally:
            duration = time.time() - start
            # Use configured slow processing threshold
            if duration > SLOW_PROCESSING_THRESHOLD:
                logger.warning(f"[PROCESS] Slow processing: {duration:.2f}s for agent: {self.agent_uuid}")

    async def _process_incoming_message(self, text_data: str, agent) -> dict:
        """Parse and route message to appropriate handler."""
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return await self._handle_invalid_json(text_data)

        if isinstance(data, list):
            return await self._process_batch(data)
        elif isinstance(data, dict):
            return await self._process_single(data)
        else:
            return {'status': 'error', 'message': 'Invalid data format'}

    async def _process_batch(self, data: List[Dict]) -> dict:
        """
        Process batch of messages with controlled concurrency.
        Uses semaphore to limit parallel processing and prevent database overload.
        """
        if not data:
            return {'status': 'error', 'message': 'Empty batch'}
        
        first = data[0]
        event_type = first.get('event_type', 'MON_DATA')
        base_description = first.get('description', 'Batch monitoring data')
        
        if event_type == 'MON_DATA':
            device_name = getattr(self.agent, 'hostname', 'Unknown Device') if self.agent else 'Unknown Device'
            description = f"{base_description} - Device: {device_name}"
        else:
            description = base_description
        
        # Create event with cooldown check
        event = await self._create_event_with_cooldown(event_type, description)
        
        # Process items with configured concurrency limit
        semaphore = asyncio.Semaphore(BATCH_PROCESSING_SIZE)
        
        async def process_with_limit(item, index):
            async with semaphore:
                if not self._is_connection_active():
                    return {'status': 'error', 'message': 'Connection closed', 'index': index}
                return await self._process_event_payload(item, event)
        
        # Process all items concurrently but with limited parallelism
        start = time.time()
        results = await asyncio.gather(
            *[process_with_limit(item, i) for i, item in enumerate(data)],
            return_exceptions=True
        )
        duration = time.time() - start
        
        # Handle exceptions in results
        processed_results = []
        error_count = 0
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                error_count += 1
                processed_results.append({
                    'status': 'error',
                    'message': str(result),
                    'index': i
                })
            else:
                processed_results.append(result)
                if result.get('status') == 'error':
                    error_count += 1
        
        return {
            'status': 'success' if error_count == 0 else 'partial',
            'processed': len(processed_results),
            'errors': error_count,
            'processing_time': round(duration, 2),
            'processing_mode': f'concurrent_limited_{BATCH_PROCESSING_SIZE}',
            'connection_active': self._is_connection_active()
        }

    async def _process_single(self, data: Dict) -> dict:
        """Process a single message."""
        if not self._is_connection_active():
            return {'status': 'error', 'message': 'Connection closed'}
            
        event_type = data.get('event_type', 'MON_DATA')
        base_description = data.get('description', 'Monitoring update')
        
        if event_type == 'MON_DATA':
            device_name = getattr(self.agent, 'hostname', 'Unknown Device') if self.agent else 'Unknown Device'
            description = f"{base_description} - Device: {device_name}"
        else:
            description = base_description
        
        event = await self._create_event_with_cooldown(event_type, description)
        return await self._process_event_payload(data, event)

    async def _process_event_payload(self, data: Dict, event) -> dict:
        """Process specific event type with frontend broadcasting (same as old logic)."""
        if not self._is_connection_active():
            return {'status': 'error', 'message': 'Connection closed'}
            
        event_type = data.get("event_type", "MON_DATA")
        
        try:
            match event_type:
                case 'MON_DATA':
                    success, result = await self.monitoring_handler.process_monitoring_data(
                        data, event, self.agent
                    )
                    if not success:
                        raise Exception(f"Monitoring failed: {result}")
                    
                    # BROADCAST TO FRONTEND 
                    if self._is_connection_active() and self.channel_layer:
                        await self._broadcast_to_frontend(data, result, event_type)
                    
                    return {'status': 'success', 'type': event_type}

                case 'HEARTBEAT':
                    await self.monitoring_handler.process_heartbeat(data, event)
                    
                    # BROADCAST HEARTBEAT
                    if self._is_connection_active() and self.channel_layer:
                        await self._broadcast_to_frontend(data, {"status": "heartbeat"}, event_type)
                    
                    return {'status': 'success', 'type': event_type}

                case 'ALERT':
                    await self.monitoring_handler.process_alert(data, event)
                    
                    # BROADCAST ALERT
                    if self._is_connection_active() and self.channel_layer:
                        await self._broadcast_to_frontend(data, {"status": "alert"}, event_type)
                    
                    return {'status': 'success', 'type': event_type}

                case _:
                    return {'status': 'error', 'message': f'Unknown event_type: {event_type}'}

        except Exception as e:
            logger.error(f"[EVENT] Processing error for {event_type}: {e}")
            
            # Create error event
            try:
                device_name = getattr(self.agent, 'hostname', 'Unknown Device') if self.agent else 'Unknown Device'
                await self.event_service.create_event(
                    event_type='ERROR', 
                    description=f'{str(e)} - Device: {device_name}',
                    agent=self.agent
                )
            except Exception as inner:
                logger.error(f"[EVENT] Failed to create error event: {inner}")
                
            return {'status': 'error', 'message': str(e)}

    # ═══════════════════════════════════════════════════════════════
    # FRONTEND BROADCASTING
    # ═══════════════════════════════════════════════════════════════

    async def _broadcast_to_frontend(self, raw_data: Dict, processed_result, event_type: str):
        """
        Broadcast to frontend using the same logic as old working consumer.
        This is what made your old consumer work with frontend updates.
        """
        try:
            device_name = getattr(self.agent, 'hostname', 'Unknown Device') if self.agent else 'Unknown Device'
            
            if event_type == 'MON_DATA':
                # Send monitoring_realtime_update
                await self.channel_layer.group_send(
                    "monitoring_all",
                    {
                        "type": "monitoring_realtime_update",
                        "data": {
                            "agent_uuid": str(self.agent.uuid),
                            "hostname": device_name,
                            "raw_data": raw_data,
                            "processed_result": processed_result,
                            "timestamp": timezone.now().isoformat(),
                            "event_type": event_type
                        }
                    }
                )
            else:
                # Send agent_update for other event types
                await self.channel_layer.group_send(
                    "monitoring_all",
                    {
                        "type": "agent_update",
                        "data": {
                            "agent_uuid": str(self.agent.uuid),
                            "hostname": device_name,
                            "status": event_type.lower(),
                            "data": raw_data,
                            "result": processed_result,
                            "timestamp": timezone.now().isoformat(),
                            "event_type": event_type
                        }
                    }
                )
            
            logger.debug(f"[BROADCAST] {event_type} sent to frontend for {device_name}")
            
        except Exception as e:
            logger.error(f"[BROADCAST] Failed to broadcast {event_type}: {e}")

    # ═══════════════════════════════════════════════════════════════
    # EVENT CREATION WITH COOLDOWN 
    # ═══════════════════════════════════════════════════════════════

    async def _create_event_with_cooldown(self, event_type: str, description: str):
        """
        Create event with cooldown logic to prevent spam.
        Uses in-memory cache for faster lookups.
        """
        if not self.agent or not self._is_connection_active():
            return None

        device_name = getattr(self.agent, 'hostname', 'Unknown Device') if self.agent else 'Unknown Device'

        # Handle MON_DATA event (once per session)
        if event_type == 'MON_DATA':
            if self.mon_data_event_sent:
                return None
            try:
                event = await self.event_service.create_event(
                    event_type=event_type,
                    description=description,
                    agent=self.agent,
                    component_type="Agent",
                    component_uuid=str(self.agent.uuid),
                    dedupe=True
                )
                if event:
                    self.mon_data_event_sent = True
                return event
            except Exception as e:
                logger.error(f"[COOLDOWN] Failed to create MON_DATA event: {e}")
                return None

        # Handle CONNECTION event (once per session)
        if event_type == 'CONNECTION':
            if self.connection_event_sent:
                return None
            if 'Device:' not in description:
                description = f"{description} - Device: {device_name}"
            event = await self.event_service.create_event(
                event_type='CONNECTION', 
                description=description,
                agent=self.agent,
                component_type="Agent",
                dedupe=True
            )
            if event:
                self.connection_event_sent = True
            return event

        # Handle DISCONNECT event (once per session)
        if event_type == 'DISCONNECT':
            if self.disconnect_event_sent:
                return None
            if 'Device:' not in description:
                description = f"{description} - Device: {device_name}"
            event = await self.event_service.create_event(
                event_type='DISCONNECT', 
                description=description,
                agent=self.agent,
                component_type="Agent",
                dedupe=True
            )
            if event:
                self.disconnect_event_sent = True
            return event

        # Other event types with time-based cooldown (uses configured cooldown)
        cache_key = f"{event_type}:{self.agent.uuid}"
        now_ts = time.time()
        
        # Check in-memory cooldown cache first (faster than Redis/Django cache)
        last = self._cooldown_cache.get(cache_key)
        if last and (now_ts - last) < EVENT_COOLDOWN_SECONDS:
            logger.debug(f"[COOLDOWN] Skipping {event_type} (elapsed: {now_ts - last:.2f}s)")
            return None

        if 'Device:' not in description:
            description = f"{description} - Device: {device_name}"

        event = await self.event_service.create_event(
            event_type=event_type,
            description=description,
            agent=self.agent,
            component_type="Agent" if event_type not in ['INFO', 'ALERT', 'ERROR'] else None
        )
        
        if event:
            self._cooldown_cache[cache_key] = now_ts
            # Clean old entries to prevent memory leak (uses configured limits)
            if len(self._cooldown_cache) > COOLDOWN_CACHE_MAX_SIZE:
                cutoff = now_ts - EVENT_COOLDOWN_SECONDS * COOLDOWN_CACHE_CLEANUP_MULTIPLIER
                self._cooldown_cache = {
                    k: v for k, v in self._cooldown_cache.items() 
                    if v > cutoff
                }
        
        return event

    # ═══════════════════════════════════════════════════════════════
    # HELPER METHODS 
    # ═══════════════════════════════════════════════════════════════

    async def _handle_invalid_json(self, text_data: str) -> dict:
        """Handle invalid JSON data."""
        if not self._is_connection_active():
            return {'status': 'error', 'message': 'Connection closed'}
            
        error_msg = "Invalid JSON received"
        device_name = getattr(self.agent, 'hostname', 'Unknown Device') if self.agent else 'Unknown Device'
        
        await self.event_service.create_event(
            event_type="ERROR",
            description=f"{error_msg} - Device: {device_name}",
            agent=self.agent
        )
        
        return {'status': 'error', 'message': error_msg}

    async def _send_response(self, response: Dict) -> None:
        """Send JSON response to agent."""
        try:
            if not self._is_connection_active():
                return
            await self.send_json(response)
        except Exception as e:
            logger.error(f"[RESPONSE] Send error: {e}")
            await self._mark_disconnected()

    @database_sync_to_async
    def _mark_agent_active(self, agent):
        """Mark agent as active in database (async wrapper)."""
        if agent:
            agent.mark_active()

# ═══════════════════════════════════════════════════════════════
# UTILITY FUNCTIONS 
# ═══════════════════════════════════════════════════════════════

def convert_uuids(obj):
    """Recursively convert UUID objects to strings for JSON serialization."""
    if isinstance(obj, UUID):
        return str(obj)
    elif isinstance(obj, dict):
        return {
            (str(k) if isinstance(k, UUID) else k): convert_uuids(v)
            for k, v in obj.items()
        }
    elif isinstance(obj, list):
        return [convert_uuids(item) for item in obj]
    elif isinstance(obj, tuple):
        return tuple(convert_uuids(item) for item in obj)
    return obj

# ═══════════════════════════════════════════════════════════════
# FRONTEND WEBSOCKET CONSUMER (EXACT SAME AS OLD WORKING CODE)
# ═══════════════════════════════════════════════════════════════

class FrontendMonitoringConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for frontend real-time updates - same as old working code."""
    
    async def connect(self):
        self.group_name = "monitoring_all"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        """Handle incoming messages from frontend."""
        data = json.loads(text_data)
        # Handle incoming messages if needed

    async def monitoring_realtime_update(self, event):
        """Send monitoring updates to frontend - exact same as old working code."""
        await self.send(text_data=json.dumps({
            "type": "monitoring_realtime_update",
            "data": event.get("data")
        }))

    async def agent_update(self, event):
        """Handle agent updates - exact same as old working code."""
        safe_event = convert_uuids(event)
        agent_data = safe_event.get("data")
        await self.send(text_data=json.dumps({
            "type": "agent_update",
            "agent": agent_data
        }))

    async def port_flag_update(self, event):
        await self.send(text_data=json.dumps({
            "type": "port_flag_update",
            "data": event["data"]
        }))

    async def alert_created(self, event):
        print(f"CONSUMER RECEIVED: alert_update")
        print(f"Event data: {event}")
        await self.send(text_data=json.dumps({
            "type": "alert_created",
            "data": event['data']
        }))    

   