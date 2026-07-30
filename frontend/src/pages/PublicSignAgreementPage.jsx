import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { toast, Toaster } from "sonner";
import { CheckCircle2, ShieldCheck, Camera, MapPin, AlertTriangle } from "lucide-react";
import { fetchAgreementByToken, submitAgreementSignature, uploadPublicSignaturePhoto } from "@/services/agreementService";
import { formatDateTime } from "@/utils/format";

export default function PublicSignAgreementPage() {
  const { token } = useParams();
  const [agreement, setAgreement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [step, setStep] = useState("view"); // view | form | submitting | done

  const [name, setName] = useState("");
  const [selfie, setSelfie] = useState(null);
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [locStatus, setLocStatus] = useState("idle");
  const [cameraOn, setCameraOn] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const row = await fetchAgreementByToken(token);
      if (!row) { setError("Invalid or expired link."); return; }
      setAgreement(row);
      if (row.status === "signed_digital") setStep("done");
      else if (row.expires_at && new Date(row.expires_at) < new Date()) setError("This signing link has expired. Please ask Sankalp Interior Solution to resend it.");
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-line */ }, [token]);

  const requestLocation = () => {
    if (!navigator.geolocation) { setLocStatus("error"); return; }
    setLocStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLat(pos.coords.latitude); setLng(pos.coords.longitude); setAccuracy(pos.coords.accuracy); setLocStatus("ok"); },
      () => setLocStatus("error"),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      setCameraOn(true);
    } catch {
      toast.error("Camera permission denied — you can still sign with just your name");
    }
  };
  const stopCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    setCameraOn(false);
  };
  useEffect(() => {
    if (cameraOn && videoRef.current && streamRef.current) {
      const v = videoRef.current;
      v.srcObject = streamRef.current;
      v.muted = true;
      const p = v.play();
      if (p?.catch) p.catch(() => {});
    }
  }, [cameraOn]);
  useEffect(() => () => stopCamera(), []);

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const v = videoRef.current;
    const c = document.createElement("canvas");
    c.width = v.videoWidth || 640; c.height = v.videoHeight || 480;
    const ctx = c.getContext("2d");
    ctx.drawImage(v, 0, 0, c.width, c.height);

    // ---------- Watermark overlay (same evidence style as Digital Approvals) ----------
    const pad = Math.round(c.width * 0.02);
    const lineH = Math.round(c.width * 0.032);
    const fontS = Math.round(c.width * 0.028);
    const bandH = lineH * 4 + pad * 2;

    ctx.fillStyle = "rgba(0,0,0,0.62)";
    ctx.fillRect(0, c.height - bandH, c.width, bandH);
    ctx.fillStyle = "#f5b800";
    ctx.fillRect(0, c.height - bandH, c.width, 2);

    ctx.textBaseline = "top";
    ctx.fillStyle = "#f5b800";
    ctx.font = `bold ${Math.round(fontS * 0.9)}px Inter, Arial, sans-serif`;
    ctx.fillText("SANKALP GROUP · DIGITAL SIGNATURE EVIDENCE", pad, c.height - bandH + pad);

    ctx.fillStyle = "#ffffff";
    ctx.font = `${fontS}px Inter, Arial, sans-serif`;
    const now = new Date();
    const ts = now.toLocaleString("en-IN", { hour12: true });
    const geoLine = (lat != null && lng != null)
      ? `GEO: ${lat.toFixed(6)}, ${lng.toFixed(6)} (±${Math.round(accuracy || 0)}m)`
      : "GEO: not captured";

    let y = c.height - bandH + pad + lineH;
    ctx.fillText(`TIME: ${ts}`, pad, y);
    y += lineH;
    ctx.fillText(geoLine, pad, y);
    y += lineH;
    if (agreement?.title) {
      ctx.fillText(`RE: ${agreement.title.slice(0, 60)}${agreement.merge_data?.client_name ? ` · ${agreement.merge_data.client_name}` : ""}`, pad, y);
    }

    c.toBlob((blob) => { setSelfie({ url: URL.createObjectURL(blob), blob }); stopCamera(); }, "image/jpeg", 0.88);
  };

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error("Please type your full name"); return; }
    setStep("submitting");
    try {
      let signatureUrl = null;
      if (selfie?.blob) {
        const up = await uploadPublicSignaturePhoto(selfie.blob);
        signatureUrl = up.url;
      }
      let ip = null;
      try { const r = await fetch("https://api.ipify.org?format=json"); ip = (await r.json()).ip; } catch {}
      const updated = await submitAgreementSignature({
        token, signerName: name.trim(), signatureUrl, lat, lng, accuracy, ip, userAgent: navigator.userAgent,
      });
      setAgreement(updated);
      setStep("done");
      toast.success("Agreement signed — thank you!");
    } catch (e) { toast.error(e.message); setStep("form"); }
  };

  if (loading) return <div className="min-h-screen grid place-items-center text-slate-400">Loading agreement…</div>;
  if (error) return (
    <div className="min-h-screen grid place-items-center px-6 text-center">
      <div>
        <AlertTriangle className="w-10 h-10 mx-auto text-amber-500 mb-3" />
        <div className="text-slate-700 font-medium">{error}</div>
      </div>
    </div>
  );

  const clauses = agreement.signed_snapshot || [];
  const md = agreement.merge_data || {};

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <Toaster position="top-center" />
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <div className="font-display font-extrabold text-lg text-blue-800">SANKALP GROUP · BUSINESS SOLUTIONS</div>
          <div className="text-xs uppercase tracking-widest text-slate-400 mt-1">Secure Digital Agreement</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h1 className="font-display font-bold text-xl text-slate-900 mb-1">{agreement.title}</h1>
          <p className="text-sm text-slate-500 mb-5">Client: {md.client_name} · {md.project_type} {md.project_location ? `· ${md.project_location}` : ""}</p>

          <div className="max-h-[45vh] overflow-y-auto pr-2 border-y border-slate-100 py-4 space-y-4 text-[13px] leading-relaxed text-slate-700">
            {clauses.length === 0 ? (
              <p className="text-slate-400 text-sm">Agreement text is being prepared — please contact Sankalp Interior Solution if this persists.</p>
            ) : clauses.map((c, i) => (
              <div key={i}>
                <div className="font-semibold text-slate-900 text-sm mb-1">{c.title}</div>
                <p className="whitespace-pre-line">{c.body}</p>
              </div>
            ))}
          </div>

          {step === "done" ? (
            <div className="mt-5 text-center py-6">
              <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500 mb-2" />
              <div className="font-semibold text-slate-900">Signed successfully</div>
              <div className="text-sm text-slate-500 mt-1">By {agreement.signer_name} on {formatDateTime(agreement.signed_at)}</div>
              {agreement.signature_url && <img src={agreement.signature_url} alt="" className="mt-3 h-24 mx-auto rounded border border-slate-200 object-cover" />}
              <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 mt-3"><ShieldCheck className="w-3.5 h-3.5" /> This record is securely stored by Sankalp Interior Solution</div>
            </div>
          ) : step === "view" ? (
            <div className="mt-5 text-center">
              <button
                onClick={() => setStep("form")}
                className="w-full py-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold"
                data-testid="sign-continue-button"
              >
                I Have Read &amp; Agree — Continue to Sign
              </button>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <div>
                <label className="text-xs text-slate-500 font-medium">Your Full Name (acts as your signature)</label>
                <input
                  className="w-full mt-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Type your full legal name"
                  data-testid="sign-name-input"
                />
              </div>

              <div>
                <button onClick={requestLocation} className="text-xs inline-flex items-center gap-1.5 text-blue-700 hover:underline">
                  <MapPin className="w-3.5 h-3.5" /> {locStatus === "ok" ? "Location captured ✓" : locStatus === "error" ? "Location unavailable — continuing without it" : "Share location (optional, strengthens evidence)"}
                </button>
              </div>

              <div>
                {selfie ? (
                  <div className="flex items-center gap-3">
                    <img src={selfie.url} alt="" className="h-16 w-16 rounded-lg object-cover border border-slate-200" />
                    <button onClick={() => setSelfie(null)} className="text-xs text-slate-500 hover:underline">Retake</button>
                  </div>
                ) : cameraOn ? (
                  <div>
                    <video ref={videoRef} className="w-full max-w-xs rounded-lg bg-black" playsInline muted autoPlay />
                    <button onClick={capturePhoto} className="mt-2 px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg inline-flex items-center gap-1.5">
                      <Camera className="w-4 h-4" /> Capture
                    </button>
                  </div>
                ) : (
                  <button onClick={startCamera} className="px-4 py-2 border-2 border-slate-300 rounded-lg text-sm inline-flex items-center gap-2 hover:bg-slate-50">
                    <Camera className="w-4 h-4" /> Take a quick selfie (optional, strengthens evidence)
                  </button>
                )}
              </div>

              <button
                onClick={handleSubmit}
                disabled={step === "submitting"}
                className="w-full py-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold disabled:opacity-60"
                data-testid="sign-submit-button"
              >
                {step === "submitting" ? "Submitting…" : "Sign Agreement"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
