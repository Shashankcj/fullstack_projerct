import React from "react";
import { MemoryStick } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useNavigate, useParams } from "react-router-dom";
import { MetricCard } from "./MetricCard";
import { useMetricData } from "../../../../Hooks/useMetricData";
import { useRefreshSettings } from "../../../../Contexts/RefreshContext";

export const MemoryCard = ({ isDarkMode }) => {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const { refreshInterval } = useRefreshSettings();

  const { data: memoryData, loading } = useMetricData({
    endpoint: `/device/memory-utilization/${agentId}/`,
    refreshInterval,
    params: { interval: refreshInterval > 0 ? refreshInterval : 1 },
  });

  const isEmpty = !loading && (!memoryData || memoryData.length === 0);
  const handleCardClick = () => navigate(`/devices/${agentId}/mon/memory`);

  return (
    <MetricCard
      isDarkMode={isDarkMode}
      title="Memory Usage"
      Icon={MemoryStick}
      isEmpty={isEmpty}
      emptyText="No memory data available"
      onClick={handleCardClick}
      loading={loading}
    >
      {/* Chart */}
      <div className="flex-1 min-h-0" onClick={(e) => e.stopPropagation()}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={memoryData} margin={{ left: 11, right: 11 }}>
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
            <Area
              type="monotone"
              dataKey="value"
              stroke="#3B82F6"
              fill="#93C5FD"
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
            />
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