
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
import jwt
from django.conf import settings
from BaseApp.models import WebUser

class JWTCookieAuthentication(BaseAuthentication):
    def authenticate(self, request):
        token = request.COOKIES.get('jwt')
        if not token:
            return None
        
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
            user = WebUser.objects.get(id=payload['id'])
            return (user, token)
        except (jwt.InvalidTokenError, WebUser.DoesNotExist):
            raise AuthenticationFailed('Invalid token')
