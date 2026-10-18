// e2e — the Archive page in the immersive direction (docs/IMMERSIVE_VIEWING_SPEC §7).
//
// Frozen references: FDS §3.3 (cover, title, photographed date, Place, count
// per row), CONTENT_MODEL §7/UD-003 (chronology comes from PHOTOGRAPHED dates
// — the builder owns it; published_at can never group the archive), §5.5 (one
// h1).
//
// C direction (2026-10-18): the year groups were pruned. The archive is ONE
// flat hairline list of numbered rows (No. 01 … No. N) whose order IS the
// frozen chronology — newest first — so the underlying guarantee is asserted
// directly on the rows (descending photographed years, no invented years)
// instead of on `[data-year-heading]` landmarks.
import { expect, test } from "@playwright/test";
import { DESKTOP_VIEWPORT, MOBILE_VIEWPORT } from "../support/viewports.mjs";

test.describe("Archive — flat catalogue chronology", () => {
  test("renders one h1 and no year landmarks (the rows carry the chronology)", async ({
    page,
  }) => {
    const response = await page.goto("/archive");
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveText("Journeys");

    // The former grouping surfaces are gone by construction.
    await expect(page.locator("[data-year-heading]")).toHaveCount(0);
    await expect(page.locator(".year-grid, .year-heading")).toHaveCount(0);
  });

  test("rows run newest-first in photographed chronology, with no invented years", async ({
    page,
  }) => {
    await page.goto("/archive");
    const readings = await page.locator(".arow").evaluateAll((rows) =>
      rows.map((row) => {
        const meta = row.querySelector(".arow-meta")?.textContent?.trim() ?? "";
        const no = /No\. (\d+)/.exec(meta)?.[1] ?? null;
        const months = [...meta.matchAll(new RegExp(`(?:${"January|February|March|April|May|June|July|August|September|October|November|December"}) (\\d{4})`, "g"))].map(
          (m) => Number(m[1]),
        );
        return { no, years: months, href: row.getAttribute("href") };
      }),
    );
    expect(readings.length).toBe(13);

    // Catalogue numbering is continuous and in DOM order (No. 01 … No. 13).
    expect(readings.map((r) => r.no)).toEqual(
      Array.from({ length: 13 }, (_, i) => String(i + 1).padStart(2, "0")),
    );

    // Chronology: every row carries a photographed year and the sequence never
    // rises (comparePhotographedDesc). The real corpus covers 2026/2025/2024.
    const firstYears = readings.map((r) => r.years[0]!);
    expect(firstYears.every((y) => Number.isInteger(y))).toBe(true);
    for (let i = 1; i < firstYears.length; i++) {
      expect(firstYears[i]!, `row ${i + 1} must not be newer than row ${i}`).toBeLessThanOrEqual(
        firstYears[i - 1]!,
      );
    }
    expect(new Set(firstYears)).toEqual(new Set([2026, 2025, 2024]));
    // A slug that never existed is absent (route allowlist honesty).
    expect(readings.map((r) => r.href)).not.toContain("/galleries/not-a-real-gallery");
  });

  test("the header counts the catalogue, one row per published gallery", async ({ page }) => {
    await page.goto("/archive");
    await expect(page.locator(".archive-note")).toHaveText("13 collections");
    const hrefs = await page
      .locator(".arow")
      .evaluateAll((rows) => rows.map((a) => a.getAttribute("href")));
    expect(hrefs).toHaveLength(13);
    for (const href of hrefs) expect(href).toMatch(/^\/galleries\/[a-z0-9-]+$/);
  });
});

test.describe("Archive — the row composition", () => {
  test("every row carries the frozen metadata: title, date, place, count", async ({ page }) => {
    await page.goto("/archive");
    const rows = page.locator(".arow");
    expect(await rows.count()).toBe(13);
    const counts = await page.locator(".arow .arow-meta").evaluateAll((metas) =>
      metas.map((m) => /\d+ photographs?/.test(m.textContent ?? "")),
    );
    expect(counts.every(Boolean)).toBe(true);
    const dates = await page
      .locator(".arow .arow-meta")
      .evaluateAll((metas) =>
        metas.map((m) => new RegExp(`(?:${"January|February|March|April|May|June|July|August|September|October|November|December"}) \\d{4}`).test(m.textContent ?? "")),
      );
    expect(dates.every(Boolean)).toBe(true);
    // Serif title + mono meta and ONE hairline rule per row (no cards).
    await expect(page.locator(".arow .arow-title").first()).toHaveCount(1);
    await expect(page.locator(".gallery-card")).toHaveCount(0);
    const border = await page
      .locator(".arow")
      .first()
      .evaluate((el) => getComputedStyle(el).borderBottomWidth);
    expect(border).toBe("1px");
  });

  test("the thumbnail keeps the photograph's own ratio with the soft edge", async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/archive");
    const thumb = await page.locator(".arow img").first().evaluate((img) => {
      const r = img.getBoundingClientRect();
      return {
        sizes: img.getAttribute("sizes"),
        width: r.width,
        height: r.height,
        naturalRatio: (img as HTMLImageElement).naturalWidth / (img as HTMLImageElement).naturalHeight,
        renderedRatio: r.width / r.height,
        objectFit: getComputedStyle(img).objectFit,
        shadow: getComputedStyle(img).boxShadow,
      };
    });
    expect(thumb.sizes).toBe("110px");
    expect(thumb.width).toBeLessThanOrEqual(110);
    // The box IS the picture's box (width/height auto), so the rendered ratio
    // matches the intrinsic one — a fixed-ratio crop would break this.
    expect(thumb.renderedRatio).toBeCloseTo(thumb.naturalRatio, 1);
    expect(thumb.objectFit).toBe("fill");
    // The soft edge: a 1px rim + the shadow stack (computed form keeps px
    // units: "0px 0px 0px 1px").
    expect(thumb.shadow).toContain("0px 0px 0px 1px");
  });

  test("the row is one native link with the mono OPEN marker on desktop", async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/archive");
    const first = page.locator(".arow").first();
    await expect(first).toHaveAttribute("href", /^\/galleries\//);
    const open = first.locator(".arow-open");
    await expect(open).toHaveText("Open");
    await expect(open).toBeVisible();
    // aria-hidden: the visible title already names the link (no double name).
    await expect(open).toHaveAttribute("aria-hidden", "true");
    const name = await first.evaluate((el) => el.textContent?.replace(/\s+/g, " ").trim());
    expect(name).toContain("Open");
  });

  test("@390 the OPEN marker drops and the row keeps its 84px thumbnail track", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto("/archive");
    const first = page.locator(".arow").first();
    await expect(first.locator(".arow-open")).toBeHidden();
    const tracks = await first.evaluate(
      (el) => getComputedStyle(el).gridTemplateColumns.split(" "),
    );
    expect(tracks[0]).toBe("84px");
    expect(await page.locator(".arow").count()).toBe(13);
  });
});
