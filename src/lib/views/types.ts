// WP-25 — shared view-layer types and helpers (pure data builders).
//
// Frozen references:
//   - CONTENT_MODEL.md §5.5 (photo order = array order; counts derive from
//     array length, never authored), §7/UD-003 (photographed time = archive
//     chronology; published_at = publication order — never mixed),
//     §8.4/UD-010 (cover via cover_photo_id, NEVER a silent first-Photo
//     default; required for published galleries), §6.3 (no counts anywhere
//     for places), §10.2/§10.4 (featured/Recent resolution owned by WP-11).
//   - FINAL_DESIGN_SPECIFICATION §3.2–3.4 (what each discovery page shows).
//   - BUILD_AND_ROUTING §4 (published-only route inputs; mode semantics).
//   - ADR-020 (preview keeps draft content; production never does).
//
// Design contract: builders return PLAIN SERIALIZABLE DATA — no Astro,
// template, or CSS concerns. `mode` scopes publication visibility:
//   - production → published galleries only; drafts absent from every view.
//   - preview    → route-scope is draft-inclusive (ADR-020): archive/place
//     views surface drafts via `isDraft: true` for the draft indicator.
//     HomeView stays published-only in BOTH modes — §10.2/§10.4 selection is
//     published-only by its own contract (WP-11), independent of route scope.
//
// Cover resolution is INJECTED (`CoverResolver`) so builders stay pure and
// testable without a manifest; pages bind the WP-24 selector surface
// (createPhotoSelectors(getManifest())) with their layout-context `sizes`
// decision. Builders never parse filenames and never read the manifest JSON.

import type { Gallery, Place } from "../../content-schemas";

/** Build/run mode; mirrors WP-13's ArchiveValidationMode. */
export type ViewMode = "production" | "preview";

/** A Place as a card reference (disambiguation fields only, §6.3). */
export interface ViewPlaceRef {
  id: string;
  name: string;
  region: string | null;
  country: string | null;
}

/** Cover derivative data resolved through the WP-24 selector surface. */
export interface ViewCover {
  photoId: string;
  /** JPEG fallback URL (widest jpeg, D7) — embed verbatim as `<img src>`. */
  src: string;
  /** JPEG `"url w"` width-descriptor srcset — embed verbatim as `<img srcset>`. */
  srcset: string;
  /** AVIF `"url w"` srcset (WP-24 `formats[avif]`, verbatim) for the
   * `<source type="image/avif">` primary; absent when the manifest carries
   * no AVIF entry (defensive, never fabricated). */
  avifSrcset?: string;
  /** Intrinsic dimensions of `src` (CLS prevention). */
  width: number;
  height: number;
  /** Preview-only: a draft cover whose photo has no manifest record. */
  missing?: boolean;
}

/**
 * (photoId) → cover derivative data. Pages close over
 * `createPhotoSelectors(getManifest()).getCoverVariants(photoId, { sizes })`
 * with their own layout-context `sizes` decision (a presentation concern,
 * IMAGE_PIPELINE §10.4 — the selector echoes sizes verbatim, it never
 * computes them).
 */
export type CoverResolver = (photoId: string) => ViewCover;

/** The one shared discovery-card data shape (Home hero/grid, Archive, Place). */
export interface ViewGalleryCard {
  id: string;
  slug: string;
  title: string;
  /** ISO date (YYYY-MM-DD) — archive chronology (§7/UD-003). */
  photographedStart: string;
  photographedEnd: string;
  places: ViewPlaceRef[];
  /** Derived from photos[] length (§5.5). Archive cards show it (FDS §3.3). */
  photoCount: number;
  /**
   * Non-null for every published gallery (§8.4 requires cover_photo_id).
   * Null ONLY for a preview draft that omits cover_photo_id (§8.3 leniency).
   */
  cover: ViewCover | null;
  /** True only in preview builds (ADR-020 draft indicator input). */
  isDraft: boolean;
}

/** Mode-scoped gallery list: production → published only; preview → all. */
export function modeScopedGalleries(galleries: ReadonlyArray<Gallery>, mode: ViewMode): Gallery[] {
  return mode === "production" ? galleries.filter((g) => g.status === "published") : [...galleries];
}

/** Deterministic place lookup (id → Place). */
export function placeIndex(places: ReadonlyArray<Place>): Map<string, Place> {
  return new Map(places.map((p) => [p.id, p]));
}

function toPlaceRef(place: Place): ViewPlaceRef {
  return {
    id: place.id,
    name: place.name,
    region: place.region ?? null,
    country: place.country ?? null,
  };
}

/** The names-led index/detail entry shape (NO counts — §6.3 / FDS §3.4). */
export function toPlacesViewEntry(place: Place): {
  id: string;
  slug: string;
  name: string;
  region: string | null;
  country: string | null;
} {
  return {
    id: place.id,
    slug: place.slug,
    name: place.name,
    region: place.region ?? null,
    country: place.country ?? null,
  };
}

/**
 * Assemble one card from a Gallery. Cover resolution: cover_photo_id →
 * resolveCover (§8.4/UD-010 — there is NEVER a silent first-Photo default).
 * A published gallery without cover_photo_id cannot reach this code in a
 * validated production build (§13.1#8 fails the build); preview drafts
 * without one get a null cover rather than a fabricated derivative.
 */
export function buildGalleryCard(
  gallery: Gallery,
  placesById: ReadonlyMap<string, Place>,
  resolveCover: CoverResolver,
): ViewGalleryCard {
  const cover = gallery.cover_photo_id ? resolveCover(gallery.cover_photo_id) : null;
  return {
    id: gallery.id,
    slug: gallery.slug,
    title: gallery.title,
    photographedStart: gallery.photographed_start,
    photographedEnd: gallery.photographed_end,
    places: gallery.places
      .map((id) => placesById.get(id))
      .filter((p): p is Place => p !== undefined)
      .map(toPlaceRef),
    photoCount: gallery.photos.length,
    cover,
    isDraft: gallery.status === "draft",
  };
}

/**
 * Archive chronology comparator: photographed_start DESCENDING, tie-break by
 * stable Gallery ID ascending (deterministic; §7/UD-003 — published_at can
 * never influence archive/place ordering through this comparator).
 */
export function comparePhotographedDesc(a: Gallery, b: Gallery): number {
  if (a.photographed_start !== b.photographed_start) {
    return a.photographed_start < b.photographed_start ? 1 : -1;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
