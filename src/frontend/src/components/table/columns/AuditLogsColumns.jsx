import { useMemo } from "react";
import { createColumnHelper } from "@tanstack/react-table";

const helper = createColumnHelper();

const SEVERITY_COLORS = {
  Critical: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  Delete: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  Create: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  Update: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  Success: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  Warning: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  Info: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
};

export default function useAuditLogColumns() {
  return useMemo(
    () => [
      helper.accessor("timestamp", {
        id: "timestamp",
        header: "DATE",
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap">
            {new Date(getValue()).toLocaleString()}
          </span>
        ),
      }),

      helper.accessor((row) => row.user || "---", {
        id: "user",
        header: "USER",
      }),

      helper.accessor("action", {
        id: "action",
        header: "ACTION",
        cell: ({ getValue }) => <span className="font-medium">{getValue() || "---"}</span>,
      }),

      helper.accessor("model_name", {
        id: "model_name",
        header: "RESOURCE",
        cell: ({ getValue }) => <span>{getValue() || "---"}</span>,
      }),

      helper.accessor("ip", {
        id: "ip",
        header: "IP",
        cell: ({ getValue }) => <span className="whitespace-nowrap">{getValue() || "---"}</span>,
      }),

      helper.accessor("severity_display", {
        id: "severity_display",
        header: "SEVERITY",
        cell: ({ row, getValue }) => {
          const value = getValue() || row.original.severity || "Info";
          return (
            <div className="flex items-center justify-center">
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  SEVERITY_COLORS[value] || SEVERITY_COLORS.Info
                }`}
              >
                {value}
              </span>
            </div>
          );
        },
      }),

      helper.accessor((row) => row.description || "---", {
        id: "description",
        header: "DESCRIPTION",
        cell: ({ getValue }) => {
          const text = getValue() || "---";
          return (
            <span title={text}>
              {text.length > 70 ? `${text.slice(0, 70)}…` : text}
            </span>
          );
        },
      }),
    ],
    []
  );
}