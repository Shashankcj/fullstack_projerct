import { Outlet, useNavigate, useParams } from "react-router-dom";
import { useState, useCallback, useRef } from "react";
import PriorityTabs from "../../../Utilities/PriorityTabs";
import { VALID_TABS } from "../utils/dashboardTabs";
import ActionButtons from "../../../shared/ActionButtons";
import { RefreshCw } from "lucide-react";
import { toast } from "react-toastify";

const DashboardLayout = ({ isDarkMode }) => {
  const navigate = useNavigate();
  const { priority } = useParams();

  const activeTab = VALID_TABS.includes(priority) ? priority : "p1";

  // This ref will hold the refetch functions registered by Dashboard
  const refetchRef = useRef({ refetchSummary: null, refetchServers: null });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleTabChange = (tabKey) => {
    navigate(`/dashboard/${tabKey}`);
  };

  const handleRefresh = useCallback(async () => {
    const { refetchSummary, refetchServers } = refetchRef.current;
    if (!refetchSummary || !refetchServers) return;
    try {
      setIsRefreshing(true);
      await Promise.all([refetchSummary(), refetchServers()]);
      toast.success("Dashboard refreshed successfully");
    } catch (error) {
      console.error("[Dashboard] Refresh error:", error);
      toast.error("Failed to refresh dashboard");
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  return (
    <div className="w-full">
      <div className="sticky top-[3.5rem] z-30 backdrop-blur-md px-4 pt-3 pb-2">
  <div className="flex items-center justify-between gap-4">

    <div className="flex-1 min-w-0">
      <PriorityTabs
        activeTab={activeTab}
        onTabChange={handleTabChange}
        isDarkMode={isDarkMode}
      />
    </div>

    <div className="flex-shrink-0">
      <ActionButtons
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        isDarkMode={isDarkMode}
        refreshButtonTitle="Refresh Dashboard"
        refreshIcon={RefreshCw}
      />
    </div>

  </div>
</div>

      {/* outlet context */}
      <Outlet context={{ refetchRef }} />
    </div>
  );
};

export default DashboardLayout;