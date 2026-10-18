// Visual-precision contracts for the immersive direction
// (docs/IMMERSIVE_VIEWING_SPEC.md §4/§5/§7).
//
// The Monograph "French mat / serif wordmark / golden-ratio wall / plaque"
// geometry and the Swiss cover-layer contract are both gone. What survives,
// re-anchored on the current surfaces:
//   1. reveal can never strand a reading position at opacity 0 (incl. print) —
//      the reveal targets are the Gallery plates (the Home wall is gone);
//   2. the Home index strip keeps its catalogue rhythm (equal cards, one
//      horizontal track on desktop, one column on phones);
//   3. the appearance chips keep their geometry (44px tall, one row, filled
//      checked state) and still theme the page;
//   4. the per-figure open trigger covers the media slot only, never the
//      figcaption;
//   5. across viewports: no horizontal overflow, 44px targets, single-line
//      wordmark, and the colophon footer structure.
import { expect, test } from "@playwright/test";
import { bodyBackground, fieldSrgb } from "../support/colors";
import { MOBILE_VIEWPORT } from "../support/viewports.mjs";

const DESKTOP = { width: 1440, height: 900 };
const GALLERY = "/galleries/lofoten-polar-night";

const pendingOpacity = () =>
  Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]")).filter(
    (el) => parseFloat(getComputedStyle(el).opacity) < 1,
  ).length;

test.describe("visual precision — reveal safety on the Gallery sequence", () => {
  test("print media depicts every plate (no scroll can fire the observer)", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(GALLERY);
    // A printed sheet has no scroll, so the observer never runs for the
    // below-fold plates. The print stylesheet must assert their visibility.
    await page.emulateMedia({ media: "print" });
    const hidden = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"))
        .filter((el) => parseFloat(getComputedStyle(el).opacity) < 1)
        .map((el) => el.className),
    );
    expect(hidden).toEqual([]);
    await page.emulateMedia({ media: "screen" });
  });

  test("the beforeprint hook lifts every pending plate", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(GALLERY);
    // Some engines emit beforeprint before the print stylesheet is queried;
    // the JS hook is the belt to that braces.
    await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
    const blank = await page.evaluate(pendingOpacity);
    expect(blank).toBe(0);
  });

  test("a fast scroll to the bottom reveals the whole sequence", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(GALLERY);
    // The reported "fast scroll" case: one jump to the end, no incremental
    // scrolling. The look-ahead margin plus threshold must still fade the
    // plates in rather than stranding them at opacity 0.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(() => page.evaluate(pendingOpacity), { timeout: 10000 }).toBe(0);
  });

  test("without the JS bootstrap the pending state is inert (static visibility)", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(GALLERY);
    const result = await page.evaluate(() => {
      // Drop the script-alive marker: this is the print-engine / snapshot /
      // module-never-ran situation, where nothing can lift the pending class.
      document.documentElement.classList.remove("js");
      const el = document.querySelector<HTMLElement>("[data-reveal]")!;
      // Force the exact state the script would create, with nothing else on
      // the element that could mask it.
      el.classList.remove("is-in");
      el.classList.add("reveal-pending");
      return parseFloat(getComputedStyle(el).opacity);
    });
    expect(result).toBe(1);
  });

  test("a plate in the first viewport is never hidden by the reveal enhancement", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 2400 });
    await page.goto(GALLERY);
    // Read BEFORE any scroll: everything the reader can see must be opaque.
    const hidden = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"))
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.top < window.innerHeight && r.bottom > 0;
        })
        .filter((el) => parseFloat(getComputedStyle(el).opacity) < 1)
        .map((el) => el.className),
    );
    expect(hidden).toEqual([]);
  });

  test("scrolling the sequence reveals every plate with no blank stragglers", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(GALLERY);
    await page.evaluate(async () => {
      const step = Math.max(200, Math.floor(window.innerHeight * 0.75));
      for (let y = 0; y <= document.documentElement.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 40));
      }
    });
    await expect.poll(() => page.evaluate(pendingOpacity), { timeout: 10000 }).toBe(0);
  });
});

