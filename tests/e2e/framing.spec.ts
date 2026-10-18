// Monograph framing contract (spec §7.4 + §7.5):
//  - photographs are never rounded (sharp artwork framing)
//  - motion durations collapse to 0 under prefers-reduced-motion
import { expect, test } from "@playwright/test";

test("gallery photographs render with zero border radius (§7.4)", async ({ page }) => {
  await page.goto("/galleries/lofoten-polar-night");
  const firstImg = page.locator(".gallery-figure img").first();
  await expect(firstImg).toBeVisible();
  await expect(firstImg).toHaveCSS("border-radius", "0px");
});

test("motion tokens collapse under prefers-reduced-motion (§7.5)", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/galleries/lofoten-polar-night");
  const durations = await page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return {
      micro: s.getPropertyValue("--dur-micro").trim(),
      medium: s.getPropertyValue("--dur-medium").trim(),
      major: s.getPropertyValue("--dur-major").trim(),
    };
  });
  // Computed style serializes a zero time as "0s".
  expect(durations).toEqual({ micro: "0s", medium: "0s", major: "0s" });
});
