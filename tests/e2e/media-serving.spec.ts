// P4/P5 FINAL TARGETED CORRECTION — IMP-01 browser-level evidence.
//
// The structural markup tests (p4p5-corrections.spec.ts IMP-01 describe)
// proved <picture>/<source type=image/avif> renders and Chromium RESOLVES an
// .avif currentSrc — but URL-suffix inspection is a false-positive class:
// the canonical preview never served /media/, so the selected AVIF was a
// 404 and the "selection" proved nothing about serving or decoding.
//
// These tests close that class. They assert the FULL consumption chain:
// the selected AVIF URL is fetched over HTTP 200 with an image/avif content
// type, decode() succeeds, natural dimensions are non-zero, and the rendered
// box is non-empty. For the Home hero and Gallery first photo (route LCPs)
// they additionally assert exactly ONE effective LCP candidate transfer —
// the responsive preload corresponds to the candidate the browser actually
// consumes (AVIF for AVIF-capable Chromium), with no redundant JPEG body
// download.
//
// Measurement hygiene: the serving probe's own fetch() is excluded from the
// transfer accounting (initiatorType "fetch") so the assertions measure only
// what the PAGE loaded (preload/img initiators). Lazy images are scrolled
// into view and awaited before currentSrc is read — an unloaded lazy <img>
// has not run candidate selection yet.
//
// RED-first: every assertion here failed against the pre-correction state
// (AVIF 404 → decode reject → naturalWidth 0; JPEG preload + AVIF fetch =
// two body transfers).
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

interface Consumption {
  currentSrc: string;
  status: number;
  contentType: string;
  decoded: boolean;
  naturalWidth: number;
  naturalHeight: number;
  renderedWidth: number;
  renderedHeight: number;
}

/** Full serving+decode chain for one <img>: load it (lazy images are
 * scrolled into view and awaited), decode it, probe the selected URL over
 * HTTP, and read natural + rendered dimensions. */
async function consume(page: Page, selector: string): Promise<Consumption> {
  return page.evaluate(async (sel) => {
    const img = document.querySelector<HTMLImageElement>(sel)!;
    img.scrollIntoView({ block: "center" });
    if (!img.complete) {
      await new Promise((settled) => {
        img.addEventListener("load", settled, { once: true });
        img.addEventListener("error", settled, { once: true });
      });
    }
    const url = img.currentSrc || img.src;
    let decoded = false;
    try {
      await img.decode();
      decoded = true;
    } catch {
      decoded = false;
    }
    const response = await fetch(url);
    const rect = img.getBoundingClientRect();
    return {
      currentSrc: url,
      status: response.status,
      contentType: response.headers.get("content-type") ?? "",
      decoded,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      renderedWidth: rect.width,
      renderedHeight: rect.height,
    };
  }, selector);
}

/** Resource-timing entries with an actual body transfer for /media/ URLs,
 * initiated BY THE PAGE (preload/img) — the probe's own fetch() calls are
 * excluded so the LCP accounting measures page behavior only. */
async function pageMediaTransfers(page: Page) {
  return page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter((e): e is PerformanceResourceTiming => e.name.includes("/media/"))
      .filter((e) => e.transferSize > 0)
      .filter((e) => e.initiatorType === "link" || e.initiatorType === "img")
      .map((e) => ({ url: e.name, initiator: e.initiatorType, transferSize: e.transferSize })),
  );
}

test.describe("IMP-01 AVIF resources are actually served and decoded", () => {
  test("Home hero: selected AVIF returns HTTP 200 image/avif and decodes", async ({ page }) => {
    await page.goto("/");
    const r = await consume(page, ".home-cover-img");
    expect(r.currentSrc).toMatch(/\.avif$/);
    expect(r.status, `AVIF ${r.currentSrc} must be servable`).toBe(200);
    expect(r.contentType).toBe("image/avif");
    expect(r.decoded, "img.decode() must succeed on the served AVIF").toBe(true);
    expect(r.naturalWidth).toBeGreaterThan(0);
    expect(r.naturalHeight).toBeGreaterThan(0);
    expect(r.renderedWidth).toBeGreaterThan(0);
    expect(r.renderedHeight).toBeGreaterThan(0);
  });

  test("Gallery first photo: selected AVIF returns HTTP 200 and decodes", async ({ page }) => {
    await page.goto("/galleries/lofoten-polar-night");
    const r = await consume(page, ".gallery-figure img");
    expect(r.currentSrc).toMatch(/\.avif$/);
    expect(r.status, `AVIF ${r.currentSrc} must be servable`).toBe(200);
    expect(r.contentType).toBe("image/avif");
    expect(r.decoded).toBe(true);
    expect(r.naturalWidth).toBeGreaterThan(0);
    expect(r.naturalHeight).toBeGreaterThan(0);
  });

  test("Archive row thumbnail: selected AVIF is servable and decodes", async ({ page }) => {
    await page.goto("/archive");
    const r = await consume(page, ".arow picture img");
    expect(r.currentSrc).toMatch(/\.avif$/);
    expect(r.status, `AVIF ${r.currentSrc} must be servable`).toBe(200);
    expect(r.contentType).toBe("image/avif");
    expect(r.decoded).toBe(true);
    expect(r.naturalWidth).toBeGreaterThan(0);
    expect(r.naturalHeight).toBeGreaterThan(0);
  });
});

