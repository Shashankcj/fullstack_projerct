import { useState } from "react";

/* =========================
   DONUT CHART
========================= */
const DonutChart = ({
  data,
  isDarkMode,
  size = 100,
  centerValue,   
  centerLabel,   
}) => {
  const total = data.reduce((sum, d) => sum + (Number(d.value) || 0), 0);

  const radius = 48;
  const strokeWidth = 16;
  const circumference = 2 * Math.PI * radius;
  const cx = 60, cy = 60;

  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [tooltip, setTooltip] = useState({
    visible: false,
    x: 0,
    y: 0,
    label: "",
    value: 0,
    color: "",
  });

  // ✅ What to show in the center
  const displayValue  = centerValue  !== undefined ? centerValue  : total;
  const displayLabel  = centerLabel  !== undefined ? centerLabel  : "Servers";

  if (total === 0) {
    return (
      <svg viewBox="0 0 120 120" style={{ width: size, height: size, flexShrink: 0 }}>
        <circle
          cx={cx} cy={cy} r={radius}
          fill="none"
          stroke={isDarkMode ? "#1e2a3a" : "#e5e7eb"}
          strokeWidth={strokeWidth}
        />
        {/* Center text even on empty state */}
        <text
          x={cx} y={cy - 2}
          textAnchor="middle"
          fill={isDarkMode ? "#fff" : "#1e293b"}
          style={{ fontSize: "18px", fontWeight: "bold" }}
        >
          {displayValue}
        </text>
        <text
          x={cx} y={cy + 14}
          textAnchor="middle"
          fill={isDarkMode ? "#64748b" : "#94a3b8"}
          style={{ fontSize: "10px" }}
        >
          {displayLabel}
        </text>
      </svg>
    );
  }

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg viewBox="0 0 120 120" style={{ width: size, height: size }}>
        {/* Background ring */}
        <circle
          cx={cx} cy={cy} r={radius}
          fill="none"
          stroke={isDarkMode ? "#1e2a3a" : "#f1f5f9"}
          strokeWidth={strokeWidth}
        />

        {/* Segments */}
        {data.map((item, i) => {
          const value = Number(item.value) || 0;
          if (value <= 0) return null;

          const percent = value / total;
          const previousTotal = data
            .slice(0, i)
            .reduce((sum, d) => sum + (Number(d.value) || 0), 0);

          const offset = (previousTotal / total) * circumference;
          const gap    = 3;
          const dash   = Math.max(percent * circumference - gap, 0);

          return (
            <circle
              key={i}
              cx={cx} cy={cy} r={radius}
              fill="none"
              stroke={item.color || "#ccc"}
              strokeWidth={hoveredIndex === i ? strokeWidth + 2 : strokeWidth}
              strokeDasharray={`${dash} ${circumference}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${cx} ${cy})`}
              strokeLinecap="round"
              onMouseEnter={(e) => {
                setHoveredIndex(i);
                setTooltip({
                  visible: true,
                  x: e.clientX,
                  y: e.clientY,
                  label: item.label,
                  value,
                  color: item.color,
                });
              }}
              onMouseMove={(e) =>
                setTooltip((prev) => ({ ...prev, x: e.clientX, y: e.clientY }))
              }
              onMouseLeave={() => {
                setHoveredIndex(null);
                setTooltip({ visible: false });
              }}
              onClick={() => item.onClick?.(item)}
              style={{
                cursor: "pointer",
                opacity: hoveredIndex === null || hoveredIndex === i ? 1 : 0.5,
                transition: "all 0.3s ease",
              }}
            />
          );
        })}

        {/* ✅ Center — uses displayValue / displayLabel */}
        <text
          x={cx} y={cy - 2}
          textAnchor="middle"
          fill={isDarkMode ? "#fff" : "#1e293b"}
          style={{ fontSize: "18px", fontWeight: "bold" }}
        >
          {displayValue}
        </text>
        <text
          x={cx} y={cy + 14}
          textAnchor="middle"
          fill={isDarkMode ? "#64748b" : "#94a3b8"}
          style={{ fontSize: "10px" }}
        >
          {displayLabel}
        </text>
      </svg>

      {/* Tooltip */}
      {tooltip.visible && (
        <div
          style={{
            position: "fixed",
            top: tooltip.y + 12,
            left: tooltip.x + 12,
            background: isDarkMode ? "#0f172a" : "#fff",
            color: isDarkMode ? "#fff" : "#111",
            padding: "8px 10px",
            borderRadius: "8px",
            fontSize: "11px",
            fontWeight: "600",
            pointerEvents: "none",
            boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
            zIndex: 9999,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 8, height: 8,
                borderRadius: "50%",
                background: tooltip.color,
                display: "inline-block",
              }}
            />
            {tooltip.label}
          </div>
          <div style={{ opacity: 0.8 }}>
            {tooltip.value} ({Math.round((tooltip.value / total) * 100)}%)
          </div>
        </div>
      )}
    </div>
  );
};

