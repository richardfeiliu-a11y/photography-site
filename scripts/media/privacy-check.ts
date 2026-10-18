// WP-21 — final metadata scanner + pipeline stages 6–7 verification layer
// (IMAGE_PIPELINE.md §5 stages 6–7 + stage ordering invariants, §7 privacy
// contract, §11.1 fail-closed; ADR-012 default full strip; ICC-POLICY.md D10;
// BUILD_AND_ROUTING.md §8 check 6 context).
//
// Authority, consumed (not re-derived):
//   - IMAGE_PIPELINE §7.2: public derivatives carry NO EXIF by default; the
//     pipeline never calls the metadata-retention APIs (keepExif / keepMetadata
//     / withExif) and never retains the source profile (keepIccProfile /
//     withIccProfile — both forbidden on the derivative path per
//     ICC-POLICY.md §4 forbidden_on_derivative_path). This module therefore
//     NEVER calls any sharp output-modifying API — it contains NO sharp import
//     at all. It reads raw bytes only.
//   - ICC-POLICY.md D10 (CLOSED): output ICC embedding = NO. Stage 7
//     (embed-output-icc) is a VERIFIED NO-OP: there is nothing to embed, so
//     WP-21's stage-7 work is verification that final bytes carry NO ICC
//     profile (a finding if any is present).
//   - IMAGE_PIPELINE §11.1: a privacy-verification failure is BUILD-BLOCKING.
//     Every finding carries the rule-precise token 11.1:privacy-verification;
//     master-checksum violations carry 7.3:master-untouched / 7.3:master-
//     unresolved (§7.3 source masters remain untouched).
//   - ADR-012: strip ALL EXIF/XMP/IPTC by default; verify no GPS/serial/
//     private fields remain. So ANY EXIF/XMP/IPTC/ICC presence — not just the
//     §7.1 shortlist — is a finding; GPS and serial/private tags additionally
//     get their own finding kinds so reports name the severity precisely.
//
// Stage-order wiring: WP-20's derive outputs (stages 1–5, scripts/media/
// derive.ts) are the INPUT to this module. Stripping happens by encoder
// default during stage 5 (no retention call exists anywhere in scripts/media/
// *.ts — pinned by the unit test's comment-stripped greps); stages 6–7 are
// this VERIFICATION layer over the FINAL bytes. FINALIZE_STAGE_PLAN composes
// DERIVE_STAGE_PLAN + "strip-metadata", validated through the WP-18 guard
// (scripts/media/stage-order.ts) BEFORE any scanning. embed-output-icc is
// deliberately ABSENT (D10: nothing to embed) and hash-output is deliberately
// ABSENT (WP-22 owns it — no digest is computed here).
//
// Scanner design (exhaustive, not sampled — brief requirement):
//   JPEG: full APP-segment walk from SOI to SOS. APP1 "Exif\0\0" → TIFF IFD
//         walk (IFD0 chain + Exif IFD 0x8769 + GPS IFD 0x8825 + Interop IFD
//         0xA005) enumerating entries; GPS IFD with ≥1 entry → gps; serial/
//         private tags (BodySerialNumber 0xA431, LensSerialNumber 0xA435,
//         ImageUniqueID 0xA420, CameraOwnerName 0xA430, MakerNote 0x927C) →
//         serial; any EXIF → exif (full strip). APP1 XMP → xmp (+ gps when
//         GPS properties appear in the packet). APP13 → iptc. APP2
//         "ICC_PROFILE\0" → icc. COM → comment. Any other APPn → segment.
//   AVIF/HEIF (ISOBMFF): top-level box walk; meta box → iinf/infe item table
//         (item types), iloc extents (+ idat construction), iprp/ipco/colr
//         colour boxes. Exif items → TIFF walk (4-byte tiff-header offset
//         prefix per the HEIF/Exif-item spec, then "II*"/"MM*" magic);
//         mime items (XMP content type) → xmp scan; iptc/unknown metadata
//         item types → iptc/metadata-item. colr 'prof'/'rICC' → icc ('nclx'
//         is format-level colour SIGNALING, not an embedded profile — not a
//         finding). Pixel items (av01, grid, iovl) are ignored.
//   Fail-closed: malformed TIFF/box structures → malformed; any file whose
//         bytes are neither a JPEG stream nor a picture-handled ISOBMFF
//         container → unscannable-format. A file the scanner cannot fully
//         parse NEVER passes.
//
// Honest coverage limits (see docs/implementation/WP-21.md matrix): the TIFF
// walk enumerates IFD entries (tags/counts) — it does not interpret values
// beyond presence; MakerNote payloads are flagged as private (not parsed
// maker-specifically); IPTC fields inside APP13/iptc items are flagged as a
// class, not field-enumerated; XMP is pattern-scanned (GPS/serial predicates)
// rather than RDF-parsed. All limits are fail-closed directions: an
// unparseable region is a finding, never a silent pass.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { DERIVE_STAGE_PLAN } from "./derive";
import type { DeriveSourceResult } from "./derive";
import { validateStagePlan, type PipelineStage } from "./stage-order";

// ---------------------------------------------------------------------------
// Public API — findings, reports, errors
// ---------------------------------------------------------------------------

/** The umbrella build-blocking token (IMAGE_PIPELINE §11.1). */
export const PRIVACY_RULE = "11.1:privacy-verification";
/** §7.3 master-untouched tokens. */
export const MASTER_MODIFIED_RULE = "7.3:master-untouched";
export const MASTER_UNRESOLVED_RULE = "7.3:master-unresolved";

/** Classes of privacy/metadata findings (kind-precise reporting). */
export type PrivacyFindingKind =
  | "gps"
  | "serial"
  | "icc"
  | "exif"
  | "xmp"
  | "iptc"
  | "comment"
  | "segment"
  | "metadata-item"
  | "malformed"
  | "unscannable-format";

/** One violation found in a final derivative (or probe) — fail-closed. */
export interface PrivacyFinding {
  kind: PrivacyFindingKind;
  /** Rule-precise token; always the §11.1 build-blocking token for scans. */
  rule: string;
  /** Human explanation naming the segment/box/tag that produced the finding. */
  detail: string;
}

/** The exhaustive scan result for one buffer. */
export interface PrivacyScanResult {
  /** Container class the scanner dispatched on ("jpeg" | "isobmff"). */
  format: string;
  /** Every violation found (empty only when ok). */
  findings: PrivacyFinding[];
  /** Honesty metric: APP/COM segments (JPEG) or boxes/items (ISOBMFF) walked. */
  segmentsExamined: number;
  ok: boolean;
}

/** Structured report over a set of final derivative files. */
export interface PrivacyReport {
  /** Per-file scans, in input order. */
  files: Array<{ file: string; scan: PrivacyScanResult }>;
  /** Total files scanned (== files.length; mirrored for callers). */
  filesScanned: number;
  /** Every finding across all files, in scan order. */
  findings: PrivacyFinding[];
  ok: boolean;
}

/** Master reference for the §7.3 untouched guard (WP-17 record joinable). */
export interface MasterRef {
  /** Photo ID of the derived source (joins DeriveSourceResult.photoId). */
  photoId: string;
  /** Path to the WEB INGEST MASTER (read-only; never modified). */
  file: string;
  /**
   * Expected SHA-256 (e.g. from the WP-17 discovery record). When present it
   * is checked BOTH against the derive-time sourceSha256 and the live bytes —
   * a before/after checksum across the pipeline run.
   */
  sha256?: string;
}

/** Per-source verification result inside a FinalizeReport. */
export interface FinalizeSourceReport {
  photoId: string;
  /** True when a MasterRef was supplied and the checksum guard ran. */
  masterChecked: boolean;
  /** Derivative files scanned for this source. */
  derivativeFiles: number;
  findings: PrivacyFinding[];
}

