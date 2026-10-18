// WP-43 gallery page-type axe scan (the missing sixth page type: Home,
// Archive, Places Index, Place Detail, Gallery, About). Same WCAG 2.x A/AA
// rule-set union through tests/support/axe.ts.
import { expect, test } from "@playwright/test";
import { runAxeScan } from "../support/axe";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

// Scanning protocol (immersive direction, 2026-10-18): WCAG evaluates the
// PRESENTED state, so the scan settles first — past the media-slot hydration
// and the one-shot entrance reveals — and then runs at a real MID-SEQUENCE
// reading position rather than at the top of the page.
//
// The former protocol here also waited for the floating position annotation
// to reach opacity 1 (a WP-43 finding: it faded in over 120ms and a scan
// could catch it mid-transition). That subject was PRUNED with the immersive
// port — the reader's location now lives in the viewer's own counter — so the
// protocol asserts its absence instead (a regression guard) and otherwise
// scans the same real reading state.
test("gallery page: zero axe violations — Light/Dark (R4 F5)", async ({ page }) => {
  const results: Record<string, any> = {};
  for (const theme of ["light", "dark"] as const) {
    await page.goto("/galleries/lofoten-polar-night");
    await page.evaluate((t) => {
      try {
        localStorage.setItem("photography.appearance", t);
      } catch {}
      document.documentElement.dataset.theme = t;
      document.documentElement.style.colorScheme = t;
    }, theme);
    await page.reload();

    const actualTheme = await page.evaluate(
      () => document.documentElement.dataset.theme,
    );
    expect(actualTheme).toBe(theme);
    expect(new URL(page.url()).pathname).toBe("/galleries/lofoten-polar-night");
    await expect(page.locator("h1").first()).toHaveText("Lofoten, Polar Night");

    await page.waitForTimeout(600);
    await page.locator("figure").nth(3).scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const readingState = await page.evaluate(() => {
      const figures = Array.from(document.querySelectorAll<HTMLElement>(".gallery-figure"));
      const target = figures[3] ?? null;
      const r = target?.getBoundingClientRect() ?? null;
      return {
        // A real reading position: the 4th plate is actually in the viewport.
        plateInViewport: Boolean(
          r && r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight,
        ),
        // The pruned surfaces are gone from the markup entirely.
        annotation: document.querySelectorAll("[data-position-annotation]").length,
        overview: document.querySelectorAll(
          "[data-overview-layer], [data-overview-trigger], [data-overview-trigger-template]",
        ).length,
      };
    });
    expect(readingState.plateInViewport, `${theme}: mid-sequence reading position`).toBe(true);
    expect(readingState.annotation, `${theme}: no position annotation`).toBe(0);
    expect(readingState.overview, `${theme}: no Overview surface`).toBe(0);
    results[theme] = await runAxeScan(page, { withTags: WCAG_TAGS });
    expect(results[theme].violations, `${theme}`).toEqual([]);
  }
});
