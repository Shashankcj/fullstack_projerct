// pages/Jobs.jsx

import { useState, useMemo, useCallback } from "react"
import { toast } from "react-toastify"
import { useSearchParams } from "react-router-dom"

import {
  useGetJobsQuery,
  useLazyGetJobFilterOptionsQuery,
  useLazyExportJobsQuery,
} from "../../../../redux/jobsApi"

import { useTablePagination } from "../../../../Hooks/table/useTablePagination"
import { useDebouncedSearch }  from "../../../../Hooks/table/useDebouncedSearch"
import { useTableFilters }     from "../../../../Hooks/table/useTableFilters"
import { useURLSync }          from "../../../../Hooks/table/useURLSync"
import { useDocumentTitle }    from "../../../../Hooks/useDocumentTitle"
import useJobColumns           from "../../../table/columns/JobsColumns"

import FilterDropdown    from "../../../shared/FilterDropdown"
import JobModal          from "../components/JobModal"
import PageWrapper       from "../../../Utilities/PageWrapper"
import TablePageShell    from "../../../table/TablePageShell"
import DataTableToolbar  from "../../../table/DataTableToolbar"
import DataTable         from "../../../table/DataTable"
import TableStateWrapper from "../../../table/TableStateWrapper"

/* ── constants outside component — never recreated ── */
const FILTER_CONFIG = [
  { key: "user",     label: "User",       optionsKey: "users",     type: "select"    },
  { key: "job_type", label: "Job Type",   optionsKey: "job_types", type: "select"    },
  { key: "result",   label: "Result",     optionsKey: "results",   type: "select"    },
  { key: "date",     label: "Date Range",                          type: "dateRange" },
]

const EMPTY_FILTERS = {
  user: "", job_type: "", result: "", dateFrom: "", dateTo: "",
}

