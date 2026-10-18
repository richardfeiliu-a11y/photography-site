// WP-25 — ArchiveView builder (pure data).
//
// Frozen references: CONTENT_MODEL §7/UD-003 (year grouping from PHOTOGRAPHED
// dates — published_at never groups the archive), FDS §3.3 (year headings as
// chronology landmarks; cards carry counts), §5.5 (counts from photos[]
// length).
//
// Implementation-level decision (recorded in docs/implementation/WP-25.md):
// grouping year = calendar year of `photographed_start` (the gallery's
// canonical photographed anchor); intra-year ordering = photographed_start
// DESC with stable Gallery ID ascending tie-break (chronology-consistent,
// deterministic). Year groups render newest-first.

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

export interface ArchiveViewInput {
  galleries: ReadonlyArray<Gallery>;
  places: ReadonlyArray<Place>;
  resolveCover: CoverResolver;
  mode: ViewMode;
}

export interface ArchiveYearGroup {
  /** Calendar year of photographed_start (archive chronology, §7/UD-003). */
  year: number;
  galleries: ViewGalleryCard[];
}

export interface ArchiveView {
  /** Year groups, newest year first. */
  years: ArchiveYearGroup[];
}

// WP-29/WP-30 — the ONE canonical photographed-year derivation (shared by
// the ArchiveView builder and the Place-detail page grouping). UTC calendar
// year of the photographed anchor; no string surgery (dates get a date
// parse). Exported from the views layer so chronology semantics cannot fork.
export function photographedYear(photographedStart: string): number {
  return new Date(`${photographedStart}T00:00:00Z`).getUTCFullYear();
}

export function buildArchiveView(input: ArchiveViewInput): ArchiveView {
  const galleries = modeScopedGalleries(input.galleries, input.mode).sort(comparePhotographedDesc);
  const placesById = placeIndex(input.places);

  const byYear = new Map<number, Gallery[]>();
  for (const gallery of galleries) {
    // Year of the photographed anchor via the canonical UTC derivation.
    const year = photographedYear(gallery.photographed_start);
    const bucket = byYear.get(year);
    if (bucket === undefined) byYear.set(year, [gallery]);
    else bucket.push(gallery);
  }

  return {
    years: [...byYear.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([year, group]) => ({
        year,
        galleries: group.map((g) => buildGalleryCard(g, placesById, input.resolveCover)),
      })),
  };
}
