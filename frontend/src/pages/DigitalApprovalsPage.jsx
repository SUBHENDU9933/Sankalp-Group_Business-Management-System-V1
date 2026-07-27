import { useEffect, useMemo, useState } from "react";
import { PageHeader, PageBody } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus, FileCheck2, Search, X, Copy, Send, ExternalLink, MapPin, Image as ImageIcon, User, Calendar, Trash2, MessageCircle, Mail, ClipboardCheck } from "lucide-react";
import { fetchApprovals, createApproval, softDeleteApproval, APPROVAL_STATUSES } from "@/services/digitalApprovalService";
import { fetchCustomers } from "@/services/customerService";
import { fetchProjects } from "@/services/projectService";
import { uploadFile } from "@/services/attachmentService";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatDateTime } from "@/utils/format";
import { cn } from "@/lib/utils";

const STATUS_STYLES = {
  pending:  { label: "PENDING",  cls: "bg-amber-100 text-amber-800 border-amber-300",  dot: "bg-amber-500" },
  approved: { label: "APPROVED", cls: "bg-emerald-100 text-emerald-800 border-emerald-300", dot: "bg-emerald-500" },
  rejected: { label: "REJECTED", cls: "bg-rose-100 text-rose-800 border-rose-300", dot: "bg-rose-500" },
  expired:  { label: "EXPIRED",  cls: "bg-stone-200 text-stone-700 border-stone-300",  dot: "bg-stone-500" },
};

