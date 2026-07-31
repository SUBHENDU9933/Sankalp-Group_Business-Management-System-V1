import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send, Upload, Copy, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { fetchAgreementById, renderClauseBody, sendForDigitalSignature, markSignedPhysical } from "@/services/agreementService";
import { fetchTemplateById } from "@/services/agreementTemplateService";
import { uploadFile } from "@/services/attachmentService";
import { AgreementDocumentPages } from "@/components/shared/AgreementDocument";
import { downloadAgreementPdf } from "@/utils/pdfExport";

export default function AgreementPrintPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [agreement, setAgreement] = useState(null);
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const fileRef = useRef(null);
  const docRef = useRef(null);

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

  const buildResolvedClauses = () => {
    const md = agreement.merge_data || {};
    const opts = { paymentSchedule: agreement.payment_schedule, categorySpecs: template?.category_specs };
    return (template?.clauses || [])
      .filter((c) => !c.is_optional || (agreement.enabled_clause_ids || []).includes(c.id))
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .map((c) => ({ id: c.id, title: c.title, body: renderClauseBody(c.body, md, opts) }));
  };

  const handleSendDigital = async () => {
    try {
      const resolvedClauses = buildResolvedClauses();
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

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const filename = `${(agreement.title || "Agreement").replace(/[^\w\- ]/g, "")}-${agreement.id.slice(0, 8).toUpperCase()}.pdf`;
      await downloadAgreementPdf(docRef.current, filename);
    } catch (e) { toast.error("Couldn't generate PDF: " + e.message); }
    finally { setDownloading(false); }
  };

  if (loading) return <div className="p-16 text-center text-slate-400">Loading…</div>;
  if (!agreement) return <div className="p-16 text-center text-slate-400">Agreement not found.</div>;

  const md = agreement.merge_data || {};
  const resolvedClauses = buildResolvedClauses();

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 print:p-0 print:bg-white">
      <div className="max-w-[210mm] mx-auto flex flex-wrap items-center justify-between gap-2 mb-3 no-print">
        <Button variant="outline" className="rounded-lg" onClick={() => nav("/agreements")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <div className="flex items-center gap-2 flex-wrap">
          {agreement.status === "draft" && (
            <>
              <Button variant="outline" className="rounded-lg" onClick={handleDownloadPdf} disabled={downloading} data-testid="agreement-download-physical-button">
                {downloading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
                Download for Physical Signature
              </Button>
              <Button className="rounded-lg bg-blue-700 hover:bg-blue-800 text-white" onClick={handleSendDigital} data-testid="agreement-send-digital-button">
                <Send className="w-4 h-4 mr-1" /> Sign Digitally — Create Customer Link
              </Button>
            </>
          )}

          {agreement.status === "sent" && (
            <>
              {agreement.token && (
                <Button variant="outline" className="rounded-lg" onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/sign/${agreement.token}`); toast.success("Link copied"); }} data-testid="agreement-copy-link-button">
                  <Copy className="w-4 h-4 mr-1" /> Copy Signing Link
                </Button>
              )}
              <Button variant="outline" className="rounded-lg" onClick={handleDownloadPdf} disabled={downloading} data-testid="agreement-download-physical-button">
                {downloading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
                Download for Physical Signature
              </Button>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleUploadSigned} />
              <Button variant="outline" className="rounded-lg" onClick={() => fileRef.current?.click()} data-testid="agreement-upload-signed-button">
                <Upload className="w-4 h-4 mr-1" /> Client Signed on Paper — Upload Scan
              </Button>
            </>
          )}

          {agreement.status === "signed_digital" && (
            <Button className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleDownloadPdf} disabled={downloading} data-testid="agreement-download-signed-button">
              {downloading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
              {downloading ? "Generating…" : "Download Digitally Signed Agreement"}
            </Button>
          )}

          {agreement.status === "signed_physical" && (
            <>
              {agreement.signed_file_url && (
                <a href={agreement.signed_file_url} target="_blank" rel="noreferrer" data-testid="agreement-download-physical-signed-link">
                  <Button className="rounded-lg bg-blue-700 hover:bg-blue-800 text-white">
                    <Download className="w-4 h-4 mr-1" /> Download Physically Signed Copy
                  </Button>
                </a>
              )}
              <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleUploadSigned} />
              <Button variant="outline" className="rounded-lg" onClick={() => fileRef.current?.click()} data-testid="agreement-upload-signed-button">
                <Upload className="w-4 h-4 mr-1" /> Replace Scanned Copy
              </Button>
            </>
          )}
        </div>
      </div>

      <div ref={docRef}>
        <AgreementDocumentPages agreement={agreement} resolvedClauses={resolvedClauses} md={md} />
      </div>
    </div>
  );
}
