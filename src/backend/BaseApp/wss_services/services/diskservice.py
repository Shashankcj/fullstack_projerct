import asyncio
import logging
from datetime import datetime, timedelta
from typing import (
    Dict, List, Set, Tuple, Union, Callable, Awaitable, Optional
)
from django.core.cache import cache  
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from django.conf import settings
from asgiref.sync import sync_to_async


from ...models import (
    Storage, Partition, DiskMonitoring, PartitionMonitoring,
    MonitoringCheckpoint, Device
)
from .alertservice import AlertService
from .unknown_handler import UnknownEntitiesService
from .eventservice import EventService
from .utility import DiskMonitoringUtils


logger = logging.getLogger("agent_monitoring")

# ═══════════════════════════════════════════════════════════════════
# CONFIGURATION LOADING WITH FALLBACKS
# ═══════════════════════════════════════════════════════════════════

# Load configuration with comprehensive fallbacks
_DISK_CONFIG = getattr(settings, "DISK_MONITORING_CONFIG", {})

# Alert timing configuration
ALERT_CONTINUOUS_MINUTES = _DISK_CONFIG.get(
    "ALERT_CONTINUOUS_MINUTES",
    _DISK_CONFIG.get("ALERT_STREAK_MINUTES", 5)  # Backward compat
)

# Cache configuration
ALERT_CACHE_TTL = _DISK_CONFIG.get("ALERT_CACHE_TTL", 3600)
CACHE_KEY_PREFIX = _DISK_CONFIG.get("CACHE_KEY_PREFIX", "disk_util_alert")

# Bulk operation configuration
BULK_INSERT_CHUNK_SIZE = _DISK_CONFIG.get("BULK_INSERT_CHUNK_SIZE", 500)

# Partition verification configuration
PARTITION_VERIFICATION_TIMEOUT = _DISK_CONFIG.get(
    "PARTITION_VERIFICATION_TIMEOUT", 
    86400  # 24 hours
)
PARTITION_VERIFICATION_CACHE_PREFIX = _DISK_CONFIG.get(
    "PARTITION_VERIFICATION_CACHE_PREFIX",
    "partition_verification_sent"
)

