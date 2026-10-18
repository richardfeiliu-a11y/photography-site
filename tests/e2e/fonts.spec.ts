// WP-05 font probe contract (TDD, runs against the production build served by
// `astro preview` per playwright.config.ts).
//
// Frozen references: FINAL_DESIGN_SPECIFICATION §2.2 + G1 (four families, no
// third family); PERFORMANCE_BUDGET §7 (font-display: optional; Options A/B;
// §7.5 mandatory CJK rules — honest unicode-range, system fallback for
// out-of-subset glyphs, no blind preload).
//
// Probe markup lives behind the `wp-05-font-probe` marker in the WP-02
// placeholder page (src/pages/index.astro) and leaves with the placeholder in
// P4 — no extra route is created (WP-04 probe strategy, recorded in
// docs/implementation/WP-04.md).
//
// font-display: optional caveat (recorded for the PoC): on first paint the
// browser may keep fallback fonts if the webfont misses the ~100 ms block
// window. Tests therefore wait for networkidle + document.fonts.ready before
// asserting load()/check() state. Rendering-application flakiness is reported
// honestly in docs/implementation/WP-05.md; production stays `optional`.
import { expect, test } from "@playwright/test";

const SERIF_STACK = '"Source Serif 4", Georgia, "Noto Serif SC", "Songti SC", serif';
const SANS_STACK = '"Source Sans 3", "Helvetica Neue", "Noto Sans SC", -apple-system, sans-serif';

/** In-subset probe glyphs: Latin "A"; CJK 永/影/像 (GB2312 level 1, in the Option A subset). */
const LATIN_PROBE = "A";
// The SERVED SC faces are the Option B build-derived subsets (PERFORMANCE_BUDGET
// §7.4 / WP-46 verdict), and their declared unicode-range is generated from the
// served cmap (scripts/fonts/emit-fonts-css.py). Measured from the served files
// 2026-09-14: noto-serif-sc/-sans-sc sc400 option-b carry 319 codepoints
// (55 CJK) including 影 U+5F71 and 像 U+50CF, and do NOT carry 永 U+6C38 —
// 永 exists only in the unserved option-a file. The in-subset probe therefore
// uses characters the shipped subsets really contain.
const SERIF_CJK_PROBE = "影";
const SANS_CJK_PROBE = "影像";

/** Outside every candidate subset (NOT in GB2312 level 1+2, not in authored content): 喆 U+5586 (GBK-only name glyph). */
const OUTSIDE_CHAR = "喆";

/** Present in option-a only; the served Option B subsets legitimately omit it. */
const OPTION_A_ONLY_CHAR = "永";

const SERIF_WEIGHTS = [400, 500];
const SANS_WEIGHTS = [400, 500, 600];
const SC_POC_WEIGHTS = [400]; // PoC minimum; weight gaps documented in WP-05.md

async function whenFontsReady(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/qa-probe", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
}

