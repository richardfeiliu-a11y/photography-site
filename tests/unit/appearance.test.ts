// Unit contract for normalizeAppearance (visual redesign spec §3.3):
// only system/light/dark are valid; everything else — including null,
// garbage, and wrong-cased input — falls back to system.
import { describe, expect, it } from "vitest";
import {
  APPEARANCE_STORAGE_KEY,
  normalizeAppearance,
} from "../../src/lib/js/appearance";

describe("normalizeAppearance", () => {
  it("maps null to system", () => {
    expect(normalizeAppearance(null)).toBe("system");
  });

  it("accepts light and dark", () => {
    expect(normalizeAppearance("light")).toBe("light");
    expect(normalizeAppearance("dark")).toBe("dark");
  });

  it("accepts system explicitly", () => {
    expect(normalizeAppearance("system")).toBe("system");
  });

  it("falls back to system on unexpected values", () => {
    expect(normalizeAppearance("unexpected")).toBe("system");
    expect(normalizeAppearance("")).toBe("system");
    expect(normalizeAppearance("DARK")).toBe("system");
    expect(normalizeAppearance("LIGHT")).toBe("system");
    expect(normalizeAppearance("dark ")).toBe("system");
    expect(normalizeAppearance("null")).toBe("system");
  });
});

describe("appearance storage key", () => {
  it("uses the agreed namespaced key", () => {
    expect(APPEARANCE_STORAGE_KEY).toBe("photography.appearance");
  });
});
