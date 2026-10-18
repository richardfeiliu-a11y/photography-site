// WP-23 — derivative coverage validator (IMAGE_PIPELINE.md §8 manifest
// closure/coverage, §11.1 build-blocking failure semantics, §11.3 drafts;
// CONTENT_MODEL.md §13.1#18; BUILD_AND_ROUTING.md §8 integrity-gate inputs).
//
// Authority, consumed (not re-derived):
//   - The FROZEN variant plan comes from the WP-15 decision record via
//     WP-20's parseDerivativeRecord + planDerivatives (scripts/media/
//     derive.ts). The plan join honors D5/§15 source-capping: a ladder rung
//     ABOVE a source's orientation-normalized display width produces NO
//     expected variant at that rung — the single source-capped variant at the
//     source width is what coverage requires ("a variant above source width
//     is not missing").
//   - IMAGE_PIPELINE §8: the manifest is the closure authority over
//     generated/media/. §11.1 makes all of the following BUILD-BLOCKING:
//       * the manifest missing entirely while published content exists
//         (11.1:manifest-missing);
//       * a required variant missing for a published photo — purpose ×
//         format × effective width (rule 13.1#18, the same rule ID WP-13's
//         composed validator enforces purpose-level; this validator is the
//         WIDTH-PRECISE second owner);
//       * a manifest record whose public_url does not resolve to an existing
//         file under the media root, or whose live bytes do not hash to the
//         recorded derivative_hash (11.1:manifest-entry-unresolved).
//       * a published photo's master that cannot be resolved/decoded for the
//         plan join (11.1:source-unresolved — fail closed, never a silent
//         zero-variant pass).
//   - IMAGE_PIPELINE §11.3: DRAFT photos are excluded from every blocking
//     check. Missing derivatives for draft content never block production.
//   - TESTING_AND_VISUAL_REGRESSION §4: "Derivative coverage: Every Photo in
//     every published Gallery has complete derivative entries in the
//     manifest" — this module IS that check; BUILD_AND_ROUTING §8 check 3
//     consumes its verdict at release-assembly time.
//
// Message/field style mirrors WP-13 (src/lib/validate/production.ts): the
// rule token appears as a bracketed prefix in the message and as the `rule`
// field, findings carry file/field coordinates, and output is deterministic
// (photos sorted by (galleryId, photoId), purposes in the §10.3 canonical
// order, widths ascending, unresolved records sorted).
//
// This module never writes and never mutates corpus fixtures or masters; the
// only I/O is reading masters (stage-2 metadata for the plan join), the
// manifest, and hashing the published files it references.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { load as parseYaml } from "js-yaml";
import sharp from "sharp";
import { planDerivatives, type FrozenDerivativeRecord } from "./derive";
import { extractSourceMetadata } from "./extract";
import { PUBLIC_URL_BASE } from "./naming";

// ---------------------------------------------------------------------------
// Rule tokens (§13.1#18 / §11.1 style, shared with WP-13)
// ---------------------------------------------------------------------------

/** Width-precise derivative-coverage rule (same rule ID as WP-13's §13.1#18). */
export const COVERAGE_RULE = "13.1#18";
/** The manifest itself is absent while published content exists (§11.1). */
export const MANIFEST_MISSING_RULE = "11.1:manifest-missing";
/** A manifest record's public_url/hash does not resolve on disk (§11.1). */
export const MANIFEST_UNRESOLVED_RULE = "11.1:manifest-entry-unresolved";
/** A published photo's master cannot be resolved for the plan join (§11.1). */
export const SOURCE_UNRESOLVED_RULE = "11.1:source-unresolved";
/**
 * The manifest's envelope record identity disagrees with the live FROZEN
 * record (hand-maintained or drifted manifest — the variant plan the manifest
 * was produced under cannot be trusted).
 */
export const MANIFEST_RECORD_MISMATCH_RULE = "11.1:manifest-record-mismatch";
/**
 * A manifest record's URL is not the flat layout the pipeline produces
 * (PUBLIC_URL_BASE + ONE filename segment, §9.3/§10.1 — consumers embed the
 * URL verbatim; any nesting breaks the release assembly).
 */
export const MANIFEST_URL_SHAPE_RULE = "11.1:manifest-url-shape";
/**
 * THE shared canonical public-URL shape rule (R-02): a production public_url
 * is exactly PUBLIC_URL_BASE + ONE filename component. Returns the filename
 * (also the outDir-relative protected path for pruning) or null when the URL
 * is out-of-base, nested, backslash-separated, or is a `.`/`..` component.
 * Legal consecutive dots INSIDE a filename are fine — "p..x-avif-w1-….avif"
 * is a legal authority (the Photo-ID contract only forbids the whole-ID
 * "."/"..", and the single-segment grammar means segment traversal cannot
 * occur in a valid URL). Both the coverage shape check and pipeline pruning
 * consume this one function — no second divergent rule.
 */
export function flatPublicUrlName(publicUrl: string): string | null {
  if (!publicUrl.startsWith(PUBLIC_URL_BASE)) return null;
  const name = publicUrl.slice(PUBLIC_URL_BASE.length);
  if (
    name.length === 0 ||
    name.includes("/") ||
    name.includes("\\") ||
    name === "." ||
    name === ".."
  ) {
    return null;
  }
  // Belt-and-braces equality: rejects any remaining form that is not
  // literally base + basename (e.g. URL-escaped separators).
  return name === basename(name) ? name : null;
}
/**
 * A spot-checked manifest record's width/height does not match the actual
 * decoded pixels of the referenced file (record metadata drift; sampled —
 * see CoverageOptions.verifyDimensionsSample for scope).
 */
export const MANIFEST_DIMENSION_MISMATCH_RULE = "11.1:manifest-dimension-mismatch";

/** How many records the pipeline/CLI coverage gates dimension-spot-check. */
export const DEFAULT_DIMENSION_SAMPLE = 8;

// ---------------------------------------------------------------------------
// Input/output types
// ---------------------------------------------------------------------------

/** One content-graph photo joined against the plan + manifest. */
export interface CoveragePhotoInput {
  /** Owning gallery ID (e.g. "g_lofoten_light") — coordinates in findings. */
  galleryId: string;
  /** The content Photo ID — the manifest join key (records' photo_id). */
  photoId: string;
  /** Path of the WEB INGEST MASTER (content source_ref resolved). */
  masterFile: string;
  /** True for draft-gallery photos: NEVER blocking (IMAGE_PIPELINE §11.3). */
  draft?: boolean;
}

/** Structural subset of an IMAGE_PIPELINE §10.2 manifest record. */
export interface CoverageManifestRow {
  photo_id: string;
  purpose: string;
  format: string;
  width: number;
  height: number;
  public_url: string;
  derivative_hash: string;
}

export interface CoverageOptions {
  /** The content-graph photos to join (drafts flagged; drafts never block). */
  publishedPhotos: readonly CoveragePhotoInput[];
  /** Manifest rows, or undefined when the manifest is absent entirely. */
  manifest: readonly CoverageManifestRow[] | undefined;
  /**
   * The manifest document's envelope record identity (from
   * `loadManifest`/`parseManifestEnvelope`), when the manifest carries one.
   * When supplied and `id` disagrees with the live FROZEN record, the
   * manifest is rejected (11.1:manifest-record-mismatch).
   */
  manifestRecord?: { id?: string; frozen_at?: string };
  /** The media root the manifest's public_urls resolve against (basename join). */
  mediaRoot: string;
  /** The parsed FROZEN WP-15 record — the only source of the variant plan. */
  frozenRecord: FrozenDerivativeRecord;
  /**
   * Verify each manifest record's file existence + derivative_hash (default
   * true). Disabling runs the pure plan join only (tests).
   */
  verifyFiles?: boolean;
  /**
   * Dimension spot-check scope: after the hash of a record's file VERIFIES,
   * up to this many records (deterministically: the first N in the sorted
   * check order) are decoded with sharp and their actual pixel
   * width/height compared against the record (11.1:manifest-dimension-
   * mismatch on drift). 0 (default) disables — unit tests fabricate
   * non-decodable rows; the pipeline and CLI gates enable it
   * (DEFAULT_DIMENSION_SAMPLE). SAMPLED scope, documented: hash equality
   * already proves bytes↔record integrity; the spot-check additionally
   * catches record metadata drift (hand-maintained rows with authentic
   * hashes), and a full-exhaustive decode of every derivative is deliberately
   * not paid on every run (the one-shot publish path already encodes each
   * file exactly once; WP-24's build-time selectors consume the records).
   */
  verifyDimensionsSample?: number;
}

