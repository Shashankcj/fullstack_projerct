import json
import logging
import asyncio
from typing import Dict, Any, Optional
from channels.generic.websocket import AsyncWebsocketConsumer
 
logger = logging.getLogger("agent_monitoring")

class BaseConsumer(AsyncWebsocketConsumer):
    """
    Base WebSocket consumer providing logging, error handling, and
    event lifecycle hooks. Meant to be subclassed.
    """
 
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.user = None
        self.agent = None
        self.device = None
        self.agent_uuid = None
        self.group_name = None
        self.connected = False
 
    async def connect(self):
        """Subclasses should override this with authentication/logic"""
        await self.accept()
        self.connected = True
        logger.info(f"[BaseConsumer] WebSocket connected: {self.channel_name}")
 
    async def disconnect(self, close_code):
        """Handles cleanup and group removal."""
        self.connected = False
 
        if self.group_name:
            try:
                await self.channel_layer.group_discard(
                    self.group_name,
                    self.channel_name
                )
            except Exception as e:
                logger.warning(f"[BaseConsumer] Group discard failed: {e}")
 
        logger.info(f"[BaseConsumer] WebSocket disconnected with code {close_code}")
 
    async def receive(self, text_data: str):
        """Base receive handler. Subclasses should override `handle_message`."""
        try:
            data = json.loads(text_data)
            await self.handle_message(data)
        except json.JSONDecodeError:
            await self.send_error("Invalid JSON format")
        except Exception as e:
            logger.exception(f"[BaseConsumer] Error in receive: {e}")
            await self.send_error("Internal server error")
 
    async def handle_message(self, data: Dict[str, Any]):
        """To be implemented by subclasses."""
        raise NotImplementedError("handle_message must be implemented in subclass")
 
    async def send_json(self, data: Dict[str, Any]):
        """Safely send JSON-formatted data to client."""
        try:
            await self.send(text_data=json.dumps(data))
        except Exception as e:
            logger.error(f"[BaseConsumer] Failed to send JSON: {e}")
 
    async def send_error(self, message: str, code: Optional[str] = None):
        """Send a formatted error message to client."""
        payload = {"status": "error", "message": message}
        if code:
            payload["code"] = code
        await self.send_json(payload)
 
    async def send_success(self, data: Optional[Dict[str, Any]] = None):
        """Send a success message to the client."""
        payload = {"status": "success"}
        if data:
            payload.update(data)
        await self.send_json(payload)