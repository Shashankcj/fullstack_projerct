import asyncio
import json
import sys
import logging
import platform
import socket
import requests
import uuid
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework import status
from rest_framework.permissions import AllowAny
from oauth2_provider.models import AccessToken, Application
from django.utils.timezone import now
from django.contrib.auth.hashers import make_password, check_password
from asgiref.sync import sync_to_async,async_to_sync
from BaseApp.models import * 
import json
import logging
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from asgiref.sync import sync_to_async
from BaseApp.serializer import AgentSerializer, DeviceSerializer, NICSerializer,PartitionSerializer, PortSerializer,StorageSerializer
from django.core.cache import cache
from django.core.exceptions import ObjectDoesNotExist