// WP-51 / P9 Task 2.1 — assemble-release.mjs nine-integrity-gate + manifest
// validation, driven through the REAL CLI as a subprocess with the SAME
// bootstrap the CLI requires to load the WP-12 TS validator:
//
//   node --experimental-strip-types --import ./scripts/validate/register-ts-resolve.mjs \
//        scripts/release/assemble-release.mjs --out <rel> --dist <dist> --content <root>
//
// Every bad-release test violates exactly ONE gate on a synthetic --dist
// candidate and asserts exit != 0 with NO manifest written, and NO half-built
// release directory left behind. The happy path uses a complete candidate and
// asserts exit 0 + a valid manifest. Additional tests exercise the separate
// manifest-validation stage (empty files, path escape, duplicates, bad sha,
// list-vs-actual drift), the existing --out rejection, and input
// immutability of --dist between assembly runs.
//
// Isolation: every test builds UNIQUE scratch roots via mkdtempSync under
// tests/tmp/isolated/release/ (gitignored). --content points at an isolated
// repo ROOT whose content/ carries the corner of the real corpus the gates
// need (published galleries + one draft + places + redirects.yaml), so the
// redirect registry, the sitemap slugs and the published canonical set all
// come from the SAME isolated root (裁定②). The real repo content/ is never
// read or written.
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import sharp from "sharp";
import { buildGpsExifPayload, spliceJpegExifApp1 } from "../support/privacy-fixtures";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

const REPO_ROOT = resolve(join(__dirname, "..", ".."));
const ASSEMBLY_SCRIPT = join(REPO_ROOT, "scripts", "release", "assemble-release.mjs");
const REGISTER_SCRIPT = resolve(join(REPO_ROOT, "scripts", "validate", "register-ts-resolve.mjs"));
const ISOLATION_ROOT = join(REPO_ROOT, "tests", "tmp", "isolated", "release");
const CONTENT = join(REPO_ROOT, "content");

// WP-12 / WP-21 consumers require the same TS-strip bootstrap and an explicit
// empty NODE_OPTIONS (never an inherited terminal setting).
const CLI_FLAGS = ["--experimental-strip-types", "--import", REGISTER_SCRIPT, ASSEMBLY_SCRIPT];

// ---------------------------------------------------------------------------
// CLI / fixture helpers
// ---------------------------------------------------------------------------

