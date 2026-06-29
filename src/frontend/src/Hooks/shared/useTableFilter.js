import { useState, useCallback, useEffect, useRef } from 'react'

const useTableFilter = (initialFilters = {}) => {
  const [page, setPage]                       = useState(1)
  const [limit, setLimit]                     = useState(10)
  const [search, setSearch]                   = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filters, setFilters]                 = useState(initialFilters)
  const timerRef                              = useRef(null)

  // debounce search
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 500)
    return () => clearTimeout(timerRef.current)
  }, [search])

  // reset page when limit changes
  useEffect(() => {
    setPage(1)
  }, [limit])

  const onSearchChange = useCallback((val) => {
    setSearch(val)
  }, [])

  const onFilterChange = useCallback((key, val) => {
    setFilters(prev => ({ ...prev, [key]: val }))
    setPage(1)
  }, [])

  const onLimitChange = useCallback((val) => {
    setLimit(Number(val))
  }, [])

  // when activeTab changes from outside, reset everything
  const resetFilters = useCallback((newFilters = {}) => {
    setPage(1)
    setSearch('')
    setDebouncedSearch('')
    setFilters(newFilters)
  }, [])

  return {
    filterParams: {
      page,
      limit,
      search: debouncedSearch,
      ...filters,
    },
    search,
    setPage,
    onSearchChange,
    onFilterChange,
    onLimitChange,
    resetFilters,
  }
}

export default useTableFilter