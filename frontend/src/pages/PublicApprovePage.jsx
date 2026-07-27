import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchApprovalByToken, submitApprovalResponse, uploadPublicResponsePhoto } from "@/services/digitalApprovalService";
import { toast, Toaster } from "sonner";
import { CheckCircle2, XCircle, AlertTriangle, MapPin, Camera, ShieldCheck, ExternalLink, User, Calendar, Phone, Printer } from "lucide-react";
import { cn } from "@/lib/utils";

// Public-facing magic-link approval page. NO app auth.

// -- Print-ready evidence document (opens in new window, auto-prints) --
function printApprovalEvidence(approval) {
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
        <div class="field"><label>Customer</label><span>${esc(approval.customer_name || "—")}</span></div>
        <div class="field"><label>Project</label><span>${esc(approval.project_name || "—")}</span></div>
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
      ${approval.response_photo_url ? `<div style="margin-top:10px"><label style="display:block;font-size:9px;letter-spacing:.15em;text-transform:uppercase;color:#64748b;font-weight:700">Customer Selfie</label><img src="${esc(approval.response_photo_url)}" class="selfie" alt="Customer selfie"/></div>` : ""}
      ${approval.response_user_agent ? `<div style="margin-top:10px;font-size:9px;color:#64748b">Device: ${esc(approval.response_user_agent)}</div>` : ""}
    </section>` : `<section><h3>Response Status</h3><div style="text-align:center;color:${statusColor};font-size:14px;font-weight:700;padding:12px">Awaiting customer response · Link expires ${fmt(approval.expires_at)}</div></section>`}

    <div class="footer">This is a system-generated digital record. Sankalp Group · Business Solutions · © ${new Date().getFullYear()}</div>
  </body></html>`);
  w.document.close();
  setTimeout(() => { try { w.focus(); w.print(); } catch(_){ /* noop */ } }, 500);
}