export default function DigitalApprovalsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState(false);
  const [activeView, setActiveView] = useState(null);   // row for detail sheet
  const [customers, setCustomers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchApprovals({ status, search });
      setRows(data);
    } catch (e) {
      if (/digital_approvals|does not exist/i.test(e.message)) {
        toast.error("Requires schema v14 — apply supabase_schema_v14.sql");
      } else toast.error(e.message);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-line */ }, [status, search]);
  useEffect(() => {
    fetchCustomers().then(setCustomers).catch(() => setCustomers([]));
    fetchProjects().then(setProjects).catch(() => setProjects([]));
  }, []);

  const filtered = useMemo(() => rows, [rows]);

  const handleDelete = async (row) => {
    if (!window.confirm(`Move approval "${row.subject}" to Trash?`)) return;
    try { await softDeleteApproval(row.id, user?.id); toast.success("Moved to Trash"); load(); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div data-testid="digital-approvals-page">
      <PageHeader
        title="Digital Approvals"
        subtitle="Send a magic link to your customer for approval — capture geo, IP, selfie & signature."
        actions={<Button onClick={() => setOpenForm(true)} className="rounded-none bg-stone-900 hover:bg-stone-800 h-9" data-testid="new-approval-btn"><Plus className="w-4 h-4 mr-1" /> New Approval</Button>}
      />
      <PageBody>
        {/* Filter bar */}
        <div className="bg-white border border-stone-200 grid grid-cols-1 md:grid-cols-4 gap-0 grid-divider-x">
          <div className="px-4 py-2 md:col-span-2 flex items-center gap-2">
            <Search className="w-4 h-4 text-stone-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search subject / customer / project…" className="border-0 shadow-none focus-visible:ring-0 px-0 rounded-none h-8" data-testid="da-search" />
            {(search || status !== "all") && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatus("all"); }} className="rounded-none text-xs h-7"><X className="w-3 h-3 mr-1" /> Clear</Button>
            )}
          </div>
          <div className="px-4 py-2">
            <div className="text-[10px] tracking-[0.15em] uppercase font-semibold text-stone-500">Status</div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="rounded-none border-0 shadow-none focus:ring-0 h-8 px-0 bg-transparent" data-testid="da-status-filter"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-none">
                <SelectItem value="all" className="rounded-none">All Statuses</SelectItem>
                {APPROVAL_STATUSES.map((s) => <SelectItem key={s} value={s} className="rounded-none">{s.toUpperCase()}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="px-4 py-2 flex items-center">
            <span className="text-xs text-stone-500">Total: <b className="text-stone-900">{filtered.length}</b></span>
          </div>
        </div>

        {/* List */}
        <div className="mt-4">
          {loading ? (
            <div className="bg-white border border-stone-200 p-8 text-center text-sm text-stone-500">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="bg-white border border-stone-200 p-12 text-center text-sm text-stone-500" data-testid="da-empty">
              <FileCheck2 className="w-8 h-8 text-stone-300 mx-auto mb-2" /> No approvals yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((r) => {
                const style = STATUS_STYLES[r.status] || STATUS_STYLES.pending;
                return (
                  <div key={r.id} className="bg-white border border-stone-200 p-4 cursor-pointer hover:border-stone-400 transition-colors" onClick={() => setActiveView(r)} data-testid={`da-card-${r.id}`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-stone-900 truncate">{r.subject}</div>
                        <div className="text-xs text-stone-500 mt-0.5">
                          {r.customer_name || r.customer?.name || "—"}
                          {(r.project_name || r.project?.project_name) && (<> · <span>{r.project_name || r.project?.project_name}</span></>)}
                        </div>
                      </div>
                      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 text-[10px] tracking-[0.12em] uppercase font-bold border", style.cls)}>
                        <span className={cn("w-1 h-1 rounded-full", style.dot)} />
                        {style.label}
                      </span>
                    </div>
                    {r.description && <div className="text-xs text-stone-600 line-clamp-2 mb-2">{r.description}</div>}
                    <div className="grid grid-cols-2 gap-1 text-[11px] text-stone-500">
                      <div><Calendar className="w-3 h-3 inline mr-1" />{formatDateTime(r.created_at)}</div>
                      <div className="text-right">by {r.creator?.full_name || "—"}</div>
                    </div>
                    {r.status === "approved" && r.response_by_name && (
                      <div className="mt-2 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1">✓ Approved by <b>{r.response_by_name}</b></div>
                    )}
                    {r.status === "rejected" && r.response_by_name && (
                      <div className="mt-2 text-[11px] text-rose-700 bg-rose-50 border border-rose-200 px-2 py-1">✗ Rejected by <b>{r.response_by_name}</b></div>
                    )}
                    {r.status === "expired" && (
                      <div className="mt-2 text-[11px] text-stone-600 bg-stone-100 border border-stone-200 px-2 py-1">⏱ Link expired</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PageBody>

      {openForm && (
        <NewApprovalDialog
          open={openForm}
          onOpenChange={setOpenForm}
          customers={customers}
          projects={projects}
          userId={user?.id}
          onCreated={(r) => { load(); setActiveView(r); }}
        />
      )}
      {activeView && (
        <ApprovalDetailSheet
          approval={activeView}
          open={!!activeView}
          onOpenChange={(o) => !o && setActiveView(null)}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

// ============================================================================
// New Approval Dialog
// ============================================================================
function NewApprovalDialog({ open, onOpenChange, customers, projects, userId, onCreated }) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [photos, setPhotos] = useState([]);   // {url, name}
  const [files, setFiles] = useState([]);     // {url, name}
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const upload = async (fileList, kind) => {
    setUploading(true);
    try {
      const arr = Array.from(fileList);
      const results = [];
      for (const f of arr) {
        const r = await uploadFile(f, `approvals/${kind}`);
        results.push(r);
      }
      if (kind === "photos") setPhotos((p) => [...p, ...results]);
      else setFiles((p) => [...p, ...results]);
      toast.success(`Uploaded ${results.length} ${kind}`);
    } catch (e) { toast.error(e.message); }
    finally { setUploading(false); }
  };

  const handleSubmit = async () => {
    if (!subject.trim()) { toast.error("Subject is required"); return; }
    setSaving(true);
    const cust = customers.find((c) => c.id === customerId);
    const proj = projects.find((p) => p.id === projectId);
    try {
      const row = await createApproval({
        subject: subject.trim(),
        description: description.trim() || null,
        customer_id: customerId || null,
        customer_name: cust?.name || null,
        project_id: projectId || null,
        project_name: proj?.project_name || null,
        photo_urls: photos.map((p) => ({ url: p.url, name: p.name })),
        file_urls: files.map((f) => ({ url: f.url, name: f.name, type: f.type })),
        created_by: userId,
      });
      toast.success("Approval created — share the link with your customer");
      onCreated?.(row);
      onOpenChange(false);
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-none border-stone-300">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">New Digital Approval</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-[10px] tracking-[0.15em] uppercase font-semibold text-stone-500">Subject *</label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Final Kitchen Design Approval" className="rounded-none border-stone-300 mt-1" data-testid="da-subject" />
          </div>
          <div>
            <label className="text-[10px] tracking-[0.15em] uppercase font-semibold text-stone-500">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What are they approving? Include any material specs, colours, dimensions…" className="rounded-none border-stone-300 mt-1" data-testid="da-desc" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] tracking-[0.15em] uppercase font-semibold text-stone-500">Customer</label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger className="rounded-none border-stone-300 mt-1" data-testid="da-customer"><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent className="rounded-none max-h-[300px]">
                  {customers.map((c) => <SelectItem key={c.id} value={c.id} className="rounded-none">{c.name} · {c.phone || ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] tracking-[0.15em] uppercase font-semibold text-stone-500">Project</label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="rounded-none border-stone-300 mt-1" data-testid="da-project"><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent className="rounded-none max-h-[300px]">
                  {projects.map((p) => <SelectItem key={p.id} value={p.id} className="rounded-none">{p.project_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] tracking-[0.15em] uppercase font-semibold text-stone-500">Photos ({photos.length})</label>
              <label className="mt-1 block cursor-pointer border-2 border-dashed border-stone-300 p-4 text-center text-xs text-stone-500 hover:bg-stone-50">
                <ImageIcon className="w-6 h-6 text-stone-400 mx-auto mb-1" />
                {uploading ? "Uploading…" : "Click to add photos"}
                <input type="file" multiple accept="image/*" onChange={(e) => upload(e.target.files, "photos")} className="hidden" data-testid="da-photo-upload" />
              </label>
              {photos.length > 0 && (
                <div className="mt-2 grid grid-cols-3 gap-1">
                  {photos.map((p, i) => (
                    <div key={i} className="relative aspect-square bg-stone-100 border border-stone-200 overflow-hidden">
                      <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                      <button onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))} className="absolute top-0 right-0 bg-stone-900 text-white p-0.5"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="text-[10px] tracking-[0.15em] uppercase font-semibold text-stone-500">Files (PDF/Doc) ({files.length})</label>
              <label className="mt-1 block cursor-pointer border-2 border-dashed border-stone-300 p-4 text-center text-xs text-stone-500 hover:bg-stone-50">
                <ClipboardCheck className="w-6 h-6 text-stone-400 mx-auto mb-1" />
                {uploading ? "Uploading…" : "Click to add files"}
                <input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx" onChange={(e) => upload(e.target.files, "files")} className="hidden" data-testid="da-file-upload" />
              </label>
              {files.length > 0 && (
                <div className="mt-2 space-y-1">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs bg-stone-50 border border-stone-200 px-2 py-1">
                      <span className="flex-1 truncate">{f.name}</span>
                      <button onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="text-xs text-stone-500 bg-amber-50 border border-amber-200 p-3">
            📌 <b>Link expiry:</b> Customer has <b>7 days</b> to respond. Once they respond, the link becomes read-only evidence.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-none border-stone-300">Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || uploading} className="rounded-none bg-stone-900 hover:bg-stone-800" data-testid="da-submit">
            {saving ? "Creating…" : "Create & Get Link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Approval Detail Sheet
// ============================================================================
function ApprovalDetailSheet({ approval, open, onOpenChange, onDelete }) {
  const link = `${window.location.origin}/approve/${approval.token}`;
  const style = STATUS_STYLES[approval.status] || STATUS_STYLES.pending;

  const copyLink = () => {
    navigator.clipboard.writeText(link);
    toast.success("Link copied");
  };
  const share = (channel) => {
    const msg = encodeURIComponent(`Hi ${approval.customer_name || ""},\n\nPlease review & approve:\n${approval.subject}\n\n${link}\n\n— Sankalp Group`);
    const urls = {
      whatsapp: `https://wa.me/?text=${msg}`,
      sms: `sms:?&body=${msg}`,
      email: `mailto:?subject=${encodeURIComponent(approval.subject)}&body=${msg}`,
    };
    window.open(urls[channel], "_blank");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl rounded-none overflow-y-auto" data-testid="da-detail-sheet">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl tracking-tight">{approval.subject}</SheetTitle>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 text-[10px] tracking-[0.12em] uppercase font-bold border", style.cls)}>
              <span className={cn("w-1 h-1 rounded-full", style.dot)} />
              {style.label}
            </span>
            <span className="text-xs text-stone-500">Created {formatDateTime(approval.created_at)} by {approval.creator?.full_name}</span>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Magic Link */}
          <div className="border border-stone-200 bg-stone-50 p-4">
            <div className="text-[10px] tracking-[0.15em] uppercase font-semibold text-stone-500 mb-2">Customer Magic Link</div>
            <div className="flex items-center gap-2 bg-white border border-stone-300 px-3 py-2">
              <ExternalLink className="w-4 h-4 text-stone-400" />
              <input readOnly value={link} className="flex-1 text-xs bg-transparent outline-none font-mono truncate" data-testid="da-link-input" />
              <button onClick={copyLink} className="p-1 hover:bg-stone-100" title="Copy" data-testid="da-copy-link"><Copy className="w-4 h-4" /></button>
            </div>
            <div className="flex gap-1 mt-2">
              <Button size="sm" variant="outline" onClick={() => share("whatsapp")} className="rounded-none border-stone-300 hover:bg-emerald-50 hover:text-emerald-700 h-8 text-xs flex-1" data-testid="da-share-whatsapp"><MessageCircle className="w-3.5 h-3.5 mr-1" /> WhatsApp</Button>
              <Button size="sm" variant="outline" onClick={() => share("sms")} className="rounded-none border-stone-300 hover:bg-blue-50 hover:text-blue-700 h-8 text-xs flex-1"><Send className="w-3.5 h-3.5 mr-1" /> SMS</Button>
              <Button size="sm" variant="outline" onClick={() => share("email")} className="rounded-none border-stone-300 hover:bg-amber-50 hover:text-amber-700 h-8 text-xs flex-1"><Mail className="w-3.5 h-3.5 mr-1" /> Email</Button>
            </div>
            <div className="text-[11px] text-stone-500 mt-2">Expires: {formatDateTime(approval.expires_at)}</div>
          </div>

          {/* Details */}
          <div>
            <div className="label-uppercase mb-2">Details</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Field label="Customer" value={approval.customer_name || approval.customer?.name} />
              <Field label="Project" value={approval.project_name || approval.project?.project_name} />
            </div>
            {approval.description && (
              <div className="mt-3">
                <div className="label-uppercase">Description</div>
                <div className="text-sm text-stone-700 mt-1 whitespace-pre-wrap">{approval.description}</div>
              </div>
            )}
          </div>

          {/* Attachments */}
          {(approval.photo_urls?.length > 0) && (
            <div>
              <div className="label-uppercase mb-2">Photo Attachments ({approval.photo_urls.length})</div>
              <div className="grid grid-cols-3 gap-2">
                {approval.photo_urls.map((p, i) => (
                  <a key={i} href={p.url} target="_blank" rel="noreferrer" className="block aspect-square bg-stone-100 border border-stone-200 overflow-hidden">
                    <img src={p.url} alt={p.name} className="w-full h-full object-cover hover:opacity-80" />
                  </a>
                ))}
              </div>
            </div>
          )}
          {(approval.file_urls?.length > 0) && (
            <div>
              <div className="label-uppercase mb-2">File Attachments ({approval.file_urls.length})</div>
              <div className="space-y-1">
                {approval.file_urls.map((f, i) => (
                  <a key={i} href={f.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm bg-stone-50 border border-stone-200 px-3 py-2 hover:bg-stone-100">
                    <ClipboardCheck className="w-4 h-4 text-stone-500" />
                    <span className="flex-1 truncate">{f.name}</span>
                    <ExternalLink className="w-3 h-3 text-stone-400" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Response evidence */}
          {approval.response_at && (
            <div className={cn("border p-4", approval.status === "approved" ? "border-emerald-300 bg-emerald-50" : "border-rose-300 bg-rose-50")}>
              <div className="label-uppercase mb-3">Customer Response — Evidence</div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Field label="Status" value={STATUS_STYLES[approval.status].label} />
                <Field label="At" value={formatDateTime(approval.response_at)} />
                <Field label="Name (typed)" value={approval.response_by_name} />
                <Field label="IP" value={approval.response_ip} />
                {approval.response_lat && (<>
                  <Field label="Latitude" value={approval.response_lat?.toFixed(6)} />
                  <Field label="Longitude" value={approval.response_lng?.toFixed(6)} />
                </>)}
              </div>
              {approval.response_comment && (
                <div className="mt-3">
                  <div className="label-uppercase">Comment / Change Request</div>
                  <div className="text-sm text-stone-800 bg-white border border-stone-200 p-2 mt-1 whitespace-pre-wrap">{approval.response_comment}</div>
                </div>
              )}
              {approval.response_photo_url && (
                <div className="mt-3">
                  <div className="label-uppercase mb-1">Customer Selfie / Photo</div>
                  <a href={approval.response_photo_url} target="_blank" rel="noreferrer">
                    <img src={approval.response_photo_url} alt="Customer" className="max-w-[200px] border border-stone-300" />
                  </a>
                </div>
              )}
              {approval.response_lat && approval.response_lng && (
                <div className="mt-3">
                  <a href={`https://maps.google.com/?q=${approval.response_lat},${approval.response_lng}`} target="_blank" rel="noreferrer" className="text-xs text-blue-700 hover:underline inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> View on Google Maps</a>
                </div>
              )}
              {approval.response_user_agent && (
                <div className="mt-2 text-[10px] text-stone-500 font-mono truncate" title={approval.response_user_agent}>Device: {approval.response_user_agent}</div>
              )}
            </div>
          )}

          <div className="pt-4 border-t border-stone-200">
            <Button variant="outline" onClick={() => onDelete(approval)} className="rounded-none border-rose-300 text-rose-700 hover:bg-rose-50 h-8 text-xs" data-testid="da-delete">
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Move to Trash
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-[10px] tracking-[0.15em] uppercase font-semibold text-stone-500">{label}</div>
      <div className="text-sm text-stone-900 mt-0.5 break-words">{value || <span className="text-stone-400">—</span>}</div>
    </div>
  );
}
