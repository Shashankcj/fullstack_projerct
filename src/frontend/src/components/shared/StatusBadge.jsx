import React from "react";

const StatusBadge = ({
  status = "Unknown",
  isDarkMode = false,
  className = "",
}) => {
  const normalized = status?.toLowerCase()?.trim();

  const getStatusStyles = () => {
    switch (normalized) {
      case "active":
      case "online":
      case "up":
        return isDarkMode
          ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10"
          : "text-emerald-700 border-emerald-500/30 bg-emerald-50";

      case "inactive":
      case "offline":
      case "down":
        return isDarkMode
          ? "text-red-400 border-red-500/40 bg-red-500/10"
          : "text-red-700 border-red-500/30 bg-red-50";

      case "warning":
        return isDarkMode
          ? "text-amber-400 border-amber-500/40 bg-amber-500/10"
          : "text-amber-700 border-amber-500/30 bg-amber-50";

      default:
        return isDarkMode
          ? "text-gray-400 border-gray-500/40 bg-gray-500/10"
          : "text-gray-700 border-gray-300 bg-gray-50";
    }
  };

  return (
    <span
      className={`
        inline-flex
        items-center
        justify-center
        px-4
        py-1
        rounded-full
        text-xs
        font-semibold
        tracking-wider
        border
        whitespace-nowrap
        select-none
        ${getStatusStyles()}
        ${className}
      `}
    >
      {status}
    </span>
  );
};

export default StatusBadge;