// // ✅ Fix #1 — removed `import React`, added useCallback + useMemo
// import { useState, useEffect, useCallback, useMemo } from "react";
// import { toast } from "react-toastify";
// // ✅ Fix #11 — removed useNavigate (never used)
// import { useSearchParams } from "react-router-dom";
// import {
//   useGetAuditLogsQuery,
//   useLazyGetFilterOptionsQuery,
//   // ✅ Fix #2 — updated to mutation hook
//   useExportAuditLogsMutation,
// } from "../../redux/auditLogsApi";
// import { RefreshCw, Download, Loader2 } from "lucide-react";
// import SearchBar      from "../SearchBar";
// import DataTableUI    from "../DataTableUI";
// import AuditLogModal  from "./AuditLogModal";
// import FilterDropdown from "../tables/FilterDropdown";
// import "../../components/index.css";
// import ActionButtons      from "../ActionButtons";
// import RenderIfAllowed    from "../Utilities/RenderIfAllowed";
// import PageWrapper        from "../Utilities/PageWrapper";


// /* ================= STATIC CONSTANTS — outside component ================= */
// // ✅ Fix #3 — TABLE_HEADERS, filterConfig, SEVERITY_COLORS moved outside
// // ✅ Fix #4 — ITEMS_PER_PAGE_OPTIONS moved outside

// const TABLE_HEADERS = [
//   { key: "timestamp",        label: "DATE",        className: "w-32" },
//   { key: "user",             label: "USER",        className: "w-24" },
//   { key: "action",           label: "ACTION",      className: "w-28" },
//   { key: "model_name",       label: "RESOURCE",    className: "w-28" },
//   { key: "ip",               label: "IP",          className: "w-32" },
//   { key: "severity_display", label: "SEVERITY",    className: "w-24" },
//   { key: "description",      label: "DESCRIPTION"                    },
// ];

// const FILTER_CONFIG = [
//   { key: "user",     label: "User",       optionsKey: "users",      type: "select"    },
//   { key: "action",   label: "Action",     optionsKey: "actions",    type: "select"    },
//   { key: "severity", label: "Severity",   optionsKey: "severities", type: "select"    },
//   { key: "resource", label: "Resource",   optionsKey: "resources",  type: "select"    },
//   { key: "date",     label: "Date Range",                            type: "dateRange" },
// ];

// const SEVERITY_COLORS = {
//   Critical: "text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400",
//   Delete:   "text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400",
//   Create:   "text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400",
//   Update:   "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400",
//   Success:  "text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400",
//   Warning:  "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400",
//   Info:     "text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400",
// };

// const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

// const EMPTY_FILTERS = {
//   user:     "",
//   action:   "",
//   resource: "",
//   severity: "",
//   dateFrom: "",
//   dateTo:   "",
// };


// /* ================= COMPONENT ================= */

// const AuditLogs = ({ isDarkMode = false }) => {

//   /* -------------------- ROUTER -------------------- */
//   const [searchParams, setSearchParams] = useSearchParams();


//   /* -------------------- STATE -------------------- */
//   const [selectedLog,  setSelectedLog]  = useState(null);
//   const [isModalOpen,  setIsModalOpen]  = useState(false);
//   const [itemsPerPage, setItemsPerPage] = useState(10);

//   const [currentPage, setCurrentPage] = useState(
//     Number(searchParams.get("page")) || 1
//   );
//   const [searchTerm, setSearchTerm] = useState(
//     searchParams.get("search") || ""
//   );
//   const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);

//   const [appliedFilters, setAppliedFilters] = useState({
//     user:     searchParams.get("user")       || "",
//     action:   searchParams.get("action")     || "",
//     resource: searchParams.get("resource")   || "",
//     severity: searchParams.get("severity")   || "",
//     dateFrom: searchParams.get("start_date") || "",
//     dateTo:   searchParams.get("end_date")   || "",
//   });

