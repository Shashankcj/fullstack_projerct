import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { Download } from "lucide-react";
import backendApi from "../../../../api/backendAxiosInstance";

import { useTablePagination } from "../../../../Hooks/table/useTablePagination";
import { useDebouncedSearch } from "../../../../Hooks/table/useDebouncedSearch";
import { useTableFilters } from "../../../../Hooks/table/useTableFilters";
import { useURLSync } from "../../../../Hooks/table/useURLSync";
import { useDocumentTitle } from "../../../../Hooks/useDocumentTitle";

import PageWrapper from "../../../Utilities/PageWrapper";
import TablePageShell from "../../../table/TablePageShell";
import DataTableToolbar from "../../../table/DataTableToolbar";
import DataTable from "../../../table/DataTable";
import TableStateWrapper from "../../../table/TableStateWrapper";
import LogsModal from "../components/LogsModal";
import FilterDropdown from "../../../shared/FilterDropdown";

const EVENT_TYPE_DISPLAY = {
  MON_DATA: "Monitoring Data",
  INFO: "Info",
  ALERT: "Alert",
  ERROR: "Error",
  UPDATE: "Update",
  DELETE: "Delete",
  CREATE: "Create",
  CONNECTION: "Connection",
  DISCONNECT: "Disconnect",
};

const FILTER_CONFIG = [
  { key: "device", label: "Device", type: "select", optionsKey: "devices" },
  { key: "eventType", label: "Event Type", type: "select", optionsKey: "eventTypes" },
  { key: "component", label: "Component", type: "select", optionsKey: "components" },
  { key: "timeRange", label: "Date Range", type: "dateRange" },
];

const EMPTY_FILTERS = {
  device: "",
  eventType: "",
  component: "",
  timeRangeFrom: "",
  timeRangeTo: "",
};


