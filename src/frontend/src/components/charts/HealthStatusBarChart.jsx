import React, { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';

/* ✅ Same fixed order as PriorityChart */
const PRIORITY_ORDER = ['p1', 'p2', 'p3', 'p4', 'np'];

const HealthStatusBarChart = ({
  title = 'Health Status Distribution',
  data = [],
  isDarkMode = false,
  tooltipLabel = 'items',
  onBarClick,
}) => {
  const containerRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(200);
  const [tooltip, setTooltip] = useState(null);

  const chartHeight = 220;
  const margin = { top: 10, right: 10, bottom: 50, left: 46 };
  const innerWidth  = chartWidth - margin.left - margin.right;
  const innerHeight = chartHeight - margin.top - margin.bottom;
  const barPadding  = 20;

  const bgColor       = isDarkMode ? '#1F2937' : '#FFFFFF';
  const borderColor   = isDarkMode ? '#374151' : '#E5E7EB';
  const labelColor    = isDarkMode ? '#FFFFFF' : '#6B7280';
  const axisLabelColor= isDarkMode ? '#D1D5DB' : '#374151';
  const gridColor     = isDarkMode ? '#374151' : '#E5E7EB';
  const emptyBarColor = isDarkMode ? '#374151' : '#E5E7EB';

  const statusColors = {
    healthy:  '#10B981',
    warning:  '#F59E0B',
    critical: '#EF4444',
  };

  /* ✅ STEP 1 — Normalize incoming data to fixed PRIORITY_ORDER slots
       Same logic as PriorityChart's processedData useMemo             */
  const normalizedData = useMemo(() => {
    const map = {};

    data.forEach(item => {
      const raw = (item?.priority || '').toString().toLowerCase();

      let key = null;
      if (/p1/.test(raw))      key = 'p1';
      else if (/p2/.test(raw)) key = 'p2';
      else if (/p3/.test(raw)) key = 'p3';
      else if (/p4/.test(raw)) key = 'p4';
      else if (raw === 'np' || raw === 'no priority') key = 'np';

      if (key) {
        map[key] = {
          priority: key,
          label:    key.toUpperCase(),
          healthy:  item.healthy  ?? 0,
          warning:  item.warning  ?? 0,
          critical: item.critical ?? 0,
        };
      }
    });

    /* Always return all 5 slots — missing ones get zero values */
    return PRIORITY_ORDER.map(p => ({
      priority: p,
      label:    p.toUpperCase(),
      healthy:  map[p]?.healthy  ?? 0,
      warning:  map[p]?.warning  ?? 0,
      critical: map[p]?.critical ?? 0,
      total:    (map[p]?.healthy ?? 0) + (map[p]?.warning ?? 0) + (map[p]?.critical ?? 0),
    }));
  }, [data]);

  /* ✅ STEP 2 — Stack generator using normalizedData */
  const stackedData = useMemo(() => {
    return normalizedData.map(d => {
      let y0 = 0;
      const statuses = {};
      ['healthy', 'warning', 'critical'].forEach(key => {
        const value = d[key] ?? 0;
        statuses[key] = [y0, (y0 += value)];
      });
      return { ...d, statuses };
    });
  }, [normalizedData]);

  const maxTotal = useMemo(
    () => Math.max(...stackedData.map(d => d.total), 1),
    [stackedData]
  );

  useEffect(() => {
    const ro = new ResizeObserver(entries => {
      setChartWidth(entries[0].contentRect.width);
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const yTicks = [0, 25, 50, 75, 100];

  /* ✅ STEP 3 — Fixed bar width using PRIORITY_ORDER.length (always 5)
       Identical formula to PriorityChart                              */
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
              x1="0" x2={innerWidth}
              y1={innerHeight - (y / 100) * innerHeight}
              y2={innerHeight - (y / 100) * innerHeight}
              stroke={gridColor}
              strokeDasharray="3"
            />
          ))}

          {stackedData.map((d, i) => {
            const x = i * (barWidth + barPadding);

            return (
              <g key={d.priority}>

                {/* ✅ STEP 4 — Empty stub bar for zero-total priorities
                    Mirrors PriorityChart's opacity:0.25 pattern        */}
                {d.total === 0 && (
                  <rect
                    x={x}
                    y={innerHeight - 4}
                    width={barWidth}
                    height={4}
                    rx="2"
                    fill={emptyBarColor}
                    opacity={0.5}
                  />
                )}

                {/* Stacked segments — only for priorities with data */}
                {d.total > 0 && Object.entries(d.statuses).map(([status, [y0, y1]]) => {
                  if (y1 === y0) return null;

                  const segmentHeight = innerHeight * ((y1 - y0) / maxTotal);
                  const segmentY      = innerHeight - (y1 / maxTotal) * innerHeight;

                  return (
                    <g key={status}>
                      <rect
                        x={x}
                        y={segmentY}
                        width={barWidth}
                        height={segmentHeight}
                        rx="4"
                        fill={statusColors[status]}
                        opacity={0.9}
                        style={{ cursor: 'pointer' }}
                        onClick={() => onBarClick?.(status, d.priority)}
                        onMouseEnter={e => {
                          const rect = containerRef.current.getBoundingClientRect();
                          setTooltip({
                            priority: d.label,
                            status,
                            count: Math.round(y1 - y0),
                            percentage: Math.round(((y1 - y0) / d.total) * 100),
                            left: e.clientX - rect.left,
                            top:  e.clientY - rect.top,
                          });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      />

                      {/* Count label inside segment */}
                      {segmentHeight > 15 && (
                        <text
                          x={x + barWidth / 2}
                          y={segmentY + segmentHeight / 2 + 3}
                          textAnchor="middle"
                          fill="white"
                          fontSize="10"
                          fontWeight="600"
                        >
                          {Math.round(y1 - y0)}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* ✅ X Label — always shown for all 5 slots */}
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

      {tooltip && (
        <div
          className="absolute px-3 py-2 rounded-lg text-xs shadow-xl pointer-events-none"
          style={{
            left: tooltip.left,
            top:  tooltip.top - 10,
            transform: 'translate(-50%, -100%)',
            backgroundColor: bgColor,
            border: `1px solid ${statusColors[tooltip.status]}`,
            color: labelColor,
          }}
        >
          <div className="font-semibold" style={{ color: statusColors[tooltip.status] }}>
            {tooltip.priority}
          </div>
          <div>{tooltip.count} {tooltipLabel}</div>
          <div>{tooltip.percentage}%</div>
        </div>
      )}
    </div>
  );
};

HealthStatusBarChart.propTypes = {
  title:        PropTypes.string,
  data:         PropTypes.array.isRequired,
  isDarkMode:   PropTypes.bool,
  tooltipLabel: PropTypes.string,
  onBarClick:   PropTypes.func,
};

export default React.memo(HealthStatusBarChart);