//   const [filterOptions, setFilterOptions] = useState({
//     users:      [],
//     actions:    [],
//     resources:  [],
//     severities: [],
//   });


//   /* -------------------- RTK QUERY HOOKS -------------------- */
//   const [triggerGetFilterOptions]                      = useLazyGetFilterOptionsQuery();
//   // ✅ Fix #2 — mutation hook with loading state
//   const [triggerExport, { isLoading: isExporting }]   = useExportAuditLogsMutation();

//   const { data, isLoading, isFetching, refetch } = useGetAuditLogsQuery(
//     {
//       page:       currentPage,
//       page_size:  itemsPerPage,
//       user:       appliedFilters.user,
//       action:     appliedFilters.action,
//       model_name: appliedFilters.resource,
//       severity:   appliedFilters.severity,
//       start_date: appliedFilters.dateFrom,
//       end_date:   appliedFilters.dateTo,
//       search:     debouncedSearchTerm,
//     },
//     { refetchOnMountOrArgChange: true }
//   );

//   const logs       = data?.audit_logs || [];
//   const totalCount = data?.count      || 0;
//   const totalPages = Math.ceil(totalCount / itemsPerPage) || 1;


//   /* -------------------- DERIVED STATE -------------------- */
//   // ✅ Fix #9 — useMemo
//   const hasActiveFilters = useMemo(() =>
//     Object.values(appliedFilters).some(Boolean) || Boolean(debouncedSearchTerm),
//   [appliedFilters, debouncedSearchTerm]);


//   /* -------------------- EFFECTS -------------------- */

//   // Debounce search term
//   useEffect(() => {
//     const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
//     return () => clearTimeout(timer);
//   }, [searchTerm]);

//   // Reset to page 1 when debounced search changes
//   useEffect(() => {
//     setCurrentPage(1);
//   }, [debouncedSearchTerm]);

//   // ✅ Fix #10 — added itemsPerPage to deps
//   useEffect(() => {
//     const params = new URLSearchParams();
//     params.set("page",      currentPage);
//     params.set("page_size", itemsPerPage);
//     if (debouncedSearchTerm)       params.set("search",     debouncedSearchTerm);
//     if (appliedFilters.user)       params.set("user",       appliedFilters.user);
//     if (appliedFilters.action)     params.set("action",     appliedFilters.action);
//     if (appliedFilters.resource)   params.set("resource",   appliedFilters.resource);
//     if (appliedFilters.severity)   params.set("severity",   appliedFilters.severity);
//     if (appliedFilters.dateFrom)   params.set("start_date", appliedFilters.dateFrom);
//     if (appliedFilters.dateTo)     params.set("end_date",   appliedFilters.dateTo);
//     setSearchParams(params, { replace: true });
//   }, [currentPage, itemsPerPage, debouncedSearchTerm, appliedFilters, setSearchParams]);


//   /* -------------------- HANDLERS -------------------- */
//   // ✅ Fix #5 — all handlers useCallback
//   // ✅ Fix #8 — namespaced console.error

//   const handleFilterOptionsLoad = useCallback(async () => {
//     try {
//       const result = await triggerGetFilterOptions().unwrap();
//       const clean  = (arr) =>
//         (arr || []).filter((item) => item && String(item).trim() !== "");
//       const cleaned = {
//         users:      clean(result.users),
//         actions:    clean(result.actions),
//         resources:  clean(result.resources),
//         severities: clean(result.severities),
//       };
//       setFilterOptions(cleaned);
//       return cleaned;
//     } catch (error) {
//       console.error("[AuditLogs] Failed to fetch filter options:", error);
//       setFilterOptions({ users: [], actions: [], resources: [], severities: [] });
//     }
//   }, [triggerGetFilterOptions]);

//   const handleFiltersChange = useCallback((newFilters) => {
//     setAppliedFilters(newFilters);
//     setCurrentPage(1);
//   }, []);

