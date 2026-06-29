import React from "react";

import {
  Eye,
  Edit2,
  Trash2,
} from "lucide-react";

import RenderIfAllowed from "../../shared/RenderIfAllowed";
import StatusBadge from "../../shared/StatusBadge";
import PriorityBadge from "../../shared/priorityBadge";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const normalizePriority = (rawPriority) => {
  if (rawPriority === "") return "---";
  if (rawPriority === "np") return "np";

  if (!rawPriority || typeof rawPriority !== "string") {
    return "default";
  }

  const lower = rawPriority.toLowerCase();

  if (lower.includes("p1")) return "p1";
  if (lower.includes("p2")) return "p2";
  if (lower.includes("p3")) return "p3";
  if (lower.includes("p4")) return "p4";

  return "default";
};

// ─────────────────────────────────────────────────────────────
// Columns
// ─────────────────────────────────────────────────────────────
export const getIPMonitoringColumns = ({
  isDarkMode = true,
  selectedRows = new Set(),
  isAllSelected = false,
  onCheckboxChange,
  onSelectAll,
  onRowClick,
  onEditIP,
  onDeleteIP,
  onViewIP,
  moduleName = "ip_monitoring",
}) => [
  // ─────────────────────────────────────────────────────────
  // Checkbox
  // ─────────────────────────────────────────────────────────
  {
    id: "checkbox",

    header: () => (
      <input
        type="checkbox"
        checked={isAllSelected}
        onChange={onSelectAll}
        className={`accent-indigo-500 w-3.5 h-3.5 rounded cursor-pointer ${
          isDarkMode ? "border-slate-500" : "border-slate-300"
        }`}
      />
    ),

    cell: ({ row }) => (
      <input
        type="checkbox"
        checked={selectedRows.has(row.original.uuid)}
        onChange={() => onCheckboxChange?.(row.original.uuid)}
        onClick={(e) => e.stopPropagation()}
        className="accent-indigo-500 w-3.5 h-3.5 rounded cursor-pointer"
      />
    ),

    enableSorting: false,
    size: 50,
  },

  // ─────────────────────────────────────────────────────────
  // Name
  // ─────────────────────────────────────────────────────────
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRowClick?.(row.original.uuid);
        }}
        className={`font-medium ${
          isDarkMode ? "text-slate-200" : "text-slate-700"
        } hover:underline`}
      >
        {row.original.name || "-"}
      </button>
    ),
    enableSorting: true,
    size: 180,
  },

  // ─────────────────────────────────────────────────────────
  // IP Address
  // ─────────────────────────────────────────────────────────
  {
    accessorKey: "ip_address",
    header: "IP Address",
    cell: ({ row }) => (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRowClick?.(row.original.uuid);
        }}
        className={`font-medium ${
          isDarkMode ? "text-slate-200" : "text-slate-700"
        } hover:underline`}
      >
        {row.original.ip_address || "-"}
      </button>
    ),
    enableSorting: true,
    size: 190,
  },

  // ─────────────────────────────────────────────────────────
  // Priority
  // ─────────────────────────────────────────────────────────
  {
    accessorKey: "priority",
    header: "Priority",
    cell: ({ row }) => {
      const value = row.original.priority;
      const rawPriority = row.original.rawPriority;

      if (value && typeof value === "object" && value.label) {
        return (
          <PriorityBadge
            priority={value.label.toLowerCase()}
            isDarkMode={isDarkMode}
          />
        );
      }

      const normalized = normalizePriority(rawPriority);

      if (normalized === "np" || normalized === "---") {
        return (
          <span className={isDarkMode ? "text-slate-400" : "text-slate-500"}>
            ---
          </span>
        );
      }

      return (
        <PriorityBadge
          priority={normalized}
          isDarkMode={isDarkMode}
        />
      );
    },
    enableSorting: true,
    size: 150,
  },

  // ─────────────────────────────────────────────────────────
  // Status
  // ─────────────────────────────────────────────────────────
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <StatusBadge
        status={row.original.status}
        isDarkMode={isDarkMode}
      />
    ),
    enableSorting: true,
    size: 140,
  },

  // ─────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────
  {
    id: "actions",
    header: "Action",

    cell: ({ row }) => (
      <div className="flex items-center justify-center gap-2">

        {/* View */}
        {onViewIP && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewIP(row.original);
            }}
            className={`p-1 rounded transition-colors ${
              isDarkMode
                ? "text-slate-300 hover:text-white hover:bg-white/10"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
            title="View"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Edit (ONLY priority + edit now handled here) */}
        {onEditIP && (
          <RenderIfAllowed module={moduleName} action="update">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditIP(e, row.original);
              }}
              className={`p-1 rounded transition-colors ${
                isDarkMode
                  ? "text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
                  : "text-blue-600 hover:text-blue-900 hover:bg-blue-50"
              }`}
              title="Edit"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          </RenderIfAllowed>
        )}

        {/* Delete */}
        {onDeleteIP && (
          <RenderIfAllowed module={moduleName} action="delete">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteIP(e, row.original);
              }}
              className={`p-1 rounded transition-colors ${
                isDarkMode
                  ? "text-red-400 hover:text-red-300 hover:bg-red-900/20"
                  : "text-red-600 hover:text-red-900 hover:bg-red-50"
              }`}
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </RenderIfAllowed>
        )}

      </div>
    ),
    enableSorting: false,
    size: 120,
  },
];