// Generates short, soft notification tones purely in the browser (Web Audio
// API) — no audio file to host, no CORS/loading concerns, works instantly.

let ctx = null;
const getCtx = () => {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
};

const tone = (audioCtx, freq, startTime, duration, gainPeak = 0.12) => {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
};

// Soft two-note "ding" — used for regular pending-reminder nudges.
export const playChime = () => {
  const audioCtx = getCtx();
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  tone(audioCtx, 880, t, 0.28);
  tone(audioCtx, 660, t + 0.14, 0.32);
};

// Slightly fuller three-note tone — reserved for the end-of-day full report,
// so it's distinguishable from the regular nudge without being jarring.
export const playReportChime = () => {
  const audioCtx = getCtx();
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  tone(audioCtx, 523.25, t, 0.22);
  tone(audioCtx, 659.25, t + 0.16, 0.22);
  tone(audioCtx, 783.99, t + 0.32, 0.4);
};
