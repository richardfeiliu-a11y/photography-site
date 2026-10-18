// Build-time atmosphere sidecar CLI (Light Field, Stage 2 data layer).
//
// Per-gallery ambient color for the published cover photo: the mean RGB of a
// 24×24 cover resize → OKLab → OKLCH, clamped so the field never threatens
// text contrast or photo color judgment. The math is a VERBATIM port of the
// design-lab prototype authority (experiments/design-lab/server.mjs L9–39:
// srgbToOklch + ambientFor; see
// docs/proposals/2026-10-04-independent/proposal-light-field/PROPOSAL.md).
//
// Deliberately NOT fail-closed: this is presentation data, not a gate. A
// missing/unreadable sample image — or a missing/unreadable asset manifest —
// leaves the documented default pair in place and the sidecar is still
// written; the reader (src/lib/theme/read.ts) degrades to no ambient color.
// The fallback count is always reported (standalone) or carried in the
// pipeline result, so a degraded run is visible, never silent.
//
// Output is deterministic: sorted-key stable stringify, no timestamps.
//
// Run: npm run media:atmosphere
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { load as parseYaml } from "js-yaml";
import sharp from "sharp";
import { repoRoot } from "../../src/lib/pages/archive-data";
import {
  readAssetManifest,
  resolveManifestPath,
  type ManifestRecordData,
} from "../../src/lib/assets/manifest";
import {
  ATMOSPHERE_RELATIVE_PATH,
  ATMOSPHERE_SIDECAR_SCHEMA,
  type AtmosphereEntry,
  type AtmosphereSidecar,
} from "../../src/lib/theme/atmosphere-contract";

// ---------------------------------------------------------------------------
// The algorithm (verbatim port of experiments/design-lab/server.mjs L9–39)
// ---------------------------------------------------------------------------

/** The documented fallback pair (server.mjs L38) — also the "no sample" answer. */
export const DEFAULT_ATMOSPHERE_ENTRY: AtmosphereEntry = {
  dark: { l: 0.135, c: 0.01, h: 265 },
  light: { l: 0.945, c: 0.008, h: 265 },
};

