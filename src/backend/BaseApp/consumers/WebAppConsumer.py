import json
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from BaseApp.utils import JWTCookieAuthentication
from asgiref.sync import sync_to_async
import logging, http.cookies

logger = logging.getLogger('webapp_consumer')

class WebAppConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        try:
            headers = dict(self.scope['headers'])
            cookies = headers.get(b'cookie', b'').decode() if headers.get(b'cookie', b'') else None
            logger.info(f"Cookies from WSS: {cookies}")
            cookies = http.cookies.SimpleCookie(cookies)
            
            logger.info(f"JWT Cookie from WSS: {cookies}")
            if (not cookies) or (not cookies.get('jwt')):
                logger.warning("No JWT cookie found in WebSocket connection or mallformed cookies.")
                await self.close(code=4003)  # Close with code for invalid authentication
                return
            else:
                await sync_to_async(JWTCookieAuthentication().authenticate)(request=None,jwt_cookie=cookies.get('jwt').value)
                await self.accept()
                await self.channel_layer.group_add("webapp_broadcast", self.channel_name)
                logger.info("Frontend client connected.")

        except Exception as e:
            logger.error(f"Error during Webapp WebSocket connection: {e}")
            await self.close(code=4003)  # Close with code for invalid authentication

    async def disconnect(self, close_code):
        # Cleanup logic here
        logger.info("Frontend client disconnected.")

    async def receive_json(self, content, **kwargs):
        # Handle incoming messages from frontend
        logger.info(f"Received message from frontend: {content}")

        if content.get("type") == "ping":
            await self.send_json({"type": "pong"})

        elif content.get("type") in ["WATCH_AGENT", "WATCH_IP"]:
            group_name = f"webapp.{content.get('agent_uuid')}"
            logger.info(f"Adding connection to group: {group_name}")
            await self.channel_layer.group_add(group_name, self.channel_name)

        elif content.get("type") in ["UNWATCH_AGENT", "UNWATCH_IP"]:
            group_name = f"webapp.{content.get('agent_uuid')}"
            logger.info(f"Removing connection from group: {group_name}")
            await self.channel_layer.group_discard(group_name, self.channel_name)
        await self.send_json({"message": "Message received"})

    async def send_mon_data_to_frontend(self, event):
        data = event['data']
        await self.send_json({
            "type": "MON_DATA",
            "data": data
        })
        if "ip_monitoring" in data:
            logger.info(f"Sent monitoring data to frontend - {data}")
        else:
            logger.info(f"Sent monitoring data to frontend")

    async def flagged_entity_update(self, event):
        await self.send(text_data=json.dumps({
            "type": "flagged_entity_update",
            "data": event["data"]
        }))

    async def send_alert_to_frontend(self, event):
        print(f"CONSUMER RECEIVED: alert_update")
        print(f"Event data: {event}")
        await self.send(text_data=json.dumps({
            "type": "alert_created",
            "data": event['data']
        }))