/** One blocking finding (same shape as WP-13's ProductionValidationIssue). */
export interface CoverageFinding {
  severity: "error" | "warning";
  rule: string;
  message: string;
  file?: string;
  field?: string;
}

/** Per-purpose completeness counters (§4 "coverage report enumerates
 * per-purpose completeness" — the WP-23 brief's report contract). */
export interface PurposeCoverage {
  expected: number;
  covered: number;
}

export interface CoverageResult {
  ok: boolean;
  findings: CoverageFinding[];
  /** Total expected (photo, purpose, format, width) variants, non-draft photos. */
  expectedVariants: number;
  /** Of those, how many are present in the manifest. */
  coveredVariants: number;
  photosWithCompleteCoverage: number;
  photosMissingCoverage: number;
  perPurpose: Record<string, PurposeCoverage>;
}

// ---------------------------------------------------------------------------
// Manifest loading (envelope-tolerant)
// ---------------------------------------------------------------------------

/** A parsed manifest document: §10.2 rows + the envelope record identity. */
export interface ParsedManifest {
  rows: CoverageManifestRow[];
  /** The envelope's `manifest.record` block when present (undefined otherwise). */
  record: { id?: string; frozen_at?: string } | undefined;
}

/**
 * Parse a manifest document into rows PLUS the envelope record identity.
 * Tolerates the envelope-separated document written by
 * scripts/media/manifest.ts (`{envelope, manifest: {records, record}}`), a
 * bare core (`{records}`), legacy envelope keys
 * (`derivatives`/`rows`/`entries`), or a top-level array. Rows missing
 * required string/number fields are dropped (the coverage join treats a
 * dropped row as absent — fail-closed direction).
 */
export function parseManifestEnvelope(parsed: unknown): ParsedManifest {
  let candidates: unknown[] = [];
  let record: { id?: string; frozen_at?: string } | undefined;
  if (Array.isArray(parsed)) {
    candidates = parsed;
  } else if (typeof parsed === "object" && parsed !== null) {
    const doc = parsed as Record<string, unknown>;
    const core =
      (typeof doc["manifest"] === "object" && doc["manifest"] !== null
        ? (doc["manifest"] as Record<string, unknown>)
        : doc);
    for (const key of ["records", "derivatives", "rows", "entries"]) {
      const candidate = core[key];
      if (Array.isArray(candidate)) {
        candidates = candidate;
        break;
      }
    }
    // Surface the envelope record identity (WP-23 fix round 1): the coverage
    // validator fails a manifest whose record block disagrees with the live
    // FROZEN decision record (hand-maintained / drifted manifests).
    const rawRecord = core["record"];
    if (typeof rawRecord === "object" && rawRecord !== null) {
      record = {
        ...(typeof (rawRecord as Record<string, unknown>)["id"] === "string"
          ? { id: (rawRecord as Record<string, unknown>)["id"] as string }
          : {}),
        ...(typeof (rawRecord as Record<string, unknown>)["frozen_at"] === "string"
          ? { frozen_at: (rawRecord as Record<string, unknown>)["frozen_at"] as string }
          : {}),
      };
    }
  }
  return { rows: parseRows(candidates), record };
}

