// WP-24 — manifest consumption boundary (Astro build-time) integration tests.
//
// RED set (frozen WP-24 brief):
//   (a) building (astro build, production mode) with the manifest MISSING
//       fails with the CLEAR producer-before-consumer error (not a runtime
//       crash);
//   (b) building with a STALE/INCOMPLETE manifest (a purpose's records
//       deleted) fails closure (13.1#18 coverage findings, build-blocking);
//   (c) a built page's src/srcset attributes equal the manifest entries
//       VERBATIM — proven component-level: a minimal probe project (tmp dir
//       under the repo root, deleted afterwards) whose only page consumes the
//       WP-24 selectors through the real astro build; no P4/P5 pages are
//       created (documented choice, see docs/implementation/WP-24.md);
//   (d) no <script>/fetch of the manifest exists in output HTML — the
//       browser-consumption prohibition is asserted by grepping dist/ for
//       manifest references (zero).
//
// Authority: IMAGE_PIPELINE §10.1 (build-time consumption; browser never sees
// the manifest), §10.4 (selectors; srcset never regex-derived), §13.3 +
// ADR-026 (manifest before astro build), BUILD_AND_ROUTING §1 (DAG), §9
// (mode semantics: production complete + closure-verified; preview may be
// incomplete → warn), docs/implementation/WP-13.md (env-mode gate pattern).
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, test } from "vitest";
// IMP-06 final gate correction: EVERY test-harness caller that mutates the
// canonical shared dist/ must go through the cross-process build mutex —
// a direct `npm run build` under parallel Vitest workers races other
// production builds reading dist/.prerender/chunks (order-dependent 237/238).
import { spawnNpmUnderBuildLock, withBuildLock } from "../../tests/support/artifact.mjs";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const REAL_MANIFEST = join(REPO_ROOT, "generated", "asset-manifest.json");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function withEnvAsync(
  overrides: Record<string, string | undefined>,
  fn: () => void | Promise<void>,
): Promise<void> {
  const saved = { ...process.env };
  try {
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await fn();
  } finally {
    process.env = saved;
  }
}

/** Distinct photo IDs in the real manifest, sorted. */
function manifestPhotoIds(records: Array<{ photo_id: string }>): string[] {
  return [...new Set(records.map((r) => r.photo_id))].sort();
}

function readRealManifest(): {
  records: Array<{
    photo_id: string;
    purpose: string;
    format: string;
    width: number;
    height: number;
    public_url: string;
  }>;
} {
  return JSON.parse(readFileSync(REAL_MANIFEST, "utf8")).manifest;
}

async function loadGate(): Promise<{
  assetManifestGate: () => {
    name: string;
    hooks: Record<string, (ctx?: unknown) => unknown>;
  };
}> {
  const GATE = fileURLToPath(new URL("../../scripts/validate/asset-gate.mjs", import.meta.url));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (await import(GATE)) as any;
}

// ---------------------------------------------------------------------------
// (reader + selectors) — src/lib/assets/manifest.ts
// ---------------------------------------------------------------------------

describe("WP-24 typed manifest reader (build-time)", () => {
  test("loads the real generated manifest through the Zod contract", async () => {
    const mod = await import("../../src/lib/assets/manifest");
    const doc = mod.readAssetManifest();
    expect(doc.manifest.schema).toBe("quiet-editorial-archive/asset-manifest@1");
    expect(doc.manifest.records.length).toBeGreaterThan(0);
    for (const record of doc.manifest.records) {
      expect(record.photo_id).toBeTruthy();
      expect(record.public_url.startsWith("/media/")).toBe(true);
      expect(record.width).toBeGreaterThan(0);
      expect(record.height).toBeGreaterThan(0);
    }
    expect(doc.envelope.generated_at).toBeTruthy();
  });

  test("MISSING manifest → clear producer-before-consumer error, not a crash", async () => {
    const mod = await import("../../src/lib/assets/manifest");
    const missing = join(tmpdir(), `wp24-absent-${process.pid}-${Date.now()}.json`);
    try {
      expect(() => mod.readAssetManifest(missing)).toThrow(
        /producer-before-consumer|11\.1:manifest-missing/,
      );
    } finally {
      if (existsSync(missing)) rmSync(missing);
    }
  });

  test("UNLOADABLE manifest (schema-violating document) → clear boundary error", async () => {
    const mod = await import("../../src/lib/assets/manifest");
    const bad = join(tmpdir(), `wp24-bad-${process.pid}-${Date.now()}.json`);
    writeFileSync(bad, JSON.stringify({ envelope: {}, manifest: { records: "nope" } }));
    try {
      expect(() => mod.readAssetManifest(bad)).toThrow(/24:manifest-unloadable/);
    } finally {
      rmSync(bad);
    }
  });
});

