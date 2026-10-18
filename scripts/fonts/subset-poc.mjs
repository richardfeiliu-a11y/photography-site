#!/usr/bin/env node
/*
 * WP-05 Option B — build-derived CJK subset scan (proof of concept).
 *
 * PERFORMANCE_BUDGET.md §7.4 Option B: scan all authored YAML content at
 * build time, extract the exact glyph set used, generate a minimal subset
 * covering those glyphs plus a safety margin (fallback ranges).
 *
 * What it does:
 *   1. Recursively scans every YAML file under content/ and
 *      tests/fixtures/content/.
 *   2. Collects every codepoint appearing in any YAML string value.
 *   3. Adds the documented fallback ranges (§7.4 "safety margin"): Basic
 *      Latin, CJK Symbols and Punctuation, fullwidth forms, and the
 *      typographic punctuation shared with the Latin subsets (dashes, quotes,
 *      ellipsis, middle dot).
 *   4. Runs pyftsubset (fonttools) on the pinned upstream Noto SC Regular
 *      OTFs to produce woff2 subsets under generated/fonts/option-b/.
 *   5. Prints a bytes + coverage table (PoC evidence for WP-05 docs).
 *
 * This PoC is NOT wired into `astro build`; the strategy decision belongs to
 * WP-46 (P7 finalization gate). Toolchain: see docs/implementation/WP-05.md
 * (fonttools/brotli versions pinned; commands verified against --help).
 *
 * Usage:  node scripts/fonts/subset-poc.mjs
 * Env:    FONT_SUBSETTER (default: <repo>/.venv/bin/pyftsubset)
 *         FONT_SRC_DIR  (default: /tmp/fontwork/extract — upstream OTFs)
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_DIR = join(REPO, "generated", "fonts", "option-b");
const SUBSETTER = process.env.FONT_SUBSETTER ?? join(REPO, ".venv", "bin", "pyftsubset");
const SRC_DIR = process.env.FONT_SRC_DIR ?? "/tmp/fontwork/extract";

/** Fallback ranges (the §7.4 safety margin) — same extras as Option A. */
const FALLBACK_RANGES = [
  [0x0020, 0x007e], // Basic Latin
  [0x2013, 0x2014], // en/em dash
  [0x2018, 0x2019], // single quotes
  [0x201c, 0x201d], // double quotes
  [0x2026, 0x2026], // ellipsis
  [0x00b7, 0x00b7], // middle dot
  [0x3000, 0x303f], // CJK Symbols and Punctuation
  [0xff01, 0xff60], // fullwidth forms
];

const UPSTREAM = {
  "noto-serif-sc-400-option-b": join(SRC_DIR, "SubsetOTF/SC/NotoSerifSC-Regular.otf"),
  "noto-sans-sc-400-option-b": join(SRC_DIR, "NotoSansSC-Regular.otf"),
};

function listYaml(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...listYaml(full));
    else if ([".yaml", ".yml"].includes(extname(entry))) files.push(full);
  }
  return files;
}

function collectStrings(node, out) {
  if (typeof node === "string") out.push(node);
  else if (Array.isArray(node)) for (const item of node) collectStrings(item, out);
  else if (node && typeof node === "object")
    for (const v of Object.values(node)) collectStrings(v, out);
}

const contentDirs = [join(REPO, "content"), join(REPO, "tests", "fixtures", "content")];
const yamlFiles = contentDirs.flatMap((dir) => (existsSync(dir) ? listYaml(dir) : []));

/** @type {string[]} */
const strings = [];
for (const file of yamlFiles) {
  const raw = readFileSync(file, "utf8").trim();
  if (raw.length === 0) continue; // tolerate placeholder/empty YAML documents
  try {
    collectStrings(load(raw), strings);
  } catch (err) {
    // A comment-only file parses to "expected a document" in js-yaml — skip
    // it. Real YAML syntax errors still fail loudly (build-derived honesty).
    if (!(
      err instanceof Object &&
      /expected a document/i.test(String(err?.message ?? err?.reason ?? ""))
    ))
      throw err;
  }
}

const codepoints = new Set();
for (const s of strings) for (const ch of s) codepoints.add(ch.codePointAt(0));
for (const [lo, hi] of FALLBACK_RANGES) for (let cp = lo; cp <= hi; cp++) codepoints.add(cp);

const unicodes = [...codepoints].sort((a, b) => a - b);
const unicodeArg = [...codepoints].map((cp) => `${cp.toString(16).toUpperCase()}`).join(",");

console.log(`# WP-05 Option B — build-derived subset scan (PoC)`);
console.log(`# scanned YAML files (${yamlFiles.length}):`);
for (const f of yamlFiles) console.log(`#   ${f.replace(`${REPO}/`, "")}`);
console.log(
  `# authored codepoints: ${unicodes.length - FALLBACK_RANGES.reduce((n, [lo, hi]) => n + (hi - lo + 1), 0)} (+ fallback ranges → ${unicodes.length} total)`,
);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(
  join(OUT_DIR, "unicodes.txt"),
  unicodes.map((cp) => cp.toString(16).toUpperCase().padStart(4, "0")).join("\n") + "\n",
);

const rows = [];
for (const [name, src] of Object.entries(UPSTREAM)) {
  if (!existsSync(src)) {
    console.error(`upstream source missing: ${src} (set FONT_SRC_DIR)`);
    process.exit(1);
  }
  const out = join(OUT_DIR, `${name}.woff2`);
  execFileSync(
    SUBSETTER,
    [
      src,
      `--output-file=${out}`,
      "--flavor=woff2",
      "--no-hinting",
      "--desubroutinize",
      "--ignore-missing-unicodes",
      `--unicodes=${unicodeArg}`,
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  rows.push([name, src.split("/").pop(), statSync(out).size]);
}

console.log(`# output:`);
for (const [name, src, bytes] of rows) {
  console.log(`#   ${name}.woff2  ${bytes.toLocaleString("en-US")} bytes  (from upstream ${src})`);
}

// Coverage note: the emitted subset is verified with
// scripts/fonts/coverage-report.py (actual cmap vs requested unicodes).
console.log(`# unicode list written to ${join(OUT_DIR, "unicodes.txt")}`);
