import { useEffect, useState } from "react";
import { PageHeader, PageBody } from "@/components/layout/PageHeader";
import { fetchReportsData } from "@/services/reportService";
import { formatINR, formatDate } from "@/utils/format";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { TrendingUp, TrendingDown, Users, AlertTriangle } from "lucide-react";

const Stat = ({ label, value, tone = "slate" }) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
    <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">{label}</div>
    <div className={`text-xl font-bold mt-1 text-${tone}-700`}>{value}</div>
  </div>
);

export default function ReportsPage() {
  const { role } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { setData(await fetchReportsData()); }
      catch (e) { toast.error(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="p-16 text-center text-slate-400">Loading reports…</div>;
  if (!data) return <div className="p-16 text-center text-slate-400">Couldn't load report data.</div>;

  const { projectRows, rmRows, sourceRows, receivables, monthlyTrend, totals, scope } = data;
  const isAdmin = role === "admin";
  const isRM = role === "rm" || role === "manager";
  const title = isAdmin ? "Reports" : isRM ? "Team Reports" : "My Reports";
  const subtitle = isAdmin
    ? "Company-wide business performance across projects, revenue, expenses, and lead sources"
    : isRM
      ? "Your business scope and the performance of the REs managed by you"
      : "Your permitted business scope across leads, projects, collections, and expenses";

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <PageBody className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="label-uppercase">{scope === "company" ? "Company Scope" : scope === "team" ? "My Team Scope" : "My Scope"}</div>
          <div className="text-xs text-slate-400">Read-only report</div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Total Contract Value" value={formatINR(totals.contractValue)} tone="blue" />
          <Stat label="Total Collected" value={formatINR(totals.collected)} tone="emerald" />
          <Stat label="Total Spent" value={formatINR(totals.spent)} tone="rose" />
          <Stat label="Outstanding" value={formatINR(totals.outstanding)} tone="amber" />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="label-uppercase mb-3">Collections vs Expenses — Last 12 Months</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v) => formatINR(v)} />
              <Legend />
              <Bar dataKey="receipts" name="Receipts" fill="#1E3FAD" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#F97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {(isAdmin || isRM) && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="label-uppercase mb-3 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {isAdmin ? "Performance by Business Owner" : "My Team Performance"}</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-slate-400 uppercase border-b border-slate-100"><th className="pb-2">Owner</th><th className="pb-2 text-right">Projects</th><th className="pb-2 text-right">Contract Value</th><th className="pb-2 text-right">Collected</th><th className="pb-2 text-right">Spent</th><th className="pb-2 text-right">Cash Margin</th></tr></thead>
                <tbody>
                  {rmRows.map((r) => <tr key={r.rmId} className="border-b border-slate-50"><td className="py-2 font-medium text-slate-800">{r.rmName}</td><td className="py-2 text-right">{r.projects}</td><td className="py-2 text-right">{formatINR(r.contractValue)}</td><td className="py-2 text-right text-emerald-700">{formatINR(r.collected)}</td><td className="py-2 text-right text-rose-700">{formatINR(r.spent)}</td><td className={`py-2 text-right font-semibold ${r.netPL >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{r.netPL >= 0 ? <TrendingUp className="w-3.5 h-3.5 inline mr-1" /> : <TrendingDown className="w-3.5 h-3.5 inline mr-1" />}{formatINR(r.netPL)}</td></tr>)}
                  {rmRows.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-slate-400">No project data in this scope.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="label-uppercase mb-3">Project Performance</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-400 uppercase border-b border-slate-100"><th className="pb-2">Project</th><th className="pb-2">Owner</th><th className="pb-2 text-right">Contract</th><th className="pb-2 text-right">Collected</th><th className="pb-2 text-right">% Collected</th><th className="pb-2 text-right">Cash Margin</th></tr></thead>
              <tbody>
                {projectRows.map((p) => <tr key={p.id} className="border-b border-slate-50"><td className="py-2"><div className="font-medium text-slate-800">{p.name}</div><div className="text-xs text-slate-400">{p.customerName}</div></td><td className="py-2 text-slate-600">{p.ownerName || "Unassigned"}</td><td className="py-2 text-right">{formatINR(p.contractValue)}</td><td className="py-2 text-right">{formatINR(p.collected)}</td><td className="py-2 text-right">{p.pctCollected == null ? "—" : <span className={p.pctCollected >= 90 ? "text-emerald-700" : p.pctCollected >= 50 ? "text-amber-700" : "text-rose-700"}>{p.pctCollected}%</span>}</td><td className={`py-2 text-right font-semibold ${p.netCashMargin >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{formatINR(p.netCashMargin)}</td></tr>)}
                {projectRows.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-slate-400">No projects in your authorized scope.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="label-uppercase mb-3">Lead Source Conversion</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm"><thead><tr className="text-left text-xs text-slate-400 uppercase border-b border-slate-100"><th className="pb-2">Source</th><th className="pb-2 text-right">Total Leads</th><th className="pb-2 text-right">Converted</th><th className="pb-2 text-right">Lost</th><th className="pb-2 text-right">Conversion %</th></tr></thead><tbody>
              {sourceRows.map((s) => <tr key={s.source} className="border-b border-slate-50"><td className="py-2 font-medium text-slate-800">{s.source}</td><td className="py-2 text-right">{s.total}</td><td className="py-2 text-right text-emerald-700">{s.converted}</td><td className="py-2 text-right text-rose-600">{s.lost}</td><td className="py-2 text-right font-semibold">{s.conversionRate}%</td></tr>)}
              {sourceRows.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-slate-400">No lead data in your authorized scope.</td></tr>}
            </tbody></table>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="label-uppercase mb-3 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Outstanding Receivables</div>
          {receivables.length === 0 ? <div className="text-sm text-slate-400 py-4 text-center">Nothing outstanding in this scope.</div> : <div className="space-y-2">{receivables.map((r) => <div key={r.id} className="flex items-center justify-between border border-amber-100 bg-amber-50/50 rounded-lg px-3 py-2"><div><div className="font-medium text-slate-800 text-sm">{r.name}</div><div className="text-xs text-slate-400">{r.customerName} · {r.ownerName} · started {r.startDate ? formatDate(r.startDate) : "—"}</div></div><div className="text-right"><div className="font-bold text-amber-700">{formatINR(r.outstanding)}</div><div className="text-xs text-slate-400">of {formatINR(r.contractValue)}</div></div></div>)}</div>}
        </div>
      </PageBody>
    </>
  );
}
