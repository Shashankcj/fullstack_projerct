import React from "react";
import StatCard from "../components/StatCard";
import StatusTable from "../components/StatusTable"; 
import { Database, HardDrive, LayoutGrid, ShieldCheck, Activity } from "lucide-react";

const Storage = ({ isDarkMode, storageData = {} }) => {
  
  // --- TABLE CONFIGURATIONS ---
  
  const logicalColumns = [
    { header: "ID", key: "id", bold: true },
    { header: "Capacity", key: "capacity" },
    { header: "Type", key: "type" },
    { header: "Status", key: "status" },
    { header: "Physical Drives", key: "physicalDrives", align: "right" }
  ];

  const physicalColumns = [
    { header: "Slot", key: "slot", bold: true },
    { header: "Health", key: "status" }, // StatusPill will handle this
    { header: "Type", key: "type" },
    { header: "Size", key: "size" },
    { header: "Speed", key: "speed" },
    { header: "RAID Group", key: "raid", align: "right" }
  ];

  // --- DYNAMIC DATA MOCK ---
  const logicalDrives = storageData.logical || [
    { id: "LD001", capacity: "2.4 TB", type: "Virtual Disk", status: "OK", physicalDrives: "PD01, PD04..." },
    { id: "LD002", capacity: "1.2 TB", type: "Virtual Disk", status: "OK", physicalDrives: "PD01, PD02..." },
  ];

  const physicalDrives = storageData.physical || [
    { slot: "PD01", status: "OK", type: "SAS HDD", size: "1.8 TB", speed: "10k RPM", raid: "RAID 5" },
    { slot: "PD02", status: "OK", type: "SAS HDD", size: "1.8 TB", speed: "10k RPM", raid: "RAID 5" },
    { slot: "PD03", status: "Warning", type: "SSD", size: "600 GB", speed: "6 Gb/s", raid: "RAID 1" },
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      
      {/* --- TOP ROW: STORAGE SUMMARY --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <StatCard title="Disk Pools" value="2" icon={Database} isDarkMode={isDarkMode} />
        <StatCard title="Logical Drives" value="4" icon={LayoutGrid} isDarkMode={isDarkMode} />
        <StatCard title="Total Storage" value="7.2" unit="TB" icon={HardDrive} subtext="4.4 TB Used" isDarkMode={isDarkMode} />
        <StatCard title="Storage Health" value="92%" icon={ShieldCheck} isDarkMode={isDarkMode} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* --- LEFT: RAID POOL VISUALIZATION --- */}
        <div className={`lg:col-span-1 p-5 rounded-xl border shadow-sm ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold flex items-center gap-2 text-sm">
              <Activity size={18} className="text-blue-500" /> Storage Pools
            </h3>
          </div>

          <div className="flex flex-col items-center justify-center py-6 border-b border-gray-500/10 mb-4">
            <div className="relative w-32 h-32 flex items-center justify-center">
              {/* Circular Progress Representation */}
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-200 dark:text-gray-700" />
                <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray="364" strokeDashoffset="145" className="text-blue-500" />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-xl font-bold">3.6 TB</span>
                <span className="text-[10px] text-gray-500 uppercase font-bold">Free: 2.1 TB</span>
              </div>
            </div>
            <h4 className="mt-4 font-bold text-sm">RAID 5 Disk Pool 1</h4>
            <span className="text-[10px] text-green-500 font-bold uppercase">Status: Healthy</span>
          </div>

          <div className="space-y-3">
             <div className="flex justify-between text-[11px]">
               <span className="text-gray-500">Utilization</span>
               <span className="font-bold">63%</span>
             </div>
             <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full w-[63%]" />
             </div>
          </div>
        </div>

        {/* --- RIGHT: LOGICAL DRIVES TABLE --- */}
        <div className="lg:col-span-2">
          <StatusTable 
            title="Logical Drives"
            icon={LayoutGrid}
            data={logicalDrives}
            columns={logicalColumns}
            isDarkMode={isDarkMode}
            actionLabel="RAID Configuration"
          />
        </div>
      </div>

      {/* --- BOTTOM ROW: PHYSICAL DRIVES FULL WIDTH --- */}
      <div className="w-full">
        <StatusTable 
          title="Physical Drive Details"
          icon={HardDrive}
          data={physicalDrives}
          columns={physicalColumns}
          isDarkMode={isDarkMode}
          actionLabel="Rescan Drives"
          onActionClick={() => console.log("Scanning...")}
        />
      </div>

    </div>
  );
};

export default Storage;