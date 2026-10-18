// WP-18 — metadata extraction + orientation normalization integration tests
// (IMAGE_PIPELINE.md §5 stages 2–3 + stage ordering invariants;
// TESTING_AND_VISUAL_REGRESSION.md §5 "EXIF orientation normalization").
//
// What is proven here, against REAL corpus pixels (F04 "most saturated",
// DSC02560.jpg, 1365×2048, per REAL_PHOTO_FIXTURE_MANIFEST.md):
//   1. The extractor reads the RAW EXIF orientation tag (sharp auto-applies
//      orientation only when .rotate() is called — extraction never assumes),
//      plus intrinsic dimensions, ICC presence (+ profile byte size) and the
//      source SHA-256 — BEFORE any strip (it only reads; masters are copies).
//   2. A source tagged orientation 6 (portrait stored pixels, landscape
//      intent) yields an UPRIGHT derivative with the stored dimensions
//      swapped back and NO residual orientation tag, whose pixel layout
//      matches the untagged reference crop.
//   3. Downstream is orientation-agnostic: resize works identically on
//      oriented output (dimensions contract + pixel agreement).
//   4. Extraction is complete for the WHOLE fixture corpus (113 stage3c
//      fixtures), cross-checked against the frozen checksum manifest.
//
// Fixtures are built at test time into a tmpdir — copies only; the frozen
// corpus under media/ is never mutated (guarded repo-wide by
// docs/fixtures-stage3c-sha256.txt).
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import sharp from "sharp";
import { extractSourceMetadata } from "../../scripts/media/extract";
import { orientedPipeline } from "../../scripts/media/orient";
import { HOST_PROFILE_PATHS } from "../../scripts/bench/icc/fixtures";

const F04_SOURCE = join(
  import.meta.dirname,
  "..",
  "..",
  "media",
  "stage3c-fixtures",
  "DSC02560.jpg",
);
// Top-left landscape crop of the portrait master — a real, asymmetric pixel
// payload (dark corner region), so a 90° rotation is detectable in bytes.
const CROP = { left: 0, top: 0, width: 768, height: 512 };
const REENCODING_MAX_MEAN_ABS_DELTA = 2.0; // JPEG q90 requantization noise headroom

let fixtureDir: string;
let basePath: string; // untagged upright reference (landscape 768×512)
let tagged6Path: string; // SAME crop, pixels rotated 90° CCW, EXIF orientation 6
let taggedSrgbPath: string; // SAME crop, host sRGB ICC profile attached

/** Mean absolute per-channel pixel delta (0–255 scale) between two raw decodes. */
async function meanAbsDelta(a: Buffer | string, b: Buffer | string): Promise<number> {
  const ra = await sharp(a).raw().toBuffer({ resolveWithObject: true });
  const rb = await sharp(b).raw().toBuffer({ resolveWithObject: true });
  expect(ra.info.width).toBe(rb.info.width);
  expect(ra.info.height).toBe(rb.info.height);
  expect(ra.info.channels).toBe(rb.info.channels);
  let sum = 0;
  for (let i = 0; i < ra.data.length; i++) sum += Math.abs(ra.data[i] - rb.data[i]);
  return sum / ra.data.length;
}

async function sha256File(path: string): Promise<string> {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

/**
 * JPEG EXIF APP1 splice (the brief's "minimal hand-built JPEG header splice"):
 * inserts an APP1 segment carrying EXIF bytes into a JPEG after SOI (+ any
 * APP0). We splice sharp's OWN EXIF blob — harvested from a throwaway
 * withMetadata({orientation: 6}) encode — rather than hand-building a TIFF
 * IFD, so the fixture's EXIF structure is exactly what sharp writes. (A
 * from-scratch minimal IFD was tried and libvips left metadata.orientation
 * undefined; sharp's own blob parses back as orientation 6 with no ICC.)
 */
function spliceJpegExifApp1(jpeg: Buffer, exifPayload: Buffer): Buffer {
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1]), Buffer.alloc(2), exifPayload]);
  app1.writeUInt16BE(exifPayload.length + 2, 2); // segment length incl. itself, excl. marker
  let offset = 2; // after SOI
  while (jpeg[offset] === 0xff && (jpeg[offset + 1] === 0xe0 || jpeg[offset + 1] === 0xe1)) {
    offset += 2 + jpeg.readUInt16BE(offset + 2);
  }
  return Buffer.concat([jpeg.subarray(0, offset), app1, jpeg.subarray(offset)]);
}

