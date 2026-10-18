// WP-21 reusable privacy-fixture helpers (TEST SUPPORT ONLY — never pipeline
// code; the static no-metadata-API assertion scopes scripts/media/*.ts).
//
// Recipe style follows the WP-18 fixture recipe (tests/integration/orientation
// .test.ts): real corpus pixels via sharp re-encode (metadata-free by default),
// then a HAND-BUILT JPEG APP segment splice carrying exactly one semantic.
// sharp 0.35.4 cannot author arbitrary EXIF (withExif accepts only libvips
// tag-table keys and cannot address the GPS IFD), so the GPS fixture splices a
// minimal TIFF EXIF blob built byte-by-byte below — see
// docs/implementation/WP-21.md "GPS fixture recipe" for the full recipe.
import sharp from "sharp";

/** Host sRGB profile path (same table as the WP-16/WP-18 fixtures). */
export const HOST_SRGB_PROFILE = "/System/Library/ColorSync/Profiles/sRGB Profile.icc";

// ---------------------------------------------------------------------------
// Hand-built EXIF/TIFF blobs
// ---------------------------------------------------------------------------

/**
 * Build a minimal EXIF APP1 payload ("Exif\0\0" + TIFF) whose IFD0 carries a
 * single GPSInfo pointer (tag 0x8825) to a GPS IFD with 6 entries:
 * GPSVersionID, GPSLatitudeRef "N", GPSLatitude 41° 17.52' 0",
 * GPSLongitudeRef "E", GPSLongitude 2° 21.78' 0", GPSAltitude 12 m.
 * Little-endian ("II") TIFF, 160 bytes. Detected by the WP-21 scanner's own
 * IFD walk (sharp's metadata exposes the exif Buffer but no GPS semantics).
 */
export function buildGpsExifPayload(): Buffer {
  const tiff = Buffer.alloc(160);
  let o = 0;
  tiff.write("II", o); o += 2;
  tiff.writeUInt16LE(42, o); o += 2; // TIFF magic
  tiff.writeUInt32LE(8, o); o += 4; // IFD0 at 8
  // IFD0 @8: 1 entry — 0x8825 GPSInfo, type LONG(4), count 1, value=26; next=0
  tiff.writeUInt16LE(1, o); o += 2;
  tiff.writeUInt16LE(0x8825, o); o += 2;
  tiff.writeUInt16LE(4, o); o += 2;
  tiff.writeUInt32LE(1, o); o += 4;
  tiff.writeUInt32LE(26, o); o += 4;
  tiff.writeUInt32LE(0, o); o += 4; // o === 26
  // GPS IFD @26: 6 entries (12 B each) + next-IFD 0
  tiff.writeUInt16LE(6, o); o += 2;
  // 0x0000 GPSVersionID BYTE[4] inline: 2.2.0.0
  tiff.writeUInt16LE(0x0000, o); o += 2;
  tiff.writeUInt16LE(1, o); o += 2; // BYTE
  tiff.writeUInt32LE(4, o); o += 4;
  tiff[o] = 2; tiff[o + 1] = 2; tiff[o + 2] = 0; tiff[o + 3] = 0; o += 4;
  // 0x0001 GPSLatitudeRef ASCII[2] inline "N\0"
  tiff.writeUInt16LE(0x0001, o); o += 2;
  tiff.writeUInt16LE(2, o); o += 2; // ASCII
  tiff.writeUInt32LE(2, o); o += 4;
  tiff[o] = 0x4e; tiff[o + 1] = 0; o += 4;
  // 0x0002 GPSLatitude RATIONAL[3] -> offset 104
  tiff.writeUInt16LE(0x0002, o); o += 2;
  tiff.writeUInt16LE(5, o); o += 2; // RATIONAL
  tiff.writeUInt32LE(3, o); o += 4;
  tiff.writeUInt32LE(104, o); o += 4;
  // 0x0003 GPSLongitudeRef ASCII[2] inline "E\0"
  tiff.writeUInt16LE(0x0003, o); o += 2;
  tiff.writeUInt16LE(2, o); o += 2; // ASCII
  tiff.writeUInt32LE(2, o); o += 4;
  tiff[o] = 0x45; tiff[o + 1] = 0; o += 4;
  // 0x0004 GPSLongitude RATIONAL[3] -> offset 128
  tiff.writeUInt16LE(0x0004, o); o += 2;
  tiff.writeUInt16LE(5, o); o += 2; // RATIONAL
  tiff.writeUInt32LE(3, o); o += 4;
  tiff.writeUInt32LE(128, o); o += 4;
  // 0x0006 GPSAltitude RATIONAL[1] -> offset 152
  tiff.writeUInt16LE(0x0006, o); o += 2;
  tiff.writeUInt16LE(5, o); o += 2; // RATIONAL
  tiff.writeUInt32LE(1, o); o += 4;
  tiff.writeUInt32LE(152, o); o += 4;
  tiff.writeUInt32LE(0, o); o += 4; // o === 104
  const putRat = (off: number, num: number, den: number) => {
    tiff.writeUInt32LE(num, off);
    tiff.writeUInt32LE(den, off + 4);
  };
  putRat(104, 41, 1); putRat(112, 1752, 100); putRat(120, 0, 1); // 41° 17.52' 0"
  putRat(128, 2, 1); putRat(136, 2178, 100); putRat(144, 0, 1); // 2° 21.78' 0"
  putRat(152, 12, 1); // 12 m
  return Buffer.concat([Buffer.from("Exif\0\0", "binary"), tiff]);
}

