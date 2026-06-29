import { data_unit_transformer } from "../features/Device/monDataTransformers";

export const CustomTooltip = ({ active, payload, label, seriesCount, formatToDataUnit, isDarkMode }) => {
  // 'label' here is the INDEX (e.g., 34), not the time string.

  if (active && payload && payload.length) {
    // We need access to the chartData array to find the time
    // You can pass chartData as a prop to this tooltip, or assume it's available in scope
    const dataPoint = payload[0].payload;
    const series = Array.from({ length: seriesCount }, (_, i) => `series${i + 1}`).reverse();


    return (
      <div className={`p-3 rounded-lg shadow-lg border ${isDarkMode
          ? 'bg-gray-800 border-gray-600'
          : 'bg-white border-gray-100'
        }`}>
        <p className={`font-bold mb-1 text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
          Time: {dataPoint.timestamp}
        </p>
        {series.map((seriesKey, index) => (
          <div key={seriesKey} className="flex items-center gap-2">
            <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'
              }`}>{dataPoint[`${seriesKey}_name`]}:</span>
            <span className={`text-sm font-bold ${isDarkMode ? 'text-emerald-300' : 'text-emerald-500'
              }`}>
              {
                formatToDataUnit != null ?
                  data_unit_transformer(dataPoint[seriesKey], formatToDataUnit, true)
                  :
                  `${dataPoint[seriesKey]} ${dataPoint[`${seriesKey}_suffix`]}`}
            </span>
          </div>
        ))}
      </div>
    );

  }
  return null;
};