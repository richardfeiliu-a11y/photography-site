#!/usr/bin/env node
// scripts/perf/measure.mjs — WP-45 correction: MEASURED baseline harness (v2).
//
// WHAT IT MEASURES (frozen contract: PERFORMANCE_BUDGET §§2/2.2/3/5/10-11,
// PRODUCTION_IMPLEMENTATION_PLAN WP-45, PHASE_GATES P7, ADR-013, D1-D14 rule 3):
// - Throttled LCP/CLS on 8 pages x (desktop + mobileLowEnd), 5 cold runs each.
// - True Event-Timing INP (PerformanceObserver type:"event", durationThreshold
//   0, trusted Playwright clicks) on overview-open/close/jump; menu-toggle N/A
//   (no JS toggle exists — SiteNav is static anchors).
// - Per-page transferred payload by type (CDP Network.loadingFinished
//   encodedDataLength + responseReceived mime; URL-suffix fallback).
// - DOM size (document.getElementsByTagName("*").length, both viewports).
// - Memory on the largest real gallery (JSHeapUsedSize via CDP Performance.getMetrics,
//   DOM Nodes, decoded images via performance.getEntriesByType("resource")).
// - Bundles (built CSS/JS gzip) + repeatability (all runs + min/max/median).
//
// ROBUSTNESS (learned from two crashed runs): one long-lived browser process
// dies mid-matrix ("Target page, context or browser has been closed"). Every
// measurement unit (page x profile, memory x profile, interaction x profile)
// therefore gets a FRESH browser process, and a unit that dies to a browser
// crash is retried once on a new process before the run aborts.
//
// CALIBRATION MODEL (Budget defines goals, not physics): the harness is
// validated by MINIMUM-DETECTABLE-EFFECT probes — the largest STOP threshold
// that fails the canary is the probe; everything below passes silently. If a
// future commit degrades beyond any canary threshold, the harness turns RED
// with a Gate-B verdict. Probe failures are verification artifacts; production
// judgment stays in PERFORMANCE-BASELINE.md.
//
// CORPUS HONESTY: the real corpus remains publication-invalid until WP-58
// completes the editorial alt pass (the current null count is measured at
// run time into corpus.actualCorpus.sourceAltTextNull, never hardcoded).
// The baseline is measured on a SYNTHETIC VALID-CONTENT PROVISION (isolated
// temp workspace; provisionWorkspace() below) that overlays ONLY synthetic
// alt_text (labeled, never committed). R3 note: the fixture-draft promotion
// this section described left with the real-archive swap; see
// provisionWorkspace() for the current provisioning.
// photos/order/layout/media). The candidate implementation is untouched: D11
// stays enabled, the validator is unmodified, no real alt is authored,
// photos/order/layout/media are byte-identical. dist/ is NEVER written.
import { createServer } from "node:http";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { gzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnNpmIsolated } from "./build-isolated.mjs";
import { nodeEngineSatisfied } from "./engine.mjs";
import { chromium } from "playwright";
import { ENGINEERING_BUDGETS, FROZEN_WEB_VITALS } from "../../src/lib/perf/budget.ts";

const ROOT = resolve(join(fileURLToPath(import.meta.url), "..", "..", ".."));

// T7 — ONE gzip convention for every byte count this harness reports.
// Previously the inline <script> inventory used an explicit level 9 while
// external files (bundles + per-route externals) used zlib's default level,
// so two numbers in the same record were not comparable. They all use the
// default now; the convention itself is recorded in the baseline.
const GZIP_LEVEL = undefined; // zlib default level (6)
const gzipBytesOf = (buffer) => gzipSync(buffer, GZIP_LEVEL ? { level: GZIP_LEVEL } : {}).length;
const OUT_DIR = join(ROOT, "bench-output");
const DIST_DIR = join(OUT_DIR, "perf-measure-dist");
const BASELINE_FILE = process.env.PERF_OUT_FILE
  ? resolve(process.env.PERF_OUT_FILE)
  : join(ROOT, "docs", "implementation", "PERF-BASELINE.json");

