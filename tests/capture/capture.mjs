// WP-06 deterministic screenshot capture runner (`npm run capture`).
//
// Fresh production implementation of the Stage 3C capture methodology
// (PROTOTYPE_REUSE.md B-1/B-2) under the frozen invariants of
// TESTING_AND_VISUAL_REGRESSION.md §8.1. The prototype file is methodology
// only — nothing here is copied from it.
//
// IMP-05 (final targeted correction) — explicit build-mode contract:
//   production group → FRESH `npm run build` artifact (production routes);
//   preview group    → FRESH `npm run build:preview` artifact (draft routes;
//                      used ONLY by the WP-38 draft long-gallery-72 state).
// The build is ALWAYS run — the presence of dist/index.html must never
// determine semantics (the previous build-only-if-absent inference reused a
// stale production dist as capture "truth"). Each group assembles its own
// isolated serving artifact (dist + /media — tests/support/artifact.mjs) and
// serves it on a pinned port; nothing writes into dist/ or generated/.
//
// Fail-closed gates (IMP-05 §12): before any screenshot, each state must
// answer 2xx and satisfy its declared semantic expectations
// (tests/capture/gates.mjs — selector/heading/figure-count/Overview
// trigger). A failed gate exits the run nonzero, writes no screenshot, and
// prints no "captured". No state can false-green a 404 or a wrong page.
//
// §8.1 invariants implemented:
//   1. Pinned browser binary: the chromium build pinned by the exact-pinned
//      @playwright/test dependency (recorded in docs/implementation/WP-06.md),
//      installed via `npx playwright install chromium`.
//   2. Pinned OS + fonts: capture runs on this controlled host; the frozen
//      font families land with WP-05. (SHA-256 checks file integrity only —
//      never cross-environment visual equivalence.)
//   3. Frozen viewports: 1440x900 and 390x844 logical px, DSF=1 (via
//      tests/support/viewports.mjs).
//   4. Font readiness: `document.fonts.ready` awaited before every shot.
//   5. Network idle: goto(waitUntil: "networkidle").
//   6. Lazy image forcing: loading=eager + wait for every <img> complete+decode.
//   7. Animation settling: kill-switch CSS injected after load
//      (duration/delay 0s, scroll-behavior auto) + fixed settle wait +
//      screenshot({ animations: "disabled" }).
//
// FINAL gate-correctness correction — DETERMINISTIC FONT RESOLUTION (capture
// contract only; product code and frozen G-values untouched):
//   The frozen `font-display: optional` (fonts.css, FDS §7.2) lets Chromium
//   lock EITHER the authored webfont OR the system fallback at FIRST PAINT,
//   whichever wins a ~100ms race. In a cold browser process the race is not
//   deterministic: fresh same-environment captures of the same governed
//   Gallery state alternated between 2 full-page heights (e.g. 4729 vs 4731
//   px on gallery-desktop-portrait) because header/ending text line boxes
//   differ between the fallback and authored CJK faces (Noto). The race is
//   invisible to the readiness contract: `document.fonts.ready` resolves
//   and every FontFace reports "loaded" EITHER way (with font-display:
//   optional the losing face is simply not used for first paint — the swap
//   never happens after paint).
//   Correction: inside the capture browser context ONLY, the CSS responses
//   are rewritten in transit (font-display: optional → block) via
//   page.route. font-display: block makes the authored fonts participate in
//   first paint deterministically (invisible-text block period, then the
//   real face) — the same authored rendering every run. This is the
//   "page settled for deterministic capture" contract: fonts ready AND the
//   font-resolution outcome no longer racy. It changes no product CSS and
//   does not alter any frozen G-value; it only pins WHICH of the two
//   possible first-paint font outcomes the capture records (the authored
//   fonts, which is what the frozen design specifies).
//
// Output: PNGs under <out-dir>/<state-id>/*.png plus a SHA-256 integrity
// manifest at <out-dir>/manifest.json. Integrity only — the manifest is NOT
// a visual-equivalence claim across browsers/OSes/font rasterizers.
//
// Usage: node tests/capture/capture.mjs [--out-dir <dir>] [--group <g>]
//   (default out-dir: tests/captures — gitignored, regenerable;
//    default group: all — production group then preview group)
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { CAPTURE_DEVICE_SCALE_FACTOR } from "../support/viewports.mjs";
import {
  runBuild,
  assembleArtifact,
  createStaticServer,
  waitForServer,
} from "../support/artifact.mjs";
import { CAPTURE_STATES, VIEWPORT_PRESETS } from "./states.mjs";
import { assertStateGates } from "./gates.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const GROUPS = {
  production: { build: "production", port: 4180 },
  preview: { build: "preview", port: 4181 },
};
const SETTLE_MS = 250;

