/*
 * src/lib/theme/oklch.ts — OKLCH ↔ sRGB helpers for the immersive direction.
 *
 * The page field is authored as OKLCH (the ambient pair derived from a
 * cover), but browser chrome (theme-color) and a few legacy consumers need
 * sRGB. The maths mirrors the design-lab prototype's conversion verbatim
 * (experiments/design-lab/variants/audit-c-immersive.html, `toHex`), which in
 * turn follows Björn Ottosson's OKLab definition.
 *
 * No hex literals live here: the rule in tests/unit/design-tokens.test.ts
 * allows hex only in tokens.css plus the two theme-color fallbacks in
 * Base.astro. Values produced by these functions are runtime strings.
 */

import type { Oklch } from "./atmosphere-contract";

export type { Oklch };

/** The deep field a page uses for insets and the reader: same hue, lower
 *  lightness, slightly calmer chroma (prototype: light.l-0.045 / c*0.9;
 *  dark.l*0.62 / c*0.9 with a chroma floor so the darkroom keeps some life). */
export function deriveDeep(entry: Oklch, theme: "light" | "dark"): Oklch {
  if (theme === "light") {
    return {
      l: round3(entry.l - 0.045),
      c: round3(entry.c * 0.9),
      h: entry.h,
    };
  }
  return {
    l: round3(entry.l * 0.62),
    c: round3(Math.max(entry.c * 0.9, 0.01)),
    h: entry.h,
  };
}

/** CSS declaration string for the four field variables a page injects. */
export function groundDeclarations(
  light: Oklch,
  dark: Oklch,
  deepLight: Oklch = deriveDeep(light, "light"),
  deepDark: Oklch = deriveDeep(dark, "dark"),
): string {
  return [
    `--ground-light: ${cssOklch(light)}`,
    `--ground-dark: ${cssOklch(dark)}`,
    `--deep-light: ${cssOklch(deepLight)}`,
    `--deep-dark: ${cssOklch(deepDark)}`,
  ].join("; ");
}

export function cssOklch({ l, c, h }: Oklch): string {
  return `oklch(${round3(l)} ${round3(c)} ${h})`;
}

/** OKLCH → sRGB hex, for `<meta name="theme-color">`. */
export function toHex({ l, c, h }: Oklch): string {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);
  const lms = [
    (l + 0.3963377774 * a + 0.2158037573 * b) ** 3,
    (l - 0.1055613458 * a - 0.0638541728 * b) ** 3,
    (l - 0.0894841775 * a - 1.291485548 * b) ** 3,
  ] as const;
  const [lr, lg, lb] = lms;
  const linear = [
    4.0767416621 * lr - 3.3077115913 * lg + 0.2309699292 * lb,
    -1.2684380046 * lr + 2.6097574011 * lg - 0.3413193965 * lb,
    -0.0041960863 * lr - 0.7034186147 * lg + 1.707614701 * lb,
  ];
  return `#${linear
    .map((value) => {
      const encoded = clamp01(value) ** (1 / 2.4) * 1.055 - 0.055;
      return Math.round(clamp01(encoded) * 255)
        .toString(16)
        .padStart(2, "0");
    })
    .join("")}`;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const round3 = (value: number): number => Math.round(value * 1000) / 1000;
