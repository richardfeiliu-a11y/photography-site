// Immersive readability contract (ACCESSIBILITY_VISUAL_RULES "Contrast",
// docs/IMMERSIVE_VIEWING_SPEC §3):
//   - essential text never sits on a photograph (no scrim needed);
//   - lockup/caption text meets the 4.5:1 floor against the page FIELD
//     (per page: the cover's ambient, or the neutral room);
//   - keyboard focus stays visible (≥2px perimeter) through the shell.
//
// The field is OKLCH, so every comparison runs on the browser's own
// oklch→sRGB bytes (tests/support/colors.ts) rather than on the serialized
// computed string.
import { expect, test } from "@playwright/test";
import { bodyBackground, contrastRatio, toSrgb } from "../support/colors";
import { DESKTOP_VIEWPORT, MOBILE_VIEWPORT } from "../support/viewports.mjs";

test.describe("essential text never sits on a photograph", () => {
  for (const vp of [DESKTOP_VIEWPORT, MOBILE_VIEWPORT]) {
    test(`home @${vp.width}: lockup is clear of the plate`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");
      const collisions = await page.evaluate(() => {
        const img = document.querySelector(".home-cover-img")!.getBoundingClientRect();
        const texts = Array.from(
          document.querySelectorAll<HTMLElement>(".cover-title, .cover-meta, .cover-cta"),
        );
        return texts
          .map((el) => el.getBoundingClientRect())
          .filter((r) => r.top < img.bottom - 1 && r.bottom > img.top + 1).length;
      });
      expect(collisions).toBe(0);
    });

    test(`gallery @${vp.width}: captions are clear of their photograph`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/galleries/lofoten-polar-night");
      const collisions = await page.evaluate(() => {
        let bad = 0;
        for (const fig of Array.from(document.querySelectorAll<HTMLElement>(".gallery-figure"))) {
          const img = fig.querySelector("img");
          const cap = fig.querySelector("figcaption");
          if (!img || !cap) continue;
          const i = img.getBoundingClientRect();
          const c = cap.getBoundingClientRect();
          if (c.top < i.bottom - 1) bad++;
        }
        return bad;
      });
      expect(collisions).toBe(0);
    });
  }
});

test.describe("field text contrast", () => {
  for (const theme of ["light", "dark"] as const) {
    test(`${theme}: home lockup text meets its floor on the field`, async ({ page }) => {
      await page.addInitScript(
        ([k, v]) => localStorage.setItem(k!, v!),
        ["photography.appearance", theme] as const,
      );
      await page.goto("/");
      const measured = await page.evaluate(() => ({
        bg: getComputedStyle(document.body).backgroundColor,
        title: getComputedStyle(document.querySelector<HTMLElement>(".cover-title")!).color,
        meta: getComputedStyle(document.querySelector<HTMLElement>(".cover-meta")!).color,
      }));
      const [bgRgb, titleRgb, metaRgb] = await toSrgb(page, [
        measured.bg,
        measured.title,
        measured.meta,
      ]);
      // Titles are large text (≥3:1); the meta line is normal text (≥4.5:1).
      const titleRatio = contrastRatio(titleRgb!, bgRgb!);
      const metaRatio = contrastRatio(metaRgb!, bgRgb!);
      expect(titleRatio, `${theme} title contrast ${titleRatio.toFixed(2)}`).toBeGreaterThanOrEqual(3);
      expect(metaRatio, `${theme} meta contrast ${metaRatio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
      // The field really is the theme's half (a mis-themed page would weaken
      // the measurement above).
      expect(await bodyBackground(page)).toBe(bgRgb);
    });

    // The plate index is 11.5px normal-weight text on the page field, and it is
    // deliberately recessive. Its `opacity` composites the ink against the
    // field, so the EFFECTIVE colour — not the declared token — is what must
    // clear the floor. This pins the composited value so a future "make it
    // subtler" tweak cannot silently break AA.
    test(`${theme}: plate index clears 4.5:1 after opacity compositing`, async ({ page }) => {
      await page.addInitScript(
        ([k, v]) => localStorage.setItem(k!, v!),
        ["photography.appearance", theme] as const,
      );
      await page.goto("/");
      const measured = await page.evaluate(() => {
        const plate = document.querySelector<HTMLElement>(".strip .card-plate-num")!;
        const style = getComputedStyle(plate);
        return {
          color: style.color,
          opacity: Number.parseFloat(style.opacity),
          fontSize: Number.parseFloat(style.fontSize),
          fontWeight: style.fontWeight,
          // The plate sits on the field (the strip carries no surface of its own).
          bg: getComputedStyle(document.body).backgroundColor,
        };
      });
      expect(measured.fontSize).toBeLessThan(18);
      expect(measured.fontWeight).toBe("400");

      const [fgRgb, bgRgb] = await toSrgb(page, [measured.color, measured.bg]);
      const parse = (rgb: string) =>
        /rgb\((\d+),?\s*(\d+),?\s*(\d+)\)/.exec(rgb)!.slice(1).map(Number) as number[];
      const fg = parse(fgRgb!);
      const bg = parse(bgRgb!);
      const composite = `rgb(${fg.map((c, i) => Math.round(c * measured.opacity + bg[i]! * (1 - measured.opacity))).join(", ")})`;
      const ratio = contrastRatio(composite, bgRgb!);
      expect(
        ratio,
        `${theme} plate index composite contrast ${ratio.toFixed(2)} (opacity ${measured.opacity})`,
      ).toBeGreaterThanOrEqual(4.5);
    });
  }
});

test.describe("keyboard focus perimeter", () => {
  test("tabbing through the shell yields a visible ≥2px perimeter", async ({ page }) => {
    await page.setViewportSize({ width: DESKTOP_VIEWPORT.width, height: DESKTOP_VIEWPORT.height });
    await page.goto("/");
    const seen: Array<{ outlineWidth: number; outlineStyle: string }> = [];
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      const state = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const style = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          outlineWidth: Number.parseFloat(style.outlineWidth),
          outlineStyle: style.outlineStyle,
          inViewport: r.top < window.innerHeight && r.bottom > 0,
        };
      });
      if (state?.inViewport) seen.push(state);
    }
    expect(seen.length).toBeGreaterThan(0);
    for (const s of seen) {
      expect(s.outlineWidth, "focus outline width").toBeGreaterThanOrEqual(2);
      expect(s.outlineStyle, "focus outline style").toBe("solid");
    }
  });
});
