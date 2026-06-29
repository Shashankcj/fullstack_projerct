# services/auth_service.py
from BaseApp.services.imports import sync_to_async, logging, Agent
 
logger = logging.getLogger("agent_monitoring")
 
class AgentAuthService:
    """Service for handling agent authentication and validation."""
    
    @staticmethod
    @sync_to_async
    def get_agent(agent_uuid):
        """Retrieve Agent instance by UUID."""
        try:
            agent = Agent.objects.get(uuid=agent_uuid)
            logger.info(f"Agent retrieved successfully: {agent_uuid}")
            return agent
        except Agent.DoesNotExist:
            logger.warning(f"Agent not found: {agent_uuid}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error while getting agent {agent_uuid}: {str(e)}", exc_info=True)
            return None
 
    @staticmethod
    def validate_request_headers(request):
        """Validate request headers for access token and agent UUID."""
        access_token = request.headers.get('access-token', '')
        agent_uuid = request.headers.get('uuid', '')
        
        if not access_token or not agent_uuid:
            logger.warning("Access token or agent UUID missing.")
            return None, None, "Missing or invalid Access Token or Agent UUID"
        
        return access_token, agent_uuid, None
 
    @staticmethod
    async def validate_agent_token(agent, access_token):
        """Validate agent access token."""
        if not agent:
            return False, "Agent not found"
        
        if not await sync_to_async(agent.validate_access_token)(access_token=access_token):
            logger.warning(f"Token validation failed for agent: {agent.uuid}")
            return False, "Invalid or expired token"
        
        logger.info(f"Token validated successfully for agent: {agent.uuid}")
        return True, None
 
    @staticmethod
    def is_valid_content_type(request, expected_type="application/json"):
        """
        Check if the request's content type matches the expected type.
 
        Args:
            request: The incoming HTTP request.
            expected_type (str): The expected MIME type (default is 'application/json').
        Returns:
            bool: True if content type matches, False otherwise.
        """
        return request.content_type == expected_type