// WP-20 — derivative generation core (IMAGE_PIPELINE.md §5 stage 5:
// RESIZE / ENCODE DERIVATIVES, + §10.3 purposes, §15 frozen design
// invariants).
//
// Authority:
//   - WP-15 decision record BENCHMARK-OQ01-OQ02.md (FROZEN, user-approved
//     2026-08-29): the ENTIRE variant plan is parsed at runtime from that
//     record's machine-readable JSON block — widths, per-purpose AVIF
//     qualities, JPEG fallback quality + progressive flag, purpose keys.
//     NO width or quality value is hardcoded in this module (pinned by
//     parse-mutation tests in tests/unit/derive.test.ts); a change to the
//     record changes the plan, and a change to the plan requires re-opening
//     WP-15 with new measurement evidence — never a silent edit.
//   - IMAGE_PIPELINE §5 stage 5: resize WITHOUT crop or upscale, preserving
//     aspect ratio; encode with benchmark-determined quality. §10.3: the
//     three purposes (gallery_display / overview / cover), all uncropped and
//     aspect-preserving; overview additionally contained. §15: the frozen
//     design invariants (uncropped presentation, no upscale via
//     withoutEnlargement: true, contained overview, uncropped cover) are
//     machine-asserted in tests/unit/derive.test.ts and
//     tests/integration/derivation.test.ts.
//   - WP-16 decision record ICC-POLICY.md: D9 (untagged enforcement) and D10
//     (NO output ICC embedding) are INHERITED by composition — every
//     derivative starts from the WP-19 stage-4 choke point colorToSrgb
//     (scripts/media/color.ts), so color policy, orientation normalization
//     and the source guard are not re-implemented here.
//   - ICC-POLICY.md §1 evidence chain 5: keepIccProfile() after a conversion
//     retains the SOURCE profile (a measured mislabel) and withIccProfile()
//     embeds — BOTH are forbidden on the derivative path (D10). Neither
//     appears in this module, and neither is needed: sharp's default metadata
//     handling strips profile and EXIF from re-encoded output, which is
//     exactly the stage-5 posture (formal privacy strip + verification is
//     WP-21's stage 6; D10's nothing-to-embed decision makes stage 7 a no-op).
//
// Stage-plan wiring (the WP-19 reviewer's forward obligation, now met): this
// module composes the FULL pipeline plan — stages 1–4 via COLOR_STAGE_PLAN
// plus "resize-encode" — and validates it through validateStagePlan
// (scripts/media/stage-order.ts) BEFORE any pixel work, so a drifted or
// mis-ordered plan fails closed with rule-precise tokens (5:stage-order,
// 5:resize-requires-orientation, …).
//
// Output policy: stage-5 files are written under generated/media/ ONLY
// (dist/ is never touched by the media pipeline; Astro build owns dist/).
// Names are deterministic INTERMEDIATE names derivable from plan facts —
// {photoId}-{purpose}-{format}-w{actualWidth}.{ext} — where source-capped
// variants record their ACTUAL width. Content-addressed renaming (16-hex
// digests per D8) happens in WP-22 over the FINAL served bytes, deliberately
// not here.
//
// Source-capping (D5 + §15 no-upscale): requested ladder widths above a
// source's orientation-normalized display width collapse to ONE variant at
// the source width (the first exceeding rung is recorded as requestedWidth
// provenance; the duplicates 1600/2048/2560-on-a-1365-source would encode the
// identical file). Planner honesty: capping is computed from the EXTRACTOR
// record's displayWidth (stage 2), never from hard-coded sizes.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { readdirSync, statSync } from "node:fs";
import { basename, join, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";
import { COLOR_STAGE_PLAN, colorToSrgb } from "./color";
import { extractSourceMetadata, type SourceMetadataRecord } from "./extract";
import type { IccEnforcementMode, IccLogEntry } from "./icc-policy";
import {
  validateStagePlan,
  type PipelineStage,
  type StagePlan,
} from "./stage-order";

/** The sharp pipeline type (namespace import avoided under strip-types). */
type SharpPipeline = ReturnType<typeof sharp>;

/** The three §10.3 derivative purposes, in canonical order. */
export const DERIVATIVE_PURPOSES = ["gallery_display", "overview", "cover"] as const;
export type DerivativePurpose = (typeof DERIVATIVE_PURPOSES)[number];

/** Production derivative formats (WP-15 D2: AVIF primary + JPEG fallback). */
export type DerivativeFormat = "avif" | "jpeg";

/** File extensions for the intermediate derivative names. Exported so WP-22's
 * content-addressed naming (same extension policy) cannot drift from stage 5. */
export const EXTENSIONS: Record<DerivativeFormat, string> = { avif: "avif", jpeg: "jpg" };

/** One §10.3 purpose spec, normalized from the record's JSON. */
export interface PurposeSpec {
  /** Width ladder, strictly ascending, each ≤ maxDerivativeWidth. */
  widths: number[];
  /** Primary-format (AVIF) quality for this purpose (encoder-scale). */
  avifQuality: number;
}

/** The frozen §15 rule flags, normalized from the record's JSON. */
export interface FrozenRules {
  aspectPreserving: boolean;
  noCrop: boolean;
  noEnlargement: boolean;
  sourceCappedVariantsValid: boolean;
  noFixed2xOr3xArtifacts: boolean;
}

/** The machine-readable WP-15 contract, parsed and validated. */
export interface FrozenDerivativeRecord {
  /** Record identifier, always "BENCHMARK-OQ01-OQ02" (fail-closed). */
  recordId: string;
  /** ISO date the user froze the values. */
  frozenAt: string;
  /** Per-purpose width ladders + primary-format qualities. */
  purposes: Record<DerivativePurpose, PurposeSpec>;
  /** Primary format — frozen to "avif" (D2); anything else fails closed. */
  primaryFormat: DerivativeFormat;
  /** Fallback format — frozen to "jpeg" (D2); anything else fails closed. */
  fallbackFormat: DerivativeFormat;
  /** JPEG fallback quality (D3). */
  jpegFallbackQuality: number;
  /** Progressive JPEG flag (D7). */
  jpegProgressive: boolean;
  /** Global ceiling validated against every ladder width. */
  maxDerivativeWidth: number;
  /** The §15 frozen rule flags (all must be true in the record). */
  rules: FrozenRules;
  /**
   * The RAW parsed JSON block, kept verbatim so consumers (tests, WP-22) can
   * read fields this module deliberately does not act on (e.g. the D8 digest
   * length — WP-22's concern) without re-parsing or hardcoding them here.
   */
  raw: Record<string, unknown>;
}

/** One planned derivative: the planner's output unit per (source, purpose). */
export interface PlannedVariant {
  photoId: string;
  purpose: DerivativePurpose;
  format: DerivativeFormat;
  /** The record's ladder rung this variant serves. */
  requestedWidth: number;
  /**
   * The ACTUAL output width: the requested rung, or the source's display
   * width when the rung exceeds it (source-capped, D5/§15 no-upscale).
   */
  width: number;
  quality: number;
  /** Progressive encoding (JPEG fallback only; D7). */
  progressive: boolean;
}

/** One generated derivative file + its honest measured facts. */
export interface DerivativeResult {
  purpose: DerivativePurpose;
  format: DerivativeFormat;
  requestedWidth: number;
  /** Measured output width (== the planned width; mismatch fails closed). */
  width: number;
  /** Measured output height (aspect-preserved within 1px rounding). */
  height: number;
  quality: number;
  progressive: boolean;
  /** Encoded byte count. */
  bytes: number;
  /** Absolute path of the written file (under the requested outDir). */
  file: string;
}

/** Per-source derivation result. */
export interface DeriveSourceResult {
  photoId: string;
  /** SHA-256 of the exact source bytes (from the stage-2 record). */
  sourceSha256: string;
  displayWidth: number;
  displayHeight: number;
  derivatives: DerivativeResult[];
}

/** Input for one source derivation. */
export interface DeriveSourceInput {
  /** Stable photo identifier (also the intermediate filename prefix). */
  photoId: string;
  /** Filesystem path OR in-memory bytes of the WEB INGEST MASTER. */
  source: string | Buffer;
  /**
   * Stage-2 extractor record when already computed upstream — avoids a
   * duplicate metadata read (WP-18 record-passing efficiency).
   */
  record?: SourceMetadataRecord;
}

export interface DeriveSourceOptions {
  /** Output directory — generated/media/ in production usage. */
  outDir: string;
  /** Pre-parsed frozen record (skips the decision-doc read). */
  frozenRecord?: FrozenDerivativeRecord;
  /** Decision-doc TEXT override (tests / hermetic runs); parsed per call. */
  recordDoc?: string;
  /** D9 enforcement mode; defaults to the frozen "assume" (via colorToSrgb). */
  policy?: IccEnforcementMode;
  /** Surface for policy log entries ("warn" mode); frozen "assume" is silent. */
  onLog?: (entry: IccLogEntry) => void;
}

export interface DeriveAllOptions extends DeriveSourceOptions {
  /** Worker concurrency (parallel SOURCES; default DEFAULT_CONCURRENCY). */
  concurrency?: number;
}

export interface DeriveAllResult {
  /** Per-source results in INPUT order regardless of worker scheduling. */
  results: DeriveSourceResult[];
}

const DEFAULT_RECORD_PATH = fileURLToPath(
  new URL("../../docs/implementation/decisions/BENCHMARK-OQ01-OQ02.md", import.meta.url),
);

/** Worker count used by deriveAll when no concurrency is configured. */
export const DEFAULT_CONCURRENCY = 4;

/** Fail-closed record error (missing/malformed/altered machine contract). */
export class DerivativeRecordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DerivativeRecordError";
  }
}