/* =========================
   DONUT CARD
========================= */
const DonutCard = ({
  logo: Logo,
  title,
  data,
  isDarkMode = true,
  showLegend = false,   // ✅ Default FALSE — no legends unless explicitly requested
  centerValue,          // ✅ Pass totalServers here for the Servers donut
  centerLabel,          // ✅ Pass "Total" here for the Servers donut
}) => {
  return (
    <div
      style={{
        minWidth: 0,
        overflow: "hidden",
        borderRadius: "12px",
        padding: "14px",
        background: isDarkMode ? "#1a2035" : "#fff",
        color: isDarkMode ? "#cbd5e1" : "#475569",
        width: "100%",
        boxSizing: "border-box",
        transition: "all 0.2s",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          marginBottom: "12px",
        }}
      >
        {Logo && <Logo style={{ color: "#818cf8", flexShrink: 0 }} size={15} />}
        <span
          style={{
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.06em",
            // textTransform: "uppercase",
            color: "#64748b",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </span>
      </div>

      {/* Body */}
      <div
        style={{
          display: "flex",
          // ✅ When no legend, center the donut horizontally
          flexDirection: "row",
          alignItems: "center",
          justifyContent: showLegend ? "flex-start" : "center",
          gap: "10px",
          minWidth: 0,
        }}
      >
        {/* Chart */}
        <DonutChart
          data={data}
          isDarkMode={isDarkMode}
          size={95}
          centerValue={centerValue}
          centerLabel={centerLabel}
        />

        {/* ✅ Legend — only rendered when showLegend is true */}
        {showLegend && (
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {data.map((item, i) => (
              <div
                key={i}
                onClick={() => item.value > 0 && item.onClick?.(item)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "11px",
                  color: isDarkMode ? "#94a3b8" : "#64748b",
                  opacity: item.value === 0 ? 0.35 : 1,
                  cursor: item.value === 0 ? "default" : "pointer",
                  transition: "all 0.2s",
                  minWidth: 0,
                }}
                onMouseEnter={(e) => {
                  if (item.value > 0) {
                    e.currentTarget.style.color = "#fff";
                    e.currentTarget.style.transform = "translateX(2px)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = isDarkMode ? "#94a3b8" : "#64748b";
                  e.currentTarget.style.transform = "translateX(0)";
                }}
              >
                {/* Dot + Label */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    overflow: "hidden",
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      width: "9px", height: "9px",
                      borderRadius: "50%",
                      background: item.color,
                      flexShrink: 0,
                      boxShadow: item.value > 0 ? `0 0 6px ${item.color}55` : "none",
                      transition: "transform 0.2s",
                    }}
                  />
                  <span
                    style={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {item.label}
                  </span>
                </div>

                {/* Value */}
                <span
                  style={{
                    fontWeight: 700,
                    marginLeft: "4px",
                    flexShrink: 0,
                    color: item.value > 0 ? item.color : "inherit",
                  }}
                >
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* =========================
   DASHBOARD GRID WRAPPER
========================= */
export const DonutCardGrid = ({ children }) => {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
        gap: "12px",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {children}
    </div>
  );
};

export default DonutCard;