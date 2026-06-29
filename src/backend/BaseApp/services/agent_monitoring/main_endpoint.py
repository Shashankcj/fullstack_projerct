# main_endpoint.py - Updated main endpoint using the services
from BaseApp.services.imports import JsonResponse, logging, json, sys
from .auth_service import AgentAuthService
from .event_service import EventService
from .message_proccessing import MessageProcessingService
from .response import ResponseService
 
logger = logging.getLogger("agent_monitoring")
 
async def agent_monitor(request):
    """Handle HTTPS POST requests for agent monitoring data."""
    if request.method != 'POST':
        logger.warning("Received non-POST request on agent_monitoring endpoint.")
        return await ResponseService.error_response("Only POST method is allowed", status_code=405)
    try:
        # Validate headers
        access_token, agent_uuid, error = AgentAuthService.validate_request_headers(request)
        if error:
            logger.warning(error)
            return await ResponseService.error_response(error, status_code=401)
 
        logger.info(f"Incoming request from agent UUID: {agent_uuid}")
 
        # Get and validate agent
        agent = await AgentAuthService.get_agent(agent_uuid=agent_uuid)
        if not agent:
            logger.warning(f"Agent not found: {agent_uuid}")
            return await ResponseService.error_response("Agent not found", status_code=404)
 
        # Validate token
        is_valid, token_error = await AgentAuthService.validate_agent_token(agent, access_token)
        if not is_valid:
            return await ResponseService.error_response(token_error, status_code=403)
 
        logger.info(f"Token validated successfully for agent: {agent_uuid}")
        await EventService.create_event(agent, 'HTTPS_CONNECTION', 'HTTPS connection established and Agent connected successfully',component_type='AGENT')
        
        # Validate content type
        if not AgentAuthService.is_valid_content_type(request):
            logger.warning("Invalid content type. Expected application/json.")
            return await ResponseService.error_response("Invalid content type - expected JSON", status_code=400)
 
        logger.info("Request passed all validations and is ready for processing.")
 
        data_size = len(request.body)
        logger.info(f"[MONITORING] Received HTTPS data size: {data_size / 1024:.2f} KB")
        data = json.loads(request.body)
       
        if isinstance(data, list):
            logger.debug(f"[MONITORING] Processing list of {len(data)} monitoring entries.")
            results = [await MessageProcessingService.process_single_message(agent, item) for item in data]
           
            
            return ResponseService.process_action_results(results)
                    
        elif isinstance(data, dict):
            result = await MessageProcessingService.process_single_message(agent, data)
            response_size = sys.getsizeof(json.dumps(result))
            logger.info(f"[MONITORING] Single result prepared ({response_size} bytes): {result}")
            return JsonResponse({'data': result})
        else:
            return await ResponseService.error_response("Invalid data format - expected JSON object or array", status_code=400)
        
    except json.JSONDecodeError:
        error_msg = "Invalid JSON data received"
        logger.error(f"[MONITORING][ERROR] {error_msg}", exc_info=True) 
 
        error_event = None
        if 'agent' in locals() and agent:
            error_event = await EventService.create_event(agent, event_type='Error', description=error_msg)
        return await ResponseService.error_response(error_msg, event_id=str(error_event.id) if error_event else None, status_code=400)
        
    except Exception as e:
        logger.error(f"[MONITORING][ERROR] Server error: {str(e)}", exc_info=True)
        if 'agent' in locals() and agent:
            await EventService.create_event(agent=None, event_type='Disconnect', description='HTTPS connection lost due to error')
        return await ResponseService.error_response(f"Server error: {str(e)}", status_code=500)