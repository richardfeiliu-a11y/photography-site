// WP-23 — the media pipeline chain orchestrator (IMAGE_PIPELINE.md §5 stages
// 1–8 + §8 manifest closure; PRODUCTION_IMPLEMENTATION_PLAN.md WP-23).
//
// NO in-process orchestrator existed before WP-23: WP-20/21/22 shipped the
// stage entrypoints (derive → finalizeAndVerify → publishDerivatives →
// manifest write) and this module owns their COMPOSITION, plus stale-file
// pruning. The chain, over a configurable source root set:
//
//   1. deriveAll (WP-20)            — stage 5 intermediates under outDir
//   2. finalizeAndVerify (WP-21)    — stages 6–7 + §7.3 master-untouched
//                                     guard over the derive results (the
//                                     MasterRef sha256 is the derive-time
//                                     sourceSha256 — a before/after
//                                     checksum across the whole run)
//   3. publishDerivatives (WP-22)   — verify-gated one-shot rename to
//                                     content-addressed finals (D8)
//   4. buildDeterministicCore + writeManifest (WP-22) — envelope-separated
//                                     manifest at manifestPath
//   5. STALE-FILE PRUNING           — final files under outDir NOT referenced
//                                     by the fresh manifest are removed
//   6. coverage gate (WP-23)        — optional validateCoverage over the
//                                     content graph × plan × the WRITTEN
//                                     manifest (result.ok = verdict)
//   7. atmosphere sidecar           — optional Light Field ambient color per
//                                     published gallery cover, from the
//                                     published derivatives (data layer, NOT a
//                                     gate — see the step comment)
//
// Fail-closed ordering: every stage refuses on upstream failure (the WP-21
// report gate and the one-shot publish semantics are inherited, not
// re-implemented), so a failed run leaves no manifest and prunes nothing.
// Step 7 is the ONE deliberate exception: ambient color is presentation data,
// a missing sample degrades to a documented default pair, and it can never
// change the chain verdict (it runs after the gate, over the durable
// manifest, and its result is reported, not enforced).
//
// PRUNE ORDER — after the manifest write, BY DESIGN (documented per the
// WP-23 brief): the referenced set is computed by RE-READING the durable
// manifest artifact, never from in-memory state. Consequences:
//   - a crash between write and prune leaves orphan files — harmless; the
//     next run prunes them (orphans are NEVER authority: they are not in the
//     manifest, and pruning makes the directory EQUAL the manifest closure);
//   - referenced files are never deleted in any crash window, because the
//     manifest listing them is already durable when pruning starts;
//   - the reverse order (prune before write) would compute the referenced
//     set from a document that may never be written (write failure), which
//     is the wrong direction for a fail-closed pipeline.
import { readdir, rmdir, rm, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import {
  deriveAll,
  loadDerivativeRecord,
  type DeriveAllResult,
  type FrozenDerivativeRecord,
} from "./derive";
import { finalizeAndVerify, type FinalizeReport } from "./privacy-check";
import {
  PUBLIC_URL_BASE,
  publishDerivatives,
  resolveDigestHexChars,
  type PublishResult,
} from "./naming";
import {
  buildDeterministicCore,
  manifestCoreSha256,
  writeManifest,
  type ManifestCore,
} from "./manifest";
import {
  collectContentPhotos,
  DEFAULT_DIMENSION_SAMPLE,
  flatPublicUrlName,
  loadManifest,
  MANIFEST_URL_SHAPE_RULE,
  validateCoverage,
  type CoverageResult,
} from "./coverage";
import {
  writeAtmosphereSidecar,
  type AtmosphereBuildResult,
} from "./atmosphere";
import { ATMOSPHERE_RELATIVE_PATH } from "../../src/lib/theme/atmosphere-contract";

// ---------------------------------------------------------------------------
// Options + results
// ---------------------------------------------------------------------------

/** One source in the configurable root set: content Photo ID + its master. */
export interface PipelineSource {
  photoId: string;
  file: string;
}

/** Optional post-publish coverage gate inputs (the content graph). */
export interface PipelineCoverageOptions {
  /** The content-graph photos (drafts flagged; drafts never block, §11.3). */
  publishedPhotos: ReadonlyArray<{
    galleryId: string;
    photoId: string;
    masterFile: string;
    draft?: boolean;
  }>;
}

export interface PipelineOptions {
  /** The configurable source root set (Photo ID → WEB INGEST MASTER). */
  sources: readonly PipelineSource[];
  /** Stage-5 output dir + final content-addressed files (generated/media). */
  outDir: string;
  /** Manifest destination (generated/asset-manifest.json). */
  manifestPath: string;
  /** deriveAll worker concurrency (parallel SOURCES). */
  concurrency?: number;
  /** Pre-parsed frozen record (defaults to loadDerivativeRecord()). */
  frozenRecord?: FrozenDerivativeRecord;
  /** Prune stale files after the manifest write (default true). */
  prune?: boolean;
  /** Run the coverage gate against the written manifest (default: no gate). */
  coverage?: PipelineCoverageOptions;
  /**
   * Write the Light Field atmosphere sidecar after the chain (default: skip).
   * `root` is the corpus root the run was planned from — the sidecar samples
   * the published cover derivatives under `<root>/generated/` and reads the
   * content graph at `<root>/content/`. Opt-in so in-process/test runs never
   * touch a repository-side output.
   */
  atmosphere?: { root: string };
}

export interface PipelineResult {
  sources: number;
  derive: DeriveAllResult;
  finalize: FinalizeReport;
  publish: PublishResult;
  core: ManifestCore;
  manifestPath: string;
  /** sha256 over the canonical deterministic core (§8.3 body hash). */
  coreSha256: string;
  /** Stale files removed from outDir (relative names), prune stage. */
  prunedFiles: string[];
  /** Coverage verdict when the gate was configured; undefined otherwise. */
  coverage: CoverageResult | undefined;
  /** Atmosphere sidecar outcome when step 7 was configured; undefined otherwise. */
  atmosphere: AtmosphereBuildResult | undefined;
  /** Overall verdict: coverage.ok when gated, true otherwise. */
  ok: boolean;
}

// ---------------------------------------------------------------------------
// Content-graph → source root set
// ---------------------------------------------------------------------------

/**
 * Build the pipeline's source root set from the authored content graph:
 * every photo of every gallery (published by default; drafts only with
 * `includeDrafts` — IMAGE_PIPELINE §11.3 excludes draft content from
 * production) with source_ref resolved against media/ingest-masters/.
 */
export function collectPipelineSources(
  contentRoot: string,
  options: { galleries?: readonly string[]; includeDrafts?: boolean } = {},
): PipelineSource[] {
  const photos = collectContentPhotos(contentRoot, {
    ...(options.galleries !== undefined ? { galleries: options.galleries } : {}),
  });
  return photos
    .filter((p) => options.includeDrafts === true || !p.draft)
    .map((p) => ({ photoId: p.photoId, file: p.masterFile }));
}

// ---------------------------------------------------------------------------
// Stale-file pruning
// ---------------------------------------------------------------------------

/**
 * Remove every final file under outDir that the manifest at manifestPath does
 * NOT reference. The referenced set is computed by RE-READING the durable
 * manifest (see the module comment for the prune-order rationale). An absent
 * manifest prunes nothing (nothing is authority). Only regular files are
 * removed, and only inside outDir. Returns the removed file names (relative
 * to outDir, "/"-separated), sorted.
 */
export async function pruneStaleDerivatives(
  outDir: string,
  manifestPath: string,
): Promise<string[]> {
  const rows = (await loadManifest(manifestPath))?.rows;
  if (rows === undefined) return [];
  // Referenced set = THE shared flat-URL contract (R-02): each public_url is
  // PUBLIC_URL_BASE + one filename component; the filename is the
  // outDir-relative protected path. This replaces both the original
  // basename-only comparison (a nested same-basename orphan survived) and the
  // interim `includes("..")` substring check (which deleted the LEGAL
  // consecutive-dot authority "p..x-avif-w1-….avif" — dots inside a filename
  // are not traversal; only a "."/".." PATH SEGMENT is). A malformed or
  // out-of-base authority URL is an explicit failure — pruning aborts rather
  // than proceeding under uncertainty (deletion with an unreliable protected
  // set could destroy Manifest authority).
  const referenced = new Set<string>();
  for (const row of rows) {
    const name = flatPublicUrlName(row.public_url);
    if (name === null) {
      throw new Error(
        `[${MANIFEST_URL_SHAPE_RULE}] stale-derivative pruning aborted: manifest record for '${row.photo_id}' ` +
          `has public_url '${row.public_url}' which is not the flat layout '${PUBLIC_URL_BASE}<filename>' ` +
          "(exactly one path segment under the media base) — the protected-set guarantee cannot be " +
          "established, so nothing may be deleted (IMAGE_PIPELINE §11.1 fail-closed)",
      );
    }
    referenced.add(name);
  }

  /** Recursively collect regular files under dir, as outDir-relative names. */
  const walk = async (dir: string, prefix: string): Promise<string[]> => {
    const found: string[] = [];
    for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    )) {
      const child = join(dir, entry.name);
      const name = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isDirectory()) found.push(...(await walk(child, name)));
      else if (entry.isFile()) found.push(name);
    }
    return found;
  };

  let pruned: string[] = [];
  try {
    await stat(outDir);
  } catch {
    return []; // no output dir — nothing to prune
  }
  for (const name of await walk(outDir, "")) {
    if (!referenced.has(name)) {
      await rm(join(outDir, name));
      pruned.push(name);
    }
  }
  // Remove directories the prune emptied (deepest first) so the output
  // directory equals the manifest closure again — an empty leftover
  // directory would fail the directory-closure invariant.
  const removeEmptyDirs = async (dir: string): Promise<boolean> => {
    const entries = await readdir(dir, { withFileTypes: true });
    let empty = true;
    for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const child = join(dir, entry.name);
      if (entry.isDirectory()) {
        empty = (await removeEmptyDirs(child)) && empty;
      } else {
        empty = false;
      }
    }
    if (empty && dir !== outDir) await rmdir(dir);
    return empty;
  };
  if (pruned.length > 0) await removeEmptyDirs(outDir);
  return pruned.sort();
}

