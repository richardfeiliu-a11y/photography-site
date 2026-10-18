// Immersive visual-system contract (docs/IMMERSIVE_VIEWING_SPEC.md §2/§5/§6/§7).
//
//   - Every route paints its own field in BOTH concrete themes.
//   - Editorial headings resolve to the serif display stack at weight 400.
//   - The shell header is an in-flow solid bar (no transparent overlay).
//   - No text sits over the home photograph (composition is never crossed).
import { expect, test, type Page } from "@playwright/test";
import { bodyBackground, fieldSrgb } from "../support/colors";
import { MOBILE_VIEWPORT } from "../support/viewports.mjs";

async function assertNoHorizontalOverflow(page: Page, viewportWidth: number): Promise<void> {
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 1);
}

test.describe("immersive — dual theme route sweep", () => {
  const routes = [
    "/",
    "/archive",
    "/places",
    "/galleries/lofoten-polar-night",
    "/about",
    "/404-not-a-route",
  ];

  for (const theme of ["light", "dark"] as const) {
    for (const route of routes) {
      test(`${route} paints the ${theme} field`, async ({ page }) => {
        await page.addInitScript(
          ([k, v]) => localStorage.setItem(k!, v!),
          ["photography.appearance", theme] as const,
        );
        const response = await page.goto(route);
        const expected = route.includes("404-not-a-route") ? 404 : 200;
        expect(response?.status(), `${route} must resolve`).toBe(expected);
        const field = await fieldSrgb(page);
        // The chosen theme paints the page's own half of the field pair (an
        // ambient pair on subject pages, the neutral room elsewhere).
        expect(await bodyBackground(page)).toBe(theme === "light" ? field.light : field.dark);
        await assertNoHorizontalOverflow(page, 1440);
      });
    }
  }
});

test.describe("immersive — editorial typography", () => {
  const headingRoutes = ["/", "/archive", "/places", "/galleries/lofoten-polar-night", "/about"];

  for (const route of headingRoutes) {
    test(`${route}: the page h1 uses the serif display family at weight 400`, async ({ page }) => {
      await page.goto(route);
      const h1 = page.locator("h1").first();
      await expect(h1).toBeVisible();
      const type = await h1.evaluate((el) => {
        const s = getComputedStyle(el);
        return { family: s.fontFamily, weight: s.fontWeight };
      });
      expect(type.family).toContain("Source Serif 4");
      // Immersive direction (spec §6): titles are serif 400 — the Swiss 600
      // sans headings are gone.
      expect(Number(type.weight)).toBe(400);
    });
  }

  test("archive row titles render the serif catalogue voice (spec §7)", async ({ page }) => {
    await page.goto("/archive");
    const title = await page
      .locator(".arow-title")
      .first()
      .evaluate((el) => getComputedStyle(el).fontFamily);
    expect(title).toContain("Source Serif 4");
  });
});

test.describe("immersive — shell", () => {
  test("no transparent overlay header exists on any route", async ({ page }) => {
    for (const route of ["/", "/archive", "/places"]) {
      await page.goto(route);
      await expect(page.locator(".site-header--stage")).toHaveCount(0);
      const header = await page
        .locator(".site-header")
        .evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(header, `${route} header is solid`).not.toBe("rgba(0, 0, 0, 0)");
    }
  });
});

test.describe("immersive — composition protection", () => {
  test("no text overlaps the home photograph at desktop or mobile", async ({ page }) => {
    for (const vp of [
      { width: 1440, height: 900 },
      MOBILE_VIEWPORT,
    ]) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");
      const overlap = await page.evaluate(() => {
        const img = document.querySelector(".home-cover-img")!.getBoundingClientRect();
        const nodes = Array.from(
          document.querySelectorAll<HTMLElement>(".cover-title, .cover-meta, .cover-cta"),
        );
        return nodes
          .map((el) => el.getBoundingClientRect())
          .filter((r) => r.top < img.bottom - 1 && r.bottom > img.top + 1).length;
      });
      expect(overlap, `no lockup text over the plate at ${vp.width}px`).toBe(0);
    }
  });
});
