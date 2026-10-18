// WP-25 unit tests — pure view-data builders (HomeView / ArchiveView /
// PlacesView / PlaceView).
// Requirements: the frozen WP-25 brief (.superpowers/sdd/PRODUCTION_IMPLEMENTATION_PLAN/
// wp-25-brief.md) RED set; authority research/production-architecture/CONTENT_MODEL.md
// §7 (UD-003 ordering semantics: photographed time = archive chronology,
// published_at = publication order), §8.4 (cover policy — never a silent
// first-Photo default), §5.5 (photo order = array order; counts from array
// length), §10.2/§10.4 (featured + Recent resolution owned by WP-11), §6.3
// (no counts anywhere on Places); FINAL_DESIGN_SPECIFICATION §3.2–3.4.
//
// These are module tests over SYNTHESIZED in-memory galleries/places with an
// injected cover resolver — no filesystem, no loader, no manifest. The real
// corpus is exercised in tests/integration/views.test.ts (snapshot stability).
import { describe, expect, test } from "vitest";
import type { Gallery, Place } from "../../src/content-schemas";
import { buildHomeView } from "../../src/lib/views/home";
import { buildArchiveView } from "../../src/lib/views/archive";
import { buildPlacesView } from "../../src/lib/views/places";
import { buildPlaceView } from "../../src/lib/views/place";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeGallery(overrides: Partial<Gallery> & Pick<Gallery, "id">): Gallery {
  const prefix = overrides.id.replace(/^g_/, "p_");
  return {
    slug: overrides.id.replace(/^g_/, "").replace(/_/g, "-"),
    status: "published",
    title: `Title of ${overrides.id}`,
    description: null,
    photographed_start: "2025-02-01",
    photographed_end: "2025-02-07",
    published_at: "2026-08-29T00:00:00Z",
    places: ["pl_alpha"],
    cover_photo_id: `${prefix}_001`,
    next_gallery_id: undefined,
    photos: [
      {
        id: `${prefix}_001`,
        source_ref: "x/master.jpg",
        caption: null,
        rhythm_after: "base",
        alt_text: null,
      },
    ],
    ...overrides,
  } as Gallery;
}

const PLACES: Place[] = [
  { id: "pl_alpha", slug: "alpha", name: "Alpha", region: "North Region", country: "Norway" },
  { id: "pl_beta", slug: "beta", name: "Beta", region: null, country: null },
];

function makePlaces(overrides: Partial<Place>[]): Place[] {
  return PLACES.map((p, i) => ({ ...p, ...overrides[i] }));
}

const resolveCover = (photoId: string) => ({
  photoId,
  src: `/${photoId}.jpg`,
  srcset: `/${photoId}.jpg 480w, /${photoId}.jpg 800w`,
  width: 800,
  height: 600,
});

const ALL_IDS = (cards: { id: string }[]) => cards.map((c) => c.id);

// ---------------------------------------------------------------------------
// HomeView
// ---------------------------------------------------------------------------

