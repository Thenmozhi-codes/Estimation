import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils/cn";

export function ModuleTabs({ tabs = [] }) {
  if (!tabs.length) return null;

  return (
    <div className="bg-surface border-b border-line">
      <div className="page-container px-4 md:px-6">
        <nav className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {tabs.map((tab) => (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive }) =>
                cn(
                  "relative h-11 px-3.5 flex items-center",
                  "text-xs md:text-sm font-medium",
                  "whitespace-nowrap",
                  "transition-colors duration-150",
                  isActive
                    ? "text-primary-600 dark:text-primary-400"
                    : "text-muted hover:text-ink",
                )
              }
            >
              {({ isActive }) => (
                <>
                  {tab.label}

                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-primary-500" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}