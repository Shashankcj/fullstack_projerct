from datetime import datetime, timezone
from BaseApp.models.models import Agent
from BaseApp.models.ipmonitor import IPMonitor
from BaseApp.utils import get_license_payload


def validate_license_request(resource: str, new_items_count: int = 1):
    ok, payload = get_license_payload()
    if not ok:
        return False, payload

    expiry_str = payload.get("expiry")
    if not expiry_str:
        return False, "License expiry missing"

    expiry = datetime.fromisoformat(expiry_str.replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expiry:
        return False, "License expired"

    if resource == "agent":
        max_allowed = int(payload.get("max_devices", 0))
        current_count = Agent.objects.count()

    elif resource == "ip_monitor":
        max_allowed = int(payload.get("max_ip_monitors", 0))
        current_count = IPMonitor.objects.count()

    else:
        return False, "Unknown licensed resource"

    if max_allowed <= 0:
        return False, "Invalid license limit"

    if current_count + new_items_count > max_allowed:
        return False, "Device limit reached"

    return True, "VALID"
