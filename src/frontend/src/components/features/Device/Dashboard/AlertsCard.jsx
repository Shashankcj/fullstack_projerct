import { useState, useCallback, useMemo } from "react";
import { AlertCircle, Circle, CheckCheck } from "lucide-react";
import {
  useGetAlertsQuery,
  useGetAlertFilterOptionsQuery,
  useGetUnreadCountQuery,      
  useMarkAlertAsReadMutation,
  useMarkAllAlertsAsReadMutation,
} from "../../../../redux/alertFilterApi";
import FilterDropdown from "../../../shared/FilterDropdown";
import { useAuth } from "../../../../Contexts/AuthContext";


/* ================= STATIC CONSTANTS — outside component ================= */

const TABLE_COLUMNS = [
  { id: 1, name: "Time"        },
  { id: 2, name: "Component"   },
  { id: 3, name: "Severity"    },
  { id: 4, name: "Description" },
];

const SEVERITY_COLOR = {
  Critical: "bg-red-100 text-red-600",
  Warning:  "bg-yellow-100 text-yellow-700",
  Info:     "bg-blue-100 text-blue-600",
};

const FILTER_CONFIG = [
  { key: "alert_type", label: "Component",  type: "select",    optionsKey: "component" },
  { key: "severity",   label: "Severity",   type: "select",    optionsKey: "severity"  },
  { key: "date",       label: "Date Range", type: "dateRange"                           },
];

const INITIAL_FILTERS = {
  alert_type: "",
  severity:   "",
  dateFrom:   "",
  dateTo:     "",
};

// ✅ Fix #4 — pure utility moved outside component
const formatDateTime = (dateString) => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Invalid Date";
    return date.toLocaleString("en-US", {
      month:    "2-digit",
      day:      "2-digit",
      year:     "2-digit",
      hour:     "2-digit",
      minute:   "2-digit",
      hour12:   true,
      timeZone: "Asia/Kolkata",
    });
  } catch {
    return "Invalid Date";
  }
};


/* ================= COMPONENT ================= */

