// WP-14 — the authoring dry-run: `npm run validate:dry-run`.
//
// A wrapper around the WP-13 validation stack in PREVIEW mode
// (`validate:content --mode preview` semantics) plus an explicit
// SOURCE-EXISTENCE REPORT: every Photo `source_ref` of every Gallery is
// checked against the WEB INGEST MASTER root (media/ingest-masters/, §2) and
// printed as a table, so an author sees exactly which master files the
// archive expects before any build or publish step.
//
// Fail-closed contract (the dry-run is a rehearsal for production, not a
// way to skip it):
//   - Exit 1 on ANY preview-mode validation error (the preview pass is the
//     WP-13 composed archive validation: real schemas + WP-09..12 rules).
//   - Exit 1 on a missing published source EVEN IN PREVIEW — published
//     content is never draft-lenient about WEB INGEST MASTERS (§13.1#1,
//     RISK_REGISTER RISK-001: source_ref drift is caught here, before the
//     build, with a per-photo report instead of a bare rule ID).
//   - The §13.1#1 file check itself is mode-agnostic in the WP-09 validator
//     whenever a master root is supplied, so a missing DRAFT master is also
//     reported (and fails the run); the table marks each row
//     published/draft so the author can tell which gaps block a publish.
//
// Preview WARNINGS (§13.2 draft warnings, absent manifest) are printed and
// never affect the exit code.
//
// Run:
//   npm run validate:dry-run
//   node --experimental-strip-types --import ./scripts/validate/register-ts-resolve.mjs \
//        scripts/validate/dry-run.ts --content-root <dir>
//
// Flags (mirroring scripts/validate/content.ts):
//   --content-root <dir>     Project root containing content/ and media/
//                            (default: process.cwd()).
//   --ingest-root <dir>      WEB INGEST MASTER root (default:
//                            <content-root>/media/ingest-masters).
//   --asset-manifest <file>  Asset-manifest JSON (default:
//                            <content-root>/generated/asset-manifest.json;
//                            absent file → explicit warning, P3 wiring point).
//
// Exit codes: 0 = valid (warnings possible); 1 = any error, a missing
// published source, or a fail-closed load failure.
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { composeArchiveValidation, formatArchiveIssues } from "../../src/lib/validate/production";
import { masterExists } from "../../src/lib/validate/gallery";
import { loadArchive, loadAssetManifest } from "./content.ts";

interface DryRunOptions {
  contentRoot: string;
  ingestRoot: string;
  assetManifestPath: string;
}

