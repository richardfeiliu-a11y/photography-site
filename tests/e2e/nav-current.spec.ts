// P4 integration review Finding 3 — the frozen current-destination nav
// treatment (stage3a: "quiet underline/weight change") implemented at
// build time via aria-current="page" (no JS).
import { expect, test } from "@playwright/test";

test.describe("current-destination nav indicator", () => {
  for (const [route, label] of [
    ["/archive", "Archive"],
    ["/places", "Places"],
    ["/about", "About"],
  ] as const) {
    test(`${route}: ${label} link carries aria-current="page" + quiet underline`, async ({
      page,
    }) => {
      await page.goto(route);
      const link = page.locator(`header nav a[href="${route}"]`);
      await expect(link).toHaveAttribute("aria-current", "page");
      const deco = await link.evaluate((el) => {
        const s = getComputedStyle(el);
        return { textDecoration: s.textDecorationLine, color: s.color };
      });
      expect(deco.textDecoration).toContain("underline");
      // Non-current links keep the quiet state (no underline).
      const other = page.locator("header nav a:not([aria-current=page])").first();
      const otherDeco = await other.evaluate((el) => getComputedStyle(el).textDecorationLine);
      expect(otherDeco).not.toContain("underline");
    });
  }

  test("home (no nav item) leaves all nav links non-current", async ({ page }) => {
    await page.goto("/");
    const current = await page.locator("header nav a[aria-current=page]").count();
    expect(current).toBe(0);
  });
});

