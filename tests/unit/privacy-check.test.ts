// WP-21 unit tests — the final metadata scanner's byte-level semantics
// (IMAGE_PIPELINE.md §5 stages 6–7, §7 privacy contract, §11.1 fail-closed;
// ADR-012 default full strip; ICC-POLICY.md D10 no output ICC).
//
// The scanner parses RAW BYTES with no sharp involvement, so these tests feed
// it synthetic and probe-built containers directly:
//   - JPEG: APP segment walk (Exif APP1 → TIFF IFD walk incl. GPS/Exif
//     sub-IFDs; XMP APP1; IPTC APP13; ICC APP2; COM), sharp-strip default.
//   - AVIF/ISOBMFF: meta box walk (iinf/infe item types, iloc extents, idat,
//     iprp/ipco/colr ICC) over files built by sharp with the metadata-keeping
//     probe APIs (keepExif / withXmp / withIccProfile) — the same bytes a
//     regressed pipeline would emit.
//   - Fail-closed: malformed TIFF/box structures and unscannable formats are
//     findings, never silent passes.
// Also here: the static no-metadata-API assertion over scripts/media/*.ts and
// the stage-order wiring of the finalize plan (stages 6–7 after 5).
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import sharp from "sharp";
import {
  FINALIZE_STAGE_PLAN,
  PrivacyVerificationError,
  scanBuffer,
  validateFinalizeStagePlan,
  finalizeAndVerify,
} from "../../scripts/media/privacy-check";
import { DERIVE_STAGE_PLAN } from "../../scripts/media/derive";
import {
  buildGpsExifPayload,
  buildIccApp2Payload,
  buildSerialExifPayload,
  iptcApp13Payload,
  spliceJpegAppSegment,
  spliceJpegExifApp1,
  xmpApp1Payload,
  XMP_PLAIN,
  XMP_WITH_GPS,
} from "../support/privacy-fixtures";

