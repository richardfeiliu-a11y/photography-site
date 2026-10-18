// R4 round4 (T1) — the hydrated photo must be reachable by assistive
// technology, not merely present in the DOM.
//
// The reconciliation plan (docs/reports/plan-r4-round3-reconciliation-
// 2026-09-14.md §3 J05, §4 T1) requires the assertion to follow a REAL user
// path — scroll, anchor jump, Overview entry — and to check the accessible
// image name. The defect this pins: every below-the-fold photo hydrated into a
// placeholder span that carried aria-hidden="true", so `img`/`naturalWidth`
// counts and axe stayed green while the photo itself was removed from the
// accessibility tree (all 27 later photos on /galleries/netherlands).
import { expect, test } from "@playwright/test";

/** Walk the sequence the way a reader does, then report per-figure state. */
async function scrollThroughSequence(page: import("@playwright/test").Page) {
  await page.evaluate(async () => {
    const step = Math.max(320, Math.floor(window.innerHeight * 0.6));
    for (let y = 0; y <= document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 40));
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
}

async function hiddenAncestors(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const offenders: Array<{ id: string; reason: string }> = [];
    for (const figure of document.querySelectorAll<HTMLElement>(".gallery-figure")) {
      const img = figure.querySelector("img");
      if (!img) continue;
      let node: HTMLElement | null = img.parentElement;
      while (node && node !== document.body) {
        if (node.getAttribute("aria-hidden") === "true") {
          offenders.push({ id: figure.id, reason: `aria-hidden on ${node.tagName}` });
          break;
        }
        if (node.hasAttribute("inert")) {
          offenders.push({ id: figure.id, reason: `inert on ${node.tagName}` });
          break;
        }
        node = node.parentElement;
      }
      const hidden = getComputedStyle(img).visibility === "hidden";
      if (hidden) offenders.push({ id: figure.id, reason: "computed visibility:hidden" });
    }
    return offenders;
  });
}

test.describe("R4 T1: gallery photos stay exposed to assistive technology", () => {
  test("after a real scroll every loaded photo has a visible, named, reachable image", async ({
    page,
  }) => {
    await page.goto("/galleries/netherlands");
    await scrollThroughSequence(page);

    expect(await hiddenAncestors(page)).toEqual([]);

    // Reachability by accessible name, not by DOM count: every figure's img
    // must be findable through its accessible role, and each has an authored
    // alt in the real corpus (an empty alt still resolves as role=presentation
    // — assert the name wherever the corpus authors one).
    const names = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLImageElement>(".gallery-figure img")].map((img) => ({
        id: img.closest<HTMLElement>(".gallery-figure")?.id ?? "",
        alt: img.getAttribute("alt"),
        complete: img.complete && img.naturalWidth > 0,
      })),
    );
    expect(names.length).toBeGreaterThan(20);
    expect(names.every((n) => n.complete)).toBe(true);
    const authored = names.filter((n) => (n.alt ?? "").trim().length > 0);
    expect(authored.length).toBe(names.length);
    // The accessible tree agrees: each authored alt is queryable by role+name.
    const firstNamed = authored[0]!;
    await expect(
      page.getByRole("img", { name: firstNamed.alt!, exact: true }).first(),
    ).toBeVisible();
  });

  test("anchor jump (place deep link) lands on a figure whose photo is not hidden", async ({
    page,
  }) => {
    await page.goto("/places/amsterdam");
    const deepLink = await page
      .locator(".place-photo")
      .first()
      .getAttribute("href");
    expect(deepLink).toBeTruthy();
    await page.goto(deepLink!);
    // The anchor jump is the deep-link path from the Places index; hydration
    // has to have already produced a real, reachable photo at the target.
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const target = document.querySelector<HTMLElement>(".gallery-figure:target");
            if (!target) return "no-target";
            const img = target.querySelector<HTMLImageElement>("img");
            if (!img) return "no-img";
            if (!(img.complete && img.naturalWidth > 0)) return "not-loaded";
            let node: HTMLElement | null = img.parentElement;
            while (node && node !== document.body) {
              if (node.getAttribute("aria-hidden") === "true") return "hidden-ancestor";
              node = node.parentElement;
            }
            return "ok";
          }),
        { timeout: 20000 },
      )
      .toBe("ok");
  });

  test("viewer entry keeps the plate readable, named and reachable", async ({ page }) => {
    await page.goto("/galleries/netherlands");
    // A late plate (past the first viewport) opened through the real trigger
    // path: the viewer must present it as a reachable, named image — the
    // defect class this pins is a plate that is visible but stripped from the
    // accessibility tree (aria-hidden ancestor / missing name).
    await page.locator(".gallery-figure").nth(12).scrollIntoViewIfNeeded();
    await page.locator(".gallery-figure").nth(12).locator(".figure-open").click();
    await expect(page.locator("dialog[data-lightbox]")).toBeVisible();
    const state = await page.evaluate(() => {
      const img = document.querySelector<HTMLImageElement>(".lightbox-img")!;
      const offenders: string[] = [];
      let node: HTMLElement | null = img.parentElement;
      while (node && node !== document.body) {
        if (node.getAttribute("aria-hidden") === "true") offenders.push(`aria-hidden ${node.tagName}`);
        if (node.hasAttribute("inert")) offenders.push(`inert ${node.tagName}`);
        node = node.parentElement;
      }
      const r = img.getBoundingClientRect();
      return {
        offenders,
        alt: img.getAttribute("alt") ?? "",
        loaded: img.complete && img.naturalWidth > 0,
        visible: r.width > 0 && r.height > 0 && getComputedStyle(img).visibility !== "hidden",
        count: document.querySelector("[data-lb-count]")?.textContent?.trim() ?? "",
      };
    });
    expect(state.offenders).toEqual([]);
    expect(state.loaded).toBe(true);
    expect(state.visible).toBe(true);
    expect(state.alt.trim().length).toBeGreaterThan(0);
    // The viewer's own location line carries the reading position (it replaced
    // the pruned position annotation).
    expect(state.count).toMatch(/^\d+ \/ \d+$/);
    await expect(
      page.getByRole("img", { name: state.alt, exact: true }).first(),
    ).toBeVisible();
  });
});
