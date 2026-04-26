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
import { createVendor, updateVendor } from "@/services/vendorService";
import { VENDOR_TYPES } from "@/utils/format";
import { toast } from "sonner";

const inputCls = "rounded-none mt-1.5 border-stone-300 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-0";

export default function VendorFormDialog({ open, onOpenChange, vendor, onSaved }) {
  const { user } = useAuth();
  const isEdit = Boolean(vendor?.id);
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, reset, setValue, watch } = useForm();

  useEffect(() => {
    if (!open) return;
    reset({
      name: vendor?.name || "",
      type: vendor?.type || "",
      phone: vendor?.phone || "",
      email: vendor?.email || "",
      address: vendor?.address || "",
      gst_no: vendor?.gst_no || "",
      pan_no: vendor?.pan_no || "",
      aadhar_no: vendor?.aadhar_no || "",
      upi_id: vendor?.upi_id || "",
      account_holder: vendor?.account_holder || "",
      account_no: vendor?.account_no || "",
      ifsc: vendor?.ifsc || "",
      bank_name: vendor?.bank_name || "",
      notes: vendor?.notes || "",
    });
  }, [open, vendor, reset]);

  const onSubmit = async (values) => {
    setSubmitting(true);
    try {
      const payload = Object.fromEntries(
        Object.entries(values).map(([k, v]) => [k, v === "" ? null : v])
      );
      if (isEdit) {
        await updateVendor(vendor.id, payload);
        toast.success("Vendor updated");
      } else {
        await createVendor(payload, user.id);
        toast.success("Vendor added");
      }
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-none border-stone-300 max-w-3xl p-0 max-h-[92vh] overflow-y-auto" data-testid="vendor-form-dialog">
        <DialogHeader className="px-6 py-5 border-b border-stone-200">
          <div className="label-uppercase">{isEdit ? "Edit Vendor" : "New Vendor"}</div>
          <DialogTitle className="font-display text-2xl tracking-tight">{isEdit ? vendor.name : "Add a vendor"}</DialogTitle>
          <DialogDescription className="sr-only">Vendor profile, KYC, and payment details.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid md:grid-cols-2 gap-0 grid-divider-x">
          {/* LEFT — Profile + KYC */}
          <div className="p-6 space-y-4">
            <SectionTitle>Profile</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="label-uppercase">Name *</Label>
                <Input className={inputCls} {...register("name", { required: true })} data-testid="vendor-input-name" />
              </div>
              <div>
                <Label className="label-uppercase">Trade Type</Label>
                <Select value={watch("type") || ""} onValueChange={(v) => setValue("type", v)}>
                  <SelectTrigger className="rounded-none mt-1.5 border-stone-300" data-testid="vendor-select-type"><SelectValue placeholder="Select trade" /></SelectTrigger>
                  <SelectContent className="rounded-none">
                    {VENDOR_TYPES.map((t) => <SelectItem key={t} value={t} className="rounded-none">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="label-uppercase">Phone</Label>
                <Input className={inputCls} {...register("phone")} data-testid="vendor-input-phone" />
              </div>
              <div className="col-span-2">
                <Label className="label-uppercase">Email</Label>
                <Input type="email" className={inputCls} {...register("email")} data-testid="vendor-input-email" />
              </div>
              <div className="col-span-2">
                <Label className="label-uppercase">Address</Label>
                <Textarea className={`${inputCls} min-h-[68px]`} {...register("address")} data-testid="vendor-input-address" />
              </div>
            </div>

            <SectionTitle>KYC / IDs</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="label-uppercase">GST No</Label>
                <Input className={inputCls} {...register("gst_no")} data-testid="vendor-input-gst" />
              </div>
              <div>
                <Label className="label-uppercase">PAN</Label>
                <Input className={inputCls} {...register("pan_no")} data-testid="vendor-input-pan" />
              </div>
              <div className="col-span-2">
                <Label className="label-uppercase">Aadhar No</Label>
                <Input className={inputCls} {...register("aadhar_no")} data-testid="vendor-input-aadhar" />
              </div>
            </div>
          </div>

          {/* RIGHT — Payment Details + Notes */}
          <div className="p-6 space-y-4">
            <SectionTitle>Payment Details</SectionTitle>
            <div>
              <Label className="label-uppercase">UPI ID</Label>
              <Input className={inputCls} {...register("upi_id")} placeholder="vendor@okhdfcbank" data-testid="vendor-input-upi" />
            </div>
            <div>
              <Label className="label-uppercase">Account Holder Name</Label>
              <Input className={inputCls} {...register("account_holder")} data-testid="vendor-input-holder" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="label-uppercase">Bank A/c No</Label>
                <Input className={inputCls} {...register("account_no")} data-testid="vendor-input-account" />
              </div>
              <div>
                <Label className="label-uppercase">IFSC</Label>
                <Input className={inputCls} {...register("ifsc")} data-testid="vendor-input-ifsc" />
              </div>
            </div>
            <div>
              <Label className="label-uppercase">Bank Name &amp; Branch</Label>
              <Input className={inputCls} {...register("bank_name")} data-testid="vendor-input-bank" />
            </div>

            <SectionTitle>Notes</SectionTitle>
            <Textarea className={`${inputCls} min-h-[120px]`} {...register("notes")} placeholder="Internal notes about this vendor — preferred work, rates, quirks…" data-testid="vendor-input-notes" />
          </div>

          <DialogFooter className="md:col-span-2 px-6 py-4 border-t border-stone-200 bg-stone-50 flex-row justify-between items-center">
            <div className="text-[10px] tracking-widest uppercase text-stone-500">
              Photo / ID / Visiting card upload available after creating the vendor.
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="rounded-none border-stone-300" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting} className="rounded-none bg-stone-900 hover:bg-stone-800 text-white" data-testid="vendor-form-submit">
                {submitting ? "Saving…" : isEdit ? "Save Changes" : "Add Vendor"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SectionTitle({ children }) {
  return <div className="text-[10px] tracking-[0.18em] uppercase font-bold text-orange-600 border-b border-stone-200 pb-1.5">{children}</div>;
}
