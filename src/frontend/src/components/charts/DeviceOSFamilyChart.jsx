import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell } from 'recharts';
import { useNavigate } from 'react-router-dom';

const OS_COLORS = {
  Windows: '#3B82F6',
  Linux: '#d87e17',
  Others: "#EF4444",
};

const DeviceOSFamilyChart = ({ title, osFamilies = {}, isDarkMode }) => {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const navigate = useNavigate(); 

  const { data, total } = useMemo(() => {
    const entries = Object.entries(osFamilies);
    const totalCount = entries.reduce((sum, [, v]) => sum + v, 0);

    const formatted = entries.map(([name, value]) => ({
      name,
      value,
      color: OS_COLORS[name] || '#6B7280',
      percentage:
        totalCount > 0 ? ((value / totalCount) * 100).toFixed(1) : 0,
    }));

    return { data: formatted, total: totalCount };
  }, [osFamilies]);

  // Navigate to filtered devices page
  const handleSegmentClick = (osFamily) => {
    navigate(`/devices?os=${encodeURIComponent(osFamily)}&page=1&page_size=10`);
  };

  const renderCustomTooltip = () => {
    if (hoveredIndex === null) return null;
    const item = data[hoveredIndex];

    return (
      <div
        className="absolute top-0 left-full ml-4 p-3 rounded-lg shadow-lg text-sm"
        style={{
          backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
          border: `1px solid ${isDarkMode ? '#4B5563' : '#E5E7EB'}`,
          color: isDarkMode ? '#E5E7EB' : '#1F2937',
          transform: `translateY(${hoveredIndex * 60}px)`,
          minWidth: 140,
          zIndex: 10,
        }}
      >
        <div className="flex items-center space-x-2 mb-1">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="font-medium">{item.name}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          <span>Count:</span>
          <span className="text-right font-semibold">{item.value}</span>
          <span>Percent:</span>
          <span className="text-right font-semibold">
            {item.percentage}%
          </span>
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

      <div className="relative flex justify-center mb-4">
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
            >
              {data.map((entry, index) => (
                <Cell
                  key={entry.name}
                  fill={entry.color}
                  tabIndex={-1}
                  onClick={() => handleSegmentClick(entry.name)} 
                  style={{
                    outline: 'none',
                    cursor: 'pointer',
                    filter:
                      hoveredIndex === index
                        ? `brightness(1.2) drop-shadow(0 0 8px ${entry.color}60)`
                        : hoveredIndex !== null
                        ? 'brightness(0.6)'
                        : 'brightness(1)',
                    transform:
                      hoveredIndex === index ? 'scale(1.03)' : 'scale(1)',
                    transition: 'all 0.25s ease',
                  }}
                />
              ))}
            </Pie>
          </PieChart>

          {/* Center label */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span
              className="text-2xl font-bold"
              style={{ color: isDarkMode ? '#FFFFFF' : '#1F2937' }}
            >
              {total}
            </span>
          </div>

          {renderCustomTooltip()}
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-2">
        {data.map((item, i) => (
          <div
            key={item.name}
            className="flex items-center justify-between text-sm p-2 rounded cursor-pointer"
            style={{
              backgroundColor:
                hoveredIndex === i
                  ? isDarkMode
                    ? '#374151'
                    : '#F3F4F6'
                  : 'transparent',
              borderLeft:
                hoveredIndex === i
                  ? `3px solid ${item.color}`
                  : '3px solid transparent',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
            onClick={() => handleSegmentClick(item.name)} 
          >
            <div className="flex items-center space-x-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span>{item.name}</span>
            </div>
            <span className="font-semibold">
              {item.value} ({item.percentage}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default React.memo(DeviceOSFamilyChart);