/** Plan-validation failure: carries every stage-order violation found. */
export class DeriveStagePlanError extends Error {
  /** Rule-precise tokens from the stage-order guard (e.g. "5:stage-order"). */
  readonly rules: string[];

  constructor(issues: ReadonlyArray<{ rule: string; message: string }>) {
    super(
      `stage plan rejected by validateStagePlan: ${issues
        .map((issue) => `${issue.rule} — ${issue.message}`)
        .join(" | ")}`,
    );
    this.name = "DeriveStagePlanError";
    this.rules = issues.map((issue) => issue.rule);
  }
}

/** Derivation failure (bad input, encode/size mismatch). */
export class DeriveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeriveError";
  }
}

// ---------------------------------------------------------------------------
// Stage plan (stages 1–5) — composed through the WP-18 guard
// ---------------------------------------------------------------------------

/**
 * The stage-5 plan: the FULL canonical §5 subsequence this module runs —
 * the stage-4 color plan (read-decode → extract-metadata →
 * normalize-orientation → color-transform, imported from WP-19 so the two
 * plans cannot drift) plus "resize-encode". Validated through
 * validateStagePlan on EVERY derivation before any pixel is touched.
 * Stages 6–8 (strip-metadata, embed-output-icc, hash-output) are WP-21/22.
 */
