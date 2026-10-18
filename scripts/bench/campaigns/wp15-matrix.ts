// WP-15 campaign matrix — FROZEN for this benchmark run (mechanical scope
// only: NO decision is made by these choices; every value here is either
// given by the WP-15 task brief or grounded in the cited research sections,
// and all of D1–D7 stay OPEN pending human visual-quality review).
//
// Grounding:
//   - PERFORMANCE_BUDGET §4.1/§6.3 + §4.2/§4.3: widths, qualities and formats
//     are BENCHMARK REQUIRED values — benchmark candidates, not baselines.
//   - IMAGE_PIPELINE §12: responsive width steps / overview ceiling / cover
//     dimensions / quality values / format selection are deferred to exactly
//     this kind of measurement.
//   - FINAL_DESIGN_SPECIFICATION: media frame min(90vw, 1440px); reading
//     column 680px; hero 75svh (no crop, aspect preserved) — these bound the
//     consumption model below, they do not decide it.

/** The 17-photo core stress set (REAL_PHOTO_FIXTURE_MANIFEST.md §2). */
export const CORE17: readonly string[] = [
  "DSC02071.jpg",
  "DSC02066.jpg",
  "DSC02055.jpg",
  "DSC01889.jpg",
  "DSC02327.jpg",
  "DSC02466.jpg",
  "DSC02560.jpg",
  "DSC01832.jpg",
  "DSC02367.jpg",
  "DSC02762.jpg",
  "DSC01836.jpg",
  "DSC02416.jpg",
  "DSC02851.jpg",
  "DSC01935.jpg",
  "DSC02020.jpg",
  "DSC02233.jpg",
  "DSC02339.jpg",
] as const;

/** Manifest §2 visual statistics per core-17 photo (L = mean luma, S = mean
 *  saturation, C = contrast) — used for the per-fixture extremes table. */
export const MANIFEST_STATS: Readonly<Record<string, { l: number; s: number; c: number; note: string }>> = {
  "DSC02071.jpg": { l: 179.1, s: 30.2, c: 55.6, note: "brightest frame in archive" },
  "DSC02066.jpg": { l: 168.4, s: 28.0, c: 32.6, note: "near-neutral high-key" },
  "DSC02055.jpg": { l: 159.0, s: 27.4, c: 70.2, note: "most neutral frame measured" },
  "DSC01889.jpg": { l: 25.3, s: 192.6, c: 50.3, note: "darkest frame, saturated" },
  "DSC02327.jpg": { l: 46.7, s: 49.1, c: 35.0, note: "near-neutral dark" },
  "DSC02466.jpg": { l: 95.9, s: 69.3, c: 27.0, note: "flat tonal range" },
  "DSC02560.jpg": { l: 93.6, s: 245.9, c: 46.6, note: "most saturated frame" },
  "DSC01832.jpg": { l: 72.6, s: 173.0, c: 60.3, note: "red lanterns, dense" },
  "DSC02367.jpg": { l: 138.9, s: 96.2, c: 60.3, note: "ordinary wide frame (baseline)" },
  "DSC02762.jpg": { l: 122.9, s: 118.9, c: 60.2, note: "ordinary wide frame" },
  "DSC01836.jpg": { l: 126.4, s: 93.0, c: 60.6, note: "ordinary wide frame" },
  "DSC02416.jpg": { l: 148.6, s: 92.9, c: 68.7, note: "bright portrait" },
  "DSC02851.jpg": { l: 136.6, s: 84.1, c: 62.7, note: "quiet portrait" },
  "DSC01935.jpg": { l: 74.8, s: 85.9, c: 57.2, note: "detail throughout (primary dense)" },
  "DSC02020.jpg": { l: 96.7, s: 56.3, c: 54.6, note: "detail throughout" },
  "DSC02233.jpg": { l: 141.2, s: 104.2, c: 52.0, note: "large negative space" },
  "DSC02339.jpg": { l: 151.2, s: 75.6, c: 51.3, note: "large negative space" },
} as const;

export type Purpose = "gallery_display" | "overview" | "cover";

/** Width candidates per purpose (WP-15 brief; bounded overnight matrix). */
export const PURPOSE_WIDTHS: Readonly<Record<Purpose, readonly number[]>> = {
  gallery_display: [480, 800, 1024, 1280, 1600],
  overview: [240, 320, 480],
  cover: [1280, 1600, 2048],
} as const;

/** Per-format quality candidates (WP-15 brief). */
export const QUALITIES: Readonly<Record<"jpeg" | "webp" | "avif", readonly number[]>> = {
  jpeg: [65, 75, 85],
  webp: [60, 70, 80],
  avif: [45, 55, 65],
} as const;

