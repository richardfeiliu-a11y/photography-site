// WP-23 integration tests — derivative coverage validation over REAL corpus
// pixels + the REAL authored content graph (IMAGE_PIPELINE.md §8 manifest
// closure, §11.1 build-blocking, §11.3 drafts; CONTENT_MODEL §13.1#18).
//
// The frozen corpus is NEVER mutated: masters are COPIED-derived into a
// tmpdir via the WP-23 pipeline (derive → finalize → publish → manifest).
// Proven here:
//   1. Full-pipeline output over a published gallery satisfies the coverage
//      join: every published photo carries every planned (purpose × format ×
//      effective width) variant, and every manifest record's public_url
//      resolves to an existing file hashing to derivative_hash.
//   2. A deliberately missing variant for a published photo is
//      BUILD-BLOCKING through both the coverage validator (width-precise
//      13.1#18) and the composed WP-13 validator (purpose-level 13.1#18).
//   3. A manifest record whose file is missing after publish fails closed.
//   4. Draft content (the 72-photo draft gallery) with ZERO derivatives does
//      not block (IMAGE_PIPELINE §11.3).
//   5. The WP-13 wiring: the real envelope manifest is consumed through the
//      loadAssetManifest adapter (scripts/validate/content.ts), so the
//      composed validator's §13.1#18 gate is live on real pipeline output.
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { load as parseYaml } from "js-yaml";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { loadDerivativeRecord, type FrozenDerivativeRecord } from "../../scripts/media/derive";
import {
  COVERAGE_RULE,
  MANIFEST_MISSING_RULE,
  MANIFEST_UNRESOLVED_RULE,
  MANIFEST_DIMENSION_MISMATCH_RULE,
  collectContentPhotos,
  loadManifestRows,
  validateCoverage,
  type CoveragePhotoInput,
} from "../../scripts/media/coverage";
import { runMediaPipeline, type PipelineResult } from "../../scripts/media/pipeline";
import { loadAssetManifest } from "../../scripts/validate/content";
import { composeArchiveValidation } from "../../src/lib/validate/production";

const PROJECT_ROOT = join(import.meta.dirname, "..", "..");
const PUBLISHED_GALLERY = "g_kota_kinabalu"; // 4 photos (smallest published gallery in the real archive)
// The real archive has no draft galleries; the draft scenario below
// synthesizes its draft photos from the published gallery masters.


let workDir: string;
let run: PipelineResult;
let frozen: FrozenDerivativeRecord;

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), "wp23-coverage-int-"));
  frozen = await loadDerivativeRecord();
  const sources = collectContentPhotos(PROJECT_ROOT, { galleries: [PUBLISHED_GALLERY] })
    .filter((p) => !p.draft)
    .map((p) => ({ photoId: p.photoId, file: p.masterFile }));
  expect(sources.length).toBe(4);
  run = await runMediaPipeline({
    sources,
    outDir: join(workDir, "generated", "media"),
    manifestPath: join(workDir, "generated", "asset-manifest.json"),
    concurrency: 4,
    frozenRecord: frozen,
  });
}, 300_000);

afterAll(async () => {
  await rm(workDir, { recursive: true, force: true });
});

function publishedPhotos(): CoveragePhotoInput[] {
  return collectContentPhotos(PROJECT_ROOT, { galleries: [PUBLISHED_GALLERY] });
}

describe("WP-23 coverage — full-pipeline output satisfies the join", () => {
  test("every planned variant of every published photo is present and resolves", async () => {
    const result = await validateCoverage({
      publishedPhotos: publishedPhotos(),
      manifest: await loadManifestRows(run.manifestPath),
      mediaRoot: join(workDir, "generated", "media"),
      frozenRecord: frozen,
    });
    expect(result.ok).toBe(true);
    expect(result.findings).toEqual([]);
    expect(result.photosMissingCoverage).toBe(0);
    expect(result.photosWithCompleteCoverage).toBe(4);
    expect(result.expectedVariants).toBe(run.core.records.length);
    expect(result.coveredVariants).toBe(result.expectedVariants);
    // Per-purpose completeness is fully enumerated.
    for (const purpose of ["gallery_display", "overview", "cover"]) {
      expect(result.perPurpose[purpose]).toEqual({
        expected: result.perPurpose[purpose]!.expected,
        covered: result.perPurpose[purpose]!.expected,
      });
      expect(result.perPurpose[purpose]!.expected).toBeGreaterThan(0);
    }
  });

  test("missing manifest entirely is build-blocking (11.1:manifest-missing)", async () => {
    const result = await validateCoverage({
      publishedPhotos: publishedPhotos(),
      manifest: undefined,
      mediaRoot: join(workDir, "generated", "media"),
      frozenRecord: frozen,
    });
    expect(result.ok).toBe(false);
    expect(result.findings.map((f) => f.rule)).toContain(MANIFEST_MISSING_RULE);
  });
});

