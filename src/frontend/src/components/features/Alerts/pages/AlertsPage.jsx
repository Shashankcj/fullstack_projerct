// import { useEffect, useState, useMemo, useCallback } from "react";
// import backendApi from "../../api/backendAxiosInstance";
// import { toast } from "react-toastify";
// import { useSearchParams } from "react-router-dom";
// import { RefreshCw } from "lucide-react";

// import DataTableUI from "../DataTableUI";
// import LogsModal from "./LogsModal";
// import FilterDropdown from "./FilterDropdown";
// import SearchBar from "../SearchBar";
// import ActionButtons from "../ActionButtons";
// import PageWrapper from "../Utilities/PageWrapper";
// import PriorityBadge from "../Utilities/priorityBadge";


// /* ================= STATIC CONSTANTS — outside component ================= */

// const TABLE_HEADERS = [
//   { key: "created_at",  label: "Time",        className: "w-36" },
//   { key: "device",      label: "Device",      className: "w-32" },
//   { key: "priority",    label: "Priority",    className: "w-32" },
//   { key: "component",   label: "Component",   className: "w-36" },
//   { key: "severity",    label: "Severity",    className: "w-32" },
//   { key: "description", label: "Description",  className: "32" },
// ];

// const SEVERITY_COLORS = {
//   Critical: "bg-red-100 text-red-600",
//   Warning:  "bg-yellow-100 text-yellow-700",
//   Info:     "bg-blue-100 text-blue-600",
// };

// const filterConfig = [
//   { key: "device",    label: "Device",     type: "select",    optionsKey: "device"    },
//   { key: "component", label: "Component",  type: "select",    optionsKey: "component" },
//   { key: "priority",  label: "Priority",   type: "select",    optionsKey: "priority"  },
//   { key: "severity",  label: "Severity",   type: "select",    optionsKey: "severity"  },
//   { key: "date",      label: "Date Range", type: "dateRange"                          },
// ];

// const EMPTY_FILTERS = {
//   device:    "",
//   priority:  "",
//   component: "",
//   severity:  "",
//   dateFrom:  "",
//   dateTo:    "",
// };

// const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];


// /* ================= COMPONENT ================= */

// function Alert({ isDarkMode = false }) {

//   /* -------------------- STATE -------------------- */
//   const [searchParams, setSearchParams] = useSearchParams();

//   const [data, setData]               = useState([]);
//   const [loading, setLoading]         = useState(false);
//   const [error, setError]             = useState("");
//   const [selectedAlert, setSelectedAlert] = useState(null);
//   const [isModalOpen, setIsModalOpen] = useState(false);
//   const [totalCount, setTotalCount]   = useState(0);
//   const [isRefreshing, setIsRefreshing] = useState(false);

//   const [currentPage, setCurrentPage] = useState(
//     Number(searchParams.get("page")) || 1
//   );
//   const [itemsPerPage, setItemsPerPage] = useState(
//     Number(searchParams.get("page_size")) || 10
//   );
//   const [searchTerm, setSearchTerm] = useState(
//     searchParams.get("search") || ""
//   );
//   const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);

//   const [filters, setFilters] = useState({
//     device:    searchParams.get("device")     || "",
//     priority:  searchParams.get("priority")   || "",
//     component: searchParams.get("component")  || "",
//     severity:  searchParams.get("severity")   || "",
//     dateFrom:  searchParams.get("start_date") || "",
//     dateTo:    searchParams.get("end_date")   || "",
//   });

//   const [filterOptions, setFilterOptions] = useState({
//     device:    [],
//     priority:  [],
//     component: [],
//     severity:  [],
//   });

//   const [filterOptionsLoaded, setFilterOptionsLoaded]   = useState(false);
//   const [filterOptionsLoading, setFilterOptionsLoading] = useState(false);


//   /* -------------------- DERIVED -------------------- */
//   const totalPages = useMemo(
//     () => Math.ceil(totalCount / itemsPerPage),
//     [totalCount, itemsPerPage]
//   );

//   const hasActiveFilters = useMemo(
//     () => Object.values(filters).some(Boolean) || Boolean(debouncedSearchTerm),
//     [filters, debouncedSearchTerm]
//   );


//   /* -------------------- FETCH ALERTS -------------------- */

//   const fetchAlerts = useCallback(async () => {
//     setLoading(true);
//     setError("");

//     try {
//       const params = new URLSearchParams({
//         page:      currentPage,
//         page_size: itemsPerPage,
//       });

//       if (debouncedSearchTerm)  params.append("search",      debouncedSearchTerm);
//       if (filters.device)       params.append("device_name", filters.device);
//       if (filters.priority)     params.append("priority",    filters.priority);   // ✅ Fix #11 — .append() not .set()
//       if (filters.component)    params.append("alert_type",  filters.component);
//       if (filters.severity)     params.append("severity",    filters.severity);
//       if (filters.dateFrom)     params.append("start_date",  filters.dateFrom);
//       if (filters.dateTo)       params.append("end_date",    filters.dateTo);

//       const res    = await backendApi.get(`/get_alerts?${params.toString()}`);
//       const alerts = res.data?.results?.alerts || [];
//       const count  = res.data?.count           || 0;

