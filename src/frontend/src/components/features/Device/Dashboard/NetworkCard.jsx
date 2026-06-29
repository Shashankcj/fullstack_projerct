import React, { useState, useEffect, useRef } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Network, ChevronDown } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { MetricCard } from "./MetricCard";
import { useMetricData } from "../../../../Hooks/useMetricData";
import { useRefreshSettings } from "../../../../Contexts/RefreshContext";

export const NetworkCard = ({ isDarkMode }) => {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const { refreshInterval } = useRefreshSettings();

  const [selectedInterface, setSelectedInterface] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  /* ── Fetch ── */
  const { data: networkPortMap, loading } = useMetricData({
    endpoint: `/device/network-utilization/${agentId}/`,
    refreshInterval,
    defaultValue: {},
    params: { interval: refreshInterval > 0 ? refreshInterval : 1 },
  });

  /* ── Helpers ── */
  const interfaces = Object.keys(networkPortMap || {});
  const networkData = networkPortMap?.[selectedInterface] || [];
  const isEmpty = !loading && (!interfaces.length || !networkData.length);
  const handleCardClick = () => navigate(`/devices/${agentId}/mon/network`);

  /* ── Set default interface ── */
  useEffect(() => {
    if (interfaces.length && !selectedInterface) setSelectedInterface(interfaces[0]);
  }, [interfaces, selectedInterface]);

  /* ── Outside click ── */
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ── Dropdown ── */
  const dropdown = !isEmpty && (
    <div className="relative" ref={dropdownRef} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => { e.stopPropagation(); setIsDropdownOpen((p) => !p); }}
        className={`flex items-center justify-between px-3 py-1.5 text-xs border rounded-md cursor-pointer min-w-[80px] ${
          isDarkMode ? "bg-gray-700 text-gray-200 border-gray-600" : "bg-white text-gray-700 border-gray-300"
        } ${isDropdownOpen ? "ring-2 ring-blue-500 ring-opacity-50" : ""}`}
      >
        <span>{selectedInterface || "Select"}</span>
        <ChevronDown className={`w-3 h-3 ml-1 ${isDropdownOpen ? "rotate-180" : ""}`} />
      </button>

      <div className={`absolute right-0 top-full mt-1 w-full min-w-[80px] rounded-md shadow-lg border z-50 ${
        isDarkMode ? "bg-gray-700 border-gray-600" : "bg-white border-gray-200"
      } ${isDropdownOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        <div className="py-1 max-h-32 overflow-y-auto custom-scroll">
          {interfaces.map((iface) => (
            <button
              key={iface}
              onClick={(e) => { e.stopPropagation(); setSelectedInterface(iface); setIsDropdownOpen(false); }}
              className={`w-full text-left px-3 py-2 text-xs ${
                selectedInterface === iface
                  ? "bg-[#6366f1] text-white"
                  : isDarkMode ? "text-gray-200 hover:bg-gray-600" : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              {iface}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  /* ── UI ── */
  return (
    <MetricCard
      isDarkMode={isDarkMode}
      title="Network Traffic"
      Icon={Network}
      headerAction={dropdown}
      isEmpty={isEmpty}
      emptyText="No network data available"
      onClick={handleCardClick}
      loading={loading}
    >
      {/* Chart */}
      <div className="flex-1 min-h-0" onClick={(e) => e.stopPropagation()}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={networkData} margin={{ left: 11, right: 11 }}>
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} interval={0} />
            <YAxis domain={[0, 100]} hide />
            <Tooltip
              contentStyle={{
                padding: "2px 6px",
                fontSize: "11px",
                backgroundColor: isDarkMode ? "#1F2937" : "#F9FAFB",
                borderRadius: "4px",
                border: "1px solid #ccc",
              }}
              itemStyle={{ margin: 0 }}
              labelStyle={{ display: "none" }}
              labelFormatter={(label) => `Time: ${label}`}
              formatter={(value) => [`${value}%`, "Usage"]}
            />
            <Area type="monotone" dataKey="value" stroke="#3B82F6" fill="#93C5FD" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Footer */}
      <div className="flex justify-end -mt-1">
        <button onClick={handleCardClick} className="text-xs text-blue-500 hover:text-blue-600 cursor-pointer">
          View details
        </button>
      </div>
    </MetricCard>
  );
};