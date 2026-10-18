// WP-07 100% crop side-by-side packet generation — for HUMAN quality review
// (PERFORMANCE_BUDGET §4/§11 intent: fidelity metrics order candidates, but
// quality judgment is human). Given a source fixture and a derived candidate,
// produce PNG crops of the SAME region at 100% (no resampling beyond the
// candidate's own pipeline) plus a combined side-by-side image:
//
//   <label>-source.png        crop from the source resized to candidate width
//   <label>-candidate.png     same crop from the candidate
//   <label>-side-by-side.png  source | candidate on one canvas
//
// The default region is the 256×256 center of the candidate frame; callers may
// pass { left, top, width, height } (clamped to the frame) for edge/detail
// regions. Output goes to the gitignored scratch dir (bench-output/).
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

export interface CropRegion {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CropPacket {
  sourceCropPath: string;
  candidateCropPath: string;
  sideBySidePath: string;
  region: CropRegion;
}

function clampRegion(
  region: CropRegion | undefined,
  frameWidth: number,
  frameHeight: number,
): CropRegion {
  const width = Math.min(region?.width ?? 256, frameWidth);
  const height = Math.min(region?.height ?? 256, frameHeight);
  const left = Math.max(0, Math.min(region?.left ?? Math.floor((frameWidth - width) / 2), frameWidth - width));
  const top = Math.max(0, Math.min(region?.top ?? Math.floor((frameHeight - height) / 2), frameHeight - height));
  return { left, top, width, height };
}

async function cropPng(
  input: string | Buffer,
  resizeWidth: number | undefined,
  region: CropRegion,
): Promise<Buffer> {
  let pipeline = sharp(input).rotate();
  if (resizeWidth !== undefined) {
    pipeline = pipeline.resize({ width: resizeWidth, withoutEnlargement: true });
  }
  return pipeline.extract(region).png().toBuffer();
}

/**
 * Generate the side-by-side 100% crop packet for one (source, candidate) pair.
 * `candidateWidth` must be the width the candidate was encoded at, so the
 * source side is resized to the same basis before cropping.
 */
export async function generateCropPacket(options: {
  sourceAbsPath: string;
  candidateAbsPath: string;
  candidateWidth: number;
  outDir: string;
  label: string;
  region?: CropRegion;
}): Promise<CropPacket> {
  const { sourceAbsPath, candidateAbsPath, candidateWidth, outDir, label } = options;
  await mkdir(outDir, { recursive: true });

  const meta = await sharp(candidateAbsPath).metadata();
  const region = clampRegion(options.region, meta.width ?? 0, meta.height ?? 0);

  const sourcePng = await cropPng(sourceAbsPath, candidateWidth, region);
  const candidatePng = await cropPng(candidateAbsPath, undefined, region);

  const sourceCropPath = join(outDir, `${label}-source.png`);
  const candidateCropPath = join(outDir, `${label}-candidate.png`);
  const sideBySidePath = join(outDir, `${label}-side-by-side.png`);
  await writeFile(sourceCropPath, sourcePng);
  await writeFile(candidateCropPath, candidatePng);

  const sideBySide = await sharp({
    create: {
      width: region.width * 2,
      height: region.height,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([
      { input: sourcePng, left: 0, top: 0 },
      { input: candidatePng, left: region.width, top: 0 },
    ])
    .png()
    .toBuffer();
  await writeFile(sideBySidePath, sideBySide);

  return { sourceCropPath, candidateCropPath, sideBySidePath, region };
}
