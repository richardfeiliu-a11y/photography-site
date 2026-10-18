// WP-16 integration color probes — measured evidence for decisions D9/D10
// (docs/implementation/decisions/ICC-POLICY.md), TDD RED before
// scripts/media/icc-policy.ts exists.
//
// What is proven here, against REAL corpus pixels (F04 "most saturated",
// DSC02560.jpg, per REAL_PHOTO_FIXTURE_MANIFEST.md via scripts/bench/fixtures.ts):
//   1. Wide-gamut tag → `toColourspace('srgb')` produces MEASURABLY different
//      pixels than naive passthrough (mean abs delta > threshold) — a real
//      color transform happens, honoring the profile (ADR-011 tagged path).
//   2. Untagged source → `toColourspace('srgb')` is a pixel NO-OP — the
//      documented assume-sRGB path never guesses and never shifts pixels.
//   3. The policy module drives the encode decision per mode.
//   4. D10 pin: the derivative encode path embeds NO ICC profile.
//
// Fixtures are built at test time into a tmpdir via the WP-16 factory
// (scripts/bench/icc/fixtures.ts) — copies only; the frozen corpus under
// media/ is never mutated (guarded repo-wide by sha256sum, see
// docs/fixtures-stage3c-sha256.txt).
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import sharp from "sharp";
import {
  createIccFixtures,
  HOST_PROFILE_PATHS,
  type IccFixtureSet,
} from "../../scripts/bench/icc/fixtures";
import {
  DEFAULT_UNTAGGED_ENFORCEMENT_MODE,
  ICC_ENFORCEMENT_MODES,
  evaluateIccSource,
} from "../../scripts/media/icc-policy";

// Measured on this frozen host (WP-16 probes, 512×512 centered crop of F04,
// JPEG q90 fixtures): Adobe-RGB-tagged vs naive passthrough = 2.067 mean abs
// (0–255), Display-P3 = 2.000, identity paths = 0.0000. Thresholds sit well
// inside the measured separation.
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

