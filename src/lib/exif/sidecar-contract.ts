// Shared contract for the build-time EXIF sidecar (no side effects).
// Imported by both the generator (scripts/media/exif-sidecar.ts) and the
// build-time reader (src/lib/exif/read.ts).
import type { PhotoExifRecord } from "./format";

export const EXIF_SIDECAR_RELATIVE_PATH = "generated/exif-manifest.json";
export const EXIF_SIDECAR_SCHEMA = "quiet-editorial-archive/exif-manifest@1";

export interface ExifSidecar {
  schema: typeof EXIF_SIDECAR_SCHEMA;
  photos: Record<string, PhotoExifRecord>;
}