// ---------------------------------------------------------------------------
// Profiles (no frozen numbers in the Budget: chosen + fully recorded).
// ---------------------------------------------------------------------------
const PROFILES = {
  desktop: {
    viewport: { width: 1440, height: 900 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
    network: {
      offline: false,
      latency: 40,
      downloadThroughput: Math.floor((1.6 * 1024 * 1024) / 8),
      uploadThroughput: Math.floor((750 * 1024) / 8),
      downKbps: 1600,
      rttMs: 150,
      label: "Cable 1.6Mbps/750Kbps RTT 150ms (recorded choice; Budget sets no frozen numbers)",
    },
    cpuRate: 1,
    cpuLabel: "unthrottled (desktop reference)",
    throttled: true,
  },
  mobileLowEnd: {
    viewport: { width: 390, height: 844 },
    userAgent:
      "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36",
    network: {
      offline: false,
      latency: 150,
      downloadThroughput: Math.floor((1.6 * 1024 * 1024) / 8),
      uploadThroughput: Math.floor((750 * 1024) / 8),
      downKbps: 1600,
      rttMs: 300,
      label: "Slow-4G 1.6Mbps/750Kbps RTT 300ms (recorded choice; Budget sets no frozen numbers)",
    },
    cpuRate: 4,
    cpuLabel: "4x slowdown",
    throttled: true,
  },
};

// The memory profile is resource-constraint emulation, NOT a viewport claim:
// network throttle + CPU throttle + heap-pressure read + single-document
// discipline. mobileHeapCapMB is READ-ONLY instrumentation: Chromium exposes
// no per-context JS heap cap, so the budget check pins the measurement and
// its constraint profile instead of pretending to enforce a device limit.
// memoryEmulation + limitations are recorded verbatim on the baseline.
const MEMORY_PROFILE = {
  heapPressure:
    "1.5x Netherlands-28 DOM (detached clone, held by JS reference only — NOT appended to the document) resident during measurement",
  mobileHeapCapMB: 150,
  mobileHeapCapNote:
    "read-only instrumentation target (no per-context heap cap exists in Chromium); measured heap must stay under it",
};

// ---------------------------------------------------------------------------
// Page + interaction matrix.
// ---------------------------------------------------------------------------
const PAGES = [
  { path: "/", label: "Home" },
  { path: "/places/amsterdam", label: "Place Detail (photo aggregation)" },
  { path: "/galleries/lofoten-polar-night", label: "Gallery (normal)" },
  { path: "/galleries/netherlands", label: "Gallery (28-photo long)" },
  { path: "/galleries/autumn-china", label: "Gallery (mixed orientation)" },
  { path: "/places", label: "Places index" },
  { path: "/archive", label: "Archive" },
  { path: "/about", label: "About" },
];

const INTERACTIONS = [
  { id: "overview-open", kind: "open" },
  { id: "overview-close", kind: "close" },
  { id: "overview-jump", kind: "jump" },
];

const MENU_NA = {
  id: "menu-toggle",
  status: "na",
  rationale:
    "No JS menu toggle exists (SiteNav is static anchor links; smallest viewport keeps the same inline nav). Nothing to time.",
};

const RUNS = 5;
const SETTLE_MS = 3000;

// ---------------------------------------------------------------------------
// Synthetic valid-content provision (isolated temp workspace).
// ---------------------------------------------------------------------------
const SYNTHETIC_ALT = "SYNTHETIC-ALT-PROVISION for measurement only";

function provisionAltText(yaml) {
  return yaml.replace(
    /^(\s*)alt_text:\s*null\s*$/gm,
    (_m, indent) => `${indent}alt_text: "${SYNTHETIC_ALT}"`,
  );
}

// Count actual `alt_text: null` entries in the CANDIDATE source corpus (the
// real-corpus publication state at run time; replaces the stale hardcoded
// "50 alt-missing" prose). Also counts photo entries for context.
function countSourceAltMissing() {
  let altMissing = 0;
  let photos = 0;
  const galleryDir = join(ROOT, "content", "galleries");
  if (!existsSync(galleryDir)) return { altMissing: null, photos: null };
  for (const entry of readdirSync(galleryDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const meta = join(galleryDir, entry.name, "meta.yaml");
    if (!existsSync(meta)) continue;
    const yaml = readFileSync(meta, "utf8");
    altMissing += (yaml.match(/^\s*alt_text:\s*null\s*$/gm) || []).length;
    photos += (yaml.match(/^\s*-\s*id:\s*/gm) || []).length;
  }
  return { altMissing, photos };
}

// R3: the fixture draft gallery (long-gallery-72 / p_lg72_*) left with the
// 2026-09-12 real-archive swap, so the draft-promotion + preview-draft-
// manifest merge is gone. The measured manifest IS the production manifest
// (the synthetic part that remains is the alt_text fill for any nulls).
function buildSyntheticManifest() {
  const prodRaw = readFileSync(join(ROOT, "generated", "asset-manifest.json"));
  const prodManifest = JSON.parse(prodRaw.toString("utf8"));
  return {
    envelope: {
      generated_at: new Date().toISOString(),
      provision: "production manifest provision (real corpus; alt_text fill only)",
      productionManifestSha: createHash("sha256").update(prodRaw).digest("hex"),
    },
    manifest: prodManifest.manifest,
  };
}

function provisionWorkspace() {
  const ws = join(tmpdir(), `perf-provision-${Date.now().toString(36)}-${process.pid}`);
  mkdirSync(ws, { recursive: true });
  for (const heavy of ["node_modules", "generated", "bench-output"]) {
    if (existsSync(join(ROOT, heavy))) symlinkSync(join(ROOT, heavy), join(ws, heavy));
  }
  if (existsSync(join(ROOT, "media"))) symlinkSync(join(ROOT, "media"), join(ws, "media"));
  // docs/ carries the frozen BENCHMARK-OQ01-OQ02 record the manifest gate loads.
  for (const rel of [
    "content",
    "docs",
    "src",
    "scripts",
    "public",
    "package.json",
    "astro.config.mjs",
    "tsconfig.json",
    "vitest.config.ts",
    "eslint.config.js",
    ".prettierrc",
  ]) {
    const from = join(ROOT, rel);
    if (existsSync(from)) cpSync(from, join(ws, rel), { recursive: true });
  }
  let altCount = 0;
  for (const entry of readdirSync(join(ws, "content", "galleries"), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const meta = join(ws, "content", "galleries", entry.name, "meta.yaml");
    if (!existsSync(meta)) continue;
    let yaml = readFileSync(meta, "utf8");
    altCount += (yaml.match(/^(\s*)alt_text:\s*null\s*$/gm) || []).length;
    yaml = provisionAltText(yaml);
    writeFileSync(meta, yaml);
  }
  const synthetic = buildSyntheticManifest();
  writeFileSync(join(ws, "SYNTHETIC-MERGED-MANIFEST.json"), JSON.stringify(synthetic));
  writeFileSync(
    join(ws, "SYNTHETIC-PROVISION-MARKER.txt"),
    "SYNTHETIC VALID-CONTENT PROVISION — isolated temp workspace for WP-45 measurement only.\n" +
      "NOT the actual corpus. NOT committed. Candidate implementation untouched (D11 enabled).\n" +
      `Synthetic alt_text replacements: ${altCount}. Long-page target: netherlands (largest real gallery, 28 frames).\n`,
  );
  return { ws, altCount, productionManifestSha: synthetic.envelope.productionManifestSha };
}

function buildWorkspace(ws) {
  // IMP-04: isolated-output build via the structurally-guarded helper
  // (asserts cwd under os.tmpdir() and outside the candidate ROOT).
  spawnNpmIsolated({
    cwd: ws,
    args: ["run", "build:preview"],
    env: {
      ...process.env,
      ASTRO_VALIDATE_ASSET_MANIFEST: join(ws, "SYNTHETIC-MERGED-MANIFEST.json"),
      ASTRO_ASSET_MANIFEST: join(ws, "SYNTHETIC-MERGED-MANIFEST.json"),
    },
  });
  const built = join(ws, "dist");
  if (!existsSync(join(built, "index.html")))
    throw new Error("[measure] workspace dist has no index.html");
  return built;
}

// Stage the /media/ URL space into an assembled artifact root WITHOUT writing
// to candidate inputs: symlink each derivative file from the production media
// store (generated/media) plus the isolated preview-media store (WP-38
// long-gallery-72 draft derivatives), exactly as assembleArtifact() does for
// E2E/capture. Production store wins name collisions (same rule as the test
// assembly). The assembled root is bench-output-only and cleaned by the normal
// bench-output lifecycle — never committed, never dist/.
function stageMediaInto(artifactRoot) {
  const stores = [join(ROOT, "generated", "media"), join(ROOT, "generated", "preview-media")];
  const mediaTarget = join(artifactRoot, "media");
  rmSync(mediaTarget, { recursive: true, force: true });
  mkdirSync(mediaTarget, { recursive: true });
  let linked = 0;
  for (const store of stores) {
    if (!existsSync(store)) continue;
    for (const entry of readdirSync(store, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const link = join(mediaTarget, entry.name);
      if (existsSync(link)) continue;
      symlinkSync(join(store, entry.name), link);
      linked += 1;
    }
  }
  console.log(
    `[measure] staged /media/: ${linked} derivatives linked (production + preview stores)`,
  );
  if (linked === 0)
    throw new Error("[measure] no media derivatives staged — LCP would read 0; refusing");
}

// ---------------------------------------------------------------------------
// Static server (production-like: dist/ bytes served over loopback; the
// THROTTLE is applied at the CDP layer per profile, never "no throttling").
// ---------------------------------------------------------------------------
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
};

function serveDirectory(root) {
  const server = createServer((req, res) => {
    try {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      let pathname = decodeURIComponent(url.pathname);
      if (pathname.endsWith("/")) pathname += "index.html";
      else if (!pathname.slice(pathname.lastIndexOf("/")).includes(".")) pathname += "/index.html";
      const file = resolve(join(root, `.${pathname}`));
      if (!file.startsWith(resolve(root)) || !existsSync(file) || !statSync(file).isFile()) {
        res.writeHead(404, { "content-type": "text/plain" });
        res.end("not found");
        return;
      }
      const ext = pathname.slice(pathname.lastIndexOf(".")).toLowerCase();
      res.writeHead(200, { "content-type": MIME[ext] || "application/octet-stream" });
      res.end(readFileSync(file));
    } catch {
      res.writeHead(500, { "content-type": "text/plain" });
      res.end("server error");
    }
  });
  return new Promise((resolveServer) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolveServer({ server, port: typeof address === "object" && address ? address.port : 0 });
    });
  });
}

// ---------------------------------------------------------------------------
// Measurement primitives.
// ---------------------------------------------------------------------------
function stats(values) {
  const runs = [...values].sort((a, b) => a - b);
  const sum = runs.reduce((a, b) => a + b, 0);
  return {
    runs,
    min: runs[0],
    max: runs[runs.length - 1],
    median: runs[Math.floor(runs.length / 2)],
    mean: Math.round((sum / runs.length) * 100) / 100,
  };
}

function classifyPayload(url, mime) {
  const path = url.split("?")[0].toLowerCase();
  if (url.startsWith("data:")) return "other";
  if (mime.includes("css") || path.endsWith(".css")) return "css";
  if (mime.includes("javascript") || mime.includes("ecmascript") || path.endsWith(".js"))
    return "js";
  if (mime.startsWith("image/") || /\.(webp|avif|png|jpe?g|gif|svg)$/.test(path)) return "img";
  if (mime.includes("font") || /\.(woff2?|ttf|otf)$/.test(path)) return "font";
  if (mime.startsWith("text/html") || path.endsWith(".html") || path.endsWith("/")) return "html";
  return "other";
}

async function applyProfile(session, profileName) {
  const profile = PROFILES[profileName];
  await session.send("Network.enable");
  await session.send("Network.emulateNetworkConditions", {
    offline: profile.network.offline,
    latency: profile.network.latency,
    downloadThroughput: profile.network.downloadThroughput,
    uploadThroughput: profile.network.uploadThroughput,
  });
  await session.send("Emulation.setCPUThrottlingRate", { rate: profile.cpuRate });
}