test.describe("IMP-01 LCP single-candidate (responsive preload matches consumption)", () => {
  test("Home hero: exactly ONE effective LCP candidate transfer; no redundant JPEG body", async ({ page }) => {
    await page.goto("/");
    const hero = await consume(page, ".home-cover-img");
    expect(hero.status).toBe(200);
    expect(hero.currentSrc).toMatch(/\.avif$/);

    const transfers = await pageMediaTransfers(page);
    const heroUrl = new URL(hero.currentSrc).pathname;
    const forHero = transfers.filter((t) => new URL(t.url).pathname === heroUrl);
    expect(
      forHero.length,
      `the selected LCP candidate must transfer exactly once: ${JSON.stringify(transfers)}`,
    ).toBe(1);
    const jpegTransfers = transfers.filter((t) => /\.jpe?g$/.test(new URL(t.url).pathname));
    expect(
      jpegTransfers,
      `no redundant JPEG body transfer when AVIF is selected: ${JSON.stringify(transfers)}`,
    ).toEqual([]);
  });

  test("Home hero: ONE responsive preload whose srcset matches the AVIF primary", async ({ page }) => {
    await page.goto("/");
    const preload = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('link[rel="preload"][as="image"]'));
      return links.map((l) => ({
        href: l.getAttribute("href"),
        imagesrcset: l.getAttribute("imagesrcset"),
        imagesizes: l.getAttribute("imagesizes"),
        type: l.getAttribute("type"),
      }));
    });
    expect(preload, "exactly one image preload").toHaveLength(1);
    const p = preload[0]!;
    // Responsive preload semantics: imagesrcset carries the AVIF primary
    // candidates the browser will select from; imagesizes matches the
    // <source sizes>; href remains the JPEG fallback URL (used only by
    // browsers without imagesrcset support).
    expect(p.imagesrcset).toBeTruthy();
    expect(p.imagesrcset).toMatch(/^\S+\.avif \d+w(, \S+\.avif \d+w)*$/);
    // The cover is the width of the reading column (content-max minus the
    // stepped edge insets) — never full-bleed. The expression is the SAME
    // string the rendered <source sizes> carries.
    expect(p.imagesizes).not.toBe("100vw");
    expect(p.imagesizes).toContain("calc(1400px - 2 * 56px)");
    const sourceSizes = await page.evaluate(
      () => document.querySelector<HTMLSourceElement>(".cover-stage source[type='image/avif']")?.getAttribute("sizes") ?? null,
    );
    expect(p.imagesizes).toBe(sourceSizes);
    expect(p.href).toMatch(/\.jpe?g$/);
  });

  test("Gallery first photo: one responsive preload, one candidate transfer", async ({ page }) => {
    await page.goto("/galleries/lofoten-polar-night");
    const first = await consume(page, ".gallery-figure img");
    expect(first.status).toBe(200);
    const preload = await page.evaluate(() =>
      Array.from(document.querySelectorAll('link[rel="preload"][as="image"]')).map((l) => ({
        href: l.getAttribute("href"),
        imagesrcset: l.getAttribute("imagesrcset"),
      })),
    );
    expect(preload).toHaveLength(1);
    expect(preload[0]!.imagesrcset).toMatch(/^\S+\.avif \d+w(, \S+\.avif \d+w)*$/);
    const transfers = await pageMediaTransfers(page);
    const firstUrl = new URL(first.currentSrc).pathname;
    expect(transfers.filter((t) => new URL(t.url).pathname === firstUrl)).toHaveLength(1);
    expect(transfers.filter((t) => /\.jpe?g$/.test(new URL(t.url).pathname))).toEqual([]);
  });
});
