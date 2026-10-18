// Builds the EXIF sidecar document from published gallery masters.
// Pure-ish data work (reads master files via sharp); the CLI wrapper writes
// JSON. Only the non-sensitive allow-list survives into a record.
import { join } from "node:path";
import sharp from "sharp";
import { loadArchive } from "../../../scripts/validate/content";
import { composeArchiveValidation } from "../validate/production";
import { getManifest } from "../assets/manifest";
import { parseExif, type ExifTags } from "./parse";
import type { PhotoExifRecord } from "./format";
import { EXIF_SIDECAR_SCHEMA, type ExifSidecar } from "./sidecar-contract";

/** Map allow-listed parse tags onto the stored record (omit absent keys). */
export function toRecord(tags: ExifTags | null): PhotoExifRecord {
  if (!tags) return {};
  const record: PhotoExifRecord = {};
  if (tags.make) record.make = tags.make;
  if (tags.model) record.model = tags.model;
  if (tags.lens) record.lens = tags.lens;
  if (typeof tags.focalLength35 === "number") record.focalLength35 = tags.focalLength35;
  if (tags.fNumber) record.fNumber = [tags.fNumber[0], tags.fNumber[1]];
  if (tags.exposureTime) record.exposureTime = [tags.exposureTime[0], tags.exposureTime[1]];
  if (typeof tags.iso === "number") record.iso = tags.iso;
  return record;
}

export interface BuildResult {
  sidecar: ExifSidecar;
  total: number;
  labelled: number;
}

export async function buildExifSidecar(root: string, ingestRoot = join(root, "media", "ingest-masters")): Promise<BuildResult> {
  const validation = composeArchiveValidation(loadArchive(root), {
    mode: "production",
    ingestRoot,
    assetManifest: {
      rows: getManifest().manifest.records.map((r) => ({
        photo_id: r.photo_id,
        purpose: r.purpose,
      })),
    },
  });
  if (!validation.ok) {
    throw new Error(
      `[exif] content validation failed before extraction: ${validation.errors
        .slice(0, 5)
        .map((e) => e.message)
        .join("; ")}`,
    );
  }

  const photos: Record<string, PhotoExifRecord> = {};
  let labelled = 0;
  for (const gallery of validation.publishedDataSet.galleries) {
    for (const photo of gallery.photos) {
      let record: PhotoExifRecord = {};
      try {
        const meta = await sharp(join(ingestRoot, photo.source_ref)).metadata();
        record = toRecord(parseExif(meta.exif ?? null));
      } catch {
        record = {}; // §13.1#1 already fails a missing master; here stay non-fatal.
      }
      photos[photo.id] = record;
      if (Object.keys(record).length > 0) labelled++;
    }
  }

  return {
    sidecar: { schema: EXIF_SIDECAR_SCHEMA, photos },
    total: Object.keys(photos).length,
    labelled,
  };
}
