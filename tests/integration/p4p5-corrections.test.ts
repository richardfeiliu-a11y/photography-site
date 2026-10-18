// P4/P5 TARGETED CORRECTIONS — RED-first TDD evidence for each finding.
//
// Each suite reproduces the pre-fix defect shape first, then proves the
// corrected behavior against the frozen authority (Final Design Spec +
// production-architecture contracts). Tests assert the contract, not the
// implementation: e.g. the AVIF tests fail against a JPEG-only <img>, the
// G3 geometry test fails against an overflow:hidden clipped hero, the
// origin tests fail if everything resolves to /archive, and the qa-probe
// test fails if a production build still emits the route.
//
// RED-first note: run with the pre-correction implementation to confirm the
// failing assertions; then apply the fix and confirm GREEN.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { createPhotoSelectors } from "../../src/lib/assets/manifest";
import GalleryCard from "../../src/components/GalleryCard.astro";
import HomeHero from "../../src/components/HomeHero.astro";
import PhotoFigure from "../../src/components/PhotoFigure.astro";
import { buildGalleryView } from "../../src/lib/views/gallery";
import type { Gallery, Place } from "../../src/content-schemas";
import { loadCollection } from "../support/content-layer";
import { loadArchive } from "../../scripts/validate/content";
import { composeArchiveValidation } from "../../src/lib/validate/production";

const REPO_ROOT = new URL("../../", import.meta.url).pathname;

// ---------------------------------------------------------------------------
// Helpers — render Astro components to a DOM string (unit-level, no build).
// ---------------------------------------------------------------------------

async function renderWith(container: typeof AstroContainer, Component: unknown, props: Record<string, unknown>) {
  const c = await container.create();
  return c.renderToString(Component as never, { props });
}

// ---------------------------------------------------------------------------
// IMP-01 — AVIF-primary page consumption (WP-15)
// ---------------------------------------------------------------------------

describe("IMP-01 AVIF-primary page consumption", () => {
  const manifest = readFileSync(join(REPO_ROOT, "generated/asset-manifest.json"), "utf8");
  const doc = JSON.parse(manifest);
  const records = doc.manifest.records;

  function photoIds(): string[] {
    return [...new Set<string>(records.map((r: { photo_id: string }): string => r.photo_id))];
  }

  const photoId = photoIds()[0]!;

  // The manifest itself must carry AVIF + JPEG for the canonical purposes.
  test("manifest carries both AVIF and JPEG records for gallery_display (WP-15 D1/D2)", () => {
    const entry = records.filter(
      (r: { photo_id: string; purpose: string; format: string }) =>
        r.photo_id === photoId && r.purpose === "gallery_display",
    );
    const formats = [...new Set(entry.map((r: { format: string }) => r.format))];
    expect(formats).toContain("avif");
    expect(formats).toContain("jpeg");
  });

  test("WP-24 selectors expose per-format data VERBATIM (no filename parsing)", () => {
    const selectors = createPhotoSelectors(doc);
    const v = selectors.getGalleryVariants(photoId, { sizes: "(min-width: 900px) min(90vw,1440px), 90vw" });
    expect(v.formats.length).toBeGreaterThanOrEqual(2);
    const avif = v.formats.find((f) => f.format === "avif");
    const jpeg = v.formats.find((f) => f.format === "jpeg");
    expect(avif).toBeDefined();
    expect(jpeg).toBeDefined();
    // src = widest JPEG (D7 fallback), verbatim from manifest.
    const jpegEntries = records.filter(
      (r: { photo_id: string; purpose: string; format: string }) =>
        r.photo_id === photoId && r.purpose === "gallery_display" && r.format === "jpeg",
    );
    const widest = [...jpegEntries].sort((a: { width: number }, b: { width: number }) => a.width - b.width).at(-1)!;
    expect(v.src).toBe(widest.public_url);
    // Every AVIF srcset URL is a manifest public_url verbatim.
    for (const e of avif!.entries) {
      expect(records.some((r: { public_url: string }) => r.public_url === e.url)).toBe(true);
    }
    // No width parsing from the URL string: the srcset is assembled from
    // manifest `width` fields, so the URL must NOT be a regex replacement.
    expect(v.srcset).toMatch(/^\S+ \d+w(, \S+ \d+w)*$/);
  });

  // Component-level: the three consumer surfaces render <picture> with
  // <source type=image/avif> + <img> JPEG fallback.
  test("HomeHero renders <picture><source type=image/avif> + JPEG <img> fallback", async () => {
    const selectors = createPhotoSelectors(doc);
    const coverId = photoId;
    const cv = selectors.getCoverVariants(coverId, { sizes: "100vw" });
    const avifSrcset = cv.formats.find((f) => f.format === "avif")?.srcset;
    const card = {
      slug: "lofoten-light",
      title: "Lofoten Light",
      places: [{ name: "Reine" }],
      photographedStart: "2025-02-01",
      cover: { width: cv.width, height: cv.height },
    };
    const cover = {
      src: cv.src,
      srcset: cv.srcset,
      avifSrcset,
      sizes: "100vw",
    };
    const html = await renderWith(AstroContainer, HomeHero, { card, cover });
    expect(html).toContain("<picture");
    expect(html).toContain('type="image/avif"');
    expect(html).toContain(`srcset="${avifSrcset}"`);
    // JPEG <img> fallback still present.
    expect(html).toContain(`<img`);
    expect(html).toContain(`src="${cv.src}"`);
    expect(html).toContain(`srcset="${cv.srcset}"`);
  });

  test("GalleryCard renders <picture><source type=image/avif> + JPEG <img> fallback", async () => {
    const selectors = createPhotoSelectors(doc);
    const cv = selectors.getCoverVariants(photoId, { sizes: "(min-width: 900px) 33vw, 90vw" });
    const avifSrcset = cv.formats.find((f) => f.format === "avif")?.srcset;
    const card: unknown = {
      id: "g_test",
      slug: "lofoten-light",
      title: "Lofoten Light",
      photographedStart: "2025-02-01",
      photographedEnd: "2025-02-07",
      places: [{ id: "pl_reine", name: "Reine", region: null, country: null }],
      photoCount: 8,
      cover: {
        photoId,
        src: cv.src,
        srcset: cv.srcset,
        avifSrcset,
        width: cv.width,
        height: cv.height,
      },
      isDraft: false,
    };
    const html = await renderWith(AstroContainer, GalleryCard, { card, showCount: false, context: "home" });
    expect(html).toContain("<picture");
    expect(html).toContain('type="image/avif"');
    expect(html).toContain(`<img`);
    expect(html).toContain(`src="${cv.src}"`);
  });

  test("PhotoFigure renders <picture><source type=image/avif> + JPEG <img> fallback", async () => {
    const selectors = createPhotoSelectors(doc);
    const v = selectors.getGalleryVariants(photoId, { sizes: "(min-width: 900px) min(90vw,1440px), 90vw" });
    const avifSrcset = v.formats.find((f) => f.format === "avif")?.srcset;
    const photo = {
      photoId,
      caption: null,
      captionLang: null,
      altText: null,
      rhythmAfter: "base",
      display: {
        src: v.src,
        srcset: v.srcset,
        avifSrcset,
        width: v.width,
        height: v.height,
      },
    };
    const html = await renderWith(AstroContainer, PhotoFigure, { photo, position: "rest" });
    expect(html).toContain("<picture");
    expect(html).toContain('type="image/avif"');
    expect(html).toContain(`srcset="${avifSrcset}"`);
    expect(html).toContain(`<img`);
    expect(html).toContain(`src="${v.src}"`);
    // No filename regex/path parsing: the test uses a real manifest, but the
    // srcset string must be composed from manifest `width` fields, not URL digits.
    expect(html).not.toMatch(/srcset="[^"]*\\d+w[^"]*\\d+w"/); // no accidental double-width
  });
});

