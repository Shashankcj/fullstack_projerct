import Windows from "../../../../assets/Windows_logo.svg";
import Ubuntu from "../../../../assets/Ubuntu_logo.svg";
import Redhat from "../../../../assets/Redhat_logo.svg";
import { getUptimeDuration } from "../../../../components/Utilities/getUptimeDuration";
import { formatDateTime } from "../../../../components/Utilities/formatDateTime";
import { formatDurationString } from "../../../../components/Utilities/formatDurationString";

const osLogos = { Windows, Ubuntu, Redhat };

export const SystemInfoCard = ({ isDarkMode, data }) => {

  /* ── Uptime ── */
  const getUptimeDisplay = () => {
    const isActive = data?.status === "Active";
    let uptimeText = "N/A";

    if (isActive && data?.uptime_started_at) {
      uptimeText = getUptimeDuration(data.uptime_started_at);
    } else if (!isActive && data?.last_uptime_duration) {
      uptimeText = formatDurationString(data.last_uptime_duration);
    }

    return (
      <div className="flex items-center gap-2">
        {isActive ? (
          <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17l5-5 5 5M7 7l5-5 5 5" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 7l-5 5-5-5M17 17l-5 5-5-5" />
          </svg>
        )}
        <span className={`text-xs sm:text-sm ${isActive ? "text-green-500" : "text-red-500"}`}>
          {uptimeText}
        </span>
      </div>
    );
  };

  /* ── IP ── */
  const getCachedIP = () => {
    const nics = data?.device?.nic || [];

    for (const nic of nics) {
      for (const port of nic.port || []) {
        const ip = (port.ip || []).find(
          (item) =>
            typeof item.gateway === "string" &&
            /^\d{1,3}(\.\d{1,3}){3}$/.test(item.gateway)
        );
        if (ip?.address) return ip.address;
      }
    }

    for (const nic of nics) {
      for (const port of nic.port || []) {
        const ip = (port.ip || [])[0];
        if (ip?.address) return ip.address;
      }
    }

    return "N/A";
  };

  /* ── OS Logo ── */
  const getOSLogo = () => {
    if (!data?.os) return null;
    const os = data.os.toLowerCase();
    if (os.includes("windows")) return osLogos.Windows;
    if (os.includes("redhat") || os.includes("rhel") || os.includes("red hat")) return osLogos.Redhat;
    if (os.includes("linux") || os.includes("ubuntu")) return osLogos.Ubuntu;
    return null;
  };

  const logo = getOSLogo();
  const cachedIP = getCachedIP();

  /* ── Table rows ── */
  const infoRows = [
    { label: "Description",      value: data?.device?.model },
    { label: "Hardware",         value: data?.device?.cpu?.[0]?.model },
    { label: "Type",             value: data?.device?.dev_phy_vm },
    { label: "Operating System", value: `${data?.os ?? ""} ${data?.os_version ?? ""}`.trim() },
    { label: "Cached IP",        value: cachedIP },
    { label: "MAC Address",      value: data?.device?.nic?.[0]?.mac_address },
    { label: "Server Uptime",    value: getUptimeDisplay() },
    ...(data?.status?.toLowerCase() === "inactive"
      ? [{ label: "Agent Last Seen", value: formatDateTime(data?.last_seen) }]
      : []),
  ];

  /* ── UI ── */
  return (
    <div className={`flex flex-col h-full ${isDarkMode ? "bg-gray-800" : "bg-white"} rounded-xl shadow p-4 sm:p-5 w-full xl:w-80`}>

      {/* Header */}
      <div className="flex items-center mb-5 flex-shrink-0">
        <div className="w-10 h-10 mr-3 flex items-center justify-center flex-shrink-0">
          {logo && <img src={logo} alt="os" className="w-full h-full object-contain" />}
        </div>

        <div className="min-w-0 flex-1">
          <h3
            title={data?.hostname}
            className={`text-base font-semibold truncate ${isDarkMode ? "text-white" : "text-gray-900"}`}
          >
            {data?.hostname || cachedIP || "Unknown Device"}
          </h3>
          <p className={`text-sm truncate ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
            {`${data?.os ?? ""} ${data?.os_version ?? ""}`}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 flex flex-col gap-2">
        {infoRows.map((item, index) => (
          <div
            key={index}
            className="flex justify-between items-start gap-3 py-2 border-b border-gray-700/20 last:border-none"
          >
            <span className={`text-xs sm:text-sm font-medium whitespace-nowrap flex-shrink-0 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
              {item.label}
            </span>
            <div className={`text-xs sm:text-sm text-right break-words max-w-[58%] ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}>
              {item.value || "N/A"}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};