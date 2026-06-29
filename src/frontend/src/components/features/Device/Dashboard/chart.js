
/**
 * Normalize chart data to include expected time slots.
 * Missing slots will be filled with value: 0.
 * 
 * @param {Array} rawData - Original array from backend (e.g., [{ name: '10min', value: 20 }, ...])
 * @param {Array} expectedLabels - Optional array of labels to normalize to.
 * @returns {Array} - Normalized array with all expected labels.
 */
export const normalizeChartData = (rawData = [], expectedLabels = null) => {
  const defaultLabels = ["5min", "10min", "15min", "20min", "25min", "30min", "35min"];
  const labels = expectedLabels || defaultLabels;

  return labels.map(label => {
    const found = rawData.find(item => item.name === label);
    return found || { name: label, value: 0 };
  });
};
