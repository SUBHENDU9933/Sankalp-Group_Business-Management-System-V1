import { useEffect, useState } from "react";
import { PageHeader, PageBody } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Trash2, Undo2, Phone, ReceiptText } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { adminDeleteLead, cancelDeleteRequest } from "@/services/leadService";
import { adminDeleteCustomer, cancelDeleteCustomer } from "@/services/customerService";
import { adminDeleteReceipt, cancelDeleteReceipt } from "@/services/receiptService";
import { formatDateTime, formatINR } from "@/utils/format";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";

export default function ApprovalsPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [l, c, r] = await Promise.all([
        supabase.from("leads").select("*, requested_by:profiles!leads_delete_requested_by_fkey(full_name,email)").eq("delete_request", true).order("delete_requested_at", { ascending: false }),
        supabase.from("customers").select("*, requested_by:profiles!customers_delete_requested_by_fkey(full_name,email)").eq("delete_request", true).order("delete_requested_at", { ascending: false }),
        supabase.from("receipts").select("*, customer:customers(id,name,phone), requested_by:profiles!receipts_delete_requested_by_fkey(full_name,email)").eq("delete_request", true).is("deleted_at", null).order("delete_requested_at", { ascending: false }),
      ]);
      if (l.error) throw l.error;
      if (c.error) throw c.error;
      // Gracefully degrade if v16 not yet applied
      if (r.error && /delete_request|delete_requested|column|schema cache/i.test(r.error.message)) {
        setReceipts([]);
      } else if (r.error) {
        throw r.error;
      } else {
        setReceipts(r.data || []);
      }
      setLeads(l.data || []);
      setCustomers(c.data || []);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const approveLead = async (id) => {
    if (!window.confirm("Move this lead to Trash? (You can restore within 30 days from the Trash page.)")) return;
    try { await adminDeleteLead(id, user?.id); toast.success("Moved to Trash"); load(); } catch (e) { toast.error(e.message); }
  };
  const rejectLead = async (id) => {
    try { await cancelDeleteRequest(id); toast.success("Request rejected"); load(); } catch (e) { toast.error(e.message); }
  };
  const approveCustomer = async (id) => {
    if (!window.confirm("Permanently delete this customer?")) return;
    try { await adminDeleteCustomer(id, user?.id); toast.success("Moved to Trash"); load(); } catch (e) { toast.error(e.message); }
  };
  const rejectCustomer = async (id) => {
    try { await cancelDeleteCustomer(id); toast.success("Request rejected"); load(); } catch (e) { toast.error(e.message); }
  };
  const approveReceipt = async (id) => {
    if (!window.confirm("Move this receipt to Trash? (You can restore or permanently delete it from the Trash page.)")) return;
    try { await adminDeleteReceipt(id, user?.id); toast.success("Receipt moved to Trash"); load(); } catch (e) { toast.error(e.message); }
  };
  const rejectReceipt = async (id) => {
    try { await cancelDeleteReceipt(id); toast.success("Request rejected"); load(); } catch (e) { toast.error(e.message); }
  };

  return (
    <div data-testid="approvals-page">
      <PageHeader subtitle="Admin" title="Pending Approvals" />
      <PageBody>
        {loading ? (
          <div className="bg-white border border-stone-200 p-12 text-center text-sm text-stone-500">Loading…</div>
        ) : leads.length === 0 && customers.length === 0 && receipts.length === 0 ? (
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

            {receipts.length > 0 && (
              <div>
                <div className="label-uppercase mb-3 inline-flex items-center gap-1.5">
                  <ReceiptText className="w-3.5 h-3.5" /> Receipts — Delete Requests ({receipts.length})
                </div>
                <div className="bg-white border border-stone-200 overflow-x-auto">
                  <table className="w-full text-sm" data-testid="approvals-receipts-table">
                    <thead className="bg-stone-50 border-b border-stone-200">
                      <tr className="text-left">
                        <th className="px-4 py-3 label-uppercase">Receipt #</th>
                        <th className="px-4 py-3 label-uppercase">Customer</th>
                        <th className="px-4 py-3 label-uppercase">Mode</th>
                        <th className="px-4 py-3 label-uppercase text-right">Amount</th>
                        <th className="px-4 py-3 label-uppercase">Requested By</th>
                        <th className="px-4 py-3 label-uppercase">Requested At</th>
                        <th className="px-4 py-3 label-uppercase text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="grid-divider-y">
                      {receipts.map((r) => (
                        <tr key={r.id} className="hover:bg-stone-50" data-testid={`approval-receipt-${r.id}`}>
                          <td className="px-4 py-3 font-mono font-medium">{r.receipt_no}</td>
                          <td className="px-4 py-3">
                            {r.customer?.name || "—"}
                            <div className="text-xs text-stone-500">{r.customer?.phone}</div>
                          </td>
                          <td className="px-4 py-3 capitalize text-stone-700">{r.payment_mode}</td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatINR(r.amount)}</td>
                          <td className="px-4 py-3 text-stone-700">{r.requested_by?.full_name || r.requested_by?.email || "—"}</td>
                          <td className="px-4 py-3 text-stone-600">{formatDateTime(r.delete_requested_at)}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-2">
                              <Button variant="outline" size="sm" className="rounded-none border-stone-300 hover:bg-stone-100" onClick={() => rejectReceipt(r.id)} data-testid={`approval-receipt-reject-${r.id}`}><Undo2 className="w-3.5 h-3.5 mr-1" />Reject</Button>
                              <Button size="sm" className="rounded-none bg-rose-600 hover:bg-rose-700 text-white" onClick={() => approveReceipt(r.id)} data-testid={`approval-receipt-approve-${r.id}`}><Trash2 className="w-3.5 h-3.5 mr-1" />Delete</Button>
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
