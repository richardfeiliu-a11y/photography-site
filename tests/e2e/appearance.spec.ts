// E2E behavior contract for the dual-theme appearance system in the immersive
// direction (docs/IMMERSIVE_VIEWING_SPEC.md §2/§8).
//
// The page's background is the FIELD, not a fixed canvas: an ambient pair per
// page (--ground-light / --ground-dark, OKLCH, injected by Base) or the
// neutral room for pages without a subject. Themes are therefore verified via
// COMPUTED body background against the page's own --ground-<theme> value —
// never against a hard-coded rgb literal (the field is per page; the neutral
// literals are pinned in tests/e2e/immersive.spec.ts).
import { expect, test, type Page } from "@playwright/test";
import { bodyBackground, fieldSrgb, toSrgb } from "../support/colors";

const KEY = "photography.appearance";

// The control is the three-state chips radiogroup in the header (Day / Night /
// System). It replaced the Swiss cycle button + the earlier footer <select>.
const CONTROL = "[data-appearance-control]";
const BTN = (mode: string) => `[data-appearance-value="${mode}"]`;

/** The page's own field pair, and the painted background, in sRGB bytes. */
const field = fieldSrgb;

/**
 * Theme switching is a 240ms variable-swap transition (global.css: "surfaces
 * settle, nothing moves"), so the painted background right after a click is
 * still interpolating (Chromium serializes the mid-transition color as
 * oklab). Await settlement instead of sampling one frame.
 */
async function expectBackground(page: Page, target: string): Promise<void> {
  await expect.poll(() => bodyBackground(page), { timeout: 4000 }).toBe(target);
}

test.describe("appearance: top-bar radiogroup", () => {
  test("renders three text chips in the header, none of them a native select", async ({
    page,
  }) => {
    await page.goto("/");
    const group = page.locator(CONTROL);
    await expect(group).toHaveCount(1);
    await expect(group).toHaveAttribute("role", "radiogroup");
    await expect(group.locator('[role="radio"]')).toHaveCount(3);
    // Day | Night | System — in that visual (and arrow-key) order.
    const values = await group
      .locator('[role="radio"]')
      .evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.appearanceValue));
    expect(values).toEqual(["light", "dark", "system"]);
    // The header hosts it; the footer no longer does. The Swiss cycle button,
    // its glyph and any icon are gone (text chips only).
    await expect(page.locator(`.site-header ${CONTROL}`)).toHaveCount(1);
    await expect(page.locator(`.site-footer ${CONTROL}`)).toHaveCount(0);
    await expect(page.locator("select[data-appearance-select]")).toHaveCount(0);
    await expect(page.locator("[data-appearance-cycle]")).toHaveCount(0);
    await expect(page.locator(`${CONTROL} .ac-glyph`)).toHaveCount(0);
  });

  test("clicking Night sets the page's dark field and checks only that radio", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    const f = await field(page);
    await page.locator(BTN("dark")).click();
    await expectBackground(page, f.dark);
    expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe("dark");
    await expect(page.locator(BTN("dark"))).toHaveAttribute("aria-checked", "true");
    for (const other of ["light", "system"]) {
      await expect(page.locator(BTN(other))).toHaveAttribute("aria-checked", "false");
    }
  });

  test("clicking Day wins over a dark OS and persists across pages", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    const home = await field(page);
    await page.locator(BTN("light")).click();
    await expectBackground(page, home.light);
    await page.reload();
    await expectBackground(page, home.light);
    // Across pages: the field changes with the page, the THEME does not.
    await page.goto("/places");
    const places = await field(page);
    await expectBackground(page, places.light);
    // The checked state survives the navigation too.
    await expect(page.locator(BTN("light"))).toHaveAttribute("aria-checked", "true");
  });

  test("clicking System clears the override and follows the OS again", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    const f = await field(page);
    await page.locator(BTN("dark")).click();
    await expectBackground(page, f.dark);
    await page.locator(BTN("system")).click();
    expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBeNull();
    await expectBackground(page, f.light);
    await expect(page.locator(BTN("system"))).toHaveAttribute("aria-checked", "true");

    // OS flips while on System: the page follows without reload.
    await page.emulateMedia({ colorScheme: "dark" });
    await page.waitForTimeout(100);
    await expectBackground(page, f.dark);
  });

  test("a stored preference marks the matching radio on first paint", async ({ page }) => {
    await page.addInitScript(([k]) => localStorage.setItem(k!, "dark"), [KEY] as const);
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    const f = await field(page);
    await expectBackground(page, f.dark);
    await expect(page.locator(BTN("dark"))).toHaveAttribute("aria-checked", "true");
  });

  test("arrow keys move the selection inside the group", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    const f = await field(page);
    await page.locator(BTN("system")).focus();
    // Visual order is Day | Night | System, so ArrowRight from System wraps to Day.
    await page.keyboard.press("ArrowRight");
    await expectBackground(page, f.light);
    await expect(page.locator(BTN("light"))).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("ArrowLeft");
    expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBeNull();
    await expect(page.locator(BTN("system"))).toHaveAttribute("aria-checked", "true");
  });

  /**
   * Storage disabled: the arrow keys must still walk the group. Deriving the
   * current position from localStorage would always answer "system" here and
   * snap the user back to System on every keypress, so the module keeps the
   * active mode in memory.
   */
  test("arrow keys still walk the group when localStorage is unavailable", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new Error("blocked");
        },
      });
    });
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    const f = await field(page);
    await page.locator(BTN("system")).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(BTN("light"))).toHaveAttribute("aria-checked", "true");
    await expectBackground(page, f.light);
    // And one more step reaches Night rather than restarting from System.
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(BTN("dark"))).toHaveAttribute("aria-checked", "true");
    await expectBackground(page, f.dark);
  });
});

