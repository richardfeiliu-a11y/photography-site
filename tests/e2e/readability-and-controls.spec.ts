// Shell readability + 404 copy (immersive direction, spec §7).
//
// The home opening is an in-flow cover screen (stage + lockup), so the header
// is a normal solid bar that can never cover the photograph, and every stage
// control (scrims, play/prev/next, rotation) is gone.
import { expect, test } from "@playwright/test";
import { DESKTOP_VIEWPORT, MOBILE_VIEWPORT } from "../support/viewports.mjs";

test.describe("header never covers the photograph", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test("mobile: solid opaque header above the plate", async ({ page }) => {
    await page.goto("/");
    const state = await page.evaluate(() => {
      const header = document.querySelector<HTMLElement>(".site-header")!;
      const img = document.querySelector<HTMLElement>(".home-cover-img")!;
      const s = getComputedStyle(header);
      const h = header.getBoundingClientRect();
      const i = img.getBoundingClientRect();
      return {
        background: s.backgroundColor,
        position: s.position,
        headerBottom: h.bottom,
        imageTop: i.top,
      };
    });
    expect(state.background).not.toBe("rgba(0, 0, 0, 0)");
    expect(state.position).not.toBe("absolute");
    expect(state.headerBottom).toBeLessThanOrEqual(state.imageTop + 1);
  });

  test("desktop: in-flow header, no overlay, no scrim", async ({ page }) => {
    await page.setViewportSize({ width: DESKTOP_VIEWPORT.width, height: DESKTOP_VIEWPORT.height });
    await page.goto("/");
    const state = await page.evaluate(() => {
      const header = document.querySelector<HTMLElement>(".site-header")!;
      return {
        background: getComputedStyle(header).backgroundColor,
        position: getComputedStyle(header).position,
        scrims: document.querySelectorAll(".stage-scrim-top, .stage-scrim-bottom").length,
      };
    });
    expect(state.position).toBe("static");
    expect(state.background).not.toBe("rgba(0, 0, 0, 0)");
    expect(state.scrims).toBe(0);
  });

  test("no mobile horizontal overflow at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("stage controls are retired", () => {
  test("no carousel controls exist in the DOM", async ({ page }) => {
    await page.goto("/");
    for (const sel of [
      "[data-stage-controls]",
      "[data-stage-prev]",
      "[data-stage-next]",
      "[data-stage-play]",
      "[data-stage-counter]",
    ]) {
      await expect(page.locator(sel)).toHaveCount(0);
    }
  });
});

test.describe("404 copy", () => {
  test("reads 'No photograph at this address' and the action returns to the cover", async ({
    page,
  }) => {
    const response = await page.goto("/no-such-page-xyz");
    expect(response?.status()).toBe(404);
    // textContent, not innerText: the mono note is rendered uppercase by CSS.
    const body = (await page.locator(".notfound-page").textContent()) ?? "";
    expect(body).toContain("Page not found");
    expect(body).toContain("No photograph at this address");
    // The note speaks the catalogue voice (mono, uppercase, letter-spaced).
    const note = page.locator(".notfound-note");
    await expect(note).toHaveCSS("text-transform", "uppercase");
    await expect(note).toHaveCSS("font-family", /monospace/);
    const action = page.locator(".notfound-page a");
    await expect(action).toHaveAttribute("href", "/");
    await expect(action).toHaveText("Return to the cover");
  });
});
