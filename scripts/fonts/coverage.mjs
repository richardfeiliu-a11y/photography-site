// scripts/fonts/coverage.mjs — CJK coverage gate logic (WP-46).
//
// Authority: PERFORMANCE_BUDGET section 7 (options A/B, mandatory rules);
// DEFERRED D12/OQ-05. Pure functions shared by the build-time gate
// (coverage-check.mjs) and tests. Only parsed YAML string VALUES feed
// coverage — comments never render and never count.

/** Parse one unicode-range token (U+XXXX or U+XXXX-YYYY) to [lo, hi]. */
export function expandRangeToken(token) {
  const text = token.trim();
  const match = text.match(/^U\+([0-9A-Fa-f]+)(?:-([0-9A-Fa-f]+))?$/);
  if (!match) {
    throw new Error("[WP-46:range] invalid unicode-range token: " + JSON.stringify(text));
  }
  const lo = parseInt(match[1], 16);
  const hi = match[2] ? parseInt(match[2], 16) : lo;
  if (hi < lo) {
    throw new Error("[WP-46:range] reversed unicode-range token: " + JSON.stringify(text));
  }
  return [lo, hi];
}

/** Expand a comma-separated unicode-range list to a codepoint set. */
export function expandRangeList(listText) {
  const set = new Set();
  for (const token of listText.split(",")) {
    if (!token.trim()) continue;
    const [lo, hi] = expandRangeToken(token);
    for (let cp = lo; cp <= hi; cp++) set.add(cp);
  }
  return set;
}

/** Parse @font-face blocks to [{ file, ranges }] from a fonts.css text. */
export function parseCssFaces(cssText) {
  const faces = [];
  const blocks = cssText.split("@font-face");
  for (let i = 1; i < blocks.length; i++) {
    const body = blocks[i].slice(0, blocks[i].indexOf("}"));
    const urlMatch = body.match(/url\(([^)]+)\)/);
    const rangeMatch = body.match(/unicode-range\s*:\s*([^;]+);/);
    const raw = urlMatch ? urlMatch[1].trim() : "(unknown)";
    const file = raw.replace(/^[\'\"]/, "").replace(/[\'\"]$/, "");
    const ranges = rangeMatch ? expandRangeList(rangeMatch[1]) : new Set();
    faces.push({ file, ranges });
  }
  return faces;
}

/** Canonical U+XXXX form for messages and the allowlist. */
export function hexOf(cp) {
  return "U+" + cp.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Collect non-ASCII codepoints from parsed YAML docs (string values only).
 * Returns Map(cp -> { count, sources }). Comment text never reaches here:
 * callers pass js-yaml-parsed values, where comments are already stripped.
 */
export function collectCodepoints(docs, sourceLabel, into) {
  const found = into || new Map();
  const visit = (value) => {
    if (typeof value === "string") {
      for (const ch of value) {
        const cp = ch.codePointAt(0);
        if (cp > 127) {
          if (!found.has(cp)) found.set(cp, { count: 0, sources: [] });
          const rec = found.get(cp);
          rec.count += 1;
          if (rec.sources.indexOf(sourceLabel) < 0 && rec.sources.length < 5) {
            rec.sources.push(sourceLabel);
          }
        }
      }
    } else if (Array.isArray(value)) {
      for (const item of value) visit(item);
    } else if (value !== null && typeof value === "object") {
      for (const key of Object.keys(value)) visit(value[key]);
    }
  };
  for (const doc of docs) visit(doc);
  return found;
}

/**
 * Compare content codepoints against css-declared served ranges.
 * allowlist: Set of codepoints with reviewed fallback acceptance.
 */
export function checkCoverage({ docs, cssText, allowlist }) {
  const content = collectCodepoints(docs, "content");
  const faces = parseCssFaces(cssText);
  const served = new Set();
  for (const face of faces) {
    for (const cp of face.ranges) served.add(cp);
  }
  const uncovered = [];
  const accepted = [];
  for (const [cp, rec] of content) {
    if (served.has(cp)) continue;
    if (allowlist && allowlist.has(cp)) {
      accepted.push(hexOf(cp));
      continue;
    }
    uncovered.push({
      cp,
      hex: hexOf(cp),
      char: String.fromCodePoint(cp),
      count: rec.count,
      sources: rec.sources,
    });
  }
  uncovered.sort((a, b) => a.cp - b.cp);
  accepted.sort();
  return { uncovered, accepted, contentCount: content.size, servedCount: served.size };
}
