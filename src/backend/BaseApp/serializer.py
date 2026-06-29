import email
import webbrowser
from rest_framework import serializers
from .models import Agent, Application
from rest_framework import serializers
from oauth2_provider.models import Application
from .models import Agent
from rest_framework import serializers
from django.core.validators import validate_ipv4_address, validate_ipv6_address
from BaseApp.models.models import *
from .models import *
from django.db import transaction
from BaseApp.models.ipmonitor import IPMonitor,IPMonitorCheckpoint
from django.contrib.auth.hashers import make_password
import logging
from django.contrib.auth.hashers import check_password
from BaseApp.models import Group, GroupAgentAssignment, Agent, WebUser
from BaseApp.models import PermissionSet
from BaseApp.models import PriorityGroup
from BaseApp.models import Job


def normalize_uuid(value):
    try:
        return uuid.UUID(str(value))
    except Exception:
        return None
# CPU Serializer
class CPUSerializer(serializers.ModelSerializer):
    uuid = serializers.UUIDField(required=True)
    class Meta:
        model = CPU
        fields = ['uuid','make', 'model', 'p_cores', 'l_cores', 'speed']
    def validate(self, attrs):
        speed = attrs.get('speed')
        if speed is not None:
            attrs['speed'] = convert_speed(speed, "MHz")
        return attrs
    
# Memory Serializer
class MemorySerializer(serializers.ModelSerializer):
    uuid = serializers.UUIDField(required=True)
    class Meta:
        model = Memory
        fields = ['uuid','make', 'model', 'speed', 'size', 'serial_number']
    def validate(self, attrs):
        speed = attrs.get('speed')
        size = attrs.get('size')

        if speed is not None:
            attrs['speed'] = convert_speed(speed, "MHz")
        if size is not None:
            attrs['size'] = convert_bytes_to_human_readable(size, "GB")
        return attrs
# Partition Serializer
class PartitionSerializer(serializers.ModelSerializer):
    uuid = serializers.UUIDField(required=True)
    class Meta:
        model = Partition
        fields = ['uuid','name','serial_number', 'fs_type', 'free_space', 'used_space', 'total_size']
    def validate(self, attrs):
        fields = ['free_space', 'used_space', 'total_size']
        
        for field in fields:
            if field in attrs:
                attrs[field] = convert_bytes_to_human_readable(attrs[field], "GB")

        return attrs
# Storage Serializer
class StorageSerializer(serializers.ModelSerializer):
    uuid = serializers.UUIDField(required=True)
    partition = PartitionSerializer(many=True)

    class Meta:
        model = Storage
        fields = ['uuid','hw_disk_type', 'name','make', 'model', 'serial_number', 'base_fs_type', 'free_space', 'total_disk_usage', 'total_disk_size',"allocated_disk_size",'unallocated_disk_size','partition','is_flagged','flagged_at','flagged_reason']
        
    def validate(self, attrs):
        fields = ['free_space', 'total_disk_usage', 'total_disk_size', 'unallocated_disk_size',"allocated_disk_size"]
        
        for field in fields:
            if field in attrs:
                attrs[field] = convert_bytes_to_human_readable(attrs[field], "GB")

        return attrs
    def create(self, validated_data):
        partition_data = validated_data.pop('partition', [])
        storage = Storage.objects.create(**validated_data)

        for part in partition_data:
            Partition.objects.create(storage=storage, **part)

        return storage
# IP Address Serializer
class IPAddressSerializer(serializers.ModelSerializer):
    uuid = serializers.UUIDField(required=True)
    gateway = serializers.CharField(required=False)  
    def validate_gateway(self, value):
        if value.lower() == "unknown":
            return None  
        try:
            validate_ipv4_address(value)
            return value
        except serializers.ValidationError:
            try:
                validate_ipv6_address(value)
                return value
            except serializers.ValidationError:
                raise serializers.ValidationError("Enter a valid IPv4 or IPv6 address or use 'Unknown'.")

    class Meta:
        model = IPAddress
        fields = ['uuid','address', 'gateway', 'subnet_mask', 'dns']
#  Port Serializer
class PortSerializer(serializers.ModelSerializer):
    uuid = serializers.UUIDField(required=True)
    ip = IPAddressSerializer(many=True)
   
    class Meta:
        model = Port
        fields = ['uuid','name', 'operating_speed', 'is_physical_logical', 'logical_type', 'ip']

    def create(self, validated_data):
        ip_data = validated_data.pop('ip', [])
        port = Port.objects.create(**validated_data)
        for ip in ip_data:
            IPAddress.objects.create(port=port, **ip)
        return port
    
    def validate(self, attrs):
        operating_speed = attrs.get('operating_speed')
        if operating_speed is not None:
            attrs['operating_speed'] = convert_bandwidth(operating_speed)
        return attrs
