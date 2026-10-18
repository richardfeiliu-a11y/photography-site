// WP-29 a11y — axe scan of the Archive page (§7.1; WCAG 2.x A/AA union).
import { expect, test } from "@playwright/test";
import { runAxeScanBothThemes } from "../support/axe";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test("archive page: zero axe violations  — Light/Dark (R4 F5)", async ({ page }) => {
  const results = await runAxeScanBothThemes(page, {
    path: "/archive",
    expectedH1: "Journeys",
    withTags: WCAG_TAGS,
  });
  for (const theme of ["light", "dark"] as const) {
    expect(results[theme].violations, `${theme} theme`).toEqual([]);
  }
});
