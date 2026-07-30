import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader, PageBody } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/shared/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Plus, Search, MoreVertical, Eye, Pencil, Trash2, FileSignature, Send, Ban, Settings2 } from "lucide-react";
import { fetchAgreements, softDeleteAgreement, voidAgreement } from "@/services/agreementService";
import { useAuth } from "@/contexts/AuthContext";
import { formatINR, formatDateTime, AGREEMENT_STATUSES } from "@/utils/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function AgreementsPage() {
  const { user, isAdmin } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    try { setRows(await fetchAgreements()); }
    catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const hay = [r.title, r.customer_name, r.project_name, r.estimate_no].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [rows, search, statusFilter]);

  const handleVoid = async (row) => {
    if (!window.confirm(`Void agreement "${row.title}"? It will no longer be signable.`)) return;
    try { await voidAgreement(row.id); toast.success("Agreement voided"); load(); }
    catch (e) { toast.error(e.message); }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Move "${row.title}" to Trash?`)) return;
    try { await softDeleteAgreement(row.id, user.id); toast.success("Moved to Trash"); load(); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <>
      <PageHeader
        title="Agreements"
        subtitle="Contracts & MoUs"
        actions={
          <>
            {isAdmin && (
              <Button variant="outline" className="rounded-lg" onClick={() => nav("/agreement-templates")} data-testid="agreements-templates-button">
                <Settings2 className="w-4 h-4 mr-1.5" /> Templates
              </Button>
            )}
            <Button className="rounded-lg bg-blue-700 hover:bg-blue-800 text-white" onClick={() => nav("/agreements/new")} data-testid="agreements-new-button">
              <Plus className="w-4 h-4 mr-1.5" /> New Agreement
            </Button>
          </>
        }
      />
      <PageBody>
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by client, project, estimate no…"
              className="pl-9 rounded-lg"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="agreements-search-input"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-56 rounded-lg" data-testid="agreements-status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {AGREEMENT_STATUSES.map((s) => (
                <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="text-center py-16 text-slate-400">Loading agreements…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-slate-300 rounded-2xl">
            <FileSignature className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <div className="text-slate-500">No agreements yet.</div>
            <Button className="mt-4 rounded-lg bg-blue-700 hover:bg-blue-800 text-white" onClick={() => nav("/agreements/new")}>
              <Plus className="w-4 h-4 mr-1.5" /> Create your first agreement
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((r) => {
              const meta = AGREEMENT_STATUSES.find((s) => s.key === r.status) || AGREEMENT_STATUSES[0];
              return (
                <div key={r.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-4 flex items-center justify-between gap-4" data-testid={`agreement-row-${r.id}`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900">{r.title}</span>
                      <Chip className={meta.color}>{meta.label}</Chip>
                    </div>
                    <div className="text-sm text-slate-500 mt-1 truncate">
                      {r.customer_name || "—"} · {r.project_name || "No linked project"} {r.estimate_no ? `· Est. ${r.estimate_no}` : ""}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {formatINR(r.merge_data?.contract_value)} · Created {formatDateTime(r.created_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" className="rounded-lg" onClick={() => nav(`/agreements/${r.id}/print`)} data-testid={`agreement-view-${r.id}`}>
                      <Eye className="w-4 h-4 mr-1" /> View / PDF
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="rounded-lg"><MoreVertical className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => nav(`/agreements/${r.id}/edit`)} data-testid={`agreement-edit-${r.id}`}>
                          <Pencil className="w-4 h-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        {r.status === "draft" && (
                          <DropdownMenuItem onClick={() => nav(`/agreements/${r.id}/print`)} data-testid={`agreement-send-${r.id}`}>
                            <Send className="w-4 h-4 mr-2" /> Send for Digital Signature
                          </DropdownMenuItem>
                        )}
                        {r.status !== "void" && (
                          <DropdownMenuItem onClick={() => handleVoid(r)} className="text-amber-700">
                            <Ban className="w-4 h-4 mr-2" /> Void
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDelete(r)} className="text-rose-600" data-testid={`agreement-delete-${r.id}`}>
                          <Trash2 className="w-4 h-4 mr-2" /> Move to Trash
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PageBody>
    </>
  );
}
