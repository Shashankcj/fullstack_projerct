
import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from BaseApp.models.roles import *
from BaseApp.serializer import RoleListSerializer,RoleCreateUpdateSerializer,RoleSerializer
from rest_framework.permissions import AllowAny
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from BaseApp.utils import JWTCookieAuthentication
from BaseApp.utils import check_permission
from django.utils.decorators import method_decorator
from rest_framework.decorators import authentication_classes

logger = logging.getLogger("agent_monitoring")
class RolesManageView(APIView):
    authentication_classes=[JWTCookieAuthentication]
    
    @check_permission(module='rbac',allowed_action='read')
    def get(self, request):
        try:
            roles = Role.objects.all()
            logger.info(f"Fetched {roles} roles from database.")
            serializer = RoleListSerializer(roles, many=True)
            return Response(
                {
                    "message": "Roles retrieved successfully",
                    "data": serializer.data
                },
                status=status.HTTP_200_OK
            )
        except Exception as e:
            logger.info("Error fetching roles:", str(e))
            return Response(
                {"error": "An error occurred while retrieving roles."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    
    @check_permission(module='rbac', allowed_action='create')
    def post(self, request):
        """Create new role with permissions"""
        try:
            serializer = RoleCreateUpdateSerializer(data=request.data,context={'request': request})
            logger.info(f"Creating role with data: {request.data}")
            
            if serializer.is_valid():
                role = serializer.save()
                response_serializer = RoleSerializer(role)
                logger.info(f"Role created with UUID: {role.uuid}")
                return Response(
                    {
                        "message": "Role created successfully",
                        "data": response_serializer.data
                    },
                    status=status.HTTP_201_CREATED
                )
            logger.error(f"Role creation failed: {serializer.errors}")
            return Response(
                {
                    "error": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {
                    "error": "Failed to create role",
                    "details": str(e)
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )     
    
    @check_permission(module='rbac', allowed_action='update')
    def patch(self, request):
        """Partial update of existing role"""
        logger.info("Inside Update role view")
        uuid = request.data.get('uuid', None)
        if not uuid:
            return Response(
                {"error": "UUID is required for update"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            role = get_object_or_404(Role, uuid=uuid)

            if role.role_name in ["Administrator", "Administrator (Read-Only)","Global User"]:
                return Response(
                    {"error": "Cannot update default roles"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            serializer = RoleCreateUpdateSerializer(
                role,
                data=request.data,
                context={'request': request}
            )
            
            if serializer.is_valid():
                role = serializer.save()
                response_serializer = RoleSerializer(role)
                logger.info(F"response_serializer data  {response_serializer.data}")
                return Response(
                    {
                        "message": "Role updated successfully",
                        "data": response_serializer.data
                    },
                    status=status.HTTP_200_OK
                )
            
            return Response(
                {
                    "error": "Validation failed",
                    "details": serializer.errors
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {
                    "error": "Failed to update role",
                    "details": str(e)
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @check_permission(module='rbac', allowed_action='delete')
    def delete(self, request):
        """Delete role (uuid in request body)"""
        try:
            uuid = request.data.get('uuid', None)
            
            if not uuid:
                return Response(
                    {"error": "UUID is required for deletion"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            role = get_object_or_404(Role, uuid=uuid)
            role_name = role.role_name
            # Prevent deleting default roles
            if role.role_name in ["Administrator", "Administrator (Read-Only)","Global User"]:
                return Response(
                    {"error": "Cannot delete default roles"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check if role is assigned to users
        
          
            role.delete(request=request)
            
            return Response(
                {
                    "mesrsage": f"Role '{role_name}' deleted successfully"
                },
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {
                    "error": "Failed to delete role",
                    "details": str(e)
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )        