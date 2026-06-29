import React from "react";
import StatCard from "../components/StatCard";
import StatusTable from "../components/StatusTable";
import { Cpu, Layers, MemoryStickIcon, ShieldCheck } from "lucide-react";

const CpuMemory = ({ isDarkMode, cpuData = {}, memoryData = {} }) => {
  
  // Helper for Socket Status Badges
  const StatusBadge = ({ status, statusColor = "green" }) => (
    <div className={`flex items-center gap-1 bg-${statusColor}-500/10 px-2 py-0.5 rounded border border-${statusColor}-500/20`}>
      <div className={`w-1.5 h-1.5 rounded-full bg-${statusColor}-500 animate-pulse`}></div>
      <span className={`text-[10px] font-bold text-${statusColor}-500 uppercase`}>Status: {status}</span>
    </div>
  );

  // --- DYNAMIC DATA SETUP ---
  const cpuSockets = cpuData.sockets || [
    { id: 1, model: "AMD EPYC 9354", cores: 32, threads: 64, utilization: 12, status: "OK", statusColor: "green" },
    { id: 2, model: "AMD EPYC 9354", cores: 32, threads: 64, utilization: 8, status: "OK", statusColor: "green" }
  ];

  // Config for the reusable memory table
  const memoryColumns = [
    { header: "Slot", key: "slot", bold: true },
    { header: "Size", key: "size" },
    { header: "Type", key: "type" },
    { header: "Status", key: "status" }
  ];

  const dimmSlots = memoryData.dimmSlots || [
    { slot: "DIMM_A1", size: "32 GB", type: "DDR5", status: "OK" },
    { slot: "DIMM_A2", size: "Empty", type: "-", status: "Empty" },
    { slot: "DIMM_B1", size: "32 GB", type: "DDR5", status: "OK" },
    { slot: "DIMM_C1", size: "32 GB", type: "DDR5", status: "Warning" },
    { slot: "DIMM_D1", size: "16 GB", type: "DDR5", status: "OK" }
  ];

  // Derived stats for the summary bar
  const totalSlots = memoryData.totalSlots || 16;
  const usedSlots = memoryData.usedSlots || 8;
  const freeSlots = totalSlots - usedSlots;
  const occupancyPercent = Math.round((usedSlots / totalSlots) * 100);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      
      {/* --- TOP ROW: HIGH LEVEL STATS --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <StatCard title="CPU Count" value={cpuData.cpuCount || 2} icon={Cpu} isDarkMode={isDarkMode} />
        <StatCard title="Total Cores" value={cpuData.totalCores || 64} icon={Layers} isDarkMode={isDarkMode} />
        <StatCard title="Total Memory" value={memoryData.totalMemoryGB || 256} unit="GB" icon={MemoryStickIcon} isDarkMode={isDarkMode} />
        <StatCard  title="Memory Health" value={memoryData.health || "OK"} icon={ShieldCheck} isDarkMode={isDarkMode} iconColor={memoryData.health === "critical" ? "text-red-500" : "text-green-500"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* --- LEFT COLUMN: PROCESSORS --- */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h3 className="font-bold flex items-center gap-2">
              <Cpu size={18} className="text-blue-500" /> Processors
            </h3>
          </div>

          {cpuSockets.map((socket) => (
            <div key={socket.id} className={`p-5 rounded-xl border shadow-sm ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
              <div className="flex justify-between items-start mb-4">
                <h4 className="font-bold text-sm">CPU {socket.id} ({socket.model})</h4>
                <StatusBadge status={socket.status} statusColor={socket.statusColor} />
              </div>
              
              <div className="grid grid-cols-2 gap-y-3 text-xs">
                <div>
                  <p className="text-gray-500 font-medium">Model</p>
                  <p className="font-bold">{socket.model}</p>
                </div>
                <div>
                  <p className="text-gray-500 font-medium">Threads</p>
                  <p className="font-bold">{socket.threads}</p>
                </div>
                <div>
                  <p className="text-gray-500 font-medium">Cores</p>
                  <p className="font-bold">{socket.cores}</p>
                </div>
                <div>
                  <p className="text-gray-500 font-medium">Utilization</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 bg-gray-300 dark:bg-gray-600 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-blue-500 h-full" style={{ width: `${socket.utilization}%` }} />
                    </div>
                    <span className="font-bold text-[10px]">{socket.utilization}%</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* --- RIGHT COLUMN: MEMORY OVERVIEW --- */}
        <div className={`rounded-xl border shadow-sm flex flex-col h-full overflow-hidden ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
          
          {/* Slot Occupancy Header */}
          <div className="p-5 border-b border-gray-500/10">
            <h3 className="font-bold flex items-center gap-2 mb-4">
              <Layers size={18} className="text-blue-500" /> Memory Overview
            </h3>
            
            <div className="flex justify-between items-end mb-2">
              <div className="flex gap-4">
                <div className="flex flex-col">
                  <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Total Slots</span>
                  <span className="text-xl font-bold">{totalSlots}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Used</span>
                  <span className="text-xl font-bold text-blue-500">{usedSlots}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Free</span>
                  <span className="text-xl font-bold">{freeSlots}</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Total Capacity</span>
                <p className="text-xl font-bold">{memoryData.totalMemoryGB || 256} GB</p>
              </div>
            </div>

            {/* Visual Bar */}
            <div className="w-full bg-gray-200 dark:bg-gray-700 h-2.5 rounded-full overflow-hidden flex shadow-inner">
              <div className="bg-blue-600 h-full transition-all duration-700" style={{ width: `${occupancyPercent}%` }} />
            </div>
            <div className="flex justify-between mt-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-tighter">
              <span>Slot Occupancy: {occupancyPercent}%</span>
              <span>Hardware Configuration: OK</span>
            </div>
          </div>

          {/* Reusable Slot Detail Table */}
          <div className="flex-1 overflow-hidden">
             <StatusTable 
                title="DIMM Slot Details"
                data={dimmSlots}
                columns={memoryColumns}
                isDarkMode={isDarkMode}
                actionLabel="View Slot Layout"
             />
          </div>
        </div>

      </div>
    </div>
  );
};

export default CpuMemory;