//  // ✅ FIXED
// const handleRefresh = useCallback(() => {
//   const filtersAlreadyEmpty =
//     !Object.values(appliedFilters).some(Boolean) && !debouncedSearchTerm && currentPage === 1;

//   setAppliedFilters(EMPTY_FILTERS);
//   setSearchTerm("");
//   setDebouncedSearchTerm("");
//   setCurrentPage(1);

//   // If nothing was active, RTK args won't change → force a fresh API call
//   if (filtersAlreadyEmpty) {
//     refetch();
//   }

//   toast.success("Audit logs refreshed successfully");
// }, [refetch, appliedFilters, debouncedSearchTerm, currentPage]);

//   const handleDownload = useCallback(async () => {
//     try {
//       const blob = await triggerExport({
//         user:       appliedFilters.user,
//         action:     appliedFilters.action,
//         model_name: appliedFilters.resource,
//         severity:   appliedFilters.severity,
//         start_date: appliedFilters.dateFrom,
//         end_date:   appliedFilters.dateTo,
//         search:     debouncedSearchTerm,
//       }).unwrap();

//       const url  = URL.createObjectURL(blob);
//       const link = document.createElement("a");
//       link.href     = url;
//       link.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
//       link.style.visibility = "hidden";
//       document.body.appendChild(link);
//       link.click();
//       document.body.removeChild(link);
//       URL.revokeObjectURL(url);  // cleanup memory
//       toast.success("Audit logs exported successfully");
//     } catch (error) {
//       console.error("[AuditLogs] Export failed:", error);
//       toast.error("Failed to export audit logs");
//     }
//   }, [triggerExport, appliedFilters, debouncedSearchTerm]);

//   const handleRowClick = useCallback((log) => {
//     setSelectedLog(log);
//     setIsModalOpen(true);
//   }, []);

//   const handlePageChange = useCallback((page) => {
//     if (page >= 1 && page <= totalPages) setCurrentPage(page);
//   }, [totalPages]);

//   const handleItemsPerPageChange = useCallback((num) => {
//     setItemsPerPage(num);
//     setCurrentPage(1);
//   }, []);

//   const handleModalClose = useCallback(() => {
//     setIsModalOpen(false);
//   }, []);


//   /* -------------------- CELL RENDERER -------------------- */
//   // ✅ Fix #6 — useCallback with empty deps (uses only params passed in)
//   const renderCell = useCallback((item, key, formatDate, truncateText, severityColors) => {
//     switch (key) {
//       case "timestamp":
//         return <span className="whitespace-nowrap">{formatDate(item.timestamp)}</span>;
//       case "user":
//         return item.user || "---";
//       case "action":
//         return <span className="font-medium">{item.action}</span>;
//       case "model_name":
//         return item.model_name || "---";
//       case "description":
//         return (
//           <span title={item.description}>
//             {truncateText(item.description, 60)}
//           </span>
//         );
//       case "ip":
//         return item.ip || "---";
//       case "severity_display":
//         return (
//           <div className="flex items-center justify-center">
//             <span className={`px-2 py-0.5 rounded-full text-xs font-medium
//               ${severityColors[item.severity_display] || severityColors.Info}`}
//             >
//               {item.severity_display}
//             </span>
//           </div>
//         );
//       default:
//         return item[key] || "---";
//     }
//   }, []);


//   /* -------------------- RENDER -------------------- */
//   return (
//     <PageWrapper isDarkMode={isDarkMode}>
//       <div className="space-y-6">

//         {/* Header */}
//         <div className="flex items-center justify-between gap-4">

//           {/* Left: Title + Refresh + Count */}
//           <div className="flex items-center gap-3">
//             <span
//               className="text-base sm:text-lg font-semibold"
//               style={{ color: isDarkMode ? "#FFF" : "#525759" }}
//             >
//               Audit Logs
//             </span>

//             <ActionButtons
//               onRefresh={handleRefresh}
//               isRefreshing={isFetching ?? false}
//               isDarkMode={isDarkMode}
//               refreshButtonTitle="Refresh Audit Logs"
//               refreshIcon={RefreshCw}
//             />

