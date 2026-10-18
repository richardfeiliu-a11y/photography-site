import { describe, expect, it } from "vitest";
import type { Gallery, Place } from "../../src/content-schemas";
import { buildPlacesView } from "../../src/lib/views/places";
import type { ViewCover } from "../../src/lib/views/types";

function place(id: string, name: string = id, slug?: string): Place {
  return { id, slug: slug ?? id.replace(/^pl_/, ""), name, region: "Region", country: "Country" };
}

function gallery(id: string, start: string, places: string[], cover: string): Gallery {
  return {
    id,
    slug: id.replace(/^g_/, "").replaceAll("_", "-"),
    status: "published",
    title: id,
    description: null,
    photographed_start: start,
    photographed_end: start,
    published_at: "2026-09-12T00:00:00Z",
    places,
    cover_photo_id: cover,
    next_gallery_id: undefined,
    photos: [
      {
        id: cover,
        source_ref: `m/${cover}.jpg`,
        rhythm_after: "base",
        alt_text: null,
        place: places[0],
      },
    ],
  } as Gallery;
}

const PLACES = [place("pl_alpha", "Alpha"), place("pl_beta", "Beta")];
const GALLERIES = [
  gallery("g_old", "2024-01-01", ["pl_alpha"], "p_old_cover"),
  gallery("g_new", "2025-06-01", ["pl_alpha"], "p_new_cover"),
  gallery("g_beta", "2025-01-01", ["pl_beta"], "p_beta_cover"),
];

const cover = (id: string): ViewCover =>
  ({ photoId: id, src: `/media/${id}.jpg`, srcset: "", width: 480, height: 320 }) as ViewCover;

describe("buildPlacesView atlas covers", () => {
  it("keeps name-asc ordering and attaches the most recent contributor's cover", () => {
    const view = buildPlacesView({
      places: PLACES,
      galleries: GALLERIES,
      mode: "production",
      resolveCover: (id) => cover(id),
    });
    expect(view.places.map((p) => p.slug)).toEqual(["alpha", "beta"]);
    expect(view.places[0]?.cover?.photoId).toBe("p_new_cover");
    expect(view.places[1]?.cover?.photoId).toBe("p_beta_cover");
  });

  it("photo-level contribution qualifies a place", () => {
    const galleries = [
      {
        ...gallery("g_photo", "2025-03-03", [], "p_photo_cover"),
        photos: [
          {
            id: "p_photo_cover",
            source_ref: "m/x.jpg",
            rhythm_after: "base" as const,
            alt_text: null,
            place: "pl_beta",
          },
        ],
      },
    ];
    const view = buildPlacesView({
      places: [place("pl_beta", "Beta")],
      galleries,
      mode: "production",
      resolveCover: cover,
    });
    expect(view.places[0]?.cover?.photoId).toBe("p_photo_cover");
  });

  it("emits null cover without a resolver or published gallery, and never a count field", () => {
    const withNoResolver = buildPlacesView({
      places: PLACES,
      galleries: GALLERIES,
      mode: "production",
    });
    expect(withNoResolver.places[0]?.cover).toBeNull();
    expect("photoCount" in (withNoResolver.places[0] ?? {})).toBe(false);
  });
});
