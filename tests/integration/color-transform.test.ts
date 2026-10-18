// WP-19 integration — stage-4 color transform against REAL corpus pixels
// (IMAGE_PIPELINE.md §5 stage 4 + §6; WP-16 decision record ICC-POLICY.md).
//
// What is proven here, on the WP-16 fixture recipe (tag-vs-tag mutual
// identity is what the tests rely on; the corpus itself is never mutated —
// fixtures are built at test time into a tmpdir by the WP-16 factory):
//   1. A tagged wide-gamut source converted through the WP-19 module differs
//      MEASURABLY from naive passthrough of the same tagged file (threshold
//      consistent with WP-16's measured 2.0657 Adobe-RGB / 1.9991 Display-P3
//      — pinned delta > 1.0): a real gamut transform happens, honoring the
//      source ICC implicitly on decode (WP-16 measured explicit
//      toColourspace('srgb') === the implicit default).
//   2. A tagged-sRGB source passes through without double-conversion
//      artifacts (delta < 0.05 vs the untagged sibling through the same
//      encode — like-for-like, so any delta would be a wrong transform).
//   3. An untagged source follows the frozen D9 policy exactly: 'assume'
//      (default) is silent and a pixel no-op (delta < 0.05); 'warn' proceeds
//      with the recorded log entry; 'fail' rejects with rule token
//      11.1:color-policy (IMAGE_PIPELINE §11.1 build-blocking).
//   4. The module's output path embeds NO ICC profile (D10; WP-21 will
//      VERIFY the same on final derivatives — there is nothing to embed).
//   5. A ROTATED source (EXIF orientation 6, WP-18 recipe) through the
//      module yields an UPRIGHT derivative — dimensions swapped back,
//      pixel layout matching the untagged upright reference — proving the
//      module really starts from the stage-3 choke point.
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import sharp from "sharp";
import {
  createIccFixtures,
  type IccFixtureSet,
} from "../../scripts/bench/icc/fixtures";
import {
  ColorPolicyError,
  colorToSrgb,
} from "../../scripts/media/color";
import { extractSourceMetadata } from "../../scripts/media/extract";

// Measured on this frozen host (WP-16 probes, 512×512 centered crop of F04,
// JPEG q90 fixtures): Adobe-RGB-tagged vs naive passthrough = 2.0657 mean abs
// (0–255), Display-P3 = 1.9991, identity paths = 0.0000.
const WIDE_GAMUT_MIN_MEAN_ABS_DELTA = 1.0;
const IDENTITY_MAX_MEAN_ABS_DELTA = 0.05;

const F04_SOURCE = join(
  import.meta.dirname,
  "..",
  "..",
  "media",
  "stage3c-fixtures",
  "DSC02560.jpg",
);

let fixtureDir: string;
let fixtures: IccFixtureSet;
const CROP = { left: 426, top: 768, width: 512, height: 512 }; // centered on 1365×2048

// Orientation-6 fixtures (WP-18 recipe, docs/implementation/WP-18.md):
// an ASYMMETRIC landscape crop (768×512) so a 90° rotation is detectable in
// both dimensions and pixel layout.
const ORIENT_CROP = { left: 0, top: 0, width: 768, height: 512 };
// JPEG q90 requantization noise headroom (WP-18 measured 1.4699 through the
// same rotate-and-reencode recipe).
const REENCODING_MAX_MEAN_ABS_DELTA = 2.0;
let baseLandscapePath: string; // untagged upright reference (768×512)
let tagged6Path: string; // SAME crop, pixels rotated 90° CCW, EXIF orientation 6

