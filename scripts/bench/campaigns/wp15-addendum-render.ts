// WP-15 Targeted Addendum — DPR rendering comparison at frozen Gallery geometry.
//
// The matrix script (wp15-addendum.ts) measures payload; this script measures
// what a REAL browser renders at the frozen Gallery frame:
//   media frame width: min(90vw, 1440px)  (FINAL_DESIGN_SPECIFICATION §3.1)
//   portrait height cap: 80svh            (G1/G2 frozen)
// Viewport 1600×1300 CSS → 90vw = 1440 exactly, so the frame is width-bound
// for landscape (1440 CSS px) and height-bound for portrait (80svh = 1040 CSS
// px). Each addendum candidate derivative (1600/2048/2560/2880) is rendered
// into the SAME frame at deviceScaleFactor 1 and 2 — the browser does exactly
// what production would ask of it (downscale W>needed, upscale W<needed) —
// and identical device-pixel regions are cropped from every screenshot so
// panels are directly comparable at 100%.
//
// Output: docs/implementation/wp15-review/addendum-crops/
//   <stem>-dpr2-center-w1600-w2048-w2560-w2880.jpg   4 panels @100% device px
//   <stem>-dpr2-edge-w1600-w2048-w2560-w2880.jpg
//   <stem>-dpr1-center-w1600-vs-w2880.jpg            2 panels (DPR1 reference)
// Raw screenshots stay in gitignored bench-output/wp15-addendum/screens/.
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { chromium } from "@playwright/test";

const ROOT = join(import.meta.dirname, "..", "..", "..");
const CAND_DIR = join(ROOT, "bench-output", "wp15-addendum", "candidates");
const SHOT_DIR = join(ROOT, "bench-output", "wp15-addendum", "screens");
const CROPS_DIR = join(ROOT, "docs", "implementation", "wp15-review", "addendum-crops");

const SOURCES = [
  { id: "DSC02850-fullres", orientation: "landscape" },
  { id: "FEI04145", orientation: "landscape" },
  { id: "FEI04197", orientation: "landscape" },
  { id: "FEI04093", orientation: "portrait" },
  { id: "FEI04064", orientation: "portrait" },
  { id: "FEI03936", orientation: "portrait" },
] as const;

const WIDTHS = [1600, 2048, 2560, 2880] as const;
const VIEWPORT = { width: 1600, height: 1300 };
const LABEL_H = 28;

