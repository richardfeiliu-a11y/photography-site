import { describe, expect, it } from "vitest";
import {
  cameraLabel,
  formatAperture,
  formatFocal35,
  formatIso,
  formatShutter,
  miniExifLine,
} from "../../src/lib/exif/format";

describe("EXIF formatters", () => {
  it("formats aperture rationals", () => {
    expect(formatAperture([56, 10])).toBe("ƒ/5.6");
    expect(formatAperture([8, 1])).toBe("ƒ/8");
    expect(formatAperture([71, 10])).toBe("ƒ/7.1");
    expect(formatAperture([1, 0])).toBeNull();
    expect(formatAperture(undefined)).toBeNull();
  });

  it("formats shutter speed as reciprocal or decimal seconds", () => {
    expect(formatShutter([1, 160])).toBe("1/160s");
    expect(formatShutter([1, 60])).toBe("1/60s");
    expect(formatShutter([25, 10])).toBe("2.5s");
    expect(formatShutter([2, 1])).toBe("2s");
    expect(formatShutter([0, 1])).toBeNull();
  });

  it("formats iso and focal length", () => {
    expect(formatIso(100)).toBe("ISO 100");
    expect(formatIso(12800)).toBe("ISO 12800");
    expect(formatIso(0)).toBeNull();
    expect(formatIso(undefined)).toBeNull();
    expect(formatFocal35(24)).toBe("24mm");
    expect(formatFocal35(70.4)).toBe("70mm");
    expect(formatFocal35(undefined)).toBeNull();
  });

  it("builds the camera label", () => {
    expect(cameraLabel({ make: "SONY", model: "ILCE-7CR" })).toBe("Sony ILCE-7CR");
    expect(cameraLabel({ model: "ILCE-7CR" })).toBe("ILCE-7CR");
    expect(cameraLabel({ make: "SONY" })).toBe("Sony");
    expect(cameraLabel({})).toBeNull();
  });

  it("assembles the mini line and omits missing parts", () => {
    expect(
      miniExifLine({ focalLength35: 24, fNumber: [8, 1], exposureTime: [1, 160], iso: 100 }),
    ).toBe("24mm · ƒ/8 · 1/160s · ISO 100");
    expect(miniExifLine({ iso: 100 })).toBe("ISO 100");
    expect(miniExifLine({})).toBe("");
    expect(miniExifLine(null)).toBe("");
    expect(miniExifLine(undefined)).toBe("");
  });
});
