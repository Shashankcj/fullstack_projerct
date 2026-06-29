# services/message_processing_service.py
from BaseApp.services.imports import JsonResponse, logging
from .event_service import EventService
from .monitoring_data_service import MonitoringDataService
from .alert_service import AlertService
 
logger = logging.getLogger("agent_monitoring")
 
class MessageProcessingService:
    """Service for processing individual messages and routing to appropriate handlers."""
    
    @staticmethod
    async def process_single_message(agent, data):
        """Process a single message dictionary."""
        try:
            if not isinstance(data, dict):
                raise ValueError("Expected a dictionary for single message processing")
            
            event_type = data.get('event_type', 'MON_DATA')
            event = await EventService.create_event(agent, event_type, data.get('description'),component_type='Agent')
 
            logger.info(f"[PROCESSING] Handling event type: {event_type} for Agent UUID={agent.uuid}")
 
            if event_type == 'MON_DATA':
                success, result = await MonitoringDataService.process_monitoring_data(agent, data, event)
                if success:
                    logger.debug(f"[PROCESSING] Monitoring result: {result}")
                    return {
                        'disk': result['disk'],
                        'port': result['port'],
                    }
                else:
                    logger.error(f"[PROCESSING][MON_DATA][ERROR] {result}")
                    return JsonResponse({'status': 'error', 'message': result})
 
            elif event_type == 'HEARTBEAT':
                await MessageProcessingService._process_heartbeat(agent, data, event)
                logger.info("[PROCESSING] Heartbeat processed")
                return {'heartbeat': 'processed'}
 
            elif event_type == 'ALERT':
                await MessageProcessingService._process_alert(agent, data, event)
                logger.info("[PROCESSING] Alert processed")
                return {'alert': 'processed'}
 
            else:
                logger.warning(f"[PROCESSING][UNKNOWN] Unknown event type: {event_type}")
                raise ValueError(f"Unknown event type: {event_type}")
 
        except Exception as e:
            logger.error(f"[PROCESSING][ERROR] Failed to process message: {str(e)}", exc_info=True)
            await EventService.create_event(agent, event_type='PROCESSING_ERROR', description=str(e))
            raise

    @staticmethod
    async def _process_heartbeat(agent, data, event):
        """Process heartbeat data."""
        AlertService.process_heartbeat(agent, data, event)
 
    @staticmethod
    async def _process_alert(agent, data, event):
        """Process alert data."""
        # Placeholder for alert processing logic
        pass