beforeAll(async () => {
  fixtureDir = await mkdtemp(join(tmpdir(), "wp19-color-"));
  fixtures = await createIccFixtures({
    sourcePath: F04_SOURCE,
    outDir: fixtureDir,
    crop: CROP,
    quality: 90,
  });
  // Orientation-6 fixture per the WP-18 recipe: the upright reference's
  // pixels rotated 90° CCW (lossless), re-encoded q90 ONCE, then sharp's OWN
  // EXIF blob (harvested from a throwaway withMetadata({orientation: 6})
  // encode) spliced in as an APP1 — withMetadata would also embed a
  // 480-byte lcms ICC profile, and a hand-built IFD does not parse back.
  baseLandscapePath = join(fixtureDir, "orientation-base.jpg");
  tagged6Path = join(fixtureDir, "orientation-6.jpg");
  await sharp(F04_SOURCE).extract(ORIENT_CROP).jpeg({ quality: 90 }).toFile(baseLandscapePath);
  const baseBuffer = await readFile(baseLandscapePath);
  const harvest = await sharp(baseBuffer)
    .rotate(-90)
    .withMetadata({ orientation: 6 })
    .jpeg({ quality: 90 })
    .toBuffer();
  const exifPayload = (await sharp(harvest).metadata()).exif;
  expect(exifPayload).toBeDefined();
  const rotatedPayload = await sharp(baseBuffer).rotate(-90).jpeg({ quality: 90 }).toBuffer();
  await writeFile(tagged6Path, spliceJpegExifApp1(rotatedPayload, exifPayload!));
}, 60_000);

afterAll(async () => {
  if (fixtureDir) await rm(fixtureDir, { recursive: true, force: true });
});

/** Mean absolute per-channel pixel delta (0–255 scale) between two raw decodes. */
async function meanAbsDelta(a: Buffer | string, b: Buffer | string): Promise<number> {
  const ra = await sharp(a).raw().toBuffer({ resolveWithObject: true });
  const rb = await sharp(b).raw().toBuffer({ resolveWithObject: true });
  expect(ra.info.width * ra.info.height * ra.info.channels).toBe(
    rb.info.width * rb.info.height * rb.info.channels,
  );
  let sum = 0;
  for (let i = 0; i < ra.data.length; i++) sum += Math.abs(ra.data[i] - rb.data[i]);
  return sum / ra.data.length;
}

/** The WP-19 stage-4 module output, encoded to a derivative JPEG. */
async function derivativeViaColorModule(source: string): Promise<Buffer> {
  const pipeline = await colorToSrgb(source);
  return pipeline.jpeg({ quality: 75, progressive: true }).toBuffer();
}

/**
 * JPEG EXIF APP1 splice — verbatim helper from the WP-18 recipe
 * (tests/integration/orientation.test.ts): inserts an APP1 segment carrying
 * sharp's own harvested EXIF bytes after SOI (+ any APP0); segment length
 * includes itself, excludes the marker.
 */
function spliceJpegExifApp1(jpeg: Buffer, exifPayload: Buffer): Buffer {
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1]), Buffer.alloc(2), exifPayload]);
  app1.writeUInt16BE(exifPayload.length + 2, 2);
  let offset = 2; // after SOI
  while (jpeg[offset] === 0xff && (jpeg[offset + 1] === 0xe0 || jpeg[offset + 1] === 0xe1)) {
    offset += 2 + jpeg.readUInt16BE(offset + 2);
  }
  return Buffer.concat([jpeg.subarray(0, offset), app1, jpeg.subarray(offset)]);
}

