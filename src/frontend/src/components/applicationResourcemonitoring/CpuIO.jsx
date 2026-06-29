import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { Cpu } from 'lucide-react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useDocumentTitle } from '../../Hooks/useDocumentTitle';
import { MonitoringCalculations } from './calculations';
import { CPU_CONFIG } from './monitoringConfigs';
import IOHeader from './Deviceheader';
import '../index.css';

const CPUIO = ({ isDarkMode, applicationData = [] }) => {
  
  
  useDocumentTitle("Application CPU Usage");
  const navigate = useNavigate();
  const location = useLocation();
  const { appId, id } = useParams();
  const [currentTime] = useState(new Date());
  const [selectedGraphType, setSelectedGraphType] = useState('line');

  // ========== STALE-WHILE-REVALIDATE PATTERN (NEW) ==========
  const [previousApplicationData, setPreviousApplicationData] = useState([]);
  
  useEffect(() => {
    if (Array.isArray(applicationData) && applicationData.length > 0) {
      setPreviousApplicationData(applicationData);
    } else if (applicationData && typeof applicationData === 'object') {
      const hasData = Object.keys(applicationData).some(
        key => Array.isArray(applicationData[key]) && applicationData[key].length > 0
      );
      if (hasData) {
        setPreviousApplicationData(applicationData);
      }
    }
  }, [applicationData]);

  const stableApplicationData = useMemo(() => {
    if (Array.isArray(applicationData) && applicationData.length > 0) {
      return applicationData;
    }
    if (applicationData && typeof applicationData === 'object' && Object.keys(applicationData).length > 0) {
      const hasData = Object.keys(applicationData).some(
        key => Array.isArray(applicationData[key]) && applicationData[key].length > 0
      );
      if (hasData) return applicationData;
    }
    return previousApplicationData;
  }, [applicationData, previousApplicationData]);

  // ================== UUID FILTERING ==================
  
  const getAllApplicationData = () => {
    if (!stableApplicationData || (Array.isArray(stableApplicationData) && stableApplicationData.length === 0)) {
      return [];
    }
    
    if (Array.isArray(stableApplicationData)) {
      return stableApplicationData;
    }
    
    const allData = [];
    for (const agentId in stableApplicationData) {
      if (stableApplicationData[agentId] && Array.isArray(stableApplicationData[agentId])) {
        allData.push(...stableApplicationData[agentId]);
      }
    }
    return allData;
  };

  const allApps = getAllApplicationData();
  const selectedAppData = allApps.find(app => app.uuid === appId);

  // ========== CACHE PREVIOUS SELECTED APP DATA (NEW) ==========
  const [previousSelectedAppData, setPreviousSelectedAppData] = useState(null);

  useEffect(() => {
    if (selectedAppData && selectedAppData.uuid === appId) {
      setPreviousSelectedAppData(selectedAppData);
    }
  }, [selectedAppData, appId]);

  const stableSelectedAppData = selectedAppData || previousSelectedAppData;

  // ================== CPU MONITORING STATE ==================
  
  const [lastProcessedData, setLastProcessedData] = useState(null);
  const [calculatedMetrics, setCalculatedMetrics] = useState({
    cpuPercent: 0,
    averageCpuPercent: 0,
    threads: 0,
    status: 'unknown'
  });

  const [metricsHistory, setMetricsHistory] = useState([]);
  const [appCpuChartData, setAppCpuChartData] = useState([]);

  // ========== MEMOIZED CHART DATA TO PREVENT FLICKERING (NEW) ==========
  const stableChartData = useMemo(() => {
    return appCpuChartData.length > 0 ? appCpuChartData : [];
  }, [appCpuChartData]);

  // ================== HELPER FUNCTIONS ==================

  const getApplicationDisplayName = (app) => {
    if (app && app.name && app.name.trim()) {
      return app.name;
    }
    return app ? `Process ${app.pid}` : 'Unknown Process';
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'running': return 'text-green-600';
      case 'sleeping': return 'text-blue-600';
      case 'stopped': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const handleDeviceClick = () => { 
    if (id) navigate(`/devices/${id}`); 
  };

  // ================== SIMPLIFIED CALCULATION EFFECT USING HELPER ==================

  useEffect(() => {
    if (!stableSelectedAppData) return;

    const result = MonitoringCalculations.processComponentMetrics({
      selectedAppData: stableSelectedAppData,
      lastProcessedData,
      config: CPU_CONFIG,
      onMetricsUpdate: setCalculatedMetrics,
      onHistoryUpdate: setMetricsHistory,
      onChartUpdate: setAppCpuChartData,
      componentName: 'CPU'
    });

    if (result.shouldProcess && result.newSignature) {
      setLastProcessedData(result.newSignature);
    }
  }, [stableSelectedAppData?.cpu_average, stableSelectedAppData?.threads, stableSelectedAppData?.status, stableSelectedAppData?.updated_at]);

  // ================== RENDER UTILITIES ==================

  const cardClass = `rounded-lg shadow-md p-4 h-88 ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`;

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const renderChart = (chartData, selectedGraphType, isDarkMode) => {
    if (!chartData || chartData.length === 0) {
      return <div className="flex items-center justify-center h-48 text-gray-500">No data available</div>;
    }
    
    const commonProps = { width: "100%", height: "100%" };
    const tooltipStyle = {
      fontSize: '10px',
      padding: '4px 6px',
      backgroundColor: isDarkMode ? '#1f2937' : '#f9f9f9',
      color: isDarkMode ? '#f9f9f9' : '#1f2937',
    };
    const cpuColor = '#f97316';
    
    const tooltipFormatter = (value, name) => {
      if (value === undefined || value === null) return [`0%`, name];
      return [`${value.toFixed(2)}%`, name];
    };
    
    const yAxisFormatter = (value) => {
      return `${value}%`;
    };
    
    const tickProps = {
      fontSize: 10,
      fill: isDarkMode ? '#d1d5db' : '#6b7280'
    };
    
    switch (selectedGraphType) {
      case 'line':
        return (
          <ResponsiveContainer {...commonProps}>
            <LineChart data={chartData}>
              <XAxis dataKey="time" tick={tickProps} interval="preserveStartEnd" />
              <YAxis domain={[0, 'dataMax + 5']} tick={tickProps} tickFormatter={yAxisFormatter} />
              <Tooltip formatter={tooltipFormatter} contentStyle={tooltipStyle} itemStyle={{ fontSize: '12px' }} />
              <Line type="monotone" dataKey="cpu" stroke={cpuColor} strokeWidth={2} dot={false} name="CPU %" />
            </LineChart>
          </ResponsiveContainer>
        );
      case 'area':
        return (
          <ResponsiveContainer {...commonProps}>
            <AreaChart data={chartData}>
              <XAxis dataKey="time" tick={tickProps} interval="preserveStartEnd" />
              <YAxis domain={[0, 'dataMax + 5']} tick={tickProps} tickFormatter={yAxisFormatter} />
              <Tooltip formatter={tooltipFormatter} contentStyle={tooltipStyle} itemStyle={{ fontSize: '12px' }} />
              <Area type="monotone" dataKey="cpu" stackId="1" stroke={cpuColor} fill={cpuColor} fillOpacity={0.6} name="CPU %" />
            </AreaChart>
          </ResponsiveContainer>
        );
      default:
        return null;
    }
  };

  // Show message if application not found by UUID
  if (!stableSelectedAppData) {
    return (
      <div className="space-y-4">
        <div className={`rounded-lg shadow-md p-8 text-center ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
          <Cpu className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold mb-2">Application Not Found</h3>
          <p className="text-xs text-gray-400 mt-2">
            Available applications: {allApps.length}
          </p>
          <button 
            onClick={() => navigate(-1)}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <IOHeader 
        deviceId={id}
        isDarkMode={isDarkMode}
        onDeviceClick={handleDeviceClick}
        selectedGraphType={selectedGraphType}
        onGraphTypeChange={setSelectedGraphType}
      />

      <div className="grid grid-cols-1">
        <div className={`rounded-lg shadow-md p-4 h-20 flex items-center justify-between ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 bg-[#6366f1] rounded flex items-center justify-center">
              <Cpu className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Application CPU Monitoring
              </h3>
              <div className="mt-1">
                <div className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {getApplicationDisplayName(stableSelectedAppData)}
                </div>
                <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  PID: {stableSelectedAppData.pid}
                </div>
              </div>
            </div>
          </div>

          <div className={`text-sm whitespace-nowrap ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            {currentTime.toLocaleString()}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={cardClass}>
          <div className="flex items-center gap-1 mb-2">
            <Cpu className="w-5 h-5" />
            <h4 className="text-md font-semibold">Application CPU Usage</h4>
          </div>

          <div className={`p-3 rounded-lg border-l-4 border-orange-500 mb-4 ${
            isDarkMode ? 'bg-orange-900/20' : 'bg-orange-50'
          }`}>
            <div className="flex items-center gap-1 mb-1">
              <span className={`text-xs font-medium ${
                isDarkMode ? 'text-orange-300' : 'text-orange-800'
              }`}>Current CPU %</span>
            </div>
            <div className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {calculatedMetrics.cpuPercent.toFixed(2)}%
            </div>
          </div>

          <div>
            <div className={`flex items-center justify-between mb-3 ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
              <h3 className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>CPU Usage Over Time</h3>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-0.5 bg-orange-500"></div>
                  <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>CPU %</span>
                </div>
              </div>
            </div>

            <div className="h-40 -ml-8">
              <ResponsiveContainer width="100%" height="100%">
                <div className="h-48">
                  {renderChart(stableChartData, selectedGraphType, isDarkMode)}
                </div>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className={cardClass}>
          <div className="flex items-center gap-1 mb-2">
            <Cpu className="w-5 h-5" />
            <h4 className="text-md font-semibold">Application Summary</h4>
          </div>

          <div className="space-y-4">
            <div className={`p-4 rounded-lg border-l-4 ${
              isDarkMode
                ? 'bg-orange-900/30 border-orange-400'
                : 'bg-orange-50 border-orange-500'
            }`}>
              <div className="flex justify-between items-center mb-2">
                <span className={`text-sm font-medium ${isDarkMode ? 'text-orange-300' : 'text-orange-800'}`}>
                  Process Name
                </span>
                <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-700'}`}>
                  {getApplicationDisplayName(stableSelectedAppData)}
                </span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className={`text-sm font-medium ${isDarkMode ? 'text-orange-300' : 'text-orange-800'}`}>
                  Process ID
                </span>
                <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-700'}`}>
                  {stableSelectedAppData?.pid || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className={`text-sm font-medium ${isDarkMode ? 'text-orange-300' : 'text-orange-800'}`}>
                  Status
                </span>
                <span className={`text-sm font-semibold ${getStatusColor(stableSelectedAppData?.status)}`}>
                  {stableSelectedAppData?.status?.charAt(0)?.toUpperCase() + stableSelectedAppData?.status?.slice(1) || 'Unknown'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className={`text-sm font-medium ${isDarkMode ? 'text-orange-300' : 'text-orange-800'}`}>
                  Threads
                </span>
                <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-700'}`}>
                  {stableSelectedAppData?.threads || 0}
                </span>
              </div>
            </div>

            <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <h5 className={`text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>Real-time Performance</h5>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Current CPU:</span>
                  <span className={`text-xs font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {calculatedMetrics.cpuPercent.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Avg CPU (2s):</span>
                  <span className={`text-xs font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {calculatedMetrics.averageCpuPercent.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Status:</span>
                  <span className={`text-xs font-medium ${getStatusColor(calculatedMetrics.status)}`}>
                    {calculatedMetrics.status?.charAt(0)?.toUpperCase() + calculatedMetrics.status?.slice(1) || 'Unknown'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Threads:</span>
                  <span className={`text-xs font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {calculatedMetrics.threads || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Last Updated:</span>
                  <span className={`text-xs font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {stableSelectedAppData?.updated_at ? formatDateTime(stableSelectedAppData.updated_at) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CPUIO;
