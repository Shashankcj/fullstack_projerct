from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from BaseApp.models import GlobalConfig
from BaseApp.utils import check_permission,load_licence_to_memory
from rest_framework.permissions import IsAuthenticated,AllowAny
from BaseApp.utils import JWTCookieAuthentication
from django.utils.decorators import method_decorator
from rest_framework.decorators import authentication_classes
from BaseApp.models import Agent
from BaseApp.models.audit_logs import AuditLog
from ipware import get_client_ip
from BaseApp.utils import get_license_payload

class LicenseInstallView(APIView):
    authentication_classes =[JWTCookieAuthentication]
    
    @check_permission(module='global_configuration', allowed_action='create')
    def post(self, request):

        license_key = request.data.get("license.key")

        if not license_key:
            return Response({"error": "license_key is required"}, status=400)

        if GlobalConfig.objects.filter(item_key="license.key").exists():
            return Response(
                {"error": "License already exists."},
                status=409,
            )
         
        GlobalConfig.objects.create(
            item_key="license.key",
            item_value= license_key
        )
        ok, msg = load_licence_to_memory()
        if request:
            ip_address,is_routable =get_client_ip(request)  
        AuditLog.objects.create(
            user=request.user,
            action='CREATE',
            model_name='license',
            description=f"{request.user.username} installed a new license key",
            ip= ip_address
        )
        if not ok:
            return Response({"error": msg}, status=400)

        return Response(
            {"success": True, "message": "License installed successfully"},
            status=200
        )
         
        
    @check_permission(module='global_configuration', allowed_action='update')
    def put(self, request):

        license_key = request.data.get("license.key")

        if not license_key:
            return Response({"error": "license.key is required"}, status=400)

      
        GlobalConfig.objects.filter(item_key="license.key").update(
           item_value=license_key
        )
        if request:
           ip_address,is_routable =get_client_ip(request)
        AuditLog.objects.create(
            user=request.user,
            action = 'UPDATE',
            model_name="license",
            description=f"{request.user.username} updated the license key",
            ip=ip_address
        )
        ok, msg = load_licence_to_memory()
        if not ok:
            return Response({"error": msg}, status=400)

        return Response(
            {"success": True, "message": "License Updated successfully"},
            status=200
        )
        
