import { useMemo, useState } from "react";
import { toast } from "react-toastify";

import {
  useGetUsersQuery,
  useUpdateUserMutation,
  useDeleteUserMutation,
} from "../../../../redux/userApiSlice";
import UserCreationModal from "../UserCreationModal";
import { useGetRolesQuery }  from "../../../../redux/roleApiSlice";
import { useAuth }           from "../../../../Contexts/AuthContext";
import useTableFilter        from "../../../../Hooks/shared/useTableFilter";

import UsersTable            from "../components/usertable";
import PageWrapper from "../../../Utilities/PageWrapper";

// ─────────────────────────────────────────────────────────────────────────────

const UsersPage = ({ isDarkMode = false }) => {
  const { user: currentUser } = useAuth();

  // ── Filter / pagination state ─────────────────────────────────────────────
  const {
    filterParams,
    search,
    setPage,
    onSearchChange,
    onLimitChange,
  } = useTableFilter();

  // ── API ───────────────────────────────────────────────────────────────────
  const {
  data: usersData = [],
  isLoading,
  isFetching,
  refetch,
} = useGetUsersQuery(filterParams);
  const [updateUser] = useUpdateUserMutation();
  const [deleteUser] = useDeleteUserMutation();

  const {
    data:      rolesData    = [],
    isLoading: rolesLoading,
    error:     rolesError,
  } = useGetRolesQuery();

  // ── Derived: role options for dropdowns ───────────────────────────────────
  const editRoleOptions = useMemo(() => {
    if (!Array.isArray(rolesData) || rolesData.length === 0) return [];
    return rolesData.map((role) => ({
      value: role.uuid,
      label: role.role_name || role.name || "Unknown Role",
    }));
  }, [rolesData]);

  // ── Selected user (shared between modals) ─────────────────────────────────
  const [selectedUser, setSelectedUser] = useState(null);

  // ── Edit modal state ──────────────────────────────────────────────────────
  const [showEditModal,   setShowEditModal]   = useState(false);
  const [editFormData,    setEditFormData]    = useState({});
  const [modifiedFields,  setModifiedFields]  = useState(new Set());
  const [originalData,    setOriginalData]    = useState({});

  // ── Delete modal state ────────────────────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  //--additional modals state (e.g. bulk actions) can be added here--
  const [showCreateModal, setShowCreateModal] = useState(false);

  // ── Password reset modal state ────────────────────────────────────────────
  const [showPasswordResetModal,    setShowPasswordResetModal]    = useState(false);
  const [passwordResetData,         setPasswordResetData]         = useState({ email: "", newPassword: "", confirmPassword: "" });
  const [passwordErrors,            setPasswordErrors]            = useState({});
  const [showNewPassword,           setShowNewPassword]           = useState(false);
  const [showConfirmPassword,       setShowConfirmPassword]       = useState(false);
  const [confirmPasswordTouched,    setConfirmPasswordTouched]    = useState(false);

  // ── Pagination helpers ────────────────────────────────────────────────────
  const users      = Array.isArray(usersData?.results) ? usersData.results : (Array.isArray(usersData) ? usersData : []);
  const totalCount = usersData?.count      ?? users.length;
  const totalPages = usersData?.totalPages ?? Math.ceil(totalCount / filterParams.limit);

  // ── Handler: open edit modal ──────────────────────────────────────────────
  const handleEditUser = (userToEdit) => {
    const matchingRole = editRoleOptions.find((r) => r.label === userToEdit?.role_name);
    const initial = {
      username:         userToEdit?.username        || "",
      email:            userToEdit?.email           || "",
      role:             matchingRole?.value         || "",
      is_user_enabled:  userToEdit?.is_user_enabled ?? false,
      // UI checkbox is inverted: checked = "email verification ON" = override OFF
      is_email_override: !(userToEdit?.is_email_override ?? true),
    };
    setSelectedUser(userToEdit);
    setEditFormData(initial);
    setOriginalData(initial);
    setModifiedFields(new Set());
    setShowEditModal(true);
  };

  const handleOpenCreateModal = () => {
  setShowCreateModal(true);
};

//refresh function
const handleRefresh = async () => {
  try {
    await refetch();

    toast.success("Users refreshed successfully");
  } catch (err) {
    toast.error("Failed to refresh users");
  }
};

const handleCloseCreateModal = () => {
  setShowCreateModal(false);
};

  const handleFieldChange = (fieldName, value) => {
    setEditFormData((prev) => ({ ...prev, [fieldName]: value }));
    if (value !== originalData[fieldName]) {
      setModifiedFields((prev) => new Set(prev).add(fieldName));
    } else {
      setModifiedFields((prev) => { const n = new Set(prev); n.delete(fieldName); return n; });
    }
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setModifiedFields(new Set());
  };

  const handleSubmitEdit = async (e) => {
    e.preventDefault();
    if (modifiedFields.size === 0) {
      toast.info("No changes detected");
      setShowEditModal(false);
      return;
    }

    const payload = { id: selectedUser?.id };
    modifiedFields.forEach((field) => {
      payload[field] =
        field === "is_email_override" ? !editFormData[field] : editFormData[field];
    });

    const t = toast.loading("Updating user...");
    try {
      const res = await updateUser(payload).unwrap();
      toast.update(t, { render: res?.results?.[0]?.message, type: "success", isLoading: false, autoClose: 2000 });
      handleCloseEditModal();
      setSelectedUser(null);
      refetch();
    } catch (err) {
      toast.update(t, { render: `Failed to update user: ${extractErrorMessage(err)}`, type: "error", isLoading: false, autoClose: 5000 });
    }
  };

  // ── Handler: open delete modal ────────────────────────────────────────────
  const handleDeleteUser = (userToDelete) => {
    setSelectedUser(userToDelete);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    const t = toast.loading("Deleting user...");
    try {
      const res = await deleteUser(selectedUser?.id).unwrap();
      toast.update(t, { render: res?.message, type: "success", isLoading: false, autoClose: 3000 });
      setShowDeleteModal(false);
      setSelectedUser(null);
      refetch();
    } catch (err) {
      toast.update(t, { render: `Failed to delete user: ${extractErrorMessage(err)}`, type: "error", isLoading: false, autoClose: 5000 });
    }
  };

  // ── Handler: open password reset modal ────────────────────────────────────
  const handlePasswordReset = (userToReset) => {
    setSelectedUser(userToReset);
    setPasswordResetData({ email: userToReset?.email || "", newPassword: "", confirmPassword: "" });
    setPasswordErrors({});
    setConfirmPasswordTouched(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setShowPasswordResetModal(true);
  };

  const handlePasswordResetChange = (field, value) => {
    setPasswordResetData((prev) => ({ ...prev, [field]: value }));
    if (passwordErrors[field]) {
      setPasswordErrors((prev) => {
        const n = { ...prev };
        delete n[field];
        if (field === "newPassword") delete n.password;
        return n;
      });
    }
  };

  const handlePasswordResetSubmit = async (e) => {
    e.preventDefault();
    if (passwordResetData.newPassword !== passwordResetData.confirmPassword) {
      setPasswordErrors({ confirmPassword: "Passwords do not match!" });
      return;
    }

    const t = toast.loading("Resetting password...");
    try {
      const res = await updateUser({ id: selectedUser?.id, password: passwordResetData.newPassword }).unwrap();

      // Handle soft-failure in success response (backend-specific)
      if (res.success === false && res.failed_updates?.length > 0) {
        const fieldErrors = extractFieldErrors(res.failed_updates[0]?.errors);
        if (Object.keys(fieldErrors).length > 0) {
          setPasswordErrors(fieldErrors);
          toast.update(t, { render: "Please fix the validation errors", type: "error", isLoading: false, autoClose: 3000 });
          return;
        }
      }

      const updated = res?.results?.[0] || res?.successful_updates?.[0];
      toast.update(t, {
        render: updated ? `Password reset successfully for "${updated.email}"!` : "Password reset successful",
        type: "success",
        isLoading: false,
        autoClose: 2000,
      });

      setShowPasswordResetModal(false);
      setSelectedUser(null);
      setPasswordResetData({ email: "", newPassword: "", confirmPassword: "" });
      setPasswordErrors({});
      setConfirmPasswordTouched(false);
    } catch (err) {
      const fieldErrors = extractFieldErrorsFromApiError(err?.data);
      if (Object.keys(fieldErrors).length > 0) {
        setPasswordErrors(fieldErrors);
        toast.update(t, { render: "Please fix the validation errors", type: "error", isLoading: false, autoClose: 3000 });
        return;
      }
      toast.update(t, { render: `Failed to reset password: ${extractErrorMessage(err)}`, type: "error", isLoading: false, autoClose: 5000 });
    }
  };

  // ── Bulk action handlers (called by UsersTable's BulkActionModal) ─────────
  const handleDeleteUsers = async (ids) => {
    const t = toast.loading(`Deleting ${ids.length} user(s)...`);
    const results = await Promise.allSettled(ids.map((id) => deleteUser(id).unwrap()));
    const ok   = results.filter((r) => r.status === "fulfilled").length;
    const fail = results.filter((r) => r.status === "rejected").length;
    toast.update(t, {
      render: ok && !fail ? `Successfully deleted ${ok} user(s)` : ok ? `Deleted ${ok}, ${fail} failed` : `Failed to delete ${fail} user(s)`,
      type:  ok && !fail ? "success" : ok ? "warning" : "error",
      isLoading: false,
      autoClose: 3000,
    });
    refetch();
  };

  const handleBulkUpdateUsers = async (ids, fields) => {
    const t = toast.loading(`Updating ${ids.length} user(s)...`);
    const results = await Promise.allSettled(
      ids.map((id) => updateUser({ id, ...fields }).unwrap())
    );
    const ok   = results.filter((r) => r.status === "fulfilled").length;
    const fail = results.filter((r) => r.status === "rejected").length;
    toast.update(t, {
      render: ok && !fail ? `Successfully updated ${ok} user(s)` : ok ? `Updated ${ok}, ${fail} failed` : `Failed to update ${fail} user(s)`,
      type:  ok && !fail ? "success" : ok ? "warning" : "error",
      isLoading: false,
      autoClose: 3000,
    });
    refetch();
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <PageWrapper isDarkMode={isDarkMode}>
  <>
    <UsersTable
      // data
      users={users}
      editRoleOptions={editRoleOptions}
      rolesLoading={rolesLoading}
      rolesError={rolesError}
      currentUser={currentUser}

      //refetching
      isRefreshing={isFetching}
      onRefreshAfterAction={handleRefresh}

      // pagination
      page={filterParams.page}
      totalPages={totalPages}
      totalCount={totalCount}
      onPageChange={setPage}

      // search
      searchTerm={search}
      onSearchChange={onSearchChange}
      itemsPerPage={filterParams.limit}
      onItemsPerPageChange={onLimitChange}

      // create user
      onCreateUser={handleOpenCreateModal}

      // bulk handlers
      onDeleteUsers={handleDeleteUsers}
      onUpdateUser={handleBulkUpdateUsers}

      // single-row action openers
      onEditUser={handleEditUser}
      onPasswordReset={handlePasswordReset}
      onDeleteUser={handleDeleteUser}

      // edit modal
      showEditModal={showEditModal}
      onHideEditModal={handleCloseEditModal}
      selectedUser={selectedUser}
      editFormData={editFormData}
      modifiedFields={modifiedFields}
      onFieldChange={handleFieldChange}
      onSubmitEdit={handleSubmitEdit}

      // delete modal
      showDeleteModal={showDeleteModal}
      onHideDeleteModal={() => setShowDeleteModal(false)}
      onConfirmDelete={handleConfirmDelete}

      // password reset modal
      showPasswordResetModal={showPasswordResetModal}
      onHidePasswordResetModal={() => {
        setShowPasswordResetModal(false);
        setPasswordErrors({});
        setConfirmPasswordTouched(false);
      }}
      passwordResetData={passwordResetData}
      onPasswordResetChange={handlePasswordResetChange}
      onPasswordResetSubmit={handlePasswordResetSubmit}
      passwordErrors={passwordErrors}
      showNewPassword={showNewPassword}
      setShowNewPassword={setShowNewPassword}
      showConfirmPassword={showConfirmPassword}
      setShowConfirmPassword={setShowConfirmPassword}
      confirmPasswordTouched={confirmPasswordTouched}
      setConfirmPasswordTouched={setConfirmPasswordTouched}

      isDarkMode={isDarkMode}
      isLoading={isLoading}
    />

    <UserCreationModal
      show={showCreateModal}
      onHide={handleCloseCreateModal}
      onUserCreated={() => {
        refetch();
        handleCloseCreateModal();
      }}
      isDarkMode={isDarkMode}
    />
  </>
</PageWrapper>
  );
};

export default UsersPage;

// ── Private error helpers (no need to export) ─────────────────────────────────

function extractErrorMessage(err) {
  if (!err) return "Unknown error occurred";
  return (
    err?.data?.message  ||
    err?.data?.error    ||
    err?.data?.detail   ||
    err?.message        ||
    "Unknown error occurred"
  );
}

function extractFieldErrors(errorsObj) {
  if (!errorsObj || typeof errorsObj !== "object") return {};
  const out = {};
  Object.keys(errorsObj).forEach((field) => {
    if (Array.isArray(errorsObj[field])) out[field] = errorsObj[field].join(" ");
    else if (typeof errorsObj[field] === "string") out[field] = errorsObj[field];
  });
  return out;
}

function extractFieldErrorsFromApiError(errorData) {
  if (!errorData) return {};
  if (errorData.failed_updates?.[0]?.errors)
    return extractFieldErrors(errorData.failed_updates[0].errors);
  if (errorData.code === "VALIDATION_ERROR" && errorData.errors)
    return extractFieldErrors(errorData.errors);
  return extractFieldErrors(errorData);
}