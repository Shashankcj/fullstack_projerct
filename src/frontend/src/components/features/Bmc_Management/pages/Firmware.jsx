import React from "react";
import StatCard from "../components/StatCard";
import StatusTable from "../components/StatusTable";
import { Cpu, Box, RefreshCcw, HardDrive } from "lucide-react";

const Firmware = ({ isDarkMode, rawRedfishData = [] }) => {
  
  // --- TABLE CONFIGURATION ---
  const firmwareColumns = [
    { header: "Component Name", key: "name", bold: true },
    { header: "Type", key: "description" },
    { header: "Version", key: "version" },
    { header: "Status", key: "status" },
    { header: "Location", key: "location", align: "right" }
  ];

  // --- DATA PARSING LOGIC ---
  // We map your Redfish JSON structure to our Table keys
  const firmwareInventory = rawRedfishData.map(item => ({
    name: item.Name,
    description: item.Description,
    version: item.Version,
    // If Updateable is true, we flag it as a "Warning" to prompt an update check
    status: item.Updateable ? "Update Available" : "OK",
    location: item.Oem?.Hpe?.DeviceContext || "Internal"
  }));

  // Fallback for demo if no data is passed
  const displayData = firmwareInventory.length > 0 ? firmwareInventory : [
    { 
      name: "8 SFF 12G x1SAS UBM2 BC BP", 
      description: "Universal Backplane Manager", 
      version: "1.20", 
      status: "OK", 
      location: "Slot=12:Port=2I" 
    }
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      
      {/* --- TOP ROW SUMMARY --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <StatCard title="Total Components" value={displayData.length} icon={Box} isDarkMode={isDarkMode} />
        <StatCard title="Updateable" value={displayData.filter(d => d.status !== "OK").length} icon={RefreshCcw} isDarkMode={isDarkMode} />
        <StatCard title="Device Class" value="HPE UBM" icon={HardDrive} isDarkMode={isDarkMode} />
      </div>

      {/* --- FIRMWARE TABLE --- */}
      <div className="w-full">
        <StatusTable 
          title="Hardware Firmware Inventory"
          icon={Cpu}
          data={displayData}
          columns={firmwareColumns}
          isDarkMode={isDarkMode}
        />
      </div>

      {/* OEM DETAILS FOOTER */}
      <div className={`p-4 rounded-lg border text-[10px] font-mono ${isDarkMode ? 'bg-gray-900/50 border-gray-700 text-gray-400' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
        <p>REDFISH CONTEXT: {rawRedfishData[0]?.["@odata.context"] || "N/A"}</p>
        <p>ETAG: {rawRedfishData[0]?.["@odata.etag"] || "N/A"}</p>
      </div>

    </div>
  );
};

export default Firmware;