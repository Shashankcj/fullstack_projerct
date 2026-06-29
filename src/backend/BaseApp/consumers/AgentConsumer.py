from channels.generic.websocket import AsyncJsonWebsocketConsumer
from asgiref.sync import sync_to_async
from channels.db import database_sync_to_async
from BaseApp.models.models import Agent
from BaseApp.Services.AgentMonitoring.agentMonitoringHandler import AgentMonitoringHandler
import logging, datetime, asyncio
from django.utils import timezone
logger = logging.getLogger('agent_consumer')

class AgentConsumer(AsyncJsonWebsocketConsumer):
    @database_sync_to_async
    def update_agent_last_seen(self):
        self.agent.last_seen = timezone.now()
        self.agent.save(update_fields=['last_seen'])
    @database_sync_to_async  
    def mark_agent_active(self):
        self.agent.mark_active()
        
    async def connect(self):
        # Extract access token and agent UUID from headers
        headers = dict(self.scope['headers'])
        access_token = headers.get(b'access-token', b'').decode()
        agent_uuid = headers.get(b'uuid', b'').decode()

        # Check if access token and agent UUID are provided
        if not access_token or not agent_uuid:
            await self.close(code=4001)  # Close with code for missing credentials
            return
        
        # Validate agent UUID and Access Token
        try:
            self.agent = await database_sync_to_async(Agent.objects.get)(uuid=agent_uuid)
        except Agent.DoesNotExist:
            await self.close(code=4003)  # Close with code for invalid agent
            return
        
        is_valid, expires = await sync_to_async(self.agent.validate_access_token)(access_token=access_token)
        
        if not is_valid:
            logger.warning(f"Invalid token for agent {agent_uuid}")
            await self.close(code=4002)  # Close with code for invalid token
            return
        
        # Accept the connection
        await self.accept()
        await self.mark_agent_active()
        # Add the connection to a group based on agent UUID
        self.group_name = f"agent.{agent_uuid}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        
        await sync_to_async(self.agent.create_event)("CONNECTION", f"Agent connected and WebSocket established. {self.agent.hostname} - {agent_uuid}","Agent")
       
        # Schedule disconnection on token expiry
        now = datetime.datetime.now(datetime.timezone.utc)
        expiry_dt = expires.replace(tzinfo=datetime.timezone.utc)
        sleep_duration_seconds = (expiry_dt - now).total_seconds()
        asyncio.create_task(self.disconnect_on_expiry(sleep_duration_seconds))

    async def disconnect(self, close_code):
        # Cleanup logic here
        await sync_to_async(self.agent.create_event)("DISCONNECT", f"Agent disconnected and WebSocket terminated. {self.agent.hostname} - {self.agent.uuid}","Agent")

    async def receive_json(self, content, **kwargs):
        await self.update_agent_last_seen() 
        if content.get("event_type") == "MON_DATA":
            logger.info(f"Received monitoring data from agent {self.agent.uuid}")
            await sync_to_async(AgentMonitoringHandler.process_monitoring_data)(agent_uuid=self.agent.uuid, data=content.get("data", []))
        
        await self.send_json({"message": "Message received"})

    async def disconnect_on_expiry(self, sleep_duration_seconds):
        await asyncio.sleep(sleep_duration_seconds)
        logger.info(f"Token expired for agent {self.agent.uuid}. Forcefully disconnecting.")
        # await self.agent.create_event("MON_DATA", f"Disconnecting WebSocket Connection - Token Expiry. {self.agent.hostname} - {self.agent.uuid}")
        await self.close(code=4002) # 4002 = Token Expired

        