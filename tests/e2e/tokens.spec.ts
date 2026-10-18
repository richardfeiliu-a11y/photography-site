// Computed-style contract for the FROZEN design tokens in the immersive
// direction (docs/IMMERSIVE_VIEWING_SPEC.md §2/§3/§6; RUNTIME_AND_
// PROGRESSIVE_ENHANCEMENT §8).
//
// Strategy: assertions run against the assembled artifact server; the token
// probe markup lives behind the `wp-04-token-probe` comment marker on the
// robots-noindex /qa-probe route (src/pages/qa-probe.astro).
//
// The field is OKLCH and the serialization of a computed color is not stable
// across paint paths (oklch(...) on first paint, oklab(...) after a variable
// swap — and both after a transition settles), so colors are compared as the
// browser's own oklch→sRGB bytes (tests/support/colors.ts).
import { expect, test } from "@playwright/test";
import { toSrgb } from "../support/colors";
import { MOBILE_VIEWPORT } from "../support/viewports.mjs";

// The neutral room (no subject): the values Base.astro falls back to and the
// /qa-probe route paints. Day / Night halves.
const NEUTRAL_LIGHT = "oklch(0.945 0.012 255)";
const NEUTRAL_DARK = "oklch(0.13 0.012 265)";

/** Monograph spacing scale (spec §7.3): token suffix → exact px. */
const SPACE_SCALE: ReadonlyArray<readonly [string, number]> = [
  ["2xs", 4],
  ["xs", 8],
  ["md", 16],
  ["lg", 24],
  ["2xl", 48],
  ["4xl", 96],
];

test.describe("WP-04 frozen design tokens", () => {
  test("body surface is the page's field (neutral room on a subject-less page)", async ({
    page,
  }) => {
    await page.goto("/qa-probe");
    const painted = await page.evaluate(() => ({
      body: getComputedStyle(document.body).backgroundColor,
      field: getComputedStyle(document.documentElement).getPropertyValue("--ground-light").trim(),
    }));
    expect(painted.field).toBe(NEUTRAL_LIGHT);
    const [bodyRgb, neutralRgb] = await toSrgb(page, [painted.body, NEUTRAL_LIGHT]);
    expect(bodyRgb).toBe(neutralRgb);
  });

  test("night paints the dark half of the neutral field", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("photography.appearance", "dark"));
    await page.goto("/qa-probe");
    const painted = await page.evaluate(() => ({
      body: getComputedStyle(document.body).backgroundColor,
      field: getComputedStyle(document.documentElement).getPropertyValue("--ground-dark").trim(),
    }));
    expect(painted.field).toBe(NEUTRAL_DARK);
    const [bodyRgb, darkRgb] = await toSrgb(page, [painted.body, NEUTRAL_DARK]);
    expect(bodyRgb).toBe(darkRgb);
    await page.evaluate(() => localStorage.removeItem("photography.appearance"));
  });

  test("focus-visible outline is 2px solid --color-focus with 3px offset (§3)", async ({ page }) => {
    await page.goto("/qa-probe");
    // First Tab stop must be the skip link (§5.1 order: skip first).
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const s = getComputedStyle(el);
      return {
        tag: el.tagName,
        href: el instanceof HTMLAnchorElement ? el.getAttribute("href") : null,
        text: (el.textContent ?? "").trim(),
        outlineWidth: s.outlineWidth,
        outlineStyle: s.outlineStyle,
        outlineColor: s.outlineColor,
        outlineOffset: s.outlineOffset,
        focusToken: getComputedStyle(document.documentElement).getPropertyValue("--color-focus").trim(),
      };
    });
    expect(focused, "first Tab stop must be the skip link").not.toBeNull();
    expect(focused?.tag).toBe("A");
    expect(focused?.href).toBe("#main");
    expect(focused?.text).toBe("Skip to content");
    expect(focused?.outlineWidth).toBe("2px");
    expect(focused?.outlineStyle).toBe("solid");
    expect(focused?.outlineOffset).toBe("3px");
    // The ring is the theme's own --color-focus token. The token's AUTHORED
    // form is whatever the CSS minifier emitted ("oklch(30% .03 265)"), so the
    // value is pinned as color: Day's focus ink is oklch(0.3 0.03 265).
    const [outlineRgb, tokenRgb, dayFocusRgb] = await toSrgb(page, [
      focused!.outlineColor,
      focused!.focusToken,
      "oklch(0.3 0.03 265)",
    ]);
    expect(outlineRgb).toBe(tokenRgb);
    expect(outlineRgb).toBe(dayFocusRgb);
  });

  test("programmatic skip target suppresses the ring: main:focus { outline: none } (§5.2)", async ({
    page,
  }) => {
    await page.goto("/qa-probe");
    const outline = await page.evaluate(() => {
      const main = document.getElementById("main");
      if (!main) return null;
      main.focus();
      const s = getComputedStyle(main);
      return { tabindex: main.getAttribute("tabindex"), outlineStyle: s.outlineStyle };
    });
    expect(outline, "#main must exist").not.toBeNull();
    expect(outline?.tabindex).toBe("-1");
    expect(outline?.outlineStyle).toBe("none");
  });

  test("spacing tokens resolve to the frozen scale 4/8/16/24/48/96 px (§6)", async ({ page }) => {
    await page.goto("/qa-probe");
    // Probe elements carry width: var(--space-*) — computed width proves the
    // custom properties resolve in real layout, not just as declared strings.
    for (const [suffix, px] of SPACE_SCALE) {
      const probe = page.locator(`[data-probe="space-${suffix}"]`);
      await expect(probe).toHaveCount(1);
      await expect(probe).toHaveCSS("width", `${px}px`);
    }
    // And the declared custom-property values themselves are exact.
    const declared = await page.evaluate(
      (names) => {
        const rootStyle = getComputedStyle(document.documentElement);
        return Object.fromEntries(
          names.map((name) => [name, rootStyle.getPropertyValue(name).trim()]),
        );
      },
      SPACE_SCALE.map(([suffix]) => `--space-${suffix}`),
    );
    for (const [suffix, px] of SPACE_SCALE) {
      expect(declared[`--space-${suffix}`]).toBe(`${px}px`);
    }
  });

  test("expanded magnitude set applies above the content-fit boundary (§2.2/§2.3)", async ({
    page,
  }) => {
    await page.goto("/qa-probe");
    const magnitudes = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      return {
        edgeInset: s.getPropertyValue("--edge-inset").trim(),
        bodySizeMin: s.getPropertyValue("--type-body-size-min").trim(),
      };
    });
    expect(magnitudes.edgeInset).toBe("56px");
    expect(magnitudes.bodySizeMin).toBe("17px");
  });

  test.describe("compact preset (390x844)", () => {
    test.use({ viewport: MOBILE_VIEWPORT });

    test("compact magnitude set applies below the content-fit boundary", async ({ page }) => {
      await page.goto("/qa-probe");
      const magnitudes = await page.evaluate(() => {
        const s = getComputedStyle(document.documentElement);
        return {
          edgeInset: s.getPropertyValue("--edge-inset").trim(),
          bodySizeMin: s.getPropertyValue("--type-body-size-min").trim(),
        };
      });
      expect(magnitudes.edgeInset).toBe("20px");
      expect(magnitudes.bodySizeMin).toBe("17px");
    });
  });
});
