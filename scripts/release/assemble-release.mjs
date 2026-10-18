#!/usr/bin/env node
// scripts/release/assemble-release.mjs — WP-51: assemble a release directory
// from a dist/ output, with a sha256 manifest and nine release-integrity gates
// (P9 Task 2.1 rework; R8 hardening per review-p9-r7-d0a5db3 I1–I4).
//
// Usage:
//   node --experimental-strip-types --import ./scripts/validate/register-ts-resolve.mjs \
//        scripts/release/assemble-release.mjs \
//        [--out releases/<timestamp>] [--dist <dir>] [--content <repo-root>] \
//        [--asset-manifest <generated/asset-manifest.json>] \
//        [--carry-from <old-release-dir>]… [--retain <n>] \
//        [--releases <dir>]
//
// Arguments:
//   --dist            candidate dist tree to assemble (default ROOT/dist)
//   --content         isolated content REPO ROOT: its content/ supplies the
//                     published/draft galleries, places and redirects.yaml the
//                     gates read (default ROOT). Everything is read from ONE
//                     root — never a mix of isolated fixtures and the real
//                     repo (P9 裁定②).
//   --asset-manifest  generated/asset-manifest.json records source for gate 3
//                     (default <content>/generated/asset-manifest.json — same
//                     content-root-relative convention as scripts/validate/
//                     dry-run.ts; an absent manifest at that path, or an
//                     explicit --asset-manifest that does not exist, FAILS the
//                     gate — the closure authority must exist)
//   --carry-from      one or more PRIOR release directories whose HTML
//                     src/srcset references supply assets to copy forward into
//                     this candidate when they are missing from it (repeatable;
//                     values may also be comma-separated). When omitted, the
//                     N most recent VALID releases under releases/ are
//                     discovered automatically (N = --retain, default 2).
//                     "Valid" now means the FULL manifest contract (R8/I3):
//                     manifest.json parses, every tree file is listed with a
//                     matching sha256, no escape/duplicate/symlink entries, and
//                     no unlisted real file — a {} or truncated manifest does
//                     not count as a valid release and never occupies a
//                     retention slot. Only assets referenced by RETAINED prior
//                     release HTML are carried forward — release cleanup must
//                     never break older HTML's lazy-loaded hashed URLs
//                     (DEPLOYMENT_ARCHITECTURE §6.4).
//   --retain          how many recent releases/ to treat as retained for
//                     carry-forward discovery (default 2; --retain 1 means
//                     only the most recent valid release is a source)
//   --releases        releases/ dir for automatic carry-forward discovery
//                     (default ROOT/releases). Testable against a scratch dir
//                     so auto-discovery never touches real releases/.
//   --out             release output directory. MUST NOT already exist — a
//                     candidate dir is never reused (audit requirement).
//
// The script:
//   1. Copies the candidate dist/ into a unique temp staging dir.
//   2. Carries forward retained old-release HTML assets (carry-forward, §6.4),
//      with pre-write source/destination boundary checks (R8/I4): URL-decoded,
//      resolved refs must stay inside the source release and the staged
//      candidate; symlink escape and traversal are refused BEFORE any
//      mkdir/copy. The post-hoc manifest validation is never the write
//      boundary.
//   3. Runs the NINE integrity gates against the staged candidate:
//        · Gate 2/5/8 read gallery/place metadata with a real YAML parser
//          (js-yaml, the same authority the content layer uses — R8/I1): flow
//          lists, single/double quotes, comments and line-end comments are all
//          equivalent to block style, and an unparseable meta.yaml fails the
//          assembly instead of being guessed by line regexes.
//        · Gate 3 checks the asset closure over EVERY candidate HTML
//          src/srcset reference (not only asset-manifest records — R8/I3) AND
//          every retained old page's references: anything a current page or a
//          retained old page needs must actually be servable from the final
//          candidate; a missing reference fails the release, it is never
//          silently ignored.
//        · Gate 8 parses sitemap.xml with a real XML parser (sax — R8/I2),
//          counts only real <loc> elements (never text inside XML comments),
//          rejects malformed XML / non-urlset roots / non-absolute locs, and
//          compares the URL set EXACTLY against the published canonical set
//          (the same STATIC_SITEMAP_PATHS authority the WP-44 endpoint uses,
//          plus published galleries and published-referenced places, minus
//          redirect old paths).
//   4. Deletes draft gallery routes (published-only release hygiene, AFTER the
//      gates — a candidate carrying a draft page has already failed Gate 5).
//   5. Writes + validates the sha256 release manifest.
//   6. Promotes the verified staged dir into --out, then points
//      releases/latest at it.
//
// Fail-closed semantics: any gate failure, manifest failure, or --out
// pre-existing → exit 1, NO manifest, no release directory left behind —
// a release is never half-built and never silently reused.
//
// Non-production drill: does not modify dist/ or generated/.
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
// readdirSync already imported above (listed twice for visibility: it feeds
// discoverCarryFrom's release-dir scan).
import { createHash } from "node:crypto";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { load as parseYaml } from "js-yaml";

const ROOT = resolve(join(fileURLToPath(import.meta.url), "..", "..", ".."));
const DEFAULT_DIST = join(ROOT, "dist");
const RELEASES = join(ROOT, "releases");
const DEFAULT_CONTENT = ROOT;

