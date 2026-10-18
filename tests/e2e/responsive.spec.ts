// Immersive responsive contract (docs/IMMERSIVE_VIEWING_SPEC §5/§7): no
// horizontal overflow at any governed viewport, ≥44px touch targets,
// single-column mobile layouts and a usable mobile viewer.
import { expect, test } from "@playwright/test";

const ROUTES = [
  "/",
  "/archive",
  "/galleries/lofoten-polar-night",
  "/places",
  "/places/amsterdam",
  "/about",
] as const;

const VIEWPORTS = [
  { name: "320", width: 320, height: 740 },
  { name: "390", width: 390, height: 844 },
  { name: "430", width: 430, height: 932 },
  { name: "768", width: 768, height: 1024 },
  { name: "1024", width: 1024, height: 900 },
  { name: "1440", width: 1440, height: 900 },
  { name: "1920", width: 1920, height: 1080 },
] as const;

test.describe("no horizontal overflow", () => {
  for (const vp of VIEWPORTS) {
    test(`@${vp.name}: every route fits its viewport`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const route of ROUTES) {
        await page.goto(route);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflow, `${route} @${vp.name}`).toBeLessThanOrEqual(0);
      }
    });
  }
});

test.describe("mobile ergonomics", () => {
  test("@390 home cover lockup never overlaps and controls are ≥44px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const geometry = await page.evaluate(() => {
      const img = document.querySelector(".home-cover-img")!.getBoundingClientRect();
      const title = document.querySelector(".cover-title")!.getBoundingClientRect();
      const cta = document.querySelector(".cover-cta")!.getBoundingClientRect();
      return {
        titleBelowImage: title.top >= img.bottom - 1,
        titleIntent: title.bottom <= cta.top + 1,
        ctaInsideViewport: cta.right <= window.innerWidth && cta.left >= 0,
      };
    });
    expect(geometry.titleBelowImage).toBe(true);
    expect(geometry.titleIntent).toBe(true);
    expect(geometry.ctaInsideViewport).toBe(true);

    const navTargets = await page
      .locator(".site-nav .nav-link")
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
    for (const h of navTargets) expect(h).toBeGreaterThanOrEqual(44);
  });

  test("@390 gallery: single-column sequence + usable viewer", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    // The index strip stacks to one column on a phone (no side-scroller).
    const stripDirection = await page
      .locator(".strip")
      .evaluate((el) => getComputedStyle(el).flexDirection);
    expect(stripDirection).toBe("column");

    await page.goto("/galleries/lofoten-polar-night");
    // The plate measure is the phone column: the figure fills it, uncropped.
    const plate = await page.locator(".gallery-figure").first().evaluate((fig) => {
      const sequence = document.querySelector<HTMLElement>(".gallery-sequence")!;
      const img = fig.querySelector<HTMLImageElement>("img")!;
      const fr = fig.getBoundingClientRect();
      const sr = sequence.getBoundingClientRect();
      const ir = img.getBoundingClientRect();
      return {
        figureEqualsSequence: Math.abs(fr.width - sr.width) <= 1,
        imgEqualsFigure: Math.abs(ir.width - fr.width) <= 1,
        insideViewport: ir.left >= -1 && ir.right <= window.innerWidth + 1,
      };
    });
    expect(plate.figureEqualsSequence).toBe(true);
    expect(plate.imgEqualsFigure).toBe(true);
    expect(plate.insideViewport).toBe(true);

    // Viewer: contained image, controls ≥44px, bar inside the viewport.
    await page.locator(".figure-open").first().click();
    const lb = await page.evaluate(() => {
      const img = document.querySelector<HTMLImageElement>(".lightbox-img")!;
      const r = img.getBoundingClientRect();
      const close = document.querySelector("[data-lb-close]")!.getBoundingClientRect();
      const bar = document.querySelector<HTMLElement>(".lb-bar")!.getBoundingClientRect();
      return {
        insideX: r.left >= -1 && r.right <= window.innerWidth + 1,
        insideY: r.top >= -1 && r.bottom <= window.innerHeight + 1,
        closeSize: Math.min(close.width, close.height),
        barInside: bar.top >= -1 && bar.bottom <= window.innerHeight + 1,
      };
    });
    expect(lb.insideX).toBe(true);
    expect(lb.insideY).toBe(true);
    expect(lb.closeSize).toBeGreaterThanOrEqual(44);
    expect(lb.barInside).toBe(true);
    await page.keyboard.press("Escape");
  });

  test("@430 lightbox and atlas stay inside the viewport", async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 932 });
    await page.goto("/galleries/lofoten-polar-night");
    await page.locator(".figure-open").nth(1).click();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await page.keyboard.press("Escape");

    await page.goto("/places");
    const atlasCols = await page
      .locator(".places-atlas")
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
    expect(atlasCols).toBe(1);
  });
});
