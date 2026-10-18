// WP-06 capture state list — the states captured by `npm run capture`.
//
// IMP-05 (final targeted correction): every state declares an EXPLICIT
// capture group and baseline group — shared stale dist/ state must never
// determine capture semantics (BUILD_AND_ROUTING §6 / ADR-020):
//   group "production" → captured against a FRESH PRODUCTION build
//     (`npm run build`): the production route table only.
//   group "preview"    → captured against a FRESH PREVIEW build
//     (`npm run build:preview`): draft routes present. Used ONLY by the
//     WP-38 stress-set draft gallery (long-gallery-72); existing production
//     baseline semantics are NOT converted to preview for it (§11).
//
// baselineGroup names the governed baseline directory under tests/baselines/
// (each group keeps its own manifest.json — see tests/baselines/README.md).
//
// `expect` is the fail-closed semantic gate (IMP-05 §12): before any
// screenshot the runner requires a 2xx response, the required selector, the
// exact page heading, and (where declared) an exact figure count and rendered
// media. A failed gate exits nonzero, writes no screenshot, and prints no
// "captured". Gates are deliberately minimal: page-identity assertions that
// reject wrong-page/404 captures — no more.
//
// `overviewTrigger` remains a supported gate field (tests/capture/gates.mjs)
// but no state declares it since the Overview (Contact Sheet) was pruned
// (2026-10-18, owner-approved — plan §5). Same for the `annotation` gate: its
// former consumer state (`gallery-mobile-caption`) was replaced by
// `gallery-mobile-plate` when the floating position annotation was removed.
import {
  DESKTOP_1280_VIEWPORT,
  DESKTOP_VIEWPORT,
  MOBILE_VIEWPORT,
} from "../support/viewports.mjs";

const VIEWPORTS = {
  desktop: DESKTOP_VIEWPORT,
  desktop1280: DESKTOP_1280_VIEWPORT,
  mobile: MOBILE_VIEWPORT,
};

/** Frozen viewport presets by name (§8.1). */
export const VIEWPORT_PRESETS = VIEWPORTS;

/** Governed baseline group directory names under tests/baselines/. */
export const BASELINE_GROUPS = ["discovery", "gallery", "preview"];

/**
 * @typedef {Object} CaptureState
 * @property {string} id Stable state id (directory name under tests/captures/).
 * @property {string} path Site path to capture.
 * @property {keyof typeof VIEWPORTS} viewport Frozen viewport preset name.
 * @property {boolean} [fullPage] Capture full scrollable page (default false).
 * @property {"production"|"preview"} group Capture build mode (explicit, §11).
 * @property {string} baselineGroup Governed baseline dir under tests/baselines/.
 * @property {{selector: string, heading?: string, figures?: number, overviewTrigger?: boolean}} expect Fail-closed page-identity gate.
 */

