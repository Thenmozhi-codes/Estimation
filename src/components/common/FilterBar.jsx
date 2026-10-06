import { Search } from "lucide-react";

/* Search box on the left, filters (selects, chips) on the right */
export function FilterBar({ search, onSearch, placeholder = "Search…", children }) {
  return (
    <div className="flex flex-col gap-2 border-b border-line px-4 py-3 sm:flex-row sm:items-center">
      <div className="relative flex-1 sm:max-w-sm">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
          strokeWidth={2}
        />

        <input
          value={search}
          onChange={(event) => onSearch?.(event.target.value)}
          placeholder={placeholder}
          className="h-9 w-full rounded-lg border border-line bg-bg pl-9 pr-3 text-sm text-ink placeholder:text-subtle transition-all hover:border-muted/40 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15"
        />
      </div>

      {children && (
        <div className="flex items-center gap-2 sm:ml-auto">{children}</div>
      )}
    </div>
  );
}

export default FilterBar;