describe("WP-24 selectors (IMAGE_PIPELINE §10.4)", () => {
  test("gallery variants: src/srcset/width/height are manifest entries VERBATIM", async () => {
    const mod = await import("../../src/lib/assets/manifest");
    const { records } = readRealManifest();
    const photoId = manifestPhotoIds(records)[0]!;
    const jpeg = records.filter(
      (r) => r.photo_id === photoId && r.purpose === "gallery_display" && r.format === "jpeg",
    );
    expect(jpeg.length).toBeGreaterThan(0);
    const sorted = [...jpeg].sort((a, b) => a.width - b.width);
    const expectedSrcset = sorted.map((r) => `${r.public_url} ${r.width}w`).join(", ");
    const widest = sorted[sorted.length - 1]!;

    const v = mod.getGalleryVariants(photoId, { sizes: "(min-width: 60em) 60vw, 90vw" });
    expect(v.src).toBe(widest.public_url);
    expect(v.srcset).toBe(expectedSrcset);
    expect(v.width).toBe(widest.width);
    expect(v.height).toBe(widest.height);
    expect(v.sizes).toBe("(min-width: 60em) 60vw, 90vw");
    // Every srcset URL is an entry public_url verbatim — no filename parsing.
    for (const url of v.srcset.split(", ").map((part) => part.split(" ")[0]!)) {
      expect(records.some((r) => r.public_url === url)).toBe(true);
    }
    // Per-format data is explicit (for <picture><source type=…>).
    const avif = records.filter(
      (r) => r.photo_id === photoId && r.purpose === "gallery_display" && r.format === "avif",
    );
    if (avif.length > 0) {
      const avifSrcset = [...avif]
        .sort((a, b) => a.width - b.width)
        .map((r) => `${r.public_url} ${r.width}w`)
        .join(", ");
      expect(v.formats.find((f) => f.format === "avif")?.srcset).toBe(avifSrcset);
    }
  });

  test("overview + cover selectors map the §10.3 purposes", async () => {
    const mod = await import("../../src/lib/assets/manifest");
    const { records } = readRealManifest();
    const photoId = manifestPhotoIds(records)[0]!;
    for (const [purpose, selector] of [
      ["overview", mod.getOverviewVariants],
      ["cover", mod.getCoverVariants],
    ] as const) {
      const jpeg = records.filter(
        (r) => r.photo_id === photoId && r.purpose === purpose && r.format === "jpeg",
      );
      expect(jpeg.length).toBeGreaterThan(0);
      const widest = [...jpeg].sort((a, b) => a.width - b.width).at(-1)!;
      const v = selector(photoId);
      expect(v.purpose).toBe(purpose);
      expect(v.src).toBe(widest.public_url);
      expect(v.width).toBe(widest.width);
      expect(v.height).toBe(widest.height);
    }
  });

  test("unknown photo or missing purpose → clear build-time error (fail closed)", async () => {
    const mod = await import("../../src/lib/assets/manifest");
    expect(() => mod.getGalleryVariants("p_does_not_exist")).toThrow(/24:variant-missing/);
  });
});

// ---------------------------------------------------------------------------
// (guard) — producer-before-consumer enforcement at astro:build:start
// ---------------------------------------------------------------------------

