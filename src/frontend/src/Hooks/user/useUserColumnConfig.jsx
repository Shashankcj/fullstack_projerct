import { useMemo, useState } from "react";
import { PencilIcon, TrashIcon } from "@heroicons/react/24/outline";
import { CheckBadgeIcon } from "@heroicons/react/24/outline";
import { KeyRound } from "lucide-react";
import RenderIfAllowed from "../../components/shared/RenderIfAllowed";

// ── Column IDs ────────────────────────────────────────────────────────────────
export const USER_COL_IDS = {
  SELECT:     "select",
  USER:       "user",
  ROLE:       "role",
  STATUS:     "status",
  LAST_LOGIN: "last_login",
  JOINED:     "date_joined",
  ACTIONS:    "actions",
};

// ── Always-visible columns ────────────────────────────────────────────────────
const ALWAYS_VISIBLE = new Set([
  USER_COL_IDS.SELECT,
  USER_COL_IDS.USER,
  USER_COL_IDS.ACTIONS,
]);

// ── Toggleable column definitions ─────────────────────────────────────────────
const TOGGLEABLE_COLUMN_DEFS = [
  { id: USER_COL_IDS.ROLE,       label: "Role" },
  { id: USER_COL_IDS.STATUS,     label: "Status" },
  { id: USER_COL_IDS.LAST_LOGIN, label: "Last Login" },
  { id: USER_COL_IDS.JOINED,     label: "Joined" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatDate = (dateString) => {
  if (!dateString) return null;
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Invalid Date";
    return date.toLocaleDateString("en-US", {
      year:   "numeric",
      month:  "short",
      day:    "numeric",
      hour:   "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Invalid Date";
  }
};

const getRoleBadgeStyle = (isDarkMode) =>
  isDarkMode ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-800";

const getStatusBadgeStyle = (isActive, isDarkMode) =>
  isActive
    ? isDarkMode ? "bg-green-900 text-green-300" : "bg-green-100 text-green-800"
    : isDarkMode ? "bg-red-900  text-red-300"    : "bg-red-100  text-red-800";

// ── Hook ──────────────────────────────────────────────────────────────────────
const useUserColumnConfig = ({
  isDarkMode,
  selectedUsers,
  toggleSelectOne,
  toggleSelectAll,
  sortedUsers,
  currentUser,
  onEdit,
  onPasswordReset,
  onDelete,
}) => {
  const [visibleCols, setVisibleCols] = useState(
    () => new Set(TOGGLEABLE_COLUMN_DEFS.map((c) => c.id))
  );

  const toggleCol = (colId) => {
    if (ALWAYS_VISIBLE.has(colId)) return;
    setVisibleCols((prev) => {
      const next = new Set(prev);
      next.has(colId) ? next.delete(colId) : next.add(colId);
      return next;
    });
  };

  const toggleableCols = TOGGLEABLE_COLUMN_DEFS.map((col) => ({
    ...col,
    visible: visibleCols.has(col.id),
  }));

  // ── All column definitions ─────────────────────────────────────────────────
  const allColumns = useMemo(() => {
    const selectableUsers = sortedUsers.filter((u) => u.id !== currentUser?.id);
    const allSelected =
      selectableUsers.length > 0 &&
      selectedUsers.size === selectableUsers.length;

    return [
      // ── Checkbox ────────────────────────────────────────────────────────────
      {
        id: USER_COL_IDS.SELECT,
        header: () => (
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => toggleSelectAll(e, selectableUsers)}
            onClick={(e) => e.stopPropagation()}   // ← stops row click
            className={`w-4 h-4 cursor-pointer rounded border ${
              isDarkMode
                ? "border-gray-500 accent-blue-500"
                : "border-gray-300 accent-blue-600"
            }`}
          />
        ),
        cell: ({ row }) => {
          const isOwn = row.original.id === currentUser?.id;
          return (
            <input
              type="checkbox"
              checked={selectedUsers.has(row.original.id)}
              onChange={() => toggleSelectOne(row.original.id)}
              onClick={(e) => e.stopPropagation()}   // ← stops row click
              disabled={isOwn}
              title={isOwn ? "Cannot select your own account" : ""}
              className={`w-4 h-4 rounded border ${
                isOwn ? "cursor-not-allowed opacity-50" : "cursor-pointer"
              } ${
                isDarkMode
                  ? "border-gray-500 accent-blue-500"
                  : "border-gray-300 accent-blue-600"
              }`}
            />
          );
        },
        enableSorting: false,
        size: 48,
      },

      // ── User (username + email + verified badge) ───────────────────────────
      {
        id: USER_COL_IDS.USER,
        header: "User",
        accessorKey: "username",
        cell: ({ row }) => {
          const u = row.original;
          return (
            <div>
              <div
                className="text-sm font-medium truncate"
                style={{ color: isDarkMode ? "#D1D5DB" : "#111827" }}
                title={u.username}
              >
                {u.username || "N/A"}
              </div>
              <div className="flex items-center gap-1">
                <div
                  className="text-xs truncate"
                  style={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }}
                  title={u.email}
                >
                  {u.email || "N/A"}
                </div>
                {u.is_email_verified && (
                  <CheckBadgeIcon
                    className="w-4 h-4 flex-shrink-0"
                    style={{ color: isDarkMode ? "#34D399" : "#10B981" }}
                    title="Email Verified"
                  />
                )}
              </div>
            </div>
          );
        },
        size: 220,
      },

      // ── Role ──────────────────────────────────────────────────────────────
      {
        id: USER_COL_IDS.ROLE,
        header: "Role",
        accessorKey: "role_name",
        cell: ({ row }) => (
          <div className="flex justify-center">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeStyle(isDarkMode)}`}
              title={row.original.role_name}
            >
              {row.original.role_name || "N/A"}
            </span>
          </div>
        ),
        size: 130,
      },

      // ── Status ────────────────────────────────────────────────────────────
      {
        id: USER_COL_IDS.STATUS,
        header: "Status",
        accessorKey: "is_user_enabled",
        cell: ({ row }) => (
          <div className="flex justify-center">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeStyle(row.original.is_user_enabled, isDarkMode)}`}
            >
              {row.original.is_user_enabled ? "Active" : "Inactive"}
            </span>
          </div>
        ),
        size: 100,
      },

      // ── Last Login ────────────────────────────────────────────────────────
      {
        id: USER_COL_IDS.LAST_LOGIN,
        header: "Last Login",
        accessorKey: "last_login",
        cell: ({ row }) => {
          const date = formatDate(row.original.last_login);
          return date ? (
            <span
              className="truncate block text-sm"
              style={{ color: isDarkMode ? "#D1D5DB" : "#6B7280" }}
              title={date}
            >
              {date}
            </span>
          ) : (
            <span
              className="italic text-sm"
              style={{ color: isDarkMode ? "#9CA3AF" : "#9CA3AF" }}
            >
              Never Logged-In
            </span>
          );
        },
        size: 180,
      },

      // ── Joined ────────────────────────────────────────────────────────────
      {
        id: USER_COL_IDS.JOINED,
        header: "Joined",
        accessorKey: "date_joined",
        cell: ({ row }) => {
          const date = formatDate(row.original.date_joined);
          return (
            <span
              className="truncate block text-sm"
              style={{ color: isDarkMode ? "#D1D5DB" : "#6B7280" }}
              title={date}
            >
              {date || "N/A"}
            </span>
          );
        },
        size: 160,
      },

      // ── Actions ───────────────────────────────────────────────────────────
      {
        id: USER_COL_IDS.ACTIONS,
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => {
          const rowUser = row.original;
          const isOwn   = rowUser.id === currentUser?.id;

          if (isOwn) {
            return (
              <div className="flex items-center justify-center space-x-1">
                {[
                  { icon: PencilIcon, title: "Cannot edit your own account" },
                  { icon: KeyRound,   title: "Cannot reset your own password here" },
                  { icon: TrashIcon,  title: "Cannot delete your own account" },
                ].map(({ icon: Icon, title }) => (
                  <button
                    key={title}
                    disabled
                    title={title}
                    className={`p-1 rounded cursor-not-allowed opacity-50 ${
                      isDarkMode ? "text-gray-600" : "text-gray-400"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            );
          }

          return (
            <div className="flex items-center justify-center space-x-1">
              <RenderIfAllowed module="users_management" action="update">
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(rowUser); }}
                  title="Edit User"
                  className={`p-1 rounded transition-colors ${
                    isDarkMode
                      ? "text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
                      : "text-blue-600 hover:text-blue-900 hover:bg-blue-50"
                  }`}
                >
                  <PencilIcon className="w-3.5 h-3.5" />
                </button>
              </RenderIfAllowed>

              <RenderIfAllowed module="users_management" action="update">
                <button
                  onClick={(e) => { e.stopPropagation(); onPasswordReset(rowUser); }}
                  title="Reset Password"
                  className={`p-1 rounded transition-colors ${
                    isDarkMode
                      ? "text-yellow-400 hover:text-yellow-300 hover:bg-yellow-900/20"
                      : "text-yellow-600 hover:text-yellow-900 hover:bg-yellow-50"
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                </button>
              </RenderIfAllowed>

              <RenderIfAllowed module="users_management" action="delete">
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(rowUser); }}
                  title="Delete User"
                  className={`p-1 rounded transition-colors ${
                    isDarkMode
                      ? "text-red-400 hover:text-red-300 hover:bg-red-900/20"
                      : "text-red-600 hover:text-red-900 hover:bg-red-50"
                  }`}
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>
              </RenderIfAllowed>
            </div>
          );
        },
        size: 100,
      },
    ];
  }, [
    isDarkMode,
    selectedUsers,
    sortedUsers,
    currentUser,
    toggleSelectOne,
    toggleSelectAll,
    onEdit,
    onPasswordReset,
    onDelete,
  ]);

  // ── Filter to only visible columns ────────────────────────────────────────
  const filteredColumns = useMemo(
    () =>
      allColumns.filter(
        (col) => ALWAYS_VISIBLE.has(col.id) || visibleCols.has(col.id)
      ),
    [allColumns, visibleCols]
  );

  return { visibleCols, toggleCol, filteredColumns, toggleableCols };
};

export default useUserColumnConfig;