class NICSerializer(serializers.ModelSerializer):
    uuid = serializers.UUIDField(required=True)
    port = PortSerializer(many=True)
    class Meta:
        model = NIC
        fields = ['uuid','make', 'model', 'number_of_ports', 'max_speed', 'supported_speeds','mac_address', 'serial_number', 'port']
    def validate(self, attrs):
        # Convert max_speed if it's present
        max_speed = attrs.get('max_speed')
        if max_speed is not None:
            attrs['max_speed'] = convert_bandwidth(max_speed)
        # Convert supported_speeds
        supported_speeds = attrs.get('supported_speeds')
        if supported_speeds:
            if isinstance(supported_speeds, str):
                speeds = supported_speeds.split(',')
            elif isinstance(supported_speeds, list):
                speeds = supported_speeds
            else:
                speeds = []

            converted = []
            for speed in speeds:
                speed_str = str(speed).strip()
                converted.append(convert_bandwidth(speed_str))
            attrs['supported_speeds'] = ", ".join(converted)

        return attrs
    def create(self, validated_data):
        port_data = validated_data.pop('port', [])
        nic = NIC.objects.create(**validated_data)

        for p in port_data:
            PortSerializer().create({**p, 'nic': nic})

        return nic

#  GPU Serializer
class GPUSerializer(serializers.ModelSerializer):
    uuid = serializers.UUIDField(required=True)
    class Meta:
        model = GPU
        fields = ['uuid','make', 'model', 'serial_number', 'size', 'driver']
    def validate(self, attrs):
        size = attrs.get('size')
        if size is not None:
            attrs['size'] = convert_bytes_to_human_readable(size, "GB")
        return attrs
   
