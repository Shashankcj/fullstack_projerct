import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { useSelector } from 'react-redux';

const RoleFormModal = ({
  show = false,
  isEditMode = false,
  isViewMode = false,
  roleData = null,
  modules = [],
  isDarkMode = false,
  onClose,
  onSubmit,
  isSubmitting = false
}) => {
  const [formData, setFormData] = useState({
    roleName: roleData?.role_name || "",
    permissions: roleData?.permissions || {},
  });

  const [errors, setErrors] = useState({});

  // Get Redux state to check module structure
  const availableModulesFromRedux = useSelector(state => state.userModPerm) || {};

  // Define permission columns
  const permissionColumns = [
    { id: 'All', label: 'All', hideOnMobile: false },
    { id: 'create', label: 'Create', hideOnMobile: true },
    { id: 'read', label: 'Read', hideOnMobile: true },
    { id: 'update', label: 'Update', hideOnMobile: true },
    { id: 'delete', label: 'Delete', hideOnMobile: true }
  ];

  // Helper function to check if a module supports a specific permission based on Redux structure
  const moduleSupportsPermission = (moduleId, permission) => {
    // Check if the module exists in Redux state
    const moduleInRedux = availableModulesFromRedux[moduleId];
    
    if (!moduleInRedux) {
      // If module doesn't exist in Redux, allow all permissions by default
      return true;
    }

    // For 'All' checkbox, check if module has ALL CRUD permissions
    if (permission === 'All') {
      const hasAllPermissions = ['create', 'read', 'update', 'delete'].every(
        perm => moduleInRedux.hasOwnProperty(perm)
      );
      return hasAllPermissions;
    }

    // Check if the specific permission property exists in the Redux module structure
    const hasPermission = moduleInRedux.hasOwnProperty(permission);
    
    return hasPermission;
  };

  // Add useEffect to update formData when roleData changes
  useEffect(() => {
    if (roleData) {
      setFormData({
        roleName: roleData.role_name || "",
        permissions: roleData.permissions || {},
      });
    }
  }, [roleData, show]);

  const isFieldEnabled = (fieldName) => {
    if (isViewMode) return false;

    switch (fieldName) {
      case 'roleName':
        return true;
      case 'permissions':
        return formData.roleName.trim() !== '';
      default:
        return true;
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (!isFieldEnabled(name)) return;

    setFormData({
      ...formData,
      [name]: value,
    });

    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: '',
      });
    }
  };

  const handlePermissionToggle = (moduleId, permission) => {
    if (isViewMode) return;
    
    // Check if this module supports this permission
    if (!moduleSupportsPermission(moduleId, permission)) return;

    setFormData((prev) => {
      const modulePermissions = prev.permissions[moduleId] || {};

      let updatedPermissions;

      if (permission === "All") {
        const isAllChecked = !modulePermissions["All"];
        
        // Get all supported permissions for this module from Redux
        const supportedPermissions = permissionColumns
          .filter(col => col.id !== 'All' && moduleSupportsPermission(moduleId, col.id))
          .map(col => col.id);
        
        // Toggle only supported permissions
        updatedPermissions = { ...modulePermissions, All: isAllChecked };
        
        supportedPermissions.forEach(perm => {
          updatedPermissions[perm] = isAllChecked;
        });
      } else {
        updatedPermissions = {
          ...modulePermissions,
          [permission]: !modulePermissions[permission],
        };

        // Check if all supported permissions are checked for "All" checkbox
        const supportedPermissions = permissionColumns
          .filter(col => col.id !== 'All' && moduleSupportsPermission(moduleId, col.id))
          .map(col => col.id);
        
        const allChecked = supportedPermissions.every((perm) => updatedPermissions[perm]);
        updatedPermissions["All"] = allChecked;
      }

      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          [moduleId]: updatedPermissions,
        },
      };
    });

    if (errors.permissions) {
      setErrors({
        ...errors,
        permissions: '',
      });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.roleName.trim()) {
      newErrors.roleName = 'Role name is required';
    }

    const hasAnyPermission = Object.values(formData.permissions).some(modulePerms =>
      modulePerms.create || modulePerms.read || modulePerms.update || modulePerms.delete
    );

    if (!hasAnyPermission) {
      newErrors.permissions = 'At least one permission must be selected';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (isViewMode) return;

    if (!validateForm()) return;

    onSubmit(formData);
  };

  const getInputStyling = (fieldName) => {
    const isEnabled = isFieldEnabled(fieldName);

    if (!isEnabled) {
      return isDarkMode
        ? 'border-gray-700 bg-gray-800 text-gray-500 cursor-not-allowed'
        : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed';
    }

    if (errors[fieldName]) {
      return isDarkMode
        ? 'border-red-500 bg-gray-600 text-gray-300 placeholder-gray-400 focus:border-red-500 focus:ring-red-500'
        : 'border-red-500 bg-gray-100 text-gray-700 placeholder-gray-500 focus:border-red-500 focus:ring-red-500';
    }

    return isDarkMode
      ? 'border-gray-600 focus:border-blue-500 bg-gray-700 text-white placeholder-gray-400 focus:ring-blue-500'
      : 'border-gray-300 focus:border-blue-500 bg-white text-gray-900 focus:ring-blue-500';
  };

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.1)' }}
      onClick={onClose}
    >
      <div
        className="rounded-xl p-6 max-w-2xl w-full relative shadow-2xl border mx-4"
        style={{
          background: isDarkMode
            ? 'rgba(15, 23, 42, 0.8)'
            : 'rgba(246, 245, 248, 1)',
          borderColor: isDarkMode
            ? 'rgba(51, 65, 85, 0.4)'
            : 'rgba(203, 213, 225, 0.3)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 right-0 pt-4 pr-4">
          <button
            onClick={onClose}
            className={isDarkMode ? "text-gray-400 hover:text-gray-300" : "text-gray-400 hover:text-gray-600"}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <h3
          className="text-lg leading-6 font-medium mb-4"
          style={{ color: isDarkMode ? "#FFF" : "#111827" }}
        >
          {isViewMode ? 'View Role' : isEditMode ? 'Edit Role' : 'Create New Role'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4 custom-scrollbar-horizontal">
          <div>
            <label
              htmlFor="roleName"
              className="block text-sm font-medium mb-1"
              style={{ color: isDarkMode ? "#D1D5DB" : "#374151" }}
            >
              Role Name
            </label>
            <input
              type="text"
              name="roleName"
              value={formData.roleName}
              onChange={handleChange}
              placeholder="Enter role name"
              disabled={isEditMode || !isFieldEnabled('roleName') || isViewMode}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 transition-colors ${getInputStyling('roleName')}`}
            />
            {errors.roleName && (
              <p className="mt-0.5 text-xs text-red-600">{errors.roleName}</p>
            )}
          </div>

          <div>
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: isDarkMode ? "#D1D5DB" : "#374151" }}
            >
              Module Permissions
            </label>
            {errors.permissions && (
              <p className="mt-1 text-xs text-red-600">{errors.permissions}</p>
            )}
          </div>

          <div
            className="rounded-lg border overflow-auto"
            style={{
              borderColor: isDarkMode ? "#4B5563" : "#E5E7EB",
              backgroundColor: isDarkMode ? "#374151" : "#F9FAFB",
              maxHeight: "280px"
            }}
          >
            {modules.length === 0 ? (
              <div
                className="p-4 text-center text-sm"
                style={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }}
              >
                No modules available
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr
                      style={{
                        backgroundColor: isDarkMode ? "#1F2937" : "#F3F4F6",
                        borderBottom: isDarkMode ? "1px solid #4B5563" : "1px solid #E5E7EB",
                        position: "sticky",
                        top: 0,
                        zIndex: 5
                      }}
                    >
                      {/* Module Header */}
                      <th
                        className="px-3 py-2 text-left font-semibold"
                        style={{ color: isDarkMode ? "#FFF" : "#111827" }}
                      >
                        Module
                      </th>
                      
                      {/* Dynamic Permission Headers */}
                      {permissionColumns.map((column) => (
                        <th
                          key={column.id}
                          className={`px-3 py-2 text-center font-semibold ${column.hideOnMobile ? 'hidden sm:table-cell' : ''}`}
                          style={{ color: isDarkMode ? "#FFF" : "#111827" }}
                        >
                          {column.label}
                        </th>
                      ))}
                      
                      {/* Mobile CRUD Header */}
                      <th
                        className="px-3 py-2 text-center font-semibold sm:hidden"
                        style={{ color: isDarkMode ? "#FFF" : "#111827" }}
                      >
                        CRUD
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {modules.map((module) => {
                      return (
                        <tr
                          key={module.id}
                          style={{
                            borderBottom: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB"
                          }}
                        >
                          {/* Module Name */}
                          <td
                            className="px-3 py-3 font-medium"
                            style={{ color: isDarkMode ? "#FFF" : "#111827" }}
                          >
                            {module.label}
                          </td>
                          
                          {/* Dynamic Permission Checkboxes for Desktop */}
                          {permissionColumns.map((column) => {
                            const isSupported = moduleSupportsPermission(module.id, column.id);
                            const isCheckboxDisabled = !isFieldEnabled('permissions') || 
                                                       isViewMode || 
                                                       !isSupported;
                            
                            return (
                              <td 
                                key={column.id} 
                                className={`px-3 py-3 text-center ${column.hideOnMobile ? 'hidden sm:table-cell' : ''}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={formData.permissions[module.id]?.[column.id] || false}
                                  onChange={() => handlePermissionToggle(module.id, column.id)}
                                  disabled={isCheckboxDisabled}
                                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                />
                              </td>
                            );
                          })}
                          
                          {/* Mobile View - Compact CRUD Checkboxes */}
                          <td className="px-3 py-3 text-center sm:hidden">
                            <div className="flex gap-1 justify-center">
                              {permissionColumns
                                .filter(col => col.id !== 'All')
                                .map((column) => {
                                  const isSupported = moduleSupportsPermission(module.id, column.id);
                                  const isCheckboxDisabled = !isFieldEnabled('permissions') || 
                                                             isViewMode || 
                                                             !isSupported;
                                  
                                  return (
                                    <input
                                      key={column.id}
                                      type="checkbox"
                                      checked={formData.permissions[module.id]?.[column.id] || false}
                                      onChange={() => handlePermissionToggle(module.id, column.id)}
                                      disabled={isCheckboxDisabled}
                                      className="w-3 h-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                      title={column.label}
                                    />
                                  );
                                })}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className={`px-4 py-2 rounded-lg ${isDarkMode
                ? "text-gray-300 bg-gray-600 hover:bg-gray-500"
                : "text-gray-700 bg-gray-200 hover:bg-gray-300"
                }`}
            >
              {isViewMode ? 'Close' : 'Cancel'}
            </button>

            {!isViewMode && (
              <button
  type="submit"
  disabled={isSubmitting}
  className={`inline-flex items-center px-5 py-2 font-medium rounded-lg
    bg-[#6366F1] hover:bg-[#5558e6] text-white
    focus:outline-none focus:ring-2 focus:ring-[#6366F1]/40
    disabled:opacity-50 disabled:cursor-not-allowed
    transition-colors
    ${
      isDarkMode
        ? "focus:ring-offset-gray-800"
        : "focus:ring-offset-2"
    }`}
>
  {isSubmitting ? (
    <>
      <svg
        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {isEditMode ? "Updating..." : "Creating..."}
    </>
  ) : (
    <>
      <Save className="w-4 h-4 mr-2" />
      {isEditMode ? "Update Role" : "Create Role"}
    </>
  )}
</button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default RoleFormModal;
