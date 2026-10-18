// Minimal, dependency-free EXIF reader for the Lightbox plaque.
//
// Privacy posture (ADR-012): derivatives stay fully stripped. This reader
// runs at BUILD TIME over the ingest masters and extracts ONLY a small
// allow-list of non-sensitive capture labels — it never reads GPS, serial
// numbers, MakerNote, owner fields, or anything outside the tag table below.
//
// Input is the raw APP1 payload that sharp exposes as `metadata.exif`
// (either a bare TIFF block or one prefixed by "Exif\0\0"). Output is null
// on any truncation/parse problem (callers degrade to "no plaque" rather
// than failing the build).

/** Unsigned rational numerator/denominator. */
export type ExifRational = readonly [number, number];

export interface ExifTags {
  make?: string;
  model?: string;
  lens?: string;
  /** FNumber (0x829D), e.g. [56,10] = ƒ/5.6. */
  fNumber?: ExifRational;
  /** ExposureTime (0x829A), e.g. [1,160] = 1/160s. */
  exposureTime?: ExifRational;
  /** ISOSpeedRatings (0x8827). */
  iso?: number;
  /** FocalLength (0x920A) in mm. */
  focalLength?: ExifRational;
  /** FocalLengthIn35mmFilm (0xA405) in mm — preferred for display. */
  focalLength35?: number;
  /** DateTimeOriginal (0x9003), "YYYY:MM:DD HH:MM:SS". */
  dateTimeOriginal?: string;
}

// TIFF field types → byte width (1 = byte/ascii, 3 = short, 4 = long,
// 5 = rational). Types outside this table are skipped.
const TYPE_SIZE: Readonly<Record<number, number>> = {
  1: 1,
  2: 1,
  3: 2,
  4: 4,
  5: 8,
};

const TAG = {
  MAKE: 0x010f,
  MODEL: 0x0110,
  EXIF_IFD_POINTER: 0x8769,
  F_NUMBER: 0x829d,
  EXPOSURE_TIME: 0x829a,
  ISO: 0x8827,
  FOCAL_LENGTH: 0x920a,
  FOCAL_LENGTH_35MM: 0xa405,
  DATE_TIME_ORIGINAL: 0x9003,
  LENS_MODEL: 0xa434,
} as const;

const MAX_IFD_ENTRIES = 512;

class ByteReader {
  private readonly buf: Buffer;
  private readonly littleEndian: boolean;
  private readonly base: number;

  // Explicit fields (no TypeScript parameter properties) so this module also
  // runs under Node's --experimental-strip-types (the media script runner).
  constructor(buf: Buffer, littleEndian: boolean, base: number) {
    this.buf = buf;
    this.littleEndian = littleEndian;
    this.base = base;
  }

  get length(): number {
    return this.buf.length;
  }

  u16(at: number): number {
    return this.littleEndian ? this.buf.readUInt16LE(at) : this.buf.readUInt16BE(at);
  }

  u32(at: number): number {
    return this.littleEndian ? this.buf.readUInt32LE(at) : this.buf.readUInt32BE(at);
  }

  /** Read an IFD entry value (inline when ≤4 bytes, else at TIFF offset). */
  field(entryAt: number, type: number, count: number): { at: number; ok: boolean } {
    const width = TYPE_SIZE[type];
    if (width === undefined) return { at: 0, ok: false };
    if (count <= 0) return { at: 0, ok: false };
    const total = width * count;
    const valueField = entryAt + 8;
    const at = total <= 4 ? valueField : this.base + this.u32(valueField);
    if (at < 0 || at + total > this.buf.length) return { at: 0, ok: false };
    return { at, ok: true };
  }

  ascii(entryAt: number, count: number): string | null {
    const f = this.field(entryAt, 2, count);
    if (!f.ok) return null;
    return this.buf
      .subarray(f.at, f.at + count)
      .toString("latin1")
      .replace(/\0[\s\S]*$/, "")
      .trim();
  }

  short(entryAt: number): number | null {
    const f = this.field(entryAt, 3, 1);
    return f.ok ? this.u16(f.at) : null;
  }