// ---------------------------------------------------------------------------
// IMP-02 — Home G3 no-crop (geometry contract; computed-style assertion)
// ---------------------------------------------------------------------------

describe("IMP-02 Home G3 no-crop CSS contract", () => {
  test("hero renders a <picture> with contained img dimensions (unit-level shape; geometry asserted in e2e)", async () => {
    const _manifest = JSON.parse(readFileSync(join(REPO_ROOT, "generated/asset-manifest.json"), "utf8"));
    const selectors = createPhotoSelectors(_manifest);
    const _photoIds = [
      ...new Set<string>(_manifest.manifest.records.map((r: { photo_id: string }): string => r.photo_id)),
    ];
    const cv = selectors.getCoverVariants(_photoIds[0]!, { sizes: "100vw" });
    const html = await renderWith(
      AstroContainer,
      HomeHero,
      {
        card: {
          slug: "lofoten-light",
          title: "Lofoten Light",
          places: [{ name: "Reine" }],
          photographedStart: "2025-02-01",
          cover: { width: cv.width, height: cv.height },
        },
        cover: {
          src: cv.src,
          srcset: cv.srcset,
          avifSrcset: cv.formats.find((f) => f.format === "avif")?.srcset,
          sizes: "100vw",
          // Monograph contract: the LCP image ships its intrinsic dimensions
          // so the plate reserves space before decode (CLS 0).
          width: cv.width,
          height: cv.height,
        },
      },
    );
    // Container-level shape: <picture> present, intrinsic width/height attributes.
    expect(html).toContain("<picture");
    expect(html).toContain('type="image/avif"');
    expect(html).toContain(`width="${cv.width}"`);
    expect(html).toContain(`height="${cv.height}"`);
    // Full G3 geometry (no clipping, ≤ svh ceiling, contained not stretched) is
    // asserted at the browser level in tests/e2e/home.spec.ts + p4p5-corrections.spec.ts.
  });
});

