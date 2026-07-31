import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { toast, Toaster } from "sonner";
import { CheckCircle2, ShieldCheck, Camera, MapPin, AlertTriangle, RotateCcw, Download, Loader2 } from "lucide-react";
import { fetchAgreementByToken, submitAgreementSignature, uploadPublicSignaturePhoto } from "@/services/agreementService";
import { AgreementDocumentPages } from "@/components/shared/AgreementDocument";
import { downloadAgreementPdf } from "@/utils/pdfExport";

export default function PublicSignAgreementPage() {
  const { token } = useParams();
  const [agreement, setAgreement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [step, setStep] = useState("view"); // view | form | submitting | done
  const [downloading, setDownloading] = useState(false);
  const [nameEdited, setNameEdited] = useState(false);

  const [name, setName] = useState("");
  const [selfie, setSelfie] = useState(null);
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [locStatus, setLocStatus] = useState("idle");
  const [cameraOn, setCameraOn] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const padCanvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPtRef = useRef(null);
  const docRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const row = await fetchAgreementByToken(token);
      if (!row) { setError("Invalid or expired link."); return; }
      setAgreement(row);
      if (!nameEdited && row.merge_data?.client_name) setName(row.merge_data.client_name);
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
  // Location is mandatory — ask for it the moment the person reaches the signing form.
  useEffect(() => {
    if (step === "form" && locStatus === "idle") requestLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      setCameraOn(true);
    } catch {
      toast.error("Camera access is required to sign — please allow camera permission and try again");
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

  const getPoint = (e) => {
    const c = padCanvasRef.current;
    const rect = c.getBoundingClientRect();
    const scaleX = c.width / rect.width;
    const scaleY = c.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };
  const padPointerDown = (e) => {
    e.preventDefault();
    const c = padCanvasRef.current;
    c.setPointerCapture?.(e.pointerId);
    drawingRef.current = true;
    lastPtRef.current = getPoint(e);
  };
  const padPointerMove = (e) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const ctx = padCanvasRef.current.getContext("2d");
    const pt = getPoint(e);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(lastPtRef.current.x, lastPtRef.current.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    lastPtRef.current = pt;
    setHasSignature(true);
  };
  const padPointerUp = () => { drawingRef.current = false; };
  const clearSignaturePad = () => {
    const c = padCanvasRef.current;
    c?.getContext("2d").clearRect(0, 0, c.width, c.height);
    setHasSignature(false);
  };

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
    if (!hasSignature) { toast.error("Please sign in the signature box"); return; }
    if (!selfie) { toast.error("A photo is required to sign — please take a selfie"); return; }
    if (locStatus !== "ok") { toast.error("Location is required to sign — please allow location access"); requestLocation(); return; }
    setStep("submitting");
    try {
      const up = await uploadPublicSignaturePhoto(selfie.blob);
      const signatureUrl = up.url;
      let signaturePadUrl = null;
      const padBlob = await new Promise((resolve) => padCanvasRef.current.toBlob(resolve, "image/png"));
      if (padBlob) {
        const upPad = await uploadPublicSignaturePhoto(padBlob, "agreements/signature-pads", "png", "image/png");
        signaturePadUrl = upPad.url;
      }
      let ip = null;
      try { const r = await fetch("https://api.ipify.org?format=json"); ip = (await r.json()).ip; } catch {}
      const updated = await submitAgreementSignature({
        token, signerName: name.trim(), signatureUrl, signaturePadUrl, lat, lng, accuracy, ip, userAgent: navigator.userAgent,
      });
      setAgreement(updated);
      setStep("done");
      toast.success("Agreement signed — thank you!");
    } catch (e) { toast.error(e.message); setStep("form"); }
  };

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const filename = `${(agreement.title || "Agreement").replace(/[^\w\- ]/g, "")}-${agreement.id.slice(0, 8).toUpperCase()}.pdf`;
      await downloadAgreementPdf(docRef.current, filename);
    } catch (e) { toast.error("Couldn't generate PDF: " + e.message); }
    finally { setDownloading(false); }
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

  // ---- Signed: show the full styled document + a real downloadable PDF ----
  if (step === "done") {
    return (
      <div className="min-h-screen bg-slate-50 py-8 px-4">
        <Toaster position="top-center" />
        <div className="max-w-2xl mx-auto text-center mb-6">
          <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500 mb-2" />
          <div className="font-semibold text-slate-900 text-lg">Signed successfully</div>
          <div className="text-sm text-slate-500 mt-1">By {agreement.signer_name} on {new Date(agreement.signed_at).toLocaleString("en-IN")}</div>
          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 mt-2 mb-4"><ShieldCheck className="w-3.5 h-3.5" /> This record is securely stored by Sankalp Interior Solution</div>
          <button
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="px-6 py-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold inline-flex items-center gap-2 disabled:opacity-60"
            data-testid="sign-download-pdf-button"
          >
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {downloading ? "Preparing your PDF…" : "Download Signed Agreement (PDF)"}
          </button>
        </div>
        <div className="overflow-x-auto pb-8">
          <div style={{ transform: "scale(0.42)", transformOrigin: "top center", marginBottom: "-58%" }}>
            <div ref={docRef}>
              <AgreementDocumentPages agreement={agreement} resolvedClauses={clauses} md={md} />
            </div>
          </div>
        </div>
      </div>
    );
  }

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

          {step === "view" ? (
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
                  onChange={(e) => { setName(e.target.value); setNameEdited(true); }}
                  placeholder="Type your full legal name"
                  data-testid="sign-name-input"
                />
              </div>

              <div>
                <button onClick={requestLocation} className={`text-xs inline-flex items-center gap-1.5 hover:underline ${locStatus === "ok" ? "text-emerald-600" : locStatus === "error" ? "text-rose-600" : "text-blue-700"}`}>
                  <MapPin className="w-3.5 h-3.5" />
                  {locStatus === "ok" ? "Location captured ✓" : locStatus === "error" ? "Location required — tap to allow, or check your browser's location permission" : locStatus === "requesting" ? "Requesting location…" : "Location required — tap to allow"}
                </button>
              </div>

              <div>
                <label className="text-xs text-slate-500 font-medium mb-1 block">Sign here with your finger or mouse</label>
                <div className="relative border-2 border-slate-300 rounded-lg overflow-hidden bg-white">
                  <canvas
                    ref={padCanvasRef}
                    width={600}
                    height={180}
                    className="w-full touch-none"
                    style={{ height: 140 }}
                    onPointerDown={padPointerDown}
                    onPointerMove={padPointerMove}
                    onPointerUp={padPointerUp}
                    onPointerLeave={padPointerUp}
                    data-testid="signature-pad-canvas"
                  />
                  {!hasSignature && (
                    <div className="absolute inset-0 grid place-items-center pointer-events-none text-slate-300 text-sm">
                      Draw your signature here
                    </div>
                  )}
                </div>
                {hasSignature && (
                  <button onClick={clearSignaturePad} className="mt-1.5 text-xs text-slate-500 hover:underline inline-flex items-center gap-1">
                    <RotateCcw className="w-3 h-3" /> Clear and redo
                  </button>
                )}
              </div>

              <div>
                {selfie ? (
                  <div className="flex items-center gap-3">
                    <img src={selfie.url} alt="" className="h-16 w-16 rounded-lg object-cover border border-slate-200" />
                    <span className="text-xs text-emerald-600">Photo captured ✓</span>
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
                  <button onClick={startCamera} className="px-4 py-2 border-2 border-slate-300 rounded-lg text-sm inline-flex items-center gap-2 hover:bg-slate-50" data-testid="sign-selfie-button">
                    <Camera className="w-4 h-4" /> Take a photo (required)
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
