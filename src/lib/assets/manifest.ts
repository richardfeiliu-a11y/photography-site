// WP-24 — manifest consumption boundary (Astro build-time).
//
// Authority (consumed, not re-derived):
//   - IMAGE_PIPELINE §10.1: generated/asset-manifest.json is produced BEFORE
//     Astro build; Astro consumes it at BUILD TIME via a typed import
//     boundary; the browser NEVER consumes the manifest at runtime.
//   - IMAGE_PIPELINE §10.2/§10.3 + scripts/media/manifest.ts (WP-22): the
//     document shape written by the pipeline — { envelope: {generated_at},
//     manifest: { schema, record, toolchain, records } } with format-agnostic
//     per-derivative records (photo_id, purpose, format, width, height,
//     public_url, bytes, source_hash, derivative_hash, provenance).
//   - IMAGE_PIPELINE §10.4: selectors expose src (fallback URL), srcset
//     ("url w" descriptors from manifest ENTRIES), a sizes hook accepting
//     layout context (templates supply sizes; the selector NEVER parses
//     filenames), and intrinsic dimensions. The srcset invariant — never
//     regex-replacing digits in filenames — is enforced by the WP-22 grep
//     tripwire (tests/unit/naming.test.ts), extended in WP-24 to forbid
//     parseInt fed from public_url slices.
//   - IMAGE_PIPELINE §13.3 + ADR-026 + BUILD_AND_ROUTING §1 (DAG): the
//     manifest is a BUILD-TIME INPUT that must exist before astro build; the
//     producer-before-consumer invariant is enforced by the WP-24 build gate
//     (scripts/validate/asset-gate.mjs — reusing scripts/media/coverage.ts
//     validateCoverage; the scripts/ → src/lib import direction is the WP-13
//     boundary, src/lib never imports the pipeline).
//   - BUILD_AND_ROUTING §9 (mode semantics): production requires a complete,
//     closure-verified manifest (fail closed); local preview may be
//     incomplete (warn, never fatal).
//
// Zod choice: `z` from "astro/zod" (the single hoisted instance Astro itself
// uses, per the WP-09 convention in src/content-schemas.ts). The schema is
// the CONSUMER-side contract check of the WP-22 document — it never mutates
// or re-serializes the manifest, and it is the same contract the WP-23
// coverage validator treats as the closure authority.
//
// Purpose names are the §10.3 frozen contract, restated here as literals so
// src/ does not import from scripts/media (which drags sharp into the Astro
// build graph); the pipeline-side owner is scripts/media/derive.ts
// DERIVATIVE_PURPOSES. The flat `/media/` URL-shape rule is owned by WP-23
// (11.1:manifest-url-shape) and is not duplicated here — the reader only
// requires absolute public paths, as embedded verbatim by templates.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "astro/zod";
import {
  MANIFEST_RELATIVE_PATH as SHARED_MANIFEST_PATH,
  resolveAssetAuthority,
  isPreviewMode as sharedIsPreviewMode,
} from "./manifest-authority.mjs";

/** The frozen production location of the manifest (IMAGE_PIPELINE §10.1). */
// Single production authority shared with the gates (scripts/validate/).
export const MANIFEST_RELATIVE_PATH: string = SHARED_MANIFEST_PATH;

/** The schema identifier (mirrors scripts/media/manifest.ts MANIFEST_SCHEMA). */
export const MANIFEST_SCHEMA = "quiet-editorial-archive/asset-manifest@1";

/** The §10.3 derivative purposes (frozen contract; owner: WP-20 derive.ts). */
export const DERIVATIVE_PURPOSES = ["gallery_display", "overview", "cover"] as const;
export type DerivativePurpose = (typeof DERIVATIVE_PURPOSES)[number];

/** The fallback format (D7: progressive JPEG fallback; D2: AVIF primary). */
export const FALLBACK_FORMAT = "jpeg";

// ---------------------------------------------------------------------------
// Zod contract (consumer side of the WP-22 document)
// ---------------------------------------------------------------------------

