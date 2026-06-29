import React, { useCallback } from "react";
import { Search, X } from "lucide-react";

const SearchBar = ({
  searchTerm,
  onSearchChange,
  searchPlaceholder = "Search...",
  isDarkMode = true,
  className = "",
}) => {
  const clearSearch = useCallback(() => {
  onSearchChange("");
}, [onSearchChange]);

  return (
    <div className={`relative ${className}`}>
      <div className="relative w-full sm:w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />

        <input
          type="text"
          placeholder={searchPlaceholder}
          value={searchTerm || ""}
          onChange={(e) => onSearchChange(e.target.value)}
          className={`w-full pl-10 pr-9 py-2 rounded-lg border text-sm shadow-sm transition-all
            ${
              isDarkMode
                ? "bg-[#1F2937] text-white border-[#374151] placeholder-gray-400 "
                : "bg-white text-gray-900 border-gray-300 placeholder-gray-400 "
            }`}
          aria-label="Search"
        />

        {searchTerm && (
          <button
            onClick={clearSearch}
            className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors
              ${
                isDarkMode
                  ? "text-gray-400 hover:bg-gray-600"
                  : "text-gray-500 hover:bg-gray-200"
              }`}
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default SearchBar;