/* ── component ── */
const Jobs = ({ isDarkMode = false }) => {
  useDocumentTitle("Jobs")

  const [searchParams] = useSearchParams()

  /* ── pagination ── */
  const {
    currentPage, itemsPerPage,
    setCurrentPage, handlePageChange,
    handleItemsPerPageChange, resetPage,
  } = useTablePagination({
    initialPage:     Number(searchParams.get("page"))      || 1,
    initialPageSize: Number(searchParams.get("page_size")) || 10,
  })

  /* ── search ── */
  const {
    searchTerm, debouncedTerm,
    setSearchTerm, clearSearch,
  } = useDebouncedSearch({
    initialValue: searchParams.get("search") || "",
    delay:        500,
    onSearch:     resetPage,
  })

  /* ── filters ── */
  const {
    filters, filterOptions,
    updateFilters, resetFilters, loadFilterOptions,
  } = useTableFilters({
    initialFilters: {
      user:     searchParams.get("user")       || "",
      job_type: searchParams.get("job_type")   || "",
      result:   searchParams.get("result")     || "",
      dateFrom: searchParams.get("start_date") || "",
      dateTo:   searchParams.get("end_date")   || "",
    },
    onFilterChange: resetPage,
  })

  const hasActiveFilters = useMemo(() =>
    Object.values(filters).some(Boolean) || Boolean(debouncedTerm),
  [filters, debouncedTerm])

  /* ── url sync ── */
  useURLSync({
    params: {
      page: currentPage, page_size: itemsPerPage,
      search:     debouncedTerm,
      user:       filters.user,
      job_type:   filters.job_type,
      result:     filters.result,
      start_date: filters.dateFrom,
      end_date:   filters.dateTo,
    },
    defaults: { page: 1, page_size: 10 },
  })

  /* ── modal state ── */
  const [isJobModalOpen, setIsJobModalOpen] = useState(false)
  const [selectedJob,    setSelectedJob]    = useState(null)

  /* ── api ── */
  const [triggerGetJobFilterOptions] = useLazyGetJobFilterOptionsQuery()
  const [triggerExportJobs]          = useLazyExportJobsQuery()

  const {
    data: jobsData, isLoading, isFetching, error, refetch,
  } = useGetJobsQuery(
    {
      page:       currentPage,
      page_size:  itemsPerPage,
      search:     debouncedTerm,
      user:       filters.user      || undefined,
      job_type:   filters.job_type  || undefined,
      result:     filters.result    || undefined,
      start_date: filters.dateFrom  || undefined,
      end_date:   filters.dateTo    || undefined,
    },
    { refetchOnMountOrArgChange: true }
  )

  /* ── derived data ── */
  const jobs = useMemo(() => {
    const rawJobs = Array.isArray(jobsData)
      ? jobsData
      : jobsData?.jobs || []
    return rawJobs.map(job => ({
      ...job,
      id:       job.uuid,
      timestamp: job.created_at,
    }))
  }, [jobsData])

  const totalCount = jobsData?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage))

  /* ── handlers ── */
  const handleRowClick = useCallback((job) => {
    setSelectedJob(job)
    setIsJobModalOpen(true)
  }, [])

  const handleModalClose = useCallback(() => {
    setIsJobModalOpen(false)
    setSelectedJob(null)
  }, [])

  const handleDownload = useCallback(async (jobUuid) => {
    try {
      const result = await triggerExportJobs({ job_uuid: jobUuid }).unwrap()
      const url    = window.URL.createObjectURL(new Blob([result]))
      const link   = document.createElement("a")
      link.href    = url
      link.setAttribute("download", `job-${jobUuid.slice(0, 8)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast.success("Job downloaded successfully")
    } catch {
      toast.error("Download failed")
    }
  }, [triggerExportJobs])

  const handleFilterOptionsLoad = useCallback(async () => {
    try {
      const result = await triggerGetJobFilterOptions().unwrap()
      return {
        users:     (result.users     || result.user      || []).filter(i => i && String(i).trim()),
        job_types: (result.job_types || result.job_type  || []).filter(i => i && String(i).trim()),
        results:   (result.results   || result.result    || []).filter(i => i && String(i).trim()),
      }
    } catch {
      return { users: [], job_types: [], results: [] }
    }
  }, [triggerGetJobFilterOptions])

  const handleFiltersChange = useCallback((newFilters) => {
    updateFilters(newFilters)
    setCurrentPage(1)
  }, [updateFilters, setCurrentPage])

  const handleRefresh = useCallback(async () => {
    try {
      resetFilters(EMPTY_FILTERS)
      clearSearch()
      setCurrentPage(1)
      await refetch()
      toast.success("Jobs refreshed successfully")
    } catch {
      toast.error("Failed to refresh jobs")
    }
  }, [refetch, resetFilters, clearSearch, setCurrentPage])

  const handleClearAll = useCallback(() => {
    resetFilters(EMPTY_FILTERS)
    clearSearch()
    setCurrentPage(1)
  }, [resetFilters, clearSearch, setCurrentPage])

  const handlePageChangeSafe = useCallback(
    (page) => handlePageChange(page, totalPages),
    [handlePageChange, totalPages]
  )

  /* ── columns ── */
  const columns = useJobColumns({
    isDarkMode,
    onDownload: handleDownload,
    onRowClick: handleRowClick,   // ← single definition
  })

  /* ── render ── */
  return (
    <PageWrapper isDarkMode={isDarkMode}>
      <div className="space-y-6">
        <TablePageShell isDarkMode={isDarkMode}>
          <div className="p-3 sm:p-4">
            <DataTableToolbar
              title="Jobs"
              count={totalCount}
              countLabel="jobs"
              onRefresh={handleRefresh}
              isRefreshing={isFetching}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              searchPlaceholder="Search jobs..."
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={handleItemsPerPageChange}
              isDarkMode={isDarkMode}
              isLoading={isLoading || isFetching}
              rightSlot={
                <FilterDropdown
                  filters={filters}
                  filterConfig={FILTER_CONFIG}
                  filterOptions={filterOptions}
                  onFilterOptionsLoad={() => loadFilterOptions(handleFilterOptionsLoad)}
                  hasActiveFilters={hasActiveFilters}
                  onFiltersChange={handleFiltersChange}
                  isDarkMode={isDarkMode}
                />
              }
            />
          </div>

          <TableStateWrapper
            isLoading={isLoading}
            isError={!!error}
            errorMessage={error?.data?.message || error?.message || "Failed to load jobs"}
            isEmpty={jobs.length === 0}
            hasActiveFilters={hasActiveFilters}
            emptyTitle="No Jobs Found"
            onRetry={refetch}
            onClearFilters={handleClearAll}
            isDarkMode={isDarkMode}
            loadingText="Loading jobs..."
          >
            <DataTable
              data={jobs}
              columns={columns}
              isDarkMode={isDarkMode}
              isLoading={isLoading}
              getRowId={(row) => row.id ?? row.uuid}
              page={currentPage}
              totalPages={totalPages}
              rowCount={totalCount}
              onPageChange={handlePageChangeSafe}
              itemsPerPage={itemsPerPage}
              onRowClick={handleRowClick}    // ← reuses same handler
              sorting={[]}
              onSortingChange={() => {}}
              globalFilter={searchTerm}
              onGlobalFilterChange={setSearchTerm}
            />
          </TableStateWrapper>
        </TablePageShell>

        <JobModal
          isOpen={isJobModalOpen}
          onClose={handleModalClose}
          job={selectedJob}
          isDarkMode={isDarkMode}
        />
      </div>
    </PageWrapper>
  )
}

export default Jobs