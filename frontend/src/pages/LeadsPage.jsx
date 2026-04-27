import { useEffect, useMemo, useState } from "react";
import { PageHeader, PageBody } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Plus, Upload, Download, ChevronDown, FileSpreadsheet } from "lucide-react";
import {
  fetchLeads, updateLeadStatus, requestDelete, cancelDeleteRequest, convertLeadToCustomer,
  bulkUpdateLeads,
} from "@/services/leadService";
import { fetchProfiles } from "@/services/profileService";
import { useAuth } from "@/contexts/AuthContext";
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
  const nav = useNavigate();
  const [leads, setLeads] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [rmFilter, setRmFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [view, setView] = useState("table");

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [editLead, setEditLead] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [activeLead, setActiveLead] = useState(null);
  const [importOpen, setImportOpen] = useState(false);

  // Bulk selection
  const [selected, setSelected] = useState(new Set());
  const toggleSelect = (id) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAll = (checked, list) => setSelected(() => checked ? new Set(list.map((l) => l.id)) : new Set());
  const clearSelection = () => setSelected(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const [d, p] = await Promise.all([fetchLeads(), fetchProfiles().catch(() => [])]);
      setLeads(d);
      setProfiles(p);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Refresh active lead snapshot when leads list refreshes
  useEffect(() => {
    if (activeLead) {
      const fresh = leads.find((l) => l.id === activeLead.id);
      if (fresh) setActiveLead(fresh);
    }
  }, [leads]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (rmFilter !== "all") {
        if (rmFilter === "unassigned" && l.assigned_to) return false;
        if (rmFilter !== "unassigned" && l.assigned_to !== rmFilter) return false;
      }
      if (sourceFilter !== "all" && l.source !== sourceFilter) return false;
      if (fromDate && new Date(l.created_at) < new Date(fromDate)) return false;
      if (toDate) {
        const end = new Date(toDate); end.setHours(23, 59, 59, 999);
        if (new Date(l.created_at) > end) return false;
      }
      if (search) {
        const s = search.toLowerCase();
        const hay = [
          l.name, l.phone, l.phone_secondary, l.location, l.area, l.pincode,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [leads, search, statusFilter, rmFilter, sourceFilter, fromDate, toDate]);

  const handleStatusChange = async (lead, status) => {
    try {
      await updateLeadStatus(lead.id, status, user.id);
      toast.success(`Status updated to ${status.replace(/_/g, " ")}`);
      load();
    } catch (e) { toast.error(e.message); }
  };

  const handleConvert = async (lead) => {
    if (lead.is_locked || lead.status === "converted") {
      toast.info("This lead is already converted");
      return;
    }
    if (!window.confirm(`Convert "${lead.name}" to a customer? This will lock the lead.`)) return;
    try {
      await convertLeadToCustomer(lead, user.id);
      toast.success("Converted to customer");
      load();
      nav("/customers");
    } catch (e) { toast.error(e.message || "Convert failed"); }
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

  // ---------- BULK ACTIONS ----------
  const selectedIds = () => Array.from(selected);
  const selectedLeads = () => filtered.filter((l) => selected.has(l.id));

  const runBulk = async (actionLabel, payload) => {
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
  const handleBulkAssign = (assigned_to) => runBulk(`assign`, { assigned_to });
  const handleBulkDeleteRequest = () => runBulk("request delete", { delete_request: true, delete_requested_by: user.id });
  const handleExportSelected = () => {
    const rows = selectedLeads();
    if (!rows.length) return;
    exportLeadsCSV(rows, `leads-selected-${new Date().toISOString().slice(0,10)}.csv`);
    toast.success(`Exported ${rows.length} leads`);
  };
  const handleExportFiltered = () => {
    if (!filtered.length) { toast.info("No leads to export"); return; }
    exportLeadsCSV(filtered, `leads-${new Date().toISOString().slice(0,10)}.csv`);
    toast.success(`Exported ${filtered.length} leads`);
  };

  const openDetails = (lead) => { setActiveLead(lead); setDetailsOpen(true); };
  const openEdit = (lead) => { setEditLead(lead); setFormOpen(true); setDetailsOpen(false); };

  const clearFilters = () => {
    setSearch(""); setStatusFilter("all"); setRmFilter("all");
    setSourceFilter("all"); setFromDate(""); setToDate("");
  };

  return (
    <div data-testid="leads-page">
      <PageHeader
        subtitle="Phase 2"
        title="Lead Management"
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="rounded-none border-stone-300 hover:bg-stone-100" data-testid="lead-bulk-menu-btn">
                  <FileSpreadsheet className="w-4 h-4 mr-1" />Bulk<ChevronDown className="w-3 h-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-none border-stone-300 w-56">
                <DropdownMenuItem className="rounded-none cursor-pointer" onClick={() => setImportOpen(true)} data-testid="lead-import-open">
                  <Upload className="w-4 h-4 mr-2" />Import from CSV…
                </DropdownMenuItem>
                <DropdownMenuItem className="rounded-none cursor-pointer" onClick={downloadLeadTemplate} data-testid="lead-template-download">
                  <Download className="w-4 h-4 mr-2" />Download CSV template
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="rounded-none cursor-pointer" onClick={handleExportFiltered} data-testid="lead-export-filtered">
                  <Download className="w-4 h-4 mr-2" />Export filtered ({filtered.length})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => { setEditLead(null); setFormOpen(true); }} className="rounded-none bg-orange-500 hover:bg-orange-600 text-white" data-testid="lead-add-button">
              <Plus className="w-4 h-4" /> New Lead
            </Button>
          </>
        }
      />

      <PageBody>
        <LeadKpiStrip leads={filtered} />

        <div className="mt-4">
          <LeadBulkActionBar
            selectedCount={selected.size}
            totalCount={filtered.length}
            onClear={clearSelection}
            onSelectAll={() => toggleAll(true, filtered)}
            isAdmin={isAdmin}
            rmOptions={profiles}
            onBulkStatus={handleBulkStatus}
            onBulkPriority={handleBulkPriority}
            onBulkAssign={handleBulkAssign}
            onBulkDeleteRequest={handleBulkDeleteRequest}
            onExportSelected={handleExportSelected}
          />
        </div>

        <div className="mt-5">
          <LeadFilters
            search={search} onSearchChange={setSearch}
            status={statusFilter} onStatusChange={setStatusFilter}
            rm={rmFilter} onRmChange={setRmFilter}
            source={sourceFilter} onSourceChange={setSourceFilter}
            fromDate={fromDate} onFromDateChange={setFromDate}
            toDate={toDate} onToDateChange={setToDate}
            view={view} onViewChange={setView}
            rmOptions={profiles}
            isAdmin={isAdmin}
            onClear={clearFilters}
          />
        </div>

        <div className="mt-5">
          {loading ? (
            <div className="bg-white border border-stone-200 p-12 text-center text-sm text-stone-500">Loading leads…</div>
          ) : filtered.length === 0 ? (
            <div className="bg-white border border-stone-200 p-12 text-center" data-testid="leads-empty">
              <div className="font-display text-xl font-bold tracking-tight text-stone-900">No leads found</div>
              <p className="text-sm text-stone-500 mt-2">{leads.length === 0 ? "Add your first lead to start tracking enquiries." : "Try clearing filters or changing the search query."}</p>
              {leads.length === 0 && (
                <Button onClick={() => setFormOpen(true)} className="mt-4 rounded-none bg-stone-900 hover:bg-stone-800 text-white">
                  <Plus className="w-4 h-4" /> Create Lead
                </Button>
              )}
            </div>
          ) : view === "table" ? (
            <LeadTableView
              leads={filtered}
              onOpen={openDetails}
              onEdit={openEdit}
              onStatusChange={handleStatusChange}
              onConvert={handleConvert}
              onRequestDelete={handleRequestDelete}
              onCancelDelete={handleCancelDelete}
              selected={selected}
              onToggleSelect={toggleSelect}
              onToggleAll={(checked) => toggleAll(checked, filtered)}
            />
          ) : (
            <LeadPipelineView
              leads={filtered}
              onOpen={openDetails}
              onStatusChange={handleStatusChange}
              onConvert={handleConvert}
            />
          )}
        </div>
      </PageBody>

      <LeadFormDialog open={formOpen} onOpenChange={setFormOpen} lead={editLead} onSaved={load} />
      <LeadImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        rmOptions={profiles}
        onImported={load}
      />
      <LeadDetailsSheet
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        lead={activeLead}
        onEdit={openEdit}
        onConvert={handleConvert}
      />
    </div>
  );
}
