// WP-13 — the standalone fail-closed content validation CLI behind
// `npm run validate:content` and the astro build gate (WP-13 integration).
//
// Run:
//   npm run validate:content
//   node --experimental-strip-types --import ./scripts/validate/register-ts-resolve.mjs \
//        scripts/validate/content.ts --mode production
//
// Flags:
//   --mode preview|production      Build mode (BUILD_AND_ROUTING §6: selected
//                                  by environment configuration — this flag /
//                                  the gate's env vars — NEVER by content
//                                  inspection). Default: production (the
//                                  fail-closed default).
//   --content-root <dir>           Project root containing content/ and
//                                  media/ (default: process.cwd()).
//   --ingest-root <dir>            WEB INGEST MASTER root (§13.1#1; default:
//                                  <content-root>/media/ingest-masters).
//   --asset-manifest <file>        Asset-manifest JSON for §13.1#18
//                                  (default: <content-root>/generated/asset-manifest.json;
//                                  absent file → explicit warning, P3 wiring point).
//
// Exit codes: 0 = valid (warnings possible in preview and for the absent
// manifest); 1 = any error, or a fail-closed load failure (missing/malformed
// home.yaml or redirects.yaml). Every finding prints file + field + rule ID.
//
// Loading mirrors the REAL build pipeline: galleries/places come from the
// same directories the Content Layer glob loaders walk
// (src/content.config.ts: `content/galleries/**/meta.yaml`,
// `content/places/*.yaml`); home.yaml and redirects.yaml use the WP-11/WP-12
// fail-closed direct-file readers. All shape/rule validation is performed by
// the real schemas + validators composed in src/lib/validate/production.ts.
import { readdirSync, existsSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";
import {
  composeArchiveValidation,
  formatArchiveIssues,
  REQUIRED_DERIVATIVE_PURPOSES,
  type ArchiveValidationResult,
  type AssetManifestInput,
} from "../../src/lib/validate/production";
import type { GalleryEntryInput } from "../../src/lib/validate/gallery";
import type { PlaceEntryInput } from "../../src/lib/validate/place";
import { readHomeSettings } from "../../src/lib/content/home";
import { entriesFromRedirectsFile, readRedirects } from "../../src/lib/content/redirects";
import { load as parseYaml } from "js-yaml";

interface CliOptions {
  mode: "preview" | "production";
  contentRoot: string;
  ingestRoot: string;
  assetManifestPath: string;
}

function parseArgs(argv: ReadonlyArray<string>): CliOptions {
  const options: CliOptions = {
    mode: "production",
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
    if (arg === "--mode") {
      const mode = value();
      if (mode !== "preview" && mode !== "production") {
        throw new Error(`--mode must be 'preview' or 'production', got '${mode}'`);
      }
      options.mode = mode;
    } else if (arg === "--content-root") {
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
  options.ingestRoot ||= join(options.contentRoot, "media", "ingest-masters");
  options.assetManifestPath ||= join(options.contentRoot, "generated", "asset-manifest.json");
  return options;
}

function printUsage(): void {
  console.info(
    [
      "Usage: content.ts [--mode preview|production] [--content-root <dir>]",
      "                  [--ingest-root <dir>] [--asset-manifest <file>]",
      "",
      "Fail-closed whole-archive content validation (CONTENT_MODEL §13).",
      "Exit 0 = valid; exit 1 = errors (or fail-closed load failure).",
    ].join("\n"),
  );
}

/** Recursively collects every meta.yaml under the galleries dir (glob pattern "**" + "/meta.yaml"). */
function findGalleryMetaFiles(dir: string): string[] {  const found: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    )) {
      const child = join(current, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile() && entry.name === "meta.yaml") found.push(child);
    }
  };
  walk(dir);
  return found;
}

