// WP-25 — PlaceView builder (pure data).
//
// Frozen references: FDS §3.4 (place detail: name + location context leads;
// that place's galleries follow with covers/titles/photographed dates;
// progressive year grouping is a WP-30 presentation decision derived from
// these photographed dates — the builder supplies the ordered flat list),
// CONTENT_MODEL §7/UD-003 (photographed chronology, never published_at),
// BUILD_AND_ROUTING §4 (published-only detail routes in production).

import type { Gallery, Place } from "../../content-schemas";
import {
  buildGalleryCard,
  comparePhotographedDesc,
  modeScopedGalleries,
  placeIndex,
  type CoverResolver,
  type ViewGalleryCard,
  type ViewMode,
} from "./types";
import type { PlacesViewEntry } from "./places";

export interface PlaceViewInput {
  place: Place;
  places: ReadonlyArray<Place>;
  galleries: ReadonlyArray<Gallery>;
  resolveCover: CoverResolver;
  mode: ViewMode;
}

export interface PlaceView {
  /** The place identity fields only — the atlas cover belongs to the index. */
  place: Omit<PlacesViewEntry, "cover">;
  /** That place's galleries, photographed_start DESC + stable ID tie-break. */
  galleries: ViewGalleryCard[];
  /**
   * R3 cross-journey photo aggregation (docs/reports/gallery-r3-fix-agent-
   * handoff-2026-09-13.md §3): every published photo carrying an EXPLICIT
   * photo-level `place` reference to THIS place. Caption strings and the
   * gallery-level places[] list are NEVER consulted — an unconfirmed photo
   * stays out of the collection (and remains visible only inside its
   * journey). Ordering: captured_at DESC (naive EXIF local timestamps sort
   * correctly as uniform-format strings); photos without a capture timestamp
   * fall back to their gallery's photographed_start (DESC) with the
   * gallery's authored photo order as the deterministic final tie-break.
   */
  photos: PlacePhotoRef[];
  /**
   * R4 F1: journeys that actually CONTAIN confirmed photos of this place —
   * the only galleries the place page may list as sources. Galleries that
   * merely reference the place at gallery level (cross-city albums) are
   * never offered as a substitute for the photo collection.
   */
  sourceJourneys: ViewGalleryCard[];
}

export interface PlacePhotoRef {
  photoId: string;
  galleryId: string;
  gallerySlug: string;
  galleryTitle: string;
  /** Naive local capture timestamp when evidence exists; else null. */
  capturedAt: string | null;
  /** Gallery photographed_start / _end (ISO date-only) — the documented
   * fallback shows the JOURNEY RANGE, not a precise photo date (R4 F1). */
  photographedStart: string;
  photographedEnd: string;
  /** Authored alt text (distinct accessible names for the photo links). */
  altText: string | null;
  /** Authored order of this photo inside its gallery (0-based). */
  authoredIndex: number;
}

export function buildPlaceView(input: PlaceViewInput): PlaceView {
  const here = modeScopedGalleries(input.galleries, input.mode)
    .filter((g) => g.places.includes(input.place.id))
    .sort(comparePhotographedDesc);
  const placesById = placeIndex(input.places);

  const photos: PlacePhotoRef[] = [];
  for (const gallery of modeScopedGalleries(input.galleries, input.mode)) {
    gallery.photos.forEach((photo, authoredIndex) => {
      if (photo.place !== input.place.id) return;
      photos.push({
        photoId: photo.id,
        galleryId: gallery.id,
        gallerySlug: gallery.slug,
        galleryTitle: gallery.title,
        capturedAt: photo.captured_at ?? null,
        photographedStart: gallery.photographed_start,
        photographedEnd: gallery.photographed_end,
        altText: photo.alt_text ?? null,
        authoredIndex,
      });
    });
  }
  photos.sort((a, b) => {
    const ka = a.capturedAt ?? a.photographedStart;
    const kb = b.capturedAt ?? b.photographedStart;
    if (ka !== kb) return ka < kb ? 1 : -1; // DESC
    if (a.galleryId !== b.galleryId) return a.galleryId < b.galleryId ? -1 : 1;
    return a.authoredIndex - b.authoredIndex;
  });

  const sourceGalleryIds = new Set(photos.map((p) => p.galleryId));
  const galleriesAll = here.map((g) => buildGalleryCard(g, placesById, input.resolveCover));
  return {
    place: {
      id: input.place.id,
      slug: input.place.slug,
      name: input.place.name,
      region: input.place.region ?? null,
      country: input.place.country ?? null,
    },
    galleries: galleriesAll,
    photos,
    sourceJourneys: galleriesAll.filter((card) => sourceGalleryIds.has(card.id)),
  };
}
