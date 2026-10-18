// WP-44 — SEO artifacts integration tests (real corpus + final dist HTML).
//
// Authority: PRODUCTION_IMPLEMENTATION_PLAN WP-44; BUILD_AND_ROUTING section 4
// + section 8 check 8 (sitemap published-only); CONTENT_MODEL 8.3/12.
// Layer 1 (no build): the sitemap path set over the real corpus through the
// same collector the endpoint uses. Layer 2 (final production HTML, requires
// a fresh `npm run build`): title/description/canonical/OG per page,
// sitemap.xml, robots.txt, draft absence, and the head-only proof (no SEO
// strings inside <body> — no visible UI change).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { loadArchive } from "../../scripts/validate/content";
import { composeArchiveValidation } from "../../src/lib/validate/production";
import { entriesFromRedirectsFile, readRedirects } from "../../src/lib/content/redirects";
import { PROJECT_ROOT_URL, loadCollection } from "../support/content-layer";
import { canonicalUrl, resolveSiteOrigin } from "../../src/lib/seo/site";
import {
  aboutMeta,
  archiveMeta,
  galleryMeta,
  homeMeta,
  placesIndexMeta,
} from "../../src/lib/seo/meta";
import { collectSitemapPaths, renderRobots } from "../../src/lib/seo/sitemap";
import type { Gallery, Place } from "../../src/content-schemas";

const REPO_ROOT = new URL("../../", import.meta.url).pathname;
const ORIGIN = resolveSiteOrigin({});

function publishedDataSet() {
  const validation = composeArchiveValidation(loadArchive(REPO_ROOT), {
    mode: "production",
    ingestRoot: join(REPO_ROOT, "media/ingest-masters"),
  });
  expect(validation.ok).toBe(true);
  return validation.publishedDataSet;
}

async function galleryStatusList(): Promise<Array<{ slug: string; status: string }>> {
  const { entries } = await loadCollection("galleries");
  return entries.map((e) => {
    const data = e.data as unknown as Gallery;
    return { slug: data.slug, status: data.status };
  });
}

function redirectOldPaths(): string[] {
  const file = readRedirects(PROJECT_ROOT_URL);
  return entriesFromRedirectsFile(file.data).entries.map((e) => e.oldPath);
}

async function expectedPaths(): Promise<string[]> {
  const dataset = publishedDataSet();
  return collectSitemapPaths({
    galleries: await galleryStatusList(),
    places: dataset.places.map((p) => ({ slug: p.slug })),
    redirectOldPaths: redirectOldPaths(),
  });
}

function unescapeHtml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .split("&amp;")
    .join("&")
    .split("&lt;")
    .join("<")
    .split("&gt;")
    .join(">")
    .split("&quot;")
    .join('"')
    .split("&apos;")
    .join("'");
}

function headOf(html: string): string {
  const match = html.match(/<head>([\s\S]*?)<\/head>/);
  return match ? (match[1] as string) : "";
}

function bodyOf(html: string): string {
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/);
  return match ? (match[1] as string) : "";
}

function tagContent(head: string, pattern: RegExp): string | null {
  const match = head.match(pattern);
  return match ? unescapeHtml(match[1] as string) : null;
}

function distFile(routePath: string): string {
  return routePath === "/"
    ? join(REPO_ROOT, "dist", "index.html")
    : join(REPO_ROOT, "dist", routePath.slice(1), "index.html");
}

describe("WP-44 sitemap path set over the real corpus (no build)", () => {
  test("published canonical paths only: 13 galleries, no drafts/probe/404/aliases", async () => {
    const dataset = publishedDataSet();
    const paths = await expectedPaths();
    expect(dataset.galleries.filter((g) => g.status === "published")).toHaveLength(13);
    for (const gallery of dataset.galleries) {
      expect(paths).toContain("/galleries/" + gallery.slug);
    }
    for (const place of dataset.places) {
      expect(paths).toContain("/places/" + place.slug);
    }
    expect(paths).toContain("/");
    expect(paths).toContain("/archive");
    expect(paths).toContain("/places");
    expect(paths).toContain("/about");
    expect(paths).not.toContain("/galleries/long-gallery-72");
    expect(paths).not.toContain("/galleries/essen-industrial-light");
    expect(paths).not.toContain("/404");
    expect(paths).not.toContain("/qa-probe");
    for (const oldPath of redirectOldPaths()) {
      expect(paths).not.toContain(oldPath);
    }
    expect([...new Set(paths)]).toEqual(paths);
    expect([...paths].sort()).toEqual(paths);
  });
});

