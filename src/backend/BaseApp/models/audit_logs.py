from django.db import models
from BaseApp.models import *
import uuid

print(">>> LOADING MODELS FROM:", __file__)

class AuditLog(models.Model):

    SEVERITY_CHOICES = [
        ('CREATE', 'Info'),
        ('UPDATE', 'Warning'), 
        ('DELETE', 'Critical'),
        ('LOGIN', 'Success'),
        ('LOGOUT', 'Success'),
        ('DOWNLOAD','Info'),
        ('LOGIN_FAILED','Warning')
    ]

    # Remove SEVERITY_MAP or fix it too
    SEVERITY_MAP = {
        'CREATE': 'CREATE',
        'UPDATE': 'UPDATE', 
        'DELETE': 'DELETE',
        'LOGIN': 'LOGIN',
        'LOGOUT': 'LOGOUT',
        'DOWNLOAD':'DOWNLOAD',
        "LOGIN_FAILED":"LOGIN_FAILED"
    }

    uuid = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.CharField(max_length=100)
    action = models.CharField(max_length=100)
    model_name = models.CharField(max_length=100, blank=True)
    description = models.CharField(max_length=500, blank=True)
    ip = models.CharField(max_length=100, blank=True)
    severity = models.CharField(max_length=100, choices=SEVERITY_CHOICES)
    timestamp = models.DateTimeField(auto_now_add=True,db_index=True)

    def save(self, *args, **kwargs):
        if self.action in self.SEVERITY_MAP:
            self.severity = self.action
        else:
            self.severity = "CREATE"
        super().save(*args, **kwargs)
  
    def __str__ (self):
        return f"{self.action} - {self.model_name}"
