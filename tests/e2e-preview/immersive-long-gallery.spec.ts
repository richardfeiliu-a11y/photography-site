// Preview-artifact e2e: long-gallery plates (successor to the retired
// overview-long-gallery spec).
//
// The former spec audited the Overview (Contact Sheet) current-context
// behaviour. That feature left with the immersive direction (2026-10-18), so
// this lane now guards what preview mode still owns: the explicit preview
// BUILD + isolated assembly serve a 28-photo gallery, its photographs come
// back at one uniform plate width, and the removed chrome stays removed.
import { expect, test } from "@playwright/test";

test.describe("preview artifact · long gallery", () => {
  test("28 photographs render at one uniform plate width without removed chrome", async ({
    page,
  }) => {
    await page.goto("/galleries/netherlands");

    await expect(page.locator(".gallery-figure")).toHaveCount(28);
    await expect(page.locator("[data-overview-trigger], .overview-trigger")).toHaveCount(0);
    await expect(page.locator("[data-overview-grid]")).toHaveCount(0);
    await expect(page.locator("[data-position-annotation]")).toHaveCount(0);

    // Media slots hydrate when they approach the viewport; walk the first
    // four plates into view before measuring.
    const widths = await page.evaluate(async () => {
      const figures = [...document.querySelectorAll<HTMLElement>(".gallery-figure")].slice(0, 4);
      for (const figure of figures) {
        figure.scrollIntoView({ block: "center" });
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      return figures.map((figure) => {
        const img = figure.querySelector("img");
        return img ? Math.round(img.getBoundingClientRect().width) : 0;
      });
    });

    expect(widths.every((width) => width > 0)).toBe(true);
    expect(new Set(widths).size).toBe(1);
    expect(widths[0]).toBeGreaterThan(1100);
  });
});
