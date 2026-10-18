// WP-44 - sitemap + robots builders (pure, published-only, deterministic).
//
// Authority: BUILD_AND_ROUTING section 4 and section 8 check 8 (sitemap holds
// ONLY published canonical URLs); CONTENT_MODEL 8.3 (draft exclusion).
// Route paths are supplied by the caller: the sitemap endpoint derives them
// from the same published data set as page generation, so there is exactly
// one route authority and no hard-coded registry here.

export interface SitemapRouteInputs {
  staticPaths: ReadonlyArray<string>;
  gallerySlugs: ReadonlyArray<string>;
  placeSlugs: ReadonlyArray<string>;
  draftSlugs: ReadonlyArray<string>;
  redirectOldPaths: ReadonlyArray<string>;
}

const ALWAYS_EXCLUDED: ReadonlySet<string> = new Set(["/404", "/404.html", "/qa-probe"]);

/** Frozen IA static paths (always published; the only static list in WP-44). */
export const STATIC_SITEMAP_PATHS: ReadonlyArray<string> = ["/", "/archive", "/places", "/about"];

export interface SitemapSource {
  galleries: ReadonlyArray<{ slug: string; status: string }>;
  places: ReadonlyArray<{ slug: string }>;
  redirectOldPaths: ReadonlyArray<string>;
}

/**
 * Corpus-to-sitemap mapping shared by the sitemap endpoint and tests: splits
 * published/draft galleries by status and delegates to buildSitemapEntries.
 * Callers pass published-route places (places with >=1 published gallery).
 */
export function collectSitemapPaths(source: SitemapSource): string[] {
  return buildSitemapEntries({
    staticPaths: STATIC_SITEMAP_PATHS,
    gallerySlugs: source.galleries.filter((g) => g.status === "published").map((g) => g.slug),
    placeSlugs: source.places.map((p) => p.slug),
    draftSlugs: source.galleries.filter((g) => g.status !== "published").map((g) => g.slug),
    redirectOldPaths: source.redirectOldPaths,
  });
}

export function buildSitemapEntries(inputs: SitemapRouteInputs): string[] {
  const draftPaths = new Set(inputs.draftSlugs.map((s) => "/galleries/" + s));
  const redirectPaths = new Set(inputs.redirectOldPaths);
  const seen = new Set<string>();
  const out: string[] = [];
  const candidates = [
    ...inputs.staticPaths,
    ...inputs.gallerySlugs.map((s) => "/galleries/" + s),
    ...inputs.placeSlugs.map((s) => "/places/" + s),
  ];
  for (const path of candidates) {
    if (ALWAYS_EXCLUDED.has(path)) continue;
    if (draftPaths.has(path)) continue;
    if (redirectPaths.has(path)) continue;
    if (seen.has(path)) continue;
    seen.add(path);
    out.push(path);
  }
  return out.sort();
}

const NL = String.fromCharCode(10);

function escapeXml(value: string): string {
  return value.split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;");
}

export function renderSitemap(origin: string, entries: ReadonlyArray<string>): string {
  const base = origin.endsWith("/") ? origin.slice(0, -1) : origin;
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];
  for (const path of entries) {
    lines.push("  <url><loc>" + escapeXml(base + path) + "</loc></url>");
  }
  lines.push("</urlset>");
  return lines.join(NL) + NL;
}

export function renderRobots(origin: string): string {
  const base = origin.endsWith("/") ? origin.slice(0, -1) : origin;
  return ["User-agent: *", "Allow: /", "Sitemap: " + base + "/sitemap.xml", ""].join(NL);
}
