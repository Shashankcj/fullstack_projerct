import logging
from rest_framework.response import Response
from rest_framework import status
from BaseApp.services.webapp_services.csv_filedata_services.csv_data_validation_helper import validate_and_process_csv
logger = logging.getLogger("agent_monitoring")

def csvdata_validation(request):
    """
    Validate CSV file and return validation results without importing.
    This is the endpoint your frontend is calling: 'validate-csv/'
    """
        # Debug authentication
    logger.info(f"🔐 Request user: {request.user}")
    logger.info(f"🔐 Auth header: {request.META.get('HTTP_AUTHORIZATION', 'None')}")
    logger.info(f"🍪 Cookies: {request.COOKIES}")
    
  
    uploaded_file = request.FILES.get("csv_file")
    print("file type",type(uploaded_file))
    group_name = request.data.get("group_name", "")
   
    # === Basic file validation ===
    if not uploaded_file:
        logger.error("No csv_file found in request.FILES")
        return Response(
            {"success": False, "error": "No CSV file uploaded"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    logger.info(
        f"Received CSV for validation: {uploaded_file.name} ({uploaded_file.size} bytes) "
        f"for group: '{group_name}' | Content type: {uploaded_file.content_type}"
    )

    # === Service processing ===
    try:
        # Call your validation service
        result = validate_and_process_csv(uploaded_file, group_name)

        if result.get("success"):
            stats = result.get("stats", {})
            logger.info(
                f" CSV validation successful: "
                f"{stats.get('valid', 0)}/{stats.get('total', 0)} valid devices"
            )
            return Response(result, status=status.HTTP_200_OK)
        else:
            logger.warning(f"⚠️ CSV validation issues: {result.get('error', 'Unknown error')}")
            return Response(result, status=status.HTTP_400_BAD_REQUEST)

    except Exception as e:
        logger.exception("❌ Unexpected error validating CSV")
        return Response(
            {"success": False, "error": "Internal server error during CSV validation"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )