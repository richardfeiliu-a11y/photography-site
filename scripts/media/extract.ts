// WP-18 — metadata extractor for WEB INGEST MASTERS (IMAGE_PIPELINE.md §5
// stage 2: READ ORIENTATION + ICC + REQUIRED METADATA).
//
// Authority:
//   - IMAGE_PIPELINE.md §5 stage 2 + "Stage ordering invariants": orientation
//     and ICC must be READ before either is consumed or stripped; stripping
//     metadata before color conversion can destroy the ICC profile needed for
//     the correct transform. This module therefore extracts everything the
//     downstream pipeline needs in ONE read of the raw source bytes.
//   - IMAGE_PIPELINE.md §4.3 / §9.1 (SHA-256 content fingerprint is a pipeline
//     identity input; WP-22 joins provenance on it).
//   - IMAGE_PIPELINE.md §7.2 (internal extracted metadata may exist only when
//     necessary for pipeline operation — exactly the four fields below).
//
// Honesty note (the sharp orientation contract): `sharp().metadata()` reports
// the RAW EXIF orientation tag and does NOT auto-apply it — sharp only bakes
// orientation into pixels when `.rotate()` is called (scripts/media/orient.ts,
// the stage-3 choke point). So `width`/`height` below are the STORED intrinsic
// dimensions; `displayWidth`/`displayHeight` are the post-normalization
// dimensions computed from the raw tag (swapped for tags 5–8). Extraction
// never assumes the tag has been applied.
//
// Pure record output: no file is written, no byte of the source is modified
// (pinned by a before/after checksum test). Accepts a filesystem path OR an
// in-memory Buffer (pipeline intermediates).
//
// Record schema (consumed by WP-19 color transform via icc.present/sizeBytes,
// WP-20 derivation via display dims, WP-22 provenance via sha256):
//   {
//     width, height,            // stored intrinsic dimensions (pre-orientation)
//     displayWidth, displayHeight, // after applying the orientation tag
//     orientation,              // raw EXIF tag 1–8; absent → 1
//     icc: { present, sizeBytes }, // source ICC profile presence + byte size
//     format,                   // decoded container format (e.g. "jpeg")
//     sha256                    // hex digest of the exact source bytes
//   }
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

/** The eight EXIF orientation values defined by the EXIF spec. */
export type ExifOrientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** ICC profile facts about the source (no interpretation — presence only). */
export interface SourceIccInfo {
  /** Does the source carry an ICC profile? */
  present: boolean;
  /** Profile byte size when present, else null. */
  sizeBytes: number | null;
}

/** The complete stage-2 metadata record for one source. */
export interface SourceMetadataRecord {
  /** Stored intrinsic width (sharp reports pre-rotation pixel width). */
  width: number | null;
  /** Stored intrinsic height (sharp reports pre-rotation pixel height). */
  height: number | null;
  /** Dimensions after applying the orientation tag (upright intent). */
  displayWidth: number | null;
  displayHeight: number | null;
  /** RAW EXIF orientation tag as stored (1–8); absent → 1. NOT auto-applied. */
  orientation: ExifOrientation;
  /** Source ICC profile presence (+ byte size when present). */
  icc: SourceIccInfo;
  /** Decoded container format (e.g. "jpeg"), null if sharp could not say. */
  format: string | null;
  /** SHA-256 of the exact source bytes (hex). */
  sha256: string;
}

/**
 * Dimensions after applying an EXIF orientation tag: tags 5–8 involve 90°/
 * 270° rotations (or transpositions), which swap width and height; tags 1–4
 * do not. Pure — shared by the extractor and pinned by unit tests.
 */
export function orientedDimensions(
  width: number,
  height: number,
  orientation: ExifOrientation,
): { width: number; height: number } {
  const swaps = orientation >= 5 && orientation <= 8;
  return swaps ? { width: height, height: width } : { width, height };
}

