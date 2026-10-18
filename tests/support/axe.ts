// WP-06 reusable axe-core scan helper (TESTING_AND_VISUAL_REGRESSION §7.1:
// automated scanning runs against every page type; zero violations expected).
// Each future page type (Home, Archive, Places Index, Place Detail, Gallery,
// About, 404) calls runAxeScan(page) in its a11y spec — this helper is the single
// integration point so scan configuration stays uniform.
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { revealSettlementError, type RevealStyleSample } from "./reveal-settlement";

export interface AxeScanOptions {
  /** Restrict the rule set, e.g. WCAG tags. Omit to scan all enabled rules. */
  withTags?: string[];
  expectedH1?: string | RegExp;
}

export async function runAxeScan(page: Page, options: AxeScanOptions = {}) {
  // R3 / review F5 fix: a scan must cover the page's REAL visible state.
  // One-shot entrance reveals start opacity:0 and only reveal when scrolled
  // into view, so an at-top scan silently skipped them (and a mid-fade
  // element samples a blended text color → false contrast violations).
  //
  // Protocol: scroll the WHOLE document (so every IntersectionObserver
  // fires), return to top, then wait until every reveal element has
  // opacity exactly 1. A timeout FAILS the scan with the list of elements
  // that never appeared — an incomplete reveal is never scanned as green.
  const needsReveal = await page.evaluate(
    () => document.querySelectorAll(".reveal-pending, [data-reveal]").length > 0,
  );
  if (needsReveal) {
    await page.evaluate(async () => {
      const step = Math.max(200, Math.floor(window.innerHeight * 0.75));
      for (let y = 0; y <= document.documentElement.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 40));
      }
      window.scrollTo(0, 0);
    });

    // Wait for "ALL SETTLED" in active viewable areas.
    // Self-contained in-page predicate (R4-2): inactive slides or inert elements
    // are excluded so hidden carousel slides are not expected to be visible.
    await page
      .waitForFunction(
        () => {
          const els = Array.from(
            document.querySelectorAll<HTMLElement>("[data-reveal]"),
          ).filter((el) => {
            if (
              el.closest(
                ".stage-slide:not(.is-active), [inert], [aria-hidden='true']",
              )
            ) {
              return false;
            }
            const s = window.getComputedStyle(el);
            return s.display !== "none" && s.visibility !== "hidden";
          });

          return els.every((el) => {
            const s = window.getComputedStyle(el);
            const op = parseFloat(s.opacity);
            const tr = s.transform;
            return (
              op === 1 &&
              (tr === "none" || tr === "matrix(1, 0, 0, 1, 0, 0)")
            );
          });
        },
        undefined,
        { timeout: 10_000 },
      )
      .catch(async () => {
        // On timeout, collect samples in browser context and format diagnostic
        // via pure Node module function.
        const samples: RevealStyleSample[] = await page.evaluate(() => {
          const els = Array.from(
            document.querySelectorAll<HTMLElement>("[data-reveal]"),
          ).filter((el) => {
            if (
              el.closest(
                ".stage-slide:not(.is-active), [inert], [aria-hidden='true']",
              )
            ) {
              return false;
            }
            const s = window.getComputedStyle(el);
            return s.display !== "none" && s.visibility !== "hidden";
          });
          return els.map((el) => {
            const s = window.getComputedStyle(el);
            return {
              opacity: s.opacity,
              transform: s.transform,
              describe: `${el.tagName.toLowerCase()}.${el.className}`,
            };
          });
        });
        const err = revealSettlementError(samples);
        throw new Error(
          `axe scan refused: entrance reveals never settled after a full scroll (${err || "timeout"})`,
        );
      });

    // Double-rAF + settle before sampling computed colors.
    await page.evaluate(
      () =>
        new Promise((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        }),
    );
    await page.waitForTimeout(600);
  }

  const builder = new AxeBuilder({ page });
  if (options.withTags) {
    builder.withTags(options.withTags);
  }
  return builder.analyze();
}

/**
 * R4 F5 / R4-2: scan a route under BOTH concrete themes (Light/Dark).
 * Uses deterministic pre-paint appearance restore per theme, asserts route
 * pathname, active theme, and page H1 prior to scanning.
 */
export async function runAxeScanBothThemes(
  page: Page,
  options: AxeScanOptions & { path?: string; expectedH1?: string | RegExp } = {},
) {
  const targetPath = options.path ?? new URL(page.url()).pathname;
  const out: Record<string, Awaited<ReturnType<typeof runAxeScan>>> = {};

  for (const theme of ["light", "dark"] as const) {
    // Navigate to page first
    await page.goto(targetPath);

    // Apply stored appearance preference
    await page.evaluate((t) => {
      try {
        localStorage.setItem("photography.appearance", t);
      } catch {}
      document.documentElement.dataset.theme = t;
      document.documentElement.style.colorScheme = t;
    }, theme);

    // Reload so pre-paint inline script applies theme from scratch
    await page.reload();

    // 1. Assert actual URL pathname matches targetPath
    const currentUrl = new URL(page.url());
    expect(currentUrl.pathname).toBe(targetPath);

    // 2. Assert page theme is explicitly the asserted theme
    const actualTheme = await page.evaluate(
      () => document.documentElement.dataset.theme,
    );
    expect(actualTheme, `Page theme should be ${theme}`).toBe(theme);

    // 3. Assert page feature / H1
    if (options.expectedH1) {
      await expect(page.locator("h1").first()).toHaveText(options.expectedH1);
    } else if (targetPath !== "/404" && targetPath !== "/definitely-not-a-route") {
      const pageH1 = await page.locator("h1").first().textContent();
      expect(
        pageH1?.trim(),
        `Page at ${targetPath} must not be 404 Page not found`,
      ).not.toBe("Page not found");
    }

    out[theme] = await runAxeScan(page, { withTags: options.withTags });
  }

  return out;
}
