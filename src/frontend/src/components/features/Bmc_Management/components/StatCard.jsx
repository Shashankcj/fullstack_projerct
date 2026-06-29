import React from "react";

const StatCard = ({ sectionTitle, title, value, icon: Icon, unit, iconColor, subtext, isDarkMode }) => {
  return (
    <div className="w-full flex flex-col">
      {/* 1. Dynamic Section Header: Only renders if sectionTitle prop is provided */}
      {sectionTitle && (
        <div className="flex items-center gap-2 mb-4">
          <h2 className={`text-lg font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-600'}`}>
            {sectionTitle}
          </h2>
        </div>
      )}

      {/* 2. The Stat Card Box */}
      <div 
        className={`flex items-center justify-between p-4 rounded-xl border shadow-sm transition-all h-28 ${
          isDarkMode 
            ? "bg-gray-800 border-gray-700 text-white shadow-black/20" 
            : "bg-white border-gray-100 text-gray-600 shadow-gray-200"
        }`}
      >
        {/* Left Side: Labels and Values */}
        <div className="flex flex-col justify-center">
          <span className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${
            isDarkMode ? "text-gray-400" : "text-gray-500"
          }`}>
            {title}
          </span>
          
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold leading-none">{value}</span>
            {unit && (
              <span className={`text-sm font-semibold ${isDarkMode ? "text-gray-500" : "text-gray-400"}`}>
                {unit}
              </span>
            )}
          </div>

          {subtext && (
            <span className="text-[11px] mt-2 text-blue-500 font-medium truncate">
              {subtext}
            </span>
          )}
        </div>

        {/* Right Side: Icon Slot */}
        {Icon && (
          <div className={`p-2.5 rounded-lg shrink-0 ${
            isDarkMode ? "bg-gray-700/50 text-blue-400" : "bg-blue-50 text-blue-600"
          }`}>
            <Icon size={22} strokeWidth={2} className={iconColor} />
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;