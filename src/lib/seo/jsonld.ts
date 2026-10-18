// JSON-LD builders for schema.org structured data (SEO).
//
// Pure, deterministic, build-time only. The home page emits a CollectionPage
// that hasPart an ImageGallery (one entry per published gallery); a gallery
// page emits an ImageGallery whose image list describes its photographs.
// All URLs are made absolute against the resolved site origin.
//
// `jsonLdScriptHtml` returns a string safe to embed in a
// <script type="application/ld+json">: it escapes any "</" sequence so a
// caption can never terminate the script element early.
import { canonicalUrl } from "./site";

export interface GalleryJsonLdRef {
  title: string;
  slug: string;
  /** Absolute-path cover (JPEG fallback src), or null. */
  image: string | null;
}

export interface PhotoJsonLdRef {
  /** Absolute-path display derivative. */
  url: string;
  alt: string;
}

export interface HomeJsonLdInput {
  origin: string;
  name: string;
  description: string;
  galleries: ReadonlyArray<GalleryJsonLdRef>;
}

export interface GalleryJsonLdInput {
  origin: string;
  title: string;
  description: string;
  slug: string;
  photos: ReadonlyArray<PhotoJsonLdRef>;
}

/** Home: a CollectionPage that hasPart an ImageGallery of galleries. */
export function buildHomeJsonLd(input: HomeJsonLdInput): Record<string, unknown> {
  const images = input.galleries
    .map((g) => (g.image ? canonicalUrl(input.origin, g.image) : null))
    .filter((u): u is string => u !== null);

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: input.name,
    description: input.description,
    url: canonicalUrl(input.origin, "/"),
    hasPart: {
      "@type": "ImageGallery",
      image: images,
    },
  };
}

/** Gallery route: an ImageGallery describing each photograph. */
export function buildGalleryJsonLd(input: GalleryJsonLdInput): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ImageGallery",
    name: input.title,
    description: input.description,
    url: canonicalUrl(input.origin, `/galleries/${input.slug}`),
    image: input.photos.map((photo) => ({
      "@type": "ImageObject",
      url: canonicalUrl(input.origin, photo.url),
      ...(photo.alt ? { caption: photo.alt } : {}),
    })),
  };
}

/** Serialise to a script-safe HTML string (escapes an early "</" sequence). */
export function jsonLdScriptHtml(value: Record<string, unknown>): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