describe("WP-19 stage-4 transform — tagged sources honor their ICC", () => {
  test("Adobe-RGB-tagged fixture converts with a REAL measured pixel delta vs naive passthrough", async () => {
    // Naive passthrough: the identical stage-4 encode run on the untagged
    // sibling (same stored pixels, ICC-ignored interpretation). The converted
    // Adobe-RGB derivative must differ measurably — otherwise "convert to
    // sRGB" would be a lie (WP-16 measured 2.0657 on this exact fixture set).
    const delta = await meanAbsDelta(
      await derivativeViaColorModule(fixtures.paths["tagged-adobe-rgb"]),
      await derivativeViaColorModule(fixtures.paths.untagged),
    );
    expect(delta).toBeGreaterThan(WIDE_GAMUT_MIN_MEAN_ABS_DELTA);
  });

  test("Display-P3-tagged fixture likewise transforms measurably", async () => {
    const delta = await meanAbsDelta(
      await derivativeViaColorModule(fixtures.paths["tagged-display-p3"]),
      await derivativeViaColorModule(fixtures.paths.untagged),
    );
    expect(delta).toBeGreaterThan(WIDE_GAMUT_MIN_MEAN_ABS_DELTA);
  });

  test("tagged-sRGB passes through WITHOUT double-conversion artifacts", async () => {
    // Like-for-like: identical encode pipelines, the only difference is the
    // interpretation tag (sRGB vs none). Double conversion would show as a
    // real delta; WP-16 measured 0.0000.
    const delta = await meanAbsDelta(
      await derivativeViaColorModule(fixtures.paths["tagged-srgb"]),
      await derivativeViaColorModule(fixtures.paths.untagged),
    );
    expect(delta).toBeLessThan(IDENTITY_MAX_MEAN_ABS_DELTA);
  });
});

describe("WP-19 stage-4 transform — untagged sources follow the frozen D9 policy", () => {
  test("default policy (assume): silent AND a pixel no-op (delta < 0.05)", async () => {
    // The pipeline returned by the module decodes to the SAME pixels as a
    // plain decode of the untagged file — the assumption changes nothing, it
    // is recorded (ICC-POLICY.md D2/D9), not guessed.
    const transformed = await (await colorToSrgb(fixtures.paths.untagged)).raw().toBuffer();
    const naive = await sharp(fixtures.paths.untagged).raw().toBuffer();
    let sum = 0;
    for (let i = 0; i < transformed.length; i++) sum += Math.abs(transformed[i] - naive[i]);
    const delta = sum / transformed.length;
    expect(delta).toBeLessThan(IDENTITY_MAX_MEAN_ABS_DELTA);
  });

  test("default policy (assume): NO log entry is emitted (silent per D9)", async () => {
    const logs: unknown[] = [];
    const pipeline = await colorToSrgb(fixtures.paths.untagged, {
      onLog: (entry) => logs.push(entry),
    });
    expect(pipeline).toBeDefined();
    expect(logs).toEqual([]);
  });

  test("'warn' mode: proceeds with the recorded ICC_UNTAGGED_ASSUMED_SRGB entry, pixels unchanged", async () => {
    const logs: Array<{ level: string; code: string; message: string }> = [];
    const pipeline = await colorToSrgb(fixtures.paths.untagged, {
      policy: "warn",
      onLog: (entry) => logs.push(entry),
    });
    expect(pipeline).toBeDefined();
    expect(logs).toHaveLength(1);
    expect(logs[0]!.code).toBe("ICC_UNTAGGED_ASSUMED_SRGB");
    expect(logs[0]!.level).toBe("warn");
    // Same pixels as the assume path — the mode only chooses logging.
    const warned = await pipeline.raw().toBuffer();
    const assumed = await (await colorToSrgb(fixtures.paths.untagged)).raw().toBuffer();
    expect(warned.equals(assumed)).toBe(true);
  });

  test("'fail' mode: build-blocking rejection with rule token 11.1:color-policy", async () => {
    const attempt = colorToSrgb(fixtures.paths.untagged, { policy: "fail" });
    await expect(attempt).rejects.toBeInstanceOf(ColorPolicyError);
    await expect(attempt).rejects.toMatchObject({ rule: "11.1:color-policy" });
    // The message carries the recorded rejection content.
    await expect(attempt).rejects.toThrow(/untagged/);
  });

  test("the policy input is the WP-18 extractor record (icc.present), not a fresh guess", async () => {
    // The module consumes the stage-2 record when given one: the tagged
    // fixture's record (icc.present = true) passes under 'fail'; a record
    // claiming no ICC (the untagged fixture's real record) rejects.
    const taggedRecord = await extractSourceMetadata(fixtures.paths["tagged-srgb"]);
    expect(taggedRecord.icc.present).toBe(true);
    const pipeline = await colorToSrgb(fixtures.paths["tagged-srgb"], {
      policy: "fail",
      record: taggedRecord,
    });
    expect(pipeline).toBeDefined();

    const untaggedRecord = await extractSourceMetadata(fixtures.paths.untagged);
    expect(untaggedRecord.icc.present).toBe(false);
    await expect(
      colorToSrgb(fixtures.paths["tagged-srgb"], { policy: "fail", record: untaggedRecord }),
    ).rejects.toMatchObject({ rule: "11.1:color-policy" });
  });
});

