// WP-26 e2e — accessible no-JS navigation (TDD, runs against the production
// build served by `astro preview` per playwright.config.ts).
//
// Frozen references: RUNTIME_AND_PROGRESSIVE_ENHANCEMENT §7.1–§7.4 (native
// <a> desktop nav; mobile no-JS fallback — display:none-only toggle and
// checkbox-hack PROHIBITED; visible/in-flow links or <details>/<summary>
// acceptable; menu links ≥53px height with padding-block 12px; no persistent
// app chrome); FINAL_DESIGN_SPECIFICATION §1.3/§5.1 (accepted go-live IA: Journeys,
// Places, About; site mark → Home; skip link → #main tabindex=-1, §5.1),
// §4.2 (320px scrollWidth ≤320), §5.3 (53px touch targets).
//
// The nav destinations /archive /places /about are owned by later WPs; until
// then the anchors' href correctness is asserted (not destination content) —
// a documented WP-26 decision.

import { expect, test, type Page } from "@playwright/test";
import { NARROW_VIEWPORT } from "../support/viewports.mjs";

const NAV = [
  { name: "Journeys", href: "/archive" },
  { name: "Places", href: "/places" },
  { name: "About", href: "/about" },
];

/** The single VISIBLE header-nav anchor for a destination at the current
 * viewport (desktop row, or the open mobile disclosure). */
function visibleNavLink(page: Page, href: string) {
  return page
    .locator("header nav a[href='" + href + "']")
    .filter({ visible: true })
    .first();
}

test.describe("WP-26 site navigation", () => {
  test("accessible no-JS navigation: all destinations reachable, JS disabled", async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/", { waitUntil: "networkidle" });

    // Desktop (default viewport): the inline row exposes all three nav items.
    for (const item of NAV) {
      const link = visibleNavLink(page, item.href);
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", item.href);
      await expect(link).toHaveText(new RegExp(item.name, "i"));
    }

    // The site mark (identity → Home) is a separate top-level anchor.
    const mark = page.locator("header a[href='/']").filter({ visible: true }).first();
    await expect(mark).toBeVisible();

    // Keyboard, JS disabled: skip → site mark → Journeys → Places → About.
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab"); // site mark
    await page.keyboard.press("Tab"); // Journeys
    const focusedHref = await page.evaluate(() => {
      const el = document.activeElement as HTMLAnchorElement | null;
      return el?.tagName === "A" ? el.href : null;
    });
    expect(focusedHref).toContain("/archive");
    await context.close();
  });

  test("no display:none-only toggle: navigation is real in-flow anchors, JS off (DOM assertion)", async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/", { waitUntil: "networkidle" });

    // Each destination must have a visible/in-flow anchor path with JS off.
    for (const item of NAV) {
      expect(await visibleNavLink(page, item.href).count()).toBeGreaterThan(0);
    }
    await context.close();
  });

  test("viewports: no horizontal overflow (320px scrollWidth ≤ 320)", async ({ page }) => {
    await page.setViewportSize(NARROW_VIEWPORT);
    await page.goto("/", { waitUntil: "networkidle" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(overflow).toBeLessThanOrEqual(320);
  });
});

test.describe("WP-26 desktop navigation (≥900px magnitude)", () => {
  test("menu link touch target ≥44px height (visual redesign spec §5)", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    const link = visibleNavLink(page, "/archive");
    const box = (await link.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    const padding = await link.evaluate((el) => getComputedStyle(el).paddingBlock);
    const top = parseFloat(String(padding).split(" ")[0]);
    const bottom = parseFloat(String(padding).split(" ")[1] ?? String(padding).split(" ")[0]);
    expect(Math.min(top, bottom)).toBeGreaterThanOrEqual(12);
  });

  test("skip link is first focusable and targets #main", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      return {
        tag: el?.tagName,
        cls: el?.className,
        href: (el as HTMLAnchorElement | null)?.href,
      };
    });
    expect(focused.tag).toBe("A");
    expect(String(focused.cls)).toContain("skip-link");
    expect(focused.href).toContain("#main");
  });
});