/**
 * Extract the stage-2 metadata record from a WEB INGEST MASTER (or pipeline
 * intermediate Buffer). Reads only — the source bytes are never modified and
 * no file is written. Run this BEFORE any strip (stage ordering invariant:
 * the ICC profile must still be present when the color transform reads it).
 */
export async function extractSourceMetadata(
  source: string | Buffer,
): Promise<SourceMetadataRecord> {
  const bytes = typeof source === "string" ? await readFile(source) : source;
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  // Raw metadata read of the exact source bytes — sharp parses the header +
  // metadata segments WITHOUT decoding or modifying anything.
  const meta = await sharp(bytes).metadata();

  const orientation = normalizeOrientation(meta.orientation);
  const display =
    meta.width !== null && meta.width !== undefined && meta.height !== null && meta.height !== undefined
      ? orientedDimensions(meta.width, meta.height, orientation)
      : { width: null, height: null };

  const iccSize = meta.icc?.length ?? 0;
  return {
    width: meta.width ?? null,
    height: meta.height ?? null,
    displayWidth: display.width,
    displayHeight: display.height,
    orientation,
    icc: { present: iccSize > 0, sizeBytes: iccSize > 0 ? iccSize : null },
    format: meta.format ?? null,
    sha256,
  };
}

/** Absent tag → 1 (upright default); out-of-range garbage → 1 (honest fallback). */
function normalizeOrientation(raw: number | undefined): ExifOrientation {
  if (raw === undefined) return 1;
  if (raw >= 1 && raw <= 8 && Number.isInteger(raw)) return raw as ExifOrientation;
  return 1;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.info(
    [
      "Usage: extract.ts <file-or-dir> [--json]",
      "",
      "Extracts the stage-2 metadata record (dimensions, raw EXIF orientation,",
      "ICC presence + size, SHA-256) for one master file or every *.jpg/*.png/",
      "*.tiff file under a directory (IMAGE_PIPELINE §5 stage 2). Read-only:",
      "no source byte is ever modified.",
    ].join("\n"),
  );
}

const invokedDirectly =
  process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;
if (invokedDirectly) {
  const argv = process.argv.slice(2);
  let target: string | undefined;
  let asJson = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--json") asJson = true;
    else if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else if (arg.startsWith("-")) {
      console.error(`extract: Unknown argument '${arg}' (see --help)`);
      process.exit(1);
    } else {
      target = arg;
    }
  }
  if (!target) {
    printUsage();
    process.exit(1);
  }
  const { readdirSync, statSync } = await import("node:fs");
  const { join, relative, resolve, sep } = await import("node:path");
  const targetPath = resolve(target);
  const st = statSync(targetPath);
  const files: string[] = [];
  if (st.isFile()) {
    files.push(targetPath);
  } else {
    for (const entry of readdirSync(targetPath).sort()) {
      if (/\.(jpe?g|tiff?|png)$/i.test(entry) && statSync(join(targetPath, entry)).isFile()) {
        files.push(join(targetPath, entry));
      }
    }
  }
  // Repo-relative display paths, matching the WP-17 discovery record
  // convention (POSIX separators; absolute fallback when outside cwd so the
  // CLI stays honest about arbitrary targets).
  const displayPath = (absolute: string): string => {
    const rel = relative(process.cwd(), absolute);
    return rel.startsWith("..") ? absolute : rel.split(sep).join("/");
  };
  const records: Array<SourceMetadataRecord & { file: string }> = [];
  for (const file of files) {
    records.push({ file: displayPath(file), ...(await extractSourceMetadata(file)) });
  }
  if (asJson) {
    console.info(JSON.stringify(records, null, 2));
  } else {
    for (const r of records) {
      console.info(
        `[wp18] ${r.file} ${r.width}x${r.height} (display ${r.displayWidth}x${r.displayHeight}) ` +
          `orientation=${r.orientation} icc=${r.icc.present ? `${r.icc.sizeBytes}B` : "none"} ` +
          `format=${r.format} sha256=${r.sha256}`,
      );
    }
  }
  process.exit(0);
}
