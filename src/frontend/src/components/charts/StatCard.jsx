import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Activity } from 'lucide-react';

const hexToRgba = (hex, alpha = 0.1) => {
  let r = 0, g = 0, b = 0;

  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const StatCard = ({ 
  title, 
  value, 
  color = '#2563EB', 
  icon: Icon = Activity, 
  isDarkMode, 
  onClick
}) => {
  const styles = useMemo(() => {
    return {
      backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
      textColor: isDarkMode ? '#FFFFFF' : '#1F2937',
      borderColor: isDarkMode ? '#374151' : '#E5E7EB',
      labelColor: '#6B7280',
      hoverBg: hexToRgba(color, 0.15)
    };
  }, [isDarkMode, color]);

  return (
    <div
      onClick={onClick}
      className="p-6 rounded-lg shadow-md transition-all duration-200 transform hover:scale-[1.02] cursor-pointer" // ✅ Always show pointer cursor
      style={{
        backgroundColor: styles.backgroundColor,
        color: styles.textColor,
        border: `1px solid ${styles.borderColor}`,
        transition: 'background-color 0.3s ease, transform 0.2s ease'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = styles.hoverBg; 
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = styles.backgroundColor; 
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium" style={{ color: styles.labelColor }}>
          {title}
        </h3>
        {Icon && <Icon className="w-5 h-5" style={{ color: styles.labelColor }} />}
      </div>
      <p className="text-3xl font-bold" style={{ color }}>
        {value}
      </p>
    </div>
  );
};

StatCard.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  color: PropTypes.string,
  icon: PropTypes.elementType,
  isDarkMode: PropTypes.bool,
  onClick: PropTypes.func
};

export default React.memo(StatCard);
