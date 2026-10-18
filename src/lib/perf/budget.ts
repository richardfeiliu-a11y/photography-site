// src/lib/perf/budget.ts — frozen performance budget config (WP-45).
//
// Authority: research/production-architecture/PERFORMANCE_BUDGET.md sections
// 2 (STANDARD WEB TARGET) and 3 (PROJECT ENGINEERING BUDGET). Values must
// match the frozen document exactly (guarded by
// tests/unit/perf-budget-config.test.ts). Section 3 values are aspirational:
// they guide implementation and measurement but are not CI gates.

/** STANDARD WEB TARGET (budget section 2): lab-enforced from P7. */
export const FROZEN_WEB_VITALS = {
  lcpMs: 2500,
  lcpScope: ["home-hero", "gallery-first-photo", "archive-first-card"] as ReadonlyArray<string>,
  cls: 0.1,
  clsScope: "all-pages",
  inpMs: 200,
  inpScope: ["overview-toggle", "menu-toggle", "overview-jump"] as ReadonlyArray<string>,
} as const;

/** PROJECT ENGINEERING BUDGET (budget section 3): aspirational. */
export const ENGINEERING_BUDGETS = {
  jsGzipBytes: 20 * 1024,
  cssGzipBytes: 40 * 1024,
  galleryMemoryMB: 200,
  buildIncrementalSecs: 10,
  buildFullSecs: 60,
} as const;

/** Lab probe pages: every LCP role plus the CJK case. */
export interface ProbePage {
  path: string;
  role: string;
}

/**
 * SESSION TRANSFER BUDGET (D6, 2026-09-15 — owner-authorized gate).
 *
 * A COLD SESSION is the representative first visit: Home + one gallery page +
 * one place page. `scripts/perf/measure.mjs` measures every page in a FRESH
 * browser context (no shared cache), so summing the three per-page payloads is
 * a CONSERVATIVE upper bound — a real session downloads the fonts and the CSS
 * bundle once, while this accounting counts them once per page.
 *
 * The gate uses the WORST gallery and place page in the record (not an average),
 * so growth in any single page is caught instead of diluted.
 *
 * Targets are the measured worst case plus ~11% headroom, from the promoted
 * 2026-09-15 record:
 *   desktop      1,836 KB measured  ->  2,048 KB (2 MiB)
 *   mobileLowEnd   924 KB measured  ->  1,024 KB (1 MiB)
 *
 * Authority note: this is a PROJECT budget authorized by the owner (plan
 * `plan-r4-round3-reconciliation-2026-09-14.md` decision D6), recorded in
 * `docs/implementation/decisions/PERFORMANCE-BASELINE.md`. The frozen research
 * document (PERFORMANCE_BUDGET.md) is NOT modified by this addition.
 */
export const SESSION_BUDGET = {
  /** Pages composing one measured cold session. */
  pagesPerSession: 3,
  desktopBytes: 2048 * 1024,
  mobileLowEndBytes: 1024 * 1024,
} as const;

export const PROBE_PAGES: ReadonlyArray<ProbePage> = [
  { path: "/", role: "home-hero" },
  { path: "/archive", role: "archive-first-card" },
  { path: "/places", role: "static" },
  { path: "/about", role: "static" },
  { path: "/galleries/lofoten-light", role: "gallery-first-photo" },
  { path: "/galleries/tengwang-pavilion", role: "gallery-cjk-title" },
  { path: "/places/reine", role: "place-card" },
];
