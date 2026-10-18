// WP-52 / P9 Task 2.2 — redirects.mjs consumes the WP-12 authoritative
// validator (裁定② thin adapter) and is fail-closed: any error → exit != 0
// with no output written; a legal empty set → valid empty include (exit 0).
//
// Every test drives the REAL CLI as a subprocess with the SAME bootstrap the
// CLI requires to load TS: --experimental-strip-types + ts-resolve hook, and
// explicit env NODE_OPTIONS: "" (never rely on an inherited terminal setting).
//
// Isolation: each test builds a UNIQUE scratch content root with mkdtempSync
// (O_EXCL semantics) under tests/tmp/isolated/redirects/, copies whatever
// corpus YAML the scenario needs, and points the CLI at it via --content.
// The real content/ is never read or written.
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";

const REPO_ROOT = resolve(join(__dirname, "..", ".."));
const REDIRECTS_SCRIPT = join(REPO_ROOT, "scripts", "release", "redirects.mjs");
const REGISTER_SCRIPT = resolve(join(REPO_ROOT, "scripts", "validate", "register-ts-resolve.mjs"));
const ISOLATION_ROOT = join(REPO_ROOT, "tests", "tmp", "isolated", "redirects");
const CONTENT = join(REPO_ROOT, "content");

/** CLI bootstrap: same flags the CLI itself needs to import the TS validator. */
const CLI_FLAGS = ["--experimental-strip-types", "--import", REGISTER_SCRIPT, REDIRECTS_SCRIPT];

