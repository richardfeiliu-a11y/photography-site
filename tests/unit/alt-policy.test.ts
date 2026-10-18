// WP-42 — Alt text policy gate (D11/OQ-04) unit tests.
//
// Authority: CONTENT_MODEL §5.2 (alt_text semantics: no filename fallback,
// caption is not automatically alt), ADR-016, OPEN_QUESTIONS OQ-04,
// PRODUCTION_IMPLEMENTATION_PLAN WP-42 (policy (b): alt OR explicit
// decorative alt="" — recommended, PROPOSED pending user sign-off).
//
// Decision record (PROPOSED): docs/implementation/decisions/ALT-POLICY.md.
// Enforcement target: src/lib/validate/alt.ts wired into
// src/lib/validate/production.ts (production errors, preview warnings).
import { describe, expect, test } from "vitest";
import type { Gallery } from "../../src/content-schemas";
import { validateAltText } from "../../src/lib/validate/alt";
import { buildGalleryView } from "../../src/lib/views/gallery";

function publishedGallery(photos: Gallery["photos"]): Gallery {
  return {
    id: "g_alt_unit",
    slug: "alt-unit-gallery",
    status: "published",
    title: "Alt Unit Gallery",
    description: null,
    photographed_start: "2025-02-01",
    photographed_end: "2025-02-07",
    published_at: "2026-08-28T14:31:20Z",
    places: ["pl_reine"],
    cover_photo_id: photos[0]?.id ?? "p_alt_001",
    next_gallery_id: null,
    photos,
  } as unknown as Gallery;
}

function photo(
  id: string,
  alt_text: string | null | undefined,
  extra: Record<string, unknown> = {},
) {
  return {
    id,
    source_ref: "alt-unit/DSC02762.jpg",
    caption: "The ferry leaves at first light.",
    rhythm_after: "base",
    alt_text,
    ...extra,
  } as Gallery["photos"][number];
}

describe("WP-42 alt policy (b): production enforcement", () => {
  test("missing alt (null) on a published photo fails production", () => {
    const issues = validateAltText([publishedGallery([photo("p_alt_001", null)])], {
      mode: "production",
    });
    expect(issues.some((i) => i.rule === "WP-42:alt-missing" && i.severity === "error")).toBe(true);
  });

  test("explicit decorative alt (empty string) passes production", () => {
    const issues = validateAltText([publishedGallery([photo("p_alt_001", "")])], {
      mode: "production",
    });
    expect(issues).toEqual([]);
  });

  test("authored meaningful alt passes production", () => {
    const issues = validateAltText(
      [publishedGallery([photo("p_alt_001", "A ferry crossing grey water at dawn.")])],
      { mode: "production" },
    );
    expect(issues).toEqual([]);
  });

  test("filename-derived alt always fails production", () => {
    const issues = validateAltText([publishedGallery([photo("p_alt_001", "DSC02762")])], {
      mode: "production",
    });
    expect(
      issues.some((i) => i.rule === "WP-42:alt-filename-fallback" && i.severity === "error"),
    ).toBe(true);
  });

  test("draft galleries are excluded from production alt enforcement", () => {
    const draft = { ...publishedGallery([photo("p_alt_001", null)]), status: "draft" } as unknown as Gallery;
    const issues = validateAltText([draft], { mode: "production" });
    expect(issues).toEqual([]);
  });
});

describe("WP-42 alt policy (b): preview is warn-only", () => {
  test("missing alt in preview warns instead of failing", () => {
    const issues = validateAltText([publishedGallery([photo("p_alt_001", null)])], {
      mode: "preview",
    });
    expect(issues.some((i) => i.rule === "WP-42:alt-missing" && i.severity === "warning")).toBe(
      true,
    );
    expect(issues.some((i) => i.severity === "error")).toBe(false);
  });
});

describe("WP-42 rendering contract: no fallback generation, no caption auto-copy", () => {
  const resolveDisplay = (photoId: string) => ({
    photoId,
    src: `/media/${photoId}.jpg`,
    srcset: `/media/${photoId}.jpg 800w`,
    width: 800,
    height: 600,
  });

  test("authored alt passes through to the view model verbatim", () => {
    const view = buildGalleryView({
      gallery: publishedGallery([photo("p_alt_001", "A ferry crossing grey water at dawn.")]),
      places: [],
      nextGalleryMap: { g_alt_unit: null },
      resolveDisplay,
    });
    expect(view.photos[0]?.altText).toBe("A ferry crossing grey water at dawn.");
  });

  test("missing alt stays null (never caption-copied) at the view-model boundary", () => {
    const view = buildGalleryView({
      gallery: publishedGallery([photo("p_alt_001", null)]),
      places: [],
      nextGalleryMap: { g_alt_unit: null },
      resolveDisplay,
    });
    expect(view.photos[0]?.altText).toBeNull();
    expect(view.photos[0]?.altText).not.toBe(view.photos[0]?.caption);
  });

  test("explicit decorative empty stays empty-string (distinct from missing)", () => {
    const view = buildGalleryView({
      gallery: publishedGallery([photo("p_alt_001", "")]),
      places: [],
      nextGalleryMap: { g_alt_unit: null },
      resolveDisplay,
    });
    expect(view.photos[0]?.altText).toBe("");
  });
});