describe("WP-19 stage-4 output contract (D10 on this path)", () => {
  test("the stage-4 encode path embeds NO ICC profile (D10; WP-21 verifies finally)", async () => {
    for (const fixtureClass of ["tagged-adobe-rgb", "tagged-display-p3", "tagged-srgb", "untagged"] as const) {
      const derivative = await derivativeViaColorModule(fixtures.paths[fixtureClass]);
      const meta = await sharp(derivative).metadata();
      expect(meta.icc, `${fixtureClass} derivative must carry no ICC`).toBeUndefined();
    }
  });

  test("the module starts from the stage-3 choke point: orientation is normalized, nothing resized", async () => {
    // The returned pipeline's pixels are the FULL display size of the source
    // (512×512 crop here) — decode via orientedPipeline, no resize (stage 5
    // is downstream, WP-20).
    const pipeline = await colorToSrgb(fixtures.paths.untagged);
    const { info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
    expect(info.width).toBe(CROP.width);
    expect(info.height).toBe(CROP.height);
  });
});

describe("WP-19 stage-4 transform — a ROTATED source (EXIF orientation 6) comes out upright", () => {
  test("orientation-6 fixture through colorToSrgb: upright 768×512, reference pixel layout, silent assume", async () => {
    // Fixture honesty first: the WP-18 recipe yields portrait STORED pixels
    // (512×768) with a RAW orientation tag 6 and NO ICC (the splice carries
    // EXIF only) — an untagged rotated source, the worst case for the module.
    const record = await extractSourceMetadata(tagged6Path);
    expect(record.width).toBe(512);
    expect(record.height).toBe(768);
    expect(record.orientation).toBe(6);
    expect(record.icc.present).toBe(false);

    // Through the module under the frozen default policy: silent (assume),
    // and the returned pipeline decodes to the UPRIGHT display dimensions —
    // the orientation tag was baked into pixels by the stage-3 choke point,
    // not by this stage.
    const logs: unknown[] = [];
    const pipeline = await colorToSrgb(tagged6Path, { onLog: (entry) => logs.push(entry) });
    expect(logs).toEqual([]); // untagged + assume = silent per D9
    const { info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
    expect(info.width).toBe(768); // swapped back: landscape display intent
    expect(info.height).toBe(512);

    // Pixel uprightness: the module's stage-4 OUTPUT (raw, pre-encode — the
    // encode is stage 5) matches the untagged upright reference through the
    // SAME module. The only lossy step between the fixture payloads is the
    // recipe's single q90 rotate-reencode, so this measures the same shape
    // WP-18 measured (1.4699 through this recipe); threshold 2.0 is that
    // headroom. (A derivative-encode comparison would stack a second q75
    // requantization on both sides and mask the orientation signal.)
    const uprightPixels = await pipeline.raw().toBuffer();
    const referencePixels = await (await colorToSrgb(baseLandscapePath)).raw().toBuffer();
    let sum = 0;
    for (let i = 0; i < uprightPixels.length; i++) {
      sum += Math.abs(uprightPixels[i] - referencePixels[i]);
    }
    const delta = sum / uprightPixels.length;
    expect(delta).toBeLessThan(REENCODING_MAX_MEAN_ABS_DELTA);

    // And no residual orientation tag survives on the derivative.
    const derivativeMeta = await sharp(
      await derivativeViaColorModule(tagged6Path),
    ).metadata();
    expect(derivativeMeta.orientation).toBeUndefined();
  });
});
