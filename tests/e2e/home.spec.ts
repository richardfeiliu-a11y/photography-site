// Immersive Home contract (docs/IMMERSIVE_VIEWING_SPEC.md §7 + RUNTIME §11.1).
//
// The opening is ONE curated cover screen (stage + lockup, one merged link)
// that fills the first viewport, followed by the "More collections" index
// strip — the Swiss 12-column wall is gone. Kept from every previous
// contract: single h1, exactly one responsive AVIF preload, eager +
// fetchpriority=high cover, hero excluded from the index, no marketing/banner/
// carousel treatment, and the date/place/count metadata line.
import { expect, test } from "@playwright/test";
import { DESKTOP_VIEWPORT, MOBILE_VIEWPORT } from "../support/viewports.mjs";

test.describe("Home — cover resolution (CONTENT_MODEL §10 via WP-25)", () => {
  test("cover equals the featured resolution and is one merged link", async ({ page }) => {
    await page.goto("/");
    const link = page.locator("a.home-cover");
    await expect(link).toHaveCount(1);
    await expect(link).toHaveAttribute("href", "/galleries/lofoten-polar-night");
    await expect(page.locator(".cover-title")).toHaveText("Lofoten, Polar Night");
    // No separate View Gallery affordance; the lockup carries the entry.
    await expect(page.locator(".view-gallery")).toHaveCount(0);
    await expect(page.locator(".cover-cta")).toContainText("View collection");
    await expect(page.locator(".kicker")).toContainText("Featured collection — No. 01");
  });

  test("exactly one h1 on the page; it renders the serif display family at 400", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toHaveCount(1);
    const type = await page.locator("h1").evaluate((el) => {
      const s = getComputedStyle(el);
      return { family: s.fontFamily, weight: s.fontWeight };
    });
    expect(type.family).toContain("Source Serif 4");
    expect(Number(type.weight)).toBe(400);
  });

  test("lockup: kicker, title, then the photographed date + place + count line", async ({
    page,
  }) => {
    await page.goto("/");
    const text = (await page.locator(".lockup").textContent()) ?? "";
    expect(text).toContain("January 2025");
    expect(text).toContain("Lofoten");
    expect(text).toMatch(/\d+ photographs/);
    const titleAt = text.indexOf("Lofoten, Polar Night");
    const metaAt = text.indexOf("January 2025");
    expect(titleAt).toBeGreaterThanOrEqual(0);
    expect(metaAt).toBeGreaterThan(titleAt);
  });

  test("no stage chrome remains (carousel, scrims, controls)", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("[data-stage-carousel]")).toHaveCount(0);
    await expect(page.locator(".stage-scrim-top, .stage-scrim-bottom")).toHaveCount(0);
    await expect(page.locator("[data-stage-controls]")).toHaveCount(0);
  });
});