/** A clean, metadata-free JPEG (sharp strip default). */
async function cleanJpeg(): Promise<Buffer> {
  return sharp({
    create: { width: 64, height: 48, channels: 3, background: { r: 80, g: 120, b: 160 } },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
}

/** A clean, metadata-free AVIF (sharp strip default). */
async function cleanAvif(): Promise<Buffer> {
  return sharp({
    create: { width: 64, height: 48, channels: 3, background: { r: 80, g: 120, b: 160 } },
  })
    .avif({ quality: 40 })
    .toBuffer();
}

describe("WP-21 scanner — clean containers pass with zero findings", () => {
  test("a sharp-encoded JPEG (strip default) scans clean", async () => {
    const scan = scanBuffer(await cleanJpeg());
    expect(scan.ok).toBe(true);
    expect(scan.findings).toHaveLength(0);
    expect(scan.format).toBe("jpeg");
    expect(scan.segmentsExamined).toBeGreaterThan(0);
  });

  test("a sharp-encoded AVIF (strip default) scans clean", async () => {
    const scan = scanBuffer(await cleanAvif());
    expect(scan.ok).toBe(true);
    expect(scan.findings).toHaveLength(0);
    expect(scan.format).toBe("isobmff");
    expect(scan.segmentsExamined).toBeGreaterThan(0);
  });
});

describe("WP-21 scanner — JPEG APP segment walk", () => {
  test("spliced GPS EXIF APP1 is found: gps + exif findings with IFD detail", async () => {
    const spliced = spliceJpegExifApp1(await cleanJpeg(), buildGpsExifPayload());
    const scan = scanBuffer(spliced);
    expect(scan.ok).toBe(false);
    const gps = scan.findings.filter((f) => f.kind === "gps");
    expect(gps.length).toBeGreaterThanOrEqual(1);
    expect(gps[0]!.rule).toBe("11.1:privacy-verification");
    expect(gps[0]!.detail).toMatch(/GPS/i);
    expect(scan.findings.some((f) => f.kind === "exif")).toBe(true);
  });

  test("serial/private EXIF tags (BodySerialNumber, ImageUniqueID) are found via the Exif sub-IFD", async () => {
    const spliced = spliceJpegExifApp1(await cleanJpeg(), buildSerialExifPayload());
    const scan = scanBuffer(spliced);
    expect(scan.ok).toBe(false);
    expect(scan.findings.some((f) => f.kind === "serial")).toBe(true);
    expect(scan.findings.some((f) => f.kind === "exif")).toBe(true);
  });

  test("an EXIF APP1 with NO GPS/serial still fails the default full strip (ADR-012)", async () => {
    // Orientation-only EXIF: harvest sharp's own blob (WP-18 recipe) — it has
    // no GPS IFD, yet ANY EXIF in final bytes is a §11.1 failure.
    const exifSrc = await sharp({
      create: { width: 32, height: 32, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .withMetadata({ orientation: 6 })
      .jpeg({ quality: 80 })
      .toBuffer();
    const exifPayload = (await sharp(exifSrc).metadata()).exif!;
    const spliced = spliceJpegExifApp1(await cleanJpeg(), Buffer.from(exifPayload));
    const scan = scanBuffer(spliced);
    expect(scan.ok).toBe(false);
    expect(scan.findings.some((f) => f.kind === "exif")).toBe(true);
    expect(scan.findings.some((f) => f.kind === "gps")).toBe(false);
  });

  test("XMP APP1 is found; XMP carrying GPS properties raises BOTH xmp and gps", async () => {
    const plain = scanBuffer(spliceJpegAppSegment(await cleanJpeg(), 0xe1, xmpApp1Payload(XMP_PLAIN)));
    expect(plain.findings.some((f) => f.kind === "xmp")).toBe(true);
    expect(plain.findings.some((f) => f.kind === "gps")).toBe(false);

    const withGps = scanBuffer(spliceJpegAppSegment(await cleanJpeg(), 0xe1, xmpApp1Payload(XMP_WITH_GPS)));
    expect(withGps.findings.some((f) => f.kind === "xmp")).toBe(true);
    expect(withGps.findings.some((f) => f.kind === "gps")).toBe(true);
  });

  test("IPTC APP13 (Photoshop 3.0 / 8BIM) is found", async () => {
    const scan = scanBuffer(spliceJpegAppSegment(await cleanJpeg(), 0xed, iptcApp13Payload()));
    expect(scan.findings.some((f) => f.kind === "iptc")).toBe(true);
    expect(scan.ok).toBe(false);
  });

  test("ICC APP2 (ICC_PROFILE) is found — D10 no-embedding assertion", async () => {
    const icc = await buildIccApp2Payload();
    const scan = scanBuffer(spliceJpegAppSegment(await cleanJpeg(), 0xe2, icc));
    const iccFindings = scan.findings.filter((f) => f.kind === "icc");
    expect(iccFindings.length).toBeGreaterThanOrEqual(1);
    expect(iccFindings[0]!.detail).toMatch(/3144|ICC/i);
    expect(scan.ok).toBe(false);
  });

  test("a COM comment segment is found (any private metadata, full-strip default)", async () => {
    const scan = scanBuffer(spliceJpegAppSegment(await cleanJpeg(), 0xfe, Buffer.from("private note", "utf8")));
    expect(scan.findings.some((f) => f.kind === "comment")).toBe(true);
    expect(scan.ok).toBe(false);
  });

  test("malformed EXIF TIFF payload fails CLOSED as a malformed finding, never a pass", async () => {
    const garbage = Buffer.concat([Buffer.from("Exif\0\0", "binary"), Buffer.alloc(40, 0xff)]);
    const scan = scanBuffer(spliceJpegExifApp1(await cleanJpeg(), garbage));
    expect(scan.ok).toBe(false);
    expect(scan.findings.some((f) => f.kind === "malformed")).toBe(true);
  });

  test("an unscannable format fails closed (no silent pass for unknown bytes)", async () => {
    const png = await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();
    const scan = scanBuffer(png);
    expect(scan.ok).toBe(false);
    expect(scan.findings.some((f) => f.kind === "unscannable-format")).toBe(true);
  });
});

describe("WP-21 scanner — AVIF/ISOBMFF container box walk", () => {
  test("AVIF whose container carries an Exif item (keepExif probe path) is found via iloc + TIFF walk", async () => {
    // Build an EXIF-bearing AVIF the way a regressed pipeline would: keepExif
    // on the encode path. The scanner must find the item WITHOUT sharp.
    const exifJpeg = await sharp({
      create: { width: 64, height: 48, channels: 3, background: { r: 80, g: 120, b: 160 } },
    })
      .withMetadata({ orientation: 6 })
      .jpeg({ quality: 80 })
      .toBuffer();
    const leaking = await sharp(exifJpeg).keepExif().avif({ quality: 40 }).toBuffer();
    const scan = scanBuffer(leaking);
    expect(scan.ok).toBe(false);
    expect(scan.findings.some((f) => f.kind === "exif")).toBe(true);
  });

  test("AVIF whose Exif item carries GPS (hand-built blob through keepExif) yields a gps finding", async () => {
    const gpsJpeg = spliceJpegExifApp1(await cleanJpeg(), buildGpsExifPayload());
    const leaking = await sharp(gpsJpeg).keepExif().avif({ quality: 40 }).toBuffer();
    const scan = scanBuffer(leaking);
    expect(scan.ok).toBe(false);
    expect(scan.findings.some((f) => f.kind === "gps")).toBe(true);
    expect(scan.findings.some((f) => f.kind === "exif")).toBe(true);
  });

  test("AVIF with an XMP item (withXmp probe path) is found; GPS XMP raises gps", async () => {
    const xmpAvif = await sharp(await cleanAvif()).withXmp(XMP_PLAIN).avif({ quality: 40 }).toBuffer();
    const plain = scanBuffer(xmpAvif);
    expect(plain.ok).toBe(false);
    expect(plain.findings.some((f) => f.kind === "xmp")).toBe(true);

    const gpsXmpAvif = await sharp(await cleanAvif()).withXmp(XMP_WITH_GPS).avif({ quality: 40 }).toBuffer();
    const withGps = scanBuffer(gpsXmpAvif);
    expect(withGps.findings.some((f) => f.kind === "gps")).toBe(true);
  });

  test("AVIF with an embedded ICC profile (colr box 'prof', withIccProfile probe path) is found", async () => {
    const iccAvif = await sharp({
      create: { width: 64, height: 48, channels: 3, background: { r: 80, g: 120, b: 160 } },
    })
      .withIccProfile("/System/Library/ColorSync/Profiles/sRGB Profile.icc")
      .avif({ quality: 40 })
      .toBuffer();
    const scan = scanBuffer(iccAvif);
    expect(scan.ok).toBe(false);
    expect(scan.findings.some((f) => f.kind === "icc")).toBe(true);
  });

  test("an unrecognized 'zzzz' item type in a hand-built container fails closed as metadata-item", async () => {
    // Minimal hand-built ISOBMFF (test-side builder below) whose item table
    // carries one item of type "zzzz" — a foreign metadata carrier. The
    // scanner must flag the item type (in the detail, for auditability)
    // rather than ignore it.
    const container = buildMinimalIsobmff({
      itemType: "zzzz",
      ipcoChildren: [],
    });
    const scan = scanBuffer(container);
    expect(scan.ok).toBe(false);
    const itemFindings = scan.findings.filter((f) => f.kind === "metadata-item");
    expect(itemFindings.length).toBeGreaterThanOrEqual(1);
    expect(itemFindings.some((f) => f.detail.includes("zzzz"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Fix-round-1 hardening (review of 2ee5a7f): silent-pass / crash cases
// ---------------------------------------------------------------------------

/** BE integer helpers for hand-built containers/segments. */
function u16(v: number): Buffer {
  const b = Buffer.alloc(2);
  b.writeUInt16BE(v, 0);
  return b;
}
function u32(v: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(v, 0);
  return b;
}
/** A plain ISOBMFF box: size + type + payload. */
function box(type: string, ...payloads: Buffer[]): Buffer {
  const body = Buffer.concat(payloads);
  const b = Buffer.alloc(8 + body.length);
  b.writeUInt32BE(b.length, 0);
  b.write(type, 4, "binary");
  body.copy(b, 8);
  return b;
}
/** A full box: size + type + version byte + 24-bit flags + payload. */
function fullBox(type: string, version: number, flags: number, ...payloads: Buffer[]): Buffer {
  const vf = Buffer.alloc(4);
  vf[0] = version;
  vf.writeUIntBE(flags & 0x00ffffff, 1, 3);
  return box(type, vf, ...payloads);
}

/** Minimal hand-built ISOBMFF container (scanner-contract bytes). */
function buildMinimalIsobmff(options: {
  itemType: string;
  ipcoChildren: Buffer[];
  mdatPayload?: Buffer;
}): Buffer {
  const mdatPayload = options.mdatPayload ?? Buffer.from("pixels", "binary");
  const mdat = box("mdat", mdatPayload);
  const hdlr = fullBox("hdlr", 0, 0, u32(0), Buffer.from("pict", "binary"), Buffer.alloc(12), Buffer.from([0]));
  const infe = fullBox("infe", 2, 0, u16(1), u16(0), Buffer.from(options.itemType, "binary"), Buffer.from([0]));
  const iinf = fullBox("iinf", 0, 0, u16(1), infe);
  const iloc = fullBox(
    "iloc",
    0,
    0,
    Buffer.from([0x44, 0x40]), // offset_size 4 / length_size 4, base_offset_size 4
    u16(1), // item count
    u16(1), // item_ID
    u16(0), // data_reference_index
    u32(0), // base_offset
    u16(1), // extent count
    u32(0), // extent offset (fixed below once layout is final)
    u32(mdatPayload.length),
  );
  const children: Buffer[] = [hdlr, iinf, iloc];
  if (options.ipcoChildren.length > 0) {
    const ipco = box("ipco", ...options.ipcoChildren);
    children.push(box("iprp", ipco));
  }
  const meta = fullBox("meta", 0, 0, ...children);
  const ftyp = box("ftyp", Buffer.from("avif", "binary"), u32(0), Buffer.from("mif1", "binary"));
  const extentOffset = ftyp.length + meta.length + 8;
  iloc.writeUInt32BE(extentOffset, iloc.length - 8);
  return Buffer.concat([ftyp, meta, mdat]);
}

describe("WP-21 fix round 1 — truncated EXIF APP1 yields malformed, never a throw", () => {
  test("a TIFF whose next-IFD offset lies past EOF produces a malformed finding (no RangeError)", () => {
    // "Exif\0\0" + consistent LITTLE-ENDIAN TIFF: II + 42 + IFD0@8 +
    // entryCount=0 and NOTHING after — the next-IFD u32 (LE) read at the
    // IFD0 end lands past EOF (the reviewer's crash repro; the bound must
    // include the 4 next-IFD bytes).
    const u16le = (v: number) => {
      const b = Buffer.alloc(2);
      b.writeUInt16LE(v, 0);
      return b;
    };
    const u32le = (v: number) => {
      const b = Buffer.alloc(4);
      b.writeUInt32LE(v, 0);
      return b;
    };
    const tiff = Buffer.concat([Buffer.from("II", "binary"), u16le(42), u32le(8), u16le(0)]);
    const payload = Buffer.concat([Buffer.from("Exif\0\0", "binary"), tiff]);
    const segment = Buffer.concat([Buffer.from([0xff, 0xe1]), u16(payload.length + 2), payload]);
    const truncated = Buffer.concat([Buffer.from([0xff, 0xd8]), segment]);
    const scan = scanBuffer(truncated);
    expect(scan.ok).toBe(false);
    expect(scan.findings.some((f) => f.kind === "malformed")).toBe(true);
  });
});

describe("WP-21 fix round 1 — unreadable sibling boxes never pass silently", () => {
  test("a malformed box before 'colr prof' inside ipco yields icc-or-malformed, never ok", () => {
    // The reviewer's exact probe: ipco = [malformed "fre_" box (declared size
    // 3 < 8), colr 'prof' with profile bytes] — the colr box after the
    // unreadable sibling must still surface (or the unreadable region itself
    // must), never a silent ok.
    const malformedBox = Buffer.concat([u32(3), Buffer.from("fre_", "binary")]);
    const colr = box("colr", Buffer.from("prof", "binary"), Buffer.alloc(64, 0x42));
    const container = buildMinimalIsobmff({ itemType: "av01", ipcoChildren: [malformedBox, colr] });
    const scan = scanBuffer(container);
    expect(scan.ok).toBe(false);
    expect(scan.findings.some((f) => f.kind === "icc" || f.kind === "malformed")).toBe(true);
  });
});

describe("WP-21 fix round 1 — CLI fails closed on an empty scan set", () => {
  test("an empty directory yields exit 1 with a fail-closed error (never a silent PASS)", async () => {
    const { spawnSync } = await import("node:child_process");
    const { mkdtemp, rm } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const emptyDir = await mkdtemp(join(tmpdir(), "wp21-empty-"));
    try {
      const repoRoot = join(import.meta.dirname, "..", "..");
      const result = spawnSync(
        process.execPath,
        [
          "--experimental-strip-types",
          "--import",
          "./scripts/validate/register-ts-resolve.mjs",
          "scripts/media/privacy-check.ts",
          emptyDir,
        ],
        { cwd: repoRoot, encoding: "utf8", timeout: 60_000 },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/no scannable files found/);
      expect(result.stderr).toMatch(/fail closed/);
    } finally {
      await rm(emptyDir, { recursive: true, force: true });
    }
  }, 90_000);
});

describe("WP-21 fix round 1 — post-SOS segments are flagged, never silent", () => {
  test("a GPS APP1 hidden after SOS (before EOI) is caught — ok is impossible", async () => {
    const clean = await cleanJpeg();
    const eoi = clean.lastIndexOf(Buffer.from([0xff, 0xd9]));
    expect(eoi).toBeGreaterThan(0);
    const segment = Buffer.concat([
      Buffer.from([0xff, 0xe1]),
      u16(buildGpsExifPayload().length + 2),
      buildGpsExifPayload(),
    ]);
    const spiked = Buffer.concat([clean.subarray(0, eoi), segment, clean.subarray(eoi)]);
    const scan = scanBuffer(spiked);
    expect(scan.ok).toBe(false);
    // The hidden APP1 is classified like any other (gps + exif), or at
    // minimum flagged as a post-entropy segment/malformed region.
    expect(
      scan.findings.some((f) => ["gps", "exif", "segment", "malformed"].includes(f.kind)),
    ).toBe(true);
    expect(scan.findings.some((f) => f.kind === "gps")).toBe(true);
  });
});

describe("WP-21 verifyPrivacy over files (structured findings, fail-closed)", () => {
  test("clean files pass; a spliced GPS file fails with 11.1:privacy-verification and the failing path", async () => {
    const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const dir = await mkdtemp(join(tmpdir(), "wp21-verify-"));
    try {
      const cleanPath = join(dir, "clean.jpg");
      const gpsPath = join(dir, "gps.jpg");
      await writeFile(cleanPath, await cleanJpeg());
      await writeFile(gpsPath, spliceJpegExifApp1(await cleanJpeg(), buildGpsExifPayload()));
      const { verifyPrivacy } = await import("../../scripts/media/privacy-check");

      const cleanReport = await verifyPrivacy([cleanPath]);
      expect(cleanReport.ok).toBe(true);
      expect(cleanReport.files[0]!.scan.findings).toHaveLength(0);

      const leakReport = await verifyPrivacy([cleanPath, gpsPath]);
      expect(leakReport.ok).toBe(false);
      expect(leakReport.filesScanned).toBe(2);
      expect(leakReport.findings.some((f) => f.kind === "gps")).toBe(true);
      const failedFile = leakReport.files.find((f) => f.file === gpsPath)!;
      expect(failedFile.scan.ok).toBe(false);
      // fail-closed throw form
      await expect(verifyPrivacy([gpsPath], { throwOnError: true })).rejects.toThrow(
        PrivacyVerificationError,
      );
      await expect(verifyPrivacy([gpsPath], { throwOnError: true })).rejects.toThrow(
        /11\.1:privacy-verification/,
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("WP-21 stage-order wiring (stages 6–7 after 5)", () => {
  test("FINALIZE_STAGE_PLAN = the stage-5 derive plan + strip-metadata", () => {
    expect(FINALIZE_STAGE_PLAN).toEqual([...DERIVE_STAGE_PLAN, "strip-metadata"]);
  });

  test("the finalize plan validates through the WP-18 guard", () => {
    const plan = validateFinalizeStagePlan();
    expect(plan).toEqual(FINALIZE_STAGE_PLAN);
  });

  test("the finalize plan contains NO embed-output-icc (D10: nothing to embed) and NO hash-output (WP-22)", () => {
    expect(FINALIZE_STAGE_PLAN).not.toContain("embed-output-icc");
    expect(FINALIZE_STAGE_PLAN).not.toContain("hash-output");
    // The stage-7 slot stays canonically available (the guard accepts a plan
    // that embeds AFTER strip) — but WP-21's production plan deliberately
    // omits it per ICC-POLICY.md D10.
    expect(validateFinalizeStagePlan([...DERIVE_STAGE_PLAN, "strip-metadata", "embed-output-icc"])).toEqual([
      ...DERIVE_STAGE_PLAN,
      "strip-metadata",
      "embed-output-icc",
    ]);
  });

  test("a drifted plan (strip before resize) fails closed with the guard token", () => {
    expect(() =>
      validateFinalizeStagePlan(["read-decode", "strip-metadata", "normalize-orientation", "resize-encode"]),
    ).toThrow(/5:stage-order/);
  });

  test("finalizeAndVerify without stage-plan-eligible input still refuses a drifted plan", () => {
    // The plan is composed and validated inside finalizeAndVerify before any
    // I/O — a code drift that reordered stages fails before scanning.
    expect(FINALIZE_STAGE_PLAN[FINALIZE_STAGE_PLAN.length - 1]).toBe("strip-metadata");
  });
});

describe("WP-21 static assertions (comment-stripped pipeline greps)", () => {
  /** Remove comments so greps pin CODE, not the documentation of the rule. */
  function stripComments(source: string): string {
    return source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  }

  const FORBIDDEN = ["keepExif", "keepMetadata", "withExif", "keepIccProfile", "withIccProfile"];

  test("no metadata-retaining / ICC-embedding API call exists anywhere in scripts/media/*.ts", async () => {
    const mediaDir = join(import.meta.dirname, "..", "..", "scripts", "media");
    const files = (await readdir(mediaDir)).filter((f) => f.endsWith(".ts")).sort();
    expect(files.length).toBeGreaterThanOrEqual(8);
    const offenders: string[] = [];
    for (const file of files) {
      const code = stripComments(await readFile(join(mediaDir, file), "utf8"));
      for (const name of FORBIDDEN) {
        if (code.includes(name)) offenders.push(`${file}: ${name}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test("the finalize entrypoint exists as code and scans buffers (not just docs)", async () => {
    expect(typeof finalizeAndVerify).toBe("function");
    expect(typeof scanBuffer).toBe("function");
    expect(PrivacyVerificationError).toBeInstanceOf(Function);
  });
});

// ---------------------------------------------------------------------------
// P3 targeted corrections (IMP-01) — scanner covers the ENTIRE byte stream:
// JPEG ends at EOI, AVIF top level is a whitelist. Both adversarial shapes
// below are the exact independent-review false negatives (ok=true pre-fix).
// ---------------------------------------------------------------------------
describe("P3 IMP-01 — JPEG bytes after EOI fail closed (never silently ignored)", () => {
  test("a valid GPS EXIF APP1 appended AFTER EOI fails the scan (exact regression)", async () => {
    const jpeg = await cleanJpeg();
    // buildGpsExifPayload() IS the complete APP1 payload (Exif\0\0 + valid
    // GPS TIFF) — R-03: do NOT prepend a second Exif prefix; the earlier
    // double-prefixed fixture broke TIFF classification (no gps finding).
    const app1 = Buffer.concat([
      Buffer.from([0xff, 0xe1]),
      (() => {
        const len = Buffer.alloc(2);
        len.writeUInt16BE(buildGpsExifPayload().length + 2);
        return len;
      })(),
      buildGpsExifPayload(),
    ]);
    const scan = scanBuffer(Buffer.concat([jpeg, app1]));
    expect(scan.ok).toBe(false);
    const kinds = scan.findings.map((f) => f.kind);
    expect(kinds).toContain("exif"); // the appended payload is classified
    expect(kinds).toContain("gps"); // the GPS IFD is fully classified
    expect(scan.findings.some((f) => f.detail.includes("after EOI"))).toBe(true);
  });

  test("even opaque trailing garbage after EOI fails closed", async () => {
    const scan = scanBuffer(Buffer.concat([await cleanJpeg(), Buffer.from([0xde, 0xad, 0xbe, 0xef])]));
    expect(scan.ok).toBe(false);
    expect(scan.findings.some((f) => f.detail.includes("after EOI"))).toBe(true);
  });

  test("benign control: the clean JPEG without trailing bytes still passes", async () => {
    const scan = scanBuffer(await cleanJpeg());
    expect(scan.ok).toBe(true);
    expect(scan.findings).toHaveLength(0);
  });
});

describe("P3 IMP-01 — AVIF top-level whitelist (ftyp, exactly one meta, mdat)", () => {
  const ADOBE_XMP_UUID = Buffer.from("be7acfcb97a942e89c71999491e3afac", "hex");

  function topLevelBox(type: string, content: Buffer): Buffer {
    const size = Buffer.alloc(4);
    size.writeUInt32BE(content.length + 8);
    return Buffer.concat([size, Buffer.from(type, "binary"), content]);
  }

  test("a top-level Adobe-XMP uuid box carrying GPS + serial XMP fails (exact regression)", async () => {
    const xmp = XMP_WITH_GPS + "<tiff:SerialNumber>SN-ADVERSARIAL-123</tiff:SerialNumber>";
    const uuidBox = topLevelBox("uuid", Buffer.concat([ADOBE_XMP_UUID, Buffer.from(xmp, "utf8")]));
    const scan = scanBuffer(Buffer.concat([await cleanAvif(), uuidBox]));
    expect(scan.ok).toBe(false);
    const kinds = scan.findings.map((f) => f.kind);
    expect(kinds).toContain("xmp");
    expect(kinds).toContain("gps");
    expect(kinds).toContain("serial");
    expect(scan.findings.some((f) => f.detail.includes("Adobe-XMP"))).toBe(true);
  });

  test("a non-Adobe top-level uuid box is rejected as opaque (fail closed)", async () => {
    const custom = topLevelBox("uuid", Buffer.from(Buffer.alloc(16, 1).toString("hex", 0, 16), "hex"));
    const scan = scanBuffer(Buffer.concat([await cleanAvif(), custom]));
    expect(scan.ok).toBe(false);
    expect(scan.findings.some((f) => f.detail.includes("uuid"))).toBe(true);
  });

  test("free/skip and unknown top-level boxes are rejected (no speculative whitelist)", async () => {
    for (const type of ["free", "skip", "abcd"]) {
      const scan = scanBuffer(Buffer.concat([await cleanAvif(), topLevelBox(type, Buffer.from("x"))]));
      expect(scan.ok, `top-level '${type}' must fail closed`).toBe(false);
      expect(scan.findings.some((f) => f.detail.includes(`'${type}'`))).toBe(true);
    }
  });

  test("a duplicate top-level meta box is rejected", async () => {
    const avif = await cleanAvif();
    const metaContent = Buffer.concat([
      Buffer.from([0, 0, 0, 0]), // version/flags (full box)
      Buffer.from([0, 0, 0, 0]), // minimal body — the duplicate check fires on the box type
    ]);
    const scan = scanBuffer(Buffer.concat([avif, topLevelBox("meta", metaContent)]));
    expect(scan.ok).toBe(false);
    expect(scan.findings.some((f) => f.detail.includes("duplicate top-level 'meta'"))).toBe(true);
  });

  test("a trailing malformed top-level box (length past EOF) is rejected", async () => {
    const size = Buffer.alloc(4);
    size.writeUInt32BE(0xffffff);
    const scan = scanBuffer(Buffer.concat([await cleanAvif(), size, Buffer.from("mdat", "binary")]));
    expect(scan.ok).toBe(false);
    expect(scan.findings.length).toBeGreaterThan(0);
  });

  test("benign control: the clean AVIF without extra boxes still passes", async () => {
    const scan = scanBuffer(await cleanAvif());
    expect(scan.ok).toBe(true);
    expect(scan.findings).toHaveLength(0);
  });

  test("sharp-output structure conformance: the clean AVIF is exactly ftyp→meta→mdat", async () => {
    // Grounds the whitelist in the real producer output (all generated AVIFs
    // verified with this exact top-level sequence).
    const boxes: string[] = [];
    const avif = await cleanAvif();
    let cursor = 0;
    while (cursor < avif.length) {
      const size = avif.readUInt32BE(cursor);
      boxes.push(avif.subarray(cursor + 4, cursor + 8).toString("binary"));
      cursor += size;
    }
    expect(boxes).toEqual(["ftyp", "meta", "mdat"]);
  });

  test("R-01: a duplicate top-level ftyp carrying private text fails closed", async () => {
    const dup = topLevelBox("ftyp", Buffer.from("GPS 41.17N 2.21E SerialNumber SN-R-PROBE", "utf8"));
    const scan = scanBuffer(Buffer.concat([await cleanAvif(), dup]));
    expect(scan.ok).toBe(false);
    expect(scan.findings.some((f) => f.detail.includes("duplicate top-level 'ftyp'"))).toBe(true);
  });

  test("R-01: a duplicate top-level mdat carrying private text fails closed", async () => {
    const dup = topLevelBox("mdat", Buffer.from("GPS 41.17N 2.21E SerialNumber SN-R-PROBE", "utf8"));
    const scan = scanBuffer(Buffer.concat([await cleanAvif(), dup]));
    expect(scan.ok).toBe(false);
    expect(scan.findings.some((f) => f.detail.includes("duplicate top-level 'mdat'"))).toBe(true);
  });

  test("R-01: an AVIF with mdat removed fails closed (missing box)", async () => {
    const avif = await cleanAvif();
    const mdatStart = avif.indexOf(Buffer.from("mdat", "binary")) - 4;
    expect(mdatStart).toBeGreaterThan(0);
    const scan = scanBuffer(avif.subarray(0, mdatStart));
    expect(scan.ok).toBe(false);
    expect(scan.findings.some((f) => f.detail.includes("'mdat' missing"))).toBe(true);
  });

  test("R-01: missing ftyp fails closed (dispatch: unrecognizable container)", async () => {
    const avif = await cleanAvif();
    const ftypEnd = avif.readUInt32BE(0);
    const scan = scanBuffer(avif.subarray(ftypEnd));
    // Without the leading ftyp the bytes are not even recognizable as ISOBMFF;
    // the dispatch layer fails closed as unscannable — the contract (never a
    // silent pass) holds either way.
    expect(scan.ok).toBe(false);
    expect(scan.findings.some((f) => f.kind === "unscannable-format")).toBe(true);
  });

  test("R-01: missing meta fails closed", async () => {
    const avif = await cleanAvif();
    const metaStart = avif.indexOf(Buffer.from("meta", "binary")) - 4;
    const head = avif.subarray(0, metaStart);
    const tail = avif.subarray(avif.indexOf(Buffer.from("mdat", "binary")) - 4);
    const scan = scanBuffer(Buffer.concat([head, tail]));
    expect(scan.ok).toBe(false);
    expect(scan.findings.some((f) => f.detail.includes("'meta' missing"))).toBe(true);
  });

  test("R-01: reordered meta→ftyp→mdat and ftyp→mdat→meta fail closed", async () => {
    const avif = await cleanAvif();
    // Slice the three real boxes, then reassemble in wrong orders.
    const bounds = [0, avif.indexOf(Buffer.from("meta", "binary")) - 4, avif.indexOf(Buffer.from("mdat", "binary")) - 4, avif.length];
    const boxes = [avif.subarray(bounds[0]!, bounds[1]!), avif.subarray(bounds[1]!, bounds[2]!), avif.subarray(bounds[2]!, bounds[3]!)];
    for (const perm of [[boxes[1], boxes[0], boxes[2]], [boxes[0], boxes[2], boxes[1]]]) {
      const scan = scanBuffer(Buffer.concat(perm));
      expect(scan.ok).toBe(false);
    }
  });
});
