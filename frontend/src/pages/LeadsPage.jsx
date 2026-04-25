import { useEffect, useMemo, useState } from "react";
import { PageHeader, PageBody } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge, Chip } from "@/components/shared/StatusBadge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Plus, Search, MoreVertical, Pencil, ArrowRightCircle, Trash2, X,
  KanbanSquare, Table as TableIcon, Phone,
} from "lucide-react";
import {
  fetchLeads, updateLeadStatus, requestDelete, cancelDeleteRequest, convertLeadToCustomer,
} from "@/services/leadService";
import { useAuth } from "@/contexts/AuthContext";
import { LEAD_STATUSES, formatDate, formatINR, isOverdue, isToday } from "@/utils/format";
import LeadFormDialog from "@/components/leads/LeadFormDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

export default function LeadsPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [view, setView] = useState("table");
  const [formOpen, setFormOpen] = useState(false);
  const [editLead, setEditLead] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const d = await fetchLeads();
      setLeads(d);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          (l.name || "").toLowerCase().includes(s) ||
          (l.phone || "").includes(s) ||
          (l.location || "").toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [leads, search, statusFilter]);

  const handleStatusChange = async (lead, status) => {
    try {
      await updateLeadStatus(lead.id, status);
      toast.success(`Status updated to ${status.replace("_", " ")}`);
      load();
    } catch (e) { toast.error(e.message); }
  };

  const handleConvert = async (lead) => {
    if (lead.is_locked || lead.status === "converted") return;
    if (!window.confirm(`Convert "${lead.name}" to a customer? This will lock the lead.`)) return;
    try {
      const c = await convertLeadToCustomer(lead, user.id);
      toast.success("Converted to customer");
      load();
      nav("/customers");
    } catch (e) { toast.error(e.message); }
  };

  const handleRequestDelete = async (lead) => {
    if (!window.confirm("Request admin to delete this lead?")) return;
    try {
      await requestDelete(lead.id, user.id);
      toast.success("Delete request sent for admin approval");
      load();
    } catch (e) { toast.error(e.message); }
  };

  const handleCancelDelete = async (lead) => {
    try {
      await cancelDeleteRequest(lead.id);
      toast.success("Delete request cancelled");
      load();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div data-testid="leads-page">
      <PageHeader
        subtitle="Phase 2"
        title="Lead Management"
        actions={
          <Button onClick={() => { setEditLead(null); setFormOpen(true); }} className="rounded-none bg-orange-500 hover:bg-orange-600 text-white" data-testid="lead-add-button">
            <Plus className="w-4 h-4" /> New Lead
          </Button>
        }
      />

      <PageBody>
        {/* Toolbar */}
        <div className="bg-white border border-stone-200 grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-0 grid-divider-x">
          <div className="flex items-center gap-2 px-4 py-3">
            <Search className="w-4 h-4 text-stone-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone, location…"
              className="border-0 shadow-none focus-visible:ring-0 px-0 rounded-none h-8"
              data-testid="leads-search-input"
            />
          </div>
          <div className="px-4 py-3 flex items-center gap-2">
            <span className="label-uppercase">Status</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="rounded-none w-[180px] border-stone-300 h-9" data-testid="leads-status-filter"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-none">
                <SelectItem value="all" className="rounded-none">All</SelectItem>
                {LEAD_STATUSES.map((s) => (
                  <SelectItem key={s.key} value={s.key} className="rounded-none">{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="px-4 py-3 flex items-center">
            <Tabs value={view} onValueChange={setView}>
              <TabsList className="rounded-none bg-stone-100 p-0 h-9 border border-stone-300">
                <TabsTrigger value="table" className="rounded-none data-[state=active]:bg-stone-900 data-[state=active]:text-white px-3" data-testid="view-table"><TableIcon className="w-4 h-4 mr-1" />Table</TabsTrigger>
                <TabsTrigger value="kanban" className="rounded-none data-[state=active]:bg-stone-900 data-[state=active]:text-white px-3" data-testid="view-kanban"><KanbanSquare className="w-4 h-4 mr-1" />Pipeline</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Counts */}
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip>Total: {filtered.length}</Chip>
          {LEAD_STATUSES.map((s) => {
            const c = filtered.filter((l) => l.status === s.key).length;
            return c > 0 ? <Chip key={s.key} className={s.color}>{s.label}: {c}</Chip> : null;
          })}
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="bg-white border border-stone-200 p-12 text-center text-sm text-stone-500">Loading leads…</div>
          ) : filtered.length === 0 ? (
            <div className="bg-white border border-stone-200 p-12 text-center" data-testid="leads-empty">
              <div className="font-display text-xl font-bold tracking-tight text-stone-900">No leads found</div>
              <p className="text-sm text-stone-500 mt-2">Add your first lead to start tracking enquiries.</p>
              <Button onClick={() => setFormOpen(true)} className="mt-4 rounded-none bg-stone-900 hover:bg-stone-800 text-white">
                <Plus className="w-4 h-4" /> Create Lead
              </Button>
            </div>
          ) : view === "table" ? (
            <LeadTable
              leads={filtered}
              onEdit={(l) => { setEditLead(l); setFormOpen(true); }}
              onStatusChange={handleStatusChange}
              onConvert={handleConvert}
              onRequestDelete={handleRequestDelete}
              onCancelDelete={handleCancelDelete}
            />
          ) : (
            <LeadKanban
              leads={filtered}
              onStatusChange={handleStatusChange}
              onEdit={(l) => { setEditLead(l); setFormOpen(true); }}
              onConvert={handleConvert}
            />
          )}
        </div>
      </PageBody>

      <LeadFormDialog open={formOpen} onOpenChange={setFormOpen} lead={editLead} onSaved={load} />
    </div>
  );
}

function LeadTable({ leads, onEdit, onStatusChange, onConvert, onRequestDelete, onCancelDelete }) {
  return (
    <div className="bg-white border border-stone-200 overflow-x-auto">
      <table className="w-full text-sm" data-testid="leads-table">
        <thead className="bg-stone-50 border-b border-stone-200">
          <tr className="text-left">
            <th className="px-4 py-3 label-uppercase">Name</th>
            <th className="px-4 py-3 label-uppercase">Phone</th>
            <th className="px-4 py-3 label-uppercase">Project</th>
            <th className="px-4 py-3 label-uppercase">Budget</th>
            <th className="px-4 py-3 label-uppercase">Status</th>
            <th className="px-4 py-3 label-uppercase">Assigned</th>
            <th className="px-4 py-3 label-uppercase">Follow-up</th>
            <th className="px-4 py-3 label-uppercase text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="grid-divider-y">
          {leads.map((l) => {
            const overdue = isOverdue(l.next_followup_date) && !["converted","lost"].includes(l.status);
            const today = isToday(l.next_followup_date);
            return (
              <tr key={l.id} className={cn("hover:bg-stone-50 transition-colors", l.delete_request && "bg-rose-50/40")} data-testid={`lead-row-${l.id}`}>
                <td className="px-4 py-3">
                  <div className="font-medium text-stone-900">{l.name}</div>
                  <div className="text-xs text-stone-500">{l.location || "—"}</div>
                  {l.delete_request && <div className="text-[10px] tracking-widest uppercase text-rose-600 mt-1 font-semibold">Delete pending</div>}
                </td>
                <td className="px-4 py-3 text-stone-700"><a href={`tel:${l.phone}`} className="inline-flex items-center gap-1 hover:underline"><Phone className="w-3 h-3" />{l.phone}</a></td>
                <td className="px-4 py-3 text-stone-700">{l.project_type || "—"}</td>
                <td className="px-4 py-3 text-stone-700 text-right tabular-nums">{formatINR(l.budget)}</td>
                <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
                <td className="px-4 py-3 text-stone-700">{l.assigned_profile?.full_name || l.assigned_profile?.email || "—"}</td>
                <td className="px-4 py-3">
                  {l.next_followup_date ? (
                    <span className={cn("text-stone-700", overdue && "text-rose-600 font-medium", today && "text-orange-600 font-medium")}>
                      {formatDate(l.next_followup_date)} {overdue ? "· Overdue" : today ? "· Today" : ""}
                    </span>
                  ) : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="rounded-none h-8 w-8 hover:bg-stone-100" data-testid={`lead-actions-${l.id}`}><MoreVertical className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-none border-stone-300">
                        <DropdownMenuItem className="rounded-none cursor-pointer" onClick={() => onEdit(l)} disabled={l.is_locked}><Pencil className="w-4 h-4 mr-2" />Edit</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <div className="px-2 py-1 label-uppercase">Set Status</div>
                        {LEAD_STATUSES.filter(s => s.key !== "converted").map((s) => (
                          <DropdownMenuItem key={s.key} className="rounded-none cursor-pointer" onClick={() => onStatusChange(l, s.key)} disabled={l.is_locked || l.status === s.key}>
                            {s.label}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="rounded-none cursor-pointer text-emerald-700" onClick={() => onConvert(l)} disabled={l.is_locked || l.status === "converted"} data-testid={`lead-convert-${l.id}`}>
                          <ArrowRightCircle className="w-4 h-4 mr-2" />Convert to Customer
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {l.delete_request ? (
                          <DropdownMenuItem className="rounded-none cursor-pointer" onClick={() => onCancelDelete(l)}>
                            <X className="w-4 h-4 mr-2" />Cancel Delete Request
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem className="rounded-none cursor-pointer text-rose-600" onClick={() => onRequestDelete(l)} data-testid={`lead-delete-${l.id}`}>
                            <Trash2 className="w-4 h-4 mr-2" />Request Delete
                          </DropdownMenuItem>
                        )}
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
  );
}

function LeadKanban({ leads, onEdit, onStatusChange, onConvert }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-0 grid-divider-x border border-stone-200 bg-stone-200" data-testid="leads-kanban">
      {LEAD_STATUSES.map((s) => {
        const items = leads.filter((l) => l.status === s.key);
        return (
          <div key={s.key} className="bg-stone-50 min-h-[400px] flex flex-col">
            <div className={cn("px-3 py-2 border-b-2 flex items-center justify-between", s.color)}>
              <div className="text-[10px] tracking-[0.15em] uppercase font-semibold">{s.label}</div>
              <div className="text-xs font-mono">{items.length}</div>
            </div>
            <div className="p-2 space-y-2 flex-1">
              {items.map((l) => (
                <div key={l.id} className="bg-white border border-stone-200 p-3 hover:border-stone-500 transition-colors group cursor-pointer" data-testid={`kanban-card-${l.id}`} onClick={() => onEdit(l)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-sm text-stone-900 leading-tight">{l.name}</div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="rounded-none h-6 w-6 -mr-1 -mt-1"><MoreVertical className="w-3 h-3" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="rounded-none border-stone-300" onClick={(e) => e.stopPropagation()}>
                        <div className="px-2 py-1 label-uppercase">Move To</div>
                        {LEAD_STATUSES.filter(x => x.key !== s.key && x.key !== "converted").map((x) => (
                          <DropdownMenuItem key={x.key} className="rounded-none cursor-pointer" onClick={() => onStatusChange(l, x.key)}>{x.label}</DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="rounded-none cursor-pointer text-emerald-700" onClick={() => onConvert(l)} disabled={l.is_locked}>
                          <ArrowRightCircle className="w-4 h-4 mr-2" />Convert
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="text-xs text-stone-500 mt-1">{l.phone}</div>
                  {l.project_type && <div className="text-xs text-stone-700 mt-2">{l.project_type}</div>}
                  {l.budget && <div className="text-xs font-mono mt-1 text-stone-900">{formatINR(l.budget)}</div>}
                  {l.next_followup_date && (
                    <div className={cn("text-[10px] tracking-widest uppercase mt-2 font-semibold", isOverdue(l.next_followup_date) ? "text-rose-600" : isToday(l.next_followup_date) ? "text-orange-600" : "text-stone-500")}>
                      {isOverdue(l.next_followup_date) ? "Overdue · " : isToday(l.next_followup_date) ? "Today · " : "Due "}{formatDate(l.next_followup_date)}
                    </div>
                  )}
                </div>
              ))}
              {items.length === 0 && <div className="text-xs text-stone-400 italic px-1 py-3">No leads</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