// ---------------------------------------------------------------------------
// The chain
// ---------------------------------------------------------------------------

/**
 * Run the full chain over the configured source root set. Throws with the
 * upstream stage's rule-precise error on any failure (DeriveError,
 * PrivacyVerificationError 11.1:privacy-verification / 7.3:master-*,
 * NamingError 9:*) — a failed run writes no manifest and prunes nothing.
 */
export async function runMediaPipeline(options: PipelineOptions): Promise<PipelineResult> {
  if (options.sources.length === 0) {
    throw new Error(
      "runMediaPipeline: empty source root set — refusing to run (an empty run would write an " +
        "empty manifest and prune every final file; enumerate sources explicitly)",
    );
  }
  const frozen = options.frozenRecord ?? (await loadDerivativeRecord());

  // (1) Stage 5 — derive the planned variants for every source.
  const derive = await deriveAll(
    options.sources.map((s) => ({ photoId: s.photoId, source: s.file })),
    {
      outDir: options.outDir,
      concurrency: options.concurrency,
      frozenRecord: frozen,
    },
  );

  // (2) Stages 6–7 — final-byte verification + §7.3 master-untouched guard.
  //     The MasterRef checksum joins the derive-time sourceSha256, so the
  //     guard is a before/after checksum across the whole pipeline run.
  const shaByPhoto = new Map(derive.results.map((r) => [r.photoId, r.sourceSha256]));
  const report = await finalizeAndVerify(derive.results, {
    masters: options.sources.map((s) => ({
      photoId: s.photoId,
      file: s.file,
      sha256: shaByPhoto.get(s.photoId)!,
    })),
  });

  // (3) Stage 8 — verify-gated one-shot content-addressed publication (D8).
  const publish = await publishDerivatives(derive.results, {
    report,
    digestHexChars: resolveDigestHexChars(frozen),
  });

  // (4) Manifest — deterministic core + separated envelope (§8.3).
  const core = buildDeterministicCore(publish.published, {
    id: frozen.recordId,
    frozen_at: frozen.frozenAt,
  });
  await writeManifest(options.manifestPath, core, { generated_at: new Date().toISOString() });

  // (5) Stale-file pruning — AFTER the manifest write (module comment).
  const prunedFiles =
    options.prune === false ? [] : await pruneStaleDerivatives(options.outDir, options.manifestPath);

  // (6) Optional coverage gate over the WRITTEN manifest (single authority):
  // the envelope record identity is checked against the live FROZEN record
  // and the dimension spot-check runs at the documented sampled scope.
  const coverage = options.coverage
    ? await (async () => {
        const document = await loadManifest(options.manifestPath);
        return validateCoverage({
          publishedPhotos: options.coverage!.publishedPhotos,
          manifest: document?.rows,
          ...(document?.record !== undefined ? { manifestRecord: document.record } : {}),
          mediaRoot: options.outDir,
          frozenRecord: frozen,
          verifyDimensionsSample: DEFAULT_DIMENSION_SAMPLE,
        });
      })()
    : undefined;

  // (7) Atmosphere sidecar (Light Field data layer) — OPT-IN and NOT a gate.
  //     Runs last, over the durable manifest: a missing/unreadable cover
  //     sample degrades to the documented default pair INSIDE the generator,
  //     and a write failure is reported on stderr without touching the chain
  //     verdict (the media gates are steps 1–6; see the module comment).
  let atmosphere: AtmosphereBuildResult | undefined;
  if (options.atmosphere !== undefined) {
    try {
      atmosphere = await writeAtmosphereSidecar(options.atmosphere.root);
    } catch (error) {
      console.warn(
        `[wp23] atmosphere sidecar NOT written: ${
          error instanceof Error ? error.message : String(error)
        } (non-fatal — the ambient data layer is not a gate)`,
      );
    }
  }

  return {
    sources: options.sources.length,
    derive,
    finalize: report,
    publish,
    core,
    manifestPath: options.manifestPath,
    coreSha256: manifestCoreSha256(core),
    prunedFiles,
    coverage,
    atmosphere,
    ok: coverage?.ok ?? true,
  };
}

