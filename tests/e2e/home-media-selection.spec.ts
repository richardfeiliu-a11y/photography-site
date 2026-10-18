// R4 round4 (T6) — the Home page must consume the resources its layout
// actually needs (re-anchored on the immersive cover + index strip, 2026-10-18).
//
// The reconciliation plan (docs/reports/plan-r4-round3-reconciliation-
// 2026-09-14.md §3 J07/J08/J09, §4 T6) requires:
//   - Home cards declare their REAL slot width (the shared 33vw default
//     described a ~475px slot while the real slot differed, so the browser
//     selected a rung the layout never used);
//   - the cover consumes the manifest's larger rungs (the card cap ended the
//     ladder at w1280, so a 1440px stage could never fetch more);
//   - the first preload set matches the rendered source and exactly one image
//     is high priority;
//   - the Archive row ladder stays capped at 1280 (no site-wide ladder bump).
import { expect, test } from "@playwright/test";

const rungWidths = (srcset: string | null) =>
  (srcset ?? "")
    .split(",")
    .map((part) => Number((/(\d+)w$/.exec(part.trim()) ?? [])[1] ?? 0))
    .filter((value) => value > 0);

// Derivative URLs carry the rung as `-w<width>-<hash>.<ext>`.
const chosenRung = (currentSrc: string | null | undefined) =>
  Number(/-w(\d+)-/.exec(currentSrc ?? "")?.[1] ?? 0);

/** Walk the horizontal strip so every lazy card cover loads. */
async function walkStrip(page: import("@playwright/test").Page): Promise<void> {
  await page.evaluate(async () => {
    const track = document.querySelector<HTMLElement>(".strip")!;
    const step = Math.max(200, Math.floor(track.clientWidth * 0.6));
    for (let x = 0; x <= track.scrollWidth; x += step) {
      track.scrollLeft = x;
      await new Promise((r) => setTimeout(r, 60));
    }
    track.scrollLeft = 0;
  });
}

test.describe("R4 T6: Home cover resource selection", () => {
  test("hero ladder carries the large rungs and the preload matches the source", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    // Wait for the stage image to have actually selected a candidate.
    await page.waitForFunction(
      () =>
        Boolean(
          document.querySelector<HTMLImageElement>(".home-cover-img")?.currentSrc,
        ),
      null,
      { timeout: 30000 },
    );
    const state = await page.evaluate(() => {
      const source = document.querySelector<HTMLSourceElement>(
        ".cover-stage source[type='image/avif']",
      )!;
      const img = document.querySelector<HTMLImageElement>(".home-cover-img")!;
      const preloads = [...document.querySelectorAll<HTMLLinkElement>("link[rel='preload'][as='image']")];
      return {
        ladder: source.getAttribute("srcset"),
        sizes: source.getAttribute("sizes"),
        currentSrc: img.currentSrc,
        displayedWidth: Math.round(img.getBoundingClientRect().width),
        preloadCount: preloads.length,
        preloadLadder: preloads[0]?.getAttribute("imagesrcset") ?? null,
        preloadSizes: preloads[0]?.getAttribute("imagesizes") ?? null,
        highPriorityImgs: document.querySelectorAll("img[fetchpriority='high']").length,
      };
    });

    const ladder = rungWidths(state.ladder);
    expect(ladder.length).toBeGreaterThan(4);
    expect(Math.max(...ladder), "the cover must be able to consume a large rung").toBeGreaterThanOrEqual(
      2560,
    );
    // The chosen candidate covers the rendered slot (no visible upscaling).
    expect(chosenRung(state.currentSrc)).toBeGreaterThanOrEqual(state.displayedWidth);
    // One preload, describing the SAME candidate set as the rendered source.
    expect(state.preloadCount).toBe(1);
    expect(rungWidths(state.preloadLadder)).toEqual(ladder);
    expect(state.preloadSizes).toBe(state.sizes);
    expect(state.highPriorityImgs, "exactly one high-priority opening image").toBe(1);
  });

  test("at DPR2 the hero still consumes a rung at or above its rendered width", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    try {
      const page = await context.newPage();
      await page.goto("/");
      await page.waitForFunction(
        () =>
          Boolean(
            document.querySelector<HTMLImageElement>(".home-cover-img")?.currentSrc,
          ),
        null,
        { timeout: 30000 },
      );
      const state = await page.evaluate(() => {
        const img = document.querySelector<HTMLImageElement>(".home-cover-img")!;
        return {
          currentSrc: img.currentSrc,
          displayedWidth: Math.round(img.getBoundingClientRect().width),
        };
      });
      expect(chosenRung(state.currentSrc)).toBeGreaterThanOrEqual(state.displayedWidth);
    } finally {
      await context.close();
    }
  });
});

