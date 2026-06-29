import React, { useState, useEffect, useRef, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import DashboardIcon from '@mui/icons-material/Dashboard';
import RenderIfAllowed from '../shared/RenderIfAllowed';
import '../index.css';
import {
  Server, TriangleAlert, FileText, Sun, Moon,
  Network, Settings, X
} from 'lucide-react';

/* ================= CONSTANTS ================= */

const ICON_CLASS = "w-5 h-5 flex-shrink-0 transition-colors duration-300";

/* ================= PURE HELPERS ================= */

const navLinkClass = (isActive, isExpanded) =>
  `group w-full flex items-center gap-2 py-3 px-2
   rounded-lg transition-all duration-300 active:scale-[0.98]
   ${isExpanded ? 'justify-start pl-3' : 'justify-center'}
   ${isActive
     ? 'bg-indigo-500 text-white shadow-sm'
     : 'text-gray-500 hover:bg-indigo-100/80 dark:hover:bg-gray-800/80 hover:text-indigo-400'
   }`;

/* ================= CUSTOM HOOK ================= */

const useIsDesktop = () => {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= 1024
  );
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isDesktop;
};

/* ================= COMPONENT ================= */

const Sidebar = ({ isDarkMode, toggleTheme, isSidebarOpen, closeSidebar }) => {
  const [isHovered, setIsHovered] = useState(false);

  const sidebarRef = useRef(null);
  const location   = useLocation();
  const isDesktop  = useIsDesktop();

  const textColor  = isDarkMode ? '#FFFFFF' : '#1F2937';
  const isExpanded = isHovered || isSidebarOpen;

  /* ================= ROUTE FLAGS ================= */

  const isDevicesActive  = location.pathname.startsWith('/devices');
  const isSettingsActive = location.pathname.startsWith('/settings')      ||
                           location.pathname.startsWith('/custom-groups') ||
                           location.pathname.startsWith('/profile');

  /* ================= MEMOIZED VALUES ================= */

  const labelClass = useMemo(() =>
    `text-sm font-medium whitespace-nowrap truncate transition-all duration-300
     ${isExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0 pointer-events-none'}`,
    [isExpanded]
  );

  /* ================= EFFECTS ================= */

  // Close sidebar on route change for mobile/tablet
  useEffect(() => {
    if (!isDesktop) closeSidebar?.();
  }, [location.pathname, closeSidebar, isDesktop]);

  // Reset hover when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target))
        setIsHovered(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Escape key closes sidebar
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (!isDesktop) closeSidebar?.();
        setIsHovered(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [closeSidebar, isDesktop]);

  /* ================= UI ================= */

  return (
    <aside
      ref={sidebarRef}
      onClick={(e) => e.stopPropagation()}
      className={`
        fixed left-0 border-r flex flex-col z-[150]
        transition-all duration-300 ease-in-out
        top-0 h-screen
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
        lg:top-[4.2rem] lg:h-[calc(100vh-4rem)]
        lg:rounded-tr-lg lg:rounded-br-lg lg:z-40
        ${isExpanded ? 'w-52' : 'lg:w-20'}
      `}
      style={{
        backgroundColor:      isDarkMode ? 'rgba(36, 38, 41, 0.55)' : 'rgba(255,255,255,0.95)',
        backdropFilter:       'blur(16px) saturate(180%)',
        WebkitBackdropFilter: 'blur(16px) saturate(180%)',
        borderColor:          isDarkMode ? 'rgba(255,255,255,0.08)'      : 'rgba(209,213,219,0.4)',
        boxShadow:            isDarkMode ? '4px 0 24px rgba(0,0,0,0.4)' : '4px 0 24px rgba(0,0,0,0.08)',
      }}
      onMouseEnter={() => isDesktop && setIsHovered(true)}
      onMouseLeave={() => isDesktop && setIsHovered(false)}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* ── Mobile Header ── */}
      <div
        className="lg:hidden flex items-center justify-between p-4 border-b flex-shrink-0"
        style={{ borderColor: isDarkMode ? '#374151' : '#E5E7EB' }}
      >
        <h2 className="text-lg font-bold" style={{ color: textColor }}>GENESIS</h2>
        <button
          onClick={closeSidebar}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" style={{ color: textColor }} />
        </button>
      </div>

      {/* ── Nav Items ── */}
      <nav className="p-1 sm:p-2 space-y-1.5 flex-1 overflow-y-auto custom-scroll">

        {/* Dashboard */}
        <NavLink
          to="dashboard/p1"
          className={({ isActive }) => navLinkClass(isActive, isExpanded)}
          aria-label="Dashboard"
        >
          <DashboardIcon className={ICON_CLASS} />
          <span className={labelClass}>Dashboard</span>
        </NavLink>

        {/* Devices — no dropdown, tabs live in the page header now */}
        {/* <RenderIfAllowed module="monitoring" action="read">
          <NavLink
            to="/devices"
            end
            className={() => navLinkClass(isDevicesActive && !isSettingsActive, isExpanded)}
            aria-label="Devices"
          >
            <Server className={ICON_CLASS} />
            <span className={labelClass}>Devices</span>
          </NavLink>
        </RenderIfAllowed> */}

        {/* IP Monitoring */}
        <RenderIfAllowed module="ip_monitoring" action="read">
          <NavLink
            to="ip_monitoring"
            className={({ isActive }) => navLinkClass(isActive, isExpanded)}
            aria-label="IP Monitoring"
          >
            <Network className={ICON_CLASS} />
            <span className={labelClass}>IP Monitoring</span>
          </NavLink>
        </RenderIfAllowed>

        {/* BMC Monitoring */}
        <RenderIfAllowed module="monitoring" action="read">
          <NavLink
            to="bmc_monitoring"
            className={({ isActive }) => navLinkClass(isActive, isExpanded)}
            aria-label="BMC Monitoring"
          >
            <Server className={ICON_CLASS} />
            <span className={labelClass}>BMC Monitoring</span>
          </NavLink>
        </RenderIfAllowed>

        {/* Alerts */}
        <RenderIfAllowed module="monitoring" action="read">
          <NavLink
            to="/alerts"
            className={({ isActive }) => navLinkClass(isActive, isExpanded)}
            aria-label="Alerts"
          >
            <TriangleAlert className={ICON_CLASS} />
            <span className={labelClass}>Alerts</span>
          </NavLink>
        </RenderIfAllowed>

        {/* Event Logs */}
        <RenderIfAllowed module="monitoring" action="read">
          <NavLink
            to="/event-logs"
            className={({ isActive }) => navLinkClass(isActive, isExpanded)}
            aria-label="Event Logs"
          >
            <FileText className={ICON_CLASS} />
            <span className={labelClass}>Event Logs</span>
          </NavLink>
        </RenderIfAllowed>

        {/* Settings */}
        <NavLink
          to="/settings"
          className={({ isActive }) => navLinkClass(isActive, isExpanded)}
          aria-label="Settings"
        >
          <Settings className={ICON_CLASS} />
          <span className={labelClass}>Settings</span>
        </NavLink>

      </nav>

      {/* ── Theme Toggle ── */}
      <div
        className="p-2 border-t mt-auto flex-shrink-0"
        style={{ borderColor: isDarkMode ? '#374151' : '#E5E7EB' }}
      >
        <button
          onClick={toggleTheme}
          className={`group w-full flex items-center gap-2 py-3 px-2
            rounded-lg transition-all duration-300 active:scale-[0.98]
            ${isExpanded ? 'justify-start pl-3' : 'justify-center'}
            text-gray-500 dark:text-gray-400
            hover:bg-indigo-100/80 dark:hover:bg-gray-800/80
            hover:text-indigo-600 dark:hover:text-indigo-400`}
          aria-label={`Switch to ${isDarkMode ? 'light' : 'dark'} theme`}
        >
          {isDarkMode ? <Sun className={ICON_CLASS} /> : <Moon className={ICON_CLASS} />}
          <span className={labelClass}>
            {isDarkMode ? 'Light Mode' : 'Dark Mode'}
          </span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;