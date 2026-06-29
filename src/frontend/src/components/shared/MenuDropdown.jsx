import React, { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown } from "lucide-react";


const MenuDropdown = ({
  menuItems = [],
  isDarkMode = false,
  buttonLabel = "Actions",
  disabled = false,
  disabledTooltip = "Select items to perform actions",
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);


  /* ================= EFFECTS ================= */

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);


  /* ================= HANDLERS ================= */

  const handleMenuItemClick = useCallback((onClick) => {
    setIsOpen(false);
    if (typeof onClick === "function") onClick();
  }, []);


  /* ================= UI ================= */

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>

      {/* Trigger Button */}
      <button
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        className={`flex items-center justify-between px-3 py-2 text-xs border rounded-md cursor-pointer min-w-[120px] transition-all duration-200 hover:shadow-md
          ${disabled
            ? isDarkMode
              ? "bg-gray-700 text-gray-500 border-gray-600 cursor-not-allowed opacity-50"
              : "bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed opacity-50"
            : isDarkMode
              ? "bg-gray-700 text-gray-200 border-gray-600 hover:bg-gray-600 hover:border-gray-500"
              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
          }
          ${isOpen && !disabled ? "ring-2 ring-blue-500 ring-opacity-50" : ""}
        `}
        title={disabled ? disabledTooltip : "Bulk actions"}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <span>{buttonLabel}</span>
        <ChevronDown
          className={`w-3 h-3 ml-1 transition-transform duration-200 ${
            isOpen ? "rotate-180" : "rotate-0"
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      <div
        className={`absolute left-0 top-full mt-1 w-48 rounded-md shadow-lg border z-50 transition-all duration-200 origin-top
          ${isDarkMode ? "bg-gray-700 border-gray-600" : "bg-white border-gray-200"}
          ${isOpen && !disabled
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 -translate-y-1 pointer-events-none"
          }
        `}
        role="menu"
        aria-label="Action menu"
      >
        <div className="py-1">
          {menuItems.length === 0 ? (
            <div className={`px-3 py-2 text-xs ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
              No actions available
            </div>
          ) : (
            menuItems.map((item) => (
              <React.Fragment key={item.id || item.label}>
                {item.divider ? (
                  <div className={`border-t ${isDarkMode ? "border-gray-600" : "border-gray-200"}`} />
                ) : (
                  <button
                    onClick={() => handleMenuItemClick(item.onClick)}
                    disabled={item.disabled}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors duration-150 ${
                      item.disabled ? "opacity-50 cursor-not-allowed" : ""
                    } ${
                      item.variant === "danger"
                        ? isDarkMode
                          ? "text-red-400 hover:bg-red-900/20"
                          : "text-red-600 hover:bg-red-50"
                        : isDarkMode
                        ? "text-gray-200 hover:bg-gray-600"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                    role="menuitem"
                  >
                    {item.label}
                  </button>
                )}
              </React.Fragment>
            ))
          )}
        </div>
      </div>
    </div>
  );
};


export default MenuDropdown;