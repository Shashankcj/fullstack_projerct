import asyncio
from typing import Dict, List, Set, Optional, Callable, Union
from datetime import timedelta

from django.utils.timezone import now
from django.db import transaction
from asgiref.sync import sync_to_async
from django.conf import settings


from ...models import NIC, Port, NetworkPortMonitoring
from .alertservice import AlertService
from .unknown_handler import UnknownEntitiesService
from .eventservice import EventService
from ...signals import handle_network_monitoring
from .network_utils import (
    cache_get, cache_set, log_debug, log_info, log_warn, log_error,
    ensure_list, is_valid_uuid, get_nic_identifier, send_response_with_logging,
    determine_alert_level, execute_cache_operations, clear_lower_threshold_alerts,
    clear_all_threshold_alerts
)

# ─────────── Configuration ─────────────────────────────────────────────
_CONFIG = getattr(settings, "NETWORK_MONITORING_CONFIG", {})

CONTINUOUS_HIGH_MINUTES = _CONFIG.get(
    "ALERT_CONTINUOUS_MINUTES",
    getattr(settings, "NETWORK_ALERT_CONTINUOUS_MINUTES", 5)
)

ALERT_CACHE_TTL = _CONFIG.get(
    "ALERT_CACHE_TTL", 
    getattr(settings, "NETWORK_ALERT_CACHE_TTL", 3600)
)

CACHE_KEY_PREFIX = _CONFIG.get(
    "CACHE_KEY_PREFIX",
    "network_util_alert"
)

