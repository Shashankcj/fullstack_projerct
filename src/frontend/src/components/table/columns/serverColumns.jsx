import React from "react";

import HealthBadge from "../../shared/HealthBadge";
import ProgressCell from "../cells/ProgressCell";
import StatusBadge from "../../shared/StatusBadge";

export const getServerColumns = ({
  isDarkMode,
  thresholds,
  selectedServers,
  toggleSelectOne,
  toggleSelectAll,
  servers = [],   // renamed from sortedServers + default to [] to prevent .length crash
}) => [
  {
    id: "checkbox",
    header: () => (
      <input
        type="checkbox"
        checked={
          servers.length > 0 &&
          selectedServers?.size === servers.length
        }
        onChange={toggleSelectAll}
        className="accent-indigo-500 w-3.5 h-3.5 rounded cursor-pointer"
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        checked={selectedServers?.has(row.original.uuid)}
        onChange={() => toggleSelectOne(row.original.uuid)}
        onClick={(e) => e.stopPropagation()}
        className="accent-indigo-500 w-3.5 h-3.5 rounded cursor-pointer"
      />
    ),
    enableSorting: false,
    size: 40,
  },
  {
    accessorKey: "name",
    header: "Server",
    cell: ({ row }) => (
      <div
        className={`font-bold whitespace-nowrap ${
          isDarkMode ? "text-white" : "text-slate-700"
        }`}
      >
        {row.original.name}
      </div>
    ),
    size: 180,
  },
  {
    accessorKey: "os",
    header: "OS",
    cell: ({ row }) => (
      <div
        className={`text-[11px] font-medium ${
          isDarkMode ? "text-slate-300" : "text-slate-500"
        }`}
      >
        {row.original.os || "—"}
      </div>
    ),
    size: 140,
  },
  {
    accessorKey: "device_type",
    header: "Device Type",
    cell: ({ row }) => (
      <div
        className={`text-[11px] font-medium ${
          isDarkMode ? "text-slate-300" : "text-slate-500"
        }`}
      >
        {row.original.device_type || "—"}
      </div>
    ),
    size: 160,
  },
  {
    accessorKey: "health_status",
    header: "Health",
    cell: ({ row }) => (
      <HealthBadge status={row.original.health_status} />
    ),
    size: 140,
  },
  {
    accessorKey: "status",
    header: "Agent Status",
    cell: ({ row }) => (
      <StatusBadge
        status={row.original.status}
        isDarkMode={isDarkMode}
      />
    ),
    size: 160,
  },
  {
    accessorKey: "cpu",
    header: "CPU",
    cell: ({ row }) => (
      <ProgressCell
        value={row.original.cpu}
        thresholds={thresholds.cpu}
        isDarkMode={isDarkMode}
      />
    ),
    size: 140,
  },
  {
    accessorKey: "memory",
    header: "Memory",
    cell: ({ row }) => (
      <ProgressCell
        value={row.original.memory}
        thresholds={thresholds.memory}
        isDarkMode={isDarkMode}
      />
    ),
    size: 140,
  },
  {
    accessorKey: "disk",
    header: "Storage",
    cell: ({ row }) => (
      <ProgressCell
        value={row.original.disk}
        thresholds={thresholds.disk}
        isDarkMode={isDarkMode}
      />
    ),
    size: 140,
  },
  {
    accessorKey: "network",
    header: "Network",
    cell: ({ row }) => (
      <ProgressCell
        value={row.original.network}
        thresholds={thresholds.network}
        isDarkMode={isDarkMode}
      />
    ),
    size: 140,
  },
  {
    accessorKey: "ip",
    header: "IP",
    cell: ({ row }) => (
      <div
        className={`text-[11px] font-medium ${
          isDarkMode ? "text-slate-300" : "text-slate-500"
        }`}
      >
        {row.original.ip || "—"}
      </div>
    ),
    size: 160,
  },
];

// ─────────────────────────────────────────────
// HEALTH PRIORITY (backend‑style sort)
// ─────────────────────────────────────────────
export const HEALTH_PRIORITY = {
  red: 3,
  amber: 2,
  green: 0,
  no_data: -1,
  maintenance: 1,
};

export const sortServersByHealth = (servers = []) => {
  return [...servers].sort((a, b) => {
    const valA =
      HEALTH_PRIORITY[String(a.health_status).toLowerCase().trim()] ?? 0;
    const valB =
      HEALTH_PRIORITY[String(b.health_status).toLowerCase().trim()] ?? 0;
    return valB - valA;
  });
};