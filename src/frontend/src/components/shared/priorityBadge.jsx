import React from "react";
import { PRIORITY_CONFIG } from "../Utilities/priority_config";

const PriorityBadge = ({ priority, isDarkMode = false }) => {
  // backend sent null / empty
  if (priority === null || priority === undefined || priority === "") {
    return <span className="text-xs text-gray-400">---</span>;
  }

  // explicit placeholder
  if (priority === "---") {
    return <span className="text-xs text-gray-400">---</span>;
  }

  // valid priority
  const config = PRIORITY_CONFIG[priority];

  // unknown value safety
  if (!config) {
    return <span className="text-xs text-gray-400">---</span>;
  }

  return (
    <span
      className="font-semibold px-2 py-1 rounded-full text-xs whitespace-nowrap inline-flex items-center gap-1"
      style={{
        color: config.color,
        backgroundColor: config.bg,
        border: `1px solid ${config.color}`,
      }}
    >
      <span>{config.label}</span>
      {config.text && (
        <span className="opacity-80 text-xs">{config.text}</span>
      )}
    </span>
  );
};

export default PriorityBadge;
