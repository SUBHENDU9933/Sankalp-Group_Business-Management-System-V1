import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, Users, UserCheck, ReceiptText, Hammer,
  Truck, ShieldCheck, LogOut, ChevronRight, UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true, testid: "nav-dashboard" },
  { to: "/leads", label: "Leads", icon: Users, testid: "nav-leads" },
  { to: "/customers", label: "Customers", icon: UserCheck, testid: "nav-customers" },
  { to: "/receipts", label: "Receipts", icon: ReceiptText, testid: "nav-receipts" },
  { to: "/projects", label: "Projects", icon: Hammer, testid: "nav-projects" },
  { to: "/vendors", label: "Vendors", icon: Truck, testid: "nav-vendors" },
];

export default function DashboardLayout() {
  const { profile, isAdmin, signOut } = useAuth();
  const nav = useNavigate();

  const handleLogout = async () => {
    await signOut();
    nav("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-stone-100 grid lg:grid-cols-[260px_1fr]">
      {/* Sidebar */}
      <aside className="bg-stone-900 text-white border-r border-stone-800 flex flex-col" data-testid="sidebar">
        <div className="px-6 py-6 border-b border-stone-800 flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-500 grid place-items-center font-display font-bold">S</div>
          <div>
            <div className="font-display text-sm leading-tight">SANKALP GROUP</div>
            <div className="text-[10px] tracking-[0.2em] uppercase text-stone-500 mt-0.5">Business OS v1</div>
          </div>
        </div>

        <nav className="flex-1 py-4 grid-divider-y">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              data-testid={item.testid}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-6 py-3 text-sm transition-colors group border-l-4",
                  isActive
                    ? "bg-stone-800 border-l-orange-500 text-white"
                    : "border-l-transparent text-stone-400 hover:bg-stone-800 hover:text-white"
                )
              }
            >
              <item.icon className="w-4 h-4" />
              <span className="flex-1">{item.label}</span>
              <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
            </NavLink>
          ))}

          {isAdmin && (
            <>
              <NavLink
                to="/team"
                data-testid="nav-team"
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-6 py-3 text-sm transition-colors group border-l-4",
                    isActive
                      ? "bg-stone-800 border-l-orange-500 text-white"
                      : "border-l-transparent text-stone-400 hover:bg-stone-800 hover:text-white"
                  )
                }
              >
                <UsersRound className="w-4 h-4" />
                <span className="flex-1">Team</span>
              </NavLink>
              <NavLink
                to="/approvals"
                data-testid="nav-approvals"
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-6 py-3 text-sm transition-colors group border-l-4",
                    isActive
                      ? "bg-stone-800 border-l-orange-500 text-white"
                      : "border-l-transparent text-stone-400 hover:bg-stone-800 hover:text-white"
                  )
                }
              >
                <ShieldCheck className="w-4 h-4" />
                <span className="flex-1">Approvals</span>
              </NavLink>
            </>
          )}
        </nav>

        <div className="border-t border-stone-800 p-4">
          <div className="px-2 py-2 mb-2">
            <div className="label-uppercase text-stone-500">Signed in as</div>
            <div className="text-sm text-white mt-1 truncate" data-testid="sidebar-user-name">
              {profile?.full_name || profile?.email || "—"}
            </div>
            <div className="text-xs text-stone-400 mt-0.5 inline-flex items-center gap-2">
              <span
                className={cn(
                  "inline-block px-2 py-0.5 text-[10px] tracking-widest uppercase font-semibold",
                  isAdmin ? "bg-orange-500 text-white" : "bg-stone-700 text-stone-200"
                )}
                data-testid="sidebar-user-role"
              >
                {profile?.role || "rm"}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            data-testid="sidebar-logout-button"
            className="w-full flex items-center gap-2 px-2 py-2 text-sm text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="min-h-screen bg-stone-100">
        <Outlet />
      </main>
    </div>
  );
}