//             <span className="inline-flex items-center justify-center px-2 py-1
//               rounded-full text-sm font-semibold leading-none
//               bg-blue-500/10 text-blue-500"
//             >
//               {totalCount} logs
//             </span>
//           </div>

//           {/* Right: Search + Download */}
//           <div className="flex items-center gap-3">
//             <SearchBar
//               searchTerm={searchTerm}
//               onSearchChange={setSearchTerm}
//               searchPlaceholder="Search Audit logs..."
//               isDarkMode={isDarkMode}
//               className="border-0 p-0"
//             />

//             <RenderIfAllowed module="audit_logs" action="read">
//               {/* ✅ Fix #12 — disabled + loading state on download button */}
//               <button
//                 onClick={handleDownload}
//                 disabled={isExporting}
//                 className={`p-2 rounded-lg transition-all duration-200 shadow-sm flex items-center
//                   justify-center hover:shadow-md focus:outline-none focus:ring-2
//                   focus:ring-offset-2 focus:ring-blue-500
//                   ${isExporting ? "opacity-50 cursor-not-allowed" : ""}
//                   ${isDarkMode
//                     ? "bg-blue-900/20 text-blue-400 hover:bg-blue-900/40 hover:text-blue-300 border border-blue-900/30"
//                     : "bg-blue-100/80 text-blue-600 hover:bg-blue-200 hover:text-blue-700 border border-blue-200/50"
//                   }`}
//                 title={isExporting ? "Exporting..." : "Download Audit Logs"}
//                 aria-label="Download Audit Logs"
//               >
//                 {isExporting
//                   ? <Loader2 className="w-5 h-5 flex-shrink-0 animate-spin" />
//                   : <Download className="w-5 h-5 flex-shrink-0" />
//                 }
//               </button>
//             </RenderIfAllowed>
//           </div>
//         </div>

//         {/* Table */}
//         <DataTableUI
//           data={logs}
//           loading={isLoading}
//           error=""
//           totalCount={totalCount}
//           title="Audit Logs"
//           tableHeaders={TABLE_HEADERS}
//           tableHeight="550px"
//           isDarkMode={isDarkMode}
//           severityColors={SEVERITY_COLORS}
//           filters={appliedFilters}
//           filterConfig={FILTER_CONFIG}
//           filterOptions={filterOptions}
//           hasActiveFilters={hasActiveFilters}
//           onFiltersChange={handleFiltersChange}
//           FilterComponent={FilterDropdown}
//           onFilterOptionsLoad={handleFilterOptionsLoad}
//           currentPage={currentPage}
//           totalPages={totalPages}
//           onPageChange={handlePageChange}
//           onRowClick={handleRowClick}
//           onRetry={refetch}
//           renderCell={renderCell}
//           itemsPerPage={itemsPerPage}
//           itemsPerPageOptions={ITEMS_PER_PAGE_OPTIONS}
//           onItemsPerPageChange={handleItemsPerPageChange}
//         />

//         <AuditLogModal
//           isOpen={isModalOpen}
//           onClose={handleModalClose}
//           log={selectedLog}
//           isDarkMode={isDarkMode}
//         />
//       </div>
//     </PageWrapper>
//   );
// };

// export default AuditLogs;


import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "react-toastify";
import { useSearchParams } from "react-router-dom";
import {
  useGetAuditLogsQuery,
  useLazyGetFilterOptionsQuery,
  useExportAuditLogsMutation,
} from "../../../../redux/auditLogsApi";
import { Download, Loader2 } from "lucide-react";

import PageWrapper from "../../../Utilities/PageWrapper";
import TablePageShell from "../../../table/TablePageShell";
import DataTableToolbar from "../../../table/DataTableToolbar";
import DataTable from "../../../table/DataTable";
import TableStateWrapper from "../../../table/TableStateWrapper";
import AuditLogModal from "../components/AuditLogModal";
import FilterDropdown from "../../../shared/FilterDropdown";
import RenderIfAllowed from "../../../shared/RenderIfAllowed";