  rational(entryAt: number): ExifRational | null {
    const f = this.field(entryAt, 5, 1);
    if (!f.ok) return null;
    return [this.u32(f.at), this.u32(f.at + 4)];
  }
}

function readIfd(
  r: ByteReader,
  ifdOffset: number,
  base: number,
  out: ExifTags,
): number | null {
  const start = base + ifdOffset;
  let count: number;
  try {
    count = r.u16(start);
  } catch {
    return null;
  }
  if (!Number.isFinite(count) || count > MAX_IFD_ENTRIES) return null;

  let exifSubIfd: number | null = null;
  for (let i = 0; i < count; i++) {
    const entry = start + 2 + i * 12;
    if (entry + 12 > r.length) return null;
    let tag: number, type: number, itemCount: number;
    try {
      tag = r.u16(entry);
      type = r.u16(entry + 2);
      itemCount = r.u32(entry + 4);
    } catch {
      return null;
    }
    try {
      switch (tag) {
        case TAG.EXIF_IFD_POINTER:
          exifSubIfd = r.u32(entry + 8);
          break;
        case TAG.MAKE:
          out.make = r.ascii(entry, itemCount) ?? out.make;
          break;
        case TAG.MODEL:
          out.model = r.ascii(entry, itemCount) ?? out.model;
          break;
        case TAG.LENS_MODEL:
          out.lens = r.ascii(entry, itemCount) ?? out.lens;
          break;
        case TAG.DATE_TIME_ORIGINAL:
          out.dateTimeOriginal = r.ascii(entry, itemCount) ?? out.dateTimeOriginal;
          break;
        case TAG.F_NUMBER:
          out.fNumber = r.rational(entry) ?? out.fNumber;
          break;
        case TAG.EXPOSURE_TIME:
          out.exposureTime = r.rational(entry) ?? out.exposureTime;
          break;
        case TAG.FOCAL_LENGTH:
          out.focalLength = r.rational(entry) ?? out.focalLength;
          break;
        case TAG.ISO:
          // Stored as SHORT (and occasionally LONG across cameras).
          if (type === 4) {
            const f = r.field(entry, 4, 1);
            if (f.ok) out.iso = r.u32(f.at);
          } else {
            const v = r.short(entry);
            if (v !== null) out.iso = v;
          }
          break;
        case TAG.FOCAL_LENGTH_35MM:
          out.focalLength35 = r.short(entry) ?? out.focalLength35;
          break;
        default:
          break;
      }
    } catch {
      // A single bad entry must not poison the whole record.
    }
  }
  return exifSubIfd;
}

/**
 * Parse the allow-listed capture tags from a sharp `metadata.exif` buffer.
 * Returns null when the buffer is not parseable EXIF.
 */
export function parseExif(exif: Buffer | undefined | null): ExifTags | null {
  if (!exif || exif.length < 8) return null;

  let tiffStart = 0;
  if (exif.subarray(0, 6).toString("binary") === "Exif\0\0") tiffStart = 6;
  if (tiffStart + 8 > exif.length) return null;

  const endian = exif.subarray(tiffStart, tiffStart + 2).toString("binary");
  const littleEndian = endian === "II";
  if (!littleEndian && endian !== "MM") return null;
  const magic = littleEndian
    ? exif.readUInt16LE(tiffStart + 2)
    : exif.readUInt16BE(tiffStart + 2);
  if (magic !== 42) return null;

  const reader = new ByteReader(exif, littleEndian, tiffStart);
  const ifd0Offset = littleEndian
    ? exif.readUInt32LE(tiffStart + 4)
    : exif.readUInt32BE(tiffStart + 4);
  if (ifd0Offset <= 0 || tiffStart + ifd0Offset >= exif.length) return null;

  const out: ExifTags = {};
  const exifSubIfd = readIfd(reader, ifd0Offset, tiffStart, out);
  if (exifSubIfd !== null && exifSubIfd > 0 && tiffStart + exifSubIfd < exif.length) {
    readIfd(reader, exifSubIfd, tiffStart, out);
  }
  return Object.keys(out).length > 0 ? out : null;
}
