import { Search } from "lucide-react";

export function Toolbar({ search, onSearch, placeholder = "Search…", children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 md:px-6 py-3 border-b border-line bg-surface">
      <div className="relative flex-1 sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none" strokeWidth={2} />
        <input
          value={search}
          onChange={(e) => onSearch?.(e.target.value)}
          placeholder={placeholder}
          className="w-full h-9 pl-9 pr-3 text-sm rounded-lg bg-bg border border-line text-ink placeholder:text-subtle transition-all hover:border-muted/40 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15"
        />
      </div>
      {children && <div className="flex items-center gap-2 sm:ml-auto">{children}</div>}
    </div>
  );
}