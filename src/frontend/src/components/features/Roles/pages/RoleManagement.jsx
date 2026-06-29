import React, { useState, useMemo } from 'react';
import { Users, Plus, Edit, Trash2, RefreshCw, Eye } from 'lucide-react';
import { toast } from 'react-toastify';
import { useSelector } from 'react-redux';
import {
  useGetRolesQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation
} from '../../../../redux/roleApiSlice';
import ConfirmationModal from '../../../shared/ConfirmationModal';
import RenderIfAllowed from '../../../shared/RenderIfAllowed';
import RoleFormModal from '../components/RoleFormModal';
import PageWrapper from "../../../Utilities/PageWrapper";

const RoleManagement = ({ isDarkMode = false }) => {
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);

  const { data: rolesData = [], isLoading: isLoadingRoles, isError, refetch } = useGetRolesQuery();
  const [createRole, { isLoading: isCreating }] = useCreateRoleMutation();
  const [updateRole, { isLoading: isUpdating }] = useUpdateRoleMutation();
  const [deleteRole, { isLoading: isDeleting }] = useDeleteRoleMutation();

  const availableModulesFromRedux = useSelector(state => state.userModPerm) || {};

  // Check if user has update permission for rbac module
  const hasUpdatePermission = availableModulesFromRedux?.rbac?.update === true;

  const roles = rolesData;

  const DEFAULT_ROLES = [
    'Administrator',
    'Administrator (Read-Only)',
    'Global User'
  ];

  // Helper function to check if a role is default
  const isDefaultRole = (roleName) => {
    return DEFAULT_ROLES.some(
      defaultRole => defaultRole.toLowerCase() === roleName.toLowerCase()
    );
  };

  const convertModulesToArray = (modulesObj) => {
    if (!modulesObj || Object.keys(modulesObj).length === 0) return [];

    return Object.keys(modulesObj).map((moduleKey) => ({
      id: moduleKey,
      label: modulesObj[moduleKey]?.name
    }));
  };

  const modules = useMemo(() => {
    return convertModulesToArray(availableModulesFromRedux);
  }, [availableModulesFromRedux]);

  const convertPermissionsToUIFormat = (permissionsArray) => {
    const uiFormat = {};
    permissionsArray.forEach(perm => {
      uiFormat[perm.module] = {
        All: perm.create && perm.read && perm.update && perm.delete,
        create: perm.create,
        read: perm.read,
        update: perm.update,
        delete: perm.delete
      };
    });
    return uiFormat;
  };

  const convertPermissionsToAPIFormat = (uiPermissions) => {
    return Object.entries(uiPermissions)
      .map(([module, perms]) => ({
        module,
        create: perms.create || false,
        read: perms.read || false,
        update: perms.update || false,
        delete: perms.delete || false
      }));
  };

  const handleAddRole = () => {
    setIsEditMode(false);
    setSelectedRole(null);
    setIsViewMode(false);
    setShowModal(true);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast.success('Roles refreshed successfully');
    } catch (error) {
      toast.error('Failed to refresh roles');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleEditRole = (role) => {
    setIsEditMode(true);
    setSelectedRole(role);
    setIsViewMode(false);
    setShowModal(true);
  };

  const handleViewRole = (role) => {
    setIsEditMode(false);
    setSelectedRole(role);
    setIsViewMode(true);
    setShowModal(true);
  };

  const handleDeleteRoleClick = (role) => {
    setRoleToDelete(role);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (roleToDelete) {
      try {
        const res = await deleteRole(roleToDelete.uuid).unwrap();

        // Use backend message directly
        const backendMessage = res?.message || "Role deleted successfully";

        toast.success(backendMessage);

        setShowDeleteConfirm(false);
        setRoleToDelete(null);

      } catch (error) {
        let errorMessage = "Failed to delete role";

        if (error?.data?.message) {
          errorMessage = error.data.message;
        } else if (error?.data?.error) {
          errorMessage = error.data.error;
        }

        toast.error(errorMessage);
        setShowDeleteConfirm(false);
        setRoleToDelete(null);
      }
    }
  };


  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setRoleToDelete(null);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedRole(null);
    setIsViewMode(false);
  };

  const handleFormSubmit = async (formData) => {
    try {
      const apiPermissions = convertPermissionsToAPIFormat(formData.permissions);
      let res;

      if (isEditMode) {
        res = await updateRole({
          uuid: selectedRole.uuid,
          role_name: formData.roleName,
          permissions: apiPermissions
        }).unwrap();

        const backendMsg = res?.message || `Role "${formData.roleName}" updated successfully`;
        toast.success(backendMsg);

      } else {
        res = await createRole({
          role_name: formData.roleName,
          permissions: apiPermissions
        }).unwrap();

        const backendMsg = res?.message || `Role "${formData.roleName}" created successfully`;
        toast.success(backendMsg);
      }

      handleCloseModal();

    } catch (error) {
      let errorMessage = 'Failed to save role';
      if (error?.data?.message) errorMessage = error.data.message;
      else if (error?.data?.error) errorMessage = error.data.error;

      toast.error(errorMessage);
    }
  };


  // Prepare role data for the form
  const prepareRoleData = () => {
    if (!selectedRole) {
      const initialPermissions = {};
      modules.forEach(module => {
        initialPermissions[module.id] = {
          All: false,
          create: false,
          read: false,
          update: false,
          delete: false
        };
      });
      return { role_name: '', permissions: initialPermissions };
    }

    const uiPermissions = convertPermissionsToUIFormat(selectedRole.permissions);
    const allModulePermissions = {};
    modules.forEach(module => {
      allModulePermissions[module.id] = uiPermissions[module.id] || {
        All: false,
        create: false,
        read: false,
        update: false,
        delete: false
      };
    });

    return {
      role_name: selectedRole.role_name,
      permissions: allModulePermissions
    };
  };

  if (isLoadingRoles) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <svg
          className="animate-spin h-6 w-6"
          style={{ color: isDarkMode ? "#60A5FA" : "#3B82F6" }}
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
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        <p
          className="mt-2"
          style={{ color: isDarkMode ? "#D1D5DB" : "#6B7280" }}
        >
          Loading roles...
        </p>
      </div>
    );
  }

  return (
    <>
        <PageWrapper isDarkMode={isDarkMode}>
      {/* Header with Buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 mb-4">
        <div className="flex items-center space-x-3">
          <h2
            className="text-lg font-semibold"
            style={{ color: isDarkMode ? "#FFF" : "#111827" }}
          >
            Role Management
          </h2>

          <RenderIfAllowed module="rbac" action="create">
            <button
              onClick={handleAddRole}
              className={`p-2 rounded-lg transition-colors ${isDarkMode
                ? 'bg-blue-900/20 text-blue-400 hover:bg-blue-900/40'
                : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                }`}
              title="Add New Role"
              disabled={isCreating || isUpdating || isDeleting || isRefreshing}
            >
              <Plus className="w-5 h-5" />
            </button>
          </RenderIfAllowed>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`p-2 rounded-lg transition-colors ${isDarkMode
              ? 'bg-green-900/20 text-green-400 hover:bg-green-900/40'
              : 'bg-green-100 text-green-600 hover:bg-green-200'
              } ${isRefreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="Refresh Roles"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          <span
            className="text-sm font-medium px-2.5 py-0.5 rounded-full"
            style={{
              backgroundColor: isDarkMode ? "#1E40AF" : "#DBEAFE",
              color: isDarkMode ? "#93C5FD" : "#1E40AF",
            }}
          >
            {roles.length} roles
          </span>
        </div>
      </div>

      {/* Table */}
      <div
        className="rounded-lg shadow border overflow-hidden"
        style={{
          backgroundColor: isDarkMode ? "#1F2937" : "#FFFFFF",
          borderColor: isDarkMode ? "#374151" : "#E5E7EB",
        }}
      >
        {roles.length === 0 ? (
          <div className="text-center py-6">
            <Users
              className="mx-auto h-12 w-12"
              style={{ color: isDarkMode ? "#6B7280" : "#9CA3AF" }}
            />
            <h3
              className="mt-2 text-sm font-medium"
              style={{ color: isDarkMode ? "#FFF" : "#111827" }}
            >
              No roles found
            </h3>
            <p
              className="mt-1 text-sm"
              style={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }}
            >
              No roles available
            </p>
          </div>
        ) : (
          <div className="relative overflow-auto custom-scroll pb-4" style={{ maxHeight: "530px" }}>
            <table className="min-w-full table-fixed border-separate border-spacing-0">
              <thead
                className="sticky top-0 z-10"
                style={{ backgroundColor: isDarkMode ? "#111827" : "#F9FAFB" }}
              >
                <tr>
                  <th
                    className="w-[40%] px-4 py-3 text-left text-xs font-medium tracking-wider"
                    style={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }}
                  >
                    Role Name
                  </th>
                  <th
                    className="w-[40%] px-4 py-3 text-center text-xs font-medium tracking-wider"
                    style={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }}
                  >
                    Description
                  </th>
                  <th
                    className="w-[20%] px-4 py-3 text-center text-xs font-medium tracking-wider"
                    style={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody style={{ backgroundColor: isDarkMode ? "#1F2937" : "#FFFFFF" }}>
                {roles.map((role, index) => (
                  <tr
                    key={role.uuid}
                    className="transition-colors"
                    style={{
                      backgroundColor:
                        index % 2 === 0
                          ? isDarkMode
                            ? "#1F2937"
                            : "#FFFFFF"
                          : isDarkMode
                            ? "#111827"
                            : "#F9FAFB",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = isDarkMode
                        ? "#374151"
                        : "#F3F4F6";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor =
                        index % 2 === 0
                          ? isDarkMode
                            ? "#1F2937"
                            : "#FFFFFF"
                          : isDarkMode
                            ? "#111827"
                            : "#F9FAFB";
                    }}
                  >
                    <td className="w-[40%] px-4 py-2 text-left">
                      <div
                        className="text-sm font-medium truncate"
                        style={{ color: isDarkMode ? "#D1D5DB" : "#111827" }}
                        title={role.role_name}
                      >
                        {role.role_name}
                      </div>
                    </td>

                    <td className="w-[40%] px-4 py-2 text-center align-middle">
                      <div
                        className="text-sm truncate flex justify-center items-center h-full"
                        style={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }}
                        title={role.description}
                      >
                        {role.description || "N/A"}
                      </div>
                    </td>
                    <td className="w-[20%] px-4 py-2 text-sm font-medium text-center">
                      <div className="flex items-center justify-center space-x-2">
                        {isDefaultRole(role.role_name) ? (
                          <button
                            onClick={() => handleViewRole(role)}
                            className={`p-1 rounded transition-colors ${isDarkMode
                              ? "text-green-400 hover:text-green-300 hover:bg-green-900/20"
                              : "text-green-600 hover:text-green-900 hover:bg-green-50"
                              }`}
                            title="View Role"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <>
                            <RenderIfAllowed module="rbac" action="update">
                              <button
                                onClick={() => handleEditRole(role)}
                                className={`p-1 rounded transition-colors ${isDarkMode
                                  ? "text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
                                  : "text-blue-600 hover:text-blue-900 hover:bg-blue-50"
                                  }`}
                                title="Edit Role"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                            </RenderIfAllowed>

                            {!hasUpdatePermission && (
                              <RenderIfAllowed module="rbac" action="read">
                                <button
                                  onClick={() => handleViewRole(role)}
                                  className={`p-1 rounded transition-colors ${isDarkMode
                                    ? "text-green-400 hover:text-green-300 hover:bg-green-900/20"
                                    : "text-green-600 hover:text-green-900 hover:bg-green-50"
                                    }`}
                                  title="View Role"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              </RenderIfAllowed>
                            )}

                            <RenderIfAllowed module="rbac" action="delete">
                              <button
                                onClick={() => handleDeleteRoleClick(role)}
                                className={`p-1 rounded transition-colors ${isDarkMode
                                  ? "text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                  : "text-red-600 hover:text-red-900 hover:bg-red-50"
                                  }`}
                                title="Delete Role"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </RenderIfAllowed>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RoleFormModal component */}
      <RoleFormModal
        show={showModal}
        isEditMode={isEditMode}
        isViewMode={isViewMode}
        roleData={prepareRoleData()}
        modules={modules}
        isDarkMode={isDarkMode}
        onClose={handleCloseModal}
        onSubmit={handleFormSubmit}
        isSubmitting={isCreating || isUpdating}
      />

      <ConfirmationModal
        show={showDeleteConfirm}
        title="Delete Role"
        message={`Are you sure you want to delete the role "${roleToDelete?.role_name}"? This action cannot be undone.`}
        confirmText="Yes, Delete"
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        isDarkMode={isDarkMode}
      />
      </PageWrapper>
    </>
  );
};

export default RoleManagement;
