# services/disk_monitoring_service.py
from BaseApp.services.imports import (
    Storage, DiskMonitoring, Partition, PartitionMonitoring, PendingDeletion,
    is_valid_uuid, convert_bytes_to_human_readable, logging, json
)
from asgiref.sync import async_to_sync,sync_to_async
from .event_service import EventService
from .alert_service import AlertService
from .handle_unknown import _handle_unknown_entities

logger = logging.getLogger("agent_monitoring")

class DiskMonitoringService:
    """Service for processing disk and partition monitoring data."""
    
    # Disk utilization threshold for alerts
    DISK_ALERT_THRESHOLD = 80  
    MAX_ATTEMPTS_FOR_PARTITIONS = 60
    MAX_ATTEMPTS_FOR_DISKS = 90
    
    @classmethod
    @sync_to_async
    def process_disk_and_partition_monitoring(cls, agent, data, checkpoint, device_uuid):
        """Process disk and partition monitoring data."""
        logger.debug(f"Received disk monitoring data: {json.dumps(data.get('disk_monitoring', {}))}")
        logger.debug(f"Received partition monitoring data: {json.dumps(data.get('partition_monitoring', {}))}")
        if 'disk_monitoring' not in data or 'partition_monitoring' not in data:
            logger.warning("Missing 'disk_monitoring' or 'partition_monitoring' in data.")
            return 'not provided'
            
        try:
            disk_monitoring = data['disk_monitoring']
            partition_monitoring = data['partition_monitoring']
            device_name = agent.hostname if agent else "Unknown Device"
            
            unknowns = []
            results = []
            deleted_disk_uuids = []
            deleted_partition_uuids = []
            known_disk_uuids = set()
            known_partition_uuids = set()

            if not isinstance(disk_monitoring, list):
                disk_monitoring = [disk_monitoring]
            if not isinstance(partition_monitoring, list):
                partition_monitoring = [partition_monitoring]
                
            # Process disks
            for disk_data in disk_monitoring:
                disk_uuid = disk_data.get('disk_uuid', '').strip() or 'unknown'
                valid_disk_uuid = is_valid_uuid(disk_uuid)
                storage_exists = Storage.objects.filter(uuid=disk_uuid).exists() if is_valid_uuid(disk_uuid) else False
                
                if valid_disk_uuid and storage_exists:
                    known_disk_uuids.add(disk_uuid)
                else:
                    logger.warning(f"Skipping disk UUID {disk_uuid} (unknown or not found)")

                if (disk_uuid == 'unknown' or not valid_disk_uuid or not storage_exists):
                    logger.warning(f"Skipping disk monitoring due to unknown or invalid UUID. UUID: {disk_uuid}, Data: {disk_data}")
                    unknowns.append({'type': 'disk', 'disk_data': disk_data, 'device_uuid': device_uuid})
                    continue 
                try:
                    disk = Storage.objects.get(uuid=disk_uuid)
                    # Calculate total disk size and usage from partitions
                    total_disk_size = 0
                    total_disk_usage = 0
                    
                    for part_data in partition_monitoring:
                        try:
                            if part_data.get('disk_uuid') == disk_uuid:
                                used = part_data.get('used_space', 0)
                                free = part_data.get('free_space', 0)
                                   
                                total_disk_usage += used
                                total_disk_size += free + used
                        except PermissionError:
                            continue
                        
                    if total_disk_size == 0:
                        disk_usage_percent = "0.00%"
                    else:
                        percent = (total_disk_usage / total_disk_size) * 100
                        disk_usage_percent = f"{percent:.2f}%"
                    
                    # Convert to human-readable sizes
                    disk_data['total_disk_size'] = total_disk_size
                    disk_data['total_disk_usage'] = total_disk_usage
                    
                    mon_total_disk_size = convert_bytes_to_human_readable(disk_data.get('total_disk_size'), 'GB')
                    disk_usage = convert_bytes_to_human_readable(disk_data.get('total_disk_usage'), 'GB')
                    
                    mon_total_disk_space = float(mon_total_disk_size.strip('GB'))
                    init_total_disk_size = float(disk.total_disk_size.strip('GB'))
                    
                    
                    if mon_total_disk_space < init_total_disk_size:
                        unallocated_disk_size = round(init_total_disk_size - mon_total_disk_space, 2)
                        logger.warning(f"[DISK] Unallocated disk space for {disk_uuid}: {unallocated_disk_size} GB)")
                    else:
                        unallocated_disk_size = 0.0
                        
                    allocated_disk_size = mon_total_disk_space    
                    
                    # Create disk monitoring record
                    try:    
                        DiskMonitoring.objects.create(
                            checkpoint=checkpoint,
                            uuid=disk_uuid,
                            storage_disk=disk,
                            total_disk_size=f"{unallocated_disk_size + allocated_disk_size} GB",
                            disk_usage_percent=disk_usage_percent,
                            unallocated_disk_space=f"{unallocated_disk_size} GB",
                            allocated_disk_space=f"{allocated_disk_size} GB",
                            total_disk_usage=disk_usage,
                            read_count_io=int(disk_data.get('read_count_io', 0)),
                            write_count_io=int(disk_data.get('write_count_io', 0)),
                            bytes_read_io=int(disk_data.get('bytes_read_io', 0)),
                            bytes_write_io=int(disk_data.get('bytes_write_io', 0)),
                            read_time_io=int(disk_data.get('read_time_io', 0)),
                            write_time_io=int(disk_data.get('write_time_io', 0)),
                        )
                        logger.info(f"Disk monitoring saved for disk UUID: {disk_uuid} at checkpoint {checkpoint}")
                        results.append({'uuid': disk_uuid, 'status': 'monitored'})
                    except Exception as e:
                        logger.error(f"Failed to save DiskMonitoring for {disk_uuid}: {e}")
                        results.append({'uuid': disk_uuid, 'status': 'error', 'error': str(e)})
                        
                    disk_util = float(disk_usage_percent.strip('%'))
                   
                    
                    # Check if disk utilization exceeds threshold   
                    if disk_util > cls.DISK_ALERT_THRESHOLD:
                        logger.warning(f"[ALERT] High DISK Utilization ({disk_util}%) on UUID={disk_uuid}")
                        AlertService.process_alert(
                            component_type=disk.serial_number if disk.serial_number else "Unknown Disk",
                            device_name=device_name,
                            component_uuid=disk_uuid,
                            utilization=disk_util,
                            checkpoint=checkpoint
                        )
        
                    # Handle related partitions
                    cls._process_partitions_for_disk(agent, disk_uuid, partition_monitoring, checkpoint, device_uuid, known_partition_uuids, unknowns, results,device_name)
                    
                except Exception as e:
                    logger.exception(f"Exception while processing disk UUID: {disk_uuid}")
                    results.append({'uuid': disk_uuid, 'status': f'error: {str(e)}'})
               
            # Clean up and handle deletions
            deleted_disk_uuids, deleted_partition_uuids = cls._handle_deletions(
                device_uuid, known_disk_uuids, known_partition_uuids, agent,device_name
            )

            response = []
            if deleted_disk_uuids:
                response.append({"action": "deleted_disk", "uuid": deleted_disk_uuids})
            if deleted_partition_uuids:
                response.append({"action": "deleted_partition", "uuid": deleted_partition_uuids})   
                        
                
            # If there are unknown disks or partitions, handle them
            if unknowns:
                logger.info(f"Unknown disks/partitions encountered: {unknowns}")
                unknowns = _handle_unknown_entities(unknowns)
            response.extend(unknowns)
         
            logger.debug(f"Disk and partition monitoring result summary: {results}")
            return {
                "actions": response 
            }
        except Exception as e:
            logger.exception("Unhandled error during disk/partition processing.")
            return [{'status': f'error: {str(e)}'}]

    @classmethod
    def _process_partitions_for_disk(cls, agent, disk_uuid, partition_monitoring, checkpoint, device_uuid, known_partition_uuids, unknowns, results,device_name):
        """Process partitions for a specific disk."""
        related_partitions = [
            part for part in partition_monitoring if part.get('disk_uuid') == disk_uuid or 'unknown'
        ]
        
        for part_data in related_partitions:
            part_uuid = part_data.get('partition_uuid') or 'unknown'
            partition_exists = Partition.objects.filter(uuid=part_uuid).exists() if is_valid_uuid(part_uuid) else False
    
            if not is_valid_uuid(part_uuid) or not partition_exists:
                logger.warning(f"Unknown or invalid partition UUID: {part_data}")
                unknowns.append({
                    'type': 'partition',
                    'device_uuid': device_uuid,
                    'action': 'unknown partition'
                })
                results.append({'uuid': part_uuid, 'status': "error: unknown UUID"})
                continue
                        
            if is_valid_uuid(part_uuid) and partition_exists:
                known_partition_uuids.add(part_uuid)
            else:
                logger.warning(f"Skipping partition UUID {part_uuid} (unknown or not found)")
                
            try:
                if part_data.get('disk_uuid') == disk_uuid:
                    partition = Partition.objects.get(uuid=part_uuid)
                    part_data["used_space"] = cls._safe_convert_bytes_to_gb(part_data.get("used_space", 0))
                    part_data["free_space"] = cls._safe_convert_bytes_to_gb(part_data.get("free_space", 0))
                    
                  
                    mon_used = part_data.get("used_space")
                    free_space = part_data.get("free_space")

                    def extract_float_from_gb_string(value):
                        """Extract float value from '0.02 GB' string."""
                        try:
                            return float(str(value).split()[0])
                        except Exception:
                            return 0.0

                    mon_used_str = part_data.get("used_space", "0 GB")
                    free_space_str = part_data.get("free_space", "0 GB")

                    mon_used = extract_float_from_gb_string(mon_used_str) 
                    free_space = extract_float_from_gb_string(free_space_str)
                    total_size = mon_used + free_space
                    partition.total_size = f"{total_size:.2f} GB" 
                   
                    old_used_space = partition.used_space
                    mon_partition_used_space = part_data.get('used_space')
                    
                    if old_used_space != mon_partition_used_space:
                        async_to_sync(EventService.create_event)(
                            agent=agent,
                            event_type="UPDATE",
                            description=f"Partition {partition.name} size updated from {old_used_space} to {mon_partition_used_space} on device {device_name}",
                            component_type=f"Partition {partition.name}",
                        )
                        partition.update_partition_used_space(part_data.get('used_space'))
                        
                    PartitionMonitoring.objects.create(
                        checkpoint=checkpoint,
                        partition=partition,
                        uuid=part_uuid,
                        storage=partition.storage,
                        used_space=part_data.get("used_space"),
                        free_space=part_data.get("free_space"),
                        used_space_perc=part_data.get('used_space_perc', '0%')  
                    )
                    logger.info(f"Partition monitoring saved for partition UUID: {part_uuid}")
                    results.append({'uuid': part_uuid, 'status': 'success'})
                    
            except Exception as e:
                logger.exception(f"Exception while processing partition UUID: {part_uuid}")
                results.append({'uuid': part_uuid, 'status': f'error: {str(e)}'})

    @classmethod
    def _handle_deletions(cls, device_uuid, known_disk_uuids, known_partition_uuids, agent,device_name):
        """Handle cleanup and deletion of missing disk and partition UUIDs."""
        # Clean up pending deletions for known entities
        disk_cleanup_count = PendingDeletion.objects.filter(uuid__in=known_disk_uuids, entity_type='disk').delete()
        partition_cleanup_count = PendingDeletion.objects.filter(uuid__in=known_partition_uuids, entity_type='partition').delete()
        logger.info(f"Cleaned up {disk_cleanup_count[0]} pending disk deletions for known UUIDs.")
        logger.info(f"Cleaned up {partition_cleanup_count[0]} pending partition deletions for known UUIDs.")
        
        # Collect existing UUIDs from DB
        existing_disk_uuids = set(Storage.objects.filter(device__uuid=device_uuid).values_list('uuid', flat=True))
        existing_partition_uuids = set(Partition.objects.filter(storage__device__uuid=device_uuid).values_list('uuid', flat=True))
        
        # Compare known vs existing and identify missing
        missing_disk_uuids = set(str(uuid) for uuid in existing_disk_uuids) - known_disk_uuids
        missing_partition_uuids = set(str(uuid) for uuid in existing_partition_uuids) - known_partition_uuids
        
        deleted_disk_uuids = []
        deleted_partition_uuids = []

        # Handle missing disk UUIDs
        for uuid in missing_disk_uuids:
            pending, created = PendingDeletion.objects.get_or_create(uuid=uuid, entity_type='disk', device_uuid=device_uuid)

            if created:
                logger.info(f"Added disk UUID {uuid} to pending deletion (initial attempt).")
            elif pending:
                pending.missing_count += 1
                logger.info(f"Incremented attempt for disk UUID {uuid} to {pending.missing_count}.")

                if pending.missing_count >= cls.MAX_ATTEMPTS_FOR_DISKS:
                    # Fetch disk object before deletion
                    disk = Storage.objects.filter(uuid=uuid).first()
                    disk_name = disk.serial_number if disk else "Unknown Disk"
                   

                    # Create event before deletion
                    async_to_sync(EventService.create_event)(
                        agent=agent,
                        event_type="DELETE",
                        description=f"Disk {disk_name} deleted on device {device_name}",
                        component_type=disk.serial_number if disk else "Unknown Disk",
                    )

                    # Delete disk and mark as deleted
                    Storage.objects.filter(uuid=uuid).delete()
                    deleted_disk_uuids.append(uuid)
                    logger.warning(f"Deleted disk UUID {uuid} after {pending.missing_count} failed checks.")
                    pending.delete()
                else:
                    pending.save()


        # Handle missing partition UUIDs
        for uuid in missing_partition_uuids:
            pending, created = PendingDeletion.objects.get_or_create(uuid=uuid, entity_type='partition', device_uuid=device_uuid)
            if created:
                logger.info(f"Added partition UUID {uuid} to pending deletion (initial missing).")
            elif pending:
                pending.missing_count += 1
                logger.warning(f"Incremented missing for partition UUID {uuid} to {pending.missing_count}.")
                partition = Partition.objects.filter(uuid=uuid).first()

                if partition:
                    partition_name = partition.name
                    disk_name = partition.storage.serial_number if partition.storage else "Unknown Disk"
                else:
                    partition_name = "Unknown Partition"
                    disk_name = "Unknown Disk"


                description = (
                    f"Partition {partition_name} deleted from disk {disk_name} on device {device_name}"
                )

                if pending.missing_count >= cls.MAX_ATTEMPTS_FOR_PARTITIONS:
                    partition.delete()
                    async_to_sync(EventService.create_event)(
                        agent=agent,
                        event_type="DELETE",
                        description=description,
                        component_type=f"Partition {partition_name}"
                    )
                    deleted_partition_uuids.append(uuid)
                    logger.warning(f"Deleted partition UUID {uuid} after {pending.missing_count} failed checks.")
                    pending.delete()
                else:
                    pending.save()

        return deleted_disk_uuids, deleted_partition_uuids

    @staticmethod
    def _safe_convert_bytes_to_gb(value):
        """Safely convert bytes to GB string."""
        try:
            # If it's already a string and contains unit, return as-is
            if isinstance(value, str) and any(unit in value.upper() for unit in ["GB", "MB", "KB", "TB", "BYTES"]):
                return value
            # Otherwise, convert to GB
            return convert_bytes_to_human_readable(int(value), "GB")
        except Exception as e:
            return "Error: Invalid input value."