import { useState, useEffect, useCallback } from "react";

export const useDebouncedSearch = ({
  initialValue = "",
  delay = 500,
  onSearch,
} = {}) => {
  const [searchTerm, setSearchTerm] = useState(initialValue);
  const [debouncedTerm, setDebouncedTerm] = useState(initialValue);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(searchTerm);
      onSearch?.();
    }, delay);

    return () => clearTimeout(timer);
  }, [searchTerm, delay, onSearch]);

  const clearSearch = useCallback(() => {
    setSearchTerm("");
    setDebouncedTerm("");
  }, []);

  return { searchTerm, debouncedTerm, setSearchTerm, clearSearch };
};