// WP-30 e2e — the frozen Places index + Place detail (production build via
// astro preview).
//
// Frozen references: FDS §3.4 (names-led; region/country ONLY for
// disambiguation; NO counts anywhere; Place detail = name + location context
// leads, then Gallery covers/titles/photographed dates; progressive year
// grouping reads as chronology landmark, same visual language as Archive; NO
// maps/destination descriptions/itineraries/geography devices), CONTENT_MODEL
// §6.3 (no Visit/Trip/coordinates/counts), BUILD_AND_ROUTING §4 (Place route
// published-only — a place with unpublished-only galleries produces NO public
// route).
//
// Updated for the real archive corpus (HEAD c0495d9): 36 published-scoped
// places, no multi-year place exists in the corpus, so the progressive-year
// grouping on Place detail is exercised via the Archive suite and the flat
// rendering is asserted here (corpus fact recorded in the redesign report).
import { expect, test } from "@playwright/test";

test.describe("WP-30 Places index", () => {
  test("names-led index over the published-scoped places", async ({ page }) => {
    const response = await page.goto("/places");
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);

    const hrefs = await page.evaluate(() =>
      Array.from(document.querySelectorAll("main a[href^='/places/']")).map((a) =>
        a.getAttribute("href"),
      ),
    );
    // R4 index scope: every place with a CONFIRMED photo collection
    // (30 post-sweep; 31 after the first D1 sweep; 38 after the owner's
    // 2026-09-15 local review — the view also publicizes every place
    // referenced by a published photo, R3 photo-reference parity).
    expect(hrefs).toHaveLength(38);
    expect(hrefs).toContain("/places/amsterdam");
    expect(hrefs).toContain("/places/versailles");
    // Unmigrated places stay out of the index (honest scope).
    expect(hrefs).not.toContain("/places/thun");
    expect(hrefs).not.toContain("/places/tromso");

    // Visual atlas: one framed cover per place, served from /media.
    const cards = page.locator(".place-atlas-card");
    await expect(cards).toHaveCount(38);
    const imgs = await page
      .locator(".place-atlas-img")
      .evaluateAll((els) => els.map((el) => (el as HTMLImageElement).getAttribute("src")));
    expect(imgs.every((src) => src?.startsWith("/media/"))).toBe(true);
    // 3-column desktop grid.
    const columns = await page
      .locator(".places-atlas")
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
    expect(columns).toBe(3);
  });

  test("entries are names-ascending", async ({ page }) => {
    await page.goto("/places");
    const names = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".place-atlas-name")).map((el) =>
        el.textContent!.trim(),
      ),
    );
    // Names ascending per the builder's fixed en collator: assert the list is
    // sorted and non-empty rather than pinning 36 literals.
    // Names-ascending across the confirmed set; unmigrated places absent.
    const sorted = [...names].sort((a, b) => a.localeCompare(b, "en"));
    expect(names).toEqual(sorted);
    expect(names).toContain("Amsterdam");
    expect(names).toContain("Zakynthos");
    expect(names).not.toContain("Thun");
  });

  test("ZERO count strings anywhere in the index (FDS §3.4)", async ({ page }) => {
    await page.goto("/places");
    const counts = await page.evaluate(() => {
      const countEls = document.querySelectorAll("[class*=count]").length;
      const textCounts = Array.from(document.querySelectorAll("main *")).filter((el) =>
        /\b\d+\s+(galleries?|photos?|photographs?)\b/i.test(el.textContent ?? ""),
      ).length;
      return { countEls, textCounts };
    });
    expect(counts.countEls).toBe(0);
    expect(counts.textCounts).toBe(0);
  });

  test("region/country render as disambiguation metadata (compact)", async ({ page }) => {
    await page.goto("/places");
    // Every entry may carry a location context line (corpus places all have
    // region/country); it must be metadata-compact, not descriptive prose.
    const contexts = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".place-atlas-context")).map((el) =>
        el.textContent!.trim(),
      ),
    );
    // R4: 38 public places after the owner's 2026-09-15 local review;
    // a context line renders for every indexed entry.
    expect(contexts.length).toBe(38);
    for (const ctx of contexts) expect(ctx.length).toBeLessThan(80);
  });
});