/**
 * Build a minimal EXIF APP1 payload whose IFD0 points at an EXIF sub-IFD
 * (tag 0x8769) carrying BodySerialNumber (tag 0xA431, UNDEFINED, "SN-PROBE-1")
 * and ImageUniqueID (tag 0xA420, ASCII, "probe-unique-id") — the private /
 * serial-tag classes from IMAGE_PIPELINE §7.1. No GPS IFD (see
 * buildGpsExifPayload for the GPS-only sibling).
 */
export function buildSerialExifPayload(): Buffer {
  // Layout: header(8) | IFD0: 1 entry + next (18 B, ends 26) | Exif IFD @26:
  // 2 entries + next (30 B, ends 56) | data: BodySerialNumber[11] @56,
  // ImageUniqueID[15] @67.
  const tiff = Buffer.alloc(82);
  let o = 0;
  tiff.write("II", o); o += 2;
  tiff.writeUInt16LE(42, o); o += 2;
  tiff.writeUInt32LE(8, o); o += 4;
  // IFD0 @8: 1 entry — 0x8769 ExifIFDPointer, LONG, 1, value=26; next=0
  tiff.writeUInt16LE(1, o); o += 2;
  tiff.writeUInt16LE(0x8769, o); o += 2;
  tiff.writeUInt16LE(4, o); o += 2;
  tiff.writeUInt32LE(1, o); o += 4;
  tiff.writeUInt32LE(26, o); o += 4;
  tiff.writeUInt32LE(0, o); o += 4; // o === 26
  // Exif IFD @26: 2 entries
  tiff.writeUInt16LE(2, o); o += 2;
  // 0xA431 BodySerialNumber UNDEFINED[11] -> offset 56 ("SN-PROBE-1\0")
  tiff.writeUInt16LE(0xa431, o); o += 2;
  tiff.writeUInt16LE(7, o); o += 2; // UNDEFINED
  tiff.writeUInt32LE(11, o); o += 4;
  tiff.writeUInt32LE(56, o); o += 4;
  // 0xA420 ImageUniqueID ASCII[15] -> offset 67 ("probe-unique-id\0")
  tiff.writeUInt16LE(0xa420, o); o += 2;
  tiff.writeUInt16LE(2, o); o += 2; // ASCII
  tiff.writeUInt32LE(15, o); o += 4;
  tiff.writeUInt32LE(67, o); o += 4;
  tiff.writeUInt32LE(0, o); o += 4; // o === 56
  tiff.write("SN-PROBE-1\0", 56, 11, "binary");
  tiff.write("probe-unique-id\0", 67, 15, "binary");
  return Buffer.concat([Buffer.from("Exif\0\0", "binary"), tiff]);
}

/** An XMP packet string declaring a GPS latitude/longitude ( leaking probe). */
export const XMP_WITH_GPS =
  '<?xpacket begin=""?><x:xmpmeta xmlns:x="adobe:ns:meta/">' +
  '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
  '<rdf:Description rdf:about="" xmlns:exif="http://ns.adobe.com/exif/1.0/" ' +
  'exif:GPSLatitude="41,17.52N" exif:GPSLongitude="2,21.78E"/>' +
  "</rdf:RDF></x:xmpmeta>";

