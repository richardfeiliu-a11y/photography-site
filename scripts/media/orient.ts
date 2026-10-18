// WP-18 — orientation normalizer (IMAGE_PIPELINE.md §5 stage 3: NORMALIZE
// ORIENTATION).
//
// Authority:
//   - IMAGE_PIPELINE.md §5 stage 3 + "Stage ordering invariants": apply EXIF
//     orientation to pixel data so the image is upright in its decoded form,
//     and do it BEFORE any resize ("orientation must be normalized before
//     resize").
//   - TESTING_AND_VISUAL_REGRESSION.md §5: "Output derivatives have correct
//     visual orientation regardless of source EXIF orientation tag. The
//     pipeline applies auto-rotate before derivation."
//   - TECHNICAL_API_VERIFICATION.md §2: `rotate()` is the verified API. Sharp
//     auto-applies the EXIF orientation tag ONLY when `.rotate()` is called
//     (with no argument); the tag itself is dropped from the output by
//     sharp's default metadata handling — so the derivative is upright AND
//     carries no residual orientation tag.
//
// This module is the SINGLE CHOKE POINT for orientation normalization:
// WP-19 (color transform), WP-20 (derivative generation) and WP-21 (privacy
// pass) must start their pixel pipelines from `orientedPipeline(source)` so
// that every downstream stage sees upright pixels. The pipeline returned here
// performs NO resize and NO encoding — those are stages 4–5, downstream.
import sharp from "sharp";

/** The sharp pipeline type (namespace import avoided under strip-types). */
type SharpPipeline = ReturnType<typeof sharp>;

/**
 * ORIENTATION_NOTE documents the normalization contract (pinned by tests):
 * extraction reads the RAW tag (scripts/media/extract.ts); normalization
 * bakes it into pixels here; nothing downstream may re-apply or need it.
 */
export const ORIENTATION_NOTE =
  "Orientation normalization = sharp .rotate() with no argument: the EXIF " +
  "orientation tag is applied to the pixels exactly once and the tag is not " +
  "carried into the output. Runs after metadata extraction (stage 2) and " +
  "before color/resize/encode (stages 4–5) — IMAGE_PIPELINE §5 stages 3.";

/**
 * Stage-3 pipeline: a sharp instance with EXIF orientation normalized into
 * pixels. Accepts a filesystem path or an in-memory Buffer (pipeline
 * intermediates). Does NOT resize and does NOT encode — compose those via
 * the stage-order guard (scripts/media/stage-order.ts) downstream.
 */
export function orientedPipeline(source: string | Buffer): SharpPipeline {
  return sharp(source).rotate();
}
