import { useEffect, useMemo, useState } from "react";
import { PageHeader, PageBody } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus, FileCheck2, Search, X, Copy, Send, ExternalLink, MapPin, Image as ImageIcon, User, Calendar, Trash2, MessageCircle, Mail, ClipboardCheck, Printer, Pencil, Lock } from "lucide-react";
import { fetchApprovals, createApproval, updateApproval, softDeleteApproval, APPROVAL_STATUSES } from "@/services/digitalApprovalService";
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
  const [editingApproval, setEditingApproval] = useState(null); // row being edited, or null for "new"
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
        actions={<Button onClick={() => { setEditingApproval(null); setOpenForm(true); }} className="rounded-none bg-stone-900 hover:bg-stone-800 h-9" data-testid="new-approval-btn"><Plus className="w-4 h-4 mr-1" /> New Approval</Button>}
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
          key={editingApproval?.id || "new"}
          open={openForm}
          onOpenChange={(o) => { setOpenForm(o); if (!o) setEditingApproval(null); }}
          customers={customers}
          projects={projects}
          userId={user?.id}
          editApproval={editingApproval}
          onCreated={(r) => { load(); setActiveView(r); }}
          onUpdated={(r) => { load(); setActiveView(r); }}
        />
      )}
      {activeView && (
        <ApprovalDetailSheet
          approval={activeView}
          open={!!activeView}
          onOpenChange={(o) => !o && setActiveView(null)}
          onDelete={handleDelete}
          onEdit={(r) => { setEditingApproval(r); setOpenForm(true); setActiveView(null); }}
        />
      )}
    </div>
  );
}

