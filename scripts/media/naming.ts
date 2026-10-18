// WP-22 — fingerprint naming + content-addressed publication (IMAGE_PIPELINE.md
// §5 stage 8: HASH / OUTPUT, §9 asset hashing and fingerprint contract).
//
// Authority:
//   - BENCHMARK-OQ01-OQ02.md D8 (FROZEN, user-approved 2026-08-29): the
//     content-addressed digest is the FIRST-16-HEX of SHA-256 over the FINAL
//     SERVED BYTES. The length is read from the record's machine-readable
//     JSON (`digest_hex_characters`) at runtime — never hardcoded here. The
//     digest input is the final bytes ONLY (post WP-21 strip/verify), which
//     embodies the source bytes + every rendering-affecting config value +
//     the toolchain (§9.2 hash-input semantics): any upstream change —
//     corrected master, mutated quality, encoder upgrade — changes the bytes
//     and therefore the URL. Source hash / rendering config / toolchain ID
//     are recorded ALONGSIDE in the manifest (scripts/media/manifest.ts) for
//     provenance audit, not folded into the digest.
//   - IMAGE_PIPELINE §9.3: filenames are fully determined by the manifest;
//     `public_url` is authoritative. CONSUMERS MUST NEVER PARSE FILENAMES —
//     the naming scheme below exists so humans can identify a file, not so
//     code can extract facts from it (pinned by the static grep in
//     tests/unit/naming.test.ts + tests/integration consumers read entries).
//   - IMAGE_PIPELINE §5 stage ordering + WP-18 guard: hash-output is the
//     LAST stage. This module's plan composes WP-21's FINALIZE_STAGE_PLAN
//     (stages 1–6, imported so the plans cannot drift) + "hash-output", and
//     the publish entrypoint REFUSES to run unless the caller supplies a
//     WP-21 finalizeAndVerify report that is ok AND covers every derived
//     source (fail closed, token 9:requires-verified-final-bytes). There is
//     no overlap with WP-21: verification first, fingerprinting strictly
//     after.
//
// Naming scheme (fully determined by manifest fields; no placeholder
// variables):
//
//     {photoId}-{format}-w{width}-{digest16}.{ext}
//
//   - photoId: stable Photo ID, enforced to be a URL-safe path segment
//     (RFC 3986 unreserved characters only — see SAFE_PHOTO_ID_PATTERN), so
//     the filename and the final public_url are byte-identical strings with
//     no percent-encoding; the upstream content schema currently validates
//     Photo ids as non-empty only (possible future hardening upstream).
//   - format:  "avif" | "jpeg" (ext: avif → .avif, jpeg → .jpg, shared with
//     stage 5 via the exported EXTENSIONS map so the two cannot drift).
//   - width:   the ACTUAL output width (requested rung or source-capped
//     width, per WP-20's planner provenance).
//   - digest16: D8 fingerprint over the final served bytes.
//
// The scheme deliberately OMITS the purpose: cross-purpose derivatives from
// the same source at the same width are BYTE-IDENTICAL (both purposes freeze
// the same per-format quality over the same aspect-preserving resize —
// documented in WP-20.md "Cross-purpose byte identity"), so a
// purpose-less name makes the collision policy structural: byte-identical
// files across purposes share ONE final content-addressed file and the
// manifest records EACH purpose referencing that one file's public_url.
// This is expected, not a bug (WP-20.md; IMAGE_PIPELINE §11.2 reserves
// warnings for DISTINCT source files colliding — same-source sharing is by
// construction). Different bytes at the same width (e.g. overview AVIF q55
// vs gallery AVIF q65) produce different digests and therefore different
// names — the digest is the disambiguator.
//
// Move-vs-copy policy: the stage-5 intermediates live in generated/media/
// and are RENAMED in place (same directory, same filesystem — POSIX
// rename(2) is atomic and cannot alter bytes; no duplicate storage). Byte
// identity is proven by construction (the digest is computed from the exact
// file that is renamed) and re-proven by the integration suite, which
// re-reads every final file and matches it against the recorded
// derivative_hash. Publishing is TWO-PHASE and therefore collision-fail-
// closed: every intermediate is hashed and every sharing/collision/drift
// check runs BEFORE the first rename, so a refused run renames nothing.
// It is also ONE-SHOT: the intermediates are consumed by the rename, so
// re-publishing the same derive results fails with 9:intermediate-missing
// (re-derive instead; WP-23 owns regeneration from empty generated/).
//
// Output policy: final files stay under the SAME directory as the stage-5
// intermediates (production: generated/media/, owned by the image pipeline —
// never dist/). Stale content-addressed files from earlier runs with
// different inputs are not managed here; regeneration semantics (including
// rebuild-from-empty-generated/) are WP-23's concern.
import { createHash } from "node:crypto";
import { readFile, rename, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  EXTENSIONS,
  type DerivativeFormat,
  type DerivativeResult,
  type DeriveSourceResult,
  type FrozenDerivativeRecord,
} from "./derive";
import {
  FINALIZE_STAGE_PLAN,
  type FinalizeReport,
  PrivacyVerificationError,
} from "./privacy-check";
import { validateStagePlan, type PipelineStage, type StagePlan } from "./stage-order";

