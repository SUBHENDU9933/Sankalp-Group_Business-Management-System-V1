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

let unlocked = false;
// Browsers block AudioContext playback unless it starts from (or was already
// resumed by) a real user gesture — a chime fired later from a realtime
// event, with no click at that exact moment, gets silently blocked.
// Call this once, anywhere, on the very first click/touch in the app —
// it "primes" the context so later programmatic chimes actually play.
export const unlockAudioOnFirstInteraction = () => {
  if (unlocked) return;
  const unlock = () => {
    const audioCtx = getCtx();
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    unlocked = true;
    document.removeEventListener("click", unlock);
    document.removeEventListener("touchstart", unlock);
    document.removeEventListener("keydown", unlock);
  };
  document.addEventListener("click", unlock);
  document.addEventListener("touchstart", unlock);
  document.addEventListener("keydown", unlock);
};
// Urgent "hooter/siren" alert — sweeps between two pitches rapidly, like a
// classic emergency siren — used for the pending-task reminder popups so
// they're impossible to mistake for a routine notification.
export const playEmergencySiren = async () => {
  const audioCtx = getCtx();
  if (!audioCtx) return;
  // Mobile browsers auto-suspend the AudioContext when a tab is backgrounded
  // or the screen locks — if that happened since the last play, scheduling
  // sound immediately (without waiting for resume() to actually finish)
  // silently drops the sound. Wait for it here before scheduling anything.
  if (audioCtx.state === "suspended") {
    try { await audioCtx.resume(); } catch { return; }
  }
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sawtooth";
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  const t0 = audioCtx.currentTime;
  const duration = 1.8;
  const sweepMs = 0.28; // time for one up/down cycle
  osc.frequency.setValueAtTime(500, t0);
  for (let t = 0; t < duration; t += sweepMs * 2) {
    osc.frequency.linearRampToValueAtTime(900, t0 + t + sweepMs);
    osc.frequency.linearRampToValueAtTime(500, t0 + t + sweepMs * 2);
  }
  gain.gain.setValueAtTime(0.09, t0);
  gain.gain.setValueAtTime(0.09, t0 + duration - 0.1);
  gain.gain.linearRampToValueAtTime(0.0001, t0 + duration);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
};

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
