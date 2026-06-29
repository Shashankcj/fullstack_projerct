import logging
import re
import socket
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logger = logging.getLogger(__name__)

REQUEST_TIMEOUT = 10


class ILOClientError(Exception):
    """Base exception for iLO client errors."""


class ILOAuthenticationError(ILOClientError):
    """Raised when iLO authentication fails."""


class ILORedfishError(ILOClientError):
    """Raised when Redfish communication fails."""


class ILOClient:
    def __init__(self, ip: str, username: str, password: str):
        self.ip = ip
        self.username = username
        self.password = password
        self.token: Optional[str] = None
        self.session_uri: Optional[str] = None

    @property
    def _base_url(self) -> str:
        return f"https://{self.ip}"

    def _verify_target(self):
        # TODO: Replace with proper CA bundle path in production
        return False

    def _safe_get(self, data: Optional[Dict[str, Any]], path: List[Any], default: Any = "Unknown") -> Any:
        current: Any = data
        for part in path:
            if current is None:
                return default
            if isinstance(part, int):
                if isinstance(current, list) and 0 <= part < len(current):
                    current = current[part]
                else:
                    return default
            else:
                if not isinstance(current, dict):
                    return default
                current = current.get(part)
        return default if current is None else current

    def _normalize_text(self, value: Any) -> str:
        if value is None:
            return "Unknown"
        if isinstance(value, str):
            cleaned = re.sub(r"\s+", " ", value).strip()
            return cleaned or "Unknown"
        if isinstance(value, (int, float, bool)):
            return str(value)
        return "Unknown"

    def _normalize_health(self, value: Any) -> str:
        mapped = self._normalize_text(value).lower()
        if mapped in ("ok", "healthy"):
            return "healthy"
        if mapped in ("warning", "degraded", "caution"):
            return "warning"
        if mapped in ("critical", "failed", "error"):
            return "critical"
        return "unknown"

    def _health_rank(self, value: Any) -> int:
        level = self._normalize_health(value)
        return {"healthy": 0, "unknown": 1, "warning": 2, "critical": 3}.get(level, 1)

    def _can_connect(self, port: int = 443, timeout: int = 5) -> bool:
        try:
            with socket.create_connection((self.ip, port), timeout=timeout):
                return True
        except OSError:
            return False

    def authenticate(self) -> None:
        if not self._can_connect():
            raise ILOAuthenticationError(f"Cannot connect to {self.ip}:443")

        url = f"{self._base_url}/redfish/v1/SessionService/Sessions"
        payload = {"UserName": self.username, "Password": self.password}
        headers = {"Content-Type": "application/json"}

        try:
            response = requests.post(
                url,
                json=payload,
                headers=headers,
                verify=self._verify_target(),
                timeout=REQUEST_TIMEOUT,
            )
        except requests.RequestException as exc:
            raise ILOAuthenticationError(f"Authentication request failed: {exc}") from exc

        if response.status_code not in (200, 201):
            raise ILOAuthenticationError(
                f"Authentication failed for {self.ip} with HTTP {response.status_code}"
            )

        token = response.headers.get("X-Auth-Token")
        if not token:
            raise ILOAuthenticationError("Authentication succeeded but token is missing")

        self.token = token
        self.session_uri = response.headers.get("Location")
        logger.info("Authenticated to iLO %s", self.ip)

    def logout(self) -> None:
        if not self.token:
            return

        if self.session_uri:
            endpoint = self.session_uri if self.session_uri.startswith("http") else f"{self._base_url}{self.session_uri}"
            try:
                requests.delete(
                    endpoint,
                    headers={"X-Auth-Token": self.token, "Accept": "application/json"},
                    verify=self._verify_target(),
                    timeout=REQUEST_TIMEOUT,
                )
            except requests.RequestException:
                logger.warning("Session delete failed for %s", self.ip)

        self.token = None
        self.session_uri = None

    def _get(self, endpoint: str) -> Dict[str, Any]:
        if not self.token:
            raise ILORedfishError("Not authenticated")

        url = endpoint if endpoint.startswith("http") else f"{self._base_url}{endpoint}"
        headers = {"Accept": "application/json", "X-Auth-Token": self.token}

        try:
            response = requests.get(
                url,
                headers=headers,
                verify=self._verify_target(),
                timeout=REQUEST_TIMEOUT,
            )
        except requests.RequestException as exc:
            raise ILORedfishError(f"GET {endpoint} failed: {exc}") from exc

        if response.status_code != 200:
            logger.warning("GET %s failed with HTTP %s", endpoint, response.status_code)
            return {}

        try:
            data = response.json()
        except ValueError as exc:
            raise ILORedfishError(f"Invalid JSON from endpoint {endpoint}") from exc

        return data if isinstance(data, dict) else {}

    def fetch_system_info(self) -> Dict[str, Any]:
        system = self._get("/redfish/v1/Systems/1")
        manager = self._get("/redfish/v1/Managers/1")
        return {
            "model": self._safe_get(system, ["Model"]),
            "manufacturer": self._safe_get(system, ["Manufacturer"]),
            "serial_number": self._safe_get(system, ["SerialNumber"]),
            "uuid": self._safe_get(system, ["UUID"]),
            "bios_version": self._safe_get(system, ["BiosVersion"]),
            "hostname": self._safe_get(system, ["HostName"]),
            "power_state": self._safe_get(system, ["PowerState"]),
            "ilo_firmware_version": self._safe_get(manager, ["FirmwareVersion"]),
            "collected_at": datetime.utcnow().isoformat() + "Z",
        }

    def fetch_motherboard_info(self) -> Dict[str, Any]:
        chassis = self._get("/redfish/v1/Chassis/1")
        system = self._get("/redfish/v1/Systems/1")
        manager = self._get("/redfish/v1/Managers/1")

        system_board_id = (
            self._safe_get(chassis, ["Oem", "Hpe", "SystemBoardId"], default=None)
            or self._safe_get(system, ["Oem", "Hpe", "SystemBoardSerialNumber"], default=None)
            or self._safe_get(manager, ["Oem", "Hpe", "SystemBoardSerialNumber"], default=None)
            or self._safe_get(chassis, ["SerialNumber"], default="Unknown")
        )

        return {
            "chassis_manufacturer": self._safe_get(chassis, ["Manufacturer"]),
            "chassis_model": self._safe_get(chassis, ["Model"]),
            "chassis_serial_number": self._safe_get(chassis, ["SerialNumber"]),
            "chassis_part_number": self._safe_get(chassis, ["PartNumber"]),
            "asset_tag": self._safe_get(chassis, ["AssetTag"]),
            "system_board_id": self._normalize_text(system_board_id),
            "system_rom": self._safe_get(system, ["BiosVersion"]),
        }

    def fetch_processor_details(self) -> List[Dict[str, Any]]:
        collection = self._get("/redfish/v1/Systems/1/Processors")
        rows: List[Dict[str, Any]] = []
        for member in collection.get("Members", []):
            endpoint = member.get("@odata.id")
            if not endpoint:
                continue
            data = self._get(endpoint)
            rows.append(
                {
                    "id": self._safe_get(data, ["Id"]),
                    "name": self._safe_get(data, ["Name"]),
                    "model": self._safe_get(data, ["Model"]),
                    "manufacturer": self._safe_get(data, ["Manufacturer"]),
                    "cores": self._safe_get(data, ["TotalCores"]),
                    "threads": self._safe_get(data, ["TotalThreads"]),
                    "health": self._safe_get(data, ["Status", "Health"]),
                    "state": self._safe_get(data, ["Status", "State"]),
                }
            )
        return rows

    def compute_cpu_summary(self, processors: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Compute summary statistics for CPU inventory."""
        total_processors = len(processors)
        total_cores = sum(
            (proc.get("cores") or 0) for proc in processors if isinstance(proc.get("cores"), int)
        )
        total_threads = sum(
            (proc.get("threads") or 0) for proc in processors if isinstance(proc.get("threads"), int)
        )
        return {
            "total_processors": total_processors,
            "total_cores": total_cores,
            "total_threads": total_threads,
        }

    def fetch_storage_info(self) -> Dict[str, Any]:
        """Fetch storage information organized by controllers, volumes, and drives.
        
        Returns:
            Dict with 'controllers', 'volumes', and 'drives' lists.
        """
        storage_collection = self._get("/redfish/v1/Systems/1/Storage")
        controllers: List[Dict[str, Any]] = []
        volumes: List[Dict[str, Any]] = []
        drives: List[Dict[str, Any]] = []

        for member in storage_collection.get("Members", []):
            endpoint = member.get("@odata.id")
            if not endpoint:
                continue

            storage = self._get(endpoint)
            
            # Add controller
            controller_id = self._safe_get(storage, ["Id"])
            controllers.append(
                {
                    "id": controller_id,
                    "name": self._safe_get(storage, ["Name"]),
                    "description": self._safe_get(storage, ["Description"]),
                    "health": self._safe_get(storage, ["Status", "Health"]),
                    "state": self._safe_get(storage, ["Status", "State"]),
                }
            )

            # Process drives for this controller
            for drive in storage.get("Drives", []) or []:
                drive_endpoint = drive.get("@odata.id")
                if not drive_endpoint:
                    continue
                drive_data = self._get(drive_endpoint)
                drives.append(
                    {
                        "id": self._safe_get(drive_data, ["Id"]),
                        "name": self._safe_get(drive_data, ["Name"]),
                        "model": self._safe_get(drive_data, ["Model"]),
                        "serial_number": self._safe_get(drive_data, ["SerialNumber"]),
                        "capacity_bytes": self._safe_get(drive_data, ["CapacityBytes"]),
                        "media_type": self._safe_get(drive_data, ["MediaType"]),
                        "protocol": self._safe_get(drive_data, ["Protocol"]),
                        "health": self._safe_get(drive_data, ["Status", "Health"]),
                        "state": self._safe_get(drive_data, ["Status", "State"]),
                        "controller_id": controller_id,
                    }
                )

            # Process volumes for this controller
            volumes_data = storage.get("Volumes", {})
            volume_members = volumes_data.get("Members", []) if isinstance(volumes_data, dict) else []
            for volume in volume_members or []:
                volume_endpoint = volume.get("@odata.id")
                if not volume_endpoint:
                    continue
                volume_data = self._get(volume_endpoint)
                volumes.append(
                    {
                        "id": self._safe_get(volume_data, ["Id"]),
                        "name": self._safe_get(volume_data, ["Name"]),
                        "volume_type": self._safe_get(volume_data, ["VolumeType"]),
                        "capacity_bytes": self._safe_get(volume_data, ["CapacityBytes"]),
                        "health": self._safe_get(volume_data, ["Status", "Health"]),
                        "state": self._safe_get(volume_data, ["Status", "State"]),
                        "controller_id": controller_id,
                    }
                )

        return {"controllers": controllers, "volumes": volumes, "drives": drives}

    def fetch_network_interfaces_details(self) -> List[Dict[str, Any]]:
        collection = self._get("/redfish/v1/Managers/1/EthernetInterfaces")
        rows: List[Dict[str, Any]] = []
        for member in collection.get("Members", []):
            endpoint = member.get("@odata.id")
            if not endpoint:
                continue

            data = self._get(endpoint)
            link_status = self._normalize_text(data.get("LinkStatus"))
            speed = data.get("SpeedMbps") or data.get("CurrentLinkSpeedMbps")
            ipv4_addr = self._safe_get(data, ["IPv4Addresses", 0, "Address"], default="N/A")
            physically_connected = bool(speed)

            link_state = "down"
            lowered = link_status.lower()
            if "up" in lowered or "enabled" in lowered:
                link_state = "up"
            elif "disabled" in lowered:
                link_state = "disabled"
            elif physically_connected:
                link_state = "down_cable_present"
            else:
                link_state = "down_no_cable"

            rows.append(
                {
                    "id": self._safe_get(data, ["Id"]),
                    "name": self._safe_get(data, ["Name"]),
                    "mac_address": self._safe_get(data, ["MACAddress"], "N/A"),
                    "link_status": link_status,
                    "link_state": link_state,
                    "speed_mbps": speed if speed is not None else "N/A",
                    "ipv4_address": ipv4_addr,
                    "health": self._safe_get(data, ["Status", "Health"]),
                    "state": self._safe_get(data, ["Status", "State"]),
                }
            )
        return rows

    def fetch_memory_details(self) -> List[Dict[str, Any]]:
        memory_collection = self._get("/redfish/v1/Systems/1/Memory")
        rows: List[Dict[str, Any]] = []
        for member in memory_collection.get("Members", []):
            endpoint = member.get("@odata.id")
            if not endpoint:
                continue

            data = self._get(endpoint)
            oem_hpe = data.get("Oem", {}).get("Hpe", {}) if isinstance(data.get("Oem"), dict) else {}
            dimm_status = oem_hpe.get("DIMMStatus") if isinstance(oem_hpe, dict) else "Unknown"

            rows.append(
                {
                    "id": self._safe_get(data, ["Id"]),
                    "name": self._safe_get(data, ["Name"]),
                    "capacity_mib": self._safe_get(data, ["CapacityMiB"]),
                    "memory_type": self._safe_get(data, ["MemoryDeviceType"]),
                    "operating_speed_mhz": self._safe_get(data, ["OperatingSpeedMhz"]),
                    "health": self._safe_get(data, ["Status", "Health"]),
                    "state": self._safe_get(data, ["Status", "State"]),
                    "dimm_status": self._normalize_text(dimm_status),
                }
            )
        return rows

    def compute_memory_summary(self, memory: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Compute summary statistics for memory inventory."""
        total_memory_mib = sum(
            (mem.get("capacity_mib") or 0) for mem in memory if isinstance(mem.get("capacity_mib"), int)
        )
        # Convert MiB to GiB (1024 MiB = 1 GiB)
        total_memory_gb = round(total_memory_mib / 1024, 2) if total_memory_mib > 0 else 0
        total_dimms = len(memory)
        return {
            "total_memory_mib": total_memory_mib,
            "total_memory_gb": total_memory_gb,
            "total_dimms": total_dimms,
        }

    def fetch_power_state(self) -> Dict[str, Any]:
        system = self._get("/redfish/v1/Systems/1")
        return {
            "power_state": self._safe_get(system, ["PowerState"]),
            "health": self._safe_get(system, ["Status", "Health"]),
            "state": self._safe_get(system, ["Status", "State"]),
        }

    def fetch_power_supply_info(self) -> Dict[str, Any]:
        power = self._get("/redfish/v1/Chassis/1/Power")
        supplies: List[Dict[str, Any]] = []
        for psu in power.get("PowerSupplies", []) if isinstance(power.get("PowerSupplies"), list) else []:
            supplies.append(
                {
                    "name": self._safe_get(psu, ["Name"]),
                    "model": self._safe_get(psu, ["Model"]),
                    "serial_number": self._safe_get(psu, ["SerialNumber"]),
                    "last_power_output_watts": self._safe_get(psu, ["LastPowerOutputWatts"]),
                    "line_input_voltage": self._safe_get(psu, ["LineInputVoltage"]),
                    "health": self._safe_get(psu, ["Status", "Health"]),
                    "state": self._safe_get(psu, ["Status", "State"]),
                }
            )

        redundancy = power.get("PowerRedundancy", [])
        redundancy_rows: List[Dict[str, Any]] = []
        for item in redundancy if isinstance(redundancy, list) else []:
            redundancy_rows.append(
                {
                    "name": self._safe_get(item, ["Name"]),
                    "mode": self._safe_get(item, ["Mode"]),
                    "health": self._safe_get(item, ["Status", "Health"]),
                    "state": self._safe_get(item, ["Status", "State"]),
                }
            )

        return {"power_supplies": supplies, "redundancy": redundancy_rows}

    def fetch_health_consolidated(self) -> Dict[str, Any]:
        system = self._get("/redfish/v1/Systems/1")
        manager = self._get("/redfish/v1/Managers/1")
        chassis = self._get("/redfish/v1/Chassis/1")
        return {
            "system_health": self._safe_get(system, ["Status", "Health"]),
            "system_state": self._safe_get(system, ["Status", "State"]),
            "manager_health": self._safe_get(manager, ["Status", "Health"]),
            "manager_state": self._safe_get(manager, ["Status", "State"]),
            "chassis_health": self._safe_get(chassis, ["Status", "Health"]),
            "chassis_state": self._safe_get(chassis, ["Status", "State"]),
        }

    def fetch_thermal_details(self) -> Dict[str, Any]:
        thermal = self._get("/redfish/v1/Chassis/1/Thermal")
        fans = thermal.get("Fans", []) if isinstance(thermal.get("Fans"), list) else []
        temperatures = thermal.get("Temperatures", []) if isinstance(thermal.get("Temperatures"), list) else []
        return {
            "fan_count": len(fans),
            "temperature_sensor_count": len(temperatures),
            "fans": [
                {
                    "name": self._safe_get(fan, ["Name"]),
                    "reading": self._safe_get(fan, ["Reading"]),
                    "units": self._safe_get(fan, ["ReadingUnits"]),
                    "health": self._safe_get(fan, ["Status", "Health"]),
                    "state": self._safe_get(fan, ["Status", "State"]),
                }
                for fan in fans
            ],
            "temperatures": [
                {
                    "name": self._safe_get(sensor, ["Name"]),
                    "reading_celsius": self._safe_get(sensor, ["ReadingCelsius"]),
                    "health": self._safe_get(sensor, ["Status", "Health"]),
                    "state": self._safe_get(sensor, ["Status", "State"]),
                }
                for sensor in temperatures
            ],
        }

    def fetch_license_info(self) -> Dict[str, Any]:
        service = self._get("/redfish/v1/Managers/1/LicenseService")
        if not service:
            return {"available": False, "items": []}

        licenses_link = self._safe_get(service, ["Licenses", "@odata.id"], default=None)
        if not licenses_link:
            return {"available": True, "items": []}

        licenses = self._get(str(licenses_link))
        items: List[Dict[str, Any]] = []
        for member in licenses.get("Members", []):
            endpoint = member.get("@odata.id")
            if not endpoint:
                continue
            data = self._get(endpoint)
            items.append(
                {
                    "id": self._safe_get(data, ["Id"]),
                    "name": self._safe_get(data, ["Name"]),
                    "license_type": self._safe_get(data, ["LicenseType"]),
                    "state": self._safe_get(data, ["Status", "State"]),
                    "health": self._safe_get(data, ["Status", "Health"]),
                }
            )
        return {"available": True, "items": items}

    def fetch_firmware_inventory(self) -> List[Dict[str, Any]]:
        """Fetch firmware inventory from UpdateService.
        
        Collects BIOS, iLO, storage controller, and NIC firmware versions.
        """
        items: List[Dict[str, Any]] = []
        
        # Try fetching from FirmwareInventory
        firmware_inv = self._get("/redfish/v1/UpdateService/FirmwareInventory")
        for member in firmware_inv.get("Members", []):
            endpoint = member.get("@odata.id")
            if not endpoint:
                continue
            data = self._get(endpoint)
            items.append(
                {
                    "id": self._safe_get(data, ["Id"]),
                    "name": self._safe_get(data, ["Name"]),
                    "version": self._safe_get(data, ["Version"]),
                    "description": self._safe_get(data, ["Description"]),
                }
            )
        
        return items

    def finalize_health_status(
        self,
        system_info: Dict[str, Any],
        processors: List[Dict[str, Any]],
        storage: Dict[str, Any],
        network: List[Dict[str, Any]],
        memory: List[Dict[str, Any]],
        thermal: Dict[str, Any],
        health: Dict[str, Any],
        power: Dict[str, Any],
        power_supply: Dict[str, Any],
    ) -> Tuple[str, str, List[str]]:
        issues: List[str] = []
        max_rank = 0

        def add_issue_if_needed(label: str, value: Any) -> None:
            nonlocal max_rank
            rank = self._health_rank(value)
            max_rank = max(max_rank, rank)
            if rank >= 2:
                issues.append(f"{label} is {value}.")

        add_issue_if_needed("system health", health.get("system_health"))
        add_issue_if_needed("manager health", health.get("manager_health"))
        add_issue_if_needed("chassis health", health.get("chassis_health"))
        add_issue_if_needed("power state health", power.get("health"))

        if self._normalize_text(system_info.get("power_state")).lower() != "on":
            max_rank = max(max_rank, 2)
            issues.append(f"Power state is {system_info.get('power_state')}.")

        for section_name, rows in (
            ("processor", processors),
            ("network", network),
            ("memory", memory),
        ):
            for row in rows:
                status = row.get("health")
                rank = self._health_rank(status)
                max_rank = max(max_rank, rank)
                if rank >= 2:
                    item_id = row.get("id") or row.get("name") or "item"
                    issues.append(f"{section_name}:{item_id} health is {status}.")

        # Handle reorganized storage structure
        for controller in storage.get("controllers", []):
            add_issue_if_needed(f"storage:{controller.get('id')}", controller.get("health"))
        
        for drive in storage.get("drives", []):
            status = drive.get("health")
            rank = self._health_rank(status)
            max_rank = max(max_rank, rank)
            if rank >= 2:
                item_id = drive.get("id") or drive.get("name") or "drive"
                issues.append(f"drive:{item_id} health is {status}.")

        for fan in thermal.get("fans", []):
            add_issue_if_needed(f"fan:{fan.get('name')}", fan.get("health"))
        for sensor in thermal.get("temperatures", []):
            add_issue_if_needed(f"temperature:{sensor.get('name')}", sensor.get("health"))

        for psu in power_supply.get("power_supplies", []):
            add_issue_if_needed(f"psu:{psu.get('name')}", psu.get("health"))
        for redundancy in power_supply.get("redundancy", []):
            add_issue_if_needed(f"power_redundancy:{redundancy.get('name')}", redundancy.get("health"))

        if max_rank >= 3:
            severity = "Critical"
        elif max_rank >= 2:
            severity = "Warning"
        else:
            severity = "Healthy"

        overall_health = "Not Healthy" if severity in ("Warning", "Critical") else "Healthy"
        return overall_health, severity, issues

    def collect_full_health(self) -> Dict[str, Any]:
        self.authenticate()
        try:
            system_info = self.fetch_system_info()
            motherboard_info = self.fetch_motherboard_info()
            processors = self.fetch_processor_details()
            storage = self.fetch_storage_info()
            network = self.fetch_network_interfaces_details()
            memory = self.fetch_memory_details()
            thermal = self.fetch_thermal_details()
            health = self.fetch_health_consolidated()
            power = self.fetch_power_state()
            power_supply = self.fetch_power_supply_info()
            license_info = self.fetch_license_info()
            firmware_info = self.fetch_firmware_inventory()

            # Compute summaries
            cpu_summary = self.compute_cpu_summary(processors)
            memory_summary = self.compute_memory_summary(memory)

            health_status, severity, issues = self.finalize_health_status(
                system_info=system_info,
                processors=processors,
                storage=storage,
                network=network,
                memory=memory,
                thermal=thermal,
                health=health,
                power=power,
                power_supply=power_supply,
            )

            return {
                "system_info": system_info,
                "motherboard": motherboard_info,
                "cpu": processors,
                "cpu_summary": cpu_summary,
                "memory": memory,
                "memory_summary": memory_summary,
                "storage": storage,
                "network": network,
                "thermal": thermal,
                "power": power_supply,
                "firmware": firmware_info,
                "health": health,
                "health_status": health_status,
                "severity": severity,
                "issues": issues,
                "license": license_info,
            }
        finally:
            self.logout()
