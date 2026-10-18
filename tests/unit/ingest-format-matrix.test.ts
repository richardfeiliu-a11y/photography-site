// WP-17 — IMAGE_PIPELINE.md §14 supported-ingest-format matrix, pinned.
//
// The discovery walker (scripts/media/discover.ts) classifies every file it
// finds by extension into exactly the §14 rows. This test pins that matrix so
// the supported/rejected behavior cannot drift from the authority document:
//
//   | Format                  | Supported for web ingest? | Notes                       |
//   | JPEG                    | Yes (primary)             | Recommended web ingest      |
//   | PNG                     | Limited                   | Rarely used in photography  |
//   | RAW (NEF, CR2, ARW ...) | No (unless benchmarked)   | Keep archival; export JPEG  |
//   | TIFF                    | Limited                   | Large files; export JPEG    |
//   | HEIC/HEIF               | No                        | License/toolchain limits    |
//
// NOTE (WP-17 decision, documented in docs/implementation/WP-17.md): the task
// brief's parenthetical once said "RAW/TIFF rejected"; §14 is the frozen
// authority and lists TIFF as "Limited" (the same tier as PNG), so TIFF is
// accepted with the "limited" tier — matching §14 exactly, as required.
import { describe, expect, it } from "vitest";
import { INGEST_FORMAT_MATRIX, classifyIngestFormat } from "../../scripts/media/discover";

describe("IMAGE_PIPELINE §14 ingest format matrix (pinned)", () => {
  it("exposes exactly the five §14 format rows", () => {
    expect(Object.keys(INGEST_FORMAT_MATRIX).sort()).toEqual(
      ["heic", "jpeg", "png", "raw", "tiff"].sort(),
    );
  });

  it("JPEG: Yes (primary)", () => {
    const row = INGEST_FORMAT_MATRIX.jpeg;
    expect(row.supported).toBe(true);
    expect(row.tier).toBe("primary");
  });

  it("PNG: Limited (accepted)", () => {
    const row = INGEST_FORMAT_MATRIX.png;
    expect(row.supported).toBe(true);
    expect(row.tier).toBe("limited");
  });

  it("TIFF: Limited (accepted) — §14 lists TIFF as Limited, same tier as PNG", () => {
    const row = INGEST_FORMAT_MATRIX.tiff;
    expect(row.supported).toBe(true);
    expect(row.tier).toBe("limited");
  });

  it("RAW: No (unless benchmarked) — rejected with a rule-precise error", () => {
    const row = INGEST_FORMAT_MATRIX.raw;
    expect(row.supported).toBe(false);
    expect(row.rule).toBe("14:raw-not-supported");
  });

  it("HEIC/HEIF: No — rejected with a rule-precise error", () => {
    const row = INGEST_FORMAT_MATRIX.heic;
    expect(row.supported).toBe(false);
    expect(row.rule).toBe("14:heic-not-supported");
  });
});

describe("classifyIngestFormat per extension", () => {
  it("classifies JPEG extensions as supported primary (case-insensitive)", () => {
    for (const ext of ["jpg", "jpeg", "JPG", "Jpeg"]) {
      const c = classifyIngestFormat(`g/photo.${ext}`);
      expect(c.format).toBe("jpeg");
      expect(c.supported).toBe(true);
      expect(c.tier).toBe("primary");
      expect(c.rule).toBeNull();
    }
  });

  it("classifies PNG and TIFF extensions as supported limited", () => {
    for (const ext of ["png", "PNG"]) {
      const c = classifyIngestFormat(`g/photo.${ext}`);
      expect(c.format).toBe("png");
      expect(c.supported).toBe(true);
      expect(c.tier).toBe("limited");
    }
    for (const ext of ["tif", "tiff", "TIF", "TIFF"]) {
      const c = classifyIngestFormat(`g/photo.${ext}`);
      expect(c.format).toBe("tiff");
      expect(c.supported).toBe(true);
      expect(c.tier).toBe("limited");
    }
  });

  it("rejects every common RAW extension with 14:raw-not-supported", () => {
    for (const ext of [
      "nef",
      "cr2",
      "cr3",
      "arw",
      "dng",
      "raf",
      "orf",
      "rw2",
      "nrw",
      "srw",
      "raw",
    ]) {
      const c = classifyIngestFormat(`g/photo.${ext}`);
      expect(c.supported).toBe(false);
      expect(c.rule).toBe("14:raw-not-supported");
      expect(c.format).toBe("raw");
    }
  });

  it("rejects HEIC/HEIF with 14:heic-not-supported", () => {
    for (const ext of ["heic", "heif", "HEIC", "HEIF"]) {
      const c = classifyIngestFormat(`g/photo.${ext}`);
      expect(c.supported).toBe(false);
      expect(c.rule).toBe("14:heic-not-supported");
      expect(c.format).toBe("heic");
    }
  });

  it("rejects unknown extensions with 14:format-not-supported", () => {
    const c = classifyIngestFormat("g/notes.txt");
    expect(c.supported).toBe(false);
    expect(c.rule).toBe("14:format-not-supported");
    expect(c.format).toBe("unknown");
  });

  it("classifies a path without extension as unsupported", () => {
    const c = classifyIngestFormat("g/README");
    expect(c.supported).toBe(false);
    expect(c.rule).toBe("14:format-not-supported");
  });
});
