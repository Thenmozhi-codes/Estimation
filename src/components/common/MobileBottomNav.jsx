import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Boxes,
  Receipt,
  BarChart3,
  Settings as SettingsIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/master", label: "Master", icon: Boxes },
  { to: "/bills", label: "Bills", icon: Receipt },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

/**
 * Mobile-only bottom tab bar. Replaces the desktop sidebar as the
 * primary navigation surface on small screens, per the "no large
 * desktop sidebar on mobile" requirement. Pages that render below it
 * should reserve space with a bottom padding utility (most already
 * use `pb-24` / `pb-28` on their scroll container).
 */
export function MobileBottomNav() {
  return (
    <nav
      className={cn(
        "md:hidden fixed inset-x-0 bottom-0 z-40",
        "bg-surface/95 backdrop-blur border-t border-line",
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <div className="grid grid-cols-5">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-1 py-2.5 min-w-0",
                "transition-colors",
                isActive
                  ? "text-primary-500"
                  : "text-muted active:text-ink",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className="h-5 w-5 shrink-0"
                  strokeWidth={isActive ? 2.25 : 1.75}
                />
                <span className="text-[9.5px] font-bold leading-none truncate max-w-full">
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
