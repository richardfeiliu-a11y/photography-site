// WP-22 integration tests — fingerprint naming + asset manifest over REAL
// corpus pixels (IMAGE_PIPELINE.md §5 stage 8, §8.3, §9, §10; D8).
//
// The frozen corpus is NEVER mutated: masters are COPIED into a tmpdir and
// only the copies are derived. Proven here:
//   1. (f) End-to-end: derive → finalizeAndVerify (WP-21) → publish (WP-22
//      content-addressed names) → manifest; every record's public_url
//      resolves to an existing file whose bytes hash to derivative_hash and
//      whose dimensions match width/height.
//   2. (b) Corrected-master scenario (IMAGE_PIPELINE §4.1): replacing the
//      master bytes under the SAME Photo ID changes every derivative URL
//      while photo_id is unchanged (cached URLs invalidated automatically).
//   3. (e) WP-22 runs strictly after WP-21: a corrupt final byte stream →
//      finalizeAndVerify reports a finding → the naming stage refuses with
//      the rule token and publishes nothing.
//   4. (c) Manifest determinism: two identical full-pipeline runs produce
//      byte-identical canonical cores; the envelope (generated_at) is
//      separated and does not influence the core hash.
//   5. Cross-purpose byte identity on real pixels: gallery_display and
//      overview JPEG at the shared 480 rung are byte-identical → ONE
//      content-addressed file, both purposes recorded against it (WP-20.md).
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import sharp from "sharp";
import {
  deriveSource,
  loadDerivativeRecord,
  type DeriveSourceResult,
  type FrozenDerivativeRecord,
} from "../../scripts/media/derive";
import { finalizeAndVerify } from "../../scripts/media/privacy-check";
import {
  NAMING_INPUT_RULE,
  NamingError,
  publishDerivatives,
  resolveDigestHexChars,
  sha256Hex,
} from "../../scripts/media/naming";
import {
  buildDeterministicCore,
  canonicalJson,
  manifestCoreSha256,
  writeManifest,
} from "../../scripts/media/manifest";

/** The decision-record identity the manifest core must carry (never restated in code). */
function recordRef(): { id: string; frozen_at: string } {
  return { id: frozen.recordId, frozen_at: frozen.frozenAt };
}

const FIXTURES_DIR = join(import.meta.dirname, "..", "..", "media", "stage3c-fixtures");
const MASTER = "DSC01861.jpg"; // 2048×1018 landscape — smallest corpus source by area

let workDir: string;
let masterCopy: string;
let frozen: FrozenDerivativeRecord;

interface RunOutcome {
  result: DeriveSourceResult;
  published: Awaited<ReturnType<typeof publishDerivatives>>;
  coreSha: string;
}

async function runPipeline(
  photoId: string,
  source: string | Buffer,
  label: string,
): Promise<RunOutcome> {
  const outDir = join(workDir, `out-${label}`);
  const result = await deriveSource({ photoId, source }, { outDir, frozenRecord: frozen });
  const report = await finalizeAndVerify([result], {
    masters: typeof source === "string" ? [{ photoId, file: source, sha256: result.sourceSha256 }] : undefined,
  });
  expect(report.ok).toBe(true);
  const published = await publishDerivatives([result], {
    report,
    digestHexChars: resolveDigestHexChars(frozen),
  });
  const core = buildDeterministicCore(published.published, recordRef());
  return { result, published, coreSha: manifestCoreSha256(core) };
}

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), "wp22-manifest-"));
  masterCopy = join(workDir, MASTER);
  await cp(join(FIXTURES_DIR, MASTER), masterCopy);
  frozen = await loadDerivativeRecord();
}, 120_000);