test.describe("WP-05 font loading plumbing + CJK PoC", () => {
  test("document.fonts.ready resolves with the four frozen families usable (§7.1)", async ({
    page,
  }) => {
    await whenFontsReady(page);
    const state = await page.evaluate(
      async ([latin, serifCjk, sansCjk, serifWeights, sansWeights, scWeights]) => {
        const results: Record<string, string> = {};
        const probe = async (family: string, weight: number, text: string): Promise<string> => {
          const fontSpec = `${weight} 16px "${family}"`;
          try {
            const loaded = await document.fonts.load(fontSpec, text);
            return `loaded=${loaded.length} check=${document.fonts.check(fontSpec, text)}`;
          } catch (err) {
            return `error=${String(err)}`;
          }
        };
        for (const w of serifWeights) {
          results[`Source Serif 4 ${w}`] = await probe("Source Serif 4", w, latin);
        }
        for (const w of sansWeights) {
          results[`Source Sans 3 ${w}`] = await probe("Source Sans 3", w, latin);
        }
        for (const w of scWeights) {
          results[`Noto Serif SC ${w}`] = await probe("Noto Serif SC", w, serifCjk);
          results[`Noto Sans SC ${w}`] = await probe("Noto Sans SC", w, sansCjk);
        }
        return results;
      },
      [
        LATIN_PROBE,
        SERIF_CJK_PROBE,
        SANS_CJK_PROBE,
        SERIF_WEIGHTS,
        SANS_WEIGHTS,
        SC_POC_WEIGHTS,
      ] as const,
    );
    for (const [face, status] of Object.entries(state)) {
      const loaded = Number(status.match(/loaded=(\d+)/)?.[1] ?? 0);
      const check = status.includes("check=true");
      expect(loaded, `${face}: load() must resolve to the face (${status})`).toBeGreaterThan(0);
      expect(check, `${face}: document.fonts.check must be true (${status})`).toBe(true);
    }

    // The served range must not be broader than the served file: a codepoint
    // that only option-a carries must resolve to NO served SC face.
    const notServed = await page.evaluate(async ([char]) => {
      const loadCount = async (family: string): Promise<number> => {
        try {
          return (await document.fonts.load(`400 16px "${family}"`, char)).length;
        } catch {
          return -1;
        }
      };
      return {
        serif: await loadCount("Noto Serif SC"),
        sans: await loadCount("Noto Sans SC"),
      };
    }, [OPTION_A_ONLY_CHAR] as const);
    expect(notServed.serif, "option-a-only char is not served by the serif subset").toBe(0);
    expect(notServed.sans, "option-a-only char is not served by the sans subset").toBe(0);
  });

  test("mixed Latin+CJK probe renders with the intended family stack (§2.2)", async ({ page }) => {
    await whenFontsReady(page);
    // Latin resolves from the Source face, CJK from the SC face — per-script
    // coverage proves the frozen stack hands each script to its intended
    // family. The Source faces must NOT cover CJK (no range lies about it).
    const stack = await page.evaluate(
      async ([latin, serifCjk, sansCjk]) => {
        const loadCount = async (fontSpec: string, text: string): Promise<number> => {
          try {
            return (await document.fonts.load(fontSpec, text)).length;
          } catch {
            return -1;
          }
        };
        const probe = document.querySelector('[data-probe="font-serif-mixed"]');
        const sansProbe = document.querySelector('[data-probe="font-sans-mixed"]');
        return {
          serifFamily: probe ? getComputedStyle(probe).fontFamily : null,
          sansFamily: sansProbe ? getComputedStyle(sansProbe).fontFamily : null,
          serifLatinFaces: await loadCount('400 16px "Source Serif 4"', latin),
          serifCjkFaces: await loadCount('400 16px "Source Serif 4"', serifCjk),
          serifStackCjkFaces: await loadCount('400 16px "Noto Serif SC"', serifCjk),
          sansLatinFaces: await loadCount('400 16px "Source Sans 3"', latin),
          sansCjkFaces: await loadCount('400 16px "Source Sans 3"', sansCjk),
          sansStackCjkFaces: await loadCount('400 16px "Noto Sans SC"', sansCjk),
        };
      },
      [LATIN_PROBE, SERIF_CJK_PROBE, SANS_CJK_PROBE] as const,
    );
    const strip = (s: string | null): string | null =>
      s ? s.replace(/["']/g, "").replace(/\s+/g, "") : null;
    expect(strip(stack.serifFamily), "serif probe uses var(--font-serif)").toBe(
      SERIF_STACK.replace(/["']/g, "").replace(/\s+/g, ""),
    );
    expect(strip(stack.sansFamily), "sans probe uses var(--font-sans)").toBe(
      SANS_STACK.replace(/["']/g, "").replace(/\s+/g, ""),
    );
    // Per-script resolution along the frozen stacks.
    expect(stack.serifLatinFaces, "Latin covered by Source Serif 4").toBeGreaterThan(0);
    expect(stack.serifCjkFaces, "Source Serif 4 must NOT cover CJK (honest stack)").toBe(0);
    expect(stack.serifStackCjkFaces, "CJK covered by Noto Serif SC").toBeGreaterThan(0);
    expect(stack.sansLatinFaces, "Latin covered by Source Sans 3").toBeGreaterThan(0);
    expect(stack.sansCjkFaces, "Source Sans 3 must NOT cover CJK (honest stack)").toBe(0);
    expect(stack.sansStackCjkFaces, "CJK covered by Noto Sans SC").toBeGreaterThan(0);
  });

  test("character outside every candidate subset falls back to system CJK without layout breakage (§7.5)", async ({
    page,
  }, testInfo) => {
    await whenFontsReady(page);
    const evidence = await page.evaluate(
      async ([outside]) => {
        // Honest unicode-range: no face may claim the outside char.
        const loadCount = async (fontSpec: string, text: string): Promise<number> => {
          try {
            return (await document.fonts.load(fontSpec, text)).length;
          } catch {
            return -1;
          }
        };
        // Glyph-identity comparison on a baseline-aligned canvas: fillText
        // takes the BASELINE as y, so every stack draws from an identical
        // glyph origin (DOM line-box struts would shift it per font metrics).
        // Ink-crop normalizes translation; the diff is per-pixel alpha.
        const SIZE = 72;
        const draw = (families: string): Uint8ClampedArray => {
          const canvas = document.createElement("canvas");
          canvas.width = SIZE;
          canvas.height = SIZE;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) throw new Error("no 2d context");
          ctx.font = `48px ${families}`;
          ctx.fillStyle = "#000";
          ctx.textBaseline = "alphabetic";
          ctx.fillText(outside, 10, 56);
          return ctx.getImageData(0, 0, SIZE, SIZE).data;
        };
        const inkBox = (d: Uint8ClampedArray): [number, number, number, number] | null => {
          let minX = SIZE,
            minY = SIZE,
            maxX = -1,
            maxY = -1;
          for (let y = 0; y < SIZE; y++) {
            for (let x = 0; x < SIZE; x++) {
              if (d[(y * SIZE + x) * 4 + 3] > 8) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
              }
            }
          }
          return maxX < 0 ? null : [minX, minY, maxX, maxY];
        };
        const cropDiff = (
          a: Uint8ClampedArray,
          b: Uint8ClampedArray,
          [minX, minY, maxX, maxY]: [number, number, number, number],
        ): { diff: number; total: number } => {
          let diff = 0;
          let total = 0;
          for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
              const i = (y * SIZE + x) * 4;
              total++;
              if (Math.abs(a[i + 3] - b[i + 3]) > 32) diff++;
            }
          }
          return { diff, total };
        };
        const siteStack = '"Source Serif 4", Georgia, "Noto Serif SC", "Songti SC", serif';
        const site = draw(siteStack);
        const box = inkBox(site);
        if (!box) throw new Error("outside glyph drew no ink — no fallback font resolved it");
        const platformCjkSerif = draw('"Songti SC"');
        const differentCjk = draw('"PingFang SC"');
        // Glyph advance via a temporary INLINE span (the probe <p> is
        // block-level; its width is the container, not the glyph).
        const span = document.createElement("span");
        span.style.cssText = `position:fixed; visibility:hidden; white-space:nowrap; font-size:48px; line-height:1; font-family:${siteStack};`;
        span.textContent = outside;
        document.body.appendChild(span);
        const glyphAdvance = span.getBoundingClientRect().width;
        span.remove();
        const probe = document.querySelector('[data-probe="font-outside-subset"]');
        const elBox = probe ? probe.getBoundingClientRect() : null;
        return {
          serifFacesForOutside: await loadCount('400 16px "Noto Serif SC"', outside),
          sansFacesForOutside: await loadCount('400 16px "Noto Sans SC"', outside),
          advanceWidth: glyphAdvance,
          fontSize: 48,
          sameFontDiff: cropDiff(site, platformCjkSerif, box),
          diffFontDiff: cropDiff(site, differentCjk, box),
          probeWidth: elBox ? elBox.width : null,
          probeRight: elBox ? elBox.right : null,
          viewport: window.innerWidth,
          overflow: document.documentElement.scrollWidth > window.innerWidth,
        };
      },
      [OUTSIDE_CHAR] as const,
    );
    // (1) The webfonts honestly do not cover the outside char.
    expect(evidence.serifFacesForOutside, "Noto Serif SC must not claim the outside glyph").toBe(0);
    expect(evidence.sansFacesForOutside, "Noto Sans SC must not claim the outside glyph").toBe(0);
    // (2) A full-width glyph was rendered by SOMETHING (1em advance, not a
    // zero-width collapse): the stack handed the char to a system CJK font.
    expect(
      evidence.advanceWidth,
      "outside glyph renders with a full-width (1em) advance, not a collapse",
    ).toBeCloseTo(evidence.fontSize, 5);
    // (3) Fallback identity (§7.5 demonstration): the site stack renders the
    // outside char pixel-identically to the explicit platform CJK serif
    // ("Songti SC" on macOS — the same chain resolves wherever that name is
    // absent), proving the stack fell through the webfonts to the platform
    // CJK serif rather than an intermediate Latin font or a tofu box. The
    // discriminative control (a different CJK font) must differ.
    expect(
      evidence.sameFontDiff?.diff,
      "site stack must render the outside glyph exactly like the platform CJK serif",
    ).toBe(0);
    expect(
      (evidence.diffFontDiff?.diff ?? 0) - (evidence.sameFontDiff?.diff ?? 0),
      "a different CJK font must render differently (comparison is discriminative)",
    ).toBeGreaterThan(0);
    // (4) No layout breakage: sane element width, nothing overflows the viewport.
    expect(evidence.probeWidth, "probe element has sane width").toBeGreaterThan(0);
    expect(evidence.probeRight ?? 0, "probe element stays inside the viewport").toBeLessThanOrEqual(
      evidence.viewport,
    );
    expect(evidence.overflow, "no horizontal document overflow").toBe(false);
    // Evidence for the PoC report (attached to the test artifact, not committed).
    await testInfo.attach("fallback-metrics.json", {
      body: JSON.stringify(evidence, null, 2),
      contentType: "application/json",
    });
    const probeLocator = page.locator('[data-probe="font-outside-subset"]');
    if ((await probeLocator.count()) > 0) {
      await testInfo.attach("font-fallback-probe.png", {
        body: await probeLocator.screenshot(),
        contentType: "image/png",
      });
    }
  });
});
