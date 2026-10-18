// WP-22 — asset manifest writer (IMAGE_PIPELINE.md §8.3 manifest determinism,
// §10 asset manifest contract; BUILD_AND_ROUTING §10).
//
// Authority:
//   - IMAGE_PIPELINE §8.3: the manifest is serialized in a CANONICAL,
//     reproducible order (sorted keys, stable JSON formatting) and the
//     timestamp envelope is SEPARATED from the deterministic core so that
//     content hashing of the manifest body is stable across rebuilds with
//     identical inputs. This module writes:
//
//         {
//           "envelope": { "generated_at": "…" },      // volatile metadata
//           "manifest": {                              // deterministic core
//             "records": [ … ],
//             "schema":  "quiet-editorial-archive/asset-manifest@1",
//             "toolchain": { "id": "…", "libvips": "…", "sharp": "…", "node": "…" },
//             "record":  { "frozen_at": "…", "id": "BENCHMARK-OQ01-OQ02" }
//           }
//         }
//
//     (The canonical serializer sorts keys recursively, so the document
//     serializes with "envelope" before "manifest" — the §8.3 requirement is
//     the SEPARATION, not a key order; the core is byte-stable across runs.)
//   - IMAGE_PIPELINE §10.2: every record carries photo_id, purpose, format,
//     width, height, public_url, bytes, source_hash, derivative_hash —
//     FORMAT-AGNOSTIC field names (avif/jpeg are values of `format`, never
//     schema variants). Provenance (§9.2: source hash, rendering config
//     including quality/progressive/requested width/cap flag, toolchain ID)
//     rides on the record's `provenance` object; the source hash is
//     additionally mirrored there so each record is self-contained for
//     provenance audit.
//   - IMAGE_PIPELINE §10.1: manifest paths are ALREADY final public paths —
//     no transformation stage exists after manifest generation. public_url
//     is WP-22's content-addressed path (naming.ts PUBLIC_URL_BASE), the
//     release assembly stages generated/media/ at /media/, and consumers
//     (WP-24) embed the entry verbatim — no filename parsing, ever (§10.4).
//   - REPOSITORY_STRUCTURE: generated/ is wholly regenerable and NOT
//     committed; deleting generated/asset-manifest.json is recoverable by
//     rebuild (WP-23 proves it).
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import sharp from "sharp";
import { DERIVATIVE_PURPOSES, type DeriveSourceResult } from "./derive";
import type { PublishedDerivative } from "./naming";

/** The manifest schema identifier (bump on breaking contract changes). */
export const MANIFEST_SCHEMA = "quiet-editorial-archive/asset-manifest@1";

// ---------------------------------------------------------------------------
// Toolchain identifier (§9.2 provenance; IMAGE_PIPELINE §16.3 pinning)
// ---------------------------------------------------------------------------

/** The pinned toolchain versions that influence output bytes. */
export interface ToolchainVersions {
  /** Node.js version (process.version, e.g. "v22.22.3"). */
  node: string;
  /** Sharp package version (e.g. "0.35.4"). */
  sharp: string;
  /** Bundled libvips version (e.g. "8.18.6"). */
  libvips: string;
}

/** Derive the toolchain versions programmatically (never restated by hand). */
export function getToolchain(): ToolchainVersions {
  return {
    node: process.version,
    sharp: sharp.versions.sharp ?? "unknown",
    libvips: sharp.versions.vips ?? "unknown",
  };
}

/**
 * A single stable toolchain identifier string (e.g.
 * "node-v22.22.3+sharp-0.35.4+libvips-8.18.6"). Recorded on every manifest
 * record's provenance and in the core's toolchain block: an encoder/libvips
 * upgrade is a provenance-visible change (and changes output bytes, hence
 * URLs, because the D8 digest runs over the final bytes).
 */
export function toolchainId(versions: ToolchainVersions = getToolchain()): string {
  return `node-${versions.node}+sharp-${versions.sharp}+libvips-${versions.libvips}`;
}

// ---------------------------------------------------------------------------
// Deterministic core
// ---------------------------------------------------------------------------

/** Provenance block per record (IMAGE_PIPELINE §9.2 semantics). */
export interface ManifestProvenance {
  /** Mirrors the record's source_hash — self-contained provenance. */
  source_hash: string;
  /** The record's ladder rung this variant serves (WP-20 provenance). */
  requested_width: number;
  /** True when the requested rung exceeded the source width (no-upscale cap). */
  capped: boolean;
  /** Encoder quality actually used. */
  quality: number;
  /** Progressive encoding flag (JPEG fallback, D7). */
  progressive: boolean;
  /** The toolchain identifier (toolchainId()). */
  toolchain_id: string;
}

