// WP-11 unit tests — home.yaml schema/validation and the PURE featured/Recent
// resolution functions.
// Requirements: the frozen WP-11 brief (.superpowers/sdd/PRODUCTION_IMPLEMENTATION_PLAN/
// wp-11-brief.md) RED set; authority research/production-architecture/CONTENT_MODEL.md
// §10 (§10.1 schema, §10.2 featured resolution algorithm, §10.3 forbidden concepts,
// §10.4 Recent Galleries ordering), UD-004, ADR-019, TESTING_AND_VISUAL_REGRESSION.md
// §3.1 (featured resolution determinism; published_at ordering per UD-003).
//
// These are module tests: src/content-schemas.ts (homeSchema) and
// src/lib/content/home.ts are exercised directly — no filesystem, no loader.
// The published_at ties the RED set requires cannot use the WP-08 corpus (all
// fixture galleries share ONE honest archive-import instant), so the
// resolution tests run over SYNTHESIZED in-memory refs.
import { describe, expect, test } from "vitest";
import {
  FORBIDDEN_GALLERY_FIELDS,
  homeSchema,
  type HomeSettings,
} from "../../src/content-schemas";
import {
  orderRecentGalleries,
  resolveFeatured,
  validateHomeSettings,
  type GalleryResolutionRef,
  type HomeSettingsValidationResult,
} from "../../src/lib/content/home";

/** A minimal valid §10.1 home settings object. */
function home(featured_gallery_id: unknown): Record<string, unknown> {
  return { featured_gallery_id };
}

/** Builds one in-memory Gallery resolution ref (structural superset allowed). */
function ref(
  id: string,
  status: "draft" | "published",
  published_at: string | null,
  extra: Record<string, unknown> = {},
): GalleryResolutionRef & Record<string, unknown> {
  return { id, status, published_at, ...extra };
}

function featuredId(result: { galleryId: string | null }): string | null {
  return result.galleryId;
}

function warningRules(result: { warnings: { rule: string }[] }): string[] {
  return result.warnings.map((w) => w.rule);
}

describe("WP-11 RED: homeSchema / validateHomeSettings (CONTENT_MODEL §10.1)", () => {
  test("valid settings: featured_gallery_id as Gallery ID parses strict", () => {
    const parsed = homeSchema.parse(home("g_lofoten_light"));
    expect(parsed.featured_gallery_id).toBe("g_lofoten_light");
  });

  test("valid settings: featured_gallery_id may be explicitly null", () => {
    const parsed = homeSchema.parse(home(null));
    expect(parsed.featured_gallery_id).toBeNull();
  });

  test("unknown keys rejected (strict §10.1 — exactly one authored key)", () => {
    const result: HomeSettingsValidationResult = validateHomeSettings({
      featured_gallery_id: null,
      is_curated: true, // §10.3 forbidden concept has no home in this file
    });
    expect(result.ok).toBe(false);
    expect(result.errors.map((e) => e.rule)).toContain("10.1:unknown-key");
    expect(result.settings).toBeNull();
  });

  test("retired journey_rotation key is now an unknown key (single-cover home)", () => {
    const result: HomeSettingsValidationResult = validateHomeSettings({
      featured_gallery_id: null,
      journey_rotation: ["g_lofoten_polar_night", "g_aegean"],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.map((e) => e.rule)).toContain("10.1:unknown-key");
  });

  test("non-string featured_gallery_id rejected", () => {
    const result = validateHomeSettings(home(42));
    expect(result.ok).toBe(false);
    expect(result.errors.map((e) => e.rule)).toContain("10.1:featured-id");
  });

  test("missing featured_gallery_id rejected (the file must state featured state explicitly)", () => {
    const result = validateHomeSettings({});
    expect(result.ok).toBe(false);
    expect(result.errors.map((e) => e.rule)).toContain("10.1:featured-id");
  });

  test("empty-string featured_gallery_id rejected", () => {
    const result = validateHomeSettings(home(""));
    expect(result.ok).toBe(false);
    expect(result.errors.map((e) => e.rule)).toContain("10.1:featured-id");
  });

  test("valid settings produce parsed settings and no warnings", () => {
    const result = validateHomeSettings(home("g_lofoten_light"));
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.settings).toEqual({ featured_gallery_id: "g_lofoten_light" } satisfies HomeSettings);
  });
});

