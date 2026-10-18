import { describe, expect, it } from "vitest";
import {
  loadAboutSettings,
  validateAboutSettings,
} from "../../src/lib/content/about";
import { repoRoot } from "../../src/lib/pages/archive-data";

describe("aboutSchema (Monograph colophon)", () => {
  it("accepts a statement-only document", () => {
    const r = validateAboutSettings({ statement: "Hello." });
    expect(r.ok).toBe(true);
    expect(r.settings.gear).toBeNull();
  });

  it("accepts full optional sections", () => {
    const r = validateAboutSettings({
      statement: "A",
      approach: "B",
      gear: ["Camera", "Lens"],
      contact: { email: "richard@example.org", url: "https://example.org" },
      portrait: { src: "/media/portrait.jpg", alt: "Portrait" },
    });
    expect(r.ok).toBe(true);
    expect(r.settings.gear).toEqual(["Camera", "Lens"]);
  });

  it("rejects unknown keys", () => {
    const r = validateAboutSettings({ statement: "A", horoscope: "leo" });
    expect(r.ok).toBe(false);
  });

  it("rejects a malformed contact email and non-root portrait src", () => {
    expect(validateAboutSettings({ contact: { email: "nope" } }).ok).toBe(false);
    expect(validateAboutSettings({ portrait: { src: "media/x.jpg", alt: "x" } }).ok).toBe(false);
    expect(validateAboutSettings({ portrait: { src: "/x.jpg", alt: "" } }).ok).toBe(false);
  });

  it("empty object is valid (all sections optional)", () => {
    expect(validateAboutSettings({}).ok).toBe(true);
  });
});

describe("loadAboutSettings over the real corpus", () => {
  it("loads the authored statement, the verified gear, and no fabricated sections", () => {
    const { settings, present } = loadAboutSettings(repoRoot());
    expect(present).toBe(true);
    expect(settings.statement).toContain("Richard");
    // Gear is verified from each photograph's EXIF (real, not fabricated).
    expect(settings.gear).toEqual(["Sony A7CR", "FE 24-70mm F2.8 GM II"]);
    // The owner's real contact address is authored content (about.yaml,
    // 2026-10-07); only placeholders are banned. Portrait stays unauthored.
    expect(settings.contact).toEqual({ email: "contact@example.com" });
    expect(settings.portrait).toBeNull();
  });
});
