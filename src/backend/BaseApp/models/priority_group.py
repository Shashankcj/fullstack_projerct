from django.db import models
import uuid

class PriorityGroup(models.Model):
    Priority_Choice = (
        ("p1", "Priority 1 (P1)"),
        ("p2", "Priority 2 (P2)"),
        ("p3", "Priority 3 (P3)"),
        ("p4", "Priority 4 (P4)"),
        ("np", "No Priority (Default)"),
    )
    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    priority_name = models.CharField(max_length=255, choices=Priority_Choice, default="np")
    
    def __str__(self):
        return f"Priority group {self.priority_name} - {self.uuid}"
    
    @classmethod
    def get_default(cls):
        default, _ = cls.objects.get_or_create(priority_name='np')
        return default.pk
    
    def get_monitoring_key(self, component_type):
        mapping = {
            "p1": "monitoring_p1",
            "p2": "monitoring_p2",
            "p3": "monitoring_p3",
            "p4": "monitoring_p4",
            "np": "monitoring",
        }
        return f"{mapping.get(self.priority_name, 'monitoring')}.{component_type}"