test.describe("visual precision — the Home index strip", () => {
  test("desktop: one horizontal track of equal cards", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/");
    const strip = await page.evaluate(() => {
      const track = document.querySelector<HTMLElement>(".strip")!;
      const items = Array.from(track.querySelectorAll<HTMLElement>(".strip-item"));
      return {
        display: getComputedStyle(track).display,
        overflowX: getComputedStyle(track).overflowX,
        snap: getComputedStyle(track).scrollSnapType,
        widths: items.map((el) => Math.round(el.getBoundingClientRect().width)),
        tops: items.map((el) => Math.round(el.getBoundingClientRect().top)),
        rows: new Set(items.map((el) => Math.round(el.getBoundingClientRect().top))).size,
      };
    });
    expect(strip.display).toBe("flex");
    expect(strip.overflowX).toBe("auto");
    expect(strip.snap).toContain("x");
    // One row: every card shares one top and one width (the track is the
    // rhythm — the Swiss 3-column wall grid is gone).
    expect(strip.rows).toBe(1);
    expect(new Set(strip.widths).size).toBe(1);
    expect(strip.widths[0]).toBeGreaterThanOrEqual(230);
    expect(strip.widths[0]).toBeLessThanOrEqual(330);
  });

  test("@390: the strip stacks into one column", async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto("/");
    const strip = await page.evaluate(() => {
      const track = document.querySelector<HTMLElement>(".strip")!;
      const items = Array.from(track.querySelectorAll<HTMLElement>(".strip-item"));
      return {
        direction: getComputedStyle(track).flexDirection,
        overflowX: getComputedStyle(track).overflowX,
        rows: new Set(items.map((el) => Math.round(el.getBoundingClientRect().top))).size,
        itemWidth: Math.round(items[0]!.getBoundingClientRect().width),
        trackWidth: Math.round(track.getBoundingClientRect().width),
      };
    });
    expect(strip.direction).toBe("column");
    expect(strip.overflowX).toBe("visible");
    expect(strip.rows).toBeGreaterThan(1);
    expect(Math.abs(strip.itemWidth - strip.trackWidth)).toBeLessThanOrEqual(1);
  });
});

test.describe("visual precision — desktop appearance chips", () => {
  test("the appearance control is a three-chip radiogroup in the header", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/");
    const group = page.locator("[data-appearance-control]");
    await expect(group).toBeVisible();
    await expect(group.locator('[role="radio"]')).toHaveCount(3);
    const style = await group.evaluate((el) => {
      const s = getComputedStyle(el);
      const buttons = [...el.querySelectorAll<HTMLElement>('button[role="radio"]')];
      const first = buttons[0]!;
      const box = first.getBoundingClientRect();
      return {
        display: s.display,
        borderWidth: parseFloat(s.borderTopWidth),
        btnH: Math.round(box.height),
        rowCount: new Set(buttons.map((b) => Math.round(b.getBoundingClientRect().top))).size,
        groupWidth: Math.round(el.getBoundingClientRect().width),
        buttons: buttons.map((b) => ({
          mode: b.dataset.appearanceValue,
          label: b.textContent!.trim(),
          borderLeft: parseFloat(getComputedStyle(b).borderLeftWidth),
        })),
      };
    });
    // Chip geometry: a square-cornered hairline group, 44px tall targets.
    // (The computed display blockifies to "flex" inside the header's flex row.)
    expect(["inline-flex", "flex"]).toContain(style.display);
    expect(style.borderWidth).toBe(1);
    expect(style.btnH).toBe(44);
    expect(style.rowCount).toBe(1);
    expect(style.groupWidth).toBeGreaterThan(style.btnH * 3); // one row, not stacked
    expect(style.buttons.map((b) => b.mode)).toEqual(["light", "dark", "system"]);
    expect(style.buttons.map((b) => b.label)).toEqual(["Day", "Night", "System"]);
    // Hairline dividers BETWEEN the chips (the group carries the outer edge).
    expect(style.buttons[0]!.borderLeft).toBe(0);
    for (const b of style.buttons.slice(1)) expect(b.borderLeft).toBe(1);

    // The checked chip is distinguished by FILL: selected = the room's ink on
    // the field, unselected = transparent (the Swiss "darker edge" is gone).
    const backing = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("[data-appearance-value]")].map((b) => ({
        mode: b.dataset.appearanceValue,
        checked: b.getAttribute("aria-checked"),
        background: getComputedStyle(b).backgroundColor,
        color: getComputedStyle(b).color,
      })),
    );
    expect(backing).toHaveLength(3);
    const checked = backing.filter((b) => b.checked === "true");
    expect(checked).toHaveLength(1);
    const unchecked = backing.filter((b) => b.checked !== "true");
    expect(checked[0]!.background).not.toBe("rgba(0, 0, 0, 0)");
    for (const b of unchecked) expect(b.background).toBe("rgba(0, 0, 0, 0)");
    // Selected ink is the page's ink on the page's field (inverted chip).
    const inverted = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      return {
        ink: root.getPropertyValue("--ink").trim(),
        field: root.getPropertyValue("--ground-light").trim(),
      };
    });
    expect(checked[0]!.background).not.toBe(unchecked[0]!.background);
    expect(inverted.ink.length).toBeGreaterThan(0);
    expect(inverted.field.length).toBeGreaterThan(0);

    // It sits in the header, and the footer no longer carries a control.
    await expect(page.locator(".site-header [data-appearance-control]")).toHaveCount(1);
    await expect(
      page.locator(".site-footer select, .site-footer [data-appearance-control]"),
    ).toHaveCount(0);

    // And it still themes the page: the painted field settles on the dark
    // half (the switch is a 240ms variable-swap transition, so poll).
    await page.locator('[data-appearance-value="dark"]').click();
    const dark = await fieldSrgb(page);
    await expect.poll(() => bodyBackground(page), { timeout: 4000 }).toBe(dark.dark);
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
  });
});

