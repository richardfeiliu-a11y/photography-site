// Monograph Lightbox (spec §6.3/§12/§13): native dialog, keyboard, swipe,
// EXIF plaque, focus management. Enhancement-only (absent without JS).
import { expect, test } from "@playwright/test";

const GALLERY = "/galleries/lofoten-polar-night";

test.describe("Lightbox", () => {
  test("no JS: dialog and open triggers are absent; sequence intact", async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(GALLERY);
    await expect(page.locator("dialog[data-lightbox]")).toHaveCount(0);
    await expect(page.locator(".figure-open")).toHaveCount(0);
    await expect(page.locator(".gallery-figure")).toHaveCount(11);
    await ctx.close();
  });

  test("open control exists per figure and opens the viewer at that photo", async ({ page }) => {
    await page.goto(GALLERY);
    const triggers = page.locator(".figure-open");
    await expect(triggers).toHaveCount(11);

    await triggers.nth(2).click();
    const dialog = page.locator("dialog[data-lightbox]");
    await expect(dialog).toHaveJSProperty("open", true);
    await expect(dialog).toHaveAttribute("aria-label", "Photo viewer");

    const info = await page.evaluate(() => {
      const img = document.querySelector<HTMLImageElement>(".lightbox-img")!;
      const avif = document.querySelector<HTMLSourceElement>("[data-lb-avif]")!;
      return {
        src: img.getAttribute("src") ?? "",
        avifSrcset: avif.getAttribute("srcset") ?? "",
        alt: img.alt,
        count: document.querySelector("[data-lb-count]")?.textContent,
        title: document.querySelector("[data-lb-title]")?.textContent,
      };
    });
    // AVIF is the responsive primary; the big rungs must be offered.
    expect(info.avifSrcset).toContain("2560w");
    expect(info.src).toMatch(/\.jpg$/);
    expect(info.alt).toBeTruthy();
    expect(info.count).toBe("03 / 11");
    expect(info.title).toContain("Lofoten");
  });

  test("keyboard: arrows navigate (wrapping); Escape closes and restores focus", async ({
    page,
  }) => {
    await page.goto(GALLERY);
    const trigger = page.locator(".figure-open").nth(2);
    await trigger.click();
    const count = () => page.locator("[data-lb-count]").textContent();

    await page.keyboard.press("ArrowRight");
    await expect.poll(count).toBe("04 / 11");
    await page.keyboard.press("ArrowLeft");
    await expect.poll(count).toBe("03 / 11");

    // From the first photo, ArrowLeft wraps to the last.
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect.poll(count).toBe("01 / 11");
    await page.keyboard.press("ArrowLeft");
    await expect.poll(count).toBe("11 / 11");

    await page.keyboard.press("Escape");
    await expect(page.locator("dialog[data-lightbox]")).toHaveJSProperty("open", false);
    await expect(trigger).toBeFocused();
  });

  test("clicking the backdrop closes the dialog", async ({ page }) => {
    await page.goto(GALLERY);
    await page.locator(".figure-open").first().click();
    const dialog = page.locator("dialog[data-lightbox]");
    await expect(dialog).toHaveJSProperty("open", true);
    // Empty stage area: far-left gutter below the top bar and above the
    // centered arrow control, outside the contain-fit image.
    await dialog.click({ position: { x: 6, y: 140 } });
    await expect(dialog).toHaveJSProperty("open", false);
  });

  test("EXIF plaque shows the non-sensitive camera labels, never GPS/serial", async ({
    page,
  }) => {
    await page.goto(GALLERY);
    await page.locator(".figure-open").nth(5).click();
    const chip = page.locator("[data-lb-exif]");
    await expect(chip).toBeVisible();
    const plaque = await page.locator("[data-lb-exif-box]").innerText();
    expect(plaque).toMatch(/ILCE-7CR/);
    expect(plaque).toMatch(/FE 24-70/);
    expect(plaque).toMatch(/ISO/);
    expect(plaque).not.toMatch(/gps|lat|lon|serial|owner/i);
  });

  test("touch swipe advances / goes back", async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
    });
    const mobile = await ctx.newPage();
    await mobile.goto(GALLERY);
    await mobile.locator(".figure-open").first().click();
    const count = mobile.locator("[data-lb-count]");
    await expect(count).toHaveText("01 / 11");

    const swipe = (fromX: number, toX: number) =>
      mobile.evaluate(
        ({ fromX, toX }) => {
          const stage = document.querySelector("[data-lb-stage]")!;
          const y = Math.round(window.innerHeight / 2);
          const mk = (x: number) =>
            new Touch({ identifier: 1, target: stage, clientX: x, clientY: y });
          stage.dispatchEvent(new TouchEvent("touchstart", { touches: [mk(fromX)] }));
          stage.dispatchEvent(
            new TouchEvent("touchend", { changedTouches: [mk(toX)] }),
          );
        },
        { fromX, toX },
      );
    await swipe(300, 40);
    await expect(count).toHaveText("02 / 11");
    await swipe(40, 300);
    await expect(count).toHaveText("01 / 11");
    await ctx.close();
  });
});
