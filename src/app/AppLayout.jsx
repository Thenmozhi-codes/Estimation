import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Boxes, Receipt, BarChart3, Settings as SettingsIcon,
  Search, Menu, X, LogOut, User as UserIcon, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { GlobalSearch } from "@/components/GlobalSearch";
import { NotificationBell } from "@/components/common/NotificationBell";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { Dropdown, DropdownItem, DropdownDivider } from "@/components/ui/Dropdown";
import { PageTransition } from "@/components/common/PageTransition";
import { useAuthStore } from "@/lib/store/authStore";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/master",    label: "Master",    icon: Boxes },
  { to: "/bills",     label: "Bills",     icon: Receipt },
  { to: "/reports",   label: "Reports",   icon: BarChart3 },
  { to: "/settings",  label: "Settings",  icon: SettingsIcon },
];

export function AppLayout() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "\\" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSidebarOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-bg text-ink">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-[2px] z-40 md:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed md:static inset-y-0 left-0 z-50 w-56 flex flex-col bg-surface border-r border-line",
          "transition-transform duration-200 ease-premium",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        {/* Brand */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-line">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shadow-sm shrink-0">
              <span className="text-base">🪵</span>
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-ink truncate leading-tight tracking-tight">
                Sri Ganesh Timber
              </div>
              <div className="text-2xs text-muted leading-tight">
                Business Manager
              </div>
            </div>
          </div>
          <button
            className="md:hidden p-1.5 text-muted hover:text-ink rounded-md"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto scrollbar-thin">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-150",
                  isActive
                    ? "bg-primary-50 text-primary-700 font-semibold dark:bg-primary-950/40 dark:text-primary-300"
                    : "text-ink/70 hover:text-ink hover:bg-slate-100 dark:hover:bg-slate-800",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      isActive ? "text-primary-500" : "text-muted group-hover:text-ink",
                    )}
                    strokeWidth={isActive ? 2 : 1.75}
                  />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-line">
          <div className="flex items-center justify-between text-2xs text-muted">
            <span className="font-medium">v0.4</span>
            <kbd className="border border-line rounded px-1.5 py-0.5 bg-bg">
              ⌘\
            </kbd>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-line bg-surface flex items-center px-3 md:px-5 gap-2">
          <button
            className="md:hidden p-1.5 text-ink rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-4.5 w-4.5" />
          </button>

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex-1 md:flex-none md:w-80 h-9 px-3.5 text-sm rounded-lg bg-bg border border-line text-left text-muted hover:border-muted/40 transition-colors flex items-center gap-2"
          >
            <Search className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            <span className="hidden sm:inline truncate">Search anything…</span>
            <span className="sm:hidden truncate">Search…</span>
            <kbd className="ml-auto hidden md:inline-block text-2xs border border-line rounded px-1.5 py-0.5 bg-surface font-mono">
              ⌘K
            </kbd>
          </button>

          <div className="flex items-center gap-1 ml-auto">
            <ThemeToggle />
            <NotificationBell />

            <Dropdown
              width="w-56"
              trigger={
                <button className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {(user?.name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden sm:block text-left">
                    <div className="text-xs font-semibold text-ink leading-tight max-w-[110px] truncate tracking-tight">
                      {user?.name || "Guest"}
                    </div>
                    <div className="text-2xs text-muted capitalize leading-tight">
                      {user?.role || "—"}
                    </div>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-muted shrink-0" />
                </button>
              }
            >
              <div className="px-3 py-2 border-b border-line">
                <div className="text-xs font-semibold text-ink truncate">
                  {user?.name}
                </div>
                <div className="text-2xs text-muted truncate">{user?.email}</div>
              </div>
              <DropdownItem icon={SettingsIcon} onClick={() => navigate("/settings/company")}>
                Settings
              </DropdownItem>
              <DropdownDivider />
              <DropdownItem icon={LogOut} danger onClick={handleLogout}>
                Sign out
              </DropdownItem>
            </Dropdown>
          </div>
        </header>

        <main className="flex-1 overflow-auto scrollbar-thin">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}