#  Device Serializer
class DeviceSerializer(serializers.ModelSerializer):
    uuid = serializers.UUIDField(required=True)
    cpu = CPUSerializer(many=True)
    memory = MemorySerializer(many=True)
    storage = StorageSerializer(many=True)
    partition=PartitionSerializer(many=True,required=False)
    nic = NICSerializer(many=True)
    gpu = GPUSerializer(many=True)
    reboot_time = serializers.CharField(required=False,allow_blank=True,allow_null=True,default="")

    class Meta:
        model = Device
        fields = ['uuid','make', 'model', 'serial_number', 'dev_phy_vm','reboot_time','cpu', 'memory', 'storage', 'nic', 'gpu','partition']
        
    def create(self, validated_data):

        cpu_data = validated_data.pop('cpu', [])
        memory_data = validated_data.pop('memory', [])    
        storage_data = validated_data.pop('storage', [])
        nic_data = validated_data.pop('nic', [])
        gpu_data = validated_data.pop('gpu', [])
         
        device = Device.objects.create(**validated_data)

       
        CPU.objects.bulk_create([CPU(device=device, **cpu) for cpu in cpu_data])
        Memory.objects.bulk_create([Memory(device=device, **memory) for memory in memory_data])
        GPU.objects.bulk_create([GPU(device=device, **gpu) for gpu in gpu_data])
        
        for storage in storage_data:
            StorageSerializer().create({**storage, 'device': device})

        for nic in nic_data:
            NICSerializer().create({**nic, 'device': device})

        return device
    def update(self, instance, validated_data):
        

        with transaction.atomic():

            raw = self.context.get("raw_payload", {})
            logger.info(f"raw :{raw}")

            # Device fields
            for attr, value in validated_data.items():

                if attr not in ["cpu","memory","storage","nic","gpu","partition"]:
                    setattr(instance, attr, value)

            instance.save()

            # CPU
            if "cpu" in raw:

                cpu_data = validated_data.pop("cpu", [])

                for i, cpu in enumerate(cpu_data):
                    raw_cpu = raw.get("cpu", [])
                    raw_item = raw_cpu[i] if i < len(raw_cpu) else {}
                    cpu_uuid = normalize_uuid( raw_item.get("uuid"))
                    CPU.objects.update_or_create(uuid=cpu_uuid,defaults={**cpu,"device": instance})

            # Memory
            if "memory" in raw:
                memory_data = validated_data.pop("memory", [])
                for i, mem in enumerate(memory_data):
                    raw_mem = raw.get("memory", [])
                    raw_item = raw_mem[i] if i < len(raw_mem) else {}

                    mem_uuid = normalize_uuid(raw_item.get("uuid"))

                    Memory.objects.update_or_create(uuid=mem_uuid,defaults={**mem,"device": instance})

            # Storage
            if "storage" in raw:
                storage_data = validated_data.pop("storage", [])
                for i, disk in enumerate(storage_data):
                    partitions = disk.pop("partition", [])
                    raw_storage = raw.get("storage", [])
                    raw_item = raw_storage[i] if i < len(raw_storage) else {}

                    disk_uuid = normalize_uuid(raw_item.get("uuid"))

                    storage_obj, _ = Storage.objects.update_or_create(uuid=disk_uuid,defaults={**disk,"device": instance})

                    raw_partitions = raw_item.get("partition",[])

                    for j, part in enumerate(partitions):

                        raw_part = (raw_partitions[j]if j < len(raw_partitions)else {})

                        part_uuid = normalize_uuid( raw_part.get("uuid"))

                        Partition.objects.update_or_create(uuid=part_uuid, defaults={**part,"storage": storage_obj})

            # Partition only
            if "partition" in raw:
                partition_data = validated_data.pop("partition",[])

                logger.info(f"partition data : {partition_data}")
                raw_partitions = raw.get("partition",[])

                for i, part in enumerate(partition_data):

                    raw_part = (raw_partitions[i] if i < len(raw_partitions) else {})

                    part_uuid = normalize_uuid(raw_part.get("uuid"))

                    storage_uuid = normalize_uuid( raw_part.get("storage_uuid"))

                    storage_obj = Storage.objects.get(uuid=storage_uuid)

                    partition_obj, created = (Partition.objects.update_or_create( uuid=part_uuid, defaults={ **part, "storage": storage_obj } ))

                    logger.info(f"partition saved : "f"{partition_obj.uuid}, "f"created={created}")
            # NIC
            if "nic" in raw:
                nic_data = validated_data.pop("nic", [])
                for i, nic in enumerate(nic_data):
                    ports = nic.pop("port", [])
                    raw_nics = raw.get("nic", [])
                    raw_item = raw_nics[i] if i < len(raw_nics) else {}
                    nic_uuid = normalize_uuid( raw_item.get("uuid"))
                    nic_obj, _ = NIC.objects.update_or_create(uuid=nic_uuid,defaults={**nic,"device": instance})

                    # Ports
                    raw_ports = raw_item.get("port", [])
                    for j, port in enumerate(ports):
                        ips = port.pop("ip", [])
                        raw_port = (raw_ports[j] if j < len(raw_ports) else {})

                        port_uuid = normalize_uuid(raw_port.get("uuid"))

                        port_obj, _ = Port.objects.update_or_create(uuid=port_uuid,defaults={**port,"nic": nic_obj})

                        # IPs
                        raw_ips = raw_port.get("ip", [])
                        for k, ip in enumerate(ips):

                            raw_ip = (raw_ips[k] if k < len(raw_ips) else {})

                            ip_uuid = normalize_uuid(raw_ip.get("uuid"))

                            IPAddress.objects.update_or_create(uuid=ip_uuid,defaults={**ip,"port": port_obj } )
            # GPU
            if "gpu" in raw:
                gpu_data = validated_data.pop("gpu", [])
                for i, gpu in enumerate(gpu_data):

                    raw_gpu = raw.get("gpu", [])
                    raw_item = raw_gpu[i] if i < len(raw_gpu) else {}

                    gpu_uuid = normalize_uuid(raw_item.get("uuid"))

                    GPU.objects.update_or_create(uuid=gpu_uuid,defaults={**gpu,"device": instance})

        return instance
    
class AgentSerializer(serializers.ModelSerializer):
    client_id = serializers.CharField(source="oauth_application.client_id", read_only=True)
    client_secret = serializers.SerializerMethodField()

    class Meta:
        model = Agent
        fields = ["uuid", "os","os_version","hostname","device_fingerprint","system_uuid","master_key","client_id", "client_secret"]

    
    def create(self, validated_data):
        application = Application.objects.create(
            name=f"Agent-{validated_data.get('hostname')}",
            client_type=Application.CLIENT_CONFIDENTIAL,
            authorization_grant_type=Application.GRANT_CLIENT_CREDENTIALS,
            hash_client_secret=False
        )

        validated_data["oauth_application"] = application

        return Agent.objects.create(**validated_data)
    
    
