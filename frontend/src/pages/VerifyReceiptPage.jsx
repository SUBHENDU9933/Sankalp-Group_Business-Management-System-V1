import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { formatINR, formatDate } from "@/utils/format";
import { ShieldCheck, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Logo, SANKALP_TAGLINE_BN } from "@/lib/brand";

export default function VerifyReceiptPage() {
  const { uid } = useParams();
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Try receipt_uid first, then id
      let { data } = await supabase
        .from("receipts")
        .select("*, customer:customers(name,phone,address), project:projects(project_name)")
        .eq("receipt_uid", uid)
        .maybeSingle();
      if (!data) {
        const r = await supabase
          .from("receipts")
          .select("*, customer:customers(name,phone,address), project:projects(project_name)")
          .eq("id", uid)
          .maybeSingle();
        data = r.data;
      }
      setReceipt(data);
      setLoading(false);
    })();
  }, [uid]);

  if (loading) return <div className="min-h-screen grid place-items-center bg-slate-50 text-slate-500">Verifying…</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-orange-50/30 p-6 grid place-items-center">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-blue-700 text-white px-6 py-5 flex items-center gap-3">
          <Logo className="h-10 w-10 object-contain bg-white rounded-lg p-1" />
          <div>
            <div className="font-display font-bold text-lg leading-tight">SANKALP GROUP</div>
            <div className="font-bengali text-xs text-blue-100">"{SANKALP_TAGLINE_BN}"</div>
          </div>
        </div>

        {receipt ? (
          <div className="p-6">
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="w-6 h-6" />
              <div className="font-display font-bold text-xl">Receipt Verified</div>
            </div>
            <p className="text-sm text-slate-600 mt-1">This receipt is authentic and unaltered.</p>

            <div className="mt-5 space-y-3 text-sm">
              <Row label="Receipt No." value={receipt.receipt_no} />
              <Row label="SI No." value={receipt.si_no || "—"} />
              <Row label="Customer" value={receipt.customer?.name || "—"} />
              <Row label="Project" value={receipt.project?.project_name || receipt.customer?.address || "—"} />
              <Row label="Amount" value={<span className="font-bold text-orange-600">{formatINR(receipt.amount)}</span>} />
              <Row label="Mode" value={<span className="capitalize">{receipt.payment_mode}</span>} />
              <Row label="Purpose" value={<span className="capitalize">{receipt.payment_purpose || "—"}</span>} />
              <Row label="Date" value={formatDate(receipt.created_at)} />
            </div>

            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-900">
                If any of the printed details on the physical receipt do not match the values shown here, the receipt has been tampered with. Contact Sankalp Group immediately.
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center">
            <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto" />
            <div className="font-display font-bold text-xl mt-3 text-rose-700">Receipt Not Found</div>
            <p className="text-sm text-slate-600 mt-2">This QR code does not match any issued receipt. The receipt may be invalid or tampered with.</p>
          </div>
        )}
      </div>
    </div>
  );
}

const Row = ({ label, value }) => (
  <div className="grid grid-cols-[120px_1fr] gap-3 py-2 border-b border-slate-100 last:border-b-0">
    <div className="label-uppercase text-slate-400">{label}</div>
    <div className="text-slate-900">{value}</div>
  </div>
);
