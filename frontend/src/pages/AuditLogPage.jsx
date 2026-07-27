import { useEffect, useMemo, useState } from "react";
import { PageHeader, PageBody } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X, Activity, Download, ChevronDown, ChevronRight, ShieldCheck } from "lucide-react";
import { fetchAuditLog } from "@/services/auditService";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { formatDateTime } from "@/utils/format";
import { cn } from "@/lib/utils";

const ACTION_STYLES = {
  create:      { label: "CREATE",      cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  update:      { label: "UPDATE",      cls: "bg-blue-100    text-blue-800    border-blue-300" },
  soft_delete: { label: "SOFT-DELETE", cls: "bg-orange-100  text-orange-800  border-orange-300" },
  restore:     { label: "RESTORE",     cls: "bg-teal-100    text-teal-800    border-teal-300" },
  delete:      { label: "PURGE",       cls: "bg-rose-100    text-rose-800    border-rose-300" },
  purge:       { label: "PURGE",       cls: "bg-rose-100    text-rose-800    border-rose-300" },
};
const ACTION_KEYS = Object.keys(ACTION_STYLES);
const ENTITY_TYPES = [
  "leads","customers","projects","vendors","estimates","receipts","expenses","vendor_payments","digital_approvals",
];

export default function AuditLogPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [actorId, setActorId] = useState("all");
  const [entityType, setEntityType] = useState("all");
  const [action, setAction] = useState("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchAuditLog({ from: from ? new Date(from).toISOString() : null,
        to: to ? new Date(new Date(to).setHours(23,59,59,999)).toISOString() : null,
        actorId, entityType, action, search });
      setRows(data);
    } catch (e) {
      if (/audit_log|does not exist/i.test(e.message)) {
        toast.error("Audit log requires schema v14 — apply supabase_schema_v14.sql");
      } else { toast.error(e.message); }
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-line */ }, [from, to, actorId, entityType, action, search]);

  useEffect(() => {
    supabase.from("profiles").select("id, full_name, email, role").order("full_name").then(({ data }) => setProfiles(data || []));
  }, []);

  const clearFilters = () => { setFrom(""); setTo(""); setActorId("all"); setEntityType("all"); setAction("all"); setSearch(""); };
  const hasFilters = from || to || actorId !== "all" || entityType !== "all" || action !== "all" || search;

  const exportCSV = () => {
    if (!rows.length) { toast.info("Nothing to export"); return; }
    const headers = ["Time","Action","Entity","Entity ID","Label","Actor Name","Actor Email","Actor Role","Changes"];
    const csv = [headers, ...rows.map((r) => [
      formatDateTime(r.created_at), r.action, r.entity_type, r.entity_id || "", r.entity_label || "",
      r.actor_name || "", r.actor_email || "", r.actor_role || "", JSON.stringify(r.changes || {})
    ])].map((row) => row.map((c) => {
      const s = String(c ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `audit-log-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div data-testid="audit-log-page">
      <PageHeader
        title="Audit Log"
        subtitle="Every create / update / delete recorded permanently. Cannot be edited or deleted."
        actions={<Button variant="outline" onClick={exportCSV} className="rounded-none border-stone-300 hover:bg-stone-100 h-9 text-xs font-semibold" data-testid="audit-export"><Download className="w-3.5 h-3.5 mr-1" />Export CSV</Button>}
      />
      <PageBody>
        <div className="bg-white border border-stone-200 grid grid-cols-1 md:grid-cols-6 gap-0 grid-divider-x">
          <div className="px-4 py-2 md:col-span-2 flex items-center gap-2">
            <Search className="w-4 h-4 text-stone-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search label / user / action…" className="border-0 shadow-none focus-visible:ring-0 px-0 rounded-none h-8" data-testid="audit-search" />
            {hasFilters && <Button variant="ghost" size="sm" onClick={clearFilters} className="rounded-none text-xs h-7"><X className="w-3 h-3 mr-1" /> Clear</Button>}
          </div>
          <div className="px-4 py-2">
            <div className="text-[10px] tracking-[0.15em] uppercase font-semibold text-stone-500">User</div>
            <Select value={actorId} onValueChange={setActorId}>
              <SelectTrigger className="rounded-none border-0 shadow-none focus:ring-0 h-8 px-0 bg-transparent" data-testid="audit-user-filter"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-none max-h-[300px]">
                <SelectItem value="all" className="rounded-none">All Users</SelectItem>
                {profiles.map((p) => <SelectItem key={p.id} value={p.id} className="rounded-none">{p.full_name || p.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="px-4 py-2">
            <div className="text-[10px] tracking-[0.15em] uppercase font-semibold text-stone-500">Entity</div>
            <Select value={entityType} onValueChange={setEntityType}>
              <SelectTrigger className="rounded-none border-0 shadow-none focus:ring-0 h-8 px-0 bg-transparent" data-testid="audit-entity-filter"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-none">
                <SelectItem value="all" className="rounded-none">All Entities</SelectItem>
                {ENTITY_TYPES.map((t) => <SelectItem key={t} value={t} className="rounded-none">{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="px-4 py-2">
            <div className="text-[10px] tracking-[0.15em] uppercase font-semibold text-stone-500">Action</div>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="rounded-none border-0 shadow-none focus:ring-0 h-8 px-0 bg-transparent" data-testid="audit-action-filter"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-none">
                <SelectItem value="all" className="rounded-none">All Actions</SelectItem>
                {ACTION_KEYS.map((k) => <SelectItem key={k} value={k} className="rounded-none">{ACTION_STYLES[k].label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="px-4 py-2">
            <div className="text-[10px] tracking-[0.15em] uppercase font-semibold text-stone-500">Date</div>
            <div className="flex gap-1">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-none border-0 shadow-none focus-visible:ring-0 px-0 h-8 text-xs" data-testid="audit-from" />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-none border-0 shadow-none focus-visible:ring-0 px-0 h-8 text-xs" data-testid="audit-to" />
            </div>
          </div>
        </div>

        <div className="mt-4">
          {loading ? (
            <div className="bg-white border border-stone-200 p-8 text-center text-sm text-stone-500">Loading audit log…</div>
          ) : rows.length === 0 ? (
            <div className="bg-white border border-stone-200 p-12 text-center text-sm text-stone-500" data-testid="audit-empty">
              <Activity className="w-8 h-8 text-stone-300 mx-auto mb-2" /> No audit entries match your filters.
            </div>
          ) : (
            <div className="bg-white border border-stone-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr className="text-left">
                    <th className="px-3 py-3 label-uppercase w-8"></th>
                    <th className="px-4 py-3 label-uppercase">Time</th>
                    <th className="px-4 py-3 label-uppercase">Action</th>
                    <th className="px-4 py-3 label-uppercase">Entity</th>
                    <th className="px-4 py-3 label-uppercase">Label</th>
                    <th className="px-4 py-3 label-uppercase">Actor</th>
                  </tr>
                </thead>
                <tbody className="grid-divider-y">
                  {rows.map((r) => {
                    const style = ACTION_STYLES[r.action] || ACTION_STYLES.update;
                    const isExpanded = expanded[r.id];
                    const hasChanges = r.changes && Object.keys(r.changes).length > 0;
                    return (
                      <>
                        <tr key={r.id} className={cn("hover:bg-stone-50 cursor-pointer", isExpanded && "bg-stone-50")} onClick={() => setExpanded((p) => ({ ...p, [r.id]: !p[r.id] }))} data-testid={`audit-row-${r.id}`}>
                          <td className="px-3 py-3">{hasChanges ? (isExpanded ? <ChevronDown className="w-4 h-4 text-stone-400" /> : <ChevronRight className="w-4 h-4 text-stone-400" />) : null}</td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap font-mono">{formatDateTime(r.created_at)}</td>
                          <td className="px-4 py-3"><span className={cn("inline-flex items-center px-2 py-0.5 text-[10px] tracking-widest border font-bold", style.cls)}>{style.label}</span></td>
                          <td className="px-4 py-3 text-stone-700 text-xs font-mono">{r.entity_type}</td>
                          <td className="px-4 py-3 font-medium text-stone-900">{r.entity_label || <span className="text-stone-400 font-mono">{r.entity_id?.slice(0, 8) || "—"}</span>}</td>
                          <td className="px-4 py-3">
                            <div className="text-xs font-medium text-stone-900">{r.actor_name || r.actor_email || "System"}</div>
                            <div className="text-[10px] text-stone-500">{r.actor_role || "—"}</div>
                          </td>
                        </tr>
                        {isExpanded && hasChanges && (
                          <tr key={r.id + "-expand"} className="bg-stone-50">
                            <td></td>
                            <td colSpan={5} className="px-4 py-4">
                              <div className="text-[10px] tracking-[0.15em] uppercase font-semibold text-stone-500 mb-2">Changes</div>
                              <pre className="text-[11px] bg-white border border-stone-200 p-3 overflow-x-auto max-h-64 font-mono">{JSON.stringify(r.changes, null, 2)}</pre>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
              {rows.length >= 1000 && (
                <div className="bg-amber-50 border-t border-amber-200 px-4 py-2 text-xs text-amber-800">
                  Showing latest 1000 entries. Narrow filters to see older records.
                </div>
              )}
            </div>
          )}
        </div>
      </PageBody>
    </div>
  );
}
