/**
 * src/lib/js/media-slots.ts — progressive hydration for below-the-fold
 * gallery media (R4 perf rework).
 *
 * WHY: Chromium's native lazy-loading preload distance scales with the
 * effective connection type (~12,500px on "fast" profiles). The Gallery
 * media frame is ~797–894px tall, so on a 28-photo route the browser
 * dispatched ~16 full-size w1600 candidates during initial load. At the
 * harness 1.6Mbps throttle those transfers contended with the LCP image and
 * pushed /galleries/netherlands desktop LCP to ~3.3s (measured 2026-09-13).
 *
 * HOW: the server renders each non-first photo as an aspect-ratio-reserved
 * <span data-media-slot> plus the real <picture> inside <noscript>. With JS
 * the picture is inert (noscript content is never fetched); this module
 * injects it only when the slot gets within ROOT_MARGIN of the viewport —
 * roughly one screen of look-ahead instead of fourteen. A failsafe
 * hydrates everything after FALLBACK_MS (defensive; print has its own hook),
 * and environments without IntersectionObserver hydrate immediately.
 *
 * No-JS visitors and crawlers without script execution get the plain
 * <noscript> pictures; the reserved slot prevents cumulative layout shift.
 */

declare global {
  interface Window {
    /** Test/debug hook: hydrate every slot at once (idempotent). */
    __hydrateMediaSlots?: () => void;
  }
}

const SLOT_ATTR = "data-media-slot";
const ROOT_MARGIN = "600px 0px";
const FALLBACK_MS = 8000;

export function initMediaSlots(): void {
  const slots = Array.from(document.querySelectorAll<HTMLSpanElement>(`[${SLOT_ATTR}]`));
  if (slots.length === 0) return;

  const fill = (slot: HTMLElement): void => {
    if (slot.dataset.mediaReady === "1") return;
    const holderId = slot.getAttribute(SLOT_ATTR);
    const holder = holderId ? document.getElementById(holderId) : null;
    const markup = holder?.textContent;
    if (!markup) return;
    const template = document.createElement("template");
    template.innerHTML = markup;
    // T3: the <noscript> picture is the slot's own no-JS fallback (nested
    // inside the slot since R4 round4) — it never renders in a JS-enabled
    // browser, but leaving it in place would keep a second latent picture in
    // the figure. The live picture replaces it.
    holder?.remove();
    slot.append(template.content);
    // T1: the placeholder box must never hide the real photo it now contains.
    // The slot carries no aria-hidden in the shipped markup; this is the
    // defensive guard for a future markup regression (a aria-hidden/inert
    // ANCESTOR would remove every hydrated <img> from the accessibility tree
    // while leaving DOM counts and axe green).
    slot.removeAttribute("aria-hidden");
    slot.removeAttribute("inert");
    slot.dataset.mediaReady = "1";
  };

  const fillAll = (): void => {
    for (const slot of slots) fill(slot);
  };

  // Deterministic hook for the e2e suite (full-list assertions) and debugging.
  window.__hydrateMediaSlots = fillAll;

  if (!("IntersectionObserver" in window)) {
    fillAll();
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          fill(entry.target as HTMLElement);
          observer.unobserve(entry.target);
        }
      }
    },
    { rootMargin: ROOT_MARGIN },
  );
  for (const slot of slots) observer.observe(slot);

  window.addEventListener("beforeprint", fillAll);
  // Belt-and-braces: never strand a picture if observation silently fails.
  window.setTimeout(fillAll, FALLBACK_MS);
}