/** One per-derivative manifest record (IMAGE_PIPELINE §10.2 + provenance). */
export interface ManifestRecord {
  photo_id: string;
  purpose: string;
  /** Format-agnostic value: "avif" | "jpeg" (D2) — never schema variants. */
  format: string;
  width: number;
  height: number;
  /** Final public URL path — already resolved, no later transformation. */
  public_url: string;
  bytes: number;
  /** Full SHA-256 of the source WEB INGEST MASTER ("sha256:<64 hex>"). */
  source_hash: string;
  /** Full SHA-256 of the final served bytes ("sha256:<64 hex>"). */
  derivative_hash: string;
  provenance: ManifestProvenance;
}

/** The deterministic manifest core (envelope excluded, §8.3). */
export interface ManifestCore {
  schema: string;
  /** The FROZEN decision record the variant plan was parsed from. */
  record: { id: string; frozen_at: string };
  /** Pinned toolchain versions + composed id (provenance). */
  toolchain: ToolchainVersions & { id: string };
  records: ManifestRecord[];
}

/**
 * Build one §10.2 record from a published derivative. Pure.
 */
export function buildManifestRecord(
  entry: PublishedDerivative,
  toolchain: string = toolchainId(),
): ManifestRecord {
  const sourceHash = `sha256:${entry.sourceHash}`;
  return {
    photo_id: entry.photoId,
    purpose: entry.purpose,
    format: entry.format,
    width: entry.width,
    height: entry.height,
    public_url: entry.publicUrl,
    bytes: entry.bytes,
    source_hash: sourceHash,
    derivative_hash: `sha256:${entry.derivativeHash}`,
    provenance: {
      source_hash: sourceHash,
      requested_width: entry.requestedWidth,
      capped: entry.capped,
      quality: entry.quality,
      progressive: entry.progressive,
      toolchain_id: toolchain,
    },
  };
}

const PURPOSE_ORDER: ReadonlyMap<string, number> = new Map(
  DERIVATIVE_PURPOSES.map((purpose, index) => [purpose as string, index]),
);
const FORMAT_ORDER: Readonly<Record<string, number>> = { avif: 0, jpeg: 1 };

/**
 * Build the deterministic core from published derivatives. Records are
 * sorted deterministically (photo_id asc, purpose in the §10.3 canonical
 * order, primary format first, width asc) so two identical runs serialize
 * byte-identically. Pure: no timestamps, no I/O, no environment reads
 * beyond the pinned toolchain versions. `record` is REQUIRED and must come
 * from the parsed FROZEN record (`{id: record.recordId, frozen_at:
 * record.frozenAt}`) — the decision-record identity is never restated here.
 */
export function buildDeterministicCore(
  published: readonly PublishedDerivative[],
  record: { id: string; frozen_at: string },
  versions: ToolchainVersions = getToolchain(),
): ManifestCore {
  const toolchain = toolchainId(versions);
  const records = published
    .map((entry) => buildManifestRecord(entry, toolchain))
    .sort((a, b) => {
      if (a.photo_id !== b.photo_id) return a.photo_id < b.photo_id ? -1 : 1;
      const purposeDelta =
        (PURPOSE_ORDER.get(a.purpose) ?? Number.MAX_SAFE_INTEGER) -
        (PURPOSE_ORDER.get(b.purpose) ?? Number.MAX_SAFE_INTEGER);
      if (purposeDelta !== 0) return purposeDelta;
      const formatDelta =
        (FORMAT_ORDER[a.format] ?? Number.MAX_SAFE_INTEGER) -
        (FORMAT_ORDER[b.format] ?? Number.MAX_SAFE_INTEGER);
      if (formatDelta !== 0) return formatDelta;
      if (a.width !== b.width) return a.width - b.width;
      // Full disambiguation: byte-identical sharing means two records can
      // share photo/purpose/format/width only via distinct digests — order
      // those too so the sort is total and stable.
      if (a.public_url !== b.public_url) return a.public_url < b.public_url ? -1 : 1;
      return 0;
    });
  return {
    schema: MANIFEST_SCHEMA,
    record,
    toolchain: { ...versions, id: toolchain },
    records,
  };
}

// ---------------------------------------------------------------------------
// Canonical serialization + envelope-separated document (§8.3)
// ---------------------------------------------------------------------------

/**
 * Canonical JSON: object keys sorted RECURSIVELY, stable 2-space indent,
 * trailing newline. Arrays preserve order (record order is made
 * deterministic by buildDeterministicCore's total sort). The same logical
 * value always serializes to the same bytes — this is what makes the core
 * content-hashable across rebuilds (§8.3).
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value), null, 2) + "\n";
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

/** SHA-256 of the canonical core serialization (manifest body hash, §8.3). */
export function manifestCoreSha256(core: ManifestCore): string {
  return "sha256:" + createHash("sha256").update(canonicalJson(core)).digest("hex");
}

