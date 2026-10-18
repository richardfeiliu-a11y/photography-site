// WP-17 — source discovery walker over the WEB INGEST MASTER root
// (IMAGE_PIPELINE.md pipeline stages 1–2: READ / DECODE contract).
//
// Authority:
//   - IMAGE_PIPELINE.md §3 (single media root: media/ingest-masters/{gallery}/...;
//     source_ref is relative; the physical mount/symlink is ENVIRONMENT
//     configuration — authored YAML never carries absolute paths, so the root is
//     an option here, defaulting to the canonical repo path)
//   - IMAGE_PIPELINE.md §14 (supported ingest formats — the matrix below is
//     pinned by tests/unit/ingest-format-matrix.test.ts and must match §14
//     exactly: JPEG Yes/primary, PNG Limited, TIFF Limited, RAW No, HEIC No.
//     NOTE: the WP-17 task parenthetical said "RAW/TIFF rejected"; §14 is the
//     frozen authority and lists TIFF as "Limited" (the same tier as PNG), so
//     TIFF is accepted with the "limited" tier. RAW and HEIC/HEIF are rejected
//     with rule-precise errors without any decode attempt.)
//   - IMAGE_PIPELINE.md §11.1 (decode error: a WEB INGEST MASTER that cannot be
//     decoded or is corrupt is a build-blocking failure — ruled here, judged by
//     scripts/media/validate-sources.ts)
//   - IMAGE_PIPELINE.md §4.3 / §9.1 (SHA-256 content fingerprints are the
//     pipeline's identity inputs; §11.2 duplicate-fingerprint warnings join on
//     them)
//
// What this module does (content-agnostic — it owns NO gallery knowledge):
//   1. Walks the canonical root deterministically (sorted paths, stable record
//      order; no timestamps — the record is byte-stable for a given tree).
//   2. Classifies every file by extension against the §14 matrix.
//   3. For SUPPORTED formats performs a REAL decode check via sharp
//      (`failOn: "truncated"` + metadata + full-pixel stats()), which catches
//      corrupt/truncated files rather than trusting extensions — VERIFIED for
//      JPEG/PNG; best-effort for TIFF (libvips tolerates small tail loss; §14
//      tier unchanged). A file whose decoded content format disagrees with
//      its extension is also a decode error (mislabeled bytes are corrupt for
//      pipeline purposes). A dangling symlink inside the tree is recorded as
//      a structured 11.1:decode-error entry, never a crash.
//   4. Computes size + SHA-256 for every file (including rejected/corrupt
//      ones) so duplicate fingerprints (§11.2) can be joined downstream.
//
// The record is consumed by scripts/media/validate-sources.ts (the §11.1
// fail-closed join with WP-13's content graph) and later by the P3 pipeline
// (WP-18 metadata extraction feeds off the same discovered masters).
//
// CLI:
//   node --experimental-strip-types [--import ./scripts/validate/register-ts-resolve.mjs] \
//        scripts/media/discover.ts [--root <dir>] [--json]
// Exit code is always 0: discovery RECORDS, it does not judge — the
// validation module owns severity (fail-closed) semantics.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

// ---------------------------------------------------------------------------
// IMAGE_PIPELINE.md §14 — supported ingest format matrix (pinned by test)
// ---------------------------------------------------------------------------

export type SupportedIngestFormat = "jpeg" | "png" | "tiff";

/** One IMAGE_PIPELINE.md §14 row, as enforced by the discovery walker. */
export interface IngestFormatRow {
  format: "jpeg" | "png" | "tiff" | "raw" | "heic";
  /** File extensions (lowercase) mapped to this row. */
  extensions: ReadonlyArray<string>;
  /** Acceptable for web ingest at all? */
  supported: boolean;
  /** §14 support tier: "Yes (primary)" → primary; "Limited" → limited. */
  tier: "primary" | "limited" | null;
  /** Rule-precise error token for rejected rows (null for supported rows). */
  rule: string | null;
  /** Human-readable §14 note. */
  note: string;
}

/**
 * The five §14 rows, exactly. RAW extensions: NEF, CR2, ARW, etc. (the §14
 * row is open-ended — "RAW (NEF, CR2, ARW, etc.)" — so every common camera
 * RAW container is mapped here). Unknown extensions are rejected as
 * 14:format-not-supported (no §14 row = not supported).
 */
export const INGEST_FORMAT_MATRIX: Readonly<
  Record<"jpeg" | "png" | "tiff" | "raw" | "heic", IngestFormatRow>
