import uuid
import logging
from typing import Dict, List, Tuple
from collections import defaultdict

logger = logging.getLogger("agent_monitoring")


class DiskMonitoringUtils:
    """Utility functions for disk monitoring service."""

    @staticmethod
    def validate_input_data(data: Dict) -> bool:
        """Check if required disk/partition monitoring data is present."""
        return "disk_monitoring" in data and "partition_monitoring" in data

    @staticmethod
    def normalize_to_list(data) -> List:
        """Ensure data is in list format for consistent processing."""
        return data if isinstance(data, list) else [data]

    @staticmethod
    def index_partitions_by_disk(partition_monitoring: List[Dict]) -> Tuple[Dict, List]:
        """Pre-index partitions by disk_uuid for efficient processing."""
        partitions_by_disk = defaultdict(list)
        orphan_partitions = []
        
        for part in partition_monitoring:
            disk_uuid = part.get("disk_uuid", "").strip()
            if disk_uuid and disk_uuid.lower() != "unknown":
                partitions_by_disk[disk_uuid].append(part)
            else:
                orphan_partitions.append(part)
        
        return partitions_by_disk, orphan_partitions

    @staticmethod
    def validate_uuid_format(uuid_str: str) -> bool:
        """Validate UUID format and ensure it's not 'unknown'."""
        if not uuid_str or uuid_str.lower() == "unknown":
            return False
        try:
            uuid.UUID(uuid_str)
            return True
        except (ValueError, AttributeError):
            return False

    @staticmethod
    def safe_convert_bytes_to_gb(value) -> float:
        """Safely convert byte values to GB with error handling."""
        try:
            return round(int(value) / (1024**3), 2)
        except (ValueError, TypeError):
            return 0.0

    @staticmethod
    def parse_disk_size(total_disk_size: str) -> int:
        """Extract numeric size from disk size strings and convert to bytes."""
        try:
            size_gb = float(total_disk_size.replace("GB", "").strip()) if total_disk_size else 0
            return int(size_gb * (1024**3))
        except (ValueError, AttributeError):
            logger.error("Could not parse disk size '%s'", total_disk_size)
            return 0

    @staticmethod
    def calculate_disk_totals(partition_data: List[Dict], physical_size_bytes: int) -> Dict:
        """Calculate disk-level metrics by aggregating partition data."""
        total_used = total_free = 0
        
        for part in partition_data:
            try:
                total_used += int(part.get("used_space", 0))
                total_free += int(part.get("free_space", 0))
            except (ValueError, TypeError):
                continue

        mon_total_bytes = total_used + total_free
        unallocated = max(0, physical_size_bytes - mon_total_bytes)

        return {
            "total_size_gb": DiskMonitoringUtils.safe_convert_bytes_to_gb(physical_size_bytes),
            "total_usage_gb": DiskMonitoringUtils.safe_convert_bytes_to_gb(total_used),
            "allocated_gb": DiskMonitoringUtils.safe_convert_bytes_to_gb(mon_total_bytes),
            "unallocated_gb": DiskMonitoringUtils.safe_convert_bytes_to_gb(unallocated),
        }

    @staticmethod
    def combine_results(results: List) -> Dict:
        """Combine multiple disk processing results into single response."""
        combined = {"results": [], "unknowns": []}
        
        for res in results:
            if isinstance(res, Exception):
                logger.error("Processing error: %s", res)
                continue
            combined["results"].extend(res["results"])
            combined["unknowns"].extend(res["unknowns"])
        
        return combined

    @staticmethod
    def combine_partition_results(results: List) -> Dict:
        """Combine multiple partition processing results into single response."""
        combined = {"unknowns": [], "results": []}
        
        for res in results:
            if isinstance(res, Exception):
                logger.error("Partition processing error: %s", res)
                continue
            if res["unknown"]:
                combined["unknowns"].append(res["unknown"])
            combined["results"].append(res["result"])
        
        return combined

    @staticmethod
    def create_disk_error_response(disk_data: Dict, device_uuid: str, disk_uuid: str) -> Dict:
        """Create standardized error response for disk processing failures."""
        unknown_entry = {
            "type": "disk",
            "device_uuid": device_uuid,
            "disk_name": disk_data.get("disk_name", "unknown_disk"),
            "disk_uuid": disk_uuid or "unknown",
        }
        
        status_msg = (
            "error: unknown disk"
            if not disk_uuid or disk_uuid.lower() == "unknown"
            else "error: invalid UUID"
        )
        
        result_entry = {"uuid": disk_uuid or "unknown", "status": status_msg}
        return {"results": [result_entry], "unknowns": [unknown_entry]}

    @staticmethod
    def create_disk_not_found_response(disk_uuid: str, device_uuid: str) -> Dict:
        """Create standardized response when disk is not found in database."""
        return {
            "results": [{"uuid": disk_uuid, "status": "error: not found"}],
            "unknowns": [{"type": "disk", "device_uuid": device_uuid, "disk_uuid": disk_uuid}],
        }

    @staticmethod
    def create_partition_error_result(
        partition_uuid: str, device_uuid: str, disk_uuid: str, part_data: Dict,
    ) -> Dict:
        """Create standardized error result for partition processing failures."""
        unknown_entry = {
            "type": "partition",
            "device_uuid": device_uuid,
            "disk_uuid": disk_uuid,
            "partition_uuid": partition_uuid or "unknown",
        }
        
        status_msg = (
            "error: missing or unknown UUID"
            if not partition_uuid or partition_uuid.lower() == "unknown"
            else "error: invalid UUID format"
        )
        
        result_entry = {"uuid": partition_uuid or "unknown", "status": status_msg}
        return {"unknown": unknown_entry, "result": result_entry}

    @staticmethod
    def create_partition_not_found_result(partition_uuid: str, device_uuid: str) -> Dict:
        """Create standardized result when partition is not found in database."""
        return {
            "unknown": {
                "type": "partition",
                "device_uuid": device_uuid,
                "partition_uuid": partition_uuid,
                "reason": "not_found_in_database",
            },
            "result": {
                "uuid": partition_uuid,
                "status": "error: partition not found (possibly deleted)",
            },
        }