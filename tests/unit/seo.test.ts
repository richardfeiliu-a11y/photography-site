// WP-44 — SEO artifacts unit tests (RED first).
//
// Authority: PRODUCTION_IMPLEMENTATION_PLAN WP-44; BUILD_AND_ROUTING §4
// (routes; sitemap published-only) + §8 check 8; CONTENT_MODEL §8.3 (draft
// exclusion); DEPLOYMENT_ARCHITECTURE §6.2 (HTML/sitemap cache class).
// Single authorities under test: src/lib/seo/site.ts, src/lib/seo/meta.ts,
// src/lib/seo/sitemap.ts. Post-P9 (go-live 2026-09-10) the production origin
// IS frozen in the repo: the default is the production origin, and
// PUBLIC_SITE_ORIGIN remains a preview/staging override only.
import { describe, expect, test } from "vitest";
import {
  DEFAULT_SITE_ORIGIN,
  PRODUCTION_SITE_ORIGIN,
  canonicalUrl,
  resolveSiteOrigin,
} from "../../src/lib/seo/site";
import {
  aboutMeta,
  archiveMeta,
  galleryMeta,
  homeMeta,
  placeMeta,
  placesIndexMeta,
} from "../../src/lib/seo/meta";
import {
  buildSitemapEntries,
  collectSitemapPaths,
  renderRobots,
  renderSitemap,
} from "../../src/lib/seo/sitemap";

describe("WP-44 site origin (single authority, production origin frozen)", () => {
  test("default origin is the frozen production origin", () => {
    expect(resolveSiteOrigin({})).toBe(DEFAULT_SITE_ORIGIN);
    expect(DEFAULT_SITE_ORIGIN).toBe(PRODUCTION_SITE_ORIGIN);
    expect(PRODUCTION_SITE_ORIGIN).toBe("https://gallery.mintnode.de");
  });

  test("PUBLIC_SITE_ORIGIN override is honored, trailing slash trimmed", () => {
    expect(resolveSiteOrigin({ PUBLIC_SITE_ORIGIN: "https://photos.example.org/" })).toBe(
      "https://photos.example.org",
    );
  });

  test("invalid override fails closed", () => {
    expect(() => resolveSiteOrigin({ PUBLIC_SITE_ORIGIN: "not-a-url" })).toThrow();
    expect(() => resolveSiteOrigin({ PUBLIC_SITE_ORIGIN: "ftp://files.example.org" })).toThrow();
  });

  test("canonicalUrl joins origin and path exactly", () => {
    expect(canonicalUrl("https://gallery.mintnode.de", "/galleries/lofoten-polar-night")).toBe(
      "https://gallery.mintnode.de/galleries/lofoten-polar-night",
    );
    expect(canonicalUrl("https://gallery.mintnode.de", "/")).toBe(
      "https://gallery.mintnode.de/",
    );
  });
});

describe("WP-44 per-page metadata (deterministic, authored-first)", () => {
  test("gallery with authored description uses it (whitespace collapsed)", () => {
    const meta = galleryMeta({
      title: "Lofoten, Polar Night",
      description: "Eleven frames from a week in Reine,\nphotographed at the edge of winter.",
      slug: "lofoten-polar-night",
      photoCount: 11,
    });
    expect(meta.canonicalPath).toBe("/galleries/lofoten-polar-night");
    expect(meta.title).toBe("Lofoten, Polar Night");
    expect(meta.description).toBe(
      "Eleven frames from a week in Reine, photographed at the edge of winter.",
    );
    expect(meta.ogType).toBe("article");
  });

  test("gallery without description falls back to a deterministic title/count value", () => {
    const a = galleryMeta({
      title: "Kota Kinabalu",
      description: null,
      slug: "kota-kinabalu",
      photoCount: 4,
    });
    const b = galleryMeta({
      title: "Kota Kinabalu",
      description: null,
      slug: "kota-kinabalu",
      photoCount: 4,
    });
    expect(a.description).toBe(b.description);
    expect(a.description).toContain("Kota Kinabalu");
    expect(a.description).toContain("4");
    expect(a.description).toContain("Richard Photographs");
  });

  test("static index metas are fixed deterministic values", () => {
    expect(homeMeta().canonicalPath).toBe("/");
    expect(homeMeta().title).toBe("Richard Photographs");
    expect(archiveMeta().canonicalPath).toBe("/archive");
    expect(archiveMeta().title).toBe("Journeys");
    expect(placesIndexMeta().canonicalPath).toBe("/places");
    expect(aboutMeta().canonicalPath).toBe("/about");
    for (const m of [homeMeta(), archiveMeta(), placesIndexMeta(), aboutMeta()]) {
      expect(m.description.length).toBeGreaterThan(0);
      expect(m.ogType).toBe("website");
    }
  });

  test("place meta derives from authored name and location context", () => {
    const meta = placeMeta({
      name: "Lofoten",
      locationContext: "Nordland, Norway",
      slug: "lofoten",
      galleryCount: 3,
    });
    expect(meta.canonicalPath).toBe("/places/lofoten");
    expect(meta.title).toBe("Lofoten");
    expect(meta.description).toContain("Lofoten");
    expect(meta.description).toContain("Nordland, Norway");
  });
});

describe("WP-44 sitemap + robots (published-only, deterministic)", () => {
  test("sitemap entries keep published canonical paths only, sorted, deduplicated", () => {
    const entries = buildSitemapEntries({
      staticPaths: ["/", "/archive", "/places", "/about"],
      gallerySlugs: ["lofoten-polar-night", "tengwang-pavilion"],
      placeSlugs: ["lofoten"],
      draftSlugs: ["autumn-china"],
      redirectOldPaths: ["/old-lofoten"],
    });
    expect(entries).toContain("/galleries/lofoten-polar-night");
    expect(entries).toContain("/places/lofoten");
    expect(entries).not.toContain("/galleries/autumn-china");
    expect(entries).not.toContain("/old-lofoten");
    expect(entries).not.toContain("/404");
    expect(entries).not.toContain("/qa-probe");
    expect([...new Set(entries)]).toEqual(entries);
    expect([...entries].sort()).toEqual(entries);
  });

  test("renderSitemap emits valid XML with absolute locs and escapes", () => {
    const xml = renderSitemap("https://gallery.mintnode.de", ["/", "/galleries/a&b"]);
    expect(xml).toContain("<?xml");
    expect(xml).toContain("<urlset");
    expect(xml).toContain("<loc>https://gallery.mintnode.de/</loc>");
    expect(xml).toContain("a&amp;b");
    expect(xml).not.toContain("a&b</loc>");
  });

  test("renderRobots is valid with absolute sitemap reference", () => {
    const robots = renderRobots("https://gallery.mintnode.de");
    expect(robots).toMatch(/^User-agent: \*/m);
    expect(robots).toMatch(/^Allow: \//m);
    expect(robots).toContain("Sitemap: https://gallery.mintnode.de/sitemap.xml");
  });

  test("collectSitemapPaths splits published/draft by status (endpoint contract)", () => {
    const entries = collectSitemapPaths({
      galleries: [
        { slug: "lofoten-polar-night", status: "published" },
        { slug: "autumn-china", status: "draft" },
      ],
      places: [{ slug: "lofoten" }],
      redirectOldPaths: ["/old-lofoten"],
    });
    expect(entries).toContain("/galleries/lofoten-polar-night");
    expect(entries).toContain("/places/lofoten");
    expect(entries).toContain("/");
    expect(entries).not.toContain("/galleries/autumn-china");
    expect(entries).not.toContain("/old-lofoten");
  });
});
