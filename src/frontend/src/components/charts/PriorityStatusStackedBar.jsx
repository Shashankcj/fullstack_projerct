import React, { useMemo } from "react";
import PropTypes from "prop-types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  LabelList,
} from "recharts";

/* =========================
   CONSTANTS
   ========================= */
const PRIORITY_ORDER = ["P1", "P2", "P3", "P4"];

const normalizePriority = (value = "") => {
  const match = value.match(/P[1-4]/i);
  return match ? match[0].toUpperCase() : null;
};

const PriorityStatusStackedBar = ({
  title,
  data,
  activeLabel,
  inactiveLabel,
  isDarkMode = false,
}) => {
  /* =========================
     COLORS
     ========================= */
  const colors = {
    active: "#10B981",
    inactive: "#EF4444",
    bg: isDarkMode ? "#1F2937" : "#FFFFFF",
    grid: isDarkMode ? "#374151" : "#E5E7EB",
    text: isDarkMode ? "#E5E7EB" : "#6B7280",
    tooltip: isDarkMode ? "#111827" : "#FFFFFF",
  };

  /* =========================
     NORMALIZED DATA (P1–P4)
     ========================= */
  const normalizedData = useMemo(() => {
    const map = new Map();

    data.forEach(item => {
      const key = normalizePriority(item.priority);
      if (key) {
        map.set(key, {
          priority: key,
          active: item.active ?? 0,
          inactive: item.inactive ?? 0,
        });
      }
    });

    return PRIORITY_ORDER.map(priority => ({
      priority,
      active: map.get(priority)?.active ?? 0,
      inactive: map.get(priority)?.inactive ?? 0,
    }));
  }, [data]);

  /* =========================
     X-AXIS CONTROL (NO DECIMALS)
     ========================= */
  const maxValue = Math.max(
    ...normalizedData.map(d => d.active + d.inactive),
    1
  );

  /* =========================
     RENDER
     ========================= */
  return (
    <div
      className="p-5 rounded-lg shadow-md"
      style={{
        backgroundColor: colors.bg,
        border: `1px solid ${colors.grid}`,
        height: 260,
      }}
    >
      <h3
        className="text-sm font-medium mb-3"
        style={{ color: colors.text }}
      >
        {title}
      </h3>

      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={normalizedData}
          layout="vertical"
          margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
        >
          {/* Grid */}
          <CartesianGrid
            horizontal
            vertical={false}
            stroke={colors.grid}
            strokeDasharray="4 4"
          />

          {/* X Axis (INTEGER ONLY) */}
          <XAxis
            type="number"
            domain={[0, maxValue]}
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            tick={{ fill: colors.text, fontSize: 11 }}
          />

          {/* Y Axis */}
          <YAxis
            type="category"
            dataKey="priority"
            axisLine={false}
            tickLine={false}
            tick={{ fill: colors.text, fontSize: 12 }}
            width={45}
            ticks={PRIORITY_ORDER}
          />

          {/* Tooltip */}
          <Tooltip
            cursor={{ fill: isDarkMode ? "#111827" : "#F3F4F6" }}
            contentStyle={{
              backgroundColor: colors.tooltip,
              border: `1px solid ${colors.grid}`,
              color: colors.text,
              fontSize: 12,
            }}
            formatter={(value) => (value > 0 ? value : "No data")}
          />

          {/* Legend */}
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            wrapperStyle={{ fontSize: 12, color: colors.text }}
          />

          {/* Active Bar */}
          <Bar
            dataKey="active"
            stackId="a"
            fill={colors.active}
            name={activeLabel}
            barSize={10}
            radius={[0, 6, 6, 0]}
          >
            <LabelList
              dataKey="active"
              position="insideRight"
              fill="#FFFFFF"
              fontSize={10}
              formatter={(value) => (value > 0 ? value : null)}
            />
          </Bar>

          {/* Inactive Bar */}
          <Bar
            dataKey="inactive"
            stackId="a"
            fill={colors.inactive}
            name={inactiveLabel}
            barSize={10}
            radius={[0, 6, 6, 0]}
          >
            <LabelList
              dataKey="inactive"
              position="insideRight"
              fill="#FFFFFF"
              fontSize={10}
              formatter={(value) => (value > 0 ? value : null)}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

/* =========================
   PROPS
   ========================= */
PriorityStatusStackedBar.propTypes = {
  title: PropTypes.string.isRequired,
  data: PropTypes.arrayOf(
    PropTypes.shape({
      priority: PropTypes.string.isRequired,
      active: PropTypes.number,
      inactive: PropTypes.number,
    })
  ).isRequired,
  activeLabel: PropTypes.string.isRequired,
  inactiveLabel: PropTypes.string.isRequired,
  isDarkMode: PropTypes.bool,
};

export default React.memo(PriorityStatusStackedBar);