// ---------------------------------------------------------------------------
// Stage plan (stage 8 wiring) + fail-closed rule tokens
// ---------------------------------------------------------------------------

/**
 * The WP-22 naming plan: the stage-1–6 finalize plan (imported so the plans
 * cannot drift) + stage-8 hash-output. Stage-7 embed-output-icc is ABSENT
 * per the WP-16 D10 decision (nothing to embed — WP-21's stage-7 work is the
 * no-ICC verification). hash-output is LAST per the §5 ordering invariant
 * (the digest must reflect every prior transform); the WP-18 guard enforces
 * it (5:hash-last).
 */
export const HASH_STAGE_PLAN: StagePlan = [...FINALIZE_STAGE_PLAN, "hash-output"];

/**
 * The stage-9 rule token: WP-22 refuses to fingerprint/publish unless the
 * WP-21 finalizeAndVerify report is present, ok, and covers every derived
 * source (§9 semantics: the digest is defined over FINAL SERVED BYTES —
 * bytes that failed verification are not final served bytes; IMAGE_PIPELINE
 * §11.1 makes the underlying failure build-blocking).
 */
export const NAMING_INPUT_RULE = "9:requires-verified-final-bytes";

/** Token for a genuine digest collision (same truncated digest, different bytes). */
export const DIGEST_COLLISION_RULE = "9:digest-collision";

/** Token for a photoId that is path-safe but NOT URL-safe (would break public_urls). */
export const UNSAFE_ID_RULE = "9:unsafe-photo-id";

/** Token for a missing/unreadable stage-5 intermediate on (re-)publish. */
export const MISSING_INTERMEDIATE_RULE = "9:intermediate-missing";

/** Fail-closed naming/publication failure; carries rule-precise tokens. */
export class NamingError extends Error {
  /** Rule tokens that fired, e.g. ["9:requires-verified-final-bytes"]. */
  readonly rules: string[];

  constructor(message: string, rules: readonly string[] = [NAMING_INPUT_RULE]) {
    super(message);
    this.name = "NamingError";
    this.rules = [...rules];
  }
}

/**
 * Validate a naming stage plan through the WP-18 guard. Defaults to the
 * production plan; a drifted/mis-ordered plan (hash before strip, hash not
 * last, …) fails closed with the guard's rule-precise tokens BEFORE any I/O.
 */
export function validateNamingStagePlan(plan: readonly unknown[] = HASH_STAGE_PLAN): PipelineStage[] {
  const result = validateStagePlan(plan);
  if (!result.ok) {
    throw new NamingError(
      `naming stage plan rejected by validateStagePlan: ${result.issues
        .map((issue) => `${issue.rule} — ${issue.message}`)
        .join(" | ")}`,
      result.issues.map((issue) => issue.rule),
    );
  }
  return result.plan;
}

/** Convenience wrapper: the validated naming stage plan (throws on drift). */
export function namingStagePlan(): PipelineStage[] {
  return validateNamingStagePlan();
}

// ---------------------------------------------------------------------------
// Digest + fingerprint (D8)
// ---------------------------------------------------------------------------