THRESHOLDS = _CONFIG.get(
    "THRESHOLDS",
    getattr(settings, "NETWORK_UTILIZATION_THRESHOLDS", {
        "INFO": 40.0,
        "WARNING": 60.0,
        "CRITICAL": 80.0,
    })
)
class NetworkMonitoringService:
    """
    Production-ready network monitoring service with flagging logic.
    """

    def __init__(
        self,
        alert_service: Optional[AlertService] = None,
        unknown_entities_service: Optional[UnknownEntitiesService] = None,
        event_service: Optional[EventService] = None,
    ):
        self.alert_service = alert_service or AlertService()
        self.unknown_entities_service = unknown_entities_service or UnknownEntitiesService()
        self.event_service = event_service or EventService()
        self._response_sender: Optional[Callable[[Dict], asyncio.Future]] = None
        self.sent_deletion_responses: Set[str] = set()
        self.processed_deletion_events: Set[str] = set()

    def set_response_sender(self, sender_func: Callable[[Dict], asyncio.Future]):
        """Inject WebSocket response sender."""
        self._response_sender = sender_func
        self.unknown_entities_service.set_response_sender(sender_func)
        asyncio.create_task(log_debug("[Network] Response sender configured"))

    # ───────────────────── Main processing entry point ─────────────────────
    async def process_network_data(
        self,
        data: Dict,
        checkpoint,
        agent,
        device,
        response_callback: Optional[Callable[[Dict], asyncio.Future]] = None
    ) -> Union[List[Dict], str]:
        """Main entry point for processing network monitoring data."""
        self.processed_deletion_events.clear()
        
        if response_callback:
            self.set_response_sender(response_callback)

        if 'network_monitoring' not in data:
            return [{'status': 'error', 'message': 'Network monitoring data not provided'}]

        device_uuid = str(device.uuid)
        network_data = ensure_list(data['network_monitoring'])
        incoming_port_uuids: Set[str] = set()
        incoming_nic_uuids: Set[str] = set()
        results, unknowns = [], []

        try:
            # Process ports (including flagging logic)
            port_results = await self._process_ports_bulk(
                network_data, checkpoint, device_uuid, unknowns,
                incoming_port_uuids, incoming_nic_uuids, agent
            )
            results.extend(port_results)

            # Handle unknown entities
            if unknowns:
                await log_debug("[Network] Detected %d unknown entities", len(unknowns))
                await self.unknown_entities_service.handle_unknown_entities(device_uuid, unknowns)

            # Handle missing entities with flagging approach
            await self._handle_post_processing_with_flagging(
                agent, device, incoming_port_uuids, incoming_nic_uuids
            )

            await log_info("[Network] Processed %d network items for device %s", 
                          len(network_data), device_uuid)
            return results

        except Exception as e:
            await log_error("[Network] Failed to process network data for device %s: %s", 
                           device_uuid, e, exc_info=True)
            return [{'status': 'error', 'message': f'Processing failed: {str(e)}'}]

    # ───────────────────── Port processing with flagging ─────────────────────
    async def _process_ports_bulk(
        self, network_data, checkpoint, device_uuid,
        unknowns, incoming_port_uuids, incoming_nic_uuids, agent
    ):
        """Bulk process network ports with corrected flagging logic."""
        if not network_data:
            return []

        valid_ports, invalid_results = self._validate_ports(network_data, device_uuid, unknowns)
        if not valid_ports:
            return invalid_results

        valid_port_uuids = [item['port_uuid'].strip().lower() for item in valid_ports]

        try:
            # Fetch existing ports
            ports_queryset = await sync_to_async(
                lambda: list(
                    Port.objects.select_related("nic").filter(uuid__in=valid_port_uuids)
                )
            )()

            existing_ports = {
                str(port.uuid).strip().lower(): port for port in ports_queryset
            }

            monitoring_records, valid_results = [], []

            for item in valid_ports:
                port_uuid = item['port_uuid'].strip().lower()
                port_data = item['port_data']

                if port_uuid in existing_ports:
                    port = existing_ports[port_uuid]
                    
                    # CRITICAL FIX: Unflag reappeared ports IMMEDIATELY
                    if port.is_flagged:
                        await log_info("Port %s reappeared in data - unflagging immediately and resuming monitoring", port_uuid)
                        unflagged = await self._unflag_reappeared_port(port_uuid, device_uuid, agent)
                        
                        if unflagged:
                            # Update the local port object to reflect unflagged state
                            port.is_flagged = False
                            port.flagged_at = None
                            port.flagged_reason = None
                            await log_info("Port %s successfully unflagged - monitoring resumed", port_uuid)
                        else:
                            await log_warn("Failed to unflag port %s - skipping monitoring", port_uuid)
                            valid_results.append({
                                'uuid': port_uuid, 
                                'status': 'error_unflagging',
                                'message': 'Failed to unflag reappeared port'
                            })
                            continue
                    
                    # Continue normal monitoring for all existing ports (now unflagged if they were flagged)
                    incoming_port_uuids.add(port_uuid)
                    incoming_nic_uuids.add(str(port.nic.uuid).strip().lower())

                    record = await self._create_monitoring_record(port, port_uuid, port_data, checkpoint)
                    if record:
                        monitoring_records.append(record)
                        valid_results.append({'uuid': port_uuid, 'status': 'success'})
                else:
                    self._handle_port_not_found(port_uuid, device_uuid, item['interface'], unknowns, invalid_results)

            # Bulk create and process alerts
            if monitoring_records:
                await self._bulk_create_and_process_alerts(monitoring_records, checkpoint, agent)

            return invalid_results + valid_results

        except Exception as e:
            await log_error("[Network] Failed to bulk process network ports: %s", e, exc_info=True)
            return invalid_results + [
                {'uuid': item['port_uuid'], 'status': f'error: {str(e)}'} for item in valid_ports
            ]

    # ───────────────────── Post-processing with flagging ─────────────────────
    async def _handle_post_processing_with_flagging(
        self, agent, device, incoming_port_uuids: Set[str], incoming_nic_uuids: Set[str]
    ):
        """Handle missing entities with corrected flagging approach."""
        device_uuid = str(device.uuid)
        
        # Fetch all known entities
        port_cache, nic_cache = await self._bulk_fetch_network_objects(device_uuid)
        
        # Find missing entities
        all_known_port_uuids = set(port_cache.keys())
        all_known_nic_uuids = set(nic_cache.keys())
        
        missing_port_uuids = all_known_port_uuids - incoming_port_uuids
        missing_nic_uuids = all_known_nic_uuids - incoming_nic_uuids
        
        # Filter out already flagged entities from missing ones (avoid duplicate flagging)
        newly_missing_ports = {
            uuid for uuid in missing_port_uuids 
            if not port_cache.get(uuid, {}).is_flagged
        }
        newly_missing_nics = {
            uuid for uuid in missing_nic_uuids 
            if not nic_cache.get(uuid, {}).is_flagged
        }

        # Find NICs that need unflagging (reappeared NICs)
        reappeared_nic_uuids = set()
        for nic_uuid in incoming_nic_uuids:
            nic = nic_cache.get(nic_uuid)
            if nic and nic.is_flagged:
                reappeared_nic_uuids.add(nic_uuid)

        # Handle newly missing entities (flag only newly missing ones)
        tasks = []
        if newly_missing_ports:
            await log_info("Found %d newly missing ports: %s", len(newly_missing_ports), newly_missing_ports)
            tasks.extend([
                self._flag_missing_port(port_uuid, device_uuid, agent) 
                for port_uuid in newly_missing_ports
            ])
            
        if newly_missing_nics:
            await log_info("Found %d newly missing NICs: %s", len(newly_missing_nics), newly_missing_nics)
            tasks.extend([
                self._flag_missing_nic(nic_uuid, device_uuid, agent) 
                for nic_uuid in newly_missing_nics
            ])

        # Handle reappeared NICs (unflag them)
        if reappeared_nic_uuids:
            await log_info("Found %d reappeared NICs: %s", len(reappeared_nic_uuids), reappeared_nic_uuids)
            tasks.extend([
                self._unflag_reappeared_nic(nic_uuid, device_uuid, agent) 
                for nic_uuid in reappeared_nic_uuids
            ])

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def _bulk_fetch_network_objects(self, device_uuid: str) -> tuple[Dict, Dict]:
        """Cache all ports and NICs for this device."""
        try:
            port_query = Port.objects.select_related("nic").filter(nic__device__uuid=device_uuid)
            nic_query = NIC.objects.select_related("device").filter(device__uuid=device_uuid)

            ports, nics = await asyncio.gather(
                sync_to_async(list)(port_query),
                sync_to_async(list)(nic_query),
            )

            port_cache = {str(p.uuid): p for p in ports}
            nic_cache = {str(n.uuid): n for n in nics}

            await log_debug("Cached %d ports and %d NICs for device %s", 
                           len(port_cache), len(nic_cache), device_uuid)
            return port_cache, nic_cache
            
        except Exception as exc:
            await log_error("Bulk-fetch network objects error: %s", exc)
            return {}, {}

    # ───────────────────── Port flagging methods ─────────────────────
    async def _flag_missing_port(self, port_uuid: str, device_uuid: str, agent):
        """Flag missing port and send verification request."""
        try:
            @sync_to_async
            def flag_port():
                with transaction.atomic():
                    now_time = now()
                    agent_hostname = getattr(agent, 'hostname', 'unknown')
                    reason = f"Port missing from monitoring data. Agent: {agent_hostname}. Detected at: {now_time.strftime('%Y-%m-%d %H:%M:%S UTC')}"
                    
                    updated = Port.objects.filter(
                        uuid=port_uuid,
                        nic__device__uuid=device_uuid,
                        is_flagged=False
                    ).update(
                        is_flagged=True,
                        flagged_at=now_time,
                        flagged_reason=reason
                    )
                    return updated > 0
            
            flagged = await flag_port()
            
            if flagged:
                await log_info("Flagged missing port %s with timestamp and reason", port_uuid)
                await self._send_simple_verification_request('verify_port_existence', port_uuid, device_uuid)
                
        except Exception as e:
            await log_error("Error flagging port %s: %s", port_uuid, e)

    async def _unflag_reappeared_port(self, port_uuid: str, device_uuid: str, agent) -> bool:
        """Unflag reappeared port and clear timestamp/reason. Returns True if successful."""
        try:
            @sync_to_async
            def unflag_port():
                with transaction.atomic():
                    updated = Port.objects.filter(
                        uuid=port_uuid,
                        nic__device__uuid=device_uuid,
                        is_flagged=True
                    ).update(
                        is_flagged=False,
                        flagged_at=None,
                        flagged_reason=None
                    )
                    return updated > 0
            
            unflagged = await unflag_port()
            
            if unflagged:
                await log_info("Unflagged reappeared port %s - monitoring resumed", port_uuid)
                return True
            else:
                await log_warn("Port %s was not flagged or unflag failed", port_uuid)
                return False
                
        except Exception as e:
            await log_error("Error unflagging reappeared port %s: %s", port_uuid, e)
            return False

    # ───────────────────── NIC flagging methods ─────────────────────
    async def _flag_missing_nic(self, nic_uuid: str, device_uuid: str, agent):
        """Flag missing NIC and send verification request."""
        try:
            @sync_to_async
            def flag_nic():
                with transaction.atomic():
                    now_time = now()
                    agent_hostname = getattr(agent, 'hostname', 'unknown')
                    reason = f"NIC missing from monitoring data. Agent: {agent_hostname}. Detected at: {now_time.strftime('%Y-%m-%d %H:%M:%S UTC')}"
                    
                    updated = NIC.objects.filter(
                        uuid=nic_uuid,
                        device__uuid=device_uuid,
                        is_flagged=False
                    ).update(
                        is_flagged=True,
                        flagged_at=now_time,
                        flagged_reason=reason
                    )
                    return updated > 0
            
            flagged = await flag_nic()
            
            if flagged:
                await log_info("Flagged missing NIC %s with timestamp and reason", nic_uuid)
                await self._send_simple_verification_request('verify_nic_existence', nic_uuid, device_uuid)
                
        except Exception as e:
            await log_error("Error flagging NIC %s: %s", nic_uuid, e)

    async def _unflag_reappeared_nic(self, nic_uuid: str, device_uuid: str, agent) -> bool:
        """Unflag reappeared NIC and clear timestamp/reason. Returns True if successful."""
        try:
            @sync_to_async
            def unflag_nic():
                with transaction.atomic():
                    updated = NIC.objects.filter(
                        uuid=nic_uuid,
                        device__uuid=device_uuid,
                        is_flagged=True
                    ).update(
                        is_flagged=False,
                        flagged_at=None,
                        flagged_reason=None
                    )
                    return updated > 0
            
            unflagged = await unflag_nic()
            
            if unflagged:
                await log_info("Unflagged reappeared NIC %s - monitoring resumed", nic_uuid)
                return True
            else:
                await log_warn("NIC %s was not flagged or unflag failed", nic_uuid)
                return False
                
        except Exception as e:
            await log_error("Error unflagging reappeared NIC %s: %s", nic_uuid, e)
            return False

    # ───────────────────── Simplified verification request ─────────────────────
    async def _send_simple_verification_request(self, action: str, component_uuid: str, device_uuid: str):
        """Send simplified verification request to agent."""
        try:
            verification_request = {
                'action': action,
                f"{action.split('_')[1]}_uuid": component_uuid,  # port_uuid or nic_uuid
                'device_uuid': device_uuid
            }
            
            await send_response_with_logging(self._response_sender, verification_request)
            await log_info("Sent verification request: %s for %s", action, component_uuid)
            
        except Exception as e:
            await log_error("Error sending verification for %s: %s", component_uuid, e)

    # ───────────────────── Agent verification response handlers ─────────────────────
    async def handle_agent_verification_response(self, response_data: Dict, agent):
        """Handle agent's verification response for ports or NICs."""
        try:
            action = response_data.get('action', '')
            exists = response_data.get('exists', False)
            
            if action == 'verify_port_existence':
                port_uuid = response_data.get('port_uuid')
                device_uuid = response_data.get('device_uuid')
                await self._handle_port_verification_response(port_uuid, device_uuid, exists, agent)
                
            elif action == 'verify_nic':
                nic_uuid = response_data.get('nic_uuid')
                device_uuid = response_data.get('device_uuid')
                await self._handle_nic_verification_response(nic_uuid, device_uuid, exists, agent)
                
        except Exception as e:
            await log_error("Error handling agent verification response: %s", e)

    async def _handle_port_verification_response(self, port_uuid: str, device_uuid: str, exists: bool, agent):
        """Handle agent's port verification response."""
        try:
            await log_info("Agent port verification: %s exists=%s", port_uuid, exists)
            
            if exists:
                # Agent confirmed port exists - unflag it
                unflagged = await self._unflag_reappeared_port(port_uuid, device_uuid, agent)
                if unflagged:
                    await log_info("Agent confirmed port %s EXISTS - unflagged, monitoring resumed", port_uuid)
                    
            else:
                # Agent confirmed port doesn't exist - keep flagged
                await log_info("Agent confirmed port %s DOES NOT EXIST - keeping flagged permanently", port_uuid)
                
        except Exception as e:
            await log_error("Error handling port verification response: %s", e)

    async def _handle_nic_verification_response(self, nic_uuid: str, device_uuid: str, exists: bool, agent):
        """Handle agent's NIC verification response."""
        try:
            await log_info("Agent NIC verification: %s exists=%s", nic_uuid, exists)
            
            if exists:
                # Agent confirmed NIC exists - unflag it
                unflagged = await self._unflag_reappeared_nic(nic_uuid, device_uuid, agent)
                if unflagged:
                    await log_info("Agent confirmed NIC %s EXISTS - unflagged, monitoring resumed", nic_uuid)
                    
            else:
                # Agent confirmed NIC doesn't exist - keep flagged
                await log_info("Agent confirmed NIC %s DOES NOT EXIST - keeping flagged permanently", nic_uuid)
                
        except Exception as e:
            await log_error("Error handling NIC verification response: %s", e)

    # ───────────────────── Validation methods ─────────────────────
    def _validate_ports(self, network_data, device_uuid, unknowns):
        """Validate port data and separate valid from invalid."""
        valid_ports, invalid_results = [], []

        for port_data in network_data:
            port_uuid = port_data.get("port_uuid", "").strip().lower()
            interface = port_data.get("interface", "")

            if not port_uuid or port_uuid == "unknown":
                self._handle_unknown_port(port_uuid or 'unknown', device_uuid, interface, unknowns, invalid_results)
            elif not is_valid_uuid(port_uuid):
                self._handle_invalid_uuid(port_uuid, device_uuid, interface, unknowns, invalid_results)
            else:
                valid_ports.append({'port_data': port_data, 'port_uuid': port_uuid, 'interface': interface})

        return valid_ports, invalid_results

    def _handle_unknown_port(self, port_uuid, device_uuid, interface, unknowns, invalid_results):
        """Handle unknown port UUID."""
        asyncio.create_task(log_warn("[Network] Unknown port UUID detected for interface: %s", interface))
        unknowns.append({'type': 'port', 'port_uuid': port_uuid, 'device_uuid': device_uuid, 'interface': interface})
        invalid_results.append({
            'uuid': port_uuid, 'status': 'error: unknown port',
            'action': {'map_port_to_uuid': True, 'device_uuid': device_uuid, 'interface': interface}
        })
    
    def _handle_invalid_uuid(self, port_uuid, device_uuid, interface, unknowns, invalid_results):
        """Handle invalid UUID format."""
        asyncio.create_task(log_warn("[Network] Invalid UUID format for port: %s", port_uuid))
        unknowns.append({'type': 'port', 'port_uuid': port_uuid, 'device_uuid': device_uuid, 'interface': interface})
        invalid_results.append({'uuid': port_uuid, 'status': 'error: invalid UUID'})
    
    def _handle_port_not_found(self, port_uuid, device_uuid, interface, unknowns, invalid_results):
        """Handle port not found in database."""
        asyncio.create_task(log_warn("[Network] Port not found for UUID: %s", port_uuid))
        unknowns.append({'type': 'port', 'port_uuid': port_uuid, 'device_uuid': device_uuid, 'interface': interface})
        invalid_results.append({'uuid': port_uuid, 'status': 'error: not found'})

    # ───────────────────── Monitoring record creation ─────────────────────
    async def _create_monitoring_record(self, port, port_uuid, port_data, checkpoint):
        try:
            bytes_sent = int(port_data.get('bytes_sent', 0))
            bytes_received = int(port_data.get('bytes_received', 0))

            utilization = float(port_data.get('network_utilization', 0.0))
            if utilization < 0 or utilization > 100:
                utilization = max(0.0, min(100.0, utilization))

            return {
                'record': NetworkPortMonitoring(
                    uuid=port_uuid,
                    checkpoint=checkpoint,
                    port=port,
                    bytes_sent=bytes_sent,
                    bytes_received=bytes_received,
                    packet_sent=int(port_data.get('packets_sent', 0)),
                    packet_received=int(port_data.get('packets_received', 0)),
                    error_in=int(port_data.get('error_in', 0)),
                    error_out=int(port_data.get('error_out', 0)),
                    drop_in=int(port_data.get('drop_in', 0)),
                    drop_out=int(port_data.get('drop_out', 0)),
                    network_utilization=utilization
                ),
                'port': port,
                'port_uuid': port_uuid,
            }
        except Exception as e:
            await log_error("[Network] Failed to create monitoring record for %s: %s", port_uuid, e)
            return None

    async def _bulk_create_and_process_alerts(self, monitoring_records, checkpoint, agent):
        """Bulk create monitoring records and process utilization alerts."""
        try:
            valid_records = [r for r in monitoring_records if r is not None]
            if not valid_records:
                return
            
            # Bulk create monitoring records
            record_objects = [r['record'] for r in valid_records]
            await sync_to_async(NetworkPortMonitoring.objects.bulk_create)(record_objects)
            for instance in record_objects:
                await sync_to_async(handle_network_monitoring)(instance)
            
            # Process utilization alerts
            await self._process_utilization_alerts(valid_records, checkpoint, agent)
            
        except Exception as e:
            await log_error("[Network] Failed to bulk create monitoring records: %s", e, exc_info=True)
            raise

    # ───────────────────── Alert processing ─────────────────────
    async def _process_utilization_alerts(self, monitoring_records, checkpoint, agent):
        """Process utilization alerts using incoming utilization data."""
        try:
            cache_ops, alerts = [], []
            
            info_threshold = THRESHOLDS.get("INFO", 40.0)
            warning_threshold = THRESHOLDS.get("WARNING", 60.0)
            critical_threshold = THRESHOLDS.get("CRITICAL", 80.0)

            for record_data in monitoring_records:
                port, port_uuid = record_data['port'], record_data['port_uuid']
                utilization = record_data['record'].network_utilization
                
                await log_debug("[Network] Processing alert for port %s with utilization: %.2f%%", 
                               port_uuid, utilization)
                
                alert_level = determine_alert_level(utilization, info_threshold, warning_threshold, critical_threshold)
                
                if alert_level:
                    cache_key = f"network_util_alert:{port_uuid}:{alert_level}"
                    now_time = now()
                    first_seen = await cache_get(cache_key)
                    
                    if not first_seen:
                        cache_ops.append(('set', cache_key, now_time, 3600))
                        await log_debug("Started tracking %s threshold for %s: %.1f%%", 
                                       alert_level, port_uuid, utilization)
                        await clear_lower_threshold_alerts(port_uuid, alert_level, cache_ops)
                        
                    elif now_time - first_seen >= timedelta(minutes=CONTINUOUS_HIGH_MINUTES):
                        alerts.append({
                            'device_name': agent.hostname if agent else "Unknown Device",
                            'component_type': 'network', 
                            'component_uuid': str(port_uuid),
                            'utilization': utilization,
                            'checkpoint': checkpoint,
                            'alert_level': alert_level,
                            'port_info': {
                                'interface_name': getattr(port, 'interface_name', 'unknown'),
                                'operating_speed': port.operating_speed,
                                'nic_identifier': get_nic_identifier(port.nic) if port.nic else 'unknown'
                            }
                        })
                        cache_ops.append(('set', cache_key, now_time, 3600))
                        await log_info("Triggering %s alert for %s: %.1f%%", alert_level, port_uuid, utilization)
                    else:
                        time_remaining = CONTINUOUS_HIGH_MINUTES - (now_time - first_seen).total_seconds() / 60
                        await log_debug("%s alert delay active for %s, %.1f minutes remaining", 
                                       alert_level, port_uuid, time_remaining)
                else:
                    await clear_all_threshold_alerts(port_uuid, cache_ops)
                    await log_debug("[Network] Port %s utilization %.1f%% is below thresholds, clearing alerts", 
                                   port_uuid, utilization)
            
            await execute_cache_operations(cache_ops)
            if alerts:
                await self._trigger_threshold_alerts(alerts)
                
        except Exception as e:
            await log_error("[Network] Failed to process utilization alerts: %s", e, exc_info=True)

    async def _trigger_threshold_alerts(self, alerts_data: List[Dict]):
        """Trigger threshold-based utilization alerts."""
        try:
            for alert_data in alerts_data:
                await log_info("[Network] Triggering alert for port %s with %.2f%% utilization", 
                              alert_data['component_uuid'], alert_data['utilization'])
                
                await self.alert_service.trigger_utilization_alert(
                    agent=alert_data.get('agent'),
                    component_type="network",
                    component_uuid=alert_data['component_uuid'],
                    utilization=alert_data['utilization'],
                    checkpoint=alert_data['checkpoint'],
                    device_name=alert_data['device_name']
                )    
                
                if self._response_sender:
                    await send_response_with_logging(self._response_sender, {
                        'action': 'network_utilization_alert',
                        'port_uuid': alert_data['component_uuid'],
                        'utilization': round(alert_data['utilization'], 2),
                        'alert_level': alert_data['alert_level'],
                        'device_name': alert_data['device_name'],
                        'port_info': alert_data.get('port_info', {}),
                        'timestamp': now().isoformat(),
                        'data_source': 'incoming'
                    })
                    
        except Exception as e:
            await log_error("[Network] Failed to trigger threshold alerts: %s", e, exc_info=True)
