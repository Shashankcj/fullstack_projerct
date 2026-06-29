import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings as SettingsIcon,
  Users,
  ArrowRight,
  UserRoundPen,
  DoorClosedLocked,
  RefreshCw,
  ServerCog,
  FileText,
  Upload
} from 'lucide-react';
import { useDocumentTitle } from "../../Hooks/useDocumentTitle";
import { useAuth } from '../../Contexts/AuthContext';
import { toast } from 'react-toastify';
import backendApi from '../../api/backendAxiosInstance';
import { useDispatch } from 'react-redux';
import { setPermissions } from '../../redux/userModulePermission';
import PageWrapper from '../Utilities/PageWrapper';
import { hasPermission } from "../Utilities/permissionUtilities";
import PermissionErrorModal from '../permissions/PermissionErrorModal';
import RenderIfAllowed from '../shared/RenderIfAllowed';


/* ================= PURE HELPERS ================= */

const getColorClasses = (color, isDarkMode) => {
  const colorMap = {
    green: {
      bg:       isDarkMode ? 'bg-green-900/30'  : 'bg-green-50',
      border:   'border-green-500',
      icon:     isDarkMode ? 'bg-green-900'     : 'bg-green-100',
      iconText: isDarkMode ? 'text-green-400'   : 'text-green-600',
      hover:    isDarkMode ? 'hover:bg-green-900/50' : 'hover:bg-green-100',
    },
    blue: {
      bg:       isDarkMode ? 'bg-blue-900/30'   : 'bg-blue-50',
      border:   'border-blue-500',
      icon:     isDarkMode ? 'bg-blue-900'      : 'bg-blue-100',
      iconText: isDarkMode ? 'text-blue-400'    : 'text-blue-600',
      hover:    isDarkMode ? 'hover:bg-blue-900/50' : 'hover:bg-blue-100',
    },
  };
  return colorMap[color] || colorMap.blue;
};


/* ================= SETTING OPTION CARD ================= */

