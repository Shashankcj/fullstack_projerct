import React from "react";

/**
 * The outer card shell every table page uses.
 * Accepts toolbar and table as children via slots.
 */
const TablePageShell = ({ isDarkMode = true, children }) => (
  <div
    className="rounded-lg shadow-md overflow-hidden"
    style={{
      backgroundColor: isDarkMode ? "#1F2937" : "#FFFFFF",
      border:          isDarkMode ? "1px solid #374151" : "1px solid #E5E7EB",
    }}
  >
    {children}
  </div>
);

export default TablePageShell;