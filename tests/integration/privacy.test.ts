// WP-21 integration — privacy verification over the real pipeline
// (IMAGE_PIPELINE.md §5 stages 6–7, §7 privacy contract, §11.1 fail-closed
// privacy-verification; BUILD_AND_ROUTING.md §8 check 6 context; ADR-012;
// ICC-POLICY.md D10).
//
// Proven here, end to end:
//   1. GPS fixture (corpus copy + hand-built GPS EXIF APP1, recipe in
//      tests/support/privacy-fixtures.ts) → full WP-20 derivation →
//      finalizeAndVerify passes; EVERY final derivative byte is exhaustively
//      scanned: zero GPS, zero EXIF, zero ICC (not sampled — all files).
//   2. Deliberately-leaking regression probe: the same derivation cloned with
//      a metadata-retention call on the encode path (the exact regression the
//      static greps forbid) LEAKS GPS into final bytes, and the scanner
//      CAUGHTS it — proof the scanner detects what the pipeline must strip.
//   3. ICC in final bytes is caught (spliced ICC APP2 on a JPEG derivative;
//      a withIccProfile AVIF) — D10 assertion.
//   4. Master-untouched guard: modifying the master AFTER derivation fails
//      finalizeAndVerify closed (7.3:master-untouched); a discovery-record
//      SHA-256 mismatch fails closed the same way.
//   5. Exhaustive full-corpus verification over the WP-20-derived corpus
//      (generated/media if still present — 2224 files; documented in WP-21.md),
//      plus an always-run re-derived subset scanned file-by-file.
import { mkdtemp, cp, readFile, writeFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import sharp from "sharp";
import { deriveSource, parseDerivativeRecord } from "../../scripts/media/derive";
import { extractSourceMetadata } from "../../scripts/media/extract";
import {
  finalizeAndVerify,
  scanBuffer,
  verifyPrivacy,
  PrivacyVerificationError,
} from "../../scripts/media/privacy-check";
import {
  buildGpsExifPayload,
  buildIccApp2Payload,
  spliceJpegAppSegment,
  spliceJpegExifApp1,
  XMP_WITH_GPS,
} from "../support/privacy-fixtures";

const FIXTURES_DIR = join(import.meta.dirname, "..", "..", "media", "stage3c-fixtures");
const DECISION_DOC = join(
  import.meta.dirname,
  "..",
  "..",
  "docs",
  "implementation",
  "decisions",
  "BENCHMARK-OQ01-OQ02.md",
);
const CORPUS_OUT_DIR = join(import.meta.dirname, "..", "..", "generated", "media");
const GPS_MASTER_SOURCE = "DSC02560.jpg"; // F04 "most saturated" per the frozen manifest

let workDir: string;
let masterCopy: string; // clean corpus copy
let gpsMaster: string; // SAME pixels + GPS EXIF APP1 (recipe below)
let cleanBase: Buffer; // metadata-free re-encode of the corpus pixels
let recordText: string;
let frozenRecord: ReturnType<typeof parseDerivativeRecord>;

async function sha256File(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), "wp21-privacy-"));
  recordText = await readFile(DECISION_DOC, "utf8");
  frozenRecord = parseDerivativeRecord(recordText);
  masterCopy = join(workDir, "master.jpg");
  await cp(join(FIXTURES_DIR, GPS_MASTER_SOURCE), masterCopy);
  // GPS fixture: clean re-encode of real corpus pixels (sharp strips all
  // metadata by default), then splice the hand-built GPS EXIF APP1 on top.
  cleanBase = await sharp(masterCopy).extract({ left: 0, top: 0, width: 768, height: 512 }).jpeg({ quality: 90 }).toBuffer();
  gpsMaster = join(workDir, "gps-master.jpg");
  await writeFile(gpsMaster, spliceJpegExifApp1(cleanBase, buildGpsExifPayload()));
}, 120_000);