> = {
  jpeg: {
    format: "jpeg",
    extensions: ["jpg", "jpeg"],
    supported: true,
    tier: "primary",
    rule: null,
    note: "Yes (primary) — recommended web ingest format (IMAGE_PIPELINE §14)",
  },
  png: {
    format: "png",
    extensions: ["png"],
    supported: true,
    tier: "limited",
    rule: null,
    note: "Limited — rarely used in photography workflows (IMAGE_PIPELINE §14)",
  },
  tiff: {
    format: "tiff",
    extensions: ["tif", "tiff"],
    supported: true,
    tier: "limited",
    rule: null,
    note: "Limited — large files; export to JPEG for web ingest (IMAGE_PIPELINE §14)",
  },
  raw: {
    format: "raw",
    extensions: [
      "nef", "cr2", "cr3", "arw", "dng", "raf", "orf", "rw2", "nrw", "srw",
      "raw", "kdc", "dcr", "pef", "3fr", "fff", "iiq", "gpr",
    ],
    supported: false,
    tier: null,
    rule: "14:raw-not-supported",
    note: "No (unless benchmarked) — keep as archival; export to JPEG for web ingest (IMAGE_PIPELINE §14)",
  },
  heic: {
    format: "heic",
    extensions: ["heic", "heif"],
    supported: false,
    tier: null,
    rule: "14:heic-not-supported",
    note: "No — license complexity, limited toolchain support (IMAGE_PIPELINE §14)",
  },
} as const;

export interface IngestFormatClassification {
  format: "jpeg" | "png" | "tiff" | "raw" | "heic" | "unknown";
  supported: boolean;
  tier: "primary" | "limited" | null;
  /** Rejection rule token for unsupported classifications, else null. */
  rule: string | null;
}

const EXTENSION_INDEX: ReadonlyMap<string, IngestFormatClassification> = (() => {
  const map = new Map<string, IngestFormatClassification>();
  for (const row of Object.values(INGEST_FORMAT_MATRIX)) {
    for (const ext of row.extensions) {
      map.set(ext, { format: row.format, supported: row.supported, tier: row.tier, rule: row.rule });
    }
  }
  return map;
})();

/** Unknown extension → not supported (14:format-not-supported). */
export const UNKNOWN_FORMAT_RULE = "14:format-not-supported";

/** Classifies one master path by extension, case-insensitive (§14 matrix). */
export function classifyIngestFormat(path: string): IngestFormatClassification {
  const dot = path.lastIndexOf(".");
  const slash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  if (dot === -1 || dot < slash || dot === path.length - 1) {
    return { format: "unknown", supported: false, tier: null, rule: UNKNOWN_FORMAT_RULE };
  }
  const ext = path.slice(dot + 1).toLowerCase();
  return EXTENSION_INDEX.get(ext) ?? {
    format: "unknown",
    supported: false,
    tier: null,
    rule: UNKNOWN_FORMAT_RULE,
  };
}

// ---------------------------------------------------------------------------
// Discovery record
// ---------------------------------------------------------------------------

/** A supported master that decoded cleanly. */
export interface DiscoveredMaster {
  /** Path relative to the discovery root, POSIX separators, sorted order. */
  path: string;
  /** File size in bytes. */
  size: number;
  /** SHA-256 of the file bytes (§9.1 fingerprint input; §11.2 duplicate join). */
  sha256: string;
  format: SupportedIngestFormat;
  tier: "primary" | "limited";
  /** Decoded intrinsic width/height (null if sharp metadata did not supply). */
  width: number | null;
  height: number | null;
}

/** A file the discovery walker could not admit (§14 rejection or decode error). */
export interface DiscoveryIssueRecord {
  path: string;
  size: number;
  /** SHA-256 when computable (always, unless the file vanished mid-walk). */
  sha256: string | null;
  /** "14:raw-not-supported" | "14:heic-not-supported" | "14:format-not-supported" | "11.1:decode-error" */
  rule: string;
  message: string;
}

/** The complete, deterministic discovery record for one root. */
export interface DiscoveryRecord {
  /** Resolved absolute root that was walked. */
  root: string;
  /** Supported masters that decoded cleanly, sorted by path. */
  files: DiscoveredMaster[];
  /** §14 rejections (no decode attempted), sorted by path. */
  rejected: DiscoveryIssueRecord[];
  /** Supported-format files that failed the decode check, sorted by path. */
  decodeErrors: DiscoveryIssueRecord[];
}

/**
 * DECODE_CHECK_NOTE explains the strictness choice (documented contract).
 * Scope is HONEST and measured: strict rejection of truncated bytes is
 * VERIFIED for JPEG and PNG (including header-intact tail truncation, which
 * only the full pixel decode surfaces). For TIFF the check is best-effort:
 * libvips tolerates small tail loss on large TIFFs (a 3000×2000 TIFF with
 * 0.5% of its tail removed passes metadata + stats() cleanly), so truncation
 * there is NOT guaranteed to be caught. TIFF's admitted tier is unchanged
 * (§14 is frozen: Limited). Anything the check DOES catch is still a
 * structured 11.1:decode-error entry.
 */
