// IMP-05 — fail-closed capture state gates.
//
// A governed capture state must declare enough expectation to reject
// wrong-page captures BEFORE any screenshot is written. Gates: HTTP 2xx,
// required selector present, exact page heading, and (where declared)
// exact figure count + Overview trigger presence. Any failed gate makes
// `npm run capture` exit nonzero, write no screenshot, and print no
// "captured" — a capture run can never false-green a 404 or a wrong page.
//
// The gates are page-identity assertions (§12): minimal by design — they
// close the known false-green classes (404-as-success, wrong Gallery, stale
// route table) without duplicating the e2e behavioral suites.

/**
 * Assert one capture state's semantic expectations.
 * @param {import("playwright").Page} page
 * @param {{id: string, path: string, expect?: object}} state
 * @param {{status(): number}|null} response Playwright response from page.goto.
 * @returns {Promise<object>} observed gate values (recorded in the capture manifest).
 */
export async function assertStateGates(page, state, response) {
  const status = response ? response.status() : 0;
  if (!response || status < 200 || status >= 300) {
    throw new Error(
      `non-2xx response (${status ?? "none"}) for ${state.path} — refusing to capture state ${state.id}`,
    );
  }
  const expect = state.expect ?? {};
  const observed = { status };

  if (expect.selector) {
    const count = await page.locator(expect.selector).count();
    if (count === 0) {
      throw new Error(
        `required selector ${expect.selector} not found — refusing to capture state ${state.id}`,
      );
    }
  }

  if (expect.heading !== null && expect.heading !== undefined) {
    const h1 = (await page.locator("h1").first().textContent()) ?? "";
    const heading = h1.trim();
    if (heading !== expect.heading) {
      throw new Error(
        `heading mismatch on ${state.id}: expected ${JSON.stringify(expect.heading)}, got ${JSON.stringify(heading)} — refusing to capture`,
      );
    }
    observed.heading = heading;
  }

  if (expect.figures !== null && expect.figures !== undefined) {
    const figures = await page.locator(".gallery-figure").count();
    if (figures !== expect.figures) {
      throw new Error(
        `expected exactly ${expect.figures} .gallery-figure elements on ${state.id}, found ${figures} — refusing to capture`,
      );
    }
    observed.figures = figures;
  }

  if (expect.overviewTrigger) {
    const triggers = await page.locator("[data-overview-trigger]").count();
    if (triggers === 0) {
      throw new Error(
        `[data-overview-trigger] not found — refusing to capture state ${state.id} (P5 header contract)`,
      );
    }
    observed.overviewTrigger = true;
  }

  // WP-38: a governed Gallery baseline must depict rendered media, not an
  // empty figure skeleton — and a governed N-figure state must prove media
  // for ALL N figures, not merely one image. When the state declares an exact
  // figure count, <picture>/<img> counts must equal it exactly (one rendered
  // medium per figure); otherwise non-zero counts are required. Every figure
  // image must then be fully loaded with positive intrinsic dimensions and a
  // positive layout box. Any failure refuses the capture.
  if (expect.renderedMedia) {
    const pictures = await page.locator(".gallery-figure picture").count();
    const images = await page.locator(".gallery-figure img").count();
    if (expect.figures !== null && expect.figures !== undefined) {
      if (pictures !== expect.figures || images !== expect.figures) {
        throw new Error(
          `rendered media required on ${state.id}: expected exactly ${expect.figures} <picture> and ` +
            `${expect.figures} <img> inside .gallery-figure (one per figure), found ${pictures} ` +
            `<picture> and ${images} <img> — refusing to capture partial media as a governed state`,
        );
      }
    } else if (pictures === 0 || images === 0) {
      throw new Error(
        `rendered media required on ${state.id}: found ${pictures} <picture> and ${images} <img> ` +
          `inside .gallery-figure — refusing to capture an empty media skeleton`,
      );
    }
    const media = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll(".gallery-figure img"));
      const bad = [];
      for (const img of imgs) {
        const rect = img.getBoundingClientRect();
        if (!img.complete) bad.push("incomplete");
        else if (img.naturalWidth === 0 || img.naturalHeight === 0) bad.push("zero-intrinsic");
        else if (rect.width === 0 || rect.height === 0) bad.push("zero-layout");
      }
      return { total: imgs.length, bad: bad.slice(0, 5), badCount: bad.length };
    });
    if (media.badCount > 0) {
      throw new Error(
        `rendered media required on ${state.id}: ${media.badCount}/${media.total} figure images ` +
          `not loaded (${media.bad.join(", ")}) — refusing to capture`,
      );
    }
    observed.pictures = pictures;
    observed.images = images;
  }

  // WP-38: the mobile caption state must depict the VISIBLE position
  // annotation at a captioned reading position — not the yielded header
  // state — with the frozen mobile indicator contract: the Raised backing,
  // 12.5px utility typography, bottom-right viewport placement, and the
  // target caption + photo simultaneously visible. Recording a style value
  // without comparing it is not a gate: every declared contract field is
  // compared, and any failure refuses the capture.
  if (expect.annotation) {
    const figureIndex = state.setup?.scrollFigureIndex;
    const annotation = await page.evaluate((opts) => {
      const el = document.querySelector("[data-position-annotation]");
      if (!el) return null;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const inViewport = (r) =>
        r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 &&
        r.top < window.innerHeight && r.left < window.innerWidth;
      const figures = Array.from(document.querySelectorAll(".gallery-figure"));
      const target = opts.figureIndex !== undefined ? (figures[opts.figureIndex] ?? null) : null;
      const targetImg = target ? target.querySelector("img") : null;
      const targetCaption = target ? target.querySelector("figcaption") : null;
      return {
        text: (el.textContent ?? "").trim(),
        yield: el.dataset.yield ?? null,
        opacity: style.opacity,
        background: style.backgroundColor,
        fontSize: style.fontSize,
        position: style.position,
        rect: { top: rect.top, left: rect.left, bottom: rect.bottom, right: rect.right, width: rect.width, height: rect.height },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        annotationInViewport: inViewport(rect),
        targetImgVisible: targetImg ? inViewport(targetImg.getBoundingClientRect()) : null,
        targetHasCaption: target ? target.querySelector("figcaption") !== null : null,
        targetCaptionVisible: targetCaption ? inViewport(targetCaption.getBoundingClientRect()) : null,
      };
    }, { figureIndex });
    if (!annotation) {
      throw new Error(
        `[data-position-annotation] not found — refusing to capture state ${state.id} ` +
          `(the governed mobile-caption state requires the visible annotation)`,
      );
    }
    const problems = [];
    if (expect.annotation.text !== undefined && annotation.text !== expect.annotation.text) {
      problems.push(`text ${JSON.stringify(annotation.text)} !== ${JSON.stringify(expect.annotation.text)}`);
    }
    if (expect.annotation.visible) {
      if (annotation.yield !== null) problems.push(`data-yield=${JSON.stringify(annotation.yield)} (must be absent)`);
      if (Number(annotation.opacity) <= 0) problems.push(`opacity=${annotation.opacity} (must be > 0)`);
    }
    const normalizeColor = (value) => String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
    if (expect.annotation.background !== undefined && normalizeColor(annotation.background) !== normalizeColor(expect.annotation.background)) {
      problems.push(`background=${annotation.background} (must be ${expect.annotation.background}, the Raised token)`);
    }
    if (expect.annotation.fontSize !== undefined && annotation.fontSize !== expect.annotation.fontSize) {
      problems.push(`fontSize=${annotation.fontSize} (must be ${expect.annotation.fontSize})`);
    }
    if (expect.annotation.region === "bottom-right") {
      const regionOk =
        annotation.annotationInViewport &&
        annotation.position === "fixed" &&
        annotation.rect.left >= annotation.viewport.width / 2 &&
        annotation.rect.top >= annotation.viewport.height / 2 &&
        annotation.rect.right <= annotation.viewport.width &&
        annotation.rect.bottom <= annotation.viewport.height;
      if (!regionOk) {
        problems.push(`not in the bottom-right viewport region (position=${annotation.position} rect=${JSON.stringify(annotation.rect)} viewport=${JSON.stringify(annotation.viewport)})`);
      }
    }
    if (expect.annotation.caption) {
      if (figureIndex === undefined) {
        problems.push("caption subject declared but the state has no setup.scrollFigureIndex");
      } else {
        if (!annotation.targetImgVisible) problems.push(`target figure ${figureIndex} photo is not simultaneously visible`);
        if (annotation.targetHasCaption === false) {
          problems.push(`target figure ${figureIndex} has no figcaption (a captioned reading position is required)`);
        } else if (!annotation.targetCaptionVisible) {
          problems.push(`target figure ${figureIndex} caption is not simultaneously visible`);
        }
      }
    }
    if (problems.length > 0) {
      throw new Error(
        `position annotation not in the governed visible state on ${state.id}: ${problems.join("; ")} — ` +
          `refusing to capture (scroll to the captioned reading position first)`,
      );
    }
    observed.annotation = annotation;
  }

  return observed;
}