describe("buildHomeView", () => {
  test("hero follows the WP-11 featured resolution passed in (explicit featured)", () => {
    const galleries = [
      makeGallery({ id: "g_a", published_at: "2026-01-01T00:00:00Z" }),
      makeGallery({ id: "g_b", published_at: "2026-06-01T00:00:00Z" }),
    ];
    const view = buildHomeView({
      galleries,
      places: makePlaces([]),
      home: { featured_gallery_id: "g_a" },
      resolveCover,
      mode: "production",
    });
    // g_b is LATEST — the builder must NOT re-derive "latest"; the single
    // featured-state owner (§10.2/§10.3) decided g_a.
    expect(view.hero?.id).toBe("g_a");
  });

  test("featured_gallery_id null → §10.2 latest-published fallback (ADR-019), never null while published work exists", () => {
    const view = buildHomeView({
      galleries: [makeGallery({ id: "g_a" })],
      places: makePlaces([]),
      home: { featured_gallery_id: null },
      resolveCover,
      mode: "production",
    });
    expect(view.hero?.id).toBe("g_a");
  });

  test("unknown/unresolvable featured ID → §10.2 fallback to LATEST published (never a second feature system)", () => {
    const galleries = [
      makeGallery({ id: "g_a", published_at: "2026-01-01T00:00:00Z" }),
      makeGallery({ id: "g_b", published_at: "2026-06-01T00:00:00Z" }),
    ];
    const view = buildHomeView({
      galleries,
      places: makePlaces([]),
      home: { featured_gallery_id: "g_missing" },
      resolveCover,
      mode: "production",
    });
    expect(view.hero?.id).toBe("g_b");
  });

  test("Recent preserves the WP-11 §10.4 order (published_at DESC + ID tie-break)", () => {
    const galleries = [
      makeGallery({ id: "g_c", published_at: "2026-03-01T00:00:00Z" }),
      makeGallery({ id: "g_a", published_at: "2026-01-01T00:00:00Z" }),
      makeGallery({ id: "g_b2", published_at: "2026-01-01T00:00:00Z" }), // tie with g_a → ID asc wins
    ];
    const view = buildHomeView({
      galleries,
      places: makePlaces([]),
      home: { featured_gallery_id: null },
      resolveCover,
      mode: "production",
    });
    expect(ALL_IDS(view.recent)).toEqual(["g_c", "g_a", "g_b2"]);
  });

  test("production mode: drafts absent from hero and Recent (WP-11 resolution is published-only)", () => {
    const galleries = [
      makeGallery({ id: "g_pub", published_at: "2026-01-01T00:00:00Z" }),
      makeGallery({ id: "g_draft", status: "draft", published_at: null }),
    ];
    const view = buildHomeView({
      galleries,
      places: makePlaces([]),
      home: { featured_gallery_id: "g_draft" },
      resolveCover,
      mode: "production",
    });
    // Draft is never a featured candidate (§8.3/ADR-020): §10.2 falls back to
    // the latest published gallery.
    expect(view.hero?.id).toBe("g_pub");
    expect(ALL_IDS(view.recent)).toEqual(["g_pub"]);
  });

  test("preview mode: HomeView stays published-only (route scope, not §10.2 selection — WP-11 contract)", () => {
    const galleries = [
      makeGallery({ id: "g_pub", published_at: "2026-01-01T00:00:00Z" }),
      makeGallery({ id: "g_draft", status: "draft", published_at: null }),
    ];
    const view = buildHomeView({
      galleries,
      places: makePlaces([]),
      home: { featured_gallery_id: null },
      resolveCover,
      mode: "preview",
    });
    expect(view.hero?.id).toBe("g_pub");
    expect(ALL_IDS(view.recent)).toEqual(["g_pub"]);
  });

  test("photo count derives from photos[] length (never authored)", () => {
    const gallery = makeGallery({
      id: "g_multi",
      photos: [
        { id: "p_m1", source_ref: "x/a.jpg", caption: null, rhythm_after: "base", alt_text: null },
        { id: "p_m2", source_ref: "x/b.jpg", caption: "cap", rhythm_after: "base", alt_text: null },
        { id: "p_m3", source_ref: "x/c.jpg", caption: null, rhythm_after: "base", alt_text: null },
      ],
    });
    const view = buildHomeView({
      galleries: [gallery],
      places: makePlaces([]),
      home: { featured_gallery_id: "g_multi" },
      resolveCover,
      mode: "production",
    });
    expect(view.hero?.photoCount).toBe(3);
  });

  test("cover resolves via cover_photo_id → resolveCover; NEVER the first photo", () => {
    const gallery = makeGallery({
      id: "g_cover",
      cover_photo_id: "p_cover_late",
      photos: [
        {
          id: "p_cover_first",
          source_ref: "x/a.jpg",
          caption: null,
          rhythm_after: "base",
          alt_text: null,
        },
        {
          id: "p_cover_late",
          source_ref: "x/b.jpg",
          caption: null,
          rhythm_after: "base",
          alt_text: null,
        },
      ],
    });
    const view = buildHomeView({
      galleries: [gallery],
      places: makePlaces([]),
      home: { featured_gallery_id: "g_cover" },
      resolveCover,
      mode: "production",
    });
    expect(view.hero?.cover?.photoId).toBe("p_cover_late");
    expect(view.hero?.cover?.src).toBe("/p_cover_late.jpg");
  });

  test("place references resolve to name/region/country", () => {
    const view = buildHomeView({
      galleries: [makeGallery({ id: "g_a", places: ["pl_alpha"] })],
      places: makePlaces([]),
      home: { featured_gallery_id: "g_a" },
      resolveCover,
      mode: "production",
    });
    expect(view.hero?.places).toEqual([
      { id: "pl_alpha", name: "Alpha", region: "North Region", country: "Norway" },
    ]);
  });

  test("output is plain serializable data (JSON round-trip stable)", () => {
    const view = buildHomeView({
      galleries: [makeGallery({ id: "g_a" })],
      places: makePlaces([]),
      home: { featured_gallery_id: "g_a" },
      resolveCover,
      mode: "production",
    });
    expect(JSON.parse(JSON.stringify(view))).toEqual(view);
  });
});

