import React from "react";
import StatCard from "../components/StatCard";
import { 
  Activity, Thermometer, Cpu, HardDrive, 
  Zap, ShieldCheck, Globe, Database, Layers 
} from "lucide-react";

const Overview = ({ isDarkMode, systemStats }) => {
  if (!systemStats) return null;

  // Helper for info rows inside the larger cards
  const InfoRow = ({ label, value }) => (
    <div className="flex justify-between py-2 border-b border-gray-200/50 dark:border-gray-700/50 last:border-b-0">
      <span className="text-sm text-gray-500 font-medium">{label}</span>
      <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
        {value}
      </span>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* --- TOP ROW: GLOBAL STATUS --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
        <StatCard 
          title="System Health"
          value={systemStats.health}
          icon={ShieldCheck}
          iconColor={systemStats.health === "Healthy" ? "text-green-500" : "text-red-500"}
          isDarkMode={isDarkMode}
          subtext="Status: OK"
        />
        <StatCard 
          title="Power Status" 
          value={systemStats.power} 
          unit="Watts" 
          icon={Zap} 
          isDarkMode={isDarkMode} 
          subtext="Source: Redundant"
        />
        <StatCard 
          title="CPU Utilization" 
          value={systemStats.usage} 
          unit="%" 
          icon={Cpu} 
          isDarkMode={isDarkMode} 
          subtext="Load: Low"
        />
        <StatCard 
          title="Temperature" 
          value={systemStats.temp} 
          unit="°C" 
          icon={Thermometer} 
          isDarkMode={isDarkMode} 
          subtext={`Ambient: ${systemStats.ambientTemp}°C`}
        />
      </div>

      {/* --- MAIN CONTENT: 2x2 GRID --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* LEFT COLUMN: BIG SYSTEM INFO */}
        <div className={`p-6 rounded-2xl border shadow-sm ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-300/30 dark:border-gray-600/30">
            <h2 className={`text-2xl font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-600'}`}>
              System Information
            </h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <InfoRow label="Server Model" value="ProLiant DL385 Gen11" />
              <InfoRow label="Serial Number" value="CZJ12345678" />
              <InfoRow label="System Uptime" value="3 days 4 hours" />
              <InfoRow label="iLO Firmware" value="2.92" />
            </div>
            <div className="space-y-3">
              <InfoRow label="BMC IP Address" value={systemStats.ip || "192.168.1.100"} />
              <InfoRow label="Hostname" value="bmc-main-server-01" />
              <InfoRow label="BIOS Version" value="P99 v1.45" />
              <InfoRow label="Asset Tag" value="DC-RK-001" />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: 2x2 SUMMARY CARDS */}
        <div className="grid grid-cols-1 gap-4">
          
          {/* TOP ROW: Network + Storage */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Network Card */}
            <div className={`p-6 rounded-xl border shadow-sm ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-300/30 dark:border-gray-600/30">
                <Globe size={18} className="text-gray-500" />
                <h3 className={`font-semibold text-lg ${isDarkMode ? 'text-gray-100' : 'text-gray-600'}`}>Network</h3>
              </div>
              <div className="space-y-3 mb-3">
                <InfoRow label="Primary IP" value="10.52.1.17" />
                <div className={`flex items-center gap-2 p-2.5 ${isDarkMode?"bg-green-500/20":"bg-gray-50/50"} border border-gray-200/50 dark:border-gray-600/50 rounded-lg`}>
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                  <span className={`text-xs font-medium uppercase text-green-500`}>Connected</span>
                </div>
              </div>
              <InfoRow label="Link Speed" value="10 Gbps" />
            </div>

            {/* Storage Card */}
            <div className={`p-6 rounded-xl border shadow-sm ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-300/30 dark:border-gray-600/30">
                <HardDrive size={18} className="text-gray-500" />
                <h3 className={`font-semibold text-lg ${isDarkMode ? 'text-gray-100' : 'text-gray-600'}`}>Storage</h3>
              </div>
              <div className="space-y-3 mb-3">
                <InfoRow label="Total Capacity" value={systemStats.storage || "7.2 TB"} />
                <InfoRow label="Used Space" value={systemStats.storageUsed || "4.4 TB"} />
              </div>
              <div className={`flex items-center gap-2 text-green-600 p-2.5 ${isDarkMode?"bg-green-500/20":"bg-gray-50/50"} border border-gray-200/50 dark:border-gray-600/50 rounded-lg`}>
                <ShieldCheck size={16} />
                <span className="text-sm font-medium ">RAID Optimal</span>
              </div>
            </div> 

          </div>

          {/* BOTTOM ROW: Memory + CPU */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Memory Card */}
            <div className={`p-6 rounded-xl border shadow-sm ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-300/30 dark:border-gray-600/30">
                <Layers size={18} className="text-gray-500" />
                <h3 className={`font-semibold text-lg ${isDarkMode ? 'text-gray-100' : 'text-gray-600'}`}>Memory</h3>
              </div>
              <div className="space-y-3 mb-3">
                <InfoRow label="Total Installed" value="256 GB" />
                <InfoRow label="Utilization" value="42%" />
              </div>
              <div className={`flex items-center gap-2 text-green-600 p-2.5 ${isDarkMode?"bg-green-500/20":"bg-gray-50/50"} border border-gray-200/50 dark:border-gray-600/50 rounded-lg`}>
                <ShieldCheck size={16} />
                <span className="text-sm font-medium">All DIMMs OK</span>
              </div>
            </div>

            {/* CPU Card */}
            <div className={`p-6 rounded-xl border shadow-sm ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-300/30 dark:border-gray-600/30">
                <Cpu size={18} className="text-gray-500" />
                <h3 className={`font-semibold text-lg ${isDarkMode ? 'text-gray-100' : 'text-gray-600'}`}>CPU</h3>
              </div>
              <div className="space-y-3 mb-3">
                <InfoRow label="Sockets" value={systemStats.cpuSockets || "2"} />
                <InfoRow label="Total Cores" value="64" />
              </div>
               <div className={`flex items-center gap-2 text-green-600 p-2.5 ${isDarkMode?"bg-green-500/20":"bg-gray-50/50"} border border-gray-200/50 dark:border-gray-600/50 rounded-lg`}>
                <ShieldCheck size={16} />
                <span className="text-sm font-medium">All Online</span>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};

export default Overview;