function parseRows(candidates: unknown[]): CoverageManifestRow[] {
  return candidates.flatMap((row) => {
    const r = row as Record<string, unknown> | null;
    if (
      typeof row !== "object" ||
      row === null ||
      typeof r!["photo_id"] !== "string" ||
      typeof r!["purpose"] !== "string" ||
      typeof r!["format"] !== "string" ||
      typeof r!["width"] !== "number" ||
      typeof r!["public_url"] !== "string" ||
      typeof r!["derivative_hash"] !== "string"
    ) {
      return [];
    }
    return [
      {
        photo_id: r!["photo_id"] as string,
        purpose: r!["purpose"] as string,
        format: r!["format"] as string,
        width: r!["width"] as number,
        height: typeof r!["height"] === "number" ? (r!["height"] as number) : 0,
        public_url: r!["public_url"] as string,
        derivative_hash: r!["derivative_hash"] as string,
      },
    ];
  });
}

/**
 * Back-compat rows-only view of {@link parseManifestEnvelope}. Prefer
 * {@link loadManifest} so the envelope record identity reaches the coverage
 * validator.
 */
export function parseManifestRows(parsed: unknown): CoverageManifestRow[] {
  return parseManifestEnvelope(parsed).rows;
}

/**
 * Read + parse a manifest file into rows + envelope record identity
 * (undefined if the file is absent).
 */
export async function loadManifest(path: string): Promise<ParsedManifest | undefined> {
  if (!existsSync(path)) return undefined;
  return parseManifestEnvelope(JSON.parse(await readFile(path, "utf8")));
}

/** Rows-only convenience wrapper over {@link loadManifest}. */
export async function loadManifestRows(
  path: string,
): Promise<CoverageManifestRow[] | undefined> {
  return (await loadManifest(path))?.rows;
}

// ---------------------------------------------------------------------------
// Content-graph collection (published + draft photos, with master paths)
// ---------------------------------------------------------------------------

/**
 * Walk content/galleries/**\/meta.yaml and collect every photo with its
 * resolved WEB INGEST MASTER path (source_ref is relative to
 * media/ingest-masters/ — SOURCE_OF_TRUTH_MATRIX §1) and draft flag.
 * `options.galleries` filters by gallery ID (or directory name) when given.
 * Draft status is read from the authored YAML; draft photos carry
 * `draft: true` and are NEVER blocking in the coverage join (§11.3).
 */
export function collectContentPhotos(
  contentRoot: string,
  options: { galleries?: readonly string[] } = {},
): CoveragePhotoInput[] {
  const filter = options.galleries === undefined ? null : new Set(options.galleries);
  const galleriesDir = join(contentRoot, "content", "galleries");
  const photos: CoveragePhotoInput[] = [];
  const walk = (current: string, dirName: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    )) {
      const child = join(current, entry.name);
      if (entry.isDirectory()) walk(child, entry.name);
      else if (entry.isFile() && entry.name === "meta.yaml") {
        const data = parseYaml(readFileSync(child, "utf8")) as {
          id?: unknown;
          status?: unknown;
          photos?: unknown;
        } | null;
        if (
          data === null ||
          typeof data !== "object" ||
          typeof data.id !== "string" ||
          typeof data.status !== "string" ||
          !Array.isArray(data.photos)
        ) {
          continue;
        }
        if (filter !== null && !filter.has(data.id) && !filter.has(dirName)) continue;
        const draft = data.status !== "published";
        for (const photo of data.photos as Array<Record<string, unknown>>) {
          if (
            photo === null ||
            typeof photo !== "object" ||
            typeof photo["id"] !== "string" ||
            typeof photo["source_ref"] !== "string"
          ) {
            continue;
          }
          photos.push({
            galleryId: data.id,
            photoId: photo["id"],
            masterFile: join(contentRoot, "media", "ingest-masters", photo["source_ref"]),
            ...(draft ? { draft: true } : {}),
          });
        }
      }
    }
  };
  if (existsSync(galleriesDir)) walk(galleriesDir, "");
  return photos.sort((a, b) =>
    a.galleryId === b.galleryId
      ? a.photoId < b.photoId
        ? -1
        : a.photoId > b.photoId
          ? 1
          : 0
      : a.galleryId < b.galleryId
        ? -1
        : 1,
  );
}

