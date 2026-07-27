import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchReceiptById, fetchReceiptAttachments } from "@/services/receiptService";
import { Button } from "@/components/ui/button";
import { formatINR, formatDate } from "@/utils/format";
import { Printer, ArrowLeft, ShieldCheck, User as UserIcon, Clock, CalendarDays, Phone, Globe, MapPin } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Logo, SANKALP_TAGLINE_BN, SANKALP_CONTACT } from "@/lib/brand";

const numToWords = (num) => {
  if (num == null || isNaN(num)) return "";
  const a = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const b = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  const w = (n) => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n/10)] + (n%10 ? " " + a[n%10] : "");
    if (n < 1000) return a[Math.floor(n/100)] + " Hundred" + (n%100 ? " " + w(n%100) : "");
    if (n < 100000) return w(Math.floor(n/1000)) + " Thousand" + (n%1000 ? " " + w(n%1000) : "");
    if (n < 10000000) return w(Math.floor(n/100000)) + " Lakh" + (n%100000 ? " " + w(n%100000) : "");
    return w(Math.floor(n/10000000)) + " Crore" + (n%10000000 ? " " + w(n%10000000) : "");
  };
  const i = Math.floor(num); const p = Math.round((num - i) * 100);
  let s = w(i) + " Rupees";
  if (p) s += " and " + w(p) + " Paise";
  return s + " Only";
};

const Box = ({ label, checked }) => (
  <span className="inline-flex items-center gap-1 mr-2">
    <span className={`inline-block w-3 h-3 border border-slate-700 ${checked ? "bg-slate-700" : ""} rounded-sm relative`}>
      {checked && <span className="absolute inset-0 grid place-items-center text-white text-[8px] leading-none font-bold">✓</span>}
    </span>
    <span className="text-[11px] font-semibold tracking-wide">{label}</span>
  </span>
);

