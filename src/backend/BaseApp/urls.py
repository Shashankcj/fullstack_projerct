from django.urls import path
from .views import *
from .services.webapp_services.user_management.user_details import *
from .services.webapp_services.user_register_login_services.webuser_login_logout import web_user_login_view,web_user_logout_view,auth_me_view
from .services.webapp_services.user_register_login_services.webuser_username_email_validation import check_username,check_email
from .services.webapp_services.user_register_login_services.send_email_and_verify_to_reset_password import sendemail_to_reset_password,verify_reset_password_token
from .services.webapp_services.user_management.user_roles import RolesManageView
from .services.webapp_services.user_management.UserManageView import UserManageView
from .services.webapp_services.global_config.global_config_view import GlobalConfigView
from .services.webapp_services.license_management_service.license_view import LicenseInstallView
from .services.webapp_services.email_notifications.smtp_test_config import test_email_configuration
from .services.webapp_services.agent_services.agent_delete import delete_agents
from .services.webapp_services.alert_filter_services.get_latest_alerts import get_latest_alert,get_filter_options,mark_alert_as_read,mark_all_alerts_as_read,get_unread_alert_count
from .services.webapp_services.eventlogs_filter_services.get_eventlogs import get_latest_events,get_evntlogs_filter_options,download_event_logs
from .services.webapp_services.ip_monitoring.ip_monitor_view import IPMonitorView
from .services.webapp_services.audit_logs.audit_logs_view import get_audit_logs,get_audit_log_filters,download_audit_logs
from BaseApp.services.webapp_services.main_dashboard_stats import dashboard_stats
from BaseApp.services.webapp_services.agent_services.priority_assign_agent import update_agent_priority,update_agent_priority_csv
from BaseApp.services.webapp_services.job_filter_services.get_job import get_jobs,download_job_result_csv,get_jobs_filter_options

# from .services.webapp_services.user_management.UserManageView import updatepassword
urlpatterns =[
    # path('onboard/',agent_onboard_view,name='agent_view'),
    # path('get/jwt/',access_token_view,name="tokens"),
    # path('init/data/',store_scan_data_view,name="initdata"),
    # path('init/data/<str:device_uuid>/disk/',handle_unknown_disk_partition_view,name='update_partition'),
    # path('init/data/<str:device_uuid>/nic/',handle_unknown_networkport_view,name='update_nic_port'),
    # path('get/jwt/access_token/',refresh_access_token_view,name="get_access_token"),
    # path('bridge/',agent_monitroing_view,name="agent_monitoring"),

   
    #CPU Stats Endpoints
    path("cpu/<uuid:agent_uuid>/stats/hourly/", cpu_hourly_stats_view),
    path("cpu/<uuid:agent_uuid>/stats/daily/", cpu_daily_stats_view),
    path("cpu/<uuid:agent_uuid>/stats/weekly/", cpu_weekly_stats_view),
    path("cpu/<uuid:agent_uuid>/stats/monthly/", cpu_monthly_stats_view),
    path("cpu/<uuid:agent_uuid>/stats/custom-range/",cpu_custom_range_stats_view),
    path("cpu/<uuid:agent_uuid>/stats/minutely/", cpu_minutely_stats_view),
    #Storage Stats Endpoints
    path("disk/<uuid:agent_uuid>/stats/hourly/", disk_hourly_stats_view),
    path("disk/<uuid:agent_uuid>/stats/daily/", disk_daily_stats_view),
    path("disk/<uuid:agent_uuid>/stats/weekly/", disk_weekly_stats_view),
    path("disk/<uuid:agent_uuid>/stats/monthly/", disk_monthly_stats_view),
    path("disk/<uuid:agent_uuid>/stats/minutely/", disk_minutely_stats_view),
    path("disk/<uuid:agent_uuid>/stats/custom-range/", disk_custom_range_stats_view),
    #Memory Stats Endpoints
    path("memory/<uuid:agent_uuid>/stats/hourly/", memory_hourly_stats_view),  
    path("memory/<uuid:agent_uuid>/stats/daily/", memory_daily_stats_view),
    path("memory/<uuid:agent_uuid>/stats/weekly/", memory_weekly_stats_view),
    path("memory/<uuid:agent_uuid>/stats/monthly/", memory_monthly_stats_view),
    path("memory/<uuid:agent_uuid>/stats/minutely/", memory_minutely_stats_view),
    path("memory/<uuid:agent_uuid>/stats/custom-range/", memory_custom_range_stats_view),
    #custom groups endpoints
    path ('groups/configuration/',save_user_groups_view,name="save_user_groups"),
    path ('get_groups/', get_user_groups_view, name='get_user_groups'),
    path( 'delete_group/<str:group_id>/', delete_user_groups_view, name='delete_user_groups'),
    #csv validation endpoint
    path('validate-csv/',validate_csv_view, name='validate_and_process_csv'),
    path('agent/verification/', agent_verification, name='agent_verification'),
    # flagged services
    path("flagged_storage_devices/", flagged_storage_view, name="flagged-storage"),
    path("flagged_ports/", flagged_port_view, name="flagged-network-ports"),
    

    # Test URL
    path('request/user/', test_request_user),

]


