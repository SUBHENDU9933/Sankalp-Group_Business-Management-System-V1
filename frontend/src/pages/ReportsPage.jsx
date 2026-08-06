import { useEffect, useState } from "react";
import { PageHeader, PageBody } from "@/components/layout/PageHeader";
import { fetchReportsData } from "@/services/reportService";
import { formatINR, formatDate } from "@/utils/format";
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

  const { projectRows, rmRows, sourceRows, receivables, monthlyTrend, totals } = data;

  return (
    <>
      <PageHeader title="Reports" subtitle="Business performance across projects, RMs, and lead sources" />
      <PageBody className="space-y-6">
        {/* Top-line stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Total Contract Value" value={formatINR(totals.contractValue)} tone="blue" />
          <Stat label="Total Collected" value={formatINR(totals.collected)} tone="emerald" />
          <Stat label="Total Spent" value={formatINR(totals.spent)} tone="rose" />
          <Stat label="Outstanding" value={formatINR(totals.outstanding)} tone="amber" />
        </div>

        {/* Monthly trend */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="label-uppercase mb-3">Revenue vs Expenses — Last 12 Months</div>
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

        {/* P/L by RM */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="label-uppercase mb-3 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> P/L by RM</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 uppercase border-b border-slate-100">
                  <th className="pb-2">RM</th>
                  <th className="pb-2 text-right">Projects</th>
                  <th className="pb-2 text-right">Contract Value</th>
                  <th className="pb-2 text-right">Collected</th>
                  <th className="pb-2 text-right">Spent</th>
                  <th className="pb-2 text-right">Net P/L</th>
                </tr>
              </thead>
              <tbody>
                {rmRows.map((r) => (
                  <tr key={r.rmId} className="border-b border-slate-50">
                    <td className="py-2 font-medium text-slate-800">{r.rmName}</td>
                    <td className="py-2 text-right">{r.projects}</td>
                    <td className="py-2 text-right">{formatINR(r.contractValue)}</td>
                    <td className="py-2 text-right text-emerald-700">{formatINR(r.collected)}</td>
                    <td className="py-2 text-right text-rose-700">{formatINR(r.spent)}</td>
                    <td className={`py-2 text-right font-semibold ${r.netPL >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                      {r.netPL >= 0 ? <TrendingUp className="w-3.5 h-3.5 inline mr-1" /> : <TrendingDown className="w-3.5 h-3.5 inline mr-1" />}
                      {formatINR(r.netPL)}
                    </td>
                  </tr>
                ))}
                {rmRows.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-slate-400">No projects yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* P/L by Project */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="label-uppercase mb-3">P/L by Project</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 uppercase border-b border-slate-100">
                  <th className="pb-2">Project</th>
                  <th className="pb-2">RM</th>
                  <th className="pb-2 text-right">Contract</th>
                  <th className="pb-2 text-right">Collected</th>
                  <th className="pb-2 text-right">% Collected</th>
                  <th className="pb-2 text-right">Net P/L</th>
                </tr>
              </thead>
              <tbody>
                {projectRows.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50">
                    <td className="py-2">
                      <div className="font-medium text-slate-800">{p.name}</div>
                      <div className="text-xs text-slate-400">{p.customerName}</div>
                    </td>
                    <td className="py-2 text-slate-600">{p.rmName}</td>
                    <td className="py-2 text-right">{formatINR(p.contractValue)}</td>
                    <td className="py-2 text-right">{formatINR(p.collected)}</td>
                    <td className="py-2 text-right">
                      {p.pctCollected == null ? "—" : (
                        <span className={p.pctCollected >= 90 ? "text-emerald-700" : p.pctCollected >= 50 ? "text-amber-700" : "text-rose-700"}>
                          {p.pctCollected}%
                        </span>
                      )}
                    </td>
                    <td className={`py-2 text-right font-semibold ${p.netPL >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{formatINR(p.netPL)}</td>
                  </tr>
                ))}
                {projectRows.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-slate-400">No projects yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Lead source conversion */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="label-uppercase mb-3">Lead Source Conversion</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 uppercase border-b border-slate-100">
                  <th className="pb-2">Source</th>
                  <th className="pb-2 text-right">Total Leads</th>
                  <th className="pb-2 text-right">Converted</th>
                  <th className="pb-2 text-right">Lost</th>
                  <th className="pb-2 text-right">Conversion %</th>
                </tr>
              </thead>
              <tbody>
                {sourceRows.map((s) => (
                  <tr key={s.source} className="border-b border-slate-50">
                    <td className="py-2 font-medium text-slate-800">{s.source}</td>
                    <td className="py-2 text-right">{s.total}</td>
                    <td className="py-2 text-right text-emerald-700">{s.converted}</td>
                    <td className="py-2 text-right text-rose-600">{s.lost}</td>
                    <td className="py-2 text-right font-semibold">{s.conversionRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Aging receivables */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="label-uppercase mb-3 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Outstanding Receivables</div>
          {receivables.length === 0 ? (
            <div className="text-sm text-slate-400 py-4 text-center">Nothing outstanding — all projects fully collected.</div>
          ) : (
            <div className="space-y-2">
              {receivables.map((r) => (
                <div key={r.id} className="flex items-center justify-between border border-amber-100 bg-amber-50/50 rounded-lg px-3 py-2">
                  <div>
                    <div className="font-medium text-slate-800 text-sm">{r.name}</div>
                    <div className="text-xs text-slate-400">{r.customerName} · {r.rmName} · started {r.startDate ? formatDate(r.startDate) : "—"}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-amber-700">{formatINR(r.outstanding)}</div>
                    <div className="text-xs text-slate-400">of {formatINR(r.contractValue)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PageBody>
    </>
  );
}