// IMP-03 timeout policy (ROUND-2): each gate test below awaits the real
// `astro:build:start` hook, which runs scripts/validate/manifest-gate.ts via
// asset-gate.mjs as a CANCELLABLE async child (plus a Zod load of the
// 1008-record manifest and — for the closure case — the full WP-23 coverage
// walk). A Vitest-local timeout alone cannot bound a blocking child, so the
// CHILD timeout (GATE_CHILD_TIMEOUT_MS = 20s) is the enforceable bound and
// the 30s LOCAL test timeout always exceeds it with margin for worker
// reporting. Basis: isolated gate cost 0.2–0.5s, normal e2e about 1.4s, one
// historical full-suite contention spike past 5s — 20s is 40x isolated cost,
// not a global change. A genuinely hung gate child is SIGKILLed at 20s and
// fails loudly; no shared state or frozen gate path was altered.
describe("WP-24 producer-before-consumer gate (astro:build:start)", () => {
  test(
    "production mode + missing manifest → hook throws the clear error",
    async () => {
      const { assetManifestGate } = await loadGate();
      const integration = assetManifestGate();
      const tempRoot = makeMissingTempRoot();
      integration.hooks["astro:config:done"]({ config: { root: pathToFileURL(tempRoot) } });
      try {
        await withEnvAsync(
          {
            ASTRO_VALIDATE_ASSET_MANIFEST: undefined,
            ASTRO_PREVIEW_MODE: undefined,
            ASTRO_VALIDATE_CONTENT_ROOT: undefined,
          },
          async () => {
            await expect(integration.hooks["astro:build:start"]()).rejects.toThrow(
              /producer-before-consumer|11\.1:manifest-missing/,
            );
          },
        );
      } finally {
        rmSync(tempRoot, { recursive: true, force: true });
      }
    },
    30_000,
  );

  test(
    "production mode + incomplete manifest (a purpose deleted) → closure failure 13.1#18",
    async () => {
      const { assetManifestGate } = await loadGate();
      const integration = assetManifestGate();
      const tempRoot = makeStaleTempRoot();
      integration.hooks["astro:config:done"]({ config: { root: pathToFileURL(tempRoot) } });
      try {
        await withEnvAsync(
          {
            ASTRO_VALIDATE_ASSET_MANIFEST: undefined,
            ASTRO_PREVIEW_MODE: undefined,
            ASTRO_VALIDATE_CONTENT_ROOT: undefined,
          },
          async () => {
            await expect(integration.hooks["astro:build:start"]()).rejects.toThrow(/13\.1#18/);
          },
        );
      } finally {
        rmSync(tempRoot, { recursive: true, force: true });
      }
    },
    30_000,
  );

  test(
    "preview mode + missing manifest → warns, never fatal (BUILD_AND_ROUTING §9)",
    async () => {
      // Failure diagnostic for the historically load-sensitive case: elapsed
      // time distinguishes contention (slow spawn) from a real gate hang.
      const started = Date.now();
      try {
        const { assetManifestGate } = await loadGate();
        const integration = assetManifestGate();
        integration.hooks["astro:config:done"]({ config: { root: pathToFileURL(REPO_ROOT) } });
        await withEnvAsync({ ASTRO_PREVIEW_MODE: "1", ASTRO_PRODUCTION_VALIDATE: undefined }, async () => {
          await expect(integration.hooks["astro:build:start"]()).resolves.toBeUndefined();
        });
      } catch (error) {
        throw new Error(
          `preview gate failed after ${Date.now() - started}ms ` +
            `(isolated basis 0.2–0.5s; >5s implies full-suite CPU contention, ` +
            `not gate logic): ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
    30_000,
  );

  test(
    "ambiguous mode configuration → configuration error (WP-13 §6 pattern)",
    async () => {
      const { assetManifestGate } = await loadGate();
      const integration = assetManifestGate();
      integration.hooks["astro:config:done"]({ config: { root: pathToFileURL(REPO_ROOT) } });
      await withEnvAsync({ ASTRO_PRODUCTION_VALIDATE: "1", ASTRO_PREVIEW_MODE: "1" }, async () => {
        await expect(integration.hooks["astro:build:start"]()).rejects.toThrow(/ambiguous mode/);
      });
    },
    30_000,
  );
});

// ---------------------------------------------------------------------------
// (a)+(b) real astro build, production mode
// ---------------------------------------------------------------------------

// Isolated fixture projects: the temporary root IS the canonical project root
// for that test instance. Production env vars are not used as an authority fork.
function makeMissingTempRoot(): string {
  const root = join(REPO_ROOT, `.wp24-isolated-${process.pid}-${Date.now()}`);
  mkdirSync(join(root, "generated"), { recursive: true });
  symlinkSync(join(REPO_ROOT, "content"), join(root, "content"));
  symlinkSync(join(REPO_ROOT, "media"), join(root, "media"));
  symlinkSync(join(REPO_ROOT, "generated", "media"), join(root, "generated", "media"));
  return root;
}

function makeStaleTempRoot(): string {
  const root = makeMissingTempRoot();
  const doc = JSON.parse(readFileSync(REAL_MANIFEST, "utf8"));
  doc.manifest.records = doc.manifest.records.filter(
    (r: { purpose: string }) => r.purpose !== "cover",
  );
  writeFileSync(join(root, "generated", "asset-manifest.json"), JSON.stringify(doc));
  return root;
}

function runIsolatedProductionBuild(projectRoot: string): {
  status: number | null;
  output: string;
} {
  writeFileSync(
    join(projectRoot, "package.json"),
    JSON.stringify({ name: "wp24-isolated-fixture", type: "module", private: true }, null, 2) + "\n",
  );
  const astroGate = join(REPO_ROOT, "scripts/validate/astro-gate.mjs");
  const assetGate = join(REPO_ROOT, "scripts/validate/asset-gate.mjs");
  writeFileSync(
    join(projectRoot, "astro.config.mjs"),
    [
      'import { defineConfig } from "astro/config";',
      `import { contentValidationGate } from ${JSON.stringify(astroGate)};`,
      `import { assetManifestGate } from ${JSON.stringify(assetGate)};`,
      "export default defineConfig({ integrations: [contentValidationGate(), assetManifestGate()] });",
      "",
    ].join("\n"),
  );
  mkdirSync(join(projectRoot, "src", "pages"), { recursive: true });
  writeFileSync(
    join(projectRoot, "src", "pages", "index.astro"),
    ["---", "---", "<html><body>isolated fixture</body></html>", ""].join("\n"),
  );
  const env: NodeJS.ProcessEnv = { ...process.env, ASTRO_PRODUCTION_VALIDATE: "1" };
  delete env.ASTRO_PREVIEW_MODE;
  delete env.ASTRO_ASSET_MANIFEST;
  delete env.ASTRO_VALIDATE_ASSET_MANIFEST;
  delete env.ASTRO_VALIDATE_CONTENT_ROOT;
  const result = spawnSync(
    join(REPO_ROOT, "node_modules", ".bin", "astro"),
    ["build", "--root", projectRoot],
    { cwd: REPO_ROOT, encoding: "utf8", env, timeout: 240_000 },
  );
  return { status: result.status, output: `${result.stdout ?? ""}\n${result.stderr ?? ""}` };
}

function runProductionBuild(extraEnv: Record<string, string | undefined>): {
  status: number | null;
  output: string;
} {
  // Canonical shared-dist mutation → MUST hold the cross-process build lock
  // (IMP-06): the same ownership contract as runBuild()/capture/E2E builds.
  const result = spawnNpmUnderBuildLock(["run", "build"], {
    encoding: "utf8",
    env: { ...process.env, ...extraEnv },
    timeout: 240_000,
  });
  return { status: result.status, output: `${result.stdout ?? ""}\n${result.stderr ?? ""}` };
}

describe("WP-24 end-to-end astro build (production mode)", () => {
  test(
    "(a) astro build with a MISSING manifest fails with the producer-before-consumer error",
    () => {
      const tempRoot = makeMissingTempRoot();
      try {
        const run = runIsolatedProductionBuild(tempRoot);
        expect(run.status).not.toBe(0);
        expect(run.output).toMatch(/producer-before-consumer/);
        expect(run.output).toMatch(/11\.1:manifest-missing/);
      } finally {
        rmSync(tempRoot, { recursive: true, force: true });
      }
    },
    300_000,
  );

  test(
    "(b) astro build with a STALE manifest (a purpose deleted) fails closure with 13.1#18",
    () => {
      const tempRoot = makeStaleTempRoot();
      try {
        const run = runIsolatedProductionBuild(tempRoot);
        expect(run.status).not.toBe(0);
        expect(run.output).toMatch(/13\.1#18/);
      } finally {
        rmSync(tempRoot, { recursive: true, force: true });
      }
    },
    300_000,
  );

  test(
    "(c) built page's src/srcset attributes equal manifest entries verbatim (probe build)",
    () => {
      withBuildLock(() => {
      const { records } = readRealManifest();
      const photoId = manifestPhotoIds(records)[0]!;
      const jpeg = records.filter(
        (r) => r.photo_id === photoId && r.purpose === "gallery_display" && r.format === "jpeg",
      );
      const sorted = [...jpeg].sort((a, b) => a.width - b.width);
      const expectedSrc = sorted[sorted.length - 1]!.public_url;
      const expectedSrcset = sorted.map((r) => `${r.public_url} ${r.width}w`).join(", ");
      const widest = sorted[sorted.length - 1]!;

      const probeRoot = join(REPO_ROOT, `.wp24-probe-${process.pid}`);
      const pagesDir = join(probeRoot, "src", "pages");
      mkdirSync(pagesDir, { recursive: true });
      writeFileSync(
        join(probeRoot, "package.json"),
        JSON.stringify({ name: "wp24-probe", type: "module", private: true }, null, 2) + "\n",
      );
      writeFileSync(
        join(probeRoot, "astro.config.mjs"),
        'import { defineConfig } from "astro/config";\nexport default defineConfig({});\n',
      );
      writeFileSync(
        join(pagesDir, "probe.astro"),
        [
          "---",
          `import { getGalleryVariants } from "../../../src/lib/assets/manifest.ts";`,
          `const v = getGalleryVariants(${JSON.stringify(photoId)}, { sizes: "(min-width: 60em) 60vw, 90vw" });`,
          "---",
          `<img src={v.src} srcset={v.srcset} sizes={v.sizes} width={v.width} height={v.height} alt="probe" />`,
          "",
        ].join("\n"),
      );
      try {
        const result = spawnSync(
          join(REPO_ROOT, "node_modules", ".bin", "astro"),
          ["build", "--root", probeRoot],
          { cwd: REPO_ROOT, encoding: "utf8", timeout: 240_000 },
        );
        const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
        expect(result.status, output).toBe(0);
        const htmlPath = join(probeRoot, "dist", "probe", "index.html");
        expect(existsSync(htmlPath)).toBe(true);
        const html = readFileSync(htmlPath, "utf8");
        expect(html).toContain(`src="${expectedSrc}"`);
        expect(html).toContain(`srcset="${expectedSrcset}"`);
        expect(html).toContain(`sizes="(min-width: 60em) 60vw, 90vw"`);
        expect(html).toContain(`width="${widest.width}"`);
        expect(html).toContain(`height="${widest.height}"`);
        // The browser-consumption prohibition holds on the probe output too.
        expect(html).not.toMatch(/asset-manifest/);
      } finally {
        rmSync(probeRoot, { recursive: true, force: true });
      }
      });
    },
    300_000,
  );

  test(
    "(d) astro build succeeds with the manifest present; dist/ HTML has ZERO manifest references",
    () => {
      const run = runProductionBuild({});
      expect(run.status, run.output.slice(-4000)).toBe(0);
      // Grep every built HTML file for any manifest reference (fetch, script,
      // import, or even a comment) — the manifest must never reach the browser.
      const distDir = join(REPO_ROOT, "dist");
      expect(existsSync(distDir)).toBe(true);
      const offenders: string[] = [];
      const walk = (dir: string): void => {
        for (const entry of readdirSync(dir)) {
          const full = join(dir, entry);
          if (statSync(full).isDirectory()) walk(full);
          else if (entry.endsWith(".html") && readFileSync(full, "utf8").includes("asset-manifest")) {
            offenders.push(full);
          }
        }
      };
      walk(distDir);
      expect(offenders).toEqual([]);
    },
    300_000,
  );
});