//       setData(alerts);
//       setTotalCount(count);
//     } catch (err) {
//       console.error("[Alert] fetchAlerts error:", err); 
//       setError("Failed to load alerts");
//       setData([]);
//       setTotalCount(0);
//     } finally {
//       setLoading(false);
//     }
//   }, [currentPage, itemsPerPage, debouncedSearchTerm, filters]);


//   /* -------------------- FETCH FILTER OPTIONS -------------------- */
//   const fetchFilterOptions = useCallback(async () => {
//     if (filterOptionsLoaded || filterOptionsLoading) return filterOptions;

//     try {
//       setFilterOptionsLoading(true);
//       const res     = await backendApi.get("/get_alert_filter_options");
//       const options = {
//         device:    Array.isArray(res.data?.device)    ? res.data.device    : [],
//         priority:  Array.isArray(res.data?.priority)  ? res.data.priority  : [],
//         component: Array.isArray(res.data?.component) ? res.data.component : [],
//         severity:  Array.isArray(res.data?.severity)  ? res.data.severity  : [],
//       };
//       setFilterOptions(options);
//       setFilterOptionsLoaded(true);
//       return options;
//     } catch (err) {
//       console.error("[Alert] fetchFilterOptions error:", err);  
//       return filterOptions;
//     } finally {
//       setFilterOptionsLoading(false);
//     }
//   }, [filterOptionsLoaded, filterOptionsLoading, filterOptions]);


//   /* -------------------- EFFECTS -------------------- */
//   useEffect(() => {
//     document.title = "Alerts";
//   }, []);

//   // Debounce search
//   useEffect(() => {
//     const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
//     return () => clearTimeout(timer);
//   }, [searchTerm]);

//   // Sync URL params
//   useEffect(() => {
//     const params = new URLSearchParams();
//     params.set("page",      currentPage);
//     params.set("page_size", itemsPerPage);
//     if (debouncedSearchTerm)      params.set("search",      debouncedSearchTerm);
//     if (filters.device)           params.set("device_name", filters.device);
//     if (filters.priority)         params.set("priority",    filters.priority);
//     if (filters.component)        params.set("alert_type",  filters.component);
//     if (filters.severity)         params.set("severity",    filters.severity);
//     if (filters.dateFrom)         params.set("start_date",  filters.dateFrom);
//     if (filters.dateTo)           params.set("end_date",    filters.dateTo);
//     setSearchParams(params, { replace: true });
//   }, [currentPage, itemsPerPage, debouncedSearchTerm, filters, setSearchParams]);

//   // Reset to page 1 on search change
//   useEffect(() => {
//     setCurrentPage(1);
//   }, [debouncedSearchTerm]);

//   useEffect(() => {
//     fetchAlerts();
//   }, [fetchAlerts]);


//   /* -------------------- HANDLERS -------------------- */

//   const handleFiltersChange = useCallback((newFilters) => {
//     setFilters(newFilters);
//     setCurrentPage(1);
//   }, []);

//   const handleRefresh = useCallback(async () => {
//     try {
//       setIsRefreshing(true);
//       setFilters(EMPTY_FILTERS);
//       setSearchTerm("");
//       setDebouncedSearchTerm("");
//       setCurrentPage(1);
//       toast.success("Alerts refreshed successfully");
//     } catch {
//       toast.error("Failed to refresh alerts");
//     } finally {
//       setIsRefreshing(false);
//     }
//   }, []);

//   const handleRowClick = useCallback((alert) => {
//     setSelectedAlert(alert);
//     setIsModalOpen(true);
//   }, []);

//   const handlePageChange = useCallback((page) => {
//     if (page >= 1 && page <= totalPages) setCurrentPage(page);
//   }, [totalPages]);

//   const handleItemsPerPageChange = useCallback((num) => {
//     setItemsPerPage(num);
//     setCurrentPage(1);
//   }, []);


//   /* -------------------- CELL RENDERER -------------------- */

//   const renderCell = useCallback((item, key, formatDate, truncateText, severityColors) => {
//     switch (key) {
//       case "created_at":
//         return (
//           <span className="whitespace-nowrap">
//             {formatDate(item.created_at)}
//           </span>
//         );

//       case "device":
//         return item.device_name || item.hostname || "---";

//       case "priority": {
//         const priority = item.priority || item.Priority || "";
//         return (
//           <span className="flex items-center gap-2">
//             <PriorityBadge priority={priority} isDarkMode={isDarkMode} />
//           </span>
//         );
//       }

//       case "component":
//         return (
//           <span className="font-medium">{item.alert_type || "---"}</span>
//         );

//       case "severity":
//         return (
//           <span
//             className={`inline-flex justify-center px-2 py-1 rounded-full text-xs font-medium mx-auto ${
//               severityColors[item.severity] || severityColors.Info
//             }`}
//           >
//             {item.severity}
//           </span>
//         );

//       case "description":
//         return (
//           <span title={item.message || item.details}>
//             {truncateText(item.message || item.details || "---", 70)}
//           </span>
//         );

//       default:
//         return item[key] || "---";
//     }
//   }, [isDarkMode]);


