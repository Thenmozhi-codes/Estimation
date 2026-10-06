import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { EmptyState } from "./EmptyState";
import { SkeletonTable } from "./Skeleton";

export function DataTable({
  columns,
  rows,
  getRowId = (r) => r.id,
  onRowClick,
  loading,
  emptyTitle,
  emptyDescription,
  emptyAction,
  initialSort,
  dense = false,
}) {
  const [sort, setSort] = useState(initialSort || null);

  /* ---------------- PAGINATION ---------------- */
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  /* ---------------- SORTING ---------------- */
  const sorted = useMemo(() => {
    if (!sort) return rows;

    const { key, dir } = sort;
    const mult = dir === "desc" ? -1 : 1;

    return [...rows].sort((a, b) => {
      const av = a[key];
      const bv = b[key];

      if (av == null) return 1;
      if (bv == null) return -1;

      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * mult;
      }

      return String(av).localeCompare(String(bv)) * mult;
    });
  }, [rows, sort]);

  /* ---------------- RESET PAGE WHEN DATA/FILTER CHANGES ---------------- */
  useEffect(() => {
    setPage(1);
  }, [rows]);

  /* ---------------- PAGINATION CALCULATION ---------------- */
  const totalRows = sorted.length;

  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  const currentPage = Math.min(page, totalPages);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;

    return sorted.slice(start, end);
  }, [sorted, currentPage, pageSize]);

  /* ---------------- SORT TOGGLE ---------------- */
  const toggleSort = (key) => {
    setSort((s) => {
      if (!s || s.key !== key) {
        return { key, dir: "asc" };
      }

      if (s.dir === "asc") {
        return { key, dir: "desc" };
      }

      return null;
    });

    // Start from first page after sorting
    setPage(1);
  };

  /* ---------------- PAGE SIZE ---------------- */
  const handlePageSizeChange = (event) => {
    const newSize = Number(event.target.value);

    setPageSize(newSize);
    setPage(1);
  };

  /* ---------------- PAGE NAVIGATION ---------------- */
  const goToPage = (nextPage) => {
    const safePage = Math.max(1, Math.min(nextPage, totalPages));
    setPage(safePage);
  };

  /* ---------------- LOADING ---------------- */
  if (loading) {
    return <SkeletonTable rows={6} />;
  }

  /* ---------------- EMPTY ---------------- */
  if (!rows.length) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  const rowPy = dense ? "py-1.5" : "py-2.5";

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalRows);

  /* ---------------- PAGE NUMBERS ---------------- */
  const getPageNumbers = () => {
    const pages = [];

    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }

      return pages;
    }

    if (currentPage <= 3) {
      pages.push(1, 2, 3, 4, "...", totalPages);
      return pages;
    }

    if (currentPage >= totalPages - 2) {
      pages.push(
        1,
        "...",
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      );

      return pages;
    }

    pages.push(
      1,
      "...",
      currentPage - 1,
      currentPage,
      currentPage + 1,
      "...",
      totalPages,
    );

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50/80 dark:bg-slate-900/40 text-muted text-2xs uppercase tracking-wider">
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={{ width: c.width }}
                  className={cn(
                    "px-4 py-3 font-semibold border-b border-line whitespace-nowrap select-none",
                    c.align === "right" && "text-right",
                    c.align === "center" && "text-center",
                    c.align !== "right" &&
                      c.align !== "center" &&
                      "text-left",
                    c.sortable &&
                      "cursor-pointer hover:text-ink transition-colors",
                  )}
                  onClick={
                    c.sortable ? () => toggleSort(c.key) : undefined
                  }
                >
                  <span className="inline-flex items-center gap-1">
                    {c.header}

                    {c.sortable &&
                      sort?.key === c.key &&
                      (sort.dir === "asc" ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      ))}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {paginatedRows.map((row) => (
              <tr
                key={getRowId(row)}
                onClick={
                  onRowClick ? () => onRowClick(row) : undefined
                }
                className={cn(
                  "border-b border-line/60 last:border-b-0 transition-colors",
                  onRowClick &&
                    "cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/60",
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-4 align-middle",
                      rowPy,
                      c.align === "right" &&
                        "text-right tabular-nums",
                      c.align === "center" && "text-center",
                    )}
                  >
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-line">
        {paginatedRows.map((row) => (
          <div
            key={getRowId(row)}
            onClick={
              onRowClick ? () => onRowClick(row) : undefined
            }
            className={cn(
              "p-3.5 transition-colors",
              onRowClick &&
                "cursor-pointer active:bg-primary-50/60 dark:active:bg-slate-800/60",
            )}
          >
            {columns
              .filter((c) => !c.hideOnMobile)
              .map((c, idx) => (
                <div
                  key={c.key}
                  className={cn(
                    "flex items-start justify-between gap-3 py-0.5",
                    idx === 0 && "mb-1.5",
                  )}
                >
                  {idx === 0 ? (
                    <div className="min-w-0 flex-1 font-semibold text-ink">
                      {c.render ? c.render(row) : row[c.key]}
                    </div>
                  ) : (
                    <>
                      <div className="text-2xs uppercase tracking-wide text-muted pt-0.5 shrink-0">
                        {c.header}
                      </div>

                      <div
                        className={cn(
                          "text-sm text-right min-w-0 flex-1 tabular-nums",
                          c.align === "right" && "font-semibold",
                        )}
                      >
                        {c.render ? c.render(row) : row[c.key]}
                      </div>
                    </>
                  )}
                </div>
              ))}
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalRows > 0 && (
        <div className="flex flex-col gap-3 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Showing */}
          <div className="text-xs text-muted">
            Showing{" "}
            <span className="font-semibold text-ink">
              {startItem}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-ink">
              {endItem}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-ink">
              {totalRows}
            </span>{" "}
            entries
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
            {/* Page size */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted whitespace-nowrap">
                Rows
              </span>

              <select
                value={pageSize}
                onChange={handlePageSizeChange}
                className="h-8 rounded-md border border-line bg-surface px-2 text-xs font-medium text-ink outline-none transition focus:border-primary-500"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={30}>30</option>
                <option value={40}>40</option>
                <option value={50}>50</option>
              </select>
            </div>

            {/* Pagination buttons */}
            <div className="flex items-center gap-1">
              {/* Previous */}
              <button
                type="button"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className={cn(
                  "inline-flex h-8 items-center gap-1 rounded-md border border-line px-2 text-xs font-semibold transition-colors",
                  currentPage === 1
                    ? "cursor-not-allowed opacity-40"
                    : "text-ink hover:bg-bg",
                )}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Previous</span>
              </button>

              {/* Page numbers */}
              <div className="flex items-center gap-1">
                {pageNumbers.map((pageNumber, index) =>
                  pageNumber === "..." ? (
                    <span
                      key={`ellipsis-${index}`}
                      className="flex h-8 w-8 items-center justify-center text-xs text-muted"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() => goToPage(pageNumber)}
                      className={cn(
                        "h-8 min-w-8 rounded-md border px-2 text-xs font-semibold transition-colors",
                        currentPage === pageNumber
                          ? "border-primary-600 bg-primary-600 text-white"
                          : "border-line text-ink hover:bg-bg",
                      )}
                      aria-current={
                        currentPage === pageNumber
                          ? "page"
                          : undefined
                      }
                    >
                      {pageNumber}
                    </button>
                  ),
                )}
              </div>

              {/* Next */}
              <button
                type="button"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={cn(
                  "inline-flex h-8 items-center gap-1 rounded-md border border-line px-2 text-xs font-semibold transition-colors",
                  currentPage === totalPages
                    ? "cursor-not-allowed opacity-40"
                    : "text-ink hover:bg-bg",
                )}
                aria-label="Next page"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}