/** Full SHA-256 of the exact bytes, lowercase hex (64 chars). */
export function sha256Hex(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * The D8 fingerprint: the FIRST `hexChars` hex characters of SHA-256 over
 * the exact final served bytes. `hexChars` comes from the frozen record
 * (D8 = 16) via resolveDigestHexChars — never hardcoded.
 */
export function fingerprintHex(bytes: Buffer, hexChars: number): string {
  return sha256Hex(bytes).slice(0, hexChars);
}

/**
 * Resolve the D8 digest length from the FROZEN record's machine-readable
 * JSON (`digest_hex_characters`), fail-closed: it must be an integer in
 * [8, 64] (enough to avoid collisions at the expected derivative count per
 * §9.1, and never longer than the underlying SHA-256).
 */
export function resolveDigestHexChars(record: FrozenDerivativeRecord): number {
  const value = record.raw["digest_hex_characters"];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 8 || value > 64) {
    throw new NamingError(
      `frozen record field 'digest_hex_characters' must be an integer in [8, 64] (got ${String(value)}) — ` +
        "the D8 digest length may only come from the FROZEN BENCHMARK-OQ01-OQ02 record",
      [NAMING_INPUT_RULE],
    );
  }
  return value;
}

// ---------------------------------------------------------------------------
// Content-addressed naming
// ---------------------------------------------------------------------------

/** The final public URL base: the release assembly stages generated/media/ at /media/. */
export const PUBLIC_URL_BASE = "/media/";

/**
 * The EXACT photoId pattern enforced for content-addressed names: RFC 3986
 * unreserved characters only (ALPHA / DIGIT / "-" / "." / "_" / "~"), which
 * is BOTH a safe single filesystem path segment AND a URL-safe path segment
 * without percent-encoding. The upstream content schema (content-schemas.ts)
 * currently validates Photo ids as non-empty only; if that hardens, this
 * pattern is the final gate that keeps public_url bytes identical to the
 * filename.
 */
const SAFE_PHOTO_ID_PATTERN = /^[A-Za-z0-9._~-]+$/;

function assertSafePhotoId(photoId: string): void {
  if (!SAFE_PHOTO_ID_PATTERN.test(photoId) || photoId === "." || photoId === "..") {
    throw new NamingError(
      `${UNSAFE_ID_RULE}: photoId '${photoId}' is not a URL-safe path segment ` +
        `(must match ${String(SAFE_PHOTO_ID_PATTERN)} and not be '.' or '..') — ` +
        "a non-URL-safe id would produce broken final public_urls",
      [UNSAFE_ID_RULE],
    );
  }
}

/**
 * The content-addressed final filename:
 *   {photoId}-{format}-w{width}-{digest}.{ext}
 * Fully determined by the manifest entry fields (photo_id, format, width,
 * digest) — §9.3: consumers read manifest entries, never filenames.
 */
export function contentAddressedFileName(parts: {
  photoId: string;
  format: DerivativeFormat;
  width: number;
  digest: string;
}): string {
  assertSafePhotoId(parts.photoId);
  if (!/^[0-9a-f]{8,64}$/.test(parts.digest)) {
    throw new NamingError(
      `digest '${parts.digest}' is not lowercase hex in [8, 64] chars — refusing to build a content-addressed name`,
      [NAMING_INPUT_RULE],
    );
  }
  if (!Number.isInteger(parts.width) || parts.width < 1) {
    throw new NamingError(`width ${String(parts.width)} is not a positive integer`);
  }
  const ext = EXTENSIONS[parts.format];
  if (ext === undefined) {
    throw new NamingError(`unknown derivative format '${String(parts.format)}'`);
  }
  return `${parts.photoId}-${parts.format}-w${parts.width}-${parts.digest}.${ext}`;
}

// ---------------------------------------------------------------------------
// Publication (stage 8): verify-gated rename over final bytes
// ---------------------------------------------------------------------------

/** One published derivative: the manifest record's factual input. */
export interface PublishedDerivative {
  photoId: string;
  purpose: string;
  format: DerivativeFormat;
  /** The record's ladder rung this variant serves (provenance). */
  requestedWidth: number;
  /** Actual output width (requested rung or source-capped width). */
  width: number;
  height: number;
  quality: number;
  progressive: boolean;
  /** True when the requested rung exceeded the source width (WP-20 capping). */
  capped: boolean;
  /** Encoded byte count of the final served file. */
  bytes: number;
  /** SHA-256 of the WEB INGEST MASTER bytes (derive-time record). */
  sourceHash: string;
  /** Full SHA-256 of the final served bytes ("sha256:<64 hex>"). */
  derivativeHash: string;
  /** The D8 fingerprint (first-16-hex of derivativeHash per the record). */
  digest: string;
  /** Final public URL path (no later transformation; §10.1). */
  publicUrl: string;
  /** Absolute path of the final content-addressed file. */
  file: string;
}

