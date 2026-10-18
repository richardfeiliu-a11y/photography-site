// WP-18 — machine stage-ordering guard for the canonical media pipeline
// (IMAGE_PIPELINE.md §5 "Canonical pipeline stage order" + "Stage ordering
// invariants").
//
// Why this exists: §5's stage order carries correctness dependencies that a
// naive pipeline composition can silently violate:
//   - Metadata needed for color conversion (ICC profile) must not be stripped
//     before conversion (a strip-first path destroys the transform input).
//   - EXIF orientation must be normalized into pixels BEFORE resize (resize
//     assumes upright pixels).
//   - Privacy stripping must occur after color conversion.
//   - Output ICC embedding occurs after stripping (WP-16 CR-01 final-byte
//     order: strip first, then the approved embedding, per the WP-16 decision
//     record's no-source-profile rule).
//   - Hashing must occur after all pixel and metadata transforms (the digest
//     must reflect every prior stage).
//
// The guard is a PURE validator over a stage plan (a sequence of stage names).
// WP-19 (color), WP-20 (derive) and WP-21 (privacy/verify) construct their
// pipeline plans through it, so an order-violating plan fails fast — before
// any pixel is touched — rather than being caught by downstream symptoms.
//
// Enforcement model: the plan's known stages (deduplicated, first occurrence)
// must form a strictly INCREASING SUBSEQUENCE of PIPELINE_STAGES' canonical
// indices — checked in one pass. An increasing subsequence guarantees EVERY
// co-present constrained pair appears in canonical relative order (fix-round
// 1: an earlier hand-listed five-pair table missed e.g.
// normalize-orientation before extract-metadata, letting an adversarial plan
// extract metadata AFTER pixels were already rotated — the raw orientation
// tag must be read before anything consumes it). Partial plans are
// legitimate, so beyond the subsequence check, §5's hard requirements apply
// whenever the dependent stage is present:
//   - color-transform requires extract-metadata (the ICC read must happen)
//   - resize-encode requires normalize-orientation (upright before resize)
//   - embed-output-icc requires color-transform (IMAGE_PIPELINE §5 stage 7 is
//     a POST-CONVERSION decision — embedding ICC without a color transform
//     stage has no meaning; strip-metadata does NOT require anything: a
//     metadata-only strip pass is legitimate)
//   - hash-output, when present, must be the LAST stage
// (All five pairwise invariants — extract-before-color, strip-after-color,
// color-before-resize, orientation-before-resize, embed-after-strip — are
// subsumed by the subsequence check.) Stages run at most once (a repeated
// orientation or hash pass would change bytes nondeterministically relative
// to the plan's claims).
//
// Rule tokens are prefixed "5:" after the IMAGE_PIPELINE.md § section they
// enforce, matching the repo's rule-precise error-token convention.

