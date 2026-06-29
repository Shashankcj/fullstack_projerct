import React, { useMemo, useState, useCallback } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";

import Pagination from "./Pagination";

const TableSkeleton = ({
  rows = 6,
  cols = 5,
  isDarkMode = true,
}) => {
  return Array.from({ length: rows }).map((_, rowIndex) => (
    <tr
      key={rowIndex}
      className={`border-b ${
        isDarkMode ? "border-slate-800" : "border-slate-200"
      }`}
    >
      {Array.from({ length: cols }).map((__, colIndex) => (
        <td key={colIndex} className="px-4 py-4">
          <div
            className={`h-4 rounded animate-pulse ${
              isDarkMode ? "bg-slate-700" : "bg-slate-200"
            }`}
          />
        </td>
      ))}
    </tr>
  ));
};

const DataTable = ({
  data = [],
  columns = [],
  isDarkMode = true,
  isLoading = false,
  isError = false,
  errorMessage = "Something went wrong",
  emptyMessage = "No data found",

  page = 1,
  totalPages = 1,
  rowCount = 0,
  itemsPerPage = 10,

  globalFilter = "",

  onGlobalFilterChange,
  onPageChange,

  getRowId,
  onRowClick,
  rowClassName,
  rowStyle,

  enableRowSelection = false,
  enableMultiSort = false,
  maxMultiSortColCount = 3,
  stickyHeader = true,
}) => {
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState({});

  // ====================================================
  // CLIENT-SIDE SORTING STATE
  // ====================================================

  const [sorting, setSorting] = useState([]);

  // ====================================================
  // PAGINATION STATE
  // ====================================================

  const paginationState = useMemo(
    () => ({
      pageIndex: Math.max(0, page - 1),
      pageSize: itemsPerPage,
    }),
    [page, itemsPerPage]
  );

  // ====================================================
  // TABLE INSTANCE
  // ====================================================

  const table = useReactTable({
    data,
    columns,
    getRowId,

    state: {
      pagination: paginationState,
      sorting,
      globalFilter,
      rowSelection,
      columnVisibility,
    },

    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),

    manualPagination: true,
    manualSorting: false,

    // Multi-sort config — controlled via props
    enableMultiSort,
    maxMultiSortColCount,
    isMultiSortEvent: enableMultiSort ? () => true : undefined,

    rowCount,

    enableRowSelection,

    onSortingChange: setSorting,
    onGlobalFilterChange,

    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,

    onPaginationChange: (updater) => {
      const nextPagination =
        typeof updater === "function"
          ? updater(paginationState)
          : updater;

      const nextPage = nextPagination.pageIndex + 1;

      if (nextPage !== page) {
        onPageChange?.(nextPage);
      }
    },
  });

  // ====================================================
  // THEME CLASSES
  // ====================================================

  const containerClasses = isDarkMode
    ? "border-slate-800 bg-[#111827] text-slate-200"
    : "border-slate-200 bg-white text-slate-700";

  const headerClasses = isDarkMode
    ? "bg-[#0f172a] text-slate-300 border-slate-800"
    : "bg-slate-50 text-slate-700 border-slate-200";

  const rowClasses = isDarkMode
    ? "border-slate-800 text-slate-300 hover:bg-slate-800/60"
    : "border-slate-200 text-slate-700 hover:bg-slate-50";

  // ====================================================
  // SORT ICONS
  // ====================================================

  const renderSortIcon = useCallback((sorted, sortIndex) => {
    const icon =
      sorted === "asc"  ? <ArrowUp   className="w-4 h-4" /> :
      sorted === "desc" ? <ArrowDown className="w-4 h-4" /> :
                          <ArrowUpDown className="w-4 h-4 opacity-40" />;

    // Show sort priority badge when multi-sorting
    if (enableMultiSort && sorted && sortIndex !== undefined && sortIndex >= 0) {
      return (
        <span className="flex items-center gap-0.5">
          {icon}
          <span className={`text-[10px] font-bold leading-none ${
            isDarkMode ? "text-slate-400" : "text-slate-500"
          }`}>
            {sortIndex + 1}
          </span>
        </span>
      );
    }

    return icon;
  }, [enableMultiSort, isDarkMode]);

  return (
    <div className="w-full flex flex-col">
      {/* ====================================================
          TABLE CONTAINER
      ==================================================== */}

      <div
        className={`w-full overflow-auto border rounded-t-xl shadow-sm ${containerClasses}`}
      >
        <table className="w-full table-auto border-collapse text-sm">
          {/* ====================================================
              TABLE HEADER
          ==================================================== */}

          <thead
            className={`${headerClasses} ${
              stickyHeader ? "sticky top-0 z-20" : ""
            }`}
          >
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className={`border-b ${headerClasses}`}
              >
                {headerGroup.headers.map((header) => {
                  const canSort   = header.column.getCanSort();
                  const sorted    = header.column.getIsSorted();
                  const sortIndex = header.column.getSortIndex();

                  return (
                    <th
                      key={header.id}
                      scope="col"
                      style={{
                        width:
                          header.getSize() !== 150
                            ? header.getSize()
                            : undefined,
                      }}
                      className="
                        px-4
                        py-4
                        text-center
                        text-xs
                        font-bold
                        uppercase
                        tracking-wider
                        whitespace-nowrap
                      "
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        // SORTABLE HEADER
                        <button
                          type="button"
                          aria-label={`Sort ${header.id}`}
                          onClick={header.column.getToggleSortingHandler()}
                          className="
                            w-full
                            flex
                            items-center
                            justify-center
                            gap-2
                            cursor-pointer
                            select-none
                          "
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}

                          {renderSortIcon(sorted, sortIndex)}
                        </button>
                      ) : (
                        // NON SORTABLE HEADER
                        <div
                          className="
                            w-full
                            flex
                            items-center
                            justify-center
                            gap-2
                          "
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          {/* ====================================================
              TABLE BODY
          ==================================================== */}

          <tbody>
            {isLoading ? (
              <TableSkeleton
                rows={6}
                cols={columns.length}
                isDarkMode={isDarkMode}
              />
            ) : isError ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-14 text-center"
                >
                  <p className="text-red-500 font-semibold text-sm">
                    {errorMessage}
                  </p>
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-14 text-center"
                >
                  <p className="text-sm font-medium text-slate-400">
                    {emptyMessage}
                  </p>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, index) => {
                const zebraBg =
                  index % 2 === 0
                    ? isDarkMode
                      ? "bg-[#1e293b]"
                      : "bg-white"
                    : isDarkMode
                    ? "bg-[#111827]"
                    : "bg-slate-50/50";

                const dynamicRowClass = rowClassName
                  ? rowClassName(row.original)
                  : "";

                const dynamicRowStyle = rowStyle
                  ? rowStyle(row.original, row, index)
                  : undefined;

                return (
                  <tr
                    key={row.id}
                    tabIndex={0}
                    onClick={() => onRowClick?.(row.original)}
                    style={dynamicRowStyle}
                    className={`
                      border-b
                      transition-colors
                      duration-150
                      ${rowClasses}
                      ${zebraBg}
                      ${dynamicRowClass}
                      ${onRowClick ? "cursor-pointer" : ""}
                    `}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const meta =
                        cell.column.columnDef.meta || {};

                      return (
                        <td
                          key={cell.id}
                          onClick={meta.stopPropagation ? (e) => e.stopPropagation() : undefined}
                          className={`
                            px-4
                            py-3
                            align-middle
                            font-medium
                            ${
                              meta.nowrap !== false
                                ? "whitespace-nowrap text-center"
                                : "whitespace-normal break-words text-left"
                            }
                          `}
                        >
                          <div
                            className={`
                              flex items-center
                              ${
                                meta.nowrap !== false
                                  ? "justify-center"
                                  : "justify-start"
                              }
                            `}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ====================================================
          PAGINATION
      ==================================================== */}

      {!isLoading && (
        <Pagination
          page={page}
          totalPages={totalPages}
          rowCount={rowCount}
          itemsPerPage={itemsPerPage}
          isDarkMode={isDarkMode}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
};

export default DataTable;