class EventSerializer(serializers.ModelSerializer):
    device_name = serializers.CharField(source='agent.hostname', read_only=True)
    
    class Meta:
        model = Event
        fields =  '__all__'
        
        
class AlertSerializer(serializers.ModelSerializer):
    hostname = serializers.CharField(source='checkpoint.agent.hostname', read_only=True)
    priority = serializers.CharField(source='source.priority.priority_name', allow_null=True)
   
    class Meta:
        model = Alert
        fields = [
            'uuid', 'hostname', 'device_name','alert_type', 'severity', 
            'message', 'created_at', 'is_read','priority','agent','suppressed',
        ]
        
class CpuMonitoringSerializer(serializers.ModelSerializer):
    checkpoint = serializers.CharField(source='checkpoint.uuid', read_only=True)
    component = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=CPU.objects.all(),
        pk_field=serializers.UUIDField(format='hex')
    )  

    class Meta:
        model = CpuMonitoring
        fields = (
            'component', 'p_cores_perc', 'l_cores_perc', 
            'ctx_switches', 'hw_irq', 'sw_irq', 'syscalls', 
            'cpu_utilization', 'checkpoint',
        )

class MemoryMonitoringSerializer(serializers.ModelSerializer):
    checkpoint = serializers.CharField(source='checkpoint.uuid', read_only=True)
    component = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=Memory.objects.all(),
        pk_field=serializers.UUIDField(format='hex')
    )

    class Meta:
        model = MemoryMonitoring
        fields = "__all__"
        
class DiskMonitoringSerializer(serializers.ModelSerializer):
    checkpoint = serializers.CharField(source='checkpoint.uuid', read_only=True)
    component = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=Storage.objects.all(),
        pk_field=serializers.UUIDField(format='hex')
    )

    class Meta:
        model = DiskMonitoring
        fields = (
            'component', 'bytes_read_io', 
            'bytes_write_io', 'disk_usage_percent',
            'read_count_io', 'read_time_io',
            'write_count_io', 'write_time_io',
            'checkpoint', 'total_disk_size',
            'unallocated_disk_space', 'allocated_disk_space',
        )
    
class InterfaceMonitoringSerializer(serializers.ModelSerializer):
    checkpoint = serializers.CharField(source='checkpoint.uuid', read_only=True)
    component = serializers.PrimaryKeyRelatedField(
        write_only=True,
        queryset=Port.objects.all(),
        pk_field=serializers.UUIDField(format='hex')
    )

    class Meta:
        model = NetworkPortMonitoring
        fields = "__all__"
    
class PartitionMonitoringSerializer(serializers.ModelSerializer):
    checkpoint = serializers.CharField(source='checkpoint.uuid', read_only=True)
    # storage_disk = serializers.PrimaryKeyRelatedField(
    #     write_only=True,
    #     queryset=Storage.objects.all(),
    #     pk_field=serializers.UUIDField(format='hex')
    # )
    component = serializers.PrimaryKeyRelatedField( 
        write_only=True,
        queryset=Partition.objects.all(),
        pk_field=serializers.UUIDField(format='hex')
    )

    class Meta:
        model = PartitionMonitoring
        fields = "__all__"

class WebUserSerializer(serializers.ModelSerializer):
    confirm_password = serializers.CharField(write_only=True)
    role_name = serializers.CharField(source='role.role_name', read_only=True)
    
    class Meta:
        model = WebUser
        fields ='__all__' 
        extra_kwargs = {
            'password': {'write_only': True},
            'role': {'write_only': True},
        }
 
    def validate_password(self, value):
        """
        Validate password strength
        """
       
    
        if not value:
            return value
        
        errors = []
        
        # Minimum 8 characters
        if len(value) < 8:
            errors.append("Password must be at least 8 characters long.")
        
        # At least one uppercase letter
        if not re.search(r'[A-Z]', value):
            errors.append("Password must contain at least one uppercase letter.")
        
        #  At least one lowercase letter
        if not re.search(r'[a-z]', value):
            errors.append("Password must contain at least one lowercase letter.")
        
        # At least one number
        if not re.search(r'\d', value):
            errors.append("Password must contain at least one number.")
        
        # At least one special character
        if not re.search(r'[!@#$%^&*()_+\-=\[\]{};:,.<>?/\\|`~]', value):
            errors.append("Password must contain at least one special character.")
        
        # Raise errors if any validation failed
        if errors:
            raise serializers.ValidationError(errors)
        
        return value
 
    def validate(self, attrs):
        """Cross-field validation"""
        password = attrs.get('password')
        confirm_password = attrs.get('confirm_password')
        
        is_create = self.instance is None
        #  Password required for creation
        if is_create and not password:
            raise serializers.ValidationError({
                'password': 'Password is required when creating a user.'
            })
        
        # Validate password confirmation
        if password:
            if password != confirm_password:
                raise serializers.ValidationError({
                    'confirm_password': 'Passwords do not match.'
                })
            
        #  For updates: check if same as current password
        if password and self.instance and self.instance.pk:
            # Use Django's check_password function directly
            if check_password(password, self.instance.password):
                raise serializers.ValidationError({
                    'password': 'New password cannot be the same as your old password.'
                })
    
        return attrs

    def create(self, validated_data):
        request= self.context["request"]
        validated_data.pop('confirm_password')
        role = validated_data.get('role') 
        
        # Create user
        user = WebUser(**validated_data)
        user.password = make_password(validated_data['password']) 
        
        user.save(request=request)
        return user  
    def update(self, instance, validated_data):
        """Update user"""
        request = self.context.get("request")
        validated_data.pop('confirm_password', None)
        
        # Extract password if provided
        password = validated_data.pop('password', None)
        # Update other fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.password = make_password(password)
        
         # Save updated user
        instance.save(request=request)
        return instance
    


