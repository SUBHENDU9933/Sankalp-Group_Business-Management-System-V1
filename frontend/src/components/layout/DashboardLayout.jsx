import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, Users, UserCheck, ReceiptText, Hammer,
  Truck, ShieldCheck, LogOut, UsersRound, Settings, Calculator,
  FileCheck2, Trash2, Activity, Sun, Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/lib/brand";
import NotificationBell from "@/components/layout/NotificationBell";
import { useTheme } from "@/contexts/ThemeContext";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true, testid: "nav-dashboard" },
  { to: "/leads", label: "Leads", icon: Users, testid: "nav-leads" },
  { to: "/estimates", label: "Estimates", icon: Calculator, testid: "nav-estimates" },
  { to: "/customers", label: "Customers", icon: UserCheck, testid: "nav-customers" },
  { to: "/projects", label: "Projects", icon: Hammer, testid: "nav-projects" },
  { to: "/receipts", label: "Receipts", icon: ReceiptText, testid: "nav-receipts" },
  { to: "/vendors", label: "Vendors", icon: Truck, testid: "nav-vendors" },
  { to: "/digital-approvals", label: "Digital Approvals", icon: FileCheck2, testid: "nav-digital-approvals" },
];

export default function DashboardLayout() {
  const { profile, isAdmin, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const nav = useNavigate();

  const handleLogout = async () => {
    await signOut();
    nav("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 grid lg:grid-cols-[260px_1fr]">
      {/* Sidebar */}
      <aside className="bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col" data-testid="sidebar">
        <div className="px-5 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
          <div className="bg-white rounded-xl border border-slate-100 p-1.5 shadow-sm">
            <Logo className="h-9 w-9 object-contain" />
          </div>
          <div>
            <div className="font-display text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-tight">SANKALP GROUP</div>
            <div className="text-[10px] tracking-[0.18em] uppercase text-slate-500 dark:text-slate-400 mt-0.5">Interior &amp; Infra Solutions</div>
          </div>
        </div>

        <nav className="flex-1 py-3 space-y-0.5 px-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              data-testid={item.testid}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors",
                  isActive
                    ? "bg-blue-700 text-white shadow-sm shadow-blue-700/20"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                )
              }
            >
              <item.icon className="w-4 h-4" />
              <span className="flex-1 font-medium">{item.label}</span>
            </NavLink>
          ))}

          {isAdmin && (
            <div className="pt-3 mt-3 border-t border-slate-100 space-y-0.5">
              <div className="px-3 py-1.5 label-uppercase text-slate-400">Admin</div>
              <NavLink to="/team" data-testid="nav-team"
                className={({ isActive }) =>
                  cn("flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors",
                    isActive ? "bg-blue-700 text-white" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900")}>
                <UsersRound className="w-4 h-4" /><span className="flex-1 font-medium">Team</span>
              </NavLink>
              <NavLink to="/approvals" data-testid="nav-approvals"
                className={({ isActive }) =>
                  cn("flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors",
                    isActive ? "bg-blue-700 text-white" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900")}>
                <ShieldCheck className="w-4 h-4" /><span className="flex-1 font-medium">Delete Approvals</span>
              </NavLink>
              <NavLink to="/audit-log" data-testid="nav-audit-log"
                className={({ isActive }) =>
                  cn("flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors",
                    isActive ? "bg-blue-700 text-white" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900")}>
                <Activity className="w-4 h-4" /><span className="flex-1 font-medium">Audit Log</span>
              </NavLink>
              <NavLink to="/trash" data-testid="nav-trash"
                className={({ isActive }) =>
                  cn("flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors",
                    isActive ? "bg-blue-700 text-white" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900")}>
                <Trash2 className="w-4 h-4" /><span className="flex-1 font-medium">Trash</span>
              </NavLink>
            </div>
          )}
          {!isAdmin && (
            <div className="pt-3 mt-3 border-t border-slate-100 space-y-0.5">
              <NavLink to="/trash" data-testid="nav-trash-user"
                className={({ isActive }) =>
                  cn("flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors",
                    isActive ? "bg-blue-700 text-white" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900")}>
                <Trash2 className="w-4 h-4" /><span className="flex-1 font-medium">Trash</span>
              </NavLink>
            </div>
          )}
        </nav>

        <div className="border-t border-slate-100 p-3">
          <NavLink to="/profile" data-testid="sidebar-profile-link"
            className={({ isActive }) =>
              cn("flex items-center gap-3 p-2 rounded-lg transition-colors",
                isActive ? "bg-blue-50 ring-1 ring-blue-200" : "bg-slate-50 hover:bg-slate-100")
            }>
            <div className="w-9 h-9 rounded-full bg-blue-700 text-white grid place-items-center font-bold text-sm">
              {(profile?.full_name || profile?.email || "?").slice(0,1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-900 truncate" data-testid="sidebar-user-name">
                {profile?.full_name || profile?.email?.split("@")[0] || "—"}
              </div>
              <div className="inline-flex items-center gap-1.5 mt-0.5">
                <span className={cn("inline-block w-1.5 h-1.5 rounded-full", isAdmin ? "bg-emerald-500" : "bg-slate-400")} />
                <span className="text-[10px] tracking-widest uppercase font-semibold text-slate-500" data-testid="sidebar-user-role">
                  {profile?.designation || (isAdmin ? "Administrator" : "RM")}
                </span>
              </div>
            </div>
          </NavLink>
          <button onClick={handleLogout} data-testid="sidebar-logout-button"
            className="w-full mt-2 flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors font-medium">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
        {/* Topbar */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 lg:px-10 py-3.5 flex items-center justify-between sticky top-0 z-20">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Welcome back,</div>
            <div className="font-display text-base font-bold text-slate-900 dark:text-slate-100">{profile?.full_name?.split(" ")[0] || "there"} <span className="ml-1">👋</span></div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              data-testid="theme-toggle-button"
              aria-label="Toggle light or dark mode"
              className="w-9 h-9 grid place-items-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <NotificationBell />
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