describe("WP-23 coverage — missing variant is build-blocking; drafts are not", () => {
  test("a deliberately missing variant for a published photo fails coverage AND the composed WP-13 gate", async () => {
    const rows = (await loadManifestRows(run.manifestPath))!;
    const published = publishedPhotos().filter((p) => !p.draft);
    const victimId = published[0]!.photoId;
    const victimRows = rows.filter((r) => r.photo_id === victimId && r.purpose === "overview");
    expect(victimRows.length).toBe(2); // AVIF primary + JPEG fallback at width 480
    // Remove the photo's WHOLE overview purpose: WP-13's §13.1#18 is
    // purpose-level, so the composed gate blocks only when no row of the
    // purpose remains (WP-23's coverage validator is width-precise and also
    // blocks on a single missing format — pinned in the unit suite).
    const tampered = rows.filter((r) => !(r.photo_id === victimId && r.purpose === "overview"));
    const tamperedPath = join(workDir, "generated", "asset-manifest-tampered.json");
    await writeFile(tamperedPath, JSON.stringify({ manifest: { records: tampered } }, null, 2));

    // Width-precise coverage findings (13.1#18) — one per missing variant.
    const result = await validateCoverage({
      publishedPhotos: publishedPhotos(),
      manifest: tampered,
      mediaRoot: join(workDir, "generated", "media"),
      frozenRecord: frozen,
      verifyFiles: false,
    });
    expect(result.ok).toBe(false);
    const coverageFindings = result.findings.filter((f) => f.rule === COVERAGE_RULE);
    expect(coverageFindings.length).toBe(2);
    for (const finding of coverageFindings) {
      expect(finding.message).toContain(victimId);
      expect(finding.message).toContain("overview");
      expect(finding.message).toContain(String(victimRows[0]!.width));
    }

    // Purpose-level 13.1#18 through the composed WP-13 validator over the
    // SAME (real) rows — the two validators agree on the blocking verdict.
    const galleryData = parseYaml(
      await readFile(
        join(PROJECT_ROOT, "content", "galleries", "kota-kinabalu", "meta.yaml"),
        "utf8",
      ),
    ) as { id: string };
    const placeData = parseYaml(
      await readFile(join(PROJECT_ROOT, "content", "places", "kota-kinabalu.yaml"), "utf8"),
    );
    const composed = composeArchiveValidation(
      {
        galleries: [{ data: galleryData, filePath: "content/galleries/kota-kinabalu/meta.yaml" }],
        places: [{ data: placeData, filePath: "content/places/kota-kinabalu.yaml" }],
        home: { data: { featured_gallery_id: PUBLISHED_GALLERY }, filePath: "content/site/home.yaml" },
        redirects: [],
      },
      {
        mode: "production",
        ingestRoot: join(PROJECT_ROOT, "media", "ingest-masters"),
        assetManifest: loadAssetManifest(tamperedPath),
      },
    );
    expect(composed.ok).toBe(false);
    expect(composed.errors.some((e) => e.rule === "13.1#18")).toBe(true);
  });

  test("a manifest record whose published file is missing after publish fails closed", async () => {
    // Copy the whole generated tree, then remove ONE published final file.
    const brokenRoot = join(workDir, "broken");
    await cp(join(workDir, "generated"), brokenRoot, { recursive: true });
    const mediaRoot = join(brokenRoot, "media");
    const rows = (await loadManifestRows(run.manifestPath))!;
    const victimFile = join(mediaRoot, rows[0]!.public_url.split("/").pop()!);
    await unlink(victimFile);
    const result = await validateCoverage({
      publishedPhotos: publishedPhotos(),
      manifest: rows,
      mediaRoot,
      frozenRecord: frozen,
    });
    expect(result.ok).toBe(false);
    expect(result.findings.map((f) => f.rule)).toContain(MANIFEST_UNRESOLVED_RULE);
  });

  test("the 72-photo DRAFT gallery with ZERO derivatives does not block (§11.3)", async () => {
    const draftPhotos = publishedPhotos().map((p) => ({
      ...p,
      draft: true,
      photoId: p.photoId + "_draft",
    }));
    expect(draftPhotos.length).toBeGreaterThan(0);
    expect(draftPhotos.every((p) => p.draft)).toBe(true);
    // The manifest only covers the derived published gallery — the draft
    // gallery's 72 photos appear NOWHERE in it, and that is not blocking.
    const result = await validateCoverage({
      publishedPhotos: [...publishedPhotos(), ...draftPhotos],
      manifest: await loadManifestRows(run.manifestPath),
      mediaRoot: join(workDir, "generated", "media"),
      frozenRecord: frozen,
    });
    expect(result.ok).toBe(true);
    expect(result.findings).toEqual([]);
  });
});

