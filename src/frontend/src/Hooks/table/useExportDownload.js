import { useCallback } from "react";
import { toast } from "react-toastify";

/**
 * Handles CSV blob download from any API call.
 * Used by: EventLogs, Jobs, AuditLogs
 */
export const useExportDownload = ({ filename = "export" } = {}) => {
  const triggerDownload = useCallback(async (fetchFn) => {
    try {
      const blob = await fetchFn();
      const url  = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href     = url;
      link.download = `${filename}_${Date.now()}.csv`;
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Exported successfully");
    } catch (err) {
      console.error("[useExportDownload]", err);
      toast.error("Export failed");
    }
  }, [filename]);

  return { triggerDownload };
};