from BaseApp.services.imports import logging
logger=logging.getLogger('agent_monitoring')

def _handle_unknown_entities(unknowns):
    
    """
    Send response only once per unique unknown entity (per connection).
    
    Handles different entity types:
    - disks
    - partitions
    - network ports
    - memory
    - graphics cards
    
    Args:
        unknowns: List of dictionaries containing unknown entity data
        
    Returns:
        list: List of action dictionaries to be sent to client
    """
    logger.info(f"Processing {len(unknowns)} unknown entities")
    
    # Track reported unknowns to avoid duplicates
    reported_unknowns = set()
    actions_to_send = []
    
    for item in unknowns:
        if not isinstance(item, dict) or 'type' not in item or 'device_uuid' not in item:
            logger.warning(f"Skipping invalid unknown entity: {item}")
            continue
            
        entity_type = item['type']
        device_uuid = item['device_uuid']
        key = f"{entity_type}:{device_uuid}"
        
        # Skip if already reported
        if key in reported_unknowns:
            logger.debug(f"Skipping duplicate unknown entity: {key}")
            continue
            
        logger.debug(f"Processing unknown entity: {entity_type} with UUID: {device_uuid}")
        
        # Create appropriate action based on entity type
        action = _create_action_for_entity(entity_type, device_uuid, item)
        
        if action:
            reported_unknowns.add(key)
            actions_to_send.append(action)
            logger.info(f"Added action for unknown {entity_type} with DEVICE_UUID: {device_uuid}")
        else:
            logger.warning(f"Unsupported entity type: {entity_type}")
    
    logger.info(f"Returning {len(actions_to_send)} actions for unknown entities")
    print(f"Returning {len(actions_to_send)} actions for unknown entities")
    print(f"Actions to send: {actions_to_send}")
    # Return list of actions to send
    return actions_to_send


def _create_action_for_entity(entity_type, device_uuid, item):
    """
    Create appropriate action dictionary based on entity type.
    
    Args:
        entity_type: Type of entity (disk, port, memory, gpu)
        device_uuid: UUID of the device
        item: Original item dictionary with additional data
        
    Returns:
        dict: Action dictionary or None if entity type is not supported
    """
    action = None
    
    if entity_type == 'disk':
        action = {
            'action': 'disk',
            'uuid': device_uuid
        }
    elif entity_type == 'partition':
        action = {
            'action': 'disk',
            'uuid': device_uuid,
        }   
    elif entity_type == 'port':
        action = {
            'action': 'nic',
            'uuid': device_uuid,
        }

            
    elif entity_type == 'memory':
        action = {
            'action': 'memory',
            'uuid': device_uuid,
        }
        
    elif entity_type == 'gpu':
        action = {
            'action': 'gpu',
            'uuid': device_uuid,
        }
        
    return action