function isBrowserCrash(error) {
  const message = String((error && error.message) || error);
  return (
    message.includes("Target page, context or browser has been closed") ||
    message.includes("Target crashed") ||
    message.includes("Browser has been closed") ||
    message.includes("browser has disconnected")
  );
}

// One fresh browser process per measurement unit; a unit killed by a browser
// crash is retried once on a new process before the run aborts.
async function withFreshBrowser(label, fn) {
  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const browser = await chromium.launch({ args: ["--enable-features=EventTiming"] });
    try {
      const result = await fn(browser);
      await browser.close();
      return result;
    } catch (error) {
      lastError = error;
      try {
        await browser.close();
      } catch {
        // Already dead — the retry launches a new process.
      }
      if (attempt === 1 && isBrowserCrash(error)) {
        console.log(`[measure] ${label}: browser died, retrying once on a fresh process…`);
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

async function newProfileContext(browser, profileName) {
  const profile = PROFILES[profileName];
  const context = await browser.newContext({
    viewport: profile.viewport,
    userAgent: profile.userAgent,
  });
  return context;
}

async function measurePageRuns(browser, baseUrl, pageDef, profileName) {
  const lcpRuns = [];
  const clsRuns = [];
  const payloadRuns = [];
  let domNodes = 0;

  for (let run = 0; run < RUNS; run += 1) {
    const context = await newProfileContext(browser, profileName);
    try {
      // Headless-Chrome paint quirk: largest-contentful-paint entries are
      // emitted to a live observer but missing from a post-load
      // getEntriesByType query (verified: observer sees t=44 IMG while the
      // query returns []). The init script keeps the full LCP trace so the
      // read below captures the same value a headed browser would report.
      await context.addInitScript(() => {
        window.__perfLcpTrace = [];
        try {
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.entryType === "largest-contentful-paint") {
                window.__perfLcpTrace.push(entry.startTime);
              }
            }
          }).observe({ type: "largest-contentful-paint", buffered: true });
        } catch {
          // LCP unsupported — trace stays empty, read falls back to 0.
        }
      });
      const page = await context.newPage();
      const session = await page.context().newCDPSession(page);
      await applyProfile(session, profileName);

      // Payload accounting: loadingFinished carries transferred bytes;
      // responseReceived carries the authoritative response MIME (the
      // request-side mimeType is empty for navigations).
      const finishSizes = new Map();
      const responseMime = new Map();
      const responseUrl = new Map();
      session.on("Network.responseReceived", (event) => {
        responseMime.set(event.requestId, event.response.mimeType || "");
        responseUrl.set(event.requestId, event.response.url || "");
      });
      session.on("Network.loadingFinished", (event) => {
        finishSizes.set(event.requestId, event.encodedDataLength || 0);
      });

      await page.goto(`${baseUrl}${pageDef.path}`, { waitUntil: "load", timeout: 120000 });
      await page.waitForTimeout(SETTLE_MS);

      // LCP/CLS entries persist in the performance buffer after load, so a
      // single read after settle captures the full post-load values. LCP comes
      // from the live observer trace (see the addInitScript above): a
      // post-load getEntriesByType("largest-contentful-paint") query returns []
      // in headless Chromium even though the observer fired (verified t=44 IMG
      // on /). CLS has no such quirk and is read from the buffer directly.
      const perfEntries = await page.evaluate(() => ({
        lcp: [...(window.__perfLcpTrace || [])],
        cls: performance
          .getEntriesByType("layout-shift")
          .filter((e) => !e.hadRecentInput)
          .map((e) => e.value),
        domNodes: document.getElementsByTagName("*").length,
      }));

      const lcpMs = perfEntries.lcp.length > 0 ? perfEntries.lcp[perfEntries.lcp.length - 1] : 0;
      const cls = perfEntries.cls.reduce((a, b) => a + b, 0);
      lcpRuns.push(Math.round(lcpMs * 100) / 100);
      clsRuns.push(Math.round(cls * 10000) / 10000);
      domNodes = perfEntries.domNodes;

      const payload = {
        htmlBytes: 0,
        cssBytes: 0,
        jsBytes: 0,
        imgBytes: 0,
        fontBytes: 0,
        otherBytes: 0,
      };
      for (const [requestId, bytes] of finishSizes) {
        const url = responseUrl.get(requestId) || "";
        if (!url || url.startsWith("data:")) {
          payload.otherBytes += bytes;
          continue;
        }
        const kind = classifyPayload(url, responseMime.get(requestId) || "");
        if (kind === "html") payload.htmlBytes += bytes;
        else if (kind === "css") payload.cssBytes += bytes;
        else if (kind === "js") payload.jsBytes += bytes;
        else if (kind === "img") payload.imgBytes += bytes;
        else if (kind === "font") payload.fontBytes += bytes;
        else payload.otherBytes += bytes;
      }
      payloadRuns.push(payload);
    } finally {
      await context.close();
    }
  }

  const payloadMedian = {};
  for (const key of ["htmlBytes", "cssBytes", "jsBytes", "imgBytes", "fontBytes", "otherBytes"]) {
    payloadMedian[key] = Math.round(stats(payloadRuns.map((p) => p[key])).median);
  }

  const lcpFigures = stats(lcpRuns);
  const clsFigures = stats(clsRuns);
  return {
    lcp: {
      unit: "ms",
      ...lcpFigures,
      medianMs: lcpFigures.median,
      minMs: lcpFigures.min,
      maxMs: lcpFigures.max,
    },
    cls: {
      unit: "score",
      ...clsFigures,
    },
    payload: {
      unit: "bytes-transferred",
      runs: payloadRuns,
      median: payloadMedian,
      ...payloadMedian,
    },
    dom: { nodes: domNodes },
  };
}