export default function ReceiptPrintPage() {
  const { id } = useParams();
  const [receipt, setReceipt] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReceiptById(id).then((r) => {
      setReceipt(r);
      if (r?.id) fetchReceiptAttachments(r.id).then(setAttachments).catch(() => {});
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-12 text-center text-slate-500">Loading receipt…</div>;
  if (!receipt) return <div className="p-12 text-center text-slate-500">Receipt not found.</div>;

  const verifyUrl = `${window.location.origin}/verify/${receipt.receipt_uid || receipt.id}`;
  const receiptId = `${(receipt.si_no || "").split("/")[0] || "2026CR"}-${(receipt.receipt_no || "").replace(/^SG-/, "")}-${receipt.receipt_uid || ""}`;
  const dt = new Date(receipt.created_at);
  const dd = String(dt.getDate()).padStart(2,"0");
  const mm = String(dt.getMonth()+1).padStart(2,"0");
  const yy = dt.getFullYear();
  const time = dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 print:p-0 print:bg-white">
      {/* Toolbar */}
      <div className="max-w-[210mm] mx-auto flex items-center justify-between mb-3 no-print">
        <Button variant="outline" className="rounded-lg" onClick={() => window.close()} data-testid="receipt-back-button">
          <ArrowLeft className="w-4 h-4 mr-1" />Close
        </Button>
        <Link to={`/verify/${receipt.receipt_uid || receipt.id}`} className="text-sm text-blue-700 hover:underline no-print" target="_blank" rel="noreferrer">
          Verification Link →
        </Link>
        <Button className="rounded-lg bg-blue-700 hover:bg-blue-800 text-white" onClick={() => window.print()} data-testid="receipt-print-button">
          <Printer className="w-4 h-4 mr-1" />Print / Save as PDF
        </Button>
      </div>

      {/* A4 Receipt page */}
      <div className="receipt-a4 mx-auto bg-white print-page shadow-xl print:shadow-none border border-slate-200 print:border-none relative" data-testid="receipt-print-document">
        {/* Decorative corners */}
        <div className="absolute top-0 left-0 w-32 h-32 overflow-hidden pointer-events-none">
          <div className="absolute -top-14 -left-14 w-32 h-32 rotate-45 bg-orange-500" />
          <div className="absolute -top-7 -left-20 w-32 h-24 rotate-45 bg-blue-700" />
        </div>
        <div className="absolute top-0 right-0 w-32 h-32 overflow-hidden pointer-events-none">
          <div className="absolute -top-14 -right-14 w-32 h-32 -rotate-45 bg-orange-500" />
          <div className="absolute -top-7 -right-20 w-32 h-24 -rotate-45 bg-blue-700" />
        </div>
        <div className="absolute bottom-0 left-0 w-32 h-32 overflow-hidden pointer-events-none">
          <div className="absolute -bottom-14 -left-14 w-32 h-32 -rotate-45 bg-orange-500" />
          <div className="absolute -bottom-7 -left-20 w-32 h-24 -rotate-45 bg-blue-700" />
        </div>
        <div className="absolute bottom-0 right-0 w-32 h-32 overflow-hidden pointer-events-none">
          <div className="absolute -bottom-14 -right-14 w-32 h-32 rotate-45 bg-orange-500" />
          <div className="absolute -bottom-7 -right-20 w-32 h-24 rotate-45 bg-blue-700" />
        </div>

        <div className="relative z-10 px-7 py-6">
          {/* HEADER */}
          <div className="grid grid-cols-[110px_1fr] items-stretch border-2 border-blue-700">
            <div className="bg-white p-2 grid place-items-center border-r-2 border-blue-700">
              <Logo className="h-14 w-auto object-contain" />
            </div>
            <div className="bg-orange-500 text-white px-4 py-2 grid place-items-center text-center">
              <div>
                <div className="font-display font-extrabold text-[18px] leading-tight tracking-tight" style={{textShadow: "1px 1px 0 #1E3FAD"}}>SANKALP GROUP &amp;</div>
                <div className="font-display font-extrabold text-[18px] leading-tight tracking-tight" style={{textShadow: "1px 1px 0 #1E3FAD"}}>BUSINESS SOLUTIONS</div>
                <div className="font-bengali text-[12px] mt-0.5">"{SANKALP_TAGLINE_BN}"</div>
              </div>
            </div>
          </div>

          {/* DATE + SI NO */}
          <div className="flex justify-between items-end mt-3 px-1 text-slate-900 text-[12px]">
            <div>
              <span className="font-bold">Date: </span>
              <span className="inline-block w-4 border-b border-slate-700 text-center">{dd[0]}</span>
              <span className="inline-block w-4 border-b border-slate-700 text-center">{dd[1]}</span>
              <span className="mx-0.5">/</span>
              <span className="inline-block w-4 border-b border-slate-700 text-center">{mm[0]}</span>
              <span className="inline-block w-4 border-b border-slate-700 text-center">{mm[1]}</span>
              <span className="mx-0.5">/</span>
              <span className="font-bold">{yy}</span>
            </div>
            <div className="font-mono">
              <span className="font-bold font-display">SI No:</span> <span className="tracking-wider">{receipt.si_no || `${yy}CR/${mm}/00X/${(receipt.receipt_uid || "____").slice(0,4)}`}</span>
            </div>
          </div>

          {/* PAYMENT RECEIPT BANNER */}
          <div className="flex justify-center mt-3">
            <div className="bg-orange-500 text-white px-9 py-1.5 font-display font-extrabold text-[18px] tracking-wide rounded-md shadow-md" style={{textShadow: "1px 1px 0 #1E3FAD"}}>
              PAYMENT RECEIPT
            </div>
          </div>

          {/* MAIN BORDER BOX */}
          <div className="border-2 border-orange-400 rounded-md mt-2 px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-slate-900 text-[12px]">
            <div>
              <span className="font-bold">Customer Name: </span>
              <span className="font-semibold border-b border-slate-400 inline-block min-w-[180px] pb-0.5">{receipt.customer?.name || ""}</span>
            </div>
            <div>
              <span className="font-bold">Amount Received (₹): </span>
              <span className="font-bold text-blue-800 border-b border-slate-400 inline-block min-w-[140px] pb-0.5">{formatINR(receipt.amount).replace("₹","₹ ")}</span>
            </div>

            <div>
              <span className="font-bold">Address: </span>
              <span className="border-b border-slate-400 inline-block min-w-[200px] pb-0.5">{receipt.customer?.address || ""}</span>
            </div>
            <div>
              <span className="font-bold">Amount in Words: </span>
              <span className="border-b border-slate-400 inline-block min-w-[140px] pb-0.5">{numToWords(Number(receipt.amount))}</span>
            </div>

            <div className="col-span-2">
              <span className="font-bold">Project / Work / Job Details: </span>
              <span className="border-b border-slate-400 inline-block w-[80%] pb-0.5">{receipt.project?.project_name || receipt.customer?.project_details || ""}</span>
            </div>

            <div className="col-span-2 flex items-center gap-2 flex-wrap">
              <span className="font-bold mr-1">Payment Method:</span>
              <Box label="CASH" checked={receipt.payment_mode === "cash"} />
              <Box label="UPI" checked={receipt.payment_mode === "upi"} />
              <Box label="TRANSFER" checked={receipt.payment_mode === "bank"} />
              <span className="mx-2" />
              <span className="font-bold mr-1">Payment Purpose:</span>
              <Box label="ADVANCE" checked={receipt.payment_purpose === "advance"} />
              <Box label="TOKEN" checked={receipt.payment_purpose === "token"} />
              <Box label="PART" checked={receipt.payment_purpose === "part"} />
              <Box label="OTHERS" checked={receipt.payment_purpose === "others"} />
            </div>

            <div>
              <span className="font-bold">Transaction Ref No.: </span>
              <span className="border-b border-slate-400 inline-block min-w-[160px] pb-0.5">{receipt.transaction_ref || ""}</span>
            </div>
            <div>
              <span className="font-bold">Notes: </span>
              <span className="border-b border-slate-400 inline-block min-w-[160px] pb-0.5">{receipt.note || ""}</span>
            </div>
          </div>

          {/* RECEIVED BY + QR */}
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="border border-blue-300 rounded-md p-3 bg-blue-50/30">
              <div className="text-center font-display font-bold text-blue-800 tracking-wider text-[11px]">RECEIVED / GENERATED BY</div>
              <div className="mt-2 space-y-1.5 text-[11px]">
                <div className="flex items-center gap-2">
                  <UserIcon className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                  <span className="font-semibold w-10">Name</span><span>:</span>
                  <span className="border-b border-slate-400 flex-1 pb-0.5">{receipt.creator?.full_name || receipt.creator?.email || ""}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                  <span className="font-semibold w-10">Time</span><span>:</span>
                  <span className="border-b border-slate-400 flex-1 pb-0.5">{time}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                  <span className="font-semibold w-10">Date</span><span>:</span>
                  <span className="border-b border-slate-400 flex-1 pb-0.5">{formatDate(receipt.created_at)}</span>
                </div>
              </div>
              <div className="mt-3 border-t border-blue-200 pt-2 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-display font-bold text-blue-800 text-[10px] tracking-wider">SECURE &amp; VERIFIED</div>
                  <div className="text-[9.5px] text-slate-700 leading-snug">This receipt contains encrypted data verifiable via the QR. Any tampering will invalidate the receipt.</div>
                </div>
              </div>
            </div>

            <div className="border border-blue-300 rounded-md p-3 bg-blue-50/30">
              <div className="text-center font-display font-bold text-blue-800 tracking-wider text-[11px]">AUTHENTICATE THIS RECEIPT</div>
              <div className="text-center text-[10px] text-slate-600 mt-0.5 leading-snug">Scan QR code to verify the authenticity<br />of this receipt and view full details.</div>
              <div className="flex justify-center mt-1.5">
                <div className="bg-white p-1.5 border border-slate-200">
                  <QRCodeSVG value={verifyUrl} size={90} level="H" includeMargin={false} />
                </div>
              </div>
              <div className="text-center text-[11px] mt-1.5">
                <span className="font-semibold">Receipt ID:</span> <span className="font-bold text-orange-600 tracking-wider text-[11px]">{receiptId}</span>
              </div>
              <div className="text-center text-[9.5px] text-slate-600 mt-0.5">Keep this receipt safe for future reference.</div>
            </div>
          </div>

          {/* TERMS */}
          <div className="mt-3 border border-dashed border-orange-300 rounded-md px-3 py-2 text-[10px] text-slate-700 leading-snug">
            <ul className="list-disc pl-4 space-y-0.5">
              <li>The amount received shall be adjusted against the final project billing.</li>
              <li>Advance / Token / Part amount is strictly non-refundable and shall be adjusted against completed work, materials procured, or custom-made items.</li>
              <li>Final billing shall be done based on actual site measurement and executed scope of work.</li>
              <li>This receipt is for record purposes only — GST is not included. If the Client requests a GST Invoice, applicable GST shall be applied extra.</li>
            </ul>
          </div>

          {/* FOOTER */}
          <div className="mt-3 bg-slate-700 text-white px-4 py-2 grid grid-cols-2 gap-3 rounded">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-orange-500 grid place-items-center shrink-0"><Phone className="w-3.5 h-3.5 text-white" /></div>
              <div>
                <div className="text-[8px] tracking-widest uppercase text-slate-300">Call / Whatsapp</div>
                <div className="font-bold text-[12px]">{SANKALP_CONTACT.phone}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-blue-500 grid place-items-center shrink-0"><Globe className="w-3.5 h-3.5 text-white" /></div>
              <div>
                <div className="text-[8px] tracking-widest uppercase text-slate-300">Visit Our Website</div>
                <div className="font-bold text-[12px]">{SANKALP_CONTACT.website}</div>
              </div>
            </div>
          </div>
          <div className="mt-1.5 text-center text-[9.5px] text-slate-700 inline-flex items-start gap-1 w-full justify-center px-4">
            <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
            <span><span className="font-bold">Office:</span> {SANKALP_CONTACT.address}</span>
          </div>
        </div>
      </div>

      {/* PAGE 2 — Attachments (only if any) */}
      {attachments && attachments.length > 0 && (
        <div className="receipt-a4 mx-auto bg-white print-page shadow-xl print:shadow-none border border-slate-200 print:border-none mt-4 print:mt-0 attach-page" data-testid="receipt-attachments-page">
          <div className="p-8 h-full flex flex-col">
            <div className="border-b-2 border-blue-700 pb-3 mb-5">
              <div className="text-[10px] tracking-[0.25em] uppercase font-bold text-slate-500">Payment Proof / Attachments</div>
              <div className="font-display text-2xl font-bold text-blue-900">Receipt {receipt.receipt_no}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{attachments.length} file(s) attached · Generated {new Date().toLocaleString('en-IN')}</div>
            </div>
            <div className="flex-1 grid gap-4">
              {attachments.map((a) => {
                const isImg = (a.file_type || "").startsWith("image/") || /\.(png|jpe?g|gif|webp|heic)$/i.test(a.file_name || "");
                const isPdf = (a.file_type || "").includes("pdf") || /\.pdf$/i.test(a.file_name || "");
                return (
                  <div key={a.id} className="border border-slate-300 bg-slate-50 p-3 avoid-break">
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-widest font-semibold text-slate-600 mb-2">
                      <span>{a.file_name || "attachment"}</span>
                      <span>{a.file_type || ""}{a.size_bytes ? ` · ${Math.round(a.size_bytes/1024)} KB` : ""}</span>
                    </div>
                    {isImg ? (
                      <img src={a.file_url} alt={a.file_name || "attachment"} className="w-full max-h-[220mm] object-contain bg-white" />
                    ) : isPdf ? (
                      <div className="bg-white border border-slate-200 p-3 text-xs text-slate-700">
                        <div className="mb-2 font-semibold">PDF document — preview not embedded in printed page.</div>
                        <div>Verification URL: <a href={a.file_url} className="text-blue-700 underline break-all">{a.file_url}</a></div>
                      </div>
                    ) : (
                      <div className="bg-white border border-slate-200 p-3 text-xs">
                        <a href={a.file_url} className="text-blue-700 underline break-all">{a.file_url}</a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-6 pt-3 border-t border-slate-300 text-center text-[9px] text-slate-500 tracking-widest uppercase">
              Sankalp Group · Business Solutions · Verify at {verifyUrl}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .receipt-a4 {
          width: 210mm;
          min-height: 297mm;
          max-width: 210mm;
        }
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body { width: 210mm; }
          .receipt-a4 {
            width: 210mm;
            min-height: 297mm;
            page-break-inside: avoid;
          }
          .receipt-a4:not(.attach-page) {
            max-height: 297mm;
            overflow: hidden;
          }
          .attach-page { page-break-before: always; }
          .avoid-break  { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
