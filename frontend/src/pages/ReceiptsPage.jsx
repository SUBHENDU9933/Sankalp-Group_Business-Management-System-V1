import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageHeader, PageBody } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Chip } from "@/components/shared/StatusBadge";
import { Plus, Search, Printer, ReceiptText, MoreVertical, Pencil, Trash2, X } from "lucide-react";
import {
  fetchReceipts, createReceipt, updateReceipt, addReceiptAttachment,
  requestDeleteReceipt, cancelDeleteReceipt,
} from "@/services/receiptService";
import { uploadFile } from "@/services/attachmentService";
import { fetchCustomers } from "@/services/customerService";
import { fetchLeads } from "@/services/leadService";
import { useAuth } from "@/contexts/AuthContext";
import { formatINR, formatDate, PAYMENT_MODES } from "@/utils/format";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function ReceiptsPage() {
  const { user, isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const preselectCustomer = searchParams.get("customer");
  const [list, setList] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editReceipt, setEditReceipt] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [r, c, l] = await Promise.all([fetchReceipts(), fetchCustomers(), fetchLeads()]);
      setList(r);
      setCustomers(c);
      setLeads(l.filter((x) => x.status !== "converted"));
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { if (preselectCustomer && !loading) setOpen(true); }, [preselectCustomer, loading]);

  const filtered = useMemo(() => list.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (r.receipt_no || "").toLowerCase().includes(s) ||
      (r.customer?.name || "").toLowerCase().includes(s) ||
      (r.customer?.phone || "").includes(s) ||
      (r.lead?.name || "").toLowerCase().includes(s) ||
      (r.lead?.phone || "").includes(s)
    );
  }), [list, search]);

  const total = filtered.reduce((s, r) => s + Number(r.amount || 0), 0);
  const pendingDeletes = list.filter((r) => r.delete_request).length;

  const handleRequestDelete = async (r) => {
    if (!window.confirm(`Request admin to delete receipt ${r.receipt_no}?`)) return;
    try { await requestDeleteReceipt(r.id); toast.success("Delete request sent for admin approval"); load(); }
    catch (e) { toast.error(e.message); }
  };
  const handleCancelDelete = async (r) => {
    try { await cancelDeleteReceipt(r.id); toast.success("Delete request cancelled"); load(); }
    catch (e) { toast.error(e.message); }
  };

  const openNew = () => { setEditReceipt(null); setOpen(true); };
  const openEdit = (r) => { setEditReceipt(r); setOpen(true); };

  return (
    <div data-testid="receipts-page">
      <PageHeader
        subtitle="Phase 4"
        title="Receipts &amp; Payments"
        actions={
          <Button onClick={openNew} className="rounded-none bg-orange-500 hover:bg-orange-600 text-white" data-testid="receipt-add-button">
            <Plus className="w-4 h-4" /> New Receipt
          </Button>
        }
      />
      <PageBody>
        <div className="bg-white border border-stone-200 flex items-center gap-3 px-4 py-3 flex-wrap">
          <Search className="w-4 h-4 text-stone-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search receipt no, customer…" className="border-0 shadow-none focus-visible:ring-0 px-0 rounded-none h-8 max-w-md" data-testid="receipts-search" />
          <div className="flex-1" />
          {pendingDeletes > 0 && (
            <Link to="/approvals" data-testid="receipts-pending-chip">
              <Chip className="bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 cursor-pointer">
                {pendingDeletes} delete request{pendingDeletes > 1 ? "s" : ""} pending
              </Chip>
            </Link>
          )}
          <Chip>Receipts: {filtered.length}</Chip>
          <Chip className="bg-stone-900 text-white border-stone-900">Total: {formatINR(total)}</Chip>
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="bg-white border border-stone-200 p-12 text-center text-sm text-stone-500">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="bg-white border border-stone-200 p-12 text-center" data-testid="receipts-empty">
              <ReceiptText className="w-10 h-10 mx-auto text-stone-300" />
              <div className="font-display text-xl font-bold tracking-tight mt-3">No receipts yet</div>
              <p className="text-sm text-stone-500 mt-2">Generate your first receipt for a customer.</p>
            </div>
          ) : (
            <div className="bg-white border border-stone-200 overflow-x-auto">
              <table className="w-full text-sm" data-testid="receipts-table">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr className="text-left">
                    <th className="px-4 py-3 label-uppercase">Receipt #</th>
                    <th className="px-4 py-3 label-uppercase">Customer</th>
                    <th className="px-4 py-3 label-uppercase">Mode</th>
                    <th className="px-4 py-3 label-uppercase">Note</th>
                    <th className="px-4 py-3 label-uppercase">Date</th>
                    <th className="px-4 py-3 label-uppercase text-right">Amount</th>
                    <th className="px-4 py-3 label-uppercase text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="grid-divider-y">
                  {filtered.map((r) => (
                    <tr
                      key={r.id}
                      className={cn("hover:bg-stone-50", r.delete_request && "bg-rose-50/40")}
                      data-testid={`receipt-row-${r.id}`}
                    >
                      <td className="px-4 py-3 font-mono font-medium">
                        {r.receipt_no}
                        {r.delete_request && (
                          <div className="text-[10px] tracking-widest uppercase text-rose-600 mt-1 font-semibold" data-testid={`receipt-pending-${r.id}`}>
                            Delete pending
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.customer?.name || r.lead?.name || "—"}
                        {!r.customer && r.lead && (
                          <span className="ml-1.5 text-[9px] tracking-widest uppercase font-bold text-amber-700 bg-amber-50 border border-amber-300 px-1.5 py-0.5 rounded">Lead</span>
                        )}
                        <div className="text-xs text-stone-500">{r.customer?.phone || r.lead?.phone}</div>
                      </td>
                      <td className="px-4 py-3 capitalize text-stone-700">{r.payment_mode}</td>
                      <td className="px-4 py-3 text-stone-700 max-w-[260px] truncate">{r.note || "—"}</td>
                      <td className="px-4 py-3 text-stone-600">{formatDate(r.created_at)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{formatINR(r.amount)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Link to={`/receipts/${r.id}/print`} target="_blank" rel="noreferrer" data-testid={`receipt-print-${r.id}`}>
                            <Button variant="outline" size="sm" className="rounded-none border-stone-300 hover:bg-stone-100"><Printer className="w-3.5 h-3.5 mr-1" />Print</Button>
                          </Link>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="rounded-none h-8 w-8" data-testid={`receipt-actions-${r.id}`}>
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-none border-stone-300">
                              <DropdownMenuItem className="rounded-none cursor-pointer" onClick={() => openEdit(r)} data-testid={`receipt-edit-${r.id}`}>
                                <Pencil className="w-4 h-4 mr-2" />Edit
                              </DropdownMenuItem>
                              {r.delete_request ? (
                                <DropdownMenuItem className="rounded-none cursor-pointer" onClick={() => handleCancelDelete(r)} data-testid={`receipt-cancel-delete-${r.id}`}>
                                  <X className="w-4 h-4 mr-2" />Cancel Delete Request
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem className="rounded-none cursor-pointer text-rose-600" onClick={() => handleRequestDelete(r)} data-testid={`receipt-request-delete-${r.id}`}>
                                  <Trash2 className="w-4 h-4 mr-2" />Request Delete
                                </DropdownMenuItem>
                              )}
                              {isAdmin && r.delete_request && (
                                <DropdownMenuItem asChild className="rounded-none cursor-pointer text-rose-700">
                                  <Link to="/approvals" data-testid={`receipt-goto-approvals-${r.id}`}>
                                    <Trash2 className="w-4 h-4 mr-2" />Approve in /approvals
                                  </Link>
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </PageBody>

      <ReceiptFormDialog
        open={open}
        onOpenChange={(v) => { setOpen(v); if (!v) setEditReceipt(null); }}
        customers={customers}
        leads={leads}
        defaultCustomerId={preselectCustomer || ""}
        receipt={editReceipt}
        onSaved={load}
      />
    </div>
  );
}

function ReceiptFormDialog({ open, onOpenChange, customers, leads, defaultCustomerId, receipt, onSaved }) {
  const { user } = useAuth();
  const isEdit = Boolean(receipt?.id);
  const [submitting, setSubmitting] = useState(false);
  const [projects, setProjects] = useState([]);
  const [attachments, setAttachments] = useState([]);   // {url, name, type, size}
  const [uploadingAttach, setUploadingAttach] = useState(false);
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm();
  const forType = watch("for_type") || "customer";

  useEffect(() => {
    if (!open) return;
    setAttachments([]);
    // datetime-local wants "YYYY-MM-DDTHH:mm" in *local* time — build that
    // from the receipt's timestamp when editing, or from right now when creating.
    const toLocalInputValue = (iso) => {
      const d = iso ? new Date(iso) : new Date();
      const pad = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    reset({
      for_type: receipt?.lead_id && !receipt?.customer_id ? "lead" : "customer",
      customer_id: receipt?.customer_id || defaultCustomerId || "",
      lead_id: receipt?.lead_id || "",
      project_id: receipt?.project_id || "",
      amount: receipt?.amount ?? "",
      payment_mode: receipt?.payment_mode || "cash",
      payment_purpose: receipt?.payment_purpose || "advance",
      transaction_ref: receipt?.transaction_ref || "",
      note: receipt?.note || "",
      receipt_date: toLocalInputValue(receipt?.created_at),
    });
  }, [open, defaultCustomerId, receipt, reset]);

  const handleAttachUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingAttach(true);
    try {
      const results = [];
      for (const f of files) {
        const r = await uploadFile(f, "receipts");
        results.push(r);
      }
      setAttachments((prev) => [...prev, ...results]);
      toast.success(`Attached ${results.length} file(s)`);
    } catch (err) { toast.error(err.message); }
    finally { setUploadingAttach(false); e.target.value = ""; }
  };
  const removeAttachment = (idx) => setAttachments((prev) => prev.filter((_, i) => i !== idx));

  // load projects for selected customer
  const cid = watch("customer_id");
  useEffect(() => {
    if (!cid) { setProjects([]); return; }
    (async () => {
      const { supabase } = await import("@/lib/supabase");
      const { data } = await supabase.from("projects").select("id,project_name").eq("customer_id", cid).order("created_at", { ascending: false });
      setProjects(data || []);
    })();
  }, [cid]);

  const onSubmit = async (values) => {
    if (values.for_type === "lead") {
      if (!values.lead_id) { toast.error("Select a lead"); return; }
    } else if (!values.customer_id) {
      toast.error("Select a customer"); return;
    }
    setSubmitting(true);
    const payload = {
      customer_id: values.for_type === "lead" ? null : values.customer_id,
      lead_id: values.for_type === "lead" ? values.lead_id : null,
      project_id: values.for_type === "lead" ? null : (values.project_id || null),
      amount: Number(values.amount),
      payment_mode: values.payment_mode,
      payment_purpose: values.payment_purpose || null,
      transaction_ref: values.transaction_ref || null,
      note: values.note || null,
      created_at: values.receipt_date ? new Date(values.receipt_date).toISOString() : new Date().toISOString(),
    };
    try {
      if (isEdit) {
        await updateReceipt(receipt.id, payload);
        // add new attachments (if any)
        for (const a of attachments) {
          try { await addReceiptAttachment({ receiptId: receipt.id, url: a.url, name: a.name, type: a.type, size: a.size, userId: user.id }); }
          catch (attachErr) { console.warn("Attachment save failed:", attachErr); }
        }
        toast.success(`Receipt ${receipt.receipt_no} updated`);
        onSaved?.();
        onOpenChange(false);
      } else {
        const printWindow = window.open("", "_blank");
        try {
          const r = await createReceipt(payload, user.id);
          for (const a of attachments) {
            try { await addReceiptAttachment({ receiptId: r.id, url: a.url, name: a.name, type: a.type, size: a.size, userId: user.id }); }
            catch (attachErr) { console.warn("Attachment save failed:", attachErr); }
          }
          toast.success(`Receipt ${r.receipt_no} created`);
          onSaved?.();
          onOpenChange(false);
          if (printWindow) printWindow.location.href = `/receipts/${r.id}/print`;
        } catch (createErr) {
          if (printWindow) printWindow.close();
          throw createErr;
        }
      }
    } catch (e) {
      toast.error(e.message);
    }
    finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-xl border-slate-200 max-w-xl p-0" data-testid="receipt-form-dialog">
        <DialogHeader className="px-6 py-5 border-b border-slate-200">
          <div className="label-uppercase">{isEdit ? `Edit Receipt · ${receipt.receipt_no}` : "New Receipt"}</div>
          <DialogTitle className="font-display text-2xl tracking-tight">
            {isEdit ? "Update Payment Receipt" : "Generate Payment Receipt"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isEdit ? "Edit the details of an existing receipt." : "Record a customer payment. Receipt number generated automatically."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {!isEdit && (
            <div>
              <Label className="label-uppercase">For</Label>
              <div className="flex gap-2 mt-1.5">
                <button
                  type="button"
                  onClick={() => { setValue("for_type", "customer"); setValue("lead_id", ""); }}
                  className={cn("flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    forType === "customer" ? "border-blue-700 bg-blue-50 text-blue-800" : "border-slate-200 text-slate-500 hover:bg-slate-50")}
                  data-testid="receipt-for-customer"
                >
                  Customer
                </button>
                <button
                  type="button"
                  onClick={() => { setValue("for_type", "lead"); setValue("customer_id", ""); }}
                  className={cn("flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    forType === "lead" ? "border-amber-600 bg-amber-50 text-amber-800" : "border-slate-200 text-slate-500 hover:bg-slate-50")}
                  data-testid="receipt-for-lead"
                >
                  Lead <span className="text-[10px] font-normal">(not yet a customer)</span>
                </button>
              </div>
            </div>
          )}

          {forType === "lead" ? (
            <div>
              <Label className="label-uppercase">Lead *</Label>
              <Select value={watch("lead_id") || ""} onValueChange={(v) => setValue("lead_id", v)}>
                <SelectTrigger className="rounded-lg mt-1.5 border-slate-200" data-testid="receipt-select-lead"><SelectValue placeholder="Select lead" /></SelectTrigger>
                <SelectContent className="rounded-lg">
                  {leads.map((l) => <SelectItem key={l.id} value={l.id}>{l.name} <span className="text-slate-500 ml-1">({l.phone})</span></SelectItem>)}
                </SelectContent>
              </Select>
              <div className="text-[11px] text-amber-700 mt-1">This receipt will automatically link to their customer record once they convert.</div>
            </div>
          ) : (
            <div>
              <Label className="label-uppercase">Customer *</Label>
              <Select value={watch("customer_id") || ""} onValueChange={(v) => setValue("customer_id", v)} disabled={isEdit && !receipt?.customer_id}>
                <SelectTrigger className="rounded-lg mt-1.5 border-slate-200" data-testid="receipt-select-customer"><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent className="rounded-lg">
                  {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} <span className="text-slate-500 ml-1">({c.phone})</span></SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {forType === "customer" && (
            <div>
              <Label className="label-uppercase">Project (optional)</Label>
              <Select value={watch("project_id") || ""} onValueChange={(v) => setValue("project_id", v)} disabled={!cid || projects.length === 0}>
                <SelectTrigger className="rounded-lg mt-1.5 border-slate-200" data-testid="receipt-select-project"><SelectValue placeholder={projects.length === 0 ? "No projects for this customer" : "Link to project"} /></SelectTrigger>
                <SelectContent className="rounded-lg">
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.project_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="label-uppercase">Amount (₹) *</Label>
              <Input type="number" step="0.01" className="rounded-lg mt-1.5 border-slate-200 focus-visible:ring-2 focus-visible:ring-blue-700" {...register("amount", { required: true, min: 0.01 })} data-testid="receipt-input-amount" />
              {errors.amount && <span className="text-xs text-rose-600">Required (&gt; 0)</span>}
            </div>
            <div>
              <Label className="label-uppercase">Payment Mode</Label>
              <Select value={watch("payment_mode") || "cash"} onValueChange={(v) => setValue("payment_mode", v)}>
                <SelectTrigger className="rounded-lg mt-1.5 border-slate-200" data-testid="receipt-select-mode"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-lg">
                  {PAYMENT_MODES.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="label-uppercase">Date &amp; Time</Label>
            <Input type="datetime-local" className="rounded-lg mt-1.5 border-slate-200 focus-visible:ring-2 focus-visible:ring-blue-700" {...register("receipt_date", { required: true })} data-testid="receipt-input-date" />
            <div className="text-[11px] text-slate-400 mt-1">Defaults to now — change it if you're recording a payment that happened earlier.</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="label-uppercase">Payment Purpose</Label>
              <Select value={watch("payment_purpose") || "advance"} onValueChange={(v) => setValue("payment_purpose", v)}>
                <SelectTrigger className="rounded-lg mt-1.5 border-slate-200" data-testid="receipt-select-purpose"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-lg">
                  <SelectItem value="advance">Advance</SelectItem>
                  <SelectItem value="token">Token</SelectItem>
                  <SelectItem value="part">Part Payment</SelectItem>
                  <SelectItem value="visit_charge">Visit Charge</SelectItem>
                  <SelectItem value="consultancy_charge">Consultancy Charge</SelectItem>
                  <SelectItem value="others">Others</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="label-uppercase">Transaction Ref No.</Label>
              <Input className="rounded-lg mt-1.5 border-slate-200 focus-visible:ring-2 focus-visible:ring-blue-700" {...register("transaction_ref")} data-testid="receipt-input-ref" placeholder="UPI / Cheque / UTR no." />
            </div>
          </div>
          <div>
            <Label className="label-uppercase">Note</Label>
            <Textarea className="rounded-lg mt-1.5 border-slate-200 focus-visible:ring-2 focus-visible:ring-blue-700" {...register("note")} data-testid="receipt-input-note" />
          </div>
          <div>
            <Label className="label-uppercase">
              {isEdit ? "Add New Attachments" : "Payment Proof / Attachments"}
            </Label>
            <div className="text-[11px] text-slate-500 mb-2">
              {isEdit
                ? "Any files added here will be appended to the existing receipt. Existing files can be managed from the Print view."
                : "UPI screenshot, cheque photo, bank statement, PDF etc. Will print on page 2 of the receipt."}
            </div>
            <label className="cursor-pointer border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 rounded-lg block p-4 text-center text-xs text-slate-600" data-testid="receipt-attach-picker">
              {uploadingAttach ? "Uploading…" : "Click to attach files (photos or PDF)"}
              <input type="file" multiple accept="image/*,.pdf" onChange={handleAttachUpload} className="hidden" />
            </label>
            {attachments.length > 0 && (
              <div className="mt-2 space-y-1" data-testid="receipt-attach-list">
                {attachments.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs bg-slate-50 border border-slate-200 px-2 py-1 rounded">
                    <span className="flex-1 truncate">{a.name} <span className="text-slate-400">({Math.round((a.size || 0) / 1024)} KB)</span></span>
                    <button type="button" onClick={() => removeAttachment(i)} className="text-rose-600 hover:text-rose-700 text-xs">Remove</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="-mx-6 -mb-6 px-6 py-4 border-t border-slate-200 bg-slate-50">
            <Button type="button" variant="outline" className="rounded-lg" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting} className="rounded-lg bg-blue-700 hover:bg-blue-800 text-white" data-testid="receipt-form-submit">
              {submitting ? "Saving…" : isEdit ? "Save Changes" : "Generate Receipt"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
