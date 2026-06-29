import React, { useState, useRef, useEffect } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { ChevronDown } from "lucide-react";

// ─── EditRoleDropdown ────────────────────────────────────────────────────────
const EditRoleDropdown = ({
  roleOptions = [],
  selectedRole,
  setSelectedRole,
  isDarkMode,
  isLoading = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedRoleLabel = React.useMemo(() => {
    if (isLoading) return "Loading roles...";
    if (!Array.isArray(roleOptions) || roleOptions.length === 0) return "Select Role";
    const found = roleOptions.find((r) => r?.value === selectedRole);
    return found?.label || "Select Role";
  }, [roleOptions, selectedRole, isLoading]);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !isLoading && setIsOpen(!isOpen)}
        disabled={isLoading}
        className={`flex items-center justify-between w-full px-3 py-2 text-sm border rounded-lg cursor-pointer transition-all duration-200
          ${isDarkMode
            ? "bg-gray-700 text-gray-200 border-gray-600 hover:bg-gray-650 hover:border-gray-500"
            : "bg-white text-gray-900 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
          }
          ${isOpen ? "ring-2 ring-blue-500 ring-opacity-50" : ""}
          ${isLoading ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        <span>{selectedRoleLabel}</span>
        <ChevronDown className={`w-4 h-4 ml-1 transition-transform duration-200 ${isOpen ? "rotate-180" : "rotate-0"}`} />
      </button>

      <div
        className={`absolute top-full mt-1 w-full rounded-lg shadow-lg border z-50 transition-all duration-200 origin-top
          ${isDarkMode ? "bg-gray-700 border-gray-600" : "bg-white border-gray-200"}
          ${isOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-1 pointer-events-none"}
        `}
      >
        <div className="py-1 max-h-48 overflow-y-auto">
          {isLoading ? (
            <div className="px-3 py-2 text-sm text-gray-500">Loading roles...</div>
          ) : Array.isArray(roleOptions) && roleOptions.length > 0 ? (
            roleOptions.map((role) => (
              <button
                key={role?.value || Math.random()}
                type="button"
                className={`w-full text-left px-3 py-2 text-sm transition-colors duration-150
                  ${selectedRole === role?.value
                    ? "bg-blue-500 text-white"
                    : isDarkMode
                      ? "text-gray-200 hover:bg-gray-600"
                      : "text-gray-900 hover:bg-gray-100"
                  }`}
                onClick={() => { setSelectedRole(role?.value); setIsOpen(false); }}
              >
                {role?.label || "Unknown Role"}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-gray-500">No roles available</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── EditUserModal ───────────────────────────────────────────────────────────
/**
 * Props:
 *  show              – boolean
 *  onHide            – () => void
 *  selectedUser      – user object
 *  editFormData      – form state object
 *  modifiedFields    – Set of changed field names
 *  onFieldChange     – (fieldName, value) => void
 *  onSubmit          – (e) => void  (handleUpdateUser)
 *  editRoleOptions   – [{ value, label }]
 *  rolesLoading      – boolean
 *  rolesError        – error | null
 *  isDarkMode        – boolean
 */
const EditUserModal = ({
  show,
  onHide,
  selectedUser,
  editFormData,
  modifiedFields,
  onFieldChange,
  onSubmit,
  editRoleOptions,
  rolesLoading,
  rolesError,
  isDarkMode,
}) => {
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.1)" }}
      onClick={onHide}
    >
      <div
        className="rounded-xl p-6 max-w-2xl w-full relative shadow-2xl border mx-4"
        style={{
          background: isDarkMode ? "rgba(15, 23, 42, 0.8)" : "rgba(246, 245, 248, 1)",
          borderColor: isDarkMode ? "rgba(51, 65, 85, 0.4)" : "rgba(203, 213, 225, 0.3)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <div className="absolute top-0 right-0 pt-4 pr-4">
          <button
            onClick={onHide}
            className={isDarkMode ? "text-gray-400 hover:text-gray-300" : "text-gray-400 hover:text-gray-600"}
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="sm:flex sm:items-start">
          <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
            <h3
              className="text-lg leading-6 font-medium mb-4"
              style={{ color: isDarkMode ? "#FFF" : "#111827" }}
            >
              Edit User: {selectedUser?.username}
            </h3>

            <form onSubmit={onSubmit} className="space-y-4">
              {/* Username */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: isDarkMode ? "#D1D5DB" : "#374151" }}>
                  Username
                </label>
                <input
                  type="text"
                  value={editFormData.username}
                  onChange={(e) => onFieldChange("username", e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500
                    ${isDarkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"}`}
                  required
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: isDarkMode ? "#D1D5DB" : "#374151" }}>
                  Email
                </label>
                <input
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => onFieldChange("email", e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500
                    ${isDarkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"}`}
                  required
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: isDarkMode ? "#D1D5DB" : "#374151" }}>
                  Role
                </label>
                <EditRoleDropdown
                  roleOptions={editRoleOptions}
                  selectedRole={editFormData.role}
                  setSelectedRole={(role) => onFieldChange("role", role)}
                  isDarkMode={isDarkMode}
                  isLoading={rolesLoading}
                />
                {rolesError && (
                  <p className="mt-0.5 text-xs text-red-600">Error loading roles. Please try again.</p>
                )}
              </div>

              {/* Status checkboxes */}
              <div className={`p-3 rounded-lg border ${isDarkMode ? "bg-gray-700/50 border-gray-600" : "bg-gray-50 border-gray-200"}`}>
                <div className="space-y-2">
                  {/* Active User */}
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_user_enabled"
                      checked={editFormData.is_user_enabled || false}
                      onChange={(e) => onFieldChange("is_user_enabled", e.target.checked)}
                      className={`w-4 h-4 rounded border cursor-pointer
                        ${isDarkMode ? "border-gray-500 text-blue-500" : "border-gray-300 text-blue-600"}`}
                    />
                    <label
                      htmlFor="is_user_enabled"
                      className="ml-2 text-sm font-medium cursor-pointer"
                      style={{ color: isDarkMode ? "#D1D5DB" : "#374151" }}
                    >
                      Active User
                    </label>
                  </div>

                  {/* Email Verification */}
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_email_override"
                      checked={editFormData.is_email_override || false}
                      onChange={(e) => onFieldChange("is_email_override", e.target.checked)}
                      className={`w-4 h-4 rounded border cursor-pointer
                        ${isDarkMode ? "border-gray-500 text-green-500" : "border-gray-300 text-green-600"}`}
                    />
                    <label
                      htmlFor="is_email_override"
                      className="ml-2 text-sm font-medium cursor-pointer"
                      style={{ color: isDarkMode ? "#D1D5DB" : "#374151" }}
                    >
                      Enable Email Verification
                    </label>
                  </div>
                </div>
                <p className="mt-2 text-xs" style={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }}>
                  Control user account status and email verification
                </p>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={onHide}
                  className={`px-4 py-2 rounded-lg ${isDarkMode ? "text-gray-300 bg-gray-600 hover:bg-gray-500" : "text-gray-700 bg-gray-200 hover:bg-gray-300"}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rolesLoading || modifiedFields.size === 0}
                  className="px-4 py-2 bg-[#6366f1] text-white rounded-lg hover:bg-[#6366f1]/80 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Update User {modifiedFields.size > 0 && `(${modifiedFields.size})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditUserModal;