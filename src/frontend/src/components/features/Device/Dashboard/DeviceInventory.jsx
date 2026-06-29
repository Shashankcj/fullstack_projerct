import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useGetDeviceDetailsByIdQuery } from '../../../../redux/apiSlice';
import PageWrapper from "../../../../components/Utilities/PageWrapper";

import {
  Cpu,
  HardDrive,
  Server,
  ChevronDown,
  ChevronRight,
  Info,
  MemoryStick,
  Network,
  AlertCircle,
  RefreshCw,
  Gpu,
} from 'lucide-react';
import WaveLoader from '../../../../components/shared/loading';


const emptyObj = Object.freeze({});
const emptyArr = Object.freeze([]);

const DeviceInventory = ({ isDarkMode }) => {
  const { agentId } = useParams();
  const location = useLocation();

  if (!agentId) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 sm:p-6 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="text-center">
          <h3 className={`text-base sm:text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Invalid Device ID</h3>
        </div>
      </div>
    );
  }

  const { data, isLoading, error, refetch } = useGetDeviceDetailsByIdQuery(agentId, {
    pollingInterval: 5000,
  });

  const [expandedSections, setExpandedSections] = useState({
    cpu: false,
    gpu: false,
    memory: false,
    nic: false,
    storage: false,
  });

  const cpuRef     = useRef(null);
  const gpuRef     = useRef(null);
  const memoryRef  = useRef(null);
  const nicRef     = useRef(null);
  const storageRef = useRef(null);

  const scrollToSection = useCallback((ref, offset = 160) => {
    if (ref?.current) {
      const elementPosition = ref.current.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({ top: elementPosition - offset, behavior: 'smooth' });
    }
  }, []);

  const toggleSection = useCallback((section) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const handleCardClick = useCallback((section, ref) => {
    const isExpanded = expandedSections[section];
    if (isExpanded) {
      scrollToSection(ref);
    } else {
      setExpandedSections((prev) => ({ ...prev, [section]: true }));
      setTimeout(() => scrollToSection(ref), 400);
    }
  }, [expandedSections, scrollToSection]);

  // Auto-scroll when coming from flag navigation
  useEffect(() => {
    const scrollTarget = location.state?.scrollTo;
    const fromFlag     = location.state?.fromFlag;
    if (!fromFlag || !scrollTarget) return;

    const timer = setTimeout(() => {
      let targetRef = null;
      if (scrollTarget === 'storage') {
        targetRef = storageRef;
        setExpandedSections((prev) => ({ ...prev, storage: true }));
      } else if (scrollTarget === 'ports' || scrollTarget === 'nics' || scrollTarget === 'network') {
        targetRef = nicRef;
        setExpandedSections((prev) => ({ ...prev, nic: true }));
      } else if (scrollTarget === 'cpu') {
        targetRef = cpuRef;
        setExpandedSections((prev) => ({ ...prev, cpu: true }));
      } else if (scrollTarget === 'memory') {
        targetRef = memoryRef;
        setExpandedSections((prev) => ({ ...prev, memory: true }));
      } else if (scrollTarget === 'gpu') {
        targetRef = gpuRef;
        setExpandedSections((prev) => ({ ...prev, gpu: true }));
      }
      if (targetRef?.current) scrollToSection(targetRef);
    }, 600);

    return () => clearTimeout(timer);
  }, [location.state, scrollToSection]);

  // Highlight flagged port
  useEffect(() => {
    const flaggedPortUuid  = location.state?.flaggedPortUuid;
    const highlightNetwork = location.state?.highlightNetwork;
    if (!(flaggedPortUuid && highlightNetwork)) return;

    const timer = setTimeout(() => {
      const portElement = document.querySelector(`[data-port-uuid="${flaggedPortUuid}"]`);
      if (portElement) {
        portElement.classList.add('ring-2', 'ring-red-500', 'ring-opacity-75');
        portElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          portElement.classList.remove('ring-2', 'ring-red-500', 'ring-opacity-75');
        }, 3000);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [location.state?.flaggedPortUuid, location.state?.highlightNetwork]);

  const getGridCols = useMemo(() => (count) => {
    if (count === 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-1 lg:grid-cols-2';
    if (count === 3) return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
    return 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3';
  }, []);

  const getPortGridCols = useMemo(() => (portCount) => {
    if (portCount === 1) return 'grid-cols-1';
    if (portCount === 2) return 'grid-cols-1 sm:grid-cols-2';
    if (portCount <= 6)  return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
    return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
  }, []);

  const getStatusColor = useMemo(() => (status) => {
    const baseClasses = 'px-2 py-1 rounded-full text-xs font-medium border';
    switch (status?.toLowerCase()) {
      case 'connected': case 'active': case 'excellent': case 'good':
        return isDarkMode
          ? `${baseClasses} bg-emerald-900/50 text-emerald-300 border-emerald-700`
          : `${baseClasses} bg-emerald-100 text-emerald-700 border-emerald-200`;
      case 'disconnected': case 'inactive': case 'critical': case 'failing':
        return isDarkMode
          ? `${baseClasses} bg-red-900/50 text-red-300 border-red-700`
          : `${baseClasses} bg-red-100 text-red-700 border-red-200`;
      case 'warning': case 'degraded':
        return isDarkMode
          ? `${baseClasses} bg-yellow-900/50 text-yellow-300 border-yellow-700`
          : `${baseClasses} bg-yellow-100 text-yellow-700 border-yellow-200`;
      default:
        return isDarkMode
          ? `${baseClasses} bg-gray-700 text-gray-300 border-gray-600`
          : `${baseClasses} bg-gray-100 text-gray-700 border-gray-200`;
    }
  }, [isDarkMode]);

  const hasValidGateway = useMemo(() => (nic) => {
    if (!nic.port || !Array.isArray(nic.port)) return false;
    return nic.port.some((port) =>
      port.ip && Array.isArray(port.ip) &&
      port.ip.some((ip) => {
        const gw = ip.gateway?.trim?.() ?? '';
        return gw && gw !== 'N/A' && gw !== 'Unknown' && gw !== '0.0.0.0';
      })
    );
  }, []);

  const getConnectionStatus = useMemo(() => (nic) => {
    const isConnected = hasValidGateway(nic);
    return {
      text: isConnected ? 'Connected' : 'Disconnected',
      className: isConnected
        ? 'px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
        : 'px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    };
  }, [hasValidGateway]);

  const InfoRow = useMemo(() => ({ label, value, highlight = false }) => (
    <div className="flex justify-between items-center py-2 border-b border-gray-200/20 last:border-b-0">
      <span className={`text-xs sm:text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{label}</span>
      <span className={`text-xs sm:text-sm font-semibold truncate max-w-[60%] text-right ${
        highlight ? 'text-blue-500' : isDarkMode ? 'text-gray-200' : 'text-gray-900'
      }`}>
        {value || 'N/A'}
      </span>
    </div>
  ), [isDarkMode]);

  const ComponentCard = useMemo(() =>
    React.memo(
      React.forwardRef(({ title, icon: Icon, children, sectionKey, count }, ref) => {
        const isExpanded = expandedSections[sectionKey];
        return (
          <div
            ref={ref}
            className={`rounded-xl shadow-sm border overflow-hidden transition-all duration-200 hover:shadow-md ${
              isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            }`}
          >
            <div
              className={`p-3 sm:p-4 border-b cursor-pointer transition-colors ${
                isDarkMode
                  ? 'bg-gray-900/50 border-gray-700 hover:bg-gray-900/70'
                  : 'bg-gradient-to-r from-slate-50 to-gray-50 border-gray-200 hover:from-slate-100 hover:to-gray-100'
              }`}
              onClick={() => toggleSection(sectionKey)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className={`p-1.5 sm:p-2 rounded-lg shadow-sm flex-shrink-0 ${isDarkMode ? 'bg-gray-700' : 'bg-white'}`}>
                    <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${isDarkMode ? 'text-gray-300' : 'text-slate-600'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className={`font-semibold text-sm sm:text-base truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
                    <p className={`text-xs sm:text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {count} component{count !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                {isExpanded
                  ? <ChevronDown className={`w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`} />
                  : <ChevronRight className={`w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`} />
                }
              </div>
            </div>
            {isExpanded && <div className="p-4 sm:p-6">{children}</div>}
          </div>
        );
      })
    ),
    [expandedSections, isDarkMode, toggleSection]
  );

  /* ── Loading ── */
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
        <div className="text-center">
          <div className="mb-6"><WaveLoader /></div>
          <h3 className="text-base sm:text-lg font-semibold" style={{ color: isDarkMode ? '#FFFFFF' : '#1F2937' }}>
            Loading Device Inventory
          </h3>
          <p className="text-xs sm:text-sm" style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}>
            Fetching hardware information...
          </p>
        </div>
      </div>
    );
  }

  /* ── Error ── */
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4" style={{ color: '#EF4444' }} />
          <h3 className="text-lg sm:text-xl font-semibold mb-2" style={{ color: isDarkMode ? '#FFFFFF' : '#1F2937' }}>
            Failed to Load Device Inventory
          </h3>
          <p className="text-xs sm:text-sm mb-6" style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}>
            {error?.data?.message || 'Unable to fetch device hardware information.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => refetch()}
              className="flex items-center justify-center px-4 py-2 text-sm bg-[#6366f1] text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <RefreshCw className="w-4 h-4 mr-2" /> Retry
            </button>
            <button
              onClick={() => window.history.back()}
              className={`px-4 py-2 text-sm rounded-lg transition-colors font-medium border ${
                isDarkMode
                  ? 'border-gray-600 hover:bg-gray-700 text-gray-300'
                  : 'border-gray-300 hover:bg-gray-50 text-gray-700'
              }`}
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── No Data ── */
  if (!data || !data.device) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
        <div className="text-center max-w-md">
          <Server className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4" style={{ color: isDarkMode ? '#6B7280' : '#9CA3AF' }} />
          <h3 className="text-lg sm:text-xl font-semibold mb-2" style={{ color: isDarkMode ? '#FFFFFF' : '#1F2937' }}>
            Device Not Found
          </h3>
          <p className="text-xs sm:text-sm mb-6" style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}>
            The requested device inventory could not be found.
          </p>
          <button
            onClick={() => window.history.back()}
            className="flex items-center justify-center px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Go Back to Devices
          </button>
        </div>
      </div>
    );
  }

  const device    = data.device;
  const agentInfo = data;

  /* ── Main UI ── */
  return (
    <PageWrapper isDarkMode={isDarkMode}>
      <div className="min-h-[85vh]">
        <div className="pt-4 space-y-4 sm:space-y-5 px-3 sm:px-0">

          {/* System Summary Card */}
          <div className={`rounded-xl p-3 sm:p-4 border max-h-48 sm:max-h-56 overflow-hidden ${
            isDarkMode
              ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
              : 'bg-gradient-to-br from-blue-50 to-indigo-100 border-blue-200'
          }`}>
            <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-4">
              <div className="p-1 sm:p-1.5 bg-[#6366f1] rounded-lg flex-shrink-0">
                <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
              </div>
              <h3 className="text-sm sm:text-base font-semibold leading-tight" style={{ color: isDarkMode ? '#FFFFFF' : '#1F2937' }}>
                System Summary
              </h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">

              {/* CPU */}
              <div
                onClick={() => handleCardClick('cpu', cpuRef)}
                className={`rounded-lg p-2 sm:p-3 text-center shadow-sm border cursor-pointer transition-all duration-200 hover:shadow-md h-16 sm:h-20 flex flex-col justify-center ${
                  isDarkMode ? 'bg-gray-700/50 border-gray-600 hover:bg-blue-500/20 hover:border-blue-500/30' : 'bg-white border-gray-200 hover:bg-blue-50 hover:border-blue-200'
                }`}
              >
                <Cpu className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 mx-auto mb-1" />
                <p className="text-lg sm:text-xl font-bold leading-none" style={{ color: isDarkMode ? '#FFFFFF' : '#1F2937' }}>
                  {device?.cpu?.[0]?.p_cores || 0}
                </p>
                <p className="text-xs leading-tight" style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}>CPU Cores</p>
              </div>

              {/* Memory */}
              <div
                onClick={() => handleCardClick('memory', memoryRef)}
                className={`rounded-lg p-2 sm:p-3 text-center shadow-sm border cursor-pointer transition-all duration-200 hover:shadow-md h-16 sm:h-20 flex flex-col justify-center ${
                  isDarkMode ? 'bg-gray-700/50 border-gray-600 hover:bg-green-500/20 hover:border-green-500/30' : 'bg-white border-gray-200 hover:bg-green-50 hover:border-green-200'
                }`}
              >
                <MemoryStick className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 mx-auto mb-1" />
                <p className="text-lg sm:text-xl font-bold leading-none" style={{ color: isDarkMode ? '#FFFFFF' : '#1F2937' }}>
                  {(device?.memory?.[0]?.size || '0').toString().replace(' GB', '')}
                </p>
                <p className="text-xs leading-tight" style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}>GB RAM</p>
              </div>

              {/* Storage */}
              <div
                onClick={() => handleCardClick('storage', storageRef)}
                className={`rounded-lg p-2 sm:p-3 text-center shadow-sm border cursor-pointer transition-all duration-200 hover:shadow-md h-16 sm:h-20 flex flex-col justify-center ${
                  isDarkMode ? 'bg-gray-700/50 border-gray-600 hover:bg-orange-500/20 hover:border-orange-500/30' : 'bg-white border-gray-200 hover:bg-orange-50 hover:border-orange-200'
                }`}
              >
                <HardDrive className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 mx-auto mb-1" />
                <p className="text-lg sm:text-xl font-bold leading-none" style={{ color: isDarkMode ? '#FFFFFF' : '#1F2937' }}>
                  {device?.storage?.length || 0}
                </p>
                <p className="text-xs leading-tight" style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}>Storage</p>
              </div>

              {/* GPU */}
              <div
                onClick={() => handleCardClick('gpu', gpuRef)}
                className={`rounded-lg p-2 sm:p-3 text-center shadow-sm border cursor-pointer transition-all duration-200 hover:shadow-md h-16 sm:h-20 flex flex-col justify-center ${
                  isDarkMode ? 'bg-gray-700/50 border-gray-600 hover:bg-purple-500/20 hover:border-purple-500/30' : 'bg-white border-gray-200 hover:bg-purple-50 hover:border-purple-200'
                }`}
              >
                <Gpu className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 mx-auto mb-1" />
                <p className="text-lg sm:text-xl font-bold leading-none" style={{ color: isDarkMode ? '#FFFFFF' : '#1F2937' }}>
                  {device?.gpu?.length || 0}
                </p>
                <p className="text-xs leading-tight" style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}>
                  GPU{(device?.gpu?.length || 0) !== 1 ? 's' : ''}
                </p>
              </div>

              {/* NIC */}
              <div
                onClick={() => handleCardClick('nic', nicRef)}
                className={`rounded-lg p-2 sm:p-3 text-center shadow-sm border cursor-pointer transition-all duration-200 hover:shadow-md h-16 sm:h-20 flex flex-col justify-center ${
                  isDarkMode ? 'bg-gray-700/50 border-gray-600 hover:bg-indigo-500/20 hover:border-indigo-500/30' : 'bg-white border-gray-200 hover:bg-indigo-50 hover:border-indigo-200'
                }`}
              >
                <Network className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 mx-auto mb-1" />
                <p className="text-lg sm:text-xl font-bold leading-none" style={{ color: isDarkMode ? '#FFFFFF' : '#1F2937' }}>
                  {device?.nic?.length || 0}
                </p>
                <p className="text-xs leading-tight" style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}>NICs</p>
              </div>

            </div>
          </div>

          {/* Components Grid */}
          <div className="space-y-4 sm:space-y-6">

            {/* CPU Section */}
            {device?.cpu && device.cpu.length > 0 && (
              <ComponentCard ref={cpuRef} title="Processor" icon={Cpu} sectionKey="cpu" count={device.cpu.length}>
                <div className={`grid gap-4 sm:gap-6 ${getGridCols(device.cpu.length)}`}>
                  {device.cpu.map((cpu, index) => (
                    <div key={cpu.uuid || `cpu-${device.device_id || agentId}-${index}`} className={`rounded-lg p-4 sm:p-5 border ${isDarkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                        <div className="p-1.5 sm:p-2 bg-[#6366f1] rounded-lg flex-shrink-0">
                          <Cpu className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className={`font-semibold text-xs sm:text-sm truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{cpu.make || 'Unknown CPU'}</h4>
                          <p className={`text-xs font-medium truncate ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{cpu.model || 'Unknown Model'}</p>
                        </div>
                      </div>
                      <div className="space-y-0">
                        <InfoRow label="Physical Cores" value={cpu.p_cores} highlight />
                        <InfoRow label="Logical Cores"  value={cpu.l_cores} highlight />
                        <InfoRow label="Max Clock Speed" value={cpu.speed} />
                      </div>
                    </div>
                  ))}
                </div>
              </ComponentCard>
            )}

            {/* Memory Section */}
            {device?.memory && device.memory.length > 0 && (
              <ComponentCard ref={memoryRef} title="Memory" icon={MemoryStick} sectionKey="memory" count={device.memory.length}>
                <div className={`grid gap-4 sm:gap-6 ${getGridCols(device.memory.length)}`}>
                  {device.memory.map((memory, index) => (
                    <div key={memory.uuid || `mem-${device.device_id || agentId}-${index}`} className={`rounded-lg p-4 sm:p-5 border ${isDarkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                        <div className="p-1.5 sm:p-2 bg-green-600 rounded-lg flex-shrink-0">
                          <MemoryStick className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className={`font-semibold text-xs sm:text-sm truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{memory.make || 'Unknown Memory'}</h4>
                          <p className={`text-xs font-medium truncate ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{memory.model || 'Unknown Model'}</p>
                        </div>
                      </div>
                      <div className="space-y-0">
                        <InfoRow label="Total Size"  value={memory.size} highlight />
                        <InfoRow label="Type"        value={memory.type} />
                        <InfoRow label="Speed"       value={memory.speed} />
                        <InfoRow label="Slots Used"  value={memory.slots_used && memory.slots_total ? `${memory.slots_used}/${memory.slots_total}` : 'N/A'} />
                      </div>
                      {memory.slots_used && memory.slots_total && (
                        <div className="mt-3 sm:mt-4 pt-2 sm:pt-3 border-t border-gray-200/20">
                          <div className={`w-full rounded-full h-2 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`}>
                            <div className="bg-green-600 h-2 rounded-full transition-all duration-300" style={{ width: `${(memory.slots_used / memory.slots_total) * 100}%` }} />
                          </div>
                          <p className={`text-xs mt-1 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Slot Utilization</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ComponentCard>
            )}

            {/* Storage Section */}
            {device?.storage && device.storage.length > 0 && (
              <ComponentCard ref={storageRef} title="Storage Devices" icon={HardDrive} sectionKey="storage" count={device.storage.length}>
                <div className={`grid gap-4 sm:gap-6 ${getGridCols(device.storage.length)}`}>
                  {device.storage.map((storage, index) => {
                    const isFlagged = storage.is_flagged === true;
                    return (
                      <div
                        key={storage.uuid || `stor-${device.device_id || agentId}-${index}`}
                        className={`rounded-lg p-4 sm:p-5 border relative transition-opacity ${
                          isDarkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
                        } ${isFlagged ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''}`}
                        title={isFlagged ? 'This disk is flagged and disabled' : ''}
                      >
                        <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
                          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                            <div className={`p-1.5 sm:p-2 rounded-lg flex-shrink-0 ${isFlagged ? 'bg-red-600' : 'bg-orange-600'}`}>
                              <HardDrive className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className={`font-semibold text-xs sm:text-sm truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{storage.make || 'Unknown Storage'}</h4>
                              <p className={`text-xs font-medium truncate ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{storage.model || 'Unknown Model'}</p>
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            {isFlagged
                              ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-600 text-white shadow whitespace-nowrap">Flagged</span>
                              : <span className={getStatusColor(storage.health || 'Good')}>{storage.health || 'Good'}</span>
                            }
                          </div>
                        </div>
                        <div className="space-y-0">
                          <InfoRow label="Capacity"      value={storage.total_disk_size} highlight />
                          <InfoRow label="Type"          value={storage.hw_disk_type} />
                          <InfoRow label="Interface"     value={storage.interface} />
                          <InfoRow label="File System"   value={storage.base_fs_type} />
                          <InfoRow label="Serial Number" value={storage.serial_number} />
                          <InfoRow label="Temperature"   value={storage.temperature} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ComponentCard>
            )}

            {/* GPU Section */}
            {device?.gpu && device.gpu.length > 0 && (
              <ComponentCard ref={gpuRef} title="Graphics" icon={Gpu} sectionKey="gpu" count={device.gpu.length}>
                <div className={`grid gap-4 sm:gap-6 ${getGridCols(device.gpu.length)}`}>
                  {device.gpu.map((gpu, index) => (
                    <div key={gpu.uuid || `gpu-${device.device_id || agentId}-${index}`} className={`rounded-lg p-4 sm:p-5 border ${isDarkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                        <div className="p-1.5 sm:p-2 bg-purple-600 rounded-lg flex-shrink-0">
                          <Gpu className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className={`font-semibold text-xs sm:text-sm truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{gpu.make || 'Unknown GPU'}</h4>
                          <p className={`text-xs font-medium truncate ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{gpu.model || 'Unknown Model'}</p>
                        </div>
                      </div>
                      <div className="space-y-0">
                        <InfoRow label="VRAM"           value={gpu.size} highlight />
                        <InfoRow label="Driver Version" value={gpu.driver} />
                        <InfoRow label="Resolution"     value={gpu.resolution} />
                        <InfoRow label="Refresh Rate"   value={gpu.refresh_rate} />
                      </div>
                    </div>
                  ))}
                </div>
              </ComponentCard>
            )}

            {/* Network Section */}
            {device?.nic && device.nic.length > 0 && (
              <ComponentCard ref={nicRef} title="Network Interfaces" icon={Network} sectionKey="nic" count={device.nic.length}>
                <div className={`grid gap-4 sm:gap-6 ${getGridCols(device.nic.length)}`}>
                  {device.nic.map((nic, index) => {
                    const isNicDirectlyFlagged  = nic.is_flagged === true;
                    const hasNicFlaggedPort     = nic.port && nic.port.some((port) => port.uuid === location.state?.flaggedPortUuid);
                    const hasPortWithFlaggedData = nic.port && nic.port.some((port) => port.is_flagged === true);
                    const isNicDisabled         = isNicDirectlyFlagged || hasNicFlaggedPort || hasPortWithFlaggedData;

                    return (
                      <div
                        key={nic.uuid || `nic-${device.device_id || agentId}-${index}`}
                        className={`rounded-lg p-4 sm:p-5 border relative transition-opacity ${
                          isDarkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
                        } ${isNicDisabled ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''}`}
                        title={
                          isNicDirectlyFlagged
                            ? 'This NIC is flagged and disabled'
                            : hasNicFlaggedPort || hasPortWithFlaggedData
                              ? 'This NIC contains a flagged port and is disabled'
                              : ''
                        }
                      >
                        <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
                          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                            <div className={`p-1.5 sm:p-2 rounded-lg flex-shrink-0 ${isNicDisabled ? 'bg-red-600' : 'bg-[#6366f1]'}`}>
                              <Network className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className={`font-semibold text-xs sm:text-sm truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{nic.make || 'Unknown NIC'}</h4>
                              <p className={`text-xs font-medium truncate ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{nic.model || 'Unknown Model'}</p>
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            {isNicDirectlyFlagged ? (
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-600 text-white shadow whitespace-nowrap">Flagged</span>
                            ) : hasNicFlaggedPort || hasPortWithFlaggedData ? (
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-600 text-white shadow whitespace-nowrap">Flagged Port</span>
                            ) : (
                              <div className={getConnectionStatus(nic).className}>{getConnectionStatus(nic).text}</div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-0 mb-3 sm:mb-4">
                          <InfoRow label="Max Speed"   value={nic.max_speed} highlight />
                          <InfoRow label="Ports"       value={nic.number_of_ports} />
                          <InfoRow label="MAC Address" value={nic.mac_address} />
                        </div>

                        {nic.port && Array.isArray(nic.port) && nic.port.length > 0 && (
                          <div className="mt-3 sm:mt-4">
                            <h5 className={`text-xs sm:text-sm font-medium mb-2 sm:mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              Ports ({nic.port.length})
                            </h5>
                            <div className={`grid gap-2 sm:gap-3 ${getPortGridCols(nic.port.length)}`}>
                              {nic.port.map((port, portIndex) => {
                                const isFlaggedFromNavigation = port.uuid === location.state?.flaggedPortUuid;
                                const isFlaggedFromData       = port.is_flagged === true;
                                const isFlaggedPort           = isFlaggedFromNavigation || isFlaggedFromData;

                                return (
                                  <div
                                    key={port.uuid || `port-${nic.uuid || index}-${portIndex}`}
                                    data-port-uuid={port.uuid}
                                    className={`rounded-lg border p-3 sm:p-4 transition-all duration-300 ${
                                      isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'
                                    } ${isFlaggedPort
                                      ? 'border-red-500 bg-red-50 dark:bg-red-900/30'
                                      : 'hover:shadow-md'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between mb-2 sm:mb-3">
                                      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                                        <div className={`p-1 sm:p-1.5 rounded-md flex-shrink-0 ${isFlaggedPort ? 'bg-red-600' : 'bg-[#6366f1]'}`}>
                                          <Network className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
                                        </div>
                                        <span className={`font-medium text-xs sm:text-sm truncate ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                                          {port.interface_name || `Port ${portIndex + 1}`}
                                        </span>
                                      </div>
                                      {isFlaggedPort ? (
                                        <span className="px-1.5 sm:px-2 py-0.5 rounded-full text-xs font-semibold bg-red-600 text-white whitespace-nowrap flex-shrink-0">Flagged</span>
                                      ) : (
                                        <span className="px-1.5 sm:px-2 py-0.5 rounded-full text-xs font-semibold bg-green-600 text-white whitespace-nowrap flex-shrink-0">Active</span>
                                      )}
                                    </div>

                                    <div className="space-y-1.5 sm:space-y-2 text-xs">
                                      <div className={`flex justify-between ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                        <span>Speed:</span>
                                        <span className="font-medium truncate ml-2">{port.operating_speed || 'Unknown'}</span>
                                      </div>
                                      <div className={`flex justify-between ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                        <span>Type:</span>
                                        <span className="font-medium truncate ml-2">{port.is_physical_logical || 'Unknown'}</span>
                                      </div>
                                      {port.logical_type && (
                                        <div className={`flex justify-between ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                          <span>Logical:</span>
                                          <span className="font-medium truncate ml-2">{port.logical_type}</span>
                                        </div>
                                      )}
                                    </div>

                                    {port.ip && Array.isArray(port.ip) && port.ip.length > 0 && (
                                      <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-200 dark:border-gray-600">
                                        <div className={`text-xs font-medium mb-1.5 sm:mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>
                                          IP Addresses ({port.ip.length})
                                        </div>
                                        <div className="space-y-1">
                                          {port.ip.slice(0, 2).map((ip, ipIndex) => (
                                            <div key={ip.uuid || ipIndex} className={`text-xs truncate ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                                              {ip.address}
                                            </div>
                                          ))}
                                          {port.ip.length > 2 && (
                                            <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                              +{port.ip.length - 2} more
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ComponentCard>
            )}

          </div>
        </div>
      </div>
    </PageWrapper>
  );
};

export default DeviceInventory;