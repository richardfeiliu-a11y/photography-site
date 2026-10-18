// Gallery route contract (production build via astro preview), immersive
// direction: canonical routes, published-only, authored order, data contract,
// and the header's own content order (the Contact Sheet trigger was pruned
// with the Overview layer — owner decision, 2026-10-18).
import { expect, test } from "@playwright/test";
import { hydrateAllMediaSlots } from "../support/media-slots";

test.describe("WP-33 Gallery route", () => {
  test("canonical gallery renders with the full authored sequence", async ({ page }) => {
    const response = await page.goto("/galleries/lofoten-polar-night");
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveText("Lofoten, Polar Night");
    // Below-first photos hydrate from <noscript> on proximity (R4 perf gate);
    // the full authored sequence is present after the deterministic hydrate.
    await hydrateAllMediaSlots(page);
    const imgs = await page.locator(".gallery-figure img").count();
    expect(imgs).toBe(11); // authored photos[] length
  });

  test("sequence img order matches the authored photo order (data-photo-id)", async ({ page }) => {
    await page.goto("/galleries/lofoten-polar-night");
    const ids = await page.evaluate(() =>
      // data-photo-id lives on the FIGURE (WP-35's assertion surface).
      Array.from(document.querySelectorAll(".gallery-figure")).map((fig) =>
        fig.getAttribute("data-photo-id"),
      ),
    );
    // Authored order from content/galleries/lofoten-polar-night/meta.yaml photos[].
    expect(ids).toEqual([
      "p_lofoten_polar_night_001",
      "p_lofoten_polar_night_002",
      "p_lofoten_polar_night_003",
      "p_lofoten_polar_night_004",
      "p_lofoten_polar_night_005",
      "p_lofoten_polar_night_006",
      "p_lofoten_polar_night_007",
      "p_lofoten_polar_night_008",
      "p_lofoten_polar_night_009",
      "p_lofoten_polar_night_010",
      "p_lofoten_polar_night_011",
    ]);
  });

  test("imgs carry intrinsic width/height (CLS prevention, §11.3)", async ({ page }) => {
    await page.goto("/galleries/lofoten-polar-night");
    await hydrateAllMediaSlots(page);
    const missing = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll(".gallery-figure img")).filter(
          (img) => !img.getAttribute("width") || !img.getAttribute("height"),
        ).length,
    );
    expect(missing).toBe(0);
  });

  test("continuation: lofoten-polar-night → south-china-summer (standard variant, native links)", async ({
    page,
  }) => {
    await page.goto("/galleries/lofoten-polar-night");
    const next = page.locator("a.next-title");
    await expect(next).toHaveCount(1);
    await expect(next).toHaveAttribute("href", "/galleries/south-china-summer");
    await expect(next).toHaveText("Next Gallery — South China, Summer");
    await expect(page.locator("a.origin-link")).toHaveCount(1);
  });

  test("draft galleries have NO public route (published-only getStaticPaths)", async ({
    request,
  }) => {
    const long72 = await request.get("/galleries/long-gallery-72");
    expect(long72.status()).toBe(404);
    const essen = await request.get("/galleries/essen-industrial-light");
    expect(essen.status()).toBe(404);
  });
});

test.describe("Gallery header (frozen editorial treatment)", () => {
  test("header content order: Back → h1 title → date·places meta → description", async ({
    page,
  }) => {
    await page.goto("/galleries/lofoten-polar-night");
    const order = await page.evaluate(() => {
      const header = document.querySelector(".gallery-header")!;
      const seq: string[] = [];
      const walk = (el: Element) => {
        for (const child of el.children) {
          if (child.matches("a.back-to-origin")) seq.push("back");
          if (child.matches("h1")) seq.push("title");
          if (child.matches("[data-gallery-meta]")) seq.push("meta");
          if (child.matches("[data-gallery-description]")) seq.push("desc");
          walk(child);
        }
      };
      walk(header);
      return seq;
    });
    expect(order).toEqual(["back", "title", "meta", "desc"]);
  });

  test("header is NOT sticky (§10.2)", async ({ page }) => {
    await page.goto("/galleries/lofoten-polar-night");
    await page.evaluate(() => window.scrollTo(0, 400));
    const position = await page.evaluate(
      () => getComputedStyle(document.querySelector(".gallery-header")!).position,
    );
    expect(position).not.toBe("sticky");
    expect(position).not.toBe("fixed");
  });

  test("description renders when authored (real-corpus gallery)", async ({ page }) => {
    await page.goto("/galleries/lofoten-polar-night");
    await expect(page.locator("[data-gallery-description]")).toHaveCount(1);
  });

  test("no Contact Sheet trigger or template survives the pruning", async ({ page }) => {
    await page.goto("/galleries/lofoten-polar-night");
    // The Overview layer and its installer template were removed with the
    // 2026-10-18 function pruning; neither the control nor its payload may
    // come back into the DOM.
    await expect(page.locator("[data-overview-trigger]")).toHaveCount(0);
    await expect(page.locator("[data-overview-trigger-template]")).toHaveCount(0);
    await expect(page.locator("[data-overview-layer]")).toHaveCount(0);
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("Contact Sheet");
  });

  test("Back to origin link present with the static fallback (/archive)", async ({ page }) => {
    await page.goto("/galleries/lofoten-polar-night");
    const back = page.locator("a.back-to-origin");
    await expect(back).toHaveCount(1);
    await expect(back).toHaveAttribute("href", "/archive");
    await expect(back).toHaveText("Back to Journeys");
  });

  test("date metadata uses tabular numerals (§2.2)", async ({ page }) => {
    await page.goto("/galleries/lofoten-polar-night");
    const variant = await page.evaluate(() => {
      const meta = document.querySelector("[data-gallery-meta] .tnum")!;
      return getComputedStyle(meta).fontVariantNumeric;
    });
    expect(variant).toContain("tabular-nums");
  });
});
