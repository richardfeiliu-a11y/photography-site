// WP-25 integration tests — view builders over the REAL authored corpus
// (real src/content.config.ts glob loaders, real YAML, real home settings).
//
// Frozen brief requirement: "fixture corpus views snapshot-stable across runs"
// plus the UD-003 ordering consequence proven on real data: the corpus's
// galleries are ALL published_at 2026-08-29 (honest archive-import instants,
// CONTENT_MODEL §7 rule 3) while photographed dates span 2019–2025 — any
// published_at leakage into archive grouping would fabricate a 2026 year.
//
// Covers are resolved through a deterministic stub resolver: cover DERIVATIVE
// resolution via the WP-24 selector surface is a page-level composition (the
// manifest is a build-time artifact; view builders are pure). The
// cover_photo_id → selector contract is pinned by WP-24's own tests.
import { describe, expect, test } from "vitest";
import { loadCollection, PROJECT_ROOT_URL } from "../support/content-layer";
import { loadHomeSettings } from "../../src/lib/content/home";
import { buildHomeView } from "../../src/lib/views/home";
import { buildArchiveView } from "../../src/lib/views/archive";
import { buildPlacesView } from "../../src/lib/views/places";
import { buildPlaceView } from "../../src/lib/views/place";
import { loadArchive } from "../../scripts/validate/content";
import { composeArchiveValidation } from "../../src/lib/validate/production";
import type { Gallery, Place } from "../../src/content-schemas";

const REPO_ROOT = new URL("../../", import.meta.url).pathname;

const stubCover = (photoId: string) => ({
  photoId,
  src: `/stub/${photoId}.jpg`,
  srcset: `/stub/${photoId}.jpg 480w, /stub/${photoId}.jpg 800w`,
  width: 800,
  height: 600,
});

