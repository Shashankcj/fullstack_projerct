import { Monitor, Settings, X } from "lucide-react";
import { BarChart3, TrendingUp, Activity, SlidersHorizontal } from "lucide-react";
import { useSearchParams, useNavigate, useOutletContext, Navigate, NavLink } from "react-router-dom";
import { DTFilterButton } from "../Utilities/DTFilter";
import { useEffect, useState, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  toggleSetting,
  setDataUnit
} from "../../redux/chartSettings";
import { useClickOutside } from "../../Hooks/useClickOutside";
import PriorityBadge from "../shared/priorityBadge";
import { PRIORITY_CONFIG } from "../Utilities/priority_config";
import StatusBadge from "../shared/StatusBadge";


const normalizePriority = (rawPriority) => {
  if (rawPriority === "") return "---";
  if (rawPriority === "np") return "np";

  if (!rawPriority || typeof rawPriority !== "string") return "---";

  const lower = rawPriority.toLowerCase();

  if (lower.includes("p1")) return "p1";
  if (lower.includes("p2")) return "p2";
  if (lower.includes("p3")) return "p3";
  if (lower.includes("p4")) return "p4";

  return "---";
};


export const convert_DateObj_to_input_strformat = (dateObj, with_out_T = false) => {
  let year = dateObj.getFullYear();
  let month = String(dateObj.getMonth() + 1).padStart(2, '0');
  let date = String(dateObj.getDate()).padStart(2, '0');
  let hours = String(dateObj.getHours()).padStart(2, '0');
  let minutes = String(dateObj.getMinutes()).padStart(2, '0');
  return with_out_T
    ? `${year}-${month}-${date} ${hours}:${minutes}`
    : `${year}-${month}-${date}T${hours}:${minutes}`;
};


export const headerCardClass = (isDarkMode) =>
  `rounded-lg shadow-md p-2 sm:p-3 min-h-[56px] sm:h-14 flex items-center justify-between ${
    isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
  }`;

export const MonHeaderCard = ({ componentUUIDs = {}, isIPMonitoringPage = false, ...props }) => {
  const { isDarkMode } = props;
  const { entityInfo } = useOutletContext();
  console.log("componet uuid",componentUUIDs);
  

  const [searchParams, setSearchParams] = useSearchParams();
  const activeGraph = searchParams.get("graph") || "line";
  const fromDT = searchParams.get("fromDT") || null;
  const toDT = searchParams.get("toDT") || null;

  const [isFilterationApplied, setIsFilterationApplied] = useState(false);

  const rawPriority = entityInfo?.priority;
  const priorityKey = normalizePriority(rawPriority);
  const priorityMeta = PRIORITY_CONFIG[priorityKey];
  const priorityDisplay = priorityMeta || PRIORITY_CONFIG.default;

  const graphTypes = [
    { id: "line", label: "Line", icon: TrendingUp },
    { id: "area", label: "Area", icon: Activity },
  ];

  const graphButtonClass = (isActive, dark) =>
    `flex items-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${
      isActive
        ? "bg-[#6366f1] text-white"
        : dark
          ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
    }`;

  const handleGraphTypeChange = (graphId) => {
    const currentParams = Object.fromEntries([...searchParams]);
    setSearchParams({
      ...currentParams,
      graph: graphId,
    });
  };

  const setActiveComponentIfAny = (component_uuid) => {
    const currentParams = Object.fromEntries([...searchParams]);
    setSearchParams({
      ...currentParams,
      component: component_uuid,
    });
  };

  useEffect(() => {
    if (componentUUIDs && Object.keys(componentUUIDs).length > 0) {
      setActiveComponentIfAny(componentUUIDs[Object.keys(componentUUIDs)[0]]);
    }
  }, [componentUUIDs]);

  useEffect(() => {
    setIsFilterationApplied(!!(fromDT && toDT));
  }, [fromDT, toDT]);

  const handleClearFilterDates = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("fromDT");
    newParams.delete("toDT");
    setSearchParams(newParams);
  };

 const toolbar = (
  <div className="w-full flex items-center justify-end gap-2 mb-4">
      {componentUUIDs && Object.keys(componentUUIDs).length > 0 && (
        <select
          className={`text-xs sm:text-sm rounded-md p-1 sm:p-2 border ${
            isDarkMode
              ? "bg-gray-700 border-gray-600 text-gray-300"
              : "bg-white border-gray-300 text-gray-700"
          }`}
          onChange={(e) => setActiveComponentIfAny(e.target.value)}
        >
          {Object.entries(componentUUIDs).map(([key, value], index) => (
            <option value={value} key={index}>
              {key}
            </option>
          ))}
        </select>
      )}

      {graphTypes.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className={graphButtonClass(activeGraph === id, isDarkMode)}
          onClick={() => handleGraphTypeChange(id)}
        >
          <Icon className="w-4 h-4 mr-1" />
          {label}
        </button>
      ))}

      {isFilterationApplied && (
        <button
          onClick={handleClearFilterDates}
          className={graphButtonClass(false, isDarkMode)}
        >
          Live Data
        </button>
      )}

      <DTFilterButton isDarkMode={isDarkMode} />
    </div>
  );

  if (!isIPMonitoringPage) {
    return toolbar;
  }

  return (
  <div className={headerCardClass(isDarkMode)}>
    <div className="flex items-center gap-3">
      
      {/* Icon */}
      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#6366f1] shrink-0">
        <Monitor className="w-5 h-5 text-white" />
      </div>

      {/* Title + subtitle */}
      <div className="min-w-0 leading-tight">
        
        <h3
          className={`text-base font-semibold flex items-center gap-2 flex-nowrap whitespace-nowrap ${
            isDarkMode ? "text-white" : "text-gray-900"
          }`}
        >
          {/* Entity name */}
          <span className="truncate">
            {entityInfo?.name || "Unknown"}
          </span>

          {/* Badges */}
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge
              status={entityInfo?.status}
              isDarkMode={isDarkMode}
            />

            <PriorityBadge
              priority={priorityDisplay.key}
              isDarkMode={isDarkMode}
            />
          </div>
        </h3>

        <p
          className={`text-xs mt-0.5 truncate ${
            isDarkMode ? "text-gray-300" : "text-gray-600"
          }`}
        >
          {entityInfo?.sub_name}
        </p>

      </div>
    </div>

    {toolbar}
  </div>
);
};


