import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Boxes,
  Receipt,
  BarChart3,
  Settings as SettingsIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useAuthStore } from "@/lib/store/authStore";
import { getNavTarget } from "@/lib/domain/roles";
import { useRolesVersion } from "@/lib/store/rolesStore";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, paths: ["/dashboard"] },
  {
    to: "/master",
    label: "Master",
    icon: Boxes,
    paths: ["/master/attributes", "/master/brands", "/master/customers"],
  },
  { to: "/bills", label: "Bills", icon: Receipt, paths: ["/bills/quotations"] },
  { to: "/reports", label: "Reports", icon: BarChart3, paths: ["/reports/sales"] },
  { to: "/settings", label: "Settings", icon: SettingsIcon, paths: ["/settings/company"] },
];

/**
 * Mobile-only bottom tab bar. Replaces the desktop sidebar as the
 * primary navigation surface on small screens, per the "no large
 * desktop sidebar on mobile" requirement. Pages that render below it
 * should reserve space with a bottom padding utility (most already
 * use `pb-24` / `pb-28` on their scroll container).
 */
export function MobileBottomNav() {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  useRolesVersion(); /* refresh when an admin edits a role */

  /* only the tabs this role may open */
  const visibleNav = NAV.map((item) => ({
    ...item,
    target: getNavTarget(user?.role, item.paths),
  })).filter((item) => item.target);

  const baseActive = (to) =>
    location.pathname === to || location.pathname.startsWith(`${to}/`);

  return (
    <nav
      className={cn(
        "md:hidden fixed inset-x-0 bottom-0 z-40",
        "bg-surface/95 backdrop-blur border-t border-line",
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${visibleNav.length}, minmax(0, 1fr))` }}
      >
        {visibleNav.map(({ to, target, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={target}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-1 py-2.5 min-w-0",
                "transition-colors",
                (isActive || baseActive(to))
                  ? "text-primary-500"
                  : "text-muted active:text-ink",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className="h-5 w-5 shrink-0"
                  strokeWidth={(isActive || baseActive(to)) ? 2.25 : 1.75}
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