import React, { memo, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

const Pagination = ({
  page = 1,
  totalPages = 1,
  rowCount = 0,
  itemsPerPage = 10,
  isDarkMode = true,
  onPageChange,
}) => {
  // ====================================================
  // PAGINATION RANGE
  // ====================================================

  const pages = useMemo(() => {
    const result = [];

    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= page - 1 && i <= page + 1)
      ) {
        result.push(i);
      } else if (result[result.length - 1] !== "...") {
        result.push("...");
      }
    }

    return result;
  }, [page, totalPages]);

  // ====================================================
  // ENTRY INFO
  // ====================================================

  const startIdx =
    rowCount === 0 ? 0 : (page - 1) * itemsPerPage + 1;

  const endIdx = Math.min(page * itemsPerPage, rowCount);

  // ====================================================
  // THEME CLASSES
  // ====================================================

  const containerClasses = isDarkMode
    ? "border-slate-800 bg-[#111827] text-slate-200"
    : "border-slate-200 bg-white text-slate-700";

  const hoverClasses = isDarkMode
    ? "hover:bg-white/10"
    : "hover:bg-slate-100";

  return (
    <div
      className={`
        flex flex-col md:flex-row
        items-center justify-between
        gap-4
        px-4 py-4
        border border-t-0
        rounded-b-xl
        ${containerClasses}
      `}
    >
      {/* ENTRY COUNT */}

      <div className="text-xs font-medium text-slate-400">
        {rowCount === 0
          ? "No entries"
          : `Showing ${startIdx} to ${endIdx} of ${rowCount} entries`}
      </div>

      {/* PAGINATION CONTROLS */}

      <div className="flex items-center gap-1">
        {/* FIRST PAGE */}

        <button
          aria-label="First Page"
          disabled={page === 1}
          onClick={() => onPageChange?.(1)}
          className={`
            w-8 h-8 rounded-md
            flex items-center justify-center
            transition-all
            disabled:opacity-30
            disabled:cursor-not-allowed
            ${hoverClasses}
          `}
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        {/* PREVIOUS PAGE */}

        <button
          aria-label="Previous Page"
          disabled={page === 1}
          onClick={() => onPageChange?.(page - 1)}
          className={`
            w-8 h-8 rounded-md
            flex items-center justify-center
            transition-all
            disabled:opacity-30
            disabled:cursor-not-allowed
            ${hoverClasses}
          `}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* PAGE NUMBERS */}

        {pages.map((p, index) =>
          p === "..." ? (
            <span
              key={index}
              className="px-2 text-slate-500 text-xs"
            >
              ...
            </span>
          ) : (
            <button
              key={index}
              onClick={() => onPageChange?.(p)}
              className={`
                min-w-[32px] h-8
                rounded-md
                text-xs font-bold
                transition-all
                ${
                  page === p
                    ? "bg-indigo-500 text-white shadow"
                    : isDarkMode
                    ? "text-slate-300 hover:bg-white/10"
                    : "text-slate-700 hover:bg-slate-100"
                }
              `}
            >
              {p}
            </button>
          )
        )}

        {/* NEXT PAGE */}

        <button
          aria-label="Next Page"
          disabled={page === totalPages}
          onClick={() => onPageChange?.(page + 1)}
          className={`
            w-8 h-8 rounded-md
            flex items-center justify-center
            transition-all
            disabled:opacity-30
            disabled:cursor-not-allowed
            ${hoverClasses}
          `}
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* LAST PAGE */}

        <button
          aria-label="Last Page"
          disabled={page === totalPages}
          onClick={() => onPageChange?.(totalPages)}
          className={`
            w-8 h-8 rounded-md
            flex items-center justify-center
            transition-all
            disabled:opacity-30
            disabled:cursor-not-allowed
            ${hoverClasses}
          `}
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default memo(Pagination);