import { useEffect, useMemo, useState } from "react";
import { PageHeader, PageBody } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  fetchLeads, updateLeadStatus, requestDelete, cancelDeleteRequest, convertLeadToCustomer,
} from "@/services/leadService";
import { fetchProfiles } from "@/services/profileService";
import { useAuth } from "@/contexts/AuthContext";
import LeadFormDialog from "@/components/leads/LeadFormDialog";
import LeadKpiStrip from "@/components/leads/LeadKpiStrip";
import LeadFilters from "@/components/leads/LeadFilters";
import LeadTableView from "@/components/leads/LeadTableView";
import LeadPipelineView from "@/components/leads/LeadPipelineView";
import LeadDetailsSheet from "@/components/leads/LeadDetailsSheet";
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
          <Button onClick={() => { setEditLead(null); setFormOpen(true); }} className="rounded-none bg-orange-500 hover:bg-orange-600 text-white" data-testid="lead-add-button">
            <Plus className="w-4 h-4" /> New Lead
          </Button>
        }
      />

      <PageBody>
        <LeadKpiStrip leads={filtered} />

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
