import { describe, expect, it } from "vitest";
import { toRecord } from "../../src/lib/exif/build-sidecar";
import type { ExifTags } from "../../src/lib/exif/parse";
import { EXIF_SIDECAR_SCHEMA } from "../../src/lib/exif/sidecar-contract";

const ALLOWED_KEYS = ["make", "model", "lens", "focalLength35", "fNumber", "exposureTime", "iso"];
const FORBIDDEN = /gps|lat|lon|altitude|serial|owner|makernote|timestamp|datetime/i;

describe("EXIF sidecar privacy (ADR-012)", () => {
  it("maps only allow-listed capture fields", () => {
    const tags: ExifTags = {
      make: "SONY",
      model: "ILCE-7CR",
      lens: "FE 24-70mm F2.8 GM II",
      focalLength35: 24,
      fNumber: [8, 1],
      exposureTime: [1, 160],
      iso: 100,
      focalLength: [240, 10], // parsed but intentionally not stored
      dateTimeOriginal: "2025:01:27 11:33:46", // intentionally not stored
    };
    const record = toRecord(tags);
    expect(Object.keys(record).sort()).toEqual(ALLOWED_KEYS.slice().sort());
    expect(record).not.toHaveProperty("focalLength");
    expect(record).not.toHaveProperty("dateTimeOriginal");
  });

  it("never carries forbidden/private keys even if parser returned extras", () => {
    // Cast simulates a parser surface; toRecord must ignore unknown fields.
    const record = toRecord({ ...({ gps: [1, 2], bodySerialNumber: "x" } as object), iso: 100 } as ExifTags);
    expect(JSON.stringify(record)).not.toMatch(FORBIDDEN);
    expect(record.iso).toBe(100);
  });

  it("returns an empty record for null tags", () => {
    expect(toRecord(null)).toEqual({});
  });

  it("uses the documented sidecar schema id", () => {
    expect(EXIF_SIDECAR_SCHEMA).toBe("quiet-editorial-archive/exif-manifest@1");
  });
});
