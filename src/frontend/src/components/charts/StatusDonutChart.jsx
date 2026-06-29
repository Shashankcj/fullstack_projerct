import React, { useMemo, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { PieChart, Pie, Cell } from 'recharts';

const StatusDonutChart = ({
  title,
  stats = {},
  dataConfig = [],
  centerLabel = 'Total',
  isDarkMode = false,
  onSegmentClick,
  onCardClick,
   total,  
}) => {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  /* =========================
     THEME STYLES
     ========================= */
  const chartData = useMemo(() => {
  // Get the actual sum of the stats
  const actualTotal = dataConfig.reduce((sum, d) => sum + (stats[d.key] ?? 0), 0);

  return dataConfig.map((d) => {
    const value = stats[d.key] ?? 0;
    
    // Safety check: if total is 0, percentage is 0 to avoid NaN
    const percentage = actualTotal > 0 
      ? Number(((value / actualTotal) * 100).toFixed(1)) 
      : 0;

    return {
      key: d.key,
      name: d.label,
      value,
      color: d.color,
      percentage,
    };
  });
}, [stats, dataConfig]);

const totalValue = useMemo(() => {
  const calculatedSum = chartData.reduce((sum, d) => sum + d.value, 0);
  return total ?? calculatedSum;
}, [chartData, total]);


  /* =========================
     CLICK HANDLERS
     ========================= */
  const handleSegmentClick = useCallback(
    (e, item) => {
      e?.stopPropagation();
      if (!item || item.value === 0) return;
      onSegmentClick?.(item.key, item);
    },
    [onSegmentClick]
  );

  return (
    <div
      className="p-6 rounded-lg shadow-md transition-all duration-200 outline-none"
      onClick={onCardClick}
      style={{
        backgroundColor: styles.bg,
        minHeight: 160,
        cursor: onCardClick ? 'pointer' : 'default',
      }}
    >
      {/* TITLE */}
      <h3
        className="text-sm font-medium mb-4"
        style={{ color: styles.label }}
      >
        {title}
      </h3>

      <div className="flex items-center gap-6">
        {/* ======================
            DONUT CHART
           ======================= */}
        <div className="relative outline-none">
          <PieChart
            width={120}
            height={120}
            className="outline-none"
          >
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={32}
              outerRadius={52}
              dataKey="value"
              stroke="none"
              onMouseEnter={(_, index) => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={(data, index, e) =>
                handleSegmentClick(e, chartData[index])
              }
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={entry.key}
                  fill={entry.color}
                  cursor={entry.value > 0 ? 'pointer' : 'default'}
                  className="outline-none"
                  style={{
                    filter:
                      hoveredIndex === index
                        ? `brightness(1.15) drop-shadow(0 0 6px ${entry.color}88)`
                        : hoveredIndex !== null
                        ? 'brightness(0.6)'
                        : 'brightness(1)',
                    transition: 'all 0.25s ease',
                  }}
                />
              ))}
            </Pie>
          </PieChart>

          {/* CENTER LABEL */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span
              className="text-lg font-bold"
              style={{ color: styles.text }}
            >
              {totalValue}
            </span>
            <span
              className="text-xs"
              style={{ color: styles.label }}
            >
              {centerLabel}
            </span>
          </div>
        </div>

        {/* ======================
            LEGEND
           ======================= */}
        <div className="flex-1 space-y-2">
          {chartData.map((item, index) => (
            <div
              key={item.key}
              className="flex items-center justify-between px-3 py-2 rounded-md outline-none"
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={(e) => handleSegmentClick(e, item)}
              style={{
                backgroundColor:
                  hoveredIndex === index ? styles.hoverBg : 'transparent',
                borderLeft:
                  hoveredIndex === index
                    ? `3px solid ${item.color}`
                    : '3px solid transparent',
                cursor: item.value > 0 ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span
                  className="text-sm"
                  style={{ color: styles.label }}
                >
                  {item.name}
                </span>
              </div>

              <span
                className="text-sm font-semibold"
                style={{ color: styles.text }}
              >
                {item.value} ({item.percentage}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

StatusDonutChart.propTypes = {
  title: PropTypes.string.isRequired,
  stats: PropTypes.object.isRequired,
  dataConfig: PropTypes.array.isRequired,
  centerLabel: PropTypes.string,
  isDarkMode: PropTypes.bool,
  onSegmentClick: PropTypes.func,
  onCardClick: PropTypes.func,
};

export default React.memo(StatusDonutChart);
