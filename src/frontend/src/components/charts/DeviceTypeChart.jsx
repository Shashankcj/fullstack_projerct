import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell } from 'recharts';
import { useNavigate } from 'react-router-dom';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

const DeviceTypeChart = ({ title, deviceTypes = {}, isDarkMode }) => {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const navigate = useNavigate();

  // Format data
  const { data, total } = useMemo(() => {
    const entries = Object.entries(deviceTypes);
    const formatted = entries.map(([key, value], i) => ({
      name: key,
      value,
      color: COLORS[i % COLORS.length],
      percentage: 0,
    }));
    const totalCount = entries.reduce((acc, [, val]) => acc + val, 0);

    formatted.forEach(item => {
      item.percentage = totalCount > 0 ? ((item.value / totalCount) * 100).toFixed(1) : 0;
    });

    return { data: formatted, total: totalCount };
  }, [deviceTypes]);

  // Navigate to filtered devices page
  const handleSegmentClick = (deviceType) => {
    navigate(`/devices?device_type=${encodeURIComponent(deviceType)}&page=1&page_size=10`);
  };

  const renderCustomTooltip = () => {
    if (hoveredIndex === null) return null;
    const item = data[hoveredIndex];

    return (
      <div
        className="absolute top-0 left-full ml-4 p-3 rounded-lg shadow-lg border text-sm"
        style={{
          backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
          borderColor: isDarkMode ? '#4B5563' : '#E5E7EB',
          color: isDarkMode ? '#E5E7EB' : '#6B7280',
          transform: `translateY(${hoveredIndex * 60}px)`, 
          minWidth: 140,
          zIndex: 10,
          transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          opacity: 1,
          boxShadow: isDarkMode 
            ? '0 10px 25px -5px rgba(0, 0, 0, 0.3)' 
            : '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div className="flex items-center space-x-2 mb-1">
          <div
            className="w-3 h-3 rounded-full"
            style={{ 
              backgroundColor: item.color,
              boxShadow: `0 0 6px ${item.color}50`,
            }}
          />
          <span className="font-medium">{item.name}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <span>Count:</span>
          <span className="text-right font-semibold">{item.value}</span>
          <span>Percent:</span>
          <span className="text-right font-semibold">{item.percentage}%</span>
        </div>
      </div>
    );
  };

  return (
    <div
      className="p-6 rounded-lg shadow-md relative"
      style={{
        backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
        border: isDarkMode ? '1px solid #374151' : '1px solid #E5E7EB',
      }}
    >
      <h3
        className="text-lg font-semibold mb-4"
        style={{ color: isDarkMode ? '#FFFFFF' : '#6B7280' }}
      >
        {title}
      </h3>

      <div className="relative flex items-start justify-center gap-8 mb-4">
        <div className="relative">
          <PieChart width={176} height={176}>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              dataKey="value"
              stroke="none"
              onMouseEnter={(_, index) => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              animationBegin={0}
              animationDuration={300}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  onClick={() => handleSegmentClick(entry.name)} // ✅ Navigate on click
                  style={{
                    outline: 'none',
                    cursor: 'pointer',
                    filter: hoveredIndex === index 
                      ? `brightness(1.2) saturate(1.1) drop-shadow(0 0 8px ${entry.color}60)` 
                      : hoveredIndex !== null && hoveredIndex !== index 
                      ? 'brightness(0.6) saturate(0.7)' 
                      : 'brightness(1) saturate(1)',
                    transition: 'filter 0.3s ease-out',
                    transformOrigin: 'center',
                    transform: hoveredIndex === index ? 'scale(1.03)' : 'scale(1)',
                  }}
                />
              ))}
            </Pie>
          </PieChart>

          {/* Central Label */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span
              className="text-2xl font-bold transition-all duration-300 ease-out"
              style={{
                color: isDarkMode ? '#FFFFFF' : '#1F2937',
                transform: hoveredIndex !== null ? 'scale(1.02)' : 'scale(1)',
                textShadow: hoveredIndex !== null 
                  ? (isDarkMode ? '0 1px 4px rgba(255,255,255,0.15)' : '0 1px 4px rgba(0,0,0,0.1)')
                  : 'none',
              }}
            >
              {total}
            </span>
          </div>

          {renderCustomTooltip()}
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-2 mt-2">
        {data.map((item, i) => (
          <div
            key={item.name}
            className="flex items-center justify-between text-sm p-2 rounded cursor-pointer"
            style={{
              backgroundColor: hoveredIndex === i
                ? (isDarkMode ? '#374151' : '#F3F4F6')
                : 'transparent',
              transform: hoveredIndex === i ? 'translateX(3px)' : 'translateX(0px)',
              borderLeft: hoveredIndex === i ? `3px solid ${item.color}` : '3px solid transparent',
              transition: 'all 0.25s ease-out',
            }}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
            onClick={() => handleSegmentClick(item.name)} // ✅ Navigate on legend click
          >
            <div className="flex items-center space-x-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ 
                  backgroundColor: item.color,
                  transform: hoveredIndex === i ? 'scale(1.15)' : 'scale(1)',
                  boxShadow: hoveredIndex === i ? `0 0 6px ${item.color}50` : 'none',
                  transition: 'all 0.25s ease-out',
                }}
              />
              <span 
                style={{ 
                  color: isDarkMode ? '#D1D5DB' : '#6B7280',
                  fontWeight: hoveredIndex === i ? '600' : '400',
                  transition: 'font-weight 0.2s ease',
                }}
              >
                {item.name}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span 
                style={{ 
                  color: isDarkMode ? '#FFFFFF' : '#1F2937',
                  fontWeight: hoveredIndex === i ? '700' : '500',
                  transition: 'font-weight 0.2s ease',
                }}
              >
                {item.value}
              </span>
              <span
                className="text-xs"
                style={{ 
                  color: isDarkMode ? '#9CA3AF' : '#6B7280',
                  opacity: hoveredIndex === i ? 1 : 0.8,
                  transition: 'opacity 0.2s ease',
                }}
              >
                ({item.percentage}%)
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default React.memo(DeviceTypeChart);
