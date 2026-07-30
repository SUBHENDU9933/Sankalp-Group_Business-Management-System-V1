import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Send, Upload, CheckCircle2, Copy, Globe, Phone, Mail } from "lucide-react";
import { toast } from "sonner";
import { fetchAgreementById, renderClauseBody, sendForDigitalSignature, markSignedPhysical } from "@/services/agreementService";
import { fetchTemplateById } from "@/services/agreementTemplateService";
import { uploadFile } from "@/services/attachmentService";
import { formatDateTime, formatINR } from "@/utils/format";
import { SANKALP_LOGO } from "@/lib/brand";

// Auto-calculated payment breakup table — stage / % / amount, from the
// agreement's own payment_schedule + contract value.
function PaymentScheduleTable({ schedule, contractValue }) {
  if (!schedule?.length) return null;
  const cv = Number(contractValue) || 0;
  const totalPct = schedule.reduce((s, r) => s + (Number(r.percent) || 0), 0);
  return (
    <table className="agreement-table w-full mt-2 mb-1" data-testid="agreement-payment-table">
      <thead>
        <tr>
          <th style={{ width: "8%" }}>Stage</th>
          <th>Payment Stage</th>
          <th style={{ width: "15%" }}>%</th>
          <th style={{ width: "25%" }}>Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        {schedule.map((row, i) => (
          <tr key={i}>
            <td className="text-center">{i + 1}</td>
            <td>{row.stage}</td>
            <td className="text-center">{row.percent}%</td>
            <td className="text-right">{formatINR(Math.round((cv * (Number(row.percent) || 0)) / 100))}</td>
          </tr>
        ))}
        <tr className="font-bold">
          <td colSpan={2} className="text-right">Total</td>
          <td className="text-center">{totalPct}%</td>
          <td className="text-right">{formatINR(cv)}</td>
        </tr>
      </tbody>
    </table>
  );
}

// Simple, reliable header/footer bands rendered in NORMAL document flow —
// duplicated once per manually-chunked page block below, so they always
// appear on every page regardless of how the browser paginates print output.
function HeaderBand() {
  return (
    <div className="doc-header-wrap">
      <div className="doc-header">
        <img src={SANKALP_LOGO} alt="Sankalp Interior Solution" />
        <div>
          <div className="doc-header-name">Sankalp Interior Solution</div>
          <div className="doc-header-tagline">"Innovation for a Better Tomorrow"</div>
        </div>
      </div>
      <div className="doc-header-stripe">
        <div className="doc-header-stripe-blue" />
        <div className="doc-header-stripe-orange" />
      </div>
    </div>
  );
}
function FooterBand() {
  return (
    <div className="doc-footer-wrap">
      <div className="doc-footer-stripe-orange" />
      <div className="doc-footer">
        <div className="doc-footer-row">
          <span><i className="doc-icon-circle"><Globe size={11} /></i> www.sankalps.com</span>
          <span><i className="doc-icon-circle"><Phone size={11} /></i> +91 3368260520</span>
          <span><i className="doc-icon-circle doc-icon-circle-plain" /> +91 9748297025</span>
          <span><i className="doc-icon-circle"><Mail size={11} /></i> info.sankalpgrp@gmail.com</span>
        </div>
        <div className="doc-footer-address">
          Office: GB, Oishi Tower-II, Rabindra Pally, Jyangra, P.S - Baguiati, Jyangra to VIP Road, Raghunathpur, Kolkata, West Bengal - 700059
        </div>
      </div>
    </div>
  );
}

// Splits title/intro + clauses + signature block into page-sized chunks so
// every physical page gets its own header/footer band, deterministically —
// no reliance on browser print engines correctly repeating fixed elements.
const FIRST_PAGE_CLAUSES = 2;
const CLAUSES_PER_PAGE = 3;