describe("WP-25 view builders over the real authored corpus", () => {
  test("ArchiveView: photographed-year grouping is snapshot-stable and never leaks published_at", async () => {
    const { entries: galleryEntries } = await loadCollection("galleries");
    const { entries: placeEntries } = await loadCollection("places");
    const galleries = galleryEntries.map((e) => e.data as unknown as Gallery);
    const places = placeEntries.map((e) => e.data as unknown as Place);

    const input = { galleries, places, resolveCover: stubCover, mode: "production" as const };
    const first = buildArchiveView(input);
    const second = buildArchiveView(input);
    expect(JSON.parse(JSON.stringify(first))).toEqual(second); // snapshot-stable

    const years = first.years.map((y) => y.year);
    // Exact expected year set derived independently in the test from the
    // corpus's published photographed_start values, sorted DESC — catches
    // grouping regressions AND any corpus/year drift, not just sortedness.
    const expectedYears = [
      ...new Set(
        galleries
          .filter((g) => g.status === "published")
          .map((g) => new Date(`${g.photographed_start}T00:00:00Z`).getUTCFullYear()),
      ),
    ].sort((a, b) => b - a);
    expect(years).toEqual(expectedYears);
    // UD-003 consequence on real data: year groups come from photographed
    // dates ONLY. No group may equal a year that appears solely as a
    // publication year across the corpus.
    const photographedYears = new Set(
      galleries
        .filter((g) => g.status === "published")
        .map((g) => new Date(`${g.photographed_start}T00:00:00Z`).getUTCFullYear()),
    );
    for (const y of years) {
      expect(photographedYears.has(y), `year ${y} must come from photographed_start`).toBe(true);
    }
    const cardIds = first.years.flatMap((y) => y.galleries.map((c) => c.id)).sort();
    expect(cardIds).toEqual(
      galleries
        .filter((g) => g.status === "published")
        .map((g) => g.id)
        .sort(),
    );
    // Counts come from photos[] length on real data.
    const counts = new Map(
      first.years.flatMap((y) => y.galleries).map((c) => [c.id, c.photoCount]),
    );
    expect(counts.get("g_lofoten_polar_night")).toBe(11);
    expect(counts.get("g_netherlands")).toBe(28);
  });

  test("HomeView: hero = configured featured (g_lofoten_polar_night); Recent = full §10.4 order", async () => {
    const { entries: galleryEntries } = await loadCollection("galleries");
    const { entries: placeEntries } = await loadCollection("places");
    const galleries = galleryEntries.map((e) => e.data as unknown as Gallery);
    const places = placeEntries.map((e) => e.data as unknown as Place);
    const home = loadHomeSettings(PROJECT_ROOT_URL);

    const view = buildHomeView({
      galleries,
      places,
      home,
      resolveCover: stubCover,
      mode: "production",
    });
    expect(view.hero?.id).toBe("g_lofoten_polar_night");
    expect(view.hero?.slug).toBe("lofoten-polar-night");
    expect(view.hero?.cover?.photoId).toBe("p_lofoten_polar_night_010");
    expect(view.hero?.places.map((p) => p.id)).toEqual(["pl_lofoten"]);
    // The 72-photo draft stress set never surfaces on Home.
    expect(view.recent.some((c) => c.id === "g_long_gallery_72")).toBe(false);
    // Recent is deterministic across runs.
    const again = buildHomeView({
      galleries,
      places,
      home,
      resolveCover: stubCover,
      mode: "production",
    });
    expect(again.recent.map((c) => c.id)).toEqual(view.recent.map((c) => c.id));
  });

  test("PlacesView: names-led, no counts, production scope = gallery-or-photo publicity", async () => {
    const { entries: galleryEntries } = await loadCollection("galleries");
    const { entries: placeEntries } = await loadCollection("places");
    const galleries = galleryEntries.map((e) => e.data as unknown as Gallery);
    const places = placeEntries.map((e) => e.data as unknown as Place);

    const production = buildPlacesView({ places, galleries, mode: "production" });
    // Monograph atlas scope: the INDEX lists the places with at least one
    // PUBLISHED photo carrying an explicit photo-level reference (the
    // attributed set). Places that only appear in a gallery-level places[]
    // list keep their public route (WP-13 owns route publicity) but are not
    // offered as atlas cards without an attributed photograph.
    const expectedIds = [
      ...new Set(
        galleries
          .filter((g) => g.status === "published")
          .flatMap((g) => g.photos.filter((p) => p.place != null).map((p) => p.place!)),
      ),
    ].sort();
    expect(production.places.map((p) => p.id).sort()).toEqual(expectedIds);
    // No counts anywhere on real data either (§6.3/FDS §3.4); the only
    // non-authored addition is the derived representative cover.
    for (const entry of production.places) {
      expect(Object.keys(entry).sort()).toEqual([
        "country",
        "cover",
        "id",
        "name",
        "region",
        "slug",
      ]);
    }
    // Region/country survive the projection on real data.
    const nanchang = production.places.find((p) => p.id === "pl_nanchang");
    expect(nanchang?.name).toBe("Nanchang");
    expect(nanchang?.region).toBeTruthy();
  });

  test("PlacesView index scope is a SUBSET of the WP-13 public places (routes unchanged)", async () => {
    // Monograph §6.5: the atlas index shows the attributed (photo-level)
    // places only, while WP-13 keeps owning which places have a public
    // route. This pin proves the index never offers a place the validator
    // does not publish, and that the difference is exactly the places whose
    // only reference is gallery-level.
    const { entries: galleryEntries } = await loadCollection("galleries");
    const { entries: placeEntries } = await loadCollection("places");
    const galleries = galleryEntries.map((e) => e.data as unknown as Gallery);
    const places = placeEntries.map((e) => e.data as unknown as Place);

    const result = composeArchiveValidation(loadArchive(REPO_ROOT), {
      mode: "production",
      ingestRoot: `${REPO_ROOT}media/ingest-masters`,
    });
    expect(result.ok).toBe(true);
    const view = buildPlacesView({ places, galleries, mode: "production" });
    const published = new Set(result.publishedDataSet.places.map((p) => p.id));
    for (const entry of view.places) {
      expect(published.has(entry.id), `${entry.id} must be a public place`).toBe(true);
    }
    // The difference is exactly the gallery-level-only places.
    const attributed = new Set(
      galleries
        .filter((g) => g.status === "published")
        .flatMap((g) => g.photos.filter((p) => p.place != null).map((p) => p.place!)),
    );
    const galleryOnlyExtra = [...published].filter((id) => !attributed.has(id));
    expect(view.places.map((p) => p.id).sort()).toEqual([...attributed].sort());
    expect(galleryOnlyExtra.length).toBeGreaterThan(0);
  });

  test("PlaceView: real place lists exactly its published galleries with photographed dates", async () => {
    const { entries: galleryEntries } = await loadCollection("galleries");
    const { entries: placeEntries } = await loadCollection("places");
    const galleries = galleryEntries.map((e) => e.data as unknown as Gallery);
    const places = placeEntries.map((e) => e.data as unknown as Place);
    const lofoten = places.find((p) => p.id === "pl_lofoten");
    expect(lofoten).toBeDefined();

    const view = buildPlaceView({
      place: lofoten as Place,
      places,
      galleries,
      resolveCover: stubCover,
      mode: "production",
    });
    expect(view.place.slug).toBe("lofoten");
    expect(view.galleries.length).toBeGreaterThan(0);
    for (const card of view.galleries) {
      expect(card.places.some((p) => p.id === "pl_lofoten")).toBe(true);
      expect(card.photographedStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    // Photographed chronology DESC on real data.
    const starts = view.galleries.map((c) => c.photographedStart);
    expect(starts).toEqual([...starts].sort((a, b) => (a < b ? 1 : -1)));
  });
});