test.describe("visual precision — figure open control excludes the caption", () => {
  test("the overlay covers the media slot only; the figcaption stays selectable", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(GALLERY);
    const g = await page.evaluate(() => {
      const figure = document.querySelector<HTMLElement>(".gallery-figure")!;
      const media = figure.querySelector<HTMLElement>("picture, .media-slot")!;
      const caption = figure.querySelector<HTMLElement>("figcaption")!;
      const open = figure.querySelector<HTMLElement>(".figure-open")!;
      const m = media.getBoundingClientRect();
      const c = caption.getBoundingClientRect();
      const o = open.getBoundingClientRect();
      return {
        openInsideMedia:
          o.top >= m.top - 1 &&
          o.bottom <= m.bottom + 1 &&
          o.left >= m.left - 1 &&
          o.right <= m.right + 1,
        openParentIsMedia: open.parentElement === media,
        openBelowCaptionTop: o.bottom > c.top + 1,
      };
    });
    expect(g.openParentIsMedia, "the trigger is installed on the media element").toBe(true);
    expect(g.openInsideMedia, "the trigger never extends past the media box").toBe(true);
    expect(g.openBelowCaptionTop, "the trigger does not overlap the figcaption").toBe(false);
  });

  test("clicking caption text selects it instead of opening the viewer", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(GALLERY);
    const caption = page.locator(".gallery-figure figcaption").first();
    await expect(caption).toBeVisible();
    // A click inside the caption must not be hijacked by the open control.
    const captionBox = (await caption.boundingBox())!;
    await page.mouse.click(captionBox.x + 4, captionBox.y + captionBox.height / 2);
    await expect(page.locator("dialog[data-lightbox]")).toHaveJSProperty("open", false);
    // And the element under that point is the caption, not the trigger.
    const topmost = await page.evaluate(
      ([x, y]) => {
        const el = document.elementFromPoint(x, y);
        return { tag: el?.tagName ?? "", cls: (el as HTMLElement | null)?.className ?? "" };
      },
      [captionBox.x + 4, captionBox.y + captionBox.height / 2],
    );
    expect(topmost.cls).not.toContain("figure-open");
  });
});

