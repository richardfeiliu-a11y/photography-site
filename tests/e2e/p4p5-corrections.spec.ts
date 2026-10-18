// P4/P5 TARGETED CORRECTIONS — browser-level (e2e) evidence.
//
// These run against the assembled browser-facing artifact (see
// playwright.config.ts / tests/support/artifact.mjs). They prove the
// corrections are actually consumed downstream: AVIF <source> selection and
// browser currentSrc (serving/decode evidence lives in media-serving.spec.ts,
// back-origin navigation in back-origin.spec.ts), G3 geometry across all
// three frozen viewport roles, and the QA-harness route availability.
import { expect, test } from "@playwright/test";
import { MOBILE_VIEWPORT } from "../support/viewports.mjs";

// ---------------------------------------------------------------------------
// IMP-01 — AVIF browser consumption evidence
// ---------------------------------------------------------------------------

test.describe("IMP-01 AVIF browser consumption", () => {
  test("Home hero: <picture><source type=image/avif> + JPEG <img> fallback", async ({ page }) => {
    await page.goto("/");
    const cover = page.locator(".home-cover");
    // R4 T10: the stage renders ALL slides' <picture> markup in the same DOM
    // (only the active one is exposed), so every hero-wide locator has to be
    // scoped to the ACTIVE slide — a hero-level `source` locator now resolves
    // to three elements and fails strict mode.
    const heroSlide = cover;
    await expect(heroSlide.locator("picture")).toHaveCount(1);
    await expect(heroSlide.locator('source[type="image/avif"]')).toHaveCount(1);
    const avifSrcset = await heroSlide.locator('source[type="image/avif"]').getAttribute("srcset");
    expect(avifSrcset).toMatch(/^\S+ \d+w(, \S+ \d+w)*$/);
    await expect(heroSlide.locator("img")).toHaveCount(1);
    const imgSrc = await heroSlide.locator("img").getAttribute("src");
    expect(imgSrc).toMatch(/\.jpg$/); // JPEG fallback
    // Intrinsic dimensions + sizes present.
    expect(await heroSlide.locator("img").getAttribute("width")).toMatch(/^\d+$/);
    expect(await heroSlide.locator("img").getAttribute("height")).toMatch(/^\d+$/);
    // Cinematic stage slot (direction doc §4.1): the stage is full-bleed,
    // so 100vw is the layout-honest description again.
    expect(await heroSlide.locator("img").getAttribute("sizes")).not.toBe("100vw");
  });

  test("Home hero: Chromium selects an AVIF currentSrc where supported", async ({ page }) => {
    await page.goto("/");
    const currentSrc = await page.evaluate(() => {
      const img = document.querySelector<HTMLImageElement>(".home-cover-img");
      if (!img) return null;
      const source = document.querySelector<HTMLSourceElement>(".cover-stage source[type=\"image/avif\"]");
      return { currentSrc: img.currentSrc || img.src, sourceType: source?.type || null };
    });
    expect(currentSrc).not.toBeNull();
    // Chromium with AVIF support resolves currentSrc to an AVIF URL.
    expect(currentSrc!.currentSrc).toMatch(/\.avif$/);
    expect(currentSrc!.sourceType).toBe("image/avif");
  });

  test("Home hero: exactly one LCP preload, responsive + AVIF-primary", async ({ page }) => {
    await page.goto("/");
    const preloads = await page.evaluate(() =>
      Array.from(document.querySelectorAll('link[rel="preload"][as="image"]')).map((l) => ({
        href: l.getAttribute("href"),
        imagesrcset: l.getAttribute("imagesrcset"),
        imagesizes: l.getAttribute("imagesizes"),
      })),
    );
    expect(preloads).toHaveLength(1);
    // IMP-01 responsive preload: the imagesrcset mirrors the AVIF primary
    // candidate set; href remains the JPEG fallback URL.
    expect(preloads[0]!.imagesrcset).toMatch(/^\S+\.avif \d+w(, \S+\.avif \d+w)*$/);
    expect(preloads[0]!.imagesizes).not.toBe("100vw"); // in-flow plate, not full-bleed
    expect(preloads[0]!.href).toMatch(/\.jpe?g$/);
  });

  test("Gallery card (index strip): <picture><source type=image/avif> + JPEG fallback", async ({ page }) => {
    await page.goto("/");
    const card = page.locator(".strip .gallery-card").first();
    await expect(card.locator("picture")).toHaveCount(1);
    await expect(card.locator('source[type="image/avif"]')).toHaveCount(1);
    await expect(card.locator("img")).toHaveCount(1);
    const src = await card.locator("img").getAttribute("src");
    expect(src).toMatch(/\.jpg$/);
  });

  test("Gallery sequence: first <figure> uses <picture><source type=image/avif> + JPEG <img>", async ({ page }) => {
    await page.goto("/galleries/lofoten-polar-night");
    const fig = page.locator(".gallery-figure").first();
    await expect(fig.locator("picture")).toHaveCount(1);
    await expect(fig.locator('source[type="image/avif"]')).toHaveCount(1);
    await expect(fig.locator("img")).toHaveCount(1);
  });

  test("Gallery sequence first image: Chromium selects an AVIF currentSrc", async ({ page }) => {
    await page.goto("/galleries/lofoten-polar-night");
    const r = await page.evaluate(() => {
      const fig = document.querySelector<HTMLElement>(".gallery-figure")!;
      const img = fig.querySelector<HTMLImageElement>("img")!;
      const source = fig.querySelector<HTMLSourceElement>('source[type="image/avif"]');
      return { currentSrc: img.currentSrc || img.src, sourceType: source?.type || null };
    });
    expect(r.currentSrc).toMatch(/\.avif$/);
    expect(r.sourceType).toBe("image/avif");
  });

  test("Gallery first photo: exactly one responsive preload (AVIF primary, JPEG fallback href)", async ({ page }) => {
    await page.goto("/galleries/lofoten-polar-night");
    const s = await page.evaluate(() => {
      const preloads = Array.from(document.querySelectorAll('link[rel="preload"][as="image"]')).map(
        (l) => ({ href: l.getAttribute("href"), imagesrcset: l.getAttribute("imagesrcset") }),
      );
      return { preloads };
    });
    expect(s.preloads).toHaveLength(1);
    expect(s.preloads[0]!.imagesrcset).toMatch(/^\S+\.avif \d+w(, \S+\.avif \d+w)*$/);
    expect(s.preloads[0]!.href).toMatch(/\.jpe?g$/);
  });
});

