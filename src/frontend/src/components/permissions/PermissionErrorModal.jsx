// src/components/common/PermissionErrorModal.jsx
import React from 'react';
import { 
  XMarkIcon, 
  ExclamationTriangleIcon,
  ShieldExclamationIcon,
  LockClosedIcon 
} from '@heroicons/react/24/outline';

const PermissionErrorModal = ({ 
  show, 
  onClose, 
  isDarkMode, 
  permissionName,
  actionDescription = "perform this action",
  title = "Access Denied"
}) => {
if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        ></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        {/* Modal */}
        <div
          className="relative inline-block align-bottom rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full sm:p-6"
          style={{ 
            backgroundColor: isDarkMode ? "#1F2937" : "#FFFFFF",
            border: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB"
          }}
        >
          {/* Close button */}
          <div className="absolute top-0 right-0 pt-4 pr-4">
            <button
              onClick={onClose}
              className={`rounded-md p-2 transition-colors ${
                isDarkMode 
                  ? "text-gray-400 hover:text-gray-300 hover:bg-gray-600" 
                  : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              }`}
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Content */}
          <div className="sm:flex sm:items-start">
            <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 sm:mx-0 sm:h-10 sm:w-10">
              <ShieldExclamationIcon 
                className="h-6 w-6 text-red-600" 
                aria-hidden="true" 
              />
            </div>
            
            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
              <h3 
                className="text-lg leading-6 font-semibold mb-2"
                style={{ color: isDarkMode ? "#FFF" : "#111827" }}
              >
                {title}
              </h3>
              
              <div className="mt-2">
                <p 
                  className="text-sm mb-3"
                  style={{ color: isDarkMode ? "#D1D5DB" : "#374151" }}
                >
                  You don't have the required permission to {actionDescription}.
                </p>
                
                {permissionName && (
                  <div 
                    className="flex items-center p-3 rounded-lg mb-4"
                    style={{ 
                      backgroundColor: isDarkMode ? "#374151" : "#F3F4F6",
                      border: isDarkMode ? "1px solid #4B5563" : "1px solid #E5E7EB"
                    }}
                  >
                    <LockClosedIcon className="h-5 w-5 text-amber-500 mr-2" />
                    <div>
                      <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                        Required Permission
                      </p>
                      <p 
                        className="text-sm font-mono"
                        style={{ color: isDarkMode ? "#FFF" : "#111827" }}
                      >
                        {permissionName}
                      </p>
                    </div>
                  </div>
                )}

                <p 
                  className="text-xs"
                  style={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }}
                >
                  Contact your administrator to request the necessary permissions.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PermissionErrorModal;
