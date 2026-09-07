import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader, PageBody } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Chip } from "@/components/shared/StatusBadge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, MoreVertical, Pencil, Trash2, ReceiptText, Phone, X, UserPlus } from "lucide-react";
import { fetchCustomers, createCustomer, updateCustomer, addCustomerAssignee, removeCustomerAssignee, requestDeleteCustomer, cancelDeleteCustomer } from "@/services/customerService";
import { fetchProfiles } from "@/services/profileService";
import { fetchRmReAssignments } from "@/services/rmReService";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { formatDate } from "@/utils/format";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const roleOf = (p) => String(p?.role || "").toLowerCase();
const isRm = (p) => ["rm", "manager"].includes(roleOf(p));
const isRe = (p) => ["re", "executive"].includes(roleOf(p));

function initials(name = "?") {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("") || "?";
}

function Avatar({ profile }) {
  const name = profile?.full_name || profile?.email || "Unknown";
  return <span title={name} className="inline-flex w-6 h-6 items-center justify-center rounded-full border-2 border-white bg-stone-200 text-stone-700 text-[10px] font-semibold">{initials(name)}</span>;
}

export default function CustomersPage() {
  const { user, role, isAdmin } = useAuth();
  const { can } = usePermissions();
  const [list, setList] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [rmRe, setRmRe] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [customers, members, links] = await Promise.all([fetchCustomers(), fetchProfiles(), fetchRmReAssignments()]);
      setList(customers); setProfiles(members); setRmRe(links);
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const teamReIds = useMemo(() => rmRe.filter((a) => a.rm_id === user?.id).map((a) => a.re_id), [rmRe, user?.id]);
  const visibleOwnerOptions = useMemo(() => {
    if (isAdmin) return profiles.filter((p) => p.id);
    if (isRm(user)) return profiles.filter((p) => p.id === user?.id || (teamReIds.includes(p.id) && isRe(p)));
    return profiles.filter((p) => p.id === user?.id);
  }, [profiles, isAdmin, user, teamReIds]);

  const filtered = useMemo(() => list.filter((c) => {
    if (ownerFilter === "unassigned" && c.assigned_to) return false;
    if (ownerFilter === "mine" && c.assigned_to !== user?.id && !(c.assignees || []).some((a) => (a.user_id || a.profile?.id) === user?.id)) return false;
    if (ownerFilter !== "all" && !["unassigned", "mine"].includes(ownerFilter) && c.assigned_to !== ownerFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (c.name || "").toLowerCase().includes(s) || (c.phone || "").includes(s) || (c.address || "").toLowerCase().includes(s);
  }), [list, search, ownerFilter, user?.id]);

  const ownerName = (c) => c.assigned_profile?.full_name || c.assigned_profile?.email || "Unassigned";

  const handleRequestDelete = async (c) => {
    if (!window.confirm("Request admin to delete this customer?")) return;
    try { await requestDeleteCustomer(c.id, user.id); toast.success("Delete request submitted"); load(); } catch (e) { toast.error(e.message); }
  };
  const handleCancelDelete = async (c) => {
    try { await cancelDeleteCustomer(c.id); toast.success("Cancelled"); load(); } catch (e) { toast.error(e.message); }
  };

  return (
    <div data-testid="customers-page">
      <PageHeader subtitle="Phase 3" title="Customer Management" actions={can("customers", "create") ? <Button onClick={() => { setEdit(null); setOpen(true); }} className="rounded-none bg-orange-500 hover:bg-orange-600 text-white" data-testid="customer-add-button"><Plus className="w-4 h-4" />New Customer</Button> : null} />
      <PageBody>
        <div className="bg-white border border-stone-200 flex items-center gap-2 px-4 py-3 flex-wrap">
          <Search className="w-4 h-4 text-stone-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, phone, address…" className="border-0 shadow-none focus-visible:ring-0 px-0 rounded-none h-8 flex-1 min-w-[220px]" data-testid="customers-search" />
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="rounded-none h-8 w-[210px] border-stone-300"><SelectValue placeholder="Owner" /></SelectTrigger>
            <SelectContent className="rounded-none">
              <SelectItem value="all" className="rounded-none">All Customers</SelectItem>
              {isRm(user) && <><SelectItem value="mine" className="rounded-none">My Customers</SelectItem><SelectItem value="unassigned" className="rounded-none">All Unassigned</SelectItem></>}
              {isAdmin && <SelectItem value="unassigned" className="rounded-none">All Unassigned</SelectItem>}
              {visibleOwnerOptions.map((p) => <SelectItem key={p.id} value={p.id} className="rounded-none">{p.full_name || p.email} ({isRm(p) ? "RM" : isRe(p) ? "RE" : "Admin"})</SelectItem>)}
            </SelectContent>
          </Select>
          <Chip>Total: {filtered.length}</Chip>
        </div>

        <div className="mt-6">
          {loading ? <div className="bg-white border border-stone-200 p-12 text-center text-sm text-stone-500">Loading…</div> : filtered.length === 0 ? <div className="bg-white border border-stone-200 p-12 text-center" data-testid="customers-empty"><div className="font-display text-xl font-bold tracking-tight">No customers yet</div><p className="text-sm text-stone-500 mt-2">Add a new customer or convert a lead to start.</p></div> : (
            <div className="bg-white border border-stone-200 overflow-x-auto">
              <table className="w-full text-sm" data-testid="customers-table">
                <thead className="bg-stone-50 border-b border-stone-200"><tr className="text-left">
                  <th className="px-4 py-3 label-uppercase">Name</th><th className="px-4 py-3 label-uppercase">Phone</th><th className="px-4 py-3 label-uppercase">Address</th><th className="px-4 py-3 label-uppercase">Project Details</th><th className="px-4 py-3 label-uppercase">Linked Lead</th><th className="px-4 py-3 label-uppercase">Owner / Assigned Team</th><th className="px-4 py-3 label-uppercase">Created</th><th className="px-4 py-3 label-uppercase text-right">Actions</th>
                </tr></thead>
                <tbody className="grid-divider-y">{filtered.map((c) => {
                  const co = (c.assignees || []).map((a) => a.profile).filter(Boolean).filter((p) => p.id !== c.assigned_to);
                  return <tr key={c.id} className={cn("hover:bg-stone-50", c.delete_request && "bg-rose-50/40")} data-testid={`customer-row-${c.id}`}>
                    <td className="px-4 py-3 font-medium">{c.name}{c.delete_request && <div className="text-[10px] tracking-widest uppercase text-rose-600 mt-1 font-semibold">Delete pending</div>}</td>
                    <td className="px-4 py-3 text-stone-700"><a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 hover:underline"><Phone className="w-3 h-3" />{c.phone}</a></td>
                    <td className="px-4 py-3 text-stone-700">{c.address || "—"}</td><td className="px-4 py-3 text-stone-700 max-w-[280px] truncate">{c.project_details || "—"}</td>
                    <td className="px-4 py-3">{c.linked_lead_id ? <span className="font-mono text-xs">From Lead</span> : <span className="text-stone-400 text-xs">Manual</span>}</td>
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><Avatar profile={c.assigned_profile} /><span className="text-xs font-medium">{ownerName(c)}</span>{co.length > 0 && <span className="inline-flex -space-x-1">{co.slice(0, 3).map((p) => <Avatar key={p.id} profile={p} />)}{co.length > 3 && <span className="inline-flex w-6 h-6 rounded-full bg-stone-200 text-[10px] items-center justify-center">+{co.length - 3}</span>}</span>}</div></td>
                    <td className="px-4 py-3 text-stone-600">{formatDate(c.created_at)}</td>
                    <td className="px-4 py-3 text-right"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="rounded-none h-8 w-8" data-testid={`customer-actions-${c.id}`}><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="rounded-none border-stone-300">
                      {can("customers", "edit") && <DropdownMenuItem className="rounded-none cursor-pointer" onClick={() => { setEdit(c); setOpen(true); }}><Pencil className="w-4 h-4 mr-2" />Edit</DropdownMenuItem>}
                      {can("receipts", "create") && <DropdownMenuItem className="rounded-none cursor-pointer" onClick={() => nav(`/receipts?customer=${c.id}`)}><ReceiptText className="w-4 h-4 mr-2" />New Receipt</DropdownMenuItem>}
                      {c.delete_request ? <DropdownMenuItem className="rounded-none cursor-pointer" onClick={() => handleCancelDelete(c)}><X className="w-4 h-4 mr-2" />Cancel Delete</DropdownMenuItem> : can("customers", "delete") && <DropdownMenuItem className="rounded-none cursor-pointer text-rose-600" onClick={() => handleRequestDelete(c)} data-testid={`customer-delete-${c.id}`}><Trash2 className="w-4 h-4 mr-2" />Request Delete</DropdownMenuItem>}
                    </DropdownMenuContent></DropdownMenu></td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          )}
        </div>
      </PageBody>
      <CustomerFormDialog open={open} onOpenChange={setOpen} customer={edit} profiles={profiles} rmRe={rmRe} onSaved={load} />
    </div>
  );
}

function CustomerFormDialog({ open, onOpenChange, customer, profiles, rmRe, onSaved }) {
  const { user, role, isAdmin } = useAuth();
  const { can } = usePermissions();
  const isEdit = Boolean(customer?.id);
  const [submitting, setSubmitting] = useState(false);
  const [team, setTeam] = useState([]);
  const [newAssignee, setNewAssignee] = useState("");
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm({ defaultValues: { assigned_to: "" } });
  const assignedTo = watch("assigned_to");

  useEffect(() => {
    if (!open) return;
    reset({ name: customer?.name || "", phone: customer?.phone || "", address: customer?.address || "", project_details: customer?.project_details || "", assigned_to: customer?.assigned_to || user?.id || "" });
    setTeam(customer?.assignees || []); setNewAssignee("");
  }, [open, customer, reset, user?.id]);

  const teamReIds = useMemo(() => rmRe.filter((a) => a.rm_id === user?.id).map((a) => a.re_id), [rmRe, user?.id]);
  const ownerCandidates = useMemo(() => {
    if (isAdmin) return profiles;
    if (isRm({ role })) return profiles.filter((p) => p.id === user?.id || (teamReIds.includes(p.id) && isRe(p)));
    return profiles.filter((p) => p.id === user?.id);
  }, [profiles, isAdmin, role, user?.id, teamReIds]);
  const assigneeCandidates = useMemo(() => profiles.filter((p) => p.id !== assignedTo && !team.some((a) => (a.user_id || a.profile?.id) === p.id) && (isAdmin || isRm({ role }) || isRe({ role }))), [profiles, assignedTo, team, isAdmin, role]);

  const onSubmit = async (values) => {
    if (!can("customers", isEdit ? "edit" : "create")) return;
    setSubmitting(true);
    try {
      let saved;
      if (isEdit) saved = await updateCustomer(customer.id, values);
      else saved = await createCustomer(values, user.id);
      toast.success(isEdit ? "Customer updated" : "Customer created");
      if (isEdit && team.length) {
        // Existing team is managed below; no-op here.
      }
      onSaved?.(); onOpenChange(false);
    } catch (e) { toast.error(e.message); } finally { setSubmitting(false); }
  };

  const addAssignee = async () => {
    if (!isEdit || !newAssignee) return;
    try { await addCustomerAssignee(customer.id, newAssignee, user.id); const p = profiles.find((x) => x.id === newAssignee); setTeam((v) => [...v, { user_id: p.id, profile: p }]); setNewAssignee(""); toast.success("Customer co-assignee added"); onSaved?.(); } catch (e) { toast.error(e.message); }
  };
  const removeAssignee = async (a) => {
    const id = a.user_id || a.profile?.id;
    if (!isEdit || !id) return;
    if (!window.confirm("Remove this co-assignee?")) return;
    try { await removeCustomerAssignee(customer.id, id); setTeam((v) => v.filter((x) => (x.user_id || x.profile?.id) !== id)); toast.success("Co-assignee removed"); onSaved?.(); } catch (e) { toast.error(e.message); }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="rounded-none border-stone-300 max-w-xl p-0" data-testid="customer-form-dialog">
    <DialogHeader className="px-6 py-5 border-b border-stone-200"><div className="label-uppercase">{isEdit ? "Edit Customer" : "New Customer"}</div><DialogTitle className="font-display text-2xl tracking-tight">{isEdit ? customer.name : "Add a customer"}</DialogTitle><DialogDescription className="sr-only">Customer details and ownership.</DialogDescription></DialogHeader>
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
      <div><Label className="label-uppercase">Name *</Label><Input className="rounded-none mt-1.5 border-stone-300" {...register("name", { required: true })} data-testid="customer-input-name" />{errors.name && <span className="text-xs text-rose-600">Required</span>}</div>
      <div><Label className="label-uppercase">Phone *</Label><Input className="rounded-none mt-1.5 border-stone-300" {...register("phone", { required: true })} data-testid="customer-input-phone" />{errors.phone && <span className="text-xs text-rose-600">Required</span>}</div>
      <div><Label className="label-uppercase">Address</Label><Textarea className="rounded-none mt-1.5 border-stone-300" {...register("address")} data-testid="customer-input-address" /></div>
      <div><Label className="label-uppercase">Project Details</Label><Textarea className="rounded-none mt-1.5 border-stone-300 min-h-[80px]" {...register("project_details")} data-testid="customer-input-project" /></div>
      <div><Label className="label-uppercase">Primary Owner</Label><Select value={assignedTo || ""} onValueChange={(v) => setValue("assigned_to", v)}><SelectTrigger className="rounded-none mt-1.5 border-stone-300"><SelectValue placeholder="Select owner" /></SelectTrigger><SelectContent className="rounded-none">{ownerCandidates.map((p) => <SelectItem key={p.id} value={p.id} className="rounded-none">{p.full_name || p.email} ({isRm(p) ? "RM" : isRe(p) ? "RE" : "Admin"})</SelectItem>)}</SelectContent></Select></div>
      {isEdit && <div className="border-t border-stone-200 pt-4 space-y-3"><div className="flex items-center justify-between"><Label className="label-uppercase">Co-Assignees</Label><span className="text-xs text-stone-400">Same team access as Leads</span></div><div className="flex flex-wrap gap-2">{team.length ? team.map((a) => { const p = a.profile || profiles.find((x) => x.id === a.user_id); return <span key={a.user_id || p?.id} className="inline-flex items-center gap-1.5 pl-1 pr-2 py-1 bg-stone-50 border border-stone-200 rounded-full"><Avatar profile={p} /><span className="text-xs max-w-[140px] truncate">{p?.full_name || p?.email}</span><button type="button" onClick={() => removeAssignee(a)} className="text-stone-400 hover:text-rose-600"><X className="w-3.5 h-3.5" /></button></span>; }) : <span className="text-xs text-stone-400">No co-assignees</span>}</div><div className="flex gap-2"><Select value={newAssignee} onValueChange={setNewAssignee}><SelectTrigger className="rounded-none flex-1"><SelectValue placeholder="Add co-assignee" /></SelectTrigger><SelectContent className="rounded-none">{assigneeCandidates.map((p) => <SelectItem key={p.id} value={p.id} className="rounded-none">{p.full_name || p.email} ({isRm(p) ? "RM" : isRe(p) ? "RE" : "Admin"})</SelectItem>)}</SelectContent></Select><Button type="button" variant="outline" className="rounded-none" onClick={addAssignee} disabled={!newAssignee}><UserPlus className="w-4 h-4 mr-1" />Add</Button></div></div>}
      <DialogFooter className="-mx-6 -mb-6 px-6 py-4 border-t border-stone-200 bg-stone-50"><Button type="button" variant="outline" className="rounded-none border-stone-300" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={submitting || !can("customers", isEdit ? "edit" : "create")} className="rounded-none bg-stone-900 hover:bg-stone-800 text-white" data-testid="customer-form-submit">{submitting ? "Saving…" : isEdit ? "Save" : "Create"}</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>;
}
