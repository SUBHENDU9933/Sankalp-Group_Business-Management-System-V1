import { useEffect, useMemo, useState } from "react";
import { PageHeader, PageBody } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/shared/StatusBadge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Plus, Search, MoreVertical, Eye, Pencil, Copy, Trash2, FileText, Calculator, X,
} from "lucide-react";
import {
  fetchEstimates, deleteEstimate, duplicateEstimate, updateEstimateStatus, buildEstimatorUrl,
} from "@/services/estimateService";
import { useAuth } from "@/contexts/AuthContext";
import { formatINR, formatDateTime } from "@/utils/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUS_META = {
  draft:    { label: "Draft",    cls: "bg-stone-100 text-stone-900 border-stone-300" },
  sent:     { label: "Sent",     cls: "bg-blue-50 text-blue-900 border-blue-300" },
  approved: { label: "Approved", cls: "bg-emerald-50 text-emerald-900 border-emerald-400" },
  rejected: { label: "Rejected", cls: "bg-rose-50 text-rose-900 border-rose-300" },
};

export default function EstimatesPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createdByFilter, setCreatedByFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      setRows(await fetchEstimates());
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const creators = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      if (r.creator?.id) map.set(r.creator.id, r.creator.full_name || r.creator.email || "Unknown");
    });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (createdByFilter !== "all" && r.creator?.id !== createdByFilter) return false;
      if (dateFrom && new Date(r.created_at) < new Date(`${dateFrom}T00:00:00`)) return false;
      if (dateTo && new Date(r.created_at) > new Date(`${dateTo}T23:59:59`)) return false;
      if (search) {
        const s = search.toLowerCase();
        const hay = [r.estimate_no, r.customer_name, r.phone, r.lead?.name].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [rows, search, statusFilter, createdByFilter, dateFrom, dateTo]);

  const clearFilters = () => { setSearch(""); setStatusFilter("all"); setCreatedByFilter("all"); setDateFrom(""); setDateTo(""); };
  const hasActiveFilters = search || statusFilter !== "all" || createdByFilter !== "all" || dateFrom || dateTo;

  const stats = useMemo(() => {
    const total = rows.length;
    const byStatus = (k) => rows.filter((r) => r.status === k).length;
    const totalValue = rows.reduce((s, r) => s + (Number(r.final_amount) || 0), 0);
    return {
      total,
      draft: byStatus("draft"),
      sent: byStatus("sent"),
      approved: byStatus("approved"),
      rejected: byStatus("rejected"),
      totalValue,
    };
  }, [rows]);

  const openEditor = (estimateId) => {
    window.location.href = buildEstimatorUrl({ estimateId });
  };
  const openNew = () => {
    window.location.href = buildEstimatorUrl({});
  };
  const handleDelete = async (e) => {
    if (!window.confirm(`Delete estimate ${e.estimate_no}? This cannot be undone.`)) return;
    try { await deleteEstimate(e.id, user?.id); toast.success("Moved to Trash"); load(); }
    catch (err) { toast.error(err.message); }
  };
  const handleDuplicate = async (e) => {
    try {
      const dup = await duplicateEstimate(e, user.id);
      toast.success(`Duplicated as ${dup.estimate_no}`);
      load();
    } catch (err) { toast.error(err.message); }
  };
  const handleStatus = async (e, status) => {
    try { await updateEstimateStatus(e.id, status); toast.success(`Status: ${STATUS_META[status].label}`); load(); }
    catch (err) { toast.error(err.message); }
  };

  return (
    <div data-testid="estimates-page">
      <PageHeader
        subtitle="Phase 7"
        title="Estimate Management"
        actions={
          <Button onClick={openNew} className="rounded-none bg-orange-500 hover:bg-orange-600 text-white" data-testid="estimate-new-button">
            <Plus className="w-4 h-4" /> New Estimate
          </Button>
        }
      />
      <PageBody>
        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="estimate-kpis">
          <Kpi label="Total Estimates" value={stats.total} accent="text-stone-900" />
          <Kpi label="Draft" value={stats.draft} accent="text-stone-700" />
          <Kpi label="Sent" value={stats.sent} accent="text-blue-700" />
          <Kpi label="Approved" value={stats.approved} accent="text-emerald-700" />
          <Kpi label="Rejected" value={stats.rejected} accent="text-rose-700" />
          <Kpi label="Total Value" value={formatINR(stats.totalValue)} accent="text-stone-900" />
        </div>

        {/* Toolbar */}
        <div className="mt-5 bg-white border border-stone-200 grid grid-cols-1 lg:grid-cols-[1fr_auto_auto_auto_auto_auto] gap-0 grid-divider-x">
          <div className="flex items-center gap-2 px-4 py-3">
            <Search className="w-4 h-4 text-stone-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by estimate no, client, phone…"
              className="border-0 shadow-none focus-visible:ring-0 px-0 rounded-none h-8"
              data-testid="estimates-search"
            />
          </div>
          <div className="px-4 py-3 flex items-center gap-2">
            <span className="label-uppercase">Status</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="rounded-none w-[140px] border-stone-300 h-9" data-testid="estimates-status-filter"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-none">
                <SelectItem value="all" className="rounded-none">All</SelectItem>
                {Object.entries(STATUS_META).map(([k, v]) => (
                  <SelectItem key={k} value={k} className="rounded-none">{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="px-4 py-3 flex items-center gap-2">
            <span className="label-uppercase">Created By</span>
            <Select value={createdByFilter} onValueChange={setCreatedByFilter}>
              <SelectTrigger className="rounded-none w-[150px] border-stone-300 h-9" data-testid="estimates-createdby-filter"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-none">
                <SelectItem value="all" className="rounded-none">All</SelectItem>
                {creators.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="rounded-none">{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="px-4 py-3 flex items-center gap-2">
            <span className="label-uppercase">From</span>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-none border-stone-300 h-9 w-[145px]" data-testid="estimates-date-from" />
          </div>
          <div className="px-4 py-3 flex items-center gap-2">
            <span className="label-uppercase">To</span>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-none border-stone-300 h-9 w-[145px]" data-testid="estimates-date-to" />
          </div>
          {hasActiveFilters && (
            <div className="px-4 py-3 flex items-center">
              <Button variant="ghost" size="sm" onClick={clearFilters} className="rounded-none text-stone-500 hover:text-rose-600" data-testid="estimates-clear-filters">
                <X className="w-3.5 h-3.5 mr-1" /> Clear
              </Button>
            </div>
          )}
        </div>

        {!loading && <div className="text-xs text-stone-400 mt-2">{filtered.length} of {rows.length} estimates</div>}

        {/* Table */}
        <div className="mt-5">
          {loading ? (
            <div className="bg-white border border-stone-200 p-12 text-center text-sm text-stone-500">Loading estimates…</div>
          ) : filtered.length === 0 ? (
            <div className="bg-white border border-stone-200 p-12 text-center" data-testid="estimates-empty">
              <Calculator className="w-10 h-10 text-stone-300 mx-auto mb-3" />
              <div className="font-display text-xl font-bold tracking-tight text-stone-900">No estimates yet</div>
              <p className="text-sm text-stone-500 mt-2">{rows.length === 0 ? "Create your first estimate to start tracking quotations." : "No estimates match the filters."}</p>
              {rows.length === 0 && (
                <Button onClick={openNew} className="mt-4 rounded-none bg-stone-900 hover:bg-stone-800 text-white">
                  <Plus className="w-4 h-4" /> Create Estimate
                </Button>
              )}
            </div>
          ) : (
            <div className="bg-white border border-stone-200 overflow-x-auto">
              <table className="w-full text-sm" data-testid="estimates-table">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr className="text-left">
                    <th className="px-4 py-3 label-uppercase">Estimate No</th>
                    <th className="px-4 py-3 label-uppercase">Client</th>
                    <th className="px-4 py-3 label-uppercase">Linked Lead</th>
                    <th className="px-4 py-3 label-uppercase">Date</th>
                    <th className="px-4 py-3 label-uppercase text-right">Amount</th>
                    <th className="px-4 py-3 label-uppercase">Status</th>
                    <th className="px-4 py-3 label-uppercase">Created By</th>
                    <th className="px-4 py-3 label-uppercase text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="grid-divider-y">
                  {filtered.map((e) => {
                    const s = STATUS_META[e.status] || STATUS_META.draft;
                    return (
                      <tr key={e.id} className="hover:bg-stone-50 transition-colors" data-testid={`estimate-row-${e.id}`}>
                        <td className="px-4 py-3 font-mono text-xs text-stone-900">{e.estimate_no}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-stone-900">{e.customer_name || "—"}</div>
                          {e.phone && <div className="text-xs text-stone-500">{e.phone}</div>}
                        </td>
                        <td className="px-4 py-3 text-stone-700">{e.lead?.name || <span className="text-stone-400">—</span>}</td>
                        <td className="px-4 py-3 text-stone-700 whitespace-nowrap">{formatDateTime(e.created_at)}</td>
                        <td className="px-4 py-3 text-stone-900 text-right tabular-nums">{formatINR(e.final_amount)}</td>
                        <td className="px-4 py-3">
                          <Chip className={cn(s.cls)}>{s.label}</Chip>
                        </td>
                        <td className="px-4 py-3 text-stone-700">{e.creator?.full_name || e.creator?.email || <span className="text-stone-400">—</span>}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end items-center gap-1">
                            <button onClick={() => openEditor(e.id)} title="View / Edit" className="p-1.5 hover:bg-stone-100 text-stone-600 hover:text-stone-900" data-testid={`estimate-view-${e.id}`}><Eye className="w-4 h-4" /></button>
                            <button onClick={() => openEditor(e.id)} title="Edit" className="p-1.5 hover:bg-stone-100 text-stone-600 hover:text-stone-900" data-testid={`estimate-edit-${e.id}`}><Pencil className="w-4 h-4" /></button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="rounded-none h-8 w-8 hover:bg-stone-100" data-testid={`estimate-actions-${e.id}`}><MoreVertical className="w-4 h-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="rounded-none border-stone-300">
                                <DropdownMenuItem className="rounded-none cursor-pointer" onClick={() => openEditor(e.id)}>
                                  <FileText className="w-4 h-4 mr-2" />Open Editor (PDF)
                                </DropdownMenuItem>
                                <DropdownMenuItem className="rounded-none cursor-pointer" onClick={() => handleDuplicate(e)}>
                                  <Copy className="w-4 h-4 mr-2" />Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <div className="px-2 py-1 label-uppercase">Set Status</div>
                                {Object.entries(STATUS_META).map(([k, v]) => (
                                  <DropdownMenuItem key={k} className="rounded-none cursor-pointer" disabled={e.status === k} onClick={() => handleStatus(e, k)}>
                                    {v.label}
                                  </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="rounded-none cursor-pointer text-rose-600" onClick={() => handleDelete(e)} data-testid={`estimate-delete-${e.id}`}>
                                  <Trash2 className="w-4 h-4 mr-2" />Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </PageBody>
    </div>
  );
}

function Kpi({ label, value, accent }) {
  return (
    <div className="bg-white border border-stone-200 px-4 py-3" data-testid={`estimate-kpi-${String(label).toLowerCase().replace(/ /g,'-')}`}>
      <div className="text-[10px] tracking-[0.12em] uppercase font-semibold text-stone-500">{label}</div>
      <div className={cn("font-display text-xl tabular-nums truncate mt-0.5", accent)}>{value}</div>
    </div>
  );
}