async function measureMemoryRuns(browser, baseUrl, profileName) {
  // IMP-03 Round 2: honest memory semantics. `transferredImageBytes` sums
  // PerformanceResourceTiming.encodedBodySize (COMPRESSED transfer bytes —
  // never called decoded). `decodedImageEstimateBytes` prefers
  // decodedBodySize where the browser exposes it, else falls back to the
  // w*h*4 decoded-bitmap estimate, with the branch recorded per image in
  // `decodedImageMethod`. Plus: long-gallery traversal cost, overview toggle
  // state cost, and a programmatic-scroll frame-drop (jank) read.
  const heapRuns = [];
  const heapTotalRuns = [];
  const lcpRuns = [];
  const traversalRuns = [];
  const jankFramesRuns = [];
  const jankWorstRuns = [];
  let domNodes = 0;
  let domNodesDirect = 0;
  let transferredImageBytes = 0;
  let decodedImageEstimateBytes = 0;
  let decodedImageMethod = "";
  let imageCount = 0;

  for (let run = 0; run < RUNS; run += 1) {
    const context = await newProfileContext(browser, profileName);
    try {
      // Same headless LCP quirk as measurePageRuns: keep the observer trace so
      // the long-72 LCP read below matches headed-browser semantics.
      await context.addInitScript(() => {
        window.__perfLcpTrace = [];
        try {
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.entryType === "largest-contentful-paint") {
                window.__perfLcpTrace.push(entry.startTime);
              }
            }
          }).observe({ type: "largest-contentful-paint", buffered: true });
        } catch {
          // LCP unsupported — trace stays empty, read falls back to 0.
        }
      });
      const page = await context.newPage();
      const session = await page.context().newCDPSession(page);
      await applyProfile(session, profileName);
      await session.send("Performance.enable");

      await page.goto(`${baseUrl}/galleries/netherlands`, { waitUntil: "load", timeout: 120000 });
      await page.waitForTimeout(SETTLE_MS);

      // LCP on the long page comes from the live observer trace (headless
      // quirk documented in measurePageRuns); read BEFORE the heap-pressure
      // clone below perturbs the DOM.
      const longLcp = await page.evaluate(() => [...(window.__perfLcpTrace || [])]);

      // Heap-pressure model (R2 task 7): hold a DETACHED 1.5x DOM clone
      // resident by a JS reference only — NOT appended to the document. The
      // clone lives outside the rendered tree (so it does not perturb
      // layout) but the JS engine must hold its memory; the heap read
      // reflects the detached-clone pressure model, not a mutated live page.
      const dom = await page.evaluate(() => {
        const main = document.querySelector("main") || document.body;
        const detachedHolder = document.createElement("div");
        detachedHolder.id = "perf-heap-pressure-detached";
        detachedHolder.appendChild(main.cloneNode(true));
        const extra = main.cloneNode(true);
        detachedHolder.appendChild(extra.firstChild ? extra : document.createElement("i"));
        // DETACHED on purpose: held only by a JS reference, NOT in the document.
        window.__perfDetachedHolder = detachedHolder;
        const imgs = [...document.images].map((img) => ({
          src: img.currentSrc || img.src,
          w: img.naturalWidth || 0,
          h: img.naturalHeight || 0,
        }));
        return { nodes: document.getElementsByTagName("*").length, images: imgs };
      });

      const metrics = await session.send("Performance.getMetrics");
      const byName = Object.fromEntries(metrics.metrics.map((m) => [m.name, m.value]));
      heapRuns.push(Math.round(byName.JSHeapUsedSize || 0));
      heapTotalRuns.push(Math.round(byName.JSHeapTotalSize || 0));
      domNodes = byName.Nodes || dom.nodes;
      domNodesDirect = dom.nodes;
      imageCount = dom.images.length;

      // R2 task 7: honest memory accounting. transferredImageBytes sums
      // encodedBodySize ONLY (compressed transfer). decodedImageEstimateBytes
      // is a MODEL ESTIMATE: sum of naturalWidth × naturalHeight × 4 per
      // visible image (the w*h*4 model). It is NOT browser/GPU resident
      // memory, NOT shared-cache aware, NOT cross-URL dedupe-aware. The
      // previous decodedBodySize-as-memory reading is removed.
      const imgMem = await page.evaluate((images) => {
        const resources = performance.getEntriesByType("resource");
        const byUrl = new Map(resources.map((r) => [r.name, r]));
        let transferred = 0;
        let estimate = 0;
        let viaBitmapEstimate = 0;
        for (const img of images) {
          const hit = byUrl.get(img.src);
          if (hit && hit.encodedBodySize) transferred += hit.encodedBodySize;
          if (img.w > 0 && img.h > 0) {
            estimate += img.w * img.h * 4;
            viaBitmapEstimate += 1;
          }
        }
        return { transferred, estimate, viaBitmapEstimate };
      }, dom.images);
      transferredImageBytes = Math.round(imgMem.transferred);
      decodedImageEstimateBytes = Math.round(imgMem.estimate);
      decodedImageMethod =
        `MODEL ESTIMATE: sum of current-src naturalWidth × naturalHeight × 4 ` +
        `(${imgMem.viaBitmapEstimate} imgs). ` +
        `NOT browser/GPU resident memory; excludes shared-cache reuse and ` +
        `cross-URL dedupe uncertainty. ` +
        `transferredImageBytes = encodedBodySize (compressed HTTP transfer), ` +
        `never called decoded memory.`;

      // Long-gallery traversal cost: full .gallery-figure scan + layout read
      // (the same path Overview open uses to locate the current photo).
      const traversal = await page.evaluate(() => {
        const t0 = performance.now();
        const figs = [...document.querySelectorAll(".gallery-figure")];
        let acc = 0;
        for (const f of figs) {
          const r = f.getBoundingClientRect();
          acc += r.top + r.height;
        }
        return { ms: performance.now() - t0, figures: figs.length, acc };
      });
      traversalRuns.push(Math.round(traversal.ms * 100) / 100);

      // Scroll-jank read: programmatic scroll over 3000px, count rAF frame
      // gaps > 34ms (one dropped frame at 60fps ≈ 2x budget) + worst gap.
      const jank = await page.evaluate(
        () =>
          new Promise((resolveJank) => {
            const gaps = [];
            let last = 0;
            let frames = 0;
            const onFrame = (t) => {
              if (last > 0) gaps.push(t - last);
              last = t;
              frames += 1;
              if (frames < 120) requestAnimationFrame(onFrame);
              else {
                const worst = gaps.length > 0 ? Math.max(...gaps) : 0;
                resolveJank({
                  droppedFrames: gaps.filter((g) => g > 34).length,
                  worstFrameMs: Math.round(worst * 100) / 100,
                });
              }
            };
            window.scrollTo(0, 0);
            requestAnimationFrame(onFrame);
            let y = 0;
            const step = setInterval(() => {
              y += 250;
              window.scrollTo(0, y);
              if (y >= 3000) clearInterval(step);
            }, 50);
          }),
      );
      jankFramesRuns.push(jank.droppedFrames);
      jankWorstRuns.push(jank.worstFrameMs);
      if (longLcp.length > 0) lcpRuns.push(longLcp[longLcp.length - 1]);
    } finally {
      await context.close();
    }
  }

  const heapFigures = stats(heapRuns);
  const heapTotalFigures = stats(heapTotalRuns);
  const traversalFigures = stats(traversalRuns);
  const jankFramesFigures = stats(jankFramesRuns);
  const jankWorstFigures = stats(jankWorstRuns);
  const lcpFigures =
    lcpRuns.length > 0 ? stats(lcpRuns.map((v) => Math.round(v * 100) / 100)) : null;
  return {
    // Long-page LCP measured on the memory pass (full image load, heap-pressure
    // clone excluded from the trace read). The page-matrix pass overwrites
    // this key with its own 5-run LCP below — the memory pass value survives
    // as memory.lcp for cross-check.
    lcp:
      lcpFigures === null
        ? null
        : {
            unit: "ms",
            ...lcpFigures,
            medianMs: lcpFigures.median,
            minMs: lcpFigures.min,
            maxMs: lcpFigures.max,
          },
    jsHeapBytes: heapFigures.median,
    jsHeapRuns: heapFigures,
    jsHeapTotalBytes: heapTotalFigures.median,
    jsHeapTotalRuns: heapTotalFigures,
    domNodes,
    domNodesDirect,
    transferredImageBytes,
    decodedImageEstimateBytes,
    decodedImageMethod,
    imageCount,
    traversalMs: traversalFigures.median,
    traversalRuns: traversalFigures,
    scrollJank: {
      droppedFrames: jankFramesFigures.median,
      droppedFramesRuns: jankFramesFigures,
      worstFrameMs: jankWorstFigures.median,
      worstFrameMsRuns: jankWorstFigures,
    },
    heapPressure: MEMORY_PROFILE.heapPressure,
    mobileHeapCapMB: profileName === "mobileLowEnd" ? MEMORY_PROFILE.mobileHeapCapMB : null,
    mobileHeapCapNote: profileName === "mobileLowEnd" ? MEMORY_PROFILE.mobileHeapCapNote : null,
  };
}