beforeAll(async () => {
  fixtureDir = await mkdtemp(join(tmpdir(), "wp16-icc-"));
  fixtures = await createIccFixtures({
    sourcePath: F04_SOURCE,
    outDir: fixtureDir,
    crop: CROP,
    quality: 90,
  });
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

/** Re-encode a source through the sRGB derivative path used by WP-19/WP-21. */
async function toSrgbDerivative(source: Buffer | string, format: "jpeg" | "avif"): Promise<Buffer> {
  const pipeline = sharp(source).rotate().toColourspace("srgb");
  return format === "avif"
    ? pipeline.avif({ quality: 65 }).toBuffer()
    : pipeline.jpeg({ quality: 75, progressive: true }).toBuffer();
}

describe("WP-16 fixture honesty (provenance in scripts/bench/icc/fixtures.ts)", () => {
  test("untagged fixture carries no ICC and no EXIF (sharp default strip)", async () => {
    const meta = await sharp(fixtures.paths.untagged).metadata();
    expect(meta.icc).toBeUndefined();
    expect(meta.exif).toBeUndefined();
  });

  test("tagged fixtures carry their real host profiles", async () => {
    expect(fixtures.iccBytes["tagged-srgb"]).toBeGreaterThan(0);
    expect(fixtures.iccBytes["tagged-adobe-rgb"]).toBeGreaterThan(0);
    expect(fixtures.iccBytes["tagged-display-p3"]).toBeGreaterThan(0);
    // All three came from the same source pixels; only the interpretation tag
    // differs — the untagged and tagged files encode the same crop.
    expect(fixtures.paths["tagged-adobe-rgb"]).not.toBe(fixtures.paths.untagged);
    expect(HOST_PROFILE_PATHS.adobeRgb1998).toMatch(/AdobeRGB1998\.icc$/);
    expect(HOST_PROFILE_PATHS.displayP3).toMatch(/Display P3\.icc$/);
  });
});

describe("WP-16 color probes (D9 evidence)", () => {
  test("wide-gamut tag + toColourspace('srgb') REALLY transforms pixels vs naive passthrough", async () => {
    // Naive passthrough baseline: the identical derivative encode pipeline run
    // on the untagged sibling (same stored pixels, ICC-ignored interpretation).
    // The converted Adobe-RGB derivative must differ measurably — otherwise
    // "convert to sRGB" would be a lie.
    const delta = await meanAbsDelta(
      await toSrgbDerivative(fixtures.paths["tagged-adobe-rgb"], "jpeg"),
      await toSrgbDerivative(fixtures.paths.untagged, "jpeg"),
    );
    expect(delta).toBeGreaterThan(WIDE_GAMUT_MIN_MEAN_ABS_DELTA);
  });

  test("Display-P3 tag likewise transforms measurably", async () => {
    const delta = await meanAbsDelta(
      await toSrgbDerivative(fixtures.paths["tagged-display-p3"], "jpeg"),
      await toSrgbDerivative(fixtures.paths.untagged, "jpeg"),
    );
    expect(delta).toBeGreaterThan(WIDE_GAMUT_MIN_MEAN_ABS_DELTA);
  });

  test("untagged + explicit toColourspace('srgb') is a pixel no-op (documented assume-sRGB path)", async () => {
    // Converting the untagged source must NOT shift pixels: the assumption is
    // recorded, not guessed, and it changes nothing (ADR-011 frozen path).
    // Both sides decode the SAME file — one with, one without the explicit
    // conversion — so JPEG re-encoding cannot mask or fake the result.
    const explicit = await sharp(fixtures.paths.untagged).toColourspace("srgb").raw().toBuffer();
    const naive = await sharp(fixtures.paths.untagged).raw().toBuffer();
    let sum = 0;
    for (let i = 0; i < explicit.length; i++) sum += Math.abs(explicit[i] - naive[i]);
    const delta = sum / explicit.length;
    expect(delta).toBeLessThan(IDENTITY_MAX_MEAN_ABS_DELTA);
  });

  test("tagged-sRGB source converts losslessly (identity interpretation)", async () => {
    // Like-for-like: both sides run the IDENTICAL derivative encode pipeline;
    // the only difference is the interpretation tag on the source, so any
    // delta would be a real (wrong) color transform. Same-pipeline JPEG
    // requantization of identical pixels must stay ≈0.
    const delta = await meanAbsDelta(
      await toSrgbDerivative(fixtures.paths["tagged-srgb"], "jpeg"),
      await toSrgbDerivative(fixtures.paths.untagged, "jpeg"),
    );
    expect(delta).toBeLessThan(IDENTITY_MAX_MEAN_ABS_DELTA);
  });
});

describe("WP-16 policy-driven encode (consumed by WP-19)", () => {
  test("tagged sources take the convert path; untagged follow the pinned default", async () => {
    const taggedDecision = evaluateIccSource({ hasValidIcc: true });
    expect(taggedDecision.action).toBe("convert-srgb");

    const untaggedDecision = evaluateIccSource(
      { hasValidIcc: false },
      DEFAULT_UNTAGGED_ENFORCEMENT_MODE,
    );
    expect(untaggedDecision.action).toBe("assume-srgb");
    expect(untaggedDecision.log).toBeNull(); // silent, per D9
  });

  test("fail mode rejects the untagged source before any encode happens", () => {
    const decision = evaluateIccSource({ hasValidIcc: false }, "fail");
    expect(decision.action).toBe("fail");
  });

  test("all three modes are recorded behaviors (choice is a default, not a hardcode)", () => {
    const actions = ICC_ENFORCEMENT_MODES.map((mode) =>
      evaluateIccSource({ hasValidIcc: false }, mode).action,
    );
    expect(actions).toEqual(["assume-srgb", "assume-srgb", "fail"]);
  });
});

describe("WP-16 output ICC embedding (D10 evidence, consumed by WP-21)", () => {
  test("the derivative encode path embeds NO ICC profile (JPEG)", async () => {
    const derivative = await toSrgbDerivative(fixtures.paths["tagged-adobe-rgb"], "jpeg");
    const meta = await sharp(derivative).metadata();
    expect(meta.icc).toBeUndefined();
  });

  test("the derivative encode path embeds NO ICC profile (AVIF)", async () => {
    const derivative = await toSrgbDerivative(fixtures.paths.untagged, "avif");
    const meta = await sharp(derivative).metadata();
    expect(meta.icc).toBeUndefined();
  });

  test("embedding is possible via withIccProfile and costs real bytes (measured alternative)", async () => {
    // D10 chose NOT to embed (ICC-POLICY.md); this records the alternative so
    // the choice stays reproducible.
    const embedded = await sharp(fixtures.paths.untagged)
      .rotate()
      .toColourspace("srgb")
      .withIccProfile(HOST_PROFILE_PATHS.srgb)
      .jpeg({ quality: 75, progressive: true })
      .toBuffer();
    const meta = await sharp(embedded).metadata();
    expect(meta.icc).toBeDefined();
    expect(embedded.length).toBeGreaterThan(
      (await sharp(await toSrgbDerivative(fixtures.paths.untagged, "jpeg")).toBuffer()).length,
    );
  });
});