// F3: private source material must never reach a release. Camera raw suffixes,
// source content/ YAML, camera-export filenames (DSC_/IMG_) and .xmp sidecars
// are all in-candidate markers of leaked source material (content-addressed
// public derivative filenames never match these).
const PRIVATE_PATTERNS = [
  /ingest-masters/,
  /\.(raw|cr2|nef|arw|dng|orf|rw2|pef|srw|crw|raf|3fr|fff|mef|mos|erf|kdc|dcr|rwl)$/i, // 相机原始
  /^content\//,               // 源内容 YAML 不进入 release
  /DSC_\d+\.JPG$/i,           // 相机导出文件名
  /IMG_\d+\.(JPG|HEIC)$/i,    // 相机导出文件名（iOS）
  /\.xmp$/i,                  // 伴随文件
];

function briefError(e) {
  return String((e && e.message) || e);
}

/** Static file sha256. */
export function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/**
 * Recursively enumerate every entry under dir as { path, rel } (rel to base).
 * Symlinks are included deliberately: a symlink is a real directory entry a
 * release must never contain, so it must be visible to BOTH the closure check
 * (an unlisted symlink fails "manifest does not list actual release file")
 * and the per-entry lstat check in validateManifest (a listed symlink fails
 * "is a symlink"). Skipping them here would silently leak them past both.
 */
function listFiles(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, base));
    else if (entry.isFile() || entry.isSymbolicLink())
      // POSIX rel: the manifest (and the Linux-side deploy) uses forward slashes.
      out.push({ path: full, rel: full.slice(base.length + 1).split(sep).join("/") });
  }
  return out;
}

/** Strip a single leading slash. */
function stripSlash(p) {
  return p.startsWith("/") ? p.slice(1) : p;
}

// ---------------------------------------------------------------------------
// Content introspection (isolated content root) — R8/I1: real YAML parsing
// ---------------------------------------------------------------------------

/**
 * Read one YAML document, returning null when the file is missing/unparseable.
 * js-yaml is the same parser the content layer (WP-12 redirects, WP-03
 * registries) uses, so every legal YAML spelling of a value — block list,
 * flow list, single/double quotes, line-end comments — is read identically.
 */
function readYamlDoc(path) {
  if (!existsSync(path)) return null;
  try {
    return parseYaml(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

/**
 * { entry, slug, status, places } for every gallery meta under
 * <contentRoot>/content/galleries — parsed with js-yaml (R8/I1).
 *
 * Unparseable / non-mapping meta.yaml files are recorded with status=null and
 * reported as gate failures by statusSplit(): a release whose own metadata
 * cannot be machine-read is never assembled on a guess.
 */
function galleryIndex(contentRoot) {
  const dir = join(contentRoot, "content", "galleries");
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    const meta = readYamlDoc(join(dir, entry, "meta.yaml"));
    if (meta === null) {
      out.push({ entry, slug: null, status: null, places: [], error: "meta.yaml missing or unparseable" });
      continue;
    }
    if (typeof meta !== "object" || Array.isArray(meta)) {
      out.push({ entry, slug: null, status: null, places: [], error: "meta.yaml is not a mapping" });
      continue;
    }
    const slug = typeof meta.slug === "string" && meta.slug ? meta.slug : entry;
    const rawStatus = typeof meta.status === "string" && meta.status ? meta.status : "published";
    // CONTENT_MODEL §4 defines exactly two states. Anything else (a typo like
    // "pubished", or "Published" with different case) must fail the gate, not
    // silently demote the gallery out of every required set.
    const status = rawStatus === "published" || rawStatus === "draft" ? rawStatus : null;
    const places = Array.isArray(meta.places)
      ? meta.places.filter((p) => typeof p === "string" && p)
      : [];
    out.push({
      entry,
      slug,
      status,
      places,
      error: status === null ? `meta.yaml has an unknown status value: ${JSON.stringify(rawStatus)}` : null,
    });
  }
  return out;
}

/**
 * Split galleries into published/draft/metadata-error buckets. Metadata errors
 * are fail-closed: the caller (gate 2) rejects the assembly when any gallery
 * meta cannot be trusted.
 */
function statusSplit(contentRoot) {
  const published = [];
  const drafts = [];
  const errors = [];
  for (const g of galleryIndex(contentRoot)) {
    if (g.error) {
      errors.push(`${g.entry}: ${g.error}`);
      continue;
    }
    if (g.status === "published") published.push(g);
    else drafts.push(g);
  }
  return { published, drafts, errors };
}

/**
 * id → slug registry from <contentRoot>/content/places/*.yaml, parsed with
 * js-yaml (R8/I1). A place file that cannot be parsed is reported as an error
 * (its id might be the one a published gallery references).
 */
function placeIndex(contentRoot) {
  const dir = join(contentRoot, "content", "places");
  const registry = new Map();
  const errors = [];
  if (!existsSync(dir)) return { registry, errors };
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".yaml")) continue;
    const place = readYamlDoc(join(dir, file));
    if (place === null || typeof place !== "object" || Array.isArray(place)) {
      errors.push(`places/${file}: missing or unparseable`);
      continue;
    }
    if (typeof place.id === "string" && place.id) {
      registry.set(place.id, typeof place.slug === "string" && place.slug ? place.slug : file.replace(/\.yaml$/, ""));
    }
  }
  return { registry, errors };
}

/**
 * Place slugs that MUST have canonical pages: only places referenced by at
 * least one PUBLISHED gallery (BUILD_AND_ROUTING §4 published-only
 * getStaticPaths; CONTENT_MODEL §8.3 excludes draft-only places from the
 * production listing/routes). Asserting a page for every places/*.yaml would
 * permanently fail real-corpus assembly for draft-only places — a
 * gate/build contract mismatch found by the P9 restore drill (F7), whose
 * published-referenced business rule R8 keeps while fixing the parsing.
 *
 * A published gallery referencing an unknown place id is fail-closed (the
 * build could not have produced that page either).
 */
