import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageHeader, PageBody } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Chip } from "@/components/shared/StatusBadge";
import { Plus, Search, Printer, ReceiptText } from "lucide-react";
import { fetchReceipts, createReceipt } from "@/services/receiptService";
import { fetchCustomers } from "@/services/customerService";
import { useAuth } from "@/contexts/AuthContext";
import { formatINR, formatDate, PAYMENT_MODES } from "@/utils/format";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

export default function ReceiptsPage() {
  const [searchParams] = useSearchParams();
  const preselectCustomer = searchParams.get("customer");
  const [list, setList] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [r, c] = await Promise.all([fetchReceipts(), fetchCustomers()]);
      setList(r);
      setCustomers(c);
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
      (r.customer?.phone || "").includes(s)
    );
  }), [list, search]);

  const total = filtered.reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <div data-testid="receipts-page">
      <PageHeader
        subtitle="Phase 4"
        title="Receipts &amp; Payments"
        actions={
          <Button onClick={() => setOpen(true)} className="rounded-none bg-orange-500 hover:bg-orange-600 text-white" data-testid="receipt-add-button">
            <Plus className="w-4 h-4" /> New Receipt
          </Button>
        }
      />
      <PageBody>
        <div className="bg-white border border-stone-200 flex items-center gap-3 px-4 py-3 flex-wrap">
          <Search className="w-4 h-4 text-stone-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search receipt no, customer…" className="border-0 shadow-none focus-visible:ring-0 px-0 rounded-none h-8 max-w-md" data-testid="receipts-search" />
          <div className="flex-1" />
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
                    <tr key={r.id} className="hover:bg-stone-50" data-testid={`receipt-row-${r.id}`}>
                      <td className="px-4 py-3 font-mono font-medium">{r.receipt_no}</td>
                      <td className="px-4 py-3">{r.customer?.name || "—"}<div className="text-xs text-stone-500">{r.customer?.phone}</div></td>
                      <td className="px-4 py-3 capitalize text-stone-700">{r.payment_mode}</td>
                      <td className="px-4 py-3 text-stone-700 max-w-[260px] truncate">{r.note || "—"}</td>
                      <td className="px-4 py-3 text-stone-600">{formatDate(r.created_at)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{formatINR(r.amount)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link to={`/receipts/${r.id}/print`} target="_blank" rel="noreferrer" data-testid={`receipt-print-${r.id}`}>
                          <Button variant="outline" size="sm" className="rounded-none border-stone-300 hover:bg-stone-100"><Printer className="w-3.5 h-3.5 mr-1" />Print</Button>
                        </Link>
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
        onOpenChange={setOpen}
        customers={customers}
        defaultCustomerId={preselectCustomer || ""}
        onSaved={load}
      />
    </div>
  );
}

function ReceiptFormDialog({ open, onOpenChange, customers, defaultCustomerId, onSaved }) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm();

  useEffect(() => {
    if (!open) return;
    reset({
      customer_id: defaultCustomerId || "",
      amount: "",
      payment_mode: "cash",
      note: "",
    });
  }, [open, defaultCustomerId, reset]);

  const onSubmit = async (values) => {
    if (!values.customer_id) { toast.error("Select a customer"); return; }
    setSubmitting(true);
    try {
      const r = await createReceipt({
        customer_id: values.customer_id,
        amount: Number(values.amount),
        payment_mode: values.payment_mode,
        note: values.note || null,
      }, user.id);
      toast.success(`Receipt ${r.receipt_no} created`);
      onSaved?.();
      onOpenChange(false);
      window.open(`/receipts/${r.id}/print`, "_blank");
    } catch (e) { toast.error(e.message); }
    finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-none border-stone-300 max-w-xl p-0" data-testid="receipt-form-dialog">
        <DialogHeader className="px-6 py-5 border-b border-stone-200">
          <div className="label-uppercase">New Receipt</div>
          <DialogTitle className="font-display text-2xl tracking-tight">Generate Payment Receipt</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <Label className="label-uppercase">Customer *</Label>
            <Select value={watch("customer_id") || ""} onValueChange={(v) => setValue("customer_id", v)}>
              <SelectTrigger className="rounded-none mt-1.5 border-stone-300" data-testid="receipt-select-customer"><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent className="rounded-none">
                {customers.map((c) => <SelectItem key={c.id} value={c.id} className="rounded-none">{c.name} <span className="text-stone-500 ml-1">({c.phone})</span></SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="label-uppercase">Amount (₹) *</Label>
              <Input type="number" step="0.01" className="rounded-none mt-1.5 border-stone-300 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-0" {...register("amount", { required: true, min: 0.01 })} data-testid="receipt-input-amount" />
              {errors.amount && <span className="text-xs text-rose-600">Required (&gt; 0)</span>}
            </div>
            <div>
              <Label className="label-uppercase">Payment Mode</Label>
              <Select value={watch("payment_mode") || "cash"} onValueChange={(v) => setValue("payment_mode", v)}>
                <SelectTrigger className="rounded-none mt-1.5 border-stone-300" data-testid="receipt-select-mode"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-none">
                  {PAYMENT_MODES.map((m) => <SelectItem key={m.key} value={m.key} className="rounded-none">{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="label-uppercase">Note</Label>
            <Textarea className="rounded-none mt-1.5 border-stone-300 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-0" {...register("note")} data-testid="receipt-input-note" />
          </div>
          <DialogFooter className="-mx-6 -mb-6 px-6 py-4 border-t border-stone-200 bg-stone-50">
            <Button type="button" variant="outline" className="rounded-none border-stone-300" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting} className="rounded-none bg-stone-900 hover:bg-stone-800 text-white" data-testid="receipt-form-submit">{submitting ? "Saving…" : "Generate Receipt"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
