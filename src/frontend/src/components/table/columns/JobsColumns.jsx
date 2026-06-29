import { useMemo } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { Download } from "lucide-react";

const helper = createColumnHelper();

export default function useJobColumns({ isDarkMode, onDownload, onRowClick }) {
  return useMemo(
    () => [
      helper.accessor("timestamp", {
        id: "timestamp",
        header: "DATE",
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap text-xs">
            {getValue() ? new Date(getValue()).toLocaleString() : "---"}
          </span>
        ),
      }),

      helper.accessor("user", {
        id: "user",
        header: "USER",
        cell: ({ getValue }) => <span className="text-xs">{getValue() || "---"}</span>,
      }),

      helper.accessor("job_type", {
        id: "job_type",
        header: "JOB TYPE",
        cell: ({ getValue }) => (
          <span
            className={`text-xs font-medium px-2 py-1 rounded-full ${
              isDarkMode
                ? "bg-blue-900/30 border border-blue-800/50 text-blue-300"
                : "bg-blue-100 border border-blue-200 text-blue-800"
            }`}
          >
            {getValue() || "---"}
          </span>
        ),
      }),

      helper.accessor((row) => row.result || row.status || "---", {
        id: "results",
        header: "RESULTS",
        cell: ({ getValue }) => {
          const result = String(getValue() || "---").toLowerCase();

          const resultClass =
            result === "success"
              ? isDarkMode
                ? "bg-green-900/50 border border-green-800/30 text-green-300 px-2 py-1 rounded-full"
                : "bg-green-100 border border-green-200 text-green-800 px-2 py-1 rounded-full"
              : result === "partial"
              ? isDarkMode
                ? "bg-yellow-900/50 border border-yellow-800/30 text-yellow-300 px-2 py-1 rounded-full"
                : "bg-yellow-100 border border-yellow-200 text-yellow-800 px-2 py-1 rounded-full"
              : result === "failed"
              ? isDarkMode
                ? "bg-red-900/50 border border-red-800/30 text-red-300 px-2 py-1 rounded-full"
                : "bg-red-100 border border-red-200 text-red-800 px-2 py-1 rounded-full"
              : result === "duplicate"
              ? isDarkMode
                ? "bg-orange-900/50 border border-orange-800/30 text-orange-300 px-2 py-1 rounded-full"
                : "bg-orange-100 border border-orange-200 text-orange-800 px-2 py-1 rounded-full"
              : result === "empty"
              ? isDarkMode
                ? "bg-gray-900/50 border border-gray-800/30 text-gray-300 px-2 py-1 rounded-full"
                : "bg-gray-100 border border-gray-200 text-gray-800 px-2 py-1 rounded-full"
              : "text-xs font-medium";

          return <span className={`inline-flex items-center ${resultClass}`}>{getValue() || "---"}</span>;
        },
      }),

      helper.accessor("uuid", {
        id: "actions",
        header: "ACTIONS",
        cell: ({ row }) => (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownload?.(row.original.uuid);
            }}
            className={`p-1.5 rounded-lg transition-all duration-200 flex items-center justify-center hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-1 w-8 h-8 ${
              isDarkMode
                ? "bg-blue-900/20 text-blue-400 hover:bg-blue-900/40 hover:text-blue-300 border border-blue-900/30"
                : "bg-blue-100/80 text-blue-600 hover:bg-blue-200 hover:text-blue-700 border border-blue-200/50"
            }`}
            title={`Download job ${row.original.uuid}`}
            aria-label={`Download job ${row.original.uuid}`}
          >
            <Download className="w-4 h-4 flex-shrink-0" />
          </button>
        ),
      }),
    ],
    [isDarkMode, onDownload]
  );
}