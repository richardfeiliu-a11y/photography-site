// WP-19 — color transform (IMAGE_PIPELINE.md §5 stage 4: COLOR TRANSFORM TO
// TARGET WEB COLOR SPACE, + §6 ICC policy).
//
// Authority:
//   - IMAGE_PIPELINE.md §5 stage 4: valid source ICC → convert to sRGB; no
//     profile → the documented no-profile policy (§6.2); conversion runs
//     AFTER decode + ICC read and BEFORE encoding.
//   - IMAGE_PIPELINE.md §6.3 (verified Sharp APIs only): `toColourspace('srgb')`
//     is the conversion; `pipelineColourspace(...)` exists for working space.
//   - WP-16 decision record (docs/implementation/decisions/ICC-POLICY.md):
//     D9 — untagged sources follow the enforcement mode exported as
//     DEFAULT_UNTAGGED_ENFORCEMENT_MODE from scripts/media/icc-policy.ts
//     ("assume": silent, documented assume-sRGB per ADR-011; "warn"/"fail"
//     remain selectable recorded modes). D10 — NO output ICC embedding;
//     OUTPUT ICC EMBEDDING DELIBERATELY DOES NOT HAPPEN HERE (WP-21 verifies
//     the final derivatives carry no ICC — per D10 there is nothing to embed).
//   - TECHNICAL_API_VERIFICATION.md §2: only toColourspace('srgb') and
//     pipelineColourspace(...) are verified APIs ON THIS PATH.
//
// FORBIDDEN ON THIS PATH (D10, consumed from the WP-16 record's machine
// contract): `keepIccProfile()` and `withIccProfile()`. The WP-16-measured
// trap stays documented here by name: keepIccProfile() called AFTER a
// toColourspace('srgb') conversion retains the SOURCE profile on sRGB pixels
// — a mislabel (ICC-POLICY.md §1 evidence chain 5). It is only correct when
// no pixel transform occurred, which is never true downstream of this stage.
// A static test (tests/unit/color.test.ts) pins that neither method appears
// as code in this module while this documentation stays present.
//
// Guard wiring (WP-18 reviewer finding — nothing mechanically forced the
// wiring, so WP-19 is the first to wire it): constructing the stage-4
// pipeline asserts plan validity through validateStagePlan
// (scripts/media/stage-order.ts). The canonical stages 1–4 subsequence
// (read-decode → extract-metadata → normalize-orientation → color-transform)
// is composed and validated BEFORE any pixel is touched; a mis-ordered plan
// fails closed with the guard's rule-precise tokens.
//
// Pixel honesty (WP-16 measured, frozen host):
//   - tagged sources: sharp honors the valid source ICC on decode, and an
//     explicit toColourspace('srgb') equals the implicit default (delta
//     0.0000) — the call makes the D3 contract visible, it does not fight it.
//   - untagged sources: the explicit conversion is a pixel NO-OP (delta
//     0.0000) — the assume-sRGB interpretation changes nothing; it is
//     recorded (ADR-011 + ICC-POLICY.md), never guessed. No camera-model
//     inference exists anywhere (a static test greps scripts/media/*.ts for
//     it, comment-stripped, and pins the absence).
import sharp from "sharp";
import { extractSourceMetadata, type SourceMetadataRecord } from "./extract";
import {
  DEFAULT_UNTAGGED_ENFORCEMENT_MODE,
  evaluateIccSource,
  type IccEnforcementMode,
  type IccLogEntry,
} from "./icc-policy";
import { orientedPipeline } from "./orient";
import { validateStagePlan, type PipelineStage, type StagePlan } from "./stage-order";

/** The sharp pipeline type (namespace import avoided under strip-types). */
type SharpPipeline = ReturnType<typeof sharp>;

/**
 * COLOR_TRANSFORM_NOTE documents the stage-4 contract (pinned by tests):
 * decode via the stage-3 choke point, convert to sRGB honoring a valid
 * source ICC, apply the frozen untagged policy, embed NO output ICC.
 */
export const COLOR_TRANSFORM_NOTE =
  "Stage-4 color transform (IMAGE_PIPELINE §5 stage 4 + §6): decode via " +
  "orientedPipeline (orientation already normalized), apply " +
  "toColourspace('srgb') — sharp honors a valid source ICC on decode, and " +
  "the explicit call equals the implicit default (WP-16 measured 0.0000). " +
  "Untagged sources follow the frozen D9 policy via evaluateIccSource " +
  "(default 'assume': silent documented assume-sRGB, a measured pixel " +
  "no-op). NO output ICC embedding happens here (D10; the keep/with " +
  "ICC-profile methods are forbidden on this path — the keep method " +
  "retains the SOURCE profile after conversion, a measured mislabel).";

/**
 * The stage-4 plan: the canonical §5 stages this module runs, as a partial
 * plan over PIPELINE_STAGES. Composed ONCE and validated through the WP-18
 * guard on every pipeline construction (colorToSrgb), so a drifted plan
 * fails closed instead of silently reordering pixel work.
 */
export const COLOR_STAGE_PLAN: StagePlan = [
  "read-decode",
  "extract-metadata",
  "normalize-orientation",
  "color-transform",
] as const;

/** Build-blocking color-policy failure (IMAGE_PIPELINE §11.1: "Color-policy failure"). */
export class ColorPolicyError extends Error {
  /** Rule-precise token, repo convention (§.rule). */
  readonly rule: string;
  /** The recorded rejection entry from the policy module. */
  readonly entry: IccLogEntry;

