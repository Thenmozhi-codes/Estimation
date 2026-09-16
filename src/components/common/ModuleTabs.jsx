import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils/cn";

export function ModuleTabs({ tabs = [] }) {
  if (!tabs.length) return null;
  return (
    <div className="border-b border-line bg-surface px-3 md:px-6 overflow-x-auto scrollbar-none">
      <nav className="flex gap-1 -mb-px whitespace-nowrap">
        {tabs.map((t) => (
          <NavLink
            key={t.path}
            to={t.path}
            end
            className={({ isActive }) =>
              cn(
                "px-3 py-2.5 text-sm border-b-2 transition-colors duration-150",
                isActive
                  ? "border-brand-500 text-brand-600 dark:text-brand-400 font-semibold"
                  : "border-transparent text-muted hover:text-ink",
              )
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}