export default function PublicApprovePage() {
  const { token } = useParams();
  const [approval, setApproval] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form state
  const [step, setStep] = useState("view");  // view | choose | form | submitting | done
  const [decision, setDecision] = useState(null);   // "approved" | "rejected"
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [selfie, setSelfie] = useState(null);         // {url, blob}
  const [selfieUploading, setSelfieUploading] = useState(false);
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [locStatus, setLocStatus] = useState("idle"); // idle | requesting | ok | error
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraOn, setCameraOn] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const row = await fetchApprovalByToken(token);
      if (!row) { setError("Invalid or expired link."); return; }
      setApproval(row);
      if (row.status !== "pending") setStep("done");
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-line */ }, [token]);

  const requestLocation = () => {
    if (!navigator.geolocation) { setLocStatus("error"); return; }
    setLocStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLat(pos.coords.latitude); setLng(pos.coords.longitude); setAccuracy(pos.coords.accuracy); setLocStatus("ok"); },
      (err) => { setLocStatus("error"); console.warn("geo denied", err); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      setCameraOn(true);   // renders the <video> element first
    } catch (e) {
      toast.error("Camera permission denied — please allow camera access and try again");
      console.warn("getUserMedia failed", e);
    }
  };
  const stopCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    setCameraOn(false);
  };
  // Attach stream to <video> AFTER the element is in the DOM
  useEffect(() => {
    if (cameraOn && videoRef.current && streamRef.current) {
      const v = videoRef.current;
      v.srcObject = streamRef.current;
      v.setAttribute("playsinline", "true");
      v.muted = true;
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch((err) => console.warn("video play failed", err));
    }
  }, [cameraOn]);
  useEffect(() => () => stopCamera(), []);

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    const c = document.createElement("canvas");
    c.width = videoRef.current.videoWidth; c.height = videoRef.current.videoHeight;
    c.getContext("2d").drawImage(videoRef.current, 0, 0);
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
    const localUrl = URL.createObjectURL(blob);
    setSelfie({ url: localUrl, blob });
    stopCamera();
  };
  const retakePhoto = () => { setSelfie(null); startCamera(); };

  const handleSubmit = async () => {
    if (!decision) { toast.error("Choose Approve or Reject"); return; }
    if (!name.trim()) { toast.error("Please type your full name"); return; }
    if (decision === "rejected" && !comment.trim()) { toast.error("Please share what needs to change"); return; }

    setStep("submitting");
    try {
      // Upload selfie if captured
      let photoUrl = null;
      if (selfie?.blob) {
        setSelfieUploading(true);
        const up = await uploadPublicResponsePhoto(selfie.blob);
        photoUrl = up.url;
        setSelfieUploading(false);
      }
      // Get IP (best-effort, non-blocking)
      let ip = null;
      try {
        const r = await fetch("https://api.ipify.org?format=json");
        const j = await r.json(); ip = j.ip;
      } catch (_) { /* ignore */ }

      const updated = await submitApprovalResponse({
        token, status: decision, name: name.trim(), comment: comment.trim(),
        photoUrl, lat, lng, accuracy, ip, userAgent: navigator.userAgent,
      });
      setApproval(updated);
      setStep("done");
      toast.success(decision === "approved" ? "Thank you! Approved." : "Thank you — your feedback is recorded.");
    } catch (e) {
      toast.error(e.message);
      setStep("form");
    }
  };

  // ============ UI ============
  if (loading) return <Shell><div className="text-center py-20 text-stone-500 text-sm">Loading…</div></Shell>;
  if (error)   return <Shell><div className="text-center py-20"><AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" /><div className="font-semibold text-rose-700">{error}</div></div></Shell>;
  if (!approval) return null;

  // ==== DONE / VIEW-ONLY EVIDENCE MODE ====
  if (step === "done" || approval.status !== "pending") {
    const isApproved = approval.status === "approved";
    const isRejected = approval.status === "rejected";
    const isExpired = approval.status === "expired";
    return (
      <Shell>
        <div className="print-hide flex justify-end mb-3">
          <button onClick={() => printApprovalEvidence(approval)} className="inline-flex items-center gap-2 bg-stone-900 text-white px-4 py-2 text-sm font-bold hover:bg-stone-800" data-testid="pa-print-evidence">
            <Printer className="w-4 h-4" /> Print / Save as PDF
          </button>
        </div>
        <div className={cn("rounded-none border-2 p-6 mb-4", isApproved && "border-emerald-300 bg-emerald-50", isRejected && "border-rose-300 bg-rose-50", isExpired && "border-stone-300 bg-stone-50")}>
          <div className="flex items-center gap-3">
            {isApproved && <CheckCircle2 className="w-10 h-10 text-emerald-600" />}
            {isRejected && <XCircle className="w-10 h-10 text-rose-600" />}
            {isExpired && <AlertTriangle className="w-10 h-10 text-stone-500" />}
            <div>
              <div className="font-display text-2xl font-bold">{isApproved ? "APPROVED" : isRejected ? "CHANGES REQUESTED" : "LINK EXPIRED"}</div>
              {approval.response_at && <div className="text-xs text-stone-600">on {new Date(approval.response_at).toLocaleString()}</div>}
            </div>
          </div>
        </div>

        <ApprovalContent approval={approval} />

        {approval.response_at && (
          <div className="mt-6 bg-white border-2 border-stone-300 p-5">
            <div className="text-[10px] tracking-[0.15em] uppercase font-bold text-stone-500 mb-3 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-600" /> Response Evidence</div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <RO label="Responded by" value={approval.response_by_name} />
              <RO label="Response time" value={new Date(approval.response_at).toLocaleString()} />
              <RO label="IP address" value={approval.response_ip} />
              {approval.response_lat && (<>
                <RO label="Latitude" value={approval.response_lat.toFixed(6)} />
                <RO label="Longitude" value={approval.response_lng.toFixed(6)} />
              </>)}
            </div>
            {approval.response_comment && (
              <div className="mt-3">
                <div className="text-[10px] tracking-[0.15em] uppercase font-bold text-stone-500 mb-1">Customer Comment</div>
                <div className="bg-stone-50 border border-stone-200 p-3 text-sm whitespace-pre-wrap">{approval.response_comment}</div>
              </div>
            )}
            {approval.response_photo_url && (
              <div className="mt-3">
                <div className="text-[10px] tracking-[0.15em] uppercase font-bold text-stone-500 mb-1">Customer Selfie / Photo</div>
                <img src={approval.response_photo_url} alt="Customer" className="w-full max-w-md border-2 border-stone-300 shadow" data-testid="pa-response-selfie" />
              </div>
            )}
            {approval.response_lat && approval.response_lng && (
              <div className="mt-3">
                <a href={`https://maps.google.com/?q=${approval.response_lat},${approval.response_lng}`} target="_blank" rel="noreferrer" className="text-sm text-blue-700 hover:underline inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> View location on Google Maps</a>
              </div>
            )}
            <div className="mt-4 text-[10px] text-stone-500 italic">This page is now READ-ONLY. Bookmark this link — it is your permanent digital evidence of the customer&apos;s decision.</div>
          </div>
        )}
        <Toaster position="bottom-right" />
      </Shell>
    );
  }

  // ==== ACTIVE FLOW (pending) ====
  return (
    <Shell>
      <ApprovalContent approval={approval} />

      {step === "view" && (
        <div className="mt-6 bg-white border-2 border-stone-300 p-5">
          <div className="text-center mb-4">
            <div className="text-[11px] tracking-[0.2em] uppercase font-bold text-stone-500 mb-2">Your response is required</div>
            <div className="text-lg text-stone-800">Please review the details above and choose:</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => { setDecision("approved"); setStep("form"); requestLocation(); }} className="border-2 border-emerald-500 bg-emerald-50 hover:bg-emerald-100 p-5 transition-colors flex flex-col items-center gap-2" data-testid="pa-btn-approve">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              <div className="font-display text-xl font-bold text-emerald-800">Approve</div>
              <div className="text-xs text-emerald-700">I&apos;m satisfied — proceed</div>
            </button>
            <button onClick={() => { setDecision("rejected"); setStep("form"); requestLocation(); }} className="border-2 border-rose-500 bg-rose-50 hover:bg-rose-100 p-5 transition-colors flex flex-col items-center gap-2" data-testid="pa-btn-reject">
              <XCircle className="w-10 h-10 text-rose-600" />
              <div className="font-display text-xl font-bold text-rose-800">Request Changes</div>
              <div className="text-xs text-rose-700">I need modifications</div>
            </button>
          </div>
        </div>
      )}

      {(step === "form" || step === "submitting") && (
        <div className="mt-6 bg-white border-2 border-stone-300 p-5">
          <div className="mb-4">
            <div className="text-[11px] tracking-[0.2em] uppercase font-bold text-stone-500 mb-1">Your decision</div>
            <div className={cn("inline-flex items-center gap-2 px-3 py-1 border-2 text-sm font-bold", decision === "approved" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-rose-500 bg-rose-50 text-rose-800")}>
              {decision === "approved" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {decision === "approved" ? "APPROVE" : "REQUEST CHANGES"}
              <button onClick={() => setStep("view")} className="ml-2 text-xs underline">Change</button>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] tracking-[0.15em] uppercase font-bold text-stone-500">Your Full Name *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name (this becomes your signature)" className="mt-1 w-full border-2 border-stone-300 px-3 py-2 text-sm focus:border-stone-900 outline-none" data-testid="pa-name" />
            </div>
            <div>
              <label className="text-[10px] tracking-[0.15em] uppercase font-bold text-stone-500">
                {decision === "approved" ? "Any comment (optional)" : "What needs to change? *"}
              </label>
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4} placeholder={decision === "approved" ? "Any note for the team…" : "e.g. Please change the kitchen colour to darker walnut…"} className="mt-1 w-full border-2 border-stone-300 px-3 py-2 text-sm focus:border-stone-900 outline-none" data-testid="pa-comment" />
            </div>
            <div>
              <label className="text-[10px] tracking-[0.15em] uppercase font-bold text-stone-500 flex items-center gap-1"><Camera className="w-3 h-3" /> Selfie (recommended)</label>
              {selfie ? (
                <div className="mt-2 border-2 border-emerald-400 bg-emerald-50 p-3">
                  <div className="text-[11px] text-emerald-800 font-bold mb-2 tracking-wider">✓ SELFIE CAPTURED</div>
                  <img src={selfie.url} alt="Selfie" className="w-full max-w-sm object-contain border-2 border-white shadow" data-testid="pa-selfie-preview" />
                  <button onClick={retakePhoto} className="mt-2 text-xs text-blue-700 underline">Retake photo</button>
                </div>
              ) : cameraOn ? (
                <div className="mt-2 border-2 border-blue-400 bg-blue-50 p-3">
                  <div className="text-[11px] text-blue-800 font-bold mb-2 tracking-wider">CAMERA LIVE — Position your face in frame</div>
                  <video ref={videoRef} className="w-full max-w-sm bg-black" playsInline muted autoPlay data-testid="pa-video" />
                  <div className="flex gap-2 mt-2">
                    <button onClick={capturePhoto} className="px-4 py-2 bg-emerald-600 text-white text-sm hover:bg-emerald-700 inline-flex items-center gap-1" data-testid="pa-capture-selfie">
                      <Camera className="w-4 h-4" /> Capture
                    </button>
                    <button onClick={stopCamera} className="px-4 py-2 border-2 border-stone-300 bg-white text-sm hover:bg-stone-100">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={startCamera} className="mt-1 px-4 py-2 border-2 border-stone-300 text-sm hover:bg-stone-100 inline-flex items-center gap-2" data-testid="pa-selfie-open">
                  <Camera className="w-4 h-4" /> Open Camera
                </button>
              )}
            </div>
            <div className="bg-stone-50 border border-stone-200 p-3 text-xs">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-stone-500" />
                {locStatus === "ok" && <span className="text-emerald-700 font-medium">✓ Location captured ({lat?.toFixed(4)}, {lng?.toFixed(4)})</span>}
                {locStatus === "requesting" && <span className="text-stone-600">Requesting location…</span>}
                {locStatus === "error" && <span className="text-amber-700">Location permission denied — response will still record without it.</span>}
                {locStatus === "idle" && <button onClick={requestLocation} className="text-blue-700 underline" data-testid="pa-req-location">Enable location</button>}
              </div>
            </div>
            <div className="text-[10px] text-stone-500 italic">
              By clicking submit, you confirm you are the customer named above and that your response is final.
              IP address, timestamp{lat && ", geo-location"}{selfie && ", and photo"} will be recorded as legal evidence.
            </div>
            <button onClick={handleSubmit} disabled={step === "submitting" || selfieUploading} className={cn("w-full py-3 text-white font-bold text-lg tracking-wider", decision === "approved" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700", (step === "submitting" || selfieUploading) && "opacity-60")} data-testid="pa-submit">
              {step === "submitting" ? "Submitting…" : selfieUploading ? "Uploading photo…" : (decision === "approved" ? "CONFIRM APPROVAL" : "SUBMIT CHANGE REQUEST")}
            </button>
          </div>
        </div>
      )}
      <Toaster position="bottom-right" />
    </Shell>
  );
}

// ============ Sub-components ============
function Shell({ children }) {
  return (
    <div className="min-h-screen bg-stone-100 py-6 px-4 md:py-12">
      <style>{`@media print { .print-hide { display: none !important; } body { background: #fff !important; } }`}</style>
      <div className="max-w-2xl mx-auto">
        {/* Brand header */}
        <div className="bg-white border-2 border-stone-900 p-4 mb-4 flex items-center gap-3">
          <div className="w-12 h-12 bg-stone-900 text-orange-500 flex items-center justify-center font-display text-2xl font-bold">S</div>
          <div>
            <div className="font-display text-lg font-bold text-stone-900">Sankalp Group · Business Solutions</div>
            <div className="text-[10px] tracking-[0.2em] uppercase font-semibold text-stone-500">Digital Approval Request</div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function ApprovalContent({ approval }) {
  return (
    <div className="bg-white border-2 border-stone-300 p-5">
      <h1 className="font-display text-3xl font-bold text-stone-900">{approval.subject}</h1>
      <div className="text-xs text-stone-500 mt-1 flex items-center gap-3 flex-wrap">
        <span><Calendar className="w-3 h-3 inline mr-1" /> {new Date(approval.created_at).toLocaleDateString()}</span>
        {approval.customer_name && <span><User className="w-3 h-3 inline mr-1" /> {approval.customer_name}</span>}
        {approval.project_name && <span>· {approval.project_name}</span>}
      </div>
      {approval.description && (
        <div className="mt-4 whitespace-pre-wrap text-stone-800 text-sm bg-stone-50 border border-stone-200 p-3">{approval.description}</div>
      )}
      {(approval.photo_urls?.length > 0) && (
        <div className="mt-4">
          <div className="text-[10px] tracking-[0.15em] uppercase font-bold text-stone-500 mb-2">Photos ({approval.photo_urls.length})</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {approval.photo_urls.map((p, i) => (
              <a key={i} href={p.url} target="_blank" rel="noreferrer" className="block aspect-square bg-stone-100 border border-stone-200 overflow-hidden">
                <img src={p.url} alt={p.name} className="w-full h-full object-cover hover:opacity-80" />
              </a>
            ))}
          </div>
        </div>
      )}
      {(approval.file_urls?.length > 0) && (
        <div className="mt-4">
          <div className="text-[10px] tracking-[0.15em] uppercase font-bold text-stone-500 mb-2">Files ({approval.file_urls.length})</div>
          <div className="space-y-1">
            {approval.file_urls.map((f, i) => (
              <a key={i} href={f.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm bg-stone-50 border border-stone-200 px-3 py-2 hover:bg-stone-100">
                <ExternalLink className="w-4 h-4 text-stone-500" />
                <span className="flex-1 truncate">{f.name}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RO({ label, value }) {
  return (
    <div>
      <div className="text-[10px] tracking-[0.15em] uppercase font-semibold text-stone-500">{label}</div>
      <div className="text-sm text-stone-900 mt-0.5 font-mono break-all">{value || "—"}</div>
    </div>
  );
}