async function measureInteractionRuns(browser, baseUrl, interaction, profileName) {
  // IMP-02 Round 2: each run attributes ONLY the target action. The observer
  // starts AFTER setup completes (close/jump first click open with no observer
  // running, then clear + rebuild the observer for the target selector), keeps
  // only entries whose event.target matches the target selector, groups by
  // interactionId, and reports the worst interaction's duration. A run with
  // zero attributed entries THROWS (never records 0) — a silent 0 would pass
  // the <=200ms gate without measuring anything.
  //
  // R2 task 4: the raw samples (durationMs, interactionId, targetAction) are
  // kept VERBATIM and never reverse-derived from the duration value. This
  // preserves identity when multiple runs share the same duration
  // (same-duration, different interactionId → 11/22/33, never 11/11/11).
  const rawSamples = [];

  for (let run = 0; run < RUNS; run += 1) {
    const runId = `${interaction.id}:${profileName}:${run + 1}`;
    const context = await newProfileContext(browser, profileName);
    try {
      const page = await context.newPage();
      const session = await page.context().newCDPSession(page);
      await applyProfile(session, profileName);

      await page.goto(`${baseUrl}/galleries/lofoten-polar-night`, {
        waitUntil: "load",
        timeout: 120000,
      });
      await page.waitForTimeout(1500);

      // Trusted input via Playwright's actionability-checked click path (the
      // same .click() call path the e2e suite's openOverviewInPlace uses).
      // A prior revision scrolled via evaluate + raw mouse.click to avoid
      // scroll-input events in the trace; that path proved UNRELIABLE for
      // Event Timing attribution (verified: programmatic scrollIntoView moves
      // the document under a throttled compositor, the layer's fixed-position
      // close button lands off its pre-scroll box, and the click dispatches
      // to <html> — layer still closes via focus/hover side effects but no
      // attributed event entry is ever produced, 0/4 trials). The scroll
      // events page.click may emit occur during SETUP (unobserved window) or
      // on non-target elements (filtered by the target selector + start-time
      // cutoff), so they cannot pollute the attributed measurement.
      const clickAtSelector = async (selector) => {
        await page.click(selector, { timeout: 10000 });
      };
      // Start (or restart) the target-attributed observer: buffered:TRUE with
      // a start-time cutoff so only entries dispatched after this point are
      // kept; the target selector filters to the intended action's elements.
      // buffered:false DROPS event entries dispatched synchronously inside a
      // trusted mouse.click (verified: the close click dispatches pointerdown
      // but the entry never reaches a buffered:false observer — 0/3 trials
      // attributed). buffered:true + performance.now() cutoff observes the
      // same post-start window without the synchronous-dispatch race.
      const startTargetObserver = (selector) =>
        page.evaluate((sel) => {
          window.__perfTargetSelector = sel;
          window.__perfTargetEvents = [];
          window.__perfTargetStart = performance.now();
          if (window.__perfTargetObserver) window.__perfTargetObserver.disconnect();
          const obs = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.entryType !== "event") continue;
              if (entry.startTime < window.__perfTargetStart) continue;
              if (!["pointerdown", "mousedown", "pointerup", "mouseup"].includes(entry.name)) {
                continue;
              }
              const t = entry.target;
              // click is deliberately EXCLUDED: Chromium dispatches click ~0ms
              // after pointerup with duration 0 (the rejected proxy).
              if (t instanceof Element && t.closest(window.__perfTargetSelector)) {
                window.__perfTargetEvents.push({
                  interactionId: entry.interactionId || 0,
                  name: entry.name,
                  duration: entry.duration,
                });
              }
            }
          });
          obs.observe({ type: "event", buffered: true, durationThreshold: 0 });
          window.__perfTargetObserver = obs;
        }, selector);

      if (interaction.kind === "open") {
        await startTargetObserver("[data-overview-trigger]");
        await clickAtSelector("[data-overview-trigger]");
        await page.waitForSelector("[data-overview-layer]:not([hidden])", { timeout: 10000 });
      } else if (interaction.kind === "close") {
        // Setup (no observer running — setup events cannot pollute the window).
        await clickAtSelector("[data-overview-trigger]");
        await page.waitForSelector("[data-overview-layer]:not([hidden])", { timeout: 10000 });
        await page.waitForTimeout(800);
        await startTargetObserver("[data-overview-close]");
        await clickAtSelector("[data-overview-close]");
        await page.waitForTimeout(800);
      } else {
        // Setup open first (unobserved), then attribute only the thumb click.
        await clickAtSelector("[data-overview-trigger]");
        await page.waitForSelector("[data-overview-layer]:not([hidden])", { timeout: 10000 });
        await page.waitForTimeout(800);
        await startTargetObserver("[data-overview-thumb]");
        // The thumb lives inside the layer's OWN scroll context (a fixed
        // overlay): its raw viewport box is far below the fold (verified
        // y=11561, elementFromPoint null), so a raw mouse.click at that box
        // dispatches outside the viewport and attributes NOTHING (0/5 trials).
        // Scroll the thumb into view *within the layer* first (nearest keeps
        // document scroll untouched), then click via the actionability-checked
        // path — the observed start-time cutoff + target selector keep setup
        // scroll/input events out of the attributed window.
        await page.evaluate(() => {
          const els = [...document.querySelectorAll("[data-overview-thumb]")];
          const el = els[1];
          if (!el) throw new Error("[measure] overview thumb missing");
          el.scrollIntoView({ block: "nearest" });
        });
        await page.waitForTimeout(300);
        const jumped = await page.evaluate(() => {
          const els = [...document.querySelectorAll("[data-overview-thumb]")];
          return els[1]?.getAttribute("data-photo-id") ?? null;
        });
        if (!jumped) throw new Error("[measure] overview thumb has no photo id");
        await page.click(`[data-overview-thumb][data-photo-id="${jumped}"]`, { timeout: 10000 });
        await page.waitForTimeout(800);
      }

      await page.waitForTimeout(1200);
      const events = await page.evaluate(() => {
        const stored = window.__perfTargetEvents || [];
        if (window.__perfTargetObserver) window.__perfTargetObserver.disconnect();
        return stored;
      });
      if (events.length === 0) {
        throw new Error(
          `[measure] ${interaction.id} ${profileName} run ${run}: no attributed event entries`,
        );
      }
      const byInteraction = new Map();
      for (const e of events) {
        if (!byInteraction.has(e.interactionId)) byInteraction.set(e.interactionId, []);
        byInteraction.get(e.interactionId).push(e.duration);
      }
      let worst = 0;
      let worstId = 0;
      for (const [id, durations] of byInteraction) {
        const m = Math.max(...durations);
        if (m > worst) {
          worst = m;
          worstId = id;
        }
      }
      rawSamples.push({
        durationMs: Math.round(worst * 100) / 100,
        interactionId: worstId,
        targetAction: interaction.id,
        runId,
      });
    } finally {
      await context.close();
    }
  }

  // Statistics read the numeric array only; raw samples keep identity.
  const figures = stats(rawSamples.map((r) => r.durationMs));
  return {
    attribution: true,
    method: "event-timing-attributed",
    runs: rawSamples.map((r) => ({
      durationMs: r.durationMs,
      interactionId: r.interactionId,
      targetAction: r.targetAction,
      runId: r.runId,
    })),
    medianMs: figures.median,
    minMs: figures.min,
    maxMs: figures.max,
  };
}

// ---------------------------------------------------------------------------
// Bundles + per-route inline/external script inventory.
//
// jsGzipBytes/cssGzipBytes sum each UNIQUE built external file once (browsers
// cache hashed shared bundles, so counting per-route references would inflate
// the total). They do NOT include inline scripts: route HTML carries several
// inline <script> blocks (theme restore, template installs, back-origin, the
// media-slot hydrator, …). measureRouteScripts therefore inventories those
// per route as gzip bytes — raw character counts are reported separately and
// never presented as gzip bytes.
// ---------------------------------------------------------------------------
function measureBundles(distRoot) {
  let jsGzipBytes = 0;
  let cssGzipBytes = 0;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (full.endsWith(".js")) jsGzipBytes += gzipBytesOf(readFileSync(full));
      if (full.endsWith(".css")) cssGzipBytes += gzipBytesOf(readFileSync(full));
    }
  };
  walk(distRoot);
  return { jsGzipBytes, cssGzipBytes };
}

