import logging
from BaseApp.models import ApplicationMemoryIO, Memory

logger = logging.getLogger("agent_monitoring")

class MemoryIOService:
    def __init__(self, alert_service=None, unknown_service=None, response_callback=None):
        self.alert_service = alert_service
        self.unknown_service = unknown_service
        self._send_response = response_callback

    def set_response_sender(self, cb):
        self._send_response = cb

    async def process_memory_io_data(self, memory_uuid, memory_resource_monitoring_data, checkpoint=None, agent=None, device=None):
        logger.info(f"[MemoryIOService] Processing for memory UUID: {memory_uuid}")

        # Map memory_uuid to Memory record
        try:
            memory = await Memory.objects.select_related("device").aget(uuid=memory_uuid)
            logger.info(f"[MemoryIOService] Found memory: {memory}")
        except Memory.DoesNotExist:
            logger.error(f"[MemoryIOService] Memory not found for UUID: {memory_uuid}")
            return {"error": "Memory not found"}

        processed_count = 0

        # Process each memory entry
        for mem_proc in memory_resource_monitoring_data:
            try:
                obj, created = await ApplicationMemoryIO.objects.aupdate_or_create(
                    memory=memory,
                    pid=mem_proc['pid'],
                    defaults={
                        "checkpoint": checkpoint,
                        "name": mem_proc.get('name', ''),
                        "commit_kb": mem_proc.get('commit_kb', 0),
                        "working_set_kb": mem_proc.get('working_set_kb', 0),
                        "private_kb": mem_proc.get('private_kb', 0),
                    }
                )

                processed_count += 1
                action = "Created" if created else "Updated"
                logger.debug(f"[MemoryIOService] {action} record for PID {mem_proc['pid']}")

                # Send async response if callback exists
                if self._send_response:
                    try:
                        await self._send_response({
                            "type": "MEMORY_IO",
                            "uuid": str(memory_uuid),
                            "pid": mem_proc['pid'],
                            "status": "success",
                            "message": f"Memory IO data {action.lower()} for pid {mem_proc['pid']}"
                        })
                    except Exception as e:
                        logger.error(f"[MemoryIOService] Failed to send response: {e}")

            except Exception as e:
                logger.error(f"[MemoryIOService] Error processing PID {mem_proc.get('pid')}: {e}")
                continue

        logger.info(f"[MemoryIOService] Processed {processed_count} records")
        return {"processed": processed_count}
