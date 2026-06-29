from django.db import models
from django.forms.models import model_to_dict
import logging
from ipware import get_client_ip
from django.core.exceptions import ValidationError
from rest_framework.exceptions import ValidationError as DRFValidationError

logger=logging.getLogger("agent_monitoring")

class BaseAuditModel(models.Model):

    class Meta:
        abstract = True

    def _model_data(self):
        return model_to_dict(self)
 
    def _get_display_value(self, field_name, value):
        field = self._meta.get_field(field_name)

        if field.is_relation:
            if not value:
                return None

            try:
                obj = field.related_model.objects.get(pk=value)
            except:
                return value  

            text = str(obj)
            if text and text != f"{field.related_model.__name__} object ({obj.pk})":
                return text

            char_fields = [
                f.name for f in obj._meta.fields
                if isinstance(f, models.CharField)
            ]

            if char_fields:
                return getattr(obj, char_fields[0])
            return obj.pk
        return value
    
    def _compare_role_permissions(self, old_permissions, new_permissions):
        """Compare old and new permissions, return list of changes"""
        changes = []
      
        # Find modified modules
        common = set(old_permissions.keys()) & set(new_permissions.keys())
        print(f"track common permissions {common}")
        for module in common:
            old_p = old_permissions[module]
            new_p = new_permissions[module]
            
            if (old_p['create'] != new_p['create'] or 
                old_p['read'] != new_p['read'] or 
                old_p['update'] != new_p['update'] or 
                old_p['delete'] != new_p['delete']):
                
                old_str = "".join([
                    "C" if old_p['create'] else "",
                    "R" if old_p['read'] else "",
                    "U" if old_p['update'] else "",
                    "D" if old_p['delete'] else ""
                ]) or "----"
                
                new_str = "".join([
                    "C" if new_p['create'] else "",
                    "R" if new_p['read'] else "",
                    "U" if new_p['update'] else "",
                    "D" if new_p['delete'] else ""
                ]) or "----"
                
                changes.append(f"{new_p['display']} module: changed from [{old_str}] to [{new_str}]")
        print(f"final changes {changes}")   
        return changes    
    def _build_description(self, action, user, old_data=None, new_data=None, old_permissions=None,new_permissions=None):
        actor = user if user else "system"
        model_name = self.__class__.__name__
        print(f"model name {model_name}")
        print(f"action to build description {action}")
        # Handle Role model specially
        if model_name == "Role":
            role_name = new_data.get('role_name', 'Unknown')
            
            if action == "CREATE":
                description = f"{user.username if user else 'System'} created the {self.__class__.__name__}: {self.role_name}"
        
                # Add permissions info for CREATE
                if new_permissions:
                    perm_summary = []
                    for module, perms in new_permissions.items():
                        enabled = [k for k, v in perms.items() if v and k != 'display']
                        if enabled:
                            perm_summary.append(f"{perms.get('display', module)}: {', '.join(enabled)}")
                    if perm_summary:
                        description += f" with the following permissions for modules: {'; '.join(perm_summary)}"
                
                return description

            elif action == "UPDATE":
                changes = []
                print(f"here ready to get new nermissions to compare {action}") 
                # Check permission changes
                if old_permissions is not None:
                    # Get new permissions
                    new_permissions = {}
                    try:
                        for perm in self.permissionset_set.all():
                            module_display = perm.get_module_display() if hasattr(perm, 'get_module_display') else perm.module
                            new_permissions[perm.module] = {
                                'create': perm.create,
                                'read': perm.read,
                                'update': perm.update,
                                'delete': perm.delete,
                                'display': module_display
                            }
                           
                    except:
                        pass
                    
                    print(f"new permissions retrived to update {new_permissions}")   
                    perm_changes = self._compare_role_permissions(old_permissions, new_permissions)
                    changes.extend(perm_changes)
                
                if changes:
                    return f"{actor} updated role '{role_name}': {', '.join(changes)}"
                return None
               
            elif action == "DELETE":
                return f"{actor} deleted the '{role_name}' role including all its access permissions"
            
        # Handle WebUser model
        elif model_name == "WebUser":
            if action == "CREATE":
                return (
                    f"{actor} created user account '{new_data.get('username', 'Unknown')}' "
                    f"with role '{self._get_display_value('role', self.role_id) or 'None'}'"
                )
            elif action == "UPDATE":
                changes = []
                IGNORE = getattr(self.__class__, "AUDIT_IGNORE_FIELDS", [])
                is_self_update = (user.username == old_data.get('username'))
                print(f" self update return{is_self_update}")
               
                for key in new_data:
                    if key in IGNORE:
                        continue
                    old_val = old_data.get(key)
                    new_val = new_data.get(key)
                    if old_val == new_val:
                        continue 

                    old_display = self._get_display_value(key, old_val)
                    new_display = self._get_display_value(key, new_val)
                    
                    if old_display != new_display:
                        if key == "is_user_enabled":
                            old_status = "enabled" if old_display else "disabled"
                            new_status = "enabled" if new_display else "disabled"
                            changes.append(f"Changed account status from {old_status} to {new_status}")
                        elif key == "password":
                            changes.append("Changed password")
                        elif key == "role":
                            changes.append(f"Changed role from {old_display or 'None'} to {new_display or 'None'}")
                        elif key == "username":
                            changes.append(f"Changed username from '{old_display}' to '{new_display}'")
                        elif key == "email":
                            changes.append(f"Updated email from '{old_display}' to '{new_display}'")
                        else:
                            changes.append(f"{key}: '{old_display}' to '{new_display}'")
                
                if changes:
                    if is_self_update:
                        return f"{actor} updated their own profile: {', '.join(changes)}"
                    else:
                        return f"{actor} updated user {old_data.get('username', 'Unknown')}: {', '.join(changes)}"
                return None
            
            elif action == "DELETE":
                return f"{actor} deleted user account '{old_data.get('username', 'Unknown') if old_data else 'Unknown'}'"
        elif model_name == "GlobalConfig":
            old_value=old_data.get('item_value')
            new_value=new_data.get('item_value')
            config_key=self.item_key
            if old_value == new_value:  
                return None
            
            # SMTP Configuration - User-friendly labels
            if config_key.startswith('smtp.'):
                config_display = {
                    'smtp.host': 'SMTP server address',
                    'smtp.port': 'SMTP port',
                    'smtp.username': 'SMTP username',
                    'smtp.password': 'SMTP password',
                    'smtp.encryption_type': 'SMTP encryption type',
                    'smtp.from_email': 'sender email address'
                }.get(config_key, config_key.replace('smtp.', 'SMTP '))
                
                return f"{actor} changed {config_display} from '{old_value}' to '{new_value}'"
            
            elif config_key.startswith('alert.'):
                if 'to_emails' in config_key:
                    email_type = 'TO Recipients'
                elif 'cc_emails' in config_key:
                    email_type = 'CC Recipients'
                elif 'support_email' in config_key:
                    email_type = 'Support Email'
                elif 'contact' in config_key:
                    email_type = 'Contact Info'
                elif 'enable_email_alerts' in config_key:
                    email_type = 'Enable email alerts'
                else:
                    email_type = 'Email Config'
                
                # Handle comma-separated emails vs single emails
                if 'email' in config_key or 'emails' in config_key:
                    old_emails = old_value.split(',') if old_value else []
                    new_emails = new_value.split(',') if new_value else []
                    return f"{actor} updated {email_type} from '{old_value or 'None'}' to '{new_value or 'None'}'"
                else:
                    # Non-email fields (contact name, etc.)
                    return f"{actor} updated {email_type} from '{old_value or 'None'}' to '{new_value or 'None'}'"
            elif config_key.startswith('monitoring.'):
                # Monitoring thresholds
                monitoring_config = {
                    'monitoring.cpuThreshold': ('NP Servers CPU usage threshold', '%'),
                    'monitoring.ramThreshold': ('NP Servers RAM usage threshold', '%'),
                    'monitoring.diskThreshold': ('NP Servers Disk usage threshold', '%'),
                    'monitoring.networkThreshold': ('NP Servers Network usage threshold', '%'),
                    'monitoring.IPpingInterval': ('NP IPs monitoring interval', ' seconds'),
                    'monitoring.repeatFrequency': ('NP Servers Alert repeat frequency', ' minute(s)')
                }
                
                if config_key in monitoring_config:
                    display_name, unit = monitoring_config[config_key]
                    return f"{actor} changed {display_name} from {old_value}{unit} to {new_value}{unit}"
                
            elif config_key.startswith('monitoring_p1'):
                # Monitoring thresholds
                monitoring_config = {
                    'monitoring_p1.cpuThreshold': ('P1 Servers CPU usage threshold', '%'),
                    'monitoring_p1.ramThreshold': ('P1 Servers RAM usage threshold', '%'),
                    'monitoring_p1.diskThreshold': ('P1 Servers Disk usage threshold', '%'),
                    'monitoring_p1.networkThreshold': ('P1 Servers Network usage threshold', '%'),
                    'monitoring_p1.IPpingInterval': ('P1 IP monitoring ping interval', ' seconds'),
                    'monitoring_p1.repeatFrequency': ('P1 Servers Alert repeat frequency', ' minute(s)')
                }
                
                if config_key in monitoring_config:
                    display_name, unit = monitoring_config[config_key]
                    return f"{actor} changed {display_name} from {old_value}{unit} to {new_value}{unit}"
            elif config_key.startswith('monitoring_p2'):
                # Monitoring thresholds
                monitoring_config = {
                    'monitoring_p2.cpuThreshold': ('P2 Servers CPU usage threshold', '%'),
                    'monitoring_p2.ramThreshold': ('P2 Servers RAM usage threshold', '%'),
                    'monitoring_p2.diskThreshold': ('P2 Servers Disk usage threshold', '%'),
                    'monitoring_p2.networkThreshold': ('P2 Servers Network usage threshold', '%'),
                    'monitoring_p2.IPpingInterval': ('P2 IP monitoring ping interval', ' seconds'),
                    'monitoring_p2.repeatFrequency': ('P2 Servers Alert repeat frequency', ' minute(s)')
                }
                
                if config_key in monitoring_config:
                    display_name, unit = monitoring_config[config_key]
                    return f"{actor} changed {display_name} from {old_value}{unit} to {new_value}{unit}"
            elif config_key.startswith('monitoring_p3'):
                # Monitoring thresholds
                monitoring_config = {
                    'monitoring_p3.cpuThreshold': ('P3 Servers CPU usage threshold', '%'),
                    'monitoring_p3.ramThreshold': ('P3 Servers RAM usage threshold', '%'),
                    'monitoring_p3.diskThreshold': ('P3 Servers Disk usage threshold', '%'),
                    'monitoring_p3.networkThreshold': ('P3 Servers Network usage threshold', '%'),
                    'monitoring_p3.IPpingInterval': ('P3 IP monitoring ping interval', ' seconds'),
                    'monitoring_p3.repeatFrequency': ('P3 Servers Alert repeat frequency', ' minute(s)')
                }
                
                if config_key in monitoring_config:
                    display_name, unit = monitoring_config[config_key]
                    return f"{actor} changed {display_name} from {old_value}{unit} to {new_value}{unit}"
            elif config_key.startswith('monitoring_p4'):
                # Monitoring thresholds
                monitoring_config = {
                    'monitoring_p4.cpuThreshold': ('P4 Servers CPU usage threshold', '%'),
                    'monitoring_p4.ramThreshold': ('P4 Servers RAM usage threshold', '%'),
                    'monitoring_p4.diskThreshold': ('p4 Servers Disk usage threshold', '%'),
                    'monitoring_p4.networkThreshold': ('p4 Servers Network usage threshold', '%'),
                    'monitoring_p4.IPpingInterval': ('p4 IP monitoring ping interval', ' seconds'),
                    'monitoring_p4.repeatFrequency': ('p4 Servers Alert repeat frequency', ' minute(s)')
                }
                
                if config_key in monitoring_config:
                    display_name, unit = monitoring_config[config_key]
                    return f"{actor} changed {display_name} from {old_value}{unit} to {new_value}{unit}"
                           
            elif config_key.startswith('dataretention.'):
                config_display = {
                    'dataretention.monitoring': 'Monitoring data retention days',
                    'dataretention.auditlogs': 'Audit logs data retention days',
                    'dataretention.ipmonitoring': 'IPMonitoring data retention days'
                }
                display_name = config_display.get(config_key, config_key)
                return f"{actor} changed {display_name} from {old_value} to {new_value}"
        # Generic fallback
        return f"{actor} {action.lower()}ed {model_name.lower()}"

    def save(self,request=None, old_permissions_snapshot=None,new_permissions_snapshot=None,*args, **kwargs):
        user = None
        ip_address = None
        try:
            if request:
                user=request.user 
                ip_address,is_routable= get_client_ip(request)   
            logger.info(f"save called on {self.__class__.__name__} by user {request.user if request else None}")
            from .audit_logs import AuditLog    
            is_create = self._state.adding
            
        
            if is_create:
                old_data = {}
            else:
                old_obj = self.__class__.objects.get(pk=self.pk)
                old_data = model_to_dict(old_obj)
            
                    
           
            super().save(*args, **kwargs)
        
            if user is None and request is None:
                return
            
            new_data = model_to_dict(self) 

            #  Use force_action if provided, otherwise auto-detect
            action = "CREATE" if is_create else "UPDATE"
            description = self._build_description(
                action=action,
                user=user,
                old_data=old_data,
                new_data=new_data,
                old_permissions=old_permissions_snapshot,
                new_permissions=new_permissions_snapshot
            )
            
            if description is None:
                return

            AuditLog.objects.create(
                model_name=self.__class__.__name__,
                action=action,
                user=user if user else "system",
                description=description,
                ip=ip_address
            )
       
        except Exception as e:
            # Log error but don't prevent save operation
            logger.error(f"Audit log creation failed: {str(e)}", exc_info=True)
    def delete(self,request=None,user=None,*args, **kwargs):
        
        from .audit_logs import AuditLog
        new_data = self._model_data()
        old_obj = self.__class__.objects.get(pk=self.pk)
        old_data = model_to_dict(old_obj)
          # Check if role is assigned to any users (for Role model only)
        if self.__class__.__name__ == "Role":
            # Count users with this role
            assigned_users = self.webuser_set.count()  # Adjust related_name if different
            
            if assigned_users > 0:
                error_msg = (
                    f"Cannot delete role '{self.role_name}' because it is assigned to "
                    f"{assigned_users} user(s). Please reassign or remove these users first."
                )
                raise DRFValidationError({"error": error_msg})
        
        if request:
           user=request.user 
           ip_address,is_routable= get_client_ip(request) 
       
        description = self._build_description(
            action="DELETE",
            user= user,
            new_data=new_data,
            old_data=old_data
        )
        
        AuditLog.objects.create(
            model_name=self.__class__.__name__,
            action="DELETE",
            user=user.username if user else "system",
            description=description,
            ip=ip_address
        )
        super().delete(*args, **kwargs)
    