/** The full stages-6–7 verification report over WP-20 derive results. */
export interface FinalizeReport {
  /** The validated finalize stage plan (stages 1–6; see FINALIZE_STAGE_PLAN). */
  stagePlan: PipelineStage[];
  sources: FinalizeSourceReport[];
  /** Total derivative files exhaustively scanned. */
  filesScanned: number;
  /** Total derivative bytes scanned. */
  bytesScanned: number;
  /** §7.3 master-guard issues (empty when the guard is green). */
  masterIssues: Array<{ photoId: string; rule: string; message: string }>;
  findings: PrivacyFinding[];
  ok: boolean;
}

/** Fail-closed verification failure (IMAGE_PIPELINE §11.1 semantics). */
export class PrivacyVerificationError extends Error {
  /** All rule tokens that fired, e.g. ["11.1:privacy-verification"]. */
  readonly rules: string[];
  /** The structured report (PrivacyReport or FinalizeReport) when available. */
  readonly report: PrivacyReport | FinalizeReport | null;

  constructor(
    message: string,
    rules: readonly string[],
    report: PrivacyReport | FinalizeReport | null = null,
  ) {
    super(message);
    this.name = "PrivacyVerificationError";
    this.rules = [...rules];
    this.report = report;
  }
}

// ---------------------------------------------------------------------------
// Stage plan (stages 6–7 wiring)
// ---------------------------------------------------------------------------

/**
 * The WP-21 finalize plan: the stage-1–5 derive plan (imported so the plans
 * cannot drift) + stage-6 strip-metadata. Stage-7 embed-output-icc is
 * deliberately ABSENT: ICC-POLICY.md D10 decided NO embedding — there is
 * nothing to embed, so WP-21's stage-7 work is the no-ICC VERIFICATION below.
 * hash-output is deliberately ABSENT: WP-22 owns it and must hash the FINAL
 * served bytes AFTER this verification (no digest is computed here).
 */
export const FINALIZE_STAGE_PLAN: PipelineStage[] = [...DERIVE_STAGE_PLAN, "strip-metadata"];

/**
 * Validate a finalize stage plan through the WP-18 guard. Defaults to the
 * production plan; a deliberately mis-ordered plan (strip before resize,
 * hash before verification, …) fails closed with the guard's rule-precise
 * tokens (e.g. "5:stage-order") BEFORE any I/O.
 */
export function validateFinalizeStagePlan(
  plan: readonly unknown[] = FINALIZE_STAGE_PLAN,
): PipelineStage[] {
  const result = validateStagePlan(plan);
  if (!result.ok) {
    throw new PrivacyVerificationError(
      `finalize stage plan rejected by validateStagePlan: ${result.issues
        .map((issue) => `${issue.rule} — ${issue.message}`)
        .join(" | ")}`,
      result.issues.map((issue) => issue.rule),
    );
  }
  return result.plan;
}

// ---------------------------------------------------------------------------
// TIFF walking (shared by JPEG Exif APP1 and AVIF Exif items)
// ---------------------------------------------------------------------------

const TIFF_TYPE_SIZES: Record<number, number> = {
  1: 1, // BYTE
  2: 1, // ASCII
  3: 2, // SHORT
  4: 4, // LONG
  5: 8, // RATIONAL
  6: 1, // SBYTE
  7: 1, // UNDEFINED
  8: 2, // SSHORT
  9: 4, // SLONG
  10: 8, // SRATIONAL
  11: 4, // FLOAT
  12: 8, // DOUBLE
};

/** Serial/private-class EXIF tags (IMAGE_PIPELINE §7.1 + ADR-012 naming). */
const SERIAL_TAGS: ReadonlyMap<number, string> = new Map([
  [0xa431, "BodySerialNumber"],
  [0xa435, "LensSerialNumber"],
  [0xa420, "ImageUniqueID"],
  [0xa430, "CameraOwnerName"],
  [0x927c, "MakerNote"],
]);

const TAG_EXIF_IFD_POINTER = 0x8769;
const TAG_GPS_IFD_POINTER = 0x8825;
const TAG_INTEROP_IFD_POINTER = 0xa005;

/** Upper bounds so corrupt/malicious metadata can never loop the scanner. */
const MAX_IFDS = 16;
const MAX_IFD_ENTRIES = 512;

interface TiffWalkResult {
  gpsEntries: number;
  serialTags: string[];
  ifdCount: number;
  entryCount: number;
}

/**
 * Walk a TIFF blob starting at `start`: the IFD0 chain plus Exif/GPS/Interop
 * sub-IFDs, counting entries (presence, not interpretation). Returns null on
 * any malformed structure — the caller turns null into a fail-closed
 * "malformed" finding (never a silent pass).
 */
function walkTiff(bytes: Buffer, start: number): TiffWalkResult | null {
  if (start + 8 > bytes.length) return null;
  const endian = bytes.subarray(start, start + 2).toString("binary");
  const le = endian === "II";
  const be = endian === "MM";
  if (!le && !be) return null;
  const u16 = (off: number) => (le ? bytes.readUInt16LE(off) : bytes.readUInt16BE(off));
  const u32 = (off: number) => (le ? bytes.readUInt32LE(off) : bytes.readUInt32BE(off));
  if (u16(start + 2) !== 42) return null;

  const result: TiffWalkResult = { gpsEntries: 0, serialTags: [], ifdCount: 0, entryCount: 0 };
  const subIfdOffsets: Array<{ offset: number; kind: "exif" | "gps" | "interop" }> = [];
  const visitedIfd = new Set<number>();
  let queue: number[] = [u32(start + 4)];

  let ifds = 0;
  while (queue.length > 0) {
    const ifdOffset = queue.shift()!;
    if (ifdOffset === 0 || visitedIfd.has(ifdOffset)) continue;
    visitedIfd.add(ifdOffset);
    if (ifds++ >= MAX_IFDS) return null;
    if (start + ifdOffset + 2 > bytes.length) return null;
    const entryCount = u16(start + ifdOffset);
    if (entryCount > MAX_IFD_ENTRIES) return null;
    const entriesStart = start + ifdOffset + 2;
    // +4: the 4-byte next-IFD offset is read after the entries — without it a
    // truncated IFD (count 0, nothing behind) makes u32() read past EOF.
    if (entriesStart + entryCount * 12 + 4 > bytes.length) return null;
    result.ifdCount += 1;
    result.entryCount += entryCount;

    for (let e = 0; e < entryCount; e++) {
      const entryOff = entriesStart + e * 12;
      const tag = u16(entryOff);
      const type = u16(entryOff + 2);
      const count = u32(entryOff + 4);
      const typeSize = TIFF_TYPE_SIZES[type];
      if (typeSize === undefined) return null; // unknown type → malformed
      const valueBytes = typeSize * count;
      if (valueBytes < 0 || count < 0) return null;

      if (tag === TAG_GPS_IFD_POINTER) {
        if (type !== 4 || count !== 1) return null;
        subIfdOffsets.push({ offset: u32(entryOff + 8), kind: "gps" });
      } else if (tag === TAG_EXIF_IFD_POINTER) {
        if (type !== 4 || count !== 1) return null;
        subIfdOffsets.push({ offset: u32(entryOff + 8), kind: "exif" });
      } else if (tag === TAG_INTEROP_IFD_POINTER) {
        if (type !== 4 || count !== 1) return null;
        subIfdOffsets.push({ offset: u32(entryOff + 8), kind: "interop" });
      } else if (SERIAL_TAGS.has(tag)) {
        result.serialTags.push(SERIAL_TAGS.get(tag)!);
      }
    }
    const nextIfd = u32(entriesStart + entryCount * 12);
    if (nextIfd !== 0) queue.push(nextIfd);
  }

  // Walk the collected sub-IFDs (same bounded loop semantics).
  let subIfds = 0;
  const visitedSub = new Set<number>();
  while (subIfdOffsets.length > 0) {
    const { offset } = subIfdOffsets.shift()!;
    if (offset === 0 || visitedSub.has(offset)) continue;
    visitedSub.add(offset);
    if (subIfds++ >= MAX_IFDS) return null;
    if (start + offset + 2 > bytes.length) return null;
    const entryCount = u16(start + offset);
    if (entryCount > MAX_IFD_ENTRIES) return null;
    const entriesStart = start + offset + 2;
    // +4: same next-IFD-read bound as the main loop above.
    if (entriesStart + entryCount * 12 + 4 > bytes.length) return null;
    result.ifdCount += 1;
    result.entryCount += entryCount;
    for (let e = 0; e < entryCount; e++) {
      const tag = u16(entriesStart + e * 12);
      const type = u16(entriesStart + e * 12 + 2);
      if (TIFF_TYPE_SIZES[type] === undefined) return null;
      if (tag === TAG_GPS_IFD_POINTER || tag === TAG_EXIF_IFD_POINTER) {
        if (type !== 4) return null;
        subIfdOffsets.push({ offset: u32(entriesStart + e * 12 + 8), kind: "gps" });
      }
      if (SERIAL_TAGS.has(tag)) result.serialTags.push(SERIAL_TAGS.get(tag)!);
    }
  }

  return result;
}

