import { useState, useMemo, useCallback, useEffect } from "react";
import {
  AlertCircle, RefreshCw, TrashIcon, Search,
  AlertTriangle, Upload, Wrench, Clock
} from "lucide-react";
import { useDocumentTitle } from "../../Hooks/useDocumentTitle";
import { useSearchParams, useNavigate } from "react-router-dom";
import SearchBar from "../shared/SearchBar";
import ActionButtons from "../shared/ActionButtons";
import ActionDropdown from "../shared/MenuDropdown";
import { getUptimeDuration } from "../Utilities/getUptimeDuration";
import { formatDurationString } from "../Utilities/formatDurationString";
import DataTable from "../table/DataTable";
import PageWrapper from "../Utilities/PageWrapper";
import BulkActionModal from "../shared/BulkActionModal";
import { toast } from "react-toastify";
import {
  useGetDevicesQuery,
  useDeleteDeviceMutation,
  useAssignPriorityMutation,
  useCsvUploadMutation,
  useSetMaintenanceModeMutation,
} from "../../redux/devicesApiSlice";
import RenderIfAllowed from "../shared/RenderIfAllowed";
import { PRIORITY_CONFIG } from "../Utilities/priority_config";

/* ================= CONSTANTS ================= */

const TABLE_CONFIG = {
  columns: [
    { key: "select",      width: "w-[8%]",  sortable: false, header: "SELECT",           align: "text-center" },
    { key: "device_name", width: "w-[15%]", sortable: true,  header: "Device Name",      align: "text-center", sortField: "device_name" },
    { key: "os",          width: "w-[15%]", sortable: true,  header: "Operating System", align: "text-center", sortField: "os" },
    { key: "device_type", width: "w-[10%]", sortable: true,  header: "Device Type",      align: "text-center", sortField: "device_type" },
    { key: "health",      width: "w-[8%]",  sortable: true,  header: "Health",           align: "text-center", sortField: "health" },
    { key: "ip",          width: "w-[12%]", sortable: true,  header: "IP Address",       align: "text-center", sortField: "ip" },
    { key: "priority",    width: "w-[10%]", sortable: true,  header: "Priority",         align: "text-center", sortField: "priority" },
    { key: "status",      width: "w-[10%]", sortable: true,  header: "Status",           align: "text-center", sortField: "status" },
    { key: "action",      width: "w-[6%]",  sortable: false, header: "Action",           align: "text-center" },
  ],
};

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];


/* ================= PURE HELPERS ================= */

const getDisplayHealth = (device) => {
  if (device.health_status === "maintenance") return "maintenance";

  if (device.status === "Inactive") return "grey";
  return device.health_status || "grey";
};

const normalizePriority = (rawPriority) => {
  if (rawPriority === "") return "---";
  if (rawPriority === "np") return "np";
  if (!rawPriority) return "default";
  const lower = rawPriority.toLowerCase();
  if (lower.includes("p1")) return "p1";
  if (lower.includes("p2")) return "p2";
  if (lower.includes("p3")) return "p3";
  if (lower.includes("p4")) return "p4";
  return "default";
};


/* ================= COMPONENT ================= */

