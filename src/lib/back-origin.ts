/*
 * src/lib/back-origin.ts — IMP-04 Back-to-origin refinement contract.
 *
 * Valid Gallery discovery origins are ONLY:
 *   Home:    /            → "Back to Home"
 *   Archive: /archive     → "Back to Journeys"
 *   Place:   /places/{slug} for a REAL canonical Place route (the slugs
 *            that actually generate /places/{slug} routes in the current
 *            build mode — data-derived, never hardcoded fixtures)
 *           → "Back to Place"
 * Everything else (no referrer, external URL, malformed input, arbitrary
 * same-origin routes, /places/{not-a-real-place}, other Galleries) falls
 * back to the frozen safe target: /archive, "Back to Journeys". Never a
 * regex on /places/* — the allowlist is authoritative.
 *
 * ONE CORE: the decision rules live in a single ES5 source string
 * (BACK_ORIGIN_CORE) that is
 *   - evaluated in Node by `resolveBackOrigin` (unit tests), and
 *   - embedded verbatim into the generated inline script (`backOriginScript`)
 *     that refines BOTH the header and the ending Back controls together.
 * Script and resolver therefore cannot diverge. The no-JS static fallback
 * remains href="/archive", text="Back to Journeys" — basic navigation never
 * depends on JS.
 */

export interface BackOrigin {
  href: string;
  label: string;
}

export const BACK_ORIGIN_FALLBACK: BackOrigin = { href: "/archive", label: "Back to Journeys" };

/**
 * ES5 decision core. Signature inside the evaluated scope:
 *   resolveBackOrigin(referrer: string, origin: string, PLACE_SLUGS: string[])
 *   → { href, label }
 * Self-contained: no external references, safe to eval in Node and to
 * inline into a browser script.
 */
export const BACK_ORIGIN_CORE = `
function resolveBackOrigin(referrer, origin, PLACE_SLUGS) {
  var FALLBACK_HREF = "/archive";
  var FALLBACK_LABEL = "Back to Journeys";
  function fallback() {
    return { href: FALLBACK_HREF, label: FALLBACK_LABEL };
  }
  if (!referrer) return fallback();
  var url;
  try {
    url = new URL(referrer);
  } catch (e) {
    return fallback();
  }
  if (url.origin !== origin) return fallback(); // external
  var p = url.pathname;
  if (p === "/" || p === "") return { href: "/", label: "Back to Home" };
  if (p === "/archive" || p.indexOf("/archive/") === 0) {
    return { href: "/archive", label: "Back to Journeys" };
  }
  var m = p.match(/^\\/places\\/([^/]+)\\/?$/);
  if (m) {
    var slug;
    try {
      slug = decodeURIComponent(m[1]);
    } catch (e) {
      return fallback();
    }
    if (PLACE_SLUGS.indexOf(slug) !== -1) {
      return { href: "/places/" + m[1], label: "Back to Place" };
    }
  }
  return fallback();
}
`;

/** Node-side evaluation of the shared core (unit-test surface). */
export function resolveBackOrigin(
  referrer: string,
  origin: string,
  placeSlugs: readonly string[],
): BackOrigin {
  const factory = new Function(`${BACK_ORIGIN_CORE}; return resolveBackOrigin;`);
  const impl = factory() as (r: string, o: string, s: readonly string[]) => BackOrigin;
  return impl(referrer, origin, placeSlugs);
}

/**
 * The inline refinement script for the Gallery page. Embeds the SAME core
 * as the unit-tested resolver plus the data-derived place allowlist, and
 * updates header + ending Back controls TOGETHER (href AND visible text).
 * The [data-browse-archive] link is never rewritten (always /archive).
 */
export function backOriginScript(placeSlugs: readonly string[]): string {
  const slugs = JSON.stringify([...placeSlugs]);
  return `(function(){
${BACK_ORIGIN_CORE}
var PLACE_SLUGS = ${slugs};
var ref = document.referrer || "";
var resolved = resolveBackOrigin(ref, location.origin, PLACE_SLUGS);
var headerLink = document.querySelector(".gallery-header .back-to-origin");
if (headerLink) {
  headerLink.setAttribute("href", resolved.href);
  headerLink.textContent = resolved.label;
}
var links = document.querySelectorAll(".gallery-ending a.origin-link");
for (var i = 0; i < links.length; i++) {
  if (links[i].getAttribute("data-browse-archive") !== null) continue;
  links[i].setAttribute("href", resolved.href);
  links[i].textContent = resolved.label;
}
})();`;
}
