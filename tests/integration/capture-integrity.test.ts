// P4/P5 FINAL TARGETED CORRECTION — IMP-05 capture-integrity evidence.
//
// Previous defects (independent review): the capture runner built only when
// dist/index.html was ABSENT (stale production dist reused as capture
// semantics), captured a 404 long-gallery page as a successful screenshot,
// never asserted page semantic state, and capture:diff exited 0 when every
// state was no-baseline. The long-gallery state was also ungoverned.
//
// Corrected contract:
//   1. Explicit build mode: production states → fresh production build;
//      preview states → fresh preview build. Stale shared dist/ never
//      determines semantics (the runner rebuilds, always).
//   2. Fail-closed state gates: non-2xx response, missing required selector,
//      wrong heading, wrong figure count, missing Overview trigger → capture
//      exits nonzero, writes no screenshot, prints no "captured".
//   3. Governed baselines: capture:diff fails when a REQUIRED governed state
//      has no baseline (or the integrity manifest is violated).
//   4. Production and preview baselines stay distinct: production discovery/
//      gallery states are captured against production semantics; only the
//      draft long-gallery-72 uses preview semantics (§11).
//
// RED-first: the CLI tests exercise the current runner (4c4e15a behavior)
// and fail against it; the gate tests fail because the gates module does
// not exist yet (feature-missing RED).
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { chromium } from "playwright";

const REPO_ROOT = new URL("../../", import.meta.url).pathname;

function tmpOut() {
  return mkdtempSync(join(tmpdir(), "capture-integrity-"));
}