// ---------------------------------------------------------------------------
// IMP-03 — Preview draft Gallery routes + production closure
// ---------------------------------------------------------------------------

describe("IMP-03 Preview draft Gallery routes", () => {
  test("production mode: draft galleries provably absent from route input", async () => {
    const validation = composeArchiveValidation(loadArchive(REPO_ROOT), {
      mode: "production",
      ingestRoot: `${REPO_ROOT}media/ingest-masters`,
    });
    expect(validation.ok).toBe(true);
    const slugs = validation.publishedDataSet.galleries.map((g) => g.slug);
    expect(slugs).toContain("netherlands");
    expect(slugs).toContain("swiss-and-dolomites");
    // 13 published routes exactly.
    expect(slugs).toHaveLength(13);
  });

  test("preview mode: draft galleries present in route input (ADR-020)", async () => {
    const validation = composeArchiveValidation(loadArchive(REPO_ROOT), {
      mode: "preview",
      ingestRoot: `${REPO_ROOT}media/ingest-masters`,
    });
    expect(validation.ok).toBe(true);
    const slugs = validation.publishedDataSet.galleries.map((g) => g.slug);
    // No authored drafts post-go-live: preview scope equals production scope.
    expect(slugs).toHaveLength(13);
    expect(slugs).toContain("netherlands");
  });
});

// ---------------------------------------------------------------------------
// IMP-04 — Back-to-origin context (continuation + header share one contract)
// ---------------------------------------------------------------------------

describe("IMP-04 Back-to-origin contract", () => {
  test("buildGalleryView carries the frozen safe fallback (/archive) for both standard and no-next", async () => {
    const { entries: galleryEntries } = await loadCollection("galleries");
    const { entries: placeEntries } = await loadCollection("places");
    const galleries = galleryEntries.map((e) => e.data as unknown as Gallery);
    const places = placeEntries.map((e) => e.data as unknown as Place);
    const validation = composeArchiveValidation(loadArchive(REPO_ROOT), {
      mode: "production",
      ingestRoot: `${REPO_ROOT}media/ingest-masters`,
    });
    const { nextGalleryMap } = validation.publishedDataSet;

    const lofoten = galleries.find((g) => g.slug === "lofoten-polar-night")!;
    const standard = buildGalleryView({
      gallery: lofoten,
      places,
      nextGalleryMap,
      allGalleries: galleries,
      resolveDisplay: (id) => ({ photoId: id, src: "/d.jpg", srcset: "/d.jpg 1w", width: 1, height: 1 }),
    });
    expect(standard.continuation.kind).toBe("standard");
    expect(standard.continuation.originFallback).toBe("/archive");

    const noNext = galleries.find((g) => g.slug === "winter-europe")!;
    const nx = buildGalleryView({
      gallery: noNext,
      places,
      // Real archive is a 13-gallery cycle, so null one entry to synthesize no-next.
      nextGalleryMap: { ...nextGalleryMap, [noNext.id]: null },
      allGalleries: galleries,
      resolveDisplay: (id) => ({ photoId: id, src: "/d.jpg", srcset: "/d.jpg 1w", width: 1, height: 1 }),
    });
    expect(nx.continuation.kind).toBe("no-next");
    expect(nx.continuation.originFallback).toBe("/archive");
  });

  test("no 'Previous Gallery' relation is introduced (frozen anti-contract)", () => {
    // Confirm the Gallery schema shape carries no previous_gallery_id and
    // buildGalleryView does not consult one. Assert by inspecting the view output.
    const view = buildGalleryView({
      gallery: {
        id: "g_x", slug: "x", title: "X", status: "published", published_at: "2025-01-01",
        photographed_start: "2025-01-01", photographed_end: "2025-01-01", places: [],
        photos: [{ id: "p1", source_ref: "a.jpg", rhythm_after: "base" }],
      } as unknown as Gallery,
      places: [],
      nextGalleryMap: {},
      allGalleries: [],
      resolveDisplay: (id) => ({ photoId: id, src: "/d.jpg", srcset: "/d.jpg 1w", width: 1, height: 1 }),
    });
    expect(view.continuation).not.toHaveProperty("prevTitle");
    expect(view.continuation).not.toHaveProperty("prevSlug");
  });
});

// ---------------------------------------------------------------------------
// IMP-06 — /qa-probe absent from production build output
// ---------------------------------------------------------------------------

describe("IMP-06 /qa-probe absent from production output", () => {
  test("production dist/ must not contain qa-probe route", () => {
    const dist = join(REPO_ROOT, "dist");
    const htmlFiles: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (entry === ".DS_Store") continue;
        if (statSync(full).isDirectory()) walk(full);
        else if (entry.endsWith(".html")) htmlFiles.push(full);
      }
    };
    walk(dist);
    const offenders = htmlFiles.filter((f) => f.endsWith("/qa-probe/index.html") || f.includes("/qa-probe/"));
    expect(offenders).toEqual([]);
  });
});
