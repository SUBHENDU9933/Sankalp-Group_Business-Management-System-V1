import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileSignature, FileCheck2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { AGREEMENT_STATUSES } from "@/utils/format";

const APPROVAL_STATUS_META = {
  pending:  { label: "Pending",  cls: "bg-amber-50 text-amber-800 border-amber-300" },
  approved: { label: "Approved", cls: "bg-emerald-50 text-emerald-800 border-emerald-300" },
  rejected: { label: "Rejected", cls: "bg-rose-50 text-rose-800 border-rose-300" },
  expired:  { label: "Expired",  cls: "bg-slate-100 text-slate-600 border-slate-300" },
};

export default function ProjectAgreementsApprovalsPanel({ projectId }) {
  const [agreements, setAgreements] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      setLoading(true);
      try {
        const [{ data: ag }, { data: ap }] = await Promise.all([
          supabase.from("agreements").select("id, title, status, created_at").eq("project_id", projectId).is("deleted_at", null).order("created_at", { ascending: false }),
          supabase.from("digital_approvals").select("id, subject, status, created_at").eq("project_id", projectId).is("deleted_at", null).order("created_at", { ascending: false }),
        ]);
        setAgreements(ag || []);
        setApprovals(ap || []);
      } catch {}
      finally { setLoading(false); }
    })();
  }, [projectId]);

  if (loading) return null;
  if (agreements.length === 0 && approvals.length === 0) return null;

  return (
    <section className="border border-stone-200 rounded-2xl p-5 bg-white">
      <div className="label-uppercase mb-3">Agreements &amp; Digital Approvals</div>
      <div className="space-y-4">
        {agreements.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mb-2"><FileSignature className="w-3.5 h-3.5" /> Agreements</div>
            <div className="space-y-1.5">
              {agreements.map((a) => {
                const meta = AGREEMENT_STATUSES.find((s) => s.key === a.status) || AGREEMENT_STATUSES[0];
                return (
                  <Link key={a.id} to={`/agreements/${a.id}/print`} className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-100 hover:bg-slate-50 text-sm">
                    <span className="truncate">{a.title}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ml-2 ${meta.color}`}>{meta.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
        {approvals.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mb-2"><FileCheck2 className="w-3.5 h-3.5" /> Digital Approvals</div>
            <div className="space-y-1.5">
              {approvals.map((a) => {
                const meta = APPROVAL_STATUS_META[a.status] || APPROVAL_STATUS_META.pending;
                return (
                  <Link key={a.id} to="/digital-approvals" className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-100 hover:bg-slate-50 text-sm">
                    <span className="truncate">{a.subject}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ml-2 ${meta.cls}`}>{meta.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
