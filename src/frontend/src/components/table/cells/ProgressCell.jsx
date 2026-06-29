import React from "react";

const getMetricColor = (value, thresholds) => {
  if (value == null) return "bg-slate-500";

  if (value >= (thresholds?.critical ?? 90)) {
    return "bg-red-500";
  }

  if (value >= (thresholds?.warning ?? 70)) {
    return "bg-yellow-500";
  }

  return "bg-green-500";
};

const getMetricTextColor = (value, thresholds) => {
  if (value == null) return "text-slate-400";

  if (value >= (thresholds?.critical ?? 90)) {
    return "text-red-400";
  }

  if (value >= (thresholds?.warning ?? 70)) {
    return "text-yellow-400";
  }

  return "text-green-400";
};

const ProgressCell = ({
  value,
  thresholds,
  isDarkMode = true,
}) => {
  const hasValue = value != null;

  return (
    <div className="flex items-center gap-2 w-full max-w-[140px]">
      <div
        className={`
          flex-1 h-1.5 rounded-full overflow-hidden
          ${isDarkMode ? "bg-slate-500" : "bg-slate-300"}
        `}
      >
        <div
          className={`
            h-full rounded-full transition-all duration-500
            ${getMetricColor(value, thresholds)}
          `}
          style={{
            width: `${hasValue ? value : 0}%`,
          }}
        />
      </div>

      <span
        className={`
          text-[11px] font-bold w-7 text-right shrink-0
          ${getMetricTextColor(value, thresholds)}
        `}
      >
        {hasValue ? `${value}%` : "—"}
      </span>
    </div>
  );
};

export default ProgressCell;