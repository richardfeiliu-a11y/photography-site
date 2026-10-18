// WP-07 fidelity measurement — PSNR and SSIM of a derived candidate against
// the decoded SOURCE at the same dimensions.
//
// Both images are decoded to 8-bit greyscale raw pixel buffers through sharp
// (no additional pinned dependency; a straightforward windowed SSIM is enough
// for human-visible ranking in WP-15 packets — this is evidence ordering, not
// a psychophysical model). The source side goes through the same
// EXIF-normalize + resize(withoutEnlargement) pipeline family as the encode
// runner, so both buffers share dimensions before comparison.
//
// Method:
//   PSNR = 10·log10(255² / MSE) over all pixels; identical images → Infinity
//   (serialized as null so JSON stays finite — JSON has no Infinity).
//   SSIM  = mean over non-overlapping 8×8 windows of
//           ((2·μx·μy + C1)(2·cov + C2)) / ((μx² + μy² + C1)(σx² + σy² + C2))
//           with C1 = (0.01·255)², C2 = (0.03·255)²; edge remainder pixels
//           (width/height not divisible by 8) are excluded and reported.
import sharp from "sharp";

export interface Fidelity {
  width: number;
  height: number;
  /** Peak signal-to-noise ratio in dB; null when identical (infinite PSNR). */
  psnr: number | null;
  /** Mean SSIM over 8×8 windows, 0..1. */
  ssim: number;
  /** SSIM windows actually evaluated (edge remainder excluded). */
  ssimWindows: number;
}

interface GreyRaw {
  data: Buffer;
  width: number;
  height: number;
}

async function greyRawOf(input: string | Buffer, resizeWidth?: number): Promise<GreyRaw> {
  let pipeline = sharp(input).rotate().greyscale();
  if (resizeWidth !== undefined) {
    pipeline = pipeline.resize({ width: resizeWidth, withoutEnlargement: true });
  }
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function mseOf(a: Buffer, b: Buffer): number {
  let sumSq = 0;
  for (let i = 0; i < a.length; i += 1) {
    const d = a[i] - b[i];
    sumSq += d * d;
  }
  return sumSq / a.length;
}

function meanSsim8x8(a: Buffer, b: Buffer, width: number, height: number): {
  mean: number;
  windows: number;
} {
  const C1 = (0.01 * 255) ** 2;
  const C2 = (0.03 * 255) ** 2;
  const win = 8;
  const cols = Math.floor(width / win);
  const rows = Math.floor(height / win);
  let total = 0;
  let count = 0;
  for (let wy = 0; wy < rows; wy += 1) {
    for (let wx = 0; wx < cols; wx += 1) {
      let sumX = 0;
      let sumY = 0;
      let sumXX = 0;
      let sumYY = 0;
      let sumXY = 0;
      for (let y = 0; y < win; y += 1) {
        for (let x = 0; x < win; x += 1) {
          const idx = (wy * win + y) * width + (wx * win + x);
          const px = a[idx];
          const py = b[idx];
          sumX += px;
          sumY += py;
          sumXX += px * px;
          sumYY += py * py;
          sumXY += px * py;
        }
      }
      const n = win * win;
      const muX = sumX / n;
      const muY = sumY / n;
      const varX = sumXX / n - muX * muX;
      const varY = sumYY / n - muY * muY;
      const covXY = sumXY / n - muX * muY;
      const ssim =
        ((2 * muX * muY + C1) * (2 * covXY + C2)) /
        ((muX * muX + muY * muY + C1) * (varX + varY + C2));
      total += ssim;
      count += 1;
    }
  }
  return { mean: count > 0 ? total / count : 0, windows: count };
}

/**
 * Compare a derived candidate against its decoded source, resized to the
 * candidate's width (the same comparison basis the encode runner produced).
 */
export async function measureFidelity(
  sourceAbsPath: string,
  candidateAbsPath: string,
  candidateWidth: number,
): Promise<Fidelity> {
  const source = await greyRawOf(sourceAbsPath, candidateWidth);
  const candidate = await greyRawOf(candidateAbsPath);
  if (source.width !== candidate.width || source.height !== candidate.height) {
    throw new Error(
      `[bench] dimension mismatch in fidelity comparison — source ${source.width}×${source.height} vs candidate ${candidate.width}×${candidate.height} (${candidateAbsPath}).`,
    );
  }
  const mse = mseOf(source.data, candidate.data);
  const psnr = mse === 0 ? null : 10 * Math.log10((255 * 255) / mse);
  const ssim = meanSsim8x8(source.data, candidate.data, source.width, source.height);
  return {
    width: source.width,
    height: source.height,
    psnr,
    ssim: ssim.mean,
    ssimWindows: ssim.windows,
  };
}