export interface PublishResult {
  /** One entry per (photo, purpose, format, width) derivative of the run. */
  published: PublishedDerivative[];
  /** Distinct final content-addressed files (≤ published.length: sharing). */
  finalFiles: number;
  /** Redundant byte-identical intermediate duplicates removed after verify. */
  removedDuplicateIntermediates: number;
}

export interface PublishOptions {
  /**
   * The WP-21 finalizeAndVerify report over the SAME derive results. The
   * stage refuses to run without it, if it is not ok, or if it does not
   * cover every derived source (token 9:requires-verified-final-bytes).
   */
  report: FinalizeReport;
  /** D8 digest length (resolveDigestHexChars over the frozen record). */
  digestHexChars: number;
  /** Public URL base; the frozen production value is PUBLIC_URL_BASE. */
  publicBase?: string;
}

function assertReportCovers(deriveResults: readonly DeriveSourceResult[], report: FinalizeReport): void {
  const bySource = new Map(report.sources.map((source) => [source.photoId, source]));
  for (const derived of deriveResults) {
    const covered = bySource.get(derived.photoId);
    if (covered === undefined) {
      throw new NamingError(
        `${NAMING_INPUT_RULE}: the WP-21 finalize report does not cover derived source ` +
          `'${derived.photoId}' — fingerprinting unverified bytes is forbidden (fingerprint ` +
          "operates ONLY on files that passed finalizeAndVerify; IMAGE_PIPELINE §9 / §11.1)",
      );
    }
    if (covered.derivativeFiles !== derived.derivatives.length) {
      throw new NamingError(
        `${NAMING_INPUT_RULE}: the WP-21 finalize report counts ${covered.derivativeFiles} derivative ` +
          `file(s) for '${derived.photoId}' but the derive results carry ${derived.derivatives.length} — ` +
          "refusing to publish a partially verified set",
      );
    }
  }
}

/**
 * Pipeline stage 8 over WP-20 derive results that have PASSED WP-21
 * finalizeAndVerify (IMAGE_PIPELINE §5 stage 8, §9):
 *   1. Validate the naming stage plan through the WP-18 guard (hash-output
 *      last; BEFORE any I/O).
 *   2. Fail closed unless the WP-21 report is present, ok, and covers every
 *      derived source — fingerprinting runs ONLY on final served bytes.
 *   3. For every final derivative: read the exact bytes, compute the full
 *      SHA-256 + the D8 first-16-hex fingerprint, build the content-addressed
 *      name, and RENAME the file in place (atomic; bytes untouched).
 *   4. Byte-identical cross-purpose intermediates collapse onto ONE final
 *      file: the first occurrence is renamed, later duplicates are
 *      hash-verified EQUAL and unlinked (a mismatch is a genuine digest
 *      collision → fail closed, token 9:digest-collision).
 * Returns the per-derivative facts the manifest writer records.
 */
