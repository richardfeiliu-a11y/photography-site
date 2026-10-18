// R4 perf rework — below-the-fold gallery media gating.
//
// The first gallery photo renders eagerly (route LCP). Every later photo is an
// aspect-ratio-reserved slot with the real <picture> in <noscript>; the
// media-slots hydrator injects it when the slot gets within ~600px of the
// viewport. This spec pins: initial non-fetch, reserved geometry, scroll
// hydration with no broken images, the no-JS full-sequence fallback, and the
// Archive card srcset fix (w480..w1280, not the cover-only 1280+ ladder).
import { expect, test } from "@playwright/test";

test.describe("R4: gallery media slot gating", () => {
  test("initial JS load keeps later pictures out of the DOM and reserves their frame", async ({
    page,
  }) => {
    await page.goto("/galleries/lofoten-polar-night");
    const state = await page.evaluate(() => {
      const figures = Array.from(document.querySelectorAll<HTMLElement>(".gallery-figure"));
      return figures.map((fig, i) => {
        const slot = fig.querySelector<HTMLElement>(".media-slot");
        const img = fig.querySelector("img");
        const noscript = fig.querySelector("noscript");
        const rect = (slot ?? img)!.getBoundingClientRect();
        return {
          i,
          liveImg: img !== null,
          slot: slot !== null,
          noscript: noscript !== null,
          reservedH: Math.round(rect.height),
          ratioVar: fig.style.getPropertyValue("--media-ar"),
        };
      });
    });
    expect(state).toHaveLength(11);
    // Only the photos inside the 600px proximity window are live images before
    // any scroll: that is figure 0, optionally its neighbours (the sibling
    // test below documents the same look-ahead). Pin the SHAPE — a contiguous
    // prefix from 0 bounded by the window — instead of racing the
    // IntersectionObserver callback, which made "exactly [0]" flaky.
    const liveIndices = state.filter((s) => s.liveImg).map((s) => s.i);
    expect(liveIndices[0], "the first photo renders eagerly").toBe(0);
    expect(liveIndices).toEqual([...liveIndices.keys()].map((k) => k));
    const lastLive = liveIndices[liveIndices.length - 1]!;
    expect(lastLive, "hydration look-ahead stays within the 600px window").toBeLessThanOrEqual(2);
    // The un-hydrated tail keeps a reserved frame + the noscript source, i.e.
    // the later pictures really are NOT in the DOM yet.
    const gated = state.filter((s) => s.i > lastLive);
    expect(gated.length, "the sequence stays gated beyond the look-ahead window").toBeGreaterThan(6);
    for (const s of gated) {
      expect(s.slot, `figure ${s.i} slot`).toBe(true);
      expect(s.noscript, `figure ${s.i} noscript`).toBe(true);
      expect(s.reservedH, `figure ${s.i} reserved height`).toBeGreaterThan(100);
      expect(s.ratioVar, `figure ${s.i} aspect var`).toMatch(/^\d+ \/ \d+$/);
    }
    // A hydrated figure keeps its slot (the media space) and has consumed the
    // noscript fallback into it (R4 T1/T3: one media space per figure). The
    // eager FIRST photo is the exception by design: it is the route LCP image,
    // so it renders a live <picture> with no reservation wrapper at all.
    const first = state[0]!;
    expect(first.liveImg, "the eager first photo is live").toBe(true);
    expect(first.slot, "the eager first photo needs no reservation wrapper").toBe(false);
    expect(first.noscript).toBe(false);
    expect(first.reservedH, "the eager first photo still occupies real space").toBeGreaterThan(100);
    for (const s of state.filter((f) => f.i > 0 && f.i <= lastLive)) {
      expect(s.slot, `hydrated figure ${s.i} keeps its slot`).toBe(true);
      expect(s.noscript, `hydrated figure ${s.i} consumed its noscript`).toBe(false);
    }
  });

  test("initial load does not request later full-size media; scrolling hydrates all", async ({
    page,
  }) => {
    const requested = new Set<number>();
    page.on("request", (req) => {
      const m = req.url().match(/p_lofoten_polar_night_(\d{3})-avif-w(\d+)/);
      if (m) requested.add(Number(m[1]));
    });
    await page.goto("/galleries/lofoten-polar-night");
    await page.waitForLoadState("networkidle");
    // First photo only; the hydrator look-ahead (600px) may additionally pull
    // photo 2 on this tall-first-photo layout, never the rest of the sequence.
    const initial = [...requested].sort((a, b) => a - b);
    expect(initial.length).toBeGreaterThan(0);
    expect(initial[0]).toBe(1);
    expect(initial[initial.length - 1]).toBeLessThanOrEqual(2);

    // Walk to the end: every remaining photo hydrates and decodes.
    await page.evaluate(async () => {
      for (let y = 0; y <= document.body.scrollHeight; y += 500) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 30));
      }
    });
    await expect
      .poll(
        async () =>
          page.evaluate(
            () =>
              [...document.querySelectorAll<HTMLImageElement>(".gallery-figure img")].filter(
                (img) => img.naturalWidth === 0,
              ).length,
          ),
        { timeout: 20000 },
      )
      .toBe(0);
    const figures = await page.locator(".gallery-figure").count();
    const imgs = await page.locator(".gallery-figure img").count();
    expect(imgs).toBe(figures);
    expect([...requested].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 11 }, (_v, i) => i + 1),
    );
  });

  test("deterministic hydrate hook fills every slot once (idempotent)", async ({ page }) => {
    await page.goto("/galleries/lofoten-polar-night");
    await page.evaluate(() => {
      window.__hydrateMediaSlots?.();
      window.__hydrateMediaSlots?.();
    });
    await expect(page.locator(".gallery-figure img")).toHaveCount(11);
    // Exactly one live img per figure, and the consumed <noscript> fallback is
    // gone — it is nested INSIDE the slot since R4 round4 (T3), so leaving it
    // would keep a second latent picture per figure.
    await expect(page.locator(".gallery-figure noscript")).toHaveCount(0);
    const dupes = await page.evaluate(
      () =>
        [...document.querySelectorAll(".gallery-figure")].filter(
          (f) => f.querySelectorAll("img").length !== 1,
        ).length,
    );
    expect(dupes).toBe(0);
  });

  // R4 T3: the two failure-recovery paths must be proven on their OWN real
  // behaviour — not by calling the fillAll test hook.
  test("no IntersectionObserver ⇒ every slot hydrates without any scroll", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await context.addInitScript(() => {
      // The hydrator branches on `!("IntersectionObserver" in window)`, so the
      // property must be GONE, not merely undefined.
      Object.defineProperty(window, "IntersectionObserver", {
        configurable: true,
        writable: true,
        value: undefined,
      });
      Reflect.deleteProperty(window, "IntersectionObserver");
    });
    try {
      const page = await context.newPage();
      await page.goto("/galleries/lofoten-polar-night");
      expect(await page.evaluate(() => "IntersectionObserver" in window)).toBe(false);
      await expect(page.locator(".gallery-figure img")).toHaveCount(11);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      // One media space per figure: the fallback must not leave the noscript
      // picture behind next to the hydrated one.
      await expect(page.locator(".gallery-figure noscript")).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test("print (beforeprint) hydrates every slot regardless of scroll position", async ({ page }) => {
    await page.goto("/galleries/lofoten-polar-night");
    const before = await page.locator(".gallery-figure img").count();
    expect(before, "the sequence starts gated").toBeLessThan(11);
    await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
    await expect(page.locator(".gallery-figure img")).toHaveCount(11);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
});

test.describe("R4: Archive rows use small-rung discovery srcsets", () => {
  test("row avif/jpeg srcsets run 480w..1280w (no 1600w+ cover ladder)", async ({ page }) => {
    await page.goto("/archive");
    const report = await page.evaluate(() => {
      // The archive index is a flat row list (immersive port): the thumbnail
      // ladder is the card-sized discovery ladder, still 480..1280.
      const cards = [...document.querySelectorAll(".arow picture")];
      const widths = (el: Element, selector: string) => {
        const node = el.querySelector(selector);
        if (!node) return null;
        return (node.getAttribute("srcset") || "")
          .split(",")
          .map((part) => Number((part.trim().match(/(\d+)w$/) || [])[1] || 0));
      };
      return cards.slice(0, 3).map((pic) => ({
        avif: widths(pic, 'source[type="image/avif"]'),
        jpeg: widths(pic, "img"),
      }));
    });
    expect(report.length).toBeGreaterThan(0);
    for (const card of report) {
      expect(card.avif![0]).toBe(480);
      expect(card.avif![card.avif!.length - 1]).toBe(1280);
      expect(card.jpeg![0]).toBe(480);
      expect(card.jpeg![card.jpeg!.length - 1]).toBe(1280);
      for (const w of [...card.avif!, ...card.jpeg!]) {
        expect(w).toBeLessThanOrEqual(1280);
      }
    }
  });
});
