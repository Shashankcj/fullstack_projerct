from BaseApp.services.imports import Response, status, socket, platform, AgentSerializer, logging
from BaseApp.services.webapp_services.license_management_service.license_validation import validate_license_request
from BaseApp.models import Agent
from oauth2_provider.models import Application
from django.utils.crypto import get_random_string
from BaseApp.models import AuditLog
from ipware import get_client_ip
logger = logging.getLogger("agent_monitoring")
API_KEY = "1234567890abcdef1234567890abcdef"
import uuid

def generate_device_uuid(device_fingerprint, system_uuid):
    base_string = f"{device_fingerprint}-{system_uuid}"
    return uuid.uuid5(uuid.NAMESPACE_DNS, base_string)

def create_agent(request):
    """
    Create or update agent with device fingerprint validation.
    """
    logger.info("Agent onboarding request received")
    logger.info(f"request:{request.data}")
    
    # Validate API key
    api_key = request.headers.get("X-API-KEY")
    if api_key != API_KEY:
        logger.warning("Invalid API key")
        return Response(
            {"error": "Invalid API key"}, 
            status=status.HTTP_403_FORBIDDEN
        )
    # Extract and validate incoming data
    # CHANGED: Removed MAC-based logic, now using device_fingerprint for identification
    device_fingerprint = request.data.get("device_fingerprint")
    incoming_hostname = request.data.get("hostname")
    system_uuid = request.data.get("system_uuid")
    # disk_serial = request.data.get("disk_serial")
    
    generated_uuid =generate_device_uuid(device_fingerprint,system_uuid)
    
    # CHANGED: Added validation for device_fingerprint instead of MAC
    if not device_fingerprint:
        logger.error("Missing device fingerprint")
        return Response(
            {"error": "Device fingerprint is required"}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if not incoming_hostname:
        logger.error(" Missing hostname")
        return Response(
            {"error": "Hostname is required"}, 
            status=status.HTTP_400_BAD_REQUEST
        )

    if not system_uuid :
        logger.error("Missing required hardware identifiers")
        return Response(
            {"error": "System UUID are required"}, 
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
         # CHANGED: Replaced MAC-based loops with direct fingerprint lookup
         # Search for existing agent by device fingerprint
        existing_agent = Agent.objects.filter(uuid=generated_uuid).first()
        if request:
            ip_address,routable=get_client_ip(request)
        if existing_agent:
            # ========================================
            # AGENT EXISTS - UPDATE
            # ========================================
            logger.info(f"Found existing agent: {existing_agent.hostname} (UUID: {existing_agent.uuid})")
            
            # Update agent
            serializer = AgentSerializer(
                existing_agent,
                data=request.data,
                partial=True
            )
            
            if not serializer.is_valid():
                logger.error(f"Update validation failed: {serializer.errors}")
                return Response({
                    'success': False,
                    'errors': serializer.errors,
                    'code': 'VALIDATION_ERROR'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            agent = serializer.save()
            
            # Mark as reinstallation
            # CHANGED: Removed MAC mismatch validation logic, now always set is_reinstallation = True for existing agents
            agent.is_reinstallation = True
            agent.save(update_fields=["is_reinstallation"])
           
            AuditLog.objects.create(
                user=request.user,
                action='AGENT_REINSTALL',
                model_name='Agent',
                description=f"Device {agent.hostname} reinstall completed successfully",
                ip=ip_address,
            )
            application = agent.oauth_application
                        
            new_secret = regenerate_client_secret(application)
            
            logger.info(f"🔄 Agent UPDATED: {agent.hostname} (UUID: {agent.uuid})")
            logger.info(f"reinstall onboard returning --- client_id {agent.oauth_application.client_id} client_secret: {new_secret}")
            return Response({
                "uuid": str(agent.uuid),
                "client_id": agent.oauth_application.client_id,
                "client_secret": new_secret,
                "master_key": agent.master_key,
                "hostname": agent.hostname,
                "message": "Successfully reinstalled the Agent with existing data"
            }, status=status.HTTP_200_OK)
        
        
        else:
            # ========================================
            # AGENT DOES NOT EXIST - CREATE NEW
            # ========================================
            
            # try:
            #     license_ok, license_msg = validate_license_request(resource="agent")
            # except Exception:
            #     logger.exception("License validation crashed")
            #     return Response({"error": "License validation error"}, status=500)

            # if not license_ok:
            #     return Response({"error": license_msg}, status=403)
            
            logger.info(f"No agent found with device fingerprint: {device_fingerprint}")
            logger.info(f"Creating new agent: {incoming_hostname}")
            
            serializer = AgentSerializer(data=request.data)
            
            if not serializer.is_valid():
                logger.error(f"Creation validation failed: {serializer.errors}")
                return Response({
                    'success': False,
                    'errors': serializer.errors,
                    'code': 'VALIDATION_ERROR'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            agent = serializer.save(uuid=generated_uuid)
            AuditLog.objects.create(
                user=request.user,  # or system user
                action='AGENT_INSTALLED',
                model_name='Agent',
                description=f"New Device {agent.hostname} install completed successfully.",
                ip=ip_address
            )
            logger.info(f"Agent CREATED: {agent.hostname} (UUID: {agent.uuid})")
            logger.info(f" first time onboard returning client_id {agent.oauth_application.client_id} client_secret: {agent.oauth_application.client_secret}")
            return Response({
                "uuid": str(agent.uuid),
                "client_id": agent.oauth_application.client_id,
                "client_secret": agent.oauth_application.client_secret,
                "master_key": agent.master_key,
                "hostname": agent.hostname,
            }, status=status.HTTP_201_CREATED)

    except Exception as e:
        logger.exception(f"Unexpected error: {str(e)}")
        AuditLog.objects.create(
            user=request.user,
            action='AGENT_INSTALL FAIL',
            model_name='Agent',
            description=f"Agent installation failed {str(e)} ",
            ip=ip_address,
        )
        return Response({
            "error": "Internal server error",
            "details": str(e),
            "code": "INTERNAL_ERROR"
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

def regenerate_client_secret(application):
        """Generate NEW client secret for existing application"""
        # Generate cryptographically secure secret
        new_secret = get_random_string(
            length=128,
            allowed_chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
        )
        
        application.client_secret = new_secret
        application.hash_client_secret = False  # Store PLAIN TEXT (critical!)
        application.save(update_fields=['client_secret', 'hash_client_secret'])
        
        logger.info(f"🔄 Regenerated secret for {application.name} (ID: {application.id}): {new_secret[:20]}...")
        return new_secret