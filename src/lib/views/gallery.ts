// WP-33 — GalleryView builder (pure data contract consumed by WP-34..37).
//
// Frozen references:
//   - CONTENT_MODEL.md §9 / UD: the AUTHORED photos[] array order is the
//     sequence authority — never EXIF, filename, orientation, visual
//     similarity, or generated metadata. This builder preserves array order
//     verbatim (no sort anywhere).
//   - CONTENT_MODEL.md §8 + RUNTIME §4: continuation resolves next_gallery_id
//     VIA THE PUBLISHED MAP to the target's title + slug (ID-based; titles
//     are never copied at authoring time). A missing/draft target in
//     production degrades to the frozen no-next variant (the validator
//     already rejects real dangling refs; the map nulls are defensive).
//   - RUNTIME §4.1: back-to-origin is "derived from navigation context with a
//     safe static fallback". A statically-rendered page cannot know the
//     referrer at build time, so the safe static fallback is `/archive`
//     (mirrors the frozen no-next secondary). Client-side origin refinement
//     is a P6+ enhancement contract, NOT part of WP-33.
//   - IMAGE_PIPELINE §10.4: display derivatives resolve via the WP-24
//     selector surface (gallery_display purpose); a missing manifest entry
//     for a published photo is a build-blocking closure error — the resolver
//     throwing propagates (never swallowed).
//
// Pure over its inputs: the page binds the WP-24 selectors and the published
// data set (src/lib/pages/archive-data.ts) — the same canonical composition
// Lane A established.

import type { Gallery, Place } from "../../content-schemas";
import { placeIndex } from "./types";
import type { ViewPlaceRef } from "./types";
import type { PhotoExifRecord } from "../exif/format";

/** The §3.1/G4 rhythm states (authored only; orientation never chooses). */
export type RhythmAfter = "base" | "compact" | "breathing";

/** Resolved display derivative (WP-24 gallery_display surface, §10.4). */
export interface GalleryDisplayVariant {
  photoId: string;
  /** JPEG fallback URL — embed verbatim as `<img src>`. */
  src: string;
  /** JPEG `"url w"` srcset — embed verbatim as `<img srcset>`. */
  srcset: string;
  /** AVIF `"url w"` srcset (WP-24 `formats[avif]`, verbatim) for the
   * `<source type="image/avif">` primary. */
  avifSrcset?: string;
  width: number;
  height: number;
  /** Preview-only: a draft photo with no manifest record (no fabricated URL). */
  missing?: boolean;
}

export interface GallerySequencePhoto {
  /** Trusted per-photo place name (photo-level ref only; null when absent). */
  placeName?: string | null;
  photoId: string;
  caption: string | null;
  /** "zh" when the caption's script is CJK (build-time Unicode detection);
   * null keeps the document default (no fabricated locale). */
  captionLang: "zh" | null;
  altText: string | null;
  rhythmAfter: RhythmAfter;
  display: GalleryDisplayVariant;
  /** Non-sensitive camera labels from the build-time EXIF sidecar; null absent. */
  exif: PhotoExifRecord | null;
}

export interface GalleryHeaderData {
  title: string;
  description: string | null;
  photographedStart: string;
  photographedEnd: string;
  places: ViewPlaceRef[];
  /** photos[] length (§5.5) — the Overview {count} input (WP-34). */
  photoCount: number;
  slug: string;
}

export interface GalleryContinuationData {
  kind: "standard" | "no-next";
  nextTitle: string | null;
  nextSlug: string | null;
  /** RUNTIME §4.1 safe static fallback (client refinement is P6+). */
  originFallback: string;
}

export interface GalleryView {
  header: GalleryHeaderData;
  photos: GallerySequencePhoto[];
  continuation: GalleryContinuationData;
}

export interface GalleryViewInput {
  gallery: Gallery;
  places: ReadonlyArray<Place>;
  /** Gallery ID → published next_gallery_id (null = none); production map. */
  nextGalleryMap: Record<string, string | null>;
  /**
   * Resolves the gallery_display derivative for one photo. The page binds
   * WP-24 createPhotoSelectors(getManifest()).getGalleryVariants with the
   * media-frame layout context. A missing entry THROWS (closure, §10.4).
   */
  resolveDisplay: (photoId: string) => GalleryDisplayVariant;
  /** Optional EXIF label resolver (sidecar); absent → null exif on photos. */
  resolveExif?: (photoId: string) => PhotoExifRecord | null;
  /**
   * All published galleries — the continuation resolver looks up the target's
   * title + slug by ID. Defaults to [gallery] (then any non-self next ID is
   * unresolvable → no-next).
   */
  allGalleries?: ReadonlyArray<Gallery>;
}

function toPlaceRef(place: Place): ViewPlaceRef {
  return {
    id: place.id,
    name: place.name,
    region: place.region ?? null,
    country: place.country ?? null,
  };
}

/** CJK detection for the caption typography contract (RUNTIME §3: lh 1.75
 * for CJK captions). Build-time Unicode-range test — no invented metadata:
 * a caption CONTAINING CJK ideographs/punctuation renders with CJK
 * typography, and `lang` follows the script actually present (correct font
 * selection, not a locale claim). */
const CJK_RE = /[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF\u3000-\u303F]/;

export function captionContainsCjk(caption: string | null | undefined): boolean {
  return caption != null && CJK_RE.test(caption);
}

export function buildGalleryView(input: GalleryViewInput): GalleryView {
  const { gallery } = input;
  const placesById = placeIndex(input.places);

  // §9 — authored array order preserved verbatim; no sort.
  // placeName: ONLY the photo-level reference resolves to a name here — a
  // photo without an explicit ref inherits NOTHING from gallery.places[]
  // (R3: the rail must never show a guessed place).
  const photos: GallerySequencePhoto[] = gallery.photos.map((photo) => ({
    photoId: photo.id,
    caption: photo.caption ?? null,
    captionLang: captionContainsCjk(photo.caption) ? "zh" : null,
    altText: photo.alt_text ?? null,
    rhythmAfter: photo.rhythm_after,
    placeName:
      photo.place != null
        ? (placesById.get(photo.place)?.name ?? null)
        : null,
    display: input.resolveDisplay(photo.id),
    exif: input.resolveExif ? input.resolveExif(photo.id) : null,
  }));

  const header: GalleryHeaderData = {
    title: gallery.title,
    description: gallery.description ?? null,
    photographedStart: gallery.photographed_start,
    photographedEnd: gallery.photographed_end,
    places: gallery.places
      .map((id) => placesById.get(id))
      .filter((p): p is Place => p !== undefined)
      .map(toPlaceRef),
    photoCount: gallery.photos.length,
    slug: gallery.slug,
  };

  // §8/§4 — continuation resolution strictly via the published map + ID.
  const nextId = input.nextGalleryMap[gallery.id] ?? null;
  const all = input.allGalleries ?? [gallery];
  const target = nextId ? all.find((g) => g.id === nextId) : undefined;
  const continuation: GalleryContinuationData =
    nextId && target
      ? {
          kind: "standard",
          nextTitle: target.title,
          nextSlug: target.slug,
          originFallback: "/archive",
        }
      : {
          kind: "no-next",
          nextTitle: null,
          nextSlug: null,
          originFallback: "/archive",
        };

  return { header, photos, continuation };
}
