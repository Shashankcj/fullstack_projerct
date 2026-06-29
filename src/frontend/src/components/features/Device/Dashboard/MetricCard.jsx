import React from "react";
import { BarChart2 } from "lucide-react";

export const MetricCard = ({
  isDarkMode,

  title,
  Icon,
  headerAction = null,

  loading = false,
  loadingComponent = null,

  isEmpty = false,
  emptyText = "No data available",

  onClick,

  children,
  footer = null,
}) => {

  if (loading && loadingComponent) {
    return loadingComponent;
  }

  return (
    <div
      onClick={!isEmpty ? onClick : undefined}
      className={`
        ${isDarkMode ? "bg-gray-800" : "bg-white"}
        rounded-lg shadow-md
        p-4
        w-full
        h-full
        min-h-[240px]

        flex flex-col

        ${!isEmpty ? "cursor-pointer hover:shadow-lg transition" : ""}
      `}
    >

      {/* Header */}
      <div className="flex items-center justify-between shrink-0 mb-3">

        <div className="flex items-center">

          <Icon
            className={`
              w-4 h-4 mr-2
              ${isDarkMode ? "text-gray-400" : "text-gray-600"}
            `}
          />

          <span
            className={`
              text-sm font-medium
              ${isDarkMode ? "text-gray-200" : "text-gray-900"}
            `}
          >
            {title}
          </span>

        </div>

        {headerAction}

      </div>


      {/* Body */}
      <div className="flex-1 min-h-0 flex flex-col">

        {isEmpty ? (

          <div className="flex-1 flex flex-col items-center justify-center">

            <BarChart2
              className={`
                w-10 h-10 mb-2
                ${isDarkMode ? "text-gray-500" : "text-gray-400"}
              `}
            />

            <p
              className={`
                text-sm
                ${isDarkMode ? "text-gray-400" : "text-gray-500"}
              `}
            >
              {emptyText}
            </p>

          </div>

        ) : (

          children

        )}

      </div>


      {/* Footer */}
      {footer && (
        <div className="shrink-0 pt-3">
          {footer}
        </div>
      )}

    </div>
  );
};