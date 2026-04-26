import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader, PageBody } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatINR, formatDate, todayISO } from "@/utils/format";
import {
  Users, UserCheck, ReceiptText, Wallet, AlertTriangle,
  ArrowUpRight, CalendarClock, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

const KPICard = ({ label, value, icon: Icon, color, sub, testid }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-shadow" data-testid={testid}>
    <div className="flex items-start gap-3">
      <div className={`w-12 h-12 rounded-xl grid place-items-center ${color}`}>
        <Icon className="w-5 h-5" strokeWidth={2.2} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-slate-500">{label}</div>
        <div className="font-display text-2xl font-bold tracking-tight mt-0.5 text-slate-900 truncate">{value}</div>
      </div>
    </div>
    {sub && <div className="text-xs text-slate-500 mt-3">{sub}</div>}
  </div>
);

export default function DashboardPage() {
  const { isAdmin } = useAuth();
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
      <PageHeader subtitle="Overview" title="Operations Dashboard" />
      <PageBody>
        {/* KPI grid */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <KPICard label="Total Leads" value={loading ? "—" : stats.leads} icon={Users} color="bg-blue-100 text-blue-700" testid="kpi-leads" />
          <KPICard label="Converted Leads" value={loading ? "—" : stats.converted} icon={UserCheck} color="bg-emerald-100 text-emerald-700" testid="kpi-converted" />
          <KPICard label="Total Customers" value={loading ? "—" : stats.customers} icon={UserCheck} color="bg-violet-100 text-violet-700" testid="kpi-customers" />
          <KPICard label="Receipts (Total)" value={loading ? "—" : formatINR(stats.receiptsSum)} icon={ReceiptText} color="bg-orange-100 text-orange-700" testid="kpi-receipts" />
          <KPICard label="Expenses (Total)" value={loading ? "—" : formatINR(stats.expensesSum)} icon={Wallet} color="bg-rose-100 text-rose-700" testid="kpi-expenses" />
        </div>

        {/* Pending Approvals banner */}
        {isAdmin && pendingApprovals > 0 && (
          <Link to="/approvals"
                className="mt-6 flex items-center justify-between bg-gradient-to-r from-orange-500 to-rose-500 text-white px-6 py-4 rounded-xl hover:shadow-lg hover:shadow-orange-500/30 transition-all group"
                data-testid="pending-approvals-banner">
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
        <div className="grid lg:grid-cols-3 gap-4 mt-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-orange-500" />
                <div className="label-uppercase">Today's Follow-ups</div>
              </div>
              <Link to="/leads" className="text-xs text-blue-700 hover:underline font-semibold" data-testid="link-all-leads">View all leads →</Link>
            </div>
            {loading ? (
              <div className="text-sm text-slate-500">Loading…</div>
            ) : todayFollowups.length === 0 && overdueFollowups.length === 0 ? (
              <div className="text-sm text-slate-500 py-12 text-center border border-dashed border-slate-300 rounded-lg">
                No follow-ups scheduled. Set a reminder on any lead to see it here.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr className="text-left">
                      <th className="px-3 py-2 label-uppercase">Lead</th>
                      <th className="px-3 py-2 label-uppercase">Phone</th>
                      <th className="px-3 py-2 label-uppercase">Status</th>
                      <th className="px-3 py-2 label-uppercase">Due</th>
                    </tr>
                  </thead>
                  <tbody className="grid-divider-y">
                    {todayFollowups.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50" data-testid={`followup-today-${l.id}`}>
                        <td className="px-3 py-2 font-medium">{l.name}</td>
                        <td className="px-3 py-2 text-slate-600">{l.phone}</td>
                        <td className="px-3 py-2"><StatusBadge status={l.status} /></td>
                        <td className="px-3 py-2"><span className="text-orange-600 font-medium">Today</span></td>
                      </tr>
                    ))}
                    {overdueFollowups.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50" data-testid={`followup-overdue-${l.id}`}>
                        <td className="px-3 py-2 font-medium">{l.name}</td>
                        <td className="px-3 py-2 text-slate-600">{l.phone}</td>
                        <td className="px-3 py-2"><StatusBadge status={l.status} /></td>
                        <td className="px-3 py-2"><span className="text-rose-600 font-medium">Overdue · {formatDate(l.next_followup_date)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-slate-500" />
              <div className="label-uppercase">Recent Activity</div>
            </div>
            {loading ? (
              <div className="text-sm text-slate-500">Loading…</div>
            ) : recentActivities.length === 0 ? (
              <div className="text-sm text-slate-500">No activity yet.</div>
            ) : (
              <ul className="space-y-3">
                {recentActivities.map((a, i) => (
                  <li key={`${a.type}-${a.id}-${i}`} className="border-l-2 border-slate-200 pl-3 hover:border-orange-500 transition-colors">
                    <div className="text-sm text-slate-900 font-medium">{a.label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
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
