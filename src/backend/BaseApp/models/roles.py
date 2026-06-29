from django.db import models
from BaseApp.models import *
import uuid
from .base_audit_model import BaseAuditModel


class Role(BaseAuditModel):
    AUDIT_IGNORE_FIELDS =[]
    uuid = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role_name = models.CharField(max_length=255)

    def check_permission(self, module, action):
        print("Inside Role.check_permission")
        try:
            if self.role_name == "Administrator":
                return True
            
            if self.role_name == "Administrator (Read-Only)":
                if action == "read":
                    return True
                else:
                    return False

            if self.permissionset_set.get(module=module).__dict__.get(action):
                return True
            else:
                return False
        except Exception as e:
            # Log error
            print(e)
            return False
        
    def __str__(self):
        return self.role_name
    

class PermissionSet(models.Model):

    modules = (
        ("rbac", "Roles"),
        ("users_management", "Users"),
        ("monitoring", "Monitoring"),
        ("custom_groups", "Custom Groups"),
        ("global_configuration","Global configuration"),
        ("audit_logs","Audit Logs"),
        ("ip_monitoring","IP Monitoring"),
    )

    role = models.ForeignKey(Role, on_delete=models.CASCADE, to_field='uuid', db_column='role_uuid')
    module = models.CharField(max_length=255, choices=modules)
    create = models.BooleanField()
    read = models.BooleanField()
    update = models.BooleanField()
    delete = models.BooleanField()

    def get_modules():
        modules = []

        for module in PermissionSet.modules:
            modules.append(module[0])

        return modules

    def __str__(self):
        return f'{self.role} - {self.module}'

