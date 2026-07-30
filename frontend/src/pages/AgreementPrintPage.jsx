import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Send, Upload, CheckCircle2, Copy } from "lucide-react";
import { toast } from "sonner";
import { fetchAgreementById, renderClauseBody, sendForDigitalSignature, markSignedPhysical } from "@/services/agreementService";
import { fetchTemplateById } from "@/services/agreementTemplateService";
import { uploadFile } from "@/services/attachmentService";
import { formatDateTime } from "@/utils/format";

export default function AgreementPrintPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [agreement, setAgreement] = useState(null);
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const fileRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const ag = await fetchAgreementById(id);
      if (!ag) { toast.error("Agreement not found"); return; }
      setAgreement(ag);
      if (ag.template_id) setTemplate(await fetchTemplateById(ag.template_id));
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [id]);

  const handleSendDigital = async () => {
    try {
      const md = agreement.merge_data || {};
      const opts = { paymentSchedule: agreement.payment_schedule, categorySpecs: template?.category_specs };
      const resolvedClauses = (template?.clauses || [])
        .filter((c) => !c.is_optional || (agreement.enabled_clause_ids || []).includes(c.id))
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        .map((c) => ({ title: c.title, body: renderClauseBody(c.body, md, opts) }));
      const updated = await sendForDigitalSignature(agreement.id, { snapshot: resolvedClauses });
      const link = `${window.location.origin}/sign/${updated.token}`;
      await navigator.clipboard?.writeText(link).catch(() => {});
      toast.success("Signing link copied to clipboard", { description: link });
      load();
    } catch (e) { toast.error(e.message); }
  };

  const handleUploadSigned = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const res = await uploadFile(f, "agreements/signed");
      await markSignedPhysical(agreement.id, res.url);
      toast.success("Signed copy uploaded — marked as physically signed");
      load();
    } catch (err) { toast.error(err.message); }
  };

  if (loading) return <div className="p-16 text-center text-slate-400">Loading…</div>;
  if (!agreement) return <div className="p-16 text-center text-slate-400">Agreement not found.</div>;

  const clauses = (template?.clauses || [])
    .filter((c) => !c.is_optional || (agreement.enabled_clause_ids || []).includes(c.id))
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const md = agreement.merge_data || {};
  const opts = { paymentSchedule: agreement.payment_schedule, categorySpecs: template?.category_specs };

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 print:p-0 print:bg-white">
      <div className="max-w-[210mm] mx-auto flex flex-wrap items-center justify-between gap-2 mb-3 no-print">
        <Button variant="outline" className="rounded-lg" onClick={() => nav("/agreements")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <div className="flex items-center gap-2 flex-wrap">
          {agreement.status === "draft" && (
            <Button variant="outline" className="rounded-lg" onClick={handleSendDigital} data-testid="agreement-send-digital-button">
              <Send className="w-4 h-4 mr-1" /> Send for Digital Signature
            </Button>
          )}
          {agreement.status !== "signed_digital" && (
            <>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleUploadSigned} />
              <Button variant="outline" className="rounded-lg" onClick={() => fileRef.current?.click()} data-testid="agreement-upload-signed-button">
                <Upload className="w-4 h-4 mr-1" /> Upload Signed Copy
              </Button>
            </>
          )}
          {agreement.status === "sent" && agreement.token && (
            <Button variant="outline" className="rounded-lg" onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/sign/${agreement.token}`); toast.success("Link copied"); }}>
              <Copy className="w-4 h-4 mr-1" /> Copy Signing Link
            </Button>
          )}
          <Button className="rounded-lg bg-blue-700 hover:bg-blue-800 text-white" onClick={() => window.print()} data-testid="agreement-print-button">
            <Printer className="w-4 h-4 mr-1" /> Print / Save as PDF
          </Button>
        </div>
      </div>

      <div className="agreement-a4 mx-auto bg-white print-page shadow-xl print:shadow-none relative" data-testid="agreement-print-document">
        <div className="relative z-10 px-16 text-[12.5px] leading-relaxed text-slate-900" style={{ paddingTop: "42mm", paddingBottom: "36mm" }}>
          <h1 className="text-center font-display font-extrabold text-xl tracking-tight mb-1">{agreement.title}</h1>
          <p className="text-center text-[10px] text-slate-500 mb-6">Agreement Ref: {agreement.id.slice(0, 8).toUpperCase()} · Generated {formatDateTime(agreement.created_at)}</p>

          <p className="mb-3">
            This {agreement.title} ("Agreement") is made and executed between <b>SANKALP INTERIOR SOLUTION</b>, having its registered office at GB, Oishi Tower-II, Rabindra Pally, Jyangra, Baguiati, VIP Road, Kolkata – 700059 (hereinafter the "Contractor"), AND
          </p>
          <p className="mb-6">
            Mr./Ms. <b>{md.client_name || "___________"}</b>{md.client_guardian ? `, ${md.client_guardian},` : ""} residing at {md.client_address || "___________"}, Mobile No. {md.client_mobile || "___________"} (hereinafter the "Client").
          </p>

          {clauses.map((c) => (
            <div key={c.id} className="mb-4">
              <h3 className="font-bold text-[13px] mb-1">{c.title}</h3>
              <p className="whitespace-pre-line">{renderClauseBody(c.body, md, opts)}</p>
            </div>
          ))}

          {/* Signature block */}
          <div className="grid grid-cols-2 gap-8 mt-10 pt-6 border-t border-slate-300">
            <div>
              <div className="font-bold text-[11px] uppercase tracking-widest mb-3">Client Acceptance</div>
              <div className="text-sm">Client Name: {md.client_name}</div>
              {agreement.status === "signed_digital" ? (
                <div className="mt-3 border border-emerald-300 bg-emerald-50 rounded p-3">
                  <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-semibold"><CheckCircle2 className="w-3.5 h-3.5" /> Digitally Signed</div>
                  <div className="text-xs text-slate-600 mt-1">By: {agreement.signer_name}</div>
                  <div className="text-xs text-slate-600">At: {formatDateTime(agreement.signed_at)}</div>
                  {agreement.signature_url && <img src={agreement.signature_url} alt="signature evidence" className="mt-2 h-20 rounded border border-slate-200 object-cover" />}
                </div>
              ) : agreement.status === "signed_physical" ? (
                <div className="mt-3 border border-blue-300 bg-blue-50 rounded p-3">
                  <div className="text-blue-700 text-xs font-semibold">Signed physically — scanned copy on file</div>
                  {agreement.signed_file_url && <a href={agreement.signed_file_url} target="_blank" rel="noreferrer" className="text-xs text-blue-700 underline">View scanned copy</a>}
                </div>
              ) : (
                <>
                  <div className="mt-8 border-b border-slate-500 w-56" />
                  <div className="text-[10px] text-slate-500 mt-1">Signature</div>
                  <div className="mt-4 border-b border-slate-500 w-40" />
                  <div className="text-[10px] text-slate-500 mt-1">Date / Place</div>
                </>
              )}
            </div>
            <div>
              <div className="font-bold text-[11px] uppercase tracking-widest mb-3">For Sankalp Interior Solution</div>
              <div className="text-sm">Authorized Signatory: Subhendu Biswas</div>
              <div className="text-sm">Designation: Director</div>
              <div className="mt-8 border-b border-slate-500 w-56" />
              <div className="text-[10px] text-slate-500 mt-1">Signature &amp; Company Seal</div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .agreement-a4 {
          width: 210mm;
          min-height: 297mm;
          max-width: 210mm;
          background-image: url('/sankalp-letterhead.jpg');
          background-repeat: repeat-y;
          background-size: 210mm 297mm;
          background-position: top center;
        }
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body { width: 210mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .agreement-a4 { width: 210mm; }
        }
      `}</style>
    </div>
  );
}
