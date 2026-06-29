import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { RefreshCcw, Monitor, Activity, ChevronDown } from "lucide-react";
import { useRefreshSettings } from "../../../../Contexts/RefreshContext";
import PriorityBadge from "../../../../components/shared/priorityBadge";
import { PRIORITY_CONFIG } from "../../../../components/Utilities/priority_config";
import StatusBadge from "../../../../components/shared/StatusBadge";
import PageHeader from "../../../../components/Utilities/PageHeader";
import { DEVICE_TABS } from "../../../../components/Utilities/deviceTabs";
import PropTypes from "prop-types";
import { useNavigate, useLocation, useParams } from "react-router-dom";

const REFRESH_CHOICES = [1, 2, 5, 15, 30];

const normalizePriority = (rawPriority) => {
  if (rawPriority === "") return "---";
  if (rawPriority === "np") return "np";
  if (!rawPriority || typeof rawPriority !== "string") return "---";
  const lower = rawPriority.toLowerCase();
  if (lower.includes("p1")) return "p1";
  if (lower.includes("p2")) return "p2";
  if (lower.includes("p3")) return "p3";
  if (lower.includes("p4")) return "p4";
  return "---";
};

export const DeviceSummaryCard = ({ isDarkMode, device, onRefresh }) => {
  const { agentId } = useParams();
  const deviceName = device?.hostname || device?.name || "Unknown Device";
  const deviceStatus = device?.status || "Unknown";
  const priorityKey = normalizePriority(device?.priority);
  const priorityDisplay = PRIORITY_CONFIG[priorityKey] || PRIORITY_CONFIG.default;

  const { refreshInterval, setRefreshInterval } = useRefreshSettings();
  const dropdownRef = useRef(null);
  const intervalRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const activeTab = useMemo(() => {
    const found = DEVICE_TABS.find((tab) =>
      tab.suffix ? location.pathname.endsWith(tab.suffix) : location.pathname === `/devices/${agentId}`
    );
    return found?.suffix ?? "";
  }, [location.pathname, agentId]);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") setDropdownOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing || !onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } catch (err) {
      console.error("[DeviceSummaryCard] Refresh failed:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, onRefresh]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (refreshInterval) {
      intervalRef.current = setInterval(handleRefresh, refreshInterval * 60000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refreshInterval, handleRefresh]);

  const handleInterval = (minutes) => {
    setRefreshInterval(minutes);
    setDropdownOpen(false);
  };

  const handleTabChange = useCallback(
    (tab) => {
      // if (!tab.suffix) {
      //   navigate(`${agentId}`);
      //   return;
      // }
      navigate(`${tab.suffix}`);
    },
    [navigate, agentId]
  );

  const leftSlot = (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center flex-shrink-0">
          <Monitor className="w-5 h-5 text-white" />
        </div>
        <h1
          title={deviceName}
          className={`text-lg sm:text-xl font-bold truncate ${
            isDarkMode ? "text-white" : "text-gray-900"
          }`}
        >
          {deviceName}
        </h1>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Activity className={`w-4 h-4 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`} />
        <span className={`hidden sm:block text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
          Status:
        </span>
        <StatusBadge status={deviceStatus} isDarkMode={isDarkMode} />
        <PriorityBadge priority={priorityDisplay.key} isDarkMode={isDarkMode} />
      </div>
    </div>
  );

  const rightSlot = (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen((prev) => !prev)}
        className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg px-4 py-2.5 text-sm transition-colors"
      >
        <RefreshCcw className={`w-4 h-4 transition-transform ${isRefreshing ? "animate-spin" : ""}`} />
        <span>Refresh</span>
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
      </button>

      {dropdownOpen && (
        <div
          className={`absolute top-full right-0 mt-2 w-56 rounded-lg border shadow-xl z-50 ${
            isDarkMode ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200"
          }`}
        >
          <button
            onClick={() => {
              handleRefresh();
              setDropdownOpen(false);
            }}
            className={`w-full text-left px-4 py-3 text-sm ${
              isDarkMode ? "text-gray-200 hover:bg-gray-800" : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            Refresh Now
          </button>

          <div className={`border-t ${isDarkMode ? "border-gray-700" : "border-gray-100"}`} />

          {REFRESH_CHOICES.map((value) => (
            <button
              key={value}
              onClick={() => handleInterval(value)}
              className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                refreshInterval === value
                  ? "font-semibold text-indigo-500"
                  : isDarkMode
                    ? "text-gray-300 hover:bg-gray-800"
                    : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              Every {value} minute{value > 1 ? "s" : ""}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <PageHeader
      isDarkMode={isDarkMode}
      leftSlot={leftSlot}
      rightSlot={rightSlot}
      tabs={DEVICE_TABS}
      activeTab={activeTab}
      onTabChange={handleTabChange}
    />
  );
};

DeviceSummaryCard.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
  device: PropTypes.object.isRequired,
  onRefresh: PropTypes.func.isRequired,
};

export default DeviceSummaryCard;