function requiredPlaceSlugs(contentRoot) {
  const { registry, errors } = placeIndex(contentRoot);
  const slugs = new Set();
  const { published } = statusSplit(contentRoot);
  for (const g of published) {
    for (const id of g.places) {
      const slug = registry.get(id);
      if (slug) slugs.add(slug);
      else errors.push(`${g.entry}: references unknown place id ${JSON.stringify(id)}`);
    }
  }
  return { slugs, errors };
}

// ---------------------------------------------------------------------------
// Sitemap XML parsing — R8/I2: real XML, real canonical set
// ---------------------------------------------------------------------------

/**
 * Parse an XML sitemap with sax (strict mode) and return the text of every
 * real <loc> element. Text inside comments/CDATA belonging to comments is not
 * part of any loc; malformed XML (mismatched tags, stray text at root, bad
 * entities) resolves { ok: false }. A non-<urlset> root also fails.
 */
export async function parseSitemapLocs(xml) {
  // sax is loaded lazily (and never on the validateManifest import path that
  // atomic-deploy.mjs takes under plain node): a transitive-only dependency
  // must not sit on the deploy entry's module graph.
  const sax = await import("sax");
  // sax's CJS export shape under Node ESM: the factory `parser(strict, opt)`
  // hangs off the default export.
  const saxFactory = sax.parser ?? sax.default?.parser;
  return new Promise((done) => {
    const parser = saxFactory(true, { lowercase: true });
    const locs = [];
    let currentLoc = null;
    let rootName = null;
    let parseError = null;
    parser.onopentag = (node) => {
      if (rootName === null) rootName = node.name;
      if (node.name === "loc" && currentLoc === null) currentLoc = [];
    };
    parser.ontext = (t) => {
      if (currentLoc !== null) currentLoc.push(t);
    };
    parser.oncdata = (t) => {
      if (currentLoc !== null) currentLoc.push(t);
    };
    parser.onclosetag = (name) => {
      if (name === "loc" && currentLoc !== null) {
        locs.push(currentLoc.join("").trim());
        currentLoc = null;
      }
    };
    parser.onerror = (e) => {
      if (parseError === null) parseError = e;
    };
    parser.onend = () => {
      if (parseError) done({ ok: false, locs, root: rootName, error: briefError(parseError) });
      else if (rootName !== "urlset")
        done({ ok: false, locs, root: rootName, error: `root element is <${rootName ?? "(none)"}>, expected <urlset>` });
      else done({ ok: true, locs, root: rootName, error: null });
    };
    try {
      parser.write(xml).close();
    } catch (e) {
      // sax re-throws the error from write() after emitting onerror (it does
      // not treat a consumer onerror handler as terminal). The error was
      // already captured; swallow the re-throw — the parse has failed and the
      // promise resolves { ok: false } below/above.
      if (parseError === null) parseError = e;
      done({ ok: false, locs, root: rootName, error: briefError(parseError) });
    }
  });
}

/**
 * Normalize a sitemap <loc> to its site PATH the way renderSitemap authored
 * it: absolute http(s) origin + path. Returns null for anything else —
 * relative refs, other schemes, or empty hosts are not URLs the WP-44
 * generator can have produced, so they fail the exact canonical-set
 * comparison instead of being coerced into it.
 */
function canonicalPathFromLoc(loc) {
  if (!loc) return null;
  let u;
  try {
    u = new URL(loc);
  } catch {
    return null;
  }
  if ((u.protocol !== "http:" && u.protocol !== "https:") || !u.host) return null;
  return u.pathname;
}

// ---------------------------------------------------------------------------
// Carry-forward (§6.4) — old-page asset availability
// ---------------------------------------------------------------------------

/**
 * Collect every relative asset reference from a release HTML body: the `src`
 * attribute and every `srcset` entry. References are URL-DECODED once and
 * relative to the release ROOT (a leading "/" site-root reference is stripped
 * so "media/x.avif" and "/media/x.avif" resolve to the same candidate-relative
 * path). Excluded: absolute http(s): URLs, data: URIs, anchors (#…), and empty
 * values — a "reference" is only an asset this release tree must be able to
 * serve. A %-sequence that does not decode is kept verbatim (it will fail the
 * boundary/closure checks downstream rather than crash the scan).
 */
