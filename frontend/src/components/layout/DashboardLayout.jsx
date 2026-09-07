import { useEffect, useRef, useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LayoutDashboard, Users, UserCheck, ReceiptText, Hammer, Truck, ShieldCheck, UsersRound, Calculator, FileCheck2, Trash2, Activity, Sun, Moon, FileSignature, Send, BarChart3, UserCircle, LogOut, ChevronDown } from "lucide-react";
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
  { to: "/agreements", label: "Agreements", icon: FileSignature, testid: "nav-agreements" },
];

export default function DashboardLayout() {
  const { profile, role, isAdmin, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const nav = useNavigate();
  const handleLogout = async () => { await signOut(); nav("/login", { replace: true }); };

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const displayName = profile?.full_name || profile?.email?.split("@")[0] || "User";
  const displayRole = profile?.designation || ({ admin: "Administrator", rm: "Relationship Manager", re: "Relationship Executive" }[role] || "Team");
  const initials = displayName.slice(0, 1).toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 grid lg:grid-cols-[260px_1fr]">
      <aside className="shell-dark-scope bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col" data-testid="sidebar">
        <div className="px-5 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3"><div className="bg-white rounded-xl border border-slate-100 p-1.5 shadow-sm"><Logo className="h-9 w-9 object-contain" /></div><div><div className="font-display text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-tight">SANKALP GROUP</div><div className="text-[10px] tracking-[0.18em] uppercase text-slate-500 dark:text-slate-400 mt-0.5">Interior &amp; Infra Solutions</div></div></div>
        <nav className="flex-1 py-3 space-y-0.5 px-3">
          {NAV.map((item) => <NavLink key={item.to} to={item.to} end={item.exact} data-testid={item.testid} className={({ isActive }) => cn("flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors", isActive ? "bg-blue-700 text-white shadow-sm shadow-blue-700/20" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100")}><item.icon className="w-4 h-4" /><span className="flex-1 font-medium">{item.label}</span></NavLink>)}
          {isAdmin && <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 space-y-0.5">
            <div className="px-3 py-1.5 label-uppercase text-slate-400">Admin</div>
            {[ ["/team","Team",UsersRound,"nav-team"],["/reports","Reports",BarChart3,"nav-reports"],["/agreement-templates","Agreement Templates",FileSignature,"nav-agreement-templates"],["/approvals","Delete Approvals",ShieldCheck,"nav-approvals"],["/audit-log","Audit Log",Activity,"nav-audit-log"],["/trash","Trash",Trash2,"nav-trash"] ].map(([to,label,Icon,testid]) => <NavLink key={to} to={to} data-testid={testid} className={({ isActive }) => cn("flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors", isActive ? "bg-blue-700 text-white" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100")}><Icon className="w-4 h-4" /><span className="flex-1 font-medium">{label}</span></NavLink>)}
            {profile?.email === "info.subhendu@gmail.com" && <NavLink to="/admin-notify" data-testid="nav-admin-notify" className={({ isActive }) => cn("flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors", isActive ? "bg-blue-700 text-white" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100")}><Send className="w-4 h-4" /><span className="flex-1 font-medium">Send Notification</span></NavLink>}
          </div>}
          {!isAdmin && <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800"><NavLink to="/trash" data-testid="nav-trash-user" className={({ isActive }) => cn("flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors", isActive ? "bg-blue-700 text-white" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100")}><Trash2 className="w-4 h-4" /><span className="flex-1 font-medium">Trash</span></NavLink></div>}
        </nav>
      </aside>
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950"><header className="shell-dark-scope bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 lg:px-10 py-3.5 flex items-center justify-between sticky top-0 z-20"><div><div className="text-xs text-slate-500 dark:text-slate-400">Welcome back,</div><div className="font-display text-base font-bold text-slate-900 dark:text-slate-100">{profile?.full_name?.split(" ")[0] || "there"} <span className="ml-1">👋</span></div></div><div className="flex items-center gap-2"><button onClick={toggleTheme} data-testid="theme-toggle-button" aria-label="Toggle light or dark mode" className="w-9 h-9 grid place-items-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">{theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}</button><NotificationBell /><div className="relative" ref={profileMenuRef}><button type="button" onClick={() => setProfileOpen((open) => !open)} data-testid="profile-menu-button" aria-label="Open profile menu" aria-expanded={profileOpen} className={cn("relative w-10 h-10 rounded-xl grid place-items-center transition-all border", profileOpen ? "bg-blue-50 dark:bg-blue-950 border-blue-300 dark:border-blue-700 ring-2 ring-blue-100 dark:ring-blue-900" : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950")}><span className="w-8 h-8 rounded-full bg-blue-700 text-white grid place-items-center font-bold text-sm shadow-sm">{initials}</span><span className="absolute right-0.5 bottom-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" aria-label="Online" /><ChevronDown className={cn("absolute -right-1 -bottom-1 w-3.5 h-3.5 rounded-full bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-300 transition-transform", profileOpen && "rotate-180")} /></button>{profileOpen && <div className="absolute right-0 mt-3 w-72 origin-top-right rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl shadow-slate-900/10 dark:shadow-black/30 p-2 z-50"><div className="px-3 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 flex items-center gap-3"><div className="relative shrink-0"><div className="w-11 h-11 rounded-full bg-blue-700 text-white grid place-items-center font-bold shadow-sm">{initials}</div><span className="absolute right-0 bottom-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" /></div><div className="min-w-0 flex-1"><div className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">{displayName}</div><div className="text-xs text-slate-500 dark:text-slate-400 truncate">{displayRole}</div><div className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">{profile?.email || ""}</div></div></div><NavLink to="/profile" onClick={() => setProfileOpen(false)} data-testid="profile-menu-profile-link" className="mt-2 flex items-center gap-3 px-3 py-3 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><UserCircle className="w-5 h-5 text-slate-500" /><span><span className="block text-sm font-semibold">My Profile</span><span className="block text-xs text-slate-400">View and update your details</span></span></NavLink><div className="my-1 border-t border-slate-100 dark:border-slate-800" /><button type="button" onClick={handleLogout} data-testid="profile-menu-logout-button" className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors text-left"><LogOut className="w-5 h-5" /><span><span className="block text-sm font-semibold">Sign Out</span><span className="block text-xs text-rose-400 dark:text-rose-500">End your current session</span></span></button></div>}</div></div></header><Outlet /></main>
    </div>
  );
}