const SettingOptionCard = ({ option, colors, isDarkMode, onOptionClick }) => {
  const IconComponent = option.icon;

  return (
    <div
      onClick={() => onOptionClick(option)}
      className={`rounded-lg shadow-md border cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] ${
        isDarkMode
          ? 'bg-gray-800 border-gray-700 hover:border-gray-600'
          : 'bg-white border-gray-200 hover:border-gray-300'
      }`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOptionClick(option);
        }
      }}
    >
      {/* Card Header */}
      <div className={`p-6 border-l-4 ${colors.border} ${colors.bg}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colors.icon}`}>
              <IconComponent className={`w-6 h-6 ${colors.iconText}`} />
            </div>
            <div>
              <h3 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {option.title}
              </h3>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {option.description}
              </p>
            </div>
          </div>
          <ArrowRight className={`w-5 h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
        </div>
      </div>

      {/* Card Content */}
      <div className="p-6 pt-4">
        <h4 className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
          Key Features:
        </h4>
        <ul className="space-y-2">
          {option.features.map((feature, index) => (
            <li key={index} className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${colors.iconText.replace('text-', 'bg-')}`} />
              <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {feature}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Card Footer */}
      <div className={`px-6 py-4 border-t ${
        isDarkMode ? 'border-gray-700 bg-gray-700/50' : 'border-gray-200 bg-gray-50'
      }`}>
        <div className="flex items-center justify-between">
          <span className={`text-sm font-medium ${colors.iconText}`}>
            Click to access {option.title.toLowerCase()}
          </span>
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.iconText}`}>
            Configure
          </div>
        </div>
      </div>
    </div>
  );
};


/* ================= MAIN COMPONENT ================= */

const Settings = ({ isDarkMode }) => {
  useDocumentTitle('Settings');

  const { user }  = useAuth();
  const dispatch  = useDispatch();
  const navigate  = useNavigate();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorModal, setErrorModal]     = useState({
    show:              false,
    permissionName:    '',
    actionDescription: '',
    title:             '',
  });


  /* ================= HANDLERS ================= */

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const permResponse = await backendApi.get("/modules/permissions/all", {
        withCredentials: true,
      });

      if (permResponse.data.permissions) {
        dispatch(setPermissions(permResponse.data.permissions));
      } else {
        dispatch(setPermissions(permResponse.data));
      }

      toast.success('Permissions refreshed successfully');
    } catch (error) {
      console.error('[Settings] Failed to refresh permissions:', error);
      toast.error('Failed to refresh permissions');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleOptionClick = (option) => {
    if (option.requiredPermission && !hasPermission(option.requiredPermission)) {
      setErrorModal({
        show:              true,
        permissionName:    option.requiredPermission,
        actionDescription: `access ${option.title.toLowerCase()}`,
        title:             `${option.title} Access Denied`,
      });
      return;
    }
    navigate(option.path);
  };


  /* ================= UI ================= */

  return (
    <PageWrapper isDarkMode={isDarkMode}>
      <div className="space-y-6 px-2 sm:px-0">

        {/* Header */}
        <div className={`rounded-lg shadow-md px-4 py-3 border ${
          isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-[#6366f1] rounded-lg flex items-center justify-center">
                <SettingsIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Settings
                </h1>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Configure your system preferences and manage access controls
                </p>
              </div>
            </div>

            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`p-2 rounded-md transition-colors ${
                isDarkMode
                  ? 'bg-green-900/20 text-green-400 hover:bg-green-900/40 hover:text-green-300'
                  : 'bg-green-100/80 text-green-600 hover:bg-green-200 hover:text-green-700'
              } ${isRefreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Refresh Permissions"
              aria-label="Refresh Permissions"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Settings Options Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          <SettingOptionCard
            option={{
              id:          'user-profile',
              title:       'User Profile',
              description: 'Create and manage device groups for better organization',
              icon:        UserRoundPen,
              path:        '/profile',
              color:       'blue',
              features:    ['User information', 'Edit user profile'],
            }}
            colors={getColorClasses('blue', isDarkMode)}
            isDarkMode={isDarkMode}
            onOptionClick={handleOptionClick}
          />

          <RenderIfAllowed module="rbac" action="read">
            <SettingOptionCard
              option={{
                id:          'rbac',
                title:       'Roles',
                description: 'User management and system configuration settings',
                icon:        DoorClosedLocked,
                path:        '/role-management',
                color:       'blue',
                features:    ['User account management', 'Manage user permissions'],
              }}
              colors={getColorClasses('blue', isDarkMode)}
              isDarkMode={isDarkMode}
              onOptionClick={handleOptionClick}
            />
          </RenderIfAllowed>

          <RenderIfAllowed module="users_management" action="read">
            <SettingOptionCard
              option={{
                id:          'users_management',
                title:       'Users',
                description: 'User management and system configuration settings',
                icon:        Users,
                path:        '/userlist',
                color:       'blue',
                features:    ['User creation', 'User account management'],
              }}
              colors={getColorClasses('blue', isDarkMode)}
              isDarkMode={isDarkMode}
              onOptionClick={handleOptionClick}
            />
          </RenderIfAllowed>

          <RenderIfAllowed module="global_configuration" action="read">
            <SettingOptionCard
              option={{
                id:          'global_config',
                title:       'Global Configuration',
                description: 'Manage system-wide settings including SMTP and Alert configurations.',
                icon:        ServerCog,
                path:        '/global-configuration',
                color:       'blue',
                features:    ['SMTP Configuration', 'Alert Configuration'],
              }}
              colors={getColorClasses('blue', isDarkMode)}
              isDarkMode={isDarkMode}
              onOptionClick={handleOptionClick}
            />
          </RenderIfAllowed>

          <RenderIfAllowed module="audit_logs" action="read">
            <SettingOptionCard
              option={{
                id:          'Audit_Logs',
                title:       'Audit Logs',
                description: 'View detailed records of system actions, user activity, and configuration changes.',
                icon:        FileText,
                path:        '/audit-logs',
                color:       'blue',
                features:    [
                  'User Activity Logs',
                  'Configuration Change History',
                  'System Events Tracking',
                ],
              }}
              colors={getColorClasses('blue', isDarkMode)}
              isDarkMode={isDarkMode}
              onOptionClick={handleOptionClick}
            />
          </RenderIfAllowed>

          <RenderIfAllowed module="monitoring" action="read">
            <SettingOptionCard
              option={{
                id:          'Import_Jobs',
                title:       'Import Status',
                description: 'Track CSV import jobs, view processing status, errors, and imported records.',
                icon:        Upload,
                path:        '/jobs',
                color:       'blue',
                features:    [
                  'CSV Import History',
                  'Import Status (Pending / Success / Failed)',
                  'Error & Validation Logs',
                ],
              }}
              colors={getColorClasses('blue', isDarkMode)}
              isDarkMode={isDarkMode}
              onOptionClick={handleOptionClick}
            />
          </RenderIfAllowed>

        </div>
      </div>

      {/* Permission Error Modal */}
      <PermissionErrorModal
        show={errorModal.show}
        onClose={() => setErrorModal((prev) => ({ ...prev, show: false }))}
        isDarkMode={isDarkMode}
        permissionName={errorModal.permissionName}
        actionDescription={errorModal.actionDescription}
        title={errorModal.title}
      />
    </PageWrapper>
  );
};


export default Settings;