import React from "react";

const StatusTable = ({ 
  title, 
  icon: Icon, 
  data = [], 
  columns = [], 
  isDarkMode, 
}) => {

  const StatusPill = ({ status }) => {
    const isOk = status === "OK";
    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border inline-flex items-center gap-1 ${
        isOk ? "bg-green-500/10 border-green-500/20 text-green-500" : "bg-amber-500/10 border-amber-500/20 text-amber-500"
      }`}>
        <span className={`w-1 h-1 rounded-full ${isOk ? 'bg-green-500' : 'bg-amber-500'}`}></span>
        {status}
      </span>
    );
  };

  return (
    <div className={`p-5 rounded-xl border shadow-sm ${
      isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
    }`}>
      {/* Table Header - Always Visible */}
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold flex items-center gap-2 text-sm">
          {Icon && <Icon size={18} className="text-blue-500" />} {title}
        </h3>
      </div>

      <div className="overflow-x-auto overflow-y-auto max-h-[240px] custom-scrollbar-vertical pr-1">
        <table className="w-full text-left text-xs sticky-header">
          <thead className="sticky top-0 z-10">
            <tr className={`border-b border-gray-500/10 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              {columns.map((col, idx) => (
                <th key={idx} className={`pb-3 font-medium ${col.align === 'right' ? 'text-right' : ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-500/10">
            {data.map((row, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-gray-500/5 transition-colors">
                {columns.map((col, colIdx) => (
                  <td key={colIdx} className={`py-3 ${col.align === 'right' ? 'text-right' : ''}`}>
                    {col.key === 'status' ? (
                      <StatusPill status={row[col.key]} />
                    ) : (
                      <span className={col.bold ? "font-bold text-blue-500/90" : "text-gray-500"}>
                        {row[col.key]}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StatusTable;