// WP-23 integration tests — the determinism harness (IMAGE_PIPELINE.md §8
// determinism semantics; TESTING_AND_VISUAL_REGRESSION.md §5).
//
// Determinism wording, pinned by these tests and stated in
// docs/implementation/WP-23.md exactly per TESTING_AND_VISUAL_REGRESSION §5:
//   - SEMANTIC determinism (REQUIRED, §8.1): a repeat pipeline run over the
//     same source bytes, authored metadata, toolchain versions and pipeline
//     configuration produces the same logical derivative set and manifest
//     references (photo → purposes → formats → dimensions → public URL set).
//   - BYTE-FOR-BYTE determinism (conditional, §8.2): claimed ONLY within the
//     pinned toolchain environment (same OS/architecture, Node, sharp/libvips
//     versions, encoder options, JSON serialization order). These tests DO
//     assert byte identity between the two runs of THIS suite on THIS host
//     under the pinned toolchain (Node v22 + sharp 0.35.4); nothing here
//     asserts SHA-256-identical output across arbitrary Sharp/libvips
//     versions or machine environments.
//
// The frozen corpus is NEVER mutated: masters are COPIED-derived into a
// tmpdir (REAL_PHOTO_FIXTURE_MANIFEST.md).
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { loadDerivativeRecord, type FrozenDerivativeRecord } from "../../scripts/media/derive";
import { collectContentPhotos } from "../../scripts/media/coverage";
import { runMediaPipeline, type PipelineResult } from "../../scripts/media/pipeline";
import { canonicalJson, type ManifestCore } from "../../scripts/media/manifest";
import type { ManifestRecord } from "../../scripts/media/manifest";

const PROJECT_ROOT = join(import.meta.dirname, "..", "..");
const PUBLISHED_GALLERY = "g_kota_kinabalu"; // smallest published gallery in the real archive (4 photos)

let workDir: string;
let runA: PipelineResult;
let runB: PipelineResult;
let frozen: FrozenDerivativeRecord;

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), "wp23-determinism-"));
  frozen = await loadDerivativeRecord();
  const sources = collectContentPhotos(PROJECT_ROOT, { galleries: [PUBLISHED_GALLERY] })
    .filter((p) => !p.draft)
    .map((p) => ({ photoId: p.photoId, file: p.masterFile }));
  const base = {
    sources,
    concurrency: 4,
    frozenRecord: frozen,
  };
  runA = await runMediaPipeline({
    ...base,
    outDir: join(workDir, "a", "generated", "media"),
    manifestPath: join(workDir, "a", "generated", "asset-manifest.json"),
  });
  runB = await runMediaPipeline({
    ...base,
    outDir: join(workDir, "b", "generated", "media"),
    manifestPath: join(workDir, "b", "generated", "asset-manifest.json"),
  });
}, 300_000);

afterAll(async () => {
  await rm(workDir, { recursive: true, force: true });
});

/** The SEMANTIC view of a manifest core (§8.1): photo → purposes → formats
 * → dimensions + URL, with every list sorted — input-order independence. */
function semanticView(core: ManifestCore): Map<string, Map<string, Map<string, string[]>>> {
  const byPhoto = new Map<string, Map<string, Map<string, string[]>>>();
  for (const record of core.records as ManifestRecord[]) {
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

describe("WP-23 determinism — semantic (IMAGE_PIPELINE §8.1, REQUIRED)", () => {
  test("two independent runs produce the same logical derivative set and manifest references", () => {
    const viewA = semanticView(runA.core);
    const viewB = semanticView(runB.core);
    expect(viewA.size).toBeGreaterThan(0);
    expect([...viewA.keys()].sort()).toEqual([...viewB.keys()].sort());
    for (const [photoId, purposes] of viewA) {
      expect([...purposes.keys()].sort()).toEqual([...viewB.get(photoId)!.keys()].sort());
      for (const [purpose, formats] of purposes) {
        expect([...formats.keys()].sort()).toEqual(
          [...viewB.get(photoId)!.get(purpose)!.keys()].sort(),
        );
        for (const [format, variants] of formats) {
          // Dimensions + public URLs identical per (photo, purpose, format).
          expect(variants).toEqual(viewB.get(photoId)!.get(purpose)!.get(format));
        }
      }
    }
  });

  test("the manifest core (envelope excluded) is content-hash stable across runs (§8.3)", () => {
    expect(runA.coreSha256).toBe(runB.coreSha256);
  });
});

describe("WP-23 determinism — byte-for-byte (§8.2, conditional: THIS pinned toolchain ONLY)", () => {
  test("canonical core serialization is byte-identical between runs on this host/toolchain", () => {
    // §8.2 wording: byte identity is asserted ONLY within the pinned
    // toolchain environment this suite runs in (same OS/arch, Node v22,
    // sharp 0.35.4 / libvips as locked, same encoder options, canonical JSON
    // serialization order). This is NOT a cross-environment claim.
    expect(canonicalJson(runA.core)).toBe(canonicalJson(runB.core));
  });

  test("every published final file is byte-identical (same sha256) between runs", async () => {
    const dirA = join(workDir, "a", "generated", "media");
    const dirB = join(workDir, "b", "generated", "media");
    const byUrl = (run: PipelineResult): Map<string, string> => {
      const map = new Map<string, string>();
      for (const record of run.core.records as ManifestRecord[]) {
        map.set(record.public_url, record.derivative_hash);
      }
      return map;
    };
    const hashesA = byUrl(runA);
    const hashesB = byUrl(runB);
    expect([...hashesA.keys()].sort()).toEqual([...hashesB.keys()].sort());
    for (const [url, hashA] of hashesA) {
      expect(hashesB.get(url)).toBe(hashA);
      const name = url.split("/").pop()!;
      const liveA = createHash("sha256").update(await readFile(join(dirA, name))).digest("hex");
      const liveB = createHash("sha256").update(await readFile(join(dirB, name))).digest("hex");
      expect(liveA).toBe(hashA.replace(/^sha256:/, ""));
      expect(liveB).toBe(liveA);
    }
  });
});
