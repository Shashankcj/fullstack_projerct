// Dashboard.jsx

import { useCallback, useMemo, useEffect } from "react"
import { useNavigate, useParams, useOutletContext } from "react-router-dom"
import { Bot, Cpu, MemoryStick, HardDrive, Network, Activity } from "lucide-react"

import { useGetSummaryQuery } from "../../../../redux/dashboardStatsApi"
import {
  useDeleteDeviceMutation,
  useAssignPriorityMutation,
  useSetMaintenanceModeMutation,
} from "../../../../redux/devicesApiSlice"

import useServers     from "../../../../Hooks/server/useServers"
import useTableFilter from "../../../../Hooks/shared/useTableFilter"

import DonutCard    from "../components/DonutCard"
import ServersTable from "../components/ServerTable"
import WaveLoader   from "../../../shared/loading"
import { useSearchParams } from "react-router-dom"

import { VALID_TABS, PRIORITY_MAP } from "../utils/dashboardTabs"

/* ── pure helpers stay here, they are dashboard-specific ── */
const toStatusDonutData = (obj = {}, onClickMap = {}) => [
  { label: "Healthy",     value: obj?.healthy     ?? 0, color: "#22c55e", onClick: onClickMap.healthy     },
  { label: "Warning",     value: obj?.warning     ?? 0, color: "#eab308", onClick: onClickMap.warning     },
  { label: "Critical",    value: obj?.critical    ?? 0, color: "#ef4444", onClick: onClickMap.critical    },
  { label: "Maintenance", value: obj?.maintenance ?? 0, color: "#3b82f6", onClick: onClickMap.maintenance },
  { label: "No Data",     value: obj?.no_data     ?? 0, color: "#64748b", onClick: onClickMap.no_data     },
]

const toIpMonitoringData = (obj = {}, onClickMap = {}) => [
  { label: "Up",   value: obj?.up   ?? 0, color: "#22c55e", onClick: onClickMap.up   },
  { label: "Down", value: obj?.down ?? 0, color: "#ef4444", onClick: onClickMap.down },
]