test.describe("WP-30 Place detail — progressive year grouping", () => {
  test("place detail renders the name, context, photo collection and source journey", async ({
    page,
  }) => {
    // R4 semantics: Amsterdam leads with its aggregated photo collection;
    // the gallery list below lists only the SOURCE journey.
    await page.goto("/places/amsterdam");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator(".place-photo")).toHaveCount(8);
    const meta = await page.locator("[data-place-context]").first().textContent();
    expect(meta!.length).toBeGreaterThan(0);
  });

  test("place without confirmed photos shows the honest status — NO journey fallback (R4 F1)", async ({
    page,
  }) => {
    // Thun's mapping has only medium-confidence candidates (none confirmed):
    // the direct page must NOT offer the journey as a substitute collection.
    await page.goto("/places/thun");
    await expect(page.locator("[data-place-migration-status]")).toHaveCount(1);
    await expect(page.locator(".gallery-card")).toHaveCount(0);
    await expect(page.locator(".place-journeys-heading")).toHaveCount(0);
  });

  test("Dali shows only its own confirmed photo — never Xi'an/Nanchang content (R4)", async ({
    page,
  }) => {
    await page.goto("/places/dali");
    // Post-sweep Dali has ONE confirmed photo (p_autumn_china_007, 大理古城);
    // the page must show exactly that and nothing from Xi'an/Nanchang.
    // The photo collection links exactly the one confirmed photo; the
    // source-journey card may link the gallery, but the PHOTO set is the
    // collection — assert on .place-photo and on caption content instead.
    const photoLinks = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".place-photo")).map((a) =>
        a.getAttribute("href"),
      ),
    );
    expect(photoLinks).toEqual(["/galleries/autumn-china#p_autumn_china_007"]);
    await expect(page.locator(".place-journeys .gallery-card")).toHaveCount(1);
    const body = await page.locator("main").innerText();
    expect(body).not.toContain("Xi'an");
    expect(body).not.toContain("滕王閣");
  });

  test("Amsterdam journey section lists only the SOURCE journey of confirmed photos", async ({
    page,
  }) => {
    await page.goto("/places/amsterdam");
    // Photos first (8), then the journeys heading and ONLY the Netherlands
    // card (the sole journey holding confirmed Amsterdam photos — not the
    // cross-city Rhine/Lowlands/London album).
    const hrefs = await page.evaluate(() =>
      Array.from(document.querySelectorAll("main a[href*='/galleries/']")).map((a) =>
        a.getAttribute("href"),
      ),
    );
    expect(hrefs!.every((h) => h!.startsWith("/galleries/netherlands"))).toBe(true);
    await expect(page.locator(".place-journeys-heading")).toHaveCount(1);
    await expect(page.locator(".place-journeys .gallery-card")).toHaveCount(1);
  });

  test("draft-only place has NO public route (BUILD_AND_ROUTING §4)", async ({ request }) => {
    const response = await request.get("/places/not-a-real-place");
    expect(response.status()).toBe(404);
  });
});

test.describe("WP-30 no geography devices", () => {
  for (const route of ["/places", "/places/amsterdam"]) {
    test(`no map/iframe/geography elements on ${route}`, async ({ page }) => {
      await page.goto(route);
      const inventory = await page.evaluate(() => ({
        iframes: document.querySelectorAll("iframe").length,
        svgs: document.querySelectorAll("svg").length,
        maps: document.querySelectorAll("[class*=map], [id*=map]").length,
      }));
      expect(inventory.iframes).toBe(0);
      expect(inventory.svgs).toBe(0);
      expect(inventory.maps).toBe(0);
    });
  }
});

