from BaseApp.services.imports import json,Response,Device,Storage,StorageSerializer,status,Partition,PartitionSerializer,convert_bytes_to_human_readable
from asgiref.sync import async_to_sync
from .event_service import EventService 
def updation_unknown_disk_partition(request,device_uuid = None):
    data = json.loads(request.data)
    # data = request.data
    response_data = []

    # === Disk Section ===
    # input_data = data
    input_data = data.get("disk", [])
    if not isinstance(input_data, list):
        return Response({"error": "Invalid input format. Expected a list under 'disk'."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        device = Device.objects.get(uuid=device_uuid)
    except Device.DoesNotExist:
        return Response({"error": "Device not found."}, status=status.HTTP_404_NOT_FOUND)

    for disk_data in input_data:
        os_uuid_disk = disk_data.get("os_uuid", "unknown")
        disk_uuid = disk_data.get("uuid", "unknown")
        partition_data = disk_data.pop("partition", [])
        
        created_partitions = []
        updated_partitions = []

        if disk_uuid.lower() == "unknown" or not Storage.objects.filter(uuid=disk_uuid).exists():
            # New Disk
            storage_serializer = StorageSerializer(data={**disk_data, "partition": partition_data})
            if storage_serializer.is_valid(raise_exception=False):
                storage = storage_serializer.save(device=device)
                storage_data = StorageSerializer(storage).data
                async_to_sync(EventService.create_event)(
                        agent=device.agent if device.agent else None,
                        event_type="CREATED",
                        description=f"New Disk Added on device {device.agent.hostname if device.agent else 'Unknown Agent'}",
                        component_type="Disk"
                )
                storage_data["os_uuid"] = os_uuid_disk

                for part, part_input in zip(storage_data.get("partition", []), partition_data):
                    part["os_uuid"] = part_input.get("os_uuid", "unknown")
                
                response_data.append({
                    "status": "created",
                    "device_uuid": device_uuid,
                    "storage": storage_data
                })
            else:
                return Response({"error": "Storage serializer error", "details": storage_serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        else:
            # Existing Disk
            disk = Storage.objects.get(uuid=disk_uuid)

            for field in ['make', 'model', 'serial_number', 'base_fs_type', 'hw_disk_type', 'free_space', 'total_disk_usage', 'total_disk_size','unallocated_disk_size']:
                if field in disk_data:
                    value = disk_data[field]
                    if field in ['free_space', 'total_disk_usage', 'total_disk_size','unallocated_disk_size']:
                        value = convert_bytes_to_human_readable(value, 'GB')
                    setattr(disk, field, value)
            disk.save()
            changed =False
            for part_data in partition_data:
                os_uuid_part = part_data.pop("os_uuid", None)
                partition_uuid = part_data.get("uuid", "unknown")
                existing_partition = Partition.objects.filter(uuid=partition_uuid, storage=disk).first() if partition_uuid.lower() != "unknown" else None

                if existing_partition:
                    for field in ['free_space', 'used_space', 'total_size', 'name', 'fs_type','serial_number']:
                        if field in part_data:
                            value = part_data[field]
                            if field in ['free_space', 'used_space', 'total_size']:
                                value = convert_bytes_to_human_readable(value, "GB")
                                
                            if getattr(existing_partition, field) != value:
                                setattr(existing_partition, field, value)
                                changed = True
                    if changed:    
                        existing_partition.save()

                    updated_partitions.append({
                        "uuid": str(existing_partition.uuid),
                        "os_uuid": os_uuid_part,
                        "name": existing_partition.name,
                        "fs_type": existing_partition.fs_type,
                        "free_space": existing_partition.free_space,
                        "used_space": existing_partition.used_space,
                        "total_size": existing_partition.total_size,
                        "serial_number":existing_partition.serial_number
                    })
                else:
                    for field in ['free_space', 'used_space', 'total_size']:
                        if field in part_data:
                            part_data[field] = convert_bytes_to_human_readable(part_data[field], "GB")
                    part_data['storage'] = disk.uuid
                    
                    partition_serializer = PartitionSerializer(data=part_data)
                    if partition_serializer.is_valid(raise_exception=False):
                        partition = partition_serializer.save(storage=disk)
                        async_to_sync(EventService.create_event)(
                        agent=device.agent if device.agent else None,
                        event_type="CREATED",
                        description=f"Partition {partition.name} is created in {disk.serial_number} on device {device.agent.hostname if device.agent else 'Unknown Agent'}",
                        component_type=f"Partition {partition.name}"
                     )
                        created_partitions.append({
                            "uuid": str(partition.uuid),
                            "os_uuid": os_uuid_part,
                            "name": partition.name,
                            "fs_type": partition.fs_type,
                            "free_space": partition.free_space,
                            "used_space": partition.used_space,
                            "total_size": partition.total_size,
                            "serial_number":partition.serial_number
                        })
                    else:
                        return Response({"error": "Partition serializer error", "details": partition_serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

            if created_partitions:
                response_data.append({
                    "status": "updated",
                    "device_uuid": device_uuid,
                    "storage": {
                        "uuid": str(disk.uuid),
                        "os_uuid": os_uuid_disk,
                        "make": disk.make,
                        "model": disk.model,
                        "serial_number": disk.serial_number,
                        "hw_disk_type": disk.hw_disk_type,
                        "base_fs_type": disk.base_fs_type,
                        "free_space": disk.free_space,
                        "total_disk_usage": disk.total_disk_usage,
                        "total_disk_size": disk.total_disk_size, 
                        "unallocated_disk_size": disk.unallocated_disk_size,
                        "partition": created_partitions
                    }
                })
    return Response(response_data, status=status.HTTP_200_OK)