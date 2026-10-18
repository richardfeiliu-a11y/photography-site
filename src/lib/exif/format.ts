// Pure EXIF presentation formatters (Monograph spec §6.2 mini line + §6.3
// plaque). Every function is total over missing fields: a photo without a
// value simply omits that part, never fabricating one.

import type { ExifRational } from "./parse";

/** One photo's non-sensitive capture record (the exif sidecar value). */
export interface PhotoExifRecord {
  make?: string;
  model?: string;
  lens?: string;
  focalLength35?: number;
  fNumber?: ExifRational;
  exposureTime?: ExifRational;
  iso?: number;
  dateTimeOriginal?: string;
}

function trim1(v: number): string {
  // One decimal at most, dropping a trailing ".0".
  return v.toFixed(1).replace(/\.0$/, "");
}

/** [56,10] → "ƒ/5.6"; [8,1] → "ƒ/8". */
export function formatAperture(value: ExifRational | undefined): string | null {
  if (!value || value[1] === 0) return null;
  return `ƒ/${trim1(value[0] / value[1])}`;
}

/** [1,160] → "1/160s"; [25,10] → "2.5s". */
export function formatShutter(value: ExifRational | undefined): string | null {
  if (!value || value[1] === 0 || value[0] === 0) return null;
  const seconds = value[0] / value[1];
  if (seconds >= 1) return `${trim1(seconds)}s`;
  const denominator = Math.round(value[1] / value[0]);
  return denominator > 0 ? `1/${denominator}s` : null;
}

export function formatIso(iso: number | undefined): string | null {
  return typeof iso === "number" && Number.isFinite(iso) && iso > 0 ? `ISO ${iso}` : null;
}

export function formatFocal35(mm: number | undefined): string | null {
  return typeof mm === "number" && Number.isFinite(mm) && mm > 0 ? `${Math.round(mm)}mm` : null;
}

const MAKE_LABELS: Readonly<Record<string, string>> = {
  sony: "Sony",
  canon: "Canon",
  nikon: "Nikon",
  fujifilm: "Fujifilm",
  apple: "Apple",
};

/** {make:"SONY",model:"ILCE-7CR"} → "Sony ILCE-7CR". */
export function cameraLabel(rec: Pick<PhotoExifRecord, "make" | "model">): string | null {
  const make = rec.make?.trim();
  const model = rec.model?.trim();
  if (!make && !model) return null;
  const makeLabel = make ? (MAKE_LABELS[make.toLowerCase()] ?? make) : null;
  if (!model) return makeLabel;
  if (!makeLabel || !make) return model;
  return model.toUpperCase().startsWith(make.toUpperCase()) ? model : `${makeLabel} ${model}`;
}

/**
 * The figcaption mini line: "24mm · ƒ/8 · 1/160s · ISO 100". Returns "" when
 * there is no technical data to show (caller renders no right-hand node).
 */
export function miniExifLine(rec: PhotoExifRecord | null | undefined): string {
  if (!rec) return "";
  return [
    formatFocal35(rec.focalLength35),
    formatAperture(rec.fNumber),
    formatShutter(rec.exposureTime),
    formatIso(rec.iso),
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");
}

/** The Lightbox plaque SETTINGS row (same data as the mini line). */
export function settingsLine(rec: PhotoExifRecord | null | undefined): string {
  return miniExifLine(rec);
}
