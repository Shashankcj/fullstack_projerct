import logging
from BaseApp.models import ApplicationDiskIO,Storage, Device

logger = logging.getLogger("agent_monitoring")

class DiskIOService:
    def __init__(self, alert_service=None, unknown_service=None, response_callback=None):
        self.alert_service = alert_service
        self.unknown_service = unknown_service
        self._send_response = response_callback

    def set_response_sender(self, cb):
        self._send_response = cb

    async def process_disk_io_data(self, device_uuid, disk_resource_monitoring_data, checkpoint=None, agent=None, device=None):
        logger.info(f"[DiskIOService] Processing for device UUID: {device_uuid}")

        # 🔹 Step 1: Fetch device and associated storage
        try:
            device_obj = await Device.objects.prefetch_related("storage").aget(uuid=device_uuid)
            logger.info(f"[DiskIOService] Found device: {device_obj}")

            storage_records = [s async for s in Storage.objects.filter(device=device_obj)]

            if not storage_records:
                logger.error(f"[DiskIOService] No storage found for device UUID: {device_uuid}")
                return {"error": "No storage found for device"}

        except Device.DoesNotExist:
            logger.error(f"[DiskIOService] Device not found for UUID: {device_uuid}")
            return {"error": "Device not found"}
        except Exception as e:
            logger.error(f"[DiskIOService] Unexpected error finding storage: {e}")
            return {"error": f"Storage lookup failed: {str(e)}"}

        processed_count = 0
        io_priority_map = {"Low": 1, "Normal": 2, "High": 3}

        # 🔹 Step 2: Process each Disk I/O entry
        for disk_io_entry in disk_resource_monitoring_data:
            try:
                io_priority_value = io_priority_map.get(disk_io_entry.get("io_priority", "Normal"), 2)

                # Map disk_uuid → correct Storage object
                target_storage = next(
                    (stor for stor in storage_records if str(stor.uuid) == disk_io_entry.get("disk_uuid")),
                    storage_records[0] if storage_records else None
                )

                if not target_storage:
                    logger.warning(f"[DiskIOService] No valid storage found for disk entry: {disk_io_entry}")
                    continue

                # 🔹 Step 3: Update or create record based on (storage, pid)
                defaults = {
                    "checkpoint": checkpoint,
                    "read_b_sec": disk_io_entry.get("read_b_sec", 0),
                    "write_b_sec": disk_io_entry.get("write_b_sec", 0),
                    "total_b_sec": disk_io_entry.get("total_b_sec", 0),
                    "io_priority": io_priority_value,
                    "response_time": disk_io_entry.get("response_time", 0.0),
                    "name": disk_io_entry.get("name"),           
                    "file_path": disk_io_entry.get("file_path") 
                }

                obj, created = await ApplicationDiskIO.objects.aupdate_or_create(
                    storage=target_storage,
                    pid=disk_io_entry["pid"],
                    defaults=defaults,
                )

                processed_count += 1
                action = "Created" if created else "Updated"
                logger.debug(f"[DiskIOService] {action} record for PID {disk_io_entry['pid']} (Storage: {target_storage.make})")

                # Step 4: Send async response (if callback available)
                if self._send_response:
                    try:
                        await self._send_response({
                            "type": "DISK_IO",
                            "uuid": str(target_storage.uuid),
                            "pid": disk_io_entry["pid"],
                            "status": "success",
                            "message": f"Disk IO record {action.lower()} for pid {disk_io_entry['pid']}",
                        })
                    except Exception as e:
                        logger.error(f"[DiskIOService] Failed to send response: {e}")

            except Exception as e:
                logger.error(f"[DiskIOService] Error processing PID {disk_io_entry.get('pid')}: {e}")
                continue

        # Step 5: Return summary
        logger.info(f"[DiskIOService] Processed {processed_count} records")
        return {"processed": processed_count}
