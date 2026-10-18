// WP-20 integration — derivative generation against REAL corpus pixels
// (IMAGE_PIPELINE.md §5 stage 5, §10.3, §15; WP-15 record BENCHMARK-OQ01-OQ02).
//
// The frozen corpus is NEVER mutated: masters are COPIED into a tmpdir and
// only the copies are derived (REAL_PHOTO_FIXTURE_MANIFEST.md). Proven here:
//   1. (a) Aspect-ratio preservation within 1px rounding for a LANDSCAPE and a
//      PORTRAIT corpus fixture across ALL planned widths — no crop anywhere.
//   2. (b) No enlargement: a 1365px-wide corpus master requested at 1600/2048/
//      2560 yields ONE derivative at the SOURCE width 1365 (withoutEnlargement
//      proven at the file level: nothing wider than the master is ever written).
//   3. (c) Overview derivatives are contained/uncropped; cover derivatives are
//      uncropped — dimension assertions against the source aspect ratio.
//   4. (e) Concurrency equivalence: deriveAll with configurable workers
//      produces the same logical set (same variant matrix, same byte counts,
//      byte-identical files) as sequential derivation.
//   5. Files land ONLY under the requested outDir with deterministic,
//      derivable intermediate names; outputs carry no ICC (D10 continuity —
//      WP-21 verifies final derivatives) and no EXIF (sharp's strip default).
//   6. The D9 policy is inherited from stage 4: policy "fail" on an untagged
//      source fails closed with the build-blocking token 11.1:color-policy.
import { mkdtemp, cp, mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import sharp from "sharp";
import {
  deriveAll,
  deriveSource,
  derivativeFileName,
  planDerivatives,
  parseDerivativeRecord,
} from "../../scripts/media/derive";
import { extractSourceMetadata, type SourceMetadataRecord } from "../../scripts/media/extract";
import { ColorPolicyError } from "../../scripts/media/color";

const FIXTURES_DIR = join(import.meta.dirname, "..", "..", "media", "stage3c-fixtures");
const DECISION_DOC = join(
  import.meta.dirname,
  "..",
  "..",
  "docs",
  "implementation",
  "decisions",
  "BENCHMARK-OQ01-OQ02.md",
);
const LANDSCAPE_MASTER = "DSC01836.jpg"; // 2048×1365 (F05, ordinary 3:2 landscape)
const PORTRAIT_MASTER = "DSC02416.jpg"; // 1365×2048 (F06, bright portrait)

let workDir: string;
let landscapeCopy: string;
let portraitCopy: string;
let outCorpus: string;
let outSeq: string;
let outPar: string;
let landscapeRecord: SourceMetadataRecord;
let portraitRecord: SourceMetadataRecord;
let recordText: string;

async function outputPathMeta(file: string): Promise<{ width: number; height: number }> {
  const meta = await sharp(file).metadata();
  return { width: meta.width ?? 0, height: meta.height ?? 0 };
}

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), "wp20-derivation-"));
  outCorpus = join(workDir, "out-corpus");
  outSeq = join(workDir, "out-seq");
  outPar = join(workDir, "out-par");
  await mkdir(outCorpus, { recursive: true });
  landscapeCopy = join(workDir, LANDSCAPE_MASTER);
  portraitCopy = join(workDir, PORTRAIT_MASTER);
  await cp(join(FIXTURES_DIR, LANDSCAPE_MASTER), landscapeCopy);
  await cp(join(FIXTURES_DIR, PORTRAIT_MASTER), portraitCopy);
  landscapeRecord = await extractSourceMetadata(landscapeCopy);
  portraitRecord = await extractSourceMetadata(portraitCopy);
  recordText = await readFile(DECISION_DOC, "utf8");
}, 120_000);

