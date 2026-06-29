from django.utils import timezone
from django.db import models
from BaseApp.models import Port


class PortFlagService:
    @staticmethod
    def get_flagged_port_devices(unviewed_only=False):
        """Get flagged ports with timestamp and reason (no severity)."""
        try:
            results = []

            # Build base filter with optional unviewed filter
            port_filter = {'is_flagged': True}
            if unviewed_only:
                port_filter['is_viewed'] = False

            # Get flagged ports with agent uuid through NIC relationship
            flagged_ports = Port.objects.select_related('nic__device__agent').filter(
                **port_filter
            ).order_by('-flagged_at')

            for port in flagged_ports:
                missing_duration = PortFlagService._format_missing_duration(port.flagged_at)

                # Get device name through NIC relationship
                device_name = PortFlagService._get_device_name(port.nic.device if port.nic else None)

                result = {
                    'uuid': str(port.uuid),
                    'agent_uuid': str(port.nic.device.agent.uuid) if port.nic and port.nic.device and port.nic.device.agent else 'unknown',
                    'entity_type': 'port',
                    'status': 'flagged_awaiting_verification',
                    'is_flagged': True,
                    'flagged_at': port.flagged_at.isoformat() if port.flagged_at else None,
                    'flagged_reason': port.flagged_reason or 'Port flagged for verification',
                    'missing_duration': missing_duration,
                    'verification_status': 'pending',

                    # Viewing tracking fields
                    'is_viewed': getattr(port, 'is_viewed', False),
                    'viewed_at': port.viewed_at.isoformat() if getattr(port, 'viewed_at', None) else None,
                    'viewed_by': str(port.viewed_by.uuid) if getattr(port, 'viewed_by', None) else None,

                    # Port-specific details (ONLY from Port model)
                    'interface_name': port.name,
                    'operating_speed': port.operating_speed,
                    'is_physical_logical': port.is_physical_logical,
                    'logical_type': port.logical_type if port.is_physical_logical == 'logical' else None,
                    
                    # Relationship info (through NIC)
                    'nic_uuid': str(port.nic.uuid) if port.nic else 'unknown',
                    'device_name': device_name,
                }
                results.append(result)

            return results

        except Exception as e:
            raise Exception(f"Error getting flagged port devices: {str(e)}")

    @staticmethod
    def get_flagged_ports_by_type(port_type, unviewed_only=False):
        """Get flagged ports filtered by type (physical/logical) with optional unviewed filter."""
        try:
            results = []

            # Build filter
            port_filter = {
                'is_flagged': True,
                'is_physical_logical': port_type
            }
            if unviewed_only:
                port_filter['is_viewed'] = False

            flagged_ports = Port.objects.select_related('nic__device__agent').filter(
                **port_filter
            ).order_by('-flagged_at')

            for port in flagged_ports:
                missing_duration = PortFlagService._format_missing_duration(port.flagged_at)
                device_name = PortFlagService._get_device_name(port.nic.device if port.nic else None)

                result = {
                    'uuid': str(port.uuid),
                    'agent_uuid': str(port.nic.device.agent.uuid) if port.nic and port.nic.device and port.nic.device.agent else 'unknown',
                    'entity_type': 'port',
                    'status': 'flagged_awaiting_verification',
                    'is_flagged': True,
                    'flagged_at': port.flagged_at.isoformat() if port.flagged_at else None,
                    'flagged_reason': port.flagged_reason or 'Port flagged for verification',
                    'missing_duration': missing_duration,
                    'verification_status': 'pending',

                    # Viewing tracking fields
                    'is_viewed': getattr(port, 'is_viewed', False),
                    'viewed_at': port.viewed_at.isoformat() if getattr(port, 'viewed_at', None) else None,
                    'viewed_by': str(port.viewed_by.uuid) if getattr(port, 'viewed_by', None) else None,

                    # Port-specific details
                    'interface_name': port.name,
                    'operating_speed': port.operating_speed,
                    'is_physical_logical': port.is_physical_logical,
                    'logical_type': port.logical_type if port.is_physical_logical == 'logical' else None,
                    
                    # Relationship info
                    'nic_uuid': str(port.nic.uuid) if port.nic else 'unknown',
                    'device_name': device_name,
                }
                results.append(result)

            return results

        except Exception as e:
            raise Exception(f"Error getting flagged ports by type: {str(e)}")

    @staticmethod
    def get_flagged_ports_by_type_and_logical(port_type, logical_type, unviewed_only=False):
        """Get flagged ports filtered by both port type and logical type with optional unviewed filter."""
        try:
            results = []

            # Build filter
            port_filter = {
                'is_flagged': True,
                'is_physical_logical': port_type,
                'logical_type': logical_type
            }
            if unviewed_only:
                port_filter['is_viewed'] = False

            flagged_ports = Port.objects.select_related('nic__device__agent').filter(
                **port_filter
            ).order_by('-flagged_at')

            for port in flagged_ports:
                missing_duration = PortFlagService._format_missing_duration(port.flagged_at)
                device_name = PortFlagService._get_device_name(port.nic.device if port.nic else None)

                result = {
                    'uuid': str(port.uuid),
                    'agent_uuid': str(port.nic.device.agent.uuid) if port.nic and port.nic.device and port.nic.device.agent else 'unknown',
                    'entity_type': 'port',
                    'status': 'flagged_awaiting_verification',
                    'is_flagged': True,
                    'flagged_at': port.flagged_at.isoformat() if port.flagged_at else None,
                    'flagged_reason': port.flagged_reason or 'Port flagged for verification',
                    'missing_duration': missing_duration,
                    'verification_status': 'pending',

                    # Viewing tracking fields
                    'is_viewed': getattr(port, 'is_viewed', False),
                    'viewed_at': port.viewed_at.isoformat() if getattr(port, 'viewed_at', None) else None,
                    'viewed_by': str(port.viewed_by.uuid) if getattr(port, 'viewed_by', None) else None,

                    # Port-specific details
                    'interface_name': port.name,
                    'operating_speed': port.operating_speed,
                    'is_physical_logical': port.is_physical_logical,
                    'logical_type': port.logical_type,
                    
                    # Relationship info
                    'nic_uuid': str(port.nic.uuid) if port.nic else 'unknown',
                    'device_name': device_name,
                }
                results.append(result)

            return results

        except Exception as e:
            raise Exception(f"Error getting flagged ports by type and logical: {str(e)}")

    @staticmethod
    def mark_port_as_viewed(entity_uuid, user=None):
        """Mark a port as viewed"""
        try:
            updated = Port.objects.filter(
                uuid=entity_uuid,
                is_flagged=True
            ).update(
                is_viewed=True,
                viewed_at=timezone.now(),
                viewed_by=user
            )

            return updated > 0

        except Exception as e:
            raise Exception(f"Error marking port as viewed: {str(e)}")

    @staticmethod
    def mark_port_as_unviewed(entity_uuid):
        """Mark a port as unviewed"""
        try:
            updated = Port.objects.filter(
                uuid=entity_uuid,
                is_flagged=True
            ).update(
                is_viewed=False,
                viewed_at=None,
                viewed_by=None
            )

            return updated > 0

        except Exception as e:
            raise Exception(f"Error marking port as unviewed: {str(e)}")

    @staticmethod
    def bulk_mark_ports_viewed(entity_uuids, user=None, mark_viewed=True):
        """Bulk mark multiple ports as viewed/unviewed"""
        try:
            update_fields = {
                'is_viewed': mark_viewed,
                'viewed_at': timezone.now() if mark_viewed else None,
                'viewed_by': user if mark_viewed else None
            }

            updated = Port.objects.filter(
                uuid__in=entity_uuids,
                is_flagged=True
            ).update(**update_fields)

            return {
                'ports_updated': updated,
                'total_updated': updated
            }

        except Exception as e:
            raise Exception(f"Error bulk marking ports as {'viewed' if mark_viewed else 'unviewed'}: {str(e)}")

    @staticmethod
    def unflag_device(entity_uuid, agent_uuid, entity_type='port'):
        """Manually unflag a port using agent uuid through NIC relationship."""
        try:
            if entity_type.lower() == 'port':
                updated = Port.objects.filter(
                    uuid=entity_uuid,
                    nic__device__agent__uuid=agent_uuid,  # Through NIC to get agent
                    is_flagged=True
                ).update(
                    is_flagged=False,
                    flagged_at=None,
                    flagged_reason=None,
                    is_viewed=False,  # Reset viewed status when unflagging
                    viewed_at=None,
                    viewed_by=None
                )
            else:
                return False

            return updated > 0
        except Exception as e:
            raise Exception(f"Error unflagging {entity_type}: {str(e)}")

    @staticmethod
    def get_flagged_port_stats(include_viewed=True):
        """Get statistics about flagged ports with viewing breakdown."""
        try:
            flagged_ports = Port.objects.filter(is_flagged=True).count()
            total_flagged = flagged_ports

            # Viewed counts
            viewed_ports = Port.objects.filter(is_flagged=True, is_viewed=True).count()
            unviewed_ports = flagged_ports - viewed_ports

            # Physical vs Logical breakdown
            flagged_physical = Port.objects.filter(
                is_flagged=True,
                is_physical_logical='physical'
            ).count()

            flagged_logical = Port.objects.filter(
                is_flagged=True,
                is_physical_logical='logical'
            ).count()

            # Viewed breakdown by type
            viewed_physical = Port.objects.filter(
                is_flagged=True,
                is_viewed=True,
                is_physical_logical='physical'
            ).count()

            viewed_logical = Port.objects.filter(
                is_flagged=True,
                is_viewed=True,
                is_physical_logical='logical'
            ).count()

            return {
                'total_flagged': total_flagged,
                'flagged_ports': flagged_ports,
                'total_viewed': viewed_ports,
                'total_unviewed': unviewed_ports,
                'verification_status': {
                    'pending': unviewed_ports,
                    'viewed': viewed_ports,
                    'verified_missing': 0,
                    'verified_exists': 0
                },
                'port_type_breakdown': {
                    'physical': flagged_physical,
                    'logical': flagged_logical,
                    'viewed_physical': viewed_physical,
                    'viewed_logical': viewed_logical,
                    'unviewed_physical': flagged_physical - viewed_physical,
                    'unviewed_logical': flagged_logical - viewed_logical
                },
                'last_updated': timezone.now().isoformat()
            }

        except Exception as e:
            raise Exception(f"Error getting flagged port stats: {str(e)}")

    @staticmethod
    def flag_port_device(entity_uuid, agent_uuid, reason="Port flagged for verification"):
        """Flag a port for verification using agent uuid through NIC relationship."""
        try:
            updated = Port.objects.filter(
                uuid=entity_uuid,
                nic__device__agent__uuid=agent_uuid  # Through NIC to get agent
            ).update(
                is_flagged=True,
                flagged_at=timezone.now(),
                flagged_reason=reason,
                is_viewed=False,  # Reset viewed status when flagging
                viewed_at=None,
                viewed_by=None
            )

            return updated > 0
        except Exception as e:
            raise Exception(f"Error flagging port: {str(e)}")

    @staticmethod
    def _format_missing_duration(flagged_at):
        """Return missing duration in human-readable form, starting from minutes."""
        if not flagged_at:
            return "Unknown"

        delta = timezone.now() - flagged_at
        minutes = int(delta.total_seconds() // 60)

        if minutes < 60:
            return f"{minutes} minute{'s' if minutes != 1 else ''}"
        hours = minutes // 60
        if hours < 24:
            return f"{hours} hour{'s' if hours != 1 else ''}"
        days = hours // 24
        hours = hours % 24
        return f"{days} day{'s' if days != 1 else ''}, {hours} hour{'s' if hours != 1 else ''}"

    @staticmethod
    def _get_device_name(device):
        """Get device name from agent hostname through NIC relationship."""
        if not device:
            return 'Unknown Device'

        try:
            if hasattr(device, 'agent') and device.agent:
                return device.agent.hostname
            return f'Device {str(device.uuid)[:8]}'
        except Exception:
            return f'Device {str(device.uuid)[:8]}'
