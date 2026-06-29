import { useState, useCallback } from "react";

/**
 * All pagination state in one place.
 * Used by: all 5 pages
 */
export const useTablePagination = ({
  initialPage = 1,
  initialPageSize = 10,
} = {}) => {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [itemsPerPage, setItemsPerPage] = useState(initialPageSize);

  const handlePageChange = useCallback((page, totalPages) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  }, []);

  const handleItemsPerPageChange = useCallback((size) => {
    setItemsPerPage(size);
    setCurrentPage(1);
  }, []);

  const resetPage = useCallback(() => setCurrentPage(1), []);

  return {
    currentPage,
    itemsPerPage,
    setCurrentPage,
    handlePageChange,
    handleItemsPerPageChange,
    resetPage,
  };
};