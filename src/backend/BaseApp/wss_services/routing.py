from django.urls import re_path
from .consumer import AgentMonitoringConsumer,FrontendMonitoringConsumer
from BaseApp.consumers.AgentConsumer import AgentConsumer
from BaseApp.consumers.WebAppConsumer import WebAppConsumer

websocket_urlpatterns = [
    re_path(r'api/agent/bridge/', AgentConsumer.as_asgi()),
    re_path(r'webapp/api/agent/$',FrontendMonitoringConsumer.as_asgi()),
    re_path(r'api/v1/wss/agent/', AgentConsumer.as_asgi()),
    re_path(r'api/v1/wss/webapp/', WebAppConsumer.as_asgi()),
]
