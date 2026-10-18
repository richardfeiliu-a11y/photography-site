// WP-16 ICC fixture factory — builds the three ICC source classes defined by
// the WP-16 brief (tagged sRGB / wide-gamut tagged / untagged) as COPIES of
// real corpus fixtures. The frozen corpus in media/stage3c-fixtures/ is never
// mutated (REAL_PHOTO_FIXTURE_MANIFEST.md: "Nothing in media/stage3c-fixtures/
// is modified"); every fixture is a fresh sharp re-encode written to a caller
// supplied directory (tests use a tmpdir; the documented provenance copies live
// under media/wp16-icc-fixtures/, which is gitignored via the /media rule).
//
// Fixture provenance (exact recipes, reproducible):
//   untagged:          sharp(src)[.extract(crop)].jpeg({ quality: 90 }) — sharp
//                      drops all metadata (incl. ICC) by default; verified by a
//                      metadata dump (icc === undefined).
//   tagged-srgb:       sharp(src)[.extract(crop)]
//                        .withIccProfile(<host sRGB profile path>)
//                        .jpeg({ quality: 90 })
//   tagged-adobe-rgb:  same with the host AdobeRGB1998 profile.
//   tagged-display-p3: same with the host Display P3 profile.
// The profiles are REAL macOS ColorSync profiles; the pixels are REAL corpus
// pixels (F04 "most saturated", DSC02560.jpg). Attaching a wide-gamut profile
// to a copy whose pixels are unchanged is a legitimate synthetic TEST FIXTURE:
// an ICC profile is a claim about the pixels' interpretation, so the fixture
// exercises exactly the pipeline question "does the converter honor the claim".
//
// Verified Sharp APIs only (TECHNICAL_API_VERIFICATION.md §2): withIccProfile
// (filesystem path — sharp 0.35 rejects Buffers here, measured), toColourspace.
// The nonexistent ICC APIs (the rejected "profile" method and the nonexistent
// Sharp CLI) appear nowhere in this repo.
import { statSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import sharp from "sharp";

/** Real ICC profiles on the frozen macOS build host (ColorSync). */
export const HOST_PROFILE_PATHS = {
  srgb: "/System/Library/ColorSync/Profiles/sRGB Profile.icc",
  adobeRgb1998: "/System/Library/ColorSync/Profiles/AdobeRGB1998.icc",
  displayP3: "/System/Library/ColorSync/Profiles/Display P3.icc",
} as const;

export const ICC_FIXTURE_CLASSES = [
  "tagged-srgb",
  "tagged-adobe-rgb",
  "tagged-display-p3",
  "untagged",
] as const;
export type IccFixtureClass = (typeof ICC_FIXTURE_CLASSES)[number];

/** Crop applied before encoding (keeps probe encodes small and deterministic). */
export interface IccFixtureCrop {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CreateIccFixturesOptions {
  /** Source file — a REAL corpus fixture (read-only; never modified). */
  sourcePath: string;
  /** Output directory for the four fixture copies (created if missing). */
  outDir: string;
  /** Optional deterministic crop; when omitted the full frame is used. */
  crop?: IccFixtureCrop;
  /** JPEG quality for the fixture re-encodes (default 90). */
  quality?: number;
}

export interface IccFixtureSet {
  /** Source the set was derived from (absolute path, unmodified). */
  sourcePath: string;
  /** Fixture file path per class. */
  paths: Record<IccFixtureClass, string>;
  /** Encoded byte size per fixture. */
  bytes: Record<IccFixtureClass, number>;
  /** ICC profile byte length in each fixture (0 = none embedded). */
  iccBytes: Record<IccFixtureClass, number>;
}

const CLASS_SUFFIXES: Record<IccFixtureClass, string> = {
  "tagged-srgb": "tagged-srgb",
  "tagged-adobe-rgb": "tagged-adobe-rgb",
  "tagged-display-p3": "tagged-display-p3",
  untagged: "untagged",
};

const CLASS_PROFILES: Partial<Record<IccFixtureClass, string>> = {
  "tagged-srgb": HOST_PROFILE_PATHS.srgb,
  "tagged-adobe-rgb": HOST_PROFILE_PATHS.adobeRgb1998,
  "tagged-display-p3": HOST_PROFILE_PATHS.displayP3,
};

function assertProfileFile(path: string): void {
  if (!statSync(path).isFile()) {
    throw new Error(`[icc-fixtures] host ICC profile missing: ${path}`);
  }
}

/** Metadata dump assertion: an honest fixture carries (or lacks) its ICC. */
export async function assertIccFixtureHonesty(
  filePath: string,
  expectsIcc: boolean,
): Promise<number> {
  const meta = await sharp(filePath).metadata();
  const iccBytes = meta.icc?.length ?? 0;
  if (expectsIcc && iccBytes === 0) {
    throw new Error(`[icc-fixtures] fixture should carry an ICC profile but has none: ${filePath}`);
  }
  if (!expectsIcc && iccBytes !== 0) {
    throw new Error(`[icc-fixtures] fixture should be untagged but carries ${iccBytes} ICC bytes: ${filePath}`);
  }
  return iccBytes;
}

/**
 * Create the three ICC source classes (+ sRGB-tagged control) as copies of one
 * real corpus source. The source file is opened read-only by sharp; nothing is
 * ever written back to it.
 */
export async function createIccFixtures(
  options: CreateIccFixturesOptions,
): Promise<IccFixtureSet> {
  const { sourcePath, outDir, crop, quality = 90 } = options;
  for (const profile of Object.values(HOST_PROFILE_PATHS)) {
    assertProfileFile(profile);
  }
  await mkdir(outDir, { recursive: true });

  const stem = basename(sourcePath).replace(/\.[^.]+$/, "");
  const paths = {} as Record<IccFixtureClass, string>;
  const bytes = {} as Record<IccFixtureClass, number>;
  const iccBytes = {} as Record<IccFixtureClass, number>;

  for (const fixtureClass of ICC_FIXTURE_CLASSES) {
    // Fresh pipeline per class — never mutate the source, only re-encode a copy.
    let pipeline = sharp(sourcePath);
    if (crop) pipeline = pipeline.extract(crop);
    const profile = CLASS_PROFILES[fixtureClass];
    if (profile) pipeline = pipeline.withIccProfile(profile);
    const buffer = await pipeline.jpeg({ quality }).toBuffer();
    const filePath = join(outDir, `${stem}-${CLASS_SUFFIXES[fixtureClass]}.jpg`);
    await writeFile(filePath, buffer);
    paths[fixtureClass] = filePath;
    bytes[fixtureClass] = buffer.length;
    iccBytes[fixtureClass] = await assertIccFixtureHonesty(filePath, Boolean(profile));
  }

  return { sourcePath, paths, bytes, iccBytes };
}
