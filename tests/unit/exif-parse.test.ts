import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import { parseExif } from "../../src/lib/exif/parse";

interface Entry {
  tag: number;
  type: number; // 2 ascii, 3 short, 4 long, 5 rational
  bytes: Buffer; // raw value bytes (ascii incl NUL / short / long / 8-byte rational)
}

const TIFF_ASCII = 2;
const TIFF_SHORT = 3;
const TIFF_LONG = 4;
const TIFF_RATIONAL = 5;

function ascii(value: string): Buffer {
  return Buffer.from(value + "\0", "latin1");
}
function u16(v: number, le: boolean): Buffer {
  const b = Buffer.alloc(2);
  le ? b.writeUInt16LE(v, 0) : b.writeUInt16BE(v, 0);
  return b;
}
function u32(v: number, le: boolean): Buffer {
  const b = Buffer.alloc(4);
  le ? b.writeUInt32LE(v, 0) : b.writeUInt32BE(v, 0);
  return b;
}
function rational(n: number, d: number, le: boolean): Buffer {
  return Buffer.concat([u32(n, le), u32(d, le)]);
}
function evenPaddedLength(n: number): number {
  return n % 2 === 0 ? n : n + 1;
}

/** Build a TIFF with IFD0 (Model + Exif IFD pointer) and one Exif sub-IFD. */
function buildTiff(le: boolean, model: string, exif: Entry[]): Buffer {
  const modelBytes = ascii(model);

  // First pass: offsets.
  const ifd0Count = 2;
  const ifd0Size = 2 + ifd0Count * 12 + 4;
  let cursor = 8 + ifd0Size;
  const modelOff = cursor;
  cursor += evenPaddedLength(modelBytes.length);

  const exifStart = cursor;
  const exifSize = 2 + exif.length * 12 + 4;
  cursor += exifSize;

  // Resolve value offsets for exif entries > 4 bytes (rationals/ascii).
  const rationalOff: Record<number, number> = {};
  const asciiOff: Record<number, number> = {};
  for (const e of exif) {
    if (e.type === TIFF_RATIONAL) {
      rationalOff[e.tag] = cursor;
      cursor += 8;
    } else if (e.type === TIFF_ASCII) {
      asciiOff[e.tag] = cursor;
      cursor += evenPaddedLength(e.bytes.length);
    }
  }

  const buf = Buffer.alloc(cursor);
  // Header.
  buf.write(le ? "II" : "MM", 0, "binary");
  (le ? buf.writeUInt16LE(42, 2) : buf.writeUInt16BE(42, 2));
  (le ? buf.writeUInt32LE(8, 4) : buf.writeUInt32BE(8, 4));

  function writeEntry(at: number, tag: number, type: number, count: number, value: Buffer, off?: number) {
    (le ? buf.writeUInt16LE(tag, at) : buf.writeUInt16BE(tag, at));
    (le ? buf.writeUInt16LE(type, at + 2) : buf.writeUInt16BE(type, at + 2));
    (le ? buf.writeUInt32LE(count, at + 4) : buf.writeUInt32BE(count, at + 4));
    if (value.length <= 4) {
      value.copy(buf, at + 8);
    } else {
      (le ? buf.writeUInt32LE(off ?? 0, at + 8) : buf.writeUInt32BE(off ?? 0, at + 8));
      value.copy(buf, off ?? 0);
    }
  }

  // IFD0.
  let p = 8;
  (le ? buf.writeUInt16LE(ifd0Count, p) : buf.writeUInt16BE(ifd0Count, p));
  p += 2;
  writeEntry(p, 0x0110, TIFF_ASCII, modelBytes.length, modelBytes, modelOff);
  p += 12;
  writeEntry(p, 0x8769, TIFF_LONG, 1, u32(exifStart, le));
  p += 12;
  (le ? buf.writeUInt32LE(0, p) : buf.writeUInt32BE(0, p)); // next IFD = 0

  // Exif sub-IFD.
  let q = exifStart;
  (le ? buf.writeUInt16LE(exif.length, q) : buf.writeUInt16BE(exif.length, q));
  q += 2;
  for (const e of exif) {
    const off = rationalOff[e.tag] ?? asciiOff[e.tag];
    writeEntry(q, e.tag, e.type, e.bytes.length, e.bytes, off);
    q += 12;
  }
  (le ? buf.writeUInt32LE(0, q) : buf.writeUInt32BE(0, q));

  return buf;
}

