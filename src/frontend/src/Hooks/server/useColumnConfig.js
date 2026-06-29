import { useState, useMemo, useCallback } from "react";
import { getServerColumns } from "../../components/table/columns/serverColumns";

const COLUMN_DEFS = [
  { key: "checkbox",    label: "",             toggleable: false },
  { key: "name",        label: "Server",       toggleable: false },
  { key: "os",          label: "OS",           toggleable: true  },
  { key: "device_type", label: "Device Type",  toggleable: true  },
  { key: "health",      label: "Health",       toggleable: true  },
  { key: "agent",       label: "Agent Status", toggleable: true  },
  { key: "cpu",         label: "CPU",          toggleable: true  },
  { key: "memory",      label: "Memory",       toggleable: true  },
  { key: "storage",     label: "Storage",      toggleable: true  },
  { key: "network",     label: "Network",      toggleable: true  },
  { key: "ip",          label: "IP",           toggleable: true  },
];

const COL_KEY_MAP = {
  checkbox:    "checkbox",
  name:        "name",
  os:          "os",
  device_type: "device_type",
  health:      "health_status",
  agent:       "status",
  cpu:         "cpu",
  memory:      "memory",
  storage:     "disk",
  network:     "network",
  ip:          "ip",
};

// Inverted once at module level — avoids O(n) reverse lookup inside filter
const COL_ID_TO_DEF_KEY = Object.fromEntries(
  Object.entries(COL_KEY_MAP).map(([k, v]) => [v, k])
);

const useColumnConfig = ({
  isDarkMode,
  thresholds,
  selectedServers,
  toggleSelectOne,
  toggleSelectAll,
  servers, // renamed from sortedServers — column defs shouldn't need sorted data
}) => {
  const [visibleCols, setVisibleCols] = useState(
    Object.fromEntries(COLUMN_DEFS.map((c) => [c.key, true]))
  );

  // Memoized to prevent unnecessary re-renders in toggle UI
  const toggleCol = useCallback(
    (key) => setVisibleCols((prev) => ({ ...prev, [key]: !prev[key] })),
    []
  );

  const filteredColumns = useMemo(() => {
    const allColumns = getServerColumns({
      isDarkMode,
      thresholds,
      selectedServers,
      toggleSelectOne,
      toggleSelectAll,
      servers,
    });

    return allColumns.filter((col) => {
      const colId  = col.accessorKey ?? col.id;
      const defKey = COL_ID_TO_DEF_KEY[colId];
      if (!defKey) return true;
      return visibleCols[defKey] !== false;
    });
  }, [
    isDarkMode,
    thresholds,
    selectedServers,
    toggleSelectOne,  // fixed: was missing
    toggleSelectAll,  // fixed: was missing
    servers,
    visibleCols,
  ]);

  return {
    visibleCols,
    toggleCol,
    filteredColumns,
    toggleableCols: COLUMN_DEFS.filter((c) => c.toggleable),
  };
};

export default useColumnConfig;