test.describe("appearance: system following", () => {
  test("prefers-color-scheme: dark renders the dark half of the field", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    const f = await field(page);
    await expectBackground(page, f.dark);
    // color-scheme must match the active mode (spec §8).
    const scheme = await page.evaluate(
      () => getComputedStyle(document.documentElement).colorScheme,
    );
    expect(scheme).toBe("dark");
  });

  test("prefers-color-scheme: light renders the light half of the field", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    const f = await field(page);
    await expectBackground(page, f.light);
  });

  test("explicit light choice wins over a dark system and persists across refresh + pages", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    const group = page.locator(CONTROL);
    await expect(group).toBeVisible();
    const home = await field(page);
    await page.locator(BTN("light")).click();
    await expectBackground(page, home.light);
    expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe("light");

    await page.reload();
    await expectBackground(page, home.light);
    await page.goto("/places");
    const places = await field(page);
    await expectBackground(page, places.light);
  });

  test("explicit dark choice wins over a light system and persists across pages", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    await page.locator(BTN("dark")).click();
    const home = await field(page);
    await expectBackground(page, home.dark);
    await page.goto("/archive");
    const archive = await field(page);
    await expectBackground(page, archive.dark);
  });
});

test.describe("appearance: degraded inputs", () => {
  test("invalid stored value falls back to system (dark OS → dark field)", async ({ page }) => {
    await page.addInitScript(
      ([k]) => localStorage.setItem(k!, "unexpected"),
      [KEY] as const,
    );
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    const f = await field(page);
    await expectBackground(page, f.dark);
    // The control still renders, normalized to system.
    await expect(page.locator(BTN("system"))).toHaveAttribute("aria-checked", "true");
  });

  test("localStorage throwing does not break the page or the theme", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new Error("blocked");
        },
      });
    });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    const f = await field(page);
    await expectBackground(page, f.dark);
    // The control still works for this page view.
    await page.locator(BTN("light")).click();
    await expectBackground(page, f.light);
  });

  test("with JS disabled the media query still themes the page and no dead control shows", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      colorScheme: "dark",
    });
    const page = await context.newPage();
    await page.goto("/");
    // No JS → no data-theme; the prefers-color-scheme branch paints the dark
    // half of the field and the chip group stays hidden (never a dead control).
    const painted = await page.evaluate(() => ({
      theme: document.documentElement.dataset.theme ?? null,
      body: getComputedStyle(document.body).backgroundColor,
      dark: getComputedStyle(document.documentElement).getPropertyValue("--ground-dark").trim(),
    }));
    expect(painted.theme).toBeNull();
    const [bodyRgb, darkRgb] = await toSrgb(page, [painted.body, painted.dark]);
    expect(bodyRgb).toBe(darkRgb);
    await expect(page.locator(CONTROL)).toBeHidden();
    await context.close();
  });
});
