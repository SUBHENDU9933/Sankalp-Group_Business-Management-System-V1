import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchReceiptById } from "@/services/receiptService";
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

const Box = ({ children, label, value, checked }) => (
  <span className="inline-flex items-center gap-1.5 mr-3">
    <span className={`inline-block w-4 h-4 border-2 border-slate-700 ${checked ? "bg-slate-700" : ""} rounded-sm`}>
      {checked && <span className="block text-white text-[10px] leading-3 text-center">✓</span>}
    </span>
    <span className="text-sm font-semibold tracking-wide">{label}</span>
  </span>
);

export default function ReceiptPrintPage() {
  const { id } = useParams();
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchReceiptById(id).then(setReceipt).finally(() => setLoading(false)); }, [id]);

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
    <div className="min-h-screen bg-slate-100 py-8 px-4 print:p-0 print:bg-white">
      {/* Toolbar */}
      <div className="max-w-[850px] mx-auto flex items-center justify-between mb-4 no-print">
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

      {/* Receipt page */}
      <div className="max-w-[850px] mx-auto bg-white print-page shadow-xl print:shadow-none border border-slate-200 print:border-none relative" data-testid="receipt-print-document">
        {/* Decorative corner */}
        <div className="absolute top-0 left-0 w-44 h-44 overflow-hidden">
          <div className="absolute -top-20 -left-20 w-44 h-44 rotate-45 bg-orange-500" />
          <div className="absolute -top-10 -left-28 w-44 h-32 rotate-45 bg-blue-700" />
        </div>
        <div className="absolute top-0 right-0 w-44 h-44 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-44 h-44 -rotate-45 bg-orange-500" />
          <div className="absolute -top-10 -right-28 w-44 h-32 -rotate-45 bg-blue-700" />
        </div>
        {/* Bottom corners */}
        <div className="absolute bottom-0 left-0 w-44 h-44 overflow-hidden">
          <div className="absolute -bottom-20 -left-20 w-44 h-44 -rotate-45 bg-orange-500" />
          <div className="absolute -bottom-10 -left-28 w-44 h-32 -rotate-45 bg-blue-700" />
        </div>
        <div className="absolute bottom-0 right-0 w-44 h-44 overflow-hidden">
          <div className="absolute -bottom-20 -right-20 w-44 h-44 rotate-45 bg-orange-500" />
          <div className="absolute -bottom-10 -right-28 w-44 h-32 rotate-45 bg-blue-700" />
        </div>

        <div className="relative z-10 p-10 pb-16">
          {/* HEADER */}
          <div className="grid grid-cols-[auto_1fr] items-stretch border-2 border-blue-700">
            <div className="bg-white p-4 grid place-items-center border-r-2 border-blue-700">
              <Logo className="h-24 w-auto object-contain" />
            </div>
            <div className="bg-orange-500 text-white px-6 py-3 grid place-items-center text-center">
              <div>
                <div className="font-display font-extrabold text-2xl leading-tight tracking-tight" style={{textShadow: "1px 1px 0 #1E3FAD"}}>SANKALP GROUP &amp;</div>
                <div className="font-display font-extrabold text-2xl leading-tight tracking-tight" style={{textShadow: "1px 1px 0 #1E3FAD"}}>BUSINESS SOLUTIONS</div>
                <div className="font-bengali text-base mt-1">"{SANKALP_TAGLINE_BN}"</div>
              </div>
            </div>
          </div>

          {/* DATE + SI NO */}
          <div className="flex justify-between items-end mt-6 px-2 text-slate-900">
            <div className="text-base">
              <span className="font-bold">Date: </span>
              <span className="inline-block w-6 border-b-2 border-slate-700 text-center">{dd[0]}</span>
              <span className="inline-block w-6 border-b-2 border-slate-700 text-center">{dd[1]}</span>
              <span className="mx-1">/</span>
              <span className="inline-block w-6 border-b-2 border-slate-700 text-center">{mm[0]}</span>
              <span className="inline-block w-6 border-b-2 border-slate-700 text-center">{mm[1]}</span>
              <span className="mx-1">/</span>
              <span className="font-bold">{yy}</span>
            </div>
            <div className="text-base font-mono">
              <span className="font-bold font-display">SI No:</span> <span className="tracking-wider">{receipt.si_no || `${yy}CR/${mm}/00X/${(receipt.receipt_uid || "____").slice(0,4)}`}</span>
            </div>
          </div>

          {/* PAYMENT RECEIPT BANNER */}
          <div className="flex justify-center mt-6">
            <div className="bg-orange-500 text-white px-12 py-3 font-display font-extrabold text-2xl tracking-wide rounded-md shadow-md" style={{textShadow: "1px 1px 0 #1E3FAD"}}>
              PAYMENT RECEIPT
            </div>
          </div>

          {/* MAIN BORDER BOX */}
          <div className="border-2 border-orange-400 rounded-lg mt-4 p-6 grid grid-cols-2 gap-x-10 gap-y-5 text-slate-900">
            <div>
              <div className="text-base"><span className="font-bold">Customer Name:</span> <span className="font-semibold border-b-2 border-slate-400 inline-block min-w-[260px] pb-0.5">{receipt.customer?.name || ""}</span></div>
              <div className="mt-4 text-base"><span className="font-bold">Address:</span></div>
              <div className="border-b-2 border-slate-400 pb-0.5 text-sm mt-1 min-h-[20px]">{receipt.customer?.address || ""}</div>
              <div className="border-b-2 border-slate-400 pb-0.5 text-sm mt-2 min-h-[14px]"></div>
            </div>
            <div>
              <div className="text-base"><span className="font-bold">Amount Received (₹):</span> <span className="font-bold text-blue-800 border-b-2 border-slate-400 inline-block min-w-[200px] pb-0.5">{formatINR(receipt.amount).replace("₹","₹ ")}</span></div>
              <div className="mt-4 text-base"><span className="font-bold">Amount in Words:</span></div>
              <div className="border-b-2 border-slate-400 pb-0.5 text-sm mt-1 min-h-[20px]">{numToWords(Number(receipt.amount))}</div>
              <div className="border-b-2 border-slate-400 pb-0.5 text-sm mt-2 min-h-[14px]"></div>
            </div>

            <div className="col-span-2 grid grid-cols-2 gap-x-10 mt-2">
              <div>
                <div className="text-base"><span className="font-bold">Project / Work / Job Details</span></div>
                <div className="border-b-2 border-slate-400 pb-0.5 text-sm mt-2 min-h-[20px]">{receipt.project?.project_name || receipt.customer?.project_details || ""}</div>
                <div className="border-b-2 border-slate-400 pb-0.5 text-sm mt-2 min-h-[14px]"></div>
              </div>
              <div>
                <div className="flex items-center gap-2 text-base">
                  <span className="font-bold mr-2">Payment Method:</span>
                  <Box label="CASH" checked={receipt.payment_mode === "cash"} />
                  <Box label="UPI" checked={receipt.payment_mode === "upi"} />
                  <Box label="TRANSFER" checked={receipt.payment_mode === "bank"} />
                </div>
              </div>
            </div>

            <div className="col-span-2 grid grid-cols-2 gap-x-10 mt-1">
              <div>
                <div className="flex items-center gap-2 text-base">
                  <span className="font-bold">Payment Purpose:</span>
                  <Box label="ADVANCE" checked={receipt.payment_purpose === "advance"} />
                  <Box label="TOKEN" checked={receipt.payment_purpose === "token"} />
                  <Box label="PART" checked={receipt.payment_purpose === "part"} />
                </div>
                <div className="mt-2 text-sm"><span className="font-bold">OTHERS:</span> <span className="border-b-2 border-slate-400 inline-block min-w-[200px] pb-0.5">{receipt.payment_purpose === "others" ? (receipt.note || "") : ""}</span></div>
              </div>
              <div>
                <div className="text-base"><span className="font-bold">Transaction Ref No.</span></div>
                <div className="border-b-2 border-slate-400 pb-0.5 text-sm mt-1 min-h-[20px]">{receipt.transaction_ref || (receipt.payment_mode !== "cash" ? receipt.note : "") || ""}</div>
              </div>
            </div>

            <div className="col-span-2">
              <div className="text-base"><span className="font-bold">Notes (If any):</span> <span className="border-b-2 border-slate-400 inline-block min-w-[600px] pb-0.5">{receipt.note || ""}</span></div>
            </div>
          </div>

          {/* RECEIVED BY + QR */}
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="border border-blue-300 rounded-lg p-5 bg-blue-50/30">
              <div className="text-center font-display font-bold text-blue-800 tracking-wider text-sm">RECEIVED / GENERATED BY</div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <UserIcon className="w-4 h-4 text-blue-700" />
                  <span className="font-semibold">Name</span><span>:</span>
                  <span className="border-b-2 border-slate-400 flex-1 pb-0.5">{receipt.creator?.full_name || receipt.creator?.email || ""}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-blue-700" />
                  <span className="font-semibold">Time</span><span>:</span>
                  <span className="border-b-2 border-slate-400 flex-1 pb-0.5">{time}</span>
                </div>
                <div className="flex items-center gap-3">
                  <CalendarDays className="w-4 h-4 text-blue-700" />
                  <span className="font-semibold">Date</span><span>:</span>
                  <span className="border-b-2 border-slate-400 flex-1 pb-0.5">{formatDate(receipt.created_at)}</span>
                </div>
              </div>
            </div>

            <div className="border border-blue-300 rounded-lg p-5 bg-blue-50/30">
              <div className="text-center font-display font-bold text-blue-800 tracking-wider text-sm">AUTHENTICATE THIS RECEIPT</div>
              <div className="text-center text-xs text-slate-600 mt-1">Scan QR code to verify the authenticity<br />of this receipt and view full details.</div>
              <div className="flex justify-center mt-3">
                <div className="bg-white p-2 border border-slate-200">
                  <QRCodeSVG value={verifyUrl} size={120} level="H" includeMargin={false} />
                </div>
              </div>
              <div className="text-center text-sm mt-3">
                <span className="font-semibold">Receipt ID:</span> <span className="font-bold text-orange-600 tracking-wider">{receiptId}</span>
              </div>
              <div className="text-center text-xs text-slate-600 mt-1">Keep this receipt safe for future reference.</div>
            </div>
          </div>

          {/* SECURE & VERIFIED */}
          <div className="mt-4 border border-blue-300 rounded-lg p-4 bg-blue-50/30 flex items-start gap-4">
            <div className="w-12 h-12 rounded-md bg-blue-100 grid place-items-center shrink-0">
              <ShieldCheck className="w-6 h-6 text-blue-700" />
            </div>
            <div>
              <div className="font-display font-bold text-blue-800 tracking-wider text-sm">SECURE &amp; VERIFIED</div>
              <div className="text-xs text-slate-700 mt-1 leading-relaxed">
                This receipt contains encrypted information that can be verified using the QR code above. Any tampering will invalidate the receipt.
              </div>
            </div>
          </div>

          {/* TERMS */}
          <div className="mt-5 border-2 border-dashed border-orange-300 rounded-lg p-4 text-xs text-slate-700 leading-relaxed">
            <ul className="list-disc pl-5 space-y-1">
              <li>The amount received shall be adjusted against the final project billing.</li>
              <li>Advance / Token / Part amount is strictly non-refundable and shall be adjusted against completed work, materials procured, or custom-made items.</li>
              <li>Final billing shall be done based on actual site measurement and executed scope of work.</li>
              <li>This receipt is issued for record purposes only and GST is not included in this receipt. If the Client requests a GST Invoice, applicable GST charges shall be applied extra.</li>
            </ul>
          </div>

          {/* FOOTER */}
          <div className="mt-6 bg-slate-700 text-white px-6 py-3 grid grid-cols-2 gap-4 rounded">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-orange-500 grid place-items-center"><Phone className="w-4 h-4 text-white" /></div>
              <div>
                <div className="text-[10px] tracking-widest uppercase text-slate-300">Call / Whatsapp</div>
                <div className="font-bold">{SANKALP_CONTACT.phone}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-500 grid place-items-center"><Globe className="w-4 h-4 text-white" /></div>
              <div>
                <div className="text-[10px] tracking-widest uppercase text-slate-300">Visit Our Website</div>
                <div className="font-bold">{SANKALP_CONTACT.website}</div>
              </div>
            </div>
          </div>
          <div className="mt-3 text-center text-xs text-slate-700 inline-flex items-start gap-2 w-full justify-center">
            <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
            <span><span className="font-bold">Office:</span> {SANKALP_CONTACT.address}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