//   /* -------------------- RENDER -------------------- */
//   return (
//     <PageWrapper isDarkMode={isDarkMode}>
//       <div className="space-y-6">
//         <div
//           className="rounded-lg shadow-md overflow-hidden"
//           style={{
//             backgroundColor: isDarkMode ? "#1F2937" : "#FFFFFF",
//             border:          isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB",
//           }}
//         >
//           <div
//             className="p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 border-b"
//             style={{
//               borderColor:     isDarkMode ? "#374151" : "#E5E7EB",
//               backgroundColor: isDarkMode ? "#1F2937" : "#FFFFFF",
//             }}
//           >
//             {/* Left: Title + Refresh + Count */}
//             <div className="flex items-center gap-3">
//               <span
//                 className="text-base sm:text-lg font-semibold"
//                 style={{ color: isDarkMode ? "#FFF" : "#525759" }}
//               >
//                 Alerts
//               </span>

//               <ActionButtons
//                 onRefresh={handleRefresh}
//                 isRefreshing={isRefreshing}
//                 isDarkMode={isDarkMode}
//                 refreshButtonTitle="Refresh Alerts"
//                 refreshIcon={RefreshCw}
//               />

//               <span className="inline-flex items-center justify-center px-2 py-1 rounded-full text-sm font-semibold leading-none bg-blue-500/10 text-blue-500">
//                 {totalCount} alerts
//               </span>
//             </div>

//             {/* Right: SearchBar */}
//             <div className="flex items-center gap-3">
//               <SearchBar
//                 searchTerm={searchTerm}
//                 onSearchChange={setSearchTerm}
//                 searchPlaceholder="Search alerts..."
//                 isDarkMode={isDarkMode}
//                 className="border-0 p-0"
//               />
//             </div>
//           </div>

//           <DataTableUI
//             data={data}
//             loading={loading}
//             error={error}
//             totalCount={totalCount}
//             tableTitle="All Alerts"
//             tableHeaders={TABLE_HEADERS}
//             tableHeight="550px"
//             isDarkMode={isDarkMode}
//             severityColors={SEVERITY_COLORS}
//             filters={filters}
//             filterConfig={filterConfig}
//             filterOptions={filterOptions}
//             onFilterOptionsLoad={fetchFilterOptions}
//             hasActiveFilters={hasActiveFilters}
//             onFiltersChange={handleFiltersChange}
//             FilterComponent={FilterDropdown}
//             currentPage={currentPage}
//             totalPages={totalPages}
//             onPageChange={handlePageChange}
//             onRowClick={handleRowClick}
//             onRetry={fetchAlerts}
//             renderCell={renderCell}
//             itemsPerPage={itemsPerPage}
//             itemsPerPageOptions={ITEMS_PER_PAGE_OPTIONS}
//             onItemsPerPageChange={handleItemsPerPageChange}
//           />
//         </div>

//         <LogsModal
//           isOpen={isModalOpen}
//           onClose={() => {
//             setIsModalOpen(false);
//             setSelectedAlert(null);
//           }}
//           data={selectedAlert}
//           isDarkMode={isDarkMode}
//           type="alert"
//         />
//       </div>
//     </PageWrapper>
//   );
// }

// export default Alert;


// import { useEffect, useState, useMemo, useCallback } from "react";
// import backendApi from "../../api/backendAxiosInstance";
// import { toast } from "react-toastify";
// import { useSearchParams } from "react-router-dom";
// import { RefreshCw } from "lucide-react";

// import DataTable from "../table/DataTable";
// import LogsModal from "./LogsModal";
// import FilterDropdown from "./FilterDropdown";
// import SearchBar from "../SearchBar";
// import ActionButtons from "../ActionButtons";
// import PageWrapper from "../Utilities/PageWrapper";
// import RowsPerPageDropdown from "../Utilities/RowsPerPageDropdown";
// import useAlertColumns from "../table/columns/AlertColumns";


// /* ================= STATIC CONSTANTS — outside component ================= */

// const filterConfig = [
//   { key: "device",    label: "Device",     type: "select",   optionsKey: "device"    },
//   { key: "component", label: "Component",  type: "select",   optionsKey: "component" },
//   { key: "priority",  label: "Priority",   type: "select",   optionsKey: "priority"  },
//   { key: "severity",  label: "Severity",   type: "select",   optionsKey: "severity"  },
//   { key: "date",      label: "Date Range", type: "dateRange"                         },
// ];

// const EMPTY_FILTERS = {
//   device:    "",
//   priority:  "",
//   component: "",
//   severity:  "",
//   dateFrom:  "",
//   dateTo:    "",
// };


// /* ================= COMPONENT ================= */

// function Alert({ isDarkMode = false }) {

//   /* -------------------- STATE -------------------- */
//   const [searchParams, setSearchParams] = useSearchParams();

//   const [data, setData]                   = useState([]);
//   const [loading, setLoading]             = useState(false);
//   const [error, setError]                 = useState("");
//   const [selectedAlert, setSelectedAlert] = useState(null);
//   const [isModalOpen, setIsModalOpen]     = useState(false);
//   const [totalCount, setTotalCount]       = useState(0);
//   const [isRefreshing, setIsRefreshing]   = useState(false);

//   const [currentPage, setCurrentPage] = useState(
//     Number(searchParams.get("page")) || 1
//   );
//   const [itemsPerPage, setItemsPerPage] = useState(
//     Number(searchParams.get("page_size")) || 10
//   );
//   const [searchTerm, setSearchTerm] = useState(
//     searchParams.get("search") || ""
//   );
//   const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);