// ---------------------------------------------------------------------------
// ArchiveView
// ---------------------------------------------------------------------------

describe("buildArchiveView", () => {
  test("groups by PHOTOGRAPHED year, never published_at (UD-003)", () => {
    const galleries = [
      makeGallery({ id: "g_24", photographed_start: "2024-06-01", photographed_end: "2024-06-10" }),
      makeGallery({ id: "g_25", photographed_start: "2025-02-01" }),
    ];
    // Both published in 2026 — a 2026 group would prove published_at leakage.
    const view = buildArchiveView({
      galleries,
      places: makePlaces([]),
      resolveCover,
      mode: "production",
    });
    expect(view.years.map((y) => y.year)).toEqual([2025, 2024]);
  });

  test("year groups DESC; intra-year photographed_start DESC with stable ID tie-break", () => {
    const galleries = [
      makeGallery({ id: "g_b25", photographed_start: "2025-05-01" }),
      makeGallery({ id: "g_a24", photographed_start: "2024-01-01" }),
      makeGallery({ id: "g_z24", photographed_start: "2024-03-01" }),
      makeGallery({ id: "g_a25", photographed_start: "2025-01-01" }),
    ];
    const view = buildArchiveView({
      galleries,
      places: makePlaces([]),
      resolveCover,
      mode: "production",
    });
    expect(view.years.map((y) => y.year)).toEqual([2025, 2024]);
    expect(ALL_IDS(view.years[0].galleries)).toEqual(["g_b25", "g_a25"]);
    // Intra-year: photographed_start DESC → g_z24 (03-01) before g_a24 (01-01).
    expect(ALL_IDS(view.years[1].galleries)).toEqual(["g_z24", "g_a24"]);
  });

  test("same photographed_start inside one year → stable ID ascending tie-break", () => {
    const galleries = [
      makeGallery({ id: "g_b", photographed_start: "2025-05-01" }),
      makeGallery({ id: "g_a", photographed_start: "2025-05-01" }),
    ];
    const view = buildArchiveView({
      galleries,
      places: makePlaces([]),
      resolveCover,
      mode: "production",
    });
    expect(ALL_IDS(view.years[0].galleries)).toEqual(["g_a", "g_b"]);
  });

  test("production: drafts absent; preview: drafts surface with isDraft", () => {
    const galleries = [
      makeGallery({ id: "g_pub", photographed_start: "2025-02-01" }),
      makeGallery({
        id: "g_draft",
        status: "draft",
        published_at: null,
        photographed_start: "2025-06-01",
      }),
    ];
    const production = buildArchiveView({
      galleries,
      places: makePlaces([]),
      resolveCover,
      mode: "production",
    });
    expect(ALL_IDS(production.years.flatMap((y) => y.galleries))).toEqual(["g_pub"]);
    const preview = buildArchiveView({
      galleries,
      places: makePlaces([]),
      resolveCover,
      mode: "preview",
    });
    expect(ALL_IDS(preview.years.flatMap((y) => y.galleries))).toEqual(["g_draft", "g_pub"]);
    expect(preview.years[0].galleries.find((c) => c.id === "g_draft")?.isDraft).toBe(true);
  });

  test("single-gallery archive edge case: one year, one card", () => {
    const view = buildArchiveView({
      galleries: [makeGallery({ id: "g_only", photographed_start: "2019-11-02" })],
      places: makePlaces([]),
      resolveCover,
      mode: "production",
    });
    expect(view.years).toHaveLength(1);
    expect(view.years[0].year).toBe(2019);
    expect(ALL_IDS(view.years[0].galleries)).toEqual(["g_only"]);
  });
});