/** @type {CaptureState[]} */
export const CAPTURE_STATES = [
  // WP-32 discovery baselines (§8.3 discovery states) — PRODUCTION semantics.
  {
    id: "home-desktop",
    path: "/",
    viewport: "desktop",
    fullPage: true,
    group: "production",
    baselineGroup: "discovery",
    expect: { selector: ".home-cover-img", heading: "Lofoten, Polar Night" },
  },
  {
    id: "home-mobile",
    path: "/",
    viewport: "mobile",
    fullPage: true,
    group: "production",
    baselineGroup: "discovery",
    expect: { selector: ".home-cover-img", heading: "Lofoten, Polar Night" },
  },
  {
    id: "archive-desktop",
    path: "/archive",
    viewport: "desktop",
    fullPage: true,
    group: "production",
    baselineGroup: "discovery",
    // 2026-10-18: `.gallery-card` → `.arow`. The immersive archive is a flat
    // row list (the card grid left with the port), so the stale selector made
    // this gate refuse EVERY production capture run (verified:
    // "required selector .gallery-card not found — refusing to capture state
    // archive-desktop"). Same page-identity intent: /archive must render the
    // catalogue under the "Journeys" heading.
    expect: { selector: ".arow", heading: "Journeys" },
  },
  {
    id: "places-index-desktop",
    path: "/places",
    viewport: "desktop",
    fullPage: true,
    group: "production",
    baselineGroup: "discovery",
    expect: { selector: ".place-atlas-card", heading: "Places" },
  },
  {
    id: "place-detail-desktop",
    path: "/places/lofoten",
    viewport: "desktop",
    fullPage: true,
    group: "production",
    baselineGroup: "discovery",
    expect: { selector: "[data-place-context]", heading: "Lofoten" },
  },
  {
    id: "about-desktop",
    path: "/about",
    viewport: "desktop",
    fullPage: true,
    group: "production",
    baselineGroup: "discovery",
    expect: { selector: ".about-body", heading: "About" },
  },
  // WP-38 Gallery baselines (§8.3 gallery states; the frozen state list) —
  // PRODUCTION semantics (published galleries).
  {
    id: "gallery-desktop-base",
    path: "/galleries/lofoten-polar-night",
    viewport: "desktop",
    fullPage: true,
    group: "production",
    baselineGroup: "gallery",
    expect: { selector: ".gallery-figure", heading: "Lofoten, Polar Night" },
  },
  // Breathing state: a DISTINCT page whose fullPage sequence is dominated by
  // the breathing cadence (the original same-URL duplicate of the base state
  // was vacuous — P5 integration review Finding 3; the lofoten breathing
  // positions remain e2e-measured in gallery-rhythm.spec.ts).
  {
    id: "gallery-desktop-breathing",
    path: "/galleries/winter-europe",
    viewport: "desktop",
    fullPage: true,
    group: "production",
    baselineGroup: "gallery",
    expect: { selector: ".gallery-figure", heading: "Rhine, Lowlands and London" },
  },
  {
    id: "gallery-desktop-ending",
    path: "/galleries/autumn-china",
    viewport: "desktop",
    fullPage: true,
    group: "production",
    baselineGroup: "gallery",
    expect: { selector: ".gallery-figure", heading: "Autumn in China" },
  },
  {
    id: "gallery-desktop-no-next",
    path: "/galleries/bavaria-konigssee",
    viewport: "desktop",
    fullPage: true,
    group: "production",
    baselineGroup: "gallery",
    expect: { selector: ".gallery-figure", heading: "Bavaria: Königssee and Neuschwanstein" },
  },
  // WP-38 status replacement (2026-10-18, owner-approved — plan §5): the
  // former `gallery-mobile-caption` state depicted the VISIBLE position
  // annotation at a captioned reading position. The immersive direction
  // PRUNED the floating PositionAnnotation (the reader's location now lives
  // in the viewer's own top-bar counter), so the state's subject no longer
  // exists and it was removed rather than re-pointed.
  //
  // `gallery-mobile-plate` is its successor: the mobile UNIFIED PLATE measure
  // with its mono caption line — the 3rd figure (a captioned, portrait plate)
  // is scrolled into view and the state gates on the page identity, then
  // captures the VIEWPORT (the plate + caption are what the direction's
  // mobile reading position looks like). The historical full-page states
  // cannot depict it: at fullPage the mobile screenshot stitches the whole
  // 11-plate sequence and no single reading position is legible in the
  // governed image.
  {
    id: "gallery-mobile-plate",
    path: "/galleries/lofoten-polar-night",
    viewport: "mobile",
    fullPage: false,
    group: "production",
    baselineGroup: "gallery",
    expect: { selector: ".gallery-figure", heading: "Lofoten, Polar Night" },
    setup: { scrollFigureIndex: 2 },
  },
  {
    id: "gallery-desktop-landscape",
    path: "/galleries/south-china-summer",
    viewport: "desktop",
    fullPage: true,
    group: "production",
    baselineGroup: "gallery",
    expect: { selector: ".gallery-figure", heading: "South China, Summer" },
  },
  {
    id: "gallery-desktop-portrait",
    path: "/galleries/iceland",
    viewport: "desktop",
    fullPage: true,
    group: "production",
    baselineGroup: "gallery",
    expect: { selector: ".gallery-figure", heading: "Iceland" },
  },
  // IMP-05 / WP-38 — the long-gallery stress baseline. The former WP-08
  // synthetic 72-photo DRAFT gallery was retired with the 2026-09-12
  // real-archive swap (the real archive is published-only), so this state now
  // targets the LARGEST REAL published gallery (Netherlands, 28 frames). It
  // keeps the WP-38 guarantees that matter — long-sequence rendering, exact
  // figure count, and RENDERED (non-skeleton) media — while no longer
  // requiring a synthetic draft route.
  //
  // 2026-10-18 (owner-approved — plan §5): the `overviewTrigger` expectation
  // was REMOVED with the Overview (Contact Sheet) pruning. `figures: 28` and
  // `renderedMedia` are unchanged, so the state still refuses a partial or
  // skeleton long sequence.
  //
  // Group note: the runner still captures this in a dedicated group that
  // builds the canonical production artifact (there is no draft route left to
  // capture against preview semantics).
  {
    id: "gallery-desktop-long-72",
    path: "/galleries/netherlands",
    viewport: "desktop",
    fullPage: true,
    group: "preview",
    baselineGroup: "preview",
    expect: {
      selector: ".gallery-figure",
      heading: "Netherlands",
      figures: 28,
      renderedMedia: true,
    },
  },
  // WP-06 placeholder-era states removed: the placeholder page left with WP-28.
];

// REDESIGN_CAPTURE_STATES retired 2026-09-19 (repo simplification Batch 04);
// snapshot: docs/archive/redesign-capture-states-SNAPSHOT-2026-09-19.mjs.txt