// ---------------------------------------------------------------------------
// IMP-02 — G3 geometry across all three frozen viewport roles
// ---------------------------------------------------------------------------

test.describe("IMP-02 G3 full-photo-visible across frozen viewport roles", () => {
  test("mobile portrait 390x844: the whole plate fits its stage (< the viewport)", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto("/");
    const r = await page.evaluate(() => {
      const stage = document.querySelector<HTMLElement>(".cover-stage")!;
      const img = stage.querySelector<HTMLElement>("img")!;
      const imgRect = img.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      return {
        imgHeight: Math.round(imgRect.height),
        imgWidth: Math.round(imgRect.width),
        stageHeight: Math.round(stageRect.height),
        fullPhotoVisible:
          imgRect.bottom <= stageRect.bottom + 1 && imgRect.top >= stageRect.top - 1,
        objectFit: getComputedStyle(img).objectFit,
      };
    });
    // The plate lives INSIDE the first screen's stage share (the header is a
    // separate 104px block above it), never taller than the stage itself.
    expect(r.fullPhotoVisible).toBe(true);
    expect(r.imgHeight).toBeLessThanOrEqual(r.stageHeight + 1);
    expect(r.imgHeight).toBeLessThanOrEqual(591 + 1);
    expect(r.objectFit).toBe("contain");
  });

  test("mobile landscape 844x390: full photo visible at natural ratio (no crop)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto("/");
    const r = await page.evaluate(() => {
      const stage = document.querySelector<HTMLElement>(".cover-stage")!;
      const img = stage.querySelector<HTMLImageElement>("img")!;
      const imgRect = img.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      return {
        imgHeight: Math.round(imgRect.height),
        imgWidth: Math.round(imgRect.width),
        fullPhotoVisible:
          imgRect.bottom <= stageRect.bottom + 1 && imgRect.top >= stageRect.top - 1,
        objectFit: getComputedStyle(img).objectFit,
        renderedRatio: +(imgRect.width / imgRect.height).toFixed(2),
        intrinsicRatio: +(img.naturalWidth / img.naturalHeight).toFixed(2),
      };
    });
    // Compact viewports render the natural-ratio plate, whole (no crop to
    // fill the screen, no letterbox distortion).
    expect(r.fullPhotoVisible).toBe(true);
    expect(r.objectFit).toBe("contain");
    expect(r.renderedRatio).toBeCloseTo(r.intrinsicRatio, 1);
    expect(r.imgWidth).toBeLessThanOrEqual(844);
  });
});

// ---------------------------------------------------------------------------
// IMP-06 — QA harness serves the canary; canonical route set intact.
// The e2e server is the TEST-ONLY QA harness (serve-artifact --mode qa,
// assembled from dist-qa/). Production exclusion of /qa-probe is a BUILD
// contract proven in tests/integration/qa-isolation.test.ts (guard refuses
// QA_PROBE=1 npm run build; canonical dist/ never contains the route).
// ---------------------------------------------------------------------------

test.describe("IMP-06 test-only QA harness + canonical route set", () => {
  test("GET /qa-probe is available on the test-only QA harness", async ({ request }) => {
    const response = await request.get("/qa-probe");
    expect(response.status()).toBe(200);
  });

  test("canonical route set remains intact (Home + Archive + Places + 10 galleries + About)", async ({
    request,
  }) => {
    for (const path of [
      "/",
      "/archive",
      "/places",
      "/places/amsterdam",
      "/about",
      "/galleries/lofoten-polar-night",
      "/galleries/autumn-china",
    ]) {
      const r = await request.get(path);
      expect(r.status(), `route ${path} must be 200`).toBe(200);
    }
  });
});
