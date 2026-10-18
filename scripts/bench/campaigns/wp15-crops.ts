// WP-15 100% crop review packet — compact side-by-side crops for the HUMAN
// visual-quality review (D1–D7 stay OPEN; this packet provides evidence, not
// decisions). COMMITTED under docs/implementation/wp15-review/crops/ so the
// user can review WITHOUT running anything.
//
// Contents (bounded ≤ ~20MB, JPEG q90 panels — crops.ts's PNG trio stays the
// smoke-test format; this packet uses a compact single-composite variant):
//   For EACH of the 17 core fixtures at gallery_display 1280, THREE formats at
//   the representative mid qualities (jpeg q75 / webp q70 / avif q55):
//     <stem>-gallery1280-<center|edge>-<format>-q<q>-side-by-side.jpg
//   where each composite is [source-at-1280 | candidate] at 100% over a
//   320×320 region — center, plus a mechanical right-edge detail crop
//   (placement is mechanical, not curated).
//   For the 4 brief-named extreme fixtures (dark DSC01889, dense DSC01935,
//   saturated DSC02560, bright DSC02071): per format a quality-sweep strip
//     <stem>-gallery1280-center-sweep-<format>-q<lo>-q<mid>-q<hi>.jpg
//   = [source | qLow | qMid | qHigh] center crops at 100%.
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { runEncodeCandidate } from "../encode-runner.ts";
import { createFixtureRegistry } from "../fixtures.ts";
import { assertSameSnapshot, snapshotFixtureDir } from "../integrity.ts";
import { CORE17, EXTREME_FIXTURES, QUALITIES } from "./wp15-matrix.ts";

const ROOT = join(import.meta.dirname, "..", "..", "..");
const CROPS_DIR = join(ROOT, "docs", "implementation", "wp15-review", "crops");
const CAND_DIR = join(ROOT, "bench-output", "wp15", "crops-candidates");

const CROP = 320;
const PANEL_QUALITY = 90;

/** Representative mid qualities per format (brief-specified). */
const MID: Record<string, number> = { jpeg: 75, webp: 70, avif: 55 };

interface Region { left: number; top: number; width: number; height: number }

function regionFor(frameWidth: number, frameHeight: number, kind: "center" | "edge"): Region {
  const width = Math.min(CROP, frameWidth);
  const height = Math.min(CROP, frameHeight);
  const left = kind === "center"
    ? Math.floor((frameWidth - width) / 2)
    : Math.max(0, frameWidth - width); // mechanical right-edge crop
  const top = Math.floor((frameHeight - height) / 2);
  return { left, top, width, height };
}

async function panel(input: string, resizeWidth: number | undefined, region: Region): Promise<Buffer> {
  let pipeline = sharp(input).rotate();
  if (resizeWidth !== undefined) {
    pipeline = pipeline.resize({ width: resizeWidth, withoutEnlargement: true });
  }
  return pipeline.extract(region).toBuffer();
}

async function composite(panels: Buffer[], width: number, height: number, outPath: string): Promise<void> {
  const buf = await sharp({
    create: { width: width * panels.length, height, channels: 3, background: { r: 24, g: 24, b: 24 } },
  })
    .composite(panels.map((input, i) => ({ input, left: i * width, top: 0 })))
    .jpeg({ quality: PANEL_QUALITY })
    .toBuffer();
  writeFileSync(outPath, buf);
}

async function main(): Promise<void> {
  const registry = createFixtureRegistry();
  registry.verifyOnDisk();
  const before = await snapshotFixtureDir(registry.dir);
  mkdirSync(CROPS_DIR, { recursive: true });

  const written: string[] = [];

  for (const fixture of CORE17) {
    const sourceAbs = join(registry.dir, fixture);
    const stem = fixture.replace(/\.jpg$/, "");

    // Encode the three mid-quality candidates at gallery_display 1280
    // (deterministic content-addressed paths via the WP-07 runner).
    const candidates: Array<{ format: "jpeg" | "webp" | "avif"; quality: number }> =
      (["jpeg", "webp", "avif"] as const).map((format) => ({ format, quality: MID[format] }));
    const encoded = new Map<string, { path: string; width: number }>();
    for (const c of candidates) {
      const { row, outputPath } = await runEncodeCandidate(
        sourceAbs, fixture, { format: c.format, width: 1280, quality: c.quality }, CAND_DIR,
      );
      encoded.set(c.format, { path: outputPath, width: row.width });
    }

    const frame = encoded.get("jpeg")!;
    const frameMeta = await sharp(frame.path).metadata();
    const fw = frameMeta.width ?? frame.width;
    const fh = frameMeta.height ?? 0;

    for (const kind of ["center", "edge"] as const) {
      const region = regionFor(fw, fh, kind);
      const sourcePanel = await panel(sourceAbs, 1280, region);
      for (const c of candidates) {
        const candPanel = await panel(encoded.get(c.format)!.path, undefined, region);
        const outPath = join(CROPS_DIR, `${stem}-gallery1280-${kind}-${c.format}-q${c.quality}-side-by-side.jpg`);
        await composite([sourcePanel, candPanel], region.width, region.height, outPath);
        written.push(outPath);
      }
    }

    // Quality-sweep strips for the 4 extreme fixtures (center region).
    if (EXTREME_FIXTURES.includes(fixture)) {
      const region = regionFor(fw, fh, "center");
      const sourcePanel = await panel(sourceAbs, 1280, region);
      for (const format of ["jpeg", "webp", "avif"] as const) {
        const qualities = QUALITIES[format];
        const panels: Buffer[] = [sourcePanel];
        for (const q of qualities) {
          const { outputPath } = await runEncodeCandidate(
            sourceAbs, fixture, { format, width: 1280, quality: q }, CAND_DIR,
          );
          panels.push(await panel(outputPath, undefined, region));
        }
        const outPath = join(
          CROPS_DIR,
          `${stem}-gallery1280-center-sweep-${format}-q${qualities.join("-q")}.jpg`,
        );
        await composite(panels, region.width, region.height, outPath);
        written.push(outPath);
      }
    }
  }

  const after = await snapshotFixtureDir(registry.dir);
  assertSameSnapshot(before, after);

  const totalBytes = written.reduce((acc, p) => acc + statSync(p).size, 0);
  console.log(`[wp15] crops: ${written.length} composites, ${(totalBytes / 1024 / 1024).toFixed(1)} MB → ${CROPS_DIR}`);
  console.log(`[wp15] integrity: ${before.size} fixtures unchanged (before==after SHA-256)`);
}

main().catch((cause: unknown) => {
  console.error(`[wp15] crop packet FAILED: ${String(cause)}`);
  process.exitCode = 1;
});
