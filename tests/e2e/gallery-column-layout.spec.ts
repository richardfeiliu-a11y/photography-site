// Gallery layout — ONE plate measure (immersive spec §5).
//
// The desktop exhibition rail/right track is long gone, and so is the 1100px
// cap: the sequence column IS the plate width (content-max minus the stepped
// edge insets), the aspect ratio sets the height, the ending follows the last
// photo, and without JS every photo still occupies exactly one media space.
import { expect, test } from "@playwright/test";
import { settleGalleryMedia } from "../support/media-slots";

const DESKTOP_WIDTHS = [1200, 1280, 1440] as const;

async function columnReport(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const page_ = document.querySelector<HTMLElement>(".gallery-page")!;
    const sequence = document.querySelector<HTMLElement>(".gallery-sequence")!;
    const figures = [...document.querySelectorAll<HTMLElement>(".gallery-figure")];
    const figure = figures[Math.floor(figures.length / 2)]!.getBoundingClientRect();
    const last = figures.at(-1)!.getBoundingClientRect();
    const ending = document
      .querySelector<HTMLElement>("[data-gallery-continuation]")!
      .getBoundingClientRect();
    const pageRect = page_.getBoundingClientRect();
    const pageStyle = getComputedStyle(page_);
    const inset = Number.parseFloat(pageStyle.paddingLeft);
    const abs = (r: DOMRect) => r.bottom + window.scrollY;
    return {
      figureWidth: Math.round(figure.width),
      sequenceWidth: Math.round(sequence.getBoundingClientRect().width),
      columnWidth: Math.round(pageRect.width - 2 * inset),
      // The plate starts on the page column's own left edge (one measure, no
      // centering offset, no narrower rail column).
      plateOnColumnEdge: Math.abs(figure.left - sequence.getBoundingClientRect().left) <= 2,
      railCount: document.querySelectorAll("[data-exhibit-rail]").length,
      lastFigureBottom: Math.round(abs(last)),
      endingTop: Math.round(ending.top + window.scrollY),
      horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
}

test.describe("single plate measure (JS)", () => {
  for (const width of DESKTOP_WIDTHS) {
    test(`@${width}: the plate is the column width, no rail, ending after last photo`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/galleries/netherlands");
      const r = await columnReport(page);
      expect(r.railCount).toBe(0);
      // No 1100px cap: at every desktop width the plate is wider than the
      // retired cap and exactly the column's measure.
      expect(r.figureWidth).toBeGreaterThan(1100);
      expect(r.figureWidth).toBe(r.sequenceWidth);
      expect(r.sequenceWidth).toBe(r.columnWidth);
      expect(r.plateOnColumnEdge, "the sequence starts on the column edge").toBe(true);
      expect(r.endingTop).toBeGreaterThan(r.lastFigureBottom);
      expect(r.horizontalOverflow).toBeLessThanOrEqual(0);
    });
  }

  test("both themes keep the same single-column geometry", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const theme of ["light", "dark"] as const) {
      await page.addInitScript((value) => {
        localStorage.setItem("photography.appearance", value);
      }, theme);
      await page.goto("/galleries/netherlands");
      const r = await columnReport(page);
      expect(r.railCount, `${theme}: rail absent`).toBe(0);
      expect(r.figureWidth, `${theme}: plate is the column measure`).toBe(1288);
      expect(r.endingTop, `${theme}: ending after last photo`).toBeGreaterThan(r.lastFigureBottom);
      await page.evaluate(() => localStorage.removeItem("photography.appearance"));
    }
  });

  test("portrait plates are never height-capped (the whole photograph shows)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/galleries/iceland");
    // Below-the-first plates are slots until hydration + decode.
    await settleGalleryMedia(page);
    const portrait = await page.evaluate(() => {
      const figures = [...document.querySelectorAll<HTMLElement>(".gallery-figure")];
      const fig = figures.find((f) => f.classList.contains("is-portrait"))!;
      const img = fig.querySelector<HTMLImageElement>("img")!;
      const r = img.getBoundingClientRect();
      return {
        rendered: +(r.width / r.height).toFixed(2),
        intrinsic: +(img.naturalWidth / img.naturalHeight).toFixed(2),
        maxHeight: getComputedStyle(img).maxHeight,
        height: Math.round(r.height),
      };
    });
    // No crop, no max-height: the plate is as tall as its own ratio demands.
    expect(portrait.maxHeight).toBe("none");
    expect(portrait.rendered).toBeCloseTo(portrait.intrinsic, 1);
    expect(portrait.height).toBeGreaterThan(900);
  });
});

test.describe("gallery without JS", () => {
  test("exactly one media element per figure; plates hold the column measure", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      javaScriptEnabled: false,
    });
    try {
      const page = await context.newPage();
      await page.goto("/galleries/netherlands");
      const rows = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>(".gallery-figure")].map((figure) => ({
          id: figure.id,
          width: Math.round(figure.getBoundingClientRect().width),
          imgs: figure.querySelectorAll("img").length,
          imgWidth: Math.round(figure.querySelector("img")!.getBoundingClientRect().width),
          imgHeight: Math.round(figure.querySelector("img")!.getBoundingClientRect().height),
        })),
      );
      expect(rows.length).toBeGreaterThan(5);
      for (const row of rows) {
        expect(row.imgs, `${row.id} one media element`).toBe(1);
        expect(row.width, `${row.id} plate is the column measure`).toBeGreaterThan(1100);
        expect(row.imgWidth, `${row.id} picture fills the slot exactly`).toBe(row.width);
        expect(row.imgHeight, `${row.id} image has a box`).toBeGreaterThan(50);
      }
    } finally {
      await context.close();
    }
  });

  test("anchor jump without JS still reaches a real photo", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      javaScriptEnabled: false,
    });
    try {
      const page = await context.newPage();
      await page.goto("/galleries/lofoten-polar-night#p_lofoten_polar_night_005");
      const state = await page.evaluate(() => {
        const target = document.querySelector<HTMLElement>(".gallery-figure:target");
        const img = target?.querySelector<HTMLImageElement>("img");
        return {
          hasTarget: target !== null,
          hasImg: Boolean(img),
          complete: Boolean(img?.complete && (img?.naturalWidth ?? 0) > 0),
        };
      });
      expect(state).toEqual({ hasTarget: true, hasImg: true, complete: true });
    } finally {
      await context.close();
    }
  });
});
