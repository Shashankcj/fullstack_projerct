// Thresholds are configurable — change once, applies everywhere
export const DEFAULT_THRESHOLDS = [
  { min: 90, bg: "bg-red-500/20",    text: "text-red-400"    },
  { min: 75, bg: "bg-orange-500/20", text: "text-orange-400" },
  { min: 50, bg: "bg-yellow-500/20", text: "text-yellow-400" },
  { min: 0,  bg: "bg-blue-500/20",   text: "text-blue-400"   },
];

export const getSeverityColor = (value, thresholds = DEFAULT_THRESHOLDS) => {
  return (
    thresholds.find((t) => value >= t.min) || thresholds[thresholds.length - 1]
  );
};