function serveSynthetic(html: string, status = 200): Promise<import("node:http").Server> {
  const server = createServer((_req, res) => {
    res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

function syntheticUrl(server: import("node:http").Server) {
  const addr = server.address();
  if (addr === null || typeof addr === "string") throw new Error("server not listening on a port");
  return `http://127.0.0.1:${addr.port}/`;
}

describe("IMP-05 capture build-mode + fail-closed contract (CLI)", () => {
  test(
    "stale production dist cannot satisfy a production capture (explicit rebuild)",
    () => {
      const out = tmpOut();
      // Simulate a stale artifact with a marker FILE inside dist/ — a fresh
      // canonical build clears dist/ wholesale, so the marker's presence
      // proves no rebuild happened. (We do not mutate dist/index.html: dist
      // is shared state and parallel test files legitimately rebuild it.)
      const markerPath = join(REPO_ROOT, "dist", "STALE-DIST-MARKER-IMP05");
      writeFileSync(markerPath, "stale");
      try {
        const r = spawnSync("node", ["tests/capture/capture.mjs", "--out-dir", out, "--group", "production"], {
          cwd: REPO_ROOT,
          encoding: "utf8",
          timeout: 480_000,
        });
        expect(r.status, `capture output: ${r.stdout?.slice(-800)} ${r.stderr?.slice(-800)}`).toBe(0);
        // The runner must have rebuilt the artifact explicitly: the stale
        // marker is gone from the canonical build output, and the artifact
        // the capture actually SERVED is a fresh assembly.
        expect(existsSync(markerPath)).toBe(false);
        const served = readFileSync(
          join(REPO_ROOT, ".serve-artifacts", "capture-production", "index.html"),
          "utf8",
        );
        expect(served).toContain("<!DOCTYPE html");
        // And the production group must not include the preview-only draft state.
        expect(existsSync(join(out, "gallery-desktop-long-72"))).toBe(false);
      } finally {
        rmSync(markerPath, { force: true });
      }
    },
    600_000,
  );

  test(
    "production capture never writes the preview-only long-gallery state (baseline separation)",
    () => {
      const out = tmpOut();
      const r = spawnSync("node", ["tests/capture/capture.mjs", "--out-dir", out, "--group", "production"], {
        cwd: REPO_ROOT,
        encoding: "utf8",
        timeout: 480_000,
      });
      expect(r.status, `capture output: ${r.stdout?.slice(-800)} ${r.stderr?.slice(-800)}`).toBe(0);
      expect(existsSync(join(out, "gallery-desktop-long-72", "index.png"))).toBe(false);
      const manifest = JSON.parse(readFileSync(join(out, "manifest.json"), "utf8"));
      expect(manifest.buildMode).toBe("production");
      for (const entry of manifest.captures as Array<{ state: string; buildMode: string }>) {
        expect(entry.buildMode, `state ${entry.state} must be production semantics`).toBe("production");
      }
    },
    600_000,
  );

  test(
    "long-gallery state captures the LARGEST real gallery with exact figures + rendered media",
    () => {
      const out = tmpOut();
      const r = spawnSync("node", ["tests/capture/capture.mjs", "--out-dir", out, "--group", "preview"], {
        cwd: REPO_ROOT,
        encoding: "utf8",
        timeout: 480_000,
      });
      expect(r.status, `capture output: ${r.stdout?.slice(-800)} ${r.stderr?.slice(-800)}`).toBe(0);
      const manifest = JSON.parse(readFileSync(join(out, "manifest.json"), "utf8"));
      expect(manifest.buildMode).toBe("preview");
      const long72 = (manifest.captures as Array<{ state: string; gates: object }>).find(
        (c) => c.state === "gallery-desktop-long-72",
      );
      expect(long72, "preview group must capture gallery-desktop-long-72").toBeTruthy();
      // 2026-10-18 (owner-approved — plan §5): the `overviewTrigger` gate
      // expectation was removed with the Overview (Contact Sheet) pruning.
      // The long-sequence guarantees under test are unchanged: exact figure
      // count + rendered (non-skeleton) media.
      expect(long72!.gates).toMatchObject({ status: 200, figures: 28, pictures: 28, images: 28 });
    },
    600_000,
  );
});

describe("IMP-05 fail-closed state gates (synthetic pages, real browser)", () => {
  function serve(html: string, status = 200): Promise<import("node:http").Server> {
    const server = createServer((_req, res) => {
      res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    });
    return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
  }

  function urlOf(server: import("node:http").Server) {
    const addr = server.address();
    if (addr === null || typeof addr === "string") throw new Error("server not listening on a port");
    return `http://127.0.0.1:${addr.port}/`;
  }

  function longGalleryHtml({ figures = 72, trigger = true, heading = "Long Gallery — Seventy-Two Frames" } = {}) {
    return `<!doctype html><html><body><h1>${heading}</h1>` +
      (trigger ? '<button data-overview-trigger>Overview 72</button>' : "") +
      Array.from({ length: figures }, (_, i) => `<figure class="gallery-figure">f${i}</figure>`).join("") +
      `</body></html>`;
  }

  const STATE = {
    id: "gallery-desktop-long-72",
    path: "/",
    expect: {
      selector: ".gallery-figure",
      heading: "Long Gallery — Seventy-Two Frames",
      figures: 72,
      overviewTrigger: true,
    },
  };

  async function gateThrows(
    page: import("playwright").Page,
    response: import("playwright").Response | null,
    messagePattern: RegExp,
  ) {
    const { assertStateGates } = await import("../../tests/capture/gates.mjs");
    await expect(assertStateGates(page, STATE, response)).rejects.toThrow(messagePattern);
  }

  test("404 response fails the gate (never a screenshot)", async () => {
    const server = await serve(longGalleryHtml(), 404);
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const response = await page.goto(urlOf(server));
    await gateThrows(page, response, /non-2xx|404/i);
    await browser.close();
    server.close();
  }, 60_000);

  test("wrong figure count fails the gate (71 of 72)", async () => {
    const server = await serve(longGalleryHtml({ figures: 71 }));
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const response = await page.goto(urlOf(server));
    await gateThrows(page, response, /figure/i);
    await browser.close();
    server.close();
  }, 60_000);

  test("missing Overview trigger fails the gate", async () => {
    const server = await serve(longGalleryHtml({ trigger: false }));
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const response = await page.goto(urlOf(server));
    await gateThrows(page, response, /overview/i);
    await browser.close();
    server.close();
  }, 60_000);

  test("wrong page heading fails the gate (wrong-Gallery capture rejected)", async () => {
    const server = await serve(longGalleryHtml({ heading: "Some Other Gallery" }));
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const response = await page.goto(urlOf(server));
    await gateThrows(page, response, /heading/i);
    await browser.close();
    server.close();
  }, 60_000);

  test("a correct 72-figure page with trigger passes the gate", async () => {
    const server = await serve(longGalleryHtml());
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const response = await page.goto(urlOf(server));
    const { assertStateGates } = await import("../../tests/capture/gates.mjs");
    await expect(assertStateGates(page, STATE, response)).resolves.toMatchObject({
      status: 200,
      figures: 72,
      overviewTrigger: true,
    });
    await browser.close();
    server.close();
  }, 60_000);
});

describe("WP-38 rendered-media + visible-annotation gates (synthetic pages, real browser)", () => {
  function mediaGalleryHtml({ figures = 72, withMedia = true, mediaCount }: { figures?: number; withMedia?: boolean; mediaCount?: number } = {}) {
    const withMediaCount = mediaCount !== undefined ? mediaCount : withMedia ? figures : 0;
    return `<!doctype html><html><body><h1>Long Gallery — Seventy-Two Frames</h1>` +
      `<button data-overview-trigger>Overview 72</button>` +
      Array.from(
        { length: figures },
        (_, i) =>
          `<figure class="gallery-figure">` +
          (i < withMediaCount
            ? `<picture><source type="image/avif" srcset="/media/a.avif 1w"><img src="/media/a.jpg" srcset="/media/a.jpg 1w" width="100" height="60" alt=""></picture>`
            : ``) +
          `f${i}</figure>`,
      ).join("") +
      `</body></html>`;
  }

  const MEDIA_STATE = {
    id: "gallery-desktop-long-72",
    path: "/",
    expect: {
      selector: ".gallery-figure",
      heading: "Long Gallery — Seventy-Two Frames",
      figures: 72,
      overviewTrigger: true,
      renderedMedia: true,
    },
  };

  test("72 figures with 0 pictures/0 imgs FAILS the renderedMedia gate (empty skeleton rejected)", async () => {
    const server = await serveSynthetic(mediaGalleryHtml({ withMedia: false }));
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const response = await page.goto(syntheticUrl(server));
    const { assertStateGates } = await import("../../tests/capture/gates.mjs");
    await expect(assertStateGates(page, MEDIA_STATE, response)).rejects.toThrow(/picture|img|media/i);
    await browser.close();
    server.close();
  }, 60_000);

  test("72 figures with real picture/img media PASSES the renderedMedia gate", async () => {
    const server = await serveSynthetic(mediaGalleryHtml({ withMedia: true }));
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const response = await page.goto(syntheticUrl(server));
    const { assertStateGates } = await import("../../tests/capture/gates.mjs");
    // Inline data-URL images so load/decode succeeds without a media server
    // (srcset is removed: with srcset present the data-URL src is ignored).
    await page.evaluate(() => {
      const dataUrl =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      for (const source of document.querySelectorAll(".gallery-figure picture source")) {
        source.setAttribute("srcset", dataUrl);
      }
      for (const img of document.querySelectorAll<HTMLImageElement>(".gallery-figure img")) {
        img.removeAttribute("srcset");
        img.src = dataUrl;
      }
    });
    await page.evaluate(async () => {
      await Promise.all(
        Array.from(document.images).map(async (img) => {
          if (!img.complete) {
            await new Promise((settled) => {
              img.addEventListener("load", settled, { once: true });
              img.addEventListener("error", settled, { once: true });
            });
          }
          try {
            await img.decode();
          } catch {
            // load state is surfaced by the gate below
          }
        }),
      );
    });
    await expect(assertStateGates(page, MEDIA_STATE, response)).resolves.toMatchObject({
      status: 200,
      figures: 72,
      pictures: 72,
      images: 72,
    });
    await browser.close();
    server.close();
  }, 60_000);

  test("72 figures with only 1 valid medium FAILS the renderedMedia gate (partial media rejected)", async () => {
    const server = await serveSynthetic(mediaGalleryHtml({ mediaCount: 1 }));
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const response = await page.goto(syntheticUrl(server));
    const { assertStateGates } = await import("../../tests/capture/gates.mjs");
    // The single present image is genuinely loadable, so only the exact
    // cardinality rule can reject this page (the old non-zero rule passed it).
    await page.evaluate(() => {
      const dataUrl =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      for (const source of document.querySelectorAll(".gallery-figure picture source")) {
        source.setAttribute("srcset", dataUrl);
      }
      for (const img of document.querySelectorAll<HTMLImageElement>(".gallery-figure img")) {
        img.removeAttribute("srcset");
        img.src = dataUrl;
      }
    });
    await page.evaluate(async () => {
      await Promise.all(
        Array.from(document.images).map(async (img) => {
          if (!img.complete) {
            await new Promise((settled) => {
              img.addEventListener("load", settled, { once: true });
              img.addEventListener("error", settled, { once: true });
            });
          }
          try {
            await img.decode();
          } catch {
            // load state is surfaced by the gate below
          }
        }),
      );
    });
    await expect(assertStateGates(page, MEDIA_STATE, response)).rejects.toThrow(/exactly 72/i);
    await browser.close();
    server.close();
  }, 60_000);

  test("a yielded/invisible annotation FAILS the annotation gate (top-of-page capture rejected)", async () => {
    const html =
      `<!doctype html><html><body><h1>Lofoten Light</h1>` +
      `<div class="position-annotation" data-position-annotation data-yield="true" style="opacity: 0">1 / 8</div>` +
      Array.from({ length: 8 }, (_, i) => `<figure class="gallery-figure">f${i}</figure>`).join("") +
      `</body></html>`;
    const server = await serveSynthetic(html);
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const response = await page.goto(syntheticUrl(server));
    const { assertStateGates } = await import("../../tests/capture/gates.mjs");
    const ANNOTATION_STATE = {
      id: "gallery-mobile-caption",
      path: "/",
      expect: {
        selector: ".gallery-figure",
        heading: "Lofoten Light",
        annotation: { text: "3 / 8", visible: true },
      },
    };
    await expect(assertStateGates(page, ANNOTATION_STATE, response)).rejects.toThrow(
      /annotation|yield|opacity|visible/i,
    );
    await browser.close();
    server.close();
  }, 60_000);

  // ROUND-2: the governed mobile-caption fixture — visible annotation with
  // the frozen indicator contract (Raised backing, 12.5px, bottom-right) at
  // a captioned reading position (target figure 2 has a photo + caption).
  function captionedHtml({ background = "rgb(239, 236, 229)", fontSize = "12.5px" } = {}) {
    return `<!doctype html><html><head><style>body{margin:0}</style></head><body><h1>Lofoten Light</h1>` +
      `<div data-position-annotation style="position: fixed; right: 12px; bottom: 12px; opacity: 1; ` +
      `background-color: ${background}; font-size: ${fontSize};">3 / 8</div>` +
      Array.from(
        { length: 8 },
        (_, i) =>
          `<figure class="gallery-figure"><picture><img src="x" width="300" height="200" alt="">` +
          `<figcaption>caption ${i}</figcaption></figure>`,
      ).join("") +
      `</body></html>`;
  }

  const CAPTION_STATE = {
    id: "gallery-mobile-caption",
    path: "/",
    expect: {
      selector: ".gallery-figure",
      heading: "Lofoten Light",
      annotation: {
        text: "3 / 8",
        visible: true,
        background: "rgb(239, 236, 229)",
        fontSize: "12.5px",
        region: "bottom-right",
        caption: true,
      },
    },
    setup: { scrollFigureIndex: 2 },
  };

  async function gateAnnotation(page: import("playwright").Page, response: import("playwright").Response | null) {
    const { assertStateGates } = await import("../../tests/capture/gates.mjs");
    return assertStateGates(page, CAPTION_STATE, response);
  }

  test("a fully-contracted captioned state PASSES the annotation gate", async () => {
    const server = await serveSynthetic(captionedHtml());
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const response = await page.goto(syntheticUrl(server));
    await expect(gateAnnotation(page, response)).resolves.toMatchObject({
      status: 200,
      annotation: { text: "3 / 8", background: "rgb(239, 236, 229)", fontSize: "12.5px" },
    });
    await browser.close();
    server.close();
  }, 60_000);

  test("a transparent/wrong backing FAILS the annotation gate", async () => {
    const server = await serveSynthetic(captionedHtml({ background: "rgba(0, 0, 0, 0)" }));
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const response = await page.goto(syntheticUrl(server));
    await expect(gateAnnotation(page, response)).rejects.toThrow(/background|Raised/i);
    await browser.close();
    server.close();
  }, 60_000);

  test("a materially wrong indicator font size FAILS the annotation gate", async () => {
    const server = await serveSynthetic(captionedHtml({ fontSize: "99px" }));
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const response = await page.goto(syntheticUrl(server));
    await expect(gateAnnotation(page, response)).rejects.toThrow(/fontSize/i);
    await browser.close();
    server.close();
  }, 60_000);
});

describe("IMP-05 capture:diff required-governed-baseline contract (CLI)", () => {
  test("a required governed state with no baseline FAILS capture:diff", () => {
    const captures = tmpOut();
    const baselines = tmpOut();
    // A capture exists for a REQUIRED governed state; no baseline does.
    const stateDir = join(captures, "gallery-desktop-long-72");
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(join(stateDir, "index.png"), Buffer.from("89504e470d0a1a0a", "hex"));
    try {
      const r = spawnSync(
        "node",
        ["tests/capture/diff.mjs", "--captures", captures, "--baselines", baselines],
        { cwd: REPO_ROOT, encoding: "utf8", timeout: 120_000 },
      );
      expect(
        r.status,
        `no-baseline on a required governed state must fail: ${r.stdout?.slice(-800)}`,
      ).not.toBe(0);
    } finally {
      rmSync(captures, { recursive: true, force: true });
      rmSync(baselines, { recursive: true, force: true });
    }
  });
});
