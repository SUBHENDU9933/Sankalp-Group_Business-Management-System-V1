import { useEffect, useMemo, useState } from "react";
import { PageHeader, PageBody } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Plus, Upload, Download, ChevronDown, FileSpreadsheet } from "lucide-react";
import { fetchLeads, updateLeadStatus, requestDelete, cancelDeleteRequest, convertLeadToCustomer, bulkUpdateLeads, bulkAddCoAssignee } from "@/services/leadService";
import { fetchProfiles } from "@/services/profileService";
import { fetchLeadPaymentTotals } from "@/services/leadPaymentService";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import LeadFormDialog from "@/components/leads/LeadFormDialog";
import LeadKpiStrip from "@/components/leads/LeadKpiStrip";
import LeadFilters from "@/components/leads/LeadFilters";
import LeadTableView from "@/components/leads/LeadTableView";
import LeadPipelineView from "@/components/leads/LeadPipelineView";
import LeadDetailsSheet from "@/components/leads/LeadDetailsSheet";
import LeadBulkActionBar from "@/components/leads/LeadBulkActionBar";
import LeadImportDialog from "@/components/leads/LeadImportDialog";
import { exportLeadsCSV, downloadLeadTemplate } from "@/utils/leadCsv";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function LeadsPage() {
  const { user, isAdmin } = useAuth();
  const { can } = usePermissions();
  const nav = useNavigate();
  const [leads, setLeads] = useState([]), [profiles, setProfiles] = useState([]), [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(""), [statusFilter, setStatusFilter] = useState("all"), [rmFilter, setRmFilter] = useState("all"), [sourceFilter, setSourceFilter] = useState("all"), [tagFilter, setTagFilter] = useState("all"), [fromDate, setFromDate] = useState(""), [toDate, setToDate] = useState(""), [view, setView] = useState("table");
  const [formOpen, setFormOpen] = useState(false), [editLead, setEditLead] = useState(null), [detailsOpen, setDetailsOpen] = useState(false), [activeLead, setActiveLead] = useState(null), [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const toggleSelect = (id) => setSelected((s) => { const next = new Set(s); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const toggleAll = (checked, list) => setSelected(() => checked ? new Set(list.map((l) => l.id)) : new Set());
  const clearSelection = () => setSelected(new Set());

  const load = async () => { setLoading(true); try { const [d, p, paidMap] = await Promise.all([fetchLeads(), fetchProfiles().catch(() => []), fetchLeadPaymentTotals().catch(() => ({}))]); setLeads(d.map((l) => ({ ...l, receiptsTotal: paidMap[l.id] || 0 }))); setProfiles(p); } catch (e) { toast.error(e.message); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  useEffect(() => { if (activeLead) { const fresh = leads.find((l) => l.id === activeLead.id); if (fresh) setActiveLead(fresh); } }, [leads]);

  const filtered = useMemo(() => leads.filter((l) => {
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    if (rmFilter !== "all") { if (rmFilter === "unassigned" && l.assigned_to) return false; if (rmFilter !== "unassigned" && l.assigned_to !== rmFilter) return false; }
    if (sourceFilter !== "all" && l.source !== sourceFilter) return false;
    if (tagFilter && tagFilter !== "all") { const t = (l.tag || "").toLowerCase(); if (tagFilter === "website" && !(t.includes("website") && !t.includes("repeat"))) return false; if (tagFilter === "repeat" && !t.includes("repeat")) return false; if (tagFilter === "any-website" && !t.includes("website")) return false; if (tagFilter === "none" && l.tag) return false; }
    if (fromDate && new Date(l.created_at) < new Date(fromDate)) return false;
    if (toDate) { const end = new Date(toDate); end.setHours(23, 59, 59, 999); if (new Date(l.created_at) > end) return false; }
    if (search) { const s = search.toLowerCase(); const hay = [l.name, l.phone, l.phone_secondary, l.location, l.area, l.pincode].filter(Boolean).join(" ").toLowerCase(); if (!hay.includes(s)) return false; }
    return true;
  }), [leads, search, statusFilter, rmFilter, sourceFilter, tagFilter, fromDate, toDate]);

  const handleStatusChange = async (lead, status) => { if (!can("leads", "edit")) { toast.error("You do not have permission to edit leads"); return; } try { await updateLeadStatus(lead.id, status, user.id); toast.success(`Status updated to ${status.replace(/_/g, " ")}`); load(); } catch (e) { toast.error(e.message); } };
  const handleConvert = async (lead) => { if (!can("customers", "create")) { toast.error("You do not have permission to convert leads to customers"); return; } if (lead.is_locked || lead.status === "converted") { toast.info("This lead is already converted"); return; } if (!window.confirm(`Convert "${lead.name}" to a customer? This will lock the lead.`)) return; try { await convertLeadToCustomer(lead, user.id); toast.success("Converted to customer"); load(); nav("/customers"); } catch (e) { toast.error(e.message || "Convert failed"); } };
  const handleRequestDelete = async (lead) => { if (!can("leads", "delete")) { toast.error("You do not have permission to delete leads"); return; } if (!window.confirm("Request admin to delete this lead?")) return; try { await requestDelete(lead.id, user.id); toast.success("Delete request sent for admin approval"); load(); } catch (e) { toast.error(e.message); } };
  const handleCancelDelete = async (lead) => { if (!can("leads", "delete")) { toast.error("You do not have permission to cancel this delete request"); return; } try { await cancelDeleteRequest(lead.id); toast.success("Delete request cancelled"); load(); } catch (e) { toast.error(e.message); } };

  const selectedIds = () => Array.from(selected), selectedLeads = () => filtered.filter((l) => selected.has(l.id));
  const runBulk = async (actionLabel, payload) => { if (!can("leads", "edit")) { toast.error("You do not have permission to bulk edit leads"); return; } const ids = selectedIds(); if (!ids.length) return; if (!window.confirm(`Apply "${actionLabel}" to ${ids.length} lead${ids.length !== 1 ? "s" : ""}?`)) return; try { const n = await bulkUpdateLeads(ids, payload); toast.success(`Updated ${n} lead${n !== 1 ? "s" : ""}`); clearSelection(); load(); } catch (e) { toast.error(e.message); } };
  const handleBulkStatus = (status) => runBulk(`status → ${status}`, { status });
  const handleBulkPriority = (priority) => runBulk(`priority → ${priority || "none"}`, { priority });
  const handleBulkAssign = (assigned_to) => { if (!can("leads", "assign")) { toast.error("You do not have permission to assign leads"); return; } runBulk("assign", { assigned_to }); };
  const handleBulkAddCoAssignee = async (userId) => { if (!can("leads", "assign")) { toast.error("You do not have permission to co-assign leads"); return; } const ids = selectedIds(); if (!ids.length || !userId) return; const profile = profiles.find((p) => p.id === userId); const label = profile ? (profile.full_name || profile.email) : "selected user"; if (!window.confirm(`Add ${label} as co-assignee to ${ids.length} lead${ids.length !== 1 ? "s" : ""}?`)) return; try { await bulkAddCoAssignee(ids, userId, user.id); toast.success(`Added ${label} to ${ids.length} lead${ids.length !== 1 ? "s" : ""}`); clearSelection(); load(); } catch (e) { toast.error(e.message); } };
  const handleBulkDeleteRequest = () => { if (!can("leads", "delete")) { toast.error("You do not have permission to delete leads"); return; } runBulk("request delete", { delete_request: true, delete_requested_by: user.id }); };
  const handleExportSelected = () => { if (!can("leads", "view")) return; const rows = selectedLeads(); if (!rows.length) return; exportLeadsCSV(rows, `leads-selected-${new Date().toISOString().slice(0,10)}.csv`); toast.success(`Exported ${rows.length} leads`); };
  const handleExportFiltered = () => { if (!can("leads", "view")) return; if (!filtered.length) { toast.info("No leads to export"); return; } exportLeadsCSV(filtered, `leads-${new Date().toISOString().slice(0,10)}.csv`); toast.success(`Exported ${filtered.length} leads`); };
  const openDetails = (lead) => { setActiveLead(lead); setDetailsOpen(true); };
  const openEdit = (lead) => { if (!can("leads", "edit")) { toast.error("You do not have permission to edit leads"); return; } setEditLead(lead); setFormOpen(true); setDetailsOpen(false); };
  const clearFilters = () => { setSearch(""); setStatusFilter("all"); setRmFilter("all"); setSourceFilter("all"); setTagFilter("all"); setFromDate(""); setToDate(""); };

  const canCreate = can("leads", "create"), canView = can("leads", "view");
  return (
    <div data-testid="leads-page">
      <PageHeader subtitle="Phase 2" title="Lead Management" actions={<>
        {canView && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" className="rounded-none border-stone-300 hover:bg-stone-100" data-testid="lead-bulk-menu-btn"><FileSpreadsheet className="w-4 h-4 mr-1" />Bulk<ChevronDown className="w-3 h-3 ml-1" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="rounded-none border-stone-300 w-56">{canCreate && <DropdownMenuItem className="rounded-none cursor-pointer" onClick={() => setImportOpen(true)} data-testid="lead-import-open"><Upload className="w-4 h-4 mr-2" />Import from CSV…</DropdownMenuItem>}<DropdownMenuItem className="rounded-none cursor-pointer" onClick={downloadLeadTemplate} data-testid="lead-template-download"><Download className="w-4 h-4 mr-2" />Download CSV template</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem className="rounded-none cursor-pointer" onClick={handleExportFiltered} data-testid="lead-export-filtered"><Download className="w-4 h-4 mr-2" />Export filtered ({filtered.length})</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}
        {canCreate && <Button onClick={() => { setEditLead(null); setFormOpen(true); }} className="rounded-none bg-orange-500 hover:bg-orange-600 text-white" data-testid="lead-add-button"><Plus className="w-4 h-4" /> New Lead</Button>}
      </>} />
      <PageBody>
        <LeadKpiStrip leads={filtered} />
        <div className="mt-4"><LeadBulkActionBar selectedCount={selected.size} totalCount={filtered.length} onClear={clearSelection} onSelectAll={() => toggleAll(true, filtered)} isAdmin={isAdmin} rmOptions={profiles} onBulkStatus={handleBulkStatus} onBulkPriority={handleBulkPriority} onBulkAssign={handleBulkAssign} onBulkAddCoAssignee={handleBulkAddCoAssignee} onBulkDeleteRequest={handleBulkDeleteRequest} onExportSelected={handleExportSelected} /></div>
        <div className="mt-5"><LeadFilters search={search} onSearchChange={setSearch} status={statusFilter} onStatusChange={setStatusFilter} rm={rmFilter} onRmChange={setRmFilter} source={sourceFilter} onSourceChange={setSourceFilter} tag={tagFilter} onTagChange={setTagFilter} fromDate={fromDate} onFromDateChange={setFromDate} toDate={toDate} onToDateChange={setToDate} view={view} onViewChange={setView} rmOptions={profiles} isAdmin={isAdmin} onClear={clearFilters} /></div>
        <div className="mt-5">{loading ? <div className="bg-white border border-stone-200 p-12 text-center text-sm text-stone-500">Loading leads…</div> : filtered.length === 0 ? <div className="bg-white border border-stone-200 p-12 text-center" data-testid="leads-empty"><div className="font-display text-xl font-bold tracking-tight text-stone-900">No leads found</div><p className="text-sm text-stone-500 mt-2">{leads.length === 0 ? "Add your first lead to start tracking enquiries." : "Try clearing filters or changing the search query."}</p>{leads.length === 0 && canCreate && <Button onClick={() => setFormOpen(true)} className="mt-4 rounded-none bg-stone-900 hover:bg-stone-800 text-white"><Plus className="w-4 h-4" /> Create Lead</Button>}</div> : view === "table" ? <LeadTableView leads={filtered} onOpen={openDetails} onEdit={openEdit} onStatusChange={handleStatusChange} onConvert={handleConvert} onRequestDelete={handleRequestDelete} onCancelDelete={handleCancelDelete} selected={selected} onToggleSelect={toggleSelect} onToggleAll={(checked) => toggleAll(checked, filtered)} profiles={profiles} onAssigneesChanged={load} /> : <LeadPipelineView leads={filtered} onOpen={openDetails} onStatusChange={handleStatusChange} onConvert={handleConvert} /></div>
      </PageBody>
      <LeadFormDialog open={formOpen} onOpenChange={setFormOpen} lead={editLead} onSaved={load} />
      <LeadImportDialog open={importOpen} onOpenChange={setImportOpen} rmOptions={profiles} onImported={load} />
      <LeadDetailsSheet open={detailsOpen} onOpenChange={setDetailsOpen} lead={activeLead} onEdit={openEdit} onConvert={handleConvert} profiles={profiles} onAssigneesChanged={load} />
    </div>
  );
}