//   const [filters, setFilters] = useState({
//     device:    searchParams.get("device")     || "",
//     priority:  searchParams.get("priority")   || "",
//     component: searchParams.get("component")  || "",
//     severity:  searchParams.get("severity")   || "",
//     dateFrom:  searchParams.get("start_date") || "",
//     dateTo:    searchParams.get("end_date")   || "",
//   });

//   const [filterOptions, setFilterOptions] = useState({
//     device:    [],
//     priority:  [],
//     component: [],
//     severity:  [],
//   });

//   const [filterOptionsLoaded, setFilterOptionsLoaded]   = useState(false);
//   const [filterOptionsLoading, setFilterOptionsLoading] = useState(false);


//   /* -------------------- DERIVED -------------------- */
//   const totalPages = useMemo(
//     () => Math.ceil(totalCount / itemsPerPage),
//     [totalCount, itemsPerPage]
//   );

//   const hasActiveFilters = useMemo(
//     () => Object.values(filters).some(Boolean) || Boolean(debouncedSearchTerm),
//     [filters, debouncedSearchTerm]
//   );

//   // ── use your existing hook — no inline column definitions needed ──
//   const columns = useAlertColumns({ isDarkMode });


//   /* -------------------- FETCH ALERTS -------------------- */
//   const fetchAlerts = useCallback(async () => {
//     setLoading(true);
//     setError("");

//     try {
//       const params = new URLSearchParams({
//         page:      currentPage,
//         page_size: itemsPerPage,
//       });

//       if (debouncedSearchTerm) params.append("search",      debouncedSearchTerm);
//       if (filters.device)      params.append("device_name", filters.device);
//       if (filters.priority)    params.append("priority",    filters.priority);
//       if (filters.component)   params.append("alert_type",  filters.component);
//       if (filters.severity)    params.append("severity",    filters.severity);
//       if (filters.dateFrom)    params.append("start_date",  filters.dateFrom);
//       if (filters.dateTo)      params.append("end_date",    filters.dateTo);

//       const res    = await backendApi.get(`/get_alerts?${params.toString()}`);
//       const alerts = res.data?.results?.alerts || [];
//       const count  = res.data?.count           || 0;

//       setData(alerts);
//       setTotalCount(count);
//     } catch (err) {
//       console.error("[Alert] fetchAlerts error:", err);
//       setError("Failed to load alerts");
//       setData([]);
//       setTotalCount(0);
//     } finally {
//       setLoading(false);
//     }
//   }, [currentPage, itemsPerPage, debouncedSearchTerm, filters]);


//   /* -------------------- FETCH FILTER OPTIONS -------------------- */
//   const fetchFilterOptions = useCallback(async () => {
//     if (filterOptionsLoaded || filterOptionsLoading) return filterOptions;

//     try {
//       setFilterOptionsLoading(true);
//       const res     = await backendApi.get("/get_alert_filter_options");
//       const options = {
//         device:    Array.isArray(res.data?.device)    ? res.data.device    : [],
//         priority:  Array.isArray(res.data?.priority)  ? res.data.priority  : [],
//         component: Array.isArray(res.data?.component) ? res.data.component : [],
//         severity:  Array.isArray(res.data?.severity)  ? res.data.severity  : [],
//       };
//       setFilterOptions(options);
//       setFilterOptionsLoaded(true);
//       return options;
//     } catch (err) {
//       console.error("[Alert] fetchFilterOptions error:", err);
//       return filterOptions;
//     } finally {
//       setFilterOptionsLoading(false);
//     }
//   }, [filterOptionsLoaded, filterOptionsLoading, filterOptions]);


//   /* -------------------- EFFECTS -------------------- */
//   useEffect(() => {
//     document.title = "Alerts";
//   }, []);

//   // Debounce search
//   useEffect(() => {
//     const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
//     return () => clearTimeout(timer);
//   }, [searchTerm]);

//   // Sync URL params
//   useEffect(() => {
//     const params = new URLSearchParams();
//     params.set("page",      currentPage);
//     params.set("page_size", itemsPerPage);
//     if (debouncedSearchTerm) params.set("search",      debouncedSearchTerm);
//     if (filters.device)      params.set("device_name", filters.device);
//     if (filters.priority)    params.set("priority",    filters.priority);
//     if (filters.component)   params.set("alert_type",  filters.component);
//     if (filters.severity)    params.set("severity",    filters.severity);
//     if (filters.dateFrom)    params.set("start_date",  filters.dateFrom);
//     if (filters.dateTo)      params.set("end_date",    filters.dateTo);
//     setSearchParams(params, { replace: true });
//   }, [currentPage, itemsPerPage, debouncedSearchTerm, filters, setSearchParams]);

//   // Reset to page 1 on search change
//   useEffect(() => {
//     setCurrentPage(1);
//   }, [debouncedSearchTerm]);

//   useEffect(() => {
//     fetchAlerts();
//   }, [fetchAlerts]);


//   /* -------------------- HANDLERS -------------------- */
//   const handleFiltersChange = useCallback((newFilters) => {
//     setFilters(newFilters);
//     setCurrentPage(1);
//   }, []);

//   const handleRefresh = useCallback(async () => {
//     try {
//       setIsRefreshing(true);
//       setFilters(EMPTY_FILTERS);
//       setSearchTerm("");
//       setDebouncedSearchTerm("");
//       setCurrentPage(1);
//       toast.success("Alerts refreshed successfully");
//     } catch {
//       toast.error("Failed to refresh alerts");
//     } finally {
//       setIsRefreshing(false);
//     }
//   }, []);