/** Convenience: locate the TIFF start inside an "Exif\0\0"-prefixed payload. */
function tiffOffsetInExifPayload(payload: Buffer, payloadStart: number): number | null {
  if (payloadStart + 6 > payload.length) return null;
  if (payload.subarray(payloadStart, payloadStart + 6).toString("binary") !== "Exif\0\0") return null;
  return payloadStart + 6;
}

/**
 * Belt-and-braces wrappers: walkTiff/countGpsIfdEntries are bounds-checked,
 * but a malformed blob must NEVER be able to escape a raw RangeError through
 * verifyPrivacy/finalizeAndVerify — any crash is downgraded to a `malformed`
 * finding (fail closed) at every call site.
 */
function safeWalkTiff(
  bytes: Buffer,
  start: number,
  what: string,
  onMalformed: (detail: string) => unknown,
): TiffWalkResult | null {
  try {
    return walkTiff(bytes, start);
  } catch {
    onMalformed(`${what}: TIFF walk hit an out-of-bounds read on malformed metadata — treated as malformed (fail closed)`);
    return null;
  }
}

function safeGpsCount(
  bytes: Buffer,
  start: number,
  what: string,
  onMalformed: (detail: string) => unknown,
): number | null {
  try {
    return countGpsIfdEntries(bytes, start);
  } catch {
    onMalformed(`${what}: GPS IFD walk hit an out-of-bounds read on malformed metadata — treated as malformed (fail closed)`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// JPEG segment walker
// ---------------------------------------------------------------------------

const XMP_APP1_MARKER = "http://ns.adobe.com/xap/1.0/\0";
const XMP_EXT_APP1_MARKER = "http://ns.adobe.com/xmp/extension/\0";
const ICC_APP2_MARKER = "ICC_PROFILE\0";
const EXIF_APP1_MARKER = "Exif\0\0";

function isXmpGpsPacket(xmp: string): boolean {
  return /exif:GPS(Latitude|Longitude|Altitude|VersionID|ImgDirection|DateStamp|TimeStamp)|GPano:/i.test(xmp);
}

function isXmpSerialPacket(xmp: string): boolean {
  return /exif:BodySerialNumber|exif:LensSerialNumber|exif:ImageUniqueID|tiff:SerialNumber|aux:(SerialNumber|InternalSerialNumber|ImageUniqueID)/i.test(xmp);
}

/**
 * Walk a JPEG stream exhaustively: every APPn/COM segment between SOI and SOS
 * is classified, AND the entropy-coded stream after SOS is walked (accounting
 * for FF00 byte stuffing, RSTn restart markers and fill bytes) so a segment
 * hidden AFTER the scan data — e.g. an APP1 GPS blob spliced in before EOI —
 * can never pass silently. Any foreign FFxx marker after SOS is flagged
 * (segment) or, when it carries a recognizable metadata payload, classified
 * exactly like its pre-SOS sibling.
 */
function scanJpeg(bytes: Buffer): PrivacyScanResult {
  const findings: PrivacyFinding[] = [];
  const push = (kind: PrivacyFindingKind, detail: string) =>
    findings.push({ kind, rule: PRIVACY_RULE, detail });
  let segments = 0;
  let offset = 2; // after SOI (FFD8 verified by dispatch)
  let entropyStart: number | null = null;
  /** Offset just past the EOI marker when one is found; null until then. */
  let eoiEnd: number | null = null;
  /** Payload start of every Exif APP1 seen (pre- AND post-SOS) for GPS attribution. */
  const exifApp1PayloadOffsets: number[] = [];

  /** Shared classification for one APPn/COM payload (used pre- and post-SOS). */
  const classifySegment = (marker: number, payload: Buffer, payloadStart: number): void => {
    if (marker === 0xe0) {
      // APP0: JFIF/JFXX. JFIF is the standard container header — not private.
      const id = payload.subarray(0, 5).toString("binary");
      if (id !== "JFIF\0") push("segment", `APP0 "${id.replace(/\0/g, "\\0")}" (non-JFIF APP0)`);
    } else if (marker === 0xe1) {
      if (payload.subarray(0, 6).toString("binary") === EXIF_APP1_MARKER) {
        const tiffStart = tiffOffsetInExifPayload(bytes, payloadStart);
        if (tiffStart === null) {
          push("malformed", "EXIF APP1 payload does not start with the Exif\\0\\0 header");
        } else {
          push("exif", `EXIF APP1 present (${payload.length - 6} B TIFF) — ADR-012 default full strip`);
          exifApp1PayloadOffsets.push(tiffStart);
          const walk = safeWalkTiff(bytes, tiffStart, "EXIF APP1", (detail) => push("malformed", detail));
          if (walk === null) {
            push("malformed", "EXIF APP1 TIFF structure could not be walked (malformed IFD chain)");
          } else if (walk.serialTags.length > 0) {
            push("serial", `serial/private EXIF tags present: ${[...new Set(walk.serialTags)].join(", ")}`);
          }
        }
      } else if (
        payload.subarray(0, XMP_APP1_MARKER.length).toString("binary") === XMP_APP1_MARKER ||
        payload.subarray(0, XMP_EXT_APP1_MARKER.length).toString("binary") === XMP_EXT_APP1_MARKER
      ) {
        const xmp = payload.subarray(payload.indexOf(0, 29) + 1).toString("utf8");
        push("xmp", `XMP APP1 present (${payload.length} B) — ADR-012 default full strip`);
        if (isXmpGpsPacket(xmp)) push("gps", "XMP packet carries GPS properties (exif:GPS*/GPano)");
        if (isXmpSerialPacket(xmp)) push("serial", "XMP packet carries serial/unique-id properties");
      } else {
        push("segment", `APP1 with unknown payload identifier "${payload.subarray(0, 29).toString("binary").replace(/\0/g, "\\0")}"`);
      }
    } else if (marker === 0xe2 && payload.subarray(0, ICC_APP2_MARKER.length).toString("binary") === ICC_APP2_MARKER) {
      // "ICC_PROFILE\0" (12) + seq(1) + count(1) + profile bytes.
      const profileBytes = payload.length - 14;
      push("icc", `ICC profile present in APP2 ("ICC_PROFILE", ~${profileBytes} B in segment) — D10 forbids output ICC`);
    } else if (marker === 0xed) {
      const id = payload.subarray(0, 14).toString("binary").replace(/\0/g, "\\0");
      push("iptc", `APP13 present ("${id}") — IPTC metadata class (ADR-012 full strip)`);
    } else if (marker === 0xfe) {
      push("comment", `COM comment segment present (${payload.length} B)`);
    } else if (marker >= 0xe0 && marker <= 0xef) {
      const id = payload.subarray(0, Math.min(12, payload.length)).toString("binary").replace(/\0/g, "\\0");
      push("segment", `APP${marker - 0xe0} with unrecognized payload ("${id}") — fail-closed classification`);
    }
  };

  // --- Header walk: SOI → SOS ---
  walk: for (;;) {
    if (offset + 2 > bytes.length) {
      push("malformed", "JPEG segment walk reached EOF before SOS — truncated stream");
      break;
    }
    if (bytes[offset] !== 0xff) {
      push("malformed", `JPEG marker walk desynced at offset ${offset} (expected 0xFF)`);
      break;
    }
    const marker = bytes[offset + 1]!;
    if (marker === 0xff) {
      offset += 1; // fill byte
      continue;
    }
    if (marker === 0xd9) {
      eoiEnd = offset + 2;
      break walk; // EOI before SOS — nothing entropy-coded follows
    }
    if (marker === 0xda) {
      // SOS: the entropy-coded data starts after its (header) length field.
      if (offset + 4 > bytes.length) {
        push("malformed", `JPEG SOS at offset ${offset} truncated before length`);
        break walk;
      }
      const sosLength = bytes.readUInt16BE(offset + 2);
      if (sosLength < 2 || offset + 2 + sosLength > bytes.length) {
        push("malformed", `JPEG SOS at offset ${offset} has an invalid length ${sosLength}`);
        break walk;
      }
      entropyStart = offset + 2 + sosLength;
      break walk;
    }
    segments += 1;
    const standalone =
      marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7); // TEM / RSTn
    if (standalone) {
      offset += 2;
      continue;
    }
    if (offset + 4 > bytes.length) {
      push("malformed", `JPEG segment at offset ${offset} truncated before length`);
      break;
    }
    const length = bytes.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > bytes.length) {
      push("malformed", `JPEG segment 0x${marker.toString(16)} at offset ${offset} has an invalid length ${length}`);
      break;
    }
    classifySegment(marker, bytes.subarray(offset + 4, offset + 2 + length), offset + 4);
    offset += 2 + length;
  }

  // --- Entropy walk: SOS → EOI (FF00 stuffing, RSTn, fill bytes accounted) ---
  if (entropyStart !== null) {
    let i = entropyStart;
    scan: for (;;) {
      if (i >= bytes.length) {
        push("malformed", "JPEG entropy stream ends without EOI — truncated final bytes");
        break;
      }
      if (bytes[i] !== 0xff) {
        i += 1;
        continue;
      }
      if (i + 1 >= bytes.length) {
        push("malformed", "JPEG entropy stream ends with a lone 0xFF — truncated final bytes");
        break;
      }
      const next = bytes[i + 1]!;
      if (next === 0x00) {
        i += 2; // byte stuffing
        continue;
      }
      if (next === 0xff) {
        i += 1; // fill byte
        continue;
      }
      if (next >= 0xd0 && next <= 0xd7) {
        i += 2; // RSTn restart marker
        continue;
      }
      if (next === 0xd9) {
        eoiEnd = i + 2;
        break scan; // EOI — clean end
      }

      // Encoder-legal STRUCTURAL markers between scans of progressive /
      // multi-scan JPEGs: DHT (0xC4), DQT (0xDB), DNL (0xDC) and subsequent
      // SOS (0xDA). Measured on the frozen toolchain's q75 progressive
      // output: a derivative carries 8 DHT + 8 SOS after the first SOS.
      // They carry no privacy content; skip their length-bearing headers
      // and continue the entropy scan. APPn/COM and ANY other marker are
      // still flagged below — nothing metadata-bearing passes silently.
      if (next === 0xc4 || next === 0xdb || next === 0xdc || next === 0xda) {
        if (i + 4 <= bytes.length) {
          const headerLength = bytes.readUInt16BE(i + 2);
          if (headerLength >= 2 && i + 2 + headerLength <= bytes.length) {
            segments += 1;
            i = i + 2 + headerLength;
            continue;
          }
        }
        push("malformed", `JPEG structural marker 0xFF${next.toString(16)} after SOS (offset ${i}) has an invalid length`);
        break scan;
      }

      // Any other FFxx marker after SOS: a segment the encoder hid in (or
      // appended after) the entropy stream. Recognizable APPn/COM payloads
      // are classified exactly like their pre-SOS siblings; everything else
      // is flagged as a post-entropy segment. Nothing passes silently.
      const mOffset = i;
      if ((next >= 0xe0 && next <= 0xef) || next === 0xfe) {
        if (mOffset + 4 <= bytes.length) {
          const length = bytes.readUInt16BE(mOffset + 2);
          if (length >= 2 && mOffset + 2 + length <= bytes.length) {
            segments += 1;
            classifySegment(
              next,
              bytes.subarray(mOffset + 4, mOffset + 2 + length),
              mOffset + 4,
            );
            i = mOffset + 2 + length;
            continue;
          }
        }
        push("malformed", `JPEG segment 0xFF${next.toString(16)} after SOS (offset ${mOffset}) has an invalid length`);
        break scan;
      }
      push(
        "segment",
        `marker 0xFF${next.toString(16)} found after SOS (offset ${mOffset}) — post-entropy segment, fail-closed classification`,
      );
      i += 2;
    }
  }

  // --- EOI must terminate the accepted byte stream (IMP-01) ---
  // Anything after EOI is not part of the image the encoder produced: a
  // structurally valid metadata segment appended there used to be silently
  // ignored (verified false negative). If a recognizable APPn/COM sits at
  // the trailing offset it is ALSO classified like any other segment, so
  // the finding names the actual private payload; either way the scan
  // fails closed.
  if (eoiEnd !== null && eoiEnd < bytes.length) {
    const trailing = bytes.length - eoiEnd;
    const tMarker = eoiEnd + 1 < bytes.length ? bytes[eoiEnd + 1]! : -1;
    if (
      eoiEnd + 4 <= bytes.length &&
      ((tMarker >= 0xe0 && tMarker <= 0xef) || tMarker === 0xfe)
    ) {
      const length = bytes.readUInt16BE(eoiEnd + 2);
      if (length >= 2 && eoiEnd + 2 + length <= bytes.length) {
        segments += 1;
        classifySegment(
          tMarker,
          bytes.subarray(eoiEnd + 4, eoiEnd + 2 + length),
          eoiEnd + 4,
        );
      }
    }
    push(
      "malformed",
      `JPEG has ${trailing} byte${trailing === 1 ? "" : "s"} after EOI (offset ${eoiEnd}) — bytes after end-of-image are outside the accepted stream (fail closed)`,
    );
  }

  // --- GPS attribution over EVERY Exif APP1 seen (pre- and post-SOS) ---
  for (const tiffStart of exifApp1PayloadOffsets) {
    const gps = safeGpsCount(bytes, tiffStart, "EXIF APP1", (detail) => push("malformed", detail));
    if (gps === null || gps === 0) continue; // malformed already flagged by the walk
    push("gps", `GPS IFD present in EXIF APP1 with ${gps} entr${gps === 1 ? "y" : "ies"}`);
  }

  return {
    format: "jpeg",
    findings,
    segmentsExamined: segments,
    ok: findings.length === 0,
  };
}

/**
 * Walk a TIFF blob counting ONLY entries inside GPS IFDs (those reached via
 * 0x8825 pointers, directly or through Exif/Interop IFDs). Bounded like
 * walkTiff; null on malformed structure.
 */
function countGpsIfdEntries(bytes: Buffer, tiffStart: number): number | null {
  const walk = walkTiffDetailed(bytes, tiffStart);
  return walk;
}

function walkTiffDetailed(bytes: Buffer, start: number): number | null {
  if (start + 8 > bytes.length) return null;
  const endian = bytes.subarray(start, start + 2).toString("binary");
  const le = endian === "II";
  const be = endian === "MM";
  if (!le && !be) return null;
  const u16 = (off: number) => (le ? bytes.readUInt16LE(off) : bytes.readUInt16BE(off));
  const u32 = (off: number) => (le ? bytes.readUInt32LE(off) : bytes.readUInt32BE(off));
  if (u16(start + 2) !== 42) return null;

  let gpsEntries = 0;
  const visited = new Set<number>();
  // Queue entries carry the IFD kind chain: reached-via-gps or not.
  const queue: Array<{ offset: number; viaGps: boolean }> = [{ offset: u32(start + 4), viaGps: false }];
  let iterations = 0;

  while (queue.length > 0) {
    if (iterations++ > MAX_IFDS * 4) return null;
    const { offset: ifdOffset, viaGps } = queue.shift()!;
    if (ifdOffset === 0 || visited.has(ifdOffset)) continue;
    visited.add(ifdOffset);
    if (start + ifdOffset + 2 > bytes.length) return null;
    const entryCount = u16(start + ifdOffset);
    if (entryCount > MAX_IFD_ENTRIES) return null;
    const entriesStart = start + ifdOffset + 2;
    if (entriesStart + entryCount * 12 + 4 > bytes.length) return null;
    if (viaGps) gpsEntries += entryCount;
    for (let e = 0; e < entryCount; e++) {
      const entryOff = entriesStart + e * 12;
      const tag = u16(entryOff);
      const type = u16(entryOff + 2);
      if (TIFF_TYPE_SIZES[type] === undefined) return null;
      if (tag === TAG_GPS_IFD_POINTER || tag === TAG_EXIF_IFD_POINTER || tag === TAG_INTEROP_IFD_POINTER) {
        if (type !== 4) return null;
        const target = u32(entryOff + 8);
        queue.push({ offset: target, viaGps: viaGps || tag === TAG_GPS_IFD_POINTER });
      }
    }
    const nextIfd = u32(entriesStart + entryCount * 12);
    if (nextIfd !== 0) queue.push({ offset: nextIfd, viaGps });
  }
  return gpsEntries;
}

// ---------------------------------------------------------------------------
// ISOBMFF (AVIF/HEIF) box walker
// ---------------------------------------------------------------------------

/** Pixel-data item types that are NOT metadata carriers (ignored). */
const PIXEL_ITEM_TYPES = new Set(["av01", "grid", "iovl"]);
const XMP_MIME_TYPES = new Set(["application/rdf+xml", "application/xmp"]);

interface BoxInfo {
  type: string;
  contentStart: number;
  contentEnd: number;
}

/** Parse the box header at `offset`; null when malformed/out of bounds. */
function parseBox(bytes: Buffer, offset: number): BoxInfo | null {
  if (offset + 8 > bytes.length) return null;
  let size = bytes.readUInt32BE(offset);
  const type = bytes.subarray(offset + 4, offset + 8).toString("binary");
  let headerSize = 8;
  if (size === 1) {
    if (offset + 16 > bytes.length) return null;
    const big = bytes.readBigUInt64BE(offset + 8);
    if (big > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    size = Number(big);
    headerSize = 16;
  } else if (size === 0) {
    size = bytes.length - offset; // to EOF
  }
  if (size < headerSize || offset + size > bytes.length) return null;
  return { type, contentStart: offset + headerSize, contentEnd: offset + size };
}

/** Result of a container-children walk: boxes found + whether it stopped early. */
interface ChildBoxesResult {
  boxes: BoxInfo[];
  /** True when an unreadable/malformed child stopped the walk before `end`. */
  incomplete: boolean;
  /** Where the walk stopped (only meaningful when incomplete). */
  stopOffset: number;
}

/**
 * Children of a container box (optionally skipping a version/flags full-box
 * header). A malformed child STOPS the walk — the caller MUST surface the
 * incompleteness (a silent stop here would be a false negative: boxes after
 * the unreadable sibling would never be examined).
 */
function childBoxes(bytes: Buffer, start: number, end: number, fullBox: boolean): ChildBoxesResult {
  const children: BoxInfo[] = [];
  let cursor = fullBox ? start + 4 : start;
  while (cursor < end) {
    const box = parseBox(bytes, cursor);
    if (box === null || box.contentEnd > end) {
      return { boxes: children, incomplete: true, stopOffset: cursor };
    }
    children.push(box);
    cursor = box.contentEnd;
  }
  return { boxes: children, incomplete: false, stopOffset: end };
}

function scanIsobmff(bytes: Buffer): PrivacyScanResult {
  const findings: PrivacyFinding[] = [];
  const push = (kind: PrivacyFindingKind, detail: string) =>
    findings.push({ kind, rule: PRIVACY_RULE, detail });
  let segments = 0;
  let metaContent: { start: number; end: number } | null = null;
  let hasPictureHandler = false;

  // Top-level walk — EXACT PRODUCER CONTRACT (R-01): the pinned public-output
  // container produced by the frozen toolchain is EXACTLY the top-level
  // sequence ftyp → meta → mdat, each present exactly once, in that order
  // (independently verified across all generated AVIF outputs). Anything
  // else — duplicate ftyp/meta/mdat, missing any of them, reordered accepted
  // boxes, uuid (incl. the Adobe-XMP UUID), free/skip, unknown types, or
  // malformed/truncated boxes — is fail-closed rejected with the full byte
  // range covered: every byte must belong to a parsed box of the exact
  // accepted sequence. The legitimate single mdat (compressed pixel entropy)
  // is accepted structurally and NOT scanned as metadata — its purpose is
  // fail-closed structure verification, not payload text mining.
  const ADOBE_XMP_UUID = "be7acfcb97a942e89c71999491e3afac";
  const REQUIRED_SEQUENCE = ["ftyp", "meta", "mdat"] as const;
  let sequenceIndex = 0;
  let metaCount = 0;
  let cursor = 0;
  while (cursor < bytes.length) {
    const box = parseBox(bytes, cursor);
    if (box === null) {
      push("malformed", `ISOBMFF box at offset ${cursor} is malformed (size/type out of bounds)`);
      break;
    }
    segments += 1;
    const expected = REQUIRED_SEQUENCE[sequenceIndex];
    if (box.type === expected) {
      if (box.type === "meta") {
        metaCount += 1;
        metaContent = { start: box.contentStart, end: box.contentEnd };
      }
      sequenceIndex += 1;
    } else if (
      (REQUIRED_SEQUENCE as readonly string[]).includes(box.type)
    ) {
      // An accepted TYPE at the wrong position: a duplicate (already consumed)
      // or a reordered sequence element.
      const alreadySeen = REQUIRED_SEQUENCE.slice(0, sequenceIndex).includes(
        box.type as (typeof REQUIRED_SEQUENCE)[number],
      );
      push(
        "malformed",
        alreadySeen
          ? `duplicate top-level '${box.type}' box at offset ${cursor} — the verified producer sequence is exactly ftyp→meta→mdat, each exactly once (fail closed)`
          : `top-level '${box.type}' box at offset ${cursor} out of the verified producer order — expected '${expected}' at this position (contract: ftyp→meta→mdat) (fail closed)`,
      );
      if (box.type === "meta") metaCount += 1;
    } else {
      push(
        "malformed",
        `unclassified top-level box '${box.type}' at offset ${cursor} — outside the verified producer sequence (ftyp→meta→mdat) (fail closed)`,
      );
      if (box.type === "uuid") {
        const uuid = bytes.subarray(box.contentStart, Math.min(box.contentStart + 16, box.contentEnd)).toString("hex");
        if (uuid === ADOBE_XMP_UUID) {
          const xmp = bytes.subarray(box.contentStart + 16, box.contentEnd).toString("utf8");
          push("xmp", `top-level Adobe-XMP uuid box at offset ${cursor} carries an XMP packet (${xmp.length} bytes)`);
          if (isXmpGpsPacket(xmp)) {
            push("gps", `XMP inside top-level Adobe-XMP uuid box at offset ${cursor} contains GPS properties`);
          }
          if (isXmpSerialPacket(xmp)) {
            push("serial", `XMP inside top-level Adobe-XMP uuid box at offset ${cursor} contains serial/unique-ID properties`);
          }
        } else {
          push(
            "malformed",
            `top-level uuid box at offset ${cursor} carries a non-Adobe-XMP UUID (${uuid.slice(0, 32)}…) — opaque metadata-capable box (fail closed)`,
          );
        }
      }
    }
    cursor = box.contentEnd;
  }
  if (sequenceIndex < REQUIRED_SEQUENCE.length) {
    push(
      "malformed",
      `AVIF top-level structure incomplete: '${REQUIRED_SEQUENCE[sequenceIndex]}' missing after ${sequenceIndex} accepted box${sequenceIndex === 1 ? "" : "es"} — the verified producer sequence is exactly ftyp→meta→mdat (fail closed)`,
    );
  }
  if (metaCount === 0 || metaContent === null) {
    push(
      "unscannable-format",
      "no ISOBMFF 'meta' box found — not a verifiable image container (fail closed)",
    );
    return { format: "isobmff", findings, segmentsExamined: segments, ok: false };
  }

  const metaWalk = childBoxes(bytes, metaContent.start, metaContent.end, true);
  if (metaWalk.incomplete) {
    push(
      "malformed",
      `ISOBMFF 'meta' child walk stopped at offset ${metaWalk.stopOffset} — unreadable sibling box, container not fully verifiable (fail closed)`,
    );
  }
  const children = metaWalk.boxes;
  const hdlr = children.find((b) => b.type === "hdlr");
  if (hdlr !== undefined) {
    // hdlr body: version/flags (4) + pre_defined (4) + handler_type (4).
    const handler = bytes.subarray(hdlr.contentStart + 8, hdlr.contentStart + 12).toString("binary");
    if (handler === "pict") hasPictureHandler = true;
  }

  // iinf → infe item table.
  const itemTypes = new Map<number, { type: string; contentType: string }>();
  const iinf = children.find((b) => b.type === "iinf");
  if (iinf === undefined) {
    push("unscannable-format", "ISOBMFF 'meta' box carries no 'iinf' item table — cannot verify items (fail closed)");
  } else {
    const iinfVersion = bytes[iinf.contentStart]!;
    const countOffset = iinf.contentStart + 4;
    const entryCount =
      iinfVersion === 0 ? bytes.readUInt16BE(countOffset) : bytes.readUInt32BE(countOffset);
    let entriesStart = countOffset + (iinfVersion === 0 ? 2 : 4);
    segments += 1;
    let seen = 0;
    while (entriesStart < iinf.contentEnd && seen < entryCount) {
      const infe = parseBox(bytes, entriesStart);
      if (infe === null || infe.type !== "infe") {
        push("malformed", `item table entry ${seen} is malformed or not an 'infe' box`);
        break;
      }
      segments += 1;
      const version = bytes[infe.contentStart]!;
      if (version === 2 || version === 3) {
        const idSize = version === 2 ? 2 : 4;
        const idStart = infe.contentStart + 4;
        const itemId = idSize === 2 ? bytes.readUInt16BE(idStart) : bytes.readUInt32BE(idStart);
        const itemType = bytes.subarray(idStart + idSize + 2, idStart + idSize + 6).toString("binary");
        // item_name + content_type are null-terminated UTF-8 strings after item_type.
        let strCursor = idStart + idSize + 6;
        const readString = (): string => {
          const nul = bytes.indexOf(0, strCursor);
          if (nul === -1 || nul >= infe.contentEnd) return "";
          const value = bytes.subarray(strCursor, nul).toString("utf8");
          strCursor = nul + 1;
          return value;
        };
        readString(); // item_name
        const contentType = readString(); // content_type (mime items)
        itemTypes.set(itemId, { type: itemType, contentType });
      } else {
        push("malformed", `'infe' version ${version} is outside the scanner's verified coverage (v2/v3)`);
      }
      entriesStart = infe.contentEnd;
      seen += 1;
    }
    if (seen !== entryCount) {
      push("malformed", `item table declares ${entryCount} entries but ${seen} were readable — container not fully verifiable`);
    }

    for (const [itemId, item] of itemTypes) {
      if (PIXEL_ITEM_TYPES.has(item.type)) continue;
      segments += 1;
      if (item.type === "Exif") {
        push("exif", `ISOBMFF 'Exif' item (id ${itemId}) present in container — ADR-012 default full strip`);
        const payload = readItemPayload(bytes, children, itemId);
        if (payload === null) {
          push("malformed", `Exif item ${itemId} has no readable iloc extent (construction unsupported) — fail closed`);
        } else {
          const tiffStart = locateTiffInExifItem(payload);
          const walk = tiffStart === null ? null : safeWalkTiff(payload, tiffStart, `Exif item `, (detail) => push("malformed", detail));
          if (walk === null) {
            push("malformed", `Exif item ${itemId} TIFF structure could not be walked`);
          }
        }
      } else if (item.type === "mime" && XMP_MIME_TYPES.has(item.contentType.toLowerCase())) {
        push("xmp", `ISOBMFF 'mime' XMP item (id ${itemId}, ${item.contentType}) present — ADR-012 full strip`);
        const payload = readItemPayload(bytes, children, itemId);
        const xmp = payload === null ? "" : payload.toString("utf8");
        if (payload === null) {
          push("malformed", `XMP item ${itemId} has no readable iloc extent — fail closed`);
        } else {
          if (isXmpGpsPacket(xmp)) push("gps", "XMP item carries GPS properties (exif:GPS*/GPano)");
          if (isXmpSerialPacket(xmp)) push("serial", "XMP item carries serial/unique-id properties");
        }
      } else if (item.type === "mime") {
        push("metadata-item", `ISOBMFF 'mime' item (id ${itemId}, content-type "${item.contentType}") — unknown metadata carrier, fail closed`);
      } else if (item.type === "iptc" || item.type === "iptc ") {
        push("iptc", `ISOBMFF 'iptc' item (id ${itemId}) present — IPTC metadata class (ADR-012 full strip)`);
      } else {
        push("metadata-item", `ISOBMFF item id ${itemId} has unrecognized type "${item.type.replace(/\0/g, "\\0")}" — fail closed`);
      }
    }
  }

  // GPS attribution inside Exif items (precise GPS IFD walk).
  if (iinf !== undefined) {
    for (const [itemId, item] of itemTypes) {
      if (item.type !== "Exif") continue;
      const payload = readItemPayload(bytes, children, itemId);
      if (payload === null) continue;
      const tiffStart = locateTiffInExifItem(payload);
      if (tiffStart === null) continue;
      const gpsEntries = safeGpsCount(payload, tiffStart, `Exif item `, (detail) => push("malformed", detail));
      if (gpsEntries !== null && gpsEntries > 0) {
        push("gps", `Exif item ${itemId} carries a GPS IFD with ${gpsEntries} entr${gpsEntries === 1 ? "y" : "ies"}`);
      }
    }
  }

  // iprp → ipco → colr (embedded ICC). NOTE: iprp and ipco are PLAIN
  // container boxes (no version/flags full-box header) — ipma is the full box.
  const iprp = children.find((b) => b.type === "iprp");
  if (iprp !== undefined) {
    const iprpWalk = childBoxes(bytes, iprp.contentStart, iprp.contentEnd, false);
    if (iprpWalk.incomplete) {
      push("malformed", `ISOBMFF 'iprp' child walk stopped at offset ${iprpWalk.stopOffset} — unreadable sibling box (fail closed)`);
    }
    for (const ipco of iprpWalk.boxes) {
      if (ipco.type !== "ipco") continue;
      segments += 1;
      const ipcoWalk = childBoxes(bytes, ipco.contentStart, ipco.contentEnd, false);
      if (ipcoWalk.incomplete) {
        push("malformed", `ISOBMFF 'ipco' child walk stopped at offset ${ipcoWalk.stopOffset} — unreadable sibling box, colour properties not fully verifiable (fail closed)`);
      }
      for (const colr of ipcoWalk.boxes) {
        if (colr.type !== "colr") continue;
        const colourType = bytes.subarray(colr.contentStart, colr.contentStart + 4).toString("binary");
        if (colourType === "prof" || colourType === "rICC") {
          push(
            "icc",
            `ISOBMFF 'colr' box embeds an ICC profile ('${colourType}', ${colr.contentEnd - colr.contentStart - 4} B) — D10 forbids output ICC`,
          );
        } else if (colourType === "nclx") {
          // Format-level colour signaling (primaries/transfer/matrix) — not an
          // embedded profile; expected on AVIF output, not a finding.
        } else {
          push("malformed", `'colr' box with unrecognized colour_type "${colourType.replace(/\0/g, "\\0")}"`);
        }
      }
    }
  }

  if (!hasPictureHandler) {
    push(
      "unscannable-format",
      "ISOBMFF container has no 'pict' handler — not a verifiable still-image container (fail closed)",
    );
  }

  return { format: "isobmff", findings, segmentsExamined: segments, ok: findings.length === 0 };
}

/** Locate an Exif item's iloc extent payload bytes (file-offset construction). */
function readItemPayload(
  bytes: Buffer,
  metaChildren: BoxInfo[],
  itemId: number,
): Buffer | null {
  const iloc = metaChildren.find((b) => b.type === "iloc");
  if (iloc === undefined) return null;
  const version = bytes[iloc.contentStart]!;
  if (version > 2) return null;
  const sizesByte = bytes[iloc.contentStart + 4]!;
  const offsetSize = sizesByte >> 4;
  const lengthSize = sizesByte & 0x0f;
  const baseByte = bytes[iloc.contentStart + 5]!;
  const baseOffsetSize = baseByte >> 4;
  const indexSize = version >= 1 ? baseByte & 0x0f : 0;
  const countOffset = iloc.contentStart + 6;
  const entryCount = version === 2 ? bytes.readUInt32BE(countOffset) : bytes.readUInt16BE(countOffset);
  let cursor = countOffset + (version === 2 ? 4 : 2);
  const idSize = version === 2 ? 4 : 2;
  const readUint = (size: number): number | null => {
    if (size === 0) return 0;
    if (size > 8 || cursor + size > iloc.contentEnd) return null;
    let value = 0;
    for (let i = 0; i < size; i++) value = value * 256 + bytes[cursor + i]!;
    cursor += size;
    return value;
  };
  for (let i = 0; i < entryCount; i++) {
    const itemIdRead = idSize === 2 ? bytes.readUInt16BE(cursor) : bytes.readUInt32BE(cursor);
    cursor += idSize;
    if (version >= 1) {
      if (cursor + 2 > iloc.contentEnd) return null;
      cursor += 2; // construction_method
    }
    if (cursor + 2 > iloc.contentEnd) return null;
    cursor += 2; // data_reference_index
    const baseOffset = readUint(baseOffsetSize);
    if (baseOffset === null) return null;
    if (cursor + 2 > iloc.contentEnd) return null;
    const extentCount = bytes.readUInt16BE(cursor);
    cursor += 2;
    for (let e = 0; e < extentCount; e++) {
      if (indexSize > 0) {
        if (readUint(indexSize) === null) return null;
      }
      const extentOffset = readUint(offsetSize);
      const extentLength = readUint(lengthSize);
      if (extentOffset === null || extentLength === null) return null;
      if (itemIdRead !== itemId) continue;
      const absolute = baseOffset + extentOffset;
      if (absolute + extentLength > bytes.length) return null;
      return bytes.subarray(absolute, absolute + extentLength);
    }
  }
  return null;
}

/**
 * Locate the TIFF start inside an Exif item payload: a 4-byte big-endian
 * tiff-header offset (HEIF/Exif-item spec) whose value says how many further
 * bytes to skip (e.g. libheif writes 6 with an "Exif\0\0" prefix). Falls back
 * to scanning the first 16 bytes for the TIFF endian magic ("II" + 42 /
 * "MM" + 42). Null when no TIFF header is present.
 */
function locateTiffInExifItem(payload: Buffer): number | null {
  if (payload.length < 4) return null;
  const declared = payload.readUInt32BE(0);
  const candidates = [4 + declared, 0, 4];
  for (const candidate of candidates) {
    if (candidate + 4 <= payload.length) {
      const magic = payload.subarray(candidate, candidate + 4).toString("binary");
      if (magic === "II*\0" || magic === "MM\0*") return candidate;
    }
  }
  for (let i = 0; i < Math.min(16, payload.length - 4); i++) {
    const magic = payload.subarray(i, i + 4).toString("binary");
    if (magic === "II*\0" || magic === "MM\0*") return i;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public scan API
// ---------------------------------------------------------------------------

/** True when the buffer is a JPEG stream (SOI marker). */
function isJpeg(bytes: Buffer): boolean {
  return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

/**
 * Exhaustive metadata scan over FINAL derivative bytes. Pure: no sharp, no
 * I/O — bytes in, structured findings out. Fail-closed: malformed structure
 * or an unrecognized container is itself a finding (§11.1), never a pass.
 */
export function scanBuffer(bytes: Buffer): PrivacyScanResult {
  if (isJpeg(bytes)) return scanJpeg(bytes);
  // ISOBMFF dispatch: ftyp box at offset 0.
  if (
    bytes.length >= 12 &&
    bytes.subarray(4, 8).toString("binary") === "ftyp"
  ) {
    return scanIsobmff(bytes);
  }
  return {
    format: "unknown",
    findings: [
      {
        kind: "unscannable-format",
        rule: PRIVACY_RULE,
        detail: "bytes are neither a JPEG stream nor an ISOBMFF (ftyp) container — no exhaustive scan is possible, fail closed (IMAGE_PIPELINE §11.1)",
      },
    ],
    segmentsExamined: 0,
    ok: false,
  };
}

/** Options for verifyPrivacy. */
export interface VerifyPrivacyOptions {
  /** Throw PrivacyVerificationError instead of only reporting (fail-closed). */
  throwOnError?: boolean;
}

/**
 * Exhaustively verify a set of final derivative FILES (read + scanBuffer each
 * — every byte of every file, not sampled). Returns the structured report;
 * with throwOnError the §11.1 failure throws PrivacyVerificationError.
 */
export async function verifyPrivacy(
  files: readonly string[],
  options: VerifyPrivacyOptions = {},
): Promise<PrivacyReport> {
  const report: PrivacyReport = { files: [], filesScanned: 0, findings: [], ok: true };
  for (const file of files) {
    const bytes = await readFile(file);
    const scan = scanBuffer(bytes);
    report.files.push({ file, scan });
    report.filesScanned += 1;
    if (!scan.ok) {
      report.ok = false;
      report.findings.push(...scan.findings);
    }
  }
  if (!report.ok && options.throwOnError) {
    throw new PrivacyVerificationError(
      `${PRIVACY_RULE}: privacy verification FAILED for ` +
        `${report.files.filter((f) => !f.scan.ok).length} of ${report.filesScanned} final ` +
        `derivative file(s): ${summarizeFindings(report.findings)} (IMAGE_PIPELINE §11.1 — build blocked)`,
      [PRIVACY_RULE],
      report,
    );
  }
  return report;
}

// ---------------------------------------------------------------------------
// Stages 6–7 entrypoint — finalizeAndVerify over WP-20 derive results
// ---------------------------------------------------------------------------

export interface FinalizeAndVerifyOptions {
  /**
   * Master references for the §7.3 untouched guard. When supplied, EVERY
   * derived source must resolve (else 7.3:master-unresolved) and every live
   * master checksum must match the derive-time sourceSha256 (and any
   * discovery-record sha256 — else 7.3:master-untouched). Omitted → the
   * checksum guard does not run (reported honestly as masterChecked: false).
   */
  masters?: readonly MasterRef[];
  /** Throw PrivacyVerificationError on any failure (default true — §11.1). */
  throwOnError?: boolean;
}

/**
 * Pipeline stages 6–7 over WP-20 derive results (IMAGE_PIPELINE §5):
 *   1. Validate the finalize stage plan through the WP-18 guard (stages 6–7
 *      strictly after 5; embed-output-icc absent per D10; hash-output absent
 *      per WP-22 ownership — no digest is computed here).
 *   2. §7.3 master-untouched guard: live master bytes must still hash to the
 *      derive-time sourceSha256 (and to the supplied discovery-record SHA-256
 *      when present) — checksum before/after the pipeline run, fail closed.
 *   3. Exhaustive final-byte verification for every derivative: scanBuffer
 *      (zero GPS/serial/EXIF/XMP/IPTC/ICC/comment/segment — ADR-012 full
 *      strip) + the D10 no-ICC assertion (an icc finding is a §11.1 failure).
 * Fail-closed: any finding or guard mismatch throws PrivacyVerificationError
 * (unless throwOnError is false) AND the structured FinalizeReport is
 * returned when everything passes.
 */
export async function finalizeAndVerify(
  deriveResults: readonly DeriveSourceResult[],
  options: FinalizeAndVerifyOptions = {},
): Promise<FinalizeReport> {
  // (1) Stage-order guard BEFORE any I/O — a drifted plan cannot scan.
  const stagePlan = validateFinalizeStagePlan();

  const report: FinalizeReport = {
    stagePlan,
    sources: [],
    filesScanned: 0,
    bytesScanned: 0,
    masterIssues: [],
    findings: [],
    ok: true,
  };

  // (2) Master-untouched guard.
  const mastersByPhoto = new Map((options.masters ?? []).map((m) => [m.photoId, m]));
  for (const derived of deriveResults) {
    const ref = mastersByPhoto.get(derived.photoId);
    if (options.masters !== undefined && ref === undefined) {
      report.masterIssues.push({
        photoId: derived.photoId,
        rule: MASTER_UNRESOLVED_RULE,
        message: `no master reference supplied for derived source '${derived.photoId}' — the §7.3 guard cannot run, fail closed`,
      });
      continue;
    }
    if (ref === undefined) continue;
    if (ref.sha256 !== undefined && ref.sha256 !== derived.sourceSha256) {
      report.masterIssues.push({
        photoId: derived.photoId,
        rule: MASTER_MODIFIED_RULE,
        message: `discovery-record SHA-256 (${ref.sha256.slice(0, 12)}…) disagrees with the derive-time sourceSha256 (${derived.sourceSha256.slice(0, 12)}…) for master '${ref.file}'`,
      });
      continue;
    }
    const live = createHash("sha256").update(await readFile(ref.file)).digest("hex");
    if (live !== derived.sourceSha256) {
      report.masterIssues.push({
        photoId: derived.photoId,
        rule: MASTER_MODIFIED_RULE,
        message: `master '${ref.file}' changed after derivation: live SHA-256 ${live.slice(0, 12)}… ≠ derive-time ${derived.sourceSha256.slice(0, 12)}… (IMAGE_PIPELINE §7.3)`,
      });
    }
  }

  // (3) Exhaustive final-byte verification.
  for (const derived of deriveResults) {
    const sourceFindings: PrivacyFinding[] = [];
    for (const derivative of derived.derivatives) {
      const bytes = await readFile(derivative.file);
      const scan = scanBuffer(bytes);
      report.filesScanned += 1;
      report.bytesScanned += bytes.length;
      sourceFindings.push(...scan.findings);
      if (!scan.ok) report.ok = false;
    }
    report.sources.push({
      photoId: derived.photoId,
      masterChecked: mastersByPhoto.has(derived.photoId),
      derivativeFiles: derived.derivatives.length,
      findings: sourceFindings,
    });
    report.findings.push(...sourceFindings);
  }

  if (report.masterIssues.length > 0) {
    report.ok = false;
    const rules = [...new Set(report.masterIssues.map((issue) => issue.rule))];
    if (options.throwOnError !== false) {
      throw new PrivacyVerificationError(
        `${rules.join(",")}: master-untouched guard FAILED — ` +
          `${report.masterIssues.map((issue) => issue.message).join(" | ")}`,
        rules,
        report,
      );
    }
  }
  if (!report.ok && options.throwOnError !== false && report.masterIssues.length === 0) {
    throw new PrivacyVerificationError(
      `${PRIVACY_RULE}: privacy verification FAILED across ${report.filesScanned} final ` +
        `derivative file(s): ${summarizeFindings(report.findings)} (IMAGE_PIPELINE §11.1 — build blocked)`,
      [PRIVACY_RULE],
      report,
    );
  }
  return report;
}

function summarizeFindings(findings: readonly PrivacyFinding[]): string {
  if (findings.length === 0) return "no findings";
  const byKind = new Map<string, number>();
  for (const finding of findings) byKind.set(finding.kind, (byKind.get(finding.kind) ?? 0) + 1);
  return [...byKind.entries()].map(([kind, count]) => `${kind}×${count}`).join(", ");
}

// ---------------------------------------------------------------------------
// CLI — media:privacy-check
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.info(
    [
      "Usage: privacy-check.ts <file-or-dir> [--json]",
      "",
      "Exhaustively scans FINAL derivative bytes for privacy/metadata leakage",
      "(IMAGE_PIPELINE §5 stages 6–7, §7, §11.1; ADR-012 full strip; ICC-POLICY",
      "D10 no-ICC): JPEG APP walk + TIFF IFD walk (GPS/serial), AVIF/HEIF",
      "container box walk (Exif/XMP/iptc items, colr ICC). Exit 1 on ANY finding",
      "— fail closed, build-blocking.",
      "",
      "Non-recursive scan contract (current limitation, documented): <dir>",
      "scans the files DIRECTLY inside it, not subdirectories; a nested tree",
      "must be enumerated by the caller (WP-23 closure owns the recursive",
      "inventory). An empty scan set also fails closed.",
    ].join("\n"),
  );
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  (process.argv[1]!.endsWith("privacy-check.ts"));
if (invokedDirectly) {
  const argv = process.argv.slice(2);
  let target: string | undefined;
  let asJson = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--json") asJson = true;
    else if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else if (arg.startsWith("-")) {
      console.error(`privacy-check: Unknown argument '${arg}' (see --help)`);
      process.exit(1);
    } else {
      target = arg;
    }
  }
  if (!target) {
    printUsage();
    process.exit(1);
  }
  const { statSync, readdirSync } = await import("node:fs");
  const { resolve, join, relative, sep } = await import("node:path");
  const targetPath = resolve(target);
  let st: import("node:fs").Stats;
  try {
    st = statSync(targetPath);
  } catch {
    console.error(`privacy-check: target '${target}' does not exist or is not stat-able — fail closed`);
    process.exit(1);
  }
  const files: string[] = [];
  if (st.isFile()) {
    files.push(targetPath);
  } else {
    for (const entry of readdirSync(targetPath).sort()) {
      if (/\.(avif|jpe?g)$/i.test(entry) && statSync(join(targetPath, entry)).isFile()) {
        files.push(join(targetPath, entry));
      }
    }
  }
  // Fail closed on an empty scan set: a silent PASS over zero files would
  // make the verification vacuous (e.g. a wrong --out directory).
  if (files.length === 0) {
    console.error(
      "privacy-check: no scannable files found (.avif/.jpg/.jpeg; non-recursive for directories) — " +
        "refusing to PASS an empty scan set, fail closed (IMAGE_PIPELINE §11.1)",
    );
    process.exit(1);
  }
  const report = await verifyPrivacy(files);
  const display = (absolute: string): string => {
    const rel = relative(process.cwd(), absolute);
    return rel.startsWith("..") ? absolute : rel.split(sep).join("/");
  };
  if (asJson) {
    console.info(
      JSON.stringify(
        {
          rule: PRIVACY_RULE,
          filesScanned: report.filesScanned,
          ok: report.ok,
          findings: report.findings.map((f) => ({
            kind: f.kind,
            rule: f.rule,
            detail: f.detail,
            file: report.files.find((entry) => entry.scan.findings.includes(f))?.file,
          })),
        },
        null,
        2,
      ) + "\n",
    );
  } else {
    for (const entry of report.files) {
      if (!entry.scan.ok) {
        for (const finding of entry.scan.findings) {
          console.info(`[wp21] ${display(entry.file)}: ${finding.kind} — ${finding.detail}`);
        }
      }
    }
    console.info(
      `[wp21] ${report.filesScanned} file(s) exhaustively scanned: ` +
        (report.ok
          ? "PASS — no GPS/serial/EXIF/XMP/IPTC/ICC metadata in final bytes"
          : `FAIL — ${report.findings.length} finding(s): ${summarizeFindings(report.findings)}`),
    );
  }
  process.exit(report.ok ? 0 : 1);
}