// ---------------------------------------------------------------------------
// The coverage join
// ---------------------------------------------------------------------------

function finding(f: CoverageFinding): CoverageFinding {
  return f;
}

/**
 * The coverage join (pure aside from reading masters for display widths and
 * hashing referenced files): content graph × FROZEN variant plan × manifest.
 * Deterministic — see the module comment for ordering.
 */
export async function validateCoverage(options: CoverageOptions): Promise<CoverageResult> {
  const verifyFiles = options.verifyFiles ?? true;
  const findings: CoverageFinding[] = [];
  const rows = options.manifest;
  const nonDraft = options.publishedPhotos.filter((p) => !p.draft);

  // ---- §11.1: the manifest must exist when published content exists. -----
  if (rows === undefined && nonDraft.length > 0) {
    findings.push(
      finding({
        severity: "error",
        rule: MANIFEST_MISSING_RULE,
        message:
          `[${MANIFEST_MISSING_RULE}] No asset manifest exists (generated/asset-manifest.json) but ` +
          `${nonDraft.length} published photo(s) require derivative coverage — the manifest is the ` +
          "closure authority over generated/media/ (IMAGE_PIPELINE §8, §11.1; build-blocking)",
        file: "generated/asset-manifest.json",
      }),
    );
  }

  // ---- Envelope record identity (fix round 1): a manifest whose record
  // block disagrees with the LIVE FROZEN decision record is hand-maintained
  // or drifted — its variant plan provenance cannot be trusted, fail closed.
  if (
    rows !== undefined &&
    options.manifestRecord?.id !== undefined &&
    options.manifestRecord.id !== options.frozenRecord.recordId
  ) {
    findings.push(
      finding({
        severity: "error",
        rule: MANIFEST_RECORD_MISMATCH_RULE,
        message:
          `[${MANIFEST_RECORD_MISMATCH_RULE}] Manifest envelope record identity ` +
          `'${options.manifestRecord.id}' does not match the live FROZEN decision record ` +
          `'${options.frozenRecord.recordId}' — the manifest's variant-plan provenance is ` +
          "untrustworthy (hand-maintained or drifted manifest; regenerate with media:pipeline; " +
          "IMAGE_PIPELINE §8, §11.1; build-blocking)",
        file: "generated/asset-manifest.json",
        field: "manifest.record.id",
      }),
    );
  }

  // ---- Plan join: expected variants per NON-DRAFT photo. ------------------
  const rowKeys = new Set<string>();
  for (const row of rows ?? []) {
    rowKeys.add(`${row.photo_id}\u0000${row.purpose}\u0000${row.format}\u0000${row.width}`);
  }
  const perPurpose: Record<string, PurposeCoverage> = {};
  const bump = (purpose: string, side: "expected" | "covered"): void => {
    const entry = perPurpose[purpose] ?? { expected: 0, covered: 0 };
    entry[side] += 1;
    perPurpose[purpose] = entry;
  };

  let expectedVariants = 0;
  let coveredVariants = 0;
  let photosWithCompleteCoverage = 0;
  let photosMissingCoverage = 0;

  // Rows referenced by non-draft photos, for the resolution checks below.
  const publishedPhotoIds = new Set(nonDraft.map((p) => p.photoId));

  for (const photo of nonDraft) {
    // Display width comes from the stage-2 extractor over the master bytes —
    // planner honesty: capping is computed from the EXTRACTOR record, never
    // from hardcoded sizes (WP-20). An unresolvable master fails closed.
    let displayWidth: number;
    try {
      const record = await extractSourceMetadata(photo.masterFile);
      if (record.displayWidth === null) {
        throw new Error("master has no decodable dimensions");
      }
      displayWidth = record.displayWidth;
    } catch (error) {
      findings.push(
        finding({
          severity: "error",
          rule: SOURCE_UNRESOLVED_RULE,
          message:
            `[${SOURCE_UNRESOLVED_RULE}] Gallery '${photo.galleryId}' photo '${photo.photoId}': ` +
            `master '${photo.masterFile}' cannot be resolved/decoded for the variant-plan join ` +
            `(${error instanceof Error ? error.message : String(error)}) — published content requires ` +
            "a resolvable WEB INGEST MASTER (IMAGE_PIPELINE §11.1; build-blocking)",
          file: photo.masterFile,
          field: `photos[${photo.photoId}]`,
        }),
      );
      photosMissingCoverage += 1;
      continue;
    }

    // The FULL planned variant set at this photo's display width: purposes ×
    // ladder rungs × {AVIF, JPEG}, with D5/§15 source-capping applied — a
    // rung above the source width is NOT an expected variant (no-upscale);
    // the single capped variant at the source width IS required.
    const planned = planDerivatives(options.frozenRecord, photo.photoId, displayWidth);
    let missingForPhoto = 0;
    for (const variant of planned) {
      expectedVariants += 1;
      bump(variant.purpose, "expected");
      const present = rowKeys.has(
        `${photo.photoId}\u0000${variant.purpose}\u0000${variant.format}\u0000${variant.width}`,
      );
      if (present) {
        coveredVariants += 1;
        bump(variant.purpose, "covered");
      } else {
        missingForPhoto += 1;
        findings.push(
          finding({
            severity: "error",
            rule: COVERAGE_RULE,
            message:
              `[13.1#18] Gallery '${photo.galleryId}' photo '${photo.photoId}': derivative coverage ` +
              `incomplete — manifest rows are missing the '${variant.purpose}' '${variant.format}' ` +
              `variant at width ${variant.width}` +
              (variant.width !== variant.requestedWidth
                ? ` (source-capped effective width; requested rung ${variant.requestedWidth})`
                : "") +
              " (IMAGE_PIPELINE §10.3 plan from the FROZEN WP-15 record; every published Photo " +
              "requires its full planned variant set; §11.1 build-blocking)",
            file: "generated/asset-manifest.json",
            field: `derivatives[${photo.photoId}][${variant.purpose}][${variant.format}@${variant.width}]`,
          }),
        );
      }
    }
    if (missingForPhoto === 0) photosWithCompleteCoverage += 1;
    else photosMissingCoverage += 1;
  }

  // ---- §11.1: manifest records for published photos must resolve. ---------
  const hashVerified: Array<{ row: CoverageManifestRow; file: string }> = [];
  if (verifyFiles && rows !== undefined) {
    for (const row of [...rows].sort((a, b) =>
      a.photo_id === b.photo_id
        ? a.public_url < b.public_url
          ? -1
          : a.public_url > b.public_url
            ? 1
            : 0
        : a.photo_id < b.photo_id
          ? -1
          : 1,
    )) {
      // Only records FOR published photos are blocking (§11.3: drafts are
      // excluded; unknown photo ids are not coverage failures — the stale-
      // file story belongs to the pipeline's pruning).
      if (!publishedPhotoIds.has(row.photo_id)) continue;
      // Flat-layout URL shape (fix round 1): the pipeline produces
      // public_url = PUBLIC_URL_BASE + ONE filename segment (§9.3: the URL
      // is embedded verbatim by consumers; §10.1: already final). Nesting
      // would break the release assembly — fail closed, explicitly.
      const name = flatPublicUrlName(row.public_url);
      if (name === null) {
        findings.push(
          finding({
            severity: "error",
            rule: MANIFEST_URL_SHAPE_RULE,
            message:
              `[${MANIFEST_URL_SHAPE_RULE}] Manifest record for '${row.photo_id}' ` +
              `('${row.purpose}' '${row.format}' w${row.width}) has public_url '${row.public_url}' ` +
              `which is not the flat layout '${PUBLIC_URL_BASE}<filename>' (exactly one path segment ` +
              "under the media base) — the release assembly stages generated/media/ flat; a nested " +
              "URL cannot resolve (IMAGE_PIPELINE §9.3/§10.1; §11.1 build-blocking)",
            file: "generated/asset-manifest.json",
            field: `derivatives[${row.photo_id}][${row.purpose}][${row.format}@${row.width}].public_url`,
          }),
        );
        continue;
      }
      const file = join(options.mediaRoot, name);
      if (!existsSync(file) || !statSync(file).isFile()) {
        findings.push(
          finding({
            severity: "error",
            rule: MANIFEST_UNRESOLVED_RULE,
            message:
              `[${MANIFEST_UNRESOLVED_RULE}] Manifest record for '${row.photo_id}' ` +
              `('${row.purpose}' '${row.format}' w${row.width}) references public_url ` +
              `'${row.public_url}' which does not resolve to an existing file under the media root ` +
              "(IMAGE_PIPELINE §8 closure; §11.1 build-blocking)",
            file: "generated/asset-manifest.json",
            field: `derivatives[${row.photo_id}][${row.purpose}][${row.format}@${row.width}].public_url`,
          }),
        );
        continue;
      }
      const live = createHash("sha256").update(await readFile(file)).digest("hex");
      const recorded = row.derivative_hash.replace(/^sha256:/, "");
      if (live !== recorded) {
        findings.push(
          finding({
            severity: "error",
            rule: MANIFEST_UNRESOLVED_RULE,
            message:
              `[${MANIFEST_UNRESOLVED_RULE}] Manifest record for '${row.photo_id}' ` +
              `('${row.purpose}' '${row.format}' w${row.width}) references '${row.public_url}' whose ` +
              `live bytes (sha256 ${live.slice(0, 12)}…) do not match the recorded derivative_hash ` +
              `${row.derivative_hash.slice(0, 19)}… — the manifest is the closure authority; drifted ` +
              "final bytes are a build-blocking defect (IMAGE_PIPELINE §8, §11.1)",
            file: "generated/asset-manifest.json",
            field: `derivatives[${row.photo_id}][${row.purpose}][${row.format}@${row.width}].derivative_hash`,
          }),
        );
        continue;
      }
      hashVerified.push({ row, file });
    }
  }

  // ---- Dimension spot-check (fix round 1, SAMPLED — see
  // CoverageOptions.verifyDimensionsSample for the documented scope): the
  // hash already proves bytes↔record integrity; this catches record
  // metadata drift (e.g. hand-maintained rows with authentic hashes) by
  // decoding up to N sampled files and comparing actual pixels.
  const sampleSize = options.verifyDimensionsSample ?? 0;
  if (sampleSize > 0) {
    for (const { row, file } of hashVerified.slice(0, sampleSize)) {
      let meta: { width: number | null; height: number | null };
      try {
        meta = await sharp(file).metadata();
      } catch (error) {
        findings.push(
          finding({
            severity: "error",
            rule: MANIFEST_DIMENSION_MISMATCH_RULE,
            message:
              `[${MANIFEST_DIMENSION_MISMATCH_RULE}] Manifest record for '${row.photo_id}' ` +
              `('${row.purpose}' '${row.format}' w${row.width}) references '${row.public_url}' whose ` +
              `bytes cannot be decoded for the dimension spot-check ` +
              `(${error instanceof Error ? error.message : String(error)}) — fail closed`,
            file: "generated/asset-manifest.json",
            field: `derivatives[${row.photo_id}][${row.purpose}][${row.format}@${row.width}]`,
          }),
        );
        continue;
      }
      if (meta.width !== row.width || meta.height !== row.height) {
        findings.push(
          finding({
            severity: "error",
            rule: MANIFEST_DIMENSION_MISMATCH_RULE,
            message:
              `[${MANIFEST_DIMENSION_MISMATCH_RULE}] Manifest record for '${row.photo_id}' ` +
              `('${row.purpose}' '${row.format}') claims ${row.width}x${row.height} but ` +
              `'${row.public_url}' decodes to ${String(meta.width)}x${String(meta.height)} — ` +
              "record metadata drifted from the actual pixels (IMAGE_PIPELINE §8, §11.1; build-blocking)",
            file: "generated/asset-manifest.json",
            field: `derivatives[${row.photo_id}][${row.purpose}][${row.format}@${row.width}]`,
          }),
        );
      }
    }
  }

  return {
    ok: findings.length === 0,
    findings,
    expectedVariants,
    coveredVariants,
    photosWithCompleteCoverage,
    photosMissingCoverage,
    perPurpose,
  };
}