test.describe("Home — cover stage geometry", () => {
  test("desktop 1440: plate inside the reading column, no crop (contain)", async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/");
    await page.evaluate(async () => {
      const img = document.querySelector<HTMLImageElement>(".home-cover-img")!;
      if (!img.complete) await new Promise((r) => img.addEventListener("load", r, { once: true }));
      await img.decode().catch(() => {});
    });
    const g = await page.evaluate(() => {
      const img = document.querySelector<HTMLImageElement>(".home-cover-img")!;
      const page = document.querySelector<HTMLElement>(".home-page")!;
      const stage = document.querySelector<HTMLElement>(".cover-stage")!;
      const r = img.getBoundingClientRect();
      const s = stage.getBoundingClientRect();
      return {
        pageLeft: page.getBoundingClientRect().left,
        pageRight: page.getBoundingClientRect().right,
        stageTop: s.top,
        stageBottom: s.bottom,
        imgLeft: r.left,
        imgRight: r.right,
        imgTop: r.top,
        imgBottom: r.bottom,
        ratio: r.width / r.height,
        intrinsic: img.naturalWidth / img.naturalHeight,
        objectFit: getComputedStyle(img).objectFit,
        naturalWidth: img.naturalWidth,
      };
    });
    expect(g.naturalWidth).toBeGreaterThan(0);
    expect(g.objectFit).toBe("contain");
    // Fully inside the page column, never bled to the viewport edges.
    expect(g.imgLeft).toBeGreaterThanOrEqual(g.pageLeft - 1);
    expect(g.imgRight).toBeLessThanOrEqual(g.pageRight + 1);
    // Fully inside the stage (the stage only clips, never crops).
    expect(g.imgTop).toBeGreaterThanOrEqual(g.stageTop - 1);
    expect(g.imgBottom).toBeLessThanOrEqual(g.stageBottom + 1);
    // No destructive crop: rendered ratio matches the intrinsic ratio.
    expect(g.ratio).toBeCloseTo(g.intrinsic, 1);
  });

  test("mobile 390: natural-ratio cover with the lockup below it", async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto("/");
    const r = await page.evaluate(() => {
      const img = document.querySelector<HTMLElement>(".home-cover-img")!.getBoundingClientRect();
      const lockup = document.querySelector<HTMLElement>(".lockup")!.getBoundingClientRect();
      const cta = document.querySelector<HTMLElement>(".cover-cta")!.getBoundingClientRect();
      return {
        imgBottom: img.bottom,
        lockupTop: lockup.top,
        ctaInside:
          cta.right <= window.innerWidth && cta.left >= 0 && cta.bottom <= window.innerHeight,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    expect(r.lockupTop).toBeGreaterThanOrEqual(r.imgBottom - 1);
    expect(r.ctaInside).toBe(true);
    expect(r.overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("Home — LCP contract (RUNTIME §11.1)", () => {
  test("exactly one AVIF preload whose descriptors match the rendered <source>", async ({
    page,
  }) => {
    await page.goto("/");
    const links = page.locator('link[rel="preload"][as="image"]');
    await expect(links).toHaveCount(1);
    const preload = await links.first().evaluate((el) => ({
      href: el.getAttribute("href"),
      imagesrcset: el.getAttribute("imagesrcset"),
      imagesizes: el.getAttribute("imagesizes"),
      type: el.getAttribute("type"),
      priority: el.getAttribute("fetchpriority"),
    }));
    const source = await page.locator(".cover-stage source").first().evaluate((el) => ({
      srcset: el.getAttribute("srcset"),
      sizes: el.getAttribute("sizes"),
      type: el.getAttribute("type"),
    }));
    const imgSrc = await page.locator(".home-cover-img").getAttribute("src");
    expect(preload.href).toBe(imgSrc);
    expect(preload.type).toBe("image/avif");
    expect(preload.priority).toBe("high");
    expect(preload.imagesrcset).toBe(source.srcset);
    expect(preload.imagesizes).toBe(source.sizes);
    // The cover is the width of the reading column (content-max minus the
    // stepped insets) — sizes must not claim 100vw.
    expect(preload.imagesizes).not.toBe("100vw");
  });

  test("cover img is eager with fetchpriority=high", async ({ page }) => {
    await page.goto("/");
    const img = page.locator(".home-cover-img");
    await expect(img).not.toHaveAttribute("loading", "lazy");
    await expect(img).toHaveAttribute("fetchpriority", "high");
  });
});

test.describe("Home — the More collections index strip", () => {
  test("hero excluded; every other published gallery is indexed, in order", async ({ page }) => {
    await page.goto("/");
    const hrefs = await page
      .locator(".strip .strip-item a.gallery-card")
      .evaluateAll((els) => els.map((el) => el.getAttribute("href")));
    expect(hrefs.length).toBeGreaterThanOrEqual(1);
    expect(hrefs).not.toContain("/galleries/lofoten-polar-night");
    for (const href of hrefs) expect(href).toMatch(/^\/galleries\/[a-z0-9-]+$/);
    // The strip is the whole remaining corpus (13 published collections, the
    // cover is No. 01), not a slice: the track scrolls.
    expect(hrefs.length).toBe(12);
    const plates = await page
      .locator(".strip .card-plate-num")
      .evaluateAll((els) => els.map((el) => el.textContent!.trim()));
    expect(plates).toEqual([
      "PL. 02",
      "PL. 03",
      "PL. 04",
      "PL. 05",
      "PL. 06",
      "PL. 07",
      "PL. 08",
      "PL. 09",
      "PL. 10",
      "PL. 11",
      "PL. 12",
      "PL. 13",
    ]);
  });

  test("the section names itself and the catalogue span it covers", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".index-title")).toHaveText("More collections");
    await expect(page.locator(".index-note")).toHaveText("No. 02 — No. 13");
    await expect(page.locator(".scroll-cue")).toContainText("12 more collections below");
  });

  test("strip cards speak the catalogue voice (serif title, mono plate/date/count)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const first = page.locator(".strip .gallery-card").first();
    const type = await first.evaluate((card) => ({
      titleFamily: getComputedStyle(card.querySelector(".card-title")!).fontFamily,
      titleWeight: getComputedStyle(card.querySelector(".card-title")!).fontWeight,
      plateFamily: getComputedStyle(card.querySelector(".card-plate-num")!).fontFamily,
      metaFamily: getComputedStyle(card.querySelector(".card-meta")!).fontFamily,
      metaTransform: getComputedStyle(card.querySelector(".card-meta")!).textTransform,
    }));
    expect(type.titleFamily).toContain("Source Serif 4");
    expect(Number(type.titleWeight)).toBe(400);
    expect(type.plateFamily).toContain("ui-monospace");
    expect(type.metaFamily).toContain("ui-monospace");
    expect(type.metaTransform).toBe("uppercase");
    // Long-month dates, the one date language (immersive spec §6).
    const date = await first.locator(".card-date").textContent();
    expect(date).toMatch(/^(January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/);
  });

  test("no marketing/banner/carousel treatment on Home (behavior-scoped)", async ({ page }) => {
    await page.goto("/");
    const inventory = await page.evaluate(() => ({
      buttons: document.querySelectorAll("main button, [role=button], input[type=submit]").length,
      banners: document.querySelectorAll("[class*=banner], [class*=marketing]").length,
      video: document.querySelectorAll("video, [class*=carousel]").length,
    }));
    expect(inventory.buttons).toBe(0);
    expect(inventory.banners).toBe(0);
    expect(inventory.video).toBe(0);
  });
});
