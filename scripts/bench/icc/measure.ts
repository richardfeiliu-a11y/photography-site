// WP-16 measurement script — regenerates the color/bytes evidence recorded in
// docs/implementation/decisions/ICC-POLICY.md (D9/D10). Run:
//   npm run bench:wp16:measure
//
// Read-only with respect to the frozen corpus (media/stage3c-fixtures/): all
// encodes go to buffers or tmpdir copies created by the fixture factory.
// Verified Sharp APIs only (TECHNICAL_API_VERIFICATION.md §2).
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { createIccFixtures, HOST_PROFILE_PATHS } from "./fixtures.ts";

const CORPUS = join(import.meta.dirname, "..", "..", "..", "media", "stage3c-fixtures");
const F04 = join(CORPUS, "DSC02560.jpg"); // F04 "most saturated" (manifest §1)
const F10 = join(CORPUS, "DSC02367.jpg"); // F10 baseline "normal" (manifest §1)

function meanAbsDelta(a: Uint8Array, b: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
}

const rawPixels = async (input: Buffer | string): Promise<Uint8Array> =>
  (await sharp(input).raw().toBuffer({ resolveWithObject: true })).data;

const toSrgbDerivative = async (input: Buffer | string, format: "jpeg" | "avif"): Promise<Buffer> => {
  const pipeline = sharp(input).rotate().toColourspace("srgb");
  return format === "avif"
    ? pipeline.avif({ quality: 65 }).toBuffer()
    : pipeline.jpeg({ quality: 75, progressive: true }).toBuffer();
};

// --- 1. Pixel-delta probes (centered 512×512 crop of F04, JPEG q90 fixtures) ---
const work = await mkdtemp(join(tmpdir(), "wp16-measure-"));
const fixtures = await createIccFixtures({
  sourcePath: F04,
  outDir: work,
  crop: { left: 426, top: 768, width: 512, height: 512 }, // centered on 1365×2048
  quality: 90,
});
const baseline = await toSrgbDerivative(fixtures.paths.untagged, "jpeg");
const baselinePixels = await rawPixels(baseline);
const convertedAdobe = await rawPixels(await toSrgbDerivative(fixtures.paths["tagged-adobe-rgb"], "jpeg"));
const convertedP3 = await rawPixels(await toSrgbDerivative(fixtures.paths["tagged-display-p3"], "jpeg"));
const convertedSrgb = await rawPixels(await toSrgbDerivative(fixtures.paths["tagged-srgb"], "jpeg"));
const explicitConv = await sharp(fixtures.paths.untagged).toColourspace("srgb").raw().toBuffer();
const naiveDecode = await sharp(fixtures.paths.untagged).raw().toBuffer();

console.log("pixel probes (mean abs delta, 0-255 scale, F04 centered 512x512 crop):");
console.log("  wide-gamut AdobeRGB1998 -> sRGB vs naive passthrough:", meanAbsDelta(convertedAdobe, baselinePixels).toFixed(4));
console.log("  wide-gamut Display P3   -> sRGB vs naive passthrough:", meanAbsDelta(convertedP3, baselinePixels).toFixed(4));
console.log("  tagged-sRGB             -> sRGB vs naive passthrough:", meanAbsDelta(convertedSrgb, baselinePixels).toFixed(4));
console.log("  untagged explicit toColourspace('srgb') vs raw decode:", meanAbsDelta(explicitConv, naiveDecode).toFixed(4));

// --- 2. ICC embedding byte cost across the frozen ladder (F10) ---
console.log("\nICC embedding byte cost (F10 DSC02367, frozen qualities D3 + D7 over the D1 ladder incl. the D4 overview width):");
const ladder: ReadonlyArray<readonly [string, number]> = [
  ["overview-480", 480],
  ["gallery-800", 800],
  ["gallery-1280", 1280],
  ["gallery-2048", 2048],
];
for (const [label, width] of ladder) {
  for (const format of ["avif", "jpeg"] as const) {
    const avifQuality = label === "overview-480" ? 55 : 65;
    const base = sharp(F10).rotate().toColourspace("srgb").resize({ width, withoutEnlargement: true });
    const plain = format === "avif"
      ? await base.clone().avif({ quality: avifQuality }).toBuffer()
      : await base.clone().jpeg({ quality: 75, progressive: true }).toBuffer();
    const taggedPipeline = base.withIccProfile(HOST_PROFILE_PATHS.srgb);
    const embedded = format === "avif"
      ? await taggedPipeline.clone().avif({ quality: avifQuality }).toBuffer()
      : await taggedPipeline.clone().jpeg({ quality: 75, progressive: true }).toBuffer();
    const embeddedMeta = await sharp(embedded).metadata();
    const pct = (((embedded.length - plain.length) / plain.length) * 100).toFixed(2);
    const iccNote = embeddedMeta.icc ? `icc present (${embeddedMeta.icc.length}B)` : "icc MISSING";
    console.log(
      `  ${label.padEnd(12)} ${format}: plain=${plain.length}B embedded=${embedded.length}B delta=+${embedded.length - plain.length}B (+${pct}%) ${iccNote}`,
    );
  }
}

// --- 3. API traps (recorded as rejected history in ICC-POLICY.md §1) ---
const p3Source = await sharp(F10)
  .withIccProfile(HOST_PROFILE_PATHS.displayP3)
  .jpeg()
  .toBuffer();
const kept = await sharp(p3Source).rotate().toColourspace("srgb").keepIccProfile().jpeg().toBuffer();
const keptMeta = await sharp(kept).metadata();
const keptBytes = keptMeta.icc?.length ?? 0;
console.log("\nAPI traps:");
console.log(
  `  keepIccProfile() after toColourspace('srgb') retained ${keptBytes}B profile ${
    keptBytes !== 0 && keptBytes !== 3144 ? "(the Display P3 SOURCE profile, not sRGB — mislabel; rejected for the derivative path)" : ""
  }`,
);
try {
  const p3Meta = await sharp(p3Source).metadata();
  await sharp(F10).withIccProfile(p3Meta.icc as unknown as string).toBuffer();
  console.log("  withIccProfile(Buffer): unexpectedly accepted");
} catch {
  console.log("  withIccProfile(Buffer): rejected by sharp 0.35.4 (expects a filesystem path string)");
}

// --- 4. Corpus reality scan ---
let tagged = 0;
let untagged = 0;
for (const file of (await readdir(CORPUS)).filter((f) => f.toLowerCase().endsWith(".jpg"))) {
  const meta = await sharp(join(CORPUS, file)).metadata();
  if (meta.icc) tagged++;
  else untagged++;
}
console.log(`\ncorpus reality: ${tagged + untagged} JPEGs — ${tagged} tagged, ${untagged} untagged`);

await rm(work, { recursive: true, force: true });
