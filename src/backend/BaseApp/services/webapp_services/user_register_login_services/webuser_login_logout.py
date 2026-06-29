import os

from rest_framework.response import Response
from rest_framework import status
from BaseApp.models import WebUser
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from django.contrib.auth.hashers import check_password
import jwt,json
import datetime
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated,AllowAny
from BaseApp.utils import JWTCookieAuthentication
from BaseApp.models.audit_logs import AuditLog
from ipware import get_client_ip
from BaseApp.utils import check_permission
from django.core.cache import cache

import logging

logger = logging.getLogger("agent_monitoring")
def generate_jwt(user):
    payload = {
        "id": str(user.id),
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=7),
        "iat": datetime.datetime.utcnow()
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm='HS256')
 
def set_jwt_cookie(response, token):
    is_production = not os .environ.get('DEBUG', 'False').lower() == 'true'
    response.set_cookie(
        key="jwt",
        value=token,
        httponly=True,
        samesite="Lax",
        secure=not settings.DEBUG, # True in prod, False in local dev
        path='/',
        max_age=604800,
    )
    return response





@api_view(['POST'])
@permission_classes([AllowAny])
def web_user_login_view(request):
    # Manual failed-login rate limiting (count only failures)
    # if jwt_token:
    #     try:
    #         jwt.decode(jwt_token, settings.SECRET_KEY, algorithms=["HS256"])
    #         return Response(
    #             {"message": "Already logged in"},
    #             status=status.HTTP_403_FORBIDDEN
    #         )
    #     except jwt.ExpiredSignatureError:
    #         pass   # expired → allow login
    #     except jwt.InvalidTokenError:
    #         pass 
    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, Exception):
        return Response({"error": "Invalid request body."}, status=status.HTTP_400_BAD_REQUEST)
    email = data.get("email")
    password = data.get("password")
    
    if request:
        ip_address, is_routable = get_client_ip(request)
    else:
        ip_address = 'unknown'

    RATE_KEY = f"login_attempts_{ip_address or 'unknown'}"
    MAX_ATTEMPTS = 5
    LOCKOUT_SECONDS = 300

    attempts = cache.get(RATE_KEY, 0)
    if attempts >= MAX_ATTEMPTS:
        return Response(
            {"error": "Too many login attempts. Please wait 5 minutes and try again."},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    def record_failed_attempt():
        cache.set(RATE_KEY, attempts + 1, timeout=LOCKOUT_SECONDS)

    try:
        user = WebUser.objects.get(email=email)
    except WebUser.DoesNotExist:
         # Log failed login - user not found
        AuditLog.objects.create(
            model_name="WebUser",
            action="LOGIN_FAILED",
            user=email,  # Use email since user doesn't exist
            description=f"Failed login attempt for non-existent user '{email}'",
            ip=ip_address
        )
        record_failed_attempt()
        return Response({"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)
    
     # Check 2: Password Match
    if not check_password(password, user.password):    
        record_failed_attempt()
        return Response({"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)


    if not user.is_user_enabled:
        AuditLog.objects.create(   
            model_name="WebUser",
            action="LOGIN_FAILED",
            user=user.username,
            description=f"Login attempt on deactivated account '{user.username}'",
            ip=ip_address)
                              
        record_failed_attempt()
        return Response({
            "success": False,
            "error": "Account Inactive",
            "message": "Account Inactive. Please contact your administrator.",
        }, status=status.HTTP_403_FORBIDDEN)

    if not user.is_email_override and not user.is_email_verified:   # 2. Email verified?
        AuditLog.objects.create(
            model_name="WebUser", action="LOGIN_FAILED",
            user=user.username,
            description=f"Failed login - email not verified for '{user.username}'",
            ip=ip_address
        )
        record_failed_attempt()
        return Response({"error": "Email not verified. Check your inbox."},
                        status=status.HTTP_404_NOT_FOUND)

    
    user.last_login = datetime.datetime.now()
    user.save()

    token = generate_jwt(user)
    response_data = {}

    response_data = {
            "message": "Login successful.",
        }
    response = Response(response_data, status=status.HTTP_200_OK)
    set_jwt_cookie(response, token)
    cache.delete(RATE_KEY)
    
    timestamp = datetime.datetime.now().strftime('%d %b %Y, %H:%M:%S')
    AuditLog.objects.create(
            action="LOGIN",
            user=user.username,
            description=f"User {user.username} authenticated successfully and logged in at {timestamp}",
            ip=ip_address
    )
    return response

@api_view(['POST'])
@authentication_classes([JWTCookieAuthentication])
@permission_classes([IsAuthenticated])
def web_user_logout_view(request):
    ip_address, is_routable = get_client_ip(request)
    user = request.user #for safe user resolution - never crash
    
    response = Response({"message": "Logged out successfully"}, status=200)
    response.delete_cookie(key='jwt',path='/')
   
    AuditLog.objects.create(
            action="LOGOUT",
            user=user.username,
            description=f"User {user.username} ended session and logged out at {datetime.datetime.now().strftime('%d %b %Y, %H:%M:%S')}",
            ip=ip_address
    )
    return response

@api_view(["GET"])
@authentication_classes([JWTCookieAuthentication])
@permission_classes([IsAuthenticated])
def auth_me_view(request):
    user = request.user

    return Response(
        {
            "id": str(user.id),
            "email": user.email,
            "username": user.username,
        },
        status=status.HTTP_200_OK
    )


