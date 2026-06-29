# services/alert_service.py
from BaseApp.services.imports import logging
from .trigger_alert_operationteam import trigger_utilization_alert
 
logger = logging.getLogger("agent_monitoring")
 
class AlertService:
    """Service for managing alerts and notifications."""
    
    @staticmethod
    def process_alert(component_type,  component_uuid, utilization, checkpoint,device_name):
        """
        Process alert: trigger utilization alert.
 
        Args:
            component_type: "cpu", "memory", "disk", or "port"
            agent: The agent object or UUID
            component_uuid: UUID of the component
            utilization: Utilization percentage (float)
            checkpoint: MonitoringCheckpoint instance
        """
        
        try:
            # Trigger the alert
            trigger_utilization_alert(
                device_name=device_name,
                component_type=component_type,
                component_uuid=component_uuid,
                utilization=utilization,
                checkpoint=checkpoint
            )
            logger.info(f"Alert triggered for {component_type.upper()} on {component_uuid}")
        except Exception as e:
            logger.error(f"Error processing alert for {component_type.upper()}: {e}")
 
    @staticmethod
    def process_heartbeat(agent, data, event):
        """Process heartbeat data."""
        # Placeholder for heartbeat processing logic
        pass