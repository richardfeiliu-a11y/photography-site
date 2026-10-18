// WP-33 unit tests — the GalleryView builder (pure data contract consumed by
// WP-34..37).
//
// Frozen references: CONTENT_MODEL §9 (photo order = AUTHORED array order —
// never EXIF/filename/orientation/similarity reordering), §8 (next_gallery_id
// resolution via ID → target title+slug), IMAGE_PIPELINE §10.4 (manifest
// selector surface; missing entry fails closed), RUNTIME §4.1 (origin safe
// static fallback), §10.1 (canonical /galleries/{slug}).
//
// RED first: fails before src/lib/views/gallery.ts exists.
import { describe, expect, test } from "vitest";
import type { Gallery, Place } from "../../src/content-schemas";
import { buildGalleryView } from "../../src/lib/views/gallery";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeGallery(overrides: Partial<Gallery> & Pick<Gallery, "id">): Gallery {
  const slug = overrides.id.replace(/^g_/, "").replace(/_/g, "-");
  const prefix = overrides.id.replace(/^g_/, "p_");
  const photos = [3, 1, 2].map((n) => ({
    id: `${prefix}_00${n}`,
    source_ref: "x/master.jpg",
    caption: n === 1 ? "First frame caption" : null,
    rhythm_after: (n === 1 ? "breathing" : "base") as "breathing" | "base",
    alt_text: null,
  }));
  return {
    slug,
    status: "published",
    title: `Title of ${overrides.id}`,
    description: null,
    photographed_start: "2025-02-01",
    photographed_end: "2025-02-07",
    published_at: "2026-08-29T00:00:00Z",
    places: ["pl_alpha"],
    cover_photo_id: `${prefix}_001`,
    next_gallery_id: undefined,
    photos,
    ...overrides,
  } as Gallery;
}

const PLACES: Place[] = [
  { id: "pl_alpha", slug: "alpha", name: "Alpha", region: "R", country: "C" },
];

/** Display resolver: deterministic per photo (WP-24 selector stand-in). */
const resolveDisplay = (photoId: string) => ({
  photoId,
  src: `/display/${photoId}.jpg`,
  srcset: `/display/${photoId}.jpg 480w, /display/${photoId}.jpg 2048w`,
  width: 2048,
  height: 1365,
});

const NEXT_MAP: Record<string, string | null> = {
  g_alpha: "g_beta",
  g_beta: null,
};

// ---------------------------------------------------------------------------
// Sequence order (authored array order is authority — §9)
// ---------------------------------------------------------------------------

describe("buildGalleryView — photo sequence", () => {
  test("photos preserve AUTHORED array order (fixture is deliberately 3,1,2)", () => {
    const gallery = makeGallery({ id: "g_alpha" });
    const view = buildGalleryView({
      gallery,
      places: PLACES,
      nextGalleryMap: NEXT_MAP,
      resolveDisplay,
    });
    expect(view.photos.map((p) => p.photoId)).toEqual([
      "p_alpha_003",
      "p_alpha_001",
      "p_alpha_002",
    ]);
  });

  test("per-photo rhythm_after and caption come from the authored data", () => {
    const view = buildGalleryView({
      gallery: makeGallery({ id: "g_alpha" }),
      places: PLACES,
      nextGalleryMap: NEXT_MAP,
      resolveDisplay,
    });
    expect(view.photos[0]).toMatchObject({ photoId: "p_alpha_003", caption: null });
    expect(view.photos[1]).toMatchObject({
      photoId: "p_alpha_001",
      caption: "First frame caption",
      rhythmAfter: "breathing",
    });
  });

  test("display derivatives resolve per photo via the injected selector", () => {
    const view = buildGalleryView({
      gallery: makeGallery({ id: "g_alpha" }),
      places: PLACES,
      nextGalleryMap: NEXT_MAP,
      resolveDisplay,
    });
    expect(view.photos[0].display).toMatchObject({
      src: "/display/p_alpha_003.jpg",
      width: 2048,
      height: 1365,
    });
  });

  test("missing display resolution for a photo THROWS (closure fail-closed)", () => {
    const gallery = makeGallery({ id: "g_alpha" });
    expect(() =>
      buildGalleryView({
        gallery,
        places: PLACES,
        nextGalleryMap: NEXT_MAP,
        resolveDisplay: (photoId) => {
          if (photoId === "p_alpha_002") {
            throw new Error("[24:variant-missing] no gallery_display records");
          }
          return resolveDisplay(photoId);
        },
      }),
    ).toThrow(/variant-missing|gallery_display/);
  });
});

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