# Threshold configuration
THRESHOLDS = _DISK_CONFIG.get(
    "THRESHOLDS",
    {
        "INFO": 40.0,
        "WARNING": 60.0,
        "CRITICAL": 80.0,
    }
)
class DiskMonitoringService:
    def __init__(
        self,
        alert_service: Optional[AlertService] = None,
        unknown_service: Optional[UnknownEntitiesService] = None,
        event_service: Optional[EventService] = None,
    ):
        self.alert_service   = alert_service or AlertService()
        self.unknown_service = unknown_service
        self.event_service   = event_service or EventService()
        self._send_response_with_logging: Optional[
            Callable[[Dict], Awaitable[None]]
        ] = None
        self._disk_utilization_cache: Dict[str, datetime] = {}


    def set_response_sender(self, response_sender: Callable[[Dict], Awaitable[None]]):
        """Propagate response sender to sub-services."""
        self._send_response_with_logging = response_sender
        if self.unknown_service:
            self.unknown_service.set_response_sender(response_sender)
        logger.debug("Response sender configured")


    async def process_disk_data(
        self,
        data: Dict,
        checkpoint: MonitoringCheckpoint,
        agent,
        device,
    ) -> Union[List[Dict], str]:
        """Main entry point for processing disk monitoring data with bulk operations."""
        if not DiskMonitoringUtils.validate_input_data(data):
            return "not provided"

        device_uuid = str(device.uuid)
        disk_monitoring = DiskMonitoringUtils.normalize_to_list(data["disk_monitoring"])
        partition_monitoring = DiskMonitoringUtils.normalize_to_list(data["partition_monitoring"])

        partitions_by_disk, orphan_partitions = DiskMonitoringUtils.index_partitions_by_disk(
            partition_monitoring
        )
        incoming_disk_uuids: Set[str] = set()
        incoming_partition_uuids: Set[str] = set()

        disk_cache, partition_cache = await self._bulk_fetch_storage_objects(device_uuid)

        # UPDATED: Process all disks and collect records for bulk insert
        disk_results = await self._process_disks_batch_with_bulk_insert(
            disk_monitoring, partitions_by_disk, checkpoint, agent, device,
            incoming_disk_uuids, incoming_partition_uuids, disk_cache, partition_cache,
        )

        results = disk_results["results"]
        unknowns = disk_results["unknowns"]

        await self._handle_post_processing(
            agent, device, unknowns, incoming_disk_uuids, incoming_partition_uuids, disk_cache, partition_cache
        )
        return results


    async def _bulk_fetch_storage_objects(self, device_uuid: str) -> Tuple[Dict, Dict]:
        """Cache all disks and partitions for this device."""
        try:
            disk_query = Storage.objects.select_related("device").filter(device__uuid=device_uuid)
            part_query = Partition.objects.select_related("storage").filter(storage__device__uuid=device_uuid)

            disks, parts = await asyncio.gather(
                sync_to_async(list)(disk_query),
                sync_to_async(list)(part_query),
            )

            disk_cache = {str(d.uuid): d for d in disks}
            partition_cache = {str(p.uuid): p for p in parts}

            logger.debug(f"Cached {len(disk_cache)} disks and {len(partition_cache)} partitions")
            return disk_cache, partition_cache
        except Exception as exc:
            logger.error("Bulk-fetch error: %s", exc)
            return {}, {}


    # ═══════════════════════════════════════════════════════════════════
    # UPDATED: Bulk Insert Implementation
    # ═══════════════════════════════════════════════════════════════════

    async def _process_disks_batch_with_bulk_insert(self, disk_monitoring, partitions_by_disk, checkpoint, agent, device,
                                                   incoming_disk_uuids, incoming_partition_uuids, disk_cache, partition_cache):
        """Process multiple disks and collect records for bulk insert."""
        
        # Collect records instead of creating immediately
        disk_records = []
        partition_records = []
        alert_data = []
        results = []
        unknowns = []
        
        # Process all disks and collect monitoring records
        for disk_data in disk_monitoring:
            disk_result = await self._prepare_disk_record(
                disk_data, partitions_by_disk, checkpoint, agent, device,
                incoming_disk_uuids, incoming_partition_uuids, disk_cache, partition_cache
            )
            
            # Collect valid records
            if disk_result['disk_record']:
                disk_records.append(disk_result['disk_record'])
                alert_data.extend(disk_result['alert_data'])
            
            partition_records.extend(disk_result['partition_records'])
            results.extend(disk_result['results'])
            unknowns.extend(disk_result['unknowns'])
        
        # Bulk insert all records
        await self._bulk_create_monitoring_records(disk_records, partition_records)
        
        # Process alerts after bulk insert
        await self._process_bulk_alerts(alert_data, checkpoint, agent)
        
        logger.info(f"Bulk processed {len(disk_records)} disks and {len(partition_records)} partitions")
        
        return {"results": results, "unknowns": unknowns}


    async def _prepare_disk_record(self, disk_data, partitions_by_disk, checkpoint, agent, device,
                                   incoming_disk_uuids, incoming_partition_uuids, disk_cache, partition_cache):
        """Prepare disk and partition records without database insertion."""
        disk_uuid = disk_data.get('disk_uuid', '').strip()
        device_uuid = str(device.uuid)
        
        if not DiskMonitoringUtils.validate_uuid_format(disk_uuid):
            return {
                'disk_record': None,
                'partition_records': [],
                'alert_data': [],
                'results': [DiskMonitoringUtils.create_disk_error_response(disk_data, device_uuid, disk_uuid)],
                'unknowns': []
            }
        
        disk = disk_cache.get(disk_uuid)
        if not disk:
            logger.warning(f"Disk not found: {disk_uuid}")
            return {
                'disk_record': None,
                'partition_records': [],
                'alert_data': [],
                'results': [DiskMonitoringUtils.create_disk_not_found_response(disk_uuid, device_uuid)],
                'unknowns': []
            }
        
        incoming_disk_uuids.add(disk_uuid)
        
        if disk.is_flagged:
            logger.debug(f"Skipping monitoring for flagged disk {disk_uuid}")
            return {
                'disk_record': None,
                'partition_records': [],
                'alert_data': [],
                'results': [{
                    "disk": disk_uuid,
                    "status": "skipped_flagged",
                    "message": "Disk flagged - monitoring suspended until verification",
                    "partitions": []
                }],
                'unknowns': []
            }

        try:
            # Process disk partitions
            disk_partitions = partitions_by_disk.get(disk_uuid, [])
            physical_size_bytes = DiskMonitoringUtils.parse_disk_size(disk.total_disk_size)
            disk_totals = DiskMonitoringUtils.calculate_disk_totals(disk_partitions, physical_size_bytes)
            
            # Create disk monitoring record object
            disk_record = self._create_disk_record_object(checkpoint, disk_uuid, disk, disk_data, disk_totals)
            
            # Prepare partition records
            partition_records = []
            partition_results = []
            
            for part_data in disk_partitions:
                partition_uuid = part_data.get("partition_uuid", "").strip()
                if DiskMonitoringUtils.validate_uuid_format(partition_uuid):
                    partition = partition_cache.get(partition_uuid)
                    if partition:
                        incoming_partition_uuids.add(partition_uuid)
                        partition_record = self._create_partition_record_object(
                            checkpoint, partition, partition_uuid, disk, part_data
                        )
                        partition_records.append(partition_record)
                        partition_results.append({"uuid": partition_uuid, "status": "success"})
                    else:
                        partition_results.append({"uuid": partition_uuid, "status": "not_found"})
                else:
                    partition_results.append({"uuid": partition_uuid, "status": "invalid_uuid"})
            
            # Prepare alert data
            usage_perc = self._calculate_disk_usage_percentage(disk_totals)
            alert_data = [{
                'disk_uuid': disk_uuid,
                'usage_perc': usage_perc,
                'disk': disk
            }] if usage_perc > 0 else []
            
            return {
                'disk_record': disk_record,
                'partition_records': partition_records,
                'alert_data': alert_data,
                'results': [{
                    "disk": disk_uuid,
                    "status": "success",
                    "partitions": partition_results,
                }],
                'unknowns': []
            }

        except Exception as exc:
            logger.error("Failed to prepare disk %s: %s", disk_uuid, exc)
            return {
                'disk_record': None,
                'partition_records': [],
                'alert_data': [],
                'results': [{"uuid": disk_uuid, "status": f"error: {exc}"}],
                'unknowns': []
            }


    def _create_disk_record_object(self, checkpoint, disk_uuid, disk, disk_data, disk_totals):
        """Create disk monitoring record object without database insertion."""
        total_size_gb = float(disk_totals.get("total_size_gb", 0.0))
        total_usage_gb = float(disk_totals.get("total_usage_gb", 0.0))
        usage_perc = (total_usage_gb / total_size_gb) * 100 if total_size_gb > 0 else 0.0
        
        return DiskMonitoring(
            checkpoint=checkpoint,
            uuid=disk_uuid,
            storage_disk=disk,
            total_disk_size=f"{round(total_size_gb, 2)} GB",
            total_disk_usage=f"{round(total_usage_gb, 2)} GB",
            disk_usage_percent=f"{usage_perc:.2f}%",
            allocated_disk_space=f"{round(disk_totals.get('allocated_gb', 0.0), 2)} GB",
            unallocated_disk_space=f"{round(disk_totals.get('unallocated_gb', 0.0), 2)} GB",
            read_count_io=int(disk_data.get("read_count_io", 0)),
            write_count_io=int(disk_data.get("write_count_io", 0)),
            bytes_read_io=int(disk_data.get("bytes_read_io", 0)),
            bytes_write_io=int(disk_data.get("bytes_write_io", 0)),
            read_time_io=int(disk_data.get("read_time_io", 0)),
            write_time_io=int(disk_data.get("write_time_io", 0)),
        )


    def _create_partition_record_object(self, checkpoint, partition, partition_uuid, disk, part_data):
        """Create partition monitoring record object without database insertion."""
        converted_used = DiskMonitoringUtils.safe_convert_bytes_to_gb(part_data.get("used_space", 0))
        converted_free = DiskMonitoringUtils.safe_convert_bytes_to_gb(part_data.get("free_space", 0))
        
        return PartitionMonitoring(
            checkpoint=checkpoint,
            partition=partition,
            uuid=partition_uuid,
            storage=disk,
            free_space=converted_free,
            used_space=converted_used,
            used_space_perc=part_data.get("used_space_perc", 0),
        )


    def _calculate_disk_usage_percentage(self, disk_totals):
        """Calculate disk usage percentage from totals."""
        total_size_gb = float(disk_totals.get("total_size_gb", 0.0))
        total_usage_gb = float(disk_totals.get("total_usage_gb", 0.0))
        return (total_usage_gb / total_size_gb) * 100 if total_size_gb > 0 else 0.0


    async def _bulk_create_monitoring_records(self, disk_records, partition_records):
        """Bulk create disk and partition monitoring records with chunking."""
        try:
            tasks = []
            
            # Bulk create disk records in chunks
            if disk_records:
                tasks.append(
                    self._chunked_bulk_create(disk_records, DiskMonitoring, BULK_INSERT_CHUNK_SIZE)
                )
            
            # Bulk create partition records in chunks
            if partition_records:
                tasks.append(
                    self._chunked_bulk_create(partition_records, PartitionMonitoring, BULK_INSERT_CHUNK_SIZE)
                )
            
            # Execute both bulk operations concurrently
            if tasks:
                await asyncio.gather(*tasks)
                
            logger.info(f"Bulk created {len(disk_records)} disk records and {len(partition_records)} partition records")
            
        except Exception as e:
            logger.error(f"❌ Bulk create failed: {e}")
            raise


    async def _chunked_bulk_create(self, records, model_class, chunk_size):
        """Create records in chunks to optimize transaction size."""
        try:
            for i in range(0, len(records), chunk_size):
                chunk = records[i:i + chunk_size]
                await sync_to_async(model_class.objects.bulk_create)(
                    chunk, batch_size=chunk_size, ignore_conflicts=False
                )
                logger.debug(f"Created chunk {i//chunk_size + 1} of {model_class.__name__}: {len(chunk)} records")
        except Exception as e:
            logger.error(f"❌ Chunked bulk create failed for {model_class.__name__}: {e}")
            raise


    async def _process_bulk_alerts(self, alert_data, checkpoint, agent):
        """Process all alerts after bulk insert."""
        try:
            for alert_item in alert_data:
                await self._evaluate_disk_alerts(
                    alert_item['disk_uuid'],
                    alert_item['usage_perc'],
                    checkpoint,
                    agent
                )
        except Exception as e:
            logger.error(f"❌ Bulk alert processing failed: {e}")


    # ═══════════════════════════════════════════════════════════════════
    # Rest of the methods remain unchanged
    # ═══════════════════════════════════════════════════════════════════

    async def _handle_post_processing(self, agent, device, unknowns, incoming_disk_uuids, 
                                      incoming_partition_uuids, disk_cache, partition_cache):
        """Handle missing disks and partitions."""
        device_uuid = str(device.uuid) 
        tasks = []
        
        if unknowns and self.unknown_service:
            tasks.append(self.unknown_service.handle_unknown_entities(device_uuid, unknowns))
        
        tasks.append(self._handle_missing_disks(agent, device, incoming_disk_uuids, disk_cache))
        tasks.append(self._handle_missing_partitions_verification_only(agent, device, incoming_partition_uuids, partition_cache))
        
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)


    async def _handle_missing_disks(self, agent, device, incoming_disk_uuids, disk_cache):
        """Flag missing disks and send verification."""
        device_uuid = str(device.uuid)
        
        all_known_disk_uuids = set(disk_cache.keys())
        missing_disk_uuids = all_known_disk_uuids - incoming_disk_uuids
        
        reappeared_disk_uuids = set()
        for disk_uuid in incoming_disk_uuids:
            disk = disk_cache.get(disk_uuid)
            if disk and disk.is_flagged:
                reappeared_disk_uuids.add(disk_uuid)
        
        if missing_disk_uuids:
            logger.info(f"Found {len(missing_disk_uuids)} missing disks: {missing_disk_uuids}")
            tasks = [self._flag_missing_disk(disk_uuid, device_uuid, agent) for disk_uuid in missing_disk_uuids]
            await asyncio.gather(*tasks, return_exceptions=True)
            
        if reappeared_disk_uuids:
            logger.info(f"Found {len(reappeared_disk_uuids)} reappeared disks: {reappeared_disk_uuids}")
            tasks = [self._unflag_reappeared_disk(disk_uuid, device_uuid, agent) for disk_uuid in reappeared_disk_uuids]
            await asyncio.gather(*tasks, return_exceptions=True)


    async def _handle_missing_partitions_verification_only(self, agent, device, incoming_partition_uuids, partition_cache):
        """Send verification for missing partitions with duplicate prevention."""
        device_uuid = str(device.uuid)
        
        all_known_partition_uuids = set(partition_cache.keys())
        missing_partition_uuids = all_known_partition_uuids - incoming_partition_uuids
        
        if missing_partition_uuids:
            # Filter out partitions already sent for verification
            partitions_to_verify = []
            
            for partition_uuid in missing_partition_uuids:
                cache_key = f"{PARTITION_VERIFICATION_CACHE_PREFIX}:{partition_uuid}"
                if not cache.get(cache_key):
                    partitions_to_verify.append(partition_uuid)
                    # Mark as sent (24 hour expiry)
                    cache.set(cache_key, timezone.now().isoformat(), timeout=PARTITION_VERIFICATION_TIMEOUT)
            
            if partitions_to_verify:
                logger.info(f"Found {len(partitions_to_verify)} new missing partitions - sending verification: {partitions_to_verify}")
                tasks = [self._send_partition_verification_direct(partition_uuid, device_uuid, agent) 
                        for partition_uuid in partitions_to_verify]
                await asyncio.gather(*tasks, return_exceptions=True)
            else:
                logger.debug(f"All {len(missing_partition_uuids)} missing partitions already have pending verifications")


    async def _send_partition_verification_direct(self, partition_uuid: str, device_uuid: str, agent):
        """Send verification request with logging."""
        try:
            verification_request = {
                'action': 'verify_partition_existence',
                'device_uuid': device_uuid,
                'partition_uuid': partition_uuid
            }
            
            await self._send_response_with_logging(verification_request)
            logger.info(f"📤 Sent verification request for missing partition {partition_uuid}")
            
            await self.event_service.create_event(
                event_type="PARTITION_MISSING_VERIFICATION_SENT",
                description=f"Missing partition {partition_uuid} - verification sent to agent (duplicate prevention active)",
                agent=agent,
                component_type="Partition",
                component_uuid=partition_uuid,
                additional_data={
                    "device_uuid": device_uuid,
                    "agent_hostname": getattr(agent, 'hostname', 'unknown'),
                    "action": "direct_verification_sent"
                }
            )
        except Exception as e:
            logger.error(f"❌ Error sending partition verification for {partition_uuid}: {e}")


    # ─────────────── Disk flagging methods ───────────────
    async def _flag_missing_disk(self, disk_uuid: str, device_uuid: str, agent):
        """Flag disk with timestamp and reason."""
        try:
            @sync_to_async
            def flag_disk():
                with transaction.atomic():
                    now = timezone.now()
                    reason = f"Disk missing from monitoring data. Agent: {getattr(agent, 'hostname', 'unknown')}. Detected at: {now.strftime('%Y-%m-%d %H:%M:%S UTC')}"
                    
                    updated = Storage.objects.filter(
                        uuid=disk_uuid,
                        device__uuid=device_uuid,
                        is_flagged=False
                    ).update(
                        is_flagged=True,
                        flagged_at=now,
                        flagged_reason=reason
                    )
                    return updated > 0
            
            flagged = await flag_disk()
            
            if flagged:
                logger.info(f"🚩 Flagged missing disk {disk_uuid}")
                await self._send_disk_verification_request(disk_uuid, device_uuid, agent)
                await self.event_service.create_event(
                    event_type="DISK_FLAGGED_MISSING",
                    description=f"Disk {disk_uuid} flagged as missing - verification requested",
                    agent=agent,
                    component_type="Storage",
                    component_uuid=disk_uuid,
                    additional_data={
                        "device_uuid": device_uuid,
                        "agent_hostname": getattr(agent, 'hostname', 'unknown'),
                        "action": "flagged_and_verification_sent"
                    }
                )
            else:
                logger.debug(f"Disk {disk_uuid} already flagged")
        except Exception as e:
            logger.error(f"❌ Error flagging disk {disk_uuid}: {e}")


    async def _send_disk_verification_request(self, disk_uuid: str, device_uuid: str, agent):
        """Send verification request to agent for disk."""
        try:
            verification_request = {
                'action': 'verify_disk_existence',
                'device_uuid': device_uuid,
                'disk_uuid': disk_uuid
            }
            await self._send_response_with_logging(verification_request)
            logger.info(f"📤 Sent verification request for disk {disk_uuid}")
        except Exception as e:
            logger.error(f"❌ Error sending disk verification for {disk_uuid}: {e}")


    async def _unflag_reappeared_disk(self, disk_uuid: str, device_uuid: str, agent):
        """Unflag disk and clear timestamp/reason."""
        try:
            @sync_to_async
            def unflag_disk():
                with transaction.atomic():
                    updated = Storage.objects.filter(
                        uuid=disk_uuid,
                        device__uuid=device_uuid,
                        is_flagged=True
                    ).update(
                        is_flagged=False,
                        flagged_at=None,
                        flagged_reason=None
                    )
                    return updated > 0
            
            unflagged = await unflag_disk()
            if unflagged:
                logger.info(f"✅ Unflagged reappeared disk {disk_uuid}")
                await self.event_service.create_event(
                    event_type="DISK_REAPPEARED_AUTO_UNFLAGGED",
                    description=f"Disk {disk_uuid} reappeared and automatically unflagged",
                    agent=agent,
                    component_type="Storage",
                    component_uuid=disk_uuid,
                    additional_data={
                        "device_uuid": device_uuid,
                        "agent_hostname": getattr(agent, 'hostname', 'unknown'),
                        "action": "auto_unflagged_monitoring_resumed"
                    }
                )
        except Exception as e:
            logger.error(f"❌ Error unflagging disk {disk_uuid}: {e}")


    # ─────────────── Agent response handling ───────────────
    async def handle_agent_verification_response(self, response_data: Dict, agent):
        """Handle agent verification responses."""
        try:
            action = response_data.get('action', '')
            
            if action == 'verify_disk_existence':
                await self._handle_disk_verification_response(response_data, agent)
            elif action == 'verify_partition_existence':
                await self._handle_partition_verification_response(response_data, agent)
            else:
                logger.error(f"❌ Unknown verification action: {action}")
        except Exception as e:
            logger.error(f"❌ Error handling agent verification response: {e}")


    async def _handle_disk_verification_response(self, response_data: Dict, agent):
        """Handle agent's disk verification response."""
        try:
            disk_uuid = response_data.get('disk_uuid')
            device_uuid = response_data.get('device_uuid')
            exists = response_data.get('exists', False)
            
            if not disk_uuid or not device_uuid:
                logger.error("❌ Invalid disk verification response: missing UUIDs")
                return
            
            logger.info(f"🔔 Agent disk verification: {disk_uuid} exists={exists}")
            
            if exists:
                await self._handle_disk_agent_says_exists(disk_uuid, device_uuid, agent)
            else:
                await self._handle_disk_agent_says_not_exists(disk_uuid, device_uuid, agent)
        except Exception as e:
            logger.error(f"❌ Error handling disk verification response: {e}")


    async def _handle_partition_verification_response(self, response_data: Dict, agent):
        """Handle agent's partition verification response."""
        try:
            partition_uuid = response_data.get('partition_uuid')
            device_uuid = response_data.get('device_uuid')
            exists = response_data.get('exists', False)
            
            if not partition_uuid or not device_uuid:
                logger.error("❌ Invalid partition verification response: missing UUIDs")
                return
            
            logger.info(f"🔔 Agent partition verification: {partition_uuid} exists={exists}")
            
            # Clear verification cache when agent responds
            cache_key = f"{PARTITION_VERIFICATION_CACHE_PREFIX}:{partition_uuid}"
            cache.delete(cache_key)
            
            if exists:
                await self._handle_partition_agent_says_exists(partition_uuid, device_uuid, agent)
            else:
                await self._handle_partition_agent_says_not_exists_delete(partition_uuid, device_uuid, agent)
        except Exception as e:
            logger.error(f"Error handling partition verification response: {e}")


    async def _handle_disk_agent_says_exists(self, disk_uuid: str, device_uuid: str, agent):
        """Agent confirmed disk exists - unflag it."""
        try:
            @sync_to_async
            def unflag_disk():
                with transaction.atomic():
                    updated = Storage.objects.filter(
                        uuid=disk_uuid,
                        device__uuid=device_uuid,
                        is_flagged=True
                    ).update(
                        is_flagged=False,
                        flagged_at=None,
                        flagged_reason=None
                    )
                    return updated > 0
            
            unflagged = await unflag_disk()
            if unflagged:
                logger.info(f"Agent confirmed disk {disk_uuid} EXISTS - unflagged, monitoring resumed")
                await self.event_service.create_event(
                    event_type="DISK_VERIFIED_EXISTS_BY_AGENT",
                    description=f"Agent verified disk {disk_uuid} exists - monitoring resumed",
                    agent=agent,
                    component_type="Storage",
                    component_uuid=disk_uuid,
                    additional_data={
                        "device_uuid": device_uuid,
                        "action": "unflagged_monitoring_resumed"
                    }
                )
        except Exception as e:
            logger.error(f"Error handling 'exists' response for disk {disk_uuid}: {e}")


    async def _handle_disk_agent_says_not_exists(self, disk_uuid: str, device_uuid: str, agent):
        """Agent confirmed disk doesn't exist - keep flagged."""
        try:
            logger.info(f"Agent confirmed disk {disk_uuid} DOES NOT EXIST - keeping flagged permanently")
            await self.event_service.create_event(
                event_type="DISK_VERIFIED_NOT_EXISTS_BY_AGENT",
                description=f"Agent verified disk {disk_uuid} does not exist - permanently flagged",
                agent=agent,
                component_type="Storage",
                component_uuid=disk_uuid,
                additional_data={
                    "device_uuid": device_uuid,
                    "action": "permanently_flagged_no_monitoring"
                }
            )
        except Exception as e:
            logger.error(f"Error handling 'not exists' response for disk {disk_uuid}: {e}")


    async def _handle_partition_agent_says_exists(self, partition_uuid: str, device_uuid: str, agent):
        """Agent confirmed partition exists - continue monitoring."""
        try:
            logger.info(f"Agent confirmed partition {partition_uuid} EXISTS - continuing normal monitoring")
            await self.event_service.create_event(
                event_type="PARTITION_VERIFIED_EXISTS_BY_AGENT",
                description=f"Agent verified partition {partition_uuid} exists - continuing monitoring",
                agent=agent,
                component_type="Partition",
                component_uuid=partition_uuid,
                additional_data={
                    "device_uuid": device_uuid,
                    "action": "continue_normal_monitoring"
                }
            )
        except Exception as e:
            logger.error(f"Error handling 'exists' response for partition {partition_uuid}: {e}")


    async def _handle_partition_agent_says_not_exists_delete(self, partition_uuid: str, device_uuid: str, agent):
        """Agent confirmed partition doesn't exist - DELETE it."""
        try:
            @sync_to_async
            def delete_partition():
                with transaction.atomic():
                    deleted_count, _ = Partition.objects.filter(
                        uuid=partition_uuid,
                        storage__device__uuid=device_uuid
                    ).delete()
                    return deleted_count > 0
            
            deleted = await delete_partition()
            
            if deleted:
                logger.info(f"🗑️ Agent confirmed partition {partition_uuid} DOES NOT EXIST - DELETED")
                await self.event_service.create_event(
                    event_type="PARTITION_VERIFIED_NOT_EXISTS_DELETED",
                    description=f"Agent verified partition {partition_uuid} does not exist - deleted from system",
                    agent=agent,
                    component_type="Partition",
                    component_uuid=partition_uuid,
                    additional_data={
                        "device_uuid": device_uuid,
                        "action": "deleted_from_database"
                    }
                )
            else:
                logger.warning(f"Could not delete partition {partition_uuid} (not found)")
        except Exception as e:
            logger.error(f"Error deleting partition {partition_uuid}: {e}")


    # ─────────────── Alert processing ───────────────
    async def _evaluate_disk_alerts(self, disk_uuid, utilisation, checkpoint, agent):
        """Evaluate disk utilization alerts."""
        now_time = datetime.utcnow()
        
        applicable_levels = [level for level, threshold in THRESHOLDS.items() if utilisation >= threshold]
        
        if not applicable_levels:
            self._clear_all_levels(disk_uuid)
            return
        
        for level in applicable_levels:
            await self._process_level_streak(disk_uuid, level, utilisation, now_time, checkpoint, agent)
        
        # Clear inactive levels
        all_levels = set(THRESHOLDS.keys())
        inactive_levels = all_levels - set(applicable_levels)
        for level in inactive_levels:
            key = f"{CACHE_KEY_PREFIX}:{disk_uuid}:{level}"
            if cache.get(key) is not None:
                cache.delete(key)


    async def _process_level_streak(self, disk_uuid, level, utilisation, now_time, checkpoint, agent):
        """Process streak for a specific alert level."""
        key = f"{CACHE_KEY_PREFIX}:{disk_uuid}:{level}"
        track = cache.get(key)
        
        if track is None:
            cache.set(key, {"start": now_time, "util": utilisation, "fired": False}, timeout=ALERT_CACHE_TTL)
            return
        
        if track.get("fired", False):
            return
        
        streak = (now_time - track["start"]).total_seconds() / 60
        if streak < ALERT_CONTINUOUS_MINUTES:
            return
        
        try:
            await self.alert_service.trigger_utilization_alert(
                agent=agent,
                component_type="disk",
                component_uuid=disk_uuid,
                utilization=utilisation,
                checkpoint=checkpoint,
                device_name=getattr(agent, "hostname", "Unknown Device")
            )
            
            track["fired"] = True
            cache.set(key, track, timeout=ALERT_CACHE_TTL)
            logger.info(f"[Disk] {disk_uuid} {level} alert fired at {utilisation:.1f}%")
        except Exception as exc:
            logger.error(f"[Disk] Alert trigger failed for {disk_uuid} {level}: {exc}")


    def _clear_all_levels(self, disk_uuid: str):
        """Clear all alert level streaks for a disk."""
        for level in THRESHOLDS:
            cache.delete(f"{CACHE_KEY_PREFIX}:{disk_uuid}:{level}")
