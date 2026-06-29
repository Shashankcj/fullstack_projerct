# services/cpu_monitoring_service.py
from BaseApp.services.imports import logging, CPU, CpuMonitoring, json
from .alert_service import AlertService
from asgiref.sync import async_to_sync, sync_to_async
 
# logger = logging.getLogger("agent_monitoring")
logger=logging.getLogger("create_event_logs_check")
 
class CpuMonitoringService:
    """Service for processing CPU monitoring data."""
    
    CPU_ALERT_THRESHOLD = 10
    
    @classmethod
    @sync_to_async
    def process_cpu_data(cls, agent, data, checkpoint):
        """Process CPU monitoring data."""
        if 'cpu_monitoring' not in data:
            logger.warning("CPU monitoring data not provided.")
            return 'not provided'
          
        try:
            cpu_data = data['cpu_monitoring'][0] if isinstance(data['cpu_monitoring'], list) else data['cpu_monitoring']
            cpu_uuid = cpu_data.get('cpu_uuid')
            cpu_exists = CPU.objects.filter(uuid=cpu_uuid).exists()
            if not cpu_exists:
                logger.warning(f"CPU UUID not found in database: {cpu_uuid}")
                return f'error: UUID {cpu_uuid} does not exist'
            
            cpu_util_raw = cpu_data.get('cpu_utilization', '0%')
            
            cpu_obj =CPU.objects.get(uuid=cpu_uuid)
           
            CpuMonitoring.objects.create(
                uuid=cpu_uuid,
                checkpoint=checkpoint,
                cpu=cpu_obj,
                p_cores_perc=json.dumps(
                    cpu_data['p_cores_perc'] if isinstance(cpu_data.get('p_cores_perc'), (list, dict)) 
                    else [cpu_data.get('p_cores_perc')]
                ),
                l_cores_perc=json.dumps(cpu_data.get('l_cores_perc', {})),
                ctx_switches=int(cpu_data.get('ctx_switches', 0)),
                hw_irq=int(cpu_data.get('hw_irq', 0)),
                cpu_utilization=f"{cpu_util_raw}%",
                sw_irq=int(cpu_data.get('sw_irq', 0)),
                syscalls=int(cpu_data.get('syscalls', 0))
            )
            logger.info(f"CPU monitoring data recorded successfully for UUID: {cpu_uuid}")
            
            try:
                utilization_value = float(cpu_util_raw)
                print("cpu utilization", utilization_value)
 
                if utilization_value >= cls.CPU_ALERT_THRESHOLD:   
                    logger.warning(f"[ALERT] High CPU Utilization ({utilization_value}%) on UUID={cpu_uuid}")
                    AlertService.process_alert(
                        component_type='Cpu',
                        device_name=agent.hostname if agent else "Unknown Device",
                        component_uuid=cpu_uuid,
                        utilization=utilization_value,
                        checkpoint=checkpoint
                    )
 
            except ValueError:
                logger.error(f"Invalid CPU utilization format: {cpu_util_raw}")
            except Exception as e:
                logger.error(f"Failed to trigger CPU alert for {cpu_uuid}: {e}")
                
        except Exception as e:
            logger.error(f"Failed to process CPU monitoring data: {e}")
            return f'error: {str(e)}'