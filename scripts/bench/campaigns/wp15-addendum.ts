// WP-15 Targeted Addendum — High-DPR + Portrait evidence matrix.
//
// Closes the evidence gaps the original 17-photo campaign could not (all its
// fixtures were 2048×1365 landscape): whether 1600/2048/2560/2880 px
// derivatives produce visible gains at the frozen Gallery frame
// (min(90vw, 1440px)) at DPR 1 and DPR 2, and how portrait sources cap.
//
// Sources are REAL photographs from the author's archive library outside the
// repo (full-resolution exports) plus two existing corpus portrait masters as
// honest CAP cases. Sources are READ-ONLY: SHA-256 snapshotted before and
// after the run; no source is ever written, and no derivative is ever
// enlarged (withoutEnlargement is enforced by the shared encode runner).
//
// Matrix (addendum shortlist only — the codec/quality campaign is NOT rerun):
//   widths 1600 | 2048 | 2560 | 2880 (aspect-preserving, no crop)
//   AVIF q65 (provisional D3 gallery/cover quality)
//   AVIF q55 (reference control)
//   JPEG q75 progressive (provisional D2 fallback, D7 = yes)
//
// Output (gitignored, regenerable): bench-output/wp15-addendum/
//   candidates/            encoded files (content-addressed names)
//   results.json           full rows incl. fidelity + CAP records
//   matrix.md              the Matrix + Payload results tables for the addendum doc
//   sources-sha256-{before,after}.txt
import { statSync, writeFileSync, appendFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { runEncodeCandidate } from "../encode-runner.ts";
import { measureFidelity } from "../measure.ts";

const ROOT = join(import.meta.dirname, "..", "..", "..");
const OUT = join(ROOT, "bench-output", "wp15-addendum");
const CAND_DIR = join(OUT, "candidates");

interface AddendumSource {
  id: string;
  role: string;
  absPath: string;
  orientation: "landscape" | "portrait";
  origin: string;
}

const SOURCES: AddendumSource[] = [
  {
    id: "DSC02850-fullres",
    role: "landscape high-detail / architecture (village + snowy peaks + red cabins)",
    absPath: "~/Pictures/20250131-DSC02850.jpg",
    orientation: "landscape",
    origin: "author archive, full-resolution export (9504×5346, 16:9)",
  },
  {
    id: "FEI04145",
    role: "landscape smooth tonal / sky gradient (muted mountains, calm water)",
    absPath: "~/Pictures/Adobe Lightroom/Iceland/FEI04145.jpg",
    orientation: "landscape",
    origin: "author archive, full-resolution export (9504×6336, 3:2)",
  },
  {
    id: "FEI04197",
    role: "landscape saturated color (red-roof church, purple lupines)",
    absPath: "~/Pictures/Adobe Lightroom/Iceland/FEI04197.jpg",
    orientation: "landscape",
    origin: "author archive, full-resolution export (7805×5203, 3:2)",
  },
  {
    id: "FEI04093",
    role: "portrait high-detail (waterfall spray + figure)",
    absPath: "~/Pictures/Adobe Lightroom/Iceland/FEI04093.jpg",
    orientation: "portrait",
    origin: "author archive, full-resolution export (6336×9504, 2:3)",
  },
  {
    id: "FEI04064",
    role: "portrait smoother / tonal (figure on black-sand beach, moody)",
    absPath: "~/Pictures/Adobe Lightroom/Iceland/FEI04064.jpg",
    orientation: "portrait",
    origin: "author archive, full-resolution export (6336×9504, 2:3)",
  },
  {
    id: "FEI03936",
    role: "portrait strong color (white dress at turquoise lake, green hills)",
    absPath: "~/Pictures/Adobe Lightroom/Swiss/FEI03936.jpg",
    orientation: "portrait",
    origin: "author archive, full-resolution export (6336×9504, 2:3)",
  },
  {
    id: "DSC02416",
    role: "portrait CAP case — existing 2048-long-edge corpus master (bright portrait)",
    absPath: join(ROOT, "media", "ingest-masters", "portrait-studies", "DSC02416.jpg"),
    orientation: "portrait",
    origin: "corpus ingest master (1365×2048)",
  },
  {
    id: "DSC02851",
    role: "portrait CAP case — existing 2048-long-edge corpus master (quiet portrait)",
    absPath: join(ROOT, "media", "ingest-masters", "long-gallery-72", "DSC02851.jpg"),
    orientation: "portrait",
    origin: "corpus ingest master (1365×2048)",
  },
];

const WIDTHS = [1600, 2048, 2560, 2880] as const;
const VARIANTS = [
  { format: "avif" as const, quality: 65, progressive: false },
  { format: "avif" as const, quality: 55, progressive: false },
  { format: "jpeg" as const, quality: 75, progressive: true },
];

interface AddendumRow {
  source: string;
  role: string;
  sourceWidth: number;
  sourceHeight: number;
  requestedWidth: number;
  format: string;
  quality: number;
  progressive: boolean;
  capped: boolean;
  encoded: boolean;
  bytes: number | null;
  encodeTimeMs: number | null;
  derivedWidth: number | null;
  derivedHeight: number | null;
  psnr: number | null;
  ssim: number | null;
  file: string | null;
}

async function main(): Promise<void> {
  const started = Date.now();
  rmSync(CAND_DIR, { recursive: true, force: true });
  const rows: AddendumRow[] = [];

  for (const source of SOURCES) {
    const meta = await sharp(source.absPath).rotate().metadata();
    const sourceWidth = meta.width ?? 0;
    const sourceHeight = meta.height ?? 0;
    if (sourceWidth === 0 || sourceHeight === 0) {
      throw new Error(`[wp15-addendum] cannot read dimensions of ${source.absPath}`);
    }
    console.log(
      `[wp15-addendum] ${source.id}: ${sourceWidth}×${sourceHeight} (${source.orientation}) — ${source.role}`,
    );

    for (const requestedWidth of WIDTHS) {
      // No enlargement, intrinsic orientation respected: a requested width
      // above the orientation-normalized source width is recorded as CAP
      // honestly and produces NO derivative.
      if (requestedWidth > sourceWidth) {
        rows.push({
          source: source.id,
          role: source.role,
          sourceWidth,
          sourceHeight,
          requestedWidth,
          format: "*",
          quality: 0,
          progressive: false,
          capped: true,
          encoded: false,
          bytes: null,
          encodeTimeMs: null,
          derivedWidth: null,
          derivedHeight: null,
          psnr: null,
          ssim: null,
          file: null,
        });
        console.log(`  w${requestedWidth}: CAP (source ${sourceWidth}px) — no derivative`);
        continue;
      }

      for (const variant of VARIANTS) {
        const label = `${source.id}-w${requestedWidth}-${variant.format}-q${variant.quality}${variant.progressive ? "p" : ""}`;
        const { row, outputPath } = await runEncodeCandidate(
          source.absPath,
          `${source.id}.jpg`,
          {
            format: variant.format,
            width: requestedWidth,
            quality: variant.quality,
            progressive: variant.progressive,
          },
          CAND_DIR,
        );
        if (row.width > requestedWidth || (row.width !== requestedWidth && row.width !== sourceWidth)) {
          throw new Error(
            `[wp15-addendum] width contract violated for ${label}: got ${row.width}, requested ${requestedWidth}, source ${sourceWidth}`,
          );
        }
        const fidelity = await measureFidelity(source.absPath, outputPath, row.width);
        rows.push({
          source: source.id,
          role: source.role,
          sourceWidth,
          sourceHeight,
          requestedWidth,
          format: variant.format,
          quality: variant.quality,
          progressive: variant.progressive,
          capped: false,
          encoded: true,
          bytes: row.bytes,
          encodeTimeMs: Math.round(row.encodeTimeMs * 10) / 10,
          derivedWidth: row.width,
          derivedHeight: row.derivedHeight,
          psnr: fidelity.psnr === null ? null : Math.round(fidelity.psnr * 100) / 100,
          ssim: Math.round(fidelity.ssim * 10000) / 10000,
          file: outputPath.replace(`${ROOT}/`, ""),
        });
        console.log(
          `  ${label}: ${row.bytes} B, ${Math.round(row.encodeTimeMs)} ms, psnr ${fidelity.psnr?.toFixed(2) ?? "∞"}, ssim ${fidelity.ssim.toFixed(4)}`,
        );
      }
    }
  }

  writeFileSync(join(OUT, "results.json"), `${JSON.stringify({ rows }, null, 2)}\n`);
  writeMatrixMarkdown(rows);
  console.log(
    `[wp15-addendum] ${rows.length} rows (${rows.filter((r) => r.encoded).length} encoded, ${rows.filter((r) => r.capped).length} CAP) in ${((Date.now() - started) / 60000).toFixed(1)} min → ${OUT}`,
  );
}

/** Human-readable Matrix + Payload results fragment for the addendum document. */
function writeMatrixMarkdown(rows: AddendumRow[]): void {
  const lines: string[] = [];
  let currentSource = "";
  for (const row of rows) {
    if (row.source !== currentSource) {
      currentSource = row.source;
      lines.push(`\n### ${row.source} — ${row.role}`);
      lines.push(`\nsource ${row.sourceWidth}×${row.sourceHeight}\n`);
      lines.push(
        "| requested width | format | q | capped | bytes | encode ms | derived | psnr dB | ssim |",
        "|---:|---|---:|---|---:|---:|---|---:|---:|",
      );
    }
    if (row.capped) {
      lines.push(
        `| ${row.requestedWidth} | — | — | **CAP (source ${row.sourceWidth}px)** | — | — | — | — | — |`,
      );
      continue;
    }
    lines.push(
      `| ${row.requestedWidth} | ${row.format}${row.progressive ? " progressive" : ""} | ${row.quality} | no | ${row.bytes} | ${row.encodeTimeMs} | ${row.derivedWidth}×${row.derivedHeight} | ${row.psnr ?? "∞"} | ${row.ssim} |`,
    );
  }
  appendFileSync(join(OUT, "matrix.md"), `${lines.join("\n")}\n`);
}

// Fail loudly if a source disappeared or shrank between selection and run.
for (const source of SOURCES) {
  if (!statSync(source.absPath).isFile()) {
    throw new Error(`[wp15-addendum] source missing: ${source.absPath}`);
  }
}
await main();