function runCli(args: string[]) {
  try {
    execFileSync("node", [...CLI_FLAGS, ...args], {
      stdio: "pipe",
      encoding: "utf8",
      env: { ...process.env, NODE_OPTIONS: "" },
    });
    return { code: 0, stdout: "", stderr: "" };
  } catch (e: any) {
    return { code: e.status ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

/**
 * A fresh unique ISOLATED REPO ROOT matching the WP-03 layout: content/ lives
 * under it, exactly like the real repo — content/redirects.yaml,
 * content/galleries/, content/places/. The CLI --content <root> receives this
 * outer root (same as --content-root in scripts/validate/content.ts).
 */
/**
 * mkdtempSync(parent, prefix) fails ENOENT when `parent` does not exist. The
 * isolation root is gitignored and may not pre-exist (clean archive copy,
 * fresh clone). Create it on demand — never depend on a pre-made
 * tests/tmp/isolated/redirects/ dir or manual mkdir.
 */
function freshScratch(prefix: string) {
  mkdirSync(ISOLATION_ROOT, { recursive: true });
  return mkdtempSync(join(ISOLATION_ROOT, prefix));
}

function makeContentRoot() {
  const root = freshScratch("content-");
  const content = join(root, "content");
  mkdirSync(content, { recursive: true });
  writeFileSync(join(content, "redirects.yaml"), "# test fixture\n");
  return { root, content };
}

/** Copy a category dir (galleries/<name> or places/<file>) into isolation. */
function copyCorpus(subdir: string, name: string, destContent: string) {
  const full = join(CONTENT, subdir, name);
  const target = join(destContent, subdir, name);
  cpSync(full, target, { recursive: true });
}

describe("P9 Task 2.2: redirects.mjs authoritative validation (WP-12 thin adapter)", () => {
  test("valid real-corpus redirects -> exit 0, rules match canonical destinations", () => {
    const { root, content } = makeContentRoot();
    // The real content/redirects.yaml is the legal EMPTY set post-go-live, so
    // this CLI test authors aliases over galleries that exist in the archive.
    writeFileSync(
      join(content, "redirects.yaml"),
      [
        "/galleries/old-polar-night:",
        "  gallery_id: g_lofoten_polar_night",
        "/places/old-lofoten:",
        "  place_id: pl_lofoten",
        "",
      ].join("\n"),
    );
    // Published galleries referenced by the real aliases.
    copyCorpus("galleries", "lofoten-polar-night", content);
    copyCorpus("places", "lofoten.yaml", content);
    

    const outFile = join(root, "out.conf");
    const { code } = runCli(["--out", outFile, "--content", root]);
    expect(code).toBe(0);

    const conf = readFileSync(outFile, "utf8");
    for (const line of conf.split("\n")) {
      if (!line.startsWith("rewrite ")) continue;
      // Destination is the WP-12-resolved canonical path, not a locally
      // re-built slug.
      expect(line).toMatch(/^rewrite \^\/[^ ]+\$ \/(galleries|places)\/[^ ]+ permanent;$/);
    }
    expect(conf).toContain("rewrite ^/galleries/old-polar-night$ /galleries/lofoten-polar-night permanent;");
    expect(conf).toContain("rewrite ^/places/old-lofoten$ /places/lofoten permanent;");
    
  });

  test("invalid YAML -> fail-closed, no output written", () => {
    const { root, content } = makeContentRoot();
    writeFileSync(join(content, "redirects.yaml"), "::: not: [valid");

    // --out points at an existing file that must NOT be overwritten.
    const outFile = join(root, "out.conf");
    writeFileSync(outFile, "# KEEP ME");

    const { code } = runCli(["--out", outFile, "--content", root]);
    expect(code).not.toBe(0);
    expect(readFileSync(outFile, "utf8")).toBe("# KEEP ME");
  });

  test("missing redirects.yaml -> fail-closed, no output written", () => {
    const { root } = makeContentRoot();
    const outFile = join(root, "out.conf");
    writeFileSync(outFile, "# KEEP ME");

    // Force no redirects.yaml under content/: use a fresh empty repo root.
    const emptyRoot = mkdtempSync(join(ISOLATION_ROOT, "missing-"));
    const { code } = runCli(["--out", outFile, "--content", emptyRoot]);
    expect(code).not.toBe(0);
    expect(readFileSync(outFile, "utf8")).toBe("# KEEP ME");
  });

  test("target pointing to draft gallery -> fail-closed (production 13.1#16), no output", () => {
    const { root, content } = makeContentRoot();
    // FYI: content/galleries/long-gallery-72 has status: draft in the corpus.
    // The real archive has no drafts, so the isolation root carries a minimal
    // draft gallery; the alias targets it (production 13.1#16).
    mkdirSync(join(content, "galleries", "iso-draft"), { recursive: true });
    writeFileSync(
      join(content, "galleries", "iso-draft", "meta.yaml"),
      [
        "id: g_iso_draft",
        "slug: iso-draft",
        "status: draft",
        'title: "Isolation draft"',
        'photographed_start: "2025-01-01"',
        'photographed_end: "2025-01-02"',
        "places:",
        "  - pl_lofoten",
        "photos:",
        "  - id: p_iso_draft_001",
        "    source_ref: lofoten-polar-night/DSC02252.jpg",
        "    caption: null",
        "    rhythm_after: base",
        "    alt_text: null",
        "",
      ].join("\n"),
    );
    copyCorpus("places", "lofoten.yaml", content);
    writeFileSync(
      join(content, "redirects.yaml"),
      "/galleries/historical-slug:\n  gallery_id: g_iso_draft\n",
    );

    const outFile = join(root, "out.conf");
    const { code, stderr } = runCli(["--out", outFile, "--content", root]);
    expect(code).not.toBe(0);
    expect(existsSync(outFile)).toBe(false);
    expect(stderr).toContain("13.1#16");
  });

  test("XOR violation (both gallery_id and place_id) -> fail-closed, no output", () => {
    const { root, content } = makeContentRoot();
    writeFileSync(
      join(content, "redirects.yaml"),
      "/galleries/both:\n  gallery_id: g_lofoten_polar_night\n  place_id: pl_lofoten\n",
    );
    copyCorpus("galleries", "lofoten-polar-night", content);
    

    const outFile = join(root, "out.conf");
    const { code, stderr } = runCli(["--out", outFile, "--content", root]);
    expect(code).not.toBe(0);
    expect(existsSync(outFile)).toBe(false);
    expect(stderr).toContain("13.1#15");
  });

  test("unknown entry field -> fail-closed, no output", () => {
    const { root, content } = makeContentRoot();
    writeFileSync(
      join(content, "redirects.yaml"),
      "/galleries/badkey:\n  gallery_id: g_lofoten_polar_night\n  typo_key: x\n",
    );
    copyCorpus("galleries", "lofoten-polar-night", content);

    const outFile = join(root, "out.conf");
    const { code, stderr } = runCli(["--out", outFile, "--content", root]);
    expect(code).not.toBe(0);
    expect(existsSync(outFile)).toBe(false);
    // The zod unrecognized_keys becomes WP-12's human "unknown field(s)" error.
    expect(stderr).toContain("unknown field(s)");
  });

  test("empty redirects (legal empty set via {} mapping) -> exit 0, comment-only include", () => {
    const { root, content } = makeContentRoot();
    // WP-12's readRedirects treats the empty document and null as parse / shape
    // errors (js-yaml 5.x throws on empty input; null is not the mapping shape).
    // The legal empty set is an empty YAML mapping: {}.
    writeFileSync(join(content, "redirects.yaml"), "{}\n");
    const outFile = join(root, "out.conf");

    const { code } = runCli(["--out", outFile, "--content", root]);
    expect(code).toBe(0);
    const conf = readFileSync(outFile, "utf8");
    expect(conf).toContain("# WP-52");
    expect(conf).not.toMatch(/^rewrite /m);
  });

  test("default --content is the repo root", () => {
    // No --content flag: CLI reads ROOT/content (the real corpus).
    const outFile = join(mkdtempSync(join(ISOLATION_ROOT, "default-")), "out.conf");
    const { code } = runCli(["--out", outFile]);
    expect(code).toBe(0);
    const conf = readFileSync(outFile, "utf8");
    expect(conf).toContain("# WP-52");
    // content/redirects.yaml is the legal empty set post-go-live: header only.
    expect(conf).not.toMatch(/^rewrite /m);
  });
});
