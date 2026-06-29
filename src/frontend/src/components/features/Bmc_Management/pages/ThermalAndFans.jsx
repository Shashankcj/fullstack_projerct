import React from "react";
import StatCard from "../components/StatCard";
import StatusTable from "../components/StatusTable";
import { Thermometer, Wind, ShieldCheck, Activity, RefreshCw } from "lucide-react";

const ThermalAndFans = ({ isDarkMode }) => {
  
  // 1. Define Columns for the Sensor Table
  const thermalColumns = [
    { header: "Sensor Name", key: "name", bold: true },
    { header: "Reading", key: "displayTemp", bold: true },
    { header: "Status", key: "status" },
    { header: "Threshold", key: "crit", align: "right" }
  ];

  // 2. Define Data for the Sensor Table
  const thermalData = [
    { name: "01-Inlet Ambient", displayTemp: "27°C", status: "OK", crit: "42°C" },
    { name: "02-CPU 1", displayTemp: "41°C", status: "OK", crit: "105°C" },
    { name: "03-CPU 2", displayTemp: "42°C", status: "OK", crit: "105°C" },
    { name: "04-Chipset", displayTemp: "52°C", status: "Warning", crit: "110°C" },
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      
      {/* --- TOP ROW: SUMMARY STATS --- */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
        <StatCard title="Max Temperature" value="45" unit="°C" icon={Thermometer} isDarkMode={isDarkMode} />
        <StatCard title="Average Temp" value="32" unit="°C" icon={Activity} isDarkMode={isDarkMode} />
        <StatCard title="Total Fans" value="6" icon={Wind} subtext="All Healthy" isDarkMode={isDarkMode} />
        <StatCard title="Fan Redundancy" value="Active" icon={ShieldCheck} isDarkMode={isDarkMode} iconColor={thermalData.status=="OK"?"text-green-500":"text-red-500"}/>
        <StatCard title="Cooling Policy" value="Standard" icon={RefreshCw} isDarkMode={isDarkMode} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* --- LEFT: DYNAMIC TEMPERATURE TABLE --- */}
        <StatusTable 
          title="Temperature Sensors"
          icon={Thermometer}
          data={thermalData}
          columns={thermalColumns}
          isDarkMode={isDarkMode}
          actionLabel="Run Thermal Test"
          onActionClick={() => console.log("Thermal Test Started")}
        />

        {/* --- RIGHT: COOLING FANS --- */}
        <div className={`p-5 rounded-xl border shadow-sm ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold flex items-center gap-2 text-sm">
              <Wind size={18} className="text-blue-500" /> Cooling Fans
            </h3>
            <span className="text-[10px] font-bold text-blue-500 uppercase tracking-tight">
              Overall Utilization: 58%
            </span>
          </div>

          <div className="space-y-4">
            {[1, 2, 3, 4, 5, 6].map((fan) => (
              <div key={fan} className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold uppercase">
                  <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>Fan {fan}</span>
                  <span className="text-blue-500 font-mono">
                    {fan === 3 ? "0 RPM (Stopped)" : `${5000 + (fan * 100)} RPM`}
                  </span>
                </div>
                <div className="relative h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ${
                      fan === 3 ? 'bg-amber-500 w-[8%]' : 'bg-blue-600 w-[45%]'
                    }`} 
                  />
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 flex justify-between items-center p-3 bg-blue-500/5 rounded-lg border border-blue-500/10">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-blue-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Redundancy Status</span>
            </div>
            <span className="text-xs font-bold text-green-500">FULLY REDUNDANT</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ThermalAndFans;