function sampleExif(le: boolean): Entry[] {
  return [
    { tag: 0x829d, type: TIFF_RATIONAL, bytes: rational(56, 10, le) },
    { tag: 0x829a, type: TIFF_RATIONAL, bytes: rational(1, 160, le) },
    { tag: 0x8827, type: TIFF_SHORT, bytes: u16(100, le) },
    { tag: 0xa405, type: TIFF_SHORT, bytes: u16(24, le) },
    { tag: 0xa434, type: TIFF_ASCII, bytes: ascii("FE 24-70mm F2.8 GM II") },
    { tag: 0x9003, type: TIFF_ASCII, bytes: ascii("2025:01:27 11:33:46") },
  ];
}

describe("parseExif", () => {
  it("parses the allow-listed tags from a little-endian TIFF", () => {
    const tags = parseExif(buildTiff(true, "ILCE-7CR", sampleExif(true)));
    expect(tags).toEqual({
      model: "ILCE-7CR",
      fNumber: [56, 10],
      exposureTime: [1, 160],
      iso: 100,
      focalLength35: 24,
      lens: "FE 24-70mm F2.8 GM II",
      dateTimeOriginal: "2025:01:27 11:33:46",
    });
  });

  it("parses a big-endian TIFF and the Exif\\0\\0 APP1 prefix", () => {
    const tiff = buildTiff(false, "ILCE-7CR", sampleExif(false));
    const withPrefix = Buffer.concat([Buffer.from("Exif\0\0", "binary"), tiff]);
    expect(parseExif(withPrefix)?.fNumber).toEqual([56, 10]);
    expect(parseExif(withPrefix)?.iso).toBe(100);
  });

  it("parses Make and omits absent fields", () => {
    const tags = parseExif(
      buildTiff(true, "ILCE-7CR", [{ tag: 0x010f, type: TIFF_ASCII, bytes: ascii("SONY") }]),
    );
    expect(tags?.make).toBe("SONY");
    expect(tags?.model).toBe("ILCE-7CR");
    expect(tags?.iso).toBeUndefined();
  });

  it("returns null for empty, truncated, or non-EXIF buffers", () => {
    expect(parseExif(undefined)).toBeNull();
    expect(parseExif(Buffer.alloc(0))).toBeNull();
    expect(parseExif(Buffer.from("not a tiff file at all here"))).toBeNull();
    const tiff = buildTiff(true, "X", []);
    tiff.writeUInt32LE(999_999, 4); // IFD0 offset past EOF
    expect(parseExif(tiff)).toBeNull();
  });

  it("ignores GPS / serial / MakerNote tags (they are not in the allow-list)", () => {
    const tags = parseExif(
      buildTiff(true, "ILCE-7CR", [
        { tag: 0x8825, type: TIFF_LONG, bytes: u32(0, true) }, // GPS IFD pointer
        { tag: 0x927c, type: TIFF_ASCII, bytes: ascii("private-maker-data") },
        { tag: 0xa431, type: TIFF_ASCII, bytes: ascii("0123456789") }, // BodySerialNumber
        ...sampleExif(true),
      ]),
    );
    expect(tags && Object.keys(tags)).not.toContain("gps");
    expect(JSON.stringify(tags)).not.toMatch(/maker|serial|private/i);
    expect(tags?.iso).toBe(100);
  });
});
