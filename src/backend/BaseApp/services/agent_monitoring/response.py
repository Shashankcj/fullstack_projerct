# services/response_service.py
from BaseApp.services.imports import JsonResponse, logging, json
from .cache_service import CacheService
 
logger = logging.getLogger("agent_monitoring")
 
class ResponseService:
    """Service for managing API responses and action filtering."""
    
    @staticmethod
    async def error_response(message, event_id=None, status_code=400):
        """Create a standardized error response."""
        response_data = {
            "status": "error",
            "message": message,
        }
        if event_id:
            response_data["event_id"] = event_id
        return JsonResponse(response_data, status=status_code)
 
    @staticmethod
    def process_action_results(results):
        """Process action results and filter based on cache to prevent duplicate actions."""
        for res in results:
            if isinstance(res, JsonResponse):
                res = json.loads(res.content)
    
            for key_name in ['disk', 'port', 'memory']:
                actions = res.get(key_name, [])
    
                if isinstance(actions, dict):
                    actions = [actions]
 
                for action in actions:
                    action_name = action.get("action")
                    raw_uuids = action.get("uuid", [])
                    if isinstance(raw_uuids, str):
                        uuids = [str(raw_uuids)]
                    elif isinstance(raw_uuids, list):
                        uuids = [str(u) for u in raw_uuids]
                    else:
                        uuids = []
 
                    for uuid in uuids:
                        if CacheService.should_send_action(action_name, uuid):
                            logger.info(f"[MONITORING] Returning action: {action}")
                            return JsonResponse(action, safe=False)
                        
        logger.info("[MONITORING] No new actions — returning success.")
        return JsonResponse({"status": "success"})