//   const handleRowClick = useCallback((alert) => {
//     setSelectedAlert(alert);
//     setIsModalOpen(true);
//   }, []);

//   const handlePageChange = useCallback((page) => {
//     if (page >= 1 && page <= totalPages) setCurrentPage(page);
//   }, [totalPages]);

//   const handleItemsPerPageChange = useCallback((num) => {
//     setItemsPerPage(num);
//     setCurrentPage(1);
//   }, []);


//   /* -------------------- RENDER -------------------- */
//   return (
//     <PageWrapper isDarkMode={isDarkMode}>
//       <div className="space-y-6">
//         <div
//           className="rounded-lg shadow-md overflow-hidden"
//           style={{
//             backgroundColor: isDarkMode ? "#1F2937" : "#FFFFFF",
//             border:          isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB",
//           }}
//         >
//           {/* ── Toolbar ─────────────────────────────────────── */}
//           <div
//             className="p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3"
//             style={{
//               // borderColor:     isDarkMode ? "#374151" : "#E5E7EB",
//               backgroundColor: isDarkMode ? "#1F2937" : "#FFFFFF",
//             }}
//           >
//             {/* Left: Title + Refresh + Count */}
//             <div className="flex items-center gap-3">
//               <span
//                 className="text-base sm:text-lg font-semibold"
//                 style={{ color: isDarkMode ? "#FFF" : "#525759" }}
//               >
//                 Alerts
//               </span>

//               <ActionButtons
//                 onRefresh={handleRefresh}
//                 isRefreshing={isRefreshing}
//                 isDarkMode={isDarkMode}
//                 refreshButtonTitle="Refresh Alerts"
//                 refreshIcon={RefreshCw}
//               />

//               <span className="inline-flex items-center justify-center px-2 py-1 rounded-full text-sm font-semibold leading-none bg-blue-500/10 text-blue-500">
//                 {totalCount} alerts
//               </span>
//             </div>

//             {/* Right: Search + Filter + Rows per page */}
//             <div className="flex items-center gap-3">
//               <SearchBar
//                 searchTerm={searchTerm}
//                 onSearchChange={setSearchTerm}
//                 searchPlaceholder="Search alerts..."
//                 isDarkMode={isDarkMode}
//                 className="border-0 p-0"
//               />

//               <FilterDropdown
//                 filters={filters}
//                 filterConfig={filterConfig}
//                 filterOptions={filterOptions}
//                 onFilterOptionsLoad={fetchFilterOptions}
//                 hasActiveFilters={hasActiveFilters}
//                 onFiltersChange={handleFiltersChange}
//                 isDarkMode={isDarkMode}
//               />

//               <RowsPerPageDropdown
//                 itemsPerPage={itemsPerPage}
//                 onItemsPerPageChange={handleItemsPerPageChange}
//                 isDarkMode={isDarkMode}
//               />
//             </div>
//           </div>

//           {/* ── Table (pagination built into DataTable) ─────── */}
//           <DataTable
//             data={data}
//             columns={columns}
//             isDarkMode={isDarkMode}
//             isLoading={loading}
//             emptyMessage={
//               searchTerm.trim()
//                 ? `No alerts match "${searchTerm}"`
//                 : "No alerts found"
//             }
//             getRowId={(row) => row.id ?? row.uuid}
//             page={currentPage}
//             totalPages={totalPages}
//             rowCount={totalCount}
//             onPageChange={handlePageChange}
//             itemsPerPage={itemsPerPage}
//             onRowClick={handleRowClick}
//             sorting={[]}
//             onSortingChange={() => {}}
//             globalFilter={searchTerm}
//             onGlobalFilterChange={setSearchTerm}
//           />
//         </div>

//         {/* ── Logs Modal ──────────────────────────────────── */}
//         <LogsModal
//           isOpen={isModalOpen}
//           onClose={() => {
//             setIsModalOpen(false);
//             setSelectedAlert(null);
//           }}
//           data={selectedAlert}
//           isDarkMode={isDarkMode}
//           type="alert"
//         />
//       </div>
//     </PageWrapper>
//   );
// }

// export default Alert;


// import { useState, useCallback, useEffect, useMemo } from "react";
// import { useSearchParams } from "react-router-dom";
// import { toast } from "react-toastify";
// import backendApi from "../../../../api/backendAxiosInstance";

// import { useTablePagination } from "../../../../Hooks/table/useTablePagination";
// import { useDebouncedSearch } from "../../../../Hooks/table/useDebouncedSearch";
// import { useTableFilters } from "../../../../Hooks/table/useTableFilters";
// import { useURLSync } from "../../../../Hooks/table/useURLSync";
// import { useDocumentTitle } from "../../../../Hooks/useDocumentTitle";

// import PageWrapper from "../../../Utilities/PageWrapper";
// import TablePageShell from "../../../table/TablePageShell";
// import DataTableToolbar from "../../../table/DataTableToolbar";
// import DataTable from "../../../table/DataTable";
// import TableStateWrapper from "../../../table/TableStateWrapper";
// import LogsModal from "../../Events_logs/components/LogsModal";
// import FilterDropdown from "../../../shared/FilterDropdown";
// import useAlertColumns from "../../../table/columns/AlertColumns";

