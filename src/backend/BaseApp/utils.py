from rest_framework.response import Response
from rest_framework import status
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.decorators import authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated, BasePermission
from BaseApp.models import WebUser,Agent
import json, base64
from django.core.cache import cache
import jwt, logging
from django.conf import settings
from BaseApp.models.global_config import GlobalConfig
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import padding
from django.utils.timezone import now, make_aware, is_naive
from django.utils.dateparse import parse_datetime
from BaseApp.models import WebUser, Agent,IPMonitor
from functools import wraps
from django.http import JsonResponse as JSONResponse

logger = logging.getLogger('webapp_consumer')

class JWTCookieAuthentication(BaseAuthentication):
    def authenticate(self, request, jwt_cookie=None):
        if not jwt_cookie:
            token = request.COOKIES.get('jwt')
            # logger.info(f"(JWT::authenticate) JWT from cookie: {token}")
            if not token:
                return None
        else:
            token = jwt_cookie
            logger.info(f"(JWT::authenticate) JWT from parameter: {token}")
        
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
            user = WebUser.objects.get(id=payload['id'])
            if not user.is_user_enabled:                          # ← only line added
                raise AuthenticationFailed('Account deactivated')
            return (user, token)
        except (jwt.InvalidTokenError, WebUser.DoesNotExist):
            raise AuthenticationFailed('Invalid token')


def check_permission(module, allowed_action):
    # def decorator(func):
    #     @wraps(func)
    #     @authentication_classes([JWTCookieAuthentication])
    #     @permission_classes([IsAuthenticated])
    #     def wrapper(request, *args, **kwargs):
    #         try:
    #             if request.user:
    #                 logger.info(f"authenticated user {request.user}")
    #                 user = request.user
    #                 logger.info(f"Checking permission for user {user.username} on module '{module}' for action '{allowed_action}'")
    #                 if request.user.role.check_permission(module=module, action=allowed_action):
    #                     return func(request, *args, **kwargs)
    #                 else:
    #                     return Response({
    #                     'success': False,
    #                     'error': 'User does not have permission to access this resource.',
    #                     'code': 'NO_ACCESS'
    #                 }, status=status.HTTP_400_BAD_REQUEST)
    #             else:
    #                 return Response({
    #                     'success': False,
    #                     'error': 'User Not Logged In.',
    #                     'code': 'NO_LOGIN_FOUND'
    #                 }, status=status.HTTP_400_BAD_REQUEST)
    #         except Exception as e:
    #             logger.error(f"Error checking permissions: {str(e)}")
    #             return Response({
    #                 'success': False,
    #                 'error': 'An error occurred while checking permissions.',
    #                 'code': 'PERMISSION_CHECK_ERROR'
    #             }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
    #     return wrapper
    # return decorator
    """
    A universal decorator that injects a dynamic DRF permission class.
    Works for both FBVs and CBV methods.
    """
    class DynamicPermission(BasePermission):
        def has_permission(self, request, view):
            # 1. Ensure user is authenticated
            if not request.user or not request.user.is_authenticated:
                return False
            
            # 2. Run your existing RBAC check
            return request.user.role.check_permission(module=module, action=allowed_action)

    def decorator(func):
        # This connects the DynamicPermission class to the DRF view
        # We use @permission_classes internally
        @authentication_classes([JWTCookieAuthentication])
        @permission_classes([IsAuthenticated, DynamicPermission])
        @wraps(func)
        def wrapper(*args, **kwargs):
            return func(*args, **kwargs)
        return wrapper

    return decorator


def read_file(path):
    try:
        with open(path, "r") as f:
            return f.read().strip()
    except Exception:
        return None


def get_host_id():
     return (
        read_file("/host/machine-id")
        or read_file("/etc/machine-id")
    )


# def get_machine_id():
#     return read_file("/host/product_uuid")




CACHE_KEY = "LICENSE_DATA"  


def load_public_key():
    with open(settings.LICENSE_PUBLIC_KEY_PATH, "rb") as f:
        return serialization.load_pem_public_key(f.read())


