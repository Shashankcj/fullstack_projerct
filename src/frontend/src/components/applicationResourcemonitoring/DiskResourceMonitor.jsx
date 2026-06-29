import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { HardDrive, ChevronUp, ChevronDown } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDocumentTitle } from "../../Hooks/useDocumentTitle";

const DiskResourceMonitor = ({ 
  isDarkMode, 
  processData = [], 
  isCollapsed = false,     
  onToggleCollapse = null,
  applicationDiskData
}) => {
  useDocumentTitle('Application Resource Monitor');
  const navigate = useNavigate();
  const { id: deviceId } = useParams();

  const [sortStack, setSortStack] = useState([{ field: 'total_b_sec', direction: 'desc' }]);
  
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
  const [cachedDiskData, setCachedDiskData] = useState([]);
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
    if (Array.isArray(applicationDiskData) && applicationDiskData.length > 0) {
      validData = applicationDiskData;
    }
    else if (
      deviceId &&
      typeof applicationDiskData === 'object' &&
      !Array.isArray(applicationDiskData) &&
      applicationDiskData[deviceId] &&
      Array.isArray(applicationDiskData[deviceId]) &&
      applicationDiskData[deviceId].length > 0
    ) {
      validData = applicationDiskData[deviceId];
    }

    // Only update cache if we have valid new data
    if (validData && validData.length > 0) {
      setCachedDiskData(prev => {
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
  }, [applicationDiskData, deviceId, mergeProcessData]);

  // Always use cached data - it only updates when new valid data arrives
  const stableDiskData = cachedDiskData;

  // Use provided data or get cached data
  const diskData = useMemo(() => {
    if (processData.length > 0) {
      return processData;
    }
    return stableDiskData;
  }, [processData, stableDiskData]);

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getResponseTimeColor = (time) => {
    if (time === 0) return 'text-green-600';
    if (time < 100) return 'text-yellow-600';
    return 'text-red-600';
  };

  // ================== SIMPLIFIED NAVIGATION (ONLY UUID) ==================
  const handleApplicationClick = useCallback((app) => {
    // Only pass UUID in URL, both components get same applicationData prop
    if (app.uuid && deviceId) {
      navigate(`/devices/${deviceId}/application-disk-io/${app.uuid}`);
    } 
  }, [navigate, deviceId]);

  // Toggle sort function (keep existing)
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

  // Get sort arrow (keep existing)
  const getSortArrow = useCallback((field) => {
    const found = sortStack.find((s) => s.field === field);
    if (!found) return null;
    return found.direction === "asc" ? <ChevronUp className="w-3 h-3 ml-1 inline" /> : <ChevronDown className="w-3 h-3 ml-1 inline" />;
  }, [sortStack]);

  // Compare values function (keep existing)
  const compareValues = useCallback((a, b, field, direction) => {
    let valA = a[field];
    let valB = b[field];

    if (["pid", "read_b_sec", "write_b_sec", "total_b_sec", "response_time", "io_priority"].includes(field)) {
      valA = parseFloat(valA) || 0;
      valB = parseFloat(valB) || 0;
    }

    if (valA < valB) return direction === "asc" ? -1 : 1;
    if (valA > valB) return direction === "asc" ? 1 : -1;
    return 0;
  }, []);

  // Sorting only (no filtering)
  const sortedRows = useMemo(() => {
    let rows = [...diskData];
    for (const { field, direction } of sortStack) {
      rows.sort((a, b) => compareValues(a, b, field, direction));
    }
    return rows;
  }, [diskData, sortStack, compareValues]);

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      {/* Main Container with toggle */}
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
          aria-label="Toggle disk resource monitor open or close"
        >
          <span
            className="flex items-center text-base sm:text-lg font-semibold"
            style={{ color: isDarkMode ? '#FFF' : '#525759' }}
          >
            <HardDrive className="mr-2" />
            Application Disk I/O Processes ({sortedRows.length})
          </span>

          {/* Toggle icon */}
          <span className="ml-2">
            {isOpen ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </span>
        </div>

        {/* Table (keep existing table structure) */}
        {isOpen && (
          <div
            className="overflow-y-auto overflow-x-auto px-2 sm:px-4 py-4 custom-scroll"
            style={{ maxHeight: '24rem' }}
          >
            <div className="max-w-6xl mx-auto">
              {diskData.length === 0 ? (
                <div className="text-center py-8" style={{ color: isDarkMode ? '#D1D5DB' : '#6B7280' }}>
                  <HardDrive className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  {deviceId ? (
                    <>
                      <p>No Disk I/O Process data available for this device.</p>
                      <p className="text-xs mt-1 opacity-75">Waiting for real-time data from agents...</p>
                    </>
                  ) : (
                    <>
                      <p>No Disk I/O Process data available.</p>
                      <p className="text-xs mt-2 opacity-75">Waiting for real-time data from agents...</p>
                    </>
                  )}
                </div>
              ) : (
                <table
                  className={`w-full text-sm text-left border-collapse font-medium tracking-wider min-w-[800px] ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}
                >
                  <thead>
                    <tr
                      className="sticky top-[-17px] z-10 font-normal"
                      style={{ backgroundColor: isDarkMode ? '#111827' : '#f2f5f7' }}
                    >
                      <th className="py-2 sm:py-3 px-2 sm:px-4 cursor-pointer" onClick={() => toggleSort('pid')}>
                        <div className="flex items-center">PID {getSortArrow('pid')}</div>
                      </th>
                      <th className="py-2 sm:py-3 px-2 sm:px-4 cursor-pointer" onClick={() => toggleSort('name')}>
                        <div className="flex items-center">Process Name {getSortArrow('name')}</div>
                      </th>
                      <th className="py-2 sm:py-3 px-2 sm:px-4">File Path</th>
                      <th className="py-2 sm:py-3 px-2 sm:px-4 cursor-pointer" onClick={() => toggleSort('read_b_sec')}>
                        <div className="flex items-center">Read B/sec {getSortArrow('read_b_sec')}</div>
                      </th>
                      <th className="py-2 sm:py-3 px-2 sm:px-4 cursor-pointer" onClick={() => toggleSort('write_b_sec')}>
                        <div className="flex items-center">Write B/sec {getSortArrow('write_b_sec')}</div>
                      </th>
                      <th className="py-2 sm:py-3 px-2 sm:px-4 cursor-pointer" onClick={() => toggleSort('total_b_sec')}>
                        <div className="flex items-center">Total B/sec {getSortArrow('total_b_sec')}</div>
                      </th>
                      <th className="py-2 sm:py-3 px-2 sm:px-4 cursor-pointer" onClick={() => toggleSort('response_time')}>
                        <div className="flex items-center">Response Time {getSortArrow('response_time')}</div>
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
                        title={`Click to view I/O details for ${app.name}`}
                      >
                        <td className="py-2 sm:py-3 px-2 sm:px-4">
                          <div className="flex items-center">
                            <div className="w-1 h-6 bg-purple-400 rounded-full mr-2"></div>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              isDarkMode ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {app.pid}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4 truncate max-w-[160px]" title={app.name}>
                          <div className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {app.name}
                          </div>
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4 truncate max-w-[200px]" title={app.file_path}>
                          <div className={`text-xs font-mono ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                            {app.file_path}
                          </div>
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4" title={app.read_b_sec}>
                          <span className="text-sm text-green-600 font-medium">{app.read_b_sec}</span>
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4" title={app.write_b_sec}>
                          <span className="text-sm text-orange-600 font-medium">{app.write_b_sec}</span>
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4" title={app.total_b_sec}>
                          <span className="text-sm text-blue-600 font-medium">{app.total_b_sec}</span>
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4">
                          <span className={`text-sm font-medium ${getResponseTimeColor(app.response_time)}`}>
                            {app.response_time === 0 ? '0ms' : `${app.response_time.toFixed(1)}ms`}
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

export default DiskResourceMonitor;