import { useMemo, useCallback } from "react";
import { Trash2, AlertTriangle, Upload } from "lucide-react";
import { toast } from "react-toastify";

export default function useBulkActions({
  selectedRows,
  currentAction,
  setCurrentAction,
  setShowBulkModal,
  setShowBulkPriorityCSVModal,
  clearSelection,
  setCurrentPage,
  deleteIPs,
  assignPriority,
  isDarkMode,
}) {

  // ─────────────────────────────────────────────
  // ACTION HANDLERS
  // ─────────────────────────────────────────────

  const handleBulkDelete = useCallback(() => {
    if (selectedRows.size === 0) return;

    setCurrentAction("delete");
    setShowBulkModal(true);
  }, [selectedRows, setCurrentAction, setShowBulkModal]);

  const handleBulkAssignPriority = useCallback(() => {
    if (selectedRows.size === 0) return;

    setCurrentAction("priority");
    setShowBulkModal(true);
  }, [selectedRows, setCurrentAction, setShowBulkModal]);

  const handleBulkPriorityCSVUpload = useCallback(() => {
    setCurrentAction("priority_csv");
    setShowBulkPriorityCSVModal(true);
  }, [setCurrentAction, setShowBulkPriorityCSVModal]);

  const handleBulkSuccess = useCallback(() => {
    clearSelection();
    setShowBulkModal(false);
    setCurrentAction("");
    setCurrentPage(1);
  }, [
    clearSelection,
    setShowBulkModal,
    setCurrentAction,
    setCurrentPage,
  ]);

  // ─────────────────────────────────────────────
  // ACTION MENU ITEMS
  // ─────────────────────────────────────────────

  const actionMenuItems = useMemo(() => [
    {
      label: "Assign Priority",
      onClick: handleBulkAssignPriority,
      variant: "primary",
      icon: AlertTriangle,
      disabled: selectedRows.size === 0,
    },
    {
      label: "Import CSV for Assigning Priority",
      onClick: handleBulkPriorityCSVUpload,
      variant: "secondary",
      icon: Upload,
    },
    {
      label: "Delete Selected",
      onClick: handleBulkDelete,
      variant: "danger",
      icon: Trash2,
      disabled: selectedRows.size === 0,
    },
  ], [
    handleBulkAssignPriority,
    handleBulkPriorityCSVUpload,
    handleBulkDelete,
    selectedRows.size,
  ]);

  // ─────────────────────────────────────────────
  // BULK MODAL CONFIG
  // ─────────────────────────────────────────────

  const bulkModalConfig = useMemo(() => {

    switch (currentAction) {

      case "delete":
        return {
          title: "Delete IP Addresses",

          message:
            `Delete ${selectedRows.size} IP address(es)? This cannot be undone.`,

          icon: Trash2,

          iconColor:
            isDarkMode ? "#F87171" : "#EF4444",

          itemLabel: "Selected IPs",

          itemUnit: "IP(s)",

          showDropdown: true,

          requireSelection: true,

          cancelValue: "false",

          dropdownLabel: "Confirm Deletion",

          dropdownPlaceholder: "Select an option",

          options: [
            { value: "true", label: "Yes" },
            { value: "false", label: "No" },
          ],

          buttonText: "Delete IPs",

          buttonColor: "red",

          processingText: "Deleting...",

          onAction: async (ipIds, val) => {

            if (val !== "true") return;

            try {

              const response = await deleteIPs({
                uuid: ipIds,
              }).unwrap();

              toast.success(response?.message);

            } catch (err) {

              toast.error(err?.data?.message);

            }
          },
        };

      case "priority":
        return {
          title: "Assign Priority to IPs",

          message:
            `Assign priority to ${selectedRows.size} IP address(es)?`,

          icon: AlertTriangle,

          iconColor:
            isDarkMode ? "#3B82F6" : "#2563EB",

          itemLabel: "Selected IPs",

          itemUnit: "IP(s)",

          showDropdown: true,

          requireSelection: true,

          dropdownLabel: "Select Priority",

          dropdownPlaceholder: "Choose priority level",

          options: [
            { value: "p1", label: "Priority 1 (Critical)" },
            { value: "p2", label: "Priority 2 (High)" },
            { value: "p3", label: "Priority 3 (Medium)" },
            { value: "p4", label: "Priority 4 (Low)" },
            { value: "np", label: "No priority (Default)" },
          ],

          buttonText: "Assign Priority",

          buttonColor: "blue",

          processingText: "Assigning priority...",

          onAction: async (ipIds, priorityValue) => {

            const payload =
              ipIds.length === 1
                ? {
                    uuid: ipIds[0],
                    priority: priorityValue,
                  }
                : ipIds.map((id) => ({
                    uuid: id,
                    priority: priorityValue,
                  }));

            await assignPriority(payload).unwrap();

            toast.success(
              `Assigned ${priorityValue} to ${ipIds.length} IP(s)`
            );
          },
        };

      default:
        return null;
    }

  }, [
    currentAction,
    selectedRows.size,
    isDarkMode,
    deleteIPs,
    assignPriority,
  ]);

  // ─────────────────────────────────────────────
  // RETURN
  // ─────────────────────────────────────────────

  return {
    actionMenuItems,

    bulkModalConfig,

    handleBulkDelete,

    handleBulkAssignPriority,

    handleBulkPriorityCSVUpload,

    handleBulkSuccess,
  };
}