export async function publishDerivatives(
  deriveResults: readonly DeriveSourceResult[],
  options: PublishOptions,
): Promise<PublishResult> {
  // (1) Stage-order guard BEFORE any I/O — a drifted plan cannot publish.
  validateNamingStagePlan();

  // (2) Verification gate: WP-21 strictly before WP-22 (no stage overlap).
  if (options.report === undefined) {
    throw new NamingError(
      `${NAMING_INPUT_RULE}: no WP-21 finalizeAndVerify report supplied — the naming stage refuses ` +
        "to fingerprint bytes that have not passed final verification (IMAGE_PIPELINE §9 over " +
        "FINAL SERVED BYTES)",
    );
  }
  if (!options.report.ok) {
    const findings = options.report.findings.length;
    const masterIssues = options.report.masterIssues.length;
    throw new NamingError(
      `${NAMING_INPUT_RULE}: WP-21 finalize verification FAILED (${findings} privacy finding(s), ` +
        `${masterIssues} master-guard issue(s), ${options.report.filesScanned} file(s) scanned) — ` +
        "the naming stage refuses to run: fingerprints/manifest entries may only be built over " +
        "files that passed finalizeAndVerify (IMAGE_PIPELINE §9 + §11.1, build-blocking)",
    );
  }
  assertReportCovers(deriveResults, options.report);

  const publicBase = options.publicBase ?? PUBLIC_URL_BASE;

  // (3) PHASE 1 — hash EVERY intermediate BEFORE any rename (fail closed):
  // collisions, drifted byte counts and missing files are detected with the
  // intermediates still in place, so a refused run renames NOTHING.
  interface HashedDerivative {
    derived: DeriveSourceResult;
    derivative: DerivativeResult;
    name: string;
    digest: string;
    fullHash: string;
  }
  const hashed: HashedDerivative[] = [];
  /** target name → full SHA-256 of the first occurrence (sharing check). */
  const hashByTarget = new Map<string, string>();

  for (const derived of deriveResults) {
    for (const derivative of derived.derivatives) {
      let bytes: Buffer;
      try {
        bytes = await readFile(derivative.file);
      } catch (error) {
        throw new NamingError(
          `${MISSING_INTERMEDIATE_RULE}: intermediate derivative '${derivative.file}' is missing or ` +
            `unreadable (${(error as NodeJS.ErrnoException).code ?? String(error)}) — publishing is a ` +
            "ONE-SHOT rename of WP-20's stage-5 intermediates; re-run the derive stage (WP-23 owns " +
            "regeneration from empty generated/) instead of re-publishing consumed intermediates",
          [MISSING_INTERMEDIATE_RULE],
        );
      }
      const fullHash = sha256Hex(bytes);
      if (bytes.length !== derivative.bytes) {
        throw new NamingError(
          `final file '${derivative.file}' is ${bytes.length} bytes but the derive result recorded ` +
            `${derivative.bytes} — refusing to fingerprint bytes that drifted after derivation`,
        );
      }
      const digest = fullHash.slice(0, options.digestHexChars);
      const name = contentAddressedFileName({
        photoId: derived.photoId,
        format: derivative.format,
        width: derivative.width,
        digest,
      });

      const existingHash = hashByTarget.get(name);
      if (existingHash !== undefined && existingHash !== fullHash) {
        // Cross-purpose name shared by DIFFERENT bytes: a genuine truncated-
        // digest collision, never a silent overwrite. Thrown in phase 1 —
        // nothing has been renamed yet.
        throw new NamingError(
          `${DIGEST_COLLISION_RULE}: intermediates for '${derived.photoId}' map to content-addressed ` +
            `name '${name}' but their bytes differ (sha256 ${existingHash} vs ${fullHash}) — ` +
            "genuine D8 collision, fail closed",
          [DIGEST_COLLISION_RULE],
        );
      }
      hashByTarget.set(name, fullHash);
      hashed.push({ derived, derivative, name, digest, fullHash });
    }
  }

  // (4) PHASE 2 — all digests agree: rename first occurrences to their
  // content-addressed names (POSIX rename within the same directory: atomic,
  // bytes untouched) and unlink byte-identical cross-purpose duplicates,
  // recording EVERY purpose against the ONE shared final file (WP-20.md).
  const published: PublishedDerivative[] = [];
  /** target name → first occurrence's PublishedDerivative (sharing entry). */
  const entryByTarget = new Map<string, PublishedDerivative>();
  let removedDuplicates = 0;
  let finalFiles = 0;

  for (const { derived, derivative, name, digest, fullHash } of hashed) {
    const first = entryByTarget.get(name);
    if (first !== undefined) {
      await unlink(derivative.file);
      removedDuplicates += 1;
      published.push({
        ...first,
        purpose: derivative.purpose,
        quality: derivative.quality,
        requestedWidth: derivative.requestedWidth,
        capped: derivative.requestedWidth !== derivative.width,
      });
    } else {
      const target = join(dirname(derivative.file), name);
      await rename(derivative.file, target);
      finalFiles += 1;
      const entry: PublishedDerivative = {
        photoId: derived.photoId,
        purpose: derivative.purpose,
        format: derivative.format,
        requestedWidth: derivative.requestedWidth,
        width: derivative.width,
        height: derivative.height,
        quality: derivative.quality,
        progressive: derivative.progressive,
        capped: derivative.requestedWidth !== derivative.width,
        bytes: derivative.bytes,
        sourceHash: derived.sourceSha256,
        derivativeHash: fullHash,
        digest,
        publicUrl: publicBase + name,
        file: target,
      };
      entryByTarget.set(name, entry);
      published.push(entry);
    }
  }

  return { published, finalFiles, removedDuplicateIntermediates: removedDuplicates };
}

// Re-exported so WP-21's error type stays importable from one place for
// callers wiring the full chain (derive → finalize → publish).
export { PrivacyVerificationError };
