// Monograph home shell (plan phase 2): the home opening is an in-flow cover,
// so the global header is a normal solid bar — never a transparent overlay.
import { expect, test } from "@playwright/test";

test("home header is a static solid bar with no stage variant", async ({ page }) => {
  await page.goto("/");
  const header = page.locator(".site-header");
  await expect(header).toHaveCount(1);
  await expect(page.locator(".site-header--stage")).toHaveCount(0);

  const style = await header.evaluate((el) => {
    const s = getComputedStyle(el);
    return { position: s.position, background: s.backgroundColor };
  });
  expect(style.position).not.toBe("absolute");
  expect(style.position).not.toBe("fixed");
  // Solid canvas, not transparent.
  expect(style.background).not.toBe("rgba(0, 0, 0, 0)");
});