export const DERIVE_STAGE_PLAN: StagePlan = [...COLOR_STAGE_PLAN, "resize-encode"] as const;

/**
 * Compose-then-validate the stage-5 plan through the WP-18 guard. Returns
 * the validated plan, or throws DeriveStagePlanError with the guard's
 * rule-precise tokens. Exported so tests can pin that a deliberately
 * mis-ordered plan fails closed BEFORE any pixel work.
 */
export function validateDeriveStagePlan(plan: readonly unknown[] = DERIVE_STAGE_PLAN): PipelineStage[] {
  const result = validateStagePlan(plan);
  if (!result.ok) throw new DeriveStagePlanError(result.issues);
  return result.plan;
}

/** Convenience wrapper: the validated stage-5 plan (throws on drift). */
export function deriveStagePlan(): PipelineStage[] {
  return validateDeriveStagePlan();
}

// ---------------------------------------------------------------------------
// Decision-record parsing (planner–record linkage)
// ---------------------------------------------------------------------------

/** Read + parse the frozen decision record from its canonical location. */
export async function loadDerivativeRecord(
  path: string = DEFAULT_RECORD_PATH,
): Promise<FrozenDerivativeRecord> {
  return parseDerivativeRecord(await readFile(path, "utf8"));
}

/**
 * Parse the machine-readable contract from the decision record's fenced
 * ```json block (the block whose "record" field is BENCHMARK-OQ01-OQ02).
 * Pure: takes the document text, so tests can pin parse-level honesty by
 * mutating the JSON and observing the plan change.
 */
