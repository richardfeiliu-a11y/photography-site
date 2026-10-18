// WP-44 — per-page metadata builders (pure, deterministic, authored-first).
//
// Authority: PRODUCTION_IMPLEMENTATION_PLAN WP-44; CONTENT_MODEL §4/§6
// (authored titles/descriptions/places); FINAL_DESIGN_SPECIFICATION frozen IA
// (Home/Archive/Places/About labels).
//
// Contract: every published page gets a deterministic title, description,
// canonical path, and OG type. Authored descriptions win verbatim (whitespace
// collapsed); otherwise a factual fallback derived from authored data
// (title + counts + site name) — no invented marketing copy, no filename or
// EXIF derivation, no caption reuse beyond the authored description itself.
export const SITE_NAME = "Richard Photographs";

export type OgType = "website" | "article";

export interface PageMeta {
  title: string;
  description: string;
  /** Path-exact canonical route (e.g. `/galleries/{slug}`). */
  canonicalPath: string;
  ogType: OgType;
}

export interface GalleryMetaInput {
  title: string;
  description: string | null | undefined;
  slug: string;
  photoCount: number;
}

export interface PlaceMetaInput {
  name: string;
  /** Authored disambiguation context (`region[, country]`), if any. */
  locationContext: string | null | undefined;
  slug: string;
  galleryCount: number;
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Gallery page: authored description, else a factual title/count fallback. */
export function galleryMeta(input: GalleryMetaInput): PageMeta {
  const authored = input.description?.trim()
    ? collapseWhitespace(input.description as string)
    : null;
  return {
    title: input.title,
    description:
      authored ??
      input.title +
        " — " +
        String(input.photoCount) +
        (input.photoCount === 1 ? " photograph. " : " photographs. ") +
        SITE_NAME +
        ".",
    canonicalPath: "/galleries/" + input.slug,
    ogType: "article",
  };
}

/** Place detail page: authored name + location context. */
export function placeMeta(input: PlaceMetaInput): PageMeta {
  const context = input.locationContext?.trim()
    ? collapseWhitespace(input.locationContext as string)
    : null;
  return {
    title: input.name,
    description: context
      ? input.name + ", " + context + ". " + SITE_NAME + "."
      : input.name + ". " + SITE_NAME + ".",
    canonicalPath: "/places/" + input.slug,
    ogType: "website",
  };
}

/** Home: the archive self-description (first sentence of the authored About body). */
export function homeMeta(): PageMeta {
  return {
    title: SITE_NAME,
    description:
      "A quiet archive of photographs — places photographed over time, shown in sequences that keep their original order.",
    canonicalPath: "/",
    ogType: "website",
  };
}

/** Archive: frozen IA label + photographed-year grouping (WP-29). */
export function archiveMeta(): PageMeta {
  return {
    title: "Journeys",
    description: "Browse photographic galleries by photographed year. " + SITE_NAME + ".",
    canonicalPath: "/archive",
    ogType: "website",
  };
}

/** Places index: frozen IA label. */
export function placesIndexMeta(): PageMeta {
  return {
    title: "Places",
    description: "Browse photographed places and their galleries. " + SITE_NAME + ".",
    canonicalPath: "/places",
    ogType: "website",
  };
}

/** About: frozen IA label + authored body lead. */
export function aboutMeta(): PageMeta {
  return {
    title: "About",
    description:
      "About this quiet archive of photographs — places photographed over time, shown in sequences that keep their original order.",
    canonicalPath: "/about",
    ogType: "website",
  };
}
