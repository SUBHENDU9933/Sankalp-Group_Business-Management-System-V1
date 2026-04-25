import { useEffect, useState } from "react";
import { PageHeader, PageBody } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Trash2, Undo2, Phone } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { adminDeleteLead, cancelDeleteRequest } from "@/services/leadService";
import { adminDeleteCustomer, cancelDeleteCustomer } from "@/services/customerService";
import { formatDateTime } from "@/utils/format";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/StatusBadge";

export default function ApprovalsPage() {
  const [leads, setLeads] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [l, c] = await Promise.all([
        supabase.from("leads").select("*, requested_by:profiles!leads_delete_requested_by_fkey(full_name,email)").eq("delete_request", true).order("delete_requested_at", { ascending: false }),
        supabase.from("customers").select("*, requested_by:profiles!customers_delete_requested_by_fkey(full_name,email)").eq("delete_request", true).order("delete_requested_at", { ascending: false }),
      ]);
      if (l.error) throw l.error;
      if (c.error) throw c.error;
      setLeads(l.data || []);
      setCustomers(c.data || []);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const approveLead = async (id) => {
    if (!window.confirm("Permanently delete this lead?")) return;
    try { await adminDeleteLead(id); toast.success("Lead deleted"); load(); } catch (e) { toast.error(e.message); }
  };
  const rejectLead = async (id) => {
    try { await cancelDeleteRequest(id); toast.success("Request rejected"); load(); } catch (e) { toast.error(e.message); }
  };
  const approveCustomer = async (id) => {
    if (!window.confirm("Permanently delete this customer?")) return;
    try { await adminDeleteCustomer(id); toast.success("Customer deleted"); load(); } catch (e) { toast.error(e.message); }
  };
  const rejectCustomer = async (id) => {
    try { await cancelDeleteCustomer(id); toast.success("Request rejected"); load(); } catch (e) { toast.error(e.message); }
  };

  return (
    <div data-testid="approvals-page">
      <PageHeader subtitle="Admin" title="Pending Approvals" />
      <PageBody>
        {loading ? (
          <div className="bg-white border border-stone-200 p-12 text-center text-sm text-stone-500">Loading…</div>
        ) : leads.length === 0 && customers.length === 0 ? (
          <div className="bg-white border border-stone-200 p-12 text-center" data-testid="approvals-empty">
            <ShieldCheck className="w-10 h-10 mx-auto text-emerald-500" />
            <div className="font-display text-xl font-bold tracking-tight mt-3">All clear</div>
            <p className="text-sm text-stone-500 mt-2">No pending delete requests.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {leads.length > 0 && (
              <div>
                <div className="label-uppercase mb-3">Leads — Delete Requests ({leads.length})</div>
                <div className="bg-white border border-stone-200 overflow-x-auto">
                  <table className="w-full text-sm" data-testid="approvals-leads-table">
                    <thead className="bg-stone-50 border-b border-stone-200">
                      <tr className="text-left">
                        <th className="px-4 py-3 label-uppercase">Lead</th>
                        <th className="px-4 py-3 label-uppercase">Phone</th>
                        <th className="px-4 py-3 label-uppercase">Status</th>
                        <th className="px-4 py-3 label-uppercase">Requested By</th>
                        <th className="px-4 py-3 label-uppercase">Requested At</th>
                        <th className="px-4 py-3 label-uppercase text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="grid-divider-y">
                      {leads.map((l) => (
                        <tr key={l.id} className="hover:bg-stone-50" data-testid={`approval-lead-${l.id}`}>
                          <td className="px-4 py-3 font-medium">{l.name}<div className="text-xs text-stone-500">{l.location}</div></td>
                          <td className="px-4 py-3 text-stone-700"><span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{l.phone}</span></td>
                          <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
                          <td className="px-4 py-3 text-stone-700">{l.requested_by?.full_name || l.requested_by?.email || "—"}</td>
                          <td className="px-4 py-3 text-stone-600">{formatDateTime(l.delete_requested_at)}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-2">
                              <Button variant="outline" size="sm" className="rounded-none border-stone-300 hover:bg-stone-100" onClick={() => rejectLead(l.id)} data-testid={`approval-lead-reject-${l.id}`}><Undo2 className="w-3.5 h-3.5 mr-1" />Reject</Button>
                              <Button size="sm" className="rounded-none bg-rose-600 hover:bg-rose-700 text-white" onClick={() => approveLead(l.id)} data-testid={`approval-lead-approve-${l.id}`}><Trash2 className="w-3.5 h-3.5 mr-1" />Delete</Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {customers.length > 0 && (
              <div>
                <div className="label-uppercase mb-3">Customers — Delete Requests ({customers.length})</div>
                <div className="bg-white border border-stone-200 overflow-x-auto">
                  <table className="w-full text-sm" data-testid="approvals-customers-table">
                    <thead className="bg-stone-50 border-b border-stone-200">
                      <tr className="text-left">
                        <th className="px-4 py-3 label-uppercase">Customer</th>
                        <th className="px-4 py-3 label-uppercase">Phone</th>
                        <th className="px-4 py-3 label-uppercase">Address</th>
                        <th className="px-4 py-3 label-uppercase">Requested By</th>
                        <th className="px-4 py-3 label-uppercase">Requested At</th>
                        <th className="px-4 py-3 label-uppercase text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="grid-divider-y">
                      {customers.map((c) => (
                        <tr key={c.id} className="hover:bg-stone-50" data-testid={`approval-customer-${c.id}`}>
                          <td className="px-4 py-3 font-medium">{c.name}</td>
                          <td className="px-4 py-3 text-stone-700">{c.phone}</td>
                          <td className="px-4 py-3 text-stone-700">{c.address || "—"}</td>
                          <td className="px-4 py-3 text-stone-700">{c.requested_by?.full_name || c.requested_by?.email || "—"}</td>
                          <td className="px-4 py-3 text-stone-600">{formatDateTime(c.delete_requested_at)}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-2">
                              <Button variant="outline" size="sm" className="rounded-none border-stone-300 hover:bg-stone-100" onClick={() => rejectCustomer(c.id)} data-testid={`approval-customer-reject-${c.id}`}><Undo2 className="w-3.5 h-3.5 mr-1" />Reject</Button>
                              <Button size="sm" className="rounded-none bg-rose-600 hover:bg-rose-700 text-white" onClick={() => approveCustomer(c.id)} data-testid={`approval-customer-approve-${c.id}`}><Trash2 className="w-3.5 h-3.5 mr-1" />Delete</Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </PageBody>
    </div>
  );
}
