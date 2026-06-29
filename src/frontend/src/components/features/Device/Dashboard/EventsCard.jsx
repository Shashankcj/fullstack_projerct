import React, { useState, useCallback, useMemo } from "react";
import { AlertCircle } from 'lucide-react';
import {
  useGetEventLogsQuery,
  useGetEventLogFilterOptionsQuery
} from '../../../../redux/eventLogFilterApi';
import FilterDropdown from '../../../shared/FilterDropdown'

const TABLE_COLUMNS = [
  { id: 1, name: "Time"        },
  { id: 2, name: "Event Type"  },
  { id: 3, name: "Component"   },
  { id: 4, name: "Description" },
];

const INITIAL_FILTERS = {
  event_type:     "",
  component_type: "",
  dateFrom:       "",
  dateTo:         "",
};

const FILTER_CONFIG = [
  { key: "event_type",     label: "Event Type", type: "select",   optionsKey: "event_type" },
  { key: "component_type", label: "Component",  type: "select",   optionsKey: "component"  },
  { key: "date",           label: "Date Range", type: "dateRange"                           },
];

const formatDateTime = (dateString) => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleString('en-US', {
      month: '2-digit', day: '2-digit', year: '2-digit',
      hour: '2-digit',  minute: '2-digit', hour12: true,
      timeZone: 'Asia/Kolkata',
    });
  } catch {
    return 'Invalid Date';
  }
};

export const EventLogsTable = ({ isDarkMode = false, deviceId, limit = 100 }) => {
  const [filters, setFilters] = useState(INITIAL_FILTERS);

  const { data: filterOptionsData } = useGetEventLogFilterOptionsQuery(deviceId, {
    skip: !deviceId,
  });

  const filterOptions = useMemo(() => ({
    event_type: Array.isArray(filterOptionsData?.event_type)     ? filterOptionsData.event_type     : [],
    component:  Array.isArray(filterOptionsData?.component_type) ? filterOptionsData.component_type : [],
  }), [filterOptionsData]);

  const queryParams = useMemo(() => ({
    device_id: deviceId,
    ...(filters.event_type     && { event_type:     filters.event_type     }),
    ...(filters.component_type && { component_type: filters.component_type }),
    ...(filters.dateFrom       && { start_date:     filters.dateFrom       }),
    ...(filters.dateTo         && { end_date:       filters.dateTo         }),
  }), [deviceId, filters]);

  const { data: apiResponse, isLoading, isError, error } =
    useGetEventLogsQuery(queryParams, {
      skip: !deviceId,                      // ✅ don't fire if deviceId undefined
      refetchOnMountOrArgChange: true,
    });

  const displayLogs = Array.isArray(apiResponse?.results?.events)
    ? apiResponse.results.events
    : [];
  const totalCount       = apiResponse?.count || 0;
  const hasActiveFilters = Object.values(filters).some(Boolean);

  const handleFiltersChange = useCallback((newFilters) => {
    setFilters(newFilters);
  }, []);

  return (
    <div className="space-y-2 sm:space-y-6 px-2 sm:px-0 mt-4">
      <div
      className="rounded-lg shadow-md relative overflow-visible"
        style={{
          backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
          border: isDarkMode ? '1px solid #374151' : '1px solid #E5E7EB',
        }}
      >
        {/* ── Card Header ── */}
        <div
          className="p-3 sm:p-4 flex items-center justify-between gap-2 border-b"
          style={{ borderColor: isDarkMode ? '#374151' : '#E5E7EB' }}
        >
          {/* Left: title + filtered badge — min-w-0 so it shrinks not overflows */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span
              className="text-base sm:text-lg font-semibold truncate"
              style={{ color: isDarkMode ? '#FFF' : '#525759' }}
            >
              Event Logs ({isLoading ? '...' : totalCount})  {/* ✅ totalCount not page slice */}
            </span>
            {hasActiveFilters && totalCount > 0 && (
              <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800 whitespace-nowrap flex-shrink-0">
                Filtered ({totalCount})
              </span>
            )}
          </div>

          {/* Right: filter — flex-shrink-0 so it never wraps or squishes */}
          <div className="flex-shrink-0">
            <FilterDropdown
              filterConfig={FILTER_CONFIG}
              filters={filters}
              filterOptions={filterOptions}
              onFiltersChange={handleFiltersChange}
              isDarkMode={isDarkMode}
            />
          </div>
        </div>

        {/* ── Table Content ── */}
        <div className="max-h-72 overflow-y-auto overflow-x-auto px-4 custom-scroll mb-2">
          {isLoading ? (
            <div className="text-center py-8" style={{ color: isDarkMode ? '#D1D5DB' : '#6B7280' }}>
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-3" />
              <p>{hasActiveFilters ? 'Loading filtered event logs...' : 'Loading event logs...'}</p>
            </div>

          ) : isError ? (
            <div className="text-center py-8" style={{ color: isDarkMode ? '#EF4444' : '#DC2626' }}>
              <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">Error Loading Event Logs</h3>
              <p>{error?.data?.message || 'Failed to load event logs. Please try again.'}</p>
            </div>

          ) : displayLogs.length === 0 ? (
            <div className="text-center py-8" style={{ color: isDarkMode ? '#D1D5DB' : '#6B7280' }}>
              <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2"
                style={{ color: isDarkMode ? '#FFF' : '#1F2937' }}>
                {hasActiveFilters ? 'No Event Logs Match Filters' : 'No Event Logs Available'}
              </h3>
              <p style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}>
                {hasActiveFilters
                  ? 'Try adjusting your filters or clear them to see all event logs.'
                  : 'Event log information will appear here when available.'}
              </p>
            </div>

          ) : (
            <table className={`w-full text-xs text-left border-collapse font-medium tracking-wider min-w-[700px]
              ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}
            >
              <thead>
                <tr
                  className="sticky top-0 z-[5]"
                  style={{ backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF' }}
                >
                  {TABLE_COLUMNS.map((col) => (
                    <th
                      key={col.id}
                      className={`py-2 sm:py-3 px-2 sm:px-4 text-center whitespace-nowrap border-b
                        ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}
                    >
                      {col.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayLogs.map((log, index) => (
                  <tr
                    key={log.id || log.uuid || `log-${index}`}
                    className={`transition-colors duration-200
                      ${isDarkMode
                        ? index % 2 === 0 ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-900 hover:bg-gray-800'
                        : index % 2 === 0 ? 'bg-gray-50 hover:bg-gray-100'  : 'bg-white hover:bg-gray-50'
                      }`}
                  >
                    <td className="py-2 sm:py-3 px-2 sm:px-4 text-center text-xs whitespace-nowrap">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="py-2 sm:py-3 px-2 sm:px-4 text-center whitespace-nowrap">
                      <span className="px-2 py-1 rounded-full text-xs font-medium inline-block">
                        {log.event_type}
                      </span>
                    </td>
                    <td className="py-2 sm:py-3 px-2 sm:px-4 text-center font-medium whitespace-nowrap">
                      {log.component_type}
                    </td>
                    <td className="py-2 sm:py-3 px-2 sm:px-4 text-center">
                      <div className="max-w-xs sm:max-w-md break-words text-left">
                        {log.description}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
