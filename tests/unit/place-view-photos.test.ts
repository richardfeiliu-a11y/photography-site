// Unit contract for the R3 cross-journey photo aggregation
// (docs/reports/gallery-r3-fix-agent-handoff-2026-09-13.md §3):
//   - only EXPLICIT photo-level place refs enter the collection;
//   - caption strings and gallery-level places[] never attribute a photo;
//   - ordering is captured_at DESC with the documented fallback;
//   - unconfirmed photos stay out (and remain in their journey).
import { describe, expect, test } from "vitest";
import { buildPlaceView } from "../../src/lib/views/place";
import type { Gallery, Place } from "../../src/content-schemas";
import type { CoverResolver } from "../../src/lib/views/types";

const placeAmsterdam = { id: "pl_amsterdam", slug: "amsterdam", name: "Amsterdam", region: "North Holland", country: "Netherlands" } as unknown as Place;
const placeCologne = { id: "pl_cologne", slug: "cologne", name: "Cologne", region: "NRW", country: "Germany" } as unknown as Place;
const places = [placeAmsterdam, placeCologne] as unknown as ReadonlyArray<Place>;

function gallery(overrides: Partial<Gallery>): Gallery {
  return {
    id: "g_x",
    slug: "x",
    status: "published",
    title: "X",
    photographed_start: "2024-07-12",
    photographed_end: "2024-07-14",
    published_at: "2026-09-12T00:00:00Z",
    places: ["pl_amsterdam"],
    photos: [],
    ...overrides,
  } as unknown as Gallery;
}

const noCover: CoverResolver = () => {
  throw new Error("no cover expected");
};

describe("place photo aggregation", () => {
  test("collects only explicit photo-level refs; caption strings never attribute", () => {
    const g = gallery({
      id: "g_nl",
      slug: "netherlands",
      title: "Netherlands",
      photos: [
        { id: "p_a", source_ref: "netherlands/a.jpg", caption: "Amsterdam · 2024-07" },
        { id: "p_b", source_ref: "netherlands/b.jpg", place: "pl_amsterdam", captured_at: "2024-07-13T09:00:00" },
        { id: "p_c", source_ref: "netherlands/c.jpg", caption: "Cologne & The Hague", place: "pl_cologne" },
      ],
    } as never);
    const amsterdam = buildPlaceView({ place: placeAmsterdam, places, galleries: [g], resolveCover: noCover, mode: "production" });
    expect(amsterdam.photos.map((p) => p.photoId)).toEqual(["p_b"]);
    // The caption says Amsterdam but without a ref it must NOT aggregate.
    const cologne = buildPlaceView({ place: placeCologne, places, galleries: [g], resolveCover: noCover, mode: "production" });
    expect(cologne.photos.map((p) => p.photoId)).toEqual(["p_c"]);
  });

  test("aggregates the same place across journeys, photo id carries the source gallery", () => {
    const g1 = gallery({
      id: "g_nl", slug: "netherlands", title: "Netherlands",
      photos: [{ id: "p_1", source_ref: "a.jpg", place: "pl_amsterdam", captured_at: "2024-07-13T09:00:00" }],
    } as never);
    const g2 = gallery({
      id: "g_we", slug: "winter-europe", title: "Winter Europe", photographed_start: "2025-01-05",
      photos: [{ id: "p_2", source_ref: "b.jpg", place: "pl_amsterdam", captured_at: "2025-01-10T11:25:00" }],
    } as never);
    const view = buildPlaceView({ place: placeAmsterdam, places, galleries: [g1, g2], resolveCover: noCover, mode: "production" });
    expect(view.photos.map((p) => p.gallerySlug)).toEqual(["winter-europe", "netherlands"]);
  });

  test("sorts captured_at DESC; missing captured_at falls back to gallery photographed_start", () => {
    const g = gallery({
      id: "g_nl", slug: "netherlands", title: "Netherlands", photographed_start: "2024-07-01",
      photos: [
        { id: "p_old", source_ref: "a.jpg", place: "pl_amsterdam" },
        { id: "p_mid", source_ref: "b.jpg", place: "pl_amsterdam", captured_at: "2024-07-13T09:00:00" },
        { id: "p_new", source_ref: "c.jpg", place: "pl_amsterdam", captured_at: "2024-07-13T21:32:42" },
      ],
    } as never);
    const view = buildPlaceView({ place: placeAmsterdam, places, galleries: [g], resolveCover: noCover, mode: "production" });
    // 21:32 > 09:00 > gallery fallback (2024-07-01T00:00 string < timestamps).
    expect(view.photos.map((p) => p.photoId)).toEqual(["p_new", "p_mid", "p_old"]);
  });

  test("draft-gallery photos never leak in production mode", () => {
    const draft = gallery({
      id: "g_draft", slug: "draft", status: "draft",
      photos: [{ id: "p_d", source_ref: "d.jpg", place: "pl_amsterdam" }],
    } as never);
    const view = buildPlaceView({ place: placeAmsterdam, places, galleries: [draft], resolveCover: noCover, mode: "production" });
    expect(view.photos).toEqual([]);
    const preview = buildPlaceView({ place: placeAmsterdam, places, galleries: [draft], resolveCover: noCover, mode: "preview" });
    expect(preview.photos.map((p) => p.photoId)).toEqual(["p_d"]);
  });
});
