import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader, PageBody } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Chip } from "@/components/shared/StatusBadge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Search, MoreVertical, Pencil, Trash2, ReceiptText, Phone, X } from "lucide-react";
import { fetchCustomers, createCustomer, updateCustomer, requestDeleteCustomer, cancelDeleteCustomer } from "@/services/customerService";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate } from "@/utils/format";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

export default function CustomersPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);

  const load = async () => {
    setLoading(true);
    try { setList(await fetchCustomers()); } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => list.filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (c.name || "").toLowerCase().includes(s) || (c.phone || "").includes(s) || (c.address || "").toLowerCase().includes(s);
  }), [list, search]);

  const handleRequestDelete = async (c) => {
    if (!window.confirm("Request admin to delete this customer?")) return;
    try { await requestDeleteCustomer(c.id, user.id); toast.success("Delete request submitted"); load(); } catch (e) { toast.error(e.message); }
  };
  const handleCancelDelete = async (c) => {
    try { await cancelDeleteCustomer(c.id); toast.success("Cancelled"); load(); } catch (e) { toast.error(e.message); }
  };

  return (
    <div data-testid="customers-page">
      <PageHeader
        subtitle="Phase 3"
        title="Customer Management"
        actions={
          <Button onClick={() => { setEdit(null); setOpen(true); }} className="rounded-none bg-orange-500 hover:bg-orange-600 text-white" data-testid="customer-add-button">
            <Plus className="w-4 h-4" />New Customer
          </Button>
        }
      />
      <PageBody>
        <div className="bg-white border border-stone-200 flex items-center gap-2 px-4 py-3">
          <Search className="w-4 h-4 text-stone-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, phone, address…" className="border-0 shadow-none focus-visible:ring-0 px-0 rounded-none h-8" data-testid="customers-search" />
          <Chip>Total: {filtered.length}</Chip>
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="bg-white border border-stone-200 p-12 text-center text-sm text-stone-500">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="bg-white border border-stone-200 p-12 text-center" data-testid="customers-empty">
              <div className="font-display text-xl font-bold tracking-tight">No customers yet</div>
              <p className="text-sm text-stone-500 mt-2">Add a new customer or convert a lead to start.</p>
            </div>
          ) : (
            <div className="bg-white border border-stone-200 overflow-x-auto">
              <table className="w-full text-sm" data-testid="customers-table">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr className="text-left">
                    <th className="px-4 py-3 label-uppercase">Name</th>
                    <th className="px-4 py-3 label-uppercase">Phone</th>
                    <th className="px-4 py-3 label-uppercase">Address</th>
                    <th className="px-4 py-3 label-uppercase">Project Details</th>
                    <th className="px-4 py-3 label-uppercase">Linked Lead</th>
                    <th className="px-4 py-3 label-uppercase">Created</th>
                    <th className="px-4 py-3 label-uppercase text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="grid-divider-y">
                  {filtered.map((c) => (
                    <tr key={c.id} className={cn("hover:bg-stone-50", c.delete_request && "bg-rose-50/40")} data-testid={`customer-row-${c.id}`}>
                      <td className="px-4 py-3 font-medium">
                        {c.name}
                        {c.delete_request && <div className="text-[10px] tracking-widest uppercase text-rose-600 mt-1 font-semibold">Delete pending</div>}
                      </td>
                      <td className="px-4 py-3 text-stone-700"><a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 hover:underline"><Phone className="w-3 h-3" />{c.phone}</a></td>
                      <td className="px-4 py-3 text-stone-700">{c.address || "—"}</td>
                      <td className="px-4 py-3 text-stone-700 max-w-[280px] truncate">{c.project_details || "—"}</td>
                      <td className="px-4 py-3">{c.linked_lead_id ? <span className="font-mono text-xs">From Lead</span> : <span className="text-stone-400 text-xs">Manual</span>}</td>
                      <td className="px-4 py-3 text-stone-600">{formatDate(c.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-none h-8 w-8" data-testid={`customer-actions-${c.id}`}><MoreVertical className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-none border-stone-300">
                            <DropdownMenuItem className="rounded-none cursor-pointer" onClick={() => { setEdit(c); setOpen(true); }}><Pencil className="w-4 h-4 mr-2" />Edit</DropdownMenuItem>
                            <DropdownMenuItem className="rounded-none cursor-pointer" onClick={() => nav(`/receipts?customer=${c.id}`)}><ReceiptText className="w-4 h-4 mr-2" />New Receipt</DropdownMenuItem>
                            {c.delete_request ? (
                              <DropdownMenuItem className="rounded-none cursor-pointer" onClick={() => handleCancelDelete(c)}><X className="w-4 h-4 mr-2" />Cancel Delete</DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem className="rounded-none cursor-pointer text-rose-600" onClick={() => handleRequestDelete(c)} data-testid={`customer-delete-${c.id}`}><Trash2 className="w-4 h-4 mr-2" />Request Delete</DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </PageBody>

      <CustomerFormDialog open={open} onOpenChange={setOpen} customer={edit} onSaved={load} />
    </div>
  );
}

function CustomerFormDialog({ open, onOpenChange, customer, onSaved }) {
  const { user } = useAuth();
  const isEdit = Boolean(customer?.id);
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  useEffect(() => {
    if (!open) return;
    reset({
      name: customer?.name || "",
      phone: customer?.phone || "",
      address: customer?.address || "",
      project_details: customer?.project_details || "",
    });
  }, [open, customer, reset]);

  const onSubmit = async (values) => {
    setSubmitting(true);
    try {
      if (isEdit) await updateCustomer(customer.id, values);
      else await createCustomer(values, user.id);
      toast.success(isEdit ? "Customer updated" : "Customer created");
      onSaved?.();
      onOpenChange(false);
    } catch (e) { toast.error(e.message); }
    finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-none border-stone-300 max-w-xl p-0" data-testid="customer-form-dialog">
        <DialogHeader className="px-6 py-5 border-b border-stone-200">
          <div className="label-uppercase">{isEdit ? "Edit Customer" : "New Customer"}</div>
          <DialogTitle className="font-display text-2xl tracking-tight">{isEdit ? customer.name : "Add a customer"}</DialogTitle>
          <DialogDescription className="sr-only">Customer details: name, phone, address and project notes.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <Label className="label-uppercase">Name *</Label>
            <Input className="rounded-none mt-1.5 border-stone-300 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-0" {...register("name", { required: true })} data-testid="customer-input-name" />
            {errors.name && <span className="text-xs text-rose-600">Required</span>}
          </div>
          <div>
            <Label className="label-uppercase">Phone *</Label>
            <Input className="rounded-none mt-1.5 border-stone-300 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-0" {...register("phone", { required: true })} data-testid="customer-input-phone" />
            {errors.phone && <span className="text-xs text-rose-600">Required</span>}
          </div>
          <div>
            <Label className="label-uppercase">Address</Label>
            <Textarea className="rounded-none mt-1.5 border-stone-300 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-0" {...register("address")} data-testid="customer-input-address" />
          </div>
          <div>
            <Label className="label-uppercase">Project Details</Label>
            <Textarea className="rounded-none mt-1.5 border-stone-300 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-0 min-h-[80px]" {...register("project_details")} data-testid="customer-input-project" />
          </div>
          <DialogFooter className="-mx-6 -mb-6 px-6 py-4 border-t border-stone-200 bg-stone-50">
            <Button type="button" variant="outline" className="rounded-none border-stone-300" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting} className="rounded-none bg-stone-900 hover:bg-stone-800 text-white" data-testid="customer-form-submit">{submitting ? "Saving…" : isEdit ? "Save" : "Create"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