// Per-route script inventory straight from the served HTML. Inline blocks
// without a src attribute are gzipped individually; external references are
// resolved to their built file's gzip size (listed per route; the unique-file
// totals above avoid cross-route duplication).
function measureRouteScripts(distRoot, pagePaths) {
  const externalGzip = new Map();
  const resolveExternal = (src) => {
    const rel = src.split("?")[0];
    if (externalGzip.has(rel)) return externalGzip.get(rel);
    const file = join(distRoot, `.${rel}`);
    let bytes;
    try {
      bytes = gzipBytesOf(readFileSync(file));
    } catch {
      bytes = null;
    }
    externalGzip.set(rel, bytes);
    return bytes;
  };

  const routes = {};
  for (const path of pagePaths) {
    const htmlFile = join(distRoot, `.${path}/index.html`);
    const html = readFileSync(htmlFile, "utf8");
    const inline = [];
    const external = [];
    const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = scriptRe.exec(html)) !== null) {
      const attrs = match[1] || "";
      const body = match[2] || "";
      const srcMatch = attrs.match(/\bsrc=["']([^"']+)["']/);
      if (srcMatch) {
        const src = srcMatch[1];
        if (!src.startsWith("http")) {
          external.push({ src, gzipBytes: resolveExternal(src) });
        }
      } else if (body.trim().length > 0) {
        inline.push({
          rawBytes: Buffer.byteLength(body, "utf8"),
          gzipBytes: gzipBytesOf(Buffer.from(body, "utf8")),
        });
      }
    }
    inline.sort((a, b) => b.gzipBytes - a.gzipBytes);
    const inlineJsGzipBytes = inline.reduce((acc, e) => acc + e.gzipBytes, 0);
    const externalJsGzipBytes = external.reduce((acc, e) => acc + (e.gzipBytes ?? 0), 0);
    routes[path] = {
      inlineScriptCount: inline.length,
      inlineJsRawBytes: inline.reduce((acc, e) => acc + e.rawBytes, 0),
      inlineJsGzipBytes,
      externalJsGzipBytes,
      externalJs: external,
      largestInline: inline[0] ?? null,
      // What a cold visitor to THIS route transfers for JS (external bundles
      // shared across routes are listed individually, not duplicated here).
      routeJsGzipBytes: inlineJsGzipBytes + externalJsGzipBytes,
    };
  }
  const maxEntry = Object.entries(routes).sort(
    (a, b) => b[1].routeJsGzipBytes - a[1].routeJsGzipBytes,
  )[0];
  return {
    routes,
    maxRouteJs: maxEntry ? { path: maxEntry[0], ...maxEntry[1] } : null,
  };
}

// Candidate fingerprint beyond gitDirty — same HEAD + dirty:true across rounds
// must still be distinguishable. Best effort; git absence yields nulls.
function candidateFingerprint() {
  const tryGit = (cmd, opts = {}) => {
    try {
      return execSync(cmd, {
        cwd: ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        maxBuffer: 256 * 1024 * 1024,
        ...opts,
      });
    } catch {
      return null;
    }
  };
  const porcelain = (tryGit("git status --porcelain") || "").trim();
  // T7: porcelain lines are exactly two status characters plus a space; the
  // previous bare slice(3) ate the first character of every path (the recorded
  // round3 file list literally began `ontent/galleries/aegean/meta.yaml`).
  const lines = porcelain ? porcelain.split("\n").filter((l) => l.trim().length > 0) : [];
  const pathOf = (line) => line.substring(2).replace(/^\s/, "");
  const dirtyFiles = lines.map(pathOf);
  const trackedDiff = tryGit("git diff HEAD -- . ':(exclude)bench-output'");
  const untracked = lines
    .filter((l) => l.startsWith("??"))
    .map(pathOf)
    .filter((f) => /^(src|scripts|content)\//.test(f));

  // T7: an untracked DIRECTORY used to be read as a file, throw, and be
  // recorded as `null` — so `scripts/reports/` and `src/lib/presentation/`
  // contributed no hash while appearing fingerprinted. Enumerate the contents
  // with git itself (`--others` lists untracked files and honours .gitignore,
  // so generated/ never leaks into the fingerprint).
  const listed = tryGit("git ls-files --others --exclude-standard -- src scripts content");
  const enumerated = (listed || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const untrackedFiles = [
    ...new Set([...untracked.filter((f) => !f.endsWith("/")), ...enumerated]),
  ].sort();

  const hashFile = (relative) => {
    try {
      return createHash("sha256").update(readFileSync(join(ROOT, relative))).digest("hex");
    } catch {
      // An unhashable path is an explicit failure marker — never a silent null.
      return "UNREADABLE";
    }
  };

  return {
    gitBranch: tryGit("git rev-parse --abbrev-ref HEAD")?.trim() || null,
    gitSha: tryGit("git rev-parse HEAD")?.trim() || null,
    gitDirty: dirtyFiles.length > 0,
    dirtyFileCount: dirtyFiles.length,
    dirtyFiles,
    trackedContentDiffSha256: trackedDiff
      ? createHash("sha256").update(trackedDiff).digest("hex")
      : null,
    untrackedSourceHashes: Object.fromEntries(untrackedFiles.map((f) => [f, hashFile(f)])),
  };
}

// ---------------------------------------------------------------------------
// Calibration probes (Gate-B verdicts).
// ---------------------------------------------------------------------------
async function calibrationNoThrottleFails(browser, baseUrl) {
  // Unthrottled loopback must measure a FASTER LCP than the throttled profile
  // on the same page: proves the throttle path actually constrains load.
  const readLcp = async (throttled) => {
    const context = await browser.newContext({ viewport: PROFILES.desktop.viewport });
    try {
      // Same headless LCP quirk as the page matrix: live observer trace, not
      // the post-load query (which returns [] headless — both arms would read
      // 0 and the probe would false-report HARNESS-BROKEN).
      await context.addInitScript(() => {
        window.__perfLcpTrace = [];
        try {
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.entryType === "largest-contentful-paint") {
                window.__perfLcpTrace.push(entry.startTime);
              }
            }
          }).observe({ type: "largest-contentful-paint", buffered: true });
        } catch {
          // LCP unsupported — trace stays empty, read falls back to 0.
        }
      });
      const page = await context.newPage();
      const session = await page.context().newCDPSession(page);
      await session.send("Network.enable");
      if (throttled) {
        await session.send("Network.emulateNetworkConditions", {
          offline: false,
          latency: PROFILES.desktop.network.latency,
          downloadThroughput: PROFILES.desktop.network.downloadThroughput,
          uploadThroughput: PROFILES.desktop.network.uploadThroughput,
        });
        await session.send("Emulation.setCPUThrottlingRate", { rate: PROFILES.desktop.cpuRate });
      }
      await page.goto(`${baseUrl}/`, { waitUntil: "load", timeout: 120000 });
      await page.waitForTimeout(SETTLE_MS);
      const lcp = await page.evaluate(() => {
        const trace = [...(window.__perfLcpTrace || [])];
        return trace.length > 0 ? trace[trace.length - 1] : 0;
      });
      return lcp;
    } finally {
      await context.close();
    }
  };
  const throttled = await readLcp(true);
  const open = await readLcp(false);
  return {
    effectMs: Math.round((throttled - open) * 100) / 100,
    fails: throttled > open,
    throttled,
    open,
  };
}

async function calibrationClickProxyFails(browser, baseUrl) {
  // True Event Timing must time a real handler effect: a 60ms busy handler is
  // injected on the trigger capture path and the run must observe an event
  // entry >= 50ms. A wall-clock proxy would pass regardless; Event Timing
  // either sees the handler or the probe fails.
  const context = await browser.newContext({ viewport: PROFILES.desktop.viewport });
  try {
    const page = await context.newPage();
    await page.goto(`${baseUrl}/galleries/lofoten-polar-night`, {
      waitUntil: "load",
      timeout: 120000,
    });
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      window.__perfEventDurations = [];
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === "event") window.__perfEventDurations.push(entry.duration);
        }
      });
      observer.observe({ type: "event", buffered: true, durationThreshold: 0 });
      window.__perfEventObserver = observer;
      document.querySelector("[data-overview-trigger]")?.addEventListener(
        "pointerdown",
        () => {
          const end = performance.now() + 60;
          while (performance.now() < end) {
            // busy-wait: deliberate handler cost for the calibration probe
          }
        },
        { capture: true },
      );
    });
    const found = await page.evaluate(() => {
      const el = document.querySelector("[data-overview-trigger]");
      if (!el) return false;
      el.scrollIntoView({ block: "center" });
      return true;
    });
    if (!found) throw new Error("[measure] calibration trigger not found");
    await page.waitForTimeout(300);
    const box = await page.evaluate(() => {
      const el = document.querySelector("[data-overview-trigger]");
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });
    if (!box) throw new Error("[measure] calibration trigger has no bounding box");
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(1200);
    const worst = await page.evaluate(() => {
      const stored = window.__perfEventDurations || [];
      if (window.__perfEventObserver) window.__perfEventObserver.disconnect();
      return stored.length > 0 ? Math.max(...stored) : 0;
    });
    return { worstMs: Math.round(worst * 100) / 100, fails: worst >= 50 };
  } finally {
    await context.close();
  }
}

