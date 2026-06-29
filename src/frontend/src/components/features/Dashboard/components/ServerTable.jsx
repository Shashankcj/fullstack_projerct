import { Wrench, AlertTriangle, TrashIcon } from "lucide-react";
import { useMemo, useState } from "react";

import MenuDropdown from "../../../shared/MenuDropdown";
import RenderIfAllowed from "../../../shared/RenderIfAllowed";
import BulkActionModal from "../../../shared/BulkActionModal";

import { sortServersByHealth } from "../../../table/columns/serverColumns";
import DataTable from "../../../table/DataTable";
import DataTableToolbar from "../../../table/DataTableToolbar";
import TablePageShell from "../../../table/TablePageShell";
import TableStateWrapper from "../../../table/TableStateWrapper";

import useSelectionState from "../../../../Hooks/shared/useSelectionState";
import useColumnConfig from "../../../../Hooks/server/useColumnConfig";
import useBulkModalConfig from "../../../../Hooks/server/useBulkModalConfig";

// ── outside component — never recreated on re-render ──────────────────
const getRowStyle = (server) => {
  const key = String(
    server?.health_status ?? server?.healthStatus ?? "no_data"
  )
    .toLowerCase()
    .trim();

  if (key === "red") {
    return {
      backgroundColor: "rgba(239, 68, 68, 0.15)",
      borderLeft: "4px solid rgba(239, 68, 68, 0.5)",
    };
  }

  if (key === "amber") {
    return {
      backgroundColor: "rgba(234, 179, 8, 0.15)",
      borderLeft: "4px solid rgba(234, 179, 8, 0.5)",
    };
  }

  return {};
};

const ServersTable = ({
  servers = [],
  thresholds = {},
  page = 1,
  totalPages = 1,
  totalCount = 0,
  onPageChange,
  isDarkMode = true,
  isLoading = false,
  onDeleteServers,
  onAssignPriority,
  onSetMaintenance,
  onRefreshAfterAction,
  onRowClick,            // ← moved from inside, now comes from page
  activeTab = "",
  searchTerm = "",
  onSearchChange,
  itemsPerPage = 10,
  onItemsPerPageChange,
  sorting: backendSorting = [],
  onSortingChange,
}) => {

  
  const sortedServers = useMemo(() => sortServersByHealth(servers), [servers]);

  const {
    selectedItems: selectedServers,
    setSelectedItems: setSelectedServers,
    toggleSelectAll,
    toggleSelectOne,
  } = useSelectionState({
    items: sortedServers,
    itemKey: "uuid",
    resetOn: [activeTab, searchTerm],
  });

  const { visibleCols, toggleCol, filteredColumns, toggleableCols } =
    useColumnConfig({
      isDarkMode,
      thresholds,
      selectedServers,
      toggleSelectOne,
      toggleSelectAll,
      sortedServers,
    });

  const [showBulkModal, setShowBulkModal] = useState(false);
  const [currentAction, setCurrentAction] = useState("");

  const bulkModalConfig = useBulkModalConfig({
    currentAction,
    selectedServers,
    isDarkMode,
    onDeleteServers,
    onAssignPriority,
    onSetMaintenance,
    activeTab,
  });

  const actionMenuItems = useMemo(
    () => [
      {
        id: "maintenance",
        label: "Set Maintenance",
        icon: Wrench,
        variant: "primary",
        disabled: selectedServers.size === 0,
        onClick: () => {
          setCurrentAction("maintenance");
          setShowBulkModal(true);
        },
      },
      {
        id: "priority",
        label: "Assign Priority",
        icon: AlertTriangle,
        variant: "primary",
        disabled: selectedServers.size === 0,
        onClick: () => {
          setCurrentAction("priority");
          setShowBulkModal(true);
        },
      },
      {
        id: "delete",
        label: "Delete Selected",
        icon: TrashIcon,
        variant: "danger",
        disabled: selectedServers.size === 0,
        onClick: () => {
          setCurrentAction("delete");
          setShowBulkModal(true);
        },
      },
    ],
    [selectedServers.size]
  );

  return (
    <TablePageShell isDarkMode={isDarkMode}>
      <div className="p-4">
        <DataTableToolbar
          title="Servers"
          selectedCount={selectedServers.size}
          searchTerm={searchTerm}
          onSearchChange={onSearchChange}
          searchPlaceholder="Search servers..."
          itemsPerPage={itemsPerPage}
          onItemsPerPageChange={onItemsPerPageChange}
          isDarkMode={isDarkMode}
          isLoading={isLoading}
          toggleableCols={toggleableCols}
          visibleCols={visibleCols}
          onToggleCol={toggleCol}
          actionsSlot={
            <RenderIfAllowed module="monitoring" action="delete">
              <MenuDropdown
                menuItems={actionMenuItems}
                isDarkMode={isDarkMode}
                buttonLabel="Action"
              />
            </RenderIfAllowed>
          }
        />

        <TableStateWrapper
          isLoading={isLoading}
          isEmpty={sortedServers.length === 0}
          hasActiveFilters={!!searchTerm.trim()}
          emptyTitle="No Servers Found"
          onClearFilters={() => onSearchChange?.("")}
          isDarkMode={isDarkMode}
          loadingText="Loading servers..."
        >
          <DataTable
            data={sortedServers}
            columns={filteredColumns}
            isDarkMode={isDarkMode}
            isLoading={isLoading}
            rowStyle={getRowStyle}
            itemsPerPage={itemsPerPage}
            onRowClick={onRowClick}      // ← clean, just passes it through
            emptyMessage={
              searchTerm.trim()
                ? `No servers match "${searchTerm}" in ${activeTab.toUpperCase()}`
                : "No servers found"
            }
            getRowId={(row) => row.uuid}
            page={page}
            totalPages={totalPages}
            rowCount={totalCount}
            onPageChange={onPageChange}
            sorting={backendSorting}
            onSortingChange={onSortingChange}
            globalFilter={searchTerm}
            onGlobalFilterChange={onSearchChange}
          />
        </TableStateWrapper>
      </div>

      {showBulkModal && bulkModalConfig && (
        <BulkActionModal
          show={showBulkModal}
          onHide={() => {
            setShowBulkModal(false);
            setCurrentAction("");
          }}
          selectedItems={
            currentAction === "maintenance"
              ? Array.from(selectedServers)
                  .map((id) => sortedServers.find((s) => s.uuid === id))
                  .filter(Boolean)
              : Array.from(selectedServers)
          }
          isDarkMode={isDarkMode}
          config={bulkModalConfig}
          onSuccess={() => {
            setSelectedServers(new Set());
            setShowBulkModal(false);
            setCurrentAction("");
            onRefreshAfterAction?.();
          }}
        />
      )}
    </TablePageShell>
  );
};

export default ServersTable;