from django.http import JsonResponse
from django.conf import settings
import jwt, json
from BaseApp.models import WebUser
from rest_framework.decorators import api_view, permission_classes,throttle_classes,authentication_classes
from BaseApp.utils import JWTCookieAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from BaseApp.models.roles import *
import logging
from BaseApp.utils import check_permission
logger = logging.getLogger('agent_monitoring')
@api_view(['GET'])
@authentication_classes([JWTCookieAuthentication])
@permission_classes([IsAuthenticated])
def get_logged_in_user_details(request):
    token = request.COOKIES.get('jwt')
   
    if not token:
        return JsonResponse({"error": "Unauthorized"}, status=401)
    
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
    except jwt.ExpiredSignatureError:
        return JsonResponse({"error": "Token expired"}, status=401)
    except jwt.InvalidTokenError:
        return JsonResponse({"error": "Invalid token"}, status=401)

    try:
        user = WebUser.objects.get(id=payload["id"])
    except WebUser.DoesNotExist:
        return JsonResponse({"error": "User not found"}, status=404)
    user_data = {
        'id': user.id,  # Explicitly add user ID
        **{
            field.name: getattr(user, field.name)
            for field in user._meta.fields
            if field.name not in ['password', 'id', 'role']  # Exclude password, avoid id duplication
        }
    }  
    user_data['role'] = user.role.role_name
    
    return JsonResponse({"user": user_data, "payload": payload}, status=200)

@api_view(['GET'])
@authentication_classes([JWTCookieAuthentication])
@permission_classes([IsAuthenticated])
def get_user_permission_set(request):
    data = {}

    module_permissions = request.user.role.permissionset_set.get_queryset()
    logger.info(f"Module Permissions: {module_permissions}")
    for module in module_permissions:
        data[module.module] = {}
        for perm in ["create", "read", "update", "delete"]:
            data[module.module][perm] = module.__dict__.get(perm)
    return JsonResponse(data, status=200)

@api_view(['GET'])
@authentication_classes([JWTCookieAuthentication])
@permission_classes([IsAuthenticated])
def get_module_permission(request):
    
    body = json.loads(request.body.decode())
    if body.get("module"):
        try:
            module = request.user.role.permissionset_set.get(module=body.get("module"))
            data = {}
            data[module.module] = {}
            for perm in ['create', 'read', 'update', 'delete']:
                data[module.module][perm] = module.__dict__.get(perm)

            return JsonResponse(data, status=200)

        except PermissionSet.DoesNotExist:
            return JsonResponse({"error": "Module Not Found."}, status=404)
    else:
        return JsonResponse({"error": "No Module Information Passed."}, status=400)

    