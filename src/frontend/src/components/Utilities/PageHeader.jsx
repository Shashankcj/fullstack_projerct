import React from "react";
import PropTypes from "prop-types";

const PageHeader = ({
  isDarkMode,
  leftSlot,
  rightSlot,
  tabs,
  activeTab,
  onTabChange,
}) => {
  return (
    <div
      className={`rounded-xl border w-full shadow-sm ${
        isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 px-4 sm:px-5 py-2">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1 min-w-0">
          {leftSlot}
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          {rightSlot}
        </div>
      </div>

      {tabs?.length > 0 && (
        <nav
          className={`flex gap-x-1 px-3 overflow-x-auto border-t ${
            isDarkMode ? "border-gray-700" : "border-gray-200"
          }`}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.suffix;

            return (
              <button
                key={tab.label}
                onClick={() => onTabChange(tab)}
                className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium transition-colors whitespace-nowrap border-b-2 cursor-pointer rounded-t-md ${
                  isActive
                     ? "border-indigo-500 text-indigo-500"
                  : `border-transparent ${
                      isDarkMode
                        ? "text-gray-400 hover:text-gray-200"
                        : "text-gray-500 hover:text-gray-700"
                      }`
                }`}
              >
                {tab.Icon && <tab.Icon className="w-3.5 h-3.5" />}
                {tab.label}
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
};

PageHeader.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
  leftSlot: PropTypes.node.isRequired,
  rightSlot: PropTypes.node,
  tabs: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      suffix: PropTypes.string,
      Icon: PropTypes.elementType,
    })
  ),
  activeTab: PropTypes.string,
  onTabChange: PropTypes.func,
};

export default PageHeader;