const DevicesList = ({ isDarkMode = true }) => {
  useDocumentTitle("Devices");
  const navigate = useNavigate();

  /* ── URL PARAMS ── */
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter     = searchParams.get("status")      || "all";
  const deviceTypeFilter = searchParams.get("device_type") || "";
  const osFilter         = searchParams.get("os")          || "";
  const priorityFilter   = searchParams.get("priority")    || "";
  const healthFilter     = searchParams.get("health")      || "all";

  /* ── STATE ── */
  const [currentPage, setCurrentPage]   = useState(Number(searchParams.get("page"))      || 1);
  const [itemsPerPage, setItemsPerPage] = useState(Number(searchParams.get("page_size")) || 10);
  const [sortStack, setSortStack]       = useState([]);
  const [searchTerm, setSearchTerm]     = useState(searchParams.get("search") || "");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);
  const [selectedRows, setSelectedRows] = useState(() => new Set());

  const [showBulkModal, setShowBulkModal]               = useState(false);
  const [showSingleDeleteModal, setShowSingleDeleteModal] = useState(false);
  const [deviceToDelete, setDeviceToDelete]             = useState(null);
  const [currentAction, setCurrentAction]               = useState("");

  /* ── RTK QUERY ── */
  const [assignPriority]     = useAssignPriorityMutation();
  const [deleteDevice]       = useDeleteDeviceMutation();
  const [setMaintenanceMode] = useSetMaintenanceModeMutation();
  const [csvUpload]          = useCsvUploadMutation();

  const { data, isLoading, isFetching, error, refetch } = useGetDevicesQuery({
    page:        currentPage,
    page_size:   itemsPerPage,
    search:      debouncedSearchTerm,
    status:      statusFilter !== "all"
      ? statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)
      : undefined,
    device_type: deviceTypeFilter || undefined,
    os:          osFilter         || undefined,
    priority:    priorityFilter   || undefined,
    health:      healthFilter !== "all" ? healthFilter : undefined,
  });

  console.log("DevicesList - API response data:", data);

  /* ── DATA EXTRACTION ── */
  const devices = useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data.results))                         return data.results;
    if (data.results && Array.isArray(data.results.devices)) return data.results.devices;
    if (Array.isArray(data.devices))                         return data.devices;
    if (Array.isArray(data))                                 return data;
    console.warn("[DevicesList] Unexpected API response structure:", data);
    return [];
  }, [data]);

  const totalCount = data?.count || 0;

  /* ── DERIVED VALUES ── */
  const pageTitle = useMemo(() => {
    switch (statusFilter) {
      case "active":   return "Active Devices";
      case "inactive": return "Inactive Devices";
      default:         return "All Devices";
    }
  }, [statusFilter]);

  const errorMessage = error?.message || error?.error || "Failed to load devices";

  /* ── SORT COMPARISON ── */
  const compareValues = useCallback((a, b, field, direction) => {
    try {
      switch (field) {
        case "os":
          return direction === "asc"
            ? (a.os || "").toLowerCase().localeCompare((b.os || "").toLowerCase())
            : (b.os || "").toLowerCase().localeCompare((a.os || "").toLowerCase());

        case "device_name":
          return direction === "asc"
            ? (a.device_name || "").toLowerCase().localeCompare((b.device_name || "").toLowerCase())
            : (b.device_name || "").toLowerCase().localeCompare((a.device_name || "").toLowerCase());

        case "device_type":
          return direction === "asc"
            ? (a.device_type || "").toLowerCase().localeCompare((b.device_type || "").toLowerCase())
            : (b.device_type || "").toLowerCase().localeCompare((a.device_type || "").toLowerCase());

        case "priority":
          return direction === "asc"
            ? (a.priority?.order ?? 0) - (b.priority?.order ?? 0)
            : (b.priority?.order ?? 0) - (a.priority?.order ?? 0);

        case "health":
          return direction === "asc"
            ? (a.health?.order ?? 0) - (b.health?.order ?? 0)
            : (b.health?.order ?? 0) - (a.health?.order ?? 0);

        case "ip": {
          const toNum = (ip) =>
            (ip || "0.0.0.0")
              .split(".")
              .reduce((acc, octet) => acc * 256 + parseInt(octet, 10), 0);
          return direction === "asc"
            ? toNum(a.ip) - toNum(b.ip)
            : toNum(b.ip) - toNum(a.ip);
        }

        case "status":
          return direction === "asc"
            ? (a.status?.order ?? 0) - (b.status?.order ?? 0)
            : (b.status?.order ?? 0) - (a.status?.order ?? 0);

        default:
          return 0;
      }
    } catch (err) {
      console.error("[DevicesList] Sort error:", err);
      return 0;
    }
  }, []);

  /* ── EFFECTS ── */
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("page",      currentPage);
    params.set("page_size", itemsPerPage);
    if (debouncedSearchTerm)       params.set("search",      debouncedSearchTerm);
    if (statusFilter !== "all")    params.set("status",      statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1));
    if (deviceTypeFilter)          params.set("device_type", deviceTypeFilter);
    if (healthFilter !== "all")    params.set("health",      healthFilter);
    if (osFilter)                  params.set("os",          osFilter);
    if (priorityFilter)            params.set("priority",    priorityFilter);
    setSearchParams(params, { replace: true });
  }, [currentPage, itemsPerPage, debouncedSearchTerm, statusFilter, healthFilter, deviceTypeFilter, osFilter, priorityFilter]);

  // Combined reset — all 3 filter changes reset to page 1
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, statusFilter, healthFilter]);

  /* ── HANDLERS ── */
  const handlePageChange = useCallback((page) => {
    const totalPages = Math.ceil(totalCount / itemsPerPage);
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  }, [totalCount, itemsPerPage]);

  const handleItemsPerPageChange = useCallback((count) => {
    setItemsPerPage(count);
    setCurrentPage(1);
  }, []);

  const handleManualRefresh = useCallback(async () => {
    try {
      setSearchTerm("");
      setDebouncedSearchTerm("");
      setSortStack([]);
      setCurrentPage(1);
      await refetch();
      toast.success("Devices data refreshed");
    } catch {
      toast.error("Failed to refresh data");
    }
  }, [refetch]);

  const handleDeleteDevice = useCallback((e, device) => {
    e.stopPropagation();
    setDeviceToDelete(device);
    setShowSingleDeleteModal(true);
  }, []);

  const handleBulkDelete = useCallback(() => {
    if (selectedRows.size === 0) return;
    setCurrentAction("delete");
    setShowBulkModal(true);
  }, [selectedRows.size]);

  const handleBulkAssignPriority = useCallback(() => {
    if (selectedRows.size === 0) return;
    setCurrentAction("priority");
    setShowBulkModal(true);
  }, [selectedRows.size]);

  const handleBulkCSVImport = useCallback(() => {
    setCurrentAction("priority_csv");
    setShowBulkModal(true);
  }, []);

  const handleCSVUpload = useCallback(async (formData) => {
    try {
      const response = await csvUpload(formData).unwrap();
      if (response.message) toast.success(response.message);
      return response;
    } catch {
      toast.error("CSV upload failed");
      throw new Error("CSV upload failed");
    }
  }, [csvUpload]);

  const handleBulkSuccess = useCallback(() => {
    setSelectedRows(new Set());
    setShowBulkModal(false);
    setCurrentAction("");
    setCurrentPage(1);
  }, []);

  const handleSetMaintenance = useCallback(() => {
    if (selectedRows.size === 0) return;
    setCurrentAction("maintenance");
    setShowBulkModal(true);
  }, [selectedRows.size]);

  const handleDisableMaintenance = useCallback(async (device) => {
    try {
      const response = await setMaintenanceMode({
        agent_uuid:        device.id,
        maintenance_mode:  false,
        maintenance_start: null,
        maintenance_end:   null,
      }).unwrap();
      toast.success(response?.message || "Maintenance disabled");
    } catch (err) {
      toast.error(err?.data?.message || "Failed to disable maintenance");
    }
  }, [setMaintenanceMode]);

  const handleCheckboxChange = useCallback((e, deviceId) => {
    e.stopPropagation();
    setSelectedRows((prev) => {
      const next = new Set(prev);
      next.has(deviceId) ? next.delete(deviceId) : next.add(deviceId);
      return next;
    });
  }, []);

  const clearSearch = useCallback(() => {
    setSearchTerm("");
    setDebouncedSearchTerm("");
    setCurrentPage(1);
    navigate("/devices");
  }, [navigate]);

  const toggleSort = useCallback((field) => {
    setSortStack((prev) => {
      const existing = prev.find((s) => s.field === field);
      if (existing) {
        return existing.direction === "asc"
          ? prev.map((s) => s.field === field ? { ...s, direction: "desc" } : s)
          : prev.filter((s) => s.field !== field);
      }
      return [...prev, { field, direction: "asc" }];
    });
  }, []);

  const handleRowClick = useCallback((id) => {
    if (id) navigate(`/devices/${id}`);
  }, [navigate]);

  /* ── ACTION MENU ITEMS ── */
  const actionMenuItems = useMemo(() => [
    { id: "maintenance", label: "Set Maintenance",                   onClick: handleSetMaintenance,     variant: "primary",   icon: Wrench,        disabled: selectedRows.size === 0 },
    { id: "priority",    label: "Assign Priority",                   onClick: handleBulkAssignPriority, variant: "primary",   icon: AlertTriangle, disabled: selectedRows.size === 0 },
    { id: "csv",         label: "Import CSV for Assigning Priority", onClick: handleBulkCSVImport,      variant: "secondary", icon: Upload },
    { id: "delete",      label: "Delete Selected",                   onClick: handleBulkDelete,         variant: "danger",    icon: TrashIcon,     disabled: selectedRows.size === 0 },
  ], [handleSetMaintenance, handleBulkAssignPriority, handleBulkCSVImport, handleBulkDelete, selectedRows.size]);

  /* ── PROCESSED ROWS ── */
  const processedRows = useMemo(() => {
    if (!Array.isArray(devices)) return [];

    const mappedRows = devices.map((device) => {
      const priorityKey = normalizePriority(device.priority);
      const fallbackPriority = {
        label: priorityKey === "np" ? "NP" : "---",
        color: isDarkMode ? "#9CA3AF" : "#6B7280",
        bg:    isDarkMode ? "#1F2937" : "#F9FAFB",
        text:  "",
        order: 0,
      };
      const priorityDisplay = (priorityKey === "---" || priorityKey === "np")
        ? fallbackPriority
        : (PRIORITY_CONFIG[priorityKey] || fallbackPriority);


      const baseStatus             = device.status?.toLowerCase() === "active" ? "Active" : "Inactive";
      const inImmediateMaintenance = device.maintenance_mode === true;
      const isScheduled =
        !inImmediateMaintenance &&
        device.maintenance_start &&
        device.maintenance_end &&
        new Date(device.maintenance_start) <= new Date() &&
        new Date() <= new Date(device.maintenance_end);

      let timeRemaining = null;
      if (device.maintenance_end) {
        const diffMs = new Date(device.maintenance_end) - new Date();
        if (diffMs > 0) {
          const hours   = Math.floor(diffMs / (1000 * 60 * 60));
          const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
          timeRemaining = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
        }
      }

      return {
        id:          device.uuid,
        os:          device.os         || "---",
        os_version:  device.os_version || "",
        device_name: device.hostname   || "---",
        device_type: device.device?.dev_phy_vm || "---",
        ip:          device.device?.ip_address || "---",
        health: getDisplayHealth(device),
        priority:    priorityDisplay,
        statusLabel: device.status || "Unknown",
        isActive:    device.status || "Unknown",
        uptime: (() => {
          if (device.status === "Active" && device.uptime_started_at)
            return getUptimeDuration(device.uptime_started_at);
          if (device.status !== "Active" && device.last_uptime_duration)
            return formatDurationString(device.last_uptime_duration);
          return "---";
        })(),
        status: {
          label:         baseStatus,
          icon:          inImmediateMaintenance ? Wrench : null,
          clockIcon:     isScheduled ? Clock : null,
          timeRemaining,
          color:      baseStatus === "Active"
            ? (isDarkMode ? "#10B981" : "#059669")
            : (isDarkMode ? "#EF4444" : "#DC2626"),
          iconColor:  isDarkMode ? "#FBBF24" : "#D97706",
          clockColor: isDarkMode ? "#93C5FD" : "#2563EB",
          order: baseStatus === "Active" ? 1 : 0,
        },
      };
    });

    if (sortStack.length === 0) return mappedRows;
    return [...mappedRows].sort((a, b) => {
      for (const { field, direction } of sortStack) {
        const result = compareValues(a, b, field, direction);
        if (result !== 0) return result;
      }
      return 0;
    });
  }, [devices, sortStack, compareValues, isDarkMode]);

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const handleSelectAll = useCallback((e) => {
    if (e.target.checked) setSelectedRows(new Set(processedRows.map((r) => r.id)));
    else                  setSelectedRows(new Set());
  }, [processedRows]);

  const allSelected  = processedRows.length > 0 && selectedRows.size === processedRows.length;
  const someSelected = selectedRows.size > 0 && selectedRows.size < processedRows.length;

  const hasActiveFilters = useMemo(
    () => Boolean(debouncedSearchTerm) || statusFilter !== "all" || healthFilter !== "all",
    [debouncedSearchTerm, statusFilter, healthFilter]
  );

  /* ── BULK MODAL CONFIG ── */
  const bulkModalConfig = useMemo(() => {
    switch (currentAction) {
      case "maintenance":
        return {
          actionType:       "maintenance",
          title:            "Set Maintenance Mode",
          message:          `Set ${selectedRows.size} device(s) to maintenance mode`,
          icon:             Wrench,
          iconColor:        isDarkMode ? "#10B981" : "#059669",
          itemLabel:        "Selected Devices",
          itemUnit:         "Device(s)",
          showRadioOptions: true,
          radioOptions: [
            { label: "Immediate", value: "immediate" },
            { label: "Scheduled", value: "scheduled" },
          ],
          showDateRange:    true,
          showDatePicker:   true,
          requireSelection: true,
          buttonText:       "Set Maintenance",
          buttonColor:      "green",
          processingText:   "Setting maintenance...",
          onAction: async (deviceIds, maintenanceValue, startDate, endDate, maintenanceEnd) => {
  try {
    if (maintenanceValue === "immediate" && !maintenanceEnd) {
      toast.error("Please select a duration (3H / 6H / 24H)");
      return;
    }

    const buildEntry = (device) => ({
      agent_uuid:       typeof device === "object" ? device.id : device,
      maintenance_mode: maintenanceValue === "immediate",
      ...(maintenanceValue === "immediate" && maintenanceEnd && { maintenance_end: maintenanceEnd }),
      ...(maintenanceValue === "scheduled" && { maintenance_start: startDate, maintenance_end: endDate }),
    });

    const payload = deviceIds.length === 1
      ? buildEntry(deviceIds[0])
      : deviceIds.map(buildEntry);

    const response = await setMaintenanceMode(payload).unwrap();

// Handle partial errors
if (response?.errors?.length > 0) {
  const alreadyInMaintenance = response.errors.filter(
    (e) => typeof e === "object" && e.already_in_maintenance
  );
  const otherErrors = response.errors.filter(
    (e) => typeof e === "object" ? !e.already_in_maintenance : true
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

// ✅ FIX — always show success toast if no errors or some updated
if (!response?.errors?.length || response?.updated?.length > 0) {
  toast.success(response?.message);
}

  } catch (err) {
    const errData = err?.data;

    // ✅ ADD: Handle single device 409
    if (err?.status === 409 && errData?.already_in_maintenance) {
      const start = errData.maintenance_start
        ? new Date(errData.maintenance_start).toLocaleString()
        : "N/A";
      const end = errData.maintenance_end
        ? new Date(errData.maintenance_end).toLocaleString()
        : "Indefinite";
      toast.warning(
        `⚠️ ${errData.error} — Window: ${start} → ${end}`,
        { autoClose: 7000 }
      );
      return; // ← don't throw, modal closes cleanly
    }

    toast.error(errData?.message || errData?.error || "Failed to set maintenance");
    throw err;
  }
},
        };

      case "delete":
        return {
          title:               "Delete Devices",
          message:             `Are you sure you want to delete ${selectedRows.size} device(s)? This action cannot be undone.`,
          icon:                TrashIcon,
          iconColor:           isDarkMode ? "#F87171" : "#EF4444",
          itemLabel:           "Selected Devices",
          itemUnit:            "Device(s)",
          dropdownLabel:       "Confirm Deletion",
          dropdownPlaceholder: "Select an option",
          showDropdown:        true,
          requireSelection:    true,
          cancelValue:         "false",
          options: [
            { value: "true",  label: "Yes" },
            { value: "false", label: "No" },
          ],
          buttonText:     "Delete Devices",
          buttonColor:    "red",
          processingText: "Deleting...",
          onAction: async (deviceIds, selectedValue) => {
            if (selectedValue !== "true") return;
            try {
              await deleteDevice({ uuid: deviceIds }).unwrap();
              toast.success(`Successfully deleted ${deviceIds.length} device(s)`);
            } catch (err) {
              toast.error(err?.data?.message || err?.message || "Failed to delete devices");
              throw err;
            }
          },
        };

      case "priority":
        return {
          title:               "Assign Priority to Devices",
          message:             `Assign priority level to ${selectedRows.size} device(s)`,
          icon:                AlertTriangle,
          iconColor:           isDarkMode ? "#3B82F6" : "#2563EB",
          itemLabel:           "Selected Devices",
          itemUnit:            "Device(s)",
          dropdownLabel:       "Select Priority",
          dropdownPlaceholder: "Choose priority level",
          showDropdown:        true,
          requireSelection:    true,
          options: [
            { value: "p1", label: "Priority 1 (Critical)" },
            { value: "p2", label: "Priority 2 (High)"     },
            { value: "p3", label: "Priority 3 (Medium)"   },
            { value: "p4", label: "Priority 4 (Low)"      },
            { value: "np", label: "No Priority (Default)" },
          ],
          buttonText:     "Assign Priority",
          buttonColor:    "blue",
          processingText: "Assigning priority...",
          onAction: async (deviceIds, priorityValue) => {
            const payload = deviceIds.length === 1
              ? { agent_uuid: deviceIds[0], priority: priorityValue }
              : deviceIds.map((id) => ({ agent_uuid: id, priority: priorityValue }));
            await assignPriority(payload).unwrap();
            toast.success(`Assigned ${priorityValue} priority to ${deviceIds.length} devices`);
          },
        };

      case "priority_csv":
        return {
          title:              "Bulk Priority Assignment via CSV",
          message:            "Upload CSV to assign priorities to devices. Devices will be matched by IP address.",
          icon:               Upload,
          iconColor:          isDarkMode ? "#60A5FA" : "#2563EB",
          actionType:         "priority_csv",
          uploadType:         "priority",
          showFileUpload:     true,
          buttonText:         "Upload CSV",
          buttonColor:        "blue",
          processingText:     "Processing CSV...",
          onPriorityCSVImport: handleCSVUpload,
        };

      default:
        return null;
    }
  }, [currentAction, selectedRows.size, isDarkMode, assignPriority, deleteDevice, handleCSVUpload, setMaintenanceMode]);

  const singleDeleteConfig = useMemo(() => {
    if (!deviceToDelete) return null;
    return {
      title:               "Delete Device",
      message:             `Are you sure you want to delete "${deviceToDelete.device_name || "this device"}"? This action cannot be undone.`,
      icon:                TrashIcon,
      iconColor:           isDarkMode ? "#F87171" : "#EF4444",
      itemLabel:           "Device",
      itemUnit:            "Device",
      dropdownLabel:       "Confirm Deletion",
      dropdownPlaceholder: "Select an option",
      showDropdown:        true,
      requireSelection:    true,
      cancelValue:         "false",
      options: [
        { value: "true",  label: "Yes" },
        { value: "false", label: "No" },
      ],
      buttonText:     "Delete Device",
      buttonColor:    "red",
      processingText: "Deleting...",
      onAction: async (deviceIds, selectedValue) => {
        if (selectedValue !== "true") return;
        try {
          await deleteDevice({ uuid: deviceIds[0] }).unwrap();
          toast.success(`Successfully deleted ${deviceToDelete.device_name || "device"}`);
        } catch (err) {
          toast.error(err?.data?.message || err?.message || "Failed to delete device");
          throw err;
        }
      },
    };
  }, [deviceToDelete, isDarkMode, deleteDevice]);

  const handleSingleDeleteSuccess = useCallback(() => {
    setShowSingleDeleteModal(false);
    setDeviceToDelete(null);
    setCurrentPage(1);
  }, []);


  /* ================= UI ================= */

  return (
    <PageWrapper isDarkMode={isDarkMode}>
      <div className="space-y-4 sm:space-y-6">
        <div
          className="rounded-lg shadow-md overflow-hidden"
          style={{
            backgroundColor: isDarkMode ? "#1F2937" : "#FFFFFF",
            border: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB",
          }}
        >
          {/* Header Bar */}
          <div
            className="p-3 sm:p-4 flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3 border-b"
            style={{
              borderColor:     isDarkMode ? "#374151" : "#E5E7EB",
              backgroundColor: isDarkMode ? "#1F2937" : "#FFFFFF",
            }}
          >
            {/* Left: Title + Refresh + Selected count */}
            <div className="flex items-center gap-3 flex-wrap">
              <span
                className="text-base sm:text-lg font-semibold"
                style={{ color: isDarkMode ? "#FFF" : "#525759" }}
              >
                {pageTitle}
              </span>
              <ActionButtons
                onRefresh={handleManualRefresh}
                isRefreshing={isFetching}
                isDarkMode={isDarkMode}
                refreshButtonTitle="Refresh Devices Data"
                refreshIcon={RefreshCw}
              />
              {selectedRows.size > 0 && (
                <span
                  className="px-2 py-0.5 rounded-full text-sm font-normal"
                  style={{
                    color:           isDarkMode ? "#9CA3AF" : "#6B7280",
                    backgroundColor: isDarkMode ? "rgba(55,65,81,0.5)" : "#F3F4F6",
                  }}
                >
                  ({selectedRows.size} selected)
                </span>
              )}
            </div>

            {/* Right: Action Dropdown + SearchBar */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <RenderIfAllowed module="monitoring" action="delete">
                <ActionDropdown
                  menuItems={actionMenuItems}
                  isDarkMode={isDarkMode}
                  buttonLabel="Action"
                />
              </RenderIfAllowed>
              <div className="flex-1 sm:flex-none">
                <SearchBar
                  searchTerm={searchTerm}
                  onSearchChange={setSearchTerm}
                  searchPlaceholder="Search devices..."
                  isDarkMode={isDarkMode}
                  className="border-0 p-0"
                />
              </div>
            </div>
          </div>

          {/* Body */}
          {isLoading ? (
            <div className="text-center py-12" style={{ color: isDarkMode ? "#D1D5DB" : "#6B7280" }}>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
              <p className="text-sm">Loading devices...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12" style={{ color: isDarkMode ? "#D1D5DB" : "#6B7280" }}>
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500 opacity-50" />
              <h3 className="text-lg font-semibold mb-2" style={{ color: isDarkMode ? "#FFF" : "#374151" }}>
                {errorMessage}
              </h3>
              <button
                onClick={refetch}
                className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : processedRows.length === 0 ? (
            <div className="text-center py-12" style={{ color: isDarkMode ? "#D1D5DB" : "#6B7280" }}>
              <Search
                className="w-16 h-16 mx-auto mb-6 opacity-30"
                style={{ color: isDarkMode ? "#FFF" : "#374151" }}
              />
              <h3 className="text-lg font-semibold mb-2" style={{ color: isDarkMode ? "#FFF" : "#374151" }}>
                No Devices Found
              </h3>
              <p className="text-sm mb-4 max-w-md mx-auto">
                {hasActiveFilters
                  ? `No ${statusFilter !== "all" ? statusFilter : ""} devices match your search criteria.`
                  : "No devices have been registered yet."}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearSearch}
                  className="px-4 py-2 text-sm bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          ) : (
            <DataTable
              rows={processedRows}
              tableConfig={TABLE_CONFIG}
              sortStack={sortStack}
              selectedRows={selectedRows}
              isDarkMode={isDarkMode}
              onSort={toggleSort}
              onCheckboxChange={handleCheckboxChange}
              onSelectAll={handleSelectAll}
              onRowClick={handleRowClick}
              onDeleteDevice={handleDeleteDevice}
              allSelected={allSelected}
              someSelected={someSelected}
              currentPage={currentPage}
              totalPages={totalPages}
              itemsPerPage={itemsPerPage}
              itemsPerPageOptions={ITEMS_PER_PAGE_OPTIONS}
              onPageChange={handlePageChange}
              onItemsPerPageChange={handleItemsPerPageChange}
              totalCount={totalCount}
              onDisableMaintenance={handleDisableMaintenance}
              tableTitle={pageTitle}
              moduleName="monitoring"
            />
          )}
        </div>
      </div>

      {/* Bulk Modal */}
      {showBulkModal && bulkModalConfig && (
        <BulkActionModal
          show={showBulkModal}
          onHide={() => { setShowBulkModal(false); setCurrentAction(""); }}
          selectedItems={
            currentAction === "maintenance"
              ? Array.from(selectedRows).map((id) => processedRows.find((r) => r.id === id)).filter(Boolean)
              : Array.from(selectedRows)
          }
          isDarkMode={isDarkMode}
          config={bulkModalConfig}
          onSuccess={handleBulkSuccess}
          onPriorityCSVImport={handleCSVUpload}
        />
      )}

      {/* Single Delete Modal */}
      {deviceToDelete && (
        <BulkActionModal
          show={showSingleDeleteModal}
          onHide={() => { setShowSingleDeleteModal(false); setDeviceToDelete(null); }}
          selectedItems={[deviceToDelete.id]}
          isDarkMode={isDarkMode}
          config={singleDeleteConfig}
          onSuccess={handleSingleDeleteSuccess}
        />
      )}
    </PageWrapper>
  );
};


export default DevicesList;