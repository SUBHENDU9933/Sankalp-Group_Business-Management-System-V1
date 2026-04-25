import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchReceiptById } from "@/services/receiptService";
import { Button } from "@/components/ui/button";
import { formatINR, formatDate, formatDateTime } from "@/utils/format";
import { Printer, ArrowLeft } from "lucide-react";

const numToWords = (num) => {
  if (num === null || num === undefined || isNaN(num)) return "";
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const inWords = (n) => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n/10)] + (n%10 ? " " + a[n%10] : "");
    if (n < 1000) return a[Math.floor(n/100)] + " Hundred" + (n%100 ? " " + inWords(n%100) : "");
    if (n < 100000) return inWords(Math.floor(n/1000)) + " Thousand" + (n%1000 ? " " + inWords(n%1000) : "");
    if (n < 10000000) return inWords(Math.floor(n/100000)) + " Lakh" + (n%100000 ? " " + inWords(n%100000) : "");
    return inWords(Math.floor(n/10000000)) + " Crore" + (n%10000000 ? " " + inWords(n%10000000) : "");
  };
  const intPart = Math.floor(num);
  const paise = Math.round((num - intPart) * 100);
  let words = inWords(intPart) + " Rupees";
  if (paise) words += " and " + inWords(paise) + " Paise";
  return words + " Only";
};

export default function ReceiptPrintPage() {
  const { id } = useParams();
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetchReceiptById(id).then(setReceipt).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-12 text-center text-stone-500">Loading receipt…</div>;
  if (!receipt) return <div className="p-12 text-center text-stone-500">Receipt not found.</div>;

  return (
    <div className="min-h-screen bg-stone-100 p-6 md:p-12 print:p-0 print:bg-white">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6 no-print">
          <Button variant="outline" className="rounded-none border-stone-300" onClick={() => window.close()} data-testid="receipt-back-button">
            <ArrowLeft className="w-4 h-4 mr-1" />Close
          </Button>
          <Button className="rounded-none bg-stone-900 hover:bg-stone-800 text-white" onClick={() => window.print()} data-testid="receipt-print-button">
            <Printer className="w-4 h-4 mr-1" />Print / Save as PDF
          </Button>
        </div>

        <div className="print-page bg-white border border-stone-300 p-10 md:p-12 shadow-sm" data-testid="receipt-print-document">
          {/* Header */}
          <div className="grid grid-cols-[1fr_auto] gap-6 pb-6 border-b-2 border-stone-900">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-orange-500 grid place-items-center font-display font-bold text-2xl text-white">S</div>
                <div>
                  <div className="font-display text-2xl font-bold tracking-tight">SANKALP GROUP</div>
                  <div className="text-xs tracking-widest uppercase text-stone-600">&amp; Business Solutions</div>
                </div>
              </div>
              <div className="text-xs text-stone-600 mt-3 leading-relaxed">
                Interior &amp; Infrastructure Solutions<br />
                contact@sankalpgroup.in
              </div>
            </div>
            <div className="text-right">
              <div className="label-uppercase">Receipt</div>
              <div className="font-display text-2xl font-bold tracking-tight mt-1">{receipt.receipt_no}</div>
              <div className="text-xs text-stone-600 mt-2">{formatDateTime(receipt.created_at)}</div>
            </div>
          </div>

          {/* Customer */}
          <div className="grid grid-cols-2 gap-0 border-b border-stone-300 mt-6 grid-divider-x">
            <div className="py-4 pr-6">
              <div className="label-uppercase text-stone-500 mb-1">Received From</div>
              <div className="font-display text-lg font-semibold">{receipt.customer?.name}</div>
              <div className="text-sm text-stone-600">{receipt.customer?.phone}</div>
              {receipt.customer?.address && <div className="text-xs text-stone-500 mt-1">{receipt.customer.address}</div>}
            </div>
            <div className="py-4 pl-6">
              <div className="label-uppercase text-stone-500 mb-1">Project</div>
              <div className="text-sm">{receipt.customer?.project_details || "—"}</div>
            </div>
          </div>

          {/* Body */}
          <div className="mt-8">
            <div className="grid grid-cols-3 gap-0 border border-stone-300 grid-divider-x">
              <div className="p-4">
                <div className="label-uppercase text-stone-500">Payment Mode</div>
                <div className="font-medium capitalize mt-1">{receipt.payment_mode}</div>
              </div>
              <div className="p-4">
                <div className="label-uppercase text-stone-500">Date</div>
                <div className="font-medium mt-1">{formatDate(receipt.created_at)}</div>
              </div>
              <div className="p-4">
                <div className="label-uppercase text-stone-500">Status</div>
                <div className="font-medium mt-1 text-emerald-700">Received</div>
              </div>
            </div>

            {receipt.note && (
              <div className="border border-t-0 border-stone-300 p-4">
                <div className="label-uppercase text-stone-500 mb-1">Note</div>
                <div className="text-sm">{receipt.note}</div>
              </div>
            )}
          </div>

          {/* Amount */}
          <div className="mt-8 bg-stone-900 text-white p-6 grid grid-cols-[1fr_auto] gap-6 items-end">
            <div>
              <div className="label-uppercase text-stone-500">Amount in Words</div>
              <div className="font-display text-base font-semibold mt-1 leading-snug">{numToWords(Number(receipt.amount))}</div>
            </div>
            <div className="text-right">
              <div className="label-uppercase text-stone-500">Total</div>
              <div className="font-display text-4xl font-bold tracking-tight mt-1 text-orange-400 tabular-nums">{formatINR(receipt.amount)}</div>
            </div>
          </div>

          {/* Footer */}
          <div className="grid grid-cols-2 gap-6 mt-12 pt-8 border-t border-stone-200">
            <div>
              <div className="label-uppercase text-stone-500 mb-12">Customer Signature</div>
              <div className="border-t border-stone-400 text-xs text-stone-500 pt-1">Signed</div>
            </div>
            <div className="text-right">
              <div className="label-uppercase text-stone-500 mb-12">Authorised Signatory</div>
              <div className="border-t border-stone-400 text-xs text-stone-500 pt-1 inline-block">For Sankalp Group</div>
            </div>
          </div>
          <div className="mt-8 text-center text-[10px] tracking-widest uppercase text-stone-400">This is a system-generated receipt.</div>
        </div>
      </div>
    </div>
  );
}