export const AlertsCard = ({ isDarkMode = false, deviceId, limit = 100 }) => {
  const { user, authenticated } = useAuth();

  const [filters, setFilters] = useState(INITIAL_FILTERS);


  /* -------------------- RTK QUERY HOOKS -------------------- */
  const [markAlertAsRead]    = useMarkAlertAsReadMutation();
  const [markAllAlertsAsRead, { isLoading: isMarkingAllRead }] = useMarkAllAlertsAsReadMutation();

  const { data: filterOptionsData } = useGetAlertFilterOptionsQuery(deviceId);

  // ✅ Fix #6 — useMemo so queryParams object stays stable between renders
  const queryParams = useMemo(() => ({
    device_id: deviceId,
    ...(filters.alert_type && { alert_type: filters.alert_type }),
    ...(filters.severity   && { severity:   filters.severity   }),
    ...(filters.dateFrom   && { start_date: filters.dateFrom   }),
    ...(filters.dateTo     && { end_date:   filters.dateTo     }),
  }), [deviceId, filters]);

  const {
    data:    apiResponse,
    isLoading,
    isError,
    error,
  } = useGetAlertsQuery(queryParams, { refetchOnMountOrArgChange: true });

  console.log("AlertsCard - API Response:", apiResponse);

  // ✅ Fix #2 — updated hook name
  const {
    data:       unreadData,
    isFetching: isUnreadFetching,
    refetch:    refetchUnread,
  } = useGetUnreadCountQuery(deviceId, { skip: !deviceId });

  console.log("AlertsCard - Unread Count Data:", unreadData);


  /* -------------------- DERIVED VALUES -------------------- */
  // ✅ Fix #5 — useMemo for filterOptions
  const filterOptions = useMemo(() => ({
    device:    filterOptionsData?.device    || [],
    component: filterOptionsData?.component || [],
    severity:  filterOptionsData?.severity  || [],
  }), [filterOptionsData]);

  const displayAlerts = apiResponse?.results?.alerts || [];
  // ✅ Fix #9 — use totalCount not displayAlerts.length
  const totalCount    = apiResponse?.count           || 0;
  const unreadCount   = unreadData?.unread_count     || 0;
  const hasUnread     = unreadCount > 0;
  const hasActiveFilters = Object.values(filters).some(Boolean);


  /* -------------------- HANDLERS -------------------- */
  // ✅ Fix #7 — all handlers useCallback
  // ✅ Fix #8 — namespaced console.error
  // ✅ Fix #11 — removed redundant refetch() — RTK invalidation handles getAlerts auto-refetch
  const handleRowClick = useCallback(async (alert) => {
    if (alert.is_read || !authenticated || !user || !alert.uuid) return;
    try {
      await markAlertAsRead(alert.uuid).unwrap();
      await refetchUnread();   // ✅ only unread count needs manual refetch (custom tag)
    } catch (err) {
      console.error("[AlertsCard] Failed to mark alert as read:", err);
    }
  }, [authenticated, user, markAlertAsRead, refetchUnread]);

  const handleMarkAllAsRead = useCallback(async () => {
    if (!authenticated || !user || !hasUnread || !deviceId) return;
    try {
      await markAllAlertsAsRead(deviceId).unwrap();
      await refetchUnread();   // ✅ only unread count needs manual refetch
    } catch (err) {
      console.error("[AlertsCard] Failed to mark all alerts as read:", err);
    }
  }, [authenticated, user, hasUnread, deviceId, markAllAlertsAsRead, refetchUnread]);

  const handleFiltersChange = useCallback((newFilters) => {
    setFilters(newFilters);
  }, []);


  /* -------------------- RENDER -------------------- */
  return (
    <div className="space-y-3 sm:space-y-6 px-2 sm:px-0 mt-4">
      <div
        className="rounded-lg shadow-md relative"
        style={{
          backgroundColor: isDarkMode ? "#1F2937" : "#FFFFFF",
          border: isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB",
        }}
      >

        {/* Header */}
        <div
          className="p-3 sm:p-4 flex flex-wrap items-center justify-between gap-2 border-b"
          style={{ borderColor: isDarkMode ? "#374151" : "#E5E7EB" }}
        >
          {/* Left: Title + badges */}
          <span
            className="text-base sm:text-lg font-semibold flex items-center gap-2 flex-wrap"
            style={{ color: isDarkMode ? "#FFF" : "#525759" }}
          >
            {/* ✅ Fix #9 — totalCount not displayAlerts.length */}
            Alerts ({isLoading ? "..." : totalCount})

            {hasUnread && (
              <span className={`text-xs px-2 py-1 rounded-full font-bold flex items-center gap-1
                bg-orange-100 text-orange-800 border border-orange-200
                ${isUnreadFetching ? "animate-pulse" : ""}`}
              >
                <Circle className="w-3 h-3 fill-current" />
                {unreadCount}
              </span>
            )}

            {hasActiveFilters && totalCount > 0 && (
              <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                Filtered ({totalCount})
              </span>
            )}
          </span>

          {/* Right: Mark All + Filter */}
          <div className="flex items-center gap-2 shrink-0">
            {hasUnread && (
              <button
                onClick={handleMarkAllAsRead}
                disabled={isMarkingAllRead}
                title="Mark all unread alerts as read"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                  transition-all duration-200
                  ${isDarkMode
                    ? "bg-green-900/20 text-green-400 hover:bg-green-900/40 border border-green-900/30"
                    : "bg-green-100 text-green-700 hover:bg-green-200 border border-green-200"
                  }
                  ${isMarkingAllRead ? "opacity-50 cursor-not-allowed" : "hover:shadow-md"}`}
              >
                <CheckCheck className="w-4 h-4 shrink-0" />
                <span className="hidden xs:inline">
                  {isMarkingAllRead ? "Marking..." : "Mark All Read"}
                </span>
              </button>
            )}

            <FilterDropdown
              filterConfig={FILTER_CONFIG}
              filters={filters}
              filterOptions={filterOptions}
              onFiltersChange={handleFiltersChange}
              isDarkMode={isDarkMode}
            />
          </div>
        </div>

        {/* Body */}
        <div className="max-h-72 overflow-y-auto overflow-x-auto px-4 custom-scroll mb-2">

          {/* Loading */}
          {isLoading ? (
            <div className="text-center py-8" style={{ color: isDarkMode ? "#D1D5DB" : "#6B7280" }}>
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-3" />
              <p>{hasActiveFilters ? "Loading filtered alerts..." : "Loading alerts..."}</p>
            </div>

          ) : isError ? (
            <div className="text-center py-8" style={{ color: isDarkMode ? "#EF4444" : "#DC2626" }}>
              <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">Error Loading Alerts</h3>
              <p>{error?.data?.message || "Failed to load alerts. Please try again."}</p>
            </div>

          ) : displayAlerts.length === 0 ? (
            <div className="text-center py-8" style={{ color: isDarkMode ? "#D1D5DB" : "#6B7280" }}>
              <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2"
                style={{ color: isDarkMode ? "#FFF" : "#1F2937" }}>
                {hasActiveFilters ? "No Alerts Match Filters" : "No Alerts Available"}
              </h3>
              <p>
                {hasActiveFilters
                  ? `No alerts match your filters (${totalCount} total available).`
                  : "No alerts have been generated for this device yet."}
              </p>
            </div>

          ) : (
            <table className={`w-full text-xs text-left border-collapse font-medium
              tracking-wider min-w-[600px]
              ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}
            >
              <thead>
                <tr
                  className="sticky top-0 z-[5]"
                  style={{ backgroundColor: isDarkMode ? "#1F2937" : "#FFFFFF" }}
                >
                  {/* ✅ Fix #3 — TABLE_COLUMNS */}
                  {TABLE_COLUMNS.map((col) => (
                    <th
                      key={col.id}
                      className="py-2 sm:py-3 px-2 sm:px-4 text-center whitespace-nowrap"
                    >
                      {col.name}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {displayAlerts.map((alert, index) => (
                  <tr
                    key={alert.uuid || `alert-${index}`}
                    onClick={() => handleRowClick(alert)}
                    title={!alert.is_read ? "Click to mark as read" : "Already read"}
                    className={`transition-all duration-200 cursor-pointer
                      ${!alert.is_read
                        ? "bg-indigo-500/10 hover:bg-indigo-500/20 border-l-4 border-indigo-500"
                        : isDarkMode
                          ? index % 2 === 0 ? "bg-gray-800 hover:bg-gray-700" : "bg-gray-900 hover:bg-gray-800"
                          : index % 2 === 0 ? "bg-gray-50 hover:bg-gray-100"  : "bg-white hover:bg-gray-50"
                      }`}
                  >
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {formatDateTime(alert.created_at)}
                    </td>
                    <td className="py-3 px-4 text-center font-medium whitespace-nowrap">
                      {alert.alert_type || alert.component}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {/* ✅ Fix #3 — SEVERITY_COLOR */}
                      <span className={`px-2 py-1 rounded-full text-xs font-medium inline-block
                        ${SEVERITY_COLOR[alert.severity] || "bg-gray-100 text-gray-600"}`}
                      >
                        {alert.severity}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center" title={alert.message || alert.description}>
                      <div className="max-w-xs sm:max-w-md break-words text-left">
                        {alert.message || alert.description || alert.details}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default AlertsCard;