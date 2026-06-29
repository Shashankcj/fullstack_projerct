// features/IP_monitoring/utils/ipHelpers.js

import { PRIORITY_CONFIG } from "../../../Utilities/priority_config"

export const normalizePriority = (rawPriority) => {
  if (rawPriority === "")   return "---"
  if (rawPriority === "np") return "np"
  if (!rawPriority || typeof rawPriority !== "string") return "default"

  const lower = rawPriority.toLowerCase()
  if (lower.includes("p1")) return "p1"
  if (lower.includes("p2")) return "p2"
  if (lower.includes("p3")) return "p3"
  if (lower.includes("p4")) return "p4"

  return "default"
}

export const buildPriorityDisplay = (priorityKey, isDarkMode) => {
  if (priorityKey === "---" || priorityKey === "np") {
    return {
      label: priorityKey === "np" ? "NP" : "---",
      color: isDarkMode ? "#9CA3AF" : "#6B7280",
      bg:    isDarkMode ? "#1F2937" : "#F9FAFB",
      text:  "",
      order: 0,
    }
  }
  return PRIORITY_CONFIG[priorityKey] || {
    label: "---",
    color: isDarkMode ? "#9CA3AF" : "#6B7280",
    bg:    isDarkMode ? "#1F2937" : "#F9FAFB",
    text:  "",
    order: 0,
  }
}