webappurlpatterns =[
    path('devices/<uuid:agent_uuid>/details/', get_device_details_view, name='device-details'),
    path('monitoring/charts/', mon_charts_request_handler_view, name='mon-charts-request-handler'),
    path('component-uuid-pair/<uuid:agent_uuid>/<str:component_type>/', get_component_objects_details_view, name='component-uuid-pair'),
    
    #User CRUD APIS and logged in user detail
    path('signup/check-email/',check_email, name='check-email'),
    path('signup/check-username/', check_username, name='check-username'),
    path('register/reset-password/', sendemail_to_reset_password, name='send-reset-password'),
    path('register/verify-reset-passowrd-token/', verify_reset_password_token, name='verify-email'),
    path("password-reset/", update_password_view, name="password-reset"),
    path('register/verify-email/<str:token>/', verify_email_view, name='verify-email'),
    path('signin/', web_user_login_view, name='signin'),
    path("auth/me", auth_me_view, name="auth"),
    path('get/logged-in-user-details/', get_logged_in_user_details, name='get-logged-in-user-details'),
    path('signout/', web_user_logout_view, name='signout'), 
    
    #Permissions
    path('modules/permissions/all', get_user_permission_set, name='get_user_permission_set'),
    path('modules/permissions/', get_module_permission, name='get_module_permission'),
    
    #Device
    path('devicedata/',all_devicedata_view, name='all_devicedata'),
    path('device/<uuid:uuid>/', get_device_by_uuid_view, name='get_device_by_uuid'),
    path('device/cpu-utilization/<uuid:uuid>/', cpu_utilization_view, name='cpu_utilization'),
    path('device/memory-utilization/<uuid:uuid>/', memory_utilization_view, name='memory_utilization'),
    path('device/disk-usage/<uuid:uuid>/', disk_utilization_view, name='disk_utilization'),
    path('device/network-utilization/<uuid:uuid>/', network_utilization_view, name='network_utilization'),
    
    #audit_logs
    path('get_auditlogs/',get_audit_logs,name="audit_logs"),
    path('get_filter_options/',get_audit_log_filters,name="filter_options"),
    path('audit_logs/download/', download_audit_logs, name='audit-logs-download'),
    
    #get_alerts and filtered alerts
    path('get_alerts/',get_latest_alert,name='all_alerts'),   
    path('get_alert_filter_options/',get_filter_options,name='alert_filter_options'),
    path('alerts/mark_read/', mark_alert_as_read, name='mark_alert_read'),
    path('alerts/mark_all_read/', mark_all_alerts_as_read, name='mark_all_alerts_read'),
    path('alerts/unread_count/', get_unread_alert_count, name='unread_alerts_count'),
    
    #get_eventlogs and filtered eventlogs
    path('get_eventlogs/',get_latest_events,name='all_eventlogs'),
    path('get_eventlogs_filter_options/',get_evntlogs_filter_options,name='event_filter_options'),
    path('export_eventlogs/',download_event_logs,name='download_eventlogs'),
    
    #RoleManagement
    path('roles/', RolesManageView.as_view(), name='roles-manage'),

    # UserManageView
    path('user/manage/', UserManageView.as_view(), name='user-manage'),
 
    # GlobalConfigView
    path('globalconfig/',GlobalConfigView.as_view(),name='config'),

    #maintenance View
    path('agents/maintenance/', set_maintenance_mode_view, name='set-maintenance-mode'),

    path('test-smtp-config/', test_email_configuration,name='test-smtp-config'),

    #licenseConfigView
    path('license/',LicenseInstallView.as_view(),name='license'),
    
    #agent_single and bulk deletion
    path('delete_agent/',delete_agents,name="delete_agents"),
    
    #IP Monitor CSV upload
    path('ip-monitoring/', IPMonitorView.as_view(), name='ip-monitor-upload-csv'),
    path('ip-monitoring/<uuid:ip_monitor_uuid>/details/', get_ip_monitor_details_view, name='ip-monitor-details'),

    path("flagged_storage_devices/", flagged_storage_view, name="flagged-storage"),
    path("flagged_ports/", flagged_port_view, name="flagged-network-ports"),
    
    #Dashboard stats , commented after adding new priority based dashboard
    # path("dashboard_stats/",dashboard_stats,name="dashboard-stats"),


    #Assign priority to agent
    path('agents/priority/', update_agent_priority, name='update-agent-priority'),
    path('agents/priority/csv/', update_agent_priority_csv, name='update-agent-priority_csv'),
    
    path('get_jobs/',get_jobs,name="get job details"),
    path('get_jobs_filter_options/',get_jobs_filter_options,name='event_filter_options'),
    path('jobs/<uuid:uuid>/download/',download_job_result_csv,name="download_job_result_excel"),

    path('dashboard/summary/', dashboard_summary_view, name='dashboard-summary'),
    path('dashboard/servers/', dashboard_servers_view, name='dashboard-servers'),
    path('dashboard/alerts/', dashboard_alerts_view, name='dashboard-alerts'),
]

agenturlpatterns =[
    # AgentView
    path('agent/', AgentView.as_view(), name='agent-view'),
    path('onboard/',agent_onboard_view,name='agent_view'),
    path('init/data/',store_scan_data_view,name="initdata"),
    path('get/jwt/',access_token_view,name="tokens"),
    path('get/jwt/access_token/',refresh_access_token_view,name="get_access_token"),
]

