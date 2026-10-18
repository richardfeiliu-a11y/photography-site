// Immersive Viewing — the direction's own contract
// (docs/IMMERSIVE_VIEWING_SPEC.md; approved 2026-10-18).
//
// This file is the successor to the deleted Swiss cover-layer contract
// (tests/e2e/swiss-complete.spec.ts). It pins the seven properties the
// direction is defined by, as the values the built pages actually produce:
//
//   1. the field: every page paints its own ground (ambient pair / neutral);
//   2. a Gallery paints ITS OWN collection's ambient, not the home room;
//   3. Day / Night / System chips: selection, exclusivity, storage, system
//      following;
//   4. the photograph edge: a 1px rim + soft shadow (no frame, no mat);
//   5. one plate measure per sequence (no per-orientation width, no 1100 cap);
//   6. the colophon footer;
//   7. the pruned surfaces stay pruned (Overview / position annotation).
import { expect, test, type Page } from "@playwright/test";
import { bodyBackground, fieldSrgb } from "../support/colors";
import { hydrateAllMediaSlots } from "../support/media-slots";
import { DESKTOP_VIEWPORT } from "../support/viewports.mjs";

// --- Field values (probed from the built pages, 2026-10-18) ----------------
// Ambient pairs come from generated/atmosphere.json (cover-derived OKLCH);
// the neutral room is Base.astro's fallback. Both halves are always written,
// so the pair can be read in either theme.
const NEUTRAL = { light: "oklch(0.945 0.012 255)", dark: "oklch(0.13 0.012 265)" };
const LOFOTEN = { light: "oklch(0.945 0.029 255.828)", dark: "oklch(0.175 0.021 255.828)" };
const ICELAND = { light: "oklch(0.945 0.017 224.099)", dark: "oklch(0.175 0.012 224.099)" };
const AEGEAN = { light: "oklch(0.945 0.022 168.525)", dark: "oklch(0.139 0.015 168.525)" };

/** The page's field pair as the built page writes it. */
async function field(page: Page): Promise<{ light: string; dark: string }> {
  return page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return {
      light: s.getPropertyValue("--ground-light").trim(),
      dark: s.getPropertyValue("--ground-dark").trim(),
    };
  });
}

test.describe("1. the field is the page's own ground", () => {
  test("home paints the featured cover's ambient pair (Day and Night)", async ({ page }) => {
    await page.goto("/");
    const f = await field(page);
    expect(f).toEqual(LOFOTEN);
    // The painted surface IS that value, not a fixed white/near-black canvas.
    const home = await fieldSrgb(page);
    expect(await bodyBackground(page)).toBe(home.light);

    await page.addInitScript(() => localStorage.setItem("photography.appearance", "dark"));
    await page.goto("/");
    const homeDark = await fieldSrgb(page);
    expect(await bodyBackground(page)).toBe(homeDark.dark);
  });

  test("a subject-less page paints the neutral room instead", async ({ page }) => {
    for (const path of ["/archive", "/places", "/about"]) {
      await page.goto(path);
      const f = await field(page);
      expect(f, `${path} is neutral`).toEqual(NEUTRAL);
      const [bodyRgb, neutralRgb] = [
        await bodyBackground(page),
        (await fieldSrgb(page)).light,
      ];
      expect(bodyRgb, `${path} paints the neutral field`).toBe(neutralRgb);
    }
  });

  test("theme-color metas carry the page's own ambient (browser chrome matches)", async ({
    page,
  }) => {
    await page.goto("/");
    const homeChrome = await page.evaluate(() =>
      [...document.querySelectorAll('meta[name="theme-color"]')].map((m) =>
        `${m.getAttribute("media")}=${m.getAttribute("content")}`,
      ),
    );
    expect(homeChrome).toEqual([
      "(prefers-color-scheme: light)=#e0eeff",
      "(prefers-color-scheme: dark)=#0a111a",
    ]);
    await page.goto("/archive");
    const neutralChrome = await page.evaluate(() =>
      [...document.querySelectorAll('meta[name="theme-color"]')].map((m) =>
        `${m.getAttribute("media")}=${m.getAttribute("content")}`,
      ),
    );
    expect(neutralChrome).toEqual([
      "(prefers-color-scheme: light)=#e8edf5",
      "(prefers-color-scheme: dark)=#05070c",
    ]);
  });
});

