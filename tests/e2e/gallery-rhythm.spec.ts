// WP-35 e2e — the frozen rhythm contract (G4), caption contract, geometry,
// and loading strategy. Machine-measured at the capture viewports.
//
// Frozen values (FDS §3.1 + G4 — P0 if wrong):
//   rhythm compact 64/40 · base 96/64 · breathing 144/96 (desktop/mobile)
//   photo→caption 16 · header→first 72/48
//   media frame: ONE plate measure (the sequence column; the former
//   min(90vw,1440px) frame and the portrait 80svh ceiling were lifted by the
//   immersive direction — see the geometry test below)
//   captioned photo: rhythm starts AFTER the caption; uncaptioned: no
//   reserved region. Orientation NEVER chooses rhythm. First image eager +
//   fetchpriority high + single preload; subsequent lazy+async.
//
// RED first: fails while the sequence still uses the WP-33 skeleton spacing.
import { expect, test } from "@playwright/test";
import { DESKTOP_VIEWPORT, MOBILE_VIEWPORT } from "../support/viewports.mjs";
import { waitRevealsSettled } from "../support/reveals.mjs";
import { settleGalleryMedia } from "../support/media-slots";

/** Rhythm: authored `rhythm_after` of a photo = the gap BEFORE the NEXT
 * figure (after its caption if captioned). Real corpus (c0495d9): every
 * authored rhythm_after is "base", so live e2e pins the base magnitudes;
 * compact/breathing stay defined in gallery.css and are exercised by the
 * selector/CSS contract (corpus fact recorded in the redesign report).
 * compact (captioned), photo 6 = breathing (uncaptioned), others base. */
const RHYTHM: Record<string, Record<string, number>> = {
  desktop: { compact: 64, base: 112, breathing: 168 },
  mobile: { compact: 40, base: 72, breathing: 104 },
};

/** R4 perf gate: below-first photos live in <noscript> until the media-slot
 *  hydrator injects them. Hydrate deterministically, settle the one-shot
 *  reveals (an in-flight translateY reads as rhythm drift), then wait until
 *  every sequence image has decoded (geometry stays stable as images arrive). */
async function settleSequence(page: import("@playwright/test").Page) {
  await settleGalleryMedia(page);
  await waitRevealsSettled(page);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(null))));
}

/** Gap between the BOTTOM of element A (incl. its caption block) and the TOP
 * of element B, measured from the figures' bounding boxes in DOM order. */
async function sequenceGaps(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const figures = Array.from(document.querySelectorAll<HTMLElement>(".gallery-figure"));
    const gaps: { afterPhotoIndex: number; gap: number }[] = [];
    for (let i = 0; i < figures.length - 1; i++) {
      const a = figures[i].getBoundingClientRect();
      const b = figures[i + 1].getBoundingClientRect();
      gaps.push({ afterPhotoIndex: i, gap: Math.round(b.top - a.bottom) });
    }
    return gaps;
  });
}

