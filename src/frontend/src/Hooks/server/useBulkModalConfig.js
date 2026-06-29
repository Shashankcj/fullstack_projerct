import { useState, useMemo } from "react";
import { Wrench, AlertTriangle, TrashIcon } from "lucide-react";
import { toast } from "react-toastify";

const useBulkModalConfig = ({
  currentAction,
  selectedServers,
  isDarkMode,
  onDeleteServers,
  onAssignPriority,
  onSetMaintenance,
  activeTab,
}) => {
  return useMemo(() => {
    switch (currentAction) {
      case "delete":
        return {
          title: "Delete Servers",
          message: `Delete ${selectedServers.size} server(s)? This cannot be undone.`,
          icon: TrashIcon,
          iconColor: isDarkMode ? "#F87171" : "#EF4444",
          itemLabel: "Selected Servers",
          itemUnit: "Server(s)",
          showDropdown: true,
          requireSelection: true,
          cancelValue: "false",
          dropdownLabel: "Confirm Deletion",
          dropdownPlaceholder: "Select an option",
          options: [
            { value: "true",  label: "Yes" },
            { value: "false", label: "No"  },
          ],
          buttonText: "Delete Servers",
          buttonColor: "red",
          processingText: "Deleting...",
          onAction: async (ids, val) => {
            if (val !== "true") return;
            try {
              const response = await onDeleteServers(ids);
              toast.success(response?.message || `Successfully deleted ${ids.length} server(s)`);
            } catch (err) {
              toast.error(err?.data?.message || err?.data?.error || err?.message || "Failed to delete servers");
              throw err;
            }
          },
        };

      case "priority":
        return {
          title: "Assign Priority",
          message: `Assign priority to ${selectedServers.size} server(s)`,
          icon: AlertTriangle,
          iconColor: isDarkMode ? "#3B82F6" : "#2563EB",
          itemLabel: "Selected Servers",
          itemUnit: "Server(s)",
          showDropdown: true,
          requireSelection: true,
          dropdownLabel: "Select Priority",
          dropdownPlaceholder: "Choose priority level",
          options: [
            { value: "p1", label: "Priority 1 (Critical)", disabled: activeTab === "p1" },
            { value: "p2", label: "Priority 2 (High)",     disabled: activeTab === "p2" },
            { value: "p3", label: "Priority 3 (Medium)",   disabled: activeTab === "p3" },
            { value: "p4", label: "Priority 4 (Low)",      disabled: activeTab === "p4" },
            { value: "np", label: "No Priority" },
          ],
          buttonText: "Assign Priority",
          buttonColor: "blue",
          processingText: "Assigning...",
          onAction: async (ids, val) => {
            try {
              const response = await onAssignPriority(ids, val);
              toast.success(response?.message || `Assigned ${val} to ${ids.length} server(s)`);
            } catch (err) {
              toast.error(err?.data?.message || err?.data?.error || err?.message || "Failed to assign priority");
              throw err;
            }
          },
        };

      case "maintenance":
        return {
          actionType: "maintenance",
          title: "Set Maintenance Mode",
          message: `Set ${selectedServers.size} server(s) to maintenance`,
          icon: Wrench,
          iconColor: isDarkMode ? "#10B981" : "#059669",
          itemLabel: "Selected Servers",
          itemUnit: "Server(s)",
          showRadioOptions: true,
          radioOptions: [
            { label: "Immediate", value: "immediate" },
            { label: "Scheduled", value: "scheduled" },
          ],
          showDateRange: true,
          showDatePicker: true,
          requireSelection: true,
          buttonText: "Set Maintenance",
          buttonColor: "green",
          processingText: "Setting maintenance...",
          onAction: async (ids, mode, start, end, endTime) => {
            try {
              const uuids = ids.map((id) => (typeof id === "object" ? id.uuid : id));
              const response = await onSetMaintenance(uuids, mode, start, end, endTime);
              if (response?.message) toast.success(response.message);
              if (response?.errors?.length > 0) {
                const alreadyInMaintenance = response.errors.filter(
                  (e) => typeof e === "object" && e.already_in_maintenance
                );
                const otherErrors = response.errors.filter(
                  (e) => (typeof e === "object" ? !e.already_in_maintenance : true)
                );
                if (alreadyInMaintenance.length > 0) {
                  const names = alreadyInMaintenance.map((e) => e.hostname).join(", ");
                  toast.warning(
                    `${alreadyInMaintenance.length} device(s) already under maintenance: ${names}`,
                    { autoClose: 6000 }
                  );
                }
                if (otherErrors.length > 0) {
                  toast.error(`${otherErrors.length} device(s) failed to update`);
                }
              }
            } catch (err) {
              const errData = err?.data;
              if (err?.status === 409 && errData?.already_in_maintenance) {
                const s = errData.maintenance_start
                  ? new Date(errData.maintenance_start).toLocaleString()
                  : "N/A";
                const e = errData.maintenance_end
                  ? new Date(errData.maintenance_end).toLocaleString()
                  : "Indefinite";
                toast.warning(`⚠️ ${errData.error} — Window: ${s} → ${e}`, { autoClose: 7000 });
                return;
              }
              toast.error(errData?.message || errData?.error || err?.message || "Failed to set maintenance");
              throw err;
            }
          },
        };

      default:
        return null;
    }
  }, [currentAction, selectedServers.size, isDarkMode, onDeleteServers, onAssignPriority, onSetMaintenance, activeTab]);
};

export default useBulkModalConfig;