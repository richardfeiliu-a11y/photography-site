// WP-31 a11y — axe scans of About + the 404 page (§7.1).
import { expect, test } from "@playwright/test";
import { runAxeScanBothThemes } from "../support/axe";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test("about page: zero axe violations  — Light/Dark (R4 F5)", async ({ page }) => {
  const results = await runAxeScanBothThemes(page, {
    path: "/about",
    expectedH1: "About",
    withTags: WCAG_TAGS,
  });
  for (const theme of ["light", "dark"] as const) {
    expect(results[theme].violations, `${theme} theme`).toEqual([]);
  }
});

test("404 page: zero axe violations  — Light/Dark (R4 F5)", async ({ page }) => {
  const results = await runAxeScanBothThemes(page, {
    path: "/404",
    expectedH1: "Page not found",
    withTags: WCAG_TAGS,
  });
  for (const theme of ["light", "dark"] as const) {
    expect(results[theme].violations, `${theme} theme`).toEqual([]);
  }
});
