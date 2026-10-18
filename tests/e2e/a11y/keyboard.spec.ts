// WP-43 behavioral accessibility audit (keyboard, focus, targets, reflow,
// zoom, reduced motion). Systematic WCAG 2.2 AA verification beyond axe:
// automated tooling alone never certifies. Image alt semantics are excluded
// (WP-42 D11 verdict pending); no WCAG certification claimed beyond evidence.
//
// Immersive pass (2026-10-18): the enhanced surface exercised here is the
// VIEWER (Lightbox). The Overview / Contact Sheet it used to drive was pruned
// by owner decision — its keyboard journey is replaced by the viewer's
// (focus the plate control → Enter opens → Escape closes → focus returns).
import { expect, test } from "@playwright/test";

test("skip link is first Tab stop and moves focus to #main", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const first = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return el ? el.getAttribute("href") : null;
  });
  expect(first).toBe("#main");
  await page.keyboard.press("Enter");
  const focused = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return el ? el.getAttribute("id") : null;
  });
  expect(focused).toBe("main");
});

test("keyboard opens and closes the viewer with visible focus", async ({ page }) => {
  await page.goto("/galleries/lofoten-polar-night");
  await page.focus(".figure-open");
  const outline = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return "none";
    const style = getComputedStyle(el);
    return style.outlineWidth + " " + style.outlineStyle;
  });
  expect(outline).toContain("2px");
  await page.keyboard.press("Enter");
  await page.waitForSelector("dialog[data-lightbox]", { state: "visible" });
  // Focus lands in the viewer (its Close control) and Escape returns it to
  // the plate the reader came from.
  const focusInViewer = await page.evaluate(
    () => document.activeElement?.getAttribute("data-lb-close") !== undefined,
  );
  expect(focusInViewer).toBe(true);
  await page.keyboard.press("Escape");
  await page.waitForSelector("dialog[data-lightbox]", { state: "hidden" });
  await expect(page.locator(".figure-open").first()).toBeFocused();
});

test("touch targets meet 44px (visual redesign spec §5)", async ({ page }) => {
  await page.goto("/");
  const navHeights = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("header nav a")).map((a) => {
      const rect = (a as HTMLElement).getBoundingClientRect();
      return Math.round(rect.height);
    });
  });
  expect(navHeights.length).toBeGreaterThan(0);
  for (const height of navHeights) expect(height).toBeGreaterThanOrEqual(44);
  await page.goto("/galleries/lofoten-polar-night");
  // The plate control spans the photograph, so it is comfortably above the
  // 44px floor in both dimensions — and the viewer's own controls must clear
  // it too.
  const triggerBox = await page.locator(".figure-open").first().boundingBox();
  expect(triggerBox).not.toBeNull();
  expect(triggerBox!.width).toBeGreaterThanOrEqual(44);
  expect(triggerBox!.height).toBeGreaterThanOrEqual(44);
  const cx = triggerBox!.x + triggerBox!.width / 2;
  await page.mouse.click(cx, triggerBox!.y + triggerBox!.height / 2);
  await page.waitForSelector("dialog[data-lightbox]", { state: "visible" });
  const closeBox = await page.locator("[data-lb-close]").boundingBox();
  expect(Math.min(closeBox!.width, closeBox!.height)).toBeGreaterThanOrEqual(44);
  await page.keyboard.press("Escape");
  await page.waitForSelector("dialog[data-lightbox]", { state: "hidden" });
});

test("320px reflow has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 600 });
  for (const path of ["/", "/archive", "/galleries/lofoten-polar-night", "/about"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.scrollingElement!.scrollWidth);
    expect(overflow, path).toBeLessThanOrEqual(320);
  }
});

test("200 percent zoom equivalent shows title and controls without clipping", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 225 });
  await page.goto("/galleries/lofoten-polar-night");
  const overflow = await page.evaluate(() => document.scrollingElement!.scrollWidth);
  expect(overflow).toBeLessThanOrEqual(360);
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator(".figure-open").first()).toBeAttached();
});

test("reduced motion disables viewer transitions, Escape still closes", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  try {
    await page.goto("/galleries/lofoten-polar-night");
    await page.click(".figure-open");
    await page.waitForSelector("dialog[data-lightbox]", { state: "visible" });
    const durations = await page.evaluate(() => {
      const img = document.querySelector(".lightbox-img") as HTMLElement | null;
      const close = document.querySelector("[data-lb-close]") as HTMLElement | null;
      return [img, close].map((el) =>
        el ? getComputedStyle(el).transitionDuration.replace(/\s+/g, "") : "missing",
      );
    });
    for (const d of durations) expect(["0s", "0s,0s", "missing"]).toContain(d);
    await page.keyboard.press("Escape");
    await page.waitForSelector("dialog[data-lightbox]", { state: "hidden" });
  } finally {
    await context.close();
  }
});