function pageHtml(imagePath: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  /* Frozen Gallery geometry: media frame min(90vw, 1440px); portrait
     height-led at 80svh (G1/G2). Photo centered, aspect preserved. */
  html, body { margin: 0; padding: 0; background: #EFECE5; height: 100%; }
  .frame { width: min(90vw, 1440px); margin: 0 auto; display: flex;
           justify-content: center; align-items: center; }
  img { display: block; max-width: 100%; max-height: 80svh; width: auto; height: auto; }
</style></head>
<body><div class="frame"><img id="photo" src="file://${imagePath}"></div></body></html>`;
}

async function main(): Promise<void> {
  rmSync(SHOT_DIR, { recursive: true, force: true });
  mkdirSync(SHOT_DIR, { recursive: true });
  mkdirSync(CROPS_DIR, { recursive: true });
  const browser = await chromium.launch();

  for (const source of SOURCES) {
    const shots: Record<string, string> = {};
    for (const dpr of [1, 2] as const) {
      for (const width of WIDTHS) {
        if (dpr === 1 && width !== 1600 && width !== 2880) continue; // DPR1 reference only
        // Resolve the content-addressed JPEG candidate for this source/width
        // (the matrix run names files <stem>-<sourcethash>-<format>-w<width>-q<q>[p].jpg;
        // the 1600/2048/2560/2880 widths are unique to this campaign).
        const { readdirSync } = await import("node:fs");
        const match = readdirSync(CAND_DIR).find(
          (f) => f.startsWith(`${source.id}-`) && f.includes(`-w${width}-`) && f.endsWith(".jpg"),
        );
        if (match === undefined) throw new Error(`no candidate for ${source.id} w${width}`);
        const candidatePath = join(CAND_DIR, match);

        const context = await browser.newContext({
          viewport: VIEWPORT,
          deviceScaleFactor: dpr,
        });
        const page = await context.newPage();
        const htmlPath = join(SHOT_DIR, `page-${source.id}-${width}-${dpr}.html`);
        writeFileSync(htmlPath, pageHtml(candidatePath));
        await page.goto(`file://${htmlPath}`);
        await page.waitForLoadState("networkidle");
        const img = page.locator("#photo");
        await img.waitFor({ state: "visible" });
        const box = await img.boundingBox();
        if (box === null) throw new Error(`no bounding box for ${source.id} w${width}`);
        const shotPath = join(SHOT_DIR, `${source.id}-w${width}-dpr${dpr}.png`);
        await img.screenshot({ path: shotPath });
        console.log(
          `[wp15-addendum-render] ${source.id} w${width} dpr${dpr}: img ${box.width.toFixed(1)}×${box.height.toFixed(1)} CSS px`,
        );
        shots[`w${width}-dpr${dpr}`] = shotPath;
        await context.close();
      }
    }

    // Device-pixel geometry of the rendered <img> (identical across widths).
    const refMeta = await sharp(shots["w2880-dpr2"]).metadata();
    const imgW2 = refMeta.width ?? 0;
    const imgH2 = refMeta.height ?? 0;
    const refMeta1 = await sharp(shots["w1600-dpr1"]).metadata();
    const imgW1 = refMeta1.width ?? 0;
    const imgH1 = refMeta1.height ?? 0;

    // Center and right-edge crops in device px (mechanical, not curated).
    const cropW = 720;
    const cropH = 480;
    const center = {
      left: Math.floor((imgW2 - cropW) / 2),
      top: Math.floor((imgH2 - cropH) / 2),
      width: cropW,
      height: cropH,
    };
    const edge = {
      left: imgW2 - 8 - cropW,
      top: Math.floor((imgH2 - cropH) / 2),
      width: cropW,
      height: cropH,
    };

    await composite4(source.id, "center", shots, center);
    await composite4(source.id, "edge", shots, edge);

    // DPR1 reference: 1600-served vs 2880-served center panels.
    const crop1W = Math.round(cropW / 2);
    const crop1H = Math.round(cropH / 2);
    const center1 = {
      left: Math.floor((imgW1 - crop1W) / 2),
      top: Math.floor((imgH1 - crop1H) / 2),
      width: crop1W,
      height: crop1H,
    };
    const panels1 = [];
    for (const width of [1600, 2880] as const) {
      const crop = await sharp(shots[`w${width}-dpr1`]).extract(center1).jpeg({ quality: 90 }).toBuffer();
      panels1.push({ label: `w${width} @ DPR1`, crop });
    }
    await writeStrip(`${source.id}-dpr1-center-w1600-vs-w2880.jpg`, panels1, crop1W, crop1H);
  }

  await browser.close();
  console.log(`[wp15-addendum-render] composites → ${CROPS_DIR}`);
}

async function composite4(
  sourceId: string,
  region: "center" | "edge",
  shots: Record<string, string>,
  rect: { left: number; top: number; width: number; height: number },
): Promise<void> {
  const panels = [];
  for (const width of WIDTHS) {
    const crop = await sharp(shots[`w${width}-dpr2`]).extract(rect).jpeg({ quality: 90 }).toBuffer();
    panels.push({ label: `w${width} @ DPR2`, crop });
  }
  await writeStrip(
    `${sourceId}-dpr2-${region}-w1600-w2048-w2560-w2880.jpg`,
    panels,
    rect.width,
    rect.height,
  );
}

async function writeStrip(
  filename: string,
  panels: { label: string; crop: Buffer }[],
  cropW: number,
  cropH: number,
): Promise<void> {
  const labelSvg = (text: string) =>
    Buffer.from(
      `<svg width="${cropW}" height="${LABEL_H}"><rect width="100%" height="100%" fill="black"/><text x="6" y="20" font-size="17" fill="white" font-family="sans-serif">${text}</text></svg>`,
    );
  const composites = [];
  for (const [i, panel] of panels.entries()) {
    composites.push({ input: panel.crop, top: LABEL_H, left: i * cropW });
    composites.push({ input: labelSvg(panel.label), top: 0, left: i * cropW });
  }
  await sharp({
    create: { width: panels.length * cropW, height: LABEL_H + cropH, channels: 3, background: "#000" },
  })
    .composite(composites)
    .jpeg({ quality: 90 })
    .toFile(join(CROPS_DIR, filename));
  console.log(`[wp15-addendum-render] wrote ${filename} (${panels.length} panels, ${cropW}×${cropH} each)`);
}

await main();