/** A plain XMP packet (no GPS) for the generic XMP-detection cases. */
export const XMP_PLAIN =
  '<?xpacket begin=""?><x:xmpmeta xmlns:x="adobe:ns:meta/">' +
  '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
  '<rdf:Description rdf:about="" xmp:CreatorTool="QuietEditorial"/></rdf:RDF>' +
  "</x:xmpmeta>";

// ---------------------------------------------------------------------------
// JPEG segment splicing (WP-18 recipe style)
// ---------------------------------------------------------------------------

/**
 * Insert a raw APPn payload (already prefixed with its identifier, e.g.
 * "Exif\0\0" + TIFF) into a JPEG right after SOI + any APP0/APP1 runs.
 */
export function spliceJpegAppSegment(jpeg: Buffer, marker: number, payload: Buffer): Buffer {
  const segment = Buffer.concat([Buffer.from([0xff, marker]), Buffer.alloc(2), payload]);
  segment.writeUInt16BE(payload.length + 2, 2); // length includes itself, excludes marker
  let offset = 2; // after SOI
  while (jpeg[offset] === 0xff && jpeg[offset + 1]! >= 0xe0 && jpeg[offset + 1]! <= 0xef) {
    offset += 2 + jpeg.readUInt16BE(offset + 2);
  }
  return Buffer.concat([jpeg.subarray(0, offset), segment, jpeg.subarray(offset)]);
}

/** EXIF APP1 (marker 0xE1) convenience wrapper. */
export function spliceJpegExifApp1(jpeg: Buffer, exifPayload: Buffer): Buffer {
  return spliceJpegAppSegment(jpeg, 0xe1, exifPayload);
}

/** XMP APP1 payload ("http://ns.adobe.com/xap/1.0/\0" + packet). */
export function xmpApp1Payload(packet: string): Buffer {
  return Buffer.concat([Buffer.from("http://ns.adobe.com/xap/1.0/\0", "binary"), Buffer.from(packet, "utf8")]);
}

/** IPTC APP13 payload ("Photoshop 3.0\0" + one minimal 8BIM IPTC record). */
export function iptcApp13Payload(): Buffer {
  // 8BIM image resource: "8BIM" + resource ID 0x0404 (IPTC-NAA) + padded name
  // + size + 4 bytes of IPTC-looking payload (enough for detection; the
  // scanner flags the APP13 class itself, it does not parse IPTC fields).
  const record = Buffer.concat([
    Buffer.from("8BIM", "binary"),
    Buffer.from([0x04, 0x04]),
    Buffer.from([0x00, 0x00]), // padded Pascal name
    Buffer.from([0x00, 0x04]), // size 4
    Buffer.from([0x1c, 0x02, 0x00, 0x00]), // IPTC record marker + dataset
  ]);
  return Buffer.concat([Buffer.from("Photoshop 3.0\0", "binary"), record]);
}

/**
 * Harvest a real ICC profile carrier: a JPEG whose APP2 carries the host sRGB
 * profile ("ICC_PROFILE\0" + seq/count + profile bytes), so the spliced
 * ICC-detection fixture uses a genuine profile blob, not a fake string.
 */
export async function buildIccApp2Payload(): Promise<Buffer> {
  const probe = await sharp({
    create: { width: 16, height: 16, channels: 3, background: { r: 1, g: 2, b: 3 } },
  })
    .withIccProfile(HOST_SRGB_PROFILE)
    .jpeg({ quality: 60 })
    .toBuffer();
  // Walk to the first APP2 and lift its payload.
  let offset = 2;
  for (;;) {
    if (probe[offset] !== 0xff) throw new Error("probe JPEG walk left marker position");
    const marker = probe[offset + 1]!;
    if (marker === 0xda) throw new Error("probe JPEG carries no ICC APP2");
    const length = probe.readUInt16BE(offset + 2);
    if (marker === 0xe2) {
      const payload = probe.subarray(offset + 4, offset + 2 + length);
      if (payload.subarray(0, 11).toString("binary") !== "ICC_PROFILE") {
        throw new Error("probe APP2 is not ICC_PROFILE");
      }
      return Buffer.from(payload); // "ICC_PROFILE\0" + seq + count + profile
    }
    offset += 2 + length;
  }
}