describe("WP-44 final production HTML (fresh `npm run build` required)", () => {
  test("sitemap.xml matches the published canonical URL set exactly", async () => {
    const paths = await expectedPaths();
    const file = join(REPO_ROOT, "dist", "sitemap.xml");
    expect(existsSync(file)).toBe(true);
    const xml = readFileSync(file, "utf8");
    const locs = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1] as string);
    expect([...locs].sort()).toEqual(paths.map((p) => canonicalUrl(ORIGIN, p)).sort());
  });

  test("robots.txt is valid with the absolute sitemap reference", () => {
    const file = join(REPO_ROOT, "dist", "robots.txt");
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, "utf8")).toBe(renderRobots(ORIGIN));
  });

  test("static pages carry exact title/description/canonical/OG", async () => {
    const cases: Array<{ path: string; title: string; description: string }> = [
      { path: "/", title: homeMeta().title, description: homeMeta().description },
      { path: "/archive", title: archiveMeta().title, description: archiveMeta().description },
      {
        path: "/places",
        title: placesIndexMeta().title,
        description: placesIndexMeta().description,
      },
      { path: "/about", title: aboutMeta().title, description: aboutMeta().description },
    ];
    for (const expected of cases) {
      const html = readFileSync(distFile(expected.path), "utf8");
      const head = headOf(html);
      expect(tagContent(head, /<title>([^<]*)<\/title>/)).toBe(expected.title);
      expect(tagContent(head, /<meta name="description" content="([^"]*)"/)).toBe(
        expected.description,
      );
      expect(tagContent(head, /<link rel="canonical" href="([^"]*)"/)).toBe(
        canonicalUrl(ORIGIN, expected.path),
      );
      expect(tagContent(head, /<meta property="og:title" content="([^"]*)"/)).toBe(expected.title);
      expect(tagContent(head, /<meta property="og:url" content="([^"]*)"/)).toBe(
        canonicalUrl(ORIGIN, expected.path),
      );
      expect(tagContent(head, /<meta property="og:type" content="([^"]*)"/)).toBe("website");
    }
  });

  test("gallery pages carry authored-or-fallback description, exact canonical, og:image", async () => {
    const dataset = publishedDataSet();
    for (const gallery of dataset.galleries) {
      const routePath = "/galleries/" + gallery.slug;
      const html = readFileSync(distFile(routePath), "utf8");
      const head = headOf(html);
      const expected = galleryMeta({
        title: gallery.title,
        description: gallery.description,
        slug: gallery.slug,
        photoCount: gallery.photos.length,
      });
      expect(tagContent(head, /<title>([^<]*)<\/title>/)).toBe(gallery.title);
      expect(tagContent(head, /<meta name="description" content="([^"]*)"/)).toBe(
        expected.description,
      );
      expect(tagContent(head, /<link rel="canonical" href="([^"]*)"/)).toBe(
        canonicalUrl(ORIGIN, routePath),
      );
      expect(tagContent(head, /<meta property="og:type" content="([^"]*)"/)).toBe("article");
      const image = tagContent(head, /<meta property="og:image" content="([^"]*)"/);
      expect(image).not.toBeNull();
      expect((image as string).startsWith(ORIGIN)).toBe(true);
    }
  });

  test("place pages carry exact canonical and named title", async () => {
    const dataset = publishedDataSet();
    for (const place of dataset.places as Place[]) {
      const routePath = "/places/" + place.slug;
      const html = readFileSync(distFile(routePath), "utf8");
      const head = headOf(html);
      expect(tagContent(head, /<title>([^<]*)<\/title>/)).toBe(place.name);
      expect(tagContent(head, /<link rel="canonical" href="([^"]*)"/)).toBe(
        canonicalUrl(ORIGIN, routePath),
      );
      expect(tagContent(head, /<meta property="og:title" content="([^"]*)"/)).toBe(place.name);
      const description = tagContent(head, /<meta name="description" content="([^"]*)"/);
      expect(description).not.toBeNull();
      expect(description as string).toContain(place.name);
    }
  });

  test("no drafts, probes, or aliases leak into production dist", async () => {
    // The real archive has no draft galleries; the two former fixture draft
    // slugs must not exist in dist, and neither may the QA probe.
    expect(existsSync(join(REPO_ROOT, "dist", "galleries", "long-gallery-72"))).toBe(false);
    expect(existsSync(join(REPO_ROOT, "dist", "galleries", "essen-industrial-light"))).toBe(false);
    expect(existsSync(join(REPO_ROOT, "dist", "galleries", "iso-draft"))).toBe(false);
    expect(existsSync(join(REPO_ROOT, "dist", "qa-probe"))).toBe(false);
    const paths = await expectedPaths();
    for (const routePath of paths) {
      expect(existsSync(distFile(routePath))).toBe(true);
    }
  });

  test("SEO strings live in <head> only: no visible UI change", async () => {
    const paths = await expectedPaths();
    for (const routePath of paths) {
      const html = readFileSync(distFile(routePath), "utf8");
      const body = bodyOf(html);
      expect(body).not.toContain('rel="canonical"');
      expect(body).not.toContain('property="og:');
      expect(body).not.toContain('name="description"');
    }
  });
});
