// P8 — CJK served-coverage check (WP-46 authority).
//
// Every CJK codepoint used in production content must be COVERED by the
// served font ranges in src/styles/fonts.css — the authority the build-time
// WP-46 gate enforces. Uncovered codepoints may render via platform fallback
// only when reviewed in scripts/fonts/fallback-accepted.txt (PERF §7.5).
//
// History: the pre-go-live suite read a gitignored PoC artifact
// (generated/fonts/option-b/unicodes.txt from the non-wired subset-poc.mjs).
// After the 2026-09-12 content swap that artifact was absent on the build
// host, so the suite failed for an environment reason. The authority is now
// the TRACKED pair (fonts.css + reviewed allowlist).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadAll } from "js-yaml";
import { describe, expect, test } from "vitest";
import { checkCoverage, parseCssFaces } from "../../scripts/fonts/coverage.mjs";

const REPO = resolve(join(__dirname, "..", ".."));
const CONTENT = join(REPO, "content");
const CSS = join(REPO, "src/styles/fonts.css");
const ALLOW = join(REPO, "scripts/fonts/fallback-accepted.txt");

function contentYamlFiles(): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(CONTENT, { withFileTypes: true })) {
    const full = join(CONTENT, entry.name);
    if (entry.isDirectory()) {
      for (const inner of readdirSync(full, { withFileTypes: true })) {
        if (inner.isFile() && inner.name.endsWith(".yaml")) found.push(join(full, inner.name));
      }
    } else if (entry.name.endsWith(".yaml")) {
      found.push(full);
    }
  }
  return found;
}

function parseAllowlist(text: string): Set<number> {
  const set = new Set<number>();
  for (const raw of text.split("\n")) {
    let token = raw;
    const hash = token.indexOf("#");
    if (hash >= 0) token = token.slice(0, hash);
    token = token.trim().toUpperCase();
    if (token.startsWith("U+")) token = token.slice(2);
    const cp = parseInt(token, 16);
    if (Number.isInteger(cp)) set.add(cp);
  }
  return set;
}

describe("CJK served coverage (WP-46 fonts.css authority)", () => {
  test("served range set is non-empty and covers the CJK punctuation block", () => {
    const faces = parseCssFaces(readFileSync(CSS, "utf8"));
    const served = new Set<number>();
    for (const face of faces) for (const cp of face.ranges) served.add(cp);
    expect(served.size).toBeGreaterThan(0);
    expect(served.has(0x3002)).toBe(true);
    expect(served.has(0xff01)).toBe(true);
  });

  test("every CJK codepoint in content/ is served or a reviewed acceptance", () => {
    const docs = contentYamlFiles().map((f) => loadAll(readFileSync(f, "utf8")));
    const result = checkCoverage({
      docs,
      cssText: readFileSync(CSS, "utf8"),
      allowlist: parseAllowlist(readFileSync(ALLOW, "utf8")),
    });
    expect(result.uncovered.map((u) => u.hex)).toEqual([]);
  });

  test("the option-b CJK faces referenced by fonts.css exist and are non-empty", () => {
    const faces = parseCssFaces(readFileSync(CSS, "utf8")).filter((f) =>
      f.file.includes("option-b"),
    );
    expect(faces).toHaveLength(2);
    for (const face of faces) {
      const file = join(REPO, "public", face.file.slice(1));
      expect(statSync(file).size).toBeGreaterThan(0);
    }
  });
});