/**
 * DPR consumption model — COMPUTED, not encoded (D6 stays OPEN). Each purpose
 * has consumption contexts grounded in FINAL_DESIGN_SPECIFICATION layout
 * bounds; for each scenario the served derivative is the SMALLEST ladder
 * width ≥ the required device-pixel width. "Capped" scenarios exceed both the
 * ladder and the 2048/1365 source maximum; the largest available width is
 * named and the shortfall recorded honestly (no upscaling exists in the
 * pipeline: withoutEnlargement).
 */
export interface DprScenario {
  scenario: string;
  purpose: Purpose;
  /** CSS px consumption context. */
  context: string;
  cssPx: number;
  dpr: number;
  /** Required device-pixel width = cssPx * dpr. */
  requiredPx: number;
  /** Ladder width actually served (smallest ≥ requiredPx), or the cap. */
  servedPx: number | null;
  /** Null = served from the ladder; string = why capped/unserved. */
  capNote: string | null;
}

const pick = (ladder: readonly number[], required: number): number | null =>
  ladder.find((w) => w >= required) ?? null;

export function buildDprScenarios(sourceMaxWidth: number): DprScenario[] {
  const scenarios: DprScenario[] = [];
  const push = (s: DprScenario) => scenarios.push(s);

  // gallery_display: reading column 680 CSS px; media frame min(90vw, 1440px).
  for (const [label, css, dpr] of [["G-1x-column", 680, 1], ["G-2x-column", 680, 2], ["G-1x-frame", 1440, 1], ["G-2x-frame", 1440, 2]] as const) {
    const required = css * dpr;
    const served = pick(PURPOSE_WIDTHS.gallery_display, required);
    push({
      scenario: label, purpose: "gallery_display",
      context: label.includes("frame") ? "media frame min(90vw, 1440px)" : "reading column 680px",
      cssPx: css, dpr, requiredPx: required,
      servedPx: served, capNote: served === null ? "exceeds gallery ladder (max 1600) AND source width" : null,
    });
  }
  // overview: thumbnail/card consumption context 240 CSS px (ladder minimum;
  // the Overview grid cell width is itself a benchmark output — model only).
  for (const [label, css, dpr] of [["O-1x", 240, 1], ["O-2x", 240, 2]] as const) {
    const required = css * dpr;
    push({
      scenario: label, purpose: "overview", context: "overview/card cell ~240px (model)",
      cssPx: css, dpr, requiredPx: required,
      servedPx: pick(PURPOSE_WIDTHS.overview, required), capNote: null,
    });
  }
  // cover: displayed at the media frame min(90vw, 1440px), aspect preserved
  // (no crop; hero 75svh is a height ceiling that the frame width already bounds).
  for (const [label, css, dpr] of [["C-1x", 1440, 1], ["C-2x", 1440, 2]] as const) {
    const required = css * dpr;
    const served = pick(PURPOSE_WIDTHS.cover, required);
    push({
      scenario: label, purpose: "cover", context: "media frame min(90vw, 1440px), aspect preserved",
      cssPx: css, dpr, requiredPx: required,
      servedPx: served ?? sourceMaxWidth,
      capNote: served === null
        ? `exceeds cover ladder (max 2048) — capped at source width ${sourceMaxWidth}px (portrait sources cap lower: 1365px)`
        : null,
    });
  }
  return scenarios;
}

/** Extreme fixtures named by the WP-15 brief for the extra quality-sweep crops. */
export const EXTREME_FIXTURES: readonly string[] = [
  "DSC01889.jpg", // dark
  "DSC01935.jpg", // dense
  "DSC02560.jpg", // saturated
  "DSC02071.jpg", // bright
] as const;

export interface CampaignCandidate {
  purpose: Purpose;
  requestedWidth: number;
  format: "jpeg" | "webp" | "avif";
  quality: number;
}

/** Full candidate list: 17 fixtures × 11 widths × 9 (format,quality) = 1683. */
export function buildCampaignCandidates(): CampaignCandidate[] {
  const out: CampaignCandidate[] = [];
  for (const purpose of Object.keys(PURPOSE_WIDTHS) as Purpose[]) {
    for (const width of PURPOSE_WIDTHS[purpose]) {
      for (const format of Object.keys(QUALITIES) as Array<keyof typeof QUALITIES>) {
        for (const quality of QUALITIES[format]) {
          out.push({ purpose, requestedWidth: width, format, quality });
        }
      }
    }
  }
  return out;
}

/**
 * Overnight-reduction option (brief step 8): drop gallery 1600 and cover 2048
 * for NON-extreme fixtures only. Only used if runtime threatens the ~45 min
 * budget; the choice is recorded in the results JSON.
 */
export function isReducedCandidate(c: CampaignCandidate, fixture: string): boolean {
  if (EXTREME_FIXTURES.includes(fixture)) return false;
  return (c.purpose === "gallery_display" && c.requestedWidth === 1600) ||
    (c.purpose === "cover" && c.requestedWidth === 2048);
}
