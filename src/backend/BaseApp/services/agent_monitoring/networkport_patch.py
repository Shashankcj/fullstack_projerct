from BaseApp.services.imports import json,Response,status,NIC,NICSerializer,Device,Port,PortSerializer,IPAddress,convert_bandwidth,logging
from asgiref.sync import async_to_sync
from .event_service import EventService

logger = logging.getLogger("agent_monitoring")
def updation_unknown_networkport(request,device_uuid=None):
    data = json.loads(request.data)
    response_data = []
    input_data = data.get("nic", [])
    if not isinstance(input_data, list):
        return Response({"error": "Invalid input format. Expected a list under 'nic'."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        device = Device.objects.get(uuid=device_uuid)
    except Device.DoesNotExist:
        return Response({"error": "Device not found."}, status=status.HTTP_404_NOT_FOUND)
    for nic_data in input_data:
            os_uuid_nic = nic_data.get("os_uuid", "unknown")
            nic_uuid = nic_data.get("uuid", "unknown")
            port_data = nic_data.pop("port", [])
            
            created_ports = []

            if nic_uuid.lower() == "unknown" or not NIC.objects.filter(uuid=nic_uuid).exists():
                # New NIC
                nic_serializer = NICSerializer(data={**nic_data, "port": port_data})
                if nic_serializer.is_valid(raise_exception=False):
                    nic = nic_serializer.save(device=device)
                    nic_data_resp = NICSerializer(nic).data
                    nic_data_resp["os_uuid"] = os_uuid_nic
                     
                    for port_resp, port_input in zip(nic_data_resp.get("port", []), port_data):
                        port_resp["os_uuid"] = port_input.get("os_uuid", "unknown")

                    response_data.append({
                        "status": "created",
                        "device_uuid": device_uuid,
                        "nic": nic_data_resp
                    })
                else:
                    return Response({"error": "NIC serializer error", "details": nic_serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
                async_to_sync(EventService.create_event)(
                        agent=device.agent if device.agent else None,
                        event_type="CREATED",
                        description=f"New NIC Added on device {device.agent.hostname if device.agent else 'Unknown Agent'}",
                        component_type="Nic"
                )
            else:
                # Existing NIC
                nic = NIC.objects.get(uuid=nic_uuid)

                for field in ['make', 'model', 'number_of_ports', 'max_speed', 'supported_speeds', 'serial_number','mac_address']:
                    if field in nic_data:
                        value = nic_data[field]
                        
                        if field == 'supported_speeds':
                            value = nic_data[field]
                            
                            # If string: "1000, 2500"
                            if isinstance(value, str):
                                value = [v.strip() for v in value.split(',')]
                            
                            # If already list, ensure clean conversion
                            if isinstance(value, list):
                                value = [
                                    convert_bandwidth(float(v)) if str(v).replace('.', '', 1).isdigit() else str(v)
                                    for v in value
                                ]
                                value = ", ".join(value)  # Convert list to string: "1.0 Kbps, 2.5 Kbps"

                            nic_data[field] = value

                        if field == 'max_speed' and isinstance(value, (int, float)):
                            value = convert_bandwidth(value)

                        setattr(nic, field, value)
                nic.save()
                for port in port_data:
                    os_uuid_port = port.pop("os_uuid", None)
                    port_uuid = port.get("uuid", "unknown")
                    ip_data = port.pop("ip", [])

                    existing_port = Port.objects.filter(uuid=port_uuid, nic=nic).first() if port_uuid.lower() != "unknown" else None

                    if existing_port:
                        for field in ['interface_name', 'operating_speed', 'is_physical_logical', 'logical_type']:
                            if field in port:
                                value = port[field]
                                if field == "operating_speed":
                                    value = convert_bandwidth(value)
                                setattr(existing_port, field, value)
                        existing_port.save()

                        existing_port.ip.all().delete()
                        for ip in ip_data:
                            IPAddress.objects.create(port=existing_port, **ip)
                            
                    else:
                        port['nic'] = nic.uuid
                        port['operating_speed'] = convert_bandwidth(port.get("operating_speed"))
                        port_serializer = PortSerializer(data={**port, "ip": ip_data})
                        if port_serializer.is_valid(raise_exception=False):
                            new_port = port_serializer.save(nic=nic)
                            async_to_sync(EventService.create_event)(
                                agent=device.agent if device.agent else None,
                                event_type="CREATE",
                                description=f"NIC Added on device {device.agent.hostname if device.agent else 'Unknown Agent'}",
                                component_type={"Port": new_port.interface_name or "Unknown Interface Name"}
                            )
                            logger.info(f"Created new port: {new_port.interface_name} on NIC: {nic.interface_name}")   
                            created_ports.append({
                                "uuid": str(new_port.uuid),
                                "os_uuid": os_uuid_port,
                                "interface_name": new_port.interface_name,
                                "operating_speed": new_port.operating_speed,
                                "is_physical_logical": new_port.is_physical_logical,
                                "logical_type": new_port.logical_type,
                            })
                        else:
                            return Response({"error": "Port serializer error", "details": port_serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

                if created_ports:
                    response_data.append({
                        "status": "updated",
                        "device_uuid": str(device.uuid),
                        "nic": {
                            "uuid": str(nic.uuid),
                            "os_uuid": os_uuid_nic,
                            "make": nic.make,
                            "model": nic.model,
                            "number_of_ports": nic.number_of_ports,
                            "max_speed": nic.max_speed,
                            "supported_speeds": nic.supported_speeds,
                            "serial_number": nic.serial_number,
                            "port": created_ports
                        } 
                    })

    return Response(response_data, status=status.HTTP_200_OK)