test.describe("2. a Gallery paints its own collection's room", () => {
  test("the Lofoten gallery shares the home room; Iceland and Aegean do not", async ({ page }) => {
    await page.goto("/");
    expect(await field(page)).toEqual(LOFOTEN);

    await page.goto("/galleries/lofoten-polar-night");
    expect(await field(page)).toEqual(LOFOTEN); // same cover → same room
    expect(await bodyBackground(page)).toBe((await fieldSrgb(page)).light);

    for (const [path, expected] of [
      ["/galleries/iceland", ICELAND],
      ["/galleries/aegean", AEGEAN],
    ] as const) {
      await page.goto(path);
      expect(await field(page), `${path} ambient`).toEqual(expected);
      expect(await bodyBackground(page), `${path} painted field`).toBe(
        (await fieldSrgb(page)).light,
      );
      expect(expected.light, `${path} differs from the home room`).not.toBe(LOFOTEN.light);
      expect(expected.light, `${path} differs from the neutral room`).not.toBe(NEUTRAL.light);
    }
  });

  test("the viewer reuses the room's deep half (bar is opaque, never a scrim)", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/galleries/lofoten-polar-night");
    await page.locator(".figure-open").first().click();
    const bar = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>(".lb-bar")!;
      const s = getComputedStyle(el);
      return {
        background: s.backgroundColor,
        position: s.position,
        deepLight: getComputedStyle(document.documentElement).getPropertyValue("--deep-light").trim(),
      };
    });
    expect(bar.background).not.toBe("rgba(0, 0, 0, 0)");
    expect(bar.position).toBe("sticky");
    expect(bar.deepLight).not.toBe("");
    await page.keyboard.press("Escape");
  });
});

test.describe("3. Day / Night / System chips", () => {
  test("clicking a chip applies it, marks exactly one checked chip and stores the value", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    const f = await fieldSrgb(page);
    const chips = page.locator("[data-appearance-value]");
    await expect(chips).toHaveCount(3);

    await page.locator('[data-appearance-value="dark"]').click();
    await expect(chips.nth(1)).toHaveAttribute("aria-checked", "true");
    await expect(page.locator('[data-appearance-value="light"]')).toHaveAttribute(
      "aria-checked",
      "false",
    );
    await expect(page.locator('[data-appearance-value="system"]')).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(await page.evaluate(() => localStorage.getItem("photography.appearance"))).toBe("dark");
    await expect.poll(() => bodyBackground(page), { timeout: 4000 }).toBe(f.dark);

    await page.locator('[data-appearance-value="light"]').click();
    await expect(chips.nth(0)).toHaveAttribute("aria-checked", "true");
    expect(await page.evaluate(() => localStorage.getItem("photography.appearance"))).toBe("light");
    await expect.poll(() => bodyBackground(page), { timeout: 4000 }).toBe(f.light);
  });

  test("System clears the stored override and follows the OS again", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    const f = await fieldSrgb(page);
    await page.locator('[data-appearance-value="dark"]').click();
    await expect.poll(() => bodyBackground(page), { timeout: 4000 }).toBe(f.dark);

    await page.locator('[data-appearance-value="system"]').click();
    expect(await page.evaluate(() => localStorage.getItem("photography.appearance"))).toBeNull();
    await expect(page.locator('[data-appearance-value="system"]')).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect.poll(() => bodyBackground(page), { timeout: 4000 }).toBe(f.light);

    // The OS flips while System is selected: the page follows without a reload.
    await page.emulateMedia({ colorScheme: "dark" });
    await expect.poll(() => bodyBackground(page), { timeout: 4000 }).toBe(f.dark);
  });

  test("a stored Night preference paints Night before the first interaction", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("photography.appearance", "dark"));
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
    expect(await bodyBackground(page)).toBe((await fieldSrgb(page)).dark);
    await expect(page.locator('[data-appearance-value="dark"]')).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});

test.describe("4. the photograph edge (rim + soft shadow, never a frame)", () => {
  // The immersive rule is one edge treatment on every plate: gallery plates,
  // strip cards, archive rows, the viewer plate AND the opening cover.
  test("the gallery plate carries the 1px rim and the wide soft shadow", async ({ page }) => {
    await page.goto("/galleries/lofoten-polar-night");
    const plate = await page.locator(".gallery-figure img").first().evaluate((img) => {
      const s = getComputedStyle(img);
      return { shadow: s.boxShadow, radius: s.borderRadius, filter: s.filter };
    });
    expect(plate.shadow).not.toBe("none");
    expect(plate.shadow).toContain("0px 0px 0px 1px");
    // No frame language: square corners, no filter/glow.
    expect(plate.radius).toBe("0px");
    expect(plate.filter).toBe("none");
  });

  test("the cover, strip cards, archive rows and the viewer plate share the same edge", async ({
    page,
  }) => {
    await page.goto("/");
    const cover = await page
      .locator(".home-cover-img")
      .evaluate((el) => getComputedStyle(el).boxShadow);
    expect(cover).toContain("0px 0px 0px 1px");

    const card = await page
      .locator(".strip .gallery-card .card-cover")
      .first()
      .evaluate((el) => getComputedStyle(el).boxShadow);
    expect(card).toContain("0px 0px 0px 1px");

    await page.goto("/archive");
    const row = await page
      .locator(".arow-img")
      .first()
      .evaluate((el) => getComputedStyle(el).boxShadow);
    expect(row).toContain("0px 0px 0px 1px");

    await page.goto("/galleries/lofoten-polar-night");
    const viewer = await page
      .locator(".lightbox-img")
      .evaluate((el) => getComputedStyle(el).boxShadow);
    expect(viewer).toContain("0px 0px 0px 1px");
  });

  test("the cover is rendered whole inside its stage (contain, never cropped)", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/");
    await page.evaluate(async () => {
      const img = document.querySelector<HTMLImageElement>(".home-cover-img")!;
      if (!img.complete) await new Promise((r) => img.addEventListener("load", r, { once: true }));
      await img.decode().catch(() => {});
    });
    const cover = await page.evaluate(() => {
      const img = document.querySelector<HTMLImageElement>(".home-cover-img")!;
      const r = img.getBoundingClientRect();
      const stage = document.querySelector<HTMLElement>(".cover-stage")!.getBoundingClientRect();
      return {
        objectFit: getComputedStyle(img).objectFit,
        rendered: +(r.width / r.height).toFixed(2),
        intrinsic: +(img.naturalWidth / img.naturalHeight).toFixed(2),
        insideStage: r.top >= stage.top - 1 && r.bottom <= stage.bottom + 1,
        radius: getComputedStyle(img).borderRadius,
      };
    });
    expect(cover.objectFit).toBe("contain");
    expect(cover.rendered).toBeCloseTo(cover.intrinsic, 1);
    expect(cover.insideStage).toBe(true);
    expect(cover.radius).toBe("0px");
  });
});

