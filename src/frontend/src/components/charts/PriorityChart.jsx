import React, { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';

/* Fixed priority order */
const PRIORITY_ORDER = ['p1', 'p2', 'p3', 'p4', 'np'];

const PriorityChart = ({
  title = 'Priority Distribution',
  data = [],
  priorityKey = 'priority',
  isDarkMode = false,
  priorityColors = {
    p1: '#d0249cff',
    p2: '#F59E0B',
    p3: '#10B981',
    p4: '#3B82F6',
    np: '#6B7280', 
  },
  onBarClick,
}) => {
  const containerRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(200);
  const [tooltip, setTooltip] = useState(null);

  const chartHeight = 220;

  /* Margins */
  const margin = { top: 10, right: 10, bottom: 50, left: 46 };
  const innerWidth = chartWidth - margin.left - margin.right;
  const innerHeight = chartHeight - margin.top - margin.bottom;
  const barPadding = 20;

  /* Theme */
  const bgColor = isDarkMode ? '#1F2937' : '#FFFFFF';
  const borderColor = isDarkMode ? '#374151' : '#E5E7EB';
  const labelColor = isDarkMode ? '#FFFFFF' : '#6B7280';
  const axisLabelColor = isDarkMode ? '#D1D5DB' : '#374151';
  const gridColor = isDarkMode ? '#374151' : '#E5E7EB';

  /* =========================
     DATA NORMALIZATION
     ========================= */
  const processedData = useMemo(() => {
  const map = {};

  data.forEach(item => {
    const raw = (item?.[priorityKey] || '').toString().toLowerCase();

    let key = null;

    if (/p1/.test(raw)) key = 'p1';
    else if (/p2/.test(raw)) key = 'p2';
    else if (/p3/.test(raw)) key = 'p3';
    else if (/p4/.test(raw)) key = 'p4';
    else if (raw === 'np') key = 'np';
    // "" and any other unknown value → key = null → ignored

    if (key) {
      if (!map[key]) {
        map[key] = {
          priority: key,
          count: 0,
          label: key.toUpperCase(),
        };
      }
      map[key].count += item?.count ?? item?.value ?? 0;
    }
  });

  return PRIORITY_ORDER.map(p => ({
    priority: p,
    count: map[p]?.count ?? 0,
    label: map[p]?.label ?? p.toUpperCase(),
  }));
}, [data, priorityKey]);


  /* =========================
     PERCENTAGE
     ========================= */
  const totalCount = useMemo(
    () => processedData.reduce((sum, d) => sum + d.count, 0),
    [processedData]
  );

  const finalData = useMemo(
    () =>
      processedData.map(d => ({
        ...d,
        percentage: totalCount
          ? Math.round((d.count / totalCount) * 100)
          : 0,
      })),
    [processedData, totalCount]
  );

  /* =========================
     RESIZE OBSERVER
     ========================= */
  useEffect(() => {
    const ro = new ResizeObserver(entries => {
      setChartWidth(entries[0].contentRect.width);
    });

    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const yTicks = [0, 25, 50, 75, 100];
  const barWidth = innerWidth / PRIORITY_ORDER.length - barPadding;

  return (
    <div
      ref={containerRef}
      className="p-6 rounded-lg shadow-md relative"
      style={{ backgroundColor: bgColor, border: `1px solid ${borderColor}` }}
    >
      <h3 className="text-lg font-semibold mb-4" style={{ color: labelColor }}>
        {title}
      </h3>

      <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
        {/* Y Axis */}
        {yTicks.map(y => (
          <text
            key={y}
            x={margin.left - 10}
            y={margin.top + innerHeight - (y / 100) * innerHeight + 4}
            textAnchor="end"
            fill={axisLabelColor}
            fontSize="11"
            fontWeight="600"
          >
            {y}%
          </text>
        ))}

        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {/* Grid */}
          {yTicks.map(y => (
            <line
              key={y}
              x1="0"
              x2={innerWidth}
              y1={innerHeight - (y / 100) * innerHeight}
              y2={innerHeight - (y / 100) * innerHeight}
              stroke={gridColor}
              strokeDasharray="3"
            />
          ))}

          {/* Bars */}
          {finalData.map((d, i) => {
            const barHeight = (d.percentage / 100) * innerHeight;
            const x = i * (barWidth + barPadding);
            const y = innerHeight - barHeight;
            const color = priorityColors[d.priority];

            return (
              <g key={d.priority}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx="4"
                  fill={color}
                  opacity={d.count === 0 ? 0.25 : 0.85}
                  style={{
                    cursor:
                      d.count > 0 && onBarClick ? 'pointer' : 'default',
                  }}
                  onClick={() => d.count > 0 && onBarClick?.(d.priority)}
                  onMouseEnter={e => {
                    if (d.count === 0) return;
                    const rect = containerRef.current.getBoundingClientRect();
                    setTooltip({
                      ...d,
                      left: e.clientX - rect.left,
                      top: e.clientY - rect.top,
                    });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />

                {/* X Label */}
                <text
                  x={x + barWidth / 2}
                  y={innerHeight + 24}
                  textAnchor="middle"
                  fill={labelColor}
                  fontSize="12"
                  fontWeight="600"
                >
                  {d.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute px-3 py-2 rounded-lg text-xs shadow-xl pointer-events-none"
          style={{
            left: tooltip.left,
            top: tooltip.top - 10,
            transform: 'translate(-50%, -100%)',
            backgroundColor: bgColor,
            border: `1px solid ${priorityColors[tooltip.priority]}`,
            color: labelColor,
          }}
        >
          <div
            className="font-semibold"
            style={{ color: priorityColors[tooltip.priority] }}
          >
            {tooltip.label}
          </div>
          <div>{tooltip.count} items</div>
          <div>{tooltip.percentage}%</div>
        </div>
      )}
    </div>
  );
};

PriorityChart.propTypes = {
  title: PropTypes.string,
  data: PropTypes.array.isRequired,
  priorityKey: PropTypes.string,
  isDarkMode: PropTypes.bool,
  priorityColors: PropTypes.object,
  onBarClick: PropTypes.func,
};

export default React.memo(PriorityChart);
