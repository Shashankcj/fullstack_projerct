import logging
from BaseApp.models import ApplicationCPUIO, CPU

logger = logging.getLogger("agent_monitoring")

class CPUIOService:
    def __init__(self, alert_service=None, unknown_service=None, response_callback=None):
        self.alert_service = alert_service
        self.unknown_service = unknown_service
        self._send_response = response_callback

    def set_response_sender(self, cb):
        self._send_response = cb

    async def process_cpu_io_data(self, cpu_uuid, cpu_resource_monitoring_data, checkpoint=None, agent=None, device=None):
        logger.info(f"[CPUIOService] Processing for CPU UUID: {cpu_uuid}")

        # Map cpu_uuid to CPU record
        try:
            cpu = await CPU.objects.select_related("device").aget(uuid=cpu_uuid)
            logger.info(f"[CPUIOService] Found CPU: {cpu}")
        except CPU.DoesNotExist:
            logger.error(f"[CPUIOService] CPU not found for UUID: {cpu_uuid}")
            return {"error": "CPU not found"}

        processed_count = 0

        # Process each CPU process entry
        for cpu_proc in cpu_resource_monitoring_data:
            try:
                # Identify unique record by (cpu, pid)
                defaults = {
                    "checkpoint": checkpoint,
                    "name": cpu_proc["name"],
                    "status": cpu_proc.get("status", "running"),
                    "threads": cpu_proc.get("threads", 1),
                    "cpu_average": cpu_proc.get("cpu_average", 0.0),
                }

                obj, created = await ApplicationCPUIO.objects.aupdate_or_create(
                    cpu=cpu,
                    pid=cpu_proc["pid"],
                    defaults=defaults,
                )

                processed_count += 1
                action = "Created" if created else "Updated"
                logger.debug(f"[CPUIOService] {action} record for PID {cpu_proc['pid']}")

                # Send async response if callback exists
                if self._send_response:
                    try:
                        await self._send_response({
                            "type": "CPU_IO",
                            "uuid": str(cpu_uuid),
                            "pid": cpu_proc["pid"],
                            "status": "success",
                            "message": f"CPU IO record {action.lower()} for pid {cpu_proc['pid']}"
                        })
                    except Exception as e:
                        logger.error(f"[CPUIOService] Failed to send response: {e}")

            except Exception as e:
                logger.error(f"[CPUIOService] Error processing PID {cpu_proc.get('pid')}: {e}")
                continue

        logger.info(f"[CPUIOService] Processed {processed_count} records")
        return {"processed": processed_count}
