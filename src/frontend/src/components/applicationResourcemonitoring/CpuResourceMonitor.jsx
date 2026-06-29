import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Cpu, ChevronUp, ChevronDown } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDocumentTitle } from "../../Hooks/useDocumentTitle";

const CPUResourceMonitor = ({ 
  isDarkMode, 
  processData = [],
  isCollapsed = false,       
  onToggleCollapse = null,
  applicationCpuData = []
}) => {
  useDocumentTitle('CPU Resource Monitor');
  const navigate = useNavigate();
  const { id: deviceId } = useParams();

  const [sortStack, setSortStack] = useState([{ field: 'cpu_average', direction: 'desc' }]);
  
  // Use external state if provided, otherwise use internal state
  const [internalIsOpen, setInternalIsOpen] = useState(true);
  const isOpen = onToggleCollapse ? !isCollapsed : internalIsOpen;
  
  // Handle toggle - use external handler if provided, otherwise use internal
  const handleToggle = useCallback(() => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalIsOpen(prev => !prev);
    }
  }, [onToggleCollapse]);

  // ========== INTELLIGENT MERGE: Update Existing + Add New Processes ==========
  const [cachedCpuData, setCachedCpuData] = useState([]);
  const hasReceivedDataRef = useRef(false);

  // Merge function: Update existing processes, add new ones
  const mergeProcessData = useCallback((existingData, newData) => {
    if (!Array.isArray(newData) || newData.length === 0) {
      return existingData;
    }

    // Create a map of existing processes by PID for O(1) lookup
    const existingMap = new Map();
    existingData.forEach(process => {
      // Use PID as primary key, UUID as secondary
      const key = process.pid || process.uuid;
      existingMap.set(key, process);
    });

    // Create merged result
    const merged = [];
    const processedKeys = new Set();

    // Process new data: update existing or add new
    newData.forEach(newProcess => {
      const key = newProcess.pid || newProcess.uuid;
      processedKeys.add(key);

      if (existingMap.has(key)) {
        // Update existing process with new data
        merged.push({
          ...existingMap.get(key),
          ...newProcess,
          // Keep UUID if it exists in either
          uuid: newProcess.uuid || existingMap.get(key).uuid
        });
      } else {
        // Add new process
        merged.push(newProcess);
      }
    });

    // Add processes that are in existing but not in new data (keep old processes briefly)
    // This prevents processes from disappearing if they temporarily don't report
    existingData.forEach(existingProcess => {
      const key = existingProcess.pid || existingProcess.uuid;
      if (!processedKeys.has(key)) {
        // Only keep if it's recent (you can add timestamp check here)
        merged.push(existingProcess);
      }
    });

    return merged;
  }, []);

  // Smart cache update with merge logic
  useEffect(() => {
    let validData = null;

    // Extract valid data from incoming prop
    if (Array.isArray(applicationCpuData) && applicationCpuData.length > 0) {
      validData = applicationCpuData;
    }
    else if (
      deviceId &&
      typeof applicationCpuData === 'object' &&
      !Array.isArray(applicationCpuData) &&
      applicationCpuData[deviceId] &&
      Array.isArray(applicationCpuData[deviceId]) &&
      applicationCpuData[deviceId].length > 0
    ) {
      validData = applicationCpuData[deviceId];
    }

    // Only update cache if we have valid new data
    if (validData && validData.length > 0) {
      setCachedCpuData(prev => {
        // If this is first data or cache is empty, use new data directly
        if (!hasReceivedDataRef.current || prev.length === 0) {
          hasReceivedDataRef.current = true;
          return validData;
        }
        
        // Otherwise, intelligently merge existing with new data
        const mergedData = mergeProcessData(prev, validData);
        return mergedData;
      });
    }
  }, [applicationCpuData, deviceId, mergeProcessData]);

  // Always use cached data - it only updates when new valid data arrives
  const stableCpuData = cachedCpuData;

  // Map your data structure to match component expectations
  const mapApplicationCpuData = useCallback((data) => {
    if (!Array.isArray(data)) return [];
    
    return data.map(item => ({
      uuid: item.uuid,
      pid: item.pid,
      name: item.name,
      status: item.status,
      threads: item.threads,
      cpu_average: item.cpu_average,
      cpu_id: item.cpu_id || item.cpu_uuid,
      checkpoint_id: item.checkpoint_id,
      created_at: item.created_at,
      updated_at: item.updated_at
    }));
  }, []);

  const cpuData = useMemo(() => {
    if (processData.length > 0) {
      return processData;
    }
    return mapApplicationCpuData(stableCpuData);
  }, [processData, stableCpuData, mapApplicationCpuData]);

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const formatStatus = (status) => {
    if (!status) return "Unknown";
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  // ================== UPDATED NAVIGATION WITH UUID ==================
  const handleApplicationClick = useCallback((app) => {
    // Use UUID navigation (same pattern as DiskResourceMonitor)
    if (app.uuid && deviceId) {
      navigate(`/devices/${deviceId}/application-cpu-io/${app.uuid}`);
    } 
  }, [navigate, deviceId]);

  // Sort toggle logic
  const toggleSort = useCallback((field) => {
    setSortStack((prev) => {
      const foundIndex = prev.findIndex((s) => s.field === field);
      if (foundIndex !== -1) {
        const currentDirection = prev[foundIndex].direction;
        if (currentDirection === "asc") {
          const updated = [...prev];
          updated[foundIndex] = { field, direction: "desc" };
          return updated;
        } else if (currentDirection === "desc") {
          return prev.filter((_, index) => index !== foundIndex);
        }
      }
      return [...prev, { field, direction: "asc" }];
    });
  }, []);

  // Get sort arrow icon
  const getSortArrow = useCallback((field) => {
    const found = sortStack.find(s => s.field === field);
    if (!found) return null;
    return found.direction === "asc" ? <ChevronUp className="w-3 h-3 ml-1 inline" /> : <ChevronDown className="w-3 h-3 ml-1 inline" />;
  }, [sortStack]);

  // Compare values for sorting
  const compareValues = useCallback((a, b, field, direction) => {
    let valA = a[field];
    let valB = b[field];

    if (["pid", "cpu_average", "threads"].includes(field)) {
      valA = parseFloat(valA) || 0;
      valB = parseFloat(valB) || 0;
    }

    if (valA < valB) return direction === "asc" ? -1 : 1;
    if (valA > valB) return direction === "asc" ? 1 : -1;
    return 0;
  }, []);

  const sortedRows = useMemo(() => {
    let rows = [...cpuData];
    for (const { field, direction } of sortStack) {
      rows.sort((a, b) => compareValues(a, b, field, direction));
    }
    return rows;
  }, [cpuData, sortStack, compareValues]);

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      {/* Main Card */}
      <div
        className="rounded-lg shadow-md overflow-visible relative"
        style={{
          backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
          border: isDarkMode ? '1px solid #374151' : '1px solid #E5E7EB',
          cursor: 'pointer',
        }}
      >
        {/* Header with toggle */}
        <div
          className="p-3 sm:p-4 flex justify-between items-center flex-wrap gap-2 font-medium tracking-wider text-sm text-gray-600"
          onClick={handleToggle}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleToggle();
            }
          }}
          aria-expanded={isOpen}
          aria-label="Toggle CPU resource monitor open or close"
        >
          <span
            className="flex items-center text-base sm:text-lg font-semibold"
            style={{ color: isDarkMode ? '#FFF' : '#525759' }}
          >
            <Cpu className="mr-2" />
            Application CPU Processes ({sortedRows.length})
          </span>
          <span className="ml-2">
            {isOpen ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </span>
        </div>

        {isOpen && (
          <div
            className="overflow-y-auto overflow-x-auto px-2 sm:px-4 py-4 custom-scroll"
            style={{ maxHeight: '24rem' }}
          >
            <div className="max-w-6xl mx-auto">
              {cpuData.length === 0 ? (
                <div className="text-center py-8" style={{ color: isDarkMode ? '#D1D5DB' : '#6B7280' }}>
                  <Cpu className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  {deviceId ? (
                    <>
                      <p>No CPU Process data available for this device.</p>
                      <p className="text-xs mt-1 opacity-75">Waiting for real-time data from agents...</p>
                    </>
                  ) : (
                    <>
                      <p>No CPU Process data available.</p>
                      <p className="text-xs mt-2 opacity-75">Waiting for real-time data from agents...</p>
                    </>
                  )}
                </div>
              ) : (
                <table
                  className={`w-full text-sm text-left border-collapse font-medium tracking-wider min-w-[700px] ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}
                >
                  <thead>
                    <tr
                      className="sticky top-[-17px] z-10 font-normal"
                      style={{ backgroundColor: isDarkMode ? '#111827' : '#f2f5f7' }}
                    >
                      <th
                        className="py-2 sm:py-3 px-2 sm:px-4 cursor-pointer"
                        onClick={() => toggleSort('pid')}
                      >
                        <div className="flex items-center">
                          PID {getSortArrow('pid')}
                        </div>
                      </th>
                      <th
                        className="py-2 sm:py-3 px-2 sm:px-4 cursor-pointer"
                        onClick={() => toggleSort('name')}
                      >
                        <div className="flex items-center">
                          Process Name {getSortArrow('name')}
                        </div>
                      </th>
                      <th
                        className="py-2 sm:py-3 px-2 sm:px-4 cursor-pointer"
                        onClick={() => toggleSort('status')}
                      >
                        <div className="flex items-center">
                          Status {getSortArrow('status')}
                        </div>
                      </th>
                      <th
                        className="py-2 sm:py-3 px-2 sm:px-4 cursor-pointer"
                        onClick={() => toggleSort('threads')}
                      >
                        <div className="flex items-center">
                          Threads {getSortArrow('threads')}
                        </div>
                      </th>
                      <th
                        className="py-2 sm:py-3 px-2 sm:px-4 cursor-pointer"
                        onClick={() => toggleSort('cpu_average')}
                      >
                        <div className="flex items-center">
                          CPU Average % {getSortArrow('cpu_average')}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((app, idx) => (
                      <tr
                        key={app.uuid || `${app.pid}-${idx}`}
                        onClick={() => handleApplicationClick(app)}
                        className={`cursor-pointer transition-all duration-200 ${
                          isDarkMode
                            ? idx % 2 === 0
                              ? 'bg-gray-800 hover:bg-gray-700'
                              : 'bg-gray-900 hover:bg-gray-800'
                            : idx % 2 === 0
                              ? 'bg-gray-50 hover:bg-blue-50'
                              : 'bg-white hover:bg-blue-50'
                        } hover:shadow-sm`}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleApplicationClick(app);
                          }
                        }}
                        title={`Click to view CPU details for ${app.name} (UUID: ${app.uuid})`}
                      >
                        <td className="py-2 sm:py-3 px-2 sm:px-4">
                          <div className="flex items-center">
                            <div className="w-1 h-6 bg-purple-400 rounded-full mr-2"></div>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              isDarkMode
                                ? 'bg-blue-900/50 text-blue-300'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {app.pid}
                            </span>
                          </div>
                        </td>
                        <td
                          className="py-2 sm:py-3 px-2 sm:px-4 truncate max-w-[160px]"
                          title={app.name}
                        >
                          <div className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {app.name || 'Unknown Process'}
                          </div>
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4" title={app.status}>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            app.status === 'running' 
                              ? isDarkMode ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-800'
                              : isDarkMode ? 'bg-yellow-900/50 text-yellow-300' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {formatStatus(app.status)}
                          </span>
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4" title={`${app.threads} threads`}>
                          <span className="text-sm text-blue-600 font-medium">
                            {app.threads || 0}
                          </span>
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4" title={`${parseFloat(app.cpu_average || 0).toFixed(1)}%`}>
                          <span className="text-sm text-green-600 font-medium">
                            {parseFloat(app.cpu_average || 0).toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CPUResourceMonitor;