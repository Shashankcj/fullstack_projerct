import React, { useState, useEffect, useRef } from "react";
import { HardDrive, ChevronDown } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { useNavigate, useParams } from "react-router-dom";
import { MetricCard } from "./MetricCard";
import { useMetricData } from "../../../../Hooks/useMetricData";
import { useRefreshSettings } from "../../../../Contexts/RefreshContext";

/* ── TOOLTIP ── */
const CustomTooltip = ({ active, payload, isDarkMode }) => {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div
      className="px-3 py-2 rounded border text-xs shadow-lg"
      style={{
        backgroundColor: isDarkMode ? "#1F2937" : "#FFFFFF",
        borderColor: isDarkMode ? "#4B5563" : "#E5E7EB",
        color: isDarkMode ? "#E5E7EB" : "#1F2937",
      }}
    >
      <div className="flex items-center mb-1">
        <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: item.color }} />
        <strong>{item.name}</strong>
      </div>
      <div>{item.value} GB</div>
    </div>
  );
};

/* ── COMPONENT ── */
export const DiskUsageCard = ({ isDarkMode }) => {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const { refreshInterval } = useRefreshSettings();

  const [selectedDisk, setSelectedDisk] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  /* ── Fetch ── */
  const { data: diskData, loading } = useMetricData({
    endpoint: `/device/disk-usage/${agentId}/`,
    refreshInterval,
  });

  /* ── Data ── */
  const filteredData = Array.isArray(diskData) ? diskData.filter((d) => !d?.is_flagged) : [];
  const diskNames = filteredData.map((d, i) => d?.mount_point || d?.name || `Disk ${i + 1}`);

  useEffect(() => {
    if (selectedDisk >= filteredData.length) setSelectedDisk(0);
  }, [selectedDisk, filteredData.length]);

  /* ── Outside click ── */
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ── Helpers ── */
  const parseGB = (val) => parseFloat(val?.toString().replace("GB", "").trim()) || 0;
  const disk = filteredData[selectedDisk];

  const chartData = [
    { name: "Used",        value: parseGB(disk?.total_disk_usage),      color: "#4F46E5" },
    { name: "Free",        value: parseGB(disk?.free_space),            color: "#E5E7EB" },
    { name: "Unallocated", value: parseGB(disk?.unallocated_disk_size), color: "#9CA3AF" },
  ];

  const total = parseGB(disk?.total_disk_size);
  const isEmpty = !loading && !filteredData.length;
  const handleCardClick = () => navigate(`/devices/${agentId}/mon/disk`);

  /* ── Dropdown ── */
  const dropdown = (
    <div ref={dropdownRef} onClick={(e) => e.stopPropagation()} className="relative">
      <button
        type="button"
        onClick={() => setIsDropdownOpen((prev) => !prev)}
        className={`flex items-center justify-between px-3 py-1.5 text-xs border rounded-md min-w-[100px] ${
          isDarkMode ? "bg-gray-700 text-gray-200 border-gray-600" : "bg-white text-gray-700 border-gray-300"
        }`}
      >
        <span className="truncate max-w-[80px]">{diskNames[selectedDisk]}</span>
        <ChevronDown className={`w-3 h-3 ml-1 transition ${isDropdownOpen ? "rotate-180" : ""}`} />
      </button>

      {isDropdownOpen && (
        <div className={`absolute right-0 mt-1 min-w-full rounded-md shadow-lg border z-50 ${
          isDarkMode ? "bg-gray-700 border-gray-600" : "bg-white border-gray-200"
        }`}>
          {diskNames.map((name, index) => (
            <button
              key={index}
              onClick={() => { setSelectedDisk(index); setIsDropdownOpen(false); }}
              className={`w-full text-left px-3 py-2 text-xs ${
                selectedDisk === index
                  ? "bg-indigo-500 text-white"
                  : isDarkMode ? "text-gray-200 hover:bg-gray-600" : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  /* ── UI ── */
  return (
    <MetricCard
      isDarkMode={isDarkMode}
      title="Disk Usage"
      Icon={HardDrive}
      headerAction={dropdown}
      loading={loading}
      isEmpty={isEmpty}
      emptyText="No disk data available"
      onClick={handleCardClick}
    >
      {/* Chart */}
      <div className="flex-1 flex items-center justify-center relative min-h-0">
        <div className="w-[35%] aspect-square min-w-[90px] max-w-[120px]">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                cx="50%" cy="50%"
                innerRadius="75%" outerRadius="100%"
                stroke="none"
                onMouseEnter={(_, i) => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {chartData.map((item, i) => (
                  <Cell
                    key={i}
                    fill={item.color}
                    opacity={hoveredIndex === null || hoveredIndex === i ? 1 : 0.7}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip isDarkMode={isDarkMode} />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-sm font-semibold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
            {total} GB
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-end text-xs">
        <div className="space-y-0.5 text-[11px]">
          {chartData.map((item) => (
            <div key={item.name} className="flex items-center">
              <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: item.color }} />
              <span className={isDarkMode ? "text-gray-300" : "text-gray-600"}>
                {item.name} {item.value} GB
              </span>
            </div>
          ))}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); handleCardClick(); }}
          className="text-xs text-blue-500 hover:text-blue-600"
        >
          View details
        </button>
      </div>
    </MetricCard>
  );
};