import logging
from BaseApp.services.imports import json,status,Response
from BaseApp.models import Agent,Device
from BaseApp.serializer import DeviceSerializer

# Configure logger
logger = logging.getLogger("agent_monitoring")

def store_scanned_data(request):
    """
    Validate token and store/update device details with original OS UUIDs.
    Handles: Initial scan, Updates, and Reinstallation scenarios.
    
    Args:
        request: The HTTPS request object containing device data
        
    Returns:
        Response: HTTP response with status code and data/error message
    """
    logger.info("Processing device scan request")
    
    if request.method != 'POST':
        logger.warning(f"Method not allowed: {request.method}")
        return Response(
            {"error": f"Method {request.method} not allowed. Only POST is supported."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED
        )
    
    # Parse and validate request data
    data = _parse_request_data(request)
    if isinstance(data, Response):
        return data
    
    # Validate authentication
    auth_result = _authenticate_request(request)
    if isinstance(auth_result, Response):
        return auth_result
    
    agent = auth_result
    
    # Process device data (create or update)
    return _process_device_data(data, agent)


def _process_device_data(data, agent):
    """
    Process and store/update device data.
    Handles:
    1. Reinstallation: Return old data with new OS UUIDs
    2. Update: Update existing device data
    3. Initial scan: Create new device data
    """
    logger.debug(f"Processing device data for agent {agent.uuid}")
    
    # Validate device data
    raw_device_data = data.get("device")
    if not isinstance(raw_device_data, dict):
        logger.error("'device' field must be a JSON object")
        return Response(
            {"error": "'device' field must be a JSON object."},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Extract OS UUIDs (needed for all scenarios)
    # device_data, os_uuids = _extract_os_uuids(raw_device_data)
    
    # Check if agent is marked for reinstallation
    if getattr(agent, "is_reinstallation", False):
        return _handle_reinstallation(agent)
    
    # Check if device already exists for this agent
    try:
        existing_device = Device.objects.get(agent=agent)
    except Device.DoesNotExist:
        existing_device = None
    
    if existing_device:
        # Update existing device
        return _update_device(existing_device, raw_device_data, agent)
    else:
        # Create new device (initial scan)
        return _create_device(raw_device_data, agent)


def _handle_reinstallation(agent):
    """
    Handle reinstallation scenario - return old data with new OS UUIDs.
    
    Args:
        agent: The Agent object
        os_uuids: New OS UUIDs from current scan
        
    Returns:
        Response: Old device data with new OS UUIDs
    """
    logger.info(f"Agent {agent.uuid} is marked as reinstallation")
    
    old_device = getattr(agent, 'device', None)
    if not old_device:
        logger.warning(f"No existing device data found for reinstalled agent {agent.uuid}")
        return Response(
            {"error": "No existing device data found for reinstalled agent"},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Serialize existing device data
    old_device_serialized = DeviceSerializer(old_device).data
    
    # Inject new OS UUIDs into old device data
    # enhanced_data = _inject_os_uuids(old_device_serialized, os_uuids)
    
    logger.info(f"Reinstallation data returned for agent {agent.uuid}")
    
    # Clear reinstallation flag
    agent.is_reinstallation = False
    agent.save(update_fields=['is_reinstallation'])
    
    return Response({
        "agent": {
            "uuid": str(agent.uuid),
            "os": agent.os,
            "hostname": agent.hostname,
            "os_version": agent.os_version,
        },
        "device": old_device_serialized,
        "message": "Reinstallation detected - returned previous device data"
    }, status=status.HTTP_200_OK)


def _create_device(device_data, agent):
    """
    Create new device (initial scan).
    
    Args:
        device_data: Validated device data
        os_uuids: Original OS UUIDs
        agent: The Agent object
        
    Returns:
        Response: Created device data
    """
    
  
    device_serializer = DeviceSerializer(data=device_data)
    if not device_serializer.is_valid():
        logger.error(f"Device validation failed: {device_serializer.errors}")
        return Response(
            device_serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Save device and associate with agent
    try:
        device = device_serializer.save(agent=agent)
    except Exception as e:
        logger.error(f"SAVE ERROR: {str(e)}")
        raise
        logger.info(f"Device created successfully with ID: {device.uuid}")
        
    # Prepare response with original OS UUIDs
    # enhanced_device = _inject_os_uuids(device_serializer.data, os_uuids)
    
    response_data = {
        "agent": {
            "uuid": str(agent.uuid),
            "os": agent.os,
            "hostname": agent.hostname,
            "os_version": agent.os_version
        },
        "device": device_serializer.data,
        "message": "Device created successfully"
    }

    device_data_resp = device_serializer.data
    log_data = {
        "event": "device_created",
        "agent_uuid": str(agent.uuid),
        "agent_hostname": agent.hostname,
        "agent_os": agent.os,
        "device_uuid": str(device_data_resp.get('uuid')),
        "device_make": device_data_resp.get('make'),
        "device_model": device_data_resp.get('model'),
        "device_reboot_time":device_data_resp.get("reboot_time"),
        "message": "Device created successfully",
        "status_code": 201
    }
    logger.info(f"Device creation response: {json.dumps(log_data)}")
    return Response(response_data, status=status.HTTP_201_CREATED)



def _update_device(existing_device, device_data, agent):
    logger.info(f"Updating existing device {existing_device.uuid} for agent {agent.uuid}")

    #  Correct payload shape
    device_payload = device_data.get("device", device_data)
    logger.info(f"device payload keys: {list(device_payload.keys())}")
    logger.info(f"deviec {device_payload}")
    device_serializer = DeviceSerializer(
        existing_device,
        data=device_payload,
        context={"raw_payload": device_data},
        partial=True
    )
    
    if not device_serializer.is_valid():
        logger.error(f"Device update validation failed: {device_serializer.errors}")
        return Response(device_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    device = device_serializer.save()
    logger.info(f"Device {device.uuid} updated successfully")

    #  INJECT OS UUIDs into RESPONSE
    # enhanced_device = _inject_os_uuids(device_serializer.data, os_uuids)
    # logger.info(f"Injected OS UUIDs into response")

    response_data = {
        "agent": {
            "uuid": str(agent.uuid),
            "os": agent.os,
            "hostname": agent.hostname,
            "os_version": agent.os_version
        },
        "device": device_serializer.data,  # Has os_uuid everywhere!
        "message": "Device updated successfully"
    }

    logger.info(f"Device update response prepared for agent {agent.uuid}")
    return Response(response_data, status=status.HTTP_200_OK)

def _parse_request_data(request):
    """
    Parse and validate the request data format.
    
    Args:
        request: The HTTP request object
        
    Returns:
        dict or Response: Parsed data or error response
    """
    logger.debug("Parsing request data")
    
    if isinstance(request.data, str):
        try:
            data = json.loads(request.data)
            logger.debug("Successfully parsed JSON string data")
        except json.JSONDecodeError:
            logger.error("Invalid JSON format in request body")
            return Response(
                {"error": "Invalid JSON format in request body."},
                status=status.HTTP_400_BAD_REQUEST
            )
    elif isinstance(request.data, dict):
        data = request.data
        logger.debug("Request data already in dictionary format")
    else:
        logger.error(f"Unsupported request data format: {type(request.data)}")
        return Response(
            {"error": "Unsupported request data format."},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    return data


def _authenticate_request(request):
    """
    Authenticate the request by validating token and agent.
    
    Args: 
        request: The HTTP request object
        
    Returns:
        Agent or Response: Agent object if authenticated, otherwise error response
    """
    logger.debug("Authenticating request")
    
    # Validate access token
    access_token = _validate_authorization(request)
    if not access_token:
        logger.warning("Missing or invalid Authorization header")
        return Response(
            {"error": "Missing or invalid Authorization header"}, 
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    # Validate agent UUID
    agent_uuid = request.headers.get("uuid")
    if not agent_uuid:
        logger.warning("UUID header is missing")
        return Response(
            {"error": "UUID header is missing."}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Retrieve agent
    try:
        agent = Agent.objects.get(uuid=agent_uuid)
        logger.debug(f"Found agent with UUID: {agent_uuid}")
    except Agent.DoesNotExist:
        logger.error(f"Agent not found with UUID: {agent_uuid}")
        return Response(
            {"error": "Agent not found."}, 
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Validate token for the agent
    if not agent.validate_access_token(access_token):
        logger.warning(f"Invalid or expired token for agent: {agent_uuid}")
        return Response(
            {"error": "Invalid or expired token"}, 
            status=status.HTTP_403_FORBIDDEN
        )
    
    return agent


def _extract_os_uuids(data, prefix=""):
    logger.debug("Extracting OS UUIDs from device data")
    os_uuids = {}
    device_data = data.copy()
    
    # Extract device-level os_uuid
    if 'os_uuid' in device_data:
        os_uuids[f'{prefix}device'] = device_data.pop('os_uuid')
    
    # Extract component-level os_uuids
    for component in ['cpu', 'memory', 'storage', 'nic', 'gpu']:
        if component in device_data:
            os_uuids[component] = []
            for item in device_data[component]:
                os_uuids[component].append(item.pop('os_uuid', None))
                
                # Handle nested partitions in storage
                if component == 'storage' and 'partition' in item:
                    os_uuids['partition_os_uuids'] = os_uuids.get('partition_os_uuids', [])
                    part_uuids = [part.pop('os_uuid', None) for part in item['partition']]
                    os_uuids['partition_os_uuids'].append(part_uuids)
    return device_data, os_uuids


def _inject_os_uuids(serialized_data, os_uuids):
    logger.debug("Injecting OS UUIDs back into serialized data")
    enhanced_data = serialized_data.copy()
    
    # Device-level
    if os_uuids.get('device'):
        enhanced_data['os_uuid'] = os_uuids['device']
    
    # Component-level (cpu, memory, storage, nic, gpu)
    for component in ['cpu', 'memory', 'storage', 'nic', 'gpu']:
        if (component in enhanced_data and 
            component in os_uuids and 
            os_uuids[component]):
            
            items = enhanced_data[component]
            component_uuids = os_uuids[component]
            
            # Safe bounds
            enhanced_data[component] = [
                {**item, 'os_uuid': component_uuids[i] if i < len(component_uuids) else None}
                for i, item in enumerate(items)
            ]
            
            # Storage partitions
            if (component == 'storage' and 
                'partition_os_uuids' in os_uuids and 
                os_uuids['partition_os_uuids']):
                
                partition_uuids = os_uuids['partition_os_uuids']
                for j, storage in enumerate(enhanced_data[component]):
                    if ('partition' in storage and 
                        j < len(partition_uuids)):
                        
                        parts = storage['partition']
                        storage_part_uuids = partition_uuids[j]
                        
                        # Safe nested bounds
                        storage['partition'] = [
                            {**part, 'os_uuid': storage_part_uuids[k] if k < len(storage_part_uuids) else None}
                            for k, part in enumerate(parts)
                        ]
    
    logger.debug(f"Injected into {len(enhanced_data)} keys")
    return enhanced_data

def _validate_authorization(request):

    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        logger.warning("Invalid or missing Authorization header format")
        return None
    
    token = auth_header.split("Bearer ")[-1]
    logger.debug("Authorization token extracted")
    return token