import { useTablePagination } from "../../../../Hooks/table/useTablePagination";
import { useDebouncedSearch } from "../../../../Hooks/table/useDebouncedSearch";
import { useTableFilters } from "../../../../Hooks/table/useTableFilters";
import { useURLSync } from "../../../../Hooks/table/useURLSync";
import { useDocumentTitle } from "../../../../Hooks/useDocumentTitle";
import useAuditLogColumns from "../../../table/columns/AuditLogsColumns";

const FILTER_CONFIG = [
  { key: "user", label: "User", optionsKey: "users", type: "select" },
  { key: "action", label: "Action", optionsKey: "actions", type: "select" },
  { key: "severity", label: "Severity", optionsKey: "severities", type: "select" },
  { key: "resource", label: "Resource", optionsKey: "resources", type: "select" },
  { key: "date", label: "Date Range", type: "dateRange" },
];

const EMPTY_FILTERS = {
  user: "",
  action: "",
  resource: "",
  severity: "",
  dateFrom: "",
  dateTo: "",
};

function AuditLogs({ isDarkMode = false }) {
  useDocumentTitle("Audit Logs");

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
      user: searchParams.get("user") || "",
      action: searchParams.get("action") || "",
      resource: searchParams.get("resource") || "",
      severity: searchParams.get("severity") || "",
      dateFrom: searchParams.get("start_date") || "",
      dateTo: searchParams.get("end_date") || "",
    },
    onFilterChange: resetPage,
  });

  const hasActiveFilters = useMemo(() => {
    return Object.values(filters).some(Boolean) || Boolean(debouncedTerm);
  }, [filters, debouncedTerm]);

  useURLSync({
    params: {
      page: currentPage,
      page_size: itemsPerPage,
      search: debouncedTerm,
      user: filters.user,
      action: filters.action,
      resource: filters.resource,
      severity: filters.severity,
      start_date: filters.dateFrom,
      end_date: filters.dateTo,
    },
    defaults: { page: 1, page_size: 10 },
  });

  const [selectedLog, setSelectedLog] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [triggerGetFilterOptions] = useLazyGetFilterOptionsQuery();
  const [triggerExport, { isLoading: isExporting }] = useExportAuditLogsMutation();

  const { data, isLoading, isFetching, refetch } = useGetAuditLogsQuery(
    {
      page: currentPage,
      page_size: itemsPerPage,
      user: filters.user,
      action: filters.action,
      model_name: filters.resource,
      severity: filters.severity,
      start_date: filters.dateFrom,
      end_date: filters.dateTo,
      search: debouncedTerm,
    },
    { refetchOnMountOrArgChange: true }
  );

  const logs = data?.audit_logs || [];
  const totalCount = data?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));

  const columns = useAuditLogColumns();

  const handleFilterOptionsLoad = useCallback(async () => {
    try {
      const result = await triggerGetFilterOptions().unwrap();
      const clean = (arr) => (arr || []).filter((item) => item && String(item).trim() !== "");

      return {
        users: clean(result.users),
        actions: clean(result.actions),
        resources: clean(result.resources),
        severities: clean(result.severities),
      };
    } catch (error) {
      console.error("[AuditLogs] Failed to fetch filter options:", error);
      return { users: [], actions: [], resources: [], severities: [] };
    }
  }, [triggerGetFilterOptions]);

  const handleFiltersChange = useCallback((newFilters) => {
    updateFilters(newFilters);
    setCurrentPage(1);
  }, [updateFilters, setCurrentPage]);

  const handleRefresh = useCallback(() => {
    const filtersAlreadyEmpty =
      !Object.values(filters).some(Boolean) && !debouncedTerm && currentPage === 1;

    resetFilters(EMPTY_FILTERS);
    clearSearch();
    setCurrentPage(1);

    if (filtersAlreadyEmpty) {
      refetch();
    }

    toast.success("Audit logs refreshed successfully");
  }, [refetch, filters, debouncedTerm, currentPage, resetFilters, clearSearch, setCurrentPage]);

  const handleClearAll = useCallback(() => {
    resetFilters(EMPTY_FILTERS);
    clearSearch();
    setCurrentPage(1);
  }, [resetFilters, clearSearch, setCurrentPage]);

  const handleDownload = useCallback(async () => {
    try {
      const blob = await triggerExport({
        user: filters.user,
        action: filters.action,
        model_name: filters.resource,
        severity: filters.severity,
        start_date: filters.dateFrom,
        end_date: filters.dateTo,
        search: debouncedTerm,
      }).unwrap();

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Audit logs exported successfully");
    } catch (error) {
      console.error("[AuditLogs] Export failed:", error);
      toast.error("Failed to export audit logs");
    }
  }, [triggerExport, filters, debouncedTerm]);

  const handleRowClick = useCallback((log) => {
    setSelectedLog(log);
    setIsModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setSelectedLog(null);
  }, []);

  return (
    <PageWrapper isDarkMode={isDarkMode}>
      <div className="space-y-6">
        <TablePageShell isDarkMode={isDarkMode}>
          <div
            className="p-3 sm:p-4 border-b"
            style={{ borderColor: isDarkMode ? "#374151" : "#E5E7EB" }}
          >
            <DataTableToolbar
              title="Audit Logs"
              count={totalCount}
              countLabel="logs"
              onRefresh={handleRefresh}
              isRefreshing={isFetching}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              searchPlaceholder="Search audit logs..."
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={handleItemsPerPageChange}
              isDarkMode={isDarkMode}
              isLoading={isLoading || isFetching}
              rightSlot={
                <>
                  <FilterDropdown
                    filters={filters}
                    filterConfig={FILTER_CONFIG}
                    filterOptions={filterOptions}
                    onFilterOptionsLoad={() => loadFilterOptions(handleFilterOptionsLoad)}
                    hasActiveFilters={hasActiveFilters}
                    onFiltersChange={handleFiltersChange}
                    isDarkMode={isDarkMode}
                  />
                  <RenderIfAllowed module="audit_logs" action="read">
                    <button
                      onClick={handleDownload}
                      disabled={isExporting}
                      className={`p-2 rounded-lg transition-all duration-200 shadow-sm flex items-center justify-center hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                        isExporting ? "opacity-50 cursor-not-allowed" : ""
                      } ${
                        isDarkMode
                          ? "bg-blue-900/20 text-blue-400 hover:bg-blue-900/40 hover:text-blue-300 border border-blue-900/30"
                          : "bg-blue-100/80 text-blue-600 hover:bg-blue-200 hover:text-blue-700 border border-blue-200/50"
                      }`}
                      title={isExporting ? "Exporting..." : "Download Audit Logs"}
                      aria-label="Download Audit Logs"
                    >
                      {isExporting ? (
                        <Loader2 className="w-5 h-5 flex-shrink-0 animate-spin" />
                      ) : (
                        <Download className="w-5 h-5 flex-shrink-0" />
                      )}
                    </button>
                  </RenderIfAllowed>
                </>
              }
            />
          </div>

          <TableStateWrapper
            isLoading={isLoading}
            isError={false}
            errorMessage=""
            isEmpty={logs.length === 0}
            hasActiveFilters={hasActiveFilters}
            emptyTitle="No Audit Logs Found"
            onRetry={refetch}
            onClearFilters={handleClearAll}
            isDarkMode={isDarkMode}
            loadingText="Loading audit logs..."
          >
            <DataTable
              data={logs}
              columns={columns}
              isDarkMode={isDarkMode}
              isLoading={isLoading}
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

        <AuditLogModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          log={selectedLog}
          isDarkMode={isDarkMode}
        />
      </div>
    </PageWrapper>
  );
}

export default AuditLogs;