const manifestProvenanceSchema = z.object({
  source_hash: z.string(),
  requested_width: z.number().int(),
  capped: z.boolean(),
  quality: z.number(),
  progressive: z.boolean(),
  toolchain_id: z.string(),
});

const manifestRecordSchema = z.object({
  photo_id: z.string().min(1),
  purpose: z.string().min(1),
  format: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  /** Final public path — embedded VERBATIM (§10.1: no later transformation). */
  public_url: z.string().startsWith("/"),
  bytes: z.number().int().nonnegative(),
  source_hash: z.string(),
  derivative_hash: z.string(),
  provenance: manifestProvenanceSchema,
});

const manifestCoreSchema = z.object({
  schema: z.literal(MANIFEST_SCHEMA),
  record: z.object({ id: z.string(), frozen_at: z.string() }),
  toolchain: z.object({
    node: z.string(),
    sharp: z.string(),
    libvips: z.string(),
    id: z.string(),
  }),
  records: z.array(manifestRecordSchema),
});

const manifestDocumentSchema = z.object({
  envelope: z.object({ generated_at: z.string() }),
  manifest: manifestCoreSchema,
});

export type ManifestRecordData = z.infer<typeof manifestRecordSchema>;
export type ManifestCoreData = z.infer<typeof manifestCoreSchema>;
export type ManifestDocumentData = z.infer<typeof manifestDocumentSchema>;

// ---------------------------------------------------------------------------
// Typed errors — a clear producer-before-consumer failure, NEVER a raw crash
// ---------------------------------------------------------------------------

export class ManifestConsumptionError extends Error {
  /** Rule token, WP-13/WP-23 style ("11.1:manifest-missing", "24:*"). */
  readonly rule: string;

  constructor(rule: string, message: string) {
    super(message);
    this.name = "ManifestConsumptionError";
    this.rule = rule;
  }
}

const REMEDY =
  "The asset manifest is produced by the media pipeline BEFORE astro build " +
  "(BUILD_AND_ROUTING §1 DAG; IMAGE_PIPELINE §10.1, §13.3; ADR-026). Run " +
  "`npm run build:media` (media:pipeline → astro build), or `npm run media:pipeline` " +
  "on its own. The browser must never consume the manifest — Astro consumes it at " +
  "build time only.";

/**
 * Read + validate the asset manifest at BUILD TIME. Synchronous by design
 * (frontmatter consumption). Throws ManifestConsumptionError with a clear
 * producer-before-consumer message when the manifest is missing, unreadable,
 * or violates the contract — never a raw runtime crash.
 */
export function readAssetManifest(
  path: string = resolveManifestPath(),
): ManifestDocumentData {
  if (!existsSync(path)) {
    throw new ManifestConsumptionError(
      "11.1:manifest-missing",
      `[11.1:manifest-missing] producer-before-consumer violation: no asset manifest exists at '${path}' — ` +
        `Astro cannot consume a manifest that does not yet exist. ${REMEDY}`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new ManifestConsumptionError(
      "24:manifest-unloadable",
      `[24:manifest-unloadable] producer-before-consumer violation: the asset manifest at '${path}' is not ` +
        `valid JSON (${error instanceof Error ? error.message : String(error)}). ${REMEDY}`,
    );
  }
  const result = manifestDocumentSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 10)
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new ManifestConsumptionError(
      "24:manifest-unloadable",
      `[24:manifest-unloadable] producer-before-consumer violation: the asset manifest at '${path}' does not ` +
        `satisfy the ${MANIFEST_SCHEMA} contract (${issues}). ${REMEDY}`,
    );
  }
  return result.data;
}

/** The manifest path relative to the repo root (module-located, cwd-safe). */
export function resolveManifestPath(root: string = defaultManifestRoot()): string {
  return join(root, MANIFEST_RELATIVE_PATH);
}

