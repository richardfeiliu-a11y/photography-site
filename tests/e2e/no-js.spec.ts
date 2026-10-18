// WP-41 e2e — No-JS completeness verification (RUNTIME 1-2, TESTING 6.3).
//
// RED by nature: asserts with scripts blocked across all six page types +
// 404. Core-without-JS guarantee: every page readable/navigable; Gallery
// complete without Overview; enhancements absent (not dead); broken-JS
// tolerance probe leaves core readable.
import { expect, test } from "@playwright/test";

async function noJsPage(browser: import("@playwright/test").Browser, path: string) {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  const response = await page.goto(path);
  return { ctx, page, response };
}

test.describe("WP-41 core without JS — all routes readable and navigable", () => {
  test("home: hero, discovery links, nav, skip link", async ({ browser }) => {
    const { ctx, page, response } = await noJsPage(browser, "/");
    expect(response?.status()).toBe(200);
    await expect(page.locator(".home-cover-img")).toHaveCount(1); // single curated cover
    await expect(page.locator(".home-cover")).toHaveCount(1);
    // The index strip is plain markup: every card is a native link.
    expect(await page.locator("a.strip-item a, .strip .gallery-card").count()).toBeGreaterThan(0);
    expect(await page.locator("a[href='/archive']").count()).toBeGreaterThan(0);
    expect(await page.locator("nav a").count()).toBeGreaterThan(0);
    const skip = page.locator(".skip-link");
    await expect(skip).toHaveCount(1);
    await expect(skip).toHaveAttribute("href", "#main");
    await expect(page.locator("main#main")).toHaveCount(1);
    await ctx.close();
  });

  test("archive: the catalogue rows link natively (no grouping needed)", async ({ browser }) => {
    const { ctx, page } = await noJsPage(browser, "/archive");
    expect(await page.locator(".arow").count()).toBeGreaterThan(0);
    const rows = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a.arow")).map((a) => ({
        href: a.getAttribute("href"),
        title: a.querySelector(".arow-title")?.textContent?.trim() ?? "",
        meta: a.querySelector(".arow-meta")?.textContent?.trim() ?? "",
      }))
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.href).toMatch(/^\/galleries\//);
      expect(row.title.length).toBeGreaterThan(0);
      expect(row.meta.length).toBeGreaterThan(0);
    }
    await ctx.close();
  });

  test("places index and place detail: names-led links, no JS", async ({ browser }) => {
    const first = await noJsPage(browser, "/places");
    expect(await first.page.locator(".place-atlas-card").count()).toBeGreaterThan(0);
    await first.ctx.close();
    const second = await noJsPage(browser, "/places/amsterdam");
    await expect(second.page.locator("h1")).toContainText("Amsterdam");
    expect(await second.page.locator("a[href^='/galleries/']").count()).toBeGreaterThan(0);
    await second.ctx.close();
  });

  test("about: static body text readable", async ({ browser }) => {
    const { ctx, page, response } = await noJsPage(browser, "/about");
    expect(response?.status()).toBe(200);
    await expect(page.locator(".about-body")).toHaveCount(1);
    const text = await page.locator(".about-body").innerText();
    expect(text.trim().length).toBeGreaterThan(50);
    await ctx.close();
  });

  test("404: unknown route renders the static not-found page", async ({ browser }) => {
    const { ctx, page, response } = await noJsPage(browser, "/no-such-page-xyz");
    expect(response?.status()).toBe(404);
    await expect(page.locator("main#main")).toHaveCount(1);
    await ctx.close();
  });
});

test.describe("WP-41 gallery without JS — sequence complete, enhancements absent", () => {
  test("sequence scrolls natively: 11 figures, captions inline, no reserved blocks", async ({
    browser,
  }) => {
    const { ctx, page } = await noJsPage(browser, "/galleries/lofoten-polar-night");
    expect(await page.locator(".gallery-figure").count()).toBe(11);
    expect(await page.locator(".gallery-figure img").count()).toBe(11);
    expect(await page.locator(".gallery-figure figcaption").count()).toBeGreaterThan(0);
    const scrollable = await page.evaluate(() => document.body.scrollHeight > window.innerHeight);
    expect(scrollable).toBe(true);
    await ctx.close();
  });

  test("continuation links native and functional", async ({ browser }) => {
    const { ctx, page } = await noJsPage(browser, "/galleries/lofoten-polar-night");
    const next = page.locator("a.next-title");
    await expect(next).toHaveCount(1);
    await expect(next).toHaveAttribute("href", "/galleries/south-china-summer");
    await expect(page.locator("a.origin-link")).toHaveCount(1);
    await ctx.close();
  });

  // NOTE: no no-next gallery exists in the real corpus (all 13 chain to a
  // next gallery); the no-next variant is covered by unit tests (see
  // gallery-ending.spec.ts note).

  test("enhancements absent, not dead: no viewer nodes, no pruned payloads", async ({
    browser,
  }) => {
    const { ctx, page } = await noJsPage(browser, "/galleries/lofoten-polar-night");
    // Lightbox is a JS enhancement: no dialog, triggers, or installed nodes —
    // only its template payload stays in the document (inert by definition).
    await expect(page.locator("dialog[data-lightbox]")).toHaveCount(0);
    await expect(page.locator(".figure-open")).toHaveCount(0);
    await expect(page.locator("[data-lightbox-template]")).toHaveCount(1);
    // The pruned surfaces are gone from the markup entirely: no Overview
    // (Contact Sheet) control, layer or payload, and no position annotation.
    await expect(page.locator("[data-overview-trigger]")).toHaveCount(0);
    await expect(page.locator("[data-overview-layer]")).toHaveCount(0);
    await expect(page.locator("[data-overview-trigger-template]")).toHaveCount(0);
    await expect(page.locator("[data-overview-layer-template]")).toHaveCount(0);
    await expect(page.locator("[data-position-annotation]")).toHaveCount(0);
    await ctx.close();
  });

  test("nav + skip link usable without JS on the gallery", async ({ browser }) => {
    const { ctx, page } = await noJsPage(browser, "/galleries/lofoten-polar-night");
    expect(await page.locator("nav a").count()).toBeGreaterThan(0);
    await expect(page.locator(".skip-link")).toHaveAttribute("href", "#main");
    const back = page.locator("a.back-to-origin");
    await expect(back).toHaveAttribute("href", "/archive");
    await ctx.close();
  });
});

test.describe("WP-41 failure tolerance", () => {
  test("broken-JS simulation leaves core content readable", async ({ page }) => {
    await page.addInitScript(() => {
      throw new Error("simulated enhancement failure");
    });
    await page.goto("/galleries/lofoten-polar-night");
    expect(await page.locator(".gallery-figure").count()).toBe(11);
    await expect(page.locator("a.next-title")).toHaveAttribute("href", "/galleries/south-china-summer");
    await expect(page.locator("h1")).toHaveText("Lofoten, Polar Night");
  });
});
