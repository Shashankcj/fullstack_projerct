# services/network_monitoring_service.py
from BaseApp.services.imports import (
    NIC, Port, NetworkPortMonitoring, PendingDeletion, is_valid_uuid, logging
)
from asgiref.sync import async_to_sync,sync_to_async
from .event_service import EventService
from .alert_service import AlertService
from .handle_unknown import _handle_unknown_entities
from BaseApp.models import Device
logger = logging.getLogger("agent_monitoring")

class NetworkMonitoringService:
    """Service for processing network monitoring data."""
    
    NETWORK_PORT_ALERT_THRESHOLD = 50  
    MAX_ATTEMPTS = 40
    
    @classmethod
    @sync_to_async
    def process_network_data(cls, agent, data, checkpoint, input_device_uuid):
        """Process network monitoring data, handling known and unknown ports."""
        try:
            if 'network_monitoring' not in data:
                logger.warning("No 'network_monitoring' data provided.")
                return 'not provided'
            
            response = []
            device_uuid = input_device_uuid
            deleted_nic_uuids = []
            unknowns = []
            results = [] 
            known_port_uuids = set()
            network_port_monitoring = data['network_monitoring']
              
            if not isinstance(network_port_monitoring, list):
                network_port_monitoring = [network_port_monitoring]

            for port_data in network_port_monitoring:
                port_uuid = port_data.get('port_uuid') or 'unknown_uuid'
                port_exists = Port.objects.filter(uuid=port_uuid).exists() if is_valid_uuid(port_uuid) else False

                if is_valid_uuid(port_uuid) and port_exists:
                    known_port_uuids.add(port_uuid)
                else:
                    logger.warning(f"Skipping port UUID {port_uuid} (unknown or not found)")
                    
                if not is_valid_uuid(port_uuid) or port_exists is False:
                    logger.warning(f"Unknown or invalid port UUID detected: {port_uuid}, device: {device_uuid}")
                    unknowns.append({
                        'type': 'port',
                        'device_uuid': device_uuid
                    })
                    results.append({
                        'uuid': port_uuid,
                        'status': "error: missing or unknown UUID"
                    })
                    continue
               
                try:
                    port = Port.objects.get(uuid=port_uuid)
                    bytes_sent = int(port_data.get('bytes_sent', 0))
                    bytes_received = int(port_data.get('bytes_received', 0))
                    packet_sent = int(port_data.get('packets_sent', 0))
                    packet_received = int(port_data.get('packets_received', 0))
                    error_in = int(port_data.get('error_in', 0))
                    error_out = int(port_data.get('error_out', 0))
                    drop_in = int(port_data.get('drop_in', 0))
                    drop_out = int(port_data.get('drop_out', 0))
                    util = float(port_data.get('network_utilization', 0))
                 
                   
                    NetworkPortMonitoring.objects.create(
                        uuid=port_uuid,
                        checkpoint=checkpoint,
                        port=port,
                        bytes_sent=bytes_sent,
                        bytes_received=bytes_received,
                        packet_sent=packet_sent,
                        packet_received=packet_received,
                        error_in=error_in,
                        error_out=error_out,
                        drop_in=drop_in,
                        drop_out=drop_out,
                    )
                    logger.info(f"Successfully processed port monitoring data for port UUID: {port_uuid}")
                    results.append({'uuid': port_uuid, 'status': 'success'})
                except Port.DoesNotExist:
                    logger.warning(f"Port UUID does not exist in DB: {port_uuid}")
                    
               
                if util >= cls.NETWORK_PORT_ALERT_THRESHOLD:
                    try:
                        logger.warning(f"[ALERT] High Port Utilization ({util}%) on UUID={port_uuid}")
                        AlertService.process_alert(
                            component_type='port',
                            device_name=agent.hostname if agent else "Unknown Device",
                            component_uuid=port_uuid,
                            utilization=util,
                            checkpoint=checkpoint
                        )
                    except Exception as e:
                        logger.error(f"Failed to trigger PORT alert for {port_uuid}: {e}")
            
            # Handle deletions and cleanup
            deleted_nic_uuids = cls._handle_port_deletions(device_uuid, known_port_uuids, agent)
            
            if deleted_nic_uuids:
                response.append({
                    "action": "deleted_nic",
                    "uuid": deleted_nic_uuids
                })
            if unknowns:
                logger.info(f"Unknown port encountered: {unknowns}")
                unknowns = _handle_unknown_entities(unknowns)
            
            logger.debug(f"port monitoring result summary: {results}")
            response.extend(unknowns)
            return {
                "actions": response 
            }

        except Exception as e:
            logger.exception("Unexpected error in _process_network_data")
            return {'error': str(e)}

    @classmethod
    def _handle_port_deletions(cls, device_uuid, known_port_uuids, agent):
        """Handle cleanup and deletion of missing port UUIDs."""
        # Clean up known ports from pending deletion
        port_cleanup_count = PendingDeletion.objects.filter(uuid__in=known_port_uuids, entity_type='port').delete()
        logger.info(f"Cleaned up {port_cleanup_count[0]} pending port deletions for known UUIDs.")
        device=Device.objects.filter(uuid=device_uuid)
        
        # Collect existing port UUIDs from DB
        existing_port_uuids = set(
            Port.objects.filter(nic__device__uuid=device_uuid).values_list('uuid', flat=True)
        )
        logger.debug(f"Existing port UUIDs: {existing_port_uuids}")

        # Compare and identify missing UUIDs
        missing_port_uuids = set(str(uuid) for uuid in existing_port_uuids) - known_port_uuids
        logger.debug(f"Missing port UUIDs: {missing_port_uuids}")

        deleted_nic_uuids = []

        # Handle missing ports
        for uuid in missing_port_uuids:
            pending, created = PendingDeletion.objects.get_or_create(
                uuid=uuid, entity_type='port', device_uuid=device_uuid
            )
            if created:
                logger.info(f"Added port UUID {uuid} to pending deletion (first miss).")
            else:
                pending.missing_count += 1
                logger.warning(f"Incremented missing count for port UUID {uuid} to {pending.missing_count}.")
                if pending.missing_count >= cls.MAX_ATTEMPTS:
                    port = Port.objects.filter(uuid=uuid).first()
                    if port:
                        nic = port.nic
                        nic_uuid = str(nic.uuid)
                        port_name =port.interface_name
                       
                        device_name = agent.hostname # Adjust this field as needed

                        description = (
                            f"NIC: {port_name} on device {device_name} removed")
                        # Delete the NIC (deletes all related ports via CASCADE)
                        nic.delete()

                        async_to_sync(EventService.create_event)(
                            agent=agent,
                            event_type="DELETED",
                            description=description,
                            component_type="Port: {}".format(port_name or "Unknown Port"),
                        )

                        deleted_nic_uuids.append(nic_uuid)
                        logger.warning(
                            f"Deleted NIC UUID {nic_uuid} and its associated port UUID {uuid} "
                            f"after {pending.missing_count} failed checks."
                        )
                    else:
                        logger.warning(f"Port UUID {uuid} not found while attempting to delete NIC.")

                    pending.delete()
                else:
                    pending.save()

        return deleted_nic_uuids
