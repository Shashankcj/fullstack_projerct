from django.contrib import admin
from .models.models import *
from .models.roles import *
from .models.audit_logs import AuditLog
from .models.jobs import Job

from .models.global_config import *
from django.conf import settings
import pytz

from BaseApp.models.ipmonitor import IPMonitor,IPMonitorCheckpoint
admin.site.register(Agent)
admin.site.register(Device)
# admin.site.register(CPU)
# admin.site.register(GPU)
# admin.site.register(Memory)
# admin.site.register(Storage)
# admin.site.register(Partition)
# admin.site.register(NIC)
# admin.site.register(Port)
# admin.site.register(IPAddress)
admin.site.register(Event)
admin.site.register(CpuMonitoring)
admin.site.register(MemoryMonitoring)
admin.site.register(DiskMonitoring)
admin.site.register(PartitionMonitoring)
admin.site.register(NetworkPortMonitoring)

admin.site.register(WebUser)
admin.site.register(PendingDeletion)
admin.site.register(Group)
admin.site.register(GroupAgentAssignment)
admin.site.register(ApplicationCPUIO)
admin.site.register(ApplicationMemoryIO)
admin.site.register(ApplicationDiskIO)
admin.site.register(Role)
admin.site.register(PermissionSet)
admin.site.register(AuditLog)

admin.site.register(GlobalConfig)
admin.site.register(IPMonitor)
admin.site.register(IPMonitorCheckpoint)
admin.site.register(PriorityGroup)
admin.site.register(Job)


@admin.register(MonitoringCheckpoint)
class MonitoringCheckpointAdmin(admin.ModelAdmin):
    # 1. Point to the custom method name instead of the field name
    list_display = ('uuid', 'agent__uuid', 'agent__hostname', 'display_created_at')
    
    # 2. Use a tuple for filters
    search_fields = ('uuid', 'agent__uuid', 'agent__hostname',) 
    # list_filter = ('agent',)

    # 3. Define the custom method
    def display_created_at(self, obj):
        # Format: YYYY-MM-DD HH:MM:SS
        local_tz = pytz.timezone(settings.TIME_ZONE)  # Replace with your timezone
        obj.timestamp_utc = obj.timestamp_utc.astimezone(local_tz)
        return obj.timestamp_utc.strftime("%H:%M:%S %d-%m-%Y")
    
    # 4. Configure the column headers and sorting
    display_created_at.admin_order_field = 'timestamp_utc'  # Keeps the column sortable
    display_created_at.short_description = 'Timestamp'  # Sets the column header name

@admin.register(Storage, Partition, CPU, GPU, Memory, NIC, Port, IPAddress)
class BaseAdminClass(admin.ModelAdmin):
    # list_display = ('device__agent__hostname',)
    # search_fields = ('device__agent__hostname',)

    model_to_field_map = {
        Storage: 'device__agent__hostname',
        Partition: 'storage__device__agent__hostname',
        CPU: 'device__agent__hostname',
        GPU: 'device__agent__hostname',
        Memory: 'device__agent__hostname',
        NIC: 'device__agent__hostname',
        Port: 'nic__device__agent__hostname',
        IPAddress: 'port__nic__device__agent__hostname',
    }


    def get_list_filter(self, request):
        # 1. Fetch the correct relationship path for the current model
        filter_field = self.model_to_field_map.get(self.model)
        
        # 2. Return it as a tuple (which Django requires for filters)
        if filter_field:
            return (filter_field,)
        
        # 3. Fallback to no filters if a model isn't in the map
        return ()

    # def get_list_display(self, request):
    #     # 1. Handle Partition
    #     return BaseAdminClass.model_to_field_map.get(self.model, 'id'),

admin.site.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    list_display = ('source', 'alert_type', 'severity', 'timestamp')
    # search_fields = ()
    list_filter = ('source',)