describe("WP-11 RED: featured resolution (CONTENT_MODEL §10.2, ADR-019, UD-004)", () => {
  // Synthesized instants — the corpus shares ONE instant, so distinct values
  // must be authored in-test per the WP-11 handoff fact.
  const galleries: GalleryResolutionRef[] = [
    ref("g_oldest", "published", "2026-01-01T00:00:00Z"),
    ref("g_middle", "published", "2026-06-15T12:00:00Z"),
    ref("g_latest", "published", "2026-07-01T00:00:00Z"),
    ref("g_draft", "draft", "2026-12-31T00:00:00Z"), // never a candidate
  ];

  test("a valid published featured_gallery_id is used, even when it is not the latest", () => {
    const result = resolveFeatured(
      { featured_gallery_id: "g_oldest" },
      galleries,
      { mode: "production" },
    );
    expect(featuredId(result)).toBe("g_oldest");
    expect(result.warnings).toEqual([]);
  });

  test("featured_gallery_id null → latest published by published_at DESC", () => {
    const result = resolveFeatured({ featured_gallery_id: null }, galleries, {
      mode: "production",
    });
    expect(featuredId(result)).toBe("g_latest");
    expect(result.warnings).toEqual([]);
  });

  test("tie on published_at breaks by lexicographic Gallery ID ascending (stable)", () => {
    const tied: GalleryResolutionRef[] = [
      ref("g_b_second", "published", "2026-06-15T12:00:00Z"),
      ref("g_a_first", "published", "2026-06-15T12:00:00Z"),
      ref("g_c_third", "published", "2026-06-15T12:00:00Z"),
    ];
    const result = resolveFeatured({ featured_gallery_id: null }, tied, {
      mode: "production",
    });
    expect(featuredId(result)).toBe("g_a_first");
  });

  test("featured referencing a NONEXISTENT ID falls back deterministically + records a WARNING; the build is not failed (no throw)", () => {
    const result = resolveFeatured({ featured_gallery_id: "g_ghost" }, galleries, {
      mode: "production",
    });
    expect(featuredId(result)).toBe("g_latest"); // same fallback algorithm as null
    expect(warningRules(result)).toEqual(["10.2:featured-unresolved"]);
    expect(result.warnings[0]?.message).toContain("g_ghost");
  });

  test("featured referencing a DRAFT gallery in production falls back + warns", () => {
    const result = resolveFeatured({ featured_gallery_id: "g_draft" }, galleries, {
      mode: "production",
    });
    expect(featuredId(result)).toBe("g_latest");
    expect(warningRules(result)).toEqual(["10.2:featured-unresolved"]);
    expect(result.warnings[0]?.message).toContain("g_draft");
  });

  test("preview mode: §10.2/ADR-019 define NO mode distinction — behavior identical (documented reading)", () => {
    const productionDraft = resolveFeatured({ featured_gallery_id: "g_draft" }, galleries, {
      mode: "production",
    });
    const previewDraft = resolveFeatured({ featured_gallery_id: "g_draft" }, galleries, {
      mode: "preview",
    });
    expect(previewDraft).toEqual(productionDraft);

    const productionNull = resolveFeatured({ featured_gallery_id: null }, galleries, {
      mode: "production",
    });
    const previewNull = resolveFeatured({ featured_gallery_id: null }, galleries, {
      mode: "preview",
    });
    expect(previewNull).toEqual(productionNull);
  });

  test("a published featured target without a usable published_at is not 'valid published' — fallback + warning", () => {
    const refs: GalleryResolutionRef[] = [
      ref("g_nopub", "published", null),
      ref("g_real", "published", "2026-03-03T00:00:00Z"),
    ];
    const result = resolveFeatured({ featured_gallery_id: "g_nopub" }, refs, {
      mode: "production",
    });
    expect(featuredId(result)).toBe("g_real");
    expect(warningRules(result)).toEqual(["10.2:featured-unresolved"]);
  });

  test("no published Galleries at all → galleryId null + warning (never a throw, never a build failure)", () => {
    const result = resolveFeatured(
      { featured_gallery_id: null },
      [ref("g_draft", "draft", "2026-01-01T00:00:00Z")],
      { mode: "production" },
    );
    expect(result.galleryId).toBeNull();
    expect(warningRules(result)).toEqual(["10.2:no-published-galleries"]);
  });

  test("an invalid configured ID NEVER fails production validation: warnings only, result returned", () => {
    // The §10.2 contract: warn + fall back. Warnings are a separate channel —
    // resolveFeatured has no error channel and never throws; an invalid
    // configured ID can therefore never fail the production build.
    const result = resolveFeatured({ featured_gallery_id: "g_ghost" }, galleries, {
      mode: "production",
    });
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(result.galleryId).toBe("g_latest");
    expect(warningRules(result)).toEqual(["10.2:featured-unresolved"]);
  });

  test("DETERMINISM: same input → same output across repeated runs and input permutations", () => {
    const homeSettings: HomeSettings = { featured_gallery_id: null };
    const shuffled = [...galleries].reverse();
    const baseline = resolveFeatured(homeSettings, galleries, { mode: "production" });
    for (let i = 0; i < 5; i++) {
      expect(resolveFeatured(homeSettings, galleries, { mode: "production" })).toEqual(baseline);
      expect(resolveFeatured(homeSettings, shuffled, { mode: "production" })).toEqual(baseline);
      expect(JSON.stringify(resolveFeatured(homeSettings, shuffled, { mode: "production" }))).toBe(
        JSON.stringify(baseline),
      );
    }
  });
});