/** The eight canonical §5 stages, in canonical order. */
export const PIPELINE_STAGES = [
  "read-decode",
  "extract-metadata",
  "normalize-orientation",
  "color-transform",
  "resize-encode",
  "strip-metadata",
  "embed-output-icc",
  "hash-output",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/** A pipeline plan: the (possibly partial) ordered sequence of stages to run. */
export type StagePlan = readonly PipelineStage[];

/**
 * STAGE_ORDER_NOTE documents the enforced authority (mirrors the module header;
 * pinned by tests so the contract cannot silently drift from IMAGE_PIPELINE §5).
 */
export const STAGE_ORDER_NOTE =
  "Stage order enforced per IMAGE_PIPELINE §5: every pipeline plan must be a " +
  "subsequence of the canonical stage order (extract-metadata before " +
  "color-transform — ICC read before any strip/conversion — " +
  "normalize-orientation before resize-encode — upright pixels before resize — " +
  "color-transform before strip-metadata — metadata needed for conversion is " +
  "not stripped first — strip-metadata before embed-output-icc — WP-16 CR-01 " +
  "final-byte order —), plus the hard requirements that color-transform needs " +
  "extract-metadata, embed-output-icc needs color-transform, resize-encode " +
  "needs normalize-orientation, and hash-output runs last (digest reflects " +
  "all transforms).";

/** One order violation found in a plan. */
export interface StagePlanIssue {
  /** Rule-precise token, e.g. "5:resize-requires-orientation". */
  rule: string;
  /** Human-readable explanation naming the offending stage(s). */
  message: string;
}

export type StagePlanResult =
  | { ok: true; /** The validated plan, in run order. */ plan: PipelineStage[] }
  | { ok: false; /** All violations found (not just the first). */ issues: StagePlanIssue[] };

/** Pairs that must appear in this relative order whenever both are present.
 * SUBSUMED by the subsequence check below (kept only as documentation of the
 * §5 invariants the subsequence check enforces wholesale):
 * extract-metadata < color-transform, color-transform < strip-metadata,
 * color-transform < resize-encode, normalize-orientation < resize-encode,
 * strip-metadata < embed-output-icc.
 */
const CANONICAL_INDEX: ReadonlyMap<PipelineStage, number> = new Map(
  PIPELINE_STAGES.map((stage, index) => [stage, index] as const),
);

/**
 * Validate a stage plan against the canonical §5 order. Returns ALL violations
 * (not just the first) so callers can fail with a complete diagnosis. Pure:
 * no I/O, no sharp, deterministic.
 */
export function validateStagePlan(plan: readonly unknown[]): StagePlanResult {
  const issues: StagePlanIssue[] = [];

  // Unknown stage names — nothing else can be trusted meaningfully, but we
  // still report every violation we CAN determine for the known stages.
  const known: PipelineStage[] = [];
  for (const entry of plan) {
    if (typeof entry === "string" && (PIPELINE_STAGES as readonly string[]).includes(entry)) {
      known.push(entry as PipelineStage);
    } else {
      issues.push({
        rule: "5:unknown-stage",
        message: `unknown pipeline stage '${String(entry)}' — must be one of: ${PIPELINE_STAGES.join(", ")}`,
      });
    }
  }

  // Each stage at most once; the FIRST occurrence defines the plan order.
  const seen = new Set<PipelineStage>();
  const uniqueInPlan: PipelineStage[] = [];
  for (const stage of known) {
    if (seen.has(stage)) {
      issues.push({
        rule: "5:duplicate-stage",
        message: `stage '${stage}' appears more than once — each canonical stage runs exactly once`,
      });
      continue;
    }
    seen.add(stage);
    uniqueInPlan.push(stage);
  }

  // Strictly-increasing subsequence check (one loop, subsumes all pairwise
  // order invariants): every known stage must come later in the canonical
  // order than the stage before it in the plan.
  let previousStage: PipelineStage | null = null;
  let previousIndex = -1;
  for (const stage of uniqueInPlan) {
    const index = CANONICAL_INDEX.get(stage)!;
    if (index <= previousIndex) {
      issues.push({
        rule: "5:stage-order",
        message:
          `stage '${stage}' is out of canonical order — it follows '${previousStage}' in the ` +
          `plan but precedes it in the canonical order (${PIPELINE_STAGES.join(" → ")}); ` +
          "IMAGE_PIPELINE §5 stage ordering invariant violated",
      });
    } else {
      previousStage = stage;
      previousIndex = index;
    }
  }

  const positionOf = (stage: PipelineStage): number => uniqueInPlan.indexOf(stage);

  // Hard requirement: a pixel-transforming stage needs the metadata read.
  if (positionOf("color-transform") !== -1 && positionOf("extract-metadata") === -1) {
    issues.push({
      rule: "5:color-requires-extract",
      message:
        "stage 'color-transform' present without 'extract-metadata' — the source ICC " +
        "(and orientation) must be read before conversion (IMAGE_PIPELINE §5 stage 2)",
    });
  }

  // Hard requirement: resize assumes upright pixels.
  if (positionOf("resize-encode") !== -1 && positionOf("normalize-orientation") === -1) {
    issues.push({
      rule: "5:resize-requires-orientation",
      message:
        "stage 'resize-encode' present without 'normalize-orientation' — orientation must " +
        "be normalized into pixels before any resize (IMAGE_PIPELINE §5 stage ordering invariant)",
    });
  }

  // Hard requirement: output ICC embedding is a POST-CONVERSION decision
  // (IMAGE_PIPELINE §5 stage 7: "a post-conversion decision that depends on
  // benchmark evidence") — embedding without a color-transform stage has no
  // meaning in the canonical pipeline.
  if (positionOf("embed-output-icc") !== -1 && positionOf("color-transform") === -1) {
    issues.push({
      rule: "5:embed-requires-color",
      message:
        "stage 'embed-output-icc' present without 'color-transform' — output ICC embedding " +
        "is a post-conversion decision (IMAGE_PIPELINE §5 stage 7) and cannot run before " +
        "the color transform",
    });
  }

  // Hard requirement: hashing is the final step.
  if (positionOf("hash-output") !== -1 && positionOf("hash-output") !== known.length - 1) {
    issues.push({
      rule: "5:hash-last",
      message:
        "stage 'hash-output' is not last — hashing must occur after all pixel and " +
        "metadata transforms (IMAGE_PIPELINE §5 stage ordering invariant)",
    });
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, plan: known };
}
