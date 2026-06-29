import React from "react";
import { AlertCircle, SearchX, Inbox } from "lucide-react";

/**
 * Wraps any table with consistent loading / error / empty states.
 * When data is ready it renders children.
 *
 * Props:
 *   isLoading    — bool
 *   isError      — bool
 *   errorMessage — string
 *   isEmpty      — bool  (data.length === 0)
 *   hasActiveFilters — bool  (changes empty message)
 *   emptyTitle   — string
 *   onRetry      — fn
 *   onClearFilters — fn
 *   isDarkMode   — bool
 *   loadingText  — string
 *   children     — ReactNode (the actual DataTable)
 */
const TableStateWrapper = ({
  isLoading = false,
  isError = false,
  errorMessage = "Something went wrong",
  isEmpty = false,
  hasActiveFilters = false,
  emptyTitle = "No Data Found",
  onRetry,
  onClearFilters,
  isDarkMode = true,
  loadingText = "Loading...",
  children,
}) => {
  const textColor  = isDarkMode ? "#D1D5DB" : "#6B7280";
  const titleColor = isDarkMode ? "#F1F5F9" : "#1E293B";
  const bgStyle    = {
    backgroundColor: isDarkMode ? "#1F2937" : "#F9FAFB",
    borderColor:     isDarkMode ? "#374151" : "#E5E7EB",
    color:           textColor,
  };

  if (isLoading) {
    return (
      <div className="text-center py-12 rounded-lg border" style={bgStyle}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
        <p className="text-sm">{loadingText}</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-12 rounded-lg border" style={bgStyle}>
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500 opacity-50" />
        <h3 className="text-lg font-semibold mb-2" style={{ color: titleColor }}>
          {errorMessage}
        </h3>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="text-center py-12 rounded-lg border" style={bgStyle}>
        {hasActiveFilters
          ? <SearchX className="w-16 h-16 mx-auto mb-6 opacity-30" />
          : <Inbox    className="w-16 h-16 mx-auto mb-6 opacity-30" />
        }
        <h3 className="text-lg font-semibold mb-2" style={{ color: titleColor }}>
          {emptyTitle}
        </h3>
        <p className="text-sm mb-4 max-w-md mx-auto">
          {hasActiveFilters
            ? "No results match your current filters or search."
            : "Nothing here yet."}
        </p>
        {hasActiveFilters && onClearFilters && (
          <button
            onClick={onClearFilters}
            className="px-4 py-2 text-sm bg-indigo-500 text-white rounded hover:bg-indigo-600"
          >
            Clear Filters
          </button>
        )}
      </div>
    );
  }

  return children;
};

export default TableStateWrapper;