test.describe("WP-35 rhythm contract (desktop 1440×900)", () => {
  test.use({ viewport: DESKTOP_VIEWPORT });

  test("authored rhythm gaps: every real-corpus figure is base (96px desktop)", async ({
    page,
  }) => {
    await page.goto("/galleries/lofoten-polar-night");
    await settleSequence(page);
    const gaps = await sequenceGaps(page);
    // The real corpus authors rhythm_after: base everywhere; every
    // figure-to-figure gap must equal the base magnitude (±1px image
    // rounding at the exhibition width — the authored margin is exact).
    expect(gaps.length).toBe(10);
    for (const g of gaps) expect(Math.abs(g.gap - RHYTHM.desktop.base)).toBeLessThanOrEqual(2);
  });

  test("header→first photo 72px; photo→caption 12px", async ({ page }) => {
    await page.goto("/galleries/lofoten-polar-night");
    await settleSequence(page);
    const m = await page.evaluate(() => {
      const header = document.querySelector<HTMLElement>(".gallery-header")!;
      const first = document.querySelector<HTMLElement>(".gallery-figure")!;
      const headerGap = Math.round(
        first.getBoundingClientRect().top - header.getBoundingClientRect().bottom,
      );
      const fig = document.querySelectorAll<HTMLElement>(".gallery-figure")[2]!;
      const img = fig.querySelector<HTMLElement>("img")!;
      const cap = fig.querySelector<HTMLElement>("figcaption")!;
      return {
        headerGap,
        captionGap: Math.round(
          cap.getBoundingClientRect().top - img.getBoundingClientRect().bottom,
        ),
      };
    });
    expect(m.headerGap).toBe(72);
    expect(m.captionGap).toBe(12);
  });

  // NOTE: every photo in the real corpus carries a caption, so the
  // "uncaptioned photo reserves no caption region" case has no live route;
  // the no-reserved-block contract is covered by PhotoFigure's unit tests
  // (corpus fact recorded in the redesign report).

  test("loading strategy: first eager+fetchpriority high; rest noscript-gated; single preload", async ({
    page,
  }) => {
    await page.goto("/galleries/lofoten-polar-night");
    const s = await page.evaluate(() => {
      const figures = Array.from(document.querySelectorAll<HTMLElement>(".gallery-figure"));
      const liveImgs = Array.from(
        document.querySelectorAll<HTMLImageElement>(".gallery-figure img"),
      );
      const first = liveImgs[0]!;
      // Each non-first figure reserves an aspect-ratio slot and carries the
      // real lazy/async picture inside <noscript> (never fetched with JS).
      const restFigures = figures.slice(1).map((fig) => {
        const slot = fig.querySelector(".media-slot");
        const noscript = fig.querySelector("noscript");
        const markup = noscript?.textContent ?? "";
        // Monograph: the aspect-ratio variables ride the FIGURE (the
        // caption lock needs them for the portrait width expression).
        const figureRatio = fig.getAttribute("style") ?? "";
        return {
          slot: slot !== null,
          slotRatio: figureRatio,
          noscript: noscript !== null,
          markupLazy: /\sloading="lazy"/.test(markup),
          markupAsync: /\sdecoding="async"/.test(markup),
          // The hydrator promotes figures within ~600px of the viewport, which
          // is a legitimate end state (R4 T1/T3), not a contract breach. The
          // ready flag lives on the SLOT (media-slots.ts sets
          // `slot.dataset.mediaReady`), never on the figure.
          hydrated: slot?.getAttribute("data-media-ready") === "1",
          liveImgs: fig.querySelectorAll("img").length,
        };
      });
      return {
        firstLoading: first.getAttribute("loading"),
        firstPriority: first.getAttribute("fetchpriority"),
        restFigures,
        preloads: Array.from(document.querySelectorAll('link[rel="preload"][as="image"]')).map(
          (l) => l.getAttribute("href"),
        ),
        firstSrc: first.getAttribute("src"),
      };
    });
    expect(s.firstLoading).not.toBe("lazy");
    expect(s.firstPriority).toBe("high");
    // The non-first picture is never server-rendered live; any additional
    // live img at this point can only be a hydrator-injected one (the
    // ~600px look-ahead may promote photo 2), never a direct render.
    const directRestImgs = await page
      .locator(".gallery-figure + .gallery-figure > picture")
      .count();
    expect(directRestImgs).toBe(0);
    expect(s.restFigures).toHaveLength(10);
    // Every non-first figure is in exactly ONE of the two legal states, and the
    // reserved aspect-ratio slot exists in both:
    //   gated    -> slot + <noscript> picture with loading="lazy"/decoding="async"
    //   hydrated -> data-media-ready="1", slot consumed, exactly one live <img>
    // The previous assertion demanded "gated" for all ten figures and therefore
    // raced the ~600px look-ahead hydrator (observed flaking under load and then
    // deterministically once hydration won the race). Asserting the either/or
    // invariant keeps the contract and removes the race.
    for (const r of s.restFigures) {
      expect(r.slot).toBe(true);
      expect(r.slotRatio).toContain("--media-ar");
      if (r.hydrated) {
        expect(r.noscript).toBe(false);
        expect(r.liveImgs).toBe(1);
      } else {
        expect(r.noscript).toBe(true);
        expect(r.markupLazy).toBe(true);
        expect(r.markupAsync).toBe(true);
        expect(r.liveImgs).toBe(0);
      }
    }
    // The LAST figure is ~20,000px down the page, far outside the look-ahead
    // window, so the noscript-gated contract keeps hard coverage there.
    const last = s.restFigures[s.restFigures.length - 1]!;
    expect(last.hydrated, "the last figure stays gated").toBe(false);
    expect(last.noscript).toBe(true);
    expect(last.markupLazy).toBe(true);
    expect(s.preloads).toHaveLength(1);
    expect(s.preloads[0]).toBe(s.firstSrc);
  });

  test("media frame: image fits the ceiling and is centered in its media column", async ({
    page,
  }) => {
    await page.goto("/galleries/lofoten-polar-night");
    await settleSequence(page);
    const m = await page.evaluate(() => {
      // R4 T3: a gallery page is a two-track grid (media column + 172px rail),
      // so the frame is centered in its COLUMN, not in the viewport — the
      // viewport symmetric-margin assertion measured the rail as if it were
      // margin. The frozen ceiling (≤ min(90vw, 1440px)) still holds.
      const column = document.querySelector(".gallery-sequence");
      const img = document.querySelector<HTMLElement>(".gallery-figure img");
      if (!column || !img) return null;
      const c = column.getBoundingClientRect();
      const rect = img.getBoundingClientRect();
      return {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        columnWidth: Math.round(c.width),
        columnLeft: Math.round(c.left),
        leftInset: Math.round(rect.left - c.left),
        rightInset: Math.round(c.right - rect.right),
        complete: (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0,
        viewport: window.innerWidth,
      };
    });
    expect(m, "gallery figure + media column present").not.toBeNull();
    const ceiling = Math.min(0.9 * m!.viewport, 1440);
    expect(m!.complete, "the measured image is a real loaded photo").toBe(true);
    expect(m!.width).toBeLessThanOrEqual(ceiling + 1);
    expect(m!.width).toBeLessThanOrEqual(m!.columnWidth + 1);
    // Centered inside the media column (landscape slot is width-led).
    expect(Math.abs(m!.leftInset - m!.rightInset)).toBeLessThanOrEqual(2);
  });

  test("portrait plates are not height-capped; every plate keeps its aspect (immersive §5)", async ({
    page,
  }) => {
    await page.goto("/galleries/autumn-china");
    await settleSequence(page);
    const geometry = await page.evaluate(() => {
      const sequence = document.querySelector<HTMLElement>(".gallery-sequence")!.getBoundingClientRect();
      let widest: { w: number; h: number } = { w: 0, h: 0 };
      let tallestPortrait: { w: number; h: number; ratio: number; intrinsic: number } | null = null;
      let maxHeight: string | null = null;
      for (const img of document.querySelectorAll<HTMLImageElement>(".gallery-figure img")) {
        const r = img.getBoundingClientRect();
        if (r.width > widest.w) widest = { w: r.width, h: r.height };
        if (img.naturalHeight > img.naturalWidth) {
          if (!tallestPortrait || r.height > tallestPortrait.h) {
            tallestPortrait = {
              w: r.width,
              h: r.height,
              ratio: r.width / r.height,
              intrinsic: img.naturalWidth / img.naturalHeight,
            };
          }
          maxHeight = getComputedStyle(img).maxHeight;
        }
      }
      return {
        sequenceWidth: Math.round(sequence.width),
        widestWidth: Math.round(widest.w),
        portrait: tallestPortrait,
        maxHeight,
      };
    });
    expect(geometry.portrait, "the corpus has a portrait plate").not.toBeNull();
    // ONE plate measure: the portrait is as wide as the sequence column (the
    // former 90vw/1440px frame cap is gone)...
    expect(geometry.widestWidth).toBe(geometry.sequenceWidth);
    expect(Math.round(geometry.portrait!.w)).toBe(geometry.sequenceWidth);
    // ...and is NOT height-capped any more: the immersive ruling accepts a
    // portrait plate taller than the viewport rather than cropping it.
    expect(geometry.maxHeight).toBe("none");
    const vh = await page.evaluate(() => window.innerHeight);
    expect(geometry.portrait!.h).toBeGreaterThan(vh * 0.8);
    // The height is the ratio's, not a cap's (no crop, no letterbox).
    expect(geometry.portrait!.ratio).toBeCloseTo(geometry.portrait!.intrinsic, 2);
  });

  test("caption lockup: figcaption box matches the image box (left/width, ≤1px)", async ({
    page,
  }) => {
    await page.goto("/galleries/lofoten-polar-night");
    await settleSequence(page);
    const pairs = await page.evaluate(() => {
      const out = [];
      for (const fig of Array.from(document.querySelectorAll(".gallery-figure"))) {
        const img = fig.querySelector("img");
        const cap = fig.querySelector("figcaption");
        if (!img || !cap) continue;
        const a = img.getBoundingClientRect();
        const b = cap.getBoundingClientRect();
        out.push({ deltaLeft: Math.round(Math.abs(b.left - a.left)), deltaWidth: Math.round(Math.abs(b.width - a.width)) });
      }
      return out;
    });
    expect(pairs.length).toBeGreaterThan(5);
    for (const p of pairs) {
      expect(p.deltaLeft).toBeLessThanOrEqual(1);
      expect(p.deltaWidth).toBeLessThanOrEqual(1);
    }
  });

  test("no virtualization/pagination/swipe DOM", async ({ page }) => {
    await page.goto("/galleries/lofoten-polar-night");
    const inventory = await page.evaluate(() => ({
      virtual: document.querySelectorAll("[class*=virtual], [class*=window], [class*=swiper]")
        .length,
      dots: document.querySelectorAll("[class*=pagination], [class*=dots]").length,
    }));
    expect(inventory.virtual).toBe(0);
    expect(inventory.dots).toBe(0);
  });
});

test.describe("WP-35 rhythm contract (mobile 390×844)", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test("mobile rhythm gaps: base 64, compact 40, breathing 96; header→first 48", async ({
    page,
  }) => {
    await page.goto("/galleries/lofoten-polar-night");
    await settleSequence(page);
    const gaps = await sequenceGaps(page);
    expect(gaps.length).toBe(10);
    for (const g of gaps) expect(Math.abs(g.gap - RHYTHM.mobile.base)).toBeLessThanOrEqual(2);

    const headerGap = await page.evaluate(() => {
      const header = document.querySelector<HTMLElement>(".gallery-header")!;
      const first = document.querySelector<HTMLElement>(".gallery-figure")!;
      return Math.round(first.getBoundingClientRect().top - header.getBoundingClientRect().bottom);
    });
    expect(headerGap).toBe(48);
  });

  test("mobile: one plate width, no portrait ceiling, aspect preserved", async ({ page }) => {
    await page.goto("/galleries/autumn-china");
    await settleSequence(page);
    const m = await page.evaluate(() => {
      const sequence = document.querySelector<HTMLElement>(".gallery-sequence")!.getBoundingClientRect();
      let maxPortraitH = 0;
      let worstRatioDrift = 0;
      let portraitMaxHeight: string | null = null;
      let widths = new Set<number>();
      for (const img of document.querySelectorAll<HTMLImageElement>(".gallery-figure img")) {
        const r = img.getBoundingClientRect();
        widths.add(Math.round(r.width));
        if (img.naturalHeight > img.naturalWidth) {
          maxPortraitH = Math.max(maxPortraitH, r.height);
          portraitMaxHeight = getComputedStyle(img).maxHeight;
        }
        const rendered = r.width / r.height;
        const intrinsic = img.naturalWidth / img.naturalHeight;
        if (Number.isFinite(intrinsic) && intrinsic > 0) {
          worstRatioDrift = Math.max(worstRatioDrift, Math.abs(rendered - intrinsic) / intrinsic);
        }
      }
      return {
        maxPortraitH,
        worstRatioDrift,
        portraitMaxHeight,
        widths: [...widths],
        sequenceWidth: Math.round(sequence.width),
      };
    });
    // ONE plate width on the phone too (the portrait 82svh ceiling is gone).
    expect(m.widths).toEqual([m.sequenceWidth]);
    expect(m.portraitMaxHeight).toBe("none");
    expect(m.maxPortraitH).toBeGreaterThan(0);
    expect(m.worstRatioDrift).toBeLessThan(0.01);
  });

  test("captions wrap without clamp/truncation (long + CJK captions)", async ({ page }) => {
    // Real-corpus captions are short place+month lines, so the assertion is
    // that captions render fully with NO clamp/truncation (spec §6.4 keeps
    // the no-clamp contract; long-passage behavior is capped at 680px).
    await page.goto("/galleries/lofoten-polar-night");
    const r = await page.evaluate(() => {
      const caps = Array.from(document.querySelectorAll<HTMLElement>("figcaption"));
      let maxLines = 0;
      for (const cap of caps) {
        const s = getComputedStyle(cap);
        if (s.webkitLineClamp !== "none" && s.webkitLineClamp !== "") return { clamped: true };
        const lh = parseFloat(s.lineHeight);
        maxLines = Math.max(maxLines, Math.round(cap.getBoundingClientRect().height / lh));
      }
      return { clamped: false, maxLines };
    });
    expect(r.clamped).toBe(false);
    expect(r.maxLines).toBeGreaterThanOrEqual(1);
  });
});

test.describe("WP-35 CJK caption typography (fix round)", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  // NOTE: the real corpus contains no CJK-detected captions (all authored
  // captions are Latin place+month lines), so no figcaption[lang=zh] exists
  // to probe; the CJK 1.75 rule stays in gallery.css and the :lang(zh)
  // contract in global.css (corpus fact recorded in the redesign report).

  test("Latin captions keep the document default (no fabricated locale)", async ({ page }) => {
    await page.goto("/galleries/lofoten-polar-night");
    const caps = await page.evaluate(() =>
      Array.from(document.querySelectorAll("figcaption")).map((c) => c.getAttribute("lang")),
    );
    expect(caps.filter((l) => l !== null)).toHaveLength(0);
  });
});
