// WP-24 — the manifest consumption gate CLI (spawned by the WP-24 Astro
// integration, scripts/validate/asset-gate.mjs, at astro:build:start — the
// same one-source-of-truth subprocess pattern as WP-13's content gate).
//
// Checks, in fail-closed order (production mode):
//   1. EXISTENCE — the manifest must exist before astro build consumes it
//      (11.1:manifest-missing; BUILD_AND_ROUTING §1 DAG; ADR-026);
//   2. LOADABILITY — the manifest must satisfy the WP-24 typed contract
//      (src/lib/assets/manifest.ts, 24:manifest-unloadable);
//   3. COVERAGE CLOSURE — scripts/media/coverage.ts validateCoverage over the
//      content graph × the FROZEN WP-15 variant plan × the manifest
//      (13.1#18 width-precise, 11.1:* record resolution/identity; §11.1
//      build-blocking, §11.3 drafts excluded).
//
// BOUNDARY (documented per the WP-24 brief): this scripts/ CLI imports
// ACROSS into both scripts/media/coverage.ts (the closure authority, WP-23)
// and src/lib/assets/manifest.ts (the typed consumer contract, WP-24) — the
// permitted direction is scripts → src/lib; src/lib never imports the
// pipeline. The gate runs the SAME validateCoverage the media:pipeline CLI
// runs — one source of truth for closure semantics.
//
// Mode semantics (BUILD_AND_ROUTING §6/§9 — environment configuration, never
// content inspection; identical vocabulary to WP-13):
//   production → any missing/unloadable/incomplete manifest is a BLOCKING
//                error (exit 1; the astro build aborts before page
//                generation).
//   preview    → the same conditions are WARNINGS, never fatal (§9: "asset
//                manifest may be incomplete" in local preview; drafts stay
//                renderable for P4/P5 draft-indicator work).
//
// Environment overrides (same variables the WP-13 gate documents):
//   --content-root <dir>       project root containing content/ + media/ +
//                              generated/ (default: cwd)
//   --asset-manifest <file>    manifest path override (tests, non-standard
//                              mounts; default <content-root>/generated/
//                              asset-manifest.json)
import { existsSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import {
  DERIVATIVE_PURPOSES,
  ManifestConsumptionError,
  MANIFEST_RELATIVE_PATH,
  readAssetManifest,
} from "../../src/lib/assets/manifest";
import {
  collectContentPhotos,
  DEFAULT_DIMENSION_SAMPLE,
  validateCoverage,
} from "../media/coverage";
import { loadDerivativeRecord } from "../media/derive";

function printUsage(): void {
  console.info(
    [
      "Usage: manifest-gate.ts --mode <production|preview> [--content-root <dir>] [--asset-manifest <file>]",
      "",
      "WP-24 producer-before-consumer gate (astro:build:start): manifest",
      "existence (11.1:manifest-missing) + typed loadability (24:manifest-" +
        "unloadable) + coverage closure (WP-23 validateCoverage, 13.1#18).",
      "Production: fail closed. Preview: warnings only (§9).",
    ].join("\n"),
  );
}

function printFindings(
  label: "ERROR" | "WARNING",
  findings: ReadonlyArray<{ severity: string; rule: string; message: string; file?: string; field?: string }>,
): void {
  for (const f of findings) {
    console.error(
      `${label} [${f.rule}] ${f.file ?? ""}${f.field ? ` (${f.field})` : ""}: ` +
        f.message.replace(/^\[[^\]]+\]\s*/, ""),
    );
  }
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  let mode = "";
  let contentRoot = process.cwd();
  let manifestPath = "";
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const value = (): string => {
      if (i + 1 >= argv.length) {
        console.error(`manifest-gate: Missing value for ${arg}`);
        process.exit(1);
      }
      return argv[++i] as string;
    };
    if (arg === "--mode") mode = value();
    else if (arg === "--content-root") contentRoot = value();
    else if (arg === "--asset-manifest") manifestPath = value();
    else if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else {
      console.error(`manifest-gate: Unknown argument '${arg}' (see --help)`);
      process.exit(1);
    }
  }
  if (mode !== "production" && mode !== "preview") {
    console.error("manifest-gate: --mode must be 'production' or 'preview'");
    process.exit(1);
  }
  const fatal = mode === "production";
  manifestPath ||= join(contentRoot, MANIFEST_RELATIVE_PATH);
  const label = fatal ? "ERROR" : "WARNING";

  // (1) Existence — the producer-before-consumer invariant itself.
  if (!existsSync(manifestPath) || !statSync(manifestPath).isFile()) {
    console.error(
      `${label} [11.1:manifest-missing] producer-before-consumer violation: no asset manifest exists at ` +
        `'${manifestPath}' — Astro cannot consume a manifest that does not yet exist ` +
        "(BUILD_AND_ROUTING §1 DAG; IMAGE_PIPELINE §10.1/§13.3; ADR-026). " +
        "Run `npm run build:media` (media:pipeline → astro build)",
    );
    return fatal ? 1 : 0;
  }

  // (2) Loadability — the typed consumer contract (WP-24 Zod schema).
  let document;
  try {
    document = readAssetManifest(manifestPath);
  } catch (error) {
    if (error instanceof ManifestConsumptionError) {
      console.error(`${label} ${error.message}`);
      return fatal ? 1 : 0;
    }
    throw error;
  }
  console.info(
    `[wp24] manifest ${basename(manifestPath)} loaded — schema ${document.manifest.schema}, ` +
      `${document.manifest.records.length} record(s), purposes ${DERIVATIVE_PURPOSES.join("/")}`,
  );

  // (3) Coverage closure — the WP-23 verdict, unchanged (single authority).
  const frozen = await loadDerivativeRecord();
  const photos = collectContentPhotos(contentRoot);
  const result = await validateCoverage({
    publishedPhotos: photos,
    manifest: document.manifest.records,
    manifestRecord: document.manifest.record,
    mediaRoot: join(contentRoot, "generated", "media"),
    frozenRecord: frozen,
    verifyDimensionsSample: DEFAULT_DIMENSION_SAMPLE,
  });
  printFindings(label, result.findings);
  console.info(
    `[wp23] coverage ${result.ok ? "OK" : "FAILED"} — ` +
      `${result.coveredVariants}/${result.expectedVariants} expected variants, ` +
      `${result.photosWithCompleteCoverage} complete / ${result.photosMissingCoverage} incomplete photo(s)`,
  );
  if (!result.ok) {
    if (fatal) {
      console.error(
        `[wp24] manifest closure FAILED for published content — the manifest is stale or incomplete ` +
          "relative to the content graph and the FROZEN variant plan (BUILD_AND_ROUTING §9: " +
          "production requires complete, closure-verified coverage; IMAGE_PIPELINE §11.1)",
      );
    }
    return fatal ? 1 : 0;
  }
  return 0;
}

process.exitCode = 1;
main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(
      `manifest-gate: FAILED — ${error instanceof Error ? error.message : String(error)} (fail closed)`,
    );
    process.exitCode = 1;
  });
