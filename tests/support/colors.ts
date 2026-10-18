// Immersive direction (2026-10-18): the page field is OKLCH, and Chromium
// serializes a computed color as `oklch(...)` on first paint but as
// `oklab(...)` after a live theme switch — two spellings of the same color.
// Serialized-string equality is therefore an unstable contract, so field /
// ink comparisons run on the CONVERTED sRGB bytes instead.
//
// The conversion happens in the page (a 1x1 canvas is the browser's own,
// honest oklch→sRGB path); this module only carries values across the
// boundary. Alpha is composited over the requested matte (default white) so a
// translucent ink still converts to the byte triple it paints as.
import type { Page } from "@playwright/test";

/** The color → sRGB byte triples, converted inside the page. */
export async function toSrgb(page: Page, colors: string[]): Promise<string[]> {
  return page.evaluate((list) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const convert = (color: string): string => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return `rgb(${d[0]}, ${d[1]}, ${d[2]})`;
    };
    return list.map(convert);
  }, colors);
}

/** The page's own field pair, as sRGB byte triples. */
export async function fieldSrgb(page: Page): Promise<{ light: string; dark: string }> {
  const raw = await page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return {
      light: s.getPropertyValue("--ground-light").trim(),
      dark: s.getPropertyValue("--ground-dark").trim(),
    };
  });
  const [light, dark] = await toSrgb(page, [raw.light, raw.dark]);
  return { light: light!, dark: dark! };
}

/** The painted body background, as an sRGB byte triple. */
export async function bodyBackground(page: Page): Promise<string> {
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const [rgb] = await toSrgb(page, [bg]);
  return rgb!;
}

/** WCAG relative luminance of an `rgb(r, g, b)` byte triple. */
export function luminance(rgb: string): number {
  const parts = /rgb\((\d+),?\s*(\d+),?\s*(\d+)\)/
    .exec(rgb)!
    .slice(1)
    .map((p) => Number(p) / 255);
  const f = (c: number): number =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * f(parts[0]!) + 0.7152 * f(parts[1]!) + 0.0722 * f(parts[2]!);
}

/** WCAG contrast ratio between two `rgb(r, g, b)` byte triples. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