// ---------------------------------------------------------------------------
// PlacesView
// ---------------------------------------------------------------------------

describe("buildPlacesView", () => {
  test("alphabetical names-led ordering (deterministic, numeric-aware)", () => {
    const places: Place[] = [
      { id: "pl_t", slug: "tromso", name: "Tromsø", region: null, country: null },
      { id: "pl_a", slug: "alpha", name: "Alpha", region: null, country: null },
      { id: "pl_b2", slug: "beta-2", name: "Beta 2", region: null, country: null },
      { id: "pl_b10", slug: "beta-10", name: "Beta 10", region: null, country: null },
    ];
    const view = buildPlacesView({ places, galleries: [], mode: "preview" });
    expect(view.places.map((p) => p.name)).toEqual(["Alpha", "Beta 2", "Beta 10", "Tromsø"]);
  });

  test("equal names tie-break by slug (Springfield IL/MO disambiguation pair stays deterministic)", () => {
    const places: Place[] = [
      {
        id: "pl_s_mo",
        slug: "springfield-mo",
        name: "Springfield",
        region: "Missouri",
        country: "USA",
      },
      {
        id: "pl_s_il",
        slug: "springfield-il",
        name: "Springfield",
        region: "Illinois",
        country: "USA",
      },
    ];
    const view = buildPlacesView({ places, galleries: [], mode: "preview" });
    expect(view.places.map((p) => p.slug)).toEqual(["springfield-il", "springfield-mo"]);
  });

  test("NO counts anywhere in the shape (FDS §3.4 / CONTENT_MODEL §6.3)", () => {
    const view = buildPlacesView({ places: makePlaces([]), galleries: [], mode: "preview" });
    for (const entry of view.places) {
      expect(Object.keys(entry).sort()).toEqual([
        "country",
        "cover",
        "id",
        "name",
        "region",
        "slug",
      ]);
      expect(JSON.stringify(entry)).not.toMatch(/count(?!ry)/i);
    }
  });

  test("production: only places with at least one PUBLISHED gallery; preview: all parsed places", () => {
    const places: Place[] = [
      { id: "pl_used", slug: "used", name: "Used", region: null, country: null },
      { id: "pl_draftonly", slug: "draft-only", name: "Draft Only", region: null, country: null },
      { id: "pl_orphan", slug: "orphan", name: "Orphan", region: null, country: null },
    ];
    const galleries = [
      makeGallery({
        id: "g_pub",
        places: ["pl_used"],
        photos: [
          {
            id: "p_pub_001",
            source_ref: "x/master.jpg",
            caption: null,
            rhythm_after: "base",
            alt_text: null,
            place: "pl_used",
          },
        ],
      }),
      makeGallery({
        id: "g_draft",
        status: "draft",
        published_at: null,
        places: ["pl_draftonly"],
      }),
    ];
    const production = buildPlacesView({ places, galleries, mode: "production" });
    expect(production.places.map((p) => p.id)).toEqual(["pl_used"]);
    const preview = buildPlacesView({ places, galleries, mode: "preview" });
    expect(preview.places.map((p) => p.id)).toEqual(["pl_draftonly", "pl_orphan", "pl_used"]);
  });

  test("deterministic: same input → deep-equal output across runs", () => {
    const input = {
      places: makePlaces([]),
      galleries: [makeGallery({ id: "g_a" })],
      mode: "production" as const,
    };
    expect(buildPlacesView(input)).toEqual(buildPlacesView(input));
  });
});