export function parseDerivativeRecord(markdown: string): FrozenDerivativeRecord {
  const fence = /```json[ \t]*\r?\n([\s\S]*?)```/g;
  let parsed: Record<string, unknown> | null = null;
  for (const match of markdown.matchAll(fence)) {
    const body = match[1];
    if (body === undefined) continue;
    try {
      const candidate = JSON.parse(body) as Record<string, unknown>;
      if (
        candidate !== null &&
        typeof candidate === "object" &&
        candidate["record"] === "BENCHMARK-OQ01-OQ02"
      ) {
        parsed = candidate;
        break;
      }
    } catch {
      // Not the machine contract block — keep scanning.
    }
  }
  if (parsed === null) {
    throw new DerivativeRecordError(
      "no machine-readable BENCHMARK-OQ01-OQ02 JSON block found in the decision record — " +
        "the derivation plan may only be derived from that FROZEN contract",
    );
  }
  return normalizeRecord(parsed);
}

function recordField(parsed: Record<string, unknown>, key: string): unknown {
  const value = parsed[key];
  if (value === undefined) {
    throw new DerivativeRecordError(`decision record JSON is missing required field '${key}'`);
  }
  return value;
}

function assertInt(value: unknown, name: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new DerivativeRecordError(
      `decision record field '${name}' must be an integer in [${min}, ${max}] (got ${String(value)})`,
    );
  }
  return value;
}

function normalizeRecord(parsed: Record<string, unknown>): FrozenDerivativeRecord {
  const frozenAt = recordField(parsed, "frozen_at");
  if (typeof frozenAt !== "string") {
    throw new DerivativeRecordError("decision record field 'frozen_at' must be a string");
  }

  const formats = recordField(parsed, "formats") as Record<string, unknown> | undefined;
  if (
    formats === undefined ||
    typeof formats !== "object" ||
    formats["primary"] !== "avif" ||
    formats["fallback"] !== "jpeg"
  ) {
    throw new DerivativeRecordError(
      "decision record 'formats' deviates from the FROZEN D2 contract (AVIF primary + JPEG " +
        "fallback) — re-opening WP-15 with new measurement evidence is required, not a silent edit",
    );
  }

  const maxDerivativeWidth = assertInt(recordField(parsed, "max_derivative_width"), "max_derivative_width", 1, 100000);
  const jpegFallbackQuality = assertInt(recordField(parsed, "jpeg_fallback_quality"), "jpeg_fallback_quality", 1, 100);
  const jpegProgressive = recordField(parsed, "jpeg_progressive");
  if (typeof jpegProgressive !== "boolean") {
    throw new DerivativeRecordError("decision record field 'jpeg_progressive' must be a boolean");
  }

  const rawPurposes = recordField(parsed, "purposes") as Record<string, unknown> | undefined;
  if (rawPurposes === undefined || typeof rawPurposes !== "object" || rawPurposes === null) {
    throw new DerivativeRecordError("decision record field 'purposes' must be an object");
  }
  const purposes = {} as Record<DerivativePurpose, PurposeSpec>;
  for (const purpose of DERIVATIVE_PURPOSES) {
    const raw = rawPurposes[purpose];
    if (raw === undefined || typeof raw !== "object" || raw === null) {
      throw new DerivativeRecordError(`decision record is missing the frozen purpose '${purpose}'`);
    }
    const spec = raw as Record<string, unknown>;
    const rawWidths = spec["widths"];
    if (!Array.isArray(rawWidths) || rawWidths.length === 0) {
      throw new DerivativeRecordError(`purpose '${purpose}' must declare a non-empty widths array`);
    }
    const widths: number[] = [];
    let previous = -Infinity;
    for (const rawWidth of rawWidths) {
      const width = assertInt(rawWidth, `purposes.${purpose}.widths`, 1, 100000);
      if (width > maxDerivativeWidth) {
        throw new DerivativeRecordError(
          `purpose '${purpose}' width ${width} exceeds max_derivative_width (${maxDerivativeWidth})`,
        );
      }
      if (width <= previous) {
        throw new DerivativeRecordError(
          `purpose '${purpose}' widths must be strictly ascending (got ${width} after ${previous})`,
        );
      }
      previous = width;
      widths.push(width);
    }
    purposes[purpose] = {
      widths,
      avifQuality: assertInt(spec["avif_quality"], `purposes.${purpose}.avif_quality`, 1, 100),
    };
  }

  const rawRules = recordField(parsed, "rules") as Record<string, unknown> | undefined;
  const rules: FrozenRules = {
    aspectPreserving: rawRules?.["aspect_preserving"] === true,
    noCrop: rawRules?.["no_crop"] === true,
    noEnlargement: rawRules?.["no_enlargement"] === true,
    sourceCappedVariantsValid: rawRules?.["source_capped_variants_valid"] === true,
    noFixed2xOr3xArtifacts: rawRules?.["no_fixed_2x_or_3x_artifacts"] === true,
  };
  for (const [flag, value] of Object.entries(rules)) {
    if (value !== true) {
      throw new DerivativeRecordError(
        `decision record rule '${flag}' is not true — the §15 frozen design invariants are ` +
          "non-negotiable; a change requires re-opening WP-15/WP-20, not a silent edit",
      );
    }
  }

  return {
    recordId: "BENCHMARK-OQ01-OQ02",
    frozenAt,
    purposes,
    primaryFormat: "avif",
    fallbackFormat: "jpeg",
    jpegFallbackQuality,
    jpegProgressive,
    maxDerivativeWidth,
    rules,
    raw: parsed,
  };
}

