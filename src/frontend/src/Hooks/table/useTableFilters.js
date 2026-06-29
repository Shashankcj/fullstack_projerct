import { useState, useCallback } from "react";

/**
 * Manages filter state + lazy-loaded filter options.
 * Used by: Alert, EventLogs, Jobs, AuditLogs
 */
export const useTableFilters = ({ initialFilters = {}, onFilterChange }) => {
  const [filters, setFilters] = useState(initialFilters);
  const [filterOptions, setFilterOptions] = useState({});
  const [filterOptionsLoaded, setFilterOptionsLoaded] = useState(false);
  const [filterOptionsLoading, setFilterOptionsLoading] = useState(false);

  const updateFilters = useCallback((newFilters) => {
    setFilters(newFilters);
    onFilterChange?.();
  }, [onFilterChange]);

  const resetFilters = useCallback((emptyFilters) => {
    setFilters(emptyFilters);
    onFilterChange?.();
  }, [onFilterChange]);

  const loadFilterOptions = useCallback(async (fetchFn) => {
    if (filterOptionsLoaded || filterOptionsLoading) return filterOptions;
    setFilterOptionsLoading(true);
    try {
      const options = await fetchFn();
      setFilterOptions(options);
      setFilterOptionsLoaded(true);
      return options;
    } finally {
      setFilterOptionsLoading(false);
    }
  }, [filterOptionsLoaded, filterOptionsLoading, filterOptions]);

  const hasActiveFilters = Object.values(filters).some(Boolean);

  return {
    filters,
    filterOptions,
    setFilterOptions,
    hasActiveFilters,
    updateFilters,
    resetFilters,
    loadFilterOptions,
  };
};