describe("buildGalleryView — header", () => {
  test("header carries title, description|null, photographed range, places, count", () => {
    const gallery = makeGallery({
      id: "g_alpha",
      description: "A short description.",
    });
    const view = buildGalleryView({
      gallery,
      places: PLACES,
      nextGalleryMap: NEXT_MAP,
      resolveDisplay,
    });
    expect(view.header).toEqual({
      title: "Title of g_alpha",
      description: "A short description.",
      photographedStart: "2025-02-01",
      photographedEnd: "2025-02-07",
      places: [{ id: "pl_alpha", name: "Alpha", region: "R", country: "C" }],
      photoCount: 3,
      slug: "alpha",
    });
  });

  test("description null when absent (no reserved block decision belongs to WP-34)", () => {
    const view = buildGalleryView({
      gallery: makeGallery({ id: "g_alpha", description: null }),
      places: PLACES,
      nextGalleryMap: NEXT_MAP,
      resolveDisplay,
    });
    expect(view.header.description).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Continuation (RUNTIME §4)
// ---------------------------------------------------------------------------

describe("buildGalleryView — continuation", () => {
  test("standard variant: next ID resolves to target TITLE + SLUG via the map", () => {
    const beta = makeGallery({ id: "g_beta", title: "Beta Gallery" });
    const view = buildGalleryView({
      gallery: makeGallery({ id: "g_alpha" }),
      places: PLACES,
      nextGalleryMap: NEXT_MAP,
      allGalleries: [makeGallery({ id: "g_alpha" }), beta],
      resolveDisplay,
    });
    expect(view.continuation).toEqual({
      kind: "standard",
      nextTitle: "Beta Gallery",
      nextSlug: "beta",
      originFallback: "/archive",
    });
  });

  test("no-next variant when nextGalleryMap maps the gallery to null", () => {
    const view = buildGalleryView({
      gallery: makeGallery({ id: "g_beta" }),
      places: PLACES,
      nextGalleryMap: NEXT_MAP,
      allGalleries: [makeGallery({ id: "g_beta" })],
      resolveDisplay,
    });
    expect(view.continuation).toEqual({
      kind: "no-next",
      nextTitle: null,
      nextSlug: null,
      originFallback: "/archive",
    });
  });

  test("next ID absent from the map (draft target in production) → no-next variant, not a crash", () => {
    const view = buildGalleryView({
      gallery: makeGallery({ id: "g_alpha" }),
      places: PLACES,
      nextGalleryMap: { g_alpha: null },
      allGalleries: [makeGallery({ id: "g_alpha" })],
      resolveDisplay,
    });
    expect(view.continuation.kind).toBe("no-next");
  });

  test("exif is null without a resolver and passes through when one is supplied", () => {
    const without = buildGalleryView({
      gallery: makeGallery({ id: "g_alpha" }),
      places: PLACES,
      nextGalleryMap: NEXT_MAP,
      resolveDisplay,
    });
    expect(without.photos.map((p) => p.exif)).toEqual([null, null, null]);

    const withExif = buildGalleryView({
      gallery: makeGallery({ id: "g_alpha" }),
      places: PLACES,
      nextGalleryMap: NEXT_MAP,
      resolveDisplay,
      resolveExif: (id) => (id.endsWith("_001") ? { iso: 100, fNumber: [8, 1] } : null),
    });
    expect(withExif.photos.find((p) => p.photoId.endsWith("_001"))?.exif).toEqual({
      iso: 100,
      fNumber: [8, 1],
    });
    expect(withExif.photos.find((p) => p.photoId.endsWith("_002"))?.exif).toBeNull();
  });
});
