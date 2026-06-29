import React, { useState } from "react";
import Header from "../components/Header";
import Overview from "./Overview";
import CpuMemory from "./cpu&memory";
import ThermalAndFans from "./ThermalAndFans";
import Storage from "./Storage";
import Power from "./Power";
import Firmware from "./Firmware";
import PageWrapper from "../../../Utilities/PageWrapper";

const BmcDashboard = ({ isDarkMode }) => {
  const [systemStats] = useState({
    health: "Healthy",
    temp: 42,
    ambientTemp: 24,
    usage: 12,
    storage: 7.2,
    storageUsed: 4.4,
    power: 185,
    ip: "192.168.1.100",
    cpuSockets: 2
  });

  const [cpuMemoryStats] = useState({
    cpuCount: 2,
    totalCores: 64,
    totalMemoryGB: 256,
    cpuSockets: [
      { id: 1, model: "AMD EPYC 9354", cores: 32, threads: 64, utilization: 12 },
      { id: 2, model: "AMD EPYC 9354", cores: 32, threads: 64, utilization: 8 }
    ],
    dimmSlots: [
      { slot: "DIMM_A1", size: "32 GB", type: "DDR5", status: "OK" },
      { slot: "DIMM_A2", size: "Empty", type: "-", status: "Empty" },
      { slot: "DIMM_B1", size: "32 GB", type: "DDR5", status: "OK" },
      { slot: "DIMM_C1", size: "32 GB", type: "DDR5", status: "Warning" }
    ],
    memorySlotsTotal: 16,
    memoryUsedSlots: 8,
    memoryHealth: "OK"
  });

  const [activeTab, setActiveTab] = useState("Overview");

  const dashboardData = {
    name: "Main Server BMC",
    ip: "192.168.1.100",
    version: "v2.4.0"
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "Overview":
        return <Overview isDarkMode={isDarkMode} systemStats={systemStats} />;
      case "CPU & Memory":
        return <CpuMemory isDarkMode={isDarkMode} cpuMemoryStats={cpuMemoryStats} />;
      case "Thermal & Fans":
        return <ThermalAndFans isDarkMode={isDarkMode} />;
      case "Storage":
        return <Storage isDarkMode={isDarkMode} />;
      case "Power":
        return <Power isDarkMode={isDarkMode} />;
      case "Firmware":
        return <Firmware isDarkMode={isDarkMode} />;
      default:
        return <Overview isDarkMode={isDarkMode} systemStats={systemStats} />;
    }
  };

  return (
    <>
    <PageWrapper isDarkMode={isDarkMode}>
      {/* STICKY HEADER - Perfect positioning */}
      <div
        className="sticky top-14 z-30 backdrop-blur-md pt-3"
        style={{ backgroundColor: isDarkMode ? 'rgba(17, 24, 39, 0.92)' : '#F0F4FF' }}
      >
        <Header
          bmcName={dashboardData.name}
          bmcIp={dashboardData.ip}
          bmcVersion={dashboardData.version}
          status={"Inactive"}
          isDarkMode={isDarkMode}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>

      {/* CONTENT - Full width, perfect spacing */}
        <div className="w-full pt-4 space-y-5">
          <div className="animate-in fade-in duration-500">
            {renderTabContent()}
          </div>
        </div>
    </PageWrapper>
    </>
  );
}

export default BmcDashboard;
