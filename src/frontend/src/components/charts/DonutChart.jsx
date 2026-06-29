import React, { useMemo, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { PieChart, Pie, Cell } from 'recharts';
import { useNavigate } from 'react-router-dom';


const OS_COLORS = {
  Windows: '#3B82F6',
  Linux:   '#d87e17',
  Others:  '#EF4444',
};

const DEVICE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];


const DonutChart = ({
  title,
  stats       = {},
  dataConfig  = [],
  deviceTypes = {},
  osFamilies  = {},
  total: totalProp,
  centerLabel = 'Total',
  isDarkMode  = false,
  onSegmentClick,
  onCardClick,
  chartType   = 'status',
}) => {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const navigate = useNavigate();


  /* =============================================================
     CHART DATA
     - mathTotal  → used ONLY for percentage calculation (min 1
                    to avoid division-by-zero, never displayed)
     - displayTotal → shown in the center label (can be 0)
     ============================================================= */
  const chartData = useMemo(() => {
    let data         = [];
    let displayTotal = totalProp ?? 0;   // what the user sees in center
    let mathTotal    = totalProp ?? 0;   // what we divide by for %

    if (dataConfig.length > 0 && Object.keys(stats).length > 0) {
      const actualSum = dataConfig.reduce((sum, d) => sum + (stats[d.key] ?? 0), 0);

      // BUG FIX 1 ↓ — keep || 1 only for math, not for display
      displayTotal = totalProp ?? actualSum;
      mathTotal    = totalProp || actualSum || 1;  // safe divisor, never shown

      data = dataConfig.map(d => {
        const value = stats[d.key] ?? 0;
        return {
          key:        d.key,
          name:       d.label,
          value,
          color:      d.color,
          percentage: Number(((value / mathTotal) * 100).toFixed(1)),
        };
      });

    } else if (
      Object.keys(deviceTypes).length > 0 ||
      Object.keys(osFamilies).length > 0
    ) {
      const deviceData = { ...deviceTypes, ...osFamilies };
      const entries    = Object.entries(deviceData);
      const actualSum  = entries.reduce((sum, [, v]) => sum + v, 0);

      displayTotal = totalProp ?? actualSum;
      mathTotal    = totalProp || actualSum || 1;  // safe divisor

      data = entries.map(([name, value], i) => ({
        key:   name,
        name,
        value,
        color: chartType === 'os'
          ? (OS_COLORS[name] || '#6B7280')
          : DEVICE_COLORS[i % DEVICE_COLORS.length],
        percentage: Number(((value / mathTotal) * 100).toFixed(1)),
      }));
    }

    return { data, displayTotal };
  }, [stats, dataConfig, deviceTypes, osFamilies, chartType, totalProp]);


  const { data, displayTotal } = chartData;

  // BUG FIX 2 ↓ — detect empty/all-zero state for placeholder ring
  const isEmpty = displayTotal === 0 || data.length === 0 || data.every(d => d.value === 0);


  /* =============================================================
     STYLES
     ============================================================= */
  const styles = useMemo(() => ({
    bg:           isDarkMode ? '#1F2937' : '#FFFFFF',
    border:       isDarkMode ? '#374151' : '#E5E7EB',
    text:         isDarkMode ? '#FFFFFF' : '#111827',
    label:        isDarkMode ? '#D1D5DB' : '#6B7280',
    hoverBg:      isDarkMode ? '#374151' : '#F3F4F6',
    emptyRing:    isDarkMode ? '#374151' : '#E5E7EB',
    emptyText:    isDarkMode ? '#4B5563' : '#D1D5DB',
  }), [isDarkMode]);


  /* =============================================================
     CLICK HANDLER
     ============================================================= */
  const handleSegmentClick = useCallback((itemKey, item) => {
    if (!itemKey || item.value === 0) return;

    if (onSegmentClick) {
      onSegmentClick(itemKey, item);
      return;
    }

    let path = '';
    if (title.includes('Status') && (itemKey === 'active' || itemKey === 'inactive')) {
      const statusMap = { active: 'Active', inactive: 'Inactive' };
      path = `/devices?status=${statusMap[itemKey]}&page=1&page_size=10`;
    } else if (title.includes('IP')) {
      path = `/ip_monitoring?status=${itemKey}&page=1&page_size=10`;
    } else if (title.includes('OS')) {
      path = `/devices?os=${itemKey}&page=1&page_size=10`;
    } else if (title.includes('Types')) {
      path = `/devices?device_type=${itemKey}&page=1&page_size=10`;
    }

    if (path) navigate(path, { replace: true });
  }, [navigate, title, onSegmentClick]);


  /* =============================================================
     RENDER
     ============================================================= */
  return (
    <div
      className="p-3 sm:p-3 rounded-lg shadow-sm transition-all duration-200 outline-none relative"
      style={{
        backgroundColor: styles.bg,
        border:          `1px solid ${styles.border}`,
        minHeight:       180,
        cursor:          onCardClick ? 'pointer' : 'default',
      }}
      onClick={onCardClick}
      tabIndex={-1}
    >
      {/* TITLE */}
      <h3
        className="text-xs sm:text-sm font-medium mb-2 sm:mb-3"
        style={{ color: styles.label }}
      >
        {title}
      </h3>

      <div className="space-y-2 sm:space-y-3">

        {/* ── DONUT RING ─────────────────────────────────────── */}
        <div className="flex justify-center">
          <div className="relative">

            {isEmpty ? (
              // BUG FIX 2 ↓ — grey placeholder ring when no data
              <PieChart width={100} height={100}>
                <Pie
                  data={[{ value: 1 }]}
                  cx="50%"
                  cy="50%"
                  innerRadius={32}
                  outerRadius={45}
                  dataKey="value"
                  stroke="none"
                  isAnimationActive={false}
                >
                  <Cell fill={styles.emptyRing} />
                </Pie>
              </PieChart>
            ) : (
              <PieChart width={100} height={100}>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={32}
                  outerRadius={45}
                  dataKey="value"
                  stroke="none"
                  onMouseEnter={(_, index) => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onClick={(e, clickedData) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleSegmentClick(clickedData?.key, clickedData);
                  }}
                >
                  {data.map((entry, index) => (
                    <Cell
                      key={`cell-${entry.key}`}
                      fill={entry.color}
                      cursor={entry.value > 0 ? 'pointer' : 'default'}
                      style={{
                        filter: hoveredIndex === index
                          ? `brightness(1.15) drop-shadow(0 0 4px ${entry.color}88)`
                          : hoveredIndex !== null
                          ? 'brightness(0.6)'
                          : 'brightness(1)',
                        transition: 'all 0.25s ease',
                        outline: 'none',
                      }}
                      tabIndex={-1}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleSegmentClick(entry.key, entry);
                      }}
                    />
                  ))}
                </Pie>
              </PieChart>
            )}

            {/* CENTER LABEL */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span
                className="text-base sm:text-lg font-bold"
                style={{ color: isEmpty ? styles.emptyText : styles.text }}
              >
                {displayTotal}  {/* BUG FIX 1 ↓ — now correctly shows 0, not 1 */}
              </span>
              {centerLabel && (
                <span className="text-xs mt-0.5" style={{ color: styles.label }}>
                  {centerLabel}
                </span>
              )}
            </div>

          </div>
        </div>

        {/* ── LEGEND ─────────────────────────────────────────── */}
        <div className="space-y-1 pt-1 sm:pt-2">
          {isEmpty ? (
            // BUG FIX 3 ↓ — clean empty state message instead of "0 (0%)" rows
            <p
              className="text-xs text-center py-2"
              style={{ color: styles.label }}
            >
              No data available
            </p>
          ) : (
            data.map((item, index) => (
              <div
                key={item.key}
                className="flex items-center justify-between px-1 py-1.5 rounded-md w-full focus:outline-none"
                tabIndex={item.value > 0 ? 0 : -1}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSegmentClick(item.key, item);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSegmentClick(item.key, item);
                  }
                }}
                style={{
                  backgroundColor: hoveredIndex === index ? styles.hoverBg : 'transparent',
                  borderLeft:      hoveredIndex === index
                    ? `2px solid ${item.color}`
                    : '2px solid transparent',
                  cursor:     item.value > 0 ? 'pointer' : 'default',
                  transition: 'all 0.2s ease',
                  outline:    'none',
                }}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs sm:text-sm" style={{ color: styles.label }}>
                    {item.name}
                  </span>
                </div>
                <span
                  className="text-xs sm:text-sm font-semibold"
                  style={{ color: styles.text }}
                >
                  {item.value} ({item.percentage}%)
                </span>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
};


DonutChart.propTypes = {
  title:          PropTypes.string.isRequired,
  stats:          PropTypes.object,
  dataConfig:     PropTypes.array,
  deviceTypes:    PropTypes.object,
  osFamilies:     PropTypes.object,
  total:          PropTypes.number,
  centerLabel:    PropTypes.string,
  isDarkMode:     PropTypes.bool,
  onSegmentClick: PropTypes.func,
  onCardClick:    PropTypes.func,
  chartType:      PropTypes.oneOf(['status', 'device', 'os']),
};


export default React.memo(DonutChart);