class Deviceserializer(serializers.ModelSerializer):
    """Serializer for Agent/Device data in groups"""
    dev_phy_vm = serializers.SerializerMethodField() 
    ip_address = serializers.SerializerMethodField()
    make_model = serializers.SerializerMethodField()

    class Meta:
        model = Device  # Correct model
        fields = ['uuid', 'dev_phy_vm', 'ip_address', 'make_model','reboot_time']  # Include other fields as needed

    def get_dev_phy_vm(self, obj):
        # obj is Device instance - access directly
        return getattr(obj, 'dev_phy_vm', None)

    def get_ip_address(self, obj):
        #  obj is Device - traverse nic → port → ip
        if obj.nic.exists():
            for nic in obj.nic.all():
                for port in nic.port.all():
                    for ip in port.ip.all():
                        if ip.gateway and ip.gateway != "0.0.0.0":
                            return ip.address
        return None
    
    def get_make_model(self, obj):
        return f"{obj.make} {obj.model}"
    
class WebAgentserializer(serializers.ModelSerializer):
    device = Deviceserializer(read_only=True)
    priority= serializers.CharField(source='priority.priority_name', read_only=True)
    class Meta:
        model = Agent
        fields = ["uuid", "os", "os_version", "hostname", "device","status","priority", "last_activated_at","last_seen","last_uptime_duration","device", "maintenance_mode",
            "maintenance_start",
            "maintenance_end","health_status",]  
        

class GroupAgentAssignmentSerializer(serializers.ModelSerializer):
    """Serializer for group-agent assignments with device details"""
    agent = Deviceserializer(read_only=True)
    
    class Meta:
        model = GroupAgentAssignment
        fields = ['agent', 'priority', 'added_at']

class GroupSerializer(serializers.ModelSerializer):
    """Serializer for Group with nested devices"""
    devices = GroupAgentAssignmentSerializer(source='agent_assignments', many=True, read_only=True)
    device_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Group
        fields = ['group_id', 'group_name', 'group_description', 'created_at', 'device_count', 'devices']
    
    def get_device_count(self, obj):
        return obj.agent_assignments.count()

class UserGroupsSerializer(serializers.Serializer):
    """Complete serializer for user with all their groups"""
    user = serializers.SerializerMethodField()
    groups = GroupSerializer(many=True)
    total_groups = serializers.SerializerMethodField()
    timestamp = serializers.DateTimeField(read_only=True)
    
    def get_user(self, obj):
        user = self.context['request'].user
        return {
            'id': str(user.id),
            'username': user.username,
            'email': user.email
        }
    
    def get_total_groups(self, obj):
        return len(obj['groups']) if isinstance(obj, dict) and 'groups' in obj else obj.count()


class WebAgentSerializer(serializers.ModelSerializer):
    device = DeviceSerializer(read_only=True)
    monitoring_data = serializers.SerializerMethodField()  
    priority= serializers.CharField(source='priority.priority_name', read_only=True)
    class Meta:
        model = Agent
        fields = ["uuid", "os", "os_version", "hostname", "device","status","priority","uptime_started_at","last_activated_at","last_seen","last_uptime_duration","monitoring_data", "maintenance_mode",
            "maintenance_start",
            "maintenance_end","health_status",]  

    def get_monitoring_data(self, obj):
        events = obj.event_set.all().order_by('-created_at')[:100]
        checkpoint_uuids = obj.checkpoints.values_list('uuid', flat=True)
        alerts = Alert.objects.filter(checkpoint_id__in=checkpoint_uuids,suppressed=False).order_by('-created_at')
        return {
            "events": EventSerializer(events, many=True).data,
            "alerts": AlertSerializer(alerts, many=True).data,
        }
    