// ---------------------------------------------------------------------------
// Planner
// ---------------------------------------------------------------------------

/**
 * Plan the FULL variant set for one source: purposes × ladder widths ×
 * {primary AVIF at the purpose quality, fallback JPEG at the frozen fallback
 * quality (progressive per D7)}. Ladder rungs above the source's display
 * width collapse to ONE source-capped variant at the display width (the
 * first exceeding rung is kept as requestedWidth provenance) — §15 no-upscale
 * with no duplicate encodes of the identical capped file. Pure + deterministic
 * (fixed purpose order, ascending widths, primary before fallback).
 */
export function planDerivatives(
  record: FrozenDerivativeRecord,
  photoId: string,
  displayWidth: number,
): PlannedVariant[] {
  if (!Number.isInteger(displayWidth) || displayWidth < 1) {
    throw new DeriveError(`displayWidth must be a positive integer (got ${String(displayWidth)})`);
  }
  const variants: PlannedVariant[] = [];
  for (const purpose of DERIVATIVE_PURPOSES) {
    const spec = record.purposes[purpose];
    let capRequestedWidth: number | null = null;
    // Actual widths already planned for this purpose — a capped rung that
    // lands on an existing width (e.g. 2560 requested from a 2048 source,
    // whose ladder already contains a real 2048 rung) would encode the
    // identical file under the identical deterministic name.
    const seenWidths = new Set<number>();
    for (const requested of spec.widths) {
      let actualWidth: number;
      let provenance: number;
      if (requested > displayWidth) {
        if (capRequestedWidth !== null) continue; // capped rung already planned
        capRequestedWidth = requested;
        actualWidth = displayWidth;
        provenance = requested;
      } else {
        actualWidth = requested;
        provenance = requested;
      }
      if (seenWidths.has(actualWidth)) continue;
      seenWidths.add(actualWidth);
      variants.push({
        photoId,
        purpose,
        format: record.primaryFormat,
        requestedWidth: provenance,
        width: actualWidth,
        quality: spec.avifQuality,
        progressive: false,
      });
      variants.push({
        photoId,
        purpose,
        format: record.fallbackFormat,
        requestedWidth: provenance,
        width: actualWidth,
        quality: record.jpegFallbackQuality,
        progressive: record.jpegProgressive,
      });
    }
  }
  return variants;
}

/**
 * Deterministic INTERMEDIATE derivative name, derivable purely from plan
 * facts. Source-capped variants record their ACTUAL width. WP-22 renames to
 * content-addressed names over the FINAL served bytes (D8, 16-hex) — no
 * digest computation happens at this stage.
 */
export function derivativeFileName(
  photoId: string,
  purpose: DerivativePurpose,
  format: DerivativeFormat,
  width: number,
): string {
  return `${photoId}-${purpose}-${format}-w${width}.${EXTENSIONS[format]}`;
}

/** The intermediate filename must not be able to escape the output directory. */
function assertSafePhotoId(photoId: string): void {
  if (photoId.length === 0 || /[/\\]/.test(photoId) || photoId === "." || photoId === "..") {
    throw new DeriveError(
      `photoId '${photoId}' is not a safe single path segment — refusing to derive`,
    );
  }
}

// ---------------------------------------------------------------------------
// Generation (stage 5)
// ---------------------------------------------------------------------------

