# services/monitoring_data_service.py
from BaseApp.services.imports import sync_to_async, logging
from asgiref.sync import async_to_sync
from .checkpoint_service import CheckpointService
from .memory_monitoring_service import MemoryMonitoringService
from .cpu_monitoring_service import CpuMonitoringService
from .disk_monitoring_service import DiskMonitoringService
from .network_monitoring_service import NetworkMonitoringService
 
logger = logging.getLogger("agent_monitoring")
 
class MonitoringDataService:
    """Main service for coordinating monitoring data processing."""
    
    @staticmethod
    async def process_monitoring_data(agent, data, event):
        """Process and store monitoring data in the database."""
        try:
            input_device_uuid = data.get("device_uuid", "").strip().lower()
            if not input_device_uuid:
                return False, "error: device_uuid not provided in the data"
            
            device = await sync_to_async(lambda: agent.device)()
            if not device or not device.uuid:
              return False, "error: agent has no associated device with a valid UUID"

            agent_device_uuid = str(device.uuid).lower()
            if input_device_uuid != agent_device_uuid:
                return False, f"error: device_uuid mismatch (expected: {agent_device_uuid}, received: {input_device_uuid})"

            logger.info(f"[MON_DATA] device_uuid validated for Agent UUID={agent.uuid}, Device UUID={agent_device_uuid}, Event ID={event.id}")
            # Only mark agent active AFTER data is processed
            await sync_to_async(agent.mark_active)()
            #  Await the async checkpoint service
            checkpoint = await CheckpointService.create_checkpoint(agent, event)

            logger.debug("[MON_DATA] Processing disk data...")
            disk_result = await DiskMonitoringService.process_disk_and_partition_monitoring(
                agent, data, checkpoint, input_device_uuid
            )
      
            logger.debug("[MON_DATA] Processing memory data...")
            memory_result =await MemoryMonitoringService.process_memory_data(agent, data, checkpoint)

            logger.debug("[MON_DATA] Processing CPU data...")
            cpu_result =await CpuMonitoringService.process_cpu_data(agent, data, checkpoint)

            logger.debug("[MON_DATA] Processing network data...")
            network_result =await NetworkMonitoringService.process_network_data(
                agent, data, checkpoint, input_device_uuid
            )

            # Now safe to use `.get()` because results are resolved
            response_data = {
                'disk': disk_result.get('actions', []) if disk_result else [],
                'port': network_result.get('actions', []) if network_result else [],
            }

            logger.info(
                f"[MON_DATA] Actions collected for Agent UUID={agent.uuid}: "
                f"Disk={len(response_data['disk'])}, "
                f"Port={len(response_data['port'])}"
            )
            logger.debug(f"[MON_DATA] Full action response: {response_data}")
            return True, response_data

        except Exception as e:
            logger.error(
                f"[MON_DATA][ERROR] Failed to process monitoring data for Agent UUID={agent.uuid}: {str(e)}",
                exc_info=True
            )
            return False, str(e)