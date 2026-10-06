import { cn } from "@/lib/utils/cn";

/*
 * Status filter as underlined tabs with a count on each:
 *   All 12 · Draft 3 · Approved 4 · Converted 5
 * Replaces a status dropdown + summary cards.
 */
export function StatusTabs({ tabs = [], value, onChange }) {
  return (
    <div className="overflow-x-auto border-b border-line px-2 scrollbar-none md:px-4">
      <div className="flex min-w-max gap-1" role="tablist">
        {tabs.map((tab) => {
          const active = tab.value === value;

          return (
            <button
              key={tab.value || "all"}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange?.(tab.value)}
              className={cn(
                "-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm transition-colors",
                active
                  ? "border-primary-500 font-semibold text-primary-700 dark:text-primary-300"
                  : "border-transparent text-muted hover:text-ink",
              )}
            >
              {tab.label}

              <span
                className={cn(
                  "min-w-5 rounded-full px-1.5 py-0.5 text-center text-2xs font-semibold tabular-nums",
                  active
                    ? "bg-primary-50 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300"
                    : "bg-slate-100 text-muted dark:bg-slate-800",
                )}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default StatusTabs;