// ---------------------------------------------------------------------------
// CLI — media:coverage
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.info(
    [
      "Usage: coverage.ts [--content-root <dir>] [--manifest <file>] [--media-root <dir>]",
      "                   [--gallery <id>]... [--json]",
      "",
      "Derivative coverage validation (IMAGE_PIPELINE §8 closure, §11.1): joins the",
      "content graph (published galleries/photos; drafts excluded per §11.3) with",
      "the FROZEN WP-15 variant plan (source-capping honored) and the asset manifest.",
      "Exit 0 = covered; exit 1 = any build-blocking finding.",
    ].join("\n"),
  );
}

const invokedDirectly =
  process.argv[1] !== undefined && basename(process.argv[1]) === "coverage.ts";
if (invokedDirectly) {
  const { loadDerivativeRecord } = await import("./derive");
  const argv = process.argv.slice(2);
  let contentRoot = process.cwd();
  let manifestPath = "";
  let mediaRoot = "";
  const galleries: string[] = [];
  let asJson = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const value = (): string => {
      if (i + 1 >= argv.length) {
        console.error(`coverage: Missing value for ${arg}`);
        process.exit(1);
      }
      return argv[++i] as string;
    };
    if (arg === "--content-root") contentRoot = value();
    else if (arg === "--manifest") manifestPath = value();
    else if (arg === "--media-root") mediaRoot = value();
    else if (arg === "--gallery") galleries.push(value());
    else if (arg === "--json") asJson = true;
    else if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else {
      console.error(`coverage: Unknown argument '${arg}' (see --help)`);
      process.exit(1);
    }
  }
  manifestPath ||= join(contentRoot, "generated", "asset-manifest.json");
  mediaRoot ||= join(contentRoot, "generated", "media");

  const frozen = await loadDerivativeRecord();
  const photos = collectContentPhotos(contentRoot, {
    ...(galleries.length > 0 ? { galleries } : {}),
  });
  const document = await loadManifest(manifestPath);
  const result = await validateCoverage({
    publishedPhotos: photos,
    manifest: document?.rows,
    ...(document?.record !== undefined ? { manifestRecord: document.record } : {}),
    mediaRoot,
    frozenRecord: frozen,
    verifyDimensionsSample: DEFAULT_DIMENSION_SAMPLE,
  });

  if (asJson) {
    console.info(JSON.stringify(result, null, 2));
  } else {
    for (const f of result.findings) {
      console.error(`${f.severity.toUpperCase()} [${f.rule}] ${f.file ?? ""}${f.field ? ` (${f.field})` : ""}: ${f.message.replace(/^\[[^\]]+\]\s*/, "")}`);
    }
    console.info(
      `[wp23] coverage ${result.ok ? "OK" : "FAILED"} — ` +
        `${result.coveredVariants}/${result.expectedVariants} expected variants, ` +
        `${result.photosWithCompleteCoverage} complete / ${result.photosMissingCoverage} incomplete photo(s)`,
    );
  }
  process.exit(result.ok ? 0 : 1);
}