/** Loads the whole authored archive exactly as the build pipeline sees it. */
export function loadArchive(contentRoot: string): {
  galleries: GalleryEntryInput[];
  places: PlaceEntryInput[];
  home: { data: unknown; filePath: string };
  redirects: ReturnType<typeof entriesFromRedirectsFile>["entries"];
} {
  const toRelative = (absolute: string): string =>
    relative(contentRoot, absolute).split(sep).join("/");

  const galleriesDir = join(contentRoot, "content", "galleries");
  const galleries: GalleryEntryInput[] = findGalleryMetaFiles(galleriesDir).map((absolute) => ({
    data: parseYaml(readFileSync(absolute, "utf8"), { filename: absolute }),
    filePath: toRelative(absolute),
  }));

  const placesDir = join(contentRoot, "content", "places");
  const places: PlaceEntryInput[] = readdirSync(placesDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".yaml"))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .map((e) => {
      const absolute = join(placesDir, e.name);
      return {
        data: parseYaml(readFileSync(absolute, "utf8"), { filename: absolute }),
        filePath: toRelative(absolute),
      };
    });

  // Fail-closed single-file readers (WP-11/WP-12): missing or malformed
  // home.yaml / redirects.yaml throws — the CLI reports and exits 1.
  const home = readHomeSettings(contentRoot);
  const redirectsFile = readRedirects(contentRoot);
  const redirects = entriesFromRedirectsFile(redirectsFile.data);

  return {
    galleries,
    places,
    home: { data: home.data, filePath: toRelative(home.filePath) },
    redirects: redirects.entries.map((entry) => ({
      ...entry,
      filePath: toRelative(redirectsFile.filePath),
    })),
  };
}

/**
 * Loads the asset manifest for §13.1#18. The manifest is P3 pipeline output
 * (IMAGE_PIPELINE.md §10); its top-level structure is an implementation
 * detail, so any array of {photo_id, purpose} records under the root or a
 * `derivatives`/`rows`/`entries` key is accepted.
 */
export function loadAssetManifest(path: string): AssetManifestInput | undefined {
  if (!existsSync(path)) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (cause) {
    throw new Error(
      `Asset manifest ${path} is not parseable JSON (fail-closed): ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
    );
  }
  // Top-level structure is an implementation detail (IMAGE_PIPELINE §10.4):
  // accept a root array or an array under a known envelope key. WP-23 wiring
  // (one-line envelope adapter, per the WP-13 handoff fact): the REAL
  // pipeline document is envelope-separated — `{envelope, manifest:
  // {schema, record, toolchain, records}}` — so the nested
  // `manifest.records` core is accepted too, making §13.1#18 live on real
  // pipeline output.
  let rows: unknown[] = [];
  if (Array.isArray(parsed)) {
    rows = parsed;
  } else if (typeof parsed === "object" && parsed !== null) {
    const doc = parsed as Record<string, unknown>;
    const nestedCore =
      typeof doc["manifest"] === "object" && doc["manifest"] !== null
        ? (doc["manifest"] as Record<string, unknown>)
        : doc;
    for (const key of ["derivatives", "rows", "entries", "records"]) {
      const candidate = nestedCore[key];
      if (Array.isArray(candidate)) {
        rows = candidate;
        break;
      }
    }
  }
  return {
    rows: rows.flatMap((row) =>
      typeof row === "object" &&
      row !== null &&
      typeof (row as Record<string, unknown>).photo_id === "string" &&
      typeof (row as Record<string, unknown>).purpose === "string"
        ? [
            {
              photo_id: (row as Record<string, unknown>).photo_id as string,
              purpose: (row as Record<string, unknown>).purpose as string,
            },
          ]
        : [],
    ),
  };
}

function report(result: ArchiveValidationResult, options: CliOptions): void {
  for (const line of formatArchiveIssues(result.errors)) console.error(line);
  for (const line of formatArchiveIssues(result.warnings)) console.warn(line);
  const verdict = result.ok ? "OK" : "FAILED";
  console.info(
    `content validation: ${result.errors.length} errors, ${result.warnings.length} warnings (mode=${options.mode}) — ${verdict}`,
  );
}

export function main(argv: ReadonlyArray<string>): number {
  let options: CliOptions;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`content validation: ${error instanceof Error ? error.message : String(error)}`);
    printUsage();
    return 1;
  }

  console.info(
    `[wp13] content validation — mode=${options.mode} content-root=${options.contentRoot} ingest-root=${options.ingestRoot} purposes=[${REQUIRED_DERIVATIVE_PURPOSES.join(", ")}]`,
  );

  let archive: ReturnType<typeof loadArchive>;
  let manifest: AssetManifestInput | undefined;
  try {
    archive = loadArchive(options.contentRoot);
    manifest = loadAssetManifest(options.assetManifestPath);
  } catch (error) {
    console.error(
      `content validation: fail-closed load error: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return 1;
  }

  const result = composeArchiveValidation(archive, {
    mode: options.mode,
    ingestRoot: options.ingestRoot,
    ...(manifest !== undefined ? { assetManifest: manifest } : {}),
  });
  report(result, options);
  return result.ok ? 0 : 1;
}

const invokedDirectly =
  process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;
if (invokedDirectly) {
  process.exit(main(process.argv.slice(2)));
}
