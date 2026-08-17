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
  ChevronRight, MessageCircle, MapPin, Plus, Zap, PieChart, BarChart3,
  Banknote, Landmark, Smartphone, FileSignature, CircleDollarSign,
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

const PAYMENT_MODE_META = {
  cash: { label: "Cash", icon: Banknote, color: "#2563EB", bg: "bg-blue-50", text: "text-blue-600" },
  bank: { label: "Bank Transfer", icon: Landmark, color: "#0D9488", bg: "bg-teal-50", text: "text-teal-600" },
  upi: { label: "UPI", icon: Smartphone, color: "#F97316", bg: "bg-orange-50", text: "text-orange-600" },
  cheque: { label: "Cheque", icon: FileSignature, color: "#7C3AED", bg: "bg-violet-50", text: "text-violet-600" },
  other: { label: "Other", icon: CircleDollarSign, color: "#64748B", bg: "bg-slate-100", text: "text-slate-600" },
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
    paymentModeBreakdown: {}, monthlyTrend: [], receiptsTrendPct: null, expensesTrendPct: null,
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
          supabase.from("receipts").select("amount,created_at,payment_mode"),
          supabase.from("receipts").select("amount,created_at").gte("created_at", monthIso),
          supabase.from("expenses").select("amount,created_at"),
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
          supabase.from("projects").select("id,project_name,total_value,status,start_date,end_date,customer:customers(name)").order("created_at", { ascending: false }).limit(20),
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

        // Payment mode breakdown (real, from receipts.payment_mode)
        const modeAgg = {};
        (receiptsAll.data || []).forEach((r) => {
          const m = r.payment_mode || "other";
          modeAgg[m] = (modeAgg[m] || 0) + Number(r.amount || 0);
        });

        // Monthly trend — last 6 months, real receipts vs expenses
        const monthBuckets = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
          monthBuckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("en-IN", { month: "short" }), receipts: 0, expenses: 0 });
        }
        const bucketKey = (dateStr) => { const d = new Date(dateStr); return `${d.getFullYear()}-${d.getMonth()}`; };
        (receiptsAll.data || []).forEach((r) => {
          const b = monthBuckets.find((x) => x.key === bucketKey(r.created_at));
          if (b) b.receipts += Number(r.amount || 0);
        });
        (expensesAll.data || []).forEach((e) => {
          const b = monthBuckets.find((x) => x.key === bucketKey(e.created_at));
          if (b) b.expenses += Number(e.amount || 0);
        });
        const prevM = monthBuckets[monthBuckets.length - 2];
        const curM = monthBuckets[monthBuckets.length - 1];
        const pctChange = (curr, prev) => (prev > 0 ? Math.round(((curr - prev) / prev) * 100) : null);

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
          paymentModeBreakdown: modeAgg,
          monthlyTrend: monthBuckets,
          receiptsTrendPct: pctChange(curM.receipts, prevM.receipts),
          expensesTrendPct: pctChange(curM.expenses, prevM.expenses),
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
        {/* QUICK ACTIONS */}
        <ShortcutsRow />

        {/* MONEY ROW */}
        <SectionLabel title="Money snapshot" subtitle="Cash flowing through the business" icon={<IndianRupee className="w-3 h-3" />} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-3">
          <MoneyCard tone="emerald" label="Total Receipts" value={data.receiptsAll} sub={`This month · ${formatINR(data.receiptsMtd)}`} icon={TrendingUp} link="/receipts" loading={loading} trendPct={data.receiptsTrendPct} />
          <MoneyCard tone="rose" label="Total Expenses" value={data.expensesAll} sub={`This month · ${formatINR(data.expensesMtd)}`} icon={TrendingDown} link="/projects" loading={loading} trendPct={data.expensesTrendPct} invertTrend />
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

        {/* INSIGHTS — revenue trend + payment mode split */}
        <SectionLabel title="Insights" subtitle="Revenue trend and how collections come in" icon={<BarChart3 className="w-3 h-3" />} className="mt-8" />
        <div className="grid lg:grid-cols-3 gap-6 mt-3">
          <div className="lg:col-span-2">
            <RevenueTrendPanel data={data.monthlyTrend} loading={loading} />
          </div>
          <div>
            <PaymentModePanel breakdown={data.paymentModeBreakdown} loading={loading} />
          </div>
        </div>

        {/* PIPELINE FUNNEL */}
        <SectionLabel title="Lead pipeline" subtitle="Stage-wise distribution" icon={<Sparkles className="w-3 h-3" />} className="mt-8" link="/leads" />
        <PipelineFunnel byStatus={data.leadsByStatus} total={data.leadsTotal} loading={loading} />

        {/* Follow-up queue — full width */}
        <div className="mt-8">
          <FollowupsPanel today={data.todayFups} overdue={data.overdue} loading={loading} />
        </div>

        {/* SNAPSHOTS — Active projects + Top vendors */}
        <div className="grid lg:grid-cols-2 gap-6 mt-8">
          <ActiveProjectsPanel projects={data.topProjects} loading={loading} />
          <TopVendorsPanel vendors={data.topVendors} loading={loading} />
        </div>

        {/* Recent Activity — now last */}
        <div className="mt-8 mb-4">
          <ActivityFeed items={data.activities} loading={loading} />
        </div>
      </PageBody>

      <style>{`
        .dash-bg { background: linear-gradient(180deg, #f5f4ef 0%, #ecebe5 100%); min-height: 100vh; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes popIn { from { opacity: 0; transform: translateY(8px) scale(.96) } to { opacity: 1; transform: translateY(0) scale(1) } }
        .anim-fade-up { animation: fadeUp 600ms cubic-bezier(.2,.7,.2,1) both; }
        .anim-stagger > * { animation: fadeUp 600ms cubic-bezier(.2,.7,.2,1) both; }
        .anim-stagger > *:nth-child(1) { animation-delay: 40ms; }
        .anim-stagger > *:nth-child(2) { animation-delay: 80ms; }
        .anim-stagger > *:nth-child(3) { animation-delay: 120ms; }
        .anim-stagger > *:nth-child(4) { animation-delay: 160ms; }
        .anim-stagger > *:nth-child(5) { animation-delay: 200ms; }
        .anim-stagger > *:nth-child(6) { animation-delay: 240ms; }
        .anim-pop > * { animation: popIn 480ms cubic-bezier(.2,.7,.2,1) both; }
        .anim-pop > *:nth-child(1) { animation-delay: 20ms; } .anim-pop > *:nth-child(2) { animation-delay: 60ms; }
        .anim-pop > *:nth-child(3) { animation-delay: 100ms; } .anim-pop > *:nth-child(4) { animation-delay: 140ms; }
        .anim-pop > *:nth-child(5) { animation-delay: 180ms; } .anim-pop > *:nth-child(6) { animation-delay: 220ms; }
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

        {/* Approvals banner inside hero */}
        {isAdmin && !loading && pendingApprovals > 0 && (
          <Link to="/approvals" data-testid="pending-approvals-banner"
            className="mt-6 inline-flex items-center gap-3 bg-orange-500 hover:bg-orange-400 text-white px-5 py-3 transition-colors group rounded-xl">
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

/* ============================================================ SHORTCUTS */
function ShortcutsRow() {
  const items = [
    { to: "/leads", icon: Plus, label: "New Lead", tone: "blue" },
    { to: "/estimates", icon: Calculator, label: "New Estimate", tone: "violet" },
    { to: "/receipts", icon: ReceiptText, label: "Issue Receipt", tone: "orange" },
    { to: "/projects", icon: Hammer, label: "New Project", tone: "teal" },
    { to: "/customers", icon: UserCheck, label: "Add Customer", tone: "emerald" },
    { to: "/vendors", icon: Wallet, label: "Pay Vendor", tone: "rose" },
  ];
  const tones = {
    blue: "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white",
    violet: "bg-violet-50 text-violet-600 group-hover:bg-violet-600 group-hover:text-white",
    orange: "bg-orange-50 text-orange-600 group-hover:bg-orange-500 group-hover:text-white",
    teal: "bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white",
    emerald: "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white",
    rose: "bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white",
  };
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-6 anim-pop" data-testid="dashboard-shortcuts">
      {items.map((it) => (
        <Link key={it.label} to={it.to}
          className="group bg-white border border-stone-200/70 hover:border-transparent rounded-2xl p-4 flex flex-col items-center gap-2.5 text-center transition-all hover:shadow-xl hover:-translate-y-1"
          data-testid={`shortcut-${it.label.toLowerCase().replace(/ /g, "-")}`}>
          <div className={cn("w-10 h-10 rounded-xl grid place-items-center transition-colors duration-200 group-hover:rotate-[-6deg] group-hover:scale-110", tones[it.tone])}>
            <it.icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
          </div>
          <div className="text-[11px] font-bold text-stone-600 group-hover:text-stone-900">{it.label}</div>
        </Link>
      ))}
    </div>
  );
}

/* ============================================================ MONEY CARDS */
function MoneyCard({ tone, label, value, sub, icon: Icon, link, loading, trendPct, invertTrend }) {
  const animated = useCountUp(value || 0);
  const tones = {
    emerald: { icon: "bg-emerald-50 text-emerald-600", strip: "bg-emerald-100", text: "text-emerald-700" },
    rose: { icon: "bg-rose-50 text-rose-600", strip: "bg-rose-100", text: "text-rose-700" },
  }[tone] || {};
  const Wrap = link ? Link : "div";
  const good = invertTrend ? trendPct <= 0 : trendPct >= 0;
  return (
    <Wrap to={link} className="block bg-white border border-stone-200/70 hover:border-transparent rounded-2xl transition-all hover:shadow-xl hover:-translate-y-1 group anim-fade-up overflow-hidden">
      <div className="px-5 pt-5 flex items-start justify-between gap-2">
        <div className={cn("w-11 h-11 rounded-xl grid place-items-center", tones.icon)}>
          <Icon className="w-5 h-5" />
        </div>
        {trendPct !== null && trendPct !== undefined && !loading && (
          <div className={cn("text-[10.5px] font-bold px-2 py-1 rounded-full", good ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
            {trendPct >= 0 ? "↑" : "↓"} {Math.abs(trendPct)}%
          </div>
        )}
      </div>
      <div className="px-5 pb-5 pt-3">
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
      "block border transition-all hover:shadow-xl hover:-translate-y-1 anim-fade-up rounded-2xl overflow-hidden",
      positive ? "bg-[#0c1c3e] text-white border-[#0c1c3e]" : "bg-rose-700 text-white border-rose-700",
    )}>
      <div className="px-5 pt-5 flex items-start justify-between gap-2">
        <div className={cn("w-11 h-11 rounded-xl grid place-items-center", positive ? "bg-orange-500/20 text-orange-300" : "bg-white/15 text-white")}>
          <Sparkles className="w-5 h-5" />
        </div>
        <div className={cn("text-[10px] tracking-widest uppercase font-bold px-2.5 py-1 rounded-full", positive ? "bg-orange-500 text-white" : "bg-white/20 text-white")}>
          {positive ? "Profit" : "Loss"}
        </div>
      </div>
      <div className="px-5 pb-5 pt-3">
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
    <Link to="/estimates" className="block bg-white border border-stone-200/70 hover:border-transparent rounded-2xl transition-all hover:shadow-xl hover:-translate-y-1 group anim-fade-up overflow-hidden">
      <div className="px-5 pt-5 flex items-start justify-between gap-2">
        <div className="w-11 h-11 rounded-xl grid place-items-center bg-blue-50 text-blue-600">
          <Calculator className="w-5 h-5" />
        </div>
        <ArrowUpRight className="w-4 h-4 text-stone-300 group-hover:text-stone-700 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all" />
      </div>
      <div className="px-5 pb-5 pt-3">
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
    orange: "bg-orange-50 text-orange-600",
    blue: "bg-blue-50 text-blue-600",
    indigo: "bg-indigo-50 text-indigo-600",
    violet: "bg-violet-50 text-violet-600",
    amber: "bg-amber-50 text-amber-600",
    teal: "bg-teal-50 text-teal-600",
  };
  return (
    <Link to={to} data-testid={testid}
      className="group bg-white border border-stone-200/70 hover:border-transparent rounded-2xl transition-all hover:shadow-xl hover:-translate-y-1 anim-fade-up overflow-hidden relative">
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className={cn("w-10 h-10 rounded-xl grid place-items-center transition-transform group-hover:scale-110 group-hover:-rotate-6", tones[tone])}>
            <Icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
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

/* ============================================================ REVENUE TREND */
function RevenueTrendPanel({ data, loading }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.receipts, d.expenses]));
  return (
    <div className="bg-white border border-stone-200/70 rounded-2xl anim-fade-up overflow-hidden">
      <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-600" />
          <div>
            <div className="text-[10px] tracking-[0.18em] uppercase font-bold text-stone-500">Last 6 months</div>
            <div className="font-display text-lg tracking-tight">Revenue trend</div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider">
          <span className="inline-flex items-center gap-1.5 text-stone-600"><span className="w-2.5 h-2.5 rounded-sm bg-blue-600 inline-block" />Receipts</span>
          <span className="inline-flex items-center gap-1.5 text-stone-600"><span className="w-2.5 h-2.5 rounded-sm bg-orange-400 inline-block" />Expenses</span>
        </div>
      </div>
      <div className="p-5">
        {loading ? (
          <div className="h-40 grid place-items-center text-sm text-stone-500">Loading…</div>
        ) : (
          <div className="flex items-end gap-3 h-40">
            {data.map((m, i) => (
              <div key={m.key} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <div className="w-full flex items-end justify-center gap-1 h-full">
                  <div className="w-full max-w-[16px] rounded-t-md bg-gradient-to-t from-blue-700 to-blue-500 transition-all duration-700 ease-out"
                    style={{ height: `${(m.receipts / max) * 100}%`, transitionDelay: `${i * 70}ms` }} />
                  <div className="w-full max-w-[16px] rounded-t-md bg-gradient-to-t from-orange-500 to-orange-300 transition-all duration-700 ease-out"
                    style={{ height: `${(m.expenses / max) * 100}%`, transitionDelay: `${i * 70 + 40}ms` }} />
                </div>
                <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">{m.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================ PAYMENT MODE DONUT */
function PaymentModePanel({ breakdown, loading }) {
  const entries = Object.entries(breakdown || {}).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  const C = 2 * Math.PI * 52;
  let offsetAcc = 0;

  return (
    <div className="bg-white border border-stone-200/70 rounded-2xl anim-fade-up overflow-hidden h-full">
      <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-2">
        <PieChart className="w-4 h-4 text-orange-600" />
        <div>
          <div className="text-[10px] tracking-[0.18em] uppercase font-bold text-stone-500">All time</div>
          <div className="font-display text-lg tracking-tight">Collection by mode</div>
        </div>
      </div>
      <div className="p-5">
        {loading ? (
          <div className="h-40 grid place-items-center text-sm text-stone-500">Loading…</div>
        ) : total === 0 ? (
          <div className="h-40 grid place-items-center text-sm text-stone-500 text-center px-4">No receipts recorded yet.</div>
        ) : (
          <div className="flex flex-col items-center gap-5">
            <div className="relative w-[132px] h-[132px]">
              <svg width="132" height="132" viewBox="0 0 132 132">
                <circle cx="66" cy="66" r="52" fill="none" stroke="#F1F0EB" strokeWidth="16" />
                {entries.map(([mode, val], i) => {
                  const meta = PAYMENT_MODE_META[mode] || PAYMENT_MODE_META.other;
                  const pct = val / total;
                  const len = C * pct;
                  const el = (
                    <circle key={mode} cx="66" cy="66" r="52" fill="none" stroke={meta.color} strokeWidth="16"
                      strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offsetAcc}
                      transform="rotate(-90 66 66)" strokeLinecap="butt"
                      style={{ transition: "stroke-dasharray 900ms cubic-bezier(.2,.7,.2,1)", transitionDelay: `${i * 100}ms` }} />
                  );
                  offsetAcc += len;
                  return el;
                })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="font-display text-base font-extrabold">{formatINR(total)}</div>
                <div className="text-[9px] uppercase tracking-widest font-bold text-stone-400">Total</div>
              </div>
            </div>
            <div className="w-full flex flex-col gap-2">
              {entries.map(([mode, val]) => {
                const meta = PAYMENT_MODE_META[mode] || PAYMENT_MODE_META.other;
                const pct = Math.round((val / total) * 100);
                return (
                  <div key={mode} className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-2 font-semibold text-stone-600">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: meta.color }} />
                      {meta.label}
                    </span>
                    <span className="font-bold text-stone-900">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================ PIPELINE FUNNEL */
function PipelineFunnel({ byStatus, total, loading }) {
  const stages = LEAD_STATUSES.filter((s) => s.key !== "lost");
  const max = Math.max(1, ...stages.map((s) => byStatus[s.key] || 0));
  return (
    <div className="bg-white border border-stone-200/70 rounded-2xl p-5 mt-3 anim-fade-up overflow-hidden">
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
              <Link to="/leads" key={s.key} className="group px-3 py-3 hover:bg-stone-50 transition-colors rounded-xl">
                <div className="flex items-center gap-1.5">
                  <span className={cn("w-1.5 h-1.5 rounded-full", s.dot)} />
                  <div className="text-[10px] tracking-[0.12em] uppercase font-bold text-stone-500 truncate">{s.label}</div>
                </div>
                <div className="font-display text-2xl font-bold mt-1 tabular-nums">{count}</div>
                <div className="mt-2 h-1.5 bg-stone-100 overflow-hidden rounded-full">
                  <div className={cn("h-full transition-all duration-700 rounded-full", s.dot)} style={{ width: `${pct}%` }} />
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
    <div className="bg-white border border-stone-200/70 rounded-2xl anim-fade-up overflow-hidden">
      <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-orange-500" />
          <div>
            <div className="text-[10px] tracking-[0.18em] uppercase font-bold text-stone-500">Calls today &amp; overdue</div>
            <div className="font-display text-lg tracking-tight">Your follow-up queue</div>
          </div>
        </div>
        <div className="flex gap-2">
          {overdue.length > 0 && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] tracking-widest uppercase font-bold bg-rose-50 text-rose-700 border border-rose-200">{overdue.length} overdue</span>}
          {today.length > 0 && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] tracking-widest uppercase font-bold bg-orange-50 text-orange-700 border border-orange-200">{today.length} today</span>}
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
                "px-5 py-3 flex items-center gap-3 hover:bg-stone-50 transition-all hover:pl-6",
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
                  "text-[10px] tracking-widest uppercase font-bold px-2 py-0.5 rounded-full border whitespace-nowrap",
                  l._kind === "overdue" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-orange-50 text-orange-700 border-orange-200",
                )}>{l._kind === "overdue" ? `Overdue · ${formatDate(l.next_followup_date)}` : "Today"}</span>
                <div className="flex gap-1">
                  {phoneClean && <a href={`tel:${phoneClean}`} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500 hover:text-stone-900"><Phone className="w-3.5 h-3.5" /></a>}
                  {phoneClean && <a href={`https://wa.me/${phoneClean}`} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg hover:bg-emerald-50 text-stone-500 hover:text-emerald-700"><MessageCircle className="w-3.5 h-3.5" /></a>}
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
    <div className="bg-white border border-stone-200/70 rounded-2xl anim-fade-up overflow-hidden">
      <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-2">
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
                  <div className={cn("w-8 h-8 rounded-lg grid place-items-center shrink-0", tone)}>
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
    <div className="bg-white border border-stone-200/70 rounded-2xl anim-fade-up overflow-hidden">
      <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
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
          {projects.map((p) => {
            let pct = null;
            if (p.start_date && p.end_date) {
              const start = new Date(p.start_date).getTime();
              const end = new Date(p.end_date).getTime();
              const now = Date.now();
              if (end > start) pct = Math.max(2, Math.min(100, Math.round(((now - start) / (end - start)) * 100)));
            }
            return (
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
                  {pct !== null && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[10px] font-bold text-stone-400 uppercase tracking-wide mb-1">
                        <span>Est. timeline progress</span><span className="text-stone-600">{pct}%</span>
                      </div>
                      <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-700" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ============================================================ TOP VENDORS */
function TopVendorsPanel({ vendors, loading }) {
  return (
    <div className="bg-white border border-stone-200/70 rounded-2xl anim-fade-up overflow-hidden">
      <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
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
                  <div className="w-9 h-9 rounded-xl bg-stone-100 border border-stone-200 grid place-items-center overflow-hidden shrink-0">
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
