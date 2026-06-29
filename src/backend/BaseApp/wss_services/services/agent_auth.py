import logging
import json
from typing import Tuple, Optional
from asgiref.sync import sync_to_async
from ...models import Agent
from .eventservice import EventService
 
logger = logging.getLogger("agent_monitoring")
 
# Constants for header keys
HEADER_ACCESS_TOKEN = "access-token"
HEADER_AGENT_UUID = "uuid"  


class AuthenticationMixin:
    """Authentication utilities for WebSocket consumers"""
 
    def _extract_connection_headers(self) -> Tuple[str, str]:
        """
        Extract access token and agent UUID from WebSocket headers.
        Returns:
            Tuple[str, str]: A tuple containing (access_token, agent_uuid)
        """
        access_token = ""
        agent_uuid = ""
 
        headers = self.scope.get("headers", [])
        try:
            for key, value in headers:
                key_decoded = key.decode().lower()
                if key_decoded == HEADER_ACCESS_TOKEN:
                    access_token = value.decode()
                elif key_decoded == HEADER_AGENT_UUID:
                    agent_uuid = value.decode()
        except Exception as e:
            logger.error(f"Failed to parse headers: {e}")
       
        logger.debug(f"Extracted headers: access_token={bool(access_token)}, agent_uuid={agent_uuid}")
        return access_token, agent_uuid
 
    async def _authenticate_connection(self, access_token: str, agent_uuid: str) -> bool:
        """
        Validate authentication credentials and establish connection.
        Returns:
            bool: True if authentication succeeded, False otherwise
        """
        if not access_token:
            await self.close_with_error("Missing Access Token")
            return False
 
        if not agent_uuid:
            await self.close_with_error("Missing Agent UUID")
            return False
 
        self.agent = await self.get_agent(agent_uuid=agent_uuid)
        if not self.agent:
            await self.close_with_error("Agent not found")
            return False
 
        # Optional: Uncomment if agents can be disabled
        # if not self.agent.is_active:
        #     await self.close_with_error("Agent is disabled")
        #     return False
 
        is_valid = await sync_to_async(self.agent.validate_access_token)(access_token=access_token)
        if not is_valid:
            logger.warning(f"Invalid token for agent {agent_uuid}")
            await self.close_with_error("Invalid or expired token")
            return False
 
        return True
 
    async def close_with_error(self, message: str) -> None:
        """
        Send an error message and close WebSocket connection.
        Args:
            message: Error message to send before closing
        """
        try:
            agent = getattr(self, 'agent', None)
 
            event_service = EventService()
            event = await event_service.create_event('CONNECTION_ERROR', message, agent=agent)
 
            error_response = {
                "status": "error",
                "message": message,
                "event_id": str(event.id if event else "0")
            }
 
            await self.send(json.dumps(error_response))
        except Exception as e:
            logger.error(f"Failed to send error message before closing: {e}")
        finally:
            await self.close()
 
    @sync_to_async
    def get_agent(self, agent_uuid: str) -> Optional[Agent]:
        """
        Retrieve Agent instance by UUID.
        Returns:
            Agent: The agent instance if found, None otherwise
        """
        try:
            return Agent.objects.get(uuid=agent_uuid)
        except Agent.DoesNotExist:
            return None
        except Exception as e:
            logger.error(f"Error getting agent: {str(e)}")
            return None