beforeAll(async () => {
  fixtureDir = await mkdtemp(join(tmpdir(), "wp18-orient-"));
  basePath = join(fixtureDir, "orientation-base.jpg");
  tagged6Path = join(fixtureDir, "orientation-6.jpg");
  taggedSrgbPath = join(fixtureDir, "tagged-srgb.jpg");
  // (1) Upright reference: real crop, sharp drops all metadata by default.
  await sharp(F04_SOURCE).extract(CROP).jpeg({ quality: 90 }).toFile(basePath);
  // (2) Orientation-6 fixture: the upright reference's pixels rotated 90° CCW
  //     (lossless rotation; the payload is re-encoded q90 ONCE so the
  //     derivative's own re-encode stays the only lossy step on that path),
  //     carrying an EXIF orientation tag 6 ("rotate 90° CW to display").
  //     sharp CANNOT set an arbitrary EXIF blob directly, and
  //     withMetadata({orientation}) both sets the tag AND embeds a 480-byte
  //     lcms ICC profile (measured), which would pollute the ICC-absence
  //     assertions. So: harvest sharp's own EXIF blob from a throwaway
  //     withMetadata({orientation: 6}) encode, then splice that APP1 into the
  //     metadata-free rotated payload (spliceJpegExifApp1 above). Verified
  //     against TECHNICAL_API_VERIFICATION §2 and probed on sharp 0.35.4 —
  //     exactly what the normalization question needs: stored pixels disagree
  //     with display intent until .rotate().
  const baseBuffer = await readFile(basePath);
  const harvest = await sharp(baseBuffer)
    .rotate(-90)
    .withMetadata({ orientation: 6 })
    .jpeg({ quality: 90 })
    .toBuffer();
  const exifPayload = (await sharp(harvest).metadata()).exif;
  expect(exifPayload).toBeDefined();
  const rotatedPayload = await sharp(baseBuffer).rotate(-90).jpeg({ quality: 90 }).toBuffer();
  await writeFile(tagged6Path, spliceJpegExifApp1(rotatedPayload, exifPayload!));
  // (3) ICC-carrying sibling for the extractor's presence flag.
  await sharp(F04_SOURCE)
    .extract(CROP)
    .withIccProfile(HOST_PROFILE_PATHS.srgb)
    .jpeg({ quality: 90 })
    .toFile(taggedSrgbPath);
}, 60_000);

afterAll(async () => {
  if (fixtureDir) await rm(fixtureDir, { recursive: true, force: true });
});

describe("WP-18 fixture honesty (copies of real corpus pixels; recipes above)", () => {
  test("upright reference carries no metadata (sharp default strip)", async () => {
    const meta = await sharp(basePath).metadata();
    expect(meta.width).toBe(768);
    expect(meta.height).toBe(512);
    expect(meta.orientation).toBeUndefined();
    expect(meta.icc).toBeUndefined();
    expect(meta.exif).toBeUndefined();
  });

  test("orientation-6 fixture stores portrait pixels with a raw tag 6", async () => {
    const meta = await sharp(tagged6Path).metadata();
    expect(meta.width).toBe(512); // stored (pre-normalization) dimensions
    expect(meta.height).toBe(768);
    expect(meta.orientation).toBe(6); // raw tag, NOT auto-applied by metadata()
  });
});

