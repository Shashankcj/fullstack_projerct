from django.http import JsonResponse, HttpResponseBadRequest
from BaseApp.models import Storage


def disk_utilization(request, uuid):
    try:
        disks = Storage.objects.filter(
            device__agent__uuid=uuid,
            is_flagged=False          # exclude flagged disks (matches your frontend filter)
        ).values(
            'uuid',
            'name',
            'total_disk_size',
            'total_disk_usage',
            'free_space',
            'unallocated_disk_size',
            'allocated_disk_size',
            'hw_disk_type',
            'is_flagged',
        )

        data = []
        for disk in disks:
            data.append({
                "mount_point": disk['name'] or f"Disk {len(data) + 1}",
                "name":        disk['name'] or f"Disk {len(data) + 1}",
                "total_disk_size":    _parse_gb(disk['total_disk_size']),
                "total_disk_usage":   _parse_gb(disk['total_disk_usage']),
                "free_space":         _parse_gb(disk['free_space']),
                "unallocated_disk_size": _parse_gb(disk['unallocated_disk_size']),
                "hw_disk_type":       disk['hw_disk_type'],
                "is_flagged":         disk['is_flagged'],
            })

        return JsonResponse(data, safe=False)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return HttpResponseBadRequest(f"Error fetching disk data: {str(e)}")


def _parse_gb(value):
    """
    Parses values stored as '120.50 GB' or '120.50GB' or '120.50'
    Returns a plain float.
    """
    if not value:
        return 0.0
    try:
        return round(float(str(value).replace("GB", "").strip()), 2)
    except ValueError:
        return 0.0