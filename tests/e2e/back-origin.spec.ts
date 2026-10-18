// P4/P5 FINAL TARGETED CORRECTION — IMP-04 browser-level evidence.
//
// Contract: valid Gallery discovery origins are ONLY Home (/), Archive
// (/archive), and a REAL canonical Place route (/places/{published slug});
// everything else falls back to /archive with the text "Back to Journeys".
// Header AND ending Back controls must reflect the SAME resolved origin —
// href and visible text update TOGETHER (the previous correction changed
// href for some origins but left the ending text stale, and accepted
// arbitrary /places/{segment}).
//
// The three real origins are exercised by ACTUAL USER NAVIGATION (clicking
// links) — sequential page.goto() referrer emulation is not accepted as
// evidence for those. Negative cases that cannot arise from a clickable
// link (external referrer, irrelevant same-origin routes, /places/not-real,
// malformed input) are injected via goto-referrer, which is how a real
// browser would carry them (Playwright `referer` sets the navigation
// referrer). No-JS behavior keeps the static /archive fallback.
import { expect, test } from "@playwright/test";

const GALLERY = "/galleries/lofoten-polar-night";

async function assertBackControls(page: import("@playwright/test").Page, href: string, text: string) {
  const header = page.locator(".gallery-header .back-to-origin");
  await expect(header, "header Back href").toHaveAttribute("href", href);
  await expect(header, "header Back text").toHaveText(text);
  const ending = page.locator(".gallery-ending a.origin-link").first();
  await expect(ending, "ending Back href").toHaveAttribute("href", href);
  await expect(ending, "ending Back text").toHaveText(text);
}

test.describe("IMP-04 real discovery-origin navigation (actual clicks)", () => {
  test("Home → Gallery (click) → Back to Home in header AND ending", async ({ page }) => {
    await page.goto("/");
    await page.locator("a.home-cover").first().click();
    await expect(page).toHaveURL(new RegExp(/\/galleries\//));
    await assertBackControls(page, "/", "Back to Home");
  });

  test("Archive → Gallery (click) → Back to Journeys in header AND ending", async ({ page }) => {
    await page.goto("/archive");
    // The archive is a flat row list now (the card grid left with the
    // immersive port); the row IS the link.
    await page.locator("a.arow").first().click();
    await expect(page).toHaveURL(new RegExp(/\/galleries\//));
    await assertBackControls(page, "/archive", "Back to Journeys");
  });

  test("/places/amsterdam → Gallery (click) → Back to Place in header AND ending", async ({ page }) => {
    await page.goto("/places/amsterdam");
    await page.locator(".gallery-card").first().click();
    await expect(page).toHaveURL(new RegExp(/\/galleries\//));
    await assertBackControls(page, "/places/amsterdam", "Back to Place");
  });

  test("reload after discovery keeps the resolved origin", async ({ page }) => {
    await page.goto("/");
    await page.locator("a.home-cover").first().click();
    await page.reload();
    await assertBackControls(page, "/", "Back to Home");
  });
});

test.describe("IMP-04 unsupported origins fall back to /archive", () => {
  test("direct entry (no referrer) → /archive in header AND ending", async ({ page }) => {
    await page.goto(GALLERY);
    await assertBackControls(page, "/archive", "Back to Journeys");
  });

  test("another Gallery (real click on Next Gallery) → /archive", async ({ page }) => {
    await page.goto(GALLERY);
    await page.locator(".gallery-ending a.next-title").click();
    await expect(page).toHaveURL(new RegExp(/\/galleries\//));
    await assertBackControls(page, "/archive", "Back to Journeys");
  });

  test("external referrer → /archive", async ({ page }) => {
    await page.goto(GALLERY, { referer: "https://external.example/somewhere" });
    await assertBackControls(page, "/archive", "Back to Journeys");
  });

  test("irrelevant same-origin route (/about) as referrer → /archive", async ({ page }) => {
    await page.goto(GALLERY, { referer: "http://127.0.0.1:4179/about" });
    await assertBackControls(page, "/archive", "Back to Journeys");
  });

  test("/places/not-real (NOT a canonical Place route) as referrer → /archive", async ({ page }) => {
    await page.goto(GALLERY, { referer: "http://127.0.0.1:4179/places/not-real" });
    await assertBackControls(page, "/archive", "Back to Journeys");
  });

  test("QA probe route as referrer → /archive", async ({ page }) => {
    await page.goto(GALLERY, { referer: "http://127.0.0.1:4179/qa-probe" });
    await assertBackControls(page, "/archive", "Back to Journeys");
  });

  test("malformed referrer input → /archive", async ({ page }) => {
    await page.goto(GALLERY, { referer: "not-a-url" });
    await assertBackControls(page, "/archive", "Back to Journeys");
  });

  // NOTE: no no-next gallery exists in the real corpus (all 13 chain to a
  // next gallery); the fallback-primary contract is covered by the
  // direct-entry test above and unit tests.
});

test.describe("IMP-04 no-JS fallback", () => {
  test("no-JS click navigation keeps the static /archive fallback (usable core nav)", async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto("/");
    await page.locator("a.home-cover").first().click();
    await expect(page).toHaveURL(new RegExp(/\/galleries\//));
    await assertBackControls(page, "/archive", "Back to Journeys");
    await ctx.close();
  });
});
