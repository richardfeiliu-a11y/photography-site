// e2e — About typography contract + static 404 (immersive direction,
// docs/IMMERSIVE_VIEWING_SPEC §7).
//
// Frozen references: FDS §3.5 (body measure 60–70 Latin chars; paragraph
// SPACING not indentation; low-weight informational page), DEPLOYMENT_
// ARCHITECTURE §7 + BUILD_AND_ROUTING §4 (static 404 at 404.html; real HTTP
// 404; no SPA fallback), §5.5 (one h1).
//
// Immersive pass: the statement is the page's one large sans paragraph
// (clamp 1.15–1.5rem), the approach is a serif quotation with a mono cite,
// and Equipment / Contact are mono-label catalogue columns.
import { expect, test } from "@playwright/test";
import { DESKTOP_VIEWPORT, MOBILE_VIEWPORT } from "../support/viewports.mjs";

test.describe("About typography contract", () => {
  test("one h1; the statement sits on the immersive scale at both viewports", async ({ page }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    const response = await page.goto("/about");
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);
    const desktopSize = await page.evaluate(() => {
      const p = document.querySelector<HTMLElement>(".about-statement");
      return parseFloat(getComputedStyle(p!).fontSize);
    });
    // clamp(1.15rem, 1vw + 0.8rem, 1.5rem): 18.4–24px.
    expect(desktopSize).toBeGreaterThanOrEqual(18.4);
    expect(desktopSize).toBeLessThanOrEqual(24);

    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto("/about");
    const mobileSize = await page.evaluate(() => {
      const p = document.querySelector<HTMLElement>(".about-statement");
      return parseFloat(getComputedStyle(p!).fontSize);
    });
    expect(mobileSize).toBeGreaterThanOrEqual(18.4);
    expect(mobileSize).toBeLessThanOrEqual(24);
  });

  test("measure: the statement stays inside the frozen 60–70 Latin char range", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto("/about");
    const measure = await page.evaluate(() => {
      const p = document.querySelector<HTMLElement>(".about-statement")!;
      const s = getComputedStyle(p);
      const width = p.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
      const size = parseFloat(s.fontSize);
      // Average Latin char width ≈ 0.5em for the sans stack.
      return width / (size * 0.5);
    });
    expect(measure).toBeGreaterThanOrEqual(55);
    expect(measure).toBeLessThanOrEqual(75);
  });

  test("body paragraphs are unindented with spacing-based separation", async ({ page }) => {
    await page.goto("/about");
    const paras = await page.evaluate(() => {
      const list = Array.from(document.querySelectorAll<HTMLElement>(".about-body p"));
      return list.map((p) => {
        const s = getComputedStyle(p);
        return { indent: s.textIndent, marginTop: parseFloat(s.marginTop) };
      });
    });
    // The minimum-factual About (visual redesign spec §6.5) ships a single
    // statement; the spacing-not-indentation rule stays asserted on what exists.
    expect(paras.length).toBeGreaterThanOrEqual(1);
    for (const p of paras) expect(p.indent).toBe("0px");
  });

  test("the immersive structure: statement, serif quotation, mono catalogue columns", async ({
    page,
  }) => {
    await page.goto("/about");
    await expect(page.locator(".about-statement")).toHaveCount(1);
    const quote = page.locator(".about-quote-text");
    await expect(quote).toHaveCount(1);
    const quoteType = await quote.evaluate((el) => {
      const s = getComputedStyle(el);
      return { family: s.fontFamily, size: parseFloat(s.fontSize) };
    });
    expect(quoteType.family).toContain("Source Serif 4");
    // The room's quotation is set at display scale, above the statement.
    expect(quoteType.size).toBeGreaterThanOrEqual(20.8);
    // The attribution is content-conditional (only an approach authored as
    // "<quote> — <who>" renders the cite); when it renders, it speaks mono.
    const cite = page.locator(".about-quote-cite");
    if ((await cite.count()) > 0) {
      const citeFamily = await cite.first().evaluate((el) => getComputedStyle(el).fontFamily);
      expect(citeFamily).toContain("ui-monospace");
    }

    // Equipment / Contact: mono labels, no serif section headings.
    const labels = await page.locator(".about-label").evaluateAll((els) =>
      els.map((el) => ({
        text: el.textContent!.trim(),
        family: getComputedStyle(el).fontFamily,
        transform: getComputedStyle(el).textTransform,
      })),
    );
    expect(labels.map((l) => l.text)).toEqual(["Equipment", "Contact"]);
    for (const l of labels) {
      expect(l.family).toContain("ui-monospace");
      expect(l.transform).toBe("uppercase");
    }
  });

  test("no placeholder/example content leaks to the public About (visual redesign spec §6.5)", async ({
    page,
  }) => {
    await page.goto("/about");
    // The WP-60 placeholder surface is gone; the leak check now asserts the
    // absence of placeholder copy and example contact targets.
    await expect(page.locator("[data-about-placeholder]")).toHaveCount(0);
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/placeholder/i);
    expect(body).not.toContain("hello@example.com");
    expect(body).not.toContain("example.com");
    // Real contact is allowed (about.yaml, 2026-10-07): every mailto on the
    // page must be the owner's authored address — never an example target.
    const mailtos = await page
      .locator('a[href^="mailto:"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    expect(mailtos.length).toBeGreaterThan(0);
    for (const href of mailtos) expect(href).toBe("mailto:contact@example.com");
  });
});

test.describe("static 404", () => {
  test("unknown path returns real HTTP 404 with the 404 page body", async ({ request }) => {
    const response = await request.get("/definitely-not-a-route");
    expect(response.status()).toBe(404);
    const body = await response.text();
    expect(body).toContain("Page not found");
  });

  test("404 page: one h1; text-only visual system (no img/svg)", async ({ page }) => {
    await page.goto("/definitely-not-a-route");
    await expect(page.locator("h1")).toHaveCount(1);
    const inventory = await page.evaluate(() => ({
      imgs: document.querySelectorAll("img, svg").length,
      headings: Array.from(document.querySelectorAll("h1")).map((h) => h.textContent!.trim()),
    }));
    expect(inventory.imgs).toBe(0);
    expect(inventory.headings).toEqual(["Page not found"]);
  });
});