  constructor(entry: IccLogEntry) {
    super(`11.1:color-policy — ${entry.message} (${entry.code})`);
    this.name = "ColorPolicyError";
    this.rule = "11.1:color-policy";
    this.entry = entry;
  }
}

/** Plan-validation failure: carries every stage-order violation found. */
export class ColorStagePlanError extends Error {
  /** Rule-precise tokens from the stage-order guard (e.g. "5:stage-order"). */
  readonly rules: string[];

  constructor(
    issues: ReadonlyArray<{ rule: string; message: string }>,
  ) {
    super(
      `stage plan rejected by validateStagePlan: ${issues
        .map((issue) => `${issue.rule} — ${issue.message}`)
        .join(" | ")}`,
    );
    this.name = "ColorStagePlanError";
    this.rules = issues.map((issue) => issue.rule);
  }
}

/**
 * Compose-then-validate the stage-4 plan through the WP-18 guard. Returns
 * the validated plan, or throws ColorStagePlanError with the guard's rule
 * tokens. Exported so tests can pin that a deliberately mis-ordered plan
 * fails closed BEFORE any pixel work.
 */
export function validateColorStagePlan(
  plan: readonly unknown[] = COLOR_STAGE_PLAN,
): PipelineStage[] {
  const result = validateStagePlan(plan);
  if (!result.ok) throw new ColorStagePlanError(result.issues);
  return result.plan;
}

/** Convenience wrapper: the validated stage-4 plan (throws on drift). */
export function colorStagePlan(): PipelineStage[] {
  return validateColorStagePlan();
}

export interface ColorToSrgbOptions {
  /**
   * D9 enforcement mode for untagged sources. Defaults to the FROZEN mode
   * imported from scripts/media/icc-policy.ts (DEFAULT_UNTAGGED_ENFORCEMENT_MODE
   * = "assume") — never a local hardcode, so a policy re-decision is a
   * one-module change pinned by tests.
   */
  policy?: IccEnforcementMode;
  /**
   * The stage-2 extractor record (scripts/media/extract.ts) — its
   * icc.present drives the D9 decision. When omitted, the record is
   * extracted here (one read-only metadata pass on the raw source bytes).
   * Passing the record from the pipeline runner avoids the duplicate read.
   */
  record?: SourceMetadataRecord;
  /**
   * Surface for policy log entries ("warn" mode emits the recorded
   * ICC_UNTAGGED_ASSUMED_SRGB entry). Defaults to console output. The
   * frozen "assume" mode emits nothing (silent per D9).
   */
  onLog?: (entry: IccLogEntry) => void;
}

function defaultOnLog(entry: IccLogEntry): void {
  const line = `[wp19] ${entry.code}: ${entry.message}`;
  if (entry.level === "warn") console.warn(line);
  else console.info(line);
}

/**
 * Stage-4 color transform: a sharp pipeline whose decoded pixels are sRGB,
 * honoring a valid source ICC implicitly on decode, with the frozen D9
 * policy enforced for untagged sources and the stage plan validated through
 * the WP-18 guard BEFORE any pixel is touched.
 *
 * - Tagged source: `toColourspace('srgb')` performs the real gamut
 *   conversion (WP-16 measured mean abs delta 2.0657 Adobe-RGB / 1.9991
 *   Display P3 vs naive passthrough).
 * - Untagged source: the same call is a pixel no-op (measured 0.0000); the
 *   policy decides only logging/failure semantics. Under the frozen default
 *   ("assume") this is silent; "warn" emits the recorded entry and proceeds;
 *   "fail" throws ColorPolicyError (rule 11.1:color-policy) BEFORE any
 *   pipeline is returned — build-blocking, fail closed.
 *
 * The returned pipeline does NOT encode and does NOT resize (stages 5 are
 * downstream, WP-20) and embeds NO ICC profile (D10; WP-21 verifies).
 */
export async function colorToSrgb(
  source: string | Buffer,
  options: ColorToSrgbOptions = {},
): Promise<SharpPipeline> {
  // Guard wiring: construct-then-assert. A mis-ordered or drifted stage-4
  // plan throws (rule-precise tokens) before any pixel work is composed.
  validateColorStagePlan(COLOR_STAGE_PLAN);

  // Stage 2 (already run upstream in the full pipeline): the extractor
  // record's icc.present is the ONLY policy input — no camera-model or
  // metadata guessing (ADR-011).
  const record = options.record ?? (await extractSourceMetadata(source));
  const decision = evaluateIccSource(
    { hasValidIcc: record.icc.present },
    options.policy ?? DEFAULT_UNTAGGED_ENFORCEMENT_MODE,
  );

  if (decision.action === "fail") {
    // Build-blocking color-policy failure (IMAGE_PIPELINE §11.1), fail
    // closed before any encode could happen.
    throw new ColorPolicyError(decision.log!);
  }
  if (decision.log) {
    (options.onLog ?? defaultOnLog)(decision.log);
  }

  // Stage 3 → stage 4: start from the SINGLE orientation choke point, then
  // the verified sRGB conversion. Both fixture classes (tagged/untagged)
  // take this same call — WP-16 measured it as a real transform for tagged
  // wide-gamut sources and a pixel no-op for untagged ones.
  return orientedPipeline(source).toColourspace("srgb");
}
