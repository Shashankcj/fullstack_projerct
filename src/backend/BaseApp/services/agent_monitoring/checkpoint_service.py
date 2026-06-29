# services/checkpoint_service.py
from asyncio import sleep
from django.db import IntegrityError
from BaseApp.services.imports import MonitoringCheckpoint, logging, sync_to_async

logger = logging.getLogger("agent_monitoring")

class CheckpointService:
    """Service for managing monitoring checkpoints."""

    @staticmethod
    @sync_to_async
    def create_checkpoint(agent, event):
        """Create a monitoring checkpoint (without checking existence)."""
        retries = 3
        for attempt in range(retries):
            try:
                checkpoint=MonitoringCheckpoint.objects.create(agent=agent, event=event)
            except IntegrityError:
                if attempt == retries - 1:
                    raise
                sleep(0.1)
        return checkpoint