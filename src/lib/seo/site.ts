// WP-44 — site origin authority (single source of truth for absolute SEO URLs).
//
// Authority: PRODUCTION_IMPLEMENTATION_PLAN WP-44; BUILD_AND_ROUTING §4.
// The production domain IS frozen since P9 go-live (2026-09-10): the site
// is live at https://gallery.mintnode.de, and the first live deploy shipped
// with the pre-P9 RFC-2606 placeholder because no build set the override.
// That placeholder path is now retired: the default origin IS the production
// origin, so a plain `npm run build` on any machine emits the correct
// canonical/OG/sitemap/robots URLs with no environment configuration.
// PUBLIC_SITE_ORIGIN remains an override for previews/staging only
// (fail-closed on invalid input). Route PATHS always come from the published
// route graph — this module never owns slugs.

/**
 * The production origin (frozen at P9 go-live, 2026-09-10). Single source of
 * truth for absolute SEO URLs; changing this is a production change.
 */
export const PRODUCTION_SITE_ORIGIN = "https://gallery.mintnode.de";

/**
 * Default origin used when PUBLIC_SITE_ORIGIN is absent. Post-P9 this IS the
 * production origin (kept under the historical name for callers/tests).
 */
export const DEFAULT_SITE_ORIGIN = PRODUCTION_SITE_ORIGIN;

export interface SiteOriginEnv {
  PUBLIC_SITE_ORIGIN?: string | undefined;
}

/**
 * Resolves the single site origin. The override must be an absolute http(s)
 * URL; anything else fails closed (a misconfigured origin must never ship
 * silently inside canonical/OG/sitemap output).
 */
export function resolveSiteOrigin(env: SiteOriginEnv = {}): string {
  const raw = env.PUBLIC_SITE_ORIGIN?.trim();
  if (!raw) return DEFAULT_SITE_ORIGIN;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(
      "[WP-44:site-origin] PUBLIC_SITE_ORIGIN must be an absolute URL, got " + JSON.stringify(raw),
    );
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(
      "[WP-44:site-origin] PUBLIC_SITE_ORIGIN must use http(s), got " + JSON.stringify(raw),
    );
  }
  return url.origin;
}

/** Build-time wrapper: reads the origin from the process environment. */
export function buildSiteOrigin(): string {
  return resolveSiteOrigin({ PUBLIC_SITE_ORIGIN: process.env.PUBLIC_SITE_ORIGIN });
}

/** Absolute canonical URL for a path-exact route (no double slashes). */
export function canonicalUrl(origin: string, path: string): string {
  const base = origin.endsWith("/") ? origin.slice(0, -1) : origin;
  return base + path;
}
