import React, { useState, useRef, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { ChevronDown } from "lucide-react";

const RowsPerPageDropdown = ({
  itemsPerPage,
  itemsPerPageOptions = [10, 25, 50, 100],
  onItemsPerPageChange,
  isDarkMode = true,
  label = " ",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleOptionClick = useCallback((option) => {
    onItemsPerPageChange?.(option);
    setIsOpen(false);
  }, [onItemsPerPageChange]);

  return (
    <div className="flex items-center gap-2 font-medium tracking-wider text-xs">
      <label style={{ color: isDarkMode ? "#9CA3AF" : "#6B7280" }}>
        {label}
      </label>
      
      <div className="relative inline-block text-left" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="inline-flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[70px] tracking-wide"
          style={{
            backgroundColor: isDarkMode ? "#374151" : "#F9FAFB",
            color: isDarkMode ? "#F3F4F6" : "#6B7280",
            border: `1px solid ${isDarkMode ? "#4B5563" : "#D1D5DB"}`,
          }}
        >
          <span>{itemsPerPage}</span>
          <ChevronDown 
            className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} 
          />
        </button>

        {isOpen && (
          <div
            className="absolute right-0 mt-2 w-32 origin-top-right rounded-lg shadow-lg z-50"
            style={{
              backgroundColor: isDarkMode ? "#1F2937" : "#FFFFFF",
              border: `1px solid ${isDarkMode ? "#374151" : "#E5E7EB"}`,
            }}
          >
            <div className="py-1">
              {itemsPerPageOptions.map((option) => (
                <button
                  key={option}
                  onClick={() => handleOptionClick(option)}
                  className="w-full text-left px-4 py-2 text-sm font-medium flex items-center justify-between transition-colors tracking-wide"
                  style={{
                    backgroundColor: itemsPerPage === option 
                      ? (isDarkMode ? "#374151" : "#F3F4F6") 
                      : "transparent",
                    color: itemsPerPage === option 
                      ? (isDarkMode ? "#60A5FA" : "#2563EB") 
                      : (isDarkMode ? "#D1D5DB" : "#6B7280"),
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

RowsPerPageDropdown.propTypes = {
  itemsPerPage: PropTypes.number.isRequired,
  itemsPerPageOptions: PropTypes.array,
  onItemsPerPageChange: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool,
  label: PropTypes.string,
};

export default RowsPerPageDropdown;