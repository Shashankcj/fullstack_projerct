import { useMemo, useState } from "react";
import {
  TrashIcon,
  UserGroupIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/outline";

import MenuDropdown    from "../../../shared/MenuDropdown";
import RenderIfAllowed from "../../../shared/RenderIfAllowed";
import BulkActionModal from "../../../shared/BulkActionModal";

import DataTable        from "../../../table/DataTable";
import DataTableToolbar from "../../../table/DataTableToolbar";
import TablePageShell   from "../../../table/TablePageShell";
import TableStateWrapper from "../../../table/TableStateWrapper";

import useSelectionState   from "../../../../Hooks/shared/useSelectionState";
import useUserColumnConfig from "../../../../Hooks/user/useUserColumnConfig";

import EditUserModal      from "./EditUserModal";
import DeleteUserModal    from "./DeleteUserModal";
import PasswordResetModal from "./PasswordResetModal";
import { UserPlusIcon } from "@heroicons/react/24/outline"

// ── Bulk action config builder ────────────────────────────────────────────────
const buildBulkConfig = ({
  currentAction,
  selectedUsers,
  sortedUsers,
  isDarkMode,
  editRoleOptions,
  onDeleteUsers,
  onUpdateUser,
}) => {
  const count = selectedUsers.size;

  if (currentAction === "delete") {
    return {
      title: "Delete Users",
      message: `Are you sure you want to delete ${count} user(s)? This action cannot be undone.`,
      icon: TrashIcon,
      iconColor:   isDarkMode ? "#F87171" : "#EF4444",
      iconBgColor: isDarkMode ? "#7F1D1D" : "#FEE2E2",
      itemLabel: "Selected Users",
      itemUnit: "user(s)",
      dropdownLabel: "Confirm Deletion",
      dropdownPlaceholder: "Select an option",
      showDropdown: true,
      requireSelection: true,
      cancelValue: "false",
      options: [
        { value: "true",  label: "Yes" },
        { value: "false", label: "No"  },
      ],
      buttonText: "Delete Users",
      buttonColor: "red",
      processingText: "Deleting...",
      onAction: async (ids, value) => {
        if (value !== "true") return;
        await onDeleteUsers(ids);
      },
    };
  }

  if (currentAction === "edit_roles") {
    return {
      title: "Edit User Roles",
      message: `Select a role to assign to ${count} user(s).`,
      icon: UserGroupIcon,
      iconColor:   isDarkMode ? "#60A5FA" : "#3B82F6",
      iconBgColor: isDarkMode ? "#1E3A8A" : "#DBEAFE",
      itemLabel: "Selected Users",
      itemUnit: "user(s)",
      dropdownLabel: "Select Role",
      dropdownPlaceholder: "Choose a role",
      showDropdown: true,
      requireSelection: true,
      cancelValue: null,
      options: editRoleOptions,
      buttonText: "Update Roles",
      buttonColor: "blue",
      processingText: "Updating...",
      onAction: async (ids, roleUuid) => {
        if (!roleUuid) return;
        await onUpdateUser(ids, { role: roleUuid });
      },
    };
  }

  if (currentAction === "email_verification") {
    return {
      title: "Email Verification Control",
      message: `Control email verification for ${count} user(s)?`,
      icon: EnvelopeIcon,
      iconColor:   isDarkMode ? "#34D399" : "#10B981",
      iconBgColor: isDarkMode ? "#064E3B" : "#D1FAE5",
      itemLabel: "Selected Users",
      itemUnit: "user(s)",
      dropdownLabel: "Email Verification",
      dropdownPlaceholder: "Select an option",
      showDropdown: true,
      requireSelection: true,
      cancelValue: null,
      options: [
        { value: "enable",  label: "Enable Email Verification"  },
        { value: "disable", label: "Disable Email Verification" },
      ],
      buttonText: "Update Verification",
      buttonColor: "green",
      processingText: "Updating...",
      onAction: async (ids, value) => {
        if (!value) return;
        await onUpdateUser(ids, { is_email_override: value === "disable" });
      },
    };
  }

  if (currentAction === "toggle_status") {
    return {
      title: "Toggle User Status",
      message: `Enable or disable ${count} user(s)?`,
      icon: UserGroupIcon,
      iconColor:   isDarkMode ? "#FBBF24" : "#F59E0B",
      iconBgColor: isDarkMode ? "#78350F" : "#FEF3C7",
      itemLabel: "Selected Users",
      itemUnit: "user(s)",
      dropdownLabel: "User Status",
      dropdownPlaceholder: "Select status",
      showDropdown: true,
      requireSelection: true,
      cancelValue: null,
      options: [
        { value: "enable",  label: "Enable users"  },
        { value: "disable", label: "Disable users" },
      ],
      buttonText: "Update Status",
      buttonColor: "yellow",
      processingText: "Updating...",
      onAction: async (ids, value) => {
        if (!value) return;
        await onUpdateUser(ids, { is_user_enabled: value === "enable" });
      },
    };
  }

  return null;
};

// ─────────────────────────────────────────────────────────────────────────────

const UsersTable = ({
  users          = [],
  editRoleOptions = [],
  rolesLoading   = false,
  rolesError     = null,
  currentUser    = null,

  onCreateUser,

  page           = 1,
  totalPages     = 1,
  totalCount     = 0,
  onPageChange,

  searchTerm     = "",
  onSearchChange,
  itemsPerPage   = 10,
  onItemsPerPageChange,

  sorting        = [],
  onSortingChange,

  onDeleteUsers,
  onUpdateUser,
  onRefreshAfterAction,

  onEditUser,
  onPasswordReset,
  onDeleteUser,

  showEditModal,
  onHideEditModal,
  selectedUser,
  editFormData,
  modifiedFields,
  onFieldChange,
  onSubmitEdit,

  showDeleteModal,
  onHideDeleteModal,
  onConfirmDelete,

  showPasswordResetModal,
  onHidePasswordResetModal,
  passwordResetData,
  onPasswordResetChange,
  onPasswordResetSubmit,
  passwordErrors,
  showNewPassword,
  setShowNewPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  confirmPasswordTouched,
  setConfirmPasswordTouched,

  isDarkMode     = false,
  isLoading      = false,
  activeTab      = "",

  isRefreshing = false,
}) => {

  // ── Exclude current user from selectable pool ──────────────────────────────
  const selectableUsers = useMemo(
    () => users.filter((u) => u.id !== currentUser?.id),
    [users, currentUser]
  )

  // ── Selection (only operates on selectableUsers, never touches current user)
  const {
    selectedItems: selectedUsers,
    setSelectedItems: setSelectedUsers,
    toggleSelectAll,
    toggleSelectOne,
  } = useSelectionState({
    items:   selectableUsers,   // ← key change: excludes current user
    itemKey: "id",
    resetOn: [activeTab, searchTerm],
  });

  // ── Column config ──────────────────────────────────────────────────────────
  const { visibleCols, toggleCol, filteredColumns, toggleableCols } =
    useUserColumnConfig({
      isDarkMode,
      selectedUsers,
      toggleSelectOne,
      toggleSelectAll,
      sortedUsers: selectableUsers,   // ← key change: excludes current user
      currentUser,
      onEdit:          onEditUser,
      onPasswordReset: onPasswordReset,
      onDelete:        onDeleteUser,
    });

  // ── Bulk modal ─────────────────────────────────────────────────────────────
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [currentAction, setCurrentAction] = useState("");

  const bulkConfig = buildBulkConfig({
    currentAction,
    selectedUsers,
    sortedUsers: selectableUsers,
    isDarkMode,
    editRoleOptions,
    onDeleteUsers,
    onUpdateUser,
  });

  const openBulkAction = (action) => {
    setCurrentAction(action);
    setShowBulkModal(true);
  };

  // ── Actions menu ───────────────────────────────────────────────────────────
  const actionMenuItems = useMemo(() => [
    {
      id: "edit_roles",
      label: "Edit Roles",
      icon: UserGroupIcon,
      variant: "primary",
      disabled: selectedUsers.size === 0,
      onClick: () => openBulkAction("edit_roles"),
    },
    {
      id: "email_verification",
      label: "Email Verification",
      icon: EnvelopeIcon,
      variant: "primary",
      disabled: selectedUsers.size === 0,
      onClick: () => openBulkAction("email_verification"),
    },
    {
      id: "toggle_status",
      label: "Enable / Disable",
      icon: UserGroupIcon,
      variant: "primary",
      disabled: selectedUsers.size === 0,
      onClick: () => openBulkAction("toggle_status"),
    },
    {
      id: "delete",
      label: "Delete Selected",
      icon: TrashIcon,
      variant: "danger",
      disabled: selectedUsers.size === 0,
      onClick: () => openBulkAction("delete"),
    },
  ], [selectedUsers.size]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <TablePageShell isDarkMode={isDarkMode}>
      <div className="p-4">
<DataTableToolbar
  title="User Management"
  selectedCount={selectedUsers.size}
  searchTerm={searchTerm}
  onSearchChange={onSearchChange}
  searchPlaceholder="Search users..."
  itemsPerPage={itemsPerPage}
  onItemsPerPageChange={onItemsPerPageChange}
  isDarkMode={isDarkMode}
  isLoading={isLoading}
  onRefresh={onRefreshAfterAction}    
  isRefreshing={isRefreshing}
  actionsSlot={
    <>
      <RenderIfAllowed module="users_management" action="create">
        <button
          onClick={onCreateUser}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
        >
          <UserPlusIcon className="w-3.5 h-3.5" />
          Create User
        </button>
      </RenderIfAllowed>

      <RenderIfAllowed module="users_management" action="update">
        <MenuDropdown
          menuItems={actionMenuItems}
          isDarkMode={isDarkMode}
          buttonLabel="Actions"
        />
      </RenderIfAllowed>
    </>
  }
/>

        <TableStateWrapper
          isLoading={isLoading}
          isEmpty={users.length === 0}     
          hasActiveFilters={!!searchTerm.trim()}
          emptyTitle="No Users Found"
          onClearFilters={() => onSearchChange?.("")}
          isDarkMode={isDarkMode}
          loadingText="Loading users..."
        >
          <DataTable
            data={users}                    // ← full users so current user row renders
            columns={filteredColumns}
            isDarkMode={isDarkMode}
            isLoading={isLoading}
            itemsPerPage={itemsPerPage}
            emptyMessage={
              searchTerm.trim()
                ? `No users match "${searchTerm}"`
                : "No users found"
            }
            getRowId={(row) => row.id}
            page={page}
            totalPages={totalPages}
            rowCount={totalCount}
            onPageChange={onPageChange}
            sorting={sorting}
            onSortingChange={onSortingChange}
            globalFilter={searchTerm}
            onGlobalFilterChange={onSearchChange}
          />
        </TableStateWrapper>
      </div>

      {/* ── Bulk action modal ─────────────────────────────────────────────── */}
      {showBulkModal && bulkConfig && (
        <BulkActionModal
          show={showBulkModal}
          onHide={() => { setShowBulkModal(false); setCurrentAction(""); }}
          selectedItems={Array.from(selectedUsers)}
          isDarkMode={isDarkMode}
          config={bulkConfig}
          onSuccess={() => {
            setSelectedUsers(new Set());
            setShowBulkModal(false);
            setCurrentAction("");
            onRefreshAfterAction?.();
          }}
        />
      )}

      {/* ── Single-row modals ─────────────────────────────────────────────── */}
      <EditUserModal
        show={showEditModal}
        onHide={onHideEditModal}
        selectedUser={selectedUser}
        editFormData={editFormData}
        modifiedFields={modifiedFields}
        onFieldChange={onFieldChange}
        onSubmit={onSubmitEdit}
        editRoleOptions={editRoleOptions}
        rolesLoading={rolesLoading}
        rolesError={rolesError}
        isDarkMode={isDarkMode}
      />

      <DeleteUserModal
        show={showDeleteModal}
        onHide={onHideDeleteModal}
        selectedUser={selectedUser}
        onConfirm={onConfirmDelete}
        isDarkMode={isDarkMode}
      />

      <PasswordResetModal
        show={showPasswordResetModal}
        onHide={onHidePasswordResetModal}
        passwordResetData={passwordResetData}
        onChange={onPasswordResetChange}
        onSubmit={onPasswordResetSubmit}
        passwordErrors={passwordErrors}
        showNewPassword={showNewPassword}
        setShowNewPassword={setShowNewPassword}
        showConfirmPassword={showConfirmPassword}
        setShowConfirmPassword={setShowConfirmPassword}
        confirmPasswordTouched={confirmPasswordTouched}
        setConfirmPasswordTouched={setConfirmPasswordTouched}
        isDarkMode={isDarkMode}
      />
    </TablePageShell>
  );
};

export default UsersTable;