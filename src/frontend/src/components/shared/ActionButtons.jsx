// ✅ Fix #1 — removed `import React`, added useCallback
import { useState, useRef, useEffect, useCallback } from "react";
import { PlusIcon, ArrowPathIcon, ChevronDownIcon } from "@heroicons/react/24/outline";


const ActionButtons = ({
  onAdd,
  onRefresh,
  isRefreshing    = false,
  isDarkMode      = true,
  addButtonTitle  = "Add New Item",
  refreshButtonTitle = "Refresh Data",
  className       = "",

  // Icons
  addIcon:     AddIcon     = PlusIcon,
  refreshIcon: RefreshIcon = ArrowPathIcon,

  // Dropdown
  showAddDropdown  = false,
  addDropdownItems = [],
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);


  /* -------------------- EFFECTS -------------------- */
  // ✅ Fix #6 — cleaner early-return pattern, same behavior
  useEffect(() => {
    if (!isDropdownOpen) return;

    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDropdownOpen]);


  /* -------------------- HANDLERS -------------------- */
  // ✅ Fix #3 — stable handler instead of inline arrow per item
  const handleItemClick = useCallback((itemOnClick) => {
    itemOnClick();
    setIsDropdownOpen(false);
  }, []);


  /* -------------------- RENDER -------------------- */
  return (
    <div className={`flex items-center space-x-3 ${className}`}>

      {/* ADD BUTTON */}
      {onAdd && (
        <div
          className="relative inline-flex"
          ref={showAddDropdown ? dropdownRef : null}
        >
          {/* Main Add Button */}
          <button
            onClick={onAdd}
            title={addButtonTitle}
            aria-label={addButtonTitle}
            className={`p-2 transition-all duration-200 flex items-center justify-center focus:outline-none
              ${showAddDropdown ? "rounded-l-lg" : "rounded-lg"}
              ${isDarkMode
                ? "bg-blue-900/20 text-blue-400 hover:bg-blue-900/40 hover:text-blue-300 border border-blue-900/30"
                : "bg-blue-100/80 text-blue-600 hover:bg-blue-200 hover:text-blue-700 border border-blue-200/50"
              }`}
          >
            <AddIcon className="w-5 h-5" />
          </button>

          {/* Dropdown Chevron Button */}
          {showAddDropdown && addDropdownItems.length > 0 && (
            <>
              <button
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                className={`p-2 rounded-r-lg border-l transition-all duration-200
                  ${isDarkMode
                    ? "bg-blue-900/20 text-blue-400 hover:bg-blue-900/40 border-blue-900/30"
                    : "bg-blue-100/80 text-blue-600 hover:bg-blue-200 border-blue-200/50"
                  }`}
                aria-label="More add options"
              >
                <ChevronDownIcon
                  className={`w-4 h-4 transition-transform duration-200 ${
                    isDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div
                  // ✅ Fix #5 — replaced magic mt-14 with top-full mt-1
                  className="absolute left-0 top-full mt-1 w-56 rounded-lg shadow-lg z-50"
                  style={{
                    backgroundColor: isDarkMode ? "#1F2937" : "#FFFFFF",
                    border: `1px solid ${isDarkMode ? "#374151" : "#E5E7EB"}`,
                  }}
                >
                  {/* ✅ Fix #2 — key={item.label} instead of key={index} */}
                  {addDropdownItems.map((item) => (
                    <button
                      key={item.label}
                      // ✅ Fix #3 — useCallback handler, not inline arrow
                      onClick={() => handleItemClick(item.onClick)}
                      className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3
                        transition-colors duration-150
                        ${isDarkMode
                          ? "text-gray-300 hover:bg-gray-700"
                          : "text-gray-700 hover:bg-gray-100"
                        }`}
                    >
                      {item.icon && <item.icon className="w-4 h-4" />}
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* REFRESH BUTTON */}
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          title={refreshButtonTitle}
          aria-label={refreshButtonTitle} 
          className={`p-2 rounded-lg transition-all duration-200
            ${isDarkMode
              ? "bg-green-900/20 text-green-400 hover:bg-green-900/40 border border-green-900/30"
              : "bg-green-100/80 text-green-600 hover:bg-green-200 border border-green-200/50"
            }
            ${isRefreshing ? "opacity-50 cursor-not-allowed" : ""}
          `}
        >
          <RefreshIcon
            className={`w-5 h-5 ${isRefreshing ? "animate-spin" : ""}`}
          />
        </button>
      )}

    </div>
  );
};

export default ActionButtons;