// const FILTER_CONFIG = [
//   { key: "device", label: "Device", type: "select", optionsKey: "device" },
//   { key: "component", label: "Component", type: "select", optionsKey: "component" },
//   { key: "priority", label: "Priority", type: "select", optionsKey: "priority" },
//   { key: "severity", label: "Severity", type: "select", optionsKey: "severity" },
//   { key: "date", label: "Date Range", type: "dateRange" },
// ];

// const EMPTY_FILTERS = {
//   device: "",
//   priority: "",
//   component: "",
//   severity: "",
//   dateFrom: "",
//   dateTo: "",
// };

// function Alert({ isDarkMode = false }) {
//   useDocumentTitle("Alerts");

//   const [searchParams] = useSearchParams();

//   const {
//     currentPage,
//     itemsPerPage,
//     setCurrentPage,
//     handlePageChange,
//     handleItemsPerPageChange,
//     resetPage,
//   } = useTablePagination({
//     initialPage: Number(searchParams.get("page")) || 1,
//     initialPageSize: Number(searchParams.get("page_size")) || 10,
//   });

//   const {
//     searchTerm,
//     debouncedTerm,
//     setSearchTerm,
//     clearSearch,
//   } = useDebouncedSearch({
//     initialValue: searchParams.get("search") || "",
//     delay: 500,
//     onSearch: resetPage,
//   });

//   const {
//     filters,
//     filterOptions,
//     updateFilters,
//     resetFilters,
//     loadFilterOptions,
//   } = useTableFilters({
//     initialFilters: {
//       device: searchParams.get("device") || "",
//       priority: searchParams.get("priority") || "",
//       component: searchParams.get("component") || "",
//       severity: searchParams.get("severity") || "",
//       dateFrom: searchParams.get("start_date") || "",
//       dateTo: searchParams.get("end_date") || "",
//     },
//     onFilterChange: resetPage,
//   });

//   const hasActiveFilters = useMemo(() => {
//     return Object.values(filters).some(Boolean) || Boolean(debouncedTerm);
//   }, [filters, debouncedTerm]);

//   useURLSync({
//     params: {
//       page: currentPage,
//       page_size: itemsPerPage,
//       search: debouncedTerm,
//       device: filters.device,
//       priority: filters.priority,
//       component: filters.component,
//       severity: filters.severity,
//       start_date: filters.dateFrom,
//       end_date: filters.dateTo,
//     },
//     defaults: { page: 1, page_size: 10 },
//   });

//   const [data, setData] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState("");
//   const [totalCount, setTotalCount] = useState(0);

//   const [selectedAlert, setSelectedAlert] = useState(null);
//   const [isModalOpen, setIsModalOpen] = useState(false);

//   const fetchAlerts = useCallback(async () => {
//     setLoading(true);
//     setError("");

//     try {
//       const params = new URLSearchParams({
//         page: String(currentPage),
//         page_size: String(itemsPerPage),
//       });

//       if (debouncedTerm) params.append("search", debouncedTerm);
//       if (filters.device) params.append("device_name", filters.device);
//       if (filters.priority) params.append("priority", filters.priority);
//       if (filters.component) params.append("alert_type", filters.component);
//       if (filters.severity) params.append("severity", filters.severity);
//       if (filters.dateFrom) params.append("start_date", filters.dateFrom);
//       if (filters.dateTo) params.append("end_date", filters.dateTo);

//       const res = await backendApi.get(`/get_alerts?${params.toString()}`);

//       setData(res.data?.results?.alerts || []);
//       setTotalCount(res.data?.count || 0);
//     } catch (err) {
//       console.error("[Alert] fetchAlerts error:", err);
//       setError("Failed to load alerts");
//       setData([]);
//       setTotalCount(0);
//     } finally {
//       setLoading(false);
//     }
//   }, [currentPage, itemsPerPage, debouncedTerm, filters]);

//   useEffect(() => {
//     fetchAlerts();
//   }, [fetchAlerts]);

//   const fetchFilterOptions = useCallback(async () => {
//     try {
//       const res = await backendApi.get("/get_alert_filter_options");

//       return {
//         device: Array.isArray(res.data?.device) ? res.data.device : [],
//         priority: Array.isArray(res.data?.priority) ? res.data.priority : [],
//         component: Array.isArray(res.data?.component) ? res.data.component : [],
//         severity: Array.isArray(res.data?.severity) ? res.data.severity : [],
//       };
//     } catch (err) {
//       console.error("[Alert] fetchFilterOptions error:", err);
//       return {
//         device: [],
//         priority: [],
//         component: [],
//         severity: [],
//       };
//     }
//   }, []);

//   const handleRefresh = useCallback(() => {
//     resetFilters(EMPTY_FILTERS);
//     clearSearch();
//     setCurrentPage(1);
//     toast.success("Alerts refreshed successfully");
//   }, [resetFilters, clearSearch, setCurrentPage]);

//   const handleClearAll = useCallback(() => {
//     resetFilters(EMPTY_FILTERS);
//     clearSearch();
//     setCurrentPage(1);
//   }, [resetFilters, clearSearch, setCurrentPage]);

//   const handleRowClick = useCallback((alert) => {
//     setSelectedAlert(alert);
//     setIsModalOpen(true);
//   }, []);

//   const columns = useAlertColumns({ isDarkMode });

//   const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));