/** The volatile metadata envelope (timestamps live ONLY here). */
export interface ManifestEnvelope {
  generated_at: string;
}

/** The full manifest document: deterministic core + separated envelope. */
export interface ManifestDocument {
  manifest: ManifestCore;
  envelope: ManifestEnvelope;
}

/** Assemble the envelope-separated document (§8.3). Pure. */
export function buildManifestDocument(core: ManifestCore, envelope: ManifestEnvelope): ManifestDocument {
  return { manifest: core, envelope: { ...envelope } };
}

/**
 * Serialize + write the manifest document canonically. The envelope's
 * generated_at does NOT influence the deterministic core: two runs with
 * identical inputs write byte-identical `manifest` blocks differing only in
 * `envelope.generated_at`.
 */
export async function writeManifest(
  path: string,
  core: ManifestCore,
  envelope: ManifestEnvelope,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, canonicalJson(buildManifestDocument(core, envelope)));
}

// ---------------------------------------------------------------------------
// CLI — media:manifest (pipeline stage 8 entry point)
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.info(
    [
      "Usage: manifest.ts --results <derive-json> [--manifest generated/asset-manifest.json] [--json]",
      "",
      "Pipeline stage 8 (IMAGE_PIPELINE §5, §9, §10): takes WP-20's --json derive",
      "results, RE-RUNS WP-21 finalizeAndVerify over the final bytes (fail closed",
      "— a verification failure refuses the stage with token",
      "9:requires-verified-final-bytes), renames the final derivatives to",
      "content-addressed names (D8, 16-hex over final served bytes) and writes",
      "generated/asset-manifest.json (canonical JSON, timestamp envelope",
      "separated from the deterministic core). The browser never sees the",
      "manifest; Astro consumes it at build time (WP-24).",
    ].join("\n"),
  );
}

const invokedDirectly =
  process.argv[1] !== undefined && process.argv[1]!.endsWith("manifest.ts");
if (invokedDirectly) {
  const { readFile } = await import("node:fs/promises");
  const { resolve } = await import("node:path");
  const { loadDerivativeRecord } = await import("./derive");
  const { finalizeAndVerify } = await import("./privacy-check");
  const { NAMING_INPUT_RULE, publishDerivatives, resolveDigestHexChars } = await import("./naming");

  const argv = process.argv.slice(2);
  let resultsPath: string | undefined;
  let manifestPath = "generated/asset-manifest.json";
  let asJson = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--results") resultsPath = argv[++i] ?? "";
    else if (arg === "--manifest") manifestPath = argv[++i] ?? "";
    else if (arg === "--json") asJson = true;
    else if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else if (arg.startsWith("-")) {
      console.error(`manifest: Unknown argument '${arg}' (see --help)`);
      process.exit(1);
    }
  }
  if (!resultsPath) {
    printUsage();
    process.exit(1);
  }

  const resultsPathAbs = resolve(process.cwd(), resultsPath);
  const results = JSON.parse(await readFile(resultsPathAbs, "utf8")) as DeriveSourceResult[];

  const frozen = await loadDerivativeRecord();
  const report = await finalizeAndVerify(results, { throwOnError: false });
  if (!report.ok) {
    console.error(
      `manifest: WP-21 finalize verification FAILED over ${report.filesScanned} final derivative ` +
        `file(s) — the naming stage refuses to run (${NAMING_INPUT_RULE}; IMAGE_PIPELINE §9 + §11.1)`,
    );
    process.exit(1);
  }

  const publish = await publishDerivatives(results, {
    report,
    digestHexChars: resolveDigestHexChars(frozen),
  });
  const core = buildDeterministicCore(publish.published, {
    id: frozen.recordId,
    frozen_at: frozen.frozenAt,
  });
  await writeManifest(manifestPath, core, { generated_at: new Date().toISOString() });

  if (asJson) {
    console.info(
      JSON.stringify(
        {
          workPackage: "WP-22",
          records: publish.published.length,
          finalFiles: publish.finalFiles,
          removedDuplicateIntermediates: publish.removedDuplicateIntermediates,
          manifest: manifestPath,
          coreSha256: manifestCoreSha256(core),
          toolchain: core.toolchain,
        },
        null,
        2,
      ),
    );
  } else {
    console.info(
      `[wp22] ${publish.published.length} records → ${publish.finalFiles} content-addressed ` +
        `file(s) (${publish.removedDuplicateIntermediates} cross-purpose duplicate(s) collapsed)`,
    );
    console.info(`[wp22] manifest written to ${manifestPath}`);
  }
  process.exit(0);
}
