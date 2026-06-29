import { useState, Suspense, lazy, useEffect, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import PrivateRoute          from './PrivateRoute';
import { ToastContainer }    from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { WebSocketContext }  from './Contexts/WebSocketContext';
import usePersistedTheme     from './Hooks/usePersistedTheme';
import RenderIfAllowed       from './components/shared/RenderIfAllowed';
import BmcDashboard          from './components/features/Bmc_Management/pages/Bmc_Dashboard';


/* ================= LAZY IMPORTS ================= */
const DashboardLayout     = lazy(() => import('./components/features/Dashboard/components/DashboardLayout'));
const Dashboard          = lazy(() => import('./components/features/Dashboard/pages/Dashboard'));
const DevicesPage        = lazy(() => import('./components/pages/DevicesPage'));
const IPMonitoring       = lazy(() => import('./components/features/IP_monitoring/pages/IPMonitoring'));
const BMCMonitoring      = lazy(() => import('./components/features/Bmc_Management/components/BMCTable'));
const DashBoard          = lazy(() => import('./components/features/Device/Dashboard/DashBoard'));
const AlertPage          = lazy(() => import('./components/features/Alerts/pages/AlertsPage'));
const EventLogsPage      = lazy(() => import('./components/features/Events_logs/pages/EventLogsPage'));
const ErrorPage          = lazy(() => import('./components/shared/ErrorPage'));
const DeviceInventory    = lazy(() => import('./components/features/Device/Dashboard/DeviceInventory'));

// Application Resource Monitoring
const ApplicationResource = lazy(() => import('./components/applicationResourcemonitoring/ApplicationResourceWrapper'));
const DiskIO              = lazy(() => import('./components/applicationResourcemonitoring/DiskIO'));
const MemoryIO            = lazy(() => import('./components/applicationResourcemonitoring/MemoryIO'));
const CpuIO               = lazy(() => import('./components/applicationResourcemonitoring/CpuIO'));

// Layout & Settings
const SettingsPage        = lazy(() => import('./components/layout/Settings'));
const Layout              = lazy(() => import('./components/layout/Layout'));

// Admin
const AdminPanel          = lazy(() => import('./components/features/UserProfile/UserPanel'));
const Userlist            = lazy(() => import('./components/features/UsersList/pages/userpage'));
const RoleManagement      = lazy(() => import('./components/features/Roles/pages/RoleManagement'));
const GlobalConfiguration = lazy(() => import('./components/features/GlobalConfig/components/GlobalConfiguration'));

// ✅ Kept — still have active routes
const PermissionManagement = lazy(() => import('./components/permissions/PermissionManagement'));
const UserPermissionsPage  = lazy(() => import('./components/permissions/UserPermissionsPage'));

// Audit & Jobs
const AuditLogs = lazy(() => import('./components/features/Audit_logs/pages/AuditLogs'));
const Jobs      = lazy(() => import('./components/features/Jobs/pages/Jobs'));

// Auth
const SignIn           = lazy(() => import('./components/features/User/SignIn/SignIn'));
const SignUp           = lazy(() => import('./components/features/User/SignUp/SignUp'));
const EmailVerification = lazy(() => import('./components/features/User/EmailVerification/EmailVerification'));
const ForgotPassword   = lazy(() => import('./components/features/User/ForgotPassword/ForgotPassword'));
const ResetPassword    = lazy(() => import('./components/features/User/ResetPassword/ResetPassword'));
const PasswordResetInfo = lazy(() => import('./components/features/User/ForgotPassword/PasswordResetInfo'));
const PasswordReset    = lazy(() => import('./components/features/User/ResetPassword/PasswordReset'));

// Device Layout & Monitoring
const DeviceLayout         = lazy(() => import('./components/features/Device/DeviceLayout'));
const CPUMonitoring        = lazy(() => import('./components/features/Device/ComponentMonitoring/CpuMonitoring'));
const MemoryMonitoring     = lazy(() => import('./components/features/Device/ComponentMonitoring/MemoryMonitoring'));
const NetworkMonitoring    = lazy(() => import('./components/features/Device/ComponentMonitoring/NetworkMonitoring'));
const DiskMonitoring       = lazy(() => import('./components/features/Device/ComponentMonitoring/DiskMonitoring'));
const DiskIOMonitoring     = lazy(() => import('./components/features/Device/ComponentMonitoring/DiskIOMonitoring'));
const PartitionMonitoring  = lazy(() => import('./components/features/Device/ComponentMonitoring/PartitionMonitoring'));

// IP Monitoring
const IPMonitorLayout = lazy(() => import('./components/features/IP_monitoring/components/IPMonitorLayout'));
const IPMonitor       = lazy(() => import('./components/features/IP_monitoring/pages/IPMonitorChart'));


/* ================= APP CONTENT ================= */

const AppContent = () => {
  const { monitoringData }   = useContext(WebSocketContext);
  const { isDarkMode, toggleTheme } = usePersistedTheme();

  const [searchQuery,    setSearchQuery]    = useState('');
  const [refreshInterval, setRefreshInterval] = useState(5);
  const [cpuMap,         setCpuMap]         = useState({});
  const [memoryMap,      setMemoryMap]      = useState({});
  const [diskMap,        setDiskMap]        = useState({});
  const [networkMap,     setNetworkMap]     = useState({});
  const [activeAgents,   setActiveAgents]   = useState({});
  const [applicationCpuIoMap,    setApplicationCpuIoMap]    = useState({});
  const [applicationDiskIoMap,   setApplicationDiskIoMap]   = useState({});
  const [applicationMemoryIoMap, setApplicationMemoryIoMap] = useState({});

  // ✅ Removed console.log("Monitoring data", data)
  useEffect(() => {
    if (!monitoringData?.data) return;

    const newCpuMap              = {};
    const newMemoryMap           = {};
    const newDiskMap             = {};
    const newNetworkMap          = {};
    const newActiveAgents        = {};
    const newApplicationCpuIoMap    = {};
    const newApplicationDiskIoMap   = {};
    const newApplicationMemoryIoMap = {};

    for (const agentId in monitoringData.data) {
      const data = monitoringData.data[agentId];
      newActiveAgents[agentId] = Date.now();
      if (data.cpu)                  newCpuMap[agentId]                  = data.cpu;
      if (data.memory)               newMemoryMap[agentId]               = data.memory;
      if (data.disks)                newDiskMap[agentId]                 = data.disks;
      if (data.network)              newNetworkMap[agentId]              = data.network;
      if (data.application_cpu_io)    newApplicationCpuIoMap[agentId]    = data.application_cpu_io;
      if (data.application_disk_io)   newApplicationDiskIoMap[agentId]   = data.application_disk_io;
      if (data.application_memory_io) newApplicationMemoryIoMap[agentId] = data.application_memory_io;
    }

    setCpuMap(prev            => ({ ...prev, ...newCpuMap }));
    setMemoryMap(prev         => ({ ...prev, ...newMemoryMap }));
    setDiskMap(prev           => ({ ...prev, ...newDiskMap }));
    setNetworkMap(prev        => ({ ...prev, ...newNetworkMap }));
    setActiveAgents(prev      => ({ ...prev, ...newActiveAgents }));
    setApplicationCpuIoMap(prev    => ({ ...prev, ...newApplicationCpuIoMap }));
    setApplicationDiskIoMap(prev   => ({ ...prev, ...newApplicationDiskIoMap }));
    setApplicationMemoryIoMap(prev => ({ ...prev, ...newApplicationMemoryIoMap }));
  }, [monitoringData]);


  return (
    <Suspense fallback={<div className="p-4 text-center">Loading...</div>}>
      <Routes>

        {/* ── Public Routes ── */}
        <Route path="/signin"                    element={<SignIn />} />
        <Route path="/signup"                    element={<SignUp />} />
        <Route path="/verify-email/:token"       element={<EmailVerification />} />
        <Route path="/forgot-password"           element={<ForgotPassword />} />
        <Route path="/forgot-password-info"      element={<PasswordResetInfo />} />
        <Route path="/reset-password/:uuid"      element={<ResetPassword />} />
        <Route path="/reset-password/first-time" element={<PasswordReset />} />

        {/* ── Protected Routes ── */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout
                isDarkMode={isDarkMode}
                toggleTheme={toggleTheme}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                refreshInterval={refreshInterval}
                setRefreshInterval={setRefreshInterval}
              />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />

          {/* Dashboard */}
          <Route
  path="dashboard/:priority"
  element={<DashboardLayout isDarkMode={isDarkMode} />}
>
  <Route
    index
    element={
      <Dashboard
        isDarkMode={isDarkMode}
        activeAgents={activeAgents}
      />
    }
  />

  
  <Route path="devices/:agentId" element={<DeviceLayout isDarkMode={isDarkMode} />}>
            <Route index                  element={<DashBoard           isDarkMode={isDarkMode} />} />
            <Route path="inventory"       element={<DeviceInventory     isDarkMode={isDarkMode} />} />
            <Route path="mon/cpu"         element={<CPUMonitoring       isDarkMode={isDarkMode} />} />
            <Route path="mon/memory"      element={<MemoryMonitoring    isDarkMode={isDarkMode} />} />
            <Route path="mon/network"     element={<NetworkMonitoring   isDarkMode={isDarkMode} />} />
            <Route path="mon/disk"        element={<DiskMonitoring      isDarkMode={isDarkMode} />} />
            <Route path="mon/disk_io"     element={<DiskIOMonitoring    isDarkMode={isDarkMode} />} />
            <Route path="mon/partition"   element={<PartitionMonitoring isDarkMode={isDarkMode} />} />
          </Route>
</Route>



























          {/* BMC */}
          <Route path="bmc_dashboard" element={<BmcDashboard isDarkMode={isDarkMode} />} />

          {/* Devices */}
          <Route path="devices"
            element={
              <RenderIfAllowed module="monitoring" action="read" showForbidden={true}>
                <DevicesPage isDarkMode={isDarkMode} />
              </RenderIfAllowed>
            }
          />

          {/* IP Monitoring */}
          <Route path="ip_monitoring"
            element={
              <RenderIfAllowed module="ip_monitoring" action="read" showForbidden={true}>
                <IPMonitoring isDarkMode={isDarkMode} />
              </RenderIfAllowed>
            }
          />
          <Route path="bmc_monitoring"
            element={
              <RenderIfAllowed module="ip_monitoring" action="read" showForbidden={true}>
                <BMCMonitoring isDarkMode={isDarkMode} />
              </RenderIfAllowed>
            }
          />
          <Route path="ip_monitoring/:ipMonitorUUID/" element={<IPMonitorLayout isDarkMode={isDarkMode} />}>
            <Route index element={<IPMonitor isDarkMode={isDarkMode} />} />
          </Route>

          {/* Admin */}
          <Route path="/profile"      element={<AdminPanel isDarkMode={isDarkMode} />} />
          <Route path="/userlist"     element={<Userlist   isDarkMode={isDarkMode} />} />
          <Route path="/profile/permissions"
            element={<PermissionManagement isDarkMode={isDarkMode} />}
          />
          <Route path="/profile/permissions/setpermissions"
            element={<UserPermissionsPage isDarkMode={isDarkMode} />}
          />

          {/* Settings */}
          <Route path="/settings"          element={<SettingsPage        isDarkMode={isDarkMode} />} />
          <Route path="/role-management"   element={<RoleManagement      isDarkMode={isDarkMode} />} />
          <Route path="/audit-logs"        element={<AuditLogs           isDarkMode={isDarkMode} />} />
          <Route path="/jobs"              element={<Jobs                isDarkMode={isDarkMode} />} />
          <Route path="/global-configuration" element={<GlobalConfiguration isDarkMode={isDarkMode} />} />

          {/* Alerts & Event Logs */}
          <Route path="alerts"
            element={
              <RenderIfAllowed module="monitoring" action="read" showForbidden={true}>
                <AlertPage isDarkMode={isDarkMode} />
              </RenderIfAllowed>
            }
          />
          <Route path="event-logs"
            element={
              <RenderIfAllowed module="monitoring" action="read" showForbidden={true}>
                <EventLogsPage isDarkMode={isDarkMode} />
              </RenderIfAllowed>
            }
          />

          {/* Device-specific nested routes */}
          

        </Route>

        {/* 404 */}
        <Route path="*" element={<ErrorPage isDarkMode={isDarkMode} />} />

      </Routes>
    </Suspense>
  );
};


/* ================= APP ================= */

const App = () => (
  <>
    <AppContent />
    <ToastContainer
      position="top-right"
      autoClose={4000}
      hideProgressBar={false}
      newestOnTop={false}
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme="light"
    />
  </>
);

export default App;