def load_licence_to_memory():
    encrypted_lic = GlobalConfig.get_config("license.key")
    if not encrypted_lic:
        return False, "No license installed"

    cache.delete(CACHE_KEY)

    try:
        decoded = base64.b64decode(encrypted_lic).decode()
        lic_data = json.loads(decoded)
    except Exception:
        return False, "Invalid encrypted license format"

    payload = lic_data.get("payload")
    if not payload:
        return False, "License payload missing"

    try:
        signature = base64.b64decode(lic_data.get("signature"))
    except Exception:
        return False, "License signature missing/invalid"


    public = load_public_key()
    try:
        public.verify(
            signature,
            json.dumps(payload, sort_keys=True).encode(),
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.MAX_LENGTH
            ),
            hashes.SHA256()
        )
    except Exception:
        return False, "License signature invalid"
    
    host_id=get_host_id()
    # machine_id = get_machine_id()
    
    if not host_id:
        return False, "Host host-id not mounted"

    # if not machine_id:
    #     return False, "Host machine-id not mounted"

    
    lic_host_id=payload.get("host_id")
    # lic_machine_id = payload.get("machine_id")
    
    if not lic_host_id:
        return False, "License missing host id"

    # if not lic_machine_id:
    #     return False, "License missing machine_id"

    if lic_host_id.strip() != host_id.strip():
        return False, "License not valid for this host"

    # if lic_machine_id.strip() != machine_id.strip():
    #     return False, "License not valid for this machine"

    cache.set(CACHE_KEY, payload, timeout=None)
    return True, "License loaded & verified successfully"



def get_license_payload():
    payload = cache.get(CACHE_KEY)

    if payload:
        return True, payload

    ok, msg = load_licence_to_memory()
    if not ok:
        return False, msg
    

    payload = cache.get(CACHE_KEY)
    return True, payload

def get_license_status():
    ok, payload = get_license_payload()
    if not ok:
        return {
            "error": payload,
        }

    expiry = parse_datetime(payload.get("expiry"))
    if expiry and is_naive(expiry):
        expiry = make_aware(expiry)

    expired = expiry < now() if expiry else True
    remaining_days = ((expiry.date() - now().date()).days if expiry else 0)

    max_devices = payload.get("max_devices", 0)
    max_ip_monitors=payload.get("max_ip_monitors", 0)
    license_type = payload.get("license_type", "unknown")
    onboarded_devices = Agent.objects.count()
    onboarded_ip_monitors = IPMonitor.objects.count() 

    return {
        "status": "expired" if expired else "valid",
        "license_type":license_type,
        "expiry_date": expiry.date().isoformat() if expiry else None,
        "remaining_days": remaining_days,
        "max_devices": max_devices,
        "max_ip_monitors": max_ip_monitors,
        "devices_onboarded": onboarded_devices,
        "devices_remaining": max(max_devices - onboarded_devices, 0),
        "ip_monitors_onboarded": onboarded_ip_monitors,             
        "ip_monitors_remaining": max(max_ip_monitors - onboarded_ip_monitors, 0),  
    }


def authenticate_agent(func):
    @wraps(func)
    def wrapper(request, *args, **kwargs):
        
        token = request.request.headers.get('access-token')
        agent_uuid = request.request.headers.get('uuid')

        if not token or not agent_uuid:
            return Response({
                'success': False,
                'error': 'Access token or Agent UUID missing.',
                'code': 'MISSING_CREDENTIALS'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            agent = Agent.objects.get(uuid=agent_uuid)
        except Agent.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Agent not found.',
                'code': 'AGENT_NOT_FOUND'
            }, status=status.HTTP_400_BAD_REQUEST)

        is_valid, _ = agent.validate_access_token(access_token=token)
        if not is_valid:
            return Response({
                'success': False,
                'error': 'Invalid access token.',
                'code': 'INVALID_TOKEN'
            }, status=status.HTTP_400_BAD_REQUEST)

        
        return func(request, *args, **kwargs)

    return wrapper