function EventLogs({ isDarkMode = false }) {
  useDocumentTitle("Event Logs");

  const [searchParams] = useSearchParams();

  const {
    currentPage,
    itemsPerPage,
    setCurrentPage,
    handlePageChange,
    handleItemsPerPageChange,
    resetPage,
  } = useTablePagination({
    initialPage: Number(searchParams.get("page")) || 1,
    initialPageSize: Number(searchParams.get("page_size")) || 10,
  });

  const {
    searchTerm,
    debouncedTerm,
    setSearchTerm,
    clearSearch,
  } = useDebouncedSearch({
    initialValue: searchParams.get("search") || "",
    delay: 500,
    onSearch: resetPage,
  });

  const {
    filters,
    filterOptions,
    updateFilters,
    resetFilters,
    loadFilterOptions,
  } = useTableFilters({
    initialFilters: {
      device: searchParams.get("device") || "",
      eventType: searchParams.get("event_type") || "",
      component: searchParams.get("component") || "",
      timeRangeFrom: searchParams.get("from") || "",
      timeRangeTo: searchParams.get("to") || "",
    },
    onFilterChange: resetPage,
  });

  const hasActiveFilters = useMemo(
    () => Object.values(filters).some(Boolean) || Boolean(debouncedTerm),
    [filters, debouncedTerm]
  );

  useURLSync({
    params: {
      page: currentPage,
      page_size: itemsPerPage,
      search: debouncedTerm,
      device: filters.device,
      event_type: filters.eventType,
      component: filters.component,
      from: filters.timeRangeFrom,
      to: filters.timeRangeTo,
    },
    defaults: { page: 1, page_size: 10 },
  });

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [totalCount, setTotalCount] = useState(0);

  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchEventLogs = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        page_size: String(itemsPerPage),
      });

      if (debouncedTerm) params.append("search", debouncedTerm);
      if (filters.device) params.append("device_name", filters.device);
      if (filters.eventType) params.append("event_type", filters.eventType);
      if (filters.component) params.append("component_type", filters.component);
      if (filters.timeRangeFrom) params.append("start_date", filters.timeRangeFrom);
      if (filters.timeRangeTo) params.append("end_date", filters.timeRangeTo);

      const res = await backendApi.get(`/get_eventlogs?${params.toString()}`);
      setData(res.data?.results?.events || []);
      setTotalCount(res.data?.count || 0);
    } catch (err) {
      console.error("[EventLogs] fetchEventLogs error:", err);
      setError("Failed to load event logs");
      setData([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, debouncedTerm, filters]);

  useEffect(() => {
    fetchEventLogs();
  }, [fetchEventLogs]);

  const fetchFilterOptions = useCallback(async () => {
    try {
      const res = await backendApi.get("/get_eventlogs?page=1&page_size=1000");
      const events = res.data?.results?.events || [];

      return {
        devices: [...new Set(events.map((r) => r.device_name))].filter(Boolean),
        eventTypes: [...new Set(events.map((r) => r.event_type))].filter(Boolean),
        components: [...new Set(events.map((r) => r.component_type))].filter(Boolean),
      };
    } catch (err) {
      console.error("[EventLogs] fetchFilterOptions error:", err);
      return {
        devices: [],
        eventTypes: [],
        components: [],
      };
    }
  }, []);

  const handleRefresh = useCallback(() => {
    resetFilters(EMPTY_FILTERS);
    clearSearch();
    setCurrentPage(1);
    toast.success("Event logs refreshed successfully");
  }, [resetFilters, clearSearch, setCurrentPage]);

  const handleClearAll = useCallback(() => {
    resetFilters(EMPTY_FILTERS);
    clearSearch();
    setCurrentPage(1);
  }, [resetFilters, clearSearch, setCurrentPage]);

  const handleRowClick = useCallback((event) => {
    setSelectedEvent(event);
    setIsModalOpen(true);
  }, []);

  const handleDownload = useCallback(async () => {
    try {
      const params = new URLSearchParams();

      if (debouncedTerm) params.append("search", debouncedTerm);
      if (filters.device) params.append("device_name", filters.device);
      if (filters.eventType) params.append("event_type", filters.eventType);
      if (filters.component) params.append("component_type", filters.component);
      if (filters.timeRangeFrom) params.append("start_date", filters.timeRangeFrom);
      if (filters.timeRangeTo) params.append("end_date", filters.timeRangeTo);

      const response = await backendApi.get(
        `/export_eventlogs?${params.toString()}`,
        { responseType: "blob" }
      );

      const blob = new Blob([response.data], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `event_logs_export_${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Event logs exported successfully");
    } catch (err) {
      console.error("[EventLogs] Export failed:", err);
      toast.error("Failed to export event logs");
    }
  }, [debouncedTerm, filters]);

  const columns = useMemo(
    () => [
      {
        header: "Time",
        accessorKey: "created_at",
        cell: ({ row }) => new Date(row.original.created_at).toLocaleString(),
      },
      {
        header: "Device",
        accessorKey: "device_name",
        cell: ({ row }) => row.original.device_name || "-",
      },
      {
        header: "Event Type",
        accessorKey: "event_type",
        cell: ({ row }) =>
          EVENT_TYPE_DISPLAY[row.original.event_type] || row.original.event_type || "-",
      },
      {
        header: "Component",
        accessorKey: "component_type",
        cell: ({ row }) => row.original.component_type || "-",
      },
      {
        header: "Description",
        accessorKey: "description",
        cell: ({ row }) => row.original.description || "-",
      },
    ],
    []
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));

  return (
    <PageWrapper isDarkMode={isDarkMode}>
      <div className="space-y-6">
        <TablePageShell isDarkMode={isDarkMode}>
          <div
            className="p-3 sm:p-4"
          >
            <DataTableToolbar
              title="Event Logs"
              count={totalCount}
              countLabel="events"
              onRefresh={handleRefresh}
              isRefreshing={loading}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              searchPlaceholder="Search event logs..."
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={handleItemsPerPageChange}
              isDarkMode={isDarkMode}
              isLoading={loading}
              rightSlot={
                <div className="flex items-center gap-3">
                  <FilterDropdown
                    filters={filters}
                    filterConfig={FILTER_CONFIG}
                    filterOptions={filterOptions}
                    onFilterOptionsLoad={() => loadFilterOptions(fetchFilterOptions)}
                    hasActiveFilters={hasActiveFilters}
                    onFiltersChange={updateFilters}
                    isDarkMode={isDarkMode}
                  />
                  <button
                    onClick={handleDownload}
                    className={`p-2 rounded-lg transition-all duration-200 shadow-sm flex items-center justify-center hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                      isDarkMode
                        ? "bg-blue-900/20 text-blue-400 hover:bg-blue-900/40 hover:text-blue-300 border border-blue-900/30"
                        : "bg-blue-100/80 text-blue-600 hover:bg-blue-200 hover:text-blue-700 border border-blue-200/50"
                    }`}
                    title="Download Event Logs"
                    aria-label="Download Event Logs"
                  >
                    <Download className="w-5 h-5 flex-shrink-0" />
                  </button>
                </div>
              }
            />
          </div>

          <TableStateWrapper
            isLoading={loading}
            isError={!!error}
            errorMessage={error}
            isEmpty={data.length === 0}
            hasActiveFilters={hasActiveFilters}
            emptyTitle="No Event Logs Found"
            onRetry={fetchEventLogs}
            onClearFilters={handleClearAll}
            isDarkMode={isDarkMode}
            loadingText="Loading event logs..."
          >
            <DataTable
              data={data}
              columns={columns}
              isDarkMode={isDarkMode}
              isLoading={loading}
              getRowId={(row) => row.id ?? row.uuid}
              page={currentPage}
              totalPages={totalPages}
              rowCount={totalCount}
              onPageChange={(page) => handlePageChange(page, totalPages)}
              itemsPerPage={itemsPerPage}
              onRowClick={handleRowClick}
              sorting={[]}
              onSortingChange={() => {}}
              globalFilter={searchTerm}
              onGlobalFilterChange={setSearchTerm}
            />
          </TableStateWrapper>
        </TablePageShell>

        <LogsModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedEvent(null);
          }}
          data={selectedEvent}
          isDarkMode={isDarkMode}
          type="event"
          title="Event Details"
        />
      </div>
    </PageWrapper>
  );
}

export default EventLogs;