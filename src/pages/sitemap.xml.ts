// src/pages/sitemap.xml.ts - published-only sitemap endpoint (WP-44).
//
// Authority: BUILD_AND_ROUTING section 4 + section 8 check 8 (sitemap holds
// ONLY published canonical URLs); CONTENT_MODEL 8.3 (draft exclusion).
// The path set is derived from the same published data set as page generation
// (loadPublishedDataSet, production-scoped even in preview builds so drafts
// never leak) plus the full gallery collection for draft-old-slug defense and
// content/redirects.yaml old-paths (never canonical entries).
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { pathToFileURL } from "node:url";
import { loadPublishedDataSet, repoRoot } from "../lib/pages/archive-data";
import { entriesFromRedirectsFile, readRedirects } from "../lib/content/redirects";
import { buildSiteOrigin } from "../lib/seo/site";
import { collectSitemapPaths, renderSitemap } from "../lib/seo/sitemap";

export async function sitemapPathsForBuild(): Promise<string[]> {
  const { galleries, places } = loadPublishedDataSet("production");
  const collection = await getCollection("galleries");
  const redirectsFile = readRedirects(pathToFileURL(repoRoot()));
  const redirectOldPaths = entriesFromRedirectsFile(redirectsFile.data).entries.map(
    (entry) => entry.oldPath,
  );
  return collectSitemapPaths({
    galleries: [
      ...galleries.map((gallery) => ({ slug: gallery.slug, status: "published" })),
      ...collection
        .filter((entry) => entry.data.status !== "published")
        .map((entry) => ({ slug: entry.data.slug, status: entry.data.status as string })),
    ],
    places: places.map((place) => ({ slug: place.slug })),
    redirectOldPaths,
  });
}

export const GET: APIRoute = async () => {
  const xml = renderSitemap(buildSiteOrigin(), await sitemapPathsForBuild());
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
};