describe("WP-11 RED: Recent Galleries ordering (CONTENT_MODEL §10.4, UD-003)", () => {
  // photographed order intentionally REVERSED vs published order — ordering
  // must never use photographed time/EXIF/mtime/Git/folder (UD-003).
  const galleries: (GalleryResolutionRef & Record<string, unknown>)[] = [
    ref("g_old_photographed_2020", "published", "2026-01-01T00:00:00Z", {
      photographed_start: "2020-01-01",
      photographed_end: "2020-01-02",
    }),
    ref("g_new_photographed_2019", "published", "2026-06-01T00:00:00Z", {
      photographed_start: "2019-01-01",
      photographed_end: "2019-01-02",
    }),
    ref("g_draft_never", "draft", "2027-01-01T00:00:00Z", {
      photographed_start: "2021-01-01",
      photographed_end: "2021-01-02",
    }),
  ];

  test("published-only, published_at DESC, full ordered list returned (no display-count truncation)", () => {
    const result = orderRecentGalleries(galleries, { mode: "production" });
    expect(result.map((g) => g.id)).toEqual(["g_new_photographed_2019", "g_old_photographed_2020"]);
  });

  test("tie on published_at breaks by lexicographic Gallery ID ascending", () => {
    const tied: GalleryResolutionRef[] = [
      ref("g_b", "published", "2026-06-15T12:00:00Z"),
      ref("g_a", "published", "2026-06-15T12:00:00Z"),
    ];
    expect(orderRecentGalleries(tied, { mode: "production" }).map((g) => g.id)).toEqual([
      "g_a",
      "g_b",
    ]);
  });

  test("ordering ignores photographed time by construction (published order ≠ photographed order)", () => {
    const result = orderRecentGalleries(galleries, { mode: "production" });
    // g_new_photographed_2019 was photographed EARLIER (2019) than
    // g_old_photographed_2020 (2020) yet ranks first — published_at only.
    expect(result[0]?.id).toBe("g_new_photographed_2019");
    expect(result[0]?.photographed_start).toBe("2019-01-01");
  });

  test("DETERMINISM: repeated runs and shuffled input produce the identical order", () => {
    const baseline = orderRecentGalleries(galleries, { mode: "production" });
    for (let i = 0; i < 5; i++) {
      expect(orderRecentGalleries(galleries, { mode: "production" })).toEqual(baseline);
      expect(orderRecentGalleries([...galleries].reverse(), { mode: "production" })).toEqual(
        baseline,
      );
    }
  });
});

describe("WP-11 RED: §10.3 forbidden concepts have exactly one owner (UD-004)", () => {
  test("per-Gallery featured/is_featured/is_curated stay in the WP-09 forbidden-field list", () => {
    // Unit-level per-entry rejection is pinned by tests/unit/gallery-schema.test.ts
    // (fixture 4.3-forbidden-featured + synthesized enumeration). This pins the
    // contract that home.yaml is the ONLY featured owner at the module level.
    for (const banned of ["featured", "is_featured", "is_curated"]) {
      expect(FORBIDDEN_GALLERY_FIELDS).toContain(banned);
    }
  });

  test("resolution never consults any per-Gallery featured-ish field (structural input only)", () => {
    const withBannedFields: GalleryResolutionRef[] = [
      // Even if a gallery carried a featured-ish flag, the §10.2 algorithm's
      // input contract (id/status/published_at) cannot see it.
      ref("g_flagged", "published", "2026-01-01T00:00:00Z", {
        featured: true,
        is_featured: true,
        is_curated: true,
      }),
      ref("g_plain", "published", "2026-02-01T00:00:00Z"),
    ];
    const result = resolveFeatured({ featured_gallery_id: null }, withBannedFields, {
      mode: "production",
    });
    expect(result.galleryId).toBe("g_plain"); // latest published, not the flagged one
  });
});