export function extractAssetRefs(html) {
  const refs = new Set();
  const decode = (p) => {
    try {
      return decodeURIComponent(p);
    } catch {
      return p;
    }
  };
  // src="..." — absolute-URL/empty/#/"%20"-only skipped.
  for (const m of html.matchAll(/\bsrc="([^"]*)"/g)) {
    if (m[1] && !/^(https?:|data:|#)/.test(m[1])) refs.add(decode(stripSlash(m[1])));
  }
  // srcset="..." — comma-separated "url [descriptor]" entries.
  for (const m of html.matchAll(/\bsrcset="([^"]*)"/g)) {
    for (const part of m[1].split(",")) {
      const url = part.trim().split(/\s+/)[0] || "";
      if (url && !/^(https?:|data:|#)/.test(url)) refs.add(decode(stripSlash(url)));
    }
  }
  return refs;
}

/**
 * R8/I4 — resolve a decoded, root-stripped asset reference against a base
 * directory and refuse ANY escape: absolute refs, ".." traversal, or any
 * resolved path that is not strictly inside baseDir. The reference is used
 * exactly as the HTML authored it (already URL-decoded once by
 * extractAssetRefs; decoding again here would allow %252e double-encoding
 * bypasses, so it is deliberately not repeated).
 *
 * Returns { ok: true, abs } or { ok: false, reason } — callers must not touch
 * the filesystem on !ok.
 */
function resolveInside(baseDir, ref) {
  if (typeof ref !== "string" || ref === "") return { ok: false, reason: "empty reference" };
  if (ref.startsWith("/") || ref.includes("\\")) return { ok: false, reason: "not a release-relative reference" };
  const abs = resolve(baseDir, ref);
  // Windows-safe containment: path.relative is separator-agnostic, whereas a
  // raw "baseDir + '/'" prefix test fails whenever resolve() returns "\".
  const rel = relative(baseDir, abs);
  if (rel !== "" && (rel.startsWith("..") || isAbsolute(rel)))
    return { ok: false, reason: `resolved path escapes base directory: ${ref}` };
  return { ok: true, abs };
}

/**
 * R8/I3 — validate an old release's manifest.json against its directory with
 * the same contract the final candidate's manifest is held to: array of files,
 * safe in-bounds paths, no duplicates, no symlinks, matching sha256, and exact
 * coverage of the tree (no unlisted real file beyond manifest.json itself).
 * Returns the error list (empty = this directory IS a release in good
 * standing and may occupy a retention slot / supply carry-forward assets).
 */
export function validateReleaseManifestFiles(manifestPath, dir) {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (e) {
    return [`manifest parse error: ${briefError(e)}`];
  }
  if (!manifest || typeof manifest !== "object") return ["manifest must be an object"];
  if (!Array.isArray(manifest.files)) return ["manifest.files must be an array"];
  if (manifest.files.length === 0) return ["manifest.files must be non-empty"];

  const seen = new Set();
  const listedRel = new Set();
  for (const f of manifest.files) {
    if (typeof f.path !== "string") return [`manifest entry missing path: ${JSON.stringify(f)}`];
    const resolved = resolve(join(dir, f.path));
    const relToDir = relative(dir, resolved);
    if (relToDir !== "" && (relToDir.startsWith("..") || isAbsolute(relToDir)))
      return [`manifest path escapes release dir: ${f.path}`];
    if (seen.has(f.path)) return [`manifest duplicate path: ${f.path}`];
    seen.add(f.path);

    if (typeof f.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(f.sha256))
      return [`manifest entry invalid sha256: ${f.path}`];

    const filePath = join(dir, f.path);
    if (!existsSync(filePath)) return [`manifest listed file missing: ${f.path}`];
    if (lstatSync(filePath).isSymbolicLink()) return [`manifest listed file is a symlink: ${f.path}`];
    if (sha256File(filePath) !== f.sha256) return [`manifest sha256 mismatch: ${f.path}`];
    listedRel.add(f.path);
  }

  const manifestRel = manifestPath.slice(dir.length + 1);
  for (const f of listFiles(dir)) {
    if (f.rel !== manifestRel && !listedRel.has(f.rel))
      return [`manifest does not list actual release file: ${f.rel}`];
  }
  return [];
}

/**
 * True when dir looks like a release in good standing: it exists and its
 * manifest.json passes the FULL validation contract (R8/I3 — a {}, truncated,
 * hash-mismatched, or escape-carrying manifest is NOT a valid release and must
 * never occupy one of the retain-N slots or silently supply assets).
 */
function isAuthoritativeReleaseDir(dir) {
  if (!existsSync(dir)) return false;
  const manifestPath = join(dir, "manifest.json");
  if (!existsSync(manifestPath)) return false;
  return validateReleaseManifestFiles(manifestPath, dir).length === 0;
}

/**
 * Default carry-forward source discovery: the `retain` most recent VALID
 * release directories under releasesDir, ordered by directory NAME (release
 * names are timestamp-sortable, §2.1), most recent first. Validity is the
 * full manifest contract (isAuthoritativeReleaseDir): an invalid release is
 * skipped and does NOT consume a retention slot (R8/I3). Returns absolute dir
 * paths; never errors on a missing/empty releases/ dir — no old release is a
 * normal state.
 */
function discoverCarryFrom(releasesDir, retain) {
  let entries;
  try {
    entries = readdirSync(releasesDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const dirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => join(releasesDir, e.name))
    .filter(isAuthoritativeReleaseDir);
  // Release dir names are sortable timestamps (§2.1): LATER = LEXICALLY
  // LARGER = most recent. Sort by BASENAME ascending, take the LAST `retain`
  // entries (most recent), then reverse to most-recent-first for the carry
  // loop. Sorting the joined paths would order by the PARENT path too, and a
  // parent like "carry-auto-ABC" must not outrank the release basenames.
  dirs.sort((a, b) => {
    const na = a.split("/").pop() ?? "";
    const nb = b.split("/").pop() ?? "";
    return na.localeCompare(nb);
  });
  return dirs.slice(-retain).reverse();
}

/**
 * Carry forward: copy every asset referenced by the retained old releases'
 * HTML into the staged candidate, when that asset is missing from the
 * candidate. Copies are byte-identical (cpSync) and land at the SAME
 * candidate-relative path, so a cached old page's lazy-loaded hashed URL still
 * resolves to the same bytes (§6.4 carry-forward invariant).
 *
 * R8/I4 — pre-write boundary checks, BEFORE any mkdir/copy: the decoded
 * reference must resolve strictly inside the source release AND inside the
 * staged candidate; the source must be a regular (non-symlink) file whose
 * realpath stays inside the source release's realpath; the destination parent
 * must realpath-resolve inside the staged tree. Anything else is refused with
 * a log line and NO filesystem effect outside the two trees — the later
 * manifest validation is a reporting stage, never the write boundary.
 *
 * Returns the list of source dirs that actually existed (the retained sources
 * whose references gate 3 then requires to be servable in the candidate).
 * A missing old release directory is skipped silently (no old release is a
 * normal state).
 */
export function carryForward(staged, oldReleases, { log = [] } = {}) {
  const retainedUsed = [];
  const stagedReal = (() => {
    try {
      return realpathSync(staged);
    } catch {
      return staged;
    }
  })();
  for (const oldRel of oldReleases) {
    if (!existsSync(oldRel)) continue;
    retainedUsed.push(oldRel);
    const oldReal = (() => {
      try {
        return realpathSync(oldRel);
      } catch {
        return oldRel;
      }
    })();
    const htmlFiles = listFiles(oldRel).filter((f) => f.rel.endsWith(".html"));
    for (const h of htmlFiles) {
      const html = readFileSync(h.path, "utf8");
      for (const ref of extractAssetRefs(html)) {
        // 1. Source side: in-bounds, regular file, realpath inside the source.
        const src = resolveInside(oldRel, ref);
        if (!src.ok) {
          log.push(`refused out-of-bounds carry source ${ref} (${src.reason})`);
          continue;
        }
        if (!existsSync(src.abs)) continue; // missing source: gate 3 reports it
        let srcOk = true;
        try {
          const st = lstatSync(src.abs);
          if (st.isSymbolicLink() || !st.isFile()) {
            log.push(`refused non-regular carry source ${ref}`);
            srcOk = false;
          } else {
            const real = realpathSync(src.abs);
            if (real !== oldReal && !real.startsWith(oldReal + "/")) {
              log.push(`refused symlink-escaping carry source ${ref}`);
              srcOk = false;
            }
          }
        } catch {
          srcOk = false;
        }
        if (!srcOk) continue;
        // 2. Destination side: in-bounds (lexical), and the nearest EXISTING
        //    ancestor of the destination must resolve inside the staged tree
        //    BEFORE any mkdir/copy (R9/M5 — the previous code mkdir'd first
        //    and only then realpath-checked the parent, so a destination
        //    parent that is a symlink OUT of the staged tree left an external
        //    directory behind after the refusal). Walking up stops at the
        //    first existing component: missing components are ordinary
        //    staged-internal subdirectories that mkdir will create; an
        //    existing component that is a symlink, or that resolves outside
        //    the staged tree, refuses the carry without creating anything.
        const dst = resolveInside(staged, ref);
        if (!dst.ok) {
          log.push(`refused out-of-bounds carry destination ${ref} (${dst.reason})`);
          continue;
        }
        let destRefused = false;
        for (let anc = dirname(dst.abs); ; anc = dirname(anc)) {
          let st = null;
          try {
            st = lstatSync(anc);
          } catch {
            // Component does not exist yet — keep walking up to the nearest
            // existing ancestor (mkdir will create this one inside the tree).
            if (anc === staged || anc.length <= staged.length) {
              // Walked past the staged root without finding anything — the
              // root itself is the boundary; it exists and was resolved above.
              break;
            }
            continue;
          }
          if (st.isSymbolicLink()) {
            log.push(`refused carry destination parent symlink: ${ref}`);
            destRefused = true;
            break;
          }
          let ancReal;
          try {
            ancReal = realpathSync(anc);
          } catch {
            log.push(`carry failed for ${ref}: ancestor ${anc} unresolvable`);
            destRefused = true;
            break;
          }
          if (ancReal !== stagedReal && !ancReal.startsWith(stagedReal + "/")) {
            log.push(`refused carry destination escaping the staged tree: ${ref}`);
            destRefused = true;
            break;
          }
          break; // nearest existing ancestor is inside the staged tree
        }
        if (destRefused) continue;
        if (existsSync(dst.abs)) continue;
        try {
          mkdirSync(dirname(dst.abs), { recursive: true });
          cpSync(src.abs, dst.abs);
          log.push(`carried forward ${ref}`);
        } catch (e) {
          log.push(`carry failed for ${ref}: ${briefError(e)}`);
        }
      }
    }
  }
  return retainedUsed;
}

// ---------------------------------------------------------------------------
// The nine release-integrity gates
// ---------------------------------------------------------------------------

async function runNineGate(outDir, { contentRoot, assetManifestPath, retainedSources = [] }) {
  const failures = [];

  // The WP-12 authoritative validator is consumed once and feeds BOTH gate 8
  // (redirect old paths are never canonical URLs) and gate 9 (redirect targets
  // exist in the candidate). 裁定② — never copy its logic.
  let redirectsResult = null;
  try {
    const { validateRedirectsFromRoot } = await import("./redirect-validator.mjs");
    redirectsResult = validateRedirectsFromRoot(contentRoot);
  } catch (e) {
    failures.push(`9: redirect validation errored: ${briefError(e)}`);
  }
  if (redirectsResult && !redirectsResult.ok) {
    failures.push(`9: ${redirectsResult.errors.join("; ")}`);
  }

  // R8/I1 — content introspection via js-yaml, with fail-closed metadata
  // errors (a meta.yaml that cannot be trusted fails the assembly).
  const { published, drafts, errors: galleryErrors } = statusSplit(contentRoot);
  for (const err of galleryErrors) failures.push(`2: gallery metadata unreadable — ${err}`);
  const requiredPlaces = requiredPlaceSlugs(contentRoot);
  for (const err of requiredPlaces.errors) failures.push(`2: place reference unresolvable — ${err}`);

  // Gate 1: index.html exists.
  if (!existsSync(join(outDir, "index.html"))) failures.push("1: index.html missing");

  // Gate 2: canonical route pages exist (published galleries + places).
  for (const slug of published.map((g) => g.slug)) {
    if (!existsSync(join(outDir, "galleries", slug, "index.html")))
      failures.push(`2: missing canonical page for published gallery ${slug}`);
  }
  for (const slug of requiredPlaces.slugs) {
    if (!existsSync(join(outDir, "places", slug, "index.html")))
      failures.push(`2: missing canonical page for published place ${slug}`);
  }

  // Gate 3: asset closure. Two authorities:
  //   (a) the asset manifest — every public_url record must resolve to an
  //       existing file under the candidate release (the manifest is the
  //       DERIVATIVE closure authority; absent/unreadable fails the gate);
  //   (b) R8/I3 — EVERY src/srcset reference in the candidate's HTML (new
  //       pages) AND every reference made by a RETAINED old release's HTML
  //       must be servable from the final candidate. A missing reference fails
  //       the release — it is never silently ignored.
  let assetManifest;
  try {
    assetManifest = JSON.parse(readFileSync(assetManifestPath, "utf8"));
  } catch (e) {
    failures.push(`3: asset manifest unreadable: ${assetManifestPath} — ${briefError(e)}`);
  }
  // F3: strict schema — must be { manifest: { records: [...] } }, never a
  // silent fallback to an empty array. A legal empty collection
  // ({ manifest: { records: [] } }) passes the STRUCTURE check but must not
  // skip any other gate (failures accumulate, every gate still runs).
  if (!assetManifest || typeof assetManifest !== "object" ||
      !assetManifest.manifest || typeof assetManifest.manifest !== "object" ||
      !Array.isArray(assetManifest.manifest.records)) {
    failures.push(`3: asset manifest invalid structure — expected { manifest: { records: [...] } }`);
  } else {
    for (const rec of assetManifest.manifest.records) {
      if (typeof rec?.public_url !== "string" || !rec.public_url) {
        failures.push(`3: asset manifest record missing public_url: ${JSON.stringify(rec)}`);
        continue;
      }
      const rel = stripSlash(rec.public_url);
      if (rel && !existsSync(join(outDir, rel)))
        failures.push(`3: asset manifest public_url missing in release: ${rec.public_url}`);
    }
  }

  // (b) R8/I3 — HTML src/srcset closure over the final candidate.
  for (const f of listFiles(outDir)) {
    if (!f.rel.endsWith(".html")) continue;
    for (const ref of extractAssetRefs(readFileSync(f.path, "utf8"))) {
      const target = resolveInside(outDir, ref);
      if (!target.ok) {
        failures.push(`3: HTML asset reference escapes release dir: ${ref} (in ${f.rel})`);
        continue;
      }
      if (!existsSync(target.abs))
        failures.push(`3: HTML references asset missing from release: ${ref} (in ${f.rel})`);
    }
  }
  // (b) R8/I3 — retained old pages: every asset an old page needs must be
  // servable from the candidate (carry-forward copied it, or the candidate
  // still ships it at the same path). A retained reference that neither the
  // old release nor the candidate can serve fails the release.
  for (const oldRel of retainedSources) {
    for (const f of listFiles(oldRel)) {
      if (!f.rel.endsWith(".html")) continue;
      for (const ref of extractAssetRefs(readFileSync(f.path, "utf8"))) {
        const inOld = resolveInside(oldRel, ref);
        const inNew = resolveInside(outDir, ref);
        if (inOld.ok && existsSync(inOld.abs)) {
          if (!inNew.ok || !existsSync(inNew.abs))
            failures.push(`3: retained old-page asset not servable in release: ${ref} (from ${oldRel.split("/").pop()}/${f.rel})`);
        } else if (!inNew.ok || !existsSync(inNew.abs)) {
          failures.push(`3: retained old-page reference unresolvable: ${ref} (from ${oldRel.split("/").pop()}/${f.rel})`);
        }
      }
    }
  }

  // Gate 4: no private source files in the candidate.
  for (const f of listFiles(outDir)) {
    if (PRIVATE_PATTERNS.some((p) => p.test(f.rel)))
      failures.push(`4: private source file in release: ${f.rel}`);
  }

  // Gate 5: no draft route HTML.
  for (const slug of drafts.map((g) => g.slug)) {
    if (existsSync(join(outDir, "galleries", slug, "index.html")))
      failures.push(`5: draft gallery page in release: ${slug}`);
  }

  // Gate 6: no GPS in derivative EXIF. Consumed as a subprocess (WP-21
  // authoritative scanner, scripts/media/privacy-check.ts) — no EXIF parsing
  // logic is copied here. The scanner walks candidate media/ only, and fails
  // closed on any finding (and on an empty scan set).
  const scan = spawnSync(
    "node",
    [
      "--experimental-strip-types",
      "--import",
      pathToFileURL(join(ROOT, "scripts", "validate", "register-ts-resolve.mjs")).href,
      join(ROOT, "scripts", "media", "privacy-check.ts"),
      join(outDir, "media"),
    ],
    { encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } },
  );
  if (scan.status !== 0) {
    const detail = (scan.stderr || scan.stdout || "").trim().split("\n").pop() ?? "";
    failures.push(`6: privacy scan found metadata in release media (exit ${scan.status})${detail ? ` — ${detail}` : ""}`);
  }

  // Gate 7: static 404.html exists.
  if (!existsSync(join(outDir, "404.html"))) failures.push("7: 404.html missing");

  // Gate 8: sitemap validity — R8/I2. sitemap.xml must parse as real XML with
  // a <urlset> root (sax strict parse), every <loc> must be an absolute
  // http(s) URL on a host, and the URL path set must match the published
  // canonical set EXACTLY: every published canonical present (static authority
  // paths + published galleries + published-referenced places, minus redirect
  // old paths — the same inputs the WP-44 endpoint feeds renderSitemap), no
  // unknown URL, no draft. Comments never contribute URLs; malformed XML,
  // non-urlset roots and relative/foreign-scheme locs are rejected.
  const sitemap = join(outDir, "sitemap.xml");
  if (!existsSync(sitemap)) failures.push("8: sitemap.xml missing");
  else {
    const parsed = await parseSitemapLocs(readFileSync(sitemap, "utf8"));
    if (!parsed.ok) failures.push(`8: sitemap.xml is not valid XML — ${parsed.error}`);
    else if (parsed.locs.length === 0) failures.push("8: sitemap.xml contains no <loc> entries");
    else {
      const paths = [];
      let badLoc = null;
      for (const loc of parsed.locs) {
        const p = canonicalPathFromLoc(loc);
        if (p === null) {
          badLoc = loc;
          break;
        }
        paths.push(p);
      }
      if (badLoc !== null)
        failures.push(`8: sitemap <loc> is not an absolute site URL: ${badLoc}`);
      else {
        // The published canonical set — ONE authority with the WP-44 sitemap
        // endpoint (src/lib/seo/sitemap.ts STATIC_SITEMAP_PATHS; loaded via a
        // lazy dynamic import so plain-node consumers of validateManifest,
        // e.g. atomic-deploy, never need the TS bootstrap).
        let expected;
        try {
          const authority = await import("../../src/lib/seo/sitemap.ts");
          expected = new Set(authority.STATIC_SITEMAP_PATHS);
        } catch (e) {
          failures.push(`8: sitemap authority (src/lib/seo/sitemap.ts) unavailable — ${briefError(e)}`);
          expected = null;
        }
        if (expected) {
          for (const g of published) expected.add(`/galleries/${g.slug}`);
          for (const slug of requiredPlaces.slugs) expected.add(`/places/${slug}`);
          if (redirectsResult && redirectsResult.ok) {
            for (const dest of redirectsResult.resolved) {
              const oldPath = dest.oldPath.startsWith("/") ? dest.oldPath : `/${dest.oldPath}`;
              expected.delete(oldPath);
            }
          }
          const actual = new Set(paths);
          for (const p of expected)
            if (!actual.has(p)) failures.push(`8: sitemap missing canonical URL ${p}`);
          for (const p of actual)
            if (!expected.has(p)) failures.push(`8: sitemap URL not in published canonical set: ${p}`);
          for (const slug of drafts.map((g) => g.slug))
            if (actual.has(`/galleries/${slug}`)) failures.push(`8: sitemap leaks draft: ${slug}`);
        }
      }
    }
  }

  // Gate 9: redirect targets resolve to existing published pages (裁定② —
  // consume the WP-12 authoritative validator, never copy its logic; the
  // validation itself ran at the top of this function).
  if (redirectsResult && redirectsResult.ok) {
    for (const dest of redirectsResult.resolved) {
      const page = join(outDir, stripSlash(dest.destination), "index.html");
      if (!existsSync(page)) failures.push(`9: redirect target missing in release: ${dest.oldPath} -> ${dest.destination}`);
    }
  }

  return failures;
}

// ---------------------------------------------------------------------------
// Manifest validation — separate stage after the gates
// ---------------------------------------------------------------------------

/**
 * Validate a release manifest.json: shape, path safety, hashes, and (when
 * fullClosureCoverage is on) exact coverage of the candidate's file set.
 * The manifest file itself is the boundary of its own description and is
 * excluded from the closure check.
 */
export function validateManifest(manifestPath, outDir, { fullClosureCoverage = true } = {}) {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (e) {
    return [`manifest parse error: ${e.message}`];
  }

  if (!manifest || typeof manifest !== "object") return ["manifest must be an object"];
  if (!Array.isArray(manifest.files)) return ["manifest.files must be an array"];
  if (manifest.files.length === 0) return ["manifest.files must be non-empty"];

  const seen = new Set();
  const listedRel = new Set();
  for (const f of manifest.files) {
    if (typeof f.path !== "string") return [`manifest entry missing path: ${JSON.stringify(f)}`];
    const resolved = resolve(join(outDir, f.path));
    const relOut = relative(outDir, resolved);
    if (relOut !== "" && (relOut.startsWith("..") || isAbsolute(relOut)))
      return [`manifest path escapes release dir: ${f.path}`];
    if (seen.has(f.path)) return [`manifest duplicate path: ${f.path}`];
    seen.add(f.path);

    if (typeof f.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(f.sha256))
      return [`manifest entry invalid sha256: ${f.path}`];

    const filePath = join(outDir, f.path);
    if (!existsSync(filePath)) return [`manifest listed file missing: ${f.path}`];
    // Symlinks are rejected outright: readFileSync would silently follow a
    // link and the sha256 would describe a file OUTSIDE the release boundary
    // (a release must be a self-contained tree, never a link farm).
    if (lstatSync(filePath).isSymbolicLink())
      return [`manifest listed file is a symlink: ${f.path}`];
    if (sha256File(filePath) !== f.sha256) return [`manifest sha256 mismatch: ${f.path}`];
    listedRel.add(f.path);
  }

  if (fullClosureCoverage) {
    // The manifest must cover EXACTLY the candidate's file set — an
    // unlisted real file means the manifest is stale/incomplete.
    const manifestRel = manifestPath.slice(outDir.length + 1);
    for (const f of listFiles(outDir)) {
      if (f.rel !== manifestRel && !listedRel.has(f.rel))
        return [`manifest does not list actual release file: ${f.rel}`];
    }
  }

  return [];
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  let outDir = null;
  let dist = DEFAULT_DIST;
  let contentRoot = DEFAULT_CONTENT;
  let assetManifestPath = null;
  let retain = 2;
  let carryFrom = [];
  // R8/I6 isolation: automatic carry-forward discovery is OPT-IN. Without an
  // explicit --releases the CLI never reads the real repository releases/
  // directory — suites that assemble synthetic candidates with isolated
  // --content roots (and one-off local assemblies) must not silently inherit
  // whatever real releases happen to sit on disk. Production runs
  // (runbook REBUILD-LOCAL §4) pass --releases explicitly.
  let releasesDir = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--out" && args[i + 1]) outDir = args[i + 1];
    else if (args[i] === "--dist" && args[i + 1]) dist = resolve(args[i + 1]);
    else if (args[i] === "--content" && args[i + 1]) contentRoot = resolve(args[i + 1]);
    else if (args[i] === "--asset-manifest" && args[i + 1]) assetManifestPath = resolve(args[i + 1]);
    else if (args[i] === "--releases" && args[i + 1]) releasesDir = resolve(args[i + 1]);
    else if (args[i] === "--carry-from" && args[i + 1]) {
      for (const dir of args[i + 1].split(",")) {
        if (dir.trim()) carryFrom.push(resolve(dir.trim()));
      }
    } else if (args[i] === "--retain" && args[i + 1] && /^\d+$/.test(args[i + 1])) {
      retain = Number(args[i + 1]);
    }
  }
  if (!assetManifestPath) assetManifestPath = join(contentRoot, "generated", "asset-manifest.json");
  if (!outDir) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    outDir = join(RELEASES, ts);
  }
  outDir = resolve(outDir);

  if (existsSync(outDir)) {
    console.error(`[assemble-release] --out already exists; a candidate release dir is never reused: ${outDir}`);
    process.exitCode = 1;
    return;
  }
  if (!existsSync(dist)) {
    console.error("[assemble-release] --dist not found — run a build first");
    process.exitCode = 1;
    return;
  }

  // Stage the candidate in a unique temp dir next to the target.
  mkdirSync(dirname(outDir), { recursive: true });
  const tmpDir = join(dirname(outDir), `.assemble-tmp-${process.pid}-${Date.now()}`);
  const staged = join(tmpDir, "stage");
  try {
    mkdirSync(staged, { recursive: true });
    cpSync(dist, staged, { recursive: true });

    // Carry-forward (§6.4): copy retained old-release HTML assets missing
    // from this candidate BEFORE the gates, so gate 3's asset closure and
    // the manifest's exact-coverage check see a candidate that serves every
    // asset a retained old page references. Explicit --carry-from sources
    // win; otherwise discover the retained releases/ automatically (validity
    // = full manifest contract, R8/I3). Every copy is boundary-checked
    // BEFORE any write (R8/I4); carryForward returns the sources that
    // existed, whose references gate 3 then requires to be servable.
    const log = [];
    const explicitCarry = carryFrom.length > 0;
    const sources = explicitCarry
      ? carryFrom
      : releasesDir
        ? discoverCarryFrom(releasesDir, retain)
        : [];
    const retainedSources = carryForward(staged, sources, { log });
    for (const line of log) console.log(`[assemble-release] ${line}`);

    // Nine integrity gates FIRST, on the assembled copy AS-IS. A candidate
    // carrying a draft page must FAIL (not be silently cleaned): gate 5 is the
    // draft-exclusion authority and a stale dist must not ship half-removed.
    const failures = await runNineGate(staged, { contentRoot, assetManifestPath, retainedSources });
    if (failures.length > 0) {
      console.error("[assemble-release] NINE GATES FAILED — release not created:");
      for (const f of failures) console.error(`  - ${f}`);
      process.exitCode = 1;
      return;
    }

    // WP-51: post-gate cleanup — remove draft gallery pages so the shipped
    // release is published-only. Gates have already certified the candidate;
    // this is the published-only hygiene step (a no-op for a current dist).
    for (const slug of statusSplit(contentRoot).drafts.map((g) => g.slug)) {
      const draftDir = join(staged, "galleries", slug);
      if (existsSync(draftDir)) rmSync(draftDir, { recursive: true, force: true });
    }

    // Manifest validation — an integrity stage AFTER the gates, over the same
    // assembled copy.
    const files = listFiles(staged).map((f) => ({
      // POSIX separators: the manifest is consumed on Linux (atomic-deploy).
      path: f.rel.split(sep).join("/"),
      sha256: sha256File(f.path),
      bytes: statSync(f.path).size,
    }));
    const manifest = {
      release: outDir.split("/").pop(),
      createdAt: new Date().toISOString(),
      fileCount: files.length,
      files,
    };
    const manifestPath = join(staged, "manifest.json");
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    const manifestErrors = validateManifest(manifestPath, staged);
    if (manifestErrors.length > 0) {
      console.error("[assemble-release] MANIFEST INVALID — release not created:");
      for (const e of manifestErrors) console.error(`  - ${e}`);
      process.exitCode = 1;
      return;
    }

    // Promote the verified candidate into its final location (same directory,
    // so an atomic rename): a release appears only when fully valid.
    renameSync(staged, outDir);

    // Point releases/latest at the new release only after validation, and only
    // for releases living under the canonical releases/ dir (the default
    // --out). An external --out (tests, promote flows) must not rewrite the
    // repository's rolling "latest" pointer.
    if (outDir.startsWith(RELEASES + "/") || outDir === RELEASES) {
      mkdirSync(RELEASES, { recursive: true });
      const latest = join(RELEASES, "latest");
      try {
        try { unlinkSync(latest); } catch {}
        symlinkSync(outDir, latest);
      } catch {
        // Non-fatal on platforms without symlink support.
      }
    }

    console.log(`[assemble-release] release assembled: ${outDir}`);
    console.log(`[assemble-release] files: ${files.length}`);
    console.log(`[assemble-release] manifest: ${join(outDir, "manifest.json")}`);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && process.argv[1].endsWith("assemble-release.mjs")) {
  main().catch((e) => {
    console.error(String((e && e.stack) || e));
    process.exitCode = 1;
  });
}