//   return (
//     <PageWrapper isDarkMode={isDarkMode}>
//       <div className="space-y-6">
//         <TablePageShell isDarkMode={isDarkMode}>
//           <div
//             className="p-3 sm:p-4"
//           >
//             <DataTableToolbar
//               title="Alerts"
//               count={totalCount}
//               countLabel="alerts"
//               onRefresh={handleRefresh}
//               isRefreshing={loading}
//               searchTerm={searchTerm}
//               onSearchChange={setSearchTerm}
//               searchPlaceholder="Search alerts..."
//               itemsPerPage={itemsPerPage}
//               onItemsPerPageChange={handleItemsPerPageChange}
//               isDarkMode={isDarkMode}
//               isLoading={loading}
//               rightSlot={
//                 <FilterDropdown
//                   filters={filters}
//                   filterConfig={FILTER_CONFIG}
//                   filterOptions={filterOptions}
//                   onFilterOptionsLoad={() => loadFilterOptions(fetchFilterOptions)}
//                   hasActiveFilters={hasActiveFilters}
//                   onFiltersChange={updateFilters}
//                   isDarkMode={isDarkMode}
//                 />
//               }
//             />
//           </div>

//           <TableStateWrapper
//             isLoading={loading}
//             isError={!!error}
//             errorMessage={error}
//             isEmpty={data.length === 0}
//             hasActiveFilters={hasActiveFilters}
//             emptyTitle="No Alerts Found"
//             onRetry={fetchAlerts}
//             onClearFilters={handleClearAll}
//             isDarkMode={isDarkMode}
//             loadingText="Loading alerts..."
//           >
//             <DataTable
//               data={data}
//               columns={columns}
//               isDarkMode={isDarkMode}
//               isLoading={loading}
//               getRowId={(row) => row.id ?? row.uuid}
//               page={currentPage}
//               totalPages={totalPages}
//               rowCount={totalCount}
//               onPageChange={(page) => handlePageChange(page, totalPages)}
//               itemsPerPage={itemsPerPage}
//               onRowClick={handleRowClick}
//               sorting={[]}
//               onSortingChange={() => {}}
//               globalFilter={searchTerm}
//               onGlobalFilterChange={setSearchTerm}
//             />
//           </TableStateWrapper>
//         </TablePageShell>

//         <LogsModal
//           isOpen={isModalOpen}
//           onClose={() => {
//             setIsModalOpen(false);
//             setSelectedAlert(null);
//           }}
//           data={selectedAlert}
//           isDarkMode={isDarkMode}
//           type="alert"
//         />
//       </div>
//     </PageWrapper>
//   );
// }

// export default Alert;


// pages/AlertsPage.jsx

import { useState, useCallback, useMemo } from "react"
import { useSearchParams } from "react-router-dom"
import { toast } from "react-toastify"

import { useGetAlertsQuery, useLazyGetAlertFilterOptionsQuery }
  from "../../../../redux/alertsApi"

import { useTablePagination }  from "../../../../Hooks/table/useTablePagination"
import { useDebouncedSearch }  from "../../../../Hooks/table/useDebouncedSearch"
import { useTableFilters }     from "../../../../Hooks/table/useTableFilters"
import { useURLSync }          from "../../../../Hooks/table/useURLSync"
import { useDocumentTitle }    from "../../../../Hooks/useDocumentTitle"
import useAlertColumns         from "../../../table/columns/AlertColumns"

import PageWrapper       from "../../../Utilities/PageWrapper"
import TablePageShell    from "../../../table/TablePageShell"
import DataTableToolbar  from "../../../table/DataTableToolbar"
import DataTable         from "../../../table/DataTable"
import TableStateWrapper from "../../../table/TableStateWrapper"
import FilterDropdown    from "../../../shared/FilterDropdown"
import LogsModal         from "../../Events_logs/components/LogsModal"

/* ── constants ── */
const FILTER_CONFIG = [
  { key: "device",    label: "Device",     type: "select",    optionsKey: "device"    },
  { key: "component", label: "Component",  type: "select",    optionsKey: "component" },
  { key: "priority",  label: "Priority",   type: "select",    optionsKey: "priority"  },
  { key: "severity",  label: "Severity",   type: "select",    optionsKey: "severity"  },
  { key: "date",      label: "Date Range", type: "dateRange"                           },
]

const EMPTY_FILTERS = {
  device: "", priority: "", component: "", severity: "", dateFrom: "", dateTo: "",
}

