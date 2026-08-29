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
import { createVendorBill } from "@/services/vendorService";
import { todayISO } from "@/utils/format";
import { toast } from "sonner";

const inputCls = "rounded-none mt-1.5 border-stone-300 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-0";

export default function VendorBillDialog({
  open, onOpenChange, vendors = [], projects = [],
  defaultVendorId, defaultProjectId,
  lockVendor = false, lockProject = false,
  onSaved,
}) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, reset, setValue, watch } = useForm();

  useEffect(() => {
    if (!open) return;
    reset({
      vendor_id: defaultVendorId || "",
      project_id: defaultProjectId || "",
      title: "",
      amount: "",
      bill_date: todayISO(),
      description: "",
    });
  }, [open, defaultVendorId, defaultProjectId, reset]);

  const onSubmit = async (values) => {
    if (!values.vendor_id) { toast.error("Select a vendor"); return; }
    if (!values.title.trim()) { toast.error("Give this bill a short title"); return; }
    setSubmitting(true);
    try {
      await createVendorBill({
        vendor_id: values.vendor_id,
        project_id: values.project_id || null,
        title: values.title.trim(),
        description: values.description?.trim() || null,
        amount: Number(values.amount),
        bill_date: values.bill_date,
      }, user.id);
      toast.success("Bill recorded");
      onSaved?.(); onOpenChange(false);
    } catch (e) { toast.error(e.message); }
    finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-none border-stone-300 max-w-md p-0" data-testid="vendor-bill-dialog">
        <DialogHeader className="px-6 py-5 border-b border-stone-200">
          <div className="label-uppercase">Work Done / Bill</div>
          <DialogTitle className="font-display text-2xl tracking-tight">Add Vendor Bill</DialogTitle>
          <DialogDescription className="text-xs text-stone-500 mt-1">
            One big bill at project completion, or a small one every week — whatever matches how this vendor actually gets billed.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <Label className="label-uppercase">Vendor *</Label>
            <Select value={watch("vendor_id") || ""} onValueChange={(v) => setValue("vendor_id", v)} disabled={lockVendor}>
              <SelectTrigger className="rounded-none mt-1.5 border-stone-300 disabled:opacity-100 disabled:bg-stone-50" data-testid="bill-select-vendor"><SelectValue placeholder="Select vendor" /></SelectTrigger>
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
            <Label className="label-uppercase">Title *</Label>
            <Input placeholder="e.g. Final bill — wiring & fittings, or Week 1 labor" className={inputCls} {...register("title", { required: true })} data-testid="bill-input-title" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="label-uppercase">Bill Amount (₹) *</Label>
              <Input type="number" step="0.01" className={inputCls} {...register("amount", { required: true })} data-testid="bill-input-amount" />
            </div>
            <div>
              <Label className="label-uppercase">Bill Date *</Label>
              <Input type="date" className={inputCls} {...register("bill_date", { required: true })} data-testid="bill-input-date" />
            </div>
          </div>
          <div>
            <Label className="label-uppercase">Details (optional)</Label>
            <Textarea placeholder="Points/fittings measured, days worked, rate used, etc." className={inputCls} {...register("description")} data-testid="bill-input-description" />
          </div>
          <DialogFooter className="-mx-6 -mb-6 px-6 py-4 border-t border-stone-200 bg-stone-50 flex-row justify-end gap-2">
            <Button type="button" variant="outline" className="rounded-none border-stone-300" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting} className="rounded-none bg-stone-900 hover:bg-stone-800 text-white" data-testid="bill-form-submit">{submitting ? "Saving…" : "Add Bill"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