/**
 * Derive ALL planned variants for ONE source:
 *   colorToSrgb(source)  — stages 1–4, D9 policy + orientation inherited
 *   → .resize({width, withoutEnlargement: true})  — stage 5, no crop, no upscale
 *   → .avif({quality}) | .jpeg({quality, progressive})  — stage 5 encode
 * No keep/with ICC-profile call exists on this path (D10) and no EXIF is
 * retained (sharp's default metadata handling strips; formal stage-6 strip +
 * verification is WP-21). Each variant encodes from a CLONE of the single
 * stage-4 pipeline — the source is decoded and color-converted exactly once.
 */
export async function deriveSource(
  input: DeriveSourceInput,
  options: DeriveSourceOptions,
): Promise<DeriveSourceResult> {
  // Guard wiring: assert the composed stage-5 plan BEFORE any pixel work.
  validateDeriveStagePlan(DERIVE_STAGE_PLAN);
  assertSafePhotoId(input.photoId);

  const frozen =
    options.frozenRecord ??
    (options.recordDoc !== undefined
      ? parseDerivativeRecord(options.recordDoc)
      : await loadDerivativeRecord());

  const bytes = typeof input.source === "string" ? await readFile(input.source) : input.source;
  const record = input.record ?? (await extractSourceMetadata(bytes));
  if (record.displayWidth === null || record.displayHeight === null) {
    throw new DeriveError(
      `source for '${input.photoId}' has no decodable dimensions — cannot plan derivatives`,
    );
  }

  const plan = planDerivatives(frozen, input.photoId, record.displayWidth);
  await mkdir(options.outDir, { recursive: true });

  // Stages 1–4 via the WP-19 choke point: D9 policy decision + orientation +
  // sRGB conversion happen here, once per source.
  const pipeline = await colorToSrgb(bytes, {
    policy: options.policy,
    record,
    onLog: options.onLog,
  });

  const derivatives: DerivativeResult[] = [];
  for (const variant of plan) {
    derivatives.push(await encodeVariant(pipeline, variant, options.outDir));
  }

  return {
    photoId: input.photoId,
    sourceSha256: record.sha256,
    displayWidth: record.displayWidth,
    displayHeight: record.displayHeight,
    derivatives,
  };
}

async function encodeVariant(
  pipeline: SharpPipeline,
  variant: PlannedVariant,
  outDir: string,
): Promise<DerivativeResult> {
  const resized = pipeline.clone().resize({ width: variant.width, withoutEnlargement: true });
  const encoded =
    variant.format === "avif"
      ? resized.avif({ quality: variant.quality })
      : resized.jpeg({ quality: variant.quality, progressive: variant.progressive });
  const { data, info } = await encoded.toBuffer({ resolveWithObject: true });

  if (info.width !== variant.width) {
    throw new DeriveError(
      `encode mismatch for '${variant.photoId}' ${variant.purpose} ${variant.format}: ` +
        `planned width ${variant.width}, encoder produced ${String(info.width)}`,
    );
  }

  const file = join(
    outDir,
    derivativeFileName(variant.photoId, variant.purpose, variant.format, info.width),
  );
  await writeFile(file, data);

  return {
    purpose: variant.purpose,
    format: variant.format,
    requestedWidth: variant.requestedWidth,
    width: info.width,
    height: info.height,
    quality: variant.quality,
    progressive: variant.progressive,
    bytes: data.length,
    file,
  };
}

/**
 * Derive a set of sources with configurable worker concurrency (parallel
 * SOURCES; each source's variants encode sequentially from one decoded
 * pipeline). Results are returned in INPUT order; the logical output set is
 * identical to sequential derivation (pinned byte-for-byte by tests).
 */
export async function deriveAll(
  sources: readonly DeriveSourceInput[],
  options: DeriveAllOptions,
): Promise<DeriveAllResult> {
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new DeriveError(`concurrency must be a positive integer (got ${String(concurrency)})`);
  }

  // Fail closed on duplicate photoIds: intermediate filenames are derived
  // from the photoId alone, so two sources sharing an id would silently
  // overwrite each other's derivatives under concurrent workers.
  const seenIds = new Set<string>();
  for (const source of sources) {
    if (seenIds.has(source.photoId)) {
      throw new DeriveError(
        `duplicate photoId '${source.photoId}' in deriveAll input — intermediate filenames are ` +
          "derived from the photoId alone; refusing to derive (ids must be unique per run)",
      );
    }
    seenIds.add(source.photoId);
  }

  const results: DeriveSourceResult[] = new Array(sources.length);
  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const index = nextIndex++;
      if (index >= sources.length) return;
      results[index] = await deriveSource(sources[index]!, options);
    }
  };
  const workerCount = Math.min(concurrency, sources.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return { results };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.info(
    [
      "Usage: derive.ts <file-or-dir> [--out <dir>] [--concurrency <n>] [--summary <file>] [--json]",
      "",
      "Derives all stage-5 variants (purposes × frozen widths × AVIF/JPEG) for one",
      "master or every *.jpg/*.png/*.tiff under a directory (IMAGE_PIPELINE §5",
      "stage 5). Output goes ONLY under --out (default generated/media/) with",
      "deterministic intermediate names; WP-22 performs content-addressed",
      "renaming over final bytes.",
    ].join("\n"),
  );
}

