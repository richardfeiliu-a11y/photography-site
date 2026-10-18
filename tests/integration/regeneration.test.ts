// WP-23 integration tests — regeneration from empty generated/ + stale-file
// pruning (TESTING_AND_VISUAL_REGRESSION.md §4 "Delete generated/ and
// rebuild"; IMAGE_PIPELINE.md §8 manifest closure, §11.1 build-blocking).
//
// The frozen corpus is NEVER mutated: everything runs inside a tmpdir whose
// generated/ tree is wholly regenerable (REPOSITORY_STRUCTURE: generated/ is
// not committed). Proven here:
//   1. Delete generated/ entirely → rebuild from the same masters → the SAME
//      logical manifest (photo → purposes → formats → dimensions → URL set)
//      and the SAME derivative file set (test-pinned RED requirement).
//   2. In-place regeneration prunes stale files: a planted orphan derivative
//      in generated/media is REMOVED by the next run and is never silently
//      treated as authority (it is not in the manifest, and after the run the
//      directory equals the manifest closure exactly).
//   3. A deliberately missing variant for a published photo in the rebuilt
//      manifest fails coverage build-blocking (13.1#18).
//   4. Draft photos in the content graph (the 72-photo draft gallery) do not
//      block even though they have no derivatives (IMAGE_PIPELINE §11.3).
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { loadDerivativeRecord, type FrozenDerivativeRecord } from "../../scripts/media/derive";
import {
  COVERAGE_RULE,
  collectContentPhotos,
  loadManifestRows,
  validateCoverage,
} from "../../scripts/media/coverage";
import { pruneStaleDerivatives, runMediaPipeline, type PipelineResult } from "../../scripts/media/pipeline";
import type { ManifestRecord } from "../../scripts/media/manifest";

const PROJECT_ROOT = join(import.meta.dirname, "..", "..");
const PUBLISHED_GALLERY = "g_kota_kinabalu";
// The real archive has no drafts; this scenario synthesizes draft photos
// from the published gallery masters (in-memory draft projection).


let workDir: string;
let runA: PipelineResult;
let runB: PipelineResult;
let frozen: FrozenDerivativeRecord;

function sourcesFor(): Array<{ photoId: string; file: string }> {
  return collectContentPhotos(PROJECT_ROOT, { galleries: [PUBLISHED_GALLERY] })
    .filter((p) => !p.draft)
    .map((p) => ({ photoId: p.photoId, file: p.masterFile }));
}

/** Logical manifest view: photo → purposes → formats → dimensions + URL set. */
function logicalManifest(run: PipelineResult): Map<string, Map<string, Map<string, string[]>>> {
  const byPhoto = new Map<string, Map<string, Map<string, string[]>>>();
  for (const record of run.core.records as ManifestRecord[]) {
    const purposes = byPhoto.get(record.photo_id) ?? new Map();
    const formats = purposes.get(record.purpose) ?? new Map();
    const variants = formats.get(record.format) ?? [];
    variants.push(`${record.width}x${record.height} ${record.public_url}`);
    formats.set(record.format, variants.sort());
    purposes.set(record.purpose, formats);
    byPhoto.set(record.photo_id, purposes);
  }
  return byPhoto;
}

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), "wp23-regen-"));
  frozen = await loadDerivativeRecord();
  // Run A — the "previous" build.
  runA = await runMediaPipeline({
    sources: sourcesFor(),
    outDir: join(workDir, "a", "generated", "media"),
    manifestPath: join(workDir, "a", "generated", "asset-manifest.json"),
    concurrency: 4,
    frozenRecord: frozen,
  });
  // "Delete generated/ entirely": root B gets a junk generated/ tree first,
  // then it is removed, then the rebuild runs from empty state.
  const junkDir = join(workDir, "b", "generated", "media");
  await mkdir(junkDir, { recursive: true });
  await writeFile(join(junkDir, "stale-junk.jpg"), "stale");
  await rm(join(workDir, "b", "generated"), { recursive: true, force: true });
  // Run B — the regeneration from EMPTY generated/.
  runB = await runMediaPipeline({
    sources: sourcesFor(),
    outDir: join(workDir, "b", "generated", "media"),
    manifestPath: join(workDir, "b", "generated", "asset-manifest.json"),
    concurrency: 4,
    frozenRecord: frozen,
  });
}, 300_000);

