import { useEffect, useState } from "react";
import { PageHeader, PageBody } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, RotateCcw, Plus } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { fetchProfiles } from "@/services/profileService";
import { fetchLeadPaymentTotals } from "@/services/leadPaymentService";
import { fetchLeadSegment, reviveLostLead } from "@/services/leadSegmentService";
import { updateLeadStatus, requestDelete, cancelDeleteRequest, convertLeadToCustomer, bulkUpdateLeads, bulkAddCoAssignee } from "@/services/leadService";
import { exportLeadsCSV } from "@/utils/leadCsv";
import LeadFilters from "@/components/leads/LeadFilters";
import LeadBulkActionBar from "@/components/leads/LeadBulkActionBar";
import LeadTableView from "@/components/leads/LeadTableView";
import LeadPipelineView from "@/components/leads/LeadPipelineView";
import LeadDetailsSheet from "@/components/leads/LeadDetailsSheet";
import LeadFormDialog from "@/components/leads/LeadFormDialog";

export default function LeadSegmentPage({ segment = "active" }) {
  const isLost = segment === "lost";
  const title = isLost ? "Lost Leads" : "Active Leads";
  const subtitle = isLost ? "Leads marked as lost · can be revived" : "All non-lost leads · paginated for scale";
  const { user, isAdmin } = useAuth();
  const { can } = usePermissions();
  const nav = useNavigate();
  const [leads, setLeads] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [rmFilter, setRmFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [view, setView] = useState("table");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState(new Set());
  const [activeLead, setActiveLead] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editLead, setEditLead] = useState(null);
  const [formOpen, setFormOpen] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const load = async () => {
    setLoading(true);
    try {
      const result = await fetchLeadSegment({
        segment,
        page,
        pageSize,
        search,
        status: statusFilter,
        rm: rmFilter,
        source: sourceFilter,
        tag: tagFilter,
        fromDate,
        toDate,
      });
      const paymentMap = await fetchLeadPaymentTotals(result.rows.map((l) => l.id));
      setLeads(result.rows.map((l) => ({ ...l, receiptsTotal: paymentMap[l.id] || 0 })));
      setTotal(result.count);
      setSelected(new Set());
      if (page > Math.max(1, Math.ceil(result.count / pageSize))) setPage(1);
    } catch (e) {
      toast.error(e.message || "Unable to load leads");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfiles().then(setProfiles).catch(() => setProfiles([])); }, []);
  useEffect(() => { load(); }, [segment, page, pageSize, search, statusFilter, rmFilter, sourceFilter, tagFilter, fromDate, toDate]);

  const toggleSelect = (id) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAll = (checked) => setSelected(checked ? new Set(leads.map((l) => l.id)) : new Set());
  const clearSelection = () => setSelected(new Set());
  const selectedIds = () => Array.from(selected);

  const openDetails = (lead) => { setActiveLead(lead); setDetailsOpen(true); };
  const openEdit = (lead) => {
    if (!can("leads", "edit")) { toast.error("You do not have permission to edit leads"); return; }
    setEditLead(lead); setFormOpen(true); setDetailsOpen(false);
  };
  const handleStatusChange = async (lead, status) => {
    if (!can("leads", "edit")) return toast.error("You do not have permission to edit leads");
    try { await updateLeadStatus(lead.id, status, user.id); toast.success(`Status updated to ${status.replace(/_/g, " ")}`); load(); }
    catch (e) { toast.error(e.message); }
  };
  const handleConvert = async (lead) => {
    if (!can("customers", "create")) return toast.error("You do not have permission to convert leads");
    if (lead.is_locked || lead.status === "converted") return toast.info("This lead is already converted");
    try { await convertLeadToCustomer(lead, user.id); toast.success("Converted to customer"); nav("/customers"); }
    catch (e) { toast.error(e.message || "Convert failed"); }
  };
  const handleRequestDelete = async (lead) => {
    if (!can("leads", "delete")) return toast.error("You do not have permission to delete leads");
    try { await requestDelete(lead.id, user.id); toast.success("Delete request sent"); load(); }
    catch (e) { toast.error(e.message); }
  };
  const handleCancelDelete = async (lead) => {
    if (!can("leads", "delete")) return toast.error("You do not have permission to cancel delete requests");
    try { await cancelDeleteRequest(lead.id); toast.success("Delete request cancelled"); load(); }
    catch (e) { toast.error(e.message); }
  };

  const runBulk = async (actionLabel, payload) => {
    if (!can("leads", "edit")) { toast.error("You do not have permission to bulk edit leads"); return; }
    const ids = selectedIds();
    if (!ids.length) return;
    if (!window.confirm(`Apply "${actionLabel}" to ${ids.length} lead${ids.length !== 1 ? "s" : ""}?`)) return;
    try {
      const n = await bulkUpdateLeads(ids, payload);
      toast.success(`Updated ${n} lead${n !== 1 ? "s" : ""}`);
      clearSelection();
      load();
    } catch (e) { toast.error(e.message); }
  };
  const handleBulkStatus = (status) => runBulk(`status → ${status}`, { status });
  const handleBulkPriority = (priority) => runBulk(`priority → ${priority || "none"}`, { priority });
  const handleBulkAssign = (assigned_to) => {
    if (!can("leads", "assign")) { toast.error("You do not have permission to assign leads"); return; }
    runBulk("assign", { assigned_to });
  };
  const handleBulkAddCoAssignee = async (userId) => {
    if (!can("leads", "assign")) { toast.error("You do not have permission to co-assign leads"); return; }
    const ids = selectedIds();
    if (!ids.length || !userId) return;
    const profile = profiles.find((p) => p.id === userId);
    const label = profile ? (profile.full_name || profile.email) : "selected user";
    if (!window.confirm(`Add ${label} as co-assignee to ${ids.length} lead${ids.length !== 1 ? "s" : ""}?`)) return;
    try {
      await bulkAddCoAssignee(ids, userId, user.id);
      toast.success(`Added ${label} to ${ids.length} lead${ids.length !== 1 ? "s" : ""}`);
      clearSelection();
      load();
    } catch (e) { toast.error(e.message); }
  };
  const handleBulkDeleteRequest = () => {
    if (!can("leads", "delete")) { toast.error("You do not have permission to delete leads"); return; }
    runBulk("request delete", { delete_request: true, delete_requested_by: user.id });
  };
  const handleExportSelected = () => {
    if (!can("leads", "view")) return;
    const rows = leads.filter((l) => selected.has(l.id));
    if (!rows.length) return;
    exportLeadsCSV(rows, `leads-selected-${new Date().toISOString().slice(0, 10)}.csv`);
    toast.success(`Exported ${rows.length} leads`);
  };
  const handleClearFilters = () => {
    setSearch("");
    setSearchInput("");
    setStatusFilter("all");
    setRmFilter("all");
    setSourceFilter("all");
    setTagFilter("all");
    setFromDate("");
    setToDate("");
    setPage(1);
  };
  const submitSearch = (e) => {
    e?.preventDefault?.();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const hasFilters = Boolean(search || statusFilter !== "all" || rmFilter !== "all" || sourceFilter !== "all" || tagFilter !== "all" || fromDate || toDate);

  return (
    <div data-testid={isLost ? "lost-leads-page" : "active-leads-page"}>
      <PageHeader subtitle={subtitle} title={title} actions={(
        <div className="flex items-center gap-2">
          {!isLost && can("leads", "create") && <Button onClick={() => { setEditLead(null); setFormOpen(true); }} className="rounded-none bg-orange-500 hover:bg-orange-600 text-white"><Plus className="w-4 h-4" />New Lead</Button>}
        </div>
      )} />
      <PageBody>
        <LeadBulkActionBar
          selectedCount={selected.size}
          totalCount={leads.length}
          onClear={clearSelection}
          onSelectAll={() => toggleAll(true)}
          isAdmin={isAdmin}
          rmOptions={profiles}
          onBulkStatus={handleBulkStatus}
          onBulkPriority={handleBulkPriority}
          onBulkAssign={handleBulkAssign}
          onBulkAddCoAssignee={handleBulkAddCoAssignee}
          onBulkDeleteRequest={handleBulkDeleteRequest}
          onExportSelected={handleExportSelected}
        />

        <div className="mt-4">
          <LeadFilters
            search={searchInput}
            onSearchChange={setSearchInput}
            status={statusFilter}
            onStatusChange={(value) => { setPage(1); setStatusFilter(value); }}
            rm={rmFilter}
            onRmChange={(value) => { setPage(1); setRmFilter(value); }}
            source={sourceFilter}
            onSourceChange={(value) => { setPage(1); setSourceFilter(value); }}
            tag={tagFilter}
            onTagChange={(value) => { setPage(1); setTagFilter(value); }}
            fromDate={fromDate}
            onFromDateChange={(value) => { setPage(1); setFromDate(value); }}
            toDate={toDate}
            onToDateChange={(value) => { setPage(1); setToDate(value); }}
            view={view}
            onViewChange={setView}
            rmOptions={profiles}
            isAdmin={isAdmin}
            onClear={handleClearFilters}
          />
          <div className="mt-2 flex items-center justify-between text-xs text-stone-500">
            <div>{total.toLocaleString("en-IN")} {isLost ? "lost" : "active"} leads{hasFilters ? " matching filters" : ""}</div>
            <select value={pageSize} onChange={(e) => { setPage(1); setPageSize(Number(e.target.value)); }} className="h-8 border border-stone-300 px-2 text-xs bg-white">
              <option value="100">100 / page</option>
              <option value="200">200 / page</option>
            </select>
          </div>
        </div>

        <div className="mt-5">
          {loading ? <div className="bg-white border border-stone-200 p-12 text-center text-sm text-stone-500">Loading {isLost ? "lost" : "active"} leads…</div>
            : leads.length === 0 ? <div className="bg-white border border-stone-200 p-12 text-center text-stone-500">No {isLost ? "lost" : "active"} leads found.</div>
            : view === "table" ? <LeadTableView
                leads={leads}
                onOpen={openDetails}
                onEdit={openEdit}
                onStatusChange={handleStatusChange}
                onConvert={handleConvert}
                onRequestDelete={handleRequestDelete}
                onCancelDelete={handleCancelDelete}
                selected={selected}
                onToggleSelect={toggleSelect}
                onToggleAll={toggleAll}
                profiles={profiles}
                onAssigneesChanged={load}
              />
            : <LeadPipelineView leads={leads} onOpen={openDetails} onStatusChange={handleStatusChange} onConvert={handleConvert} />}
        </div>

        <div className="mt-4 flex items-center justify-between bg-white border border-stone-200 px-4 py-3">
          <div className="text-xs text-stone-500">Showing {total ? `${((page - 1) * pageSize) + 1}–${Math.min(page * pageSize, total)}` : "0"} of {total.toLocaleString("en-IN")}</div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="rounded-none" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft className="w-4 h-4 mr-1" />Previous</Button>
            <span className="text-sm px-2">Page {page} of {totalPages}</span>
            <Button variant="outline" className="rounded-none" disabled={page >= totalPages || loading} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next<ChevronRight className="w-4 h-4 ml-1" />Next</Button>
          </div>
        </div>
      </PageBody>

      {isLost && selected.size > 0 && (
        <div className="fixed bottom-5 right-5 z-40">
          <Button onClick={() => reviveLostLead(Array.from(selected), user?.id)} className="rounded-none bg-emerald-600 hover:bg-emerald-700 text-white" disabled={!can("leads", "edit")}>
            <RotateCcw className="w-4 h-4 mr-1" />Revive Selected ({selected.size})
          </Button>
        </div>
      )}

      <LeadFormDialog open={formOpen} onOpenChange={setFormOpen} lead={editLead} onSaved={load} />
      <LeadDetailsSheet open={detailsOpen} onOpenChange={setDetailsOpen} lead={activeLead} onEdit={openEdit} onConvert={handleConvert} profiles={profiles} onAssigneesChanged={load} />
    </div>
  );
}
