import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Plus, ArrowLeft, Wallet, TrendingDown, TrendingUp, MoreVertical, Pencil, Trash2,
  ReceiptText, Calendar, MapPin,
} from "lucide-react";
import {
  fetchProjectById, fetchExpensesByProject, createExpense, updateProject,
  deleteProject, deleteExpense,
} from "@/services/projectService";
import { fetchCustomers } from "@/services/customerService";
import { fetchReceiptsByCustomer } from "@/services/receiptService";
import ProjectFormDialog from "@/components/projects/ProjectFormDialog";
import ProjectMembersPanel from "@/components/projects/ProjectMembersPanel";
import { useAuth } from "@/contexts/AuthContext";
import { formatINR, formatDate, formatDateTime, EXPENSE_CATEGORIES, PROJECT_STATUSES } from "@/utils/format";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const inputCls = "rounded-none mt-1.5 border-stone-300 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-0";

export default function ProjectDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { isAdmin, user } = useAuth();
  const [project, setProject] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const p = await fetchProjectById(id);
      setProject(p);
      const [e, r, c] = await Promise.all([
        fetchExpensesByProject(id),
        p?.customer_id ? fetchReceiptsByCustomer(p.customer_id) : Promise.resolve([]),
        fetchCustomers().catch(() => []),
      ]);
      setExpenses(e); setReceipts(r); setCustomers(c);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  if (loading) return <div className="p-12 text-center text-sm text-stone-500">Loading project…</div>;
  if (!project) return <div className="p-12 text-center text-sm text-stone-500">Project not found.</div>;

  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalReceipts = receipts.reduce((s, r) => s + Number(r.amount || 0), 0);
  const profit = totalReceipts - totalExpenses;
  const completion = project.total_value > 0 ? Math.min(100, Math.round((totalReceipts / Number(project.total_value)) * 100)) : 0;

  const handleStatusChange = async (status) => {
    try {
      const u = await updateProject(project.id, { status });
      setProject({ ...project, ...u });
      toast.success("Status updated");
    } catch (e) { toast.error(e.message); }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Move "${project.project_name}" to Trash? (Restore within 30 days from the Trash page.)`)) return;
    try { await deleteProject(project.id, user?.id); toast.success("Moved to Trash"); nav("/projects"); }
    catch (e) { toast.error(e.message); }
  };

  const handleDeleteExpense = async (e) => {
    if (!window.confirm(`Move this ${EXPENSE_CATEGORIES.find((x) => x.key === e.category)?.label || e.category} expense of ${formatINR(e.amount)} to Trash?`)) return;
    try { await deleteExpense(e.id, user?.id); toast.success("Moved to Trash"); load(); }
    catch (err) { toast.error(err.message); }
  };

  return (
    <div data-testid="project-detail-page">
      <PageHeader
        subtitle={`Project · ${project.customer?.name || ""}`}
        title={project.project_name}
        actions={
          <>
            <Link to="/projects"><Button variant="outline" className="rounded-none border-stone-300"><ArrowLeft className="w-4 h-4 mr-1" />All Projects</Button></Link>
            <Button onClick={() => setEditOpen(true)} variant="outline" className="rounded-none border-stone-300" data-testid="project-edit-button"><Pencil className="w-4 h-4 mr-1" />Edit</Button>
            <Button onClick={() => setExpenseOpen(true)} className="rounded-none bg-orange-500 hover:bg-orange-600 text-white" data-testid="expense-add-button"><Plus className="w-4 h-4" />Add Expense</Button>
            {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="rounded-none border-stone-300" data-testid="project-more-actions"><MoreVertical className="w-4 h-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-none border-stone-300">
                  <DropdownMenuItem className="rounded-none cursor-pointer text-rose-600" onClick={handleDelete} data-testid="project-delete-button">
                    <Trash2 className="w-4 h-4 mr-2" />Delete project
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        }
      />
      <PageBody>
        {/* Summary */}
        <div className="grid md:grid-cols-4 gap-0 grid-divider-x border border-stone-200 bg-stone-200">
          <div className="bg-white p-6">
            <div className="label-uppercase">Status</div>
            <Select value={project.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="rounded-none mt-2 border-stone-300 h-9" data-testid="project-status-select"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-none">
                {PROJECT_STATUSES.map((s) => <SelectItem key={s.key} value={s.key} className="rounded-none">{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="text-xs text-stone-500 mt-3 space-y-1">
              {project.start_date && <div className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" />Started {formatDate(project.start_date)}</div>}
              {project.end_date && <div className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" />Handover {formatDate(project.end_date)}</div>}
              {project.location && <div className="text-stone-700 inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{project.location}</div>}
            </div>
          </div>
          <div className="bg-white p-6">
            <div className="label-uppercase">Quoted Value</div>
            <div className="font-display text-2xl font-bold mt-2 tabular-nums">{formatINR(project.total_value)}</div>
            {project.total_value > 0 && (
              <>
                <div className="mt-3 h-1.5 bg-stone-100 overflow-hidden">
                  <div className="h-full bg-emerald-600 transition-all" style={{ width: `${completion}%` }} />
                </div>
                <div className="text-[10px] tracking-widest uppercase font-semibold text-stone-500 mt-1">{completion}% collected</div>
              </>
            )}
          </div>
          <div className="bg-white p-6">
            <div className="label-uppercase">Receipts</div>
            <div className="font-display text-2xl font-bold mt-2 tabular-nums text-emerald-700 flex items-center gap-2"><TrendingUp className="w-5 h-5" />{formatINR(totalReceipts)}</div>
            <div className="text-xs text-stone-500 mt-1">{receipts.length} receipt(s)</div>
          </div>
          <div className="bg-white p-6">
            <div className="label-uppercase">Expenses</div>
            <div className="font-display text-2xl font-bold mt-2 tabular-nums text-rose-700 flex items-center gap-2"><TrendingDown className="w-5 h-5" />{formatINR(totalExpenses)}</div>
            <div className="text-xs text-stone-500 mt-1">{expenses.length} entries</div>
          </div>
        </div>

        {/* P/L */}
        <div className={cn("mt-0 px-6 py-4 border border-t-0 border-stone-200", profit >= 0 ? "bg-emerald-50" : "bg-rose-50")}>
          <div className="flex items-center justify-between">
            <div className="label-uppercase text-stone-700">Net (Receipts − Expenses)</div>
            <div className={cn("font-display text-2xl font-bold tabular-nums", profit >= 0 ? "text-emerald-800" : "text-rose-800")}>{formatINR(profit)}</div>
          </div>
        </div>

        {/* Members + Receipts/Expenses log layout */}
        <div className="grid lg:grid-cols-[360px_1fr] gap-6 mt-8">
          <ProjectMembersPanel projectId={project.id} creatorId={project.created_by} />

          <div className="space-y-8">
            {/* Receipts Log */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="label-uppercase">Customer Payments</div>
                  <h3 className="font-display text-2xl font-bold tracking-tight">Receipts Log</h3>
                </div>
                <Link to={`/receipts?project=${project.id}`}><Button variant="outline" className="rounded-none border-stone-300 h-9 text-xs tracking-widest uppercase font-semibold"><Plus className="w-3.5 h-3.5 mr-1.5" />Add Receipt</Button></Link>
              </div>
              {receipts.length === 0 ? (
                <div className="bg-white border border-stone-200 p-8 text-center" data-testid="receipts-empty">
                  <ReceiptText className="w-8 h-8 mx-auto text-stone-300" />
                  <div className="font-display text-base font-semibold mt-2">No receipts yet</div>
                  <p className="text-xs text-stone-500 mt-1">Customer payments against this project will appear here.</p>
                </div>
              ) : (
                <div className="bg-white border border-stone-200 overflow-x-auto">
                  <table className="w-full text-sm" data-testid="receipts-table">
                    <thead className="bg-stone-50 border-b border-stone-200">
                      <tr className="text-left">
                        <th className="px-4 py-3 label-uppercase">Receipt No</th>
                        <th className="px-4 py-3 label-uppercase">Date</th>
                        <th className="px-4 py-3 label-uppercase">Mode</th>
                        <th className="px-4 py-3 label-uppercase">Note</th>
                        <th className="px-4 py-3 label-uppercase text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="grid-divider-y">
                      {receipts.map((r) => (
                        <tr key={r.id} className="hover:bg-stone-50" data-testid={`receipt-row-${r.id}`}>
                          <td className="px-4 py-3 font-mono text-xs">{r.receipt_no}</td>
                          <td className="px-4 py-3 text-stone-700 whitespace-nowrap">{formatDate(r.payment_date || r.created_at)}</td>
                          <td className="px-4 py-3 text-stone-700 capitalize">{(r.payment_mode || "—").replace(/_/g, " ")}</td>
                          <td className="px-4 py-3 text-stone-700">{r.note || "—"}</td>
                          <td className="px-4 py-3 text-right font-medium tabular-nums text-emerald-700">{formatINR(r.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-emerald-700 text-white">
                      <tr><td colSpan={4} className="px-4 py-3 label-uppercase text-emerald-200">Total Received</td><td className="px-4 py-3 text-right font-display text-lg tabular-nums">{formatINR(totalReceipts)}</td></tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>

            {/* Expenses Log */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="label-uppercase">Module</div>
                  <h3 className="font-display text-2xl font-bold tracking-tight">Expense Log</h3>
                </div>
              </div>
              {expenses.length === 0 ? (
                <div className="bg-white border border-stone-200 p-8 text-center" data-testid="expenses-empty">
                  <Wallet className="w-8 h-8 mx-auto text-stone-300" />
                  <div className="font-display text-base font-semibold mt-2">No expenses yet</div>
                  <p className="text-xs text-stone-500 mt-1">Track every spend by category against this project.</p>
                </div>
              ) : (
                <div className="bg-white border border-stone-200 overflow-x-auto">
                  <table className="w-full text-sm" data-testid="expenses-table">
                    <thead className="bg-stone-50 border-b border-stone-200">
                      <tr className="text-left">
                        <th className="px-4 py-3 label-uppercase">Date</th>
                        <th className="px-4 py-3 label-uppercase">Category</th>
                        <th className="px-4 py-3 label-uppercase">Note</th>
                        <th className="px-4 py-3 label-uppercase">Logged By</th>
                        <th className="px-4 py-3 label-uppercase text-right">Amount</th>
                        <th className="px-4 py-3 label-uppercase text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="grid-divider-y">
                      {expenses.map((e) => (
                        <tr key={e.id} className="hover:bg-stone-50" data-testid={`expense-row-${e.id}`}>
                          <td className="px-4 py-3 text-stone-700 whitespace-nowrap">{formatDateTime(e.created_at)}</td>
                          <td className="px-4 py-3 capitalize">{EXPENSE_CATEGORIES.find((x) => x.key === e.category)?.label || e.category}</td>
                          <td className="px-4 py-3 text-stone-700">{e.note || "—"}</td>
                          <td className="px-4 py-3 text-stone-700">{e.creator?.full_name || e.creator?.email || <span className="text-stone-400">—</span>}</td>
                          <td className="px-4 py-3 text-right font-medium tabular-nums text-rose-700">{formatINR(e.amount)}</td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => handleDeleteExpense(e)} title="Delete" className="p-1 hover:bg-rose-50 text-stone-400 hover:text-rose-600" data-testid={`expense-delete-${e.id}`}>
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-stone-900 text-white">
                      <tr><td colSpan={4} className="px-4 py-3 label-uppercase text-stone-400">Total</td><td className="px-4 py-3 text-right font-display text-lg tabular-nums">{formatINR(totalExpenses)}</td><td /></tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>
          </div>
        </div>
      </PageBody>

      <ExpenseFormDialog open={expenseOpen} onOpenChange={setExpenseOpen} projectId={project.id} onSaved={load} />
      <ProjectFormDialog open={editOpen} onOpenChange={setEditOpen} customers={customers} project={project} onSaved={load} />
    </div>
  );
}

function ExpenseFormDialog({ open, onOpenChange, projectId, onSaved }) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, reset, setValue, watch } = useForm();

  useEffect(() => {
    if (!open) return;
    reset({ category: "material", amount: "", note: "" });
  }, [open, reset]);

  const onSubmit = async (values) => {
    setSubmitting(true);
    try {
      await createExpense({
        project_id: projectId,
        category: values.category,
        amount: Number(values.amount),
        note: values.note || null,
      }, user.id);
      toast.success("Expense recorded");
      onSaved?.(); onOpenChange(false);
    } catch (e) { toast.error(e.message); }
    finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-none border-stone-300 max-w-md p-0" data-testid="expense-form-dialog">
        <DialogHeader className="px-6 py-5 border-b border-stone-200">
          <div className="label-uppercase">New Expense</div>
          <DialogTitle className="font-display text-2xl tracking-tight">Log a project expense</DialogTitle>
          <DialogDescription className="sr-only">Record an expense by category against this project.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <Label className="label-uppercase">Category</Label>
            <Select value={watch("category") || "material"} onValueChange={(v) => setValue("category", v)}>
              <SelectTrigger className="rounded-none mt-1.5 border-stone-300" data-testid="expense-select-category"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-none">
                {EXPENSE_CATEGORIES.map((c) => <SelectItem key={c.key} value={c.key} className="rounded-none">{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="label-uppercase">Amount (₹) *</Label>
            <Input type="number" step="0.01" className={inputCls} {...register("amount", { required: true })} data-testid="expense-input-amount" />
          </div>
          <div>
            <Label className="label-uppercase">Note</Label>
            <Textarea className={inputCls} {...register("note")} data-testid="expense-input-note" />
          </div>
          <DialogFooter className="-mx-6 -mb-6 px-6 py-4 border-t border-stone-200 bg-stone-50 flex-row justify-end gap-2">
            <Button type="button" variant="outline" className="rounded-none border-stone-300" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting} className="rounded-none bg-stone-900 hover:bg-stone-800 text-white" data-testid="expense-form-submit">{submitting ? "Saving…" : "Add Expense"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