function runAssemble(args: string[]) {
  try {
    const stdout = execFileSync("node", [...CLI_FLAGS, ...args], {
      stdio: "pipe",
      encoding: "utf8",
      env: { ...process.env, NODE_OPTIONS: "" },
    });
    return { code: 0, stdout, stderr: "" };
  } catch (e: any) {
    return { code: e.status ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

/** Recursive sha256 of a tree (filename + content), for immutability checks. */
function treeHash(dir: string): string {
  const h = createHash("sha256");
  const walk = (d: string) => {
    for (const entry of readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) {
        h.update("d:" + entry.name + "\n");
        walk(full);
      } else if (entry.isFile()) {
        h.update("f:" + entry.name + ":" + createHash("sha256").update(readFileSync(full)).digest("hex") + "\n");
      }
    }
  };
  walk(dir);
  return h.digest("hex");
}

/** Copy one content-corpus category into an isolated content/ tree. */
function copyCorpus(subdir: string, name: string, destContent: string) {
  const full = join(CONTENT, subdir, name);
  const target = join(destContent, subdir, name);
  if (!existsSync(full)) throw new Error(`corpus fixture missing: ${full}`);
  cpSync(full, target, { recursive: true });
}

/**
 * A fresh isolated repo ROOT matching the WP-03 layout the gates expect:
 * <root>/content/{redirects.yaml,galleries,places}. The isolated root carries
 * two published galleries (referenced by the real redirects), one draft
 * gallery, and the places needed by the redirect targets — the minimal real
 * corpus the gates actually read.
 */
function makeContentRoot() {
  const root = mkdtempSync(join(ISOLATION_ROOT, "content-"));
  const content = join(root, "content");
  mkdirSync(content, { recursive: true });
  writeFileSync(join(content, "redirects.yaml"), readFileSync(join(CONTENT, "redirects.yaml"), "utf8"));
  copyCorpus("galleries", "lofoten-polar-night", content);
  copyCorpus("galleries", "aegean", content);
  copyCorpus("galleries", "iceland", content); // draft
  copyCorpus("places", "lofoten.yaml", content);
  // aegean is referenced by the PUBLISHED aegean gallery, so it is
  // a required canonical route (R8: the place set is derived from published
  // galleries' places references via a real YAML parser).
  copyCorpus("places", "aegean.yaml", content);
  // The real aegean gallery now also references Athens and Zakynthos;
  // gate 2 fails closed on a published gallery referencing a missing place.
  copyCorpus("places", "athens.yaml", content);
  copyCorpus("places", "zakynthos.yaml", content);
  // Draft-only place (pl_vik is referenced ONLY by the draft gallery): the
  // place exists in content/places but produces NO canonical route in the
  // built dist (BUILD_AND_ROUTING §4 published-only getStaticPaths, CONTENT_
  // MODEL §8.3). Every assemble test below builds a happy dist WITHOUT a
  // places/vik page — with the pre-F7 gate (page required for every
  // places/*.yaml) this line alone would fail the whole suite, so the suite
  // doubles as the regression net for the gate/build contract fix.
  copyCorpus("places", "vik.yaml", content);
  // ROLE ASSERTION: the real archive has no drafts, but several gates below
  // need a draft gallery that exists in the isolated content graph. iceland
  // plays that role here — demote its copy so the isolated corpus is
  // internally consistent (the source file is never modified).
  const icelandMeta = join(content, "galleries", "iceland", "meta.yaml");
  writeFileSync(
    icelandMeta,
    readFileSync(icelandMeta, "utf8").replace(/^status: published$/m, "status: draft"),
  );
  return { root, content };
}

/** Isolated content root + a <root>/generated/asset-manifest.json fixture. */
function makeContentRootWithAssetManifest(publicUrls: string[] = ["/media/clean.jpg"]) {
  const { root, content } = makeContentRoot();
  mkdirSync(join(root, "generated"), { recursive: true });
  writeFileSync(
    join(root, "generated", "asset-manifest.json"),
    JSON.stringify({
      envelope: { generated_at: new Date().toISOString() },
      manifest: { records: publicUrls.map((u) => ({ public_url: u })) },
    }),
  );
  return { root, content };
}

/**
 * The canonical sitemap.xml a happy candidate ships: published only. The
 * <loc> URLs match the REAL output of renderSitemap (src/lib/seo/sitemap.ts):
 * origin + path, and buildSitemapEntries paths have NO trailing slash
 * (confirmed: sitemap.xml.ts renders `/galleries/<slug>` not
 * `/galleries/<slug>/`). Gate 8's canonical-set check is exact, so the
 * fixture must mirror that shape.
 */
function happySitemap(): string {
  // R8 Gate 8 compares the FULL published canonical set: the frozen static
  // authority paths (STATIC_SITEMAP_PATHS: /, /archive, /places, /about) plus
  // published galleries and published-referenced places.
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    "  <url><loc>https://example.com/</loc></url>",
    "  <url><loc>https://example.com/archive</loc></url>",
    "  <url><loc>https://example.com/places</loc></url>",
    "  <url><loc>https://example.com/about</loc></url>",
    "  <url><loc>https://example.com/galleries/lofoten-polar-night</loc></url>",
    "  <url><loc>https://example.com/galleries/aegean</loc></url>",
    "  <url><loc>https://example.com/places/lofoten</loc></url>",
    "  <url><loc>https://example.com/places/aegean</loc></url>",
    "  <url><loc>https://example.com/places/athens</loc></url>",
    "  <url><loc>https://example.com/places/zakynthos</loc></url>",
    "</urlset>",
    "",
  ].join("\n");
}

/** Build the complete happy candidate dist tree. */
function makeHappyDist(dist: string) {
  mkdirSync(join(dist, "galleries", "lofoten-polar-night"), { recursive: true });
  writeFileSync(join(dist, "galleries", "lofoten-polar-night", "index.html"), "<html>lofoten-polar-night</html>");
  mkdirSync(join(dist, "galleries", "aegean"), { recursive: true });
  writeFileSync(join(dist, "galleries", "aegean", "index.html"), "<html>aegean</html>");
  mkdirSync(join(dist, "places", "lofoten"), { recursive: true });
  writeFileSync(join(dist, "places", "lofoten", "index.html"), "<html>lofoten</html>");
  mkdirSync(join(dist, "places", "aegean"), { recursive: true });
  writeFileSync(join(dist, "places", "aegean", "index.html"), "<html>aegean</html>");
  // aegean gallery references athens + zakynthos (2026-09-15 owner review).
  for (const placeSlug of ["athens", "zakynthos"]) {
    mkdirSync(join(dist, "places", placeSlug), { recursive: true });
    writeFileSync(join(dist, "places", placeSlug, "index.html"), `<html>${placeSlug}</html>`);
  }
  writeFileSync(join(dist, "index.html"), "<html>home</html>");
  for (const staticPage of ["archive", "places", "about"]) {
    mkdirSync(join(dist, staticPage), { recursive: true });
    writeFileSync(join(dist, staticPage, "index.html"), `<html>${staticPage}</html>`);
  }
  writeFileSync(join(dist, "404.html"), "<html>not found</html>");
  writeFileSync(join(dist, "sitemap.xml"), happySitemap());
  mkdirSync(join(dist, "media"), { recursive: true });
  writeFileSync(join(dist, "media", "clean.jpg"), readFileSync(join(ISOLATION_ROOT, "media", "clean.jpg")));
}

// ---------------------------------------------------------------------------
// Shared media fixtures (generate once; each test copies the files it needs)
// ---------------------------------------------------------------------------

let cleanJpeg: Buffer;
let gpsJpeg: Buffer;
/** Real WP-21-verified AVIF bytes (copied from generated/media/, § see below). */
let oldAvif: Buffer;

beforeAll(async () => {
  cleanJpeg = await sharp({ create: { width: 32, height: 32, channels: 3, background: { r: 90, g: 60, b: 30 } } })
    .jpeg({ quality: 80 })
    .toBuffer();
  gpsJpeg = spliceJpegExifApp1(cleanJpeg, buildGpsExifPayload());
  // The P9 R3 carry-forward old asset must survive gate 6's privacy scan
  // (scripts/media/privacy-check.ts, WP-21 authoritative). That scanner
  // enforces an EXACT producer contract on AVIF top-level boxes
  // (ftyp → meta → mdat, each exactly once, in order — R-01): a sharp
  // `{create:…}.avif()` synthetic buffer is NOT guaranteed to satisfy it.
  // The authoritative fixture source is therefore a REAL derivative that the
  // production pipeline (scripts/media/derive.ts) already produced and the
  // privacy scan already verified — generated/media/p_aurora_002-avif-w480-
  // e8f48fd81e421b31.avif (verified PASS on this worktree, 4427 B). Kept as a
  // Buffer and written via .toString('latin1') so the on-disk bytes round-trip
  // exactly — UTF-8 round-trips a binary AVIF lossily (a 0xD6 lead byte at
  // ftyp→meta collides with a UTF-8 multibyte sequence and the re-encoded file
  // no longer parses as ISOBMFF).
  // Resolve a REAL w480 AVIF from current pipeline output (any photo): the
  // gate under test is format-structural, so a hard-coded pre-swap filename
  // would rot on every corpus change.
  const avifDir = join(REPO_ROOT, "generated", "media");
  const avifFixtureName = readdirSync(avifDir).find((n) => /-avif-w480-[0-9a-f]+[.]avif$/.test(n));
  if (avifFixtureName === undefined) {
    throw new Error("R3 fixture source missing: no generated/media/*-avif-w480-*.avif - run the media pipeline");
  }
  const REAL_AVIF_REL = join("generated", "media", avifFixtureName);
  const realAvifPath = join(REPO_ROOT, REAL_AVIF_REL);
  if (!existsSync(realAvifPath)) {
    throw new Error(`R3 fixture source missing: ${REAL_AVIF_REL} — regenerate media or copy a real AVIF there`);
  }
  oldAvif = readFileSync(realAvifPath);
  // Persisted under the isolation root so dist trees can reference them by cp.
  mkdirSync(join(ISOLATION_ROOT, "media"), { recursive: true });
  writeFileSync(join(ISOLATION_ROOT, "media", "clean.jpg"), cleanJpeg);
  writeFileSync(join(ISOLATION_ROOT, "media", "gps.jpg"), gpsJpeg);
  // Explicit 'latin1' ENCODING: without it writeFileSync re-encodes the
  // U+00D6-holding string as UTF-8 (0xC3 0x96), corrupting the box header.
  writeFileSync(join(ISOLATION_ROOT, "media", "p_old_abc.avif"), oldAvif.toString("latin1"), "latin1");
});

afterAll(() => {
  rmSync(join(ISOLATION_ROOT, "media"), { recursive: true, force: true });
});

afterEach(() => {
  // Remove every scratch root created under the isolation root (gitignored).
  for (const entry of readdirSync(ISOLATION_ROOT)) {
    if (entry !== "media" && entry !== "README.md") {
      rmSync(join(ISOLATION_ROOT, entry), { recursive: true, force: true });
    }
  }
});

// ---------------------------------------------------------------------------
// Nine gates — one bad candidate each (real CLI)
// ---------------------------------------------------------------------------

// Each test in this block spawns the assemble CLI as a subprocess; several
// sequential subprocess runs exceed Vitest's 5s default, so the suite carries
// an explicit per-test budget (the CLI work itself is bounded internally).
describe("P9 Task 2.1: release assembly nine gates (CLI)", { timeout: 60_000 }, () => {
  test("gate 1: missing index.html rejects release", () => {
    const { root } = makeContentRootWithAssetManifest();
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeHappyDist(dist);
    rmSync(join(dist, "index.html"));

    const out = join(root, "release-bad");
    const { code } = runAssemble(["--out", out, "--dist", dist, "--content", root]);
    expect(code).not.toBe(0);
    expect(existsSync(join(out, "manifest.json"))).toBe(false);
    expect(existsSync(out)).toBe(false); // no half-built release left behind
  });

  test("gate 2: missing canonical page for a published gallery rejects release", () => {
    const { root } = makeContentRootWithAssetManifest();
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeHappyDist(dist);
    rmSync(join(dist, "galleries", "lofoten-polar-night", "index.html"));

    const out = join(root, "release-bad");
    const { code } = runAssemble(["--out", out, "--dist", dist, "--content", root]);
    expect(code).not.toBe(0);
    expect(existsSync(join(out, "manifest.json"))).toBe(false);
  });

  test("gate 3: asset-manifest public_url without a file in the candidate rejects release", () => {
    const { root } = makeContentRootWithAssetManifest(["/media/clean.jpg", "/media/p_lost_001-avif-w800-hash.avif"]);
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeHappyDist(dist);
    // The manifest references a derivative that never landed in the candidate.

    const out = join(root, "release-bad");
    const { code } = runAssemble(["--out", out, "--dist", dist, "--content", root]);
    expect(code).not.toBe(0);
    expect(existsSync(join(out, "manifest.json"))).toBe(false);
  });

  test("gate 3: absent asset-manifest fails closed (closure authority must exist)", () => {
    const { root } = makeContentRoot(); // no generated/asset-manifest.json
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeHappyDist(dist);

    const out = join(root, "release-bad");
    const { code, stderr } = runAssemble(["--out", out, "--dist", dist, "--content", root]);
    expect(code).not.toBe(0);
    expect(stderr).toContain("3: asset manifest unreadable");
    expect(existsSync(join(out, "manifest.json"))).toBe(false);
  });

  test("gate 4: private source files (ingest-masters / raw extension) in candidate rejects release", () => {
    const { root } = makeContentRootWithAssetManifest();
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeHappyDist(dist);
    mkdirSync(join(dist, "media", "ingest-masters"), { recursive: true });
    writeFileSync(join(dist, "media", "ingest-masters", "DSC02762.jpg"), "source master");

    const out = join(root, "release-bad");
    const { code } = runAssemble(["--out", out, "--dist", dist, "--content", root]);
    expect(code).not.toBe(0);
    expect(existsSync(join(out, "manifest.json"))).toBe(false);
  });

  test("gate 5: draft gallery page in candidate rejects release", () => {
    const { root } = makeContentRootWithAssetManifest();
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeHappyDist(dist);
    // iceland is a draft in the isolated root.
    mkdirSync(join(dist, "galleries", "iceland"), { recursive: true });
    writeFileSync(join(dist, "galleries", "iceland", "index.html"), "<html>draft, must not ship</html>");

    const out = join(root, "release-bad");
    const { code } = runAssemble(["--out", out, "--dist", dist, "--content", root]);
    expect(code).not.toBe(0);
    expect(existsSync(join(out, "manifest.json"))).toBe(false);
  });

  test("gate 6: GPS-carrying derivative in candidate rejects release (privacy subprocess)", () => {
    const { root } = makeContentRootWithAssetManifest();
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeHappyDist(dist);
    writeFileSync(join(dist, "media", "clean.jpg"), readFileSync(join(ISOLATION_ROOT, "media", "gps.jpg")));

    const out = join(root, "release-bad");
    const { code } = runAssemble(["--out", out, "--dist", dist, "--content", root]);
    expect(code).not.toBe(0);
    expect(existsSync(join(out, "manifest.json"))).toBe(false);
  });

  test("gate 7: missing 404.html rejects release", () => {
    const { root } = makeContentRootWithAssetManifest();
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeHappyDist(dist);
    rmSync(join(dist, "404.html"));

    const out = join(root, "release-bad");
    const { code } = runAssemble(["--out", out, "--dist", dist, "--content", root]);
    expect(code).not.toBe(0);
    expect(existsSync(join(out, "manifest.json"))).toBe(false);
    expect(existsSync(out)).toBe(false);
  });

  test("gate 8: sitemap missing a published canonical URL rejects release", () => {
    const { root } = makeContentRootWithAssetManifest();
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeHappyDist(dist);
    // lofoten-polar-night is a published gallery in the isolated root; a sitemap
    // that omits its canonical URL is a partial release.
    const truncated = happySitemap().replace(
      "  <url><loc>https://example.com/galleries/lofoten-polar-night</loc></url>\n",
      "",
    );
    writeFileSync(join(dist, "sitemap.xml"), truncated);

    const out = join(root, "release-bad");
    const { code } = runAssemble(["--out", out, "--dist", dist, "--content", root]);
    expect(code).not.toBe(0);
    expect(existsSync(join(out, "manifest.json"))).toBe(false);
  });

  test("gate 8: sitemap leaking a draft slug rejects release", () => {
    const { root } = makeContentRootWithAssetManifest();
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeHappyDist(dist);
    // iceland is brand-new draft: a sitemap listing it leaks.
    const leaked = happySitemap().replace(
      "https://example.com/places/lofoten",
      "https://example.com/galleries/iceland",
    );
    writeFileSync(join(dist, "sitemap.xml"), leaked);

    const out = join(root, "release-bad");
    const { code } = runAssemble(["--out", out, "--dist", dist, "--content", root]);
    expect(code).not.toBe(0);
    expect(existsSync(join(out, "manifest.json"))).toBe(false);
  });

  // F3: strict asset-manifest schema + XML sitemap + expanded private-file
  // patterns. Each test injects exactly ONE fault into an otherwise-happy
  // candidate (same fixture as the happy path).
  test("F3 gate 3: asset manifest {} (invalid structure) rejects release", () => {
    const { root } = makeContentRoot();
    mkdirSync(join(root, "generated"), { recursive: true });
    writeFileSync(join(root, "generated", "asset-manifest.json"), "{}");
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeHappyDist(dist);

    const out = join(root, "release-bad");
    const { code, stderr } = runAssemble(["--out", out, "--dist", dist, "--content", root]);
    expect(code).not.toBe(0);
    expect(stderr).toContain("asset manifest invalid structure");
    expect(existsSync(join(out, "manifest.json"))).toBe(false);
  });

  test("F3 gate 3: asset manifest { manifest: {} } rejects release", () => {
    const { root } = makeContentRoot();
    mkdirSync(join(root, "generated"), { recursive: true });
    writeFileSync(join(root, "generated", "asset-manifest.json"), JSON.stringify({ manifest: {} }));
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeHappyDist(dist);

    const out = join(root, "release-bad");
    const { code, stderr } = runAssemble(["--out", out, "--dist", dist, "--content", root]);
    expect(code).not.toBe(0);
    expect(stderr).toContain("asset manifest invalid structure");
    expect(existsSync(join(out, "manifest.json"))).toBe(false);
  });

  test("F3 gate 3: asset manifest { manifest: { records: \"not-array\" } } rejects release", () => {
    const { root } = makeContentRoot();
    mkdirSync(join(root, "generated"), { recursive: true });
    writeFileSync(
      join(root, "generated", "asset-manifest.json"),
      JSON.stringify({ manifest: { records: "not-array" } }),
    );
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeHappyDist(dist);

    const out = join(root, "release-bad");
    const { code, stderr } = runAssemble(["--out", out, "--dist", dist, "--content", root]);
    expect(code).not.toBe(0);
    expect(stderr).toContain("asset manifest invalid structure");
    expect(existsSync(join(out, "manifest.json"))).toBe(false);
  });

  test("F3 gate 3: legal empty collection { manifest: { records: [] } } passes BUT other gates still run", () => {
    // The empty record set is a legal empty collection; Gate 7 (404.html) is
    // still evaluated, so dropping 404.html must fail the release.
    const { root } = makeContentRoot();
    mkdirSync(join(root, "generated"), { recursive: true });
    writeFileSync(join(root, "generated", "asset-manifest.json"), JSON.stringify({ manifest: { records: [] } }));
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeHappyDist(dist);
    rmSync(join(dist, "404.html"));

    const out = join(root, "release-bad");
    const { code, stderr } = runAssemble(["--out", out, "--dist", dist, "--content", root]);
    expect(code).not.toBe(0);
    expect(stderr).toContain("7: 404.html missing");
    expect(existsSync(join(out, "manifest.json"))).toBe(false);
  });

  test("F3 gate 8: sitemap.xml = THIS IS NOT XML rejects release", () => {
    const { root } = makeContentRootWithAssetManifest();
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeHappyDist(dist);
    writeFileSync(join(dist, "sitemap.xml"), "THIS IS NOT XML");

    const out = join(root, "release-bad");
    const { code, stderr } = runAssemble(["--out", out, "--dist", dist, "--content", root]);
    expect(code).not.toBe(0);
    expect(stderr).toContain("8: sitemap.xml is not valid XML");
    expect(existsSync(join(out, "manifest.json"))).toBe(false);
  });

  test("F3 gate 8: valid XML without canonical set / trailing-slash URLs rejects release", () => {
    // Well-formed <urlset> XML but the <loc> bodies use trailing-slash URLs
    // (NOT the real renderSitemap shape) — the canonical-set check is exact.
    const { root } = makeContentRootWithAssetManifest();
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeHappyDist(dist);
    writeFileSync(
      join(dist, "sitemap.xml"),
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        "  <url><loc>https://example.com/galleries/lofoten-polar-night/</loc></url>",
        "  <url><loc>https://example.com/galleries/aegean/</loc></url>",
        "  <url><loc>https://example.com/places/lofoten/</loc></url>",
        "</urlset>",
        "",
      ].join("\n"),
    );

    const out = join(root, "release-bad");
    const { code, stderr } = runAssemble(["--out", out, "--dist", dist, "--content", root]);
    expect(code).not.toBe(0);
    expect(stderr).toContain("missing canonical URL /galleries/lofoten-polar-night");
    expect(existsSync(join(out, "manifest.json"))).toBe(false);
  });

  test("F3 gate 4: content/private.yaml in candidate rejects release", () => {
    const { root } = makeContentRootWithAssetManifest();
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeHappyDist(dist);
    mkdirSync(join(dist, "content"), { recursive: true });
    writeFileSync(join(dist, "content", "private.yaml"), "source: private");

    const out = join(root, "release-bad");
    const { code } = runAssemble(["--out", out, "--dist", dist, "--content", root]);
    expect(code).not.toBe(0);
    expect(existsSync(join(out, "manifest.json"))).toBe(false);
  });

  test("F3 gate 4: DSC_0001.JPG in candidate rejects release", () => {
    const { root } = makeContentRootWithAssetManifest();
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeHappyDist(dist);
    mkdirSync(join(dist, "media"), { recursive: true });
    writeFileSync(join(dist, "media", "DSC_0001.JPG"), "camera export");

    const out = join(root, "release-bad");
    const { code } = runAssemble(["--out", out, "--dist", dist, "--content", root]);
    expect(code).not.toBe(0);
    expect(existsSync(join(out, "manifest.json"))).toBe(false);
  });

  test("gate 9: redirect destination missing in candidate rejects release", () => {
    const { root } = makeContentRootWithAssetManifest();
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeHappyDist(dist);
    // The isolated aliases resolve /places/old-lofoten -> /places/lofoten: dropping
    // that page leaves a 301 with no target (gate 2 does not read places).
    rmSync(join(dist, "places", "lofoten", "index.html"));

    const out = join(root, "release-bad");
    const { code } = runAssemble(["--out", out, "--dist", dist, "--content", root]);
    expect(code).not.toBe(0);
    expect(existsSync(join(out, "manifest.json"))).toBe(false);
  });

  test("happy path: complete candidate passes all gates, manifest written + valid", () => {
    const { root } = makeContentRootWithAssetManifest();
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeHappyDist(dist);

    const out = join(root, "release-ok");
    const { code, stdout } = runAssemble(["--out", out, "--dist", dist, "--content", root]);
    expect(code, stdout).toBe(0);
    expect(existsSync(join(out, "manifest.json"))).toBe(true);

    const manifest = JSON.parse(readFileSync(join(out, "manifest.json"), "utf8"));
    expect(manifest.files.length).toBeGreaterThan(0);
    const paths = manifest.files.map((f: any) => f.path);
    for (const p of ["index.html", "404.html", "sitemap.xml", "galleries/lofoten-polar-night/index.html", "galleries/aegean/index.html", "media/clean.jpg"]) {
      expect(paths).toContain(p);
    }
    for (const f of manifest.files) {
      expect(f.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
    // No draft page shipped.
    expect(paths.some((p: string) => p.startsWith("galleries/iceland/"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Manifest validation — separate stage, exercised directly (pure function)
// ---------------------------------------------------------------------------

describe("P9 Task 2.1: manifest validation stage", () => {
  async function makeOutDir() {
    // A fully valid tree: a.txt + b.txt with a correct manifest.
    const dir = mkdtempSync(join(ISOLATION_ROOT, "mv-"));
    writeFileSync(join(dir, "a.txt"), "AAA");
    writeFileSync(join(dir, "b.txt"), "BBB");
    return dir;
  }
  function sha(s: string): string {
    return createHash("sha256").update(s).digest("hex");
  }
  function writeManifest(dir: string, files: any[]) {
    writeFileSync(join(dir, "manifest.json"), JSON.stringify({ files }));
  }

  test("valid manifest passes", async () => {
    const dir = await makeOutDir();
    writeManifest(dir, [
      { path: "a.txt", sha256: sha("AAA") },
      { path: "b.txt", sha256: sha("BBB") },
    ]);
    const { validateManifest } = await import("../../scripts/release/assemble-release.mjs");
    expect(validateManifest(join(dir, "manifest.json"), dir)).toEqual([]);
  });

  test("empty files array rejected", async () => {
    const dir = await makeOutDir();
    writeManifest(dir, []);
    const { validateManifest } = await import("../../scripts/release/assemble-release.mjs");
    const errs = validateManifest(join(dir, "manifest.json"), dir);
    expect(errs.length).toBeGreaterThan(0);
    expect(errs.join("\n")).toMatch(/non-empty/);
  });

  test("path escaping the release dir rejected", async () => {
    const dir = await makeOutDir();
    writeManifest(dir, [
      { path: "../evil.txt", sha256: sha("x") },
      { path: "a.txt", sha256: sha("AAA") },
    ]);
    const { validateManifest } = await import("../../scripts/release/assemble-release.mjs");
    const errs = validateManifest(join(dir, "manifest.json"), dir);
    expect(errs.join("\n")).toMatch(/escapes/);
  });

  test("duplicate path rejected", async () => {
    const dir = await makeOutDir();
    writeManifest(dir, [
      { path: "a.txt", sha256: sha("AAA") },
      { path: "a.txt", sha256: sha("AAA") },
    ]);
    const { validateManifest } = await import("../../scripts/release/assemble-release.mjs");
    const errs = validateManifest(join(dir, "manifest.json"), dir);
    expect(errs.join("\n")).toMatch(/duplicate/);
  });

  test("invalid sha256 rejected", async () => {
    const dir = await makeOutDir();
    writeManifest(dir, [{ path: "a.txt", sha256: "not-a-hash" }]);
    const { validateManifest } = await import("../../scripts/release/assemble-release.mjs");
    const errs = validateManifest(join(dir, "manifest.json"), dir);
    expect(errs.join("\n")).toMatch(/sha256/);
  });

  test("listed file missing on disk rejected", async () => {
    const dir = await makeOutDir();
    writeManifest(dir, [
      { path: "a.txt", sha256: sha("AAA") },
      { path: "nope.txt", sha256: sha("whatever") },
    ]);
    const { validateManifest } = await import("../../scripts/release/assemble-release.mjs");
    const errs = validateManifest(join(dir, "manifest.json"), dir);
    expect(errs.join("\n")).toMatch(/missing/);
  });

  test("manifest vs actual file set drift rejected", async () => {
    const dir = await makeOutDir();
    // b.txt exists on disk but is not listed — the manifest must cover
    // exactly the candidate's file set.
    writeManifest(dir, [{ path: "a.txt", sha256: sha("AAA") }]);
    const { validateManifest } = await import("../../scripts/release/assemble-release.mjs");
    const errs = validateManifest(join(dir, "manifest.json"), dir);
    expect(errs.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// CLI contract: --out rejection + input immutability
// ---------------------------------------------------------------------------

describe("P9 Task 2.1: CLI contract", () => {
  test("--out pointing at an existing directory is rejected", () => {
    const { root } = makeContentRootWithAssetManifest();
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeHappyDist(dist);
    const out = join(root, "release-existing");
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "stale.txt"), "x");

    const { code } = runAssemble(["--out", out, "--dist", dist, "--content", root]);
    expect(code).not.toBe(0);
    // The pre-existing directory must be untouched.
    expect(readFileSync(join(out, "stale.txt"), "utf8")).toBe("x");
    expect(existsSync(join(out, "manifest.json"))).toBe(false);
  });

  test("--dist tree is byte-identical before and after an assembly", () => {
    const { root } = makeContentRootWithAssetManifest();
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeHappyDist(dist);
    const before = treeHash(dist);

    const out = join(root, "release-ok");
    const { code } = runAssemble(["--out", out, "--dist", dist, "--content", root]);
    expect(code).toBe(0);
    expect(treeHash(dist)).toBe(before);
  });

  test("gate failure writes no manifest and leaves no half-built release", () => {
    const { root } = makeContentRootWithAssetManifest();
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeHappyDist(dist);
    rmSync(join(dist, "sitemap.xml")); // gate 8 first failure

    const out = join(root, "release-cleanup");
    const { code } = runAssemble(["--out", out, "--dist", dist, "--content", root]);
    expect(code).not.toBe(0);
    expect(existsSync(out)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// P9 R3 — carry-forward (F5): old-page asset availability (§6.4)
// ---------------------------------------------------------------------------

/**
 * R8: a "valid old release" for auto-discovery must satisfy the FULL manifest
 * contract (complete listing + correct sha256 per file). These fixtures write
 * their manifest from the actual directory tree, so the fixture IS a release
 * in good standing rather than merely parseable JSON.
 */
function writeTreeManifest(dir: string) {
  const files: Array<{ path: string; sha256: string }> = [];
  const walk = (d: string) => {
    for (const entry of readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name !== "manifest.json")
        files.push({ path: full.slice(dir.length + 1), sha256: createHash("sha256").update(readFileSync(full)).digest("hex") });
    }
  };
  walk(dir);
  writeFileSync(join(dir, "manifest.json"), JSON.stringify({ files }, null, 2));
}

describe("P9 R3 (F5): carry-forward old release assets referenced by retained HTML", () => {
  /** The real AVIF bytes the old release served for p_old_abc.avif (set in beforeAll). */
  let OLD_AVIF_BYTES: string;
  beforeAll(() => {
    // latin1: byte-for-byte string form of the AVIF (utf8 would corrupt it).
    OLD_AVIF_BYTES = oldAvif.toString("latin1");
  });

  /** Old release A: a page referencing a legacy asset only A serves. */
  function makeOldReleaseA(dir: string) {
    mkdirSync(join(dir, "media"), { recursive: true });
    writeFileSync(join(dir, "media", "p_old_abc.avif"), OLD_AVIF_BYTES, "latin1");
    writeFileSync(
      join(dir, "index.html"),
      `<html><head></head><body><img src="/media/p_old_abc.avif" srcset="/media/p_old_abc.avif 800w" alt="old"></body></html>`,
    );
    writeTreeManifest(dir);
  }

  /** New candidate B: home page no longer references the old asset. */
  function makeNewDistB(dist: string) {
    makeHappyDist(dist);
    writeFileSync(
      join(dist, "index.html"),
      '<html><head></head><body><img src="/media/clean.jpg" alt="new"></body></html>',
    );
  }

  test("carry-forward: old URL still serves the same bytes, and is in the manifest", () => {
    const { root } = makeContentRootWithAssetManifest();
    const relA = mkdtempSync(join(ISOLATION_ROOT, "release-A-"));
    makeOldReleaseA(relA);
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeNewDistB(dist);

    const out = join(root, "release-carried");
    const { code, stdout, stderr } = runAssemble([
      "--out", out, "--dist", dist, "--content", root,
      "--carry-from", relA,
    ]);
    expect(code, stderr || stdout).toBe(0);

    // Same URL, same bytes: the carried asset resolves at the candidate-relative
    // path the old HTML referenced, byte-identical to what old release A served.
    // Both sides are binary (a real AVIF), so compare byte buffers — utf8
    // string equality would corrupt them.
    expect(existsSync(join(out, "media", "p_old_abc.avif"))).toBe(true);
    expect(readFileSync(join(out, "media", "p_old_abc.avif")).equals(oldAvif)).toBe(true);
    expect(stdout).toContain("carried forward media/p_old_abc.avif");

    // Closure: gate 3's manifest-required /media/clean.jpg and the carried
    // asset are both in the release; the manifest records the carried asset.
    const manifest = JSON.parse(readFileSync(join(out, "manifest.json"), "utf8"));
    const paths = manifest.files.map((f: any) => f.path);
    expect(paths).toContain("media/p_old_abc.avif");
    expect(paths).toContain("media/clean.jpg");
    const carriedRec = manifest.files.find((f: any) => f.path === "media/p_old_abc.avif");
    expect(carriedRec.sha256).toBe(createHash("sha256").update(oldAvif).digest("hex"));
  });

  test("carry-forward survives cleanup: after old release A is removed, the carried asset still resolves", () => {
    const { root } = makeContentRootWithAssetManifest();
    const relA = mkdtempSync(join(ISOLATION_ROOT, "release-A-"));
    makeOldReleaseA(relA);
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeNewDistB(dist);

    const out = join(root, "release-cleaned");
    const { code, stderr } = runAssemble([
      "--out", out, "--dist", dist, "--content", root,
      "--carry-from", relA,
    ]);
    expect(code, stderr).toBe(0);
    expect(readFileSync(join(out, "media", "p_old_abc.avif")).equals(oldAvif)).toBe(true);

    // Retention cleanup (§2.1) deletes old release A. The asset the old HTML
    // referenced was carried INTO the assembled release, so a visitor with a
    // cached page from A still resolves the same URL to the same bytes — the
    // lazy-loaded hashed URL must not 404 just because the SOURCE release was
    // cleaned up (DEPLOYMENT_ARCHITECTURE §6.4 invariant).
    rmSync(relA, { recursive: true, force: true });
    expect(existsSync(join(out, "media", "p_old_abc.avif"))).toBe(true);
    expect(readFileSync(join(out, "media", "p_old_abc.avif")).equals(oldAvif)).toBe(true);
  });

  test("--retain 1 limits auto-discovery to the most recent valid release only", () => {
    const { root } = makeContentRootWithAssetManifest();
    const releasesDir = mkdtempSync(join(ISOLATION_ROOT, "carry-auto-"));
    // Release names follow the §2.1 sortable-timestamp convention: later
    // releases sort LEXICALLY LARGER ("rel-2" > "rel-1"), so rel-2 is the
    // most recent and rel-1 the older release.
    const relOld = join(releasesDir, "rel-1");
    const relNew = join(releasesDir, "rel-2");
    makeOldReleaseA(relOld);
    // Newer release: still references its own asset — only rel-2 is retained.
    mkdirSync(join(relNew, "media"), { recursive: true });
    writeFileSync(join(relNew, "media", "p_new_def.avif"), OLD_AVIF_BYTES, "latin1");
    writeFileSync(
      join(relNew, "index.html"),
      '<html><img src="/media/p_new_def.avif" alt="new"></html>',
    );
    writeTreeManifest(relNew);
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeNewDistB(dist);

    const out = join(root, "release-retain1");
    const { code, stdout, stderr } = runAssemble([
      "--out", out, "--dist", dist, "--content", root,
      "--releases", releasesDir,
      "--retain", "1",
    ]);
    expect(code, stderr || stdout).toBe(0);
    // Only the NEW release's asset is carried (rel-2 is the single retained
    // release); the OLD release's asset is NOT (rel-1 is beyond retention).
    expect(existsSync(join(out, "media", "p_new_def.avif"))).toBe(true);
    expect(readFileSync(join(out, "media", "p_new_def.avif")).equals(oldAvif)).toBe(true);
    expect(existsSync(join(out, "media", "p_old_abc.avif"))).toBe(false);
    expect(stdout).toContain("carried forward media/p_new_def.avif");
    expect(stdout).not.toContain("p_old_abc");
  });

  test("--carry-from a nonexistent directory is skipped without error (no old release is normal)", () => {
    const { root } = makeContentRootWithAssetManifest();
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeNewDistB(dist);

    const out = join(root, "release-nocarry");
    const { code, stderr } = runAssemble([
      "--out", out, "--dist", dist, "--content", root,
      "--carry-from", join(ISOLATION_ROOT, "does-not-exist"),
    ]);
    expect(code, stderr).toBe(0);
    const manifest = JSON.parse(readFileSync(join(out, "manifest.json"), "utf8"));
    expect(manifest.files.map((f: any) => f.path)).not.toContain("media/p_old_abc.avif");
  });
});
// ---------------------------------------------------------------------------
// P9 R8 (review-p9-r7 I1–I4) — regression counter-examples as first-class
// tests. Each one reproduces a real-CLI bypass the independent review
// demonstrated against d0a5db3 and asserts the fail-closed behavior.
// ---------------------------------------------------------------------------
describe("P9 R8 (I1): YAML is parsed, not scanned — legal equivalent spellings cannot bypass the gates", () => {
  /** Replace a top-level scalar/list in an isolated meta.yaml with legal YAML. */
  function rewriteMeta(content: string, gallery: string, edit: (text: string) => string) {
    const metaPath = join(content, "galleries", gallery, "meta.yaml");
    writeFileSync(metaPath, edit(readFileSync(metaPath, "utf8")));
  }

  test("flow-list places spelling still requires the published place page", () => {
    const { root, content } = makeContentRootWithAssetManifest();
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeHappyDist(dist);
    // Legal flow list — js-yaml parses it exactly like the block list.
    rewriteMeta(content, "aegean", (t) =>
      t.replace(/^places:\n(?:[ \t]+-[^\n]+\n)+/m, 'places: ["pl_aegean"]\n'),
    );
    // The candidate omits the place page the (still-required) reference needs.
    rmSync(join(dist, "places", "aegean"), { recursive: true, force: true });
    writeFileSync(join(dist, "sitemap.xml"), happySitemap().replace("  <url><loc>https://example.com/places/aegean</loc></url>\n", ""));

    const out = join(root, "release-bad");
    const { code, stderr } = runAssemble(["--out", out, "--dist", dist, "--content", root]);
    expect(code, stderr).not.toBe(0);
    expect(stderr).toContain("missing canonical page for published place aegean");
    expect(existsSync(join(out, "manifest.json"))).toBe(false);
  });

  test("single-quoted draft status still rejects a candidate carrying the draft page", () => {
    const { root, content } = makeContentRootWithAssetManifest();
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeHappyDist(dist);
    rewriteMeta(content, "iceland", (t) => t.replace(/^status: draft$/m, "status: 'draft'"));
    mkdirSync(join(dist, "galleries", "iceland"), { recursive: true });
    writeFileSync(join(dist, "galleries", "iceland", "index.html"), "<html>DRAFT</html>");

    const out = join(root, "release-bad");
    const { code, stderr } = runAssemble(["--out", out, "--dist", dist, "--content", root]);
    expect(code, stderr).not.toBe(0);
    expect(stderr).toContain("5: draft gallery page in release: iceland");
    expect(existsSync(join(out, "manifest.json"))).toBe(false);
  });

  // Two full assembly runs (bad candidate + positive control) exceed the 5s default.
  test("line-end comments do not change gate outcomes (draft stays draft, published stays published)", { timeout: 60_000 }, () => {
    const { root, content } = makeContentRootWithAssetManifest();
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeHappyDist(dist);
    // Comment-annotated status values — same parsed document, same gates.
    rewriteMeta(content, "iceland", (t) => t.replace(/^status: draft$/m, "status: draft  # editorial hold"));
    rewriteMeta(content, "lofoten-polar-night", (t) => t.replace(/^status: published$/m, "status: published  # live"));
    // The draft page must still be refused even though the regex scanner of
    // d0a5db3 would have read "draft  # editorial hold" as an unknown status.
    mkdirSync(join(dist, "galleries", "iceland"), { recursive: true });
    writeFileSync(join(dist, "galleries", "iceland", "index.html"), "<html>DRAFT</html>");

    const out = join(root, "release-bad");
    const { code, stderr } = runAssemble(["--out", out, "--dist", dist, "--content", root]);
    expect(code, stderr).not.toBe(0);
    expect(stderr).toContain("5: draft gallery page in release: iceland");

    // Positive control: the same comment spelling on a PUBLISHED gallery does
    // not add any gate failure for lofoten-polar-night.
    const out2 = join(root, "release-ok");
    const dist2 = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeHappyDist(dist2);
    rewriteMeta(content, "lofoten-polar-night", (t) => t.replace(/^status: published  # live$/m, "status: published  # live"));
    const { code: code2, stderr: stderr2 } = runAssemble(["--out", out2, "--dist", dist2, "--content", root]);
    expect(code2, stderr2).toBe(0);
  });

  test("unparseable meta.yaml fails the assembly (fail-closed metadata)", () => {
    const { root, content } = makeContentRootWithAssetManifest();
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeHappyDist(dist);
    writeFileSync(join(content, "galleries", "lofoten-polar-night", "meta.yaml"), "status: [unclosed\n  - broken");

    const out = join(root, "release-bad");
    const { code, stderr } = runAssemble(["--out", out, "--dist", dist, "--content", root]);
    expect(code, stderr).not.toBe(0);
    expect(stderr).toContain("gallery metadata unreadable");
    expect(existsSync(join(out, "manifest.json"))).toBe(false);
  });

  test("unknown status value fails the assembly (no silent demotion)", () => {
    const { root, content } = makeContentRootWithAssetManifest();
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeHappyDist(dist);
    rewriteMeta(content, "lofoten-polar-night", (t) => t.replace(/^status: published$/m, "status: pubished"));

    const out = join(root, "release-bad");
    const { code, stderr } = runAssemble(["--out", out, "--dist", dist, "--content", root]);
    expect(code, stderr).not.toBe(0);
    expect(stderr).toContain("unknown status value");
    expect(existsSync(join(out, "manifest.json"))).toBe(false);
  });

  test("published gallery referencing an unknown place id fails the assembly", () => {
    const { root, content } = makeContentRootWithAssetManifest();
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeHappyDist(dist);
    // Replace the LIST ITEM (not the first "aegean" occurrence, which may
    // be inside a comment): js-yaml reads the list, comments are irrelevant.
    rewriteMeta(content, "aegean", (t) => t.replace(/^(  - )pl_aegean$/m, "$1pl_gone"));

    const out = join(root, "release-bad");
    const { code, stderr } = runAssemble(["--out", out, "--dist", dist, "--content", root]);
    expect(code, stderr).not.toBe(0);
    expect(stderr).toContain("references unknown place id");
    expect(existsSync(join(out, "manifest.json"))).toBe(false);
  });
});

describe("P9 R8 (I2): sitemap is parsed as XML against the FULL published canonical set", () => {
  test("broken XML closing tag rejects the release", () => {
    const { root } = makeContentRootWithAssetManifest();
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeHappyDist(dist);
    writeFileSync(join(dist, "sitemap.xml"), happySitemap().replace("</urlset>", "</BROKEN>"));

    const out = join(root, "release-bad");
    const { code, stderr } = runAssemble(["--out", out, "--dist", dist, "--content", root]);
    expect(code).not.toBe(0);
    expect(stderr).toContain("8: sitemap.xml is not valid XML");
    expect(existsSync(join(out, "manifest.json"))).toBe(false);
  });

  test("canonical locs hidden in an XML comment do not count; unknown URLs are rejected", () => {
    const { root } = makeContentRootWithAssetManifest();
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeHappyDist(dist);
    // Every real gallery loc is inside a comment; the only real <url> is the
    // QA probe route (never canonical).
    writeFileSync(
      join(dist, "sitemap.xml"),
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        "<!-- <url><loc>https://example.com/galleries/lofoten-polar-night</loc></url>",
        "     <url><loc>https://example.com/galleries/aegean</loc></url> -->",
        "<url><loc>https://example.com/qa-probe</loc></url>",
        "</urlset>",
        "",
      ].join("\n"),
    );

    const out = join(root, "release-bad");
    const { code, stderr } = runAssemble(["--out", out, "--dist", dist, "--content", root]);
    expect(code).not.toBe(0);
    expect(stderr).toContain("sitemap missing canonical URL /galleries/lofoten-polar-night");
    expect(stderr).toContain("sitemap URL not in published canonical set: /qa-probe");
    expect(existsSync(join(out, "manifest.json"))).toBe(false);
  });

  test("a missing static authority URL (/about) rejects the release", () => {
    const { root } = makeContentRootWithAssetManifest();
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeHappyDist(dist);
    writeFileSync(join(dist, "sitemap.xml"), happySitemap().replace("  <url><loc>https://example.com/about</loc></url>\n", ""));

    const out = join(root, "release-bad");
    const { code, stderr } = runAssemble(["--out", out, "--dist", dist, "--content", root]);
    expect(code).not.toBe(0);
    expect(stderr).toContain("sitemap missing canonical URL /about");
    expect(existsSync(join(out, "manifest.json"))).toBe(false);
  });

  test("a draft loc inside a comment contributes nothing and the draft path stays absent", () => {
    const { root } = makeContentRootWithAssetManifest();
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeHappyDist(dist);
    writeFileSync(
      join(dist, "sitemap.xml"),
      happySitemap().replace(
        "</urlset>",
        "<!-- <url><loc>https://example.com/galleries/iceland</loc></url> --></urlset>",
      ),
    );

    const out = join(root, "release-ok");
    const { code, stderr } = runAssemble(["--out", out, "--dist", dist, "--content", root]);
    expect(code, stderr).toBe(0); // comments are never URLs; the draft never leaks
  });

  test("a non-urlset root element rejects the release", () => {
    const { root } = makeContentRootWithAssetManifest();
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeHappyDist(dist);
    writeFileSync(
      join(dist, "sitemap.xml"),
      happySitemap().replace('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', "<sitemapindex>").replace("</urlset>", "</sitemapindex>"),
    );

    const out = join(root, "release-bad");
    const { code, stderr } = runAssemble(["--out", out, "--dist", dist, "--content", root]);
    expect(code).not.toBe(0);
    expect(stderr).toContain("expected <urlset>");
    expect(existsSync(join(out, "manifest.json"))).toBe(false);
  });
});

describe("P9 R8 (I3): the asset closure covers HTML src/srcset, new and retained", () => {
  test("a candidate HTML referencing a missing asset rejects the release", () => {
    const { root } = makeContentRootWithAssetManifest();
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeHappyDist(dist);
    writeFileSync(join(dist, "index.html"), '<html><img src="/media/missing-hash.jpg" srcset="/media/missing-hash-2.jpg 2x"></html>');

    const out = join(root, "release-bad");
    const { code, stderr } = runAssemble(["--out", out, "--dist", dist, "--content", root]);
    expect(code).not.toBe(0);
    expect(stderr).toContain("HTML references asset missing from release: media/missing-hash.jpg");
    expect(stderr).toContain("media/missing-hash-2.jpg");
    expect(existsSync(join(out, "manifest.json"))).toBe(false);
  });

  test("a retained old page whose asset is servable nowhere rejects the release", () => {
    const { root } = makeContentRootWithAssetManifest();
    const relA = mkdtempSync(join(ISOLATION_ROOT, "release-A-"));
    mkdirSync(join(relA, "media"), { recursive: true });
    writeFileSync(join(relA, "index.html"), '<html><img src="/media/gone-forever.jpg"></html>');
    writeTreeManifest(relA);
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeHappyDist(dist);

    const out = join(root, "release-bad");
    const { code, stderr } = runAssemble(["--out", out, "--dist", dist, "--content", root, "--carry-from", relA]);
    expect(code).not.toBe(0);
    expect(stderr).toContain("retained old-page reference unresolvable: media/gone-forever.jpg");
    expect(existsSync(join(out, "manifest.json"))).toBe(false);
  });

  test("auto-discovery skips releases whose manifest is {} — they never occupy retention slots", () => {
    const { root } = makeContentRootWithAssetManifest();
    const releasesDir = mkdtempSync(join(ISOLATION_ROOT, "carry-auto-"));
    const relValid = join(releasesDir, "001");
    mkdirSync(join(relValid, "media"), { recursive: true });
    writeFileSync(join(relValid, "media", "p_old_abc.avif"), oldAvif.toString("latin1"), "latin1");
    writeFileSync(join(relValid, "index.html"), '<html><img src="/media/p_old_abc.avif"></html>');
    writeTreeManifest(relValid);
    for (const n of ["002", "003"]) {
      mkdirSync(join(releasesDir, n));
      writeFileSync(join(releasesDir, n, "manifest.json"), "{}");
    }
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeNewDistBFor(dist);

    const out = join(root, "release-ok");
    const { code, stdout, stderr } = runAssemble(["--out", out, "--dist", dist, "--content", root, "--releases", releasesDir]);
    expect(code, stderr || stdout).toBe(0);
    // The {} dirs did NOT displace the valid release: its asset is carried.
    expect(existsSync(join(out, "media", "p_old_abc.avif"))).toBe(true);
    expect(stdout).toContain("carried forward media/p_old_abc.avif");
  });

  /** New candidate that no longer references the old asset. */
  function makeNewDistBFor(dist: string) {
    makeHappyDist(dist);
    writeFileSync(join(dist, "index.html"), '<html><head></head><body><img src="/media/clean.jpg" alt="new"></body></html>');
  }
});

describe("P9 R8 (I4): carry-forward paths are boundary-checked before any write", () => {
  test("parent traversal in an old page's ref writes nothing outside either tree", () => {
    const { root } = makeContentRootWithAssetManifest();
    const outsideMarker = join(root, "outside.txt");
    writeFileSync(outsideMarker, "synthetic source outside the old release");
    const relA = mkdtempSync(join(ISOLATION_ROOT, "release-A-"));
    writeFileSync(join(relA, "index.html"), '<html><img src="../../outside.txt"></html>');
    writeTreeManifest(relA);
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeHappyDist(dist);
    const publishRoot = join(root, "publish");
    const out = join(publishRoot, "release");

    const { code, stdout, stderr } = runAssemble(["--out", out, "--dist", dist, "--content", root, "--releases", dirname(relA)]);
    expect(code).not.toBe(0); // the unresolvable ref must fail the closure gate
    // The refusal is logged on stdout (carry log); the gate failure on stderr.
    expect(stdout).toContain("refused out-of-bounds carry source");
    expect(stderr).toContain("retained old-page reference unresolvable");
    // NOTHING was written outside the old release or the (rejected) candidate.
    expect(existsSync(join(publishRoot, "outside.txt"))).toBe(false);
    expect(readFileSync(outsideMarker, "utf8")).toBe("synthetic source outside the old release");
    expect(existsSync(out)).toBe(false);
  });

  test("a symlink escaping the old release is refused as a carry source", () => {
    const { root } = makeContentRootWithAssetManifest();
    const secretDir = join(root, "secret");
    mkdirSync(secretDir, { recursive: true });
    writeFileSync(join(secretDir, "leak.jpg"), Buffer.from("synthetic outside bytes"));
    const relA = mkdtempSync(join(ISOLATION_ROOT, "release-A-"));
    mkdirSync(join(relA, "media"), { recursive: true });
    symlinkSync(join(secretDir, "leak.jpg"), join(relA, "media", "p_old_abc.avif"));
    writeFileSync(join(relA, "index.html"), '<html><img src="/media/p_old_abc.avif"></html>');
    writeTreeManifest(relA); // lstat would refuse the symlink if it were listed; it is unlisted-but-real
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeHappyDist(dist);

    const out = join(root, "release-bad");
    const { code, stdout } = runAssemble(["--out", out, "--dist", dist, "--content", root, "--carry-from", relA]);
    expect(code).not.toBe(0);
    // A symlink source is refused before any copy: lstat classifies it
    // non-regular, and the realpath check would independently refuse an
    // in-tree link that resolves outside the source release.
    expect(stdout).toMatch(/refused (non-regular|symlink-escaping) carry source/);
    // The leaked bytes never landed in a release tree.
    expect(existsSync(join(out, "media", "p_old_abc.avif"))).toBe(false);
  });

  // R9/M5 — the review's counter-example: the DESTINATION parent is a
  // symlink out of the staged tree (linked/newdir/asset.jpg where `linked`
  // in the staged dist points outside). The carry must be refused BEFORE any
  // mkdir/copy: no external file AND no external directory left behind.
  test("a destination parent that is a symlink out of the staged tree is refused before any mkdir", () => {
    const { root } = makeContentRootWithAssetManifest();
    const outsideDir = mkdtempSync(join(ISOLATION_ROOT, "outside-"));
    const relA = mkdtempSync(join(ISOLATION_ROOT, "release-A-"));
    // Old release: REAL nested dir with the asset (a legitimate source).
    mkdirSync(join(relA, "linked", "newdir"), { recursive: true });
    writeFileSync(join(relA, "linked", "newdir", "asset.jpg"), "synthetic asset bytes");
    writeFileSync(join(relA, "index.html"), '<html><img src="/linked/newdir/asset.jpg"></html>');
    writeTreeManifest(relA);
    // The staged dist carries `linked` as a symlink OUT of the tree — the
    // destination-side trap.
    const dist = mkdtempSync(join(ISOLATION_ROOT, "dist-"));
    makeHappyDist(dist);
    symlinkSync(outsideDir, join(dist, "linked"), "dir");

    const out = join(root, "release-bad");
    const { code, stdout } = runAssemble(["--out", out, "--dist", dist, "--content", root, "--carry-from", relA]);
    expect(code).not.toBe(0); // the unresolvable retained ref fails the closure gate
    expect(stdout).toMatch(/refused carry destination (parent symlink|escaping the staged tree)/);
    // R9/M5 core assertion: refusing must not leave an external directory.
    expect(existsSync(join(outsideDir, "newdir"))).toBe(false);
    expect(existsSync(join(outsideDir, "newdir", "asset.jpg"))).toBe(false);
    expect(existsSync(out)).toBe(false);
  });
});
