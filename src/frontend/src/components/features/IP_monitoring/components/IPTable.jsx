// features/IP_monitoring/components/IPTable.jsx

import { useMemo } from "react"
import { Trash2, Plus, Upload } from "lucide-react"

import PageWrapper       from "../../../Utilities/PageWrapper"
import TablePageShell    from "../../../table/TablePageShell"
import DataTableToolbar  from "../../../table/DataTableToolbar"
import DataTable         from "../../../table/DataTable"
import TableStateWrapper from "../../../table/TableStateWrapper"
import RenderIfAllowed   from "../../../shared/RenderIfAllowed"
import MenuDropdown      from "../../../shared/MenuDropdown"
import ActionButtons     from "../../../shared/ActionButtons"

import { getIPMonitoringColumns } from "../../../table/columns/ipMonitoringColumns"

const IPTable = ({
  isDarkMode,
  tableRows,
  totalCount,
  totalPages,
  currentPage,
  itemsPerPage,
  isLoading,
  isFetching,
  error,
  searchTerm,
  selectedRows,
  setSelectedRows,
  toggleSelectOne,
  clearSelection,
  actionMenuItems,
  handleBulkAssignPriority,
  onPageChange,
  onItemsPerPageChange,
  onSearchChange,
  onRefresh,
  onRowClick,
  onAddIP,
  onEditIP,
  onDeleteIP,
  onClearSearch,
  refetch,
  onBulkUpload,        // ← pass this in from IPMonitoring page instead of calling undefined setShowBulkUploadModal
}) => {

  const addDropdownItems = useMemo(() => [
    { label: "Bulk Import IPs", onClick: onBulkUpload, icon: Upload },
  ], [onBulkUpload])

  const columns = useMemo(() =>
  getIPMonitoringColumns({
    isDarkMode,
    selectedRows,
    isAllSelected: tableRows.length > 0 && selectedRows.size === tableRows.length, 
    onCheckboxChange: (rowUuid) => toggleSelectOne(rowUuid),
    onSelectAll: (e) => {
      if (e.target.checked) setSelectedRows(new Set(tableRows.map(r => r.uuid)))
      else clearSelection()
    },
    onRowClick:       (uuid) => onRowClick({ uuid }),
    onEditIP,
    onDeleteIP,
    onAssignPriority: handleBulkAssignPriority,
    moduleName:       "ip_monitoring",
  }),
  [isDarkMode, selectedRows, tableRows, toggleSelectOne, onRowClick,
   onEditIP, onDeleteIP, handleBulkAssignPriority, setSelectedRows, clearSelection]
)

  const errorMessage = error?.message || error?.error || "Failed to load IP addresses"

  return (
    <PageWrapper isDarkMode={isDarkMode}>
      <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
        <TablePageShell isDarkMode={isDarkMode}>
          <div className="p-3 sm:p-4 border-b" style={{ borderColor: isDarkMode ? "#374151" : "#E5E7EB" }}>
            <DataTableToolbar
              title="IP Monitoring"
              count={totalCount}
              countLabel="IPs"
              selectedCount={selectedRows.size}
              onRefresh={onRefresh}
              isRefreshing={isFetching}
              searchTerm={searchTerm}
              onSearchChange={onSearchChange}
              searchPlaceholder="Search name or IP or status"
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={onItemsPerPageChange}
              isDarkMode={isDarkMode}
              isLoading={isLoading}
              leftSlot={
                <RenderIfAllowed module="ip_monitoring" action="create">
                  <ActionButtons
                    onAdd={onAddIP}
                    addButtonTitle="Add Single IP Address"
                    addIcon={Plus}
                    isDarkMode={isDarkMode}
                    showAddDropdown
                    addDropdownItems={addDropdownItems}
                  />
                </RenderIfAllowed>
              }
              actionsSlot={
                <RenderIfAllowed module="ip_monitoring" action="delete">
                  <MenuDropdown
                    selectedCount={selectedRows.size}
                    menuItems={actionMenuItems}
                    isDarkMode={isDarkMode}
                    buttonLabel="Action"
                    disabled={selectedRows.size === 0}
                  />
                </RenderIfAllowed>
              }
            />
          </div>

          <TableStateWrapper
            isLoading={isLoading}
            isError={!!error}
            errorMessage={errorMessage}
            isEmpty={tableRows.length === 0}
            hasActiveFilters={Boolean(searchTerm)}
            emptyTitle="No IP Addresses Found"
            onRetry={refetch}
            onClearFilters={onClearSearch}
            isDarkMode={isDarkMode}
            loadingText="Loading IP addresses..."
          >
            <DataTable
              data={tableRows}
              columns={columns}
              isDarkMode={isDarkMode}
              isLoading={isLoading}
              page={currentPage}
              totalPages={totalPages}
              rowCount={totalCount}
              itemsPerPage={itemsPerPage}
              onPageChange={onPageChange}
              globalFilter={searchTerm}
              onGlobalFilterChange={onSearchChange}
              getRowId={(row) => row.uuid}
              onRowClick={onRowClick}
            />
          </TableStateWrapper>
        </TablePageShell>
      </div>
    </PageWrapper>
  )
}

export default IPTable