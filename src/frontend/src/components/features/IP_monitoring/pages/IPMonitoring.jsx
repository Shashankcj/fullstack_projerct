import { useState, useMemo, useCallback } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Trash2} from "lucide-react"

import { useDocumentTitle }    from "../../../../Hooks/useDocumentTitle"
import { useTablePagination }  from "../../../../Hooks/table/useTablePagination"
import { useDebouncedSearch }  from "../../../../Hooks/table/useDebouncedSearch"
import { useURLSync }          from "../../../../Hooks/table/useURLSync"
import useSelectionState       from "../../../../Hooks/shared/useSelectionState"
import useBulkActions          from "../../../../Hooks/ip/useBulkActions"

import {
  useGetIPAddressesQuery,
  useCreateIPAddressMutation,
  useUpdateIPsMutation,
  useDeleteIPsMutation,
  useBulkUploadIPsMutation,
  useAssignPriorityMutation,
} from "../../../../redux/ipMonitoringApi"

import IPTable           from "../components/IPTable"
import IPModal           from "../components/IPModal"
import BulkUploadIPModal from "../components/BulkUploadIPModal"
import BulkActionModal   from "../../../shared/BulkActionModal"

import { normalizePriority, buildPriorityDisplay } from "../utils/ipHelpers"

const IPMonitoring = ({ isDarkMode = true }) => {
  useDocumentTitle("IP Monitoring")

  const navigate       = useNavigate()
  const [searchParams] = useSearchParams()

  const statusFilter   = searchParams.get("status")   || "all"
  const priorityFilter = searchParams.get("priority") || "all"

  /* ── pagination ── */
  const {
    currentPage,
    itemsPerPage,
    setCurrentPage,
    handlePageChange,
    handleItemsPerPageChange,
    resetPage,
  } = useTablePagination({
    initialPage:     Number(searchParams.get("page"))      || 1,
    initialPageSize: Number(searchParams.get("page_size")) || 10,
  })

  /* ── search ── */
  const {
    searchTerm,
    debouncedTerm,
    setSearchTerm,
    clearSearch,
  } = useDebouncedSearch({
    initialValue: searchParams.get("search") || "",
    delay:        500,
    onSearch:     resetPage,
  })

  /* ── url sync ── */
  useURLSync({
    params: {
      page:     currentPage,
      page_size: itemsPerPage,
      search:   debouncedTerm,
      status:   statusFilter   !== "all" ? statusFilter   : "",
      priority: priorityFilter !== "all" ? priorityFilter : "",
    },
    defaults: { page: 1, page_size: 10, search: "", status: "", priority: "" },
  })

  /* ── query params ── */
  const queryParams = useMemo(() => {
    const params = { page: currentPage, page_size: itemsPerPage }
    if (debouncedTerm)          params.search   = debouncedTerm
    if (statusFilter !== "all") params.status   = statusFilter
    if (priorityFilter !== "all") params.priority = priorityFilter
    return params
  }, [currentPage, itemsPerPage, debouncedTerm, statusFilter, priorityFilter])

  /* ── api ── */
  const {
    data: ipData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetIPAddressesQuery(queryParams)

  const { ips, totalCount } = useMemo(() => ({
    ips:        ipData?.data  || [],
    totalCount: ipData?.count || 0,
  }), [ipData])

  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage))

  /* ── table rows ── */
  const tableRows = useMemo(() => {
    if (!Array.isArray(ips)) return []
    return ips
      .filter(ip => ip?.uuid)
      .map((ip, index) => {
        const priorityKey = normalizePriority(ip.priority)
        return {
          ...ip,
          sl:            (currentPage - 1) * itemsPerPage + index + 1,
          isActive:      ip.status === "Up" ? "Up" : "Down",
          rawPriority:   priorityKey,
          priority:      buildPriorityDisplay(priorityKey, isDarkMode),
          priorityValue: priorityKey,
        }
      })
  }, [ips, currentPage, itemsPerPage, isDarkMode])

  /* ── selection ── */
  const {
    selectedItems: selectedRows,
    setSelectedItems: setSelectedRows,
    toggleSelectOne,
    clearSelection,
  } = useSelectionState({
    items:   tableRows,
    itemKey: "uuid",
    resetOn: [debouncedTerm, statusFilter, priorityFilter],
  })

  /* ── mutations ── */
  const [assignPriority] = useAssignPriorityMutation()
  const [createIP]       = useCreateIPAddressMutation()
  const [updateIPs]      = useUpdateIPsMutation()
  const [deleteIPs]      = useDeleteIPsMutation()
  const [bulkUploadIPs]  = useBulkUploadIPsMutation()

  /* ── bulk actions ── */
  const [showBulkModal,            setShowBulkModal]            = useState(false)
  const [showBulkPriorityCSVModal, setShowBulkPriorityCSVModal] = useState(false)
  const [currentAction,            setCurrentAction]            = useState("")

  const {
    actionMenuItems,
    bulkModalConfig,
    handleBulkAssignPriority,
    handleBulkSuccess,
  } = useBulkActions({
    selectedRows, currentAction, setCurrentAction,
    setShowBulkModal, setShowBulkPriorityCSVModal,
    clearSelection, setCurrentPage, deleteIPs, assignPriority, isDarkMode,
  })

  /* ── modal state ── */
  const [showModal,             setShowModal]             = useState(false)
  const [modalMode,             setModalMode]             = useState("add")
  const [ipToEdit,              setIpToEdit]              = useState(null)
  const [showBulkUploadModal,   setShowBulkUploadModal]   = useState(false)
  const [showSingleDeleteModal, setShowSingleDeleteModal] = useState(false)
  const [ipToDelete,            setIpToDelete]            = useState(null)

  /* ── handlers ── */
  const handleManualRefresh = useCallback(async () => {
    clearSearch()
    setCurrentPage(1)
    clearSelection()
    await refetch()
  }, [refetch, clearSearch, clearSelection, setCurrentPage])

  const handleAddIP    = useCallback(() => { setModalMode("add");  setIpToEdit(null); setShowModal(true) }, [])
  const handleEditIP   = useCallback((e, row) => { e.stopPropagation(); setModalMode("edit"); setIpToEdit(row); setShowModal(true) }, [])
  const handleDeleteIP = useCallback((e, ip)  => { e.stopPropagation(); setIpToDelete(ip); setShowSingleDeleteModal(true) }, [])
  const handleRowClick = useCallback((uuid)   => { if (!uuid) return; navigate(`/ip_monitoring/${uuid}`) }, [navigate])

  const handleModalSuccess = useCallback(() => {
    setShowModal(false); setIpToEdit(null); setModalMode("add")
    handleManualRefresh()
  }, [handleManualRefresh])

  const handleSingleDeleteSuccess = useCallback(() => {
    setShowSingleDeleteModal(false); setIpToDelete(null)
    clearSelection(); setCurrentPage(1)
  }, [clearSelection, setCurrentPage])

  const handleBulkUploadSuccess = useCallback(() => {
    setShowBulkUploadModal(false)
    handleManualRefresh()
  }, [handleManualRefresh])

  //bulk modal function
  const handleBulkUpload = useCallback(() => {
  setShowBulkUploadModal(true)
}, [])

  const handleBulkPriorityCSVSuccess = useCallback(() => {
    setShowBulkPriorityCSVModal(false)
    handleManualRefresh(); clearSelection()
  }, [handleManualRefresh, clearSelection])

  /* ── single delete config ── */
  const singleDeleteConfig = useMemo(() => {
  if (!ipToDelete) return null
  return {
    title:   "Delete IP Address",
    message: `Delete "${ipToDelete.name || ipToDelete.ip_address || "this IP"}"? This cannot be undone.`,
    icon: Trash2, 
    iconColor:           isDarkMode ? "#F87171" : "#EF4444",
    itemLabel:           "IP Address",
    itemUnit:            "IP",
    showDropdown:        true,
    requireSelection:    true,
    cancelValue:         "false",
    dropdownLabel:       "Confirm Deletion",
    dropdownPlaceholder: "Select an option",
    options:             [{ value: "true", label: "Yes" }, { value: "false", label: "No" }],
    buttonText:          "Delete IP",
    buttonColor:         "red",
    processingText:      "Deleting...",
    onAction: async (_, val) => {
      if (val !== "true") return
      await deleteIPs({ uuid: [ipToDelete.uuid] }).unwrap()
    },
  }
}, [ipToDelete, isDarkMode, deleteIPs])

  /* ── render ── */
  return (
    <>
      {/* table UI — all JSX moved here */}
      <IPTable
        isDarkMode={isDarkMode}
        tableRows={tableRows}
        totalCount={totalCount}
        totalPages={totalPages}
        currentPage={currentPage}
        itemsPerPage={itemsPerPage}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        searchTerm={searchTerm}
        selectedRows={selectedRows}
        setSelectedRows={setSelectedRows}
        toggleSelectOne={toggleSelectOne}
        clearSelection={clearSelection}
        actionMenuItems={actionMenuItems}
        handleBulkAssignPriority={handleBulkAssignPriority}
        onPageChange={(page) => handlePageChange(page, totalPages)}
        onItemsPerPageChange={handleItemsPerPageChange}
        onSearchChange={setSearchTerm}
        onRefresh={handleManualRefresh}
        onRowClick={(row) => handleRowClick(row.uuid)}
        onAddIP={handleAddIP}
        onEditIP={handleEditIP}
        onBulkUpload={handleBulkUpload}
        onDeleteIP={handleDeleteIP}
        onClearSearch={clearSearch}
        refetch={refetch}
      />

      {/* modals stay in the page — they need access to mutations */}
      {showBulkModal && bulkModalConfig && (
        <BulkActionModal
          show={showBulkModal}
          onHide={() => { setShowBulkModal(false); setCurrentAction("") }}
          selectedItems={Array.from(selectedRows)}
          isDarkMode={isDarkMode}
          config={bulkModalConfig}
          onSuccess={handleBulkSuccess}
        />
      )}

      {ipToDelete && (
        <BulkActionModal
          show={showSingleDeleteModal}
          onHide={() => { setShowSingleDeleteModal(false); setIpToDelete(null) }}
          selectedItems={[ipToDelete.uuid]}
          isDarkMode={isDarkMode}
          config={singleDeleteConfig}
          onSuccess={handleSingleDeleteSuccess}
        />
      )}

      {showModal && (
        <IPModal
          show={showModal}
          onHide={() => { setShowModal(false); setIpToEdit(null); setModalMode("add") }}
          isDarkMode={isDarkMode}
          mode={modalMode}
          ipData={ipToEdit}
          onSuccess={handleModalSuccess}
          createIP={createIP}
          updateIPs={updateIPs}
          assignPriority={assignPriority}
        />
      )}

      {showBulkUploadModal && (
        <BulkUploadIPModal
          show={showBulkUploadModal}
          onHide={() => setShowBulkUploadModal(false)}
          isDarkMode={isDarkMode}
          onSuccess={handleBulkUploadSuccess}
          uploadType="ip"
          bulkUploadIPs={bulkUploadIPs}
        />
      )}

      {showBulkPriorityCSVModal && (
        <BulkUploadIPModal
          show={showBulkPriorityCSVModal}
          onHide={() => setShowBulkPriorityCSVModal(false)}
          isDarkMode={isDarkMode}
          onSuccess={handleBulkPriorityCSVSuccess}
          uploadType="priority"
          assignPriority={assignPriority}
          bulkUploadIPs={bulkUploadIPs}
        />
      )}
    </>
  )
}

export default IPMonitoring