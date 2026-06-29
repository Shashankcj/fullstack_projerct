import { useState, useCallback, useEffect, useRef, useMemo } from "react";

const useSelectionState = ({
  items = [],
  itemKey = "id",
  resetOn = [],
}) => {
  const isFirst = useRef(true);

  const [selectedItems, setSelectedItems] = useState(() => new Set());

  const itemIds = useMemo(
    () => items.map((item) => item[itemKey]),
    [items, itemKey]
  );

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }

    setSelectedItems(new Set());
  }, [...resetOn]);

  const toggleSelectOne = useCallback((id) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedItems((prev) => {
      const hasAll =
        itemIds.length > 0 &&
        itemIds.every((id) => prev.has(id));

      return hasAll ? new Set() : new Set(itemIds);
    });
  }, [itemIds]);

  const clearSelection = useCallback(() => {
    setSelectedItems(new Set());
  }, []);

  const isSelected = useCallback(
    (id) => selectedItems.has(id),
    [selectedItems]
  );

  const selectedVisibleCount = itemIds.filter((id) =>
    selectedItems.has(id)
  ).length;

  const isAllSelected =
    itemIds.length > 0 &&
    selectedVisibleCount === itemIds.length;

  const isIndeterminate =
    selectedVisibleCount > 0 &&
    selectedVisibleCount < itemIds.length;

  return {
    selectedItems,
    setSelectedItems,
    toggleSelectOne,
    toggleSelectAll,
    clearSelection,
    isSelected,
    isAllSelected,
    isIndeterminate,
  };
};

export default useSelectionState;