/* ── component ── */
const Alert = ({ isDarkMode = false }) => {
  useDocumentTitle("Alerts")

  const [searchParams] = useSearchParams()

  /* ── pagination ── */
  const {
    currentPage, itemsPerPage,
    setCurrentPage, handlePageChange,
    handleItemsPerPageChange, resetPage,
  } = useTablePagination({
    initialPage:     Number(searchParams.get("page"))      || 1,
    initialPageSize: Number(searchParams.get("page_size")) || 10,
  })

  /* ── search ── */
  const {
    searchTerm, debouncedTerm,
    setSearchTerm, clearSearch,
  } = useDebouncedSearch({
    initialValue: searchParams.get("search") || "",
    delay:        500,
    onSearch:     resetPage,
  })

  /* ── filters ── */
  const {
    filters, filterOptions,
    updateFilters, resetFilters, loadFilterOptions,
  } = useTableFilters({
    initialFilters: {
      device:    searchParams.get("device")     || "",
      priority:  searchParams.get("priority")   || "",
      component: searchParams.get("component")  || "",
      severity:  searchParams.get("severity")   || "",
      dateFrom:  searchParams.get("start_date") || "",
      dateTo:    searchParams.get("end_date")   || "",
    },
    onFilterChange: resetPage,
  })

  const hasActiveFilters = useMemo(() =>
    Object.values(filters).some(Boolean) || Boolean(debouncedTerm),
  [filters, debouncedTerm])

  /* ── url sync ── */
  useURLSync({
    params: {
      page: currentPage, page_size: itemsPerPage,
      search:     debouncedTerm,
      device:     filters.device,
      priority:   filters.priority,
      component:  filters.component,
      severity:   filters.severity,
      start_date: filters.dateFrom,
      end_date:   filters.dateTo,
    },
    defaults: { page: 1, page_size: 10 },
  })

  /* ── modal state ── */
  const [selectedAlert, setSelectedAlert] = useState(null)
  const [isModalOpen,   setIsModalOpen]   = useState(false)

  /* ── api ── */
  const [triggerGetAlertFilterOptions] = useLazyGetAlertFilterOptionsQuery()

  const {
    data: alertsData, isLoading, isFetching, error, refetch,
  } = useGetAlertsQuery({
    page:      currentPage,
    page_size: itemsPerPage,
    search:    debouncedTerm    || undefined,
    device:    filters.device   || undefined,
    priority:  filters.priority || undefined,
    component: filters.component || undefined,
    severity:  filters.severity  || undefined,
    dateFrom:  filters.dateFrom  || undefined,
    dateTo:    filters.dateTo    || undefined,
  }, { refetchOnMountOrArgChange: true })

  /* ── derived data ── */
  const alerts     = alertsData?.results?.alerts ?? []
  const totalCount = alertsData?.count           ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage))

  /* ── handlers ── */
  const handleRowClick = useCallback((alert) => {
    setSelectedAlert(alert)
    setIsModalOpen(true)
  }, [])

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false)
    setSelectedAlert(null)
  }, [])

  const handleFilterOptionsLoad = useCallback(async () => {
    try {
      const res = await triggerGetAlertFilterOptions().unwrap()
      return {
        device:    Array.isArray(res?.device)    ? res.device    : [],
        priority:  Array.isArray(res?.priority)  ? res.priority  : [],
        component: Array.isArray(res?.component) ? res.component : [],
        severity:  Array.isArray(res?.severity)  ? res.severity  : [],
      }
    } catch {
      return { device: [], priority: [], component: [], severity: [] }
    }
  }, [triggerGetAlertFilterOptions])

  const handleRefresh = useCallback(() => {
    resetFilters(EMPTY_FILTERS)
    clearSearch()
    setCurrentPage(1)
    refetch()
    toast.success("Alerts refreshed successfully")
  }, [resetFilters, clearSearch, setCurrentPage, refetch])

  const handleClearAll = useCallback(() => {
    resetFilters(EMPTY_FILTERS)
    clearSearch()
    setCurrentPage(1)
  }, [resetFilters, clearSearch, setCurrentPage])

  const handlePageChangeSafe = useCallback(
    (page) => handlePageChange(page, totalPages),
    [handlePageChange, totalPages]
  )

  /* ── columns ── */
  const columns = useAlertColumns({ isDarkMode })

  /* ── render ── */
  return (
    <PageWrapper isDarkMode={isDarkMode}>
      <div className="space-y-6">
        <TablePageShell isDarkMode={isDarkMode}>
          <div className="p-3 sm:p-4">
            <DataTableToolbar
              title="Alerts"
              count={totalCount}
              countLabel="alerts"
              onRefresh={handleRefresh}
              isRefreshing={isFetching}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              searchPlaceholder="Search alerts..."
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={handleItemsPerPageChange}
              isDarkMode={isDarkMode}
              isLoading={isLoading}
              rightSlot={
                <FilterDropdown
                  filters={filters}
                  filterConfig={FILTER_CONFIG}
                  filterOptions={filterOptions}
                  onFilterOptionsLoad={() => loadFilterOptions(handleFilterOptionsLoad)}
                  hasActiveFilters={hasActiveFilters}
                  onFiltersChange={updateFilters}
                  isDarkMode={isDarkMode}
                />
              }
            />
          </div>

          <TableStateWrapper
            isLoading={isLoading}
            isError={!!error}
            errorMessage={error?.data?.message || error?.message || "Failed to load alerts"}
            isEmpty={alerts.length === 0}
            hasActiveFilters={hasActiveFilters}
            emptyTitle="No Alerts Found"
            onRetry={refetch}
            onClearFilters={handleClearAll}
            isDarkMode={isDarkMode}
            loadingText="Loading alerts..."
          >
            <DataTable
              data={alerts}
              columns={columns}
              isDarkMode={isDarkMode}
              isLoading={isLoading}
              getRowId={(row) => row.id ?? row.uuid}
              page={currentPage}
              totalPages={totalPages}
              rowCount={totalCount}
              onPageChange={handlePageChangeSafe}
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
          onClose={handleModalClose}
          data={selectedAlert}
          isDarkMode={isDarkMode}
          type="alert"
        />
      </div>
    </PageWrapper>
  )
}

export default Alert