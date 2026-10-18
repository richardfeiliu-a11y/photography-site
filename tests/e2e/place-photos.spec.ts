// R3 place-photo aggregation e2e (docs/reports/gallery-r3-fix-agent-handoff-
// 2026-09-13.md §3 acceptance counter-examples):
//   - Amsterdam shows the flat cross-journey PHOTO collection (not journey
//     blocks, not a bare gallery list);
//   - Amsterdam must NOT contain photos confirmed as Cologne/The Hague;
//   - each photo deep-links into its source gallery at the photo anchor;
//   - places without confirmed photos keep honest non-photo pages.
// Production build served by the assembled artifact server.
import { expect, test } from "@playwright/test";

const AMSTERDAM_PHOTOS = [
  "p_netherlands_016",
  "p_netherlands_015",
  "p_netherlands_014",
  "p_netherlands_013",
  "p_netherlands_011",
  "p_netherlands_010",
  "p_netherlands_009",
  "p_netherlands_008",
];

test.describe("R3 place photo aggregation — Amsterdam", () => {
  test("leads with the 8-photo collection in captured_at DESC order", async ({ page }) => {
    await page.goto("/places/amsterdam");
    const order = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".place-photo")).map((a) =>
        (a.getAttribute("href") ?? "").split("#")[1],
      ),
    );
    expect(order).toEqual(AMSTERDAM_PHOTOS);
    await expect(page.locator(".place-photos-heading")).toContainText("8");
  });

  test("excludes photos confirmed as Cologne (counter-example)", async ({ page }) => {
    await page.goto("/places/amsterdam");
    const hrefs = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".place-photo")).map((a) => a.getAttribute("href")),
    );
    for (const colognePhoto of ["p_netherlands_026", "p_netherlands_027", "p_netherlands_028"]) {
      const leak = hrefs!.filter((h) => h!.includes(colognePhoto));
      expect(leak, `${colognePhoto} must not appear under Amsterdam`).toEqual([]);
    }
    // The Cologne photos live on the Cologne place page instead.
    await page.goto("/places/cologne");
    const cologneHrefs = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".place-photo")).map((a) => a.getAttribute("href")),
    );
    expect(cologneHrefs).toHaveLength(2);
    expect(cologneHrefs!.every((h) => h!.includes("p_netherlands_02"))).toBe(true);
  });

  test("every photo carries its source gallery and a View full journey entry", async ({ page }) => {
    await page.goto("/places/amsterdam");
    const first = page.locator(".place-photo").first();
    await expect(first).toHaveAttribute("href", "/galleries/netherlands#p_netherlands_016");
    await expect(first.locator(".place-photo-source")).toHaveText("Netherlands");
    await expect(first.locator(".place-photo-cta")).toContainText("View full journey");
  });

  test("the deep link lands inside the source gallery at the photo position", async ({ page }) => {
    await page.goto("/places/amsterdam");
    await page.locator(".place-photo").first().click();
    await expect(page).toHaveURL(/\/galleries\/netherlands#p_netherlands_016$/);
    // The target figure exists and is the anchored element.
    const target = page.locator("#p_netherlands_016");
    await expect(target).toHaveCount(1);
    await expect(target).toBeVisible();
    const info = await target.evaluate((el) => ({
      top: el.getBoundingClientRect().top,
      vh: window.innerHeight,
    }));
    // The browser's native anchor scroll brought the photo into view.
    expect(info.top).toBeLessThanOrEqual(info.vh);
    expect(info.top).toBeGreaterThan(-info.vh);
  });

  test("no-JS renders the same static collection (no hydration dependency)", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto("/places/amsterdam");
    await expect(page.locator(".place-photo")).toHaveCount(8);
    await expect(page.locator(".place-photo").first()).toHaveAttribute(
      "href",
      "/galleries/netherlands#p_netherlands_016",
    );
    await ctx.close();
  });
});

test.describe("R3 place without confirmed photos stays honest", () => {
  test("a place with no confirmed photo refs renders no photo grid and no substitute collection", async ({
    page,
  }) => {
    await page.goto("/places/thun");
    await expect(page.locator(".place-photos")).toHaveCount(0);
    // R3 wrote this as "the journey gallery list is the entry (existing
    // contract)". R4 F1 supersedes that: the R3 lane removed the journey
    // fallback from the page (a journey that merely MENTIONS the place is not
    // evidence of photos taken there), and tests/e2e/places.spec.ts pins the
    // rule. The assertion here therefore states the honest page's
    // requirements instead of a substitute list.
    await expect(page.locator(".gallery-card")).toHaveCount(0);
    await expect(page.locator("[data-place-migration-status]")).toHaveCount(1);
    // The page still identifies itself (place name + region context).
    await expect(page.locator("h1")).toContainText("Thun");
    await expect(page.locator("[data-place-context]")).not.toHaveCount(0);
  });
});
