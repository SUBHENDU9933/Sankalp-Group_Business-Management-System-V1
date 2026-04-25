import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader, PageBody } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatINR, formatDate, todayISO } from "@/utils/format";
import {
  Users, UserCheck, ReceiptText, Hammer, Wallet, AlertTriangle,
  ArrowUpRight, CalendarClock, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

const KPICard = ({ label, value, icon: Icon, accent, sub, testid }) => (
  <div className="bg-white border border-stone-200 p-6 group hover:border-stone-400 transition-colors" data-testid={testid}>
    <div className="flex items-start justify-between">
      <div className="label-uppercase">{label}</div>
      <Icon className={cn("w-4 h-4", accent ? "text-orange-500" : "text-stone-400")} />
    </div>
    <div className="font-display text-4xl font-bold tracking-tight mt-3 text-stone-900">{value}</div>
    {sub && <div className="text-xs text-stone-500 mt-2">{sub}</div>}
  </div>
);

export default function DashboardPage() {
  const { profile, isAdmin } = useAuth();
  const [stats, setStats] = useState({
    leads: 0, converted: 0, customers: 0, receiptsSum: 0, expensesSum: 0,
  });
  const [todayFollowups, setTodayFollowups] = useState([]);
  const [overdueFollowups, setOverdueFollowups] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const today = todayISO();
        const [leadCnt, convCnt, custCnt, recAgg, expAgg, todayList, overdueList, recentLeads, recentRcpts, pendingLeads, pendingCustomers] = await Promise.all([
          supabase.from("leads").select("id", { count: "exact", head: true }),
          supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "converted"),
          supabase.from("customers").select("id", { count: "exact", head: true }),
          supabase.from("receipts").select("amount"),
          supabase.from("expenses").select("amount"),
          supabase.from("leads").select("id,name,phone,status,next_followup_date,reminder_note").eq("next_followup_date", today).limit(20),
          supabase.from("leads").select("id,name,phone,status,next_followup_date,reminder_note").lt("next_followup_date", today).not("status","in","(converted,lost)").limit(20),
          supabase.from("leads").select("id,name,status,created_at").order("created_at", { ascending: false }).limit(5),
          supabase.from("receipts").select("id,receipt_no,amount,created_at,customer:customers(name)").order("created_at", { ascending: false }).limit(5),
          supabase.from("leads").select("id", { count: "exact", head: true }).eq("delete_request", true),
          supabase.from("customers").select("id", { count: "exact", head: true }).eq("delete_request", true),
        ]);
        if (!active) return;
        setStats({
          leads: leadCnt.count || 0,
          converted: convCnt.count || 0,
          customers: custCnt.count || 0,
          receiptsSum: (recAgg.data || []).reduce((s, r) => s + Number(r.amount || 0), 0),
          expensesSum: (expAgg.data || []).reduce((s, r) => s + Number(r.amount || 0), 0),
        });
        setTodayFollowups(todayList.data || []);
        setOverdueFollowups(overdueList.data || []);
        const acts = [
          ...(recentLeads.data || []).map((l) => ({ type: "lead", id: l.id, label: `New Lead: ${l.name}`, status: l.status, at: l.created_at })),
          ...(recentRcpts.data || []).map((r) => ({ type: "receipt", id: r.id, label: `Receipt ${r.receipt_no} — ${r.customer?.name || ""}`, amount: r.amount, at: r.created_at })),
        ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 8);
        setRecentActivities(acts);
        setPendingApprovals((pendingLeads.count || 0) + (pendingCustomers.count || 0));
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, []);

  return (
    <div data-testid="dashboard-page">
      <PageHeader
        subtitle={`Hello, ${profile?.full_name?.split(" ")[0] || "there"}`}
        title="Operations Dashboard"
      />
      <PageBody>
        {/* KPI grid */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-0 grid-divider-x border border-stone-200 bg-stone-200">
          <div className="bg-white"><KPICard label="Total Leads" value={loading ? "—" : stats.leads} icon={Users} testid="kpi-leads" /></div>
          <div className="bg-white"><KPICard label="Converted" value={loading ? "—" : stats.converted} icon={UserCheck} accent testid="kpi-converted" /></div>
          <div className="bg-white"><KPICard label="Customers" value={loading ? "—" : stats.customers} icon={UserCheck} testid="kpi-customers" /></div>
          <div className="bg-white"><KPICard label="Receipts (Total)" value={loading ? "—" : formatINR(stats.receiptsSum)} icon={ReceiptText} testid="kpi-receipts" /></div>
          <div className="bg-white"><KPICard label="Expenses (Total)" value={loading ? "—" : formatINR(stats.expensesSum)} icon={Wallet} testid="kpi-expenses" /></div>
        </div>

        {/* Pending Approvals banner */}
        {isAdmin && pendingApprovals > 0 && (
          <Link
            to="/approvals"
            className="mt-6 flex items-center justify-between bg-orange-500 text-white px-6 py-4 hover:bg-orange-600 transition-colors group"
            data-testid="pending-approvals-banner"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5" />
              <div>
                <div className="label-uppercase text-orange-100">Action required</div>
                <div className="font-display text-lg leading-tight">{pendingApprovals} delete request{pendingApprovals > 1 ? "s" : ""} awaiting your approval</div>
              </div>
            </div>
            <ArrowUpRight className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
          </Link>
        )}

        {/* Followups + activities */}
        <div className="grid lg:grid-cols-3 gap-0 mt-8 border border-stone-200 bg-stone-200 grid-divider-x">
          {/* Today */}
          <div className="bg-white p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-orange-500" />
                <div className="label-uppercase">Today's Follow-ups</div>
              </div>
              <Link to="/leads" className="text-xs text-stone-500 hover:text-stone-900 underline underline-offset-4" data-testid="link-all-leads">View all leads →</Link>
            </div>
            {loading ? (
              <div className="text-sm text-stone-500">Loading…</div>
            ) : todayFollowups.length === 0 && overdueFollowups.length === 0 ? (
              <div className="text-sm text-stone-500 py-12 text-center border border-dashed border-stone-300">
                No follow-ups scheduled. Set a reminder on any lead to see it here.
              </div>
            ) : (
              <div className="border border-stone-200">
                <table className="w-full text-sm">
                  <thead className="bg-stone-50 border-b border-stone-200">
                    <tr className="text-left">
                      <th className="px-3 py-2 label-uppercase">Lead</th>
                      <th className="px-3 py-2 label-uppercase">Phone</th>
                      <th className="px-3 py-2 label-uppercase">Status</th>
                      <th className="px-3 py-2 label-uppercase">Due</th>
                    </tr>
                  </thead>
                  <tbody className="grid-divider-y">
                    {todayFollowups.map((l) => (
                      <tr key={l.id} className="hover:bg-stone-50 transition-colors" data-testid={`followup-today-${l.id}`}>
                        <td className="px-3 py-2 font-medium">{l.name}</td>
                        <td className="px-3 py-2 text-stone-600">{l.phone}</td>
                        <td className="px-3 py-2"><StatusBadge status={l.status} /></td>
                        <td className="px-3 py-2"><span className="text-orange-600 font-medium">Today</span></td>
                      </tr>
                    ))}
                    {overdueFollowups.map((l) => (
                      <tr key={l.id} className="hover:bg-stone-50 transition-colors" data-testid={`followup-overdue-${l.id}`}>
                        <td className="px-3 py-2 font-medium">{l.name}</td>
                        <td className="px-3 py-2 text-stone-600">{l.phone}</td>
                        <td className="px-3 py-2"><StatusBadge status={l.status} /></td>
                        <td className="px-3 py-2"><span className="text-rose-600 font-medium">Overdue · {formatDate(l.next_followup_date)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="bg-white p-6">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-stone-500" />
              <div className="label-uppercase">Recent Activity</div>
            </div>
            {loading ? (
              <div className="text-sm text-stone-500">Loading…</div>
            ) : recentActivities.length === 0 ? (
              <div className="text-sm text-stone-500">No activity yet.</div>
            ) : (
              <ul className="space-y-3">
                {recentActivities.map((a, i) => (
                  <li key={`${a.type}-${a.id}-${i}`} className="border-l-2 border-stone-300 pl-3 hover:border-orange-500 transition-colors">
                    <div className="text-sm text-stone-900 font-medium">{a.label}</div>
                    <div className="text-xs text-stone-500 mt-0.5">
                      {a.type === "receipt" && a.amount ? <>{formatINR(a.amount)} · </> : null}
                      {formatDate(a.at)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </PageBody>
    </div>
  );
}
