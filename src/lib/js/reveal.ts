/*
 * src/lib/js/reveal.ts — the homepage entrance reveals (cinematic
 * direction doc §4.4). Progressive enhancement only: content is fully
 * visible without JS; the pending state is added by JS and replaced by a
 * single one-shot transition when the element enters the viewport.
 * prefers-reduced-motion disables everything (nothing is ever hidden).
 *
 * Safety: the pending class is only ever applied to elements that are still
 * BELOW the fold at init. Content already on screen is never hidden, and the
 * observer fires with a 100px look-ahead margin and a near-zero threshold, so
 * a fast scroll, a full-page snapshot or a slow observer callback can never
 * strand a card at opacity 0.
 */

/** Look-ahead margin: reveal starts ~100px before the card reaches the fold. */
const ROOT_MARGIN = "100px 0px";
/** Any visible sliver counts — 0.12 let tall cards stall while already on screen. */
const THRESHOLD = 0.01;
/** Belt-and-braces: never leave a card transparent if observation fails. */
const FALLBACK_MS = 4000;

export function initReveal(): void {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!("IntersectionObserver" in window)) return;

  const targets = document.querySelectorAll<HTMLElement>("[data-reveal]");
  if (targets.length === 0) return;

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      }
    },
    { threshold: THRESHOLD, rootMargin: ROOT_MARGIN },
  );

  const revealAll = () => {
    for (const el of targets) {
      el.classList.add("is-in");
      io.unobserve(el);
    }
  };
  // Printing (and any full-document snapshot) must never show transparent
  // content: reveal everything when the page goes to print.
  window.addEventListener("beforeprint", revealAll);
  // Defensive: a silently dead observer must not strand a blank page.
  window.setTimeout(revealAll, FALLBACK_MS);

  for (const el of targets) {
    // Never hide what the reader can already see: an element intersecting the
    // viewport at init is revealed outright, and only the below-fold ones get
    // the pending state (still observed, so they fade in on approach).
    const rect = el.getBoundingClientRect();
    const aboveFold = rect.top < window.innerHeight + 100 && rect.bottom > -100;
    if (aboveFold) {
      el.classList.add("is-in");
      continue;
    }
    el.classList.add("reveal-pending");
    io.observe(el);
  }
}