class DeviceInfoSerializer(serializers.ModelSerializer):
    """Slim serializer for device detail page — no monitoring data."""
    device   = DeviceSerializer(read_only=True)
    priority = serializers.CharField(source='priority.priority_name', read_only=True)

    class Meta:
        model  = Agent
        fields = [
            "uuid",
            "os",
            "os_version",
            "status",
            "uptime_started_at",
            "last_seen",
            "last_uptime_duration",
            "hostname",
            "priority",
            "device",
        ]
        
class GroupAgentAssignmentSerializer(serializers.ModelSerializer):
    """Serializer for group-agent assignments with device details"""
    agent = Deviceserializer(read_only=True)
    
    class Meta:
        model = GroupAgentAssignment
        fields = ['agent', 'priority', 'added_at']

class GroupSerializer(serializers.ModelSerializer):
    """Serializer for Group with nested devices"""
    devices = GroupAgentAssignmentSerializer(source='agent_assignments', many=True, read_only=True)
    device_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Group
        fields = ['group_id', 'group_name', 'group_description', 'created_at', 'device_count', 'devices']
    
    def get_device_count(self, obj):
        return obj.agent_assignments.count()

class UserGroupsSerializer(serializers.Serializer):
    """Complete serializer for user with all their groups"""
    user = serializers.SerializerMethodField()
    groups = GroupSerializer(many=True)
    total_groups = serializers.SerializerMethodField()
    timestamp = serializers.DateTimeField(read_only=True)
    
    def get_user(self, obj):
        user = self.context['request'].user
        return {
            'id': str(user.id),
            'username': user.username,
            'email': user.email
        }
    
    def get_total_groups(self, obj):
        return len(obj['groups']) if isinstance(obj, dict) and 'groups' in obj else obj.count()
    
class DeviceNICSerializer(serializers.ModelSerializer):
    nic = NICSerializer(many=True) 
    class Meta:
        model = Device
        fields = [ 'nic']   
    
class AvailableWebAgentSerializer(serializers.ModelSerializer):
    device = DeviceNICSerializer(read_only=True)
    class Meta:
        model = Agent
        fields = ["uuid", "os", "os_version", "hostname", "device","status","uptime_started_at"]  

class RoleSerializer(serializers.ModelSerializer):
    """
    Serializer for Role model
    Basic role details without sss
    """

    class Meta:
        model = Role
        fields = ['role_name']

class PermissionSetSerializer(serializers.ModelSerializer):
    """
    Serializer for PermissionSet model
    Handles individual permission records
    """
    
    class Meta:
        model = PermissionSet
        fields =[
            'module',
            'create',
            'read',
            'update',
            'delete'
        ]

class RoleListSerializer(serializers.ModelSerializer):
    """
    Role list serializer with permission details
    Returns role with complete permission set
    """
    permissions = PermissionSetSerializer(
        source='permissionset_set',
        many=True,
        read_only=True
    )

    class Meta:
        model = Role
        fields = [
            'uuid',
            'role_name',
            'permissions'
        ]


class PermissionSetCreateSerializer(serializers.Serializer):
    """
    Serializer for creating permissions in bulk
    Used when creating/updating roles with permissions
    """
    # Define fields explicitly (not model/fields like ModelSerializer)
    module = serializers.ChoiceField(
        choices=[m[0] for m in PermissionSet.modules]
    )
    create = serializers.BooleanField(required=False, default=False)
    read = serializers.BooleanField(required=False, default=False)
    update = serializers.BooleanField(required=False, default=False)
    delete = serializers.BooleanField(required=False, default=False)
    
    def validate_module(self, value):
        """Validate module is valid"""
        valid_modules = [m[0] for m in PermissionSet.modules]
        if value not in valid_modules:
            raise serializers.ValidationError(
                f"Invalid module. Choose from: {', '.join(valid_modules)}"
            )
        return value
    
    def validate(self, data):
        """Validate at least one permission is set"""
        has_any_permission = any([
            data.get('create', False),
            data.get('read', False),
            data.get('update', False),
            data.get('delete', False)
        ])
        
        
        return data

class RoleCreateUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating/updating roles with permissions
    Handles nested permission creation/update
    """
   
    permissions = PermissionSetCreateSerializer(
        many=True,
        write_only=True,
        required=False
    )
    
    class Meta:
        model = Role
        fields = [
            'uuid',
            'role_name',
            'permissions'
        ]
        read_only_fields = ['uuid']
        extra_kwargs = {
            'role_name': {'required': False}  # Make optional for partial updates
        }
    
    def validate_role_name(self, value):
        """Validate role name"""
        if not value or len(value.strip()) == 0:
            raise serializers.ValidationError(
                "Role name cannot be empty"
            )
        
        # Check for duplicate
        instance = self.instance
        query = Role.objects.filter(role_name__iexact=value)
        
        if instance:
            # Exclude current role when checking for duplicates
            query = query.exclude(uuid=instance.uuid)
        
        if query.exists():
            raise serializers.ValidationError(
                f"Role with name '{value}' already exists"
            )
        
        return value
    
    def validate_permissions(self, value):
        """Validate permissions list"""
        if not value:
            return value
        
        # Ensure it's a list
        if not isinstance(value, list):
            raise serializers.ValidationError("Permissions must be a list")
        
        # Check for duplicate modules
        modules = [perm.get('module') for perm in value]
        if len(modules) != len(set(modules)):
            raise serializers.ValidationError(
                "Duplicate modules in permissions"
            )
        
        return value
    
    def create(self, validated_data):
        """Create role with nested permissions"""
        try:
            request= self.context['request']
        
            # Extract permissions from validated_data
            permissions_data = validated_data.pop('permissions', [])
            
            # Build new permissions snapshot from the incoming data
            new_permissions_snapshot = {}
            for perm_data in permissions_data:
                module = perm_data['module']
                # Get display name if available
                try:
                    from BaseApp.models import PermissionSet
                    module_display = dict(PermissionSet.modules).get(module, module)
                except:
                    module_display = module
                    
                new_permissions_snapshot[module] = {
                    'create': perm_data.get('create', False),
                    'read': perm_data.get('read', False),
                    'update': perm_data.get('update', False),
                    'delete': perm_data.get('delete', False),
                    'display': module_display
                }
            
            # Create role instance (not saved yet)
            role = Role(**validated_data)
            
            # Save with new permissions snapshot for audit log
            role.save(request=request, new_permissions_snapshot=new_permissions_snapshot)
        
            # Create permissions
            for perm_data in permissions_data:
                perm=PermissionSet.objects.create(
                    role=role,
                    module=perm_data['module'],
                    create=perm_data.get('create', False),
                    read=perm_data.get('read', False),
                    update=perm_data.get('update', False),
                    delete=perm_data.get('delete', False)
                )
                print(f"Created permission: {perm.module} - C:{perm.create} R:{perm.read} U:{perm.update} D:{perm.delete}")
        
        # Verify permissions were created
            created_perms = role.permissionset_set.all()
            print(f"Total permissions created: {created_perms.count()}")
                
            role.save(request=request)
            return role
        except Exception as e:
            # Rollback if creation fails
            if 'role' in locals():
                role.delete()
            raise serializers.ValidationError(f"Failed to create role: {str(e)}")
    
    def update(self, instance, validated_data):
        print("=== SERIALIZER UPDATE CALLED TO UPDATE ROLE ===")
        """
        Update role and/or its permissions
        - If role_name provided: update role name
        - If permissions provided: update permissions
        """
        try:
            request= self.context['request']
            request_user=request.user
            permissions_data = validated_data.pop('permissions', None)
            print(f"requested user to update {request_user}")
            # Update role name only if provided

            old_permissionset_snapshot = None
            if permissions_data is not None:
               old_permissionset_snapshot = {}
               for perm in instance.permissionset_set.all():
                   module_display = perm.get_module_display() if hasattr(perm,'get_module_display') else perm.module
                   old_permissionset_snapshot[perm.module] = {
                       'create':perm.create,
                       'read':perm.read,
                       'update':perm.update,
                       'delete': perm.delete,
                       'display': module_display

                   }

            if 'role_name' in validated_data:
                instance.role_name = validated_data['role_name']
            
            # Update permissions only if provided
            if permissions_data is not None:
                # Ensure it's a list
                if not isinstance(permissions_data, list):
                    raise serializers.ValidationError("Permissions must be a list")
                
                # Get existing permissions mapped by module
                existing_permission = {
                    perm.module: perm
                    for perm in instance.permissionset_set.all()
                }

                updated_modules = set()
                
                # Process each permission in the request
                for perm_data in permissions_data:
                    module = perm_data.get('module')
                    updated_modules.add(module)
                    
                    # Update existing or create new
                    if module in existing_permission:
                        # Update existing permission
                        perm = existing_permission[module]
                        perm.create = perm_data.get("create", False)
                        perm.read = perm_data.get('read', False)
                        perm.update = perm_data.get('update', False)
                        perm.delete = perm_data.get('delete', False)
                        perm.save()  # ✅ Save individual permission (no audit)
                    else:
                        # Create new permission
                        PermissionSet.objects.create(
                            role=instance,
                            module=module,
                            create=perm_data.get('create', False),
                            read=perm_data.get('read', False),
                            update=perm_data.get('update', False),
                            delete=perm_data.get('delete', False)
                        )
                
                # Delete removed permissions
                modules_delete = set(existing_permission.keys()) - updated_modules
                if modules_delete:
                    instance.permissionset_set.filter(module__in=modules_delete).delete()
            
            #  Save role with audit log (includes permission changes)
            instance.save(old_permissions_snapshot=old_permissionset_snapshot,request=request)
            
            return instance
            
        except Exception as e:
            raise serializers.ValidationError(f"Failed to update role: {str(e)}")

from BaseApp.models.audit_logs import AuditLog

class AuditLogSerializer(serializers.ModelSerializer):
    severity_display= serializers.SerializerMethodField()
    
    class Meta:
        model = AuditLog
        fields = [
            'uuid', 'user', 'action', 'model_name', 'description',
            'ip', 'severity_display', 'timestamp'
        ]

    def get_severity_display(self, obj):
        return obj.get_severity_display() 


class IPMonitorSerializer(serializers.ModelSerializer):
    # These fields come from the annotate() in the view
    status = serializers.CharField(read_only=True, allow_null=True)
    min_latency = serializers.FloatField(read_only=True, allow_null=True)
    max_latency = serializers.FloatField(read_only=True, allow_null=True)
    jitter = serializers.FloatField(read_only=True, allow_null=True)
    created_at = serializers.DateTimeField(read_only=True, allow_null=True)
    priority= serializers.CharField(source='priority.priority_name', read_only=True)
    class Meta:
        model = IPMonitor
        fields = [
            'uuid',
            'ip_address',
            'name',
            'status',
            'min_latency',
            'max_latency',
            'jitter',
            'created_at',
            'priority'
        ]
        read_only_fields=['uuid']
     
    def validate_ip_address(self, value):
        """Validate IP format and uniqueness"""
        import ipaddress
        
        # Validate format
        try:
            ipaddress.ip_address(value)
        except ValueError:
            raise serializers.ValidationError(f"Invalid IP address: {value}")
        
        # Check uniqueness (exclude current instance during update)
        instance = self.instance
        query = IPMonitor.objects.filter(ip_address=value)
        if instance:
            query = query.exclude(uuid=instance.uuid)
        if query.exists():
            raise serializers.ValidationError(
                "An IP Monitor with this IP address already exists."
            )
        return value
    
    def validate_name(self, value):
        """Validate name uniqueness"""
        instance = self.instance
        query = IPMonitor.objects.filter(name__iexact=value)
        if instance:
            query = query.exclude(uuid=instance.uuid)
    
        if query.exists():
            raise serializers.ValidationError(
                "An IP Monitor with this name already exists."
            )
        return value
    
       
    
    def update(self, instance, validated_data):
        # Only update name and ip_address
        if 'ip_address' in validated_data and validated_data['ip_address'] != instance.ip_address:
            # Reset monitoring data when IP changes
            instance.status = 'down'
            instance.response_time = None
            instance.last_checked = None
        
        instance.name = validated_data.get('name', instance.name)
        instance.ip_address = validated_data.get('ip_address', instance.ip_address)
        
        instance.save()
        return instance
    
class IPMonitorCSVSerializer(serializers.Serializer):
    csv_file = serializers.FileField()
    
class PriorityGroupSerializer(serializers.ModelSerializer): 
    class Meta:
        model = PriorityGroup
        fields =["uuid","priority_name"]
        

class JobSerializer(serializers.ModelSerializer):
    class Meta:
        model = Job
        fields = [
            "uuid",
            "user",
            "job_type",
            "total_rows",
            "created_count",
            "updated_count",
            "duplicate_count",
            "error_count",
            "status",
            "result",
            "created_at",
        ]