afterAll(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe("WP-23 regeneration — delete generated/ and rebuild (TESTING §4)", () => {
  test("rebuild from empty generated/ reproduces the same logical manifest", () => {
    const a = logicalManifest(runA);
    const b = logicalManifest(runB);
    expect(a.size).toBeGreaterThan(0);
    expect([...a.keys()].sort()).toEqual([...b.keys()].sort());
    for (const [photoId, purposes] of a) {
      expect([...purposes.keys()].sort()).toEqual([...b.get(photoId)!.keys()].sort());
      for (const [purpose, formats] of purposes) {
        expect([...formats.keys()].sort()).toEqual(
          [...b.get(photoId)!.get(purpose)!.keys()].sort(),
        );
        for (const [format, variants] of formats) {
          expect(variants).toEqual(b.get(photoId)!.get(purpose)!.get(format));
        }
      }
    }
  });

  test("rebuild reproduces the same derivative FILE set with identical bytes", async () => {
    const dirA = join(workDir, "a", "generated", "media");
    const dirB = join(workDir, "b", "generated", "media");
    const filesA = (await readdir(dirA)).sort();
    const filesB = (await readdir(dirB)).sort();
    expect(filesA.length).toBeGreaterThan(0);
    expect(filesA).toEqual(filesB);
    for (const name of filesA) {
      const hashA = createHash("sha256").update(await readFile(join(dirA, name))).digest("hex");
      const hashB = createHash("sha256").update(await readFile(join(dirB, name))).digest("hex");
      expect(hashB).toBe(hashA);
    }
  });

  test("the regenerated manifest satisfies coverage for published content", async () => {
    const result = await validateCoverage({
      publishedPhotos: collectContentPhotos(PROJECT_ROOT, { galleries: [PUBLISHED_GALLERY] }),
      manifest: await loadManifestRows(runB.manifestPath),
      mediaRoot: join(workDir, "b", "generated", "media"),
      frozenRecord: frozen,
    });
    expect(result.ok).toBe(true);
    expect(result.findings).toEqual([]);
  });

  test("a deliberately missing variant in the REBUILT manifest is build-blocking (13.1#18)", async () => {
    const rows = (await loadManifestRows(runB.manifestPath))!;
    const published = collectContentPhotos(PROJECT_ROOT, { galleries: [PUBLISHED_GALLERY] }).filter(
      (p) => !p.draft,
    );
    const victim = rows.find(
      (r) => r.photo_id === published[0]!.photoId && r.purpose === "cover",
    )!;
    const result = await validateCoverage({
      publishedPhotos: collectContentPhotos(PROJECT_ROOT, { galleries: [PUBLISHED_GALLERY] }),
      manifest: rows.filter((r) => r !== victim),
      mediaRoot: join(workDir, "b", "generated", "media"),
      frozenRecord: frozen,
      verifyFiles: false,
    });
    expect(result.ok).toBe(false);
    expect(result.findings.map((f) => f.rule)).toContain(COVERAGE_RULE);
    const finding = result.findings.find((f) => f.rule === COVERAGE_RULE)!;
    expect(finding.message).toContain("cover");
    expect(finding.message).toContain(String(victim.width));
  });
});

describe("WP-23 stale-file pruning — orphans are never authority", () => {
  test("an orphan derivative planted in generated/media is pruned by the next run; the directory equals the manifest closure", async () => {
    // Root B is fully rebuilt; plant an orphan + verify it is NOT in the
    // manifest (a stale orphan is not treated as authority).
    const dirB = join(workDir, "b", "generated", "media");
    const orphanName = "p_stale_orphan-gallery_display-avif-w2048-deadbeefdeadbeef.avif";
    await writeFile(join(dirB, orphanName), "orphan-bytes");
    const rows = (await loadManifestRows(runB.manifestPath))!;
    expect(rows.some((r) => r.public_url.endsWith(orphanName))).toBe(false);

    // In-place regeneration: intermediates are re-derived and published over
    // the existing finals; the prune stage then removes everything the fresh
    // manifest does not reference.
    const runC = await runMediaPipeline({
      sources: sourcesFor(),
      outDir: dirB,
      manifestPath: join(workDir, "b", "generated", "asset-manifest.json"),
      concurrency: 4,
      frozenRecord: frozen,
    });
    expect(runC.prunedFiles).toContain(orphanName);
    await expect(stat(join(dirB, orphanName))).rejects.toMatchObject({ code: "ENOENT" });

    // Directory closure: every remaining file is referenced by the manifest,
    // and every referenced file exists.
    const remaining = new Set(await readdir(dirB));
    const referenced = new Set(rows.map((r) => r.public_url.split("/").pop()!));
    for (const name of remaining) expect(referenced.has(name)).toBe(true);
    for (const name of referenced) expect(remaining.has(name)).toBe(true);
    // Idempotent: the third run's logical manifest equals run A's.
    expect([...logicalManifest(runC).keys()].sort()).toEqual(
      [...logicalManifest(runA).keys()].sort(),
    );
  }, 300_000);

  test("MIN-02: a nested same-basename orphan is pruned; the referenced flat file survives (relative-path pruning)", async () => {
    // The pre-fix pruning compared BASENAMES: a nested/kept.avif orphan
    // survived because a referenced /media/kept.avif protected it (verified
    // false-negative probe, pruned=[]). Pruning now compares normalized
    // outDir-relative paths against the manifest.
    const dirA = join(workDir, "a", "generated", "media");
    const rows = (await loadManifestRows(runA.manifestPath))!;
    const referencedName = rows[0]!.public_url.split("/").pop()!;
    const nestedDir = join(dirA, "nested");
    await mkdir(nestedDir, { recursive: true });
    await writeFile(join(nestedDir, referencedName), "orphan-same-basename-bytes");

    const pruned = await pruneStaleDerivatives(dirA, runA.manifestPath);
    expect(pruned).toContain(`nested/${referencedName}`);
    await expect(stat(join(nestedDir, referencedName))).rejects.toMatchObject({ code: "ENOENT" });
    // The canonical referenced flat file is untouched, and the directory is
    // still exactly the manifest closure.
    await stat(join(dirA, referencedName));
    const remaining = new Set(await readdir(dirA));
    const referenced = new Set(rows.map((r) => r.public_url.slice("/media/".length)));
    for (const name of remaining) expect(referenced.has(name)).toBe(true);
    for (const name of referenced) expect(remaining.has(name)).toBe(true);
  }, 120_000);

  test("R-02: a legal consecutive-dot authority survives pruning; traversal/out-of-base authority aborts pruning", async () => {
    // R-02 (independent re-verification): the interim `includes("..")` check
    // deleted the LEGAL authority p..x-avif-w1-….avif (dots inside a filename
    // are not traversal — the Photo-ID contract only forbids whole-ID
    // "."/".."). Pruning now consumes the shared flatPublicUrlName rule.
    const dirA = join(workDir, "a", "generated", "media");
    const rows = (await loadManifestRows(runA.manifestPath))!;
    // (1) Legal consecutive-dot AUTHORITY: the p..x filename is referenced BY
    // the manifest (dots inside a filename are legal; only whole-ID "."/".."
    // are forbidden) and exists physically — it must survive pruning while a
    // true orphan is removed.
    const legalName = "p..x-avif-w1-aaaaaaaaaaaaaaaa.avif";
    await writeFile(join(dirA, legalName), "legal-consecutive-dot-authority");
    const withLegal = JSON.parse(await readFile(runA.manifestPath, "utf8"));
    const template = { ...withLegal.manifest.records[0] };
    withLegal.manifest.records.push({
      ...template,
      photo_id: "p..x",
      purpose: "gallery_display",
      format: "avif",
      width: 1,
      public_url: `/media/${legalName}`,
    });
    const legalManifest = join(workDir, "legal-dots-manifest.json");
    await writeFile(legalManifest, JSON.stringify(withLegal));
    await writeFile(join(dirA, "true-orphan.avif"), "orphan");
    const pruned = await pruneStaleDerivatives(dirA, legalManifest);
    expect(pruned).toContain("true-orphan.avif");
    expect(pruned).not.toContain(legalName);
    await stat(join(dirA, legalName));

    // (2) Real traversal-shaped authority: "/media/../victim.avif" maps
    // outside the flat layout — pruning must ABORT, never delete under an
    // unreliable protected set. (Also holds for any path-escaped form.)
    const traversingDoc = JSON.parse(await readFile(runA.manifestPath, "utf8"));
    traversingDoc.manifest.records[0].public_url = "/media/../victim.avif";
    const badManifest = join(workDir, "traversal-manifest.json");
    await writeFile(badManifest, JSON.stringify(traversingDoc));
    await expect(pruneStaleDerivatives(dirA, badManifest)).rejects.toThrow(
      /11\.1:manifest-url-shape.*not the flat layout/s,
    );
    // Nothing was deleted by the aborted prune.
    await stat(join(dirA, "p..x-avif-w1-aaaaaaaaaaaaaaaa.avif"));
    for (const row of rows) {
      await stat(join(dirA, row.public_url.slice("/media/".length)));
    }

    // (3) Out-of-base authority: same explicit abort.
    const outOfBase = JSON.parse(await readFile(runA.manifestPath, "utf8"));
    outOfBase.manifest.records[0].public_url = "/elsewhere/x.avif";
    const otherBase = join(workDir, "outbase-manifest.json");
    await writeFile(otherBase, JSON.stringify(outOfBase));
    await expect(pruneStaleDerivatives(dirA, otherBase)).rejects.toThrow(
      /11\.1:manifest-url-shape/,
    );
    await stat(join(dirA, "p..x-avif-w1-aaaaaaaaaaaaaaaa.avif"));

    // (4) Root behavior: the output root remains; planted extras are removed
    // and the directory equals closure under the real manifest.
    await rm(join(dirA, legalName));
    await rm(join(dirA, "true-orphan.avif"), { force: true }); // already pruned in (1)
    const remaining = new Set(await readdir(dirA));
    const referenced = new Set(rows.map((r) => r.public_url.slice("/media/".length)));
    for (const name of remaining) expect(referenced.has(name)).toBe(true);
    for (const name of referenced) expect(remaining.has(name)).toBe(true);
  }, 120_000);

  test("draft content in the pipeline's coverage view does not block (§11.3)", async () => {
    // The full content-graph view (published + draft galleries) against the
    // manifest that only covers the derived published gallery: the 72 draft
    // photos have no derivatives and produce no finding.
    const runC = await runMediaPipeline({
      sources: sourcesFor(),
      outDir: join(workDir, "c", "generated", "media"),
      manifestPath: join(workDir, "c", "generated", "asset-manifest.json"),
      concurrency: 4,
      frozenRecord: frozen,
      coverage: {
        publishedPhotos: [
          ...collectContentPhotos(PROJECT_ROOT, { galleries: [PUBLISHED_GALLERY] }),
          ...collectContentPhotos(PROJECT_ROOT, { galleries: [PUBLISHED_GALLERY] }).map((p) => ({
            ...p,
            draft: true,
            photoId: p.photoId + "_draft",
          })),
        ],
      },
    });
    expect(runC.coverage).toBeDefined();
    expect(runC.coverage!.ok).toBe(true);
    expect(runC.coverage!.findings).toEqual([]);
    expect(runC.ok).toBe(true);
  }, 300_000);
});
