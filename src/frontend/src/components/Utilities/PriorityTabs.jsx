import { TABS } from '../features/Dashboard/utils/dashboardTabs';

const PriorityTabs = ({ activeTab, onTabChange, isDarkMode, extraTabs = [] }) => {
  const allTabs = [...TABS, ...extraTabs];

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
      {allTabs.map((tab) => {
  const isActive = activeTab === tab.key;
  const hasCustomActive = isActive && tab.activeClassName;

  return (
    <button
      key={tab.key}
      onClick={() => onTabChange(tab.key)}
      style={hasCustomActive ? { backgroundColor: 'rgba(59,130,246,0.2)', color: 'rgb(96,165,250)' } : {}} // 👈
      className={`px-4 py-2 rounded-lg text-xs font-semibold flex-shrink-0
        transition-all duration-200 cursor-pointer
        ${isActive && !hasCustomActive
          ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
          : !isActive
            ? isDarkMode
              ? 'bg-[#1a2035] text-slate-400 hover:bg-[#252d4a] hover:text-slate-200 hover:-translate-y-0.5'
              : 'bg-white text-slate-500 border border-transparent hover:border-slate-200 hover:bg-slate-50 hover:text-slate-700 hover:-translate-y-0.5'
            : ''
        }`}
    >
      {tab.label}
    </button>
  );
})}
    </div>
  );
};

export default PriorityTabs;