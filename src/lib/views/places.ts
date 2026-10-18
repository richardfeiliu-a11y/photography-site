// WP-25 — PlacesView builder (pure data).
//
// Frozen references: CONTENT_MODEL §6.3 (NO counts, no Visit/Trip/coordinates
// — the entry shape carries none), FDS §3.4 (names-led; region/country ONLY
// for disambiguation), BUILD_AND_ROUTING §4 (production places = places with
// at least one PUBLISHED gallery — the WP-13 publishedDataSet.places contract;
// preview keeps all parsed places, ADR-020).
//
// Implementation-level decision (recorded in docs/implementation/WP-25.md):
// ordering = name ascending via a fixed Intl collator (locale "en",
// sensitivity "base", numeric true) with slug-ascending tie-break — plain
// code-unit sort would misorder "Tromsø"/"南昌 Nanchang" and the equal-name
// Springfield pair must stay deterministic.

import type { Gallery, Place } from "../../content-schemas";
import { modeScopedGalleries, type ViewCover, type ViewMode } from "./types";

export interface PlacesViewInput {
  places: ReadonlyArray<Place>;
  /** Production scope needs the galleries to apply the §4 published rule. */
  galleries: ReadonlyArray<Gallery>;
  mode: ViewMode;
  /** Resolves the representative cover (Monograph visual atlas). */
  resolveCover?: (photoId: string) => ViewCover | null;
}

export interface PlacesViewEntry {
  id: string;
  slug: string;
  name: string;
  region: string | null;
  country: string | null;
  /** Representative gallery cover for the atlas; null when unresolved. */
  cover: ViewCover | null;
}

export interface PlacesView {
  /** Names-ascending entries; NO counts anywhere (FDS §3.4 / §6.3). */
  places: PlacesViewEntry[];
}

const NAME_COLLATOR = new Intl.Collator("en", { sensitivity: "base", numeric: true });

function comparePlaces(a: Place, b: Place): number {
  const byName = NAME_COLLATOR.compare(a.name, b.name);
  if (byName !== 0) return byName;
  // Equal display names (e.g. Springfield IL/MO): slug ascending keeps the
  // order deterministic and mirrors the disambiguated route namespace.
  return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
}

export function buildPlacesView(input: PlacesViewInput): PlacesView {
  let scoped = [...input.places];
  if (input.mode === "production") {
    // The ATLAS index lists only places with at least one PUBLISHED photo
    // carrying a photo-level place reference (the confirmed/attributed set —
    // 38 in the real archive). Gallery-level mentions without an attributed
    // photo are not promoted to index cards (matches the legacy names-led
    // index filter; route publicity is owned separately by getStaticPaths).
    scoped = scoped.filter((p) =>
      input.galleries.some(
        (g) => g.status === "published" && g.photos.some((photo) => photo.place === p.id),
      ),
    );
  }
  const published = modeScopedGalleries(input.galleries, input.mode);

  /** Most recent published gallery with a photo-level contribution. */
  const representativeCover = (placeId: string): ViewCover | null => {
    const contributors = published
      .filter((g) => g.photos.some((photo) => photo.place === placeId))
      .sort((a, b) => {
        if (a.photographed_start !== b.photographed_start) {
          return a.photographed_start < b.photographed_start ? 1 : -1;
        }
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      });
    const gallery = contributors[0];
    if (!gallery?.cover_photo_id || !input.resolveCover) return null;
    return input.resolveCover(gallery.cover_photo_id);
  };

  return {
    places: scoped.sort(comparePlaces).map((place) => ({
      id: place.id,
      slug: place.slug,
      name: place.name,
      region: place.region ?? null,
      country: place.country ?? null,
      cover: representativeCover(place.id),
    })),
  };
}