afterAll(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe("WP-21 fixture honesty (corpus copy; corpus itself never touched)", () => {
  test("the clean re-encode carries no metadata; the GPS fixture carries GPS the scanner SEES", async () => {
    const cleanScan = scanBuffer(cleanBase);
    expect(cleanScan.ok).toBe(true);
    const gpsScan = scanBuffer(await readFile(gpsMaster));
    expect(gpsScan.ok).toBe(false);
    expect(gpsScan.findings.some((f) => f.kind === "gps")).toBe(true);
    // And the frozen corpus file is untouched by all of this.
    expect(await sha256File(join(FIXTURES_DIR, GPS_MASTER_SOURCE))).toBe(
      createHash("sha256").update(await readFile(masterCopy)).digest("hex"),
    );
  });
});

describe("WP-21 (a) GPS fixture through the FULL pipeline → zero GPS in final bytes", () => {
  let derived: Awaited<ReturnType<typeof deriveSource>>;
  let finalize: Awaited<ReturnType<typeof finalizeAndVerify>>;

  beforeAll(async () => {
    derived = await deriveSource(
      { photoId: "gps_probe", source: gpsMaster },
      { outDir: join(workDir, "out-clean"), frozenRecord },
    );
    finalize = await finalizeAndVerify([derived], {
      masters: [{ photoId: "gps_probe", file: gpsMaster, sha256: await sha256File(gpsMaster) }],
    });
  }, 300_000);

  test("finalizeAndVerify passes with every derivative exhaustively scanned", () => {
    expect(finalize.ok).toBe(true);
    expect(finalize.findings).toHaveLength(0);
    expect(finalize.filesScanned).toBe(derived.derivatives.length);
    expect(finalize.sources[0]!.masterChecked).toBe(true);
    expect(finalize.sources[0]!.derivativeFiles).toBe(derived.derivatives.length);
  });

  test("EVERY final derivative file scans clean — zero GPS/EXIF/XMP/IPTC/ICC, not sampled", async () => {
    expect(derived.derivatives.length).toBeGreaterThanOrEqual(6);
    for (const d of derived.derivatives) {
      const scan = scanBuffer(await readFile(d.file));
      expect(scan.ok, `${d.purpose} ${d.format} w${d.width}`).toBe(true);
      expect(scan.findings.map((f) => f.kind)).toEqual([]);
      // Sharp-level cross-check on the same bytes (belt and braces; the
      // scanner is the authority).
      const meta = await sharp(d.file).metadata();
      expect(meta.exif).toBeUndefined();
      expect(meta.icc).toBeUndefined();
      expect(meta.orientation).toBeUndefined();
    }
  });
});

describe("WP-21 (b) deliberately-leaking regression probe is CAUGHT by the scanner", () => {
  test("a metadata-retention call on the encode path leaks GPS into final bytes — scanner fails it", async () => {
    // The probe: EXACTLY the pipeline chain, plus the one forbidden call a
    // regression would add. (Test-only — the static greps forbid this name in
    // scripts/media/*.ts; it exists here to prove the scanner catches it.)
    const bytes = await readFile(gpsMaster);
    const record = await extractSourceMetadata(bytes);
    const jpegLeak = await sharp(bytes)
      .rotate()
      .resize({ width: Math.min(800, record.displayWidth!), withoutEnlargement: true })
      .keepExif()
      .jpeg({ quality: 75, progressive: true })
      .toBuffer();
    const avifLeak = await sharp(bytes)
      .rotate()
      .resize({ width: Math.min(480, record.displayWidth!), withoutEnlargement: true })
      .keepExif()
      .avif({ quality: 55 })
      .toBuffer();

    for (const [label, leak] of [["jpeg", jpegLeak], ["avif", avifLeak]] as const) {
      const scan = scanBuffer(leak);
      expect(scan.ok, `${label} probe must fail`).toBe(false);
      expect(scan.findings.some((f) => f.kind === "gps"), `${label} probe GPS caught`).toBe(true);
      // And through the file API with the fail-closed throw.
      const leakPath = join(workDir, `leak.${label}`);
      await writeFile(leakPath, leak);
      await expect(verifyPrivacy([leakPath], { throwOnError: true })).rejects.toThrow(
        /11\.1:privacy-verification/,
      );
    }
  });
});

describe("WP-21 (c) ICC in final bytes is caught (D10)", () => {
  test("a spliced ICC APP2 on a final JPEG derivative fails the scanner", async () => {
    const clean = derivedJpegPath();
    const spiked = spliceJpegAppSegment(await readFile(clean), 0xe2, await buildIccApp2Payload());
    const scan = scanBuffer(spiked);
    expect(scan.ok).toBe(false);
    expect(scan.findings.some((f) => f.kind === "icc")).toBe(true);
    const spikedPath = join(workDir, "icc-spiked.jpg");
    await writeFile(spikedPath, spiked);
    await expect(verifyPrivacy([spikedPath], { throwOnError: true })).rejects.toThrow(
      PrivacyVerificationError,
    );
  });

  test("an ICC-embedding AVIF (withIccProfile probe path) fails the scanner", async () => {
    const iccAvif = await sharp(await readFile(derivedJpegPath()))
      .withIccProfile("/System/Library/ColorSync/Profiles/sRGB Profile.icc")
      .avif({ quality: 40 })
      .toBuffer();
    const scan = scanBuffer(iccAvif);
    expect(scan.ok).toBe(false);
    expect(scan.findings.some((f) => f.kind === "icc")).toBe(true);
  });
});

describe("WP-21 (d) master-untouched guard fails closed", () => {
  test("a master modified AFTER derivation fails finalizeAndVerify (7.3:master-untouched)", async () => {
    const derived = await deriveSource(
      { photoId: "master_guard", source: masterCopy },
      { outDir: join(workDir, "out-guard"), frozenRecord },
    );
    // Mutate the master COPY in place (a tmpdir file — never the corpus): a
    // mid-file byte inside entropy-coded data, still decodable by sharp so
    // the guard (not a decode error) is what fails the run.
    const bytes = await readFile(masterCopy);
    const flipAt = Math.floor(bytes.length * 0.75);
    bytes[flipAt] = bytes[flipAt]! ^ 0xff;
    await writeFile(masterCopy, bytes);
    await expect(
      finalizeAndVerify([derived], {
        masters: [{ photoId: "master_guard", file: masterCopy }],
      }),
    ).rejects.toThrow(/7\.3:master-untouched/);
  }, 300_000);

  test("a discovery-record SHA-256 that disagrees with the derive-time SHA fails closed", async () => {
    const derived = await deriveSource(
      { photoId: "record_guard", source: masterCopy },
      { outDir: join(workDir, "out-guard2"), frozenRecord },
    );
    const discoverySha = "0".repeat(64); // WP-17 record says one thing...
    await expect(
      finalizeAndVerify([derived], {
        masters: [{ photoId: "record_guard", file: masterCopy, sha256: discoverySha }],
      }),
    ).rejects.toThrow(/7\.3:master-untouched/);
    // A master ref MISSING for a derived source fails closed as well.
    await expect(
      finalizeAndVerify([derived], {
        masters: [{ photoId: "someone_else", file: masterCopy, sha256: await sha256File(masterCopy) }],
      }),
    ).rejects.toThrow(/7\.3:master-unresolved/);
  }, 300_000);
});

describe("WP-21 (e) exhaustive verification over the derived corpus", () => {
  test("a re-derived subset passes file-by-file (always runs)", async () => {
    // Restore the pristine master copy (the (d) test mutated it in place).
    await cp(join(FIXTURES_DIR, GPS_MASTER_SOURCE), masterCopy);
    const subset = await deriveSource(
      { photoId: "corpus_subset", source: masterCopy },
      { outDir: join(workDir, "out-subset"), frozenRecord },
    );
    const report = await verifyPrivacy(subset.derivatives.map((d) => d.file));
    expect(report.ok).toBe(true);
    expect(report.filesScanned).toBe(subset.derivatives.length);
    expect(report.findings).toHaveLength(0);
  }, 300_000);

  test("the published corpus (generated/media final files) scans clean — exhaustive", async () => {
    // Scans whatever the pipeline has produced under generated/media
    // (regenerable, gitignored; absent on a fresh clone → this test skips —
    // the re-derived subset above always runs instead). WP-23 state change:
    // the directory now holds the PUBLISHED content-addressed final files
    // (WP-22 renames consumed the WP-20 intermediates; WP-23's pruning keeps
    // the directory equal to the manifest closure), so the old ">2000
    // intermediates" assumption no longer holds — the contract under test is
    // unchanged: every present final derivative scans clean, and a present
    // corpus is never vacuously skipped.
    let files: string[];
    try {
      files = (await readdir(CORPUS_OUT_DIR)).filter((f) => /\.(avif|jpe?g)$/i.test(f)).sort();
    } catch {
      files = [];
    }
    if (files.length === 0) {
      console.warn("[wp21] generated/media absent — skipping full-corpus scan (subset test covers the contract)");
      return;
    }
    expect(files.length).toBeGreaterThan(0);
    const report = await verifyPrivacy(files.map((f) => join(CORPUS_OUT_DIR, f)));
    expect(report.ok).toBe(true);
    expect(report.filesScanned).toBe(files.length);
    expect(report.findings).toHaveLength(0);
  }, 600_000);
});

/** A clean final JPEG derivative from the (a) derivation for splicing tests. */
function derivedJpegPath(): string {
  const d = derivedForSplice;
  if (d === null) throw new Error("derivation not ready");
  return d;
}
/** A clean final AVIF derivative from the same derivation (IMP-01 probe). */
function derivedAvifPath(): string {
  const d = derivedForSpliceAvif;
  if (d === null) throw new Error("derivation not ready");
  return d;
}
let derivedForSplice: string | null = null;
let derivedForSpliceAvif: string | null = null;
beforeAll(async () => {
  // (c) reuses one real final JPEG derivative from the clean derivation.
  const derived = await deriveSource(
    { photoId: "icc_probe", source: gpsMaster },
    { outDir: join(workDir, "out-icc"), frozenRecord },
  );
  derivedForSplice = derived.derivatives.find((d) => d.format === "jpeg")!.file;
  derivedForSpliceAvif = derived.derivatives.find((d) => d.format === "avif")!.file;
}, 120_000);

// ---------------------------------------------------------------------------
// P3 targeted corrections (IMP-01) — the exact independent-review false
// negatives, reproduced over REAL final derivatives: a valid GPS EXIF APP1
// appended AFTER a final JPEG's EOI, and a top-level Adobe-XMP uuid box
// appended to a final AVIF. Both returned ok=true pre-fix (verified); both
// must FAIL now. Clean controls prove normal output still passes.
// ---------------------------------------------------------------------------
describe("P3 IMP-01 — adversarial final-byte probes over real derivatives", () => {
  test("GPS EXIF APP1 appended after a real final JPEG's EOI fails the scan", async () => {
    const jpeg = await readFile(derivedJpegPath());
    // buildGpsExifPayload() IS the complete APP1 payload (Exif\0\0 + valid
    // GPS TIFF) — R-03: no second Exif prefix (it broke TIFF classification).
    const app1 = Buffer.concat([
      Buffer.from([0xff, 0xe1]),
      (() => {
        const len = Buffer.alloc(2);
        len.writeUInt16BE(buildGpsExifPayload().length + 2);
        return len;
      })(),
      buildGpsExifPayload(),
    ]);
    const clean = scanBuffer(jpeg);
    expect(clean.ok).toBe(true); // benign control: normal Sharp output passes
    const attacked = scanBuffer(Buffer.concat([jpeg, app1]));
    expect(attacked.ok).toBe(false);
    const kinds = attacked.findings.map((f) => f.kind);
    expect(kinds).toContain("exif");
    expect(kinds).toContain("gps");
    expect(attacked.findings.some((f) => f.detail.includes("after EOI"))).toBe(true);
  });

  test("a top-level Adobe-XMP uuid box (GPS + serial XMP) appended to a real final AVIF fails the scan", async () => {
    const avif = await readFile(derivedAvifPath());
    const clean = scanBuffer(avif);
    expect(clean.ok).toBe(true); // benign control: normal Sharp output passes
    const xmp = XMP_WITH_GPS + "<tiff:SerialNumber>SN-ADVERSARIAL-123</tiff:SerialNumber>";
    const payload = Buffer.concat([
      Buffer.from("be7acfcb97a942e89c71999491e3afac", "hex"),
      Buffer.from(xmp, "utf8"),
    ]);
    const size = Buffer.alloc(4);
    size.writeUInt32BE(payload.length + 8);
    const uuidBox = Buffer.concat([size, Buffer.from("uuid", "binary"), payload]);
    const attacked = scanBuffer(Buffer.concat([avif, uuidBox]));
    expect(attacked.ok).toBe(false);
    const kinds = attacked.findings.map((f) => f.kind);
    expect(kinds).toContain("xmp");
    expect(kinds).toContain("gps");
    expect(kinds).toContain("serial");
  });
});