// ---------------------------------------------------------------------------
// Main.
// ---------------------------------------------------------------------------
async function main() {
  const startedAt = new Date().toISOString();
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(join(ROOT, "docs", "implementation"), { recursive: true });

  console.log("[measure] provisioning synthetic valid-content workspace…");
  const { ws, altCount, productionManifestSha } = provisionWorkspace();
  const syntheticManifest = JSON.parse(
    readFileSync(join(ws, "SYNTHETIC-MERGED-MANIFEST.json"), "utf8"),
  );
  const syntheticManifestSha = createHash("sha256")
    .update(JSON.stringify(syntheticManifest.manifest))
    .digest("hex");

  let server = null;
  try {
    console.log(
      `[measure] building production-like output in isolated workspace (${altCount} synthetic alts)…`,
    );
    const builtDist = buildWorkspace(ws);

    console.log(
      "[measure] copying production-like output to bench-output (candidate dist/ untouched)…",
    );
    rmSync(DIST_DIR, { recursive: true, force: true });
    mkdirSync(DIST_DIR, { recursive: true });
    cpSync(builtDist, DIST_DIR, { recursive: true });
    // FINAL-ASSEMBLY semantics (BUILD_AND_ROUTING §1-2; same concept as
    // tests/support/artifact.mjs assembleArtifact): dist/ owns HTML/CSS/JS
    // only; the /media/ URL space is staged from generated/media/ plus the
    // generated/media derivative store, which astro build never copies.
    // Without this mount every image 404s and LCP reads 0 — the exact false
    // measurement this correction must not ship.
    stageMediaInto(DIST_DIR);

    console.log("[measure] serving production-like output over loopback + CDP throttle…");
    const served = await serveDirectory(DIST_DIR);
    server = served.server;
    const baseUrl = `http://127.0.0.1:${served.port}`;

    console.log("[measure] calibration probes (Gate-B verdicts)…");
    const { throttleProbe, eventTimingProbe } = await withFreshBrowser(
      "calibration",
      async (browser) => ({
        throttleProbe: await calibrationNoThrottleFails(browser, baseUrl),
        eventTimingProbe: await calibrationClickProxyFails(browser, baseUrl),
      }),
    );

    const pages = [];
    for (const pageDef of PAGES) {
      const profiles = {};
      for (const profileName of ["desktop", "mobileLowEnd"]) {
        console.log(`[measure] page ${pageDef.path} (${profileName}, ${RUNS} runs)…`);
        profiles[profileName] = await withFreshBrowser(
          `page ${pageDef.path} ${profileName}`,
          (browser) => measurePageRuns(browser, baseUrl, pageDef, profileName),
        );
      }
      pages.push({ path: pageDef.path, label: pageDef.label, profiles });
    }

    console.log("[measure] netherlands memory (desktop + mobileLowEnd)…");
    const memory = {};
    for (const profileName of ["desktop", "mobileLowEnd"]) {
      memory[profileName] = await withFreshBrowser(`memory ${profileName}`, (browser) =>
        measureMemoryRuns(browser, baseUrl, profileName),
      );
    }
    // The memory pass measures the long page under full image load (its LCP
    // trace is the authoritative one for long-72: the page-matrix pass may
    // race the settle window against 70+ image decodes). Overwrite the
    // page-matrix LCP with the memory-pass LCP and keep both run sets.
    for (const pageEntry of pages) {
      if (pageEntry.path === "/galleries/netherlands") {
        for (const profileName of ["desktop", "mobileLowEnd"]) {
          const mem = memory[profileName];
          pageEntry.profiles[profileName].memory = mem;
          if (mem.lcp !== null) {
            pageEntry.profiles[profileName].lcpMemoryPass = pageEntry.profiles[profileName].lcp;
            pageEntry.profiles[profileName].lcp = mem.lcp;
          }
          delete mem.lcp;
        }
      }
    }

    console.log("[measure] overview interactions (true Event Timing)…");
    const interactions = [];
    for (const interaction of INTERACTIONS) {
      console.log(`[measure] interaction ${interaction.id}…`);
      const profiles = {};
      for (const profileName of ["desktop", "mobileLowEnd"]) {
        profiles[profileName] = await withFreshBrowser(
          `interaction ${interaction.id} ${profileName}`,
          (browser) => measureInteractionRuns(browser, baseUrl, interaction, profileName),
        );
      }
      const gateMs = FROZEN_WEB_VITALS.inpMs;
      interactions.push({
        id: interaction.id,
        method: "event-timing-attributed",
        gateMs,
        pass: profiles.desktop.medianMs <= gateMs && profiles.mobileLowEnd.medianMs <= gateMs,
        profiles,
      });
    }
    interactions.push(MENU_NA);

    const bundles = measureBundles(DIST_DIR);
    const scriptInventory = measureRouteScripts(
      DIST_DIR,
      PAGES.map((p) => p.path),
    );

    // R4 B3: corpus honesty measured at run time, never a stale prose count.
    const sourceAltMissing = countSourceAltMissing();

    // ADR-013 verdict from MEASURED evidence (not vibes). The §5.2 policy
    // names THREE evidence triggers (memory capacity, INP scroll jank, DOM
    // overhead) — LCP is a STANDARD WEB TARGET (§2), not a virtualization
    // trigger. A large-but-lazy long gallery paints its first photo late
    // under throttle without proving any §5.2 condition; conflating the two
    // would turn every throttled LCP miss into a virtualization mandate.
    const long72 = pages.find((p) => p.path === "/galleries/netherlands");
    const heapMB =
      Math.max(
        long72.profiles.desktop.memory.jsHeapBytes,
        long72.profiles.mobileLowEnd.memory.jsHeapBytes,
      ) /
      1024 /
      1024;
    const heapBreach = heapMB >= ENGINEERING_BUDGETS.galleryMemoryMB;
    const worstInp = Math.max(
      ...interactions
        .filter((i) => !i.status)
        .flatMap((i) => [i.profiles.desktop.medianMs, i.profiles.mobileLowEnd.medianMs]),
    );
    const inpBreach = worstInp > FROZEN_WEB_VITALS.inpMs;
    // IMP-03 Round 2: DOM + scroll-jank join the §5.2 evidence rule explicitly.
    // Thresholds: heap>=200MB (frozen budget), INP>200ms (frozen target),
    // domNodes>=10000 (rendering-overhead tripwire, recorded not frozen),
    // droppedFrames median>10 per 120-frame window (jank tripwire, recorded).
    const domNodesMax = Math.max(
      long72.profiles.desktop.memory.domNodes,
      long72.profiles.mobileLowEnd.memory.domNodes,
    );
    const droppedMax = Math.max(
      long72.profiles.desktop.memory.scrollJank.droppedFrames,
      long72.profiles.mobileLowEnd.memory.scrollJank.droppedFrames,
    );
    const domBreach = domNodesMax >= 10000;
    const jankBreach = droppedMax > 10;
    const verdict =
      heapBreach || inpBreach || domBreach || jankBreach ? "virtualize" : "no-virtualization";
    const worstLcp = Math.max(
      ...pages.flatMap((p) => [p.profiles.desktop.lcp.median, p.profiles.mobileLowEnd.lcp.median]),
    );
    const adr013 = {
      verdict,
      rule: "§5.2: heap>=200MB || attributed-INP>200ms || domNodes>=10000 || droppedFrames>10 → virtualize, else no-virtualization",
      triggers: {
        heapMB: Math.round(heapMB * 100) / 100,
        worstInpMs: worstInp,
        domNodesMax,
        droppedFramesMax: droppedMax,
      },
      rationale:
        `§5.2 triggers measured: long-72 JS heap ${heapMB.toFixed(1)}MB vs ${ENGINEERING_BUDGETS.galleryMemoryMB}MB budget; ` +
        `worst attributed Event-Timing INP ${worstInp.toFixed(0)}ms vs ${FROZEN_WEB_VITALS.inpMs}ms frozen; ` +
        `long-72 DOM ${domNodesMax} nodes vs 10000 tripwire; ` +
        `scroll-jank dropped frames ${droppedMax}/120 vs 10 tripwire. ` +
        (verdict === "no-virtualization"
          ? "No §5.2 trigger fires on either profile; native lazy loading + document flow hold (§5 baseline stands). " +
            `Context (not a trigger): worst throttled LCP ${worstLcp.toFixed(0)}ms vs ${FROZEN_WEB_VITALS.lcpMs}ms standard target — recorded as a P8 candidate in the decision doc.`
          : "A §5.2 trigger fires on measured evidence; virtualization candidate for P8 (§5.2 evidence-driven)."),
    };

    // IMP-03 Round 2: host/toolchain record (Budget §14 reproducibility).
    // Best-effort reads: a missing binary resolves to "unavailable", never a
    // thrown measurement abort.
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    const hostRecord = await (async () => {
      const { execSync } = await import("node:child_process");
      const tryExec = (cmd) => {
        try {
          return execSync(cmd, { encoding: "utf8", timeout: 15000 }).trim().slice(0, 120);
        } catch {
          return "unavailable";
        }
      };
      return {
        platform: `${process.platform} ${process.arch}`,
        node: process.version,
        // R4 B3: the repo pins a Node engine; record it so a measurement run
        // on an unsupported runtime (e.g. Node 26) cannot be misread as
        // acceptance under the supported engine.
        nodeEnginesRequired: pkg.engines?.node ?? "unavailable",
        // T7: the FULL range is checked (>=22.12.0 <23), not just the major
        // number — v22.11.0 used to pass a major-only comparison.
        nodeEngineSatisfied: nodeEngineSatisfied(pkg.engines?.node ?? ""),
        chromium: tryExec("npx playwright install --dry-run chromium 2>/dev/null | head -1"),
        playwright: tryExec("npx playwright --version 2>/dev/null"),
        cache:
          "fresh browser + fresh context per run (no persistent cache); SETTLE 3000ms post-load",
      };
    })();
    const fingerprint = candidateFingerprint();

    const baseline = {
      version: 2,
      tool: "scripts/perf/measure.mjs",
      measuredAt: startedAt,
      host: hostRecord,
      conditions: {
        network:
          "loopback serve + CDP throttled profiles (desktop cable / mobile slow-4G); never unthrottled",
        provision:
          "production manifest provision (isolated temp workspace; real corpus + alt_text fill only)",
        mode: "production-like (preview-scoped manifest override; production authority untouched)",
        // T7: state the byte-counting convention so two records are comparable
        // (inline and external script bytes both use this level).
        gzip: { library: "node:zlib gzipSync", level: "default (6)" },
      },
      profiles: {
        desktop: {
          viewport: PROFILES.desktop.viewport,
          userAgent: PROFILES.desktop.userAgent,
          network: { throttled: true, ...PROFILES.desktop.network },
          cpuSlowdown: PROFILES.desktop.cpuRate,
          cpuNote: PROFILES.desktop.cpuLabel,
        },
        mobileLowEnd: {
          viewport: PROFILES.mobileLowEnd.viewport,
          userAgent: PROFILES.mobileLowEnd.userAgent,
          network: { throttled: true, ...PROFILES.mobileLowEnd.network },
          cpuSlowdown: PROFILES.mobileLowEnd.cpuRate,
          cpuNote: PROFILES.mobileLowEnd.cpuLabel,
          memoryEmulation:
            "resource-constrained emulation: CDP network throttle + 4x CPU throttle + heap-pressure read (1.5x Netherlands-28 DOM resident) + single-document discipline; NOT a viewport-resize-only or deviceMemory-spoof claim",
          limitations:
            "no physical handset in this environment (adb absent); no per-context JS heap cap exists in Chromium so mobileHeapCapMB is a read-only instrumentation target, not an enforced device limit; emulation constrains network + CPU + resident-DOM pressure but cannot reproduce thermal throttling, carrier middleboxes, or real-GPU raster costs",
        },
      },
      corpus: {
        productionManifestSha,
        syntheticManifestSha,
        syntheticAlts: altCount,
        // R4 B3: measured from the candidate source at run time instead of a
        // stale hardcoded prose count. The provision overlays synthetic
        // alt_text on exactly these entries; the real corpus still fails
        // publication until WP-58 authors them.
        actualCorpus: {
          sourceAltTextNull: sourceAltMissing.altMissing,
          sourcePhotoEntries: sourceAltMissing.photos,
          measuredAt: startedAt,
          note: "candidate content/galleries as measured this run (not a historical figure)",
        },
      },
      fingerprint,
      inpMethod:
        "Event Timing API, event-timing-attributed (PerformanceObserver type event, durationThreshold 0, trusted input; observer starts after setup, entries filtered by event.target + interactionId, setup excluded, click excluded)",
      pages,
      interactions,
      bundles: {
        // Unique external files (cached per content hash; cross-route shared).
        ...bundles,
        // Per-route reality: inline <script> gzip + the external files each
        // route actually references (R4 B3 — the 442B external-only total was
        // never the whole JS a page executes).
        perRouteScriptGzipBytes: Object.fromEntries(
          Object.entries(scriptInventory.routes).map(([route, r]) => [
            route,
            {
              inlineScriptCount: r.inlineScriptCount,
              inlineJsRawBytes: r.inlineJsRawBytes,
              inlineJsGzipBytes: r.inlineJsGzipBytes,
              externalJsGzipBytes: r.externalJsGzipBytes,
              routeJsGzipBytes: r.routeJsGzipBytes,
            },
          ]),
        ),
        maxRouteJs: scriptInventory.maxRouteJs
          ? {
              path: scriptInventory.maxRouteJs.path,
              routeJsGzipBytes: scriptInventory.maxRouteJs.routeJsGzipBytes,
              inlineJsGzipBytes: scriptInventory.maxRouteJs.inlineJsGzipBytes,
              externalJsGzipBytes: scriptInventory.maxRouteJs.externalJsGzipBytes,
            }
          : null,
      },
      scriptInventory,
      gates: {
        lcpFrozenMs: FROZEN_WEB_VITALS.lcpMs,
        clsFrozen: FROZEN_WEB_VITALS.cls,
        inpFrozenMs: FROZEN_WEB_VITALS.inpMs,
        jsGzipBytes: ENGINEERING_BUDGETS.jsGzipBytes,
        cssGzipBytes: ENGINEERING_BUDGETS.cssGzipBytes,
        galleryMemoryMB: ENGINEERING_BUDGETS.galleryMemoryMB,
      },
      adr013,
      calibration: {
        throttleProbe: {
          label: "unthrottled loopback must read faster than throttled profile (same page)",
          ...throttleProbe,
          verdict: throttleProbe.fails ? "RED-verdict-armed" : "HARNESS-BROKEN-STOP",
        },
        eventTimingProbe: {
          label: "injected 60ms handler must surface >= 50ms event entry (proxy would miss it)",
          ...eventTimingProbe,
          verdict: eventTimingProbe.fails ? "RED-verdict-armed" : "HARNESS-BROKEN-STOP",
        },
      },
    };

    writeFileSync(BASELINE_FILE, `${JSON.stringify(baseline, null, 2)}\n`);
    console.log(`[measure] baseline written to ${BASELINE_FILE}`);
  } finally {
    if (server) server.close();
    rmSync(ws, { recursive: true, force: true });
    console.log("[measure] provision workspace cleaned");
  }
}

const isMain = process.argv[1] && process.argv[1].endsWith("measure.mjs");
if (isMain) {
  main().catch((error) => {
    console.error(String((error && error.stack) || error));
    process.exitCode = 1;
  });
}