const invokedDirectly =
  process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;
if (invokedDirectly) {
  const argv = process.argv.slice(2);
  let target: string | undefined;
  let outDir = "generated/media";
  let concurrency = DEFAULT_CONCURRENCY;
  let summaryPath: string | null = null;
  let asJson = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--out") outDir = argv[++i] ?? "";
    else if (arg === "--concurrency") concurrency = Number(argv[++i] ?? NaN);
    else if (arg === "--summary") summaryPath = argv[++i] ?? "";
    else if (arg === "--json") asJson = true;
    else if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else if (arg.startsWith("-")) {
      console.error(`derive: Unknown argument '${arg}' (see --help)`);
      process.exit(1);
    } else {
      target = arg;
    }
  }
  if (target === undefined || target === "") {
    printUsage();
    process.exit(1);
  }

  const targetPath = join(process.cwd(), target);
  const st = statSync(targetPath);
  const files: string[] = [];
  if (st.isFile()) {
    files.push(targetPath);
  } else {
    for (const entry of readdirSync(targetPath).sort()) {
      const full = join(targetPath, entry);
      if (/\.(jpe?g|tiff?|png)$/i.test(entry) && statSync(full).isFile()) files.push(full);
    }
  }

  const frozen = await loadDerivativeRecord();
  const startedAt = process.hrtime.bigint();
  const { results } = await deriveAll(
    files.map((file) => ({
      photoId: basename(file, extname(file)),
      source: file,
    })),
    { outDir, concurrency, frozenRecord: frozen },
  );
  const wallTimeMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

  const totalFiles = results.reduce((sum, r) => sum + r.derivatives.length, 0);
  const totalBytes = results.reduce(
    (sum, r) => sum + r.derivatives.reduce((s, d) => s + d.bytes, 0),
    0,
  );

  if (asJson) {
    console.info(JSON.stringify(results, null, 2));
  } else {
    for (const r of results) {
      console.info(
        `[wp20] ${r.photoId} ${r.displayWidth}x${r.displayHeight} → ${r.derivatives.length} derivatives`,
      );
    }
    console.info(
      `[wp20] ${results.length} sources → ${totalFiles} files, ${(totalBytes / 1e6).toFixed(1)} MB, ` +
        `${(wallTimeMs / 1000).toFixed(1)}s (concurrency ${concurrency})`,
    );
  }

  if (summaryPath !== null && summaryPath !== "") {
    const summary = {
      workPackage: "WP-20",
      record: { id: frozen.recordId, frozenAt: frozen.frozenAt },
      sourceRoot: targetPath,
      outDir,
      concurrency,
      sources: results.length,
      files: totalFiles,
      totalBytes,
      wallTimeMs,
      toolchain: {
        node: process.version,
        sharp: sharp.versions.sharp ?? null,
        libvips: sharp.versions.vips ?? null,
      },
      perSource: results.map((r) => ({
        photoId: r.photoId,
        displayWidth: r.displayWidth,
        displayHeight: r.displayHeight,
        sourceSha256: r.sourceSha256,
        derivatives: r.derivatives.length,
        bytes: r.derivatives.reduce((s, d) => s + d.bytes, 0),
      })),
    };
    const { writeFile: writeFileAsync, mkdir: mkdirAsync } = await import("node:fs/promises");
    await mkdirAsync(join(summaryPath, ".."), { recursive: true });
    await writeFileAsync(summaryPath, JSON.stringify(summary, null, 2) + "\n");
    console.info(`[wp20] summary written to ${summaryPath}`);
  }
  process.exit(0);
}