test.describe("R4 T6: Home index-strip card sizes", () => {
  test("each card's declared sizes describe its real slot and select at least that rung", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await walkStrip(page);
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll<HTMLImageElement>(".strip .gallery-card img")].every(
          (img) => img.currentSrc.length > 0,
        ),
      null,
      { timeout: 30000 },
    );
    const cards = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>(".strip .gallery-card")].map((card, i) => {
        const img = card.querySelector<HTMLImageElement>("img")!;
        const source = card.querySelector<HTMLSourceElement>("source[type='image/avif']")!;
        const slot = img.getBoundingClientRect();
        return {
          i,
          declaredSizes: img.getAttribute("sizes"),
          ladder: source.getAttribute("srcset"),
          currentSrc: img.currentSrc,
          displayedWidth: Math.round(slot.width),
        };
      }),
    );
    expect(cards.length).toBe(12);

    for (const card of cards) {
      // The declared sizes expression must describe the REAL slot width: the
      // strip track (clamp(230px, 24vw, 330px)), not a column-grid default.
      expect(card.declaredSizes, "card declares an explicit sizes").toBeTruthy();
      expect(card.declaredSizes, "desktop branch is the strip track clamp").toContain(
        "clamp(230px, 24vw, 330px)",
      );
      expect(chosenRung(card.currentSrc), `card ${card.i} rung covers its ${card.displayedWidth}px slot`)
        .toBeGreaterThanOrEqual(card.displayedWidth);
      // The ladder is the card ladder (480..1280), not the full stage ladder.
      expect(Math.max(...rungWidths(card.ladder))).toBeLessThanOrEqual(1280);
    }

    // Every strip card shares one sizes expression.
    const declarations = new Set(cards.map((c) => c.declaredSizes));
    expect(declarations.size).toBe(1);
  });

  test("at DPR2 cards still never render a visible upscale", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    try {
      const page = await context.newPage();
      await page.goto("/");
      await walkStrip(page);
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll<HTMLImageElement>(".strip .gallery-card img")].every(
            (img) => img.currentSrc.length > 0,
          ),
        null,
        { timeout: 30000 },
      );
      const rows = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>(".strip .gallery-card")].map((card) => {
          const img = card.querySelector<HTMLImageElement>("img")!;
          return {
            currentSrc: img.currentSrc,
            displayedWidth: Math.round(img.getBoundingClientRect().width),
          };
        }),
      );
      for (const row of rows) {
        expect(chosenRung(row.currentSrc)).toBeGreaterThanOrEqual(row.displayedWidth);
      }
    } finally {
      await context.close();
    }
  });
});

test.describe("R4 T6: Archive row ladder is unchanged", () => {
  test("rows stay on the 480..1280 discovery ladder", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/archive");
    const rows = await page.evaluate(() =>
      [...document.querySelectorAll(".arow")].slice(0, 4).map((row) => ({
        ladder: row.querySelector("source[type='image/avif']")?.getAttribute("srcset") ?? "",
        sizes: row.querySelector("img")?.getAttribute("sizes") ?? "",
      })),
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const ladder = rungWidths(row.ladder);
      expect(ladder[0]).toBe(480);
      expect(Math.max(...ladder)).toBeLessThanOrEqual(1280);
      // The row thumbnail declares its own real 110px track.
      expect(row.sizes).toBe("110px");
    }
  });
});