// ---------------------------------------------------------------------------
// PlaceView
// ---------------------------------------------------------------------------

describe("buildPlaceView", () => {
  test("lists ONLY that place's published galleries with photographed dates", () => {
    const galleries = [
      makeGallery({ id: "g_here", places: ["pl_alpha"], photographed_start: "2025-02-01" }),
      makeGallery({ id: "g_there", places: ["pl_beta"], photographed_start: "2025-03-01" }),
    ];
    const view = buildPlaceView({
      place: PLACES[0],
      places: makePlaces([]),
      galleries,
      resolveCover,
      mode: "production",
    });
    expect(view.place.id).toBe("pl_alpha");
    expect(ALL_IDS(view.galleries)).toEqual(["g_here"]);
    expect(view.galleries[0].photographedStart).toBe("2025-02-01");
    expect(view.galleries[0].photographedEnd).toBe("2025-02-07");
  });

  test("photographed chronology: photographed_start DESC with stable ID tie-break (FDS §3.4)", () => {
    const galleries = [
      makeGallery({ id: "g_b", places: ["pl_alpha"], photographed_start: "2025-05-01" }),
      makeGallery({ id: "g_a", places: ["pl_alpha"], photographed_start: "2025-01-01" }),
      makeGallery({ id: "g_tie2", places: ["pl_alpha"], photographed_start: "2025-01-01" }),
    ];
    const view = buildPlaceView({
      place: PLACES[0],
      places: makePlaces([]),
      galleries,
      resolveCover,
      mode: "production",
    });
    expect(ALL_IDS(view.galleries)).toEqual(["g_b", "g_a", "g_tie2"]);
  });

  test("production: drafts absent; preview: drafts surface with isDraft", () => {
    const galleries = [
      makeGallery({ id: "g_pub", places: ["pl_alpha"] }),
      makeGallery({ id: "g_draft", status: "draft", published_at: null, places: ["pl_alpha"] }),
    ];
    const production = buildPlaceView({
      place: PLACES[0],
      places: makePlaces([]),
      galleries,
      resolveCover,
      mode: "production",
    });
    expect(ALL_IDS(production.galleries)).toEqual(["g_pub"]);
    const preview = buildPlaceView({
      place: PLACES[0],
      places: makePlaces([]),
      galleries,
      resolveCover,
      mode: "preview",
    });
    expect(ALL_IDS(preview.galleries)).toEqual(["g_draft", "g_pub"]);
  });

  test("covers resolve via cover_photo_id, never first-photo", () => {
    const galleries = [
      makeGallery({
        id: "g_cover",
        places: ["pl_alpha"],
        cover_photo_id: "p_cover_second",
        photos: [
          {
            id: "p_cover_first",
            source_ref: "x/a.jpg",
            caption: null,
            rhythm_after: "base",
            alt_text: null,
          },
          {
            id: "p_cover_second",
            source_ref: "x/b.jpg",
            caption: null,
            rhythm_after: "base",
            alt_text: null,
          },
        ],
      }),
    ];
    const view = buildPlaceView({
      place: PLACES[0],
      places: makePlaces([]),
      galleries,
      resolveCover,
      mode: "production",
    });
    expect(view.galleries[0].cover?.photoId).toBe("p_cover_second");
  });
});