// ---------------------------------------------------------------------------
// CLI — media:pipeline / media:verify (the full chain entry point)
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.info(
    [
      "Usage: pipeline.ts [--content-root <dir>] [--out <dir>] [--manifest <file>]",
      "                   [--concurrency <n>] [--gallery <id>]... [--include-drafts]",
      "                   [--no-prune] [--no-coverage] [--json]",
      "",
      "WP-23 chain orchestrator (IMAGE_PIPELINE §5–8): derive (WP-20) →",
      "finalizeAndVerify (WP-21) → publish (WP-22) → manifest write (WP-22) →",
      "stale-file pruning + coverage gate (WP-23) → atmosphere sidecar (Light",
      "Field data layer; non-gate). Sources come from the authored",
      "content graph (published photos; drafts excluded per §11.3) with",
      "source_ref resolved against media/ingest-masters/. Exit 0 only when the",
      "chain AND the coverage gate are green (IMAGE_PIPELINE §11.1 fail closed).",
    ].join("\n"),
  );
}

const invokedDirectly =
  process.argv[1] !== undefined && basename(process.argv[1]) === "pipeline.ts";
if (invokedDirectly) {
  const argv = process.argv.slice(2);
  let contentRoot = process.cwd();
  let outDir = "";
  let manifestPath = "";
  let concurrency = 4;
  const galleries: string[] = [];
  let includeDrafts = false;
  let prune = true;
  let coverage = true;
  let asJson = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const value = (): string => {
      if (i + 1 >= argv.length) {
        console.error(`pipeline: Missing value for ${arg}`);
        process.exit(1);
      }
      return argv[++i] as string;
    };
    if (arg === "--content-root") contentRoot = value();
    else if (arg === "--out") outDir = value();
    else if (arg === "--manifest") manifestPath = value();
    else if (arg === "--concurrency") concurrency = Number(value());
    else if (arg === "--gallery") galleries.push(value());
    else if (arg === "--include-drafts") includeDrafts = true;
    else if (arg === "--no-prune") prune = false;
    else if (arg === "--no-coverage") coverage = false;
    else if (arg === "--json") asJson = true;
    else if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else {
      console.error(`pipeline: Unknown argument '${arg}' (see --help)`);
      process.exit(1);
    }
  }
  outDir ||= join(contentRoot, "generated", "media");
  manifestPath ||= join(contentRoot, "generated", "asset-manifest.json");

  try {
    const sources = collectPipelineSources(contentRoot, {
      ...(galleries.length > 0 ? { galleries } : {}),
      includeDrafts,
    });
    if (sources.length === 0) {
      console.error(
        "pipeline: no sources enumerated from the content graph — refusing to run an empty set (fail closed)",
      );
      process.exit(1);
    }
    const result = await runMediaPipeline({
      sources,
      outDir,
      manifestPath,
      concurrency,
      prune,
      ...(coverage
        ? {
            coverage: {
              // Review fix round 1 (IMPORTANT): the coverage gate joins the
              // SAME gallery filter the run derived — a --gallery subset run
              // must be validated against that subset's content graph, not
              // the whole corpus (which would make every subset run
              // fail on galleries it never derived).
              publishedPhotos: collectContentPhotos(
                contentRoot,
                galleries.length > 0 ? { galleries } : {},
              ),
            },
          }
        : {}),
      // Step 7 (non-gate): the CLI always refreshes the ambient sidecar for
      // the corpus it just processed, mirroring the defaults above —
      // generated/asset-manifest.json + generated/media under contentRoot.
      atmosphere: { root: contentRoot },
    });

    if (asJson) {
      console.info(
        JSON.stringify(
          {
            workPackage: "WP-23",
            sources: result.sources,
            publishedRecords: result.publish.published.length,
            finalFiles: result.publish.finalFiles,
            removedDuplicateIntermediates: result.publish.removedDuplicateIntermediates,
            filesScanned: result.finalize.filesScanned,
            bytesScanned: result.finalize.bytesScanned,
            prunedFiles: result.prunedFiles,
            manifest: result.manifestPath,
            coreSha256: result.coreSha256,
            toolchain: result.core.toolchain,
            coverage: result.coverage ?? null,
            atmosphere: result.atmosphere ?? null,
            ok: result.ok,
          },
          null,
          2,
        ),
      );
    } else {
      for (const r of result.derive.results) {
        console.info(
          `[wp23] derive ${r.photoId} ${r.displayWidth}x${r.displayHeight} → ${r.derivatives.length} variants`,
        );
      }
      console.info(
        `[wp23] ${result.sources} source(s) → ${result.publish.published.length} record(s), ` +
          `${result.publish.finalFiles} content-addressed file(s), ` +
          `${result.publish.removedDuplicateIntermediates} cross-purpose duplicate(s) collapsed; ` +
          `${result.finalize.filesScanned} file(s) verified (${(result.finalize.bytesScanned / 1e6).toFixed(1)} MB)`,
      );
      console.info(
        `[wp23] pruned ${result.prunedFiles.length} stale file(s)` +
          (result.prunedFiles.length > 0 ? `: ${result.prunedFiles.join(", ")}` : ""),
      );
      if (result.coverage !== undefined) {
        console.info(
          `[wp23] coverage ${result.coverage.ok ? "OK" : "FAILED"} — ` +
            `${result.coverage.coveredVariants}/${result.coverage.expectedVariants} expected variants, ` +
            `${result.coverage.photosWithCompleteCoverage} complete / ${result.coverage.photosMissingCoverage} incomplete photo(s)`,
        );
        for (const f of result.coverage.findings) {
          console.error(
            `${f.severity.toUpperCase()} [${f.rule}] ${f.file ?? ""}${f.field ? ` (${f.field})` : ""}: ${f.message.replace(/^\[[^\]]+\]\s*/, "")}`,
          );
        }
      }
      console.info(`[wp23] manifest written to ${result.manifestPath} (core ${result.coreSha256.slice(0, 19)}…)`);
      if (result.atmosphere !== undefined) {
        console.info(
          `[wp23] atmosphere ${result.atmosphere.galleries} gallery ambient pair(s) ` +
            `(${result.atmosphere.sampled} sampled, ${result.atmosphere.fallbacks} default) → ` +
            `${ATMOSPHERE_RELATIVE_PATH}`,
        );
      }
    }
    process.exit(result.ok ? 0 : 1);
  } catch (error) {
    console.error(
      `pipeline: FAILED — ${error instanceof Error ? error.message : String(error)} (fail closed; no manifest written, nothing pruned)`,
    );
    process.exit(1);
  }
}