function chunkIntoPages(clauses) {
  const pages = [];
  let i = 0;
  pages.push(clauses.slice(0, FIRST_PAGE_CLAUSES));
  i = FIRST_PAGE_CLAUSES;
  while (i < clauses.length) {
    pages.push(clauses.slice(i, i + CLAUSES_PER_PAGE));
    i += CLAUSES_PER_PAGE;
  }
  if (pages.length === 0) pages.push([]);
  return pages;
}

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
  const pages = chunkIntoPages(clauses);

  const renderClause = (c) => (
    <div key={c.id} className="mb-4 avoid-break">
      <h3 className="font-bold text-[12px] mb-1">{c.title}</h3>
      <p className="whitespace-pre-line">{renderClauseBody(c.body, md)}</p>
      {c.id === "payment_terms" && (
        <PaymentScheduleTable schedule={agreement.payment_schedule} contractValue={md.contract_value} />
      )}
    </div>
  );

  const signatureBlock = (
    <div className="grid grid-cols-2 gap-8 mt-10 pt-6 border-t border-slate-300 avoid-break">
      <div>
        <div className="font-bold text-[10px] uppercase tracking-widest mb-3">Client Acceptance</div>
        <div>Client Name: {md.client_name}</div>
        {agreement.status === "signed_digital" ? (
          <div className="mt-3 border border-emerald-300 bg-emerald-50 rounded p-3">
            <div className="flex items-center gap-1.5 text-emerald-700 text-[10px] font-semibold"><CheckCircle2 className="w-3.5 h-3.5" /> Digitally Signed</div>
            <div className="text-[10px] text-slate-600 mt-1">By: {agreement.signer_name}</div>
            <div className="text-[10px] text-slate-600">At: {formatDateTime(agreement.signed_at)}</div>
            {agreement.signature_url && <img src={agreement.signature_url} alt="signature evidence" className="mt-2 h-20 rounded border border-slate-200 object-cover" />}
          </div>
        ) : agreement.status === "signed_physical" ? (
          <div className="mt-3 border border-blue-300 bg-blue-50 rounded p-3">
            <div className="text-blue-700 text-[10px] font-semibold">Signed physically — scanned copy on file</div>
            {agreement.signed_file_url && <a href={agreement.signed_file_url} target="_blank" rel="noreferrer" className="text-[10px] text-blue-700 underline">View scanned copy</a>}
          </div>
        ) : (
          <>
            <div className="mt-8 border-b border-slate-500 w-56" />
            <div className="text-[9px] text-slate-500 mt-1">Signature</div>
            <div className="mt-4 border-b border-slate-500 w-40" />
            <div className="text-[9px] text-slate-500 mt-1">Date / Place</div>
          </>
        )}
      </div>
      <div>
        <div className="font-bold text-[10px] uppercase tracking-widest mb-3">For Sankalp Interior Solution</div>
        <div>Authorized Signatory: Subhendu Biswas</div>
        <div>Designation: Director</div>
        <div className="mt-8 border-b border-slate-500 w-56" />
        <div className="text-[9px] text-slate-500 mt-1">Signature &amp; Company Seal</div>
      </div>
    </div>
  );

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

      <div className="agreement-doc" data-testid="agreement-print-document">
        {pages.map((chunk, pageIdx) => (
          <div key={pageIdx} className="doc-page">
            <HeaderBand />
            <div className="doc-page-content">
              {pageIdx === 0 && (
                <>
                  <h1 className="text-center font-bold text-[16px] tracking-tight mb-1">{agreement.title}</h1>
                  <p className="text-center text-[9px] text-slate-500 mb-6">Agreement Ref: {agreement.id.slice(0, 8).toUpperCase()} · Generated {formatDateTime(agreement.created_at)}</p>
                  <p className="mb-3">
                    This {agreement.title} ("Agreement") is made and executed between <b>SANKALP INTERIOR SOLUTION</b>, having its registered office at GB, Oishi Tower-II, Rabindra Pally, Jyangra, Baguiati, VIP Road, Kolkata – 700059 (hereinafter the "Contractor"), AND
                  </p>
                  <p className="mb-6">
                    Mr./Ms. <b>{md.client_name || "___________"}</b>{md.client_guardian ? `, ${md.client_guardian},` : ""} residing at {md.client_address || "___________"}, Mobile No. {md.client_mobile || "___________"} (hereinafter the "Client").
                  </p>
                </>
              )}
              {chunk.map(renderClause)}
              {pageIdx === pages.length - 1 && signatureBlock}
            </div>
            <FooterBand />
          </div>
        ))}
      </div>

      <style>{`
        @font-face {
          font-family: 'Bookman Old Style';
          src: url('/fonts/bookmanoldstyle.ttf') format('truetype');
          font-weight: 400;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: 'Bookman Old Style';
          src: url('/fonts/bookmanoldstyle_bold.ttf') format('truetype');
          font-weight: 700;
          font-style: normal;
          font-display: swap;
        }
        .agreement-doc {
          font-family: 'Bookman Old Style', 'Georgia', serif;
          font-size: 11pt;
          line-height: 1.5;
          color: #1a1a1a;
        }
        .agreement-doc h1, .agreement-doc h3 { font-family: 'Bookman Old Style', 'Georgia', serif; font-weight: 700; }
        .doc-page {
          width: 210mm;
          min-height: 297mm;
          max-width: 210mm;
          margin: 0 auto 16px;
          background: #fff;
          box-shadow: 0 4px 24px rgba(0,0,0,0.12);
          display: flex;
          flex-direction: column;
        }
        .doc-header-wrap { }
        .doc-header {
          display: flex; align-items: center; gap: 18px;
          padding: 22px 1in 16px;
        }
        .doc-header img { height: 72px; width: auto; }
        .doc-header-name { font-family: 'Bookman Old Style', Georgia, serif; font-weight: 700; font-size: 26pt; color: #1E3FAD; letter-spacing: 0.01em; }
        .doc-header-tagline { font-size: 11pt; font-style: italic; color: #1E3FAD; margin-top: 2px; text-align: right; }
        .doc-header-stripe { display: flex; flex-direction: column; }
        .doc-header-stripe-blue { height: 8px; background: #1E3FAD; width: 100%; }
        .doc-header-stripe-orange { height: 4px; background: #F97316; width: 100%; }
        .doc-footer-wrap { margin-top: auto; }
        .doc-footer-stripe-orange { height: 4px; background: #F97316; width: 100%; }
        .doc-footer {
          background: #1E3FAD;
          color: #fff;
          padding: 12px 1in 14px;
          font-size: 8.5pt;
        }
        .doc-footer-row { display: flex; justify-content: center; gap: 22px; align-items: center; flex-wrap: wrap; }
        .doc-footer-row span { display: inline-flex; align-items: center; gap: 6px; }
        .doc-icon-circle {
          display: inline-flex; align-items: center; justify-content: center;
          width: 18px; height: 18px; border-radius: 50%;
          background: #F97316; color: #fff; flex-shrink: 0;
        }
        .doc-icon-circle-plain { width: 14px; height: 14px; margin: 2px; }
        .doc-footer-address { margin-top: 6px; color: #dbeafe; text-align: center; font-size: 7.5pt; }
        .doc-page-content { padding: 20px 1in; flex: 1; }
        .agreement-table { border-collapse: collapse; font-size: 10.5pt; }
        .agreement-table th, .agreement-table td { border: 1px solid #94a3b8; padding: 4px 8px; }
        .agreement-table th { background: #f1f5f9; font-weight: 700; text-align: left; }
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .doc-page {
            width: auto; min-height: 100vh; margin: 0; box-shadow: none;
            page-break-after: always;
          }
          .doc-page:last-child { page-break-after: auto; }
          .doc-page-content { padding: 16px 1in; }
          .avoid-break { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
