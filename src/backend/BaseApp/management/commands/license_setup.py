from django.core.management.base import BaseCommand
from django.conf import settings

import json
import base64
import os
from pathlib import Path
from datetime import datetime, timezone

from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import padding


class Command(BaseCommand):
    help = "Collect host identity & generate license request file"

    def read_file(self, path):
        """
        Safely read a file and return stripped content.
        Returns None if file is not accessible.
        """
        try:
            return Path(path).read_text().strip()
        except Exception:
            return None

    def handle(self, *args, **kwargs):

        # 1️⃣ Try Docker-mounted paths first
        system_uuid = self.read_file("/host/machine-id")
        # product_uuid = self.read_file("/host/product_uuid")

        # 2️⃣ Fallback to local system paths (for local testing)
        if not system_uuid:
            system_uuid = self.read_file("/etc/machine-id")

        # if not product_uuid:
        #     product_uuid = self.read_file("/sys/class/dmi/id/product_uuid")

        # 3️⃣ Hard fail if still not available
        if not system_uuid :
            self.stderr.write(self.style.ERROR(
                "\nUnable to read machine-id or product_uuid.\n\n"
                "For Docker, run:\n"
                "docker run --rm "
                "-v /etc/machine-id:/host/machine-id:ro "
                "-v /sys/class/dmi/id/product_uuid:/host/product_uuid:ro "
                "-v $(pwd):/out <image> python manage.py license_setup\n\n"
                "For local testing, ensure:\n"
                "/etc/machine-id exists\n"
                "/sys/class/dmi/id/product_uuid exists\n"
            ))
            return

        # 4️⃣ Prepare request payload
        request_time = datetime.now(timezone.utc).isoformat()

        data = {
            "host_id": system_uuid,
            "request_time": request_time,
        }

        # 5️⃣ Load public key
        try:
            with open(settings.LICENSE_PUBLIC_KEY_PATH, "rb") as f:
                public_key = serialization.load_pem_public_key(f.read())
        except Exception as e:
            self.stderr.write(self.style.ERROR(
                f"Failed to load public key: {e}"
            ))
            return

        # 6️⃣ Encrypt payload
        encrypted = public_key.encrypt(
            json.dumps(data).encode(),
            padding.OAEP(
                mgf=padding.MGF1(hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )

        # 7️⃣ Write license request file
        LICENSE_DIR = "/var/lib/genesis/license"
        LICENSE_FILE = os.path.join(LICENSE_DIR, "license_request.req")

        os.makedirs(LICENSE_DIR, exist_ok=True)

        request_file = base64.b64encode(encrypted).decode()

        with open(LICENSE_FILE, "w") as f:
            f.write(request_file)

        # 8️⃣ Success output
        self.stdout.write(self.style.SUCCESS(
            f"\n✔ License request generated successfully\n"
            f"→ {LICENSE_FILE}\n"
        ))
        self.stdout.write("Send this file to the vendor.\n")
