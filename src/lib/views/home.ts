// WP-25 — HomeView builder (pure data).
//
// Frozen references: CONTENT_MODEL §10.2/§10.4 (featured + Recent resolution
// — owned by WP-11's functions, called here; a second resolution path is a
// §10.3 forbidden concept), FDS §3.2 (Home shows the hero + Recent grid),
// ADR-019 (explicit featured or latest-published fallback with ID tie-break).
//
// The Recent list is the FULL §10.4-ordered list; the display slice/count and
// whether the hero is excluded from it are presentation concerns owned by the
// Home page (WP-28).

import type { Gallery, HomeSettings, Place } from "../../content-schemas";
import { orderRecentGalleries, resolveFeatured } from "../content/home";
import {
  buildGalleryCard,
  modeScopedGalleries,
  placeIndex,
  type CoverResolver,
  type ViewGalleryCard,
  type ViewMode,
} from "./types";

export interface HomeViewInput {
  /** Mode-scoped by the builder; pass the full parsed collection. */
  galleries: ReadonlyArray<Gallery>;
  places: ReadonlyArray<Place>;
  /** Parsed §10.1 settings (the single featured-state owner). */
  home: Pick<HomeSettings, "featured_gallery_id">;
  resolveCover: CoverResolver;
  mode: ViewMode;
}

export interface HomeView {
  /** §10.2 resolution result; null only when NO published gallery exists. */
  hero: ViewGalleryCard | null;
  /** Full §10.4-ordered Recent list (published_at DESC + stable ID tie-break). */
  recent: ViewGalleryCard[];
}

export function buildHomeView(input: HomeViewInput): HomeView {
  const galleries = modeScopedGalleries(input.galleries, input.mode);
  const placesById = placeIndex(input.places);
  const card = (gallery: Gallery): ViewGalleryCard =>
    buildGalleryCard(gallery, placesById, input.resolveCover);

  // §10.2 — single owner: WP-11's resolveFeatured (warn + §10.2 fallback
  // semantics included). The builder never re-derives "latest" on its own.
  const featured = resolveFeatured(input.home, galleries);
  const hero = featured.galleryId
    ? (galleries.find((g) => g.id === featured.galleryId) ?? null)
    : null;

  // §10.4 — single owner: WP-11's orderRecentGalleries.
  return {
    hero: hero ? card(hero) : null,
    recent: orderRecentGalleries(galleries).map(card),
  };
}
