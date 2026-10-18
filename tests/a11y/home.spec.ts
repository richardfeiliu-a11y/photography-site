// WP-28 a11y — axe scan of the Home page (TESTING_AND_VISUAL_REGRESSION §7.1;
// WCAG 2.x A/AA rule-set union). Real page-type scans accrete per page, all
// through tests/support/axe.ts.
import { expect, test } from "@playwright/test";
import { runAxeScanBothThemes } from "../support/axe";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test("home page: zero axe violations  — Light/Dark (R4 F5)", async ({ page }) => {
  const results = await runAxeScanBothThemes(page, {
    path: "/",
    expectedH1: "Lofoten, Polar Night",
    withTags: WCAG_TAGS,
  });
  for (const theme of ["light", "dark"] as const) {
    expect(results[theme].violations, `${theme} theme`).toEqual([]);
  }
});

/**
 * The appearance switcher is in the header of EVERY page, so the existing
 * full-page scan above already covers its axe rules — this test deliberately
 * does NOT re-run that scan. It pins the control's own semantics contract so a
 * future markup change cannot silently drop the accessible names or the
 * keyboard affordance.
 */
test("appearance radiogroup: role, accessible names, roving tabindex, keyboard", async ({
  page,
}) => {
  await page.goto("/");
  const group = page.locator("[data-appearance-control]");
  await expect(group).toHaveAttribute("role", "radiogroup");
  await expect(group).toHaveAttribute("aria-label", "Appearance");

  // Every radio has a non-empty accessible name (axe's button-name analogue).
  const radios = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-appearance-value]")].map((b) => ({
      mode: b.dataset.appearanceValue,
      label: b.getAttribute("aria-label") ?? "",
      checked: b.getAttribute("aria-checked"),
      tabindex: b.tabIndex,
    })),
  );
  expect(radios).toHaveLength(3);
  for (const r of radios) {
    expect(r.label.trim().length, `${r.mode} has an accessible name`).toBeGreaterThan(0);
    expect(r.checked, `${r.mode} has aria-checked`).toMatch(/^(true|false)$/);
  }
  // Exactly one radio is in the tab order (roving tabindex).
  expect(radios.filter((r) => r.tabindex === 0)).toHaveLength(1);

  // The group is reachable and operable by keyboard alone.
  await page.locator('[data-appearance-value="system"]').focus();
  await expect(page.locator('[data-appearance-value="system"]')).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-appearance-value="light"]')).toHaveAttribute(
    "aria-checked",
    "true",
  );
  // The immersive control is TEXT-ONLY: three chips carrying the words, no
  // decorative glyph span (the Swiss .ac-glyph is gone) and no icon font or
  // inline SVG (extra request + FOUT, and the 404/places contracts assert
  // `svg === 0`). The visible label IS the accessible name's text.
  const chips = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-appearance-value]")].map((b) => ({
      mode: b.dataset.appearanceValue,
      text: b.textContent!.trim(),
      inners: b.innerHTML,
    })),
  );
  expect(chips.map((c) => c.text)).toEqual(["Day", "Night", "System"]);
  for (const chip of chips) expect(chip.inners).not.toMatch(/<svg|<img|<i\b/);
  const iconography = await page.evaluate(() => ({
    glyphs: document.querySelectorAll("[data-appearance-control] .ac-glyph").length,
    svgs: document.querySelectorAll("[data-appearance-control] svg").length,
    cycles: document.querySelectorAll("[data-appearance-cycle]").length,
  }));
  expect(iconography.glyphs).toBe(0);
  expect(iconography.svgs).toBe(0);
  expect(iconography.cycles).toBe(0);
});
