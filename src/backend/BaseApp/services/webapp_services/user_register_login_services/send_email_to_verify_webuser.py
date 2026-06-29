from django.conf import settings
from BaseApp.models import WebUser
from rest_framework.response import Response
from rest_framework import status
import jwt

def sendemail_to_verify_user(request,token):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
        user = WebUser.objects.get(id=payload["user_id"])
        user.is_email_verified =  True
        user.save()
        return Response({"message": "Email verified. You can now log in."}, status=status.HTTP_200_OK)
    except jwt.ExpiredSignatureError:
            return Response({"error": "Activation link expired"}, status=status.HTTP_401_UNAUTHORIZED)
    except jwt.InvalidTokenError:
            return Response({"error": "Invalid token"}, status=status.HTTP_400_BAD_REQUEST)
    