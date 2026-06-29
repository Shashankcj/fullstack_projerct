from BaseApp.services.imports import requests,Response,Agent,logging,Application,check_password,make_password
import json
from rest_framework import status

logger = logging.getLogger("agent_monitoring")
def get_access_token(request):
    """
    Exchange client credentials for an access token.
    """
    client_id = request.data.get("client_id")
    client_secret = request.data.get("client_secret")
    agent_uuid = request.headers.get("uuid")

    logger.info("Attempting access token request: client_id=%s  agent_uuid=%s", client_id,agent_uuid)
    if not all([client_id, client_secret, agent_uuid]):
        logger.warning("Missing credentials in access token request.")
        return Response({"error": "Missing credentials"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        agent = Agent.objects.get(uuid=agent_uuid)
    except Agent.DoesNotExist:
        logger.error("Invalid agent UUID: %s", agent_uuid)
        return Response({"error": "Invalid agent UUID"}, status=status.HTTP_404_NOT_FOUND)

    try:
        # Ensure you fetch the Application model you use for agent oauth apps
        app = Application.objects.get(client_id=client_id, agent=agent)
    except Application.DoesNotExist:
        logger.error("Invalid application for client_id: %s", client_id)
        return Response({"error": "Invalid application"}, status=status.HTTP_403_FORBIDDEN)

    try:
        if app.hash_client_secret:
            # app.client_secret should contain the hashed secret (e.g. produced by make_password)
            is_valid = check_password(client_secret, app.client_secret)
            logger.debug("Stored secret is hashed; check_password result: %s", is_valid)
        else:
            # plain-text stored secret
            is_valid = (client_secret == app.client_secret)
            logger.debug("Stored secret is plain; direct comparison result: %s", is_valid)
    except Exception as exc:
        logger.exception("Error validating client secret: %s", exc)
        return Response({"error": "Internal server error validating secret"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    if not is_valid:
        logger.warning("Invalid client_secret for client_id=%s agent_uuid=%s", client_id, agent_uuid)
        return Response({"error": "Invalid client credentials"}, status=status.HTTP_403_FORBIDDEN)

    token_url = "http://127.0.0.1:8001/o/token/"
    payload = {
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
        "scope": "read write"
    }

    try:
        token_resp = requests.post(token_url, data=payload, timeout=10)
    except requests.RequestException as exc:
        logger.exception("Error calling token endpoint: %s", exc)
        return Response({"error": "Failed to contact token server"}, status=status.HTTP_502_BAD_GATEWAY)

    # If token endpoint returns 200, optionally mark app.hash_client_secret True to avoid storing raw next time
    if token_resp.status_code == 200:
        app.client_secret = make_password(client_secret)
        app.hash_client_secret = True
        app.save(update_fields=["client_secret", "hash_client_secret"])
        logger.info("Access token issued successfully for client_id=%s", client_id)
    else:
        logger.warning("Token endpoint returned non-200: %s %s", token_resp.status_code, token_resp.text)

    # Return the token endpoint response as-is
    try:
        return Response(token_resp.json(), status=token_resp.status_code)
    except ValueError:
        # Non-JSON response
        return Response({"error": "Invalid response from token server", "detail": token_resp.text},
                        status=status.HTTP_502_BAD_GATEWAY)

def get_refreshed_access_token(request):
    """
    Validate and refresh an access token using client credentials.
    """
    client_id = request.data.get("client_id")
    client_secret = request.data.get("client_secret")
    agent_uuid = request.headers.get("uuid")

    logger.info("Attempting to refresh access token for client_id=%s and agent_uuid=%s", client_id, agent_uuid)

    if not all([client_id, client_secret, agent_uuid]):
        logger.warning("Missing credentials in refresh token request.")
        return Response({"error": "Missing credentials"}, status=400)

    try:
        agent = Agent.objects.get(uuid=agent_uuid)
        app = Application.objects.get(client_id=client_id, agent=agent)
        logger.info("Agent and application successfully retrieved.")
        
        if app.hash_client_secret:
            if not check_password(client_secret, app.client_secret):
                logger.error("Invalid client secret for client_id: %s", client_id)
                return Response({"error": "Invalid client secret"}, status=403)
        else:
            app.client_secret = make_password(client_secret)
            app.hash_client_secret = True
            app.save()
            logger.info("Client secret hashed and application updated.")

    except Agent.DoesNotExist:
        logger.error("Invalid agent UUID: %s", agent_uuid)
        return Response({"error": "Invalid agent UUID"}, status=404)
    except Application.DoesNotExist:
        logger.error("Invalid application for client_id: %s", client_id)
        return Response({"error": "Invalid application"}, status=403)

    response = requests.post(
        "http://127.0.0.1:8001/o/token/",
        data={
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret,
            "scope": "read write"
        }
    )

    if response.status_code == 200:
        logger.info("Refreshed access token successfully retrieved.")
    else:
        logger.warning("Failed to refresh access token: %s", response.text)

    return Response(response.json(), status=response.status_code)