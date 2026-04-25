import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { PageHeader, PageBody } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Chip } from "@/components/shared/StatusBadge";
import { Plus, Search, Hammer, ArrowRight } from "lucide-react";
import { fetchProjects, createProject } from "@/services/projectService";
import { fetchCustomers } from "@/services/customerService";
import { useAuth } from "@/contexts/AuthContext";
import { formatINR, formatDate, PROJECT_STATUSES, todayISO } from "@/utils/format";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const statusColor = (s) => ({
  planning: "bg-stone-100 text-stone-900 border-stone-300",
  in_progress: "bg-blue-50 text-blue-900 border-blue-300",
  on_hold: "bg-amber-50 text-amber-900 border-amber-300",
  completed: "bg-emerald-50 text-emerald-900 border-emerald-300",
  cancelled: "bg-rose-50 text-rose-900 border-rose-300",
}[s] || "bg-stone-100 text-stone-900 border-stone-300");

export default function ProjectsPage() {
  const [list, setList] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([fetchProjects(), fetchCustomers()]);
      setList(p); setCustomers(c);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => list.filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (p.project_name || "").toLowerCase().includes(s) || (p.customer?.name || "").toLowerCase().includes(s) || (p.location || "").toLowerCase().includes(s);
  }), [list, search]);

  return (
    <div data-testid="projects-page">
      <PageHeader
        subtitle="Phase 5"
        title="Projects &amp; Expenses"
        actions={
          <Button onClick={() => setOpen(true)} className="rounded-none bg-orange-500 hover:bg-orange-600 text-white" data-testid="project-add-button">
            <Plus className="w-4 h-4" />New Project
          </Button>
        }
      />
      <PageBody>
        <div className="bg-white border border-stone-200 flex items-center gap-3 px-4 py-3 flex-wrap">
          <Search className="w-4 h-4 text-stone-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search project, customer, location…" className="border-0 shadow-none focus-visible:ring-0 px-0 rounded-none h-8 max-w-md" data-testid="projects-search" />
          <Chip>Total: {filtered.length}</Chip>
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="bg-white border border-stone-200 p-12 text-center text-sm text-stone-500">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="bg-white border border-stone-200 p-12 text-center" data-testid="projects-empty">
              <Hammer className="w-10 h-10 mx-auto text-stone-300" />
              <div className="font-display text-xl font-bold tracking-tight mt-3">No projects yet</div>
              <p className="text-sm text-stone-500 mt-2">Create a project to start tracking expenses and progress.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-0 grid-divider-x grid-divider-y border border-stone-200 bg-stone-200">
              {filtered.map((p) => (
                <Link key={p.id} to={`/projects/${p.id}`} className="bg-white p-6 hover:bg-stone-50 transition-colors group" data-testid={`project-card-${p.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-display text-xl font-semibold tracking-tight leading-tight">{p.project_name}</div>
                    <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
                  </div>
                  <div className="text-sm text-stone-600 mt-1">{p.customer?.name}</div>
                  <div className="text-xs text-stone-500 mt-1">{p.location || "—"}</div>
                  <div className="flex items-center gap-2 mt-4 flex-wrap">
                    <span className={cn("inline-block px-2 py-1 text-[10px] tracking-[0.15em] uppercase font-semibold border", statusColor(p.status))}>
                      {PROJECT_STATUSES.find(x => x.key === p.status)?.label || p.status}
                    </span>
                    {p.start_date && <Chip>Start: {formatDate(p.start_date)}</Chip>}
                  </div>
                  <div className="grid grid-cols-2 gap-0 mt-5 border-t border-stone-200 pt-4 grid-divider-x">
                    <div>
                      <div className="label-uppercase text-stone-500">Total Value</div>
                      <div className="font-medium tabular-nums mt-1">{formatINR(p.total_value)}</div>
                    </div>
                    <div className="pl-4">
                      <div className="label-uppercase text-stone-500">Created</div>
                      <div className="text-sm mt-1">{formatDate(p.created_at)}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </PageBody>

      <ProjectFormDialog open={open} onOpenChange={setOpen} customers={customers} onSaved={load} />
    </div>
  );
}

function ProjectFormDialog({ open, onOpenChange, customers, onSaved }) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm();

  useEffect(() => {
    if (!open) return;
    reset({ project_name: "", customer_id: "", location: "", start_date: todayISO(), status: "planning", total_value: "" });
  }, [open, reset]);

  const onSubmit = async (values) => {
    if (!values.customer_id) { toast.error("Select a customer"); return; }
    setSubmitting(true);
    try {
      await createProject({
        project_name: values.project_name,
        customer_id: values.customer_id,
        location: values.location || null,
        start_date: values.start_date || null,
        status: values.status,
        total_value: values.total_value ? Number(values.total_value) : 0,
      }, user.id);
      toast.success("Project created");
      onSaved?.(); onOpenChange(false);
    } catch (e) { toast.error(e.message); }
    finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-none border-stone-300 max-w-xl p-0" data-testid="project-form-dialog">
        <DialogHeader className="px-6 py-5 border-b border-stone-200">
          <div className="label-uppercase">New Project</div>
          <DialogTitle className="font-display text-2xl tracking-tight">Set up a project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <Label className="label-uppercase">Project Name *</Label>
            <Input className="rounded-none mt-1.5 border-stone-300 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-0" {...register("project_name", { required: true })} data-testid="project-input-name" />
          </div>
          <div>
            <Label className="label-uppercase">Customer *</Label>
            <Select value={watch("customer_id") || ""} onValueChange={(v) => setValue("customer_id", v)}>
              <SelectTrigger className="rounded-none mt-1.5 border-stone-300" data-testid="project-select-customer"><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent className="rounded-none">
                {customers.map((c) => <SelectItem key={c.id} value={c.id} className="rounded-none">{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="label-uppercase">Location</Label>
              <Input className="rounded-none mt-1.5 border-stone-300 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-0" {...register("location")} data-testid="project-input-location" />
            </div>
            <div>
              <Label className="label-uppercase">Start Date</Label>
              <Input type="date" className="rounded-none mt-1.5 border-stone-300 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-0" {...register("start_date")} data-testid="project-input-startdate" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="label-uppercase">Status</Label>
              <Select value={watch("status") || "planning"} onValueChange={(v) => setValue("status", v)}>
                <SelectTrigger className="rounded-none mt-1.5 border-stone-300"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-none">
                  {PROJECT_STATUSES.map((s) => <SelectItem key={s.key} value={s.key} className="rounded-none">{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="label-uppercase">Total Value (₹)</Label>
              <Input type="number" className="rounded-none mt-1.5 border-stone-300 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-0" {...register("total_value")} data-testid="project-input-value" />
            </div>
          </div>
          <DialogFooter className="-mx-6 -mb-6 px-6 py-4 border-t border-stone-200 bg-stone-50">
            <Button type="button" variant="outline" className="rounded-none border-stone-300" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting} className="rounded-none bg-stone-900 hover:bg-stone-800 text-white" data-testid="project-form-submit">{submitting ? "Saving…" : "Create Project"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