/* ── component ── */
const Dashboard = ({ isDarkMode = true }) => {
  const navigate          = useNavigate()
  const { priority }      = useParams()
  const { refetchRef }    = useOutletContext() ?? {}

  const activeTab         = VALID_TABS.includes(priority) ? priority : "p1"
  const currentPriority   = PRIORITY_MAP[activeTab]

  const [searchParams] = useSearchParams();
  const health = searchParams.get("health")||"";
  const status = searchParams.get("status")||"";

  /* ── server filter + data (moved out of dashboard state) ── */
  const {
    filterParams,
    search,
    setPage,
    onSearchChange,
    onLimitChange,
    resetFilters,
  } = useTableFilter({ priority: activeTab })

 const {
  servers,
  totalCount,
  totalPages,
  isLoading: serversLoading,
  isFetching: serversFetching,
  refetch: refetchServers,
} = useServers({
  ...filterParams,
  health,
  status,
})

  // reset search + page when tab changes
  useEffect(() => {
    resetFilters({ priority: activeTab })
  }, [activeTab])

  /* ── summary ── */
  const {
    data: summaryData,
    isLoading: summaryLoading,
    isError,
    refetch: refetchSummary,
  } = useGetSummaryQuery(activeTab, {
    pollingInterval:        10000,
    skipPollingIfUnfocused: true,
  })

  /* ── register refetch into layout ref ── */
  useEffect(() => {
    if (refetchRef) {
      refetchRef.current.refetchSummary = refetchSummary
      refetchRef.current.refetchServers = refetchServers
    }
  }, [refetchRef, refetchSummary, refetchServers])

  /* ── mutations ── */
  const [deleteDevice]        = useDeleteDeviceMutation()
  const [assignPriority]      = useAssignPriorityMutation()
  const [setMaintenanceMode]  = useSetMaintenanceModeMutation()

  /* ── navigation handlers ── */
const handleNavigate = useCallback((health) => {
  const params = new URLSearchParams({
    page: 1,
    page_size: filterParams.limit,
    health,
  })

  navigate(`?${params.toString()}`)
}, [navigate, filterParams.limit, activeTab])

  const handleIpNavigate = useCallback((status) => {
    const params = new URLSearchParams({ page: 1, page_size: filterParams.limit, status, priority: activeTab })
    navigate(`/ip_monitoring?${params.toString()}`)
  }, [navigate, activeTab, filterParams.limit])

const handleStatNavigate = useCallback((status) => {
  const params = new URLSearchParams({
    page: 1,
    page_size: filterParams.limit,
    status,
  })

  navigate(`?${params.toString()}`)
}, [navigate, activeTab, filterParams.limit])

  /* ── bulk action handlers ── */
  const handleDeleteServers = useCallback(async (ids) => {
    return await deleteDevice({ uuid: ids }).unwrap()
  }, [deleteDevice])

  const handleAssignPriority = useCallback(async (ids, priorityValue) => {
    const payload = ids.length === 1
      ? { agent_uuid: ids[0], priority: priorityValue }
      : ids.map(id => ({ agent_uuid: id, priority: priorityValue }))
    return await assignPriority(payload).unwrap()
  }, [assignPriority])

  const handleSetMaintenance = useCallback(async (ids, mode, start, end, endTime) => {
    const build = (id) => ({
      agent_uuid: id,
      maintenance_mode: mode === "immediate",
      ...(mode === "immediate" && endTime && { maintenance_end: endTime }),
      ...(mode === "scheduled" && { maintenance_start: start, maintenance_end: end }),
    })
    const payload = ids.length === 1 ? build(ids[0]) : ids.map(build)
    return await setMaintenanceMode(payload).unwrap()
  }, [setMaintenanceMode])

  /* ── extract summary data ── */
  const summary         = summaryData  ?? {}
  const thresholds      = summary?.thresholds ?? {}
  const totalServers    = summary?.total_servers ?? 0
  const activeCount     = summary?.devices?.active ?? 0
  const inactiveCount   = summary?.devices?.inactive ?? 0

  /* ── donut click maps ── */
  const deviceClickMap = useMemo(() => ({
    healthy:     () => handleNavigate("healthy",     currentPriority),
    warning:     () => handleNavigate("warning",     currentPriority),
    critical:    () => handleNavigate("critical",    currentPriority),
    maintenance: () => handleNavigate("maintenance", currentPriority),
    no_data:     () => handleStatNavigate("status",  "inactive"),
  }), [handleNavigate, currentPriority, handleStatNavigate])

  const ipClickMap = useMemo(() => ({
    up:   () => handleIpNavigate("up"),
    down: () => handleIpNavigate("down"),
  }), [handleIpNavigate])

  /* ── donut cards ── */
  const topDonuts = useMemo(() => [
    { title: "Server Health", data: toStatusDonutData(summary?.health,        deviceClickMap), logo: Activity,    showLegend: false, centerValue: totalServers, centerLabel: "Servers" },
    { title: "CPU",           data: toStatusDonutData(summary?.cpu_donut,     deviceClickMap), logo: Cpu,         showLegend: false, centerValue: totalServers, centerLabel: "CPUs"    },
    { title: "Memory",        data: toStatusDonutData(summary?.memory_donut,  deviceClickMap), logo: MemoryStick, showLegend: false, centerValue: totalServers, centerLabel: "Memory"  },
    { title: "Storage",       data: toStatusDonutData(summary?.disk_donut,    deviceClickMap), logo: HardDrive,   showLegend: false, centerValue: totalServers, centerLabel: "Storage" },
    { title: "Network",       data: toStatusDonutData(summary?.network_donut, deviceClickMap), logo: Network,     showLegend: false, centerValue: totalServers, centerLabel: "Network" },
    {
      title: "Agent Status",
      data: [
        { label: "Active",   value: activeCount,   color: "#22c55e", onClick: () => handleStatNavigate("active")   },
        { label: "Inactive", value: inactiveCount, color: "#ef4444", onClick: () => handleStatNavigate("inactive") },
      ],
      logo: Bot, showLegend: false, centerValue: totalServers, centerLabel: "Agents",
    },
    {
      title: "IP Monitoring",
      data: toIpMonitoringData(summary?.ip_monitoring, ipClickMap),
      logo: Network, showLegend: false,
      centerValue: summary?.ip_monitoring?.total ?? 0,
      centerLabel: "IPs",
    },
  ], [summary, activeCount, inactiveCount, totalServers, deviceClickMap, ipClickMap, handleStatNavigate])

  /* ── loading / error ── */
  if (summaryLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4">
        <WaveLoader width={50} height={60} strokeWidth={5} duration="1.8s" color1="#06b6d4" color2="#6366f1" trackColor="rgba(255,255,255,0.06)" />
        <p className="text-sm text-slate-400 font-medium tracking-wide">
          Loading {activeTab.toUpperCase()} Dashboard...
        </p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400 text-sm">
        Failed to load dashboard data.
      </div>
    )
  }

  /* ── render ── */
  return (
    <div className="max-w-[1600px] mx-auto p-4 space-y-4">

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
        {topDonuts.map((d) => (
          <DonutCard key={d.title} {...d} isDarkMode={isDarkMode} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 items-start">
        <ServersTable
          servers={servers}
          thresholds={thresholds}
          page={filterParams.page}
          totalPages={totalPages}
          totalCount={totalCount}
          onPageChange={setPage}
          isDarkMode={isDarkMode}
          isLoading={serversLoading}
          isFetching={serversFetching}
          onDeleteServers={handleDeleteServers}
          onAssignPriority={handleAssignPriority}
          onSetMaintenance={handleSetMaintenance}
          onRefreshAfterAction={refetchServers}
          activeTab={activeTab}
          searchTerm={search}
          onSearchChange={onSearchChange}
          itemsPerPage={filterParams.limit}
          onItemsPerPageChange={onLimitChange}
          onRowClick={(server) => navigate(`/dashboard/${activeTab}/devices/${server.uuid}`)}
        />
      </div>

    </div>
  )
}

export default Dashboard