import { useMemo } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import PriorityBadge from "../../shared/priorityBadge";

const helper = createColumnHelper();

const SEVERITY_COLORS = {
  Critical: "bg-red-100 text-red-600",
  Warning:  "bg-yellow-100 text-yellow-700",
  Info:     "bg-blue-100 text-blue-600",
};

export default function useAlertColumns({ isDarkMode }) {
  return useMemo(() => [

    helper.accessor("created_at", {
      header: "Time",
      cell: ({ getValue }) => (
        <span className="whitespace-nowrap">
          {new Date(getValue()).toLocaleString()}
        </span>
      ),
    }),

    helper.accessor(row => row.device_name || row.hostname || "---", {
      id: "device",
      header: "Device",
    }),

    helper.accessor("priority", {
      header: "Priority",
      cell: ({ getValue }) => (
        <PriorityBadge priority={getValue() || ""} isDarkMode={isDarkMode} />
      ),
    }),

    helper.accessor("alert_type", {
      id: "component",
      header: "Component",
      cell: ({ getValue }) => (
        <span className="font-medium">{getValue() || "---"}</span>
      ),
    }),

    helper.accessor("severity", {
      header: "Severity",
      cell: ({ getValue }) => {
        const val = getValue();
        return (
          <span className={`inline-flex justify-center px-2 py-1 rounded-full text-xs font-medium ${
            SEVERITY_COLORS[val] || SEVERITY_COLORS.Info
          }`}>
            {val}
          </span>
        );
      },
    }),

    helper.accessor(row => row.message || row.details || "---", {
      id: "description",
      header: "Description",
      cell: ({ getValue }) => {
        const text = getValue();
        return (
          <span title={text}>
            {text.length > 70 ? text.slice(0, 70) + "…" : text}
          </span>
        );
      },
    }),

  ], [isDarkMode]);
}