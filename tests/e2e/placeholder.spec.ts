// WP-28 Home smoke suite (successor to the WP-02 placeholder smoke — the
// placeholder page left with WP-28; the JS canary + token/font probes moved to
// the dedicated /qa-probe QA surface, robots-noindex, not in the IA).
// Production build served by `astro preview` per playwright.config.ts.
import { expect, test } from "@playwright/test";
import { MOBILE_VIEWPORT } from "../support/viewports.mjs";
import { readPageCanary } from "../support/canary";

test.describe("JS-enabled context", () => {
  test("home page loads at the desktop preset (1440x900, DSF 1)", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Lofoten, Polar Night");
    expect(page.viewportSize()).toEqual({ width: 1440, height: 900 });
    expect(page.context().browser()?.version()).toBeTruthy();
  });

  test("page scripts run: the canary global is set (on the QA probe surface)", async ({ page }) => {
    await page.goto("/qa-probe");
    const canary = await readPageCanary(page);
    expect(canary.evaluated).toBe(true);
    expect(canary.value).toBe("js-enabled");
  });

  test.describe("mobile preset", () => {
    test.use({ viewport: MOBILE_VIEWPORT });

    test("the mobile preset (390x844, DSF 1) renders the home page", async ({ page }) => {
      await page.goto("/");
      expect(page.viewportSize()).toEqual(MOBILE_VIEWPORT);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Lofoten, Polar Night");
    });
  });
});

test.describe("JS-blocked context (no-JS mode)", () => {
  test.use({ javaScriptEnabled: false });

  test("scripts are demonstrably blocked: the canary global is never set", async ({ page }) => {
    const response = await page.goto("/qa-probe");
    expect(response?.status()).toBe(200);

    const canary = await readPageCanary(page);
    if (canary.evaluated) {
      // evaluate ran, but page scripts did not: the global must be absent.
      expect(canary.value).toBeUndefined();
    } else {
      // evaluate itself was refused: the JS engine is disabled outright.
      expect(canary.error).toBeTruthy();
    }
  });
});
