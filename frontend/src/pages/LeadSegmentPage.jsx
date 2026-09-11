import { useEffect, useState } from "react";
import { PageHeader, PageBody } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, RotateCcw, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { fetchProfiles } from "@/services/profileService";
import { fetchLeadPaymentTotals } from "@/services/leadPaymentService";
import { fetchLeadSegment, reviveLostLead } from "@/services/leadSegmentService";
import { updateLeadStatus, requestDelete, cancelDeleteRequest, convertLeadToCustomer } from "@/services/leadService";
import LeadTableView from "@/components/leads/LeadTableView";
import LeadDetailsSheet from "@/components/leads/LeadDetailsSheet";
import LeadFormDialog from "@/components/leads/LeadFormDialog";

export default function LeadSegmentPage({ segment = "active" }) {
  const isLost = segment === "lost";
  const title = isLost ? "Lost Leads" : "Active Leads";
  const subtitle = isLost ? "Leads marked as lost · can be revived" : "All non-lost leads · paginated for scale";
  const { user } = useAuth();
  const { can } = usePermissions();
  const nav = useNavigate();
  const [leads, setLeads] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
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
      const result = await fetchLeadSegment({ segment, page, pageSize, search });
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
  useEffect(() => { load(); }, [segment, page, pageSize, search]);

  const toggleSelect = (id) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAll = (checked) => setSelected(checked ? new Set(leads.map((l) => l.id)) : new Set());

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

  const revive = async (leadIds) => {
    if (!can("leads", "edit")) return toast.error("You do not have permission to revive leads");
    if (!leadIds.length) return;
    if (!window.confirm(`Revive ${leadIds.length} lost lead${leadIds.length !== 1 ? "s" : ""} as Contacted?`)) return;
    try {
      for (const id of leadIds) await reviveLostLead(id, user.id, "contacted");
      toast.success(`Revived ${leadIds.length} lead${leadIds.length !== 1 ? "s" : ""}`);
      setSelected(new Set());
      load();
    } catch (e) { toast.error(e.message || "Revive failed"); }
  };

  const submitSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  return (
    <div data-testid={isLost ? "lost-leads-page" : "active-leads-page"}>
      <PageHeader subtitle={subtitle} title={title} actions={(
        <div className="flex items-center gap-2">
          {!isLost && can("leads", "create") && <Button onClick={() => { setEditLead(null); setFormOpen(true); }} className="rounded-none bg-orange-500 hover:bg-orange-600 text-white"><Plus className="w-4 h-4" />New Lead</Button>}
        </div>
      )} />
      <PageBody>
        <div className="bg-white border border-stone-200 p-3 flex flex-wrap items-center gap-3">
          <form onSubmit={submitSearch} className="flex flex-1 min-w-[260px] max-w-xl">
            <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search name, phone, location…" className="flex-1 h-9 border border-stone-300 px-3 text-sm outline-none focus:border-blue-500" />
            <Button type="submit" variant="outline" className="rounded-none h-9 border-stone-300"><Search className="w-4 h-4" /></Button>
          </form>
          <div className="text-sm text-stone-600">{total.toLocaleString("en-IN")} {isLost ? "lost" : "active"} leads</div>
          <select value={pageSize} onChange={(e) => { setPage(1); setPageSize(Number(e.target.value)); }} className="h-9 border border-stone-300 px-2 text-sm bg-white">
            <option value="100">100 / page</option>
            <option value="200">200 / page</option>
          </select>
          {isLost && selected.size > 0 && <Button onClick={() => revive(Array.from(selected))} disabled={!can("leads", "edit")} className="rounded-none bg-emerald-600 hover:bg-emerald-700 text-white"><RotateCcw className="w-4 h-4" />Revive Selected ({selected.size})</Button>}
        </div>

        <div className="mt-4">
          {loading ? <div className="bg-white border border-stone-200 p-12 text-center text-sm text-stone-500">Loading {isLost ? "lost" : "active"} leads…</div>
            : leads.length === 0 ? <div className="bg-white border border-stone-200 p-12 text-center text-stone-500">No {isLost ? "lost" : "active"} leads found.</div>
            : <LeadTableView
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
              />}
        </div>

        <div className="mt-4 flex items-center justify-between bg-white border border-stone-200 px-4 py-3">
          <div className="text-xs text-stone-500">Showing {total ? `${((page - 1) * pageSize) + 1}–${Math.min(page * pageSize, total)}` : "0"} of {total.toLocaleString("en-IN")}</div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="rounded-none" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft className="w-4 h-4 mr-1" />Previous</Button>
            <span className="text-sm px-2">Page {page} of {totalPages}</span>
            <Button variant="outline" className="rounded-none" disabled={page >= totalPages || loading} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next<ChevronRight className="w-4 h-4 ml-1" /></Button>
          </div>
        </div>
      </PageBody>

      <LeadFormDialog open={formOpen} onOpenChange={setFormOpen} lead={editLead} onSaved={load} />
      <LeadDetailsSheet open={detailsOpen} onOpenChange={setDetailsOpen} lead={activeLead} onEdit={openEdit} onConvert={handleConvert} profiles={profiles} onAssigneesChanged={load} />
    </div>
  );
}
