// ✅ Fix #1 — removed `import React`, added Fragment + useCallback
import { useState, useEffect, useRef, useCallback, Fragment } from "react";
import {
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  XMarkIcon,
  AdjustmentsHorizontalIcon,
} from "@heroicons/react/24/outline";


const FilterDropdown = ({
  filterConfig,
  filters,
  filterOptions = {},
  onFiltersChange,
  onFilterOptionsLoad,
  isDarkMode = false,
}) => {
  const [showDropdown, setShowDropdown]   = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState(null);
  const [tempFilters, setTempFilters]     = useState(filters);
  const [searchStates, setSearchStates]   = useState({});
  const dropdownRef = useRef(null);


  /* -------------------- EFFECTS -------------------- */

  // Initialize search states based on filterConfig
  useEffect(() => {
    const initial = {};
    filterConfig.forEach((config) => {
      if (config.type !== "dateRange") initial[config.key] = "";
    });
    setSearchStates(initial);
  }, [filterConfig]);

  // Sync internal tempFilters with external filters prop
  useEffect(() => {
    setTempFilters(filters);
  }, [filters]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
        setActiveSubmenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);


  /* -------------------- HANDLERS -------------------- */

  // ✅ Fix #2 — useCallback for stable reference
  const handleFilterButtonClick = useCallback(async () => {
    if (onFilterOptionsLoad) {
      try {
        await onFilterOptionsLoad();
      } catch (err) {
        // ✅ Fix #8 — added namespace
        console.error("[FilterDropdown] Failed to fetch filter options:", err);
      }
    }
    setShowDropdown((prev) => !prev);
    setActiveSubmenu(null);
  }, [onFilterOptionsLoad]);

  // ✅ Fix #3 — useCallback for stable reference
  const clearFilters = useCallback(() => {
    const resetFilters = {};
    const resetSearch  = {};

    filterConfig.forEach((config) => {
      if (config.type === "dateRange") {
        resetFilters[`${config.key}From`] = "";
        resetFilters[`${config.key}To`]   = "";
      } else {
        resetFilters[config.key] = "";
        resetSearch[config.key]  = "";
      }
    });

    setTempFilters(resetFilters);
    setSearchStates(resetSearch);
    onFiltersChange(resetFilters);
    setShowDropdown(false);
    setActiveSubmenu(null);
  }, [filterConfig, onFiltersChange]);

  // ✅ Fix #3 — useCallback for stable reference
  const applyFilters = useCallback(() => {
    onFiltersChange(tempFilters);
    setShowDropdown(false);
    setActiveSubmenu(null);
  }, [tempFilters, onFiltersChange]);


  /* -------------------- RENDER HELPERS -------------------- */

  // ✅ Fix #6 — useCallback for stable reference
  const renderFilterSubmenu = useCallback((config) => {
    const list        = Array.isArray(filterOptions?.[config.optionsKey])
      ? filterOptions[config.optionsKey]
      : [];
    const searchValue = searchStates[config.key] || "";

    return (
      <>
        <div className="mb-2">
          <h4 className={`text-sm font-semibold mb-2 ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
            Select {config.label}
          </h4>
          <div className="relative">
            {/* ✅ Fix #10 — removed pointless isDarkMode ternary, both were text-gray-400 */}
            <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder={`Search ${config.label.toLowerCase()}...`}
              value={searchValue}
              onChange={(e) =>
                // ✅ Fix #4 — functional update to avoid stale closure
                setSearchStates((prev) => ({
                  ...prev,
                  [config.key]: e.target.value,
                }))
              }
              className={`w-full pl-8 pr-2 py-1.5 text-sm rounded border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isDarkMode
                  ? "bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400"
                  : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
              }`}
            />
          </div>
        </div>

        <div className="max-h-[180px] overflow-y-auto custom-scroll">
          {list
            .filter((o) => o.toLowerCase().includes(searchValue.toLowerCase()))
            .map((option) => (
              <div
                key={option}
                className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer transition-colors rounded mb-1
                  ${tempFilters[config.key] === option
                    ? isDarkMode
                      ? "bg-indigo-500/30 text-indigo-200 font-medium border border-indigo-400/40"
                      : "bg-indigo-100 text-indigo-700 font-medium border border-indigo-300"
                    : isDarkMode
                      ? "text-gray-200 hover:bg-gray-700 hover:border hover:border-gray-600"
                      : "text-gray-900 hover:bg-gray-100 hover:border hover:border-gray-300"
                  }`}
              >
                <button
                  onClick={() => {
                    // ✅ Fix #5 — functional update to avoid stale closure
                    setTempFilters((prev) => ({ ...prev, [config.key]: option }));
                    setActiveSubmenu(null);
                  }}
                  className="flex-1 text-left p-0 bg-transparent border-none w-full"
                >
                  {option}
                </button>

                {tempFilters[config.key] === option && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // ✅ Fix #5 — functional update
                      setTempFilters((prev) => ({ ...prev, [config.key]: "" }));
                    }}
                    className="p-1 hover:bg-red-500/20 rounded-full transition-colors"
                  >
                    <XMarkIcon className={`h-4 w-4 ${isDarkMode ? "text-red-400" : "text-red-600"}`} />
                  </button>
                )}
              </div>
            ))}
        </div>
      </>
    );
  }, [filterOptions, searchStates, tempFilters, isDarkMode]);

  // ✅ Fix #6 — useCallback for stable reference
  const renderDateRangeSubmenu = useCallback((config) => (
    <>
      <h4 className={`text-sm font-semibold mb-3 ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
        Select {config.label}
      </h4>
      <div className="space-y-3">
        {["From", "To"].map((type) => (
          <div key={type}>
            <label className={`block text-xs font-medium mb-1 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
              {type} Date
            </label>
            <input
              type="datetime-local"
              value={tempFilters[`${config.key}${type}`] || ""}
              onChange={(e) =>
                // ✅ Fix #5 — functional update
                setTempFilters((prev) => ({
                  ...prev,
                  [`${config.key}${type}`]: e.target.value,
                }))
              }
              className={`w-full px-2 py-1.5 text-sm rounded border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isDarkMode
                  ? "bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400"
                  : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
              }`}
            />
          </div>
        ))}
      </div>
    </>
  ), [tempFilters, isDarkMode]);


  /* -------------------- RENDER -------------------- */

  return (
    <div className="relative" ref={dropdownRef}>

      {/* Main Filter Button */}
      <button
        onClick={handleFilterButtonClick}
        className={`p-2 rounded-lg transition-all duration-200
          ${isDarkMode
            ? "bg-gray-700 hover:bg-gray-600 text-gray-200"
            : "bg-gray-100 hover:bg-gray-200 text-gray-700"
          }
          ${showDropdown ? "ring-2 ring-indigo-500/40" : ""}
        `}
        title="Filter"
      >
        <AdjustmentsHorizontalIcon className="h-5 w-5" />
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 flex gap-2 z-50">

          {/* Submenu panel */}
          {activeSubmenu && (
            <div
              className={`w-72 p-4 shadow-2xl rounded-xl border backdrop-blur-sm ${
                isDarkMode
                  ? "bg-gray-800/95 border-gray-700 shadow-black/30"
                  : "bg-white/95 border-gray-200 shadow-lg"
              }`}
            >
              {filterConfig.map((config) => {
                if (config.key !== activeSubmenu) return null;
                // ✅ Fix #7 — use named Fragment import, not React.Fragment
                return (
                  <Fragment key={config.key}>
                    {config.type === "dateRange"
                      ? renderDateRangeSubmenu(config)
                      : renderFilterSubmenu(config)}
                  </Fragment>
                );
              })}
            </div>
          )}

          {/* Main Filter List */}
          <div
            className={`w-64 shadow-2xl rounded-xl border backdrop-blur-sm ${
              isDarkMode
                ? "bg-gray-800/95 border-gray-700 shadow-black/30"
                : "bg-white/95 border-gray-200 shadow-lg"
            }`}
          >
            <div className="p-3 space-y-1">
              {filterConfig.map((config) => {
                const isDate  = config.type === "dateRange";
                const hasValue = isDate
                  ? tempFilters[`${config.key}From`] || tempFilters[`${config.key}To`]
                  : tempFilters[config.key];

                return (
                  <button
                    key={config.key}
                    type="button"
                    onClick={() =>
                      setActiveSubmenu((prev) =>
                        prev === config.key ? null : config.key
                      )
                    }
                    className={`w-full px-4 py-3 text-left flex items-center justify-between rounded-lg transition-all duration-200 group ${
                      isDarkMode
                        ? "text-gray-200 hover:bg-gray-700/80 hover:text-white hover:shadow-md hover:shadow-gray-900/50"
                        : "text-gray-800 hover:bg-gray-50 hover:shadow-sm hover:shadow-gray-200/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{config.label}</span>
                      {hasValue && (
                        <span className="text-xs px-2 py-0.5 bg-indigo-500 text-white rounded-full font-medium">
                          {isDate ? "Set" : tempFilters[config.key]}
                        </span>
                      )}
                    </div>
                    <ChevronLeftIcon className={`h-4 w-4 transition-transform duration-200 group-hover:translate-x-1 ${
                      isDarkMode ? "text-gray-400" : "text-gray-500"
                    }`} />
                  </button>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className={`p-4 border-t flex justify-end gap-2 ${
              isDarkMode ? "border-gray-700 bg-gray-800/50" : "border-gray-200 bg-gray-50"
            }`}>
              <button
                onClick={clearFilters}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  isDarkMode
                    ? "text-gray-300 hover:bg-gray-700 hover:text-gray-100"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                }`}
              >
                Clear
              </button>

              {/* ✅ Fix #9 — removed conflicting base hover:bg-[#6366f1]/20, let isDarkMode handle it */}
              <button
                onClick={applyFilters}
                className={`px-4 py-2 text-sm font-medium rounded-lg bg-[#6366f1] text-white shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 ${
                  isDarkMode
                    ? "hover:bg-indigo-500 hover:shadow-indigo-900/25 focus:ring-offset-gray-800"
                    : "hover:bg-indigo-700 hover:shadow-indigo-200/50 focus:ring-offset-white"
                }`}
              >
                Apply
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default FilterDropdown;