function parseArgs(argv) {
  const args = { outDir: join(ROOT, "tests", "captures"), group: "all", states: "governed" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out-dir") args.outDir = resolve(argv[++i]);
    else if (argv[i] === "--states") args.states = argv[++i];
    else if (argv[i] === "--group") args.group = argv[++i];
  }
  if (args.group !== "all" && !GROUPS[args.group]) {
    throw new Error(`--group must be all|production|preview, got: ${args.group}`);
  }
  if (args.states !== "governed") {
    // The "redesign" candidate profile was retired 2026-09-19; its 20 rd-*
    // states are snapshotted in
    // docs/archive/redesign-capture-states-SNAPSHOT-2026-09-19.mjs.txt.
    throw new Error(
      `--states must be governed ("${args.states}" is not available; the redesign profile was retired 2026-09-19), got: ${args.states}`,
    );
  }
  return args;
}

import childProcess from "node:child_process";

/** Candidate provenance: live HEAD SHA and a hash of the dirty diff so a
 * capture manifest can be tied to the exact working-tree state. */
function candidateProvenance() {
  const git = (args) => {
    try {
      return childProcess.execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
    } catch {
      return null;
    }
  };
  const head = git(["rev-parse", "HEAD"]);
  const diff = git(["diff", "--binary"]) ?? "";
  const dirtyHash = diff ? createHash("sha256").update(diff).digest("hex").slice(0, 16) : null;
  return { head, dirtyDiffHash: dirtyHash };
}

import { dirname, resolve } from "node:path";

/** §8.1 readiness protocol: font readiness, lazy images forced eager and
 * fully loaded + decoded, two animation frames, then a fixed settle wait. */
async function settlePage(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    // R4 perf gate: below-first gallery photos start inside <noscript> and
    // hydrate on proximity; a governed capture needs the complete sequence
    // rendered deterministically, so force every slot now.
    window.__hydrateMediaSlots?.();
    await new Promise((resolve) => {
      const figures = () => document.querySelectorAll(".gallery-figure");
      const imgs = () => document.querySelectorAll(".gallery-figure img");
      if (figures().length === 0) {
        resolve();
        return;
      }
      const t0 = performance.now();
      const tick = () => {
        if (imgs().length === figures().length || performance.now() - t0 > 5000) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    document.querySelectorAll('img[loading="lazy"]').forEach((img) => (img.loading = "eager"));
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
          // decode can reject (e.g. broken image); state is still deterministic
        }
      }),
    );
  });
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }),
  );
  await page.waitForTimeout(SETTLE_MS);
}

/** Kill-switch CSS: animations/transitions complete instantly (end-state
 * semantics for filled animations), smooth scrolling becomes instant. */
const SETTLE_CSS = `
*, *::before, *::after {
  animation-delay: 0s !important;
  animation-duration: 0s !important;
  transition-delay: 0s !important;
  transition-duration: 0s !important;
  scroll-behavior: auto !important;
}
`.trim();

/** Deterministic font resolution (capture context only): rewrite CSS
 * responses in transit so the frozen `font-display: optional` first-paint
 * race (authored webfont vs system fallback — nondeterministic per fresh
 * browser process) can no longer pick the rendered face. `block` makes the
 * authored fonts deterministic at first paint. No product file is modified;
 * the rewrite lives only inside this capture browser context. */