afterAll(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe("(f) end-to-end: derive → finalizeAndVerify → publish → manifest", () => {
  let run: RunOutcome;

  beforeAll(async () => {
    run = await runPipeline("p_e2e_001", masterCopy, "e2e");
  }, 180_000);

  test("every published URL resolves to an existing file with matching bytes and dimensions", async () => {
    expect(run.published.published.length).toBeGreaterThan(0);
    const outDir = join(workDir, "out-e2e");
    for (const entry of run.published.published) {
      const file = join(outDir, entry.publicUrl.replace(/^\/media\//, ""));
      const bytes = await readFile(file);
      expect(bytes.length).toBe(entry.bytes);
      expect(sha256Hex(bytes)).toBe(entry.derivativeHash);
      // Byte identity across the rename: the final file's digest IS the D8
      // fingerprint, and the content-addressed name embeds its first 16 hex.
      expect(entry.digest).toBe(entry.derivativeHash.slice(0, 16));
      expect(file.endsWith(entry.digest + (entry.format === "jpeg" ? ".jpg" : ".avif"))).toBe(true);
      const meta = await sharp(file).metadata();
      expect(meta.width).toBe(entry.width);
      expect(meta.height).toBe(entry.height);
    }
  });

  test("the intermediate stage-5 names are gone — only content-addressed files remain", async () => {
    const outDir = join(workDir, "out-e2e");
    const files = await readdir(outDir);
    expect(files.length).toBe(run.published.finalFiles);
    for (const name of files) {
      // {photoId}-{format}-w{width}-{digest16}.{ext}
      expect(name).toMatch(/-w\d+-[0-9a-f]{16}\.(avif|jpg)$/);
    }
  });

  test("manifest core built from the run is a valid canonical document", async () => {
    const core = buildDeterministicCore(run.published.published, recordRef());
    const body = canonicalJson(core);
    expect(() => JSON.parse(body)).not.toThrow();
    const parsed = JSON.parse(body) as { records: Array<{ public_url: string }> };
    expect(parsed.records).toHaveLength(run.published.published.length);
    expect(manifestCoreSha256(core)).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  test("writeManifest separates the timestamp envelope from the deterministic core", async () => {
    const core = buildDeterministicCore(run.published.published, recordRef());
    const manifestPath = join(workDir, "asset-manifest.json");
    await writeManifest(manifestPath, core, { generated_at: "2026-08-29T00:00:00.000Z" });
    const doc1 = (await readFile(manifestPath, "utf8")).toString();
    await writeManifest(manifestPath, core, { generated_at: "2027-01-01T12:34:56.789Z" });
    const doc2 = (await readFile(manifestPath, "utf8")).toString();

    const parsed1 = JSON.parse(doc1) as { manifest: unknown; envelope: { generated_at: string } };
    const parsed2 = JSON.parse(doc2) as { manifest: unknown; envelope: { generated_at: string } };
    expect(parsed1.envelope.generated_at).toBe("2026-08-29T00:00:00.000Z");
    expect(parsed2.envelope.generated_at).toBe("2027-01-01T12:34:56.789Z");
    // Only the envelope differs — the deterministic core is byte-stable.
    expect(JSON.stringify(parsed1.manifest)).toBe(JSON.stringify(parsed2.manifest));
    expect(doc1.replace("2026-08-29T00:00:00.000Z", "X")).toBe(doc2.replace("2027-01-01T12:34:56.789Z", "X"));  });
});

describe("(c) determinism: two identical runs → identical core hash", () => {
  test("full pipeline twice on the same master yields the same canonical core", async () => {
    const run1 = await runPipeline("p_det_001", masterCopy, "det1");
    const run2 = await runPipeline("p_det_001", masterCopy, "det2");
    expect(run1.coreSha).toBe(run2.coreSha);
    const core1 = buildDeterministicCore(run1.published.published, recordRef());
    const core2 = buildDeterministicCore(run2.published.published, recordRef());
    expect(canonicalJson(core1)).toBe(canonicalJson(core2));
  }, 240_000);
});

describe("(b) corrected master under the same Photo ID", () => {
  test("replaced master bytes → all URLs change, photo_id and record identity do not", async () => {
    const original = await runPipeline("p_corrected_001", masterCopy, "cm-orig");
    // "Re-export" the master: same photo content, different bytes.
    const correctedBytes = await sharp(await readFile(masterCopy))
      .jpeg({ quality: 88 })
      .toBuffer();
    expect(sha256Hex(correctedBytes)).not.toBe(sha256Hex(await readFile(masterCopy)));
    const corrected = await runPipeline("p_corrected_001", correctedBytes, "cm-new");

    expect(corrected.result.photoId).toBe(original.result.photoId);
    expect(corrected.result.sourceSha256).not.toBe(original.result.sourceSha256);

    const originalUrls = original.published.published.map((d) => d.publicUrl).sort();
    const correctedUrls = corrected.published.published.map((d) => d.publicUrl).sort();
    expect(correctedUrls).toHaveLength(originalUrls.length);
    expect(correctedUrls).not.toEqual(originalUrls);
    for (const url of correctedUrls) expect(originalUrls).not.toContain(url);
  }, 240_000);
});

describe("(e) refusal when WP-21 verification fails", () => {
  test("one corrupted final file → the naming stage refuses with the rule token", async () => {
    const outDir = join(workDir, "out-refused");
    const result = await deriveSource(
      { photoId: "p_refused_001", source: masterCopy },
      { outDir, frozenRecord: frozen },
    );
    // Corrupt ONE derivative (append trailing garbage → malformed stream).
    const victim = result.derivatives[0]!;
    await writeFile(victim.file, Buffer.concat([await readFile(victim.file), Buffer.from([0x00, 0xff])]));
    const report = await finalizeAndVerify([result], { throwOnError: false });
    expect(report.ok).toBe(false);
    expect(report.findings.length).toBeGreaterThan(0);

    await expect(
      publishDerivatives([result], { report, digestHexChars: resolveDigestHexChars(frozen) }),
    ).rejects.toThrow(NamingError);
    await expect(
      publishDerivatives([result], { report, digestHexChars: resolveDigestHexChars(frozen) }),
    ).rejects.toThrow(new RegExp(NAMING_INPUT_RULE.replace(":", "\\:")));
    // Nothing was renamed: the intermediates are all still in place.
    const files = await readdir(outDir);
    expect(files).toHaveLength(result.derivatives.length);
  }, 180_000);
});

describe("cross-purpose byte identity on real pixels (WP-20.md)", () => {
  test("gallery/overview JPEG at the shared 480 rung: ONE file, two purposes recorded", async () => {
    const run = await runPipeline("p_shared_001", masterCopy, "shared");
    const { published } = run;
    // 2048-wide source, uncapped: 20 intermediates (purposes × rungs × formats).
    expect(published.published.length).toBe(20);
    expect(published.finalFiles).toBeLessThan(20);

    const sharedUrl = published.published.find(
      (d) => d.purpose === "gallery_display" && d.format === "jpeg" && d.width === 480,
    )!.publicUrl;
    const overviewJpeg = published.published.find(
      (d) => d.purpose === "overview" && d.format === "jpeg",
    )!;
    expect(overviewJpeg.publicUrl).toBe(sharedUrl);

    const core = buildDeterministicCore(published.published, recordRef());
    const recordsAtUrl = core.records.filter((r) => r.public_url === sharedUrl);
    expect(recordsAtUrl.map((r) => r.purpose).sort()).toEqual(["gallery_display", "overview"]);
    // Exactly one file backs both records.
    const files = await readdir(join(workDir, "out-shared"));
    expect(files.filter((f) => f === sharedUrl.replace(/^\/media\//, ""))).toHaveLength(1);
  }, 240_000);
});
