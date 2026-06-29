import React, { useState, useEffect } from 'react';
import { Monitor } from 'lucide-react';
import { useGetDeviceDetailsByIdQuery } from '../../redux/apiSlice';
import DiskResourceMonitor from './DiskResourceMonitor';
import CPUResourceMonitor from './CpuResourceMonitor';
import MemoryResourceMonitor from './MemoryResourceMonitor';
import { useParams, useNavigate } from 'react-router-dom';

// Initialize global state
if (typeof window !== 'undefined' && !window.appStateManager) {
  window.appStateManager = {
    states: new Map(),
    set: function (key, value) {
      this.states.set(key, value);
    },
    get: function (key) {
      return this.states.get(key);
    },
    clear: function () {
      this.states.clear();
    }
  };
}

const ApplicationResourceWrapper = ({ isDarkMode, applicationDiskData, applicationCpuData, applicationMemoryData }) => {
  const { id: deviceId } = useParams();
  const navigate = useNavigate();

  // Fetch device data directly using the same logic as IOHeader
  const { data: deviceData, isLoading, error } = useGetDeviceDetailsByIdQuery(deviceId);

  // Create a unique key for this device's state
  const stateKey = `applicationResourceStates_${deviceId}`;

  // Load initial state from memory (or default values)
  const getInitialState = () => {
    if (typeof window !== 'undefined' && window.appStateManager) {
      const savedState = window.appStateManager.get(stateKey);
      if (savedState) {
        return savedState;
      }
    }

    return {
      disk: false,
      cpu: true,
      memory: true
    };
  };

  const [collapsedStates, setCollapsedStates] = useState(getInitialState);

  // Save state whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && window.appStateManager) {
      window.appStateManager.set(stateKey, collapsedStates);
    }
  }, [collapsedStates, stateKey]);

  const handleDeviceClick = () => {
    if (deviceId) {
      navigate(`/devices/${deviceId}`);
    }
  };

  // Function to toggle individual card states
  const toggleCard = (cardType) => {
    setCollapsedStates(prev => ({
      ...prev,
      [cardType]: !prev[cardType]
    }));
  };

  return (
    <div className="min-h-[85vh]">
      {/* Fixed Device Header - Responsive positioning */}
      <div
        className="fixed top-16 left-0 lg:left-64 right-0 z-10 px-3 sm:px-4 pt-3 sm:pt-4 pb-2 sm:pb-3 rounded-lg mt-1.8"
        style={{
          backgroundColor: isDarkMode ? 'rgba(17, 24, 39, 0.95)' : 'rgba(240, 244, 255, 0.95)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        <div className="max-w-[1440px] mx-auto">
          <div
            className={`rounded-lg p-3 sm:p-4 border shadow-sm ${isDarkMode
                ? 'bg-gray-800/50 border-gray-700/50'
                : 'bg-white/50 border-gray-200/50'
              }`}
          >
            <div className="flex items-center gap-2 sm:gap-3 cursor-pointer" onClick={handleDeviceClick}>
              <div className="p-1.5 sm:p-2 bg-[#6366f1] rounded-lg shadow flex-shrink-0">
                <Monitor className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h1
                  className="text-base sm:text-lg lg:text-xl font-bold truncate"
                  style={{ color: isDarkMode ? '#FFFFFF' : '#1F2937' }}
                >
                  Application Resource Monitor
                </h1>
                <p
                  className="text-xs truncate"
                  style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}
                >
                  {deviceData?.device?.hostname || 'Unknown Device'} • {deviceData?.device?.device?.nic?.[0]?.port?.[0]?.ip?.[0]?.address || 'Unknown IP'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content area with reduced spacing between resource monitors */}
      <div className="pt-10 sm:pt-24 space-y-2 px-3 sm:px-0">
        <div className="space-y-2">
          {/* Disk Resource Monitor */}
          <div className={`backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-lg border transition-all duration-300 hover:shadow-xl overflow-hidden ${isDarkMode
              ? 'bg-gray-800/70 border-gray-700/50'
              : 'bg-white/70 border-gray-200/50'
            }`}>
            <DiskResourceMonitor
              isDarkMode={isDarkMode}
              isCollapsed={collapsedStates.disk}
              applicationDiskData={applicationDiskData}
              onToggleCollapse={() => toggleCard('disk')}
            />
          </div>

          {/* CPU Resource Monitor */}
          <div className={`backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-lg border overflow-hidden transition-all duration-300 hover:shadow-xl ${isDarkMode
              ? 'bg-gray-800/70 border-gray-700/50'
              : 'bg-white/70 border-gray-200/50'
            }`}>
            <CPUResourceMonitor
              isDarkMode={isDarkMode}
              isCollapsed={collapsedStates.cpu}
              applicationCpuData={applicationCpuData}
              onToggleCollapse={() => toggleCard('cpu')}
            />
          </div>

          {/* Memory Resource Monitor */}
          <div className={`backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-lg border overflow-hidden transition-all duration-300 hover:shadow-xl ${isDarkMode
              ? 'bg-gray-800/70 border-gray-700/50'
              : 'bg-white/70 border-gray-200/50'
            }`}>
            <MemoryResourceMonitor
              isDarkMode={isDarkMode}
              isCollapsed={collapsedStates.memory}
              applicationMemoryData={applicationMemoryData}
              onToggleCollapse={() => toggleCard('memory')}
            />
          </div>
        </div>
      </div>

    </div>
  );
};

export default ApplicationResourceWrapper;
