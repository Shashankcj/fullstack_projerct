# services/memory_monitoring_service.py
from BaseApp.services.imports import logging, Memory, MemoryMonitoring, convert_bytes_to_human_readable, is_valid_uuid
from asgiref.sync import async_to_sync,sync_to_async
from .event_service import EventService
from .alert_service import AlertService
 
logger = logging.getLogger("agent_monitoring")
 
class MemoryMonitoringService:
    """Service for processing memory monitoring data."""
    
    MEMORY_ALERT_THRESHOLD = 50 
    # #for testing alert change later
    # MEMORY_ALERT_THRESHOLD = 10

    
    @classmethod
    @sync_to_async
    def process_memory_data(cls, agent, data, checkpoint):
        """Update memory monitoring data for existing memory entries only."""
        if 'memory_monitoring' not in data:
            logger.warning("Memory monitoring data not provided.")
            return 'not provided'
 
        results = []
 
        try:
            memory_entries = data['memory_monitoring']
            if not isinstance(memory_entries, list):
                memory_entries = [memory_entries]
 
            for mem_entry in memory_entries:
                memory_uuid = mem_entry.get('memory_uuid')
                if not memory_uuid or not is_valid_uuid(memory_uuid):
                    logger.warning(f"Invalid or missing memory UUID: {memory_uuid}")
                    continue
 
                try:
                    memory = Memory.objects.get(uuid=memory_uuid)
                    memory_utilization = mem_entry.get('memory_utilization', '0%')
                except Memory.DoesNotExist:
                    logger.warning(f"Memory UUID does not exist in DB: {memory_uuid}")
                    continue
                
                # Convert memory values to GB
                for field in ['memory_used', 'memory_available', 'total_memory']:
                    mem_entry[field] = convert_bytes_to_human_readable(mem_entry.get(field, 0), "GB")
                    
                # Update memory_total_size if increment
                if memory.size != mem_entry['total_memory']:
                    old_value = memory.size
                    new_value = mem_entry['total_memory']
                    async_to_sync(EventService.create_event)(
                        agent=agent,
                        event_type="UPDATE",
                        description=f"Memory {memory.make} size updated from {old_value} to {new_value} on {agent.hostname}",
                        component_type="Memory {memory.make}" if memory.make else "Memory"  # Use make if available,
                    )
                    logger.info(f"Memory total size updated from {old_value} to {new_value}")
                    memory.update_total_memory(new_value)
 
                # Update or create monitoring record for the checkpoint
                MemoryMonitoring.objects.create(
                    uuid=memory_uuid,
                    memory=memory,
                    checkpoint=checkpoint,
                    memory_used=mem_entry.get('memory_used', 0),
                    memory_available=mem_entry.get('memory_available', 0),
                    total_memory=mem_entry.get('total_memory', 0),
                    memory_utilization=f"{memory_utilization}%"
                )
                logger.info(f"Memory monitoring data recorded successfully for UUID: {memory_uuid}")
                results.append({'uuid': memory_uuid, 'status': 'updated'})
                
                try:
                    utilization_value = float(memory_utilization)
                    
                    if utilization_value >= cls.MEMORY_ALERT_THRESHOLD:
                        logger.warning(f"[ALERT] High Memory Utilization ({utilization_value}%) on UUID={memory_uuid}")
                        AlertService.process_alert(
                            component_type=memory.make if memory.make else "Unknown Memory",
                            device_name=agent.hostname if agent.hostname else "Unknown Device",
                            component_uuid=memory_uuid,
                            utilization=utilization_value,
                            checkpoint=checkpoint
                        )
 
                except ValueError:
                    logger.error(f"Invalid memory utilization format: {memory_utilization}")
                except Exception as e:
                    logger.error(f"Failed to trigger memory alert for {memory_uuid}: {e}")
                
        except Exception as e:
            logger.exception(f"Error while updating memory monitoring data: {str(e)}")
            return {'error': str(e)}
        
        return results