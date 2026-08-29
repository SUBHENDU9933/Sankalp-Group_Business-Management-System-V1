import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { createVendorPayment, fetchVendorBills } from "@/services/vendorService";
import { todayISO, formatINR } from "@/utils/format";
import { toast } from "sonner";

const inputCls = "rounded-none mt-1.5 border-stone-300 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-0";

export default function VendorPaymentDialog({
  open, onOpenChange, vendors = [], projects = [],
  defaultVendorId, defaultProjectId,
  lockVendor = false, lockProject = false,
  onSaved,
}) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [bills, setBills] = useState([]);
  const { register, handleSubmit, reset, setValue, watch } = useForm();
  const vendorId = watch("vendor_id");
  const paymentType = watch("payment_type") || "advance";

  useEffect(() => {
    if (!open) return;
    reset({
      vendor_id: defaultVendorId || "",
      project_id: defaultProjectId || "",
      amount: "",
      payment_date: todayISO(),
      payment_mode: "upi",
      payment_type: "advance",
      bill_id: "",
      note: "",
    });
  }, [open, defaultVendorId, defaultProjectId, reset]);

  // Load this vendor's bills (so "Against Bill" can offer a picker with each
  // bill's remaining balance) whenever the selected vendor changes.
  useEffect(() => {
    if (!open || !vendorId) { setBills([]); return; }
    fetchVendorBills(vendorId).then(setBills).catch(() => setBills([]));
  }, [open, vendorId]);

  const onSubmit = async (values) => {
    if (!values.vendor_id) { toast.error("Select a vendor"); return; }
    if (values.payment_type === "against_bill" && !values.bill_id) { toast.error("Select which bill this payment is against"); return; }
    setSubmitting(true);
    try {
      await createVendorPayment({
        vendor_id: values.vendor_id,
        project_id: values.project_id || null,
        amount: Number(values.amount),
        payment_date: values.payment_date,
        payment_type: values.payment_type || "advance",
        bill_id: values.payment_type === "against_bill" ? values.bill_id : null,
        note: [values.payment_mode ? `[${values.payment_mode.toUpperCase()}]` : null, values.note].filter(Boolean).join(" "),
      }, user.id);
      toast.success("Payment recorded");
      onSaved?.(); onOpenChange(false);
    } catch (e) { toast.error(e.message); }
    finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-none border-stone-300 max-w-md p-0" data-testid="vendor-payment-dialog">
        <DialogHeader className="px-6 py-5 border-b border-stone-200">
          <div className="label-uppercase">Record Payment</div>
          <DialogTitle className="font-display text-2xl tracking-tight">Vendor Payment</DialogTitle>
          <DialogDescription className="sr-only">Record a payment to a vendor, optionally linked to a project.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <Label className="label-uppercase">Vendor *</Label>
            <Select value={watch("vendor_id") || ""} onValueChange={(v) => setValue("vendor_id", v)} disabled={lockVendor}>
              <SelectTrigger className="rounded-none mt-1.5 border-stone-300 disabled:opacity-100 disabled:bg-stone-50" data-testid="payment-select-vendor"><SelectValue placeholder="Select vendor" /></SelectTrigger>
              <SelectContent className="rounded-none">
                {vendors.map((v) => <SelectItem key={v.id} value={v.id} className="rounded-none">{v.name} <span className="text-stone-500 ml-1">({v.type || "—"})</span></SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="label-uppercase">Project</Label>
            <Select value={watch("project_id") || ""} onValueChange={(v) => setValue("project_id", v)} disabled={lockProject}>
              <SelectTrigger className="rounded-none mt-1.5 border-stone-300 disabled:opacity-100 disabled:bg-stone-50"><SelectValue placeholder="Link to project (optional)" /></SelectTrigger>
              <SelectContent className="rounded-none">
                {projects.map((p) => <SelectItem key={p.id} value={p.id} className="rounded-none">{p.project_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="label-uppercase">This payment is</Label>
            <div className="flex gap-2 mt-1.5">
              <button
                type="button"
                onClick={() => setValue("payment_type", "advance")}
                className={`flex-1 rounded-none border px-3 py-2 text-sm font-medium transition-colors ${paymentType === "advance" ? "border-blue-700 bg-blue-50 text-blue-800" : "border-stone-300 text-stone-500 hover:bg-stone-50"}`}
                data-testid="payment-type-advance"
              >
                Advance <span className="text-[10px] font-normal">(no bill yet)</span>
              </button>
              <button
                type="button"
                onClick={() => setValue("payment_type", "against_bill")}
                className={`flex-1 rounded-none border px-3 py-2 text-sm font-medium transition-colors ${paymentType === "against_bill" ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-stone-300 text-stone-500 hover:bg-stone-50"}`}
                data-testid="payment-type-against-bill"
              >
                Against a Bill
              </button>
            </div>
          </div>
          {paymentType === "against_bill" && (
            <div>
              <Label className="label-uppercase">Which Bill *</Label>
              <Select value={watch("bill_id") || ""} onValueChange={(v) => setValue("bill_id", v)}>
                <SelectTrigger className="rounded-none mt-1.5 border-stone-300" data-testid="payment-select-bill"><SelectValue placeholder={bills.length === 0 ? "No bills recorded for this vendor yet" : "Select bill"} /></SelectTrigger>
                <SelectContent className="rounded-none">
                  {bills.map((b) => <SelectItem key={b.id} value={b.id} className="rounded-none">{b.title} — {formatINR(b.amount)}</SelectItem>)}
                </SelectContent>
              </Select>
              {bills.length === 0 && <div className="text-[11px] text-stone-500 mt-1">Add a Work/Bill entry for this vendor first, then link payments to it.</div>}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="label-uppercase">Amount (₹) *</Label>
              <Input type="number" step="0.01" className={inputCls} {...register("amount", { required: true })} data-testid="payment-input-amount" />
            </div>
            <div>
              <Label className="label-uppercase">Payment Date *</Label>
              <Input type="date" className={inputCls} {...register("payment_date", { required: true })} data-testid="payment-input-date" />
            </div>
          </div>
          <div>
            <Label className="label-uppercase">Mode</Label>
            <Select value={watch("payment_mode") || "upi"} onValueChange={(v) => setValue("payment_mode", v)}>
              <SelectTrigger className="rounded-none mt-1.5 border-stone-300"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-none">
                <SelectItem value="upi" className="rounded-none">UPI</SelectItem>
                <SelectItem value="bank" className="rounded-none">Bank Transfer</SelectItem>
                <SelectItem value="cash" className="rounded-none">Cash</SelectItem>
                <SelectItem value="cheque" className="rounded-none">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="label-uppercase">Note</Label>
            <Textarea className={inputCls} {...register("note")} data-testid="payment-input-note" />
          </div>
          <DialogFooter className="-mx-6 -mb-6 px-6 py-4 border-t border-stone-200 bg-stone-50 flex-row justify-end gap-2">
            <Button type="button" variant="outline" className="rounded-none border-stone-300" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting} className="rounded-none bg-stone-900 hover:bg-stone-800 text-white" data-testid="payment-form-submit">{submitting ? "Saving…" : "Record Payment"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
