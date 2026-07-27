import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchApprovalByToken, submitApprovalResponse, uploadPublicResponsePhoto } from "@/services/digitalApprovalService";
import { toast, Toaster } from "sonner";
import { CheckCircle2, XCircle, AlertTriangle, MapPin, Camera, ShieldCheck, ExternalLink, User, Calendar, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

// Public-facing magic-link approval page. NO app auth.
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
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setCameraOn(true);
    } catch (e) { toast.error("Camera permission denied"); }
  };
  const stopCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    setCameraOn(false);
  };
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
                <div className="text-[10px] tracking-[0.15em] uppercase font-bold text-stone-500 mb-1">Customer Selfie</div>
                <img src={approval.response_photo_url} alt="Customer" className="max-w-[280px] border border-stone-300" />
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
                <div className="mt-2 flex items-center gap-2">
                  <img src={selfie.url} alt="Selfie" className="w-32 h-32 object-cover border border-stone-300" />
                  <button onClick={retakePhoto} className="text-xs text-blue-700 underline">Retake</button>
                </div>
              ) : cameraOn ? (
                <div className="mt-2">
                  <video ref={videoRef} className="w-full max-w-xs border border-stone-300" playsInline />
                  <button onClick={capturePhoto} className="mt-2 px-4 py-2 bg-stone-900 text-white text-sm hover:bg-stone-800" data-testid="pa-capture-selfie">Capture</button>
                  <button onClick={stopCamera} className="mt-2 ml-2 px-4 py-2 border border-stone-300 text-sm hover:bg-stone-100">Cancel</button>
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
