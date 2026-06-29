import React, { useState, useRef, useEffect, useCallback } from "react";
import Header       from "./Header";
import Sidebar      from "./Sidebar";
import { useAuth }                          from "../../Contexts/AuthContext";
import { toast }                            from "react-toastify";
import { useNavigate, Outlet }              from "react-router-dom";
import { useDispatch, useSelector }         from "react-redux";
import backendApi                           from "../../api/backendAxiosInstance";
import { useGetDevicesdataQuery, apiSlice } from "../../redux/apiSlice";
import { resetPermissions }                 from "../../redux/userModulePermission";
import { useRefreshSettings }               from "../../Contexts/RefreshContext";
import { useSidebar }                       from "../../Contexts/SidebarContext";
import { selectAlerts }                     from "../../redux/notificationSlice";
import LicenseManager from "../features/LicenseManager/LicenseManager";


const Layout = ({ isDarkMode, toggleTheme, searchQuery, setSearchQuery, onRefresh }) => {
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [audioEnabled, setAudioEnabled]                   = useState(false);

  const { isSidebarOpen, toggleSidebar, closeSidebar } = useSidebar();
  const { user, setUser, setAuthenticated }             = useAuth();

  const navigate = useNavigate();
  const dispatch = useDispatch();

  const isMountedRef          = useRef(true);
  const audioRef              = useRef(null);
  const previousAlertCountRef = useRef(0);

  const alerts     = useSelector(selectAlerts);
  const { refetch } = useGetDevicesdataQuery(undefined, {
    refetchOnMountOrArgChange: false,
  });


  /* ================= AUDIO ================= */

  useEffect(() => {
    const enableAudio = () => {
      if (audioRef.current && !audioEnabled) {
        audioRef.current.play()
          .then(() => {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setAudioEnabled(true);
          })
          .catch(() => {});
      }
    };
    const events = ['click', 'touchstart', 'keydown'];
    events.forEach((e) => document.addEventListener(e, enableAudio, { once: true }));
    return () => events.forEach((e) => document.removeEventListener(e, enableAudio));
  }, [audioEnabled]);

  useEffect(() => {
    if (!audioEnabled || !audioRef.current) return;
    if (alerts.length > previousAlertCountRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
    previousAlertCountRef.current = alerts.length;
  }, [alerts, audioEnabled]);


  /* ================= MOUNT TRACKING ================= */

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);


  /* ================= HANDLERS ================= */

  const handleDataRefresh = useCallback(async () => {
    if (!isMountedRef.current) return;
    try {
      await refetch();
      if (onRefresh) await onRefresh();
    } catch {
      toast.error("Failed to refresh data");
    }
  }, [refetch, onRefresh]);

  const handleLogout = useCallback(async () => {
    // Attempt server-side logout — always continue with local cleanup
    try {
      const res = await backendApi.post("/signout/", {}, { withCredentials: true });
      if (res.status === 200) toast.success(res.data.message || "Logout successful!");
    } catch (error) {
      // Server logout failed — cookie may still be alive
      toast.warn("Session may not be fully cleared. Please close browser if issue persists.");
      console.error("Logout backend error:", error);
    }

    try {
      dispatch(apiSlice.util.resetApiState());
      dispatch(resetPermissions());
      dispatch({ type: "auth/logout" });
      setUser(null);
      setAuthenticated(false);
      localStorage.clear();
      sessionStorage.clear();

      navigate("/signin");
    } catch {
      dispatch(resetPermissions());
      setUser(null);
      setAuthenticated(false);
      localStorage.clear();
      sessionStorage.clear();
      setTimeout(() => (window.location.href = "/signin"), 1000);
    }
  }, [dispatch, setUser, setAuthenticated, navigate]);


  /* ================= UI ================= */

  return (
    <div className={`min-h-screen ${isDarkMode ? "bg-gray-900 text-white" : "bg-[#F0F4FF] text-black"}`}>

      <LicenseManager />
      {/* Header */}
      <Header
        isDarkMode={isDarkMode}
        toggleTheme={toggleTheme}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        setShowNotificationModal={setShowNotificationModal}
        alerts={alerts}
        userEmail={user?.email}
        userName={user?.username}
        onLogout={handleLogout}
        onRefresh={handleDataRefresh}
        toggleSidebar={() => toggleSidebar("header-button")}
      />

      {/* Sidebar */}
      <Sidebar
        isDarkMode={isDarkMode}
        toggleTheme={toggleTheme}
        isSidebarOpen={isSidebarOpen}
        closeSidebar={closeSidebar}
      />

      {/* Mobile backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-[140] bg-black/50 lg:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* Main content */}
      <main className="transition-all duration-300 pt-[3.5rem] lg:ml-20">
        <div className="min-h-[calc(100vh-3.5rem)]">
          <Outlet />
        </div>
      </main>
     

      {/* Notification modal */}
      {showNotificationModal && (
        <Notification
          isDarkMode={isDarkMode}
          alerts={alerts}
          onClose={() => setShowNotificationModal(false)}
        />
      )}

      {/* Notification audio */}
      <audio ref={audioRef} preload="auto">
        <source src="./notification.mp3" type="audio/mpeg" />
        <source src="./notification.wav" type="audio/wav" />
      </audio>

    </div>
  );
};


export default Layout;