afterAll(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe("WP-20 corpus derivation — aspect, containment, no-enlargement", () => {
  let landscape: Awaited<ReturnType<typeof deriveSource>>;
  let portrait: Awaited<ReturnType<typeof deriveSource>>;

  beforeAll(async () => {
    [landscape, portrait] = await Promise.all([
      deriveSource(
        { photoId: "f05_landscape", source: landscapeCopy, record: landscapeRecord },
        { outDir: outCorpus, frozenRecord: parseDerivativeRecord(recordText) },
      ),
      deriveSource(
        { photoId: "f06_portrait", source: portraitCopy, record: portraitRecord },
        { outDir: outCorpus, frozenRecord: parseDerivativeRecord(recordText) },
      ),
    ]);
  }, 300_000);

  test("the generated set equals the planned variant set for each source", () => {
    const frozen = parseDerivativeRecord(recordText);
    for (const result of [landscape, portrait]) {
      const plan = planDerivatives(frozen, result.photoId, result.displayWidth);
      const planned = plan.map((v) => `${v.purpose}-${v.format}-w${v.width}`).sort();
      const actual = result.derivatives.map((d) => `${d.purpose}-${d.format}-w${d.width}`).sort();
      expect(actual).toEqual(planned);
    }
    // Landscape 2048-wide: gallery 6 uncapped rungs + overview 1 + cover 3
    // (2560 caps to 2048) = 10 widths × 2 formats. Portrait 1365-wide: the
    // caps dedupe → 5 gallery + 1 overview + 2 cover = 8 widths × 2 formats.
    expect(landscape.derivatives.length).toBe(20);
    expect(portrait.derivatives.length).toBe(16);
  });

  test("(a) aspect ratio preserved within 1px rounding across ALL widths (landscape + portrait)", async () => {
    for (const result of [landscape, portrait]) {
      const srcW = result.displayWidth;
      const srcH = result.displayHeight;
      for (const d of result.derivatives) {
        const expectedHeight = Math.round((srcH * d.width) / srcW);
        expect(
          Math.abs(d.height - expectedHeight),
          `${result.photoId} ${d.purpose} ${d.format} w${d.width}: ${d.height} vs ${expectedHeight}`,
        ).toBeLessThanOrEqual(1);
        // The recorded dimensions are the FILE's dimensions (honesty).
        const meta = await outputPathMeta(d.file);
        expect(meta.width).toBe(d.width);
        expect(meta.height).toBe(d.height);
      }
    }
  });

  test("(c) overview derivatives are contained/uncropped; cover derivatives are uncropped", async () => {
    for (const result of [landscape, portrait]) {
      const srcW = result.displayWidth;
      const srcH = result.displayHeight;
      for (const purpose of ["overview", "cover"] as const) {
        const variants = result.derivatives.filter((d) => d.purpose === purpose);
        expect(variants.length).toBeGreaterThanOrEqual(2);
        for (const d of variants) {
          const expectedHeight = Math.round((srcH * d.width) / srcW);
          expect(Math.abs(d.height - expectedHeight)).toBeLessThanOrEqual(1);
          // Overview is contained at the 480px ceiling (D4); cover starts at
          // the frozen 1280 rung (D5).
          if (purpose === "overview") expect(d.width).toBeLessThanOrEqual(480);
          if (purpose === "cover") expect(d.width).toBeGreaterThanOrEqual(1280);
        }
      }
    }
  });

  test("(b) a 1365px master requested at 1600/2048/2560 yields ONE derivative at the SOURCE width", async () => {
    expect(portrait.displayWidth).toBe(1365);
    // No derivative wider than the master exists on disk or in the results.
    expect(portrait.derivatives.some((d) => d.width > 1365)).toBe(false);
    // The capped rung is recorded with its ACTUAL width and its first
    // exceeding requested width, for BOTH formats.
    for (const format of ["avif", "jpeg"] as const) {
      const capped = portrait.derivatives.filter(
        (d) => d.purpose === "gallery_display" && d.format === format && d.width === 1365,
      );
      expect(capped).toHaveLength(1);
      expect(capped[0]!.requestedWidth).toBe(1600);
      const meta = await outputPathMeta(capped[0]!.file);
      expect(meta.width).toBe(1365); // decoded honesty: exactly the source width
    }
    // And no file with a capped-looking name above the source width exists.
    const names = await readdir(outCorpus);
    expect(names.some((n) => n.startsWith("f06_portrait-") && /-w(1600|2048|2560)\./.test(n))).toBe(
      false,
    );
  });

  test("files land under outDir ONLY, with deterministic derivable names", async () => {
    for (const result of [landscape, portrait]) {
      for (const d of result.derivatives) {
        const expectedName = derivativeFileName(result.photoId, d.purpose, d.format, d.width);
        expect(d.file).toBe(join(outCorpus, expectedName));
        const info = await stat(d.file);
        expect(info.size).toBe(d.bytes);
        expect(d.bytes).toBeGreaterThan(0);
      }
    }
    const names = (await readdir(outCorpus)).sort();
    expect(names.length).toBe(36); // 20 (landscape) + 16 (portrait, capped dedupe)
  });

  test("outputs carry no ICC (D10 continuity) and no EXIF (sharp strip default)", async () => {
    for (const d of portrait.derivatives) {
      const meta = await sharp(d.file).metadata();
      expect(meta.icc).toBeUndefined();
      expect(meta.exif).toBeUndefined();
      expect(meta.orientation).toBeUndefined();
    }
  });
});

describe("WP-20 concurrency equivalence (configurable workers)", () => {
  test("parallel derivation = sequential derivation (same matrix, same byte counts, identical bytes)", async () => {
    const frozen = parseDerivativeRecord(recordText);
    const sources = [
      { photoId: "conc_landscape", source: landscapeCopy, record: landscapeRecord },
      { photoId: "conc_portrait", source: portraitCopy, record: portraitRecord },
    ];
    const sequential = await deriveAll(sources, {
      outDir: outSeq,
      concurrency: 1,
      frozenRecord: frozen,
    });
    const parallel = await deriveAll(sources, {
      outDir: outPar,
      concurrency: 4,
      frozenRecord: frozen,
    });

    const row = (r: typeof sequential) =>
      r.results
        .flatMap((s) =>
          s.derivatives.map(
            (d) => `${s.photoId}|${d.purpose}|${d.format}|${d.width}|${d.height}|${d.bytes}`,
          ),
        )
        .sort();
    expect(row(parallel)).toEqual(row(sequential));

    // Same bytes means the parallel files are the sequential files' twins —
    // compare EVERY variant byte-for-byte (exhaustive, not a sample) to prove
    // full identity.
    for (const seqResult of sequential.results) {
      for (const d of seqResult.derivatives) {
        const parFile = join(outPar, basename(d.file));
        const seqBytes = await readFile(d.file);
        const parBytes = await readFile(parFile);
        expect(parBytes.equals(seqBytes)).toBe(true);
      }
    }

    // Results come back in input order regardless of worker scheduling.
    expect(parallel.results.map((r) => r.photoId)).toEqual(["conc_landscape", "conc_portrait"]);
  }, 300_000);

  test("invalid concurrency fails closed", async () => {
    await expect(
      deriveAll(
        [{ photoId: "x", source: landscapeCopy, record: landscapeRecord }],
        { outDir: join(workDir, "out-bad"), concurrency: 0, frozenRecord: parseDerivativeRecord(recordText) },
      ),
    ).rejects.toThrow(/concurrency/);
  });
});

describe("WP-20 policy inheritance from stage 4 (D9 through the composed chain)", () => {
  test("policy 'fail' on an untagged source rejects derivation with 11.1:color-policy", async () => {
    // The synthetic copy of a real corpus master retains its ICC; an untagged
    // input is built in-memory (sharp strips metadata by default).
    const untagged = await sharp({
      create: { width: 64, height: 48, channels: 3, background: { r: 90, g: 110, b: 130 } },
    })
      .jpeg({ quality: 90 })
      .toBuffer();
    await expect(
      deriveSource(
        { photoId: "p_untagged", source: untagged },
        { outDir: join(workDir, "out-policy"), frozenRecord: parseDerivativeRecord(recordText), policy: "fail" },
      ),
    ).rejects.toThrow(ColorPolicyError);
    await expect(
      deriveSource(
        { photoId: "p_untagged", source: untagged },
        { outDir: join(workDir, "out-policy"), frozenRecord: parseDerivativeRecord(recordText), policy: "fail" },
      ),
    ).rejects.toThrow(/11.1:color-policy/);
  });

  test("the frozen default ('assume') derives the untagged source silently", async () => {
    const untagged = await sharp({
      create: { width: 64, height: 48, channels: 3, background: { r: 90, g: 110, b: 130 } },
    })
      .jpeg({ quality: 90 })
      .toBuffer();
    const result = await deriveSource(
      { photoId: "p_untagged_ok", source: untagged },
      { outDir: join(workDir, "out-policy"), frozenRecord: parseDerivativeRecord(recordText) },
    );
    // 64px source: every purpose caps to 64 → 6 derivatives (3 purposes × 2 formats).
    expect(result.derivatives).toHaveLength(6);
    expect(result.derivatives.every((d) => d.width === 64)).toBe(true);
  });
});
