// Lightbox (viewer) accessibility: open-state axe scan + dialog semantics
// and 44px controls.
//
// History: the immersive port briefly shipped the viewer's plate room
// (`overflow-y: auto`) without keyboard access, which axe flagged as
// `scrollable-region-focusable`. Fixed in Lightbox.astro (the room is now
// focusable with its own region label); the scan must stay green.

import { expect, test } from "@playwright/test";
import { runAxeScan } from "../support/axe";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test("open Lightbox has zero axe violations (Light/Dark)", async ({ page }) => {
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
    await page.locator(".figure-open").nth(2).click();
    const dialog = page.locator("dialog[data-lightbox]");
    await expect(dialog).toHaveJSProperty("open", true);

    const result = await runAxeScan(page, { withTags: WCAG_TAGS });
    expect(result.violations, theme).toEqual([]);

    // Touch targets ≥44px on the controls.
    for (const sel of ["[data-lb-close]", "[data-lb-prev]", "[data-lb-next]"]) {
      const box = await dialog.locator(sel).boundingBox();
      expect(Math.max(box!.width, box!.height)).toBeGreaterThanOrEqual(44);
    }
  }
});
