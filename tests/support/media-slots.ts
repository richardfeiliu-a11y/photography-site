/**
 * Tests/support/media-slots.ts — helpers for the R4 perf media gating.
 *
 * Below-the-first gallery photos render as an aspect-ratio slot plus a
 * <noscript> picture; with JS they hydrate on proximity (see
 * src/lib/js/media-slots.ts). Full-sequence tests call the deterministic
 * hydrate hook instead of relying on scroll timing.
 */
import { expect, type Page } from "@playwright/test";

declare global {
  interface Window {
    __hydrateMediaSlots?: () => void;
  }
}

/** Hydrate every slot on the page (idempotent) and wait until each figure
 *  has exactly one live <img>. */
export async function hydrateAllMediaSlots(page: Page): Promise<void> {
  await page.evaluate(() => window.__hydrateMediaSlots?.());
  await expect
    .poll(
      async () => {
        const figures = page.locator(".gallery-figure");
        const imgs = page.locator(".gallery-figure img");
        return (await figures.count()) > 0 && (await imgs.count()) === (await figures.count());
      },
      { timeout: 10000 },
    )
    .toBe(true);
}

/** Hydrate, then wait until every sequence image has decoded (natural
 *  dimensions available) — the gate-aware replacement for the old
 *  scroll-and-settle discipline used by geometry tests. Injected pictures
 *  keep their authored loading="lazy", so a full-sequence probe flips them
 *  eager (the same trick tests/capture uses); proximity/scroll behavior is
 *  covered separately in gallery-media-gating.spec.ts. */
export async function settleGalleryMedia(page: Page): Promise<void> {
  await hydrateAllMediaSlots(page);
  await page.evaluate(() => {
    document
      .querySelectorAll<HTMLImageElement>('.gallery-figure img[loading="lazy"]')
      .forEach((img) => {
        img.loading = "eager";
      });
  });
  await page.waitForFunction(
    () => {
      const imgs = Array.from(document.querySelectorAll<HTMLImageElement>(".gallery-figure img"));
      return imgs.length > 0 && imgs.every((img) => img.complete && img.naturalWidth > 0);
    },
    null,
    { timeout: 20000 },
  );
}