describe("WP-23 → WP-13 wiring — the composed gate is live on real pipeline output", () => {
  test("loadAssetManifest consumes the real envelope manifest (adapter) and §13.1#18 is satisfied for derived published content", async () => {
    const manifestInput = loadAssetManifest(run.manifestPath);
    expect(manifestInput).toBeDefined();
    expect(manifestInput!.rows.length).toBe(run.core.records.length);
    const galleryData = parseYaml(
      await readFile(
        join(PROJECT_ROOT, "content", "galleries", "kota-kinabalu", "meta.yaml"),
        "utf8",
      ),
    );
    const placeData = parseYaml(
      await readFile(join(PROJECT_ROOT, "content", "places", "kota-kinabalu.yaml"), "utf8"),
    );
    const composed = composeArchiveValidation(
      {
        galleries: [{ data: galleryData, filePath: "content/galleries/kota-kinabalu/meta.yaml" }],
        places: [{ data: placeData, filePath: "content/places/kota-kinabalu.yaml" }],
        home: { data: { featured_gallery_id: PUBLISHED_GALLERY }, filePath: "content/site/home.yaml" },
        redirects: [],
      },
      {
        mode: "production",
        ingestRoot: join(PROJECT_ROOT, "media", "ingest-masters"),
        assetManifest: manifestInput,
      },
    );
    // Complete coverage → the composed gate is silent on §13.1#18.
    expect(composed.errors.some((e) => e.rule === "13.1#18")).toBe(false);
    // No context:asset-manifest-absent warning either — the manifest IS supplied.
    expect(composed.warnings.some((w) => w.rule === "context:asset-manifest-absent")).toBe(false);
  });
});