test.describe("5. one plate measure per sequence", () => {
  test("the first four plates of a gallery are all the column measure (>1100px at 1440)", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/galleries/lofoten-polar-night");
    // Plates after the first are aspect-reserved slots until hydrated.
    await hydrateAllMediaSlots(page);
    const plates = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>(".gallery-figure")].slice(0, 4).map((fig) => {
        const img = fig.querySelector<HTMLImageElement>("img");
        const r = img?.getBoundingClientRect();
        return {
          isPortrait: fig.classList.contains("is-portrait"),
          width: r ? Math.round(r.width) : 0,
          height: r ? Math.round(r.height) : 0,
          objectFit: img ? getComputedStyle(img).objectFit : null,
        };
      }),
    );
    expect(plates).toHaveLength(4);
    const widths = new Set(plates.map((p) => p.width));
    expect(widths.size, "one width for the whole sequence").toBe(1);
    expect(plates[0]!.width).toBeGreaterThan(1100);
    // The aspect sets the height: a portrait plate is taller than a landscape
    // one at the SAME width (the retired per-orientation cap is gone).
    for (const plate of plates) {
      expect(plate.objectFit).toBe("contain");
      expect(plate.height).toBeGreaterThan(0);
    }
    const portraits = plates.filter((p) => p.isPortrait);
    const landscapes = plates.filter((p) => !p.isPortrait);
    if (portraits.length > 0 && landscapes.length > 0) {
      expect(portraits[0]!.height).toBeGreaterThan(landscapes[0]!.height);
    }
  });

  test("no sequence wrapper narrows a plate below the column (§5)", async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/galleries/netherlands");
    const geometry = await page.evaluate(() => {
      const sequence = document.querySelector<HTMLElement>(".gallery-sequence")!.getBoundingClientRect();
      const widths = [...document.querySelectorAll<HTMLElement>(".gallery-figure")].map((fig) =>
        Math.round(fig.getBoundingClientRect().width),
      );
      return {
        sequence: Math.round(sequence.width),
        min: Math.min(...widths),
        max: Math.max(...widths),
      };
    });
    expect(geometry.min).toBe(geometry.sequence);
    expect(geometry.max).toBe(geometry.sequence);
  });
});

test.describe("6. the colophon", () => {
  test("the footer closes the page in the site's own voice", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator(".site-footer");
    await expect(footer).toHaveCount(1);
    await expect(footer.locator(".site-footer-action")).toHaveText("Browse the full archive");
    await expect(footer.locator(".site-footer-fine")).toContainText(
      "Richard Photographs · Set in Source Serif 4 and Source Sans 3",
    );
    await expect(footer.locator(".site-footer-sig")).toHaveText("Richard Photographs");
    // It is a colophon, not a three-column sitemap: no sitemap grid, no
    // appearance control.
    await expect(page.locator(".site-sitemap, .footer-grid")).toHaveCount(0);
    await expect(page.locator(".site-footer [data-appearance-control]")).toHaveCount(0);

    // On a Gallery the colophon stays the same block (minus the home-only
    // archive exit, which the header/ending already carry).
    await page.goto("/galleries/lofoten-polar-night");
    await expect(page.locator(".site-footer .site-footer-fine")).toContainText(
      "Set in Source Serif 4 and Source Sans 3",
    );
    await expect(page.locator(".site-footer .site-footer-nav a")).toHaveCount(3);
  });
});

test.describe("7. the pruned surfaces stay pruned", () => {
  test("no Overview / Contact Sheet / position annotation anywhere in the built pages", async ({
    page,
  }) => {
    for (const path of ["/", "/archive", "/galleries/lofoten-polar-night", "/places"]) {
      await page.goto(path);
      for (const sel of [
        "[data-overview-trigger]",
        "[data-overview-layer]",
        "[data-overview-grid]",
        "[data-overview-thumb]",
        "[data-overview-trigger-template]",
        "[data-overview-layer-template]",
        "[data-position-annotation]",
      ]) {
        await expect(page.locator(sel), `${path} ${sel}`).toHaveCount(0);
      }
      const text = await page.locator("body").textContent();
      expect(text, `${path} Contact Sheet copy`).not.toContain("Contact Sheet");
    }
  });

  test("the viewer's own counter carries the reading position instead", async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/galleries/lofoten-polar-night");
    await page.locator(".figure-open").first().click();
    await expect(page.locator("[data-lb-count]")).toHaveText("01 / 11");
    await expect(page.locator(".lb-bar-title")).toHaveText("Lofoten, Polar Night");
    await expect(page.locator(".lb-bar-meta")).toContainText("January 2025 · 11 photographs");
    await page.keyboard.press("Escape");
  });
});