/**
 * Default manifest root resolution, order-documented:
 *   1. module-relative repo root — the source context (vitest, node CLIs,
 *      un-bundled imports);
 *   2. process.cwd() — the bundled context: under `astro build` the module is
 *      relocated into dist/.prerender chunks, so import.meta.url no longer
 *      points at the source tree; astro is invoked from the project root
 *      (package.json scripts), making cwd the honest fallback. When the
 *      module-resolved manifest does not exist but cwd's does, cwd wins — a
 *      probe/alternative-root build still consumes the REAL project manifest
 *      at its canonical location.
 */
function defaultManifestRoot(): string {
  return resolveAssetAuthority().projectRoot;
}

/**
 * Preview-mode detection shared with the production gate
 * (scripts/validate/asset-gate.mjs): preview holds ONLY when
 * ASTRO_PREVIEW_MODE=1 without ASTRO_PRODUCTION_VALIDATE=1 — the same mode
 * semantics as resolveGatePlan. Anything else (explicit production, the
 * fail-closed bare default, or an ambiguous both-set configuration) is
 * production for authority purposes.
 */
export function isPreviewMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return sharedIsPreviewMode(env);
}

/** Module-level cache so one build reads the manifest exactly once. */
let cachedDocument: ManifestDocumentData | undefined;
let cachedPath: string | undefined;

/** Cached build-time read of the canonical manifest location. */
export function getManifest(): ManifestDocumentData {
  let path: string;
  try {
    path = resolveAssetAuthority().consumerManifestPath;
  } catch (error) {
    throw new ManifestConsumptionError(
      "24:manifest-authority",
      `${error instanceof Error ? error.message : String(error)} ${REMEDY}`,
    );
  }
  if (cachedDocument === undefined || cachedPath !== path) {
    cachedDocument = readAssetManifest(path);
    cachedPath = path;
  }
  return cachedDocument;
}

// ---------------------------------------------------------------------------
// Selectors (IMAGE_PIPELINE §10.4) — structured data, never parsed filenames
// ---------------------------------------------------------------------------

/** Layout context supplied by TEMPLATES (the selector never computes sizes). */
export interface LayoutContext {
  /** The CSS `sizes` attribute value, decided by the calling layout. */
  sizes?: string;
}

/** One explicit derivative URL with its intrinsic geometry. */
export interface VariantUrl {
  format: string;
  width: number;
  height: number;
  /** Final public path — embed verbatim. */
  url: string;
}

export interface PurposeVariants {
  purpose: DerivativePurpose | string;
  /** Fallback URL: the widest FALLBACK_FORMAT (D7 jpeg) entry. */
  src: string;
  /** `"url w"` descriptors from manifest entries, ascending width. */
  srcset: string;
  /** Intrinsic dimensions of `src` (CLS prevention, §10.4). */
  width: number;
  height: number;
  /** The layout context's sizes value, echoed for attribute assembly. */
  sizes?: string;
  /** Per-format explicit data (e.g. for <picture><source type=…>). */
  formats: ReadonlyArray<{ format: string; srcset: string; entries: readonly VariantUrl[] }>;
}

export interface PhotoVariants {
  photoId: string;
  gallery_display: PurposeVariants;
  overview: PurposeVariants;
  cover: PurposeVariants;
}

function srcsetFor(entries: readonly ManifestRecordData[]): string {
  return [...entries]
    .sort((a, b) => a.width - b.width)
    .map((r) => `${r.public_url} ${r.width}w`)
    .join(", ");
}

/**
 * Build the §10.4 selector surface for ONE manifest document. Pure — all
 * data comes from the manifest entries; URLs are embedded verbatim; no
 * filename parsing of any kind (the grep tripwire enforces this repo-wide).
 */