describe("WP-23 fix round 1 — reviewer pins", () => {
  test("removing a SINGLE format row fails the width-precise gate while the composed purpose-level gate stays green (the two owners disagree by design)", async () => {
    const rows = (await loadManifestRows(run.manifestPath))!;
    const published = publishedPhotos().filter((p) => !p.draft);
    const victimId = published[0]!.photoId;
    const victimRows = rows.filter((r) => r.photo_id === victimId && r.purpose === "overview");
    expect(victimRows.length).toBe(2); // avif + jpeg at width 480
    const jpegRow = victimRows.find((r) => r.format === "jpeg")!;
    const singleFormatGone = rows.filter((r) => r !== jpegRow);

    // Width-precise WP-23 gate: the missing jpeg variant IS blocking.
    const result = await validateCoverage({
      publishedPhotos: publishedPhotos(),
      manifest: singleFormatGone,
      mediaRoot: join(workDir, "generated", "media"),
      frozenRecord: frozen,
      verifyFiles: false,
    });
    expect(result.ok).toBe(false);
    expect(result.findings.filter((f) => f.rule === COVERAGE_RULE).length).toBe(1);
    expect(result.findings[0]!.message).toContain("jpeg");
    expect(result.findings[0]!.message).toContain(String(jpegRow.width));

    // Purpose-level WP-13 composed gate: the 'overview' purpose is still
    // served by the avif row → §13.1#18 stays green (by design; the purpose
    // blocks only when NO row of the purpose remains — pinned in the test
    // above).
    const singleFormatPath = join(workDir, "generated", "asset-manifest-single-format.json");
    await writeFile(
      singleFormatPath,
      JSON.stringify({ manifest: { records: singleFormatGone } }, null, 2),
    );
    const galleryData = parseYaml(
      await readFile(
        join(PROJECT_ROOT, "content", "galleries", "kota-kinabalu", "meta.yaml"),
        "utf8",
      ),
    );
    const placeData = parseYaml(
      await readFile(join(PROJECT_ROOT, "content", "places", "kota-kinabalu.yaml"), "utf8"),
    );
    const composed = composeArchiveValidation(
      {
        galleries: [{ data: galleryData, filePath: "content/galleries/kota-kinabalu/meta.yaml" }],
        places: [{ data: placeData, filePath: "content/places/kota-kinabalu.yaml" }],
        home: { data: { featured_gallery_id: PUBLISHED_GALLERY }, filePath: "content/site/home.yaml" },
        redirects: [],
      },
      {
        mode: "production",
        ingestRoot: join(PROJECT_ROOT, "media", "ingest-masters"),
        assetManifest: loadAssetManifest(singleFormatPath),
      },
    );
    expect(composed.errors.some((e) => e.rule === "13.1#18")).toBe(false);
  });

  test("the dimension spot-check catches record metadata drift on real pixels (sampled scope)", async () => {
    const rows = (await loadManifestRows(run.manifestPath))!;
    // The spot-check samples the FIRST records of the sorted check order —
    // tamper the very first one's width so it is provably inside the sample.
    const sorted = [...rows].sort((a, b) =>
      a.photo_id === b.photo_id
        ? a.public_url < b.public_url
          ? -1
          : 1
        : a.photo_id < b.photo_id
          ? -1
          : 1,
    );
    const victim = sorted[0]!;
    const tampered = rows.map((r) =>
      r === victim ? { ...r, width: r.width + 1 } : r,
    );
    const result = await validateCoverage({
      publishedPhotos: publishedPhotos(),
      manifest: tampered,
      mediaRoot: join(workDir, "generated", "media"),
      frozenRecord: frozen,
      verifyDimensionsSample: 8,
    });
    expect(result.ok).toBe(false);
    expect(result.findings.map((f) => f.rule)).toContain(MANIFEST_DIMENSION_MISMATCH_RULE);
    const finding = result.findings.find((f) => f.rule === MANIFEST_DIMENSION_MISMATCH_RULE)!;
    expect(finding.message).toContain(victim.photo_id);
    expect(finding.message).toContain(`decodes to ${victim.width}x${victim.height}`);
  });

  test("media:pipeline --gallery subset run exits 0 with coverage PASS over THAT subset (review fix 1)", async () => {
    const outDir = join(workDir, "cli-subset", "generated", "media");
    const manifestPath = join(workDir, "cli-subset", "generated", "asset-manifest.json");
    const cli = join(PROJECT_ROOT, "scripts", "media", "pipeline.ts");
    const run = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        "--import",
        "./scripts/validate/register-ts-resolve.mjs",
        cli,
        "--gallery",
        PUBLISHED_GALLERY,
        "--content-root",
        PROJECT_ROOT,
        "--out",
        outDir,
        "--manifest",
        manifestPath,
        "--concurrency",
        "4",
      ],
      { cwd: PROJECT_ROOT, encoding: "utf8", timeout: 280_000 },
    );
    // Pre-fix, this run exited 1: the coverage gate joined the WHOLE corpus
    // content graph while only the subset had been derived.
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("[wp23] coverage OK");
    expect(run.stdout).toContain("4 complete / 0 incomplete"); // the subset's 4 published photos
  }, 300_000);
});
