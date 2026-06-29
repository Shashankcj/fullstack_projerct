import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { MemoryStick, ChevronUp, ChevronDown } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDocumentTitle } from "../../Hooks/useDocumentTitle";

const MemoryResourceMonitor = ({
  isDarkMode,
  isCollapsed = false,
  onToggleCollapse = null,
  applicationMemoryData = []
}) => {
  useDocumentTitle('Memory Resource Monitor');
  const navigate = useNavigate();
  const { id: deviceId } = useParams();
 

  const [sortStack, setSortStack] = useState([{ field: 'working_set_kb', direction: 'desc' }]);
  const [internalIsOpen, setInternalIsOpen] = useState(true);
  const isOpen = onToggleCollapse ? !isCollapsed : internalIsOpen;

  const handleToggle = useCallback(() => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalIsOpen(prev => !prev);
    }
  }, [onToggleCollapse]);

  // ========== INTELLIGENT MERGE: Update Existing + Add New Processes ==========
  const [cachedMemoryData, setCachedMemoryData] = useState([]);
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
    if (Array.isArray(applicationMemoryData) && applicationMemoryData.length > 0) {
      validData = applicationMemoryData;
    }
    else if (
      deviceId &&
      typeof applicationMemoryData === 'object' &&
      !Array.isArray(applicationMemoryData) &&
      applicationMemoryData[deviceId] &&
      Array.isArray(applicationMemoryData[deviceId]) &&
      applicationMemoryData[deviceId].length > 0
    ) {
      validData = applicationMemoryData[deviceId];
    }

    // Only update cache if we have valid new data
    if (validData && validData.length > 0) {
      setCachedMemoryData(prev => {
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
  }, [applicationMemoryData, deviceId, mergeProcessData]);

  // Always use cached data - it only updates when new valid data arrives
  const stableMemoryData = cachedMemoryData;

  // ================== MAP APPLICATION MEMORY DATA ==================
  const mapApplicationMemoryData = useCallback((data) => {
    if (!Array.isArray(data)) return [];
    
    return data.map(item => ({
      uuid: item.uuid,
      pid: item.pid,
      name: item.name,
      commit_kb: item.commit_kb,
      working_set_kb: item.working_set_kb,
      private_kb: item.private_kb,
      memory_id: item.memory_id || item.memory_uuid,
      checkpoint_id: item.checkpoint_id,
      created_at: item.created_at,
      updated_at: item.updated_at
    }));
  }, []);

  const memoryData = useMemo(() => {
    return mapApplicationMemoryData(stableMemoryData);
  }, [stableMemoryData, mapApplicationMemoryData]);

  // ================== UTILITY FUNCTIONS ==================
  const formatKB = (kb) => kb ? kb.toLocaleString() + " KB" : "0 KB";

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  // ================== NAVIGATION WITH UUID ==================
  const handleApplicationClick = useCallback((app) => {
    if (app.uuid && deviceId) {
      navigate(`/devices/${deviceId}/application-memory-io/${app.uuid}`);
    }
  }, [navigate, deviceId]);

  // ================== SORTING LOGIC ==================
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

  const getSortArrow = useCallback((field) => {
    const found = sortStack.find(s => s.field === field);
    if (!found) return null;
    return found.direction === "asc"
      ? <ChevronUp className="w-3 h-3 ml-1 inline" />
      : <ChevronDown className="w-3 h-3 ml-1 inline" />;
  }, [sortStack]);

  const compareValues = useCallback((a, b, field, direction) => {
    let valA = a[field];
    let valB = b[field];
    if (["pid", "commit_kb", "working_set_kb", "private_kb"].includes(field)) {
      valA = parseFloat(valA) || 0;
      valB = parseFloat(valB) || 0;
    }
    if (valA < valB) return direction === "asc" ? -1 : 1;
    if (valA > valB) return direction === "asc" ? 1 : -1;
    return 0;
  }, []);

  const sortedRows = useMemo(() => {
    let rows = [...memoryData];
    for (const { field, direction } of sortStack) {
      rows.sort((a, b) => compareValues(a, b, field, direction));
    }
    return rows;
  }, [memoryData, sortStack, compareValues]);

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      <div
        className="rounded-lg shadow-md overflow-visible relative"
        style={{
          backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
          border: isDarkMode ? '1px solid #374151' : '1px solid #E5E7EB',
          cursor: 'pointer',
        }}
      >
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
          aria-label="Toggle memory resource monitor open or close"
        >
          <span
            className="flex items-center text-base sm:text-lg font-semibold"
            style={{ color: isDarkMode ? '#FFF' : '#525759' }}
          >
            <MemoryStick className="mr-2" />
            Application Memory Processes ({sortedRows.length})
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
              {memoryData.length === 0 ? (
                <div className="text-center py-8" style={{ color: isDarkMode ? '#D1D5DB' : '#6B7280' }}>
                  <MemoryStick className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  {deviceId ? (
                    <>
                      <p>No Memory Process data available for this device.</p>
                      <p className="text-xs mt-1 opacity-75">Waiting for real-time data from agents...</p>
                    </>
                  ) : (
                    <>
                      <p>No Memory Process data available.</p>
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
                        onClick={() => toggleSort('commit_kb')}
                      >
                        <div className="flex items-center">
                          Commit (KB) {getSortArrow('commit_kb')}
                        </div>
                      </th>
                      <th
                        className="py-2 sm:py-3 px-2 sm:px-4 cursor-pointer"
                        onClick={() => toggleSort('working_set_kb')}
                      >
                        <div className="flex items-center">
                          Working Set (KB) {getSortArrow('working_set_kb')}
                        </div>
                      </th>
                      <th
                        className="py-2 sm:py-3 px-2 sm:px-4 cursor-pointer"
                        onClick={() => toggleSort('private_kb')}
                      >
                        <div className="flex items-center">
                          Private (KB) {getSortArrow('private_kb')}
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
                        title={`Click to view memory details for ${app.name} (UUID: ${app.uuid})`}
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
                          <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            {app.name}
                          </span>
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4 text-green-600 font-medium">
                          {formatKB(app.commit_kb)}
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4 text-blue-600 font-medium">
                          {formatKB(app.working_set_kb)}
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4 text-pink-600 font-medium">
                          {formatKB(app.private_kb)}
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

export default MemoryResourceMonitor;