function parseArgs(argv: ReadonlyArray<string>): DryRunOptions {
  const options: DryRunOptions = {
    contentRoot: process.cwd(),
    ingestRoot: "",
    assetManifestPath: "",
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = (): string => {
      if (i + 1 >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[++i] as string;
    };
    if (arg === "--content-root") {
      options.contentRoot = value();
    } else if (arg === "--ingest-root") {
      options.ingestRoot = value();
    } else if (arg === "--asset-manifest") {
      options.assetManifestPath = value();
    } else if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument '${arg}' (see --help)`);
    }
  }
  options.ingestRoot ||= resolve(options.contentRoot, "media", "ingest-masters");
  options.assetManifestPath ||= resolve(options.contentRoot, "generated", "asset-manifest.json");
  return options;
}

function printUsage(): void {
  console.info(
    [
      "Usage: dry-run.ts [--content-root <dir>] [--ingest-root <dir>] [--asset-manifest <file>]",
      "",
      "Authoring dry-run (WP-14): preview-mode archive validation plus the",
      "source-existence report over media/ingest-masters/ (§13.1#1).",
      "Exit 0 = valid; exit 1 = errors or a missing published source.",
    ].join("\n"),
  );
}

interface SourceRow {
  galleryId: string;
  galleryStatus: string;
  photoId: string;
  sourceRef: string;
  exists: boolean;
}

/** One table row per authored Photo, in authored order, galleries sorted by ID. */
function sourceRows(
  archive: ReturnType<typeof loadArchive>,
  ingestRoot: string,
): SourceRow[] {
  const rows: SourceRow[] = [];
  const galleries = [...archive.galleries].sort((a, b) =>
    String((a.data as { id?: unknown }).id ?? "") < String((b.data as { id?: unknown }).id ?? "")
      ? -1
      : 1,
  );
  for (const entry of galleries) {
    const data = entry.data as {
      id?: unknown;
      status?: unknown;
      photos?: ReadonlyArray<{ id?: unknown; source_ref?: unknown }>;
    };
    if (!Array.isArray(data.photos)) continue;
    for (const photo of data.photos) {
      if (typeof photo?.id !== "string" || typeof photo?.source_ref !== "string") continue;
      rows.push({
        galleryId: String(data.id ?? "<unknown>"),
        galleryStatus: String(data.status ?? "<unknown>"),
        photoId: photo.id,
        sourceRef: photo.source_ref,
        exists: masterExists(ingestRoot, photo.source_ref),
      });
    }
  }
  return rows;
}

function printTable(rows: ReadonlyArray<SourceRow>): void {
  const w = {
    gallery: Math.max("gallery".length, ...rows.map((r) => r.galleryId.length)),
    status: Math.max("status".length, ...rows.map((r) => r.galleryStatus.length)),
    photo: Math.max("photo".length, ...rows.map((r) => r.photoId.length)),
    source: Math.max("source_ref".length, ...rows.map((r) => r.sourceRef.length)),
  };
  const line = (cells: string[]): string => cells.map((c, i) => c.padEnd([w.gallery, w.status, w.photo, w.source][i])).join("  ");
  console.info("");
  console.info(`source existence report (WEB INGEST MASTERS, §13.1#1):`);
  console.info(line(["gallery", "status", "photo", "source_ref"]));
  console.info(line(["-".repeat(w.gallery), "-".repeat(w.status), "-".repeat(w.photo), "-".repeat(w.source)]));
  for (const row of rows) {
    console.info(
      `${line([row.galleryId, row.galleryStatus, row.photoId, row.sourceRef])}  ${row.exists ? "OK" : "MISSING"}`,
    );
  }
}

export function main(argv: ReadonlyArray<string>): number {
  let options: DryRunOptions;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`dry-run: ${error instanceof Error ? error.message : String(error)}`);
    printUsage();
    return 1;
  }

  console.info(
    `[wp14] authoring dry-run — preview validation + source-existence report content-root=${options.contentRoot} ingest-root=${options.ingestRoot}`,
  );

  let archive: ReturnType<typeof loadArchive>;
  try {
    archive = loadArchive(options.contentRoot);
  } catch (error) {
    console.error(
      `dry-run: fail-closed load error: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return 1;
  }

  const manifest = loadAssetManifest(options.assetManifestPath);
  const result = composeArchiveValidation(archive, {
    mode: "preview",
    ingestRoot: options.ingestRoot,
    ...(manifest !== undefined ? { assetManifest: manifest } : {}),
  });

  // The explicit per-photo source report — printed even when validation
  // fails, so the author sees the full picture in one run.
  const rows = sourceRows(archive, options.ingestRoot);
  printTable(rows);
  const publishedMissing = rows.filter((r) => r.galleryStatus === "published" && !r.exists);

  for (const line of formatArchiveIssues(result.errors)) console.error(line);
  for (const line of formatArchiveIssues(result.warnings)) console.warn(line);

  console.info("");
  console.info(
    `sources: ${rows.length} checked, ${publishedMissing.length} published missing (fail-closed even in preview)`,
  );
  const verdict =
    result.errors.length === 0 && publishedMissing.length === 0 ? "OK" : "FAILED";
  console.info(
    `dry-run: ${result.errors.length} errors, ${result.warnings.length} warnings (mode=preview) — ${verdict}`,
  );
  return result.errors.length === 0 && publishedMissing.length === 0 ? 0 : 1;
}

// Invoked directly (not when imported by the walkthrough test).
const invokedDirectly =
  process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;
if (invokedDirectly) {
  process.exit(main(process.argv.slice(2)));
}
