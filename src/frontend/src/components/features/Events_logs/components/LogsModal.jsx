import { useCallback, useMemo } from "react";
import { X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDateTime } from "../../../Utilities/formatDateTime";


/* ================= STATIC CONSTANTS — outside component ================= */
// ✅ Fix #2 — EVENT_TYPE_DISPLAY moved outside (was used before defined — TDZ bug)

const EVENT_TYPE_DISPLAY = {
  MON_DATA:     "Monitoring Data",
  INFO:         "Info",
  ALERT:        "Alert",
  ERROR:        "Error",
  UPDATE:       "Update",
  DELETE:       "Delete",
  CREATE:       "Create",
  CONNECTION:   "Connection",
  DISCONNECT:   "Disconnect",
};

const timeAgo = (dateString) => {
  const now  = Date.now();
  const then = new Date(dateString).getTime();
  const diff = Math.round((now - then) / 1000);
  if (diff < 60)    return `${diff} seconds ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  return `${Math.floor(diff / 86400)} days ago`;
};


/* ================= COMPONENT ================= */

const LogsModal = ({
  isOpen,
  onClose,
  data,
  isDarkMode,
  title = "Alert Details",
  type  = "alert",
}) => {
  const navigate = useNavigate();


  /* -------------------- DERIVED VALUES -------------------- */
  const normalizedData = useMemo(() => {
  if (!data) return null;

  return {
    device_name: data.device_name || data.hostname || "Unknown",
    component: data.alert_type || data.component_type || data.component || "General",
    severity: data.severity || "Info",
    message: data.message || data.description || "No details available",
    created_at: data.created_at || data.time || new Date().toISOString(),
    device_uuid: data.agent || null,

    // ✅ ADD THIS
    priority:
      data.priority ||
      data.priority_level ||
      data.raw_data?.priority ||
      "np",

    id: data.uuid || data.id,
    raw_data: data.raw_data || data.extra_data || null,
  };
}, [data]);

  const getSeverityColor = useCallback((severity) => {
    switch (severity) {
      case "Critical": return isDarkMode ? "#F87171" : "#DC2626";
      case "Warning":  return isDarkMode ? "#FBBF24" : "#D97706";
      case "Info":     return isDarkMode ? "#60A5FA" : "#2563EB";
      case "Success":  return isDarkMode ? "#34D399" : "#059669";
      default:         return isDarkMode ? "#CBD5E1" : "#64748B";
    }
  }, [isDarkMode]);

  const getModalTitle = useCallback(() => {
    if (type === "event") return EVENT_TYPE_DISPLAY[data?.event_type] || "Event Details";
    return title;
  }, [type, data?.event_type, title]);

  const handleDeviceClick = useCallback((e) => {
  e.stopPropagation();

  if (!normalizedData?.device_uuid) return;

  navigate(
    `/dashboard/${normalizedData.priority}/devices/${normalizedData.device_uuid}`
  );

  onClose();
}, [normalizedData, navigate, onClose]);


  /* -------------------- EARLY RETURN — after all hooks -------------------- */
  if (!isOpen || !normalizedData) return null;


  /* -------------------- RENDER -------------------- */
  const severityColor = getSeverityColor(normalizedData.severity);

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center backdrop-blur-sm"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.1)" }}
      onClick={onClose}
    >
      <div
        className="rounded-xl p-6 max-w-xl w-full relative shadow-2xl border"
        style={{
          background:           isDarkMode ? "rgba(15, 23, 42, 0.8)"     : "rgba(246, 245, 248, 1)",
          borderColor:          isDarkMode ? "rgba(51, 65, 85, 0.4)"     : "rgba(203, 213, 225, 0.3)",
          backdropFilter:       "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        >
          <X size={20} />
        </button>

        {/* Title */}
        <h2
          className="text-xl font-semibold mb-5"
          style={{ color: isDarkMode ? "#F1F5F9" : "#1E293B" }}
        >
          {getModalTitle()}
        </h2>

        {/* Scrollable Content */}
        {/* ✅ Fix #5 + #8 — removed inline <style> tag; use Tailwind utility + inline style */}
        <div
          className="max-h-80 overflow-y-auto space-y-2 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >

          {/* Device Info Card — Clickable */}
          <div
            className="p-3 rounded-md cursor-pointer hover:bg-opacity-80 transition-all duration-200"
            style={{
              color:      isDarkMode ? "#E2E8F0" : "#334155",
              background: isDarkMode ? "rgba(17,24,39,0.3)" : "rgba(248,250,252,0.8)",
            }}
            onClick={handleDeviceClick}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase mb-1" style={{ color: isDarkMode ? "#94A3B8" : "#64748B" }}>
                  Device
                </div>
                <div className="font-medium text-base hover:text-blue-500 transition-colors">
                  {normalizedData.device_name}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase mb-1" style={{ color: isDarkMode ? "#94A3B8" : "#64748B" }}>
                  Component
                </div>
                <div className="font-medium text-base">{normalizedData.component}</div>
              </div>
              <div>
                <div className="text-xs uppercase mb-1" style={{ color: isDarkMode ? "#94A3B8" : "#64748B" }}>
                  Severity
                </div>
                <span
                  className="inline-block px-3 py-1 rounded-full text-xs font-semibold"
                  style={{
                    background: `${severityColor}22`,
                    color:       severityColor,
                    border:      `1px solid ${severityColor}44`,
                  }}
                >
                  {normalizedData.severity}
                </span>
              </div>
            </div>
            <div className="mt-2 text-xs opacity-60 hover:opacity-100 transition-opacity">
              Click to view device details →
            </div>
          </div>

          {/* Divider */}
          <div className="h-px my-2" style={{ background: isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" }} />

          {/* Time Card */}
          <div
            className="p-3 rounded-md"
            style={{
              color:      isDarkMode ? "#E2E8F0" : "#334155",
              background: isDarkMode ? "rgba(17,24,39,0.3)" : "rgba(248,250,252,0.8)",
            }}
          >
            <div className="text-xs uppercase mb-1" style={{ color: isDarkMode ? "#94A3B8" : "#64748B" }}>
              Time
            </div>
            <div className="font-medium">
              {formatDateTime(normalizedData.created_at)}
              <span className="ml-2 text-xs font-normal" style={{ color: "#94A3B8" }}>
                &middot; {timeAgo(normalizedData.created_at)}
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px my-2" style={{ background: isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" }} />

          {/* Message Card */}
          <div
            className="p-3 rounded-md"
            style={{
              color:      isDarkMode ? "#E2E8F0" : "#334155",
              background: isDarkMode ? "rgba(17,24,39,0.3)" : "rgba(248,250,252,0.8)",
            }}
          >
            <div className="text-xs uppercase mb-2" style={{ color: isDarkMode ? "#94A3B8" : "#64748B" }}>
              Message
            </div>
            <p className="font-medium leading-relaxed">{normalizedData.message}</p>
          </div>

          {/* Raw Data (if available) */}
          {normalizedData.raw_data && (
            <>
              <div className="h-px my-2" style={{ background: isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" }} />
              <div className="p-3 rounded-md text-xs">
                <div
                  className="text-xs uppercase mb-2 font-semibold"
                  style={{ color: isDarkMode ? "#94A3B8" : "#64748B" }}
                >
                  Raw Data
                </div>
                <pre className="bg-gray-900/50 dark:bg-gray-800/70 p-3 rounded text-xs overflow-x-auto font-mono text-gray-300 max-h-32">
                  {JSON.stringify(normalizedData.raw_data, null, 2)}
                </pre>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
};

export default LogsModal;