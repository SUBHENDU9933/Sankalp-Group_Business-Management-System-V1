import { useEffect, useState, useMemo } from "react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Chip } from "@/components/shared/StatusBadge";
import { Plus, Search, Truck, Wallet } from "lucide-react";
import { fetchVendors, createVendor, fetchVendorPayments, createVendorPayment } from "@/services/vendorService";
import { fetchProjects } from "@/services/projectService";
import { useAuth } from "@/contexts/AuthContext";
import { formatINR, formatDate, VENDOR_TYPES, todayISO } from "@/utils/format";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

export default function VendorsPage() {
  const [vendors, setVendors] = useState([]);
  const [payments, setPayments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [vOpen, setVOpen] = useState(false);
  const [pOpen, setPOpen] = useState(false);
  const [presetVendor, setPresetVendor] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [v, p, pr] = await Promise.all([fetchVendors(), fetchVendorPayments(), fetchProjects()]);
      setVendors(v); setPayments(p); setProjects(pr);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filteredVendors = useMemo(() => vendors.filter((v) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (v.name || "").toLowerCase().includes(s) || (v.type || "").toLowerCase().includes(s) || (v.phone || "").includes(s);
  }), [vendors, search]);

  const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);

  return (
    <div data-testid="vendors-page">
      <PageHeader
        subtitle="Phase 6"
        title="Vendor Management"
        actions={
          <>
            <Button variant="outline" onClick={() => { setPresetVendor(null); setPOpen(true); }} className="rounded-none border-stone-300 hover:bg-stone-100" data-testid="vendor-payment-button"><Wallet className="w-4 h-4 mr-1" />Record Payment</Button>
            <Button onClick={() => setVOpen(true)} className="rounded-none bg-orange-500 hover:bg-orange-600 text-white" data-testid="vendor-add-button"><Plus className="w-4 h-4" />New Vendor</Button>
          </>
        }
      />
      <PageBody>
        <Tabs defaultValue="vendors">
          <TabsList className="rounded-none bg-white border border-stone-300 p-0 h-10">
            <TabsTrigger value="vendors" className="rounded-none data-[state=active]:bg-stone-900 data-[state=active]:text-white px-4 h-full" data-testid="tab-vendors">Vendors</TabsTrigger>
            <TabsTrigger value="payments" className="rounded-none data-[state=active]:bg-stone-900 data-[state=active]:text-white px-4 h-full" data-testid="tab-payments">Payments</TabsTrigger>
          </TabsList>

          <TabsContent value="vendors" className="mt-4">
            <div className="bg-white border border-stone-200 flex items-center gap-3 px-4 py-3 flex-wrap">
              <Search className="w-4 h-4 text-stone-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vendors…" className="border-0 shadow-none focus-visible:ring-0 px-0 rounded-none h-8 max-w-md" data-testid="vendors-search" />
              <Chip>Total: {filteredVendors.length}</Chip>
            </div>

            <div className="mt-4">
              {loading ? (
                <div className="bg-white border border-stone-200 p-12 text-center text-sm text-stone-500">Loading…</div>
              ) : filteredVendors.length === 0 ? (
                <div className="bg-white border border-stone-200 p-12 text-center" data-testid="vendors-empty">
                  <Truck className="w-10 h-10 mx-auto text-stone-300" />
                  <div className="font-display text-xl font-bold tracking-tight mt-3">No vendors yet</div>
                  <p className="text-sm text-stone-500 mt-2">Add carpenters, painters, electricians and more.</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-0 grid-divider-x grid-divider-y border border-stone-200 bg-stone-200">
                  {filteredVendors.map((v) => {
                    const vp = payments.filter((p) => p.vendor_id === v.id);
                    const sum = vp.reduce((s, p) => s + Number(p.amount || 0), 0);
                    return (
                      <div key={v.id} className="bg-white p-5" data-testid={`vendor-card-${v.id}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-display text-lg font-semibold tracking-tight leading-tight">{v.name}</div>
                            <div className="text-xs text-stone-500 mt-0.5">{v.type || "—"}</div>
                          </div>
                        </div>
                        <div className="text-sm text-stone-700 mt-2">{v.phone || "—"}</div>
                        <div className="grid grid-cols-2 gap-0 mt-4 border-t border-stone-200 pt-3 grid-divider-x">
                          <div>
                            <div className="label-uppercase text-stone-500">Paid</div>
                            <div className="font-medium text-sm mt-0.5 tabular-nums">{formatINR(sum)}</div>
                          </div>
                          <div className="pl-3">
                            <div className="label-uppercase text-stone-500">Payments</div>
                            <div className="text-sm mt-0.5">{vp.length}</div>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" className="rounded-none border-stone-300 hover:bg-stone-100 mt-4 w-full" onClick={() => { setPresetVendor(v.id); setPOpen(true); }} data-testid={`vendor-pay-${v.id}`}>
                          <Wallet className="w-3.5 h-3.5 mr-1" />Pay
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="payments" className="mt-4">
            <div className="bg-white border border-stone-200 px-4 py-3 flex items-center gap-2 flex-wrap">
              <Chip>Entries: {payments.length}</Chip>
              <Chip className="bg-stone-900 text-white border-stone-900">Total: {formatINR(totalPaid)}</Chip>
            </div>
            <div className="mt-4">
              {payments.length === 0 ? (
                <div className="bg-white border border-stone-200 p-12 text-center text-sm text-stone-500" data-testid="vendor-payments-empty">No vendor payments recorded.</div>
              ) : (
                <div className="bg-white border border-stone-200 overflow-x-auto">
                  <table className="w-full text-sm" data-testid="vendor-payments-table">
                    <thead className="bg-stone-50 border-b border-stone-200">
                      <tr className="text-left">
                        <th className="px-4 py-3 label-uppercase">Date</th>
                        <th className="px-4 py-3 label-uppercase">Vendor</th>
                        <th className="px-4 py-3 label-uppercase">Project</th>
                        <th className="px-4 py-3 label-uppercase">Note</th>
                        <th className="px-4 py-3 label-uppercase text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="grid-divider-y">
                      {payments.map((p) => (
                        <tr key={p.id} className="hover:bg-stone-50" data-testid={`payment-row-${p.id}`}>
                          <td className="px-4 py-3 text-stone-700">{formatDate(p.payment_date)}</td>
                          <td className="px-4 py-3 font-medium">{p.vendor?.name}<div className="text-xs text-stone-500">{p.vendor?.type}</div></td>
                          <td className="px-4 py-3 text-stone-700">{p.project?.project_name || "—"}</td>
                          <td className="px-4 py-3 text-stone-700">{p.note || "—"}</td>
                          <td className="px-4 py-3 text-right tabular-nums font-medium">{formatINR(p.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </PageBody>

      <VendorFormDialog open={vOpen} onOpenChange={setVOpen} onSaved={load} />
      <VendorPaymentDialog open={pOpen} onOpenChange={setPOpen} vendors={vendors} projects={projects} defaultVendorId={presetVendor} onSaved={load} />
    </div>
  );
}

function VendorFormDialog({ open, onOpenChange, onSaved }) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, reset, setValue, watch } = useForm();

  useEffect(() => { if (open) reset({ name: "", type: "", phone: "" }); }, [open, reset]);

  const onSubmit = async (values) => {
    setSubmitting(true);
    try {
      await createVendor({ name: values.name, type: values.type || null, phone: values.phone || null }, user.id);
      toast.success("Vendor added");
      onSaved?.(); onOpenChange(false);
    } catch (e) { toast.error(e.message); }
    finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-none border-stone-300 max-w-md p-0" data-testid="vendor-form-dialog">
        <DialogHeader className="px-6 py-5 border-b border-stone-200">
          <div className="label-uppercase">New Vendor</div>
          <DialogTitle className="font-display text-2xl tracking-tight">Add a vendor</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <Label className="label-uppercase">Name *</Label>
            <Input className="rounded-none mt-1.5 border-stone-300 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-0" {...register("name", { required: true })} data-testid="vendor-input-name" />
          </div>
          <div>
            <Label className="label-uppercase">Type</Label>
            <Select value={watch("type") || ""} onValueChange={(v) => setValue("type", v)}>
              <SelectTrigger className="rounded-none mt-1.5 border-stone-300" data-testid="vendor-select-type"><SelectValue placeholder="Select trade" /></SelectTrigger>
              <SelectContent className="rounded-none">
                {VENDOR_TYPES.map((t) => <SelectItem key={t} value={t} className="rounded-none">{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="label-uppercase">Phone</Label>
            <Input className="rounded-none mt-1.5 border-stone-300 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-0" {...register("phone")} data-testid="vendor-input-phone" />
          </div>
          <DialogFooter className="-mx-6 -mb-6 px-6 py-4 border-t border-stone-200 bg-stone-50">
            <Button type="button" variant="outline" className="rounded-none border-stone-300" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting} className="rounded-none bg-stone-900 hover:bg-stone-800 text-white" data-testid="vendor-form-submit">{submitting ? "Saving…" : "Add Vendor"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function VendorPaymentDialog({ open, onOpenChange, vendors, projects, defaultVendorId, onSaved }) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, reset, setValue, watch } = useForm();

  useEffect(() => {
    if (open) reset({ vendor_id: defaultVendorId || "", project_id: "", amount: "", payment_date: todayISO(), note: "" });
  }, [open, defaultVendorId, reset]);

  const onSubmit = async (values) => {
    if (!values.vendor_id) { toast.error("Select a vendor"); return; }
    setSubmitting(true);
    try {
      await createVendorPayment({
        vendor_id: values.vendor_id,
        project_id: values.project_id || null,
        amount: Number(values.amount),
        payment_date: values.payment_date,
        note: values.note || null,
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
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <Label className="label-uppercase">Vendor *</Label>
            <Select value={watch("vendor_id") || ""} onValueChange={(v) => setValue("vendor_id", v)}>
              <SelectTrigger className="rounded-none mt-1.5 border-stone-300" data-testid="payment-select-vendor"><SelectValue placeholder="Select vendor" /></SelectTrigger>
              <SelectContent className="rounded-none">
                {vendors.map((v) => <SelectItem key={v.id} value={v.id} className="rounded-none">{v.name} <span className="text-stone-500 ml-1">({v.type || "—"})</span></SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="label-uppercase">Project (optional)</Label>
            <Select value={watch("project_id") || ""} onValueChange={(v) => setValue("project_id", v)}>
              <SelectTrigger className="rounded-none mt-1.5 border-stone-300"><SelectValue placeholder="Link to project" /></SelectTrigger>
              <SelectContent className="rounded-none">
                {projects.map((p) => <SelectItem key={p.id} value={p.id} className="rounded-none">{p.project_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="label-uppercase">Amount (₹) *</Label>
              <Input type="number" step="0.01" className="rounded-none mt-1.5 border-stone-300 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-0" {...register("amount", { required: true })} data-testid="payment-input-amount" />
            </div>
            <div>
              <Label className="label-uppercase">Payment Date *</Label>
              <Input type="date" className="rounded-none mt-1.5 border-stone-300 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-0" {...register("payment_date", { required: true })} data-testid="payment-input-date" />
            </div>
          </div>
          <div>
            <Label className="label-uppercase">Note</Label>
            <Textarea className="rounded-none mt-1.5 border-stone-300 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-0" {...register("note")} data-testid="payment-input-note" />
          </div>
          <DialogFooter className="-mx-6 -mb-6 px-6 py-4 border-t border-stone-200 bg-stone-50">
            <Button type="button" variant="outline" className="rounded-none border-stone-300" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting} className="rounded-none bg-stone-900 hover:bg-stone-800 text-white" data-testid="payment-form-submit">{submitting ? "Saving…" : "Record Payment"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
