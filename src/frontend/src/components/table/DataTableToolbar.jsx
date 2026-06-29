import React, { useEffect, useRef, useState } from "react";
import { EyeIcon, ChevronDown, RefreshCw } from "lucide-react";

import SearchBar from "../shared/SearchBar";
import RowsPerPageDropdown from "../Utilities/RowsPerPageDropdown";
import ActionButtons from "../shared/ActionButtons";

const DataTableToolbar = ({
  // ── identity ──────────────────────────────────────────
  title = "Table",

  // ── count badge ───────────────────────────────────────
  count,
  countLabel = "items",

  // ── selection badge ───────────────────────────────────
  selectedCount = 0,

  // ── refresh ───────────────────────────────────────────
  onRefresh,
  isRefreshing = false,

  // ── search ────────────────────────────────────────────
  searchTerm = "",
  onSearchChange,
  searchPlaceholder = "Search...",

  // ── rows per page ─────────────────────────────────────
  itemsPerPage = 10,
  onItemsPerPageChange,

  // ── theme / loading ───────────────────────────────────
  isDarkMode = true,
  isLoading = false,

  // ── column toggle ─────────────────────────────────────
  toggleableCols = [],
  visibleCols = {},
  onToggleCol,

  // ── slots ─────────────────────────────────────────────
  leftSlot = null,     // ✅ ADD THIS
  actionsSlot = null,
  rightSlot = null,
}) => {
  const [showPanel, setShowPanel] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setShowPanel(false);
      }
    };

    document.addEventListener("mousedown", handler);

    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="flex flex-col gap-3 mb-4 lg:flex-row lg:items-center lg:justify-between">

      {/* ── LEFT SIDE ───────────────────────────────────── */}
      <div className="flex items-center gap-2 min-w-0 flex-wrap">

        {/* Title */}
        <span
          className={`font-semibold text-sm ${
            isDarkMode ? "text-white" : "text-slate-800"
          }`}
        >
          {title}
        </span>

        {/* ✅ ADD BUTTON SLOT */}
        {leftSlot}

        {/* Refresh button */}
        {onRefresh && (
          <ActionButtons
            onRefresh={onRefresh}
            isRefreshing={isRefreshing}
            isDarkMode={isDarkMode}
            refreshButtonTitle={`Refresh ${title}`}
            refreshIcon={RefreshCw}
          />
        )}

        {/* Count badge */}
        {count !== undefined && (
          <span className="inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-semibold leading-none bg-blue-500/10 text-blue-500">
            {count} {countLabel}
          </span>
        )}

        {/* Selection badge */}
        {selectedCount > 0 && (
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${
              isDarkMode
                ? "bg-slate-700 text-slate-300"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {selectedCount} selected
          </span>
        )}
      </div>

      {/* ── RIGHT SIDE ──────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">

        {/* Fetching indicator */}
        {isLoading && (
          <span className="flex items-center gap-1.5 text-[10px] text-indigo-400 font-medium animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping inline-block" />
            Fetching...
          </span>
        )}

        {/* Bulk action dropdown */}
        {actionsSlot}

        {/* Search */}
        {onSearchChange && (
          <SearchBar
            searchTerm={searchTerm}
            onSearchChange={onSearchChange}
            searchPlaceholder={searchPlaceholder}
            isDarkMode={isDarkMode}
            className="border-0 p-0"
          />
        )}

        {/* Rows per page */}
        {onItemsPerPageChange && (
          <RowsPerPageDropdown
            itemsPerPage={itemsPerPage}
            onItemsPerPageChange={onItemsPerPageChange}
            isDarkMode={isDarkMode}
          />
        )}

        {/* Column toggle */}
        {toggleableCols.length > 0 && (
          <div className="relative" ref={panelRef}>
            <button
              onClick={() => setShowPanel((prev) => !prev)}
              type="button"
              className={`
                flex items-center gap-1.5 px-3 py-2 rounded-lg
                text-[11px] font-semibold border transition-all duration-200
                ${
                  isDarkMode
                    ? "bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                    : "bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200"
                }
                ${
                  showPanel
                    ? isDarkMode
                      ? "border-indigo-500 text-indigo-400"
                      : "border-indigo-400 text-indigo-600"
                    : ""
                }
              `}
            >
              <EyeIcon
                className={`w-3 h-3 ${
                  isDarkMode ? "text-slate-400" : "text-slate-500"
                }`}
              />

              <ChevronDown
                className={`w-3 h-3 transition-transform ${
                  showPanel ? "rotate-180" : ""
                }`}
              />
            </button>

            {showPanel && (
              <div
                className={`
                  absolute right-0 top-full mt-2 z-50 w-48
                  rounded-xl border shadow-2xl py-2
                  ${
                    isDarkMode
                      ? "bg-[#1e2740] border-slate-600/60 shadow-black/40"
                      : "bg-white border-slate-200 shadow-slate-200/80"
                  }
                `}
              >
                <p
                  className={`px-3 pb-2 text-[10px] font-bold uppercase tracking-widest border-b mb-1 ${
                    isDarkMode
                      ? "text-slate-500 border-slate-700"
                      : "text-slate-400 border-slate-100"
                  }`}
                >
                  Toggle Columns
                </p>

                {toggleableCols.map((col) => (
                  <label
                    key={col.key}
                    className={`
                      flex items-center gap-2.5 px-3 py-1.5 cursor-pointer select-none
                      text-[12px] font-medium transition-colors rounded-md mx-1
                      ${
                        isDarkMode
                          ? "text-slate-300 hover:bg-slate-700/50 hover:text-white"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }
                    `}
                  >
                    <input
                      type="checkbox"
                      checked={!!visibleCols[col.key]}
                      onChange={() => onToggleCol?.(col.key)}
                      className="accent-indigo-500 w-3.5 h-3.5 cursor-pointer"
                    />

                    {col.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Right slot */}
        {rightSlot}
      </div>
    </div>
  );
};

export default DataTableToolbar;