export const DECODE_CHECK_NOTE =
  "Decode check = sharp metadata + FULL pixel decode (stats) with failOn:'truncated'. " +
  "Verified to reject truncated/corrupt bytes for JPEG/PNG (even when the header still " +
  "parses); best-effort for TIFF (libvips tolerates small tail loss). " +
  "(IMAGE_PIPELINE §11.1 decode error.)";

interface WalkedFile {
  /** Absolute path. */
  absolute: string;
  /** POSIX-relative path from the root. */
  path: string;
  size: number;
}

interface WalkResult {
  files: WalkedFile[];
  /** Entries whose stat failed (e.g. dangling symlinks), pre-validated records. */
  statErrors: DiscoveryIssueRecord[];
}

function walkRoot(rootPath: string): WalkResult {
  const files: WalkedFile[] = [];
  const statErrors: DiscoveryIssueRecord[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    )) {
      const child = join(current, entry.name);
      // statSync (not lstat) so a symlinked FILE inside the tree is followed;
      // the root itself may be a mount/symlink (environment configuration).
      if (entry.isDirectory()) {
        walk(child);
        continue;
      }
      if (entry.isFile() || entry.isSymbolicLink()) {
        let st: import("node:fs").Stats;
        try {
          st = statSync(child);
        } catch (cause) {
          // Dangling symlink (or vanished mid-walk): a structured entry, never
          // a throw — the "never throws on file defects" contract holds.
          statErrors.push({
            path: relative(rootPath, child).split(sep).join("/"),
            size: 0,
            sha256: null,
            rule: "11.1:decode-error",
            message: `could not stat master file (dangling symlink or vanished mid-walk): ${
              cause instanceof Error ? cause.message : String(cause)
            }`,
          });
          continue;
        }
        if (!st.isFile()) continue;
        files.push({
          absolute: child,
          path: relative(rootPath, child).split(sep).join("/"),
          size: st.size,
        });
      }
    }
  };
  walk(rootPath);
  const byPath = (a: { path: string }, b: { path: string }): number =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
  return { files: files.sort(byPath), statErrors: statErrors.sort(byPath) };
}

function sha256File(absolute: string): string {
  return createHash("sha256").update(readFileSync(absolute)).digest("hex");
}

/**
 * Strict decode check (IMAGE_PIPELINE §11.1): real metadata read PLUS a full
 * pixel decode. `failOn: "truncated"` makes libvips reject files with
 * truncated/corrupt image data even when the header still parses — VERIFIED
 * for JPEG/PNG. Best-effort for TIFF: libvips tolerates small tail loss on
 * large TIFFs, so truncation there is not guaranteed to be caught (the §14
 * Limited tier is unchanged; measured 2026-08-29 review round).
 */
async function decodeCheck(
  bytes: Buffer,
  expectedFormat: SupportedIngestFormat,
): Promise<{ width: number | null; height: number | null } | string> {
  try {
    const pipeline = sharp(bytes, { failOn: "truncated" });
    const meta = await pipeline.metadata();
    if (meta.format !== expectedFormat) {
      return `decoded content format '${meta.format ?? "unknown"}' does not match the extension-declared format '${expectedFormat}' (mislabeled or corrupt master)`;
    }
    // metadata() alone does not force a full pixel decode — stats() does, and
    // is what actually surfaces tail truncation.
    await sharp(bytes, { failOn: "truncated" }).stats();
    return { width: meta.width ?? null, height: meta.height ?? null };
  } catch (cause) {
    return cause instanceof Error ? cause.message : String(cause);
  }
}

export interface DiscoverOptions {
  /** Parallel decode checks (default 8). Output order is always sorted. */
  concurrency?: number;
}

/**
 * Walks the WEB INGEST MASTER root and produces the discovery record.
 * Content-agnostic and deterministic: identical tree → identical record
 * (sorted paths, no timestamps). Never throws on bad files — every failure
 * becomes a structured record entry (severity is validate-sources' business).
 */