export function createPhotoSelectors(document: ManifestDocumentData): {
  getGalleryVariants(photoId: string, layout?: LayoutContext): PurposeVariants;
  getOverviewVariants(photoId: string, layout?: LayoutContext): PurposeVariants;
  getCoverVariants(photoId: string, layout?: LayoutContext): PurposeVariants;
  getPhotoVariants(photoId: string, layout?: LayoutContext): PhotoVariants;
} {
  const byPhoto = new Map<string, ManifestRecordData[]>();
  for (const record of document.manifest.records) {
    const bucket = byPhoto.get(record.photo_id);
    if (bucket === undefined) byPhoto.set(record.photo_id, [record]);
    else bucket.push(record);
  }

  function purposeVariants(
    photoId: string,
    purpose: DerivativePurpose,
    layout?: LayoutContext,
  ): PurposeVariants {
    const records = byPhoto.get(photoId);
    if (records === undefined) {
      throw new ManifestConsumptionError(
        "24:variant-missing",
        `[24:variant-missing] photo '${photoId}' has no manifest records — a template referenced an ` +
          "unknown Photo ID (the manifest is the only URL authority; IMAGE_PIPELINE §10.4). " +
          `Regenerate the manifest if the photo was added after the last pipeline run (${REMEDY})`,
      );
    }
    const forPurpose = records.filter((r) => r.purpose === purpose);
    if (forPurpose.length === 0) {
      throw new ManifestConsumptionError(
        "24:variant-missing",
        `[24:variant-missing] photo '${photoId}' has no '${purpose}' manifest records — the §10.3 purpose ` +
          "is required for published photos (the build-time selector fails closed rather than emit a " +
          "fabricated URL). Regenerate the manifest with the media pipeline",
      );
    }
    const fallback = forPurpose
      .filter((r) => r.format === FALLBACK_FORMAT)
      .sort((a, b) => a.width - b.width);
    const widest = fallback[fallback.length - 1] ?? [...forPurpose].sort((a, b) => a.width - b.width).at(-1)!;
    const formats = [...new Set(forPurpose.map((r) => r.format))].map((format) => {
      const entries = forPurpose
        .filter((r) => r.format === format)
        .map((r): VariantUrl => ({
          format: r.format,
          width: r.width,
          height: r.height,
          url: r.public_url,
        }));
      return { format, srcset: srcsetFor(forPurpose.filter((r) => r.format === format)), entries };
    });
    return {
      purpose,
      src: widest.public_url,
      srcset: srcsetFor(fallback.length > 0 ? fallback : forPurpose),
      width: widest.width,
      height: widest.height,
      ...(layout?.sizes !== undefined ? { sizes: layout.sizes } : {}),
      formats,
    };
  }

  function getPhotoVariants(photoId: string, layout?: LayoutContext): PhotoVariants {
    return {
      photoId,
      gallery_display: purposeVariants(photoId, "gallery_display", layout),
      overview: purposeVariants(photoId, "overview", layout),
      cover: purposeVariants(photoId, "cover", layout),
    };
  }

  return {
    getGalleryVariants: (photoId, layout) => purposeVariants(photoId, "gallery_display", layout),
    getOverviewVariants: (photoId, layout) => purposeVariants(photoId, "overview", layout),
    getCoverVariants: (photoId, layout) => purposeVariants(photoId, "cover", layout),
    getPhotoVariants,
  };
}

// Module-level selector surface over the cached canonical manifest.
const moduleSelectors = {
  getGalleryVariants: (photoId: string, layout?: LayoutContext): PurposeVariants =>
    createPhotoSelectors(getManifest()).getGalleryVariants(photoId, layout),
  getOverviewVariants: (photoId: string, layout?: LayoutContext): PurposeVariants =>
    createPhotoSelectors(getManifest()).getOverviewVariants(photoId, layout),
  getCoverVariants: (photoId: string, layout?: LayoutContext): PurposeVariants =>
    createPhotoSelectors(getManifest()).getCoverVariants(photoId, layout),
  getPhotoVariants: (photoId: string, layout?: LayoutContext): PhotoVariants =>
    createPhotoSelectors(getManifest()).getPhotoVariants(photoId, layout),
};

export const getGalleryVariants = moduleSelectors.getGalleryVariants;
export const getOverviewVariants = moduleSelectors.getOverviewVariants;
export const getCoverVariants = moduleSelectors.getCoverVariants;
export const getPhotoVariants = moduleSelectors.getPhotoVariants;
