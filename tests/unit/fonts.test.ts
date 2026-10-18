// WP-05 font-loading guard (unit, no site build needed):
//   1. src/styles/fonts.css exists and declares exactly the PoC weight set
//      derived from the §2.2 role table (serif 400/500 for Display/H1/Card
//      title; sans 400/500/600 for Body/Caption + H2/Meta/Nav/Utility; CJK PoC
//      minimum 400 for both SC families — weight gaps documented as PoC
//      limitation in docs/implementation/WP-05.md).
//   2. Every @font-face uses `font-display: optional` (PERFORMANCE_BUDGET
//      §7.2, frozen G1) and an honest `unicode-range` (§7.5: never claim a
//      range broader than the served subset).
//   3. Every url() target in fonts.css exists under public/ (no dangling face).
//   4. No font preload anywhere in src/ (§7.5: preload only proven above-fold
//      fonts — the PoC preloads none).
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC_DIR = join(import.meta.dirname, "..", "..", "src");
const PUBLIC_DIR = join(import.meta.dirname, "..", "..", "public");
const FONTS_CSS = join(SRC_DIR, "styles", "fonts.css");

/** The four frozen families (§2.2 / G1). No third family may appear. */
const FROZEN_FAMILIES = ["Source Serif 4", "Source Sans 3", "Noto Serif SC", "Noto Sans SC"];

/** PoC weight policy: §2.2 role-table endpoints; CJK 400 minimum (PoC). */
const EXPECTED_FACES: ReadonlyArray<readonly [string, number]> = [
  ["Source Serif 4", 400],
  ["Source Serif 4", 500],
  ["Source Sans 3", 400],
  ["Source Sans 3", 500],
  ["Source Sans 3", 600],
  ["Noto Serif SC", 400],
  ["Noto Sans SC", 400],
];

interface Face {
  family: string;
  weight: string;
  display: string | null;
  hasUnicodeRange: boolean;
  urls: string[];
}

function parseFaces(css: string): Face[] {
  const faces: Face[] = [];
  const blocks = css.split(/@font-face\s*\{/).slice(1);
  for (const block of blocks) {
    const body = block.slice(0, block.indexOf("}"));
    const decl = (prop: string): string | null => {
      const m = body.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, "m"));
      return m ? m[1].trim() : null;
    };
    const familyMatch = decl("font-family")?.match(/"([^"]+)"/);
    faces.push({
      family: familyMatch ? familyMatch[1] : (decl("font-family") ?? "").replace(/['"]/g, ""),
      weight: decl("font-weight") ?? "",
      display: decl("font-display"),
      hasUnicodeRange: decl("unicode-range") !== null,
      urls: [...body.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1].replace(/['"]/g, "")),
    });
  }
  return faces;
}

describe("WP-05 font loading plumbing", () => {
  it("fonts.css exists and declares exactly the PoC weight set of the four frozen families", () => {
    expect(existsSync(FONTS_CSS), "src/styles/fonts.css must exist").toBe(true);
    const css = readFileSync(FONTS_CSS, "utf8");
    const faces = parseFaces(css);
    expect(faces.length, "one @font-face per (family, weight)").toBe(EXPECTED_FACES.length);
    const declared = faces.map((f) => [f.family, Number(f.weight)] as const);
    for (const expected of EXPECTED_FACES) {
      expect(
        declared.some(([f, w]) => f === expected[0] && w === expected[1]),
        `missing @font-face for ${expected[0]} ${expected[1]}`,
      ).toBe(true);
    }
    for (const face of faces) {
      expect(
        FROZEN_FAMILIES.includes(face.family),
        `non-frozen family declared: ${face.family}`,
      ).toBe(true);
    }
  });

  it("every @font-face uses font-display: optional and an honest unicode-range (§7.2/§7.5)", () => {
    expect(existsSync(FONTS_CSS), "src/styles/fonts.css must exist").toBe(true);
    const faces = parseFaces(readFileSync(FONTS_CSS, "utf8"));
    expect(faces.length, "at least one @font-face").toBeGreaterThan(0);
    for (const face of faces) {
      expect(face.display, `font-display for ${face.family} ${face.weight}`).toBe("optional");
      expect(face.hasUnicodeRange, `unicode-range for ${face.family} ${face.weight}`).toBe(true);
    }
  });

  it("every @font-face url() target exists under public/ (no dangling face)", () => {
    expect(existsSync(FONTS_CSS), "src/styles/fonts.css must exist").toBe(true);
    const faces = parseFaces(readFileSync(FONTS_CSS, "utf8"));
    expect(faces.length, "at least one @font-face").toBeGreaterThan(0);
    const missing: string[] = [];
    for (const face of faces) {
      for (const url of face.urls) {
        // URLs are site-absolute (/fonts/...), served from public/.
        const target = join(PUBLIC_DIR, url.replace(/^\//, "").split("?")[0]);
        if (!existsSync(target)) missing.push(url);
      }
    }
    expect(missing, "font files referenced by fonts.css must exist in public/").toEqual([]);
  });

  it("no font preload in src/ — PoC preloads none blindly (§7.5)", () => {
    const offenders: string[] = [];
    const scan = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          scan(full);
        } else if (/\.(astro|html|css|js|mjs|ts)$/.test(entry)) {
          const text = readFileSync(full, "utf8");
          if (
            /rel\s*=\s*["']preload["'][^>]*as\s*=\s*["']font["']|as\s*=\s*["']font["'][^>]*rel\s*=\s*["']preload["']/.test(
              text,
            )
          ) {
            offenders.push(full);
          }
        }
      }
    };
    scan(SRC_DIR);
    expect(offenders, "no <link rel=preload as=font> in the PoC").toEqual([]);
  });
});
