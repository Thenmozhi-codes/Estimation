import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Boxes,
  Receipt,
  BarChart3,
  Settings,
  Search,
  Menu,
  X,
  LogOut,
  ChevronDown,
  Command,
} from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { SIDEBAR } from "./moduleNav";

import { GlobalSearch } from "@/components/GlobalSearch";
import { NotificationBell } from "@/components/common/NotificationBell";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import {
  Dropdown,
  DropdownItem,
  DropdownDivider,
} from "@/components/ui/Dropdown";
import { PageTransition } from "@/components/common/PageTransition";

import { useAuthStore } from "@/lib/store/authStore";

const ICONS = {
  LayoutDashboard,
  Boxes,
  Receipt,
  BarChart3,
  Settings,
};

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handleKeyboard = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }

      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyboard);

    return () => {
      document.removeEventListener("keydown", handleKeyboard);
    };
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const initials = (user?.name || "Admin")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-bg text-ink">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[2px] md:hidden"
        />
      )}

      {/* ================= SIDEBAR ================= */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[248px]",
          "bg-surface border-r border-line",
          "flex flex-col",
          "transition-transform duration-300 ease-premium",
          mobileMenuOpen
            ? "translate-x-0"
            : "-translate-x-full md:translate-x-0",
        )}
      >
        {/* Brand */}
        <div className="h-[76px] px-5 flex items-center border-b border-line">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-sm shrink-0">
              <span className="text-lg">🪵</span>
            </div>

            <div className="min-w-0">
              <div className="text-sm font-bold tracking-tight text-ink truncate">
                Sri Ganesh Timber
              </div>

              <div className="text-[11px] text-muted mt-0.5 truncate">
                Business Manager
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden h-8 w-8 rounded-lg flex items-center justify-center text-muted hover:text-ink hover:bg-bg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 px-3 py-5 overflow-y-auto scrollbar-thin">
          <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-subtle">
            Workspace
          </div>

          <nav className="space-y-1">
            {SIDEBAR.map((item) => {
              const Icon = ICONS[item.icon];

              return (
                <NavLink
                  key={item.key}
                  to={
                    item.key === "dashboard"
                      ? "/dashboard"
                      : item.path
                  }
                  className={({ isActive }) =>
                    cn(
                      "group relative flex items-center gap-3",
                      "h-10 px-3 rounded-xl",
                      "text-sm font-medium",
                      "transition-all duration-150",
                      isActive
                        ? [
                            "bg-primary-50 dark:bg-primary-950/35",
                            "text-primary-700 dark:text-primary-300",
                            "shadow-xs",
                          ]
                        : [
                            "text-muted",
                            "hover:text-ink",
                            "hover:bg-bg",
                          ],
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-primary-500" />
                      )}

                      <Icon
                        className={cn(
                          "h-[17px] w-[17px] shrink-0",
                          isActive
                            ? "text-primary-500"
                            : "text-muted group-hover:text-ink",
                        )}
                        strokeWidth={isActive ? 2.2 : 1.8}
                      />

                      <span>{item.label}</span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Sidebar footer */}
        <div className="p-3 border-t border-line">
          <div className="rounded-xl bg-bg border border-line px-3 py-2.5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider font-semibold text-subtle">
                  Version
                </div>
                <div className="text-xs font-semibold text-ink mt-0.5">
                  Timber ERP · 0.5
                </div>
              </div>

              <kbd className="hidden lg:inline-flex items-center gap-1 text-[10px] text-muted border border-line rounded-md bg-surface px-1.5 py-1">
                <Command className="h-2.5 w-2.5" /> K
              </kbd>
            </div>
          </div>
        </div>
      </aside>

      {/* ================= MAIN ================= */}
      <div className="md:pl-[248px] min-h-screen flex flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 h-[68px] bg-surface/90 backdrop-blur-xl border-b border-line">
          <div className="h-full px-4 md:px-6 flex items-center gap-3">
            {/* Mobile menu */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden h-9 w-9 rounded-lg flex items-center justify-center text-muted hover:text-ink hover:bg-bg"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Search */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="
                group
                flex-1 md:flex-none
                md:w-[360px]
                h-10
                rounded-xl
                border border-line
                bg-bg
                px-3
                flex items-center gap-2.5
                text-left
                transition-all
                hover:border-muted/50
                hover:bg-surface
              "
            >
              <Search className="h-4 w-4 text-muted shrink-0" />

              <span className="text-sm text-muted truncate">
                Search anything...
              </span>

              <kbd className="hidden sm:flex ml-auto items-center gap-0.5 text-[10px] text-muted border border-line bg-surface rounded-md px-1.5 py-1">
                Ctrl K
              </kbd>
            </button>

            {/* Right side */}
            <div className="ml-auto flex items-center gap-1.5">
              <ThemeToggle />
              <NotificationBell />

              <div className="hidden sm:block h-6 w-px bg-line mx-1" />

              <Dropdown
                width="w-64"
                trigger={
                  <button
                    type="button"
                    className="
                      flex items-center gap-2.5
                      h-10
                      rounded-xl
                      px-1.5
                      hover:bg-bg
                      transition-colors
                    "
                  >
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 text-white flex items-center justify-center text-[11px] font-bold shadow-sm">
                      {initials}
                    </div>

                    <div className="hidden lg:block text-left max-w-[120px]">
                      <div className="text-xs font-semibold text-ink truncate">
                        {user?.name || "Administrator"}
                      </div>

                      <div className="text-[10px] text-muted capitalize truncate">
                        {user?.role || "Admin"}
                      </div>
                    </div>

                    <ChevronDown className="hidden lg:block h-3.5 w-3.5 text-muted" />
                  </button>
                }
              >
                <div className="px-4 py-3 border-b border-line">
                  <div className="text-sm font-semibold text-ink truncate">
                    {user?.name || "Administrator"}
                  </div>

                  <div className="text-xs text-muted mt-0.5 truncate">
                    {user?.email || "Administrator account"}
                  </div>
                </div>

                <DropdownItem
                  icon={Settings}
                  onClick={() => navigate("/settings/company")}
                >
                  Settings
                </DropdownItem>

                <DropdownDivider />

                <DropdownItem
                  icon={LogOut}
                  danger
                  onClick={handleLogout}
                >
                  Sign out
                </DropdownItem>
              </Dropdown>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 min-w-0 overflow-x-hidden">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/95 backdrop-blur-xl border-t border-line px-2 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5 h-[64px]">
          {SIDEBAR.map((item) => {
            const Icon = ICONS[item.icon];

            return (
              <NavLink
                key={item.key}
                to={item.key === "dashboard" ? "/dashboard" : item.path}
                className={({ isActive }) =>
                  cn(
                    "relative flex flex-col items-center justify-center gap-1",
                    "text-[10px] font-medium",
                    isActive
                      ? "text-primary-600 dark:text-primary-400"
                      : "text-muted",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className="h-[18px] w-[18px]"
                      strokeWidth={isActive ? 2.2 : 1.7}
                    />

                    <span>{item.label}</span>

                    {isActive && (
                      <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary-500" />
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>

      <GlobalSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
    </div>
  );
}