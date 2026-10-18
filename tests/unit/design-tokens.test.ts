// Token guard for the immersive direction
// (docs/plans/2026-10-18-immersive-direction-production-port.md):
//   1. src/styles/tokens.css carries the ambient-field system for BOTH themes
//      (neutral fallbacks for field and deep field), the fixed ink ladder,
//      the photograph edge treatment, and the motion scale.
//   2. Display type roles resolve to the serif stack and interface roles to
//      sans (unchanged role contract).
//   3. No hex color literal may appear anywhere in src/ outside tokens.css.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC_DIR = join(import.meta.dirname, "..", "..", "src");
const TOKENS_CSS = join(SRC_DIR, "styles", "tokens.css");

/** Field fallbacks: what a page with no subject (index-like surfaces) shows.
 *  Pages WITH a subject inject the cover-derived ambient pair as
 *  --ground-light/--ground-dark, so these literals are the neutral room. */
const FIELD_FALLBACKS: readonly string[] = [
  "--ground: var(--ground-light, oklch(0.945 0.012 255))",
  "--ground-deep: var(--deep-light, oklch(0.9 0.026 255))",
  "--ground-dark, oklch(0.13 0.012 265)",
  "--deep-dark, oklch(0.108 0.016 265)",
];

/** The fixed ink ladder per theme (Day / Night). */
const INK_LADDER: ReadonlyArray<readonly [string, string]> = [
  ["--ink: oklch(0.24 0.015 265)", "--ink: oklch(0.93 0.008 90)"],
  ["--muted: oklch(0.4 0.015 265)", "--muted: oklch(0.72 0.01 90)"],
  ["--ink-tertiary: oklch(0.55 0.012 265)", "--ink-tertiary: oklch(0.6 0.01 90)"],
  ["--hairline: oklch(0.24 0.015 265 / 0.2)", "--hairline: oklch(0.93 0.008 90 / 0.16)"],
  ["--color-surface-raised: oklch(0.92 0.012 255)", "--color-surface-raised: oklch(0.17 0.014 265)"],
  ["--color-surface-sunken: oklch(0.88 0.012 255)", "--color-surface-sunken: oklch(0.1 0.014 265)"],
  ["--color-strong: oklch(0.18 0.015 265)", "--color-strong: oklch(0.99 0.005 90)"],
  ["--color-focus: oklch(0.3 0.03 265)", "--color-focus: oklch(0.95 0.015 90)"],
  ["--color-accent-subtle: oklch(0.45 0.09 265)", "--color-accent-subtle: oklch(0.78 0.07 265)"],
];

/** The photograph edge treatment: a 1px rim plus a wide, soft shadow —
 *  the single sanctioned way a photograph meets the field. */
const PHOTO_TREATMENT: readonly string[] = [
  "--photo-edge: 0 0 0 1px oklch(0.24 0.015 265 / 0.07)",
  "0 8px 20px -10px oklch(0.24 0.015 265 / 0.3)",
  "0 16px 44px -20px oklch(0.24 0.015 265 / 0.34)",
  "0 24px 60px -22px oklch(0.24 0.015 265 / 0.42)",
  "--photo-edge: 0 0 0 1px oklch(0.93 0.008 90 / 0.06)",
  "0 10px 24px -10px oklch(0 0 0 / 0.6)",
  "0 20px 54px -20px oklch(0 0 0 / 0.7)",
  "0 28px 70px -22px oklch(0 0 0 / 0.8)",
];

const SCANNED_EXTENSIONS = new Set([".astro", ".css", ".html", ".js", ".mjs", ".ts"]);
const HEX_LITERAL = /#[0-9a-fA-F]{3,8}\b/g;

function listFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...listFiles(full));
    } else if (SCANNED_EXTENSIONS.has(extname(full))) {
      files.push(full);
    }
  }
  return files;
}

function extname(file: string): string {
  return file.slice(file.lastIndexOf("."));
}

describe("design tokens (immersive direction)", () => {
  it("tokens.css exists and carries the field fallbacks verbatim", () => {
    expect(existsSync(TOKENS_CSS), "src/styles/tokens.css must exist").toBe(true);
    const css = readFileSync(TOKENS_CSS, "utf8");
    for (const token of FIELD_FALLBACKS) {
      expect(css, `${token} missing from tokens.css`).toContain(token);
    }
  });

  it("carries the ink ladder for both themes verbatim", () => {
    const css = readFileSync(TOKENS_CSS, "utf8");
    for (const [day, night] of INK_LADDER) {
      expect(css, `${day} missing from tokens.css`).toContain(day);
      expect(css, `${night} missing from tokens.css`).toContain(night);
    }
  });

  it("carries the photograph edge treatment for both themes", () => {
    const css = readFileSync(TOKENS_CSS, "utf8");
    for (const fragment of PHOTO_TREATMENT) {
      expect(css, `${fragment} missing from tokens.css`).toContain(fragment);
    }
  });

  it("declares a dark theme via [data-theme=dark] and a no-JS system fallback", () => {
    const css = readFileSync(TOKENS_CSS, "utf8");
    expect(css).toContain('[data-theme="dark"]');
    expect(css).toContain("prefers-color-scheme: dark");
    expect(css).toContain(':root:not([data-theme="light"]):not([data-theme="dark"])');
  });

  it("no hardcoded hex color literal outside src/styles/tokens.css", () => {
    const offenders = [];
    for (const file of listFiles(SRC_DIR)) {
      if (file === TOKENS_CSS) continue;
      const matches = readFileSync(file, "utf8").match(HEX_LITERAL);
      if (!matches) continue;
      // The one sanctioned exception: a <meta name="theme-color"> cannot
      // consume a CSS variable, so Base.astro states the neutral field hex
      // directly (ambient pages replace them with computed values at build).
      if (file.endsWith("layouts/Base.astro") && matches.length === 2) continue;
      offenders.push(`${file}: ${matches.join(" ")}`);
    }
    expect(offenders, "hex literals are allowed only in tokens.css (theme-color excepted)").toEqual([]);
  });

  it("display roles resolve to serif, interface roles to sans/mono", () => {
    const css = readFileSync(TOKENS_CSS, "utf8");
    for (const role of ["display", "h1", "h2", "card-title"]) {
      expect(css, `--type-${role}-family must use the serif stack`).toContain(
        `--type-${role}-family: var(--font-serif);`,
      );
    }
    for (const role of ["body", "caption", "meta", "nav"]) {
      expect(css, `--type-${role}-family must use the sans stack`).toContain(
        `--type-${role}-family: var(--font-sans);`,
      );
    }
    // Numerals/indices/EXIF use the mono stack.
    expect(css).toContain("--type-utility-family: var(--font-mono-numbers);");
  });

  it("binds the collection reader to the room and keeps the motion scale", () => {
    const css = readFileSync(TOKENS_CSS, "utf8");
    // The reader is the same room, not another one.
    expect(css).toContain("--color-lightbox-bg: var(--ground-deep)");
    expect(css).toContain("--color-lightbox-text: var(--ink)");
    expect(css).toContain("--color-lightbox-muted: var(--muted)");
    for (const token of ["--dur-micro: 120ms", "--dur-medium: 240ms", "--dur-major: 400ms"]) {
      expect(css).toContain(token);
    }
    expect(css).toContain("--ease-out-editorial: cubic-bezier(0.16, 1, 0.3, 1)");
  });
});
