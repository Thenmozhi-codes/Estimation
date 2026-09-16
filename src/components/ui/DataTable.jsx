import { useState, useMemo } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
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

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const { key, dir } = sort;
    const mult = dir === "desc" ? -1 : 1;
    return [...rows].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * mult;
      return String(av).localeCompare(String(bv)) * mult;
    });
  }, [rows, sort]);

  const toggleSort = (key) => {
    setSort((s) => {
      if (!s || s.key !== key) return { key, dir: "asc" };
      if (s.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  };

  if (loading) return <SkeletonTable rows={6} />;
  if (!rows.length) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  const rowPy = dense ? "py-2" : "py-2.5";

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bg/60 text-muted text-2xs uppercase tracking-wider">
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={{ width: c.width }}
                  className={cn(
                    "px-4 py-2.5 font-semibold border-b border-line whitespace-nowrap select-none",
                    c.align === "right" && "text-right",
                    c.align === "center" && "text-center",
                    c.align !== "right" && c.align !== "center" && "text-left",
                    c.sortable && "cursor-pointer hover:text-ink transition-colors",
                  )}
                  onClick={c.sortable ? () => toggleSort(c.key) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.header}
                    {c.sortable && sort?.key === c.key &&
                      (sort.dir === "asc"
                        ? <ChevronUp className="h-3 w-3" />
                        : <ChevronDown className="h-3 w-3" />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={getRowId(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "border-b border-line/60 last:border-b-0 transition-colors",
                  onRowClick && "cursor-pointer hover:bg-primary-50/40 dark:hover:bg-slate-800/60",
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-4 align-middle",
                      rowPy,
                      c.align === "right" && "text-right tabular-nums",
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
        {sorted.map((row) => (
          <div
            key={getRowId(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cn(
              "p-3.5 transition-colors",
              onRowClick && "cursor-pointer active:bg-primary-50/60 dark:active:bg-slate-800/60",
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
    </>
  );
}