test.describe("visual precision — appearance across viewports", () => {
  const VIEWPORTS = [320, 360, 375, 389, 390, 430, 768, 900, 1440] as const;

  test("all three chips stay visible, 44px tall and never overflow at any width", async ({
    page,
  }) => {
    for (const width of VIEWPORTS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      const g = await page.evaluate(() => {
        const radios = [...document.querySelectorAll<HTMLElement>("[data-appearance-value]")];
        const boxes = radios.map((b) => b.getBoundingClientRect());
        return {
          overflow: document.documentElement.scrollWidth - window.innerWidth,
          radioCount: radios.length,
          visible: boxes.every((b) => b.width > 0 && b.height > 0),
          minH: Math.min(...boxes.map((b) => b.height)),
          // WCAG 2.5.8 (AA) needs a 24x24 floor; the design's own commitment is
          // the 44px HEIGHT, kept at every width (the chips compact their
          // horizontal padding on phones instead of dropping a control).
          minW: Math.min(...boxes.map((b) => b.width)),
          rows: new Set(boxes.map((b) => Math.round(b.top))).size,
          compact: window.innerWidth <= 480,
        };
      });
      expect(g.radioCount, `@${width} three chips exist in the markup`).toBe(3);
      expect(g.visible, `@${width} no chip is hidden behind a compact cycle button`).toBe(true);
      expect(g.minH, `@${width} the chips keep their 44px height`).toBe(44);
      expect(g.minW, `@${width} chips stay above the 24px AA target floor`).toBeGreaterThanOrEqual(24);
      expect(g.rows, `@${width} the three chips share one row`).toBe(1);
      expect(g.overflow, `@${width} no horizontal overflow`).toBeLessThanOrEqual(0);
    }
  });

  test("the brand wordmark stays on ONE line at every width", async ({ page }) => {
    for (const width of VIEWPORTS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      const g = await page.evaluate(() => {
        const mark = document.querySelector<HTMLElement>(".site-mark")!;
        const range = document.createRange();
        range.selectNodeContents(mark);
        const rects = [...range.getClientRects()];
        return { lines: rects.length, fontSize: parseFloat(getComputedStyle(mark).fontSize) };
      });
      expect(g.lines, `@${width} wordmark is one line (font ${g.fontSize}px)`).toBe(1);
    }
  });

  test("the footer is a colophon, not a sitemap grid", async ({ page }) => {
    for (const [width, height] of [
      [320, 740],
      [390, 844],
      [430, 932],
      [1440, 900],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.goto("/");
      const g = await page.evaluate(() => {
        const footer = document.querySelector<HTMLElement>(".site-footer")!;
        return {
          controls: footer.querySelectorAll("select, [data-appearance-control]").length,
          sig: footer.querySelector(".site-footer-sig")?.textContent?.trim() ?? null,
          statement: footer.querySelector(".site-footer-statement")?.textContent?.trim() ?? null,
          action: footer.querySelector(".site-footer-action")?.textContent?.trim() ?? null,
          fine: footer.querySelector(".site-footer-fine")?.textContent?.trim() ?? null,
          navLabels: [...footer.querySelectorAll(".site-footer-nav a")].map((a) => a.textContent!.trim()),
        };
      });
      expect(g.controls, `@${width} footer has no appearance control`).toBe(0);
      expect(g.sig, `@${width} colophon carries the imprint`).toBe("Richard Photographs");
      expect(g.action, `@${width} the home colophon offers the archive exit`).toBe(
        "Browse the full archive",
      );
      expect(g.fine, `@${width} fine print present`).toContain("Set in Source Serif 4 and Source Sans 3");
      expect(g.navLabels).toEqual(["Journeys", "Places", "About"]);
      expect(g.statement && g.statement.length).toBeGreaterThan(20);
    }
  });

  test("the appearance chips are present and 44px tall on a gallery page as well", async ({
    page,
  }) => {
    for (const width of [320, 768, 1440] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(GALLERY);
      const g = await page.evaluate(() => {
        const radios = [...document.querySelectorAll<HTMLElement>("[data-appearance-value]")];
        const boxes = radios.map((b) => b.getBoundingClientRect());
        return {
          radioCount: radios.length,
          visible: boxes.every((b) => b.width > 0 && b.height > 0),
          minH: Math.min(...boxes.map((b) => b.height)),
          overflow: document.documentElement.scrollWidth - window.innerWidth,
        };
      });
      expect(g.radioCount, `@${width} gallery markup has three chips`).toBe(3);
      expect(g.visible, `@${width} gallery chips are visible`).toBe(true);
      expect(g.minH, `@${width} gallery chips keep the 44px height`).toBe(44);
      expect(g.overflow, `@${width} gallery no overflow`).toBeLessThanOrEqual(0);
    }
  });
});
