import { useNavigate } from "react-router-dom"
import useTableFilter  from "../Hooks/shared/useTableFilter"
import useServers      from "../Hooks/server/useServers"
import ServersTable    from "../features/servers/components/ServersTable"

const ServersPage = ({
  activeTab       = "all",
  isDarkMode      = true,
  thresholds      = {},
  sorting         = [],
  onSortingChange,
  onDeleteServers,
  onAssignPriority,
  onSetMaintenance,
}) => {
  const navigate = useNavigate() 

  const {
    filterParams,
    search,
    setPage,
    onSearchChange,
    onFilterChange,
    onLimitChange,
  } = useTableFilter({ priority: activeTab })

  const {
    servers,
    totalCount,
    totalPages,
    isLoading,
    refetch,
  } = useServers(filterParams)

  return (
    <ServersTable
      servers={servers}
      thresholds={thresholds}
      page={filterParams.page}
      totalPages={totalPages}
      totalCount={totalCount}
      onPageChange={setPage}
      isDarkMode={isDarkMode}
      isLoading={isLoading}
      activeTab={activeTab}
      searchTerm={search}
      onSearchChange={onSearchChange}
      itemsPerPage={filterParams.limit}
      onItemsPerPageChange={onLimitChange}
      onRefreshAfterAction={refetch}
      sorting={sorting}
      onSortingChange={onSortingChange}
      onDeleteServers={onDeleteServers}
      onAssignPriority={onAssignPriority}
      onSetMaintenance={onSetMaintenance}
      onRowClick={(server) => navigate(`devices/${server.uuid}`)}
    />
  )
}

export default ServersPage