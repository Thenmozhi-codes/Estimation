import { Search, SlidersHorizontal } from "lucide-react";

export function Toolbar({
  search = "",
  onSearch,
  placeholder = "Search...",
  children,
}) {
  return (
    <div className="px-4 md:px-6 py-3 border-b border-line bg-surface">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
        <div className="relative flex-1 sm:max-w-[360px]">
          <Search
            className="
              absolute
              left-3
              top-1/2
              -translate-y-1/2
              h-4
              w-4
              text-muted
              pointer-events-none
            "
          />

          <input
            value={search}
            onChange={(event) =>
              onSearch?.(event.target.value)
            }
            placeholder={placeholder}
            className="
              w-full
              h-9
              pl-9
              pr-3
              rounded-xl
              bg-bg
              border border-line
              text-sm
              text-ink
              placeholder:text-subtle
              transition-all
              hover:border-muted/40
              focus:border-primary-500
              focus:ring-2
              focus:ring-primary-500/10
            "
          />
        </div>

        {children && (
          <div className="flex items-center gap-2 sm:ml-auto flex-wrap">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}