/** 8-bit sRGB → OKLab → OKLCH (server.mjs L12–24). */
export function srgbToOklch(
  r8: number,
  g8: number,
  b8: number,
): { L: number; C: number; H: number } {
  const toLinear = (v: number): number => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const r = toLinear(r8);
  const g = toLinear(g8);
  const b = toLinear(b8);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const b2 = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  let h = (Math.atan2(b2, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { L, C: Math.hypot(a, b2), H: h };
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const round3 = (v: number): number => Math.round(v * 1000) / 1000;

/**
 * The ambient pair for a cover's channel means (server.mjs L27–36): dark L is
 * squashed into the 0.105–0.175 band, chroma capped at 0.04 (dark) / 0.03
 * (light), light L pinned at 0.945, hue carried through unchanged.
 */
export function ambientFromChannelMeans(r8: number, g8: number, b8: number): AtmosphereEntry {
  const { L, C, H } = srgbToOklch(r8, g8, b8);
  return {
    dark: {
      l: round3(clamp(L * 0.3, 0.105, 0.175)),
      c: round3(Math.min(C * 0.5, 0.04)),
      h: round3(H),
    },
    light: { l: 0.945, c: round3(Math.min(C * 0.7, 0.03)), h: round3(H) },
  };
}

// ---------------------------------------------------------------------------
// Inputs: the published covers + their manifest sampling derivative
// ---------------------------------------------------------------------------

export interface PublishedCover {
  galleryId: string;
  coverPhotoId: string;
}

/**
 * Every PUBLISHED gallery's cover photo id, from content/galleries/<slug>/meta.yaml
 * (server.mjs L54–56 reads the same files the same way). A folder whose meta
 * is unreadable, unparsable, or lacks id/cover_photo_id is skipped — the
 * content graph is validated elsewhere; this generator only samples it.
 */
export function collectPublishedCovers(root: string): PublishedCover[] {
  const galleriesDir = join(root, "content", "galleries");
  if (!existsSync(galleriesDir)) return [];
  const covers: PublishedCover[] = [];
  const folders = readdirSync(galleriesDir, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );
  for (const folder of folders) {
    if (!folder.isDirectory()) continue;
    const metaFile = join(galleriesDir, folder.name, "meta.yaml");
    if (!existsSync(metaFile)) continue;
    let meta: unknown;
    try {
      meta = parseYaml(readFileSync(metaFile, "utf8"));
    } catch {
      continue;
    }
    if (meta === null || typeof meta !== "object") continue;
    const gallery = meta as { id?: unknown; status?: unknown; cover_photo_id?: unknown };
    if (gallery.status !== "published") continue;
    if (typeof gallery.id !== "string" || typeof gallery.cover_photo_id !== "string") continue;
    covers.push({ galleryId: gallery.id, coverPhotoId: gallery.cover_photo_id });
  }
  return covers;
}

/**
 * The manifest records used for sampling, or [] when the manifest is absent /
 * unreadable (every entry then falls back to the default pair — reported).
 */
function loadSampleRecords(root: string): ManifestRecordData[] {
  try {
    return readAssetManifest(resolveManifestPath(root)).manifest.records;
  } catch (error) {
    process.stderr.write(
      `[media:atmosphere] no readable asset manifest at ${resolveManifestPath(root)} ` +
        `(${error instanceof Error ? error.message : String(error)}); ` +
        "every published gallery gets the default ambient pair\n",
    );
    return [];
  }
}

/**
 * The cover's sampling derivative URL — the first avif gallery_display rung at
 * width ≥ 480, else the largest available (server.mjs L58–61 sorts ascending
 * and picks the first ≥ 480).
 */
function pickSampleUrl(records: readonly ManifestRecordData[], coverPhotoId: string): string | null {
  const candidates = records
    .filter(
      (record) =>
        record.photo_id === coverPhotoId &&
        record.format === "avif" &&
        record.purpose === "gallery_display",
    )
    .sort((a, b) => a.width - b.width);
  if (candidates.length === 0) return null;
  const sample = candidates.find((record) => record.width >= 480) ?? candidates[candidates.length - 1];
  return sample === undefined ? null : sample.public_url;
}

/** The sample file's path: generated/ + public_url ("/media/x.avif") — server.mjs L29. */
function samplePath(root: string, publicUrl: string): string {
  return join(root, "generated", `.${publicUrl}`);
}

/** Ambient pair for one cover derivative; a missing/unreadable file → null
 *  (the caller substitutes DEFAULT_ATMOSPHERE_ENTRY). */
async function ambientForSample(root: string, publicUrl: string): Promise<AtmosphereEntry | null> {
  try {
    const stats = await sharp(samplePath(root, publicUrl)).resize(24, 24, { fit: "cover" }).stats();
    const means = stats.channels.map((channel) => channel.mean);
    const [r, g, b] = means;
    if (r === undefined || g === undefined || b === undefined) return null;
    return ambientFromChannelMeans(r, g, b);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Build + write
// ---------------------------------------------------------------------------

export interface AtmosphereBuildResult {
  galleries: number;
  /** Entries computed from a real cover sample. */
  sampled: number;
  /** Entries that fell back to DEFAULT_ATMOSPHERE_ENTRY. */
  fallbacks: number;
  outPath: string;
}

/** Sorted-key stable serialization (mirrors scripts/media/exif-sidecar.ts L16–26). */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Compute the ambient pair of every published gallery cover and write the
 * deterministic sidecar to `generated/atmosphere.json`. Never throws for
 * missing inputs (fallback pairs); only a filesystem write failure escapes.
 */
export async function writeAtmosphereSidecar(root: string): Promise<AtmosphereBuildResult> {
  const records = loadSampleRecords(root);
  const entries: Record<string, AtmosphereEntry> = {};
  let sampled = 0;
  let fallbacks = 0;
  for (const cover of collectPublishedCovers(root)) {
    const publicUrl = pickSampleUrl(records, cover.coverPhotoId);
    const ambient = publicUrl === null ? null : await ambientForSample(root, publicUrl);
    if (ambient === null) {
      entries[cover.galleryId] = DEFAULT_ATMOSPHERE_ENTRY;
      fallbacks++;
    } else {
      entries[cover.galleryId] = ambient;
      sampled++;
    }
  }
  const sidecar: AtmosphereSidecar = { version: ATMOSPHERE_SIDECAR_SCHEMA, entries };
  const outPath = join(root, ATMOSPHERE_RELATIVE_PATH);
  mkdirSync(join(root, "generated"), { recursive: true });
  writeFileSync(outPath, stableStringify(sidecar) + "\n", "utf8");
  return { galleries: Object.keys(entries).length, sampled, fallbacks, outPath };
}

// ---------------------------------------------------------------------------
// CLI — npm run media:atmosphere
// ---------------------------------------------------------------------------

/** Guarded like scripts/media/pipeline.ts: the pipeline imports this module. */
const invokedDirectly =
  process.argv[1] !== undefined && basename(process.argv[1]) === "atmosphere.ts";
if (invokedDirectly) {
  const root = repoRoot();
  writeAtmosphereSidecar(root)
    .then((result) => {
      process.stdout.write(
        `[media:atmosphere] wrote ${result.galleries} gallery ambient pair(s) ` +
          `(${result.sampled} sampled, ${result.fallbacks} default) → ${ATMOSPHERE_RELATIVE_PATH}\n`,
      );
    })
    .catch((cause: unknown) => {
      process.stderr.write(
        `[media:atmosphere] ${cause instanceof Error ? cause.stack ?? cause.message : String(cause)}\n`,
      );
      process.exit(1);
    });
}