export async function discoverMasters(
  root: string | URL,
  options: DiscoverOptions = {},
): Promise<DiscoveryRecord> {
  const rootPath =
    typeof root === "string" ? resolve(root) : resolve(fileURLToPath(root));
  const concurrency = Math.max(1, options.concurrency ?? 8);
  const walk = walkRoot(rootPath);
  const walked = walk.files;

  const files: DiscoveredMaster[] = [];
  const rejected: DiscoveryIssueRecord[] = [];
  const decodeErrors: DiscoveryIssueRecord[] = [];
  // stat failures (dangling symlinks, vanished files) are already structured
  // decode-error entries — they belong in the record, not in an exception.
  decodeErrors.push(...walk.statErrors);

  // Phase 1 — extension classification (sync, cheap): §14 rejections happen
  // here without any decode attempt.
  const toDecode: Array<{ file: WalkedFile; format: SupportedIngestFormat; tier: "primary" | "limited"; sha256: string }> = [];
  for (const file of walked) {
    const classification = classifyIngestFormat(file.path);
    let sha256: string | null = null;
    try {
      sha256 = sha256File(file.absolute);
    } catch (cause) {
      // unreadable file: record as a decode error (fail-closed class)
      decodeErrors.push({
        path: file.path,
        size: file.size,
        sha256: null,
        rule: "11.1:decode-error",
        message: `could not read master bytes: ${cause instanceof Error ? cause.message : String(cause)}`,
      });
      continue;
    }
    if (!classification.supported) {
      const row = classification.format !== "unknown" ? INGEST_FORMAT_MATRIX[classification.format] : null;
      rejected.push({
        path: file.path,
        size: file.size,
        sha256,
        rule: classification.rule ?? UNKNOWN_FORMAT_RULE,
        message: row
          ? `format '${row.format}' is not supported for web ingest — ${row.note}`
          : `extension '${file.path.slice(file.path.lastIndexOf(".") + 1)}' has no IMAGE_PIPELINE §14 ingest row — not supported`,
      });
      continue;
    }
    toDecode.push({
      file,
      format: classification.format as SupportedIngestFormat,
      tier: classification.tier as "primary" | "limited",
      sha256,
    });
  }

  // Phase 2 — strict decode checks, bounded concurrency, deterministic output.
  let next = 0;
  const failures: DiscoveryIssueRecord[] = [];
  const successes: DiscoveredMaster[] = [];
  async function worker(): Promise<void> {
    while (next < toDecode.length) {
      const item = toDecode[next++]!;
      const bytes = readFileSync(item.file.absolute);
      const result = await decodeCheck(bytes, item.format);
      if (typeof result === "string") {
        failures.push({
          path: item.file.path,
          size: item.file.size,
          sha256: item.sha256,
          rule: "11.1:decode-error",
          message: `master failed decode validation (${item.format}): ${result}`,
        });
      } else {
        successes.push({
          path: item.file.path,
          size: item.file.size,
          sha256: item.sha256,
          format: item.format,
          tier: item.tier,
          width: result.width,
          height: result.height,
        });
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, toDecode.length) }, () => worker()),
  );

  const byPath = (a: { path: string }, b: { path: string }): number =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
  files.push(...successes.sort(byPath));
  decodeErrors.push(...failures);
  // full re-sort: statErrors were pushed before the async failures
  decodeErrors.sort(byPath);
  rejected.sort(byPath);

  return { root: rootPath, files, rejected, decodeErrors };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.info(
    [
      "Usage: discover.ts [--root <dir>] [--json]",
      "",
      "Walks the WEB INGEST MASTER root (default media/ingest-masters) and",
      "prints the discovery record summary (IMAGE_PIPELINE §3/§14).",
      "Exit 0 always — discovery records; validate-sources.ts judges.",
    ].join("\n"),
  );
}

const invokedDirectly =
  process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;
if (invokedDirectly) {
  const argv = process.argv.slice(2);
  let rootOption: string | undefined;
  let asJson = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--root") rootOption = argv[++i];
    else if (arg === "--json") asJson = true;
    else if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else {
      console.error(`discover: Unknown argument '${arg}' (see --help)`);
      process.exit(1);
    }
  }
  discoverMasters(rootOption ?? resolve("media", "ingest-masters"))
    .then((record) => {
      if (asJson) {
        console.info(JSON.stringify(record, null, 2));
        return;
      }
      const byFormat = new Map<string, number>();
      for (const f of record.files) byFormat.set(f.format, (byFormat.get(f.format) ?? 0) + 1);
      console.info(
        `[wp17] discovery — root=${record.root} files=${record.files.length} ` +
          `formats=${JSON.stringify(Object.fromEntries(byFormat))} ` +
          `rejected=${record.rejected.length} decodeErrors=${record.decodeErrors.length}`,
      );
      for (const r of record.rejected) console.warn(`REJECTED [${r.rule}] ${r.path}: ${r.message}`);
      for (const d of record.decodeErrors)
        console.warn(`DECODE-ERROR [${d.rule}] ${d.path}: ${d.message}`);
    })
    .then(
      () => process.exit(0),
      (error) => {
        console.error(
          `discover: fail-closed walk error: ${error instanceof Error ? error.message : String(error)}`,
        );
        process.exit(1);
      },
    );
}
