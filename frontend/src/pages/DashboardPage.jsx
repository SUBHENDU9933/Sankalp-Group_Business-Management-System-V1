import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { PageBody } from "@/components/layout/PageHeader";
import { formatINR, formatDate, todayISO, LEAD_STATUSES } from "@/utils/format";
import {
  Users, UserCheck, ReceiptText, Wallet, AlertTriangle, Calculator,
  ArrowUpRight, CalendarClock, Activity, Hammer, Truck, Flame, Phone,
  TrendingUp, TrendingDown, IndianRupee, Sparkles, ArrowRight, Sun,
  ChevronRight, MessageCircle, MapPin, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------- helpers */
function useCountUp(target, duration = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf, start;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min(1, (ts - start) / duration);
      setVal(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

const greet = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 20) return "Good evening";
  return "Working late";
};
const fmtTime = (d) => {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return formatDate(d);
};

/* ---------------------------------------------------------------- main */
export default function DashboardPage() {
  const { profile, isAdmin } = useAuth();
  const [data, setData] = useState({
    leadsTotal: 0, leadsHot: 0, leadsConverted: 0, leadsByStatus: {},
    customers: 0, vendors: 0, team: 0, projectsTotal: 0, projectsActive: 0,
    receiptsAll: 0, receiptsMtd: 0, expensesAll: 0, expensesMtd: 0,
    estimatesPipeline: 0, estimatesCount: 0,
    todayFups: [], overdue: [], activities: [],
    pendingApprovals: 0, topProjects: [], topVendors: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const today = todayISO();
        const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
        const monthIso = monthStart.toISOString();
        const [
          leadAll, leadHot, leadStatuses,
          custCnt, vendCnt, teamCnt, projAll, projActive,
          receiptsAll, receiptsMtd, expensesAll, expensesMtd, estPipeline,
          todayList, overdueList, recentLeads, recentRcpts, recentExp,
          pendingLeads, pendingCustomers, pendingReceipts,
          topProjectsRaw, topVendorPays,
        ] = await Promise.all([
          supabase.from("leads").select("status,priority,created_at"),
          supabase.from("leads").select("id", { count: "exact", head: true }).eq("priority", "hot"),
          supabase.from("leads").select("status"),
          supabase.from("customers").select("id", { count: "exact", head: true }),
          supabase.from("vendors").select("id", { count: "exact", head: true }),
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase.from("projects").select("id", { count: "exact", head: true }),
          supabase.from("projects").select("id", { count: "exact", head: true }).eq("status", "in_progress"),
          supabase.from("receipts").select("amount"),
          supabase.from("receipts").select("amount,created_at").gte("created_at", monthIso),
          supabase.from("expenses").select("amount"),
          supabase.from("expenses").select("amount,created_at").gte("created_at", monthIso),
          supabase.from("estimates").select("final_amount,status"),
          supabase.from("leads").select("id,name,phone,status,priority,next_followup_date,reminder_note").eq("next_followup_date", today).limit(20),
          supabase.from("leads").select("id,name,phone,status,priority,next_followup_date,reminder_note").lt("next_followup_date", today).not("status", "in", "(converted,lost)").limit(20),
          supabase.from("leads").select("id,name,status,created_at").order("created_at", { ascending: false }).limit(5),
          supabase.from("receipts").select("id,receipt_no,amount,created_at,customer:customers(name)").order("created_at", { ascending: false }).limit(5),
          supabase.from("expenses").select("id,category,amount,created_at,project:projects(project_name)").order("created_at", { ascending: false }).limit(5),
          supabase.from("leads").select("id", { count: "exact", head: true }).eq("delete_request", true),
          supabase.from("customers").select("id", { count: "exact", head: true }).eq("delete_request", true),
          supabase.from("receipts").select("id", { count: "exact", head: true }).eq("delete_request", true).is("deleted_at", null),
          supabase.from("projects").select("id,project_name,total_value,status,start_date,customer:customers(name)").order("created_at", { ascending: false }).limit(20),
          supabase.from("vendor_payments").select("amount,vendor:vendors(id,name,type,photo_url)").order("payment_date", { ascending: false }).limit(150),
        ]);
        if (!active) return;

        // Pipeline by status
        const byStatus = {};
        (leadStatuses.data || []).forEach((l) => { byStatus[l.status] = (byStatus[l.status] || 0) + 1; });
        const converted = byStatus.converted || 0;

        // Estimate pipeline = approved + sent (active money in pipeline)
        const estData = estPipeline.data || [];
        const pipelineSum = estData
          .filter((e) => ["sent", "approved"].includes(e.status))
          .reduce((s, e) => s + Number(e.final_amount || 0), 0);

        // Top vendors aggregated
        const vendorAgg = {};
        (topVendorPays.data || []).forEach((p) => {
          const v = p.vendor;
          if (!v) return;
          if (!vendorAgg[v.id]) vendorAgg[v.id] = { ...v, total: 0, count: 0 };
          vendorAgg[v.id].total += Number(p.amount || 0);
          vendorAgg[v.id].count += 1;
        });
        const topVendors = Object.values(vendorAgg).sort((a, b) => b.total - a.total).slice(0, 4);

        // Activities (merge & sort)
        const acts = [
          ...(recentLeads.data || []).map((l) => ({ type: "lead", id: l.id, label: l.name, sub: l.status.replace(/_/g, " "), at: l.created_at, link: "/leads" })),
          ...(recentRcpts.data || []).map((r) => ({ type: "receipt", id: r.id, label: r.receipt_no, sub: r.customer?.name, amount: r.amount, at: r.created_at, link: "/receipts" })),
          ...(recentExp.data || []).map((e) => ({ type: "expense", id: e.id, label: e.project?.project_name || "Expense", sub: e.category, amount: e.amount, at: e.created_at, link: "/projects" })),
        ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 8);

        const sum = (arr) => (arr || []).reduce((s, r) => s + Number(r.amount || 0), 0);

        setData({
          leadsTotal: (leadAll.data || []).length,
          leadsHot: leadHot.count || 0,
          leadsConverted: converted,
          leadsByStatus: byStatus,
          customers: custCnt.count || 0,
          vendors: vendCnt.count || 0,
          team: teamCnt.count || 0,
          projectsTotal: projAll.count || 0,
          projectsActive: projActive.count || 0,
          receiptsAll: sum(receiptsAll.data),
          receiptsMtd: sum(receiptsMtd.data),
          expensesAll: sum(expensesAll.data),
          expensesMtd: sum(expensesMtd.data),
          estimatesPipeline: pipelineSum,
          estimatesCount: estData.length,
          todayFups: todayList.data || [],
          overdue: overdueList.data || [],
          activities: acts,
          pendingApprovals: (pendingLeads.count || 0) + (pendingCustomers.count || 0) + (pendingReceipts?.count || 0),
          topProjects: (topProjectsRaw.data || []).filter((p) => p.status === "in_progress").slice(0, 3),
          topVendors,
        });
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  const netPL = data.receiptsAll - data.expensesAll;
  const conversionRate = data.leadsTotal ? Math.round((data.leadsConverted / data.leadsTotal) * 100) : 0;

  return (
    <div data-testid="dashboard-page" className="dash-bg">
      {/* HERO */}
      <HeroBanner profile={profile} loading={loading} pendingApprovals={data.pendingApprovals} isAdmin={isAdmin} />

      <PageBody>
        {/* MONEY ROW */}
        <SectionLabel title="Money snapshot" subtitle="Cash flowing through the business" icon={<IndianRupee className="w-3 h-3" />} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-3">
          <MoneyCard tone="emerald" label="Total Receipts" value={data.receiptsAll} sub={`This month · ${formatINR(data.receiptsMtd)}`} icon={TrendingUp} link="/receipts" loading={loading} />
          <MoneyCard tone="rose" label="Total Expenses" value={data.expensesAll} sub={`This month · ${formatINR(data.expensesMtd)}`} icon={TrendingDown} link="/projects" loading={loading} />
          <PLCard pl={netPL} loading={loading} />
          <PipelineCard amount={data.estimatesPipeline} count={data.estimatesCount} loading={loading} />
        </div>

        {/* OPS ROW */}
        <SectionLabel title="Operations" subtitle="Track leads, projects, vendors, team" icon={<Activity className="w-3 h-3" />} className="mt-8" />
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mt-3">
          <OpsTile to="/leads" tone="orange" icon={Users} label="Leads" value={data.leadsTotal} sub={`${data.leadsHot} hot`} loading={loading} testid="ops-leads" />
          <OpsTile to="/leads" tone="blue" icon={Flame} label="Hot Leads" value={data.leadsHot} sub="Priority focus" loading={loading} testid="ops-hot" />
          <OpsTile to="/leads" tone="indigo" icon={TrendingUp} label="Conversion" value={`${conversionRate}%`} sub={`${data.leadsConverted} won`} loading={loading} testid="ops-conv" />
          <OpsTile to="/customers" tone="violet" icon={UserCheck} label="Customers" value={data.customers} sub="Active accounts" loading={loading} testid="ops-cust" />
          <OpsTile to="/projects" tone="amber" icon={Hammer} label="Projects" value={data.projectsTotal} sub={`${data.projectsActive} in progress`} loading={loading} testid="ops-proj" />
          <OpsTile to="/vendors" tone="teal" icon={Truck} label="Vendors" value={data.vendors} sub={`${data.team} team`} loading={loading} testid="ops-vend" />
        </div>

        {/* PIPELINE FUNNEL */}
        <SectionLabel title="Lead pipeline" subtitle="Stage-wise distribution" icon={<Sparkles className="w-3 h-3" />} className="mt-8" link="/leads" />
        <PipelineFunnel byStatus={data.leadsByStatus} total={data.leadsTotal} loading={loading} />

        {/* MAIN GRID — Followups + Activity */}
        <div className="grid lg:grid-cols-3 gap-6 mt-8">
          <div className="lg:col-span-2">
            <FollowupsPanel today={data.todayFups} overdue={data.overdue} loading={loading} />
          </div>
          <div>
            <ActivityFeed items={data.activities} loading={loading} />
          </div>
        </div>

        {/* SNAPSHOTS — Active projects + Top vendors */}
        <div className="grid lg:grid-cols-2 gap-6 mt-8 mb-4">
          <ActiveProjectsPanel projects={data.topProjects} loading={loading} />
          <TopVendorsPanel vendors={data.topVendors} loading={loading} />
        </div>
      </PageBody>

      <style>{`
        .dash-bg { background: linear-gradient(180deg, #f5f4ef 0%, #ecebe5 100%); min-height: 100vh; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        .anim-fade-up { animation: fadeUp 600ms cubic-bezier(.2,.7,.2,1) both; }
        .anim-stagger > * { animation: fadeUp 600ms cubic-bezier(.2,.7,.2,1) both; }
        .anim-stagger > *:nth-child(1) { animation-delay: 40ms; }
        .anim-stagger > *:nth-child(2) { animation-delay: 80ms; }
        .anim-stagger > *:nth-child(3) { animation-delay: 120ms; }
        .anim-stagger > *:nth-child(4) { animation-delay: 160ms; }
        .anim-stagger > *:nth-child(5) { animation-delay: 200ms; }
        .anim-stagger > *:nth-child(6) { animation-delay: 240ms; }
        .grain::before { content:""; position:absolute; inset:0; pointer-events:none; opacity:.04;
          background-image: radial-gradient(rgba(255,255,255,.8) 1px, transparent 1px); background-size: 4px 4px; }
      `}</style>
    </div>
  );
}

/* ============================================================ HERO */
function HeroBanner({ profile, loading, pendingApprovals, isAdmin }) {
  const name = (profile?.full_name || profile?.email || "there").split(" ")[0];
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return (
    <div className="relative overflow-hidden bg-[#0c1c3e] text-white grain anim-fade-up">
      {/* Subtle gradient orbs */}
      <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-orange-500/20 blur-3xl" />
      <div className="absolute -bottom-32 -left-24 w-[480px] h-[480px] rounded-full bg-blue-500/10 blur-3xl" />
      <div className="relative px-6 lg:px-10 pt-8 pb-12">
        <div className="flex items-center gap-2 text-[10px] tracking-[0.25em] uppercase font-semibold text-orange-300">
          <Sun className="w-3 h-3" /> {today}
        </div>
        <h1 className="font-display text-3xl lg:text-5xl tracking-tight mt-3 leading-tight">
          {greet()}, <span className="text-orange-400">{name}</span>
          <span className="ml-2 inline-block animate-pulse">👋</span>
        </h1>
        <p className="text-stone-300 mt-2 text-sm lg:text-base max-w-2xl">
          Here's the live pulse of <span className="font-semibold text-white">Sankalp Group</span> — leads, money, projects, and your team's progress today.
        </p>

        {/* Quick action chips */}
        <div className="flex flex-wrap gap-2 mt-6">
          <QuickChip to="/leads" icon={<Plus className="w-3.5 h-3.5" />} label="New Lead" />
          <QuickChip to="/estimates" icon={<Calculator className="w-3.5 h-3.5" />} label="New Estimate" />
          <QuickChip to="/receipts" icon={<ReceiptText className="w-3.5 h-3.5" />} label="Issue Receipt" />
          <QuickChip to="/projects" icon={<Hammer className="w-3.5 h-3.5" />} label="New Project" />
          <QuickChip to="/vendors" icon={<Wallet className="w-3.5 h-3.5" />} label="Pay Vendor" />
        </div>

        {/* Approvals banner inside hero */}
        {isAdmin && !loading && pendingApprovals > 0 && (
          <Link to="/approvals" data-testid="pending-approvals-banner"
            className="mt-6 inline-flex items-center gap-3 bg-orange-500 hover:bg-orange-400 text-white px-5 py-3 transition-colors group">
            <AlertTriangle className="w-4 h-4" />
            <div className="flex-1">
              <div className="text-[10px] tracking-[0.18em] uppercase font-bold text-orange-100">Action required</div>
              <div className="font-semibold text-sm">{pendingApprovals} delete request{pendingApprovals > 1 ? "s" : ""} awaiting approval</div>
            </div>
            <ArrowUpRight className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
          </Link>
        )}
      </div>
    </div>
  );
}

function QuickChip({ to, icon, label }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 backdrop-blur border border-white/15 text-white text-xs tracking-widest uppercase font-semibold transition-all hover:-translate-y-0.5"
      data-testid={`quick-${label.toLowerCase().replace(/ /g, "-")}`}>
      {icon}{label}
    </Link>
  );
}

/* ============================================================ MONEY CARDS */
function MoneyCard({ tone, label, value, sub, icon: Icon, link, loading }) {
  const animated = useCountUp(value || 0);
  const tones = {
    emerald: { bg: "bg-emerald-700", text: "text-emerald-700", strip: "bg-emerald-100", icon: "bg-emerald-100 text-emerald-700" },
    rose: { bg: "bg-rose-700", text: "text-rose-700", strip: "bg-rose-100", icon: "bg-rose-100 text-rose-700" },
  }[tone] || {};
  const Wrap = link ? Link : "div";
  return (
    <Wrap to={link} className="block bg-white border border-stone-200/70 hover:border-stone-300 transition-all hover:shadow-lg hover:-translate-y-0.5 group anim-fade-up">
      <div className="px-5 pt-4 flex items-start justify-between gap-2">
        <div className={cn("w-10 h-10 grid place-items-center", tones.icon)}>
          <Icon className="w-5 h-5" />
        </div>
        {link && <ArrowUpRight className="w-4 h-4 text-stone-300 group-hover:text-stone-700 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all" />}
      </div>
      <div className="px-5 pb-4 pt-3">
        <div className="text-[10px] tracking-[0.15em] uppercase font-bold text-stone-500">{label}</div>
        <div className={cn("font-display text-3xl font-bold tabular-nums mt-0.5 truncate", tones.text)}>
          {loading ? "—" : formatINR(animated)}
        </div>
        {sub && <div className="text-[11px] text-stone-500 mt-1">{sub}</div>}
      </div>
      <div className={cn("h-1", tones.strip)} />
    </Wrap>
  );
}

function PLCard({ pl, loading }) {
  const positive = pl >= 0;
  const animated = useCountUp(Math.abs(pl) || 0);
  return (
    <div className={cn(
      "block border transition-all hover:shadow-lg hover:-translate-y-0.5 anim-fade-up",
      positive ? "bg-[#0c1c3e] text-white border-[#0c1c3e]" : "bg-rose-700 text-white border-rose-700",
    )}>
      <div className="px-5 pt-4 flex items-start justify-between gap-2">
        <div className={cn("w-10 h-10 grid place-items-center", positive ? "bg-orange-500/20 text-orange-300" : "bg-white/15 text-white")}>
          <Sparkles className="w-5 h-5" />
        </div>
        <div className={cn("text-[10px] tracking-widest uppercase font-bold px-2 py-1", positive ? "bg-orange-500 text-white" : "bg-white/20 text-white")}>
          {positive ? "Profit" : "Loss"}
        </div>
      </div>
      <div className="px-5 pb-4 pt-3">
        <div className="text-[10px] tracking-[0.15em] uppercase font-bold text-stone-300">Net P/L (overall)</div>
        <div className="font-display text-3xl font-bold tabular-nums mt-0.5 truncate">
          {loading ? "—" : (positive ? "" : "−") + formatINR(animated)}
        </div>
        <div className="text-[11px] mt-1 opacity-80">Receipts minus expenses · all time</div>
      </div>
      <div className={cn("h-1", positive ? "bg-orange-500" : "bg-rose-300")} />
    </div>
  );
}

function PipelineCard({ amount, count, loading }) {
  const animated = useCountUp(amount || 0);
  return (
    <Link to="/estimates" className="block bg-white border border-stone-200/70 hover:border-stone-300 transition-all hover:shadow-lg hover:-translate-y-0.5 group anim-fade-up">
      <div className="px-5 pt-4 flex items-start justify-between gap-2">
        <div className="w-10 h-10 grid place-items-center bg-blue-100 text-blue-700">
          <Calculator className="w-5 h-5" />
        </div>
        <ArrowUpRight className="w-4 h-4 text-stone-300 group-hover:text-stone-700 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all" />
      </div>
      <div className="px-5 pb-4 pt-3">
        <div className="text-[10px] tracking-[0.15em] uppercase font-bold text-stone-500">Estimate Pipeline</div>
        <div className="font-display text-3xl font-bold tabular-nums mt-0.5 truncate text-blue-700">
          {loading ? "—" : formatINR(animated)}
        </div>
        <div className="text-[11px] text-stone-500 mt-1">{count} estimates · sent + approved</div>
      </div>
      <div className="h-1 bg-blue-100" />
    </Link>
  );
}

/* ============================================================ OPS TILES */
function OpsTile({ to, tone, icon: Icon, label, value, sub, loading, testid }) {
  const animated = useCountUp(typeof value === "number" ? value : 0, 700);
  const tones = {
    orange: "from-orange-500 to-orange-600",
    blue: "from-blue-600 to-blue-700",
    indigo: "from-indigo-600 to-indigo-700",
    violet: "from-violet-600 to-violet-700",
    amber: "from-amber-500 to-amber-600",
    teal: "from-teal-600 to-teal-700",
  };
  return (
    <Link to={to} data-testid={testid}
      className="group bg-white border border-stone-200/70 hover:border-stone-300 transition-all hover:shadow-lg hover:-translate-y-0.5 anim-fade-up overflow-hidden relative">
      <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", tones[tone])} />
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className={cn("w-9 h-9 grid place-items-center bg-gradient-to-br text-white", tones[tone])}>
            <Icon className="w-4 h-4" />
          </div>
          <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-stone-700 group-hover:translate-x-0.5 transition-all" />
        </div>
        <div className="text-[10px] tracking-[0.15em] uppercase font-bold text-stone-500 mt-3">{label}</div>
        <div className="font-display text-2xl font-bold tabular-nums text-stone-900">
          {loading ? "—" : (typeof value === "number" ? Math.round(animated).toLocaleString("en-IN") : value)}
        </div>
        {sub && <div className="text-[10px] tracking-widest uppercase font-semibold text-stone-400 mt-1 truncate">{sub}</div>}
      </div>
    </Link>
  );
}

/* ============================================================ PIPELINE FUNNEL */
function PipelineFunnel({ byStatus, total, loading }) {
  const stages = LEAD_STATUSES.filter((s) => s.key !== "lost");
  const max = Math.max(1, ...stages.map((s) => byStatus[s.key] || 0));
  return (
    <div className="bg-white border border-stone-200 p-5 mt-3 anim-fade-up">
      {loading ? (
        <div className="text-sm text-stone-500 py-8 text-center">Loading pipeline…</div>
      ) : total === 0 ? (
        <div className="text-sm text-stone-500 py-8 text-center">No leads yet — create one to start tracking.</div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-0 grid-divider-x anim-stagger">
          {stages.map((s) => {
            const count = byStatus[s.key] || 0;
            const pct = (count / max) * 100;
            return (
              <Link to="/leads" key={s.key} className="group px-3 py-3 hover:bg-stone-50 transition-colors">
                <div className="flex items-center gap-1.5">
                  <span className={cn("w-1.5 h-1.5 rounded-full", s.dot)} />
                  <div className="text-[10px] tracking-[0.12em] uppercase font-bold text-stone-500 truncate">{s.label}</div>
                </div>
                <div className="font-display text-2xl font-bold mt-1 tabular-nums">{count}</div>
                <div className="mt-2 h-1.5 bg-stone-100 overflow-hidden">
                  <div className={cn("h-full transition-all duration-700", s.dot)} style={{ width: `${pct}%` }} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================ FOLLOW-UPS */
function FollowupsPanel({ today, overdue, loading }) {
  const all = [
    ...overdue.map((l) => ({ ...l, _kind: "overdue" })),
    ...today.map((l) => ({ ...l, _kind: "today" })),
  ];
  return (
    <div className="bg-white border border-stone-200 anim-fade-up">
      <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-orange-500" />
          <div>
            <div className="text-[10px] tracking-[0.18em] uppercase font-bold text-stone-500">Calls today &amp; overdue</div>
            <div className="font-display text-lg tracking-tight">Your follow-up queue</div>
          </div>
        </div>
        <div className="flex gap-2">
          {overdue.length > 0 && <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] tracking-widest uppercase font-bold bg-rose-50 text-rose-700 border border-rose-200">{overdue.length} overdue</span>}
          {today.length > 0 && <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] tracking-widest uppercase font-bold bg-orange-50 text-orange-700 border border-orange-200">{today.length} today</span>}
        </div>
      </div>
      {loading ? (
        <div className="p-8 text-center text-sm text-stone-500">Loading…</div>
      ) : all.length === 0 ? (
        <div className="p-10 text-center">
          <CalendarClock className="w-8 h-8 mx-auto text-stone-300" />
          <div className="font-display text-base font-semibold mt-2">All caught up</div>
          <p className="text-xs text-stone-500 mt-1">No follow-ups scheduled. Set a reminder on any lead to see it here.</p>
        </div>
      ) : (
        <ul className="grid-divider-y anim-stagger">
          {all.map((l) => {
            const phoneClean = (l.phone || "").replace(/\D/g, "");
            return (
              <li key={l.id} className={cn(
                "px-5 py-3 flex items-center gap-3 hover:bg-stone-50 transition-colors",
                l._kind === "overdue" && "border-l-2 border-rose-500",
              )} data-testid={`followup-${l._kind}-${l.id}`}>
                <div className={cn(
                  "w-9 h-9 rounded-full grid place-items-center font-bold text-xs shrink-0",
                  l.priority === "hot" ? "bg-rose-600 text-white" : l.priority === "warm" ? "bg-amber-500 text-white" : "bg-stone-200 text-stone-700",
                )}>{(l.name || "?").slice(0, 1).toUpperCase()}</div>
                <Link to="/leads" className="flex-1 min-w-0">
                  <div className="font-medium text-stone-900 truncate">{l.name}</div>
                  <div className="text-xs text-stone-500 truncate">{l.phone}{l.reminder_note ? ` · ${l.reminder_note}` : ""}</div>
                </Link>
                <span className={cn(
                  "text-[10px] tracking-widest uppercase font-bold px-2 py-0.5 border whitespace-nowrap",
                  l._kind === "overdue" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-orange-50 text-orange-700 border-orange-200",
                )}>{l._kind === "overdue" ? `Overdue · ${formatDate(l.next_followup_date)}` : "Today"}</span>
                <div className="flex gap-1">
                  {phoneClean && <a href={`tel:${phoneClean}`} className="p-1.5 hover:bg-stone-100 text-stone-500 hover:text-stone-900"><Phone className="w-3.5 h-3.5" /></a>}
                  {phoneClean && <a href={`https://wa.me/${phoneClean}`} target="_blank" rel="noreferrer" className="p-1.5 hover:bg-emerald-50 text-stone-500 hover:text-emerald-700"><MessageCircle className="w-3.5 h-3.5" /></a>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ============================================================ ACTIVITY */
function ActivityFeed({ items, loading }) {
  return (
    <div className="bg-white border border-stone-200 anim-fade-up">
      <div className="px-5 py-4 border-b border-stone-200 flex items-center gap-2">
        <Activity className="w-4 h-4 text-stone-700" />
        <div>
          <div className="text-[10px] tracking-[0.18em] uppercase font-bold text-stone-500">What's happening</div>
          <div className="font-display text-lg tracking-tight">Recent Activity</div>
        </div>
      </div>
      {loading ? (
        <div className="p-8 text-center text-sm text-stone-500">Loading…</div>
      ) : items.length === 0 ? (
        <div className="p-10 text-center text-sm text-stone-500">No activity yet</div>
      ) : (
        <ul className="grid-divider-y anim-stagger">
          {items.map((a, i) => {
            const Icon = a.type === "lead" ? Users : a.type === "receipt" ? ReceiptText : Wallet;
            const tone = a.type === "lead" ? "bg-orange-50 text-orange-700"
              : a.type === "receipt" ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-700";
            return (
              <li key={`${a.type}-${a.id}-${i}`}>
                <Link to={a.link || "/"} className="px-5 py-3 flex items-start gap-3 hover:bg-stone-50 transition-colors">
                  <div className={cn("w-8 h-8 grid place-items-center shrink-0", tone)}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-stone-900 truncate">{a.label}</div>
                    <div className="text-xs text-stone-500 truncate">{a.sub} · <span className="text-stone-400">{fmtTime(a.at)}</span></div>
                  </div>
                  {a.amount && <div className={cn("text-xs font-bold tabular-nums whitespace-nowrap shrink-0", a.type === "expense" ? "text-rose-700" : "text-emerald-700")}>{formatINR(a.amount)}</div>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ============================================================ ACTIVE PROJECTS */
function ActiveProjectsPanel({ projects, loading }) {
  return (
    <div className="bg-white border border-stone-200 anim-fade-up">
      <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Hammer className="w-4 h-4 text-amber-600" />
          <div>
            <div className="text-[10px] tracking-[0.18em] uppercase font-bold text-stone-500">In progress</div>
            <div className="font-display text-lg tracking-tight">Active projects</div>
          </div>
        </div>
        <Link to="/projects" className="text-[10px] tracking-widest uppercase font-bold text-orange-600 hover:text-orange-700 inline-flex items-center gap-0.5">All<ArrowRight className="w-3 h-3" /></Link>
      </div>
      {loading ? (
        <div className="p-8 text-center text-sm text-stone-500">Loading…</div>
      ) : projects.length === 0 ? (
        <div className="p-10 text-center text-sm text-stone-500">No active projects right now.</div>
      ) : (
        <ul className="grid-divider-y anim-stagger">
          {projects.map((p) => (
            <li key={p.id}>
              <Link to={`/projects/${p.id}`} className="block px-5 py-4 hover:bg-stone-50 transition-colors group">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-base font-semibold tracking-tight truncate group-hover:text-orange-600">{p.project_name}</div>
                    <div className="text-xs text-stone-500 mt-0.5 inline-flex items-center gap-1">
                      <UserCheck className="w-3 h-3" />{p.customer?.name || "—"}
                      {p.start_date && <><span className="mx-1">·</span><MapPin className="w-3 h-3" />{formatDate(p.start_date)}</>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] tracking-widest uppercase font-bold text-stone-400">Value</div>
                    <div className="font-display text-base font-bold tabular-nums">{formatINR(p.total_value)}</div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ============================================================ TOP VENDORS */
function TopVendorsPanel({ vendors, loading }) {
  return (
    <div className="bg-white border border-stone-200 anim-fade-up">
      <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-teal-700" />
          <div>
            <div className="text-[10px] tracking-[0.18em] uppercase font-bold text-stone-500">By total paid</div>
            <div className="font-display text-lg tracking-tight">Top vendors</div>
          </div>
        </div>
        <Link to="/vendors" className="text-[10px] tracking-widest uppercase font-bold text-orange-600 hover:text-orange-700 inline-flex items-center gap-0.5">All<ArrowRight className="w-3 h-3" /></Link>
      </div>
      {loading ? (
        <div className="p-8 text-center text-sm text-stone-500">Loading…</div>
      ) : vendors.length === 0 ? (
        <div className="p-10 text-center text-sm text-stone-500">No vendor payments yet.</div>
      ) : (
        <ul className="grid-divider-y anim-stagger">
          {vendors.map((v) => (
            <li key={v.id}>
              <Link to={`/vendors/${v.id}`} className="block px-5 py-3 hover:bg-stone-50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-stone-100 border border-stone-200 grid place-items-center overflow-hidden shrink-0">
                    {v.photo_url ? (
                      <img src={v.photo_url} alt={v.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-stone-400 font-bold text-sm">{(v.name || "?").slice(0, 1).toUpperCase()}</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-stone-900 truncate group-hover:text-orange-600">{v.name}</div>
                    <div className="text-xs text-stone-500 truncate">{v.type || "—"} · {v.count} payment{v.count !== 1 ? "s" : ""}</div>
                  </div>
                  <div className="font-display text-base font-bold tabular-nums text-stone-900 whitespace-nowrap">{formatINR(v.total)}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ============================================================ HELPERS */
function SectionLabel({ title, subtitle, icon, className, link }) {
  return (
    <div className={cn("flex items-end justify-between mt-2", className)}>
      <div>
        <div className="inline-flex items-center gap-1.5 text-[10px] tracking-[0.22em] uppercase font-bold text-orange-600">
          {icon}{title}
        </div>
        <div className="text-xs text-stone-500 mt-0.5">{subtitle}</div>
      </div>
      {link && (
        <Link to={link} className="text-[10px] tracking-widest uppercase font-bold text-stone-700 hover:text-orange-600 inline-flex items-center gap-0.5">
          See all <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}