describe("WP-18 metadata extractor (stage 2 — BEFORE any strip)", () => {
  test("extracts raw orientation 6 + stored dims + absent ICC + source SHA-256", async () => {
    const record = await extractSourceMetadata(tagged6Path);
    expect(record.width).toBe(512);
    expect(record.height).toBe(768);
    expect(record.orientation).toBe(6);
    expect(record.icc.present).toBe(false);
    expect(record.icc.sizeBytes).toBeNull();
    expect(record.format).toBe("jpeg");
    expect(record.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(record.sha256).toBe(await sha256File(tagged6Path));
    // display dimensions already account for the tag the pipeline will apply
    expect(record.displayWidth).toBe(768);
    expect(record.displayHeight).toBe(512);
  });

  test("absent orientation tag reads as 1 (not assumed, honestly defaulted)", async () => {
    const record = await extractSourceMetadata(basePath);
    expect(record.orientation).toBe(1);
    expect(record.width).toBe(768);
    expect(record.height).toBe(512);
    expect(record.icc.present).toBe(false);
  });

  test("ICC presence flag carries the profile byte size when a profile exists", async () => {
    const record = await extractSourceMetadata(taggedSrgbPath);
    const meta = await sharp(taggedSrgbPath).metadata();
    expect(record.icc.present).toBe(true);
    expect(record.icc.sizeBytes).toBe(meta.icc?.length);
    expect(record.icc.sizeBytes).toBeGreaterThan(0);
  });

  test("extraction is read-only: source bytes identical before/after", async () => {
    const before = await sha256File(tagged6Path);
    await extractSourceMetadata(tagged6Path);
    expect(await sha256File(tagged6Path)).toBe(before);
  });

  test("works on in-memory buffers too (pipeline intermediate inputs)", async () => {
    const buffer = await readFile(tagged6Path);
    const record = await extractSourceMetadata(buffer);
    expect(record.orientation).toBe(6);
    expect(record.sha256).toBe(createHash("sha256").update(buffer).digest("hex"));
  });
});

describe("WP-18 orientation normalization (stage 3 — the single choke point)", () => {
  test("orientation-6 source yields an upright derivative: dims swapped back, no residual tag", async () => {
    const derivative = await orientedPipeline(tagged6Path).jpeg({ quality: 90 }).toBuffer();
    const meta = await sharp(derivative).metadata();
    expect(meta.width).toBe(768); // display intent restored
    expect(meta.height).toBe(512);
    expect(meta.orientation).toBeUndefined(); // no residual orientation tag
  });

  test("normalized derivative pixel layout matches the untagged upright reference", async () => {
    const derivative = await orientedPipeline(tagged6Path).jpeg({ quality: 90 }).toBuffer();
    const delta = await meanAbsDelta(derivative, basePath);
    expect(delta).toBeLessThan(REENCODING_MAX_MEAN_ABS_DELTA);
  });

  test("orientation-1 (untagged) input passes through unchanged in dimensions", async () => {
    const derivative = await orientedPipeline(basePath).jpeg({ quality: 90 }).toBuffer();
    const meta = await sharp(derivative).metadata();
    expect(meta.width).toBe(768);
    expect(meta.height).toBe(512);
    expect(meta.orientation).toBeUndefined();
  });

  test("the choke point itself does not resize or encode (full-size pixel output)", async () => {
    // Behavioral, not API-shape: run the choke point straight through to
    // pixels with NO downstream resize/encode call and assert the output is
    // FULL display size (768×512, not a thumbnail) — i.e. the pipeline only
    // normalized orientation; any resize is downstream business (WP-20).
    const { info } = await orientedPipeline(tagged6Path)
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(info.width).toBe(768); // full display width — orientation applied, no resize
    expect(info.height).toBe(512); // full display height
    expect(info.width * info.height).toBe(768 * 512); // every pixel present, no encode step
  });
});

describe("WP-18 orientation-agnostic downstream (resize contract)", () => {
  test("resize works identically on oriented output vs the upright reference", async () => {
    const fromReference = await sharp(basePath)
      .resize({ width: 256, withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toBuffer();
    const fromOriented = await orientedPipeline(tagged6Path)
      .resize({ width: 256, withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toBuffer();
    const metaA = await sharp(fromReference).metadata();
    const metaB = await sharp(fromOriented).metadata();
    expect(metaB.width).toBe(metaA.width);
    expect(metaB.height).toBe(metaA.height);
    // 768×512 at width 256 → 256×171 (aspect preserved, never upscaled)
    expect(metaB.width).toBe(256);
    expect(metaB.height).toBe(171);
    const delta = await meanAbsDelta(fromReference, fromOriented);
    expect(delta).toBeLessThan(REENCODING_MAX_MEAN_ABS_DELTA);
  });
});

describe("WP-18 extraction completeness over the frozen fixture corpus", () => {
  const CORPUS_DIR = join(import.meta.dirname, "..", "..", "media", "stage3c-fixtures");
  const MANIFEST = join(import.meta.dirname, "..", "..", "docs", "fixtures-stage3c-sha256.txt");

  test("every corpus fixture gets a complete record; SHA-256 matches the frozen manifest", async () => {
    const { readdirSync } = await import("node:fs");
    const corpusFiles = readdirSync(CORPUS_DIR).filter((f) => f.endsWith(".jpg"));
    expect(corpusFiles.length).toBe(113);

    const manifest = new Map<string, string>();
    for (const line of (await readFile(MANIFEST, "utf8")).split("\n")) {
      if (!line.trim()) continue;
      const [hash, path] = line.trim().split(/\s{2,}/);
      if (hash && path) manifest.set(path, hash);
    }

    for (const file of corpusFiles.sort()) {
      const relative = `media/stage3c-fixtures/${file}`;
      const record = await extractSourceMetadata(join(CORPUS_DIR, file));
      expect(record.width).toBeGreaterThan(0);
      expect(record.height).toBeGreaterThan(0);
      expect([1, 2, 3, 4, 5, 6, 7, 8]).toContain(record.orientation);
      expect(record.sha256).toMatch(/^[0-9a-f]{64}$/);
      const pinned = manifest.get(relative);
      expect(pinned, `manifest entry for ${relative}`).toBeDefined();
      expect(record.sha256).toBe(pinned);
    }
  });

  test("spot-pin: DSC02560.jpg = 1365×2048, orientation 1, IEC sRGB 3144-byte ICC", async () => {
    const record = await extractSourceMetadata(F04_SOURCE);
    expect(record.width).toBe(1365);
    expect(record.height).toBe(2048);
    expect(record.orientation).toBe(1);
    expect(record.icc.present).toBe(true);
    expect(record.icc.sizeBytes).toBe(3144);
    expect(record.format).toBe("jpeg");
    expect(record.displayWidth).toBe(1365);
    expect(record.displayHeight).toBe(2048);
  });
});