// ============================================================================
// New Approval Dialog
// ============================================================================
function NewApprovalDialog({ open, onOpenChange, customers, projects, userId, editApproval, onCreated, onUpdated }) {
  const isEdit = !!editApproval;
  const [subject, setSubject] = useState(editApproval?.subject || "");
  const [description, setDescription] = useState(editApproval?.description || "");
  const [customerId, setCustomerId] = useState(editApproval?.customer_id || "");
  const [projectId, setProjectId] = useState(editApproval?.project_id || "");
  const [photos, setPhotos] = useState(editApproval?.photo_urls || []);   // {url, name}
  const [files, setFiles] = useState(editApproval?.file_urls || []);     // {url, name}
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
    const payload = {
      subject: subject.trim(),
      description: description.trim() || null,
      customer_id: customerId || null,
      customer_name: cust?.name || null,
      project_id: projectId || null,
      project_name: proj?.project_name || null,
      photo_urls: photos.map((p) => ({ url: p.url, name: p.name })),
      file_urls: files.map((f) => ({ url: f.url, name: f.name, type: f.type })),
    };
    try {
      if (isEdit) {
        const row = await updateApproval(editApproval.id, payload);
        toast.success("Approval updated");
        onUpdated?.(row);
      } else {
        const row = await createApproval({ ...payload, created_by: userId });
        toast.success("Approval created — share the link with your customer");
        onCreated?.(row);
      }
      onOpenChange(false);
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-none border-stone-300">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{isEdit ? "Edit Digital Approval" : "New Digital Approval"}</DialogTitle>
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
            {saving ? (isEdit ? "Saving…" : "Creating…") : (isEdit ? "Save Changes" : "Create & Get Link")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Approval Detail Sheet
// ============================================================================
function ApprovalDetailSheet({ approval, open, onOpenChange, onDelete, onEdit }) {
  const link = `${window.location.origin}/approve/${approval.token}`;
  const style = STATUS_STYLES[approval.status] || STATUS_STYLES.pending;

  const copyLink = () => {
    navigator.clipboard.writeText(link);
    toast.success("Link copied");
  };
  const share = (channel) => {
    const title = `Approval Info : ${approval.subject}${approval.customer_name ? ` (${approval.customer_name})` : ""}`;
    const msg = encodeURIComponent(
      `*${title}*\n\n` +
      (approval.project_name ? `Project: ${approval.project_name}\n` : "") +
      (approval.description ? `\n${approval.description}\n` : "") +
      `\nPlease review & respond:\n${link}\n\n— Sankalp Group · Business Solutions`
    );
    const urls = {
      whatsapp: `https://wa.me/?text=${msg}`,
      sms: `sms:?&body=${msg}`,
      email: `mailto:?subject=${encodeURIComponent(title)}&body=${msg}`,
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
              {(approval.response_photo_url || (approval.response_lat && approval.response_lng)) && (
                <div className="mt-3">
                  <div className="label-uppercase mb-1">Customer Selfie &amp; Location</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {approval.response_photo_url && (
                      <a href={approval.response_photo_url} target="_blank" rel="noreferrer" data-testid="da-detail-selfie" className="block border-2 border-stone-300 shadow overflow-hidden bg-black">
                        <img src={approval.response_photo_url} alt="Customer" className="w-full block" />
                      </a>
                    )}
                    {approval.response_lat && approval.response_lng && (
                      <a
                        href={`https://maps.google.com/?q=${approval.response_lat},${approval.response_lng}`}
                        target="_blank"
                        rel="noreferrer"
                        data-testid="da-detail-map"
                        className="block border-2 border-stone-300 shadow overflow-hidden bg-stone-100"
                      >
                        <img
                          src={`https://staticmap.openstreetmap.de/staticmap.php?center=${approval.response_lat},${approval.response_lng}&zoom=16&size=500x400&markers=${approval.response_lat},${approval.response_lng},red-pushpin`}
                          alt="Location map"
                          className="w-full block"
                          onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.parentElement.innerHTML += `<div style='padding:1rem;text-align:center;font-size:11px;color:#666'>Static map unavailable · <span style='color:#1d4ed8;text-decoration:underline'>Open in Google Maps</span></div>`; }}
                        />
                      </a>
                    )}
                  </div>
                  <div className="text-[10px] text-stone-500 mt-1 italic">
                    Click images to open full-size. Selfie has watermark; map is OpenStreetMap · click for Google Maps.
                  </div>
                </div>
              )}
              {approval.response_user_agent && (
                <div className="mt-2 text-[10px] text-stone-500 font-mono truncate" title={approval.response_user_agent}>Device: {approval.response_user_agent}</div>
              )}
            </div>
          )}

          <div className="pt-4 border-t border-stone-200 flex items-center gap-2 flex-wrap">
            <Button variant="outline" onClick={() => printApprovalRecord(approval)} className="rounded-none border-stone-300 hover:bg-stone-100 h-8 text-xs" data-testid="da-print">
              <Printer className="w-3.5 h-3.5 mr-1" /> Print / Save PDF
            </Button>
            {approval.status === "pending" ? (
              <>
                <Button variant="outline" onClick={() => onEdit(approval)} className="rounded-none border-stone-300 hover:bg-stone-100 h-8 text-xs" data-testid="da-edit">
                  <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                </Button>
                <Button variant="outline" onClick={() => onDelete(approval)} className="rounded-none border-rose-300 text-rose-700 hover:bg-rose-50 h-8 text-xs" data-testid="da-delete">
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Move to Trash
                </Button>
              </>
            ) : (
              <span className="text-[11px] text-stone-500 italic flex items-center gap-1">
                <Lock className="w-3 h-3" /> Signed — this record is locked and can no longer be edited or deleted.
              </span>
            )}
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

// -- Print-ready evidence document (opens in new window, auto-prints) --
function printApprovalRecord(approval) {
  const w = window.open("", "_blank", "width=900,height=1200");
  if (!w) { alert("Popup blocked — allow popups to print"); return; }
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  const fmt = (d) => d ? new Date(d).toLocaleString('en-IN') : "—";
  const status = (approval.status || "pending").toUpperCase();
  const statusColor = approval.status === "approved" ? "#059669" : approval.status === "rejected" ? "#dc2626" : "#6b7280";
  const photos = (approval.photo_urls || []).map((p, i) => `<div class="a-photo"><img src="${esc(p.url)}" alt=""/><div class="cap">Attachment #${i + 1}</div></div>`).join("");
  const files = (approval.file_urls || []).map((f) => `<li>${esc(f.name || "file")} — <span class="u">${esc(f.url)}</span></li>`).join("");
  const mapUrl = approval.response_lat && approval.response_lng ? `https://maps.google.com/?q=${approval.response_lat},${approval.response_lng}` : "";
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Digital Approval — ${esc(approval.subject)}</title>
    <style>
      *{box-sizing:border-box}
      body{font-family:'Inter','Helvetica Neue',Arial,sans-serif;color:#0f172a;margin:24px;font-size:12px;line-height:1.5}
      .head{border-bottom:3px solid #1e3a8a;padding-bottom:12px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-end;gap:16px}
      .brand{font-size:20px;font-weight:800;color:#1e3a8a}
      .brand small{display:block;font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:#64748b;font-weight:600;margin-top:2px}
      h1{font-size:26px;margin:0 0 4px;color:#0c1c3e;font-family:Georgia,'Times New Roman',serif}
      .status{display:inline-block;padding:5px 14px;color:#fff;background:${statusColor};font-weight:800;font-size:11px;letter-spacing:.2em;border-radius:2px}
      .sub{color:#64748b;font-size:10px;letter-spacing:.15em;text-transform:uppercase;margin-top:6px}
      section{background:#f8fafc;border:1px solid #cbd5e1;padding:14px;margin:14px 0}
      section h3{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#1e3a8a;font-weight:800;margin:0 0 8px;border-bottom:1px solid #cbd5e1;padding-bottom:6px}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .field label{display:block;font-size:9px;letter-spacing:.15em;text-transform:uppercase;color:#64748b;font-weight:700}
      .field span{font-size:13px;color:#0f172a;font-weight:600;word-break:break-word}
      .mono{font-family:'JetBrains Mono',monospace;font-size:11px}
      .a-photos{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
      .a-photo{border:1px solid #cbd5e1;background:#fff;padding:4px;text-align:center}
      .a-photo img{width:100%;max-height:200px;object-fit:contain}
      .a-photo .cap{font-size:9px;color:#64748b;margin-top:2px}
      .selfie{max-width:220px;border:2px solid #cbd5e1;padding:4px;background:#fff;margin-top:6px}
      .footer{border-top:2px solid #1e3a8a;margin-top:22px;padding-top:10px;font-size:9px;color:#64748b;text-align:center;letter-spacing:.1em;text-transform:uppercase}
      .box{white-space:pre-wrap;background:#fff;border:1px solid #cbd5e1;padding:8px;font-size:12px}
      .u{color:#1d4ed8;word-break:break-all;text-decoration:underline}
      .no-print{margin-bottom:12px}
      .no-print button{padding:8px 16px;background:#1e3a8a;color:#fff;border:0;font-weight:700;cursor:pointer;font-size:12px}
      @media print{.no-print{display:none}}
      @page{size:A4;margin:14mm}
    </style></head><body>
    <div class="no-print"><button onclick="window.print()">🖨 Print / Save as PDF</button></div>
    <div class="head">
      <div>
        <div class="brand">SANKALP GROUP · BUSINESS SOLUTIONS<small>Interior & Infra Solutions</small></div>
        <h1>Digital Approval Record</h1>
        <div class="sub">Legally-binding electronic acceptance · Generated ${new Date().toLocaleString('en-IN')}</div>
      </div>
      <span class="status">${status}</span>
    </div>
    <section>
      <h3>Approval Subject</h3>
      <div style="font-size:16px;font-weight:700;color:#0c1c3e;font-family:Georgia,serif">${esc(approval.subject)}</div>
      ${approval.description ? `<div class="box" style="margin-top:8px">${esc(approval.description)}</div>` : ""}
    </section>
    <section>
      <h3>Request Details</h3>
      <div class="grid">
        <div class="field"><label>Customer</label><span>${esc(approval.customer_name || approval.customer?.name || "—")}</span></div>
        <div class="field"><label>Project</label><span>${esc(approval.project_name || approval.project?.project_name || "—")}</span></div>
        <div class="field"><label>Created By</label><span>${esc(approval.creator?.full_name || approval.creator?.email || "—")}</span></div>
        <div class="field"><label>Created At</label><span>${fmt(approval.created_at)}</span></div>
        <div class="field"><label>Expires At</label><span>${fmt(approval.expires_at)}</span></div>
        <div class="field"><label>Token</label><span class="mono">${esc(approval.token?.slice(0, 24))}…</span></div>
      </div>
    </section>
    ${photos ? `<section><h3>Attached Photos (${approval.photo_urls.length})</h3><div class="a-photos">${photos}</div></section>` : ""}
    ${files ? `<section><h3>Attached Files</h3><ul>${files}</ul></section>` : ""}
    ${approval.response_at ? `
    <section style="background:${approval.status === "approved" ? "#ecfdf5" : "#fef2f2"};border-color:${statusColor}">
      <h3 style="color:${statusColor}">Customer Response — Evidence</h3>
      <div class="grid">
        <div class="field"><label>Decision</label><span style="color:${statusColor};font-weight:800">${status}</span></div>
        <div class="field"><label>Responded By (Typed Name)</label><span>${esc(approval.response_by_name || "—")}</span></div>
        <div class="field"><label>Response Time</label><span>${fmt(approval.response_at)}</span></div>
        <div class="field"><label>IP Address</label><span class="mono">${esc(approval.response_ip || "—")}</span></div>
        ${approval.response_lat ? `
          <div class="field"><label>Latitude</label><span class="mono">${approval.response_lat.toFixed(6)}</span></div>
          <div class="field"><label>Longitude</label><span class="mono">${approval.response_lng.toFixed(6)}</span></div>
          <div class="field" style="grid-column:span 2"><label>Google Maps</label><span class="u">${mapUrl}</span></div>
        ` : ""}
      </div>
      ${approval.response_comment ? `<div style="margin-top:10px"><label style="display:block;font-size:9px;letter-spacing:.15em;text-transform:uppercase;color:#64748b;font-weight:700">Customer Comment / Change Request</label><div class="box">${esc(approval.response_comment)}</div></div>` : ""}
      ${approval.response_photo_url || (approval.response_lat && approval.response_lng) ? `<div style="margin-top:10px"><label style="display:block;font-size:9px;letter-spacing:.15em;text-transform:uppercase;color:#64748b;font-weight:700">Customer Selfie &amp; Location</label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px">
          ${approval.response_photo_url ? `<img src="${esc(approval.response_photo_url)}" style="width:100%;border:2px solid #cbd5e1;background:#000" alt="Selfie"/>` : `<div style="background:#f1f5f9;border:2px solid #cbd5e1;padding:20px;text-align:center;font-size:10px;color:#64748b">Selfie not captured</div>`}
          ${approval.response_lat && approval.response_lng ? `<img src="https://staticmap.openstreetmap.de/staticmap.php?center=${approval.response_lat},${approval.response_lng}&zoom=16&size=500x400&markers=${approval.response_lat},${approval.response_lng},red-pushpin" style="width:100%;border:2px solid #cbd5e1;background:#f1f5f9" alt="Location map"/>` : `<div style="background:#f1f5f9;border:2px solid #cbd5e1;padding:20px;text-align:center;font-size:10px;color:#64748b">GPS not captured</div>`}
        </div>
      </div>` : ""}
      ${approval.response_user_agent ? `<div style="margin-top:10px;font-size:9px;color:#64748b">Device: ${esc(approval.response_user_agent)}</div>` : ""}
    </section>` : `<section><h3>Response Status</h3><div style="text-align:center;color:${statusColor};font-size:14px;font-weight:700;padding:12px">Awaiting customer response · Link expires ${fmt(approval.expires_at)}</div></section>`}
    <div class="footer">This is a system-generated digital record. Sankalp Group · Business Solutions · © ${new Date().getFullYear()}</div>
  </body></html>`);
  w.document.close();
  setTimeout(() => { try { w.focus(); w.print(); } catch(_){ /* noop */ } }, 500);
}
