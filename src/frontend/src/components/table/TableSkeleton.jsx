import React from "react";

const TableSkeleton = ({
  isDarkMode = true,
  colCount = 10,
  rowCount = 6,
}) => {
  return (
    <>
      {Array.from({ length: rowCount }).map((_, rowIndex) => (
        <tr
          key={rowIndex}
          className={`
            border-b
            ${
              isDarkMode
                ? "border-slate-700/30"
                : "border-slate-100"
            }
          `}
        >
          {Array.from({ length: colCount }).map((_, colIndex) => (
            <td
              key={colIndex}
              className="py-4 pr-4"
            >
              <div
                className={`
                  h-3 rounded-md animate-pulse
                  ${
                    isDarkMode
                      ? "bg-slate-700"
                      : "bg-slate-200"
                  }

                  ${
                    colIndex === 1
                      ? "w-28"
                      : colIndex === colCount - 1
                      ? "w-20"
                      : "w-16"
                  }
                `}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
};

export default TableSkeleton;