async function installDeterministicFonts(context) {
  await context.route("**/*.css", async (route) => {
    try {
      const response = await route.fetch();
      const contentType = response.headers()["content-type"] || "text/css";
      let body = await response.text();
      body = body.replace(/font-display:\s*optional\b/g, "font-display: block");
      await route.fulfill({ response, body, contentType });
    } catch (error) {
      // Fail closed: an interception failure must not silently fall back to
      // a racy capture.
      throw new Error(`deterministic-font route interception failed: ${error?.message ?? error}`);
    }
  });
}

/** WP-38 reading-position setup for governed caption states: scroll the
 * declared figure to the viewport center, then wait (bounded, fail-closed)
 * for the position annotation to report the governed visible text. Throws on
 * any precondition failure — the caller writes no screenshot. */
async function scrollToReadingPosition(page, state) {
  const index = state.setup.scrollFigureIndex;
  const expectedText = state.expect?.annotation?.text;
  await page.evaluate((i) => {
    const figures = document.querySelectorAll(".gallery-figure");
    if (i < 0 || i >= figures.length) {
      throw new Error(`scrollFigureIndex ${i} out of range (${figures.length} figures)`);
    }
    figures[i].scrollIntoView({ block: "center", behavior: "auto" });
  }, index);
  if (expectedText !== undefined) {
    const deadline = Date.now() + 10_000;
    for (;;) {
      const text = await page.evaluate(() => {
        const el = document.querySelector("[data-position-annotation]");
        return el ? (el.textContent ?? "").trim() : null;
      });
      if (text === expectedText) break;
      if (Date.now() > deadline) {
        throw new Error(
          `reading-position setup on ${state.id}: annotation text ${JSON.stringify(text)} ` +
            `never reached ${JSON.stringify(expectedText)} — refusing to capture`,
        );
      }
      await page.waitForTimeout(100);
    }
  }
  await page.waitForTimeout(SETTLE_MS);
}

/** Walk the full document so viewport-gated enhancements (lazy images,
 * one-shot entrance reveals) reach their final state before a fullPage
 * screenshot, then return to the top. */
async function scrollThroughPage(page) {
  await page.evaluate(async () => {
    const step = Math.max(200, Math.floor(window.innerHeight * 0.75));
    for (let y = 0; y <= document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 40));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(SETTLE_MS);
}

/** Capture one group against its own fresh, isolated artifact. */
export async function captureGroup(group, outDir) {
  const { build, port } = GROUPS[group];
  console.log(`[capture] ${group} group: explicit fresh ${build} build (stale dist/ never reused)`);
  const sourceDir = runBuild(build);
  // The capture group assembles its own isolated artifact. Post 2026-09-12 the
  // corpus is published-only, so there is no draft media store to layer in.
  const artifact = assembleArtifact(sourceDir, `capture-${group}`);
  const serverUrl = `http://127.0.0.1:${port}/`;
  const server = createStaticServer(artifact);
  await new Promise((ready) => server.listen(port, "127.0.0.1", ready));
  try {
    await waitForServer(serverUrl);

    const browser = await chromium.launch();
    const entries = [];
    const states = CAPTURE_STATES.filter((s) => s.group === group);
    try {
      for (const state of states) {
        const viewport = VIEWPORT_PRESETS[state.viewport];
        if (!viewport) throw new Error(`unknown viewport preset: ${state.viewport}`);
        const theme = state.theme === "dark" ? "dark" : "light";
        const context = await browser.newContext({
          viewport,
          deviceScaleFactor: CAPTURE_DEVICE_SCALE_FACTOR,
          javaScriptEnabled: true,
          colorScheme: theme,
        });
        // Pin the concrete theme through the same storage path the product
        // uses: the pre-paint restore resolves it before first paint, so a
        // "dark" state can never silently render light.
        await context.addInitScript(
          ([key, value]) => window.localStorage.setItem(key, value),
          ["photography.appearance", theme],
        );
        await installDeterministicFonts(context);
        const page = await context.newPage();
        try {
          const response = await page.goto(serverUrl + state.path.replace(/^\//, ""), {
            waitUntil: "networkidle",
          });
          // §8.1 animation settling: inject kill-switch CSS, then settle.
          await page.addStyleTag({ content: SETTLE_CSS });
          await settlePage(page);
          // Viewport-gated reveals must reach their end state before a
          // fullPage capture (opacity-0 blanks are a failed capture).
          if (state.fullPage ?? false) {
            await scrollThroughPage(page);
          }
          // WP-38 reading-position setup: scroll the declared figure into
          // view (e.g. the captioned photo for the mobile-caption state),
          // settle scrolling/layout, and wait for the position annotation to
          // reach its governed visible text. Any failure throws BEFORE any
          // screenshot is written — the precondition never silently degrades
          // to a top-of-page capture.
          if (state.setup?.scrollFigureIndex !== undefined) {
            await scrollToReadingPosition(page, state);
            await settlePage(page);
          }
          if (state.setup?.clickSelector) {
            await page.click(state.setup.clickSelector);
            await page.waitForTimeout(SETTLE_MS);
            await settlePage(page);
          }
          // IMP-05 fail-closed gates BEFORE any screenshot is written.
          const gates = await assertStateGates(page, state, response);
          const stateDir = join(outDir, state.id);
          await mkdir(stateDir, { recursive: true });
          const file = join(stateDir, "index.png");
          await page.screenshot({
            path: file,
            fullPage: state.fullPage ?? false,
            animations: "disabled",
          });
          const media = await page.evaluate(() => ({
            total: document.images.length,
            decoded: Array.from(document.images).filter(
              (img) => img.complete && img.naturalWidth > 0,
            ).length,
          }));
          const bytes = await readFile(file);
          entries.push({
            state: state.id,
            path: state.path,
            group,
            buildMode: build,
            theme,
            viewport: `${viewport.width}x${viewport.height}`,
            deviceScaleFactor: CAPTURE_DEVICE_SCALE_FACTOR,
            fullPage: state.fullPage ?? false,
            gates,
            images: media,
            file: relative(ROOT, file),
            bytes: bytes.byteLength,
            sha256: createHash("sha256").update(bytes).digest("hex"),
          });
          console.log(`ok  ${state.id}`);
        } catch (error) {
          throw new Error(`capture failed for state ${state.id}: ${error?.message ?? error}`);
        } finally {
          await context.close();
        }
      }
    } finally {
      await browser.close();
    }
    return { entries, chromiumVersion: browser.version() };
  } finally {
    server.close();
  }
}

async function main() {
  const { outDir, group } = parseArgs(process.argv.slice(2));
  const groupNames = group === "all" ? Object.keys(GROUPS) : [group];

  const entries = [];
  let chromiumVersion;
  for (const name of groupNames) {
    const result = await captureGroup(name, outDir);
    entries.push(...result.entries);
    chromiumVersion = result.chromiumVersion;
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    tool: "tests/capture/capture.mjs",
    statesProfile: "governed",
    nodeVersion: process.version,
    candidate: candidateProvenance(),
    chromiumVersion,
    buildMode: groupNames.join("+"),
    note:
      "SHA-256 values are file-integrity metadata inside one controlled " +
      "baseline workflow only. They are NOT visual-equivalence proof across " +
      "browsers, operating systems, font rasterizers, or machines " +
      "(TESTING_AND_VISUAL_REGRESSION.md §8.1).",
    captures: entries,
  };
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  const expected = CAPTURE_STATES.filter((s) => groupNames.includes(s.group)).length;
  console.log(`[capture] ${entries.length}/${expected} states captured -> ${outDir}`);
}

// CLI entry only when invoked directly (the module is also imported by the
// capture-integrity integration tests).
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`[capture] FAILED: ${error?.message ?? error}`);
    process.exit(1);
  });
}
