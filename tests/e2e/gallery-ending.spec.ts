// The frozen ending (G7 + RUNTIME §4) in the immersive voice
// (docs/IMMERSIVE_VIEWING_SPEC §7): pause, catalogue structure, serif Next.
import { expect, test } from "@playwright/test";
import { DESKTOP_VIEWPORT, MOBILE_VIEWPORT } from "../support/viewports.mjs";
import { waitRevealsSettled } from "../support/reveals.mjs";

test.describe("ending — standard variant (desktop)", () => {
  test.use({ viewport: DESKTOP_VIEWPORT });

  test("end pause 168px between last photo (or caption) and End label", async ({ page }) => {
    await page.goto("/galleries/lofoten-polar-night");
    await waitRevealsSettled(page);
    const pause = await page.evaluate(() => {
      const figures = document.querySelectorAll<HTMLElement>(".gallery-figure");
      const last = figures[figures.length - 1]!;
      const label = document.querySelector<HTMLElement>("[data-end-label]")!;
      return Math.round(label.getBoundingClientRect().top - last.getBoundingClientRect().bottom);
    });
    expect(pause).toBe(168);
  });

  test("standard variant renders exactly the three-line structure with a native Next link", async ({
    page,
  }) => {
    await page.goto("/galleries/lofoten-polar-night");
    await waitRevealsSettled(page);
    const structure = await page.evaluate(() => {
      const block = document.querySelector<HTMLElement>("[data-gallery-continuation]")!;
      return {
        endLabel: block.querySelector("[data-end-label]")?.textContent?.trim(),
        nextLinks: Array.from(block.querySelectorAll("a.next-title")).map((a) => ({
          href: a.getAttribute("href"),
          text: a.textContent?.trim(),
        })),
        originLinks: Array.from(block.querySelectorAll("a.back-to-origin, a.origin-link")).map(
          (a) => a.getAttribute("href"),
        ),
        imgs: block.querySelectorAll("img").length,
        buttons: block.querySelectorAll("button").length,
        arrows: /[→←›‾‹]/.test(block.textContent ?? ""),
      };
    });
    expect(structure.endLabel).toBe("End of Lofoten, Polar Night");
    expect(structure.nextLinks).toEqual([
      { href: "/galleries/south-china-summer", text: "Next Gallery — South China, Summer" },
    ]);
    expect(structure.originLinks).toEqual(["/archive"]);
    expect(structure.imgs).toBe(0);
    expect(structure.buttons).toBe(0);
    expect(structure.arrows).toBe(false);
  });

  test("Next title uses the serif display role on the immersive step", async ({ page }) => {
    await page.goto("/galleries/lofoten-polar-night");
    const m = await page.evaluate(() => {
      const next = document.querySelector<HTMLElement>("a.next-title")!;
      const s = getComputedStyle(next);
      return { size: parseFloat(s.fontSize), weight: s.fontWeight, family: s.fontFamily };
    });
    // Immersive section step: clamp(1.6rem, 2.4vw + 0.4rem, 2.4rem) → 2.4rem
    // (38.4px) at 1440. The Swiss 28px sans title is gone.
    expect(m.size).toBeCloseTo(38.4, 1);
    expect(Number(m.weight)).toBe(400);
    expect(m.family).toContain("Source Serif 4");
  });

  test("continuation→footer gap 96px (XXL)", async ({ page }) => {
    await page.goto("/galleries/lofoten-polar-night");
    const gap = await page.evaluate(() => {
      const block = document.querySelector<HTMLElement>("[data-gallery-continuation]")!;
      const footer = document.querySelector<HTMLElement>("footer")!;
      return Math.round(footer.getBoundingClientRect().top - block.getBoundingClientRect().bottom);
    });
    expect(gap).toBe(96);
  });
});

test.describe("ending — mobile", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test("end pause 112px mobile; Next title on the small end of the step", async ({ page }) => {
    await page.goto("/galleries/lofoten-polar-night");
    await waitRevealsSettled(page);
    const m = await page.evaluate(() => {
      const figures = document.querySelectorAll<HTMLElement>(".gallery-figure");
      const last = figures[figures.length - 1]!;
      const label = document.querySelector<HTMLElement>("[data-end-label]")!;
      const next = document.querySelector<HTMLElement>("a.next-title")!;
      return {
        pause: Math.round(label.getBoundingClientRect().top - last.getBoundingClientRect().bottom),
        nextSize: parseFloat(getComputedStyle(next).fontSize),
      };
    });
    expect(m.pause).toBe(112);
    // clamp() lower bound 1.6rem at 390 (was 22px Swiss).
    expect(m.nextSize).toBeCloseTo(25.6, 1);
  });
});

test.describe("ending — no-next variant", () => {
  test.use({ viewport: DESKTOP_VIEWPORT });

  // NOTE: the real archive corpus chains every published gallery
  // (next_gallery_id set on all 13), so the no-next ENDING variant has no
  // live route to exercise here. The variant markup/behavior remains
  // covered by GalleryContinuation's unit tests; recorded as a corpus fact
  // in the redesign verification report.

  test("direct entry (no referrer) renders the ending with the static fallback", async ({
    request,
  }) => {
    const response = await request.get("/galleries/lofoten-polar-night");
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain("data-gallery-continuation");
    expect(body).toContain("/galleries/south-china-summer");
  });
});
