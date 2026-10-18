// Build-time reader for generated/exif-manifest.json (Monograph Lightbox/
// figcaption plaque). Browser code never sees the master EXIF — only the
// non-sensitive labels this sidecar carries, embedded in page markup.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "../pages/archive-data";
import type { ExifSidecar } from "./sidecar-contract";
import { EXIF_SIDECAR_SCHEMA } from "./sidecar-contract";
import type { PhotoExifRecord } from "./format";

type Sidecar = ExifSidecar;

let cache: Sidecar | undefined;

function empty(): Sidecar {
  return { schema: EXIF_SIDECAR_SCHEMA, photos: {} };
}

function isValid(value: unknown): value is Sidecar {
  if (typeof value !== "object" || value === null) return false;
  const doc = value as { schema?: unknown; photos?: unknown };
  return (
    doc.schema === EXIF_SIDECAR_SCHEMA &&
    typeof doc.photos === "object" &&
    doc.photos !== null
  );
}

/** Load + validate the sidecar. Missing/invalid → empty (no plaques). */
export function loadExifSidecar(root: string = repoRoot()): Sidecar {
  if (cache !== undefined) return cache;
  const path = join(root, "generated", "exif-manifest.json");
  if (!existsSync(path)) {
    cache = empty();
    return cache;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    cache = empty();
    return cache;
  }
  cache = isValid(parsed) ? parsed : empty();
  return cache;
}

/** Returns the non-sensitive capture record for a photo, or null. */
export function exifResolverFactory(
  root?: string,
): (photoId: string) => PhotoExifRecord | null {
  const sidecar = loadExifSidecar(root);
  return (photoId: string) => sidecar.photos[photoId] ?? null;
}
