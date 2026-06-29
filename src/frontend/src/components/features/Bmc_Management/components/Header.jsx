// components/Bmc_Management/Components/BmcDashboardHeader.jsx

import React from "react";
import PropTypes from "prop-types";
import ActionButtons from "../../../shared/ActionButtons";
import { RefreshCw } from "lucide-react";
import PageHeader from "../../../Utilities/PageHeader";
import { BMC_TABS } from "../utils/bmcTabs";

/* ── COMPONENT ── */

const Header = ({
  isDarkMode,
  bmcName,
  bmcIp,
  bmcVersion,
  status,
  activeTab,
  onTabChange,
  onRefresh,
  isRefreshing = false,
  lastUpdated = "Just now",
}) => {

  /* ── LEFT SLOT: BMC identity info ── */
  const leftSlot = (
    <div className="flex items-center gap-3 flex-wrap min-w-0">

      <h1 className={`text-xl font-bold ${isDarkMode ? "text-gray-100" : "text-gray-600"}`}>
        {bmcName}
      </h1>

      {/* Firmware version badge */}
      <span className="text-xs font-medium text-green-600 bg-green-500/10 rounded-md border border-green-500/50 px-2 py-0.5">
        {bmcVersion}
      </span>

      {/* Divider */}
      <span className="h-5 border-l border-gray-400" />

      {/* Status badge — green if Active, red otherwise */}
      <span className={`text-xs font-medium rounded-lg border px-2 py-0.5 ${
        status === "Active"
          ? "text-green-600 bg-green-500/10 border-green-500/50"
          : "text-red-600 bg-red-500/10 border-red-500/50"
      }`}>
        {status}
      </span>

      {/* IP Address */}
      <span className="text-sm font-medium text-gray-500">
        IP:{" "}
        <span className={isDarkMode ? "text-gray-100" : "text-gray-500"}>
          {bmcIp}
        </span>
      </span>

    </div>
  );

  /* ── RIGHT SLOT: Last updated + refresh button ── */
  const rightSlot = (
    <div className="flex items-center gap-6 text-sm text-gray-500">
      <span>
        Last Updated:{" "}
        <span className="font-semibold">{lastUpdated}</span>
      </span>
      <ActionButtons
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
        refreshButtonTitle="Refresh Dashboard"
        refreshIcon={RefreshCw}
        isDarkMode={isDarkMode}
      />
    </div>
  );

  /* ── UI ── */
  return (
    <PageHeader
      isDarkMode={isDarkMode}
      leftSlot={leftSlot}
      rightSlot={rightSlot}
      tabs={BMC_TABS}
      activeTab={activeTab}
      onTabChange={(tab) => onTabChange(tab.label)}
    />
  );
};

Header.propTypes = {
  isDarkMode:   PropTypes.bool.isRequired,
  bmcName:      PropTypes.string.isRequired,
  bmcIp:        PropTypes.string.isRequired,
  bmcVersion:   PropTypes.string.isRequired,
  status:       PropTypes.oneOf(["Active", "Inactive"]).isRequired,
  activeTab:    PropTypes.string.isRequired,
  onTabChange:  PropTypes.func.isRequired,
  onRefresh:    PropTypes.func.isRequired,
  isRefreshing: PropTypes.bool,
  lastUpdated:  PropTypes.string,
};

export default Header;