import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { PageHeader, PageBody } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Chip } from "@/components/shared/StatusBadge";
import {
  Plus, Search, Hammer, ArrowRight, MoreVertical, Pencil, Trash2, Users,
} from "lucide-react";
import { fetchProjects, deleteProject } from "@/services/projectService";
import { fetchCustomers } from "@/services/customerService";
import { useAuth } from "@/contexts/AuthContext";
import { formatINR, formatDate, PROJECT_STATUSES } from "@/utils/format";
import ProjectFormDialog from "@/components/projects/ProjectFormDialog";
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
  const { isAdmin } = useAuth();
  const [list, setList] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editProject, setEditProject] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([fetchProjects(), fetchCustomers().catch(() => [])]);
      setList(p); setCustomers(c);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => list.filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return [p.project_name, p.customer?.name, p.location].filter(Boolean).join(" ").toLowerCase().includes(s);
  }), [list, search, statusFilter]);

  const handleDelete = async (project) => {
    if (!window.confirm(`Permanently delete "${project.project_name}"? This will also delete all related expenses. This cannot be undone.`)) return;
    try { await deleteProject(project.id); toast.success("Project deleted"); load(); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div data-testid="projects-page">
      <PageHeader
        subtitle="Phase 5"
        title="Projects &amp; Expenses"
        actions={
          <Button onClick={() => { setEditProject(null); setOpen(true); }} className="rounded-none bg-orange-500 hover:bg-orange-600 text-white" data-testid="project-add-button">
            <Plus className="w-4 h-4" />New Project
          </Button>
        }
      />
      <PageBody>
        <div className="bg-white border border-stone-200 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-0 grid-divider-x">
          <div className="flex items-center gap-3 px-4 py-3">
            <Search className="w-4 h-4 text-stone-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search project, customer, location…" className="border-0 shadow-none focus-visible:ring-0 px-0 rounded-none h-8" data-testid="projects-search" />
          </div>
          <div className="px-4 py-3 flex items-center gap-2">
            <span className="label-uppercase">Status</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="rounded-none w-[160px] border-stone-300 h-9" data-testid="projects-status-filter"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-none">
                <SelectItem value="all" className="rounded-none">All</SelectItem>
                {PROJECT_STATUSES.map((s) => <SelectItem key={s.key} value={s.key} className="rounded-none">{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="px-4 py-3 flex items-center"><Chip>Total: {filtered.length}</Chip></div>
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="bg-white border border-stone-200 p-12 text-center text-sm text-stone-500">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="bg-white border border-stone-200 p-12 text-center" data-testid="projects-empty">
              <Hammer className="w-10 h-10 mx-auto text-stone-300" />
              <div className="font-display text-xl font-bold tracking-tight mt-3">No projects yet</div>
              <p className="text-sm text-stone-500 mt-2">{list.length === 0 ? "Create a project to start tracking expenses and progress." : "No projects match the filters."}</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-0 grid-divider-x grid-divider-y border border-stone-200 bg-stone-200">
              {filtered.map((p) => (
                <div key={p.id} className="bg-white p-6 group relative" data-testid={`project-card-${p.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <Link to={`/projects/${p.id}`} className="flex-1 min-w-0">
                      <div className="font-display text-xl font-semibold tracking-tight leading-tight hover:text-orange-600 transition-colors">{p.project_name}</div>
                      <div className="text-sm text-stone-600 mt-1">{p.customer?.name}</div>
                      <div className="text-xs text-stone-500 mt-1">{p.location || "—"}</div>
                    </Link>
                    <div className="flex items-center gap-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="rounded-none h-8 w-8 hover:bg-stone-100" data-testid={`project-actions-${p.id}`}><MoreVertical className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-none border-stone-300">
                          <DropdownMenuItem className="rounded-none cursor-pointer" onClick={() => { setEditProject(p); setOpen(true); }} data-testid={`project-edit-${p.id}`}>
                            <Pencil className="w-4 h-4 mr-2" />Edit
                          </DropdownMenuItem>
                          {isAdmin && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="rounded-none cursor-pointer text-rose-600" onClick={() => handleDelete(p)} data-testid={`project-delete-${p.id}`}>
                                <Trash2 className="w-4 h-4 mr-2" />Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-4 flex-wrap">
                    <span className={cn("inline-block px-2 py-1 text-[10px] tracking-[0.15em] uppercase font-semibold border", statusColor(p.status))}>
                      {PROJECT_STATUSES.find((x) => x.key === p.status)?.label || p.status}
                    </span>
                    {p.start_date && <Chip>Start: {formatDate(p.start_date)}</Chip>}
                  </div>

                  {/* Members */}
                  <div className="flex items-center gap-2 mt-3">
                    <div className="flex -space-x-2">
                      {(p.members || []).slice(0, 4).map((m) => (
                        <div
                          key={m.user_id}
                          title={m.profile?.full_name || m.profile?.email}
                          className={cn(
                            "w-6 h-6 rounded-full grid place-items-center font-bold text-[10px] ring-2 ring-white",
                            m.role === "lead" ? "bg-orange-500 text-white" : "bg-blue-700 text-white"
                          )}
                        >
                          {(m.profile?.full_name || m.profile?.email || "?").slice(0, 1).toUpperCase()}
                        </div>
                      ))}
                      {(p.members || []).length > 4 && (
                        <div className="w-6 h-6 rounded-full grid place-items-center font-bold text-[10px] bg-stone-200 text-stone-700 ring-2 ring-white">
                          +{p.members.length - 4}
                        </div>
                      )}
                      {(!p.members || p.members.length === 0) && (
                        <div className="text-[10px] tracking-widest uppercase text-stone-400 inline-flex items-center gap-1"><Users className="w-3 h-3" />No team</div>
                      )}
                    </div>
                    {p.members?.length > 0 && (
                      <div className="text-[10px] tracking-widest uppercase font-semibold text-stone-500">
                        {p.members.length} member{p.members.length !== 1 ? "s" : ""}
                      </div>
                    )}
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
                </div>
              ))}
            </div>
          )}
        </div>
      </PageBody>

      <ProjectFormDialog
        open={open}
        onOpenChange={(v) => { setOpen(v); if (!v) setEditProject(null); }}
        customers={customers}
        project={editProject}
        onSaved={load}
      />
    </div>
  );
}
