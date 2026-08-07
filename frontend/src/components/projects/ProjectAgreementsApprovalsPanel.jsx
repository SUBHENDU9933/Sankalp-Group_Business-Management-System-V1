import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FileSignature, FileCheck2, Upload, FileText, Trash2, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatDateTime } from "@/utils/format";
import { fetchProjectDocuments, uploadProjectDocument, deleteProjectDocument } from "@/services/projectDocumentService";

// Only finished/final items belong in "Necessary Documents" — a draft
// agreement or a still-pending approval isn't a document yet, it's a
// work-in-progress; it stays out until it's actually signed/approved.
const SIGNED_AGREEMENT_STATUSES = ["signed_physical", "signed_digital"];

export default function ProjectAgreementsApprovalsPanel({ projectId }) {
  const { user } = useAuth();
  const [agreements, setAgreements] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [{ data: ag }, { data: ap }, docs] = await Promise.all([
        supabase.from("agreements").select("id, title, status, signed_at, created_at")
          .eq("project_id", projectId).in("status", SIGNED_AGREEMENT_STATUSES).is("deleted_at", null)
          .order("signed_at", { ascending: false }),
        supabase.from("digital_approvals").select("id, subject, status, response_at, created_at")
          .eq("project_id", projectId).eq("status", "approved").is("deleted_at", null)
          .order("response_at", { ascending: false }),
        fetchProjectDocuments(projectId).catch(() => []),
      ]);
      setAgreements(ag || []);
      setApprovals(ap || []);
      setDocuments(docs);
    } catch {}
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const f of files) await uploadProjectDocument(projectId, f, user.id);
      toast.success(`${files.length} document(s) uploaded`);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setUploading(false); e.target.value = ""; }
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`Remove "${doc.name}"?`)) return;
    try { await deleteProjectDocument(doc.id, user.id); toast.success("Removed"); load(); }
    catch (err) { toast.error(err.message); }
  };

  if (loading) return null;
  const isImage = (t) => t?.startsWith("image/");

  return (
    <section className="border border-stone-200 rounded-2xl p-5 bg-white">
      <div className="label-uppercase mb-3">Necessary Documents</div>

      {(agreements.length > 0 || approvals.length > 0) && (
        <div className="space-y-4 mb-4">
          {agreements.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mb-2"><FileSignature className="w-3.5 h-3.5" /> Signed Agreements</div>
              <div className="space-y-1.5">
                {agreements.map((a) => (
                  <Link key={a.id} to={`/agreements/${a.id}/print`} className="flex items-center justify-between px-3 py-2 rounded-lg border border-emerald-100 bg-emerald-50/40 hover:bg-emerald-50 text-sm">
                    <span className="truncate">{a.title}</span>
                    <span className="text-[10px] text-emerald-700 font-semibold shrink-0 ml-2">
                      {a.status === "signed_digital" ? "Signed Digitally" : "Signed Physically"} · {formatDateTime(a.signed_at || a.created_at)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {approvals.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mb-2"><FileCheck2 className="w-3.5 h-3.5" /> Approved Digital Approvals</div>
              <div className="space-y-1.5">
                {approvals.map((a) => (
                  <Link key={a.id} to="/digital-approvals" className="flex items-center justify-between px-3 py-2 rounded-lg border border-emerald-100 bg-emerald-50/40 hover:bg-emerald-50 text-sm">
                    <span className="truncate">{a.subject}</span>
                    <span className="text-[10px] text-emerald-700 font-semibold shrink-0 ml-2">Approved {formatDateTime(a.response_at || a.created_at)}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div>
        <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mb-2"><FileText className="w-3.5 h-3.5" /> Other Documents</div>
        {documents.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mb-3">
            {documents.map((d) => (
              <div key={d.id} className="border border-slate-200 rounded-lg overflow-hidden group relative">
                <a href={d.url} target="_blank" rel="noreferrer" className="block">
                  {isImage(d.file_type) ? (
                    <img src={d.url} alt={d.name} className="w-full h-24 object-cover" />
                  ) : (
                    <div className="w-full h-24 bg-slate-50 flex items-center justify-center">
                      <FileText className="w-8 h-8 text-slate-300" />
                    </div>
                  )}
                </a>
                <div className="px-2 py-1.5 bg-white">
                  <div className="text-xs font-medium text-slate-700 truncate">{d.name}</div>
                  <div className="text-[10px] text-slate-400">{d.uploader?.full_name || "—"} · {formatDateTime(d.created_at)}</div>
                </div>
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <a href={d.url} target="_blank" rel="noreferrer" className="bg-white/90 rounded p-1 shadow"><ExternalLink className="w-3 h-3 text-slate-600" /></a>
                  <button onClick={() => handleDelete(d)} className="bg-white/90 rounded p-1 shadow"><Trash2 className="w-3 h-3 text-rose-600" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
        <label className="inline-flex items-center gap-2 px-3 py-2 border-2 border-dashed border-slate-300 rounded-lg text-xs text-slate-600 hover:bg-slate-50 cursor-pointer">
          <Upload className="w-3.5 h-3.5" />
          {uploading ? "Uploading…" : "Upload documents (design files, photos, ID, etc.)"}
          <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={handleUpload} disabled={uploading} data-testid="project-document-upload-input" />
        </label>
      </div>
    </section>
  );
}
