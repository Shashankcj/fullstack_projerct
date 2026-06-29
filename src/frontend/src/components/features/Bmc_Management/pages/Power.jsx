import React from "react";
import StatCard from "../components/StatCard";
import StatusTable from "../components/StatusTable";
import { Power as PowerIcon, Zap, ShieldCheck, Clock, RefreshCw, ZapOff ,Activity} from "lucide-react";

const Power = ({ isDarkMode, powerData = {} }) => {
  
  // --- TABLE CONFIGURATIONS ---
  const psuColumns = [
    { header: "PSU", key: "id", bold: true },
    { header: "Status", key: "status" },
    { header: "Input Power", key: "inputPower" },
    { header: "Capacity", key: "capacity" },
    { header: "Output Amps", key: "outputAmps", align: "right" }
  ];

  const logColumns = [
    { header: "Log Time", key: "time", bold: true },
    { header: "Event", key: "event" },
    { header: "Status", key: "status" }
  ];

  // --- DYNAMIC DATA MOCK ---
  const psuData = powerData.psus || [
    { id: "PSU 1, 10.52.1.50", status: "OK", inputPower: "205 W", capacity: "800 W", outputAmps: "0.93 A" },
    { id: "PSU 2, 10.52.1.51", status: "NO", inputPower: "205 W", capacity: "800 W", outputAmps: "0.93 A" },
  ];

  // const powerLogs = powerData.logs || [
  //   { time: "12/04/2024 11:35", event: "Power-on-detected", status: "OK" },
  //   { time: "12/04/2024 09:42", event: "Power Restored: Power unexpectedly lost", status: "Warning" },
  //   { time: "12/04/2024 05:41", event: "Power Lost: Power unexpectedly lost (PSU 1)", status: "Critical" },
  //    { time: "12/04/2024 11:35", event: "Power-on-detected", status: "OK" },
  //   { time: "12/04/2024 09:42", event: "Power Restored: Power unexpectedly lost", status: "Warning" },
  //   { time: "12/04/2024 05:41", event: "Power Lost: Power unexpectedly lost (PSU 1)", status: "Critical" },
  //    { time: "12/04/2024 11:35", event: "Power-on-detected", status: "OK" },
  //   { time: "12/04/2024 09:42", event: "Power Restored: Power unexpectedly lost", status: "Warning" },
  //   { time: "12/04/2024 05:41", event: "Power Lost: Power unexpectedly lost (PSU 1)", status: "Critical" },
  // ];

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      
      {/* --- TOP ROW: POWER SUMMARY --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <StatCard title="Power State" value="On" icon={PowerIcon} isDarkMode={isDarkMode} />
        <StatCard title="Redundancy" value="Active" icon={ShieldCheck} isDarkMode={isDarkMode} iconColor={psuData.status=="OK"?"text-green-500":"text-red-500"} />
        <StatCard title="Power Usage" value="350" unit="Watts" icon={Zap} isDarkMode={isDarkMode} />
        <StatCard title="Uptime" value="7 days" subtext="3 hrs" icon={Clock} isDarkMode={isDarkMode} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* --- LEFT: POWER SUPPLY TELEMETRY --- */}
        <div className="lg:col-span-2 space-y-6">
          <div className={`p-5 rounded-xl border shadow-sm ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold flex items-center gap-2 text-sm">
                <Zap size={18} className="text-blue-500" /> Power Supplies
              </h3>
              <div className="flex gap-2">
                 <span className="text-[10px] font-bold px-2 py-1 bg-green-500/10 text-green-500 rounded border border-green-500/20">● PSU 1</span>
                 <span className="text-[10px] font-bold px-2 py-1 bg-green-500/10 text-green-500 rounded border border-green-500/20">● PSU 2</span>
              </div>
            </div>

            {/* PSU Table Integration */}
            <StatusTable 
              data={psuData}
              columns={psuColumns}
              isDarkMode={isDarkMode}
            />

            <div className="mt-4 grid grid-cols-2 gap-4 text-[10px] font-bold text-gray-500 uppercase">
              <div className="flex justify-between p-2 bg-gray-500/5 rounded">
                <span>Input Voltage</span>
                <span className="text-blue-500 font-mono">230 V</span>
              </div>
              <div className="flex justify-between p-2 bg-gray-500/5 rounded">
                <span>Output Voltage</span>
                <span className="text-blue-500 font-mono">12 V</span>
              </div>
            </div>
          </div>

          {/* Power Event Logs Table
          <StatusTable 
            title="Power Controls & Logs"
            icon={Clock}
            data={powerLogs}
            columns={logColumns}
            isDarkMode={isDarkMode}
          /> */}
        </div>

        {/* --- RIGHT: CONSUMPTION GAUGE --- */}
        <div className={`p-5 rounded-xl border shadow-sm h-fit ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
          <h3 className="font-bold flex items-center gap-2 text-sm mb-6">
            <Activity size={18} className="text-blue-500" /> Power Usage
          </h3>
          
          <div className="flex flex-col items-center py-4">
            <div className="relative w-40 h-24 overflow-hidden">
               {/* Semicircle Gauge */}
               <div className="absolute top-0 left-0 w-40 h-40 border-[12px] border-gray-200 dark:border-gray-700 rounded-full"></div>
               <div 
                 className="absolute top-0 left-0 w-40 h-40 border-[12px] border-blue-500 rounded-full border-t-transparent border-l-transparent"
                 style={{ transform: 'rotate(45deg)' }}
               ></div>
               <div className="absolute bottom-0 w-full text-center">
                 <span className="text-2xl font-bold">350</span>
                 <span className="text-xs text-gray-500 ml-1 font-bold">Watts</span>
               </div>
            </div>
            <p className="mt-4 text-[10px] text-gray-400 font-bold uppercase tracking-widest">Used Capacity</p>
          </div>

          <div className="mt-6 space-y-3 border-t border-gray-500/10 pt-4">
            <div className="flex justify-between text-[10px] font-bold">
              <span className="text-gray-500">PEAK USAGE</span>
              <span className="text-red-500">390 W</span>
            </div>
            <div className="flex justify-between text-[10px] font-bold">
              <span className="text-gray-500">CAPACITY</span>
              <span>450 W</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Power;