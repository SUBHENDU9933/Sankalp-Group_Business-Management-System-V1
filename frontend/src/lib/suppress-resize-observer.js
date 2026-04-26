// Suppress benign "ResizeObserver loop" warnings from Radix UI primitives.
// Without this, react-error-overlay (CRA dev mode) renders a full-page modal
// that blocks all interactions whenever a Select / Dropdown opens.
const RO_LOOP_RE = /ResizeObserver loop (limit exceeded|completed with undelivered notifications)/;

window.addEventListener(
  "error",
  (e) => {
    if (e?.message && RO_LOOP_RE.test(e.message)) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  },
  true
);

window.addEventListener(
  "unhandledrejection",
  (e) => {
    const msg = e?.reason?.message || String(e?.reason || "");
    if (RO_LOOP_RE.test(msg)) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  },
  true
);

// Also silence the matching console.error so CRA's overlay does not pick it up.
const _origConsoleError = window.console.error;
window.console.error = function (...args) {
  const first = args[0];
  if (typeof first === "string" && RO_LOOP_RE.test(first)) return;
  if (first instanceof Error && RO_LOOP_RE.test(first.message)) return;
  _origConsoleError.apply(window.console, args);
};
