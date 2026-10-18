// WP-07 encode-runner — abstraction over candidate encoders.
//
// Sharp baseline (controller ruling R-2: sharp is a devDependency of the
// benchmark harness ONLY; it is not wired into src/ or astro config — that
// decision belongs to P3 / WP-17+). Candidate formats: jpeg | webp | avif.
//
// AVIF note: sharp 0.35 exposes AVIF through the libheif output plugin
// (sharp.format.heif.output.alias includes "avif"). If a platform's prebuilt
// binaries cannot encode AVIF, the format enum still accepts it and
// `probeFormatSupport("avif")` reports the capability honestly at runtime —
// WP-15 decides what to do with a negative answer; nothing is hacked around.
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat, mkdir } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

export const CANDIDATE_FORMATS = ["jpeg", "webp", "avif"] as const;
export type CandidateFormat = (typeof CANDIDATE_FORMATS)[number];

const EXTENSIONS: Record<CandidateFormat, string> = {
  jpeg: "jpg",
  webp: "webp",
  avif: "avif",
};

export interface CandidateSpec {
  format: CandidateFormat;
  /** Target width in px; never enlarged (withoutEnlargement: true). */
  width: number;
  /** Encoder quality (0–100, encoder-scale). */
  quality: number;
  /**
   * WP-15 progressive-JPEG probe ONLY: progressive=true is honored for jpeg
   * (ignored for webp/avif). The measurement row schema is unchanged; the
   * content-addressed filename gains a `-progressive` suffix so probe outputs
   * never collide with baseline candidates.
   */
  progressive?: boolean;
}

/**
 * Measurement row schema (FROZEN — WP-07 brief test-first requirement):
 * EXACTLY { fixture, format, width, quality, bytes, encodeTimeMs } plus the
 * permitted derivedHeight. WP-15 campaigns must not widen this object; extra
 * evidence (fidelity, crops) travels beside it, not inside it.
 */
export interface MeasurementRow {
  fixture: string;
  format: CandidateFormat;
  width: number;
  quality: number;
  bytes: number;
  encodeTimeMs: number;
  derivedHeight: number;
}

export interface EncodeResult {
  /** The frozen-schema measurement row. */
  row: MeasurementRow;
  /** Path of the encoded candidate in the scratch output dir. */
  outputPath: string;
}

/**
 * Live capability probe for a candidate format: a tiny real encode through
 * the same pipeline family the runner uses. Returns false (never throws) when
 * the prebuilt binaries cannot encode the format.
 */
export async function probeFormatSupport(format: CandidateFormat): Promise<boolean> {
  try {
    const probe = await sharp({
      create: { width: 32, height: 32, channels: 3, background: { r: 128, g: 64, b: 32 } },
    })
      .toFormat(format, { quality: 50 })
      .toBuffer();
    return probe.length > 0;
  } catch {
    return false;
  }
}

function sha256HexFile(filePath: string): Promise<string> {
  return new Promise((resolvePromise, rejectPromise) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("error", rejectPromise);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolvePromise(hash.digest("hex")));
  });
}

/**
 * Run one candidate encode of one fixture into a scratch output dir
 * (gitignored; e.g. bench-output/). EXIF orientation is normalized
 * (.rotate()), resizing never enlarges. Encode time is process.hrtime around
 * the whole pipeline; bytes come from the written file.
 */
export async function runEncodeCandidate(
  sourceAbsPath: string,
  fixtureName: string,
  spec: CandidateSpec,
  outDir: string,
): Promise<EncodeResult> {
  await mkdir(outDir, { recursive: true });

  const stem = fixtureName.replace(/\.[^.]+$/, "");
  // Content-addressable suffix keeps reruns deterministic and lets WP-15
  // compare candidates of the same (fixture, spec) across encoder versions.
  const sourceSum = (await sha256HexFile(sourceAbsPath)).slice(0, 8);
  const progressiveSuffix = spec.progressive === true ? "-progressive" : "";
  const outputPath = join(
    outDir,
    `${stem}-${sourceSum}-${spec.format}-w${spec.width}-q${spec.quality}${progressiveSuffix}.${EXTENSIONS[spec.format]}`,
  );

  const startedAt = process.hrtime.bigint();
  const formatOptions: { quality: number; progressive?: boolean } = { quality: spec.quality };
  if (spec.progressive === true && spec.format === "jpeg") {
    formatOptions.progressive = true;
  }
  const info = await sharp(sourceAbsPath)
    .rotate() // EXIF-orientation-normalized (frozen manifest §3 rule)
    .resize({ width: spec.width, withoutEnlargement: true })
    .toFormat(spec.format, formatOptions)
    .toFile(outputPath);
  const encodeTimeMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

  const { size } = await stat(outputPath);

  const row: MeasurementRow = {
    fixture: fixtureName,
    format: spec.format,
    width: info.width ?? spec.width,
    quality: spec.quality,
    bytes: size,
    encodeTimeMs,
    derivedHeight: info.height ?? 0,
  };
  return { row, outputPath };
}
