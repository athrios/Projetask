/**
 * Global delegated mousemove tracker. Any element with the
 * `.spotlight` or `.spotlight-sm` class will have its
 * --spotlight-x / --spotlight-y CSS vars updated to follow the
 * cursor while it hovers. Zero per-element setup required.
 */
let rafId: number | null = null;
let lastEvent: MouseEvent | null = null;

function flush() {
  rafId = null;
  const e = lastEvent;
  if (!e) return;
  const target = (e.target as Element | null)?.closest?.(".spotlight, .spotlight-sm") as
    | HTMLElement
    | null;
  if (!target) return;
  const rect = target.getBoundingClientRect();
  target.style.setProperty("--spotlight-x", `${e.clientX - rect.left}px`);
  target.style.setProperty("--spotlight-y", `${e.clientY - rect.top}px`);
}

function onMove(e: MouseEvent) {
  lastEvent = e;
  if (rafId != null) return;
  rafId = requestAnimationFrame(flush);
}

export function initSpotlightTracker() {
  if (typeof window === "undefined") return;
  if ((window as unknown as { __spotlightInit?: boolean }).__spotlightInit) return;
  (window as unknown as { __spotlightInit?: boolean }).__spotlightInit = true;
  window.addEventListener("mousemove", onMove, { passive: true });
}
