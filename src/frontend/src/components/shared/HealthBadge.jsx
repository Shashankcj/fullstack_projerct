import React from "react";

const HEALTH_CONFIG = {
  green: {
    label: "Healthy",
    className:
      "bg-green-500/15 text-green-400 border border-green-500/30",
  },

  amber: {
    label: "Warning",
    className:
      "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
  },

  red: {
    label: "Critical",
    className:
      "bg-red-500/15 text-red-400 border border-red-500/30",
  },

  maintenance: {
    label: "Maintenance",
    className:
      "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  },

  no_data: {
    label: "No Data",
    className:
      "bg-slate-500/10 text-slate-400 border border-slate-500/20",
  },
};

const HealthBadge = ({ status }) => {
  const key = String(status || "no_data")
    .toLowerCase()
    .trim();

  const config =
    HEALTH_CONFIG[key] || HEALTH_CONFIG.no_data;

  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold ${config.className}`}
    >
      {config.label}
    </span>
  );
};

export default HealthBadge;