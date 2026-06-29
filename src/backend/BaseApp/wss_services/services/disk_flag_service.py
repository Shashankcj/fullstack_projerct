from django.utils import timezone
from django.db import models
from BaseApp.models import Storage, Partition


class FlagService:
    @staticmethod
    def get_flagged_storage_devices(unviewed_only=False):
        """UNIFIED: Get flagged disks AND partitions with timestamp and reason (no severity)."""
        try:
            results = []

            # Build base querysets with optional unviewed filter
            disk_filter = {'is_flagged': True}
            partition_filter = {'is_flagged': True}
            
            if unviewed_only:
                disk_filter['is_viewed'] = False
                partition_filter['is_viewed'] = False

            # Get flagged disks with agent uuid
            flagged_disks = Storage.objects.select_related('device__agent').filter(
                **disk_filter
            ).order_by('-flagged_at')

            for disk in flagged_disks:
                usage_percentage = FlagService._calculate_usage_percentage(disk)
                missing_duration = FlagService._format_missing_duration(disk.flagged_at)
                device_name = FlagService._get_device_name(disk.device)

                result = {
                    'uuid': str(disk.uuid),
                    'agent_uuid': str(disk.device.agent.uuid) if disk.device and disk.device.agent else 'unknown',
                    'entity_type': 'disk',
                    'status': 'flagged_awaiting_verification',
                    'is_flagged': True,
                    'flagged_at': disk.flagged_at.isoformat() if disk.flagged_at else None,
                    'flagged_reason': disk.flagged_reason or 'Disk flagged for verification',
                    'missing_duration': missing_duration,
                    'verification_status': 'pending',

                    # Viewing tracking fields
                    'is_viewed': getattr(disk, 'is_viewed', False),
                    'viewed_at': disk.viewed_at.isoformat() if getattr(disk, 'viewed_at', None) else None,
                    'viewed_by': str(disk.viewed_by.uuid) if getattr(disk, 'viewed_by', None) else None,

                    # Disk details
                    'serial_number': disk.serial_number,
                    'make': disk.make,
                    'model': disk.model,
                    'hw_disk_type': disk.hw_disk_type,
                    'base_fs_type': disk.base_fs_type,
                    'total_disk_size': disk.total_disk_size,
                    'free_space': disk.free_space,
                    'total_disk_usage': disk.total_disk_usage,
                    'allocated_disk_size': disk.allocated_disk_size,
                    'unallocated_disk_size': disk.unallocated_disk_size,
                    'usage_percentage': usage_percentage,
                    'device_name': device_name,
                }
                results.append(result)

            # Get flagged partitions with agent uuid
            flagged_partitions = Partition.objects.select_related('storage__device__agent').filter(
                **partition_filter
            ).order_by('-flagged_at')

            for partition in flagged_partitions:
                missing_duration = FlagService._format_missing_duration(partition.flagged_at)
                device_name = FlagService._get_device_name(partition.storage.device if partition.storage else None)

                result = {
                    'uuid': str(partition.uuid),
                    'agent_uuid': str(partition.storage.device.agent.uuid) if partition.storage and partition.storage.device and partition.storage.device.agent else 'unknown',
                    'entity_type': 'partition',
                    'status': 'flagged_awaiting_verification',
                    'is_flagged': True,
                    'flagged_at': partition.flagged_at.isoformat() if partition.flagged_at else None,
                    'flagged_reason': partition.flagged_reason or 'Partition flagged for verification',
                    'missing_duration': missing_duration,
                    'verification_status': 'pending',

                    # Viewing tracking fields
                    'is_viewed': getattr(partition, 'is_viewed', False),
                    'viewed_at': partition.viewed_at.isoformat() if getattr(partition, 'viewed_at', None) else None,
                    'viewed_by': str(partition.viewed_by.uuid) if getattr(partition, 'viewed_by', None) else None,

                    # Partition details
                    'partition_name': getattr(partition, 'name', getattr(partition, 'partition_name', 'unknown')),
                    'mount_point': getattr(partition, 'mount_point', 'unknown'),
                    'fs_type': partition.fs_type,
                    'total_size': partition.total_size,
                    'free_space': partition.free_space,
                    'used_space': partition.used_space,
                    'disk_uuid': str(partition.storage.uuid) if partition.storage else 'unknown',
                    'disk_serial_number': partition.storage.serial_number if partition.storage else 'unknown',
                    'device_name': device_name,
                }
                results.append(result)

            return results

        except Exception as e:
            raise Exception(f"Error getting flagged storage devices: {str(e)}")

    @staticmethod
    def mark_storage_as_viewed(entity_uuid, user=None):
        """Mark a storage device as viewed"""
        try:
            # Try to update Storage first
            storage_updated = Storage.objects.filter(
                uuid=entity_uuid,
                is_flagged=True
            ).update(
                is_viewed=True,
                viewed_at=timezone.now(),
                viewed_by=user
            )

            if storage_updated > 0:
                return True

            # If no storage found, try partition
            partition_updated = Partition.objects.filter(
                uuid=entity_uuid,
                is_flagged=True
            ).update(
                is_viewed=True,
                viewed_at=timezone.now(),
                viewed_by=user
            )

            return partition_updated > 0

        except Exception as e:
            raise Exception(f"Error marking storage as viewed: {str(e)}")

    @staticmethod
    def mark_storage_as_unviewed(entity_uuid):
        """Mark a storage device as unviewed"""
        try:
            # Try to update Storage first
            storage_updated = Storage.objects.filter(
                uuid=entity_uuid,
                is_flagged=True
            ).update(
                is_viewed=False,
                viewed_at=None,
                viewed_by=None
            )

            if storage_updated > 0:
                return True

            # If no storage found, try partition
            partition_updated = Partition.objects.filter(
                uuid=entity_uuid,
                is_flagged=True
            ).update(
                is_viewed=False,
                viewed_at=None,
                viewed_by=None
            )

            return partition_updated > 0

        except Exception as e:
            raise Exception(f"Error marking storage as unviewed: {str(e)}")

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
        """Get device name from agent hostname."""
        if not device:
            return 'Unknown Device'

        try:
            if hasattr(device, 'agent') and device.agent:
                return device.agent.hostname
            return f'Device {str(device.uuid)[:8]}'
        except Exception:
            return f'Device {str(device.uuid)[:8]}'

    @staticmethod
    def unflag_device(entity_uuid, agent_uuid, entity_type='disk'):
        """Manually unflag a disk or partition (admin override) using agent uuid."""
        try:
            if entity_type.lower() == 'disk':
                updated = Storage.objects.filter(
                    uuid=entity_uuid,
                    device__agent__uuid=agent_uuid,
                    is_flagged=True
                ).update(
                    is_flagged=False,
                    flagged_at=None,
                    flagged_reason=None,
                    is_viewed=False,  # Reset viewed status when unflagging
                    viewed_at=None,
                    viewed_by=None
                )
            elif entity_type.lower() == 'partition':
                updated = Partition.objects.filter(
                    uuid=entity_uuid,
                    storage__device__agent__uuid=agent_uuid,
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
    def _calculate_usage_percentage(storage_device):
        """Calculate storage usage percentage from string values."""
        try:
            total_parts = storage_device.total_disk_size.strip().split()
            if len(total_parts) != 2:
                return 0
            total_value = float(total_parts[0])

            usage_parts = storage_device.total_disk_usage.strip().split()
            if len(usage_parts) != 2:
                return 0
            usage_value = float(usage_parts[0])

            return round((usage_value / total_value) * 100, 2) if total_value > 0 else 0
        except (ValueError, IndexError, AttributeError):
            return 0

    @staticmethod
    def get_flagged_storage_stats(include_viewed=True):
        """Get statistics about flagged storage devices with viewing breakdown."""
        try:
            # Base counts
            flagged_disks = Storage.objects.filter(is_flagged=True).count()
            flagged_partitions = Partition.objects.filter(is_flagged=True).count()
            total_flagged = flagged_disks + flagged_partitions

            # Viewed counts
            viewed_disks = Storage.objects.filter(is_flagged=True, is_viewed=True).count()
            viewed_partitions = Partition.objects.filter(is_flagged=True, is_viewed=True).count()
            total_viewed = viewed_disks + viewed_partitions

            # Unviewed counts
            unviewed_disks = flagged_disks - viewed_disks
            unviewed_partitions = flagged_partitions - viewed_partitions
            total_unviewed = total_flagged - total_viewed

            stats = {
                'total_flagged': total_flagged,
                'flagged_disks': flagged_disks,
                'flagged_partitions': flagged_partitions,
                'total_viewed': total_viewed,
                'viewed_disks': viewed_disks,
                'viewed_partitions': viewed_partitions,
                'total_unviewed': total_unviewed,
                'unviewed_disks': unviewed_disks,
                'unviewed_partitions': unviewed_partitions,
                'verification_status': {
                    'pending': total_unviewed,
                    'viewed': total_viewed,
                    'verified_missing': 0,
                    'verified_exists': 0
                },
                'last_updated': timezone.now().isoformat()
            }

            return stats

        except Exception as e:
            raise Exception(f"Error getting flagged storage stats: {str(e)}")

    @staticmethod
    def get_flagged_devices_by_entity_type(entity_type='disk', unviewed_only=False):
        """Get flagged devices by specific entity type with optional unviewed filter."""
        try:
            base_filter = {'is_flagged': True}
            if unviewed_only:
                base_filter['is_viewed'] = False

            if entity_type.lower() == 'disk':
                return [
                    {
                        'uuid': str(disk.uuid),
                        'agent_uuid': str(disk.device.agent.uuid) if disk.device and disk.device.agent else 'unknown',
                        'entity_type': 'disk',
                        'flagged_at': disk.flagged_at.isoformat() if disk.flagged_at else None,
                        'flagged_reason': disk.flagged_reason,
                        'is_viewed': getattr(disk, 'is_viewed', False),
                        'viewed_at': disk.viewed_at.isoformat() if getattr(disk, 'viewed_at', None) else None,
                        'viewed_by': str(disk.viewed_by.uuid) if getattr(disk, 'viewed_by', None) else None,
                        'serial_number': disk.serial_number,
                        'make': disk.make,
                        'model': disk.model,
                        'device_name': FlagService._get_device_name(disk.device),
                        'missing_duration': FlagService._format_missing_duration(disk.flagged_at),
                    }
                    for disk in Storage.objects.select_related('device__agent').filter(**base_filter)
                ]
            elif entity_type.lower() == 'partition':
                return [
                    {
                        'uuid': str(partition.uuid),
                        'agent_uuid': str(partition.storage.device.agent.uuid) if partition.storage and partition.storage.device and partition.storage.device.agent else 'unknown',
                        'entity_type': 'partition',
                        'flagged_at': partition.flagged_at.isoformat() if partition.flagged_at else None,
                        'flagged_reason': partition.flagged_reason,
                        'is_viewed': getattr(partition, 'is_viewed', False),
                        'viewed_at': partition.viewed_at.isoformat() if getattr(partition, 'viewed_at', None) else None,
                        'viewed_by': str(partition.viewed_by.uuid) if getattr(partition, 'viewed_by', None) else None,
                        'partition_name': getattr(partition, 'name', getattr(partition, 'partition_name', 'unknown')),
                        'mount_point': getattr(partition, 'mount_point', 'unknown'),
                        'fs_type': partition.fs_type,
                        'device_name': FlagService._get_device_name(partition.storage.device if partition.storage else None),
                        'missing_duration': FlagService._format_missing_duration(partition.flagged_at),
                    }
                    for partition in Partition.objects.select_related('storage__device__agent').filter(**base_filter)
                ]
            else:
                return []
        except Exception as e:
            raise Exception(f"Error getting flagged {entity_type} devices: {str(e)}")
