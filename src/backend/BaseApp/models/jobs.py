import uuid
from django.db import models

class Job(models.Model):
    uuid = models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("completed", "Completed"),
        ("failed", "Failed"), 
        ("partial", "Partial Success"),
    )
    
    RESULT_CHOICES = (
        ("success", "Success"),
        ("partial", "Partial"),
        ("failed", "Failed"),
        ("duplicate", "Duplicate"),
        ("empty", "Empty"),
    )

    user =  models.CharField(max_length=100)
    job_type = models.CharField(max_length=100,help_text="Feature name: ip_monitor")
    total_rows = models.IntegerField(default=0)     
    created_count = models.IntegerField(default=0)
    updated_count = models.IntegerField(default=0)
    duplicate_count = models.IntegerField(default=0)
    error_count = models.IntegerField(default=0)
    status = models.CharField(max_length=20,choices=STATUS_CHOICES, default="pending")
    result = models.CharField(max_length=20,choices=RESULT_CHOICES,blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def calculate_result(self):
        if self.total_rows == 0:
            return "empty"
        if self.created_count == self.total_rows:
            return "success"
        if self.duplicate_count == self.total_rows:
            return "duplicate"
        if self.error_count == self.total_rows:
            return "failed"
        return "partial"

    def save(self, *args, **kwargs):
        self.result = self.calculate_result()
        super().save(*args, **kwargs)


    def __str__(self):
        return f"{self.job_type} CSV Job {self.uuid} ({self.status})"