const ChartSettingsElement = (props) => {
  const isDarkMode = props.isDarkMode || false;
  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm ${isDarkMode ? 'text-white' : 'text-gray-700'}`}>
        {props.label}
      </span>
      <input
        type="checkbox"
        checked={props.value}
        onChange={() => props.toggleHandler(props.setting)}
        className={`w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer ${
          isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-300'
        }`}
      />
    </div>
  );
};


const ChartSettingsSection = (props) => {
  const isDarkMode = props.isDarkMode || false;
  return (
    <div className="space-y-4">
      <label className={`text-xs font-bold uppercase tracking-wider block mb-3 ${
        isDarkMode ? 'text-gray-200' : 'text-gray-400'
      }`}>
        {props.sectionTitle}
      </label>
      {props.children}
    </div>
  );
};


export const ChartSettingsCard = (props) => {
  const isDarkMode = props.isDarkMode || false;
  const [isSettingsOpen, setIsSettingsOpen] = props.isOpen;

  const dispatch = useDispatch();
  const chartSettings = useSelector((state) => state.chartSettings[props.chart]);
  const showDataUnitSetting = 'data_unit' in chartSettings ? true : false;
  const settingsPanelRef = useRef();

  const closeSettings = () => {
    setIsSettingsOpen(false);
  };
  useClickOutside(settingsPanelRef, closeSettings);

  const handleToggleSetting = (setting) => {
    dispatch(toggleSetting({ chart: props.chart, setting }));
  };

  return (
    <div>
      {isSettingsOpen && (
        <div
          ref={settingsPanelRef}
          className={`absolute top-2 right-2 bottom-2 w-72 rounded-lg shadow-2xl border z-10 flex flex-col animate-in fade-in slide-in-from-right-4 duration-200 ${
            isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}
        >
          <div className={`flex items-center justify-between px-4 py-3 border-b ${
            isDarkMode ? 'border-gray-700' : 'border-gray-100'
          }`}>
            <span className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
              Chart Settings
            </span>
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="text-gray-400 hover:text-red-500 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar-vertical p-5 space-y-6">
            {showDataUnitSetting && (
              <ChartSettingsSection sectionTitle="Data Unit">
                <select
                  value={chartSettings.data_unit}
                  onChange={(e) => dispatch(setDataUnit({ chart: props.chart, data_unit: e.target.value }))}
                  className={`w-full text-sm border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow ${
                    isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="KB">Kilobytes (KB)</option>
                  <option value="MB">Megabytes (MB)</option>
                  <option value="GB">Gigabytes (GB)</option>
                  <option value="TB">Terabytes (TB)</option>
                </select>
              </ChartSettingsSection>
            )}

            <ChartSettingsSection sectionTitle="X-Axis Settings">
              <ChartSettingsElement
                label="X-Axis Tick Line"
                value={chartSettings.x_axis_tick_line}
                toggleHandler={handleToggleSetting}
                setting="x_axis_tick_line"
                isDarkMode={isDarkMode}
              />
              <ChartSettingsElement
                label="X-Axis Line"
                value={chartSettings.x_axis_line}
                toggleHandler={handleToggleSetting}
                setting="x_axis_line"
                isDarkMode={isDarkMode}
              />
            </ChartSettingsSection>

            <ChartSettingsSection sectionTitle="Y-Axis Settings">
              <ChartSettingsElement
                label="Y-Axis Tick Line"
                value={chartSettings.y_axis_tick_line}
                toggleHandler={handleToggleSetting}
                setting="y_axis_tick_line"
                isDarkMode={isDarkMode}
              />
              <ChartSettingsElement
                label="Y-Axis Line"
                value={chartSettings.y_axis_line}
                toggleHandler={handleToggleSetting}
                setting="y_axis_line"
                isDarkMode={isDarkMode}
              />
            </ChartSettingsSection>

            <ChartSettingsSection sectionTitle="Data Point Settings">
              <ChartSettingsElement
                label="Dot"
                value={chartSettings.dot}
                toggleHandler={handleToggleSetting}
                setting="dot"
                isDarkMode={isDarkMode}
              />
            </ChartSettingsSection>
          </div>

          <div className={`p-3 border-t rounded-b-lg flex justify-end gap-2 ${
            isDarkMode ? 'border-gray-700 bg-gray-750' : 'border-gray-100 bg-gray-50'
          }`}>
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#6366f1] hover:bg-[#6366f1]/90 rounded-md shadow-sm transition-all active:scale-95"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
