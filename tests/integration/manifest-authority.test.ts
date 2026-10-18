// ROUND-2 — single production asset-manifest authority (IMP-04) plus the
// enforceable gate-child timeout (IMP-03).
//
// Authority invariant: for a production build, THE MANIFEST THAT IS VALIDATED
// MUST BE THE MANIFEST THAT ASTRO CONSUMES. ASTRO_ASSET_MANIFEST and
// ASTRO_VALIDATE_ASSET_MANIFEST are both preview-only: production/ambiguous
// builds fail closed on EVERY side (both gate hooks and the consumer), while
// preview builds allow explicit mode-scoped overrides. These tests assert
// consumer RESOLUTION (the actual document
// selected and its record identity), not merely environment parsing.
//
// Timeout invariant: the declared bound actually TERMINATES the child
// (SIGKILL with diagnostics and no orphan) instead of racing a blocked worker.
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdirSync, readdirSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, test } from "vitest";
import { spawnNpmUnderBuildLock } from "../../tests/support/artifact.mjs";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const REAL_MANIFEST = join(REPO_ROOT, "generated", "asset-manifest.json");
const AUTHORITY_MARK = "/authority-probe-marker/probe.jpg";

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

/** A schema-valid alternate manifest whose URLs are unmistakably marked. */
function writeMarkedManifest(): string {
  const doc = JSON.parse(readFileSync(REAL_MANIFEST, "utf8"));
  for (const record of doc.manifest.records) record.public_url = AUTHORITY_MARK;
  const path = join(tmpdir(), `authority-marked-${process.pid}-${Date.now()}.json`);
  writeFileSync(path, JSON.stringify(doc));
  return path;
}

describe("single production manifest authority (validator == consumer)", () => {
  test("production + ASTRO_ASSET_MANIFEST → gate hook fails closed", async () => {
    const { assetManifestGate } = await import("../../scripts/validate/asset-gate.mjs");
    const integration = assetManifestGate();
    integration.hooks["astro:config:done"]({ config: { root: pathToFileURL(REPO_ROOT) } });
    await withEnvAsync(
      {
        ASTRO_PRODUCTION_VALIDATE: "1",
        ASTRO_PREVIEW_MODE: undefined,
        ASTRO_ASSET_MANIFEST: join(tmpdir(), `authority-override-${process.pid}.json`),
      },
      async () => {
        await expect(integration.hooks["astro:build:start"]()).rejects.toThrow(/preview-only|canonical/i);
      },
    );
  }, 30_000);

  test("production + ASTRO_ASSET_MANIFEST → consumer resolution fails closed", async () => {
    const mod = await import("../../src/lib/assets/manifest");
    await withEnvAsync(
      {
        ASTRO_PRODUCTION_VALIDATE: "1",
        ASTRO_PREVIEW_MODE: undefined,
        ASTRO_ASSET_MANIFEST: join(tmpdir(), `authority-override-${process.pid}.json`),
      },
      async () => {
        expect(() => mod.getManifest()).toThrow(/24:manifest-authority/);
      },
    );
  }, 30_000);

  test("ambiguous mode + ASTRO_ASSET_MANIFEST → consumer fails closed too", async () => {
    const mod = await import("../../src/lib/assets/manifest");
    await withEnvAsync(
      {
        ASTRO_PRODUCTION_VALIDATE: "1",
        ASTRO_PREVIEW_MODE: "1",
        ASTRO_ASSET_MANIFEST: join(tmpdir(), `authority-override-${process.pid}.json`),
      },
      async () => {
        expect(() => mod.getManifest()).toThrow(/24:manifest-authority/);
      },
    );
  }, 30_000);

  test("production + ASTRO_VALIDATE_CONTENT_ROOT fork -> gate hook fails closed", async () => {
    const { assetManifestGate } = await import("../../scripts/validate/asset-gate.mjs");
    const { resolveAssetAuthority } = await import("../../src/lib/assets/manifest-authority.mjs");
    const integration = assetManifestGate();
    integration.hooks["astro:config:done"]({ config: { root: pathToFileURL(REPO_ROOT) } });
    const altRoot = join(tmpdir(), `authority-root-fork-${process.pid}-${Date.now()}`);
    await withEnvAsync(
      {
        ASTRO_PRODUCTION_VALIDATE: "1",
        ASTRO_PREVIEW_MODE: undefined,
        ASTRO_ASSET_MANIFEST: undefined,
        ASTRO_VALIDATE_ASSET_MANIFEST: undefined,
        ASTRO_VALIDATE_CONTENT_ROOT: altRoot,
      },
      async () => {
        expect(() => resolveAssetAuthority({ env: process.env, configRoot: REPO_ROOT })).toThrow(
          /24:manifest-authority|content-root|canonical project root/,
        );
        await expect(integration.hooks["astro:build:start"]()).rejects.toThrow(
          /24:manifest-authority|content-root|canonical project root/,
        );
      },
    );
  }, 30_000);

  test("clean production build resolves the canonical 4320-record manifest", async () => {
    const mod = await import("../../src/lib/assets/manifest");
    await withEnvAsync(
      {
        ASTRO_PRODUCTION_VALIDATE: "1",
        ASTRO_PREVIEW_MODE: undefined,
        ASTRO_ASSET_MANIFEST: undefined,
      },
      async () => {
        expect(mod.isPreviewMode()).toBe(false);
        expect(mod.resolveManifestPath()).toBe(REAL_MANIFEST);
        expect(mod.getManifest().manifest.records.length).toBe(4320);
      },
    );
  }, 30_000);

  test("preview + ASTRO_ASSET_MANIFEST → gate and consumer agree on the override", async () => {
    const marked = writeMarkedManifest();
    try {
      const { assetManifestGate } = await import("../../scripts/validate/asset-gate.mjs");
      const integration = assetManifestGate();
      integration.hooks["astro:config:done"]({ config: { root: pathToFileURL(REPO_ROOT) } });
      await withEnvAsync(
        {
          ASTRO_PREVIEW_MODE: "1",
          ASTRO_PRODUCTION_VALIDATE: undefined,
          ASTRO_ASSET_MANIFEST: marked,
        },
        async () => {
          // The gate does not fail closed in preview (real child runs) ...
          await expect(integration.hooks["astro:build:start"]()).resolves.toBeUndefined();
          // ... and the consumer resolves the SAME override document.
          const mod = await import("../../src/lib/assets/manifest");
          expect(mod.isPreviewMode()).toBe(true);
          const doc = mod.getManifest();
          expect(doc.manifest.records.length).toBe(4320);
          expect(doc.manifest.records[0]!.public_url).toBe(AUTHORITY_MARK);
        },
      );
    } finally {
      rmSync(marked, { force: true });
    }
  }, 60_000);
});

describe("enforceable gate-child timeout (async kill, not a declarative bound)", () => {
  test("a hung child is SIGKILLed near the bound with diagnostics and no orphan", async () => {
    const { runWithTimeout } = await import("../../scripts/validate/asset-gate.mjs");
    const started = Date.now();
    const run = await runWithTimeout(
      process.execPath,
      ["-e", "process.stdout.write(String(424242)); setTimeout(() => {}, 30000);"],
      { timeoutMs: 1_000 },
    );
    const wall = Date.now() - started;
    expect(run.timedOut).toBe(true);
    expect(run.signal).toBe("SIGKILL");
    expect(run.stdout).toContain("424242");
    expect(wall).toBeLessThan(8_000);
    expect(typeof run.pid).toBe("number");
    // No orphan: the reaped pid no longer exists.
    expect(() => process.kill(run.pid as number, 0)).toThrow(/ESRCH/);
  }, 30_000);

  test("a fast child resolves normally (no false timeout)", async () => {
    const { runWithTimeout } = await import("../../scripts/validate/asset-gate.mjs");
    const run = await runWithTimeout(process.execPath, ["-e", "console.log(123456);"], {
      timeoutMs: 10_000,
    });
    expect(run.timedOut).toBe(false);
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("123456");
  }, 30_000);
});

describe("production validator-side authority (ASTRO_VALIDATE_ASSET_MANIFEST)", () => {
  test("production + ASTRO_VALIDATE_ASSET_MANIFEST -> gate hook fails closed", async () => {
    const { assetManifestGate } = await import("../../scripts/validate/asset-gate.mjs");
    const integration = assetManifestGate();
    integration.hooks["astro:config:done"]({ config: { root: pathToFileURL(REPO_ROOT) } });
    await withEnvAsync(
      {
        ASTRO_PRODUCTION_VALIDATE: "1",
        ASTRO_PREVIEW_MODE: undefined,
        ASTRO_VALIDATE_ASSET_MANIFEST: join(tmpdir(), `authority-validate-${process.pid}.json`),
      },
      async () => {
        await expect(integration.hooks["astro:build:start"]()).rejects.toThrow(
          /preview-only|canonical|manifest-authority/i,
        );
      },
    );
  }, 30_000);

  test("production + ASTRO_VALIDATE_ASSET_MANIFEST -> consumer fails closed", async () => {
    const mod = await import("../../src/lib/assets/manifest");
    await withEnvAsync(
      {
        ASTRO_PRODUCTION_VALIDATE: "1",
        ASTRO_PREVIEW_MODE: undefined,
        ASTRO_VALIDATE_ASSET_MANIFEST: join(tmpdir(), `authority-validate-${process.pid}.json`),
      },
      async () => {
        expect(() => mod.getManifest()).toThrow(/24:manifest-authority/);
      },
    );
  }, 30_000);

  test("production + both overrides -> gate and consumer fail closed", async () => {
    const marked = writeMarkedManifest();
    try {
      const { assetManifestGate } = await import("../../scripts/validate/asset-gate.mjs");
      const integration = assetManifestGate();
      integration.hooks["astro:config:done"]({ config: { root: pathToFileURL(REPO_ROOT) } });
      await withEnvAsync(
        {
          ASTRO_PRODUCTION_VALIDATE: "1",
          ASTRO_PREVIEW_MODE: undefined,
          ASTRO_ASSET_MANIFEST: marked,
          ASTRO_VALIDATE_ASSET_MANIFEST: marked,
        },
        async () => {
          await expect(integration.hooks["astro:build:start"]()).rejects.toThrow(
            /preview-only|canonical|manifest-authority/i,
          );
          const mod = await import("../../src/lib/assets/manifest");
          expect(() => mod.getManifest()).toThrow(/24:manifest-authority/);
        },
      );
    } finally {
      rmSync(marked, { force: true });
    }
  }, 30_000);

  test("ambiguous mode + ASTRO_VALIDATE_ASSET_MANIFEST -> consumer fails closed", async () => {
    const mod = await import("../../src/lib/assets/manifest");
    await withEnvAsync(
      {
        ASTRO_PRODUCTION_VALIDATE: "1",
        ASTRO_PREVIEW_MODE: "1",
        ASTRO_VALIDATE_ASSET_MANIFEST: join(tmpdir(), `authority-validate-${process.pid}.json`),
      },
      async () => {
        expect(() => mod.getManifest()).toThrow(/24:manifest-authority/);
      },
    );
  }, 30_000);

  test("preview + ASTRO_VALIDATE_ASSET_MANIFEST -> no authority failure (mode-scoped)", async () => {
    const { assetManifestGate } = await import("../../scripts/validate/asset-gate.mjs");
    const integration = assetManifestGate();
    integration.hooks["astro:config:done"]({ config: { root: pathToFileURL(REPO_ROOT) } });
    const cleanCopy = join(tmpdir(), `authority-preview-clean-${process.pid}-${Date.now()}.json`);
    writeFileSync(cleanCopy, readFileSync(REAL_MANIFEST, "utf8"));
    try {
      await withEnvAsync(
        {
          ASTRO_PREVIEW_MODE: "1",
          ASTRO_PRODUCTION_VALIDATE: undefined,
          ASTRO_ASSET_MANIFEST: undefined,
          ASTRO_VALIDATE_ASSET_MANIFEST: cleanCopy,
        },
        async () => {
          await expect(integration.hooks["astro:build:start"]()).resolves.toBeUndefined();
          const mod = await import("../../src/lib/assets/manifest");
          expect(mod.isPreviewMode()).toBe(true);
          expect(mod.getManifest().manifest.records.length).toBe(4320);
        },
      );
    } finally {
      rmSync(cleanCopy, { force: true });
    }
  }, 60_000);
});

// Real production-build authority regression: the validated manifest must
// never differ from the consumed manifest. Every case inspects the actual
// build exit status AND built HTML output, never resolver values alone.
describe("production-build manifest authority regression (real builds + HTML)", () => {
  const BUILD_MARK = "/authority-build-regression/marker.jpg";

  function writeBuildMarkedManifest(): string {
    const doc = JSON.parse(readFileSync(REAL_MANIFEST, "utf8"));
    for (const record of doc.manifest.records) record.public_url = BUILD_MARK;
    const path = join(tmpdir(), `authority-build-marked-${process.pid}-${Date.now()}.json`);
    writeFileSync(path, JSON.stringify(doc));
    return path;
  }

  function writeBuildCleanCopy(): string {
    const path = join(tmpdir(), `authority-build-clean-${process.pid}-${Date.now()}.json`);
    writeFileSync(path, readFileSync(REAL_MANIFEST, "utf8"));
    return path;
  }

  function runAuthorityBuild(extraEnv: Record<string, string>): {
    status: number | null;
    output: string;
  } {
    const env: Record<string, string | undefined> = { ...process.env };
    delete env.ASTRO_ASSET_MANIFEST;
    delete env.ASTRO_VALIDATE_ASSET_MANIFEST;
    delete env.ASTRO_VALIDATE_CONTENT_ROOT;
    Object.assign(env, extraEnv);
    const result = spawnNpmUnderBuildLock(["run", "build"], {
      encoding: "utf8",
      env,
      timeout: 240_000,
    });
    return { status: result.status, output: `${result.stdout ?? ""}\n${result.stderr ?? ""}` };
  }

  function markerHtmlFiles(): string[] {
    const hits: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (entry.endsWith(".html") && readFileSync(full, "utf8").includes(BUILD_MARK))
          hits.push(full);
      }
    };
    walk(join(REPO_ROOT, "dist"));
    return hits;
  }

  function allBuiltHtml(): string {
    const parts: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (entry.endsWith(".html")) parts.push(readFileSync(full, "utf8"));
      }
    };
    walk(join(REPO_ROOT, "dist"));
    return parts.join("\n");
  }

  function canonicalSampleUrl(): string {
    const doc = JSON.parse(readFileSync(REAL_MANIFEST, "utf8"));
    const rec = doc.manifest.records.find(
      (r: { purpose: string; format: string }) =>
        r.purpose === "gallery_display" && r.format === "jpeg",
    );
    return rec.public_url as string;
  }

  test("normal canonical build passes with canonical URLs and zero markers", () => {
    const run = runAuthorityBuild({});
    expect(run.status, run.output.slice(-3000)).toBe(0);
    expect(markerHtmlFiles()).toEqual([]);
    expect(allBuiltHtml()).toContain(canonicalSampleUrl());
  }, 300_000);

  test("consumer-side override attack fails closed with zero markers", () => {
    const marked = writeBuildMarkedManifest();
    try {
      const run = runAuthorityBuild({ ASTRO_ASSET_MANIFEST: marked });
      expect(run.status).not.toBe(0);
      expect(run.output).toMatch(/24:manifest-authority|preview-only|canonical/);
      expect(markerHtmlFiles()).toEqual([]);
    } finally {
      rmSync(marked, { force: true });
    }
  }, 300_000);

  test("validator-side override attack fails closed with zero markers", () => {
    const clean = writeBuildCleanCopy();
    try {
      const run = runAuthorityBuild({ ASTRO_VALIDATE_ASSET_MANIFEST: clean });
      expect(run.status).not.toBe(0);
      expect(run.output).toMatch(/24:manifest-authority|preview-only|canonical/);
      expect(markerHtmlFiles()).toEqual([]);
    } finally {
      rmSync(clean, { force: true });
    }
  }, 300_000);

  test("both overrides set fails closed with zero markers", () => {
    const marked = writeBuildMarkedManifest();
    const clean = writeBuildCleanCopy();
    try {
      const run = runAuthorityBuild({
        ASTRO_ASSET_MANIFEST: marked,
        ASTRO_VALIDATE_ASSET_MANIFEST: clean,
      });
      expect(run.status).not.toBe(0);
      expect(run.output).toMatch(/24:manifest-authority|preview-only|canonical/);
      expect(markerHtmlFiles()).toEqual([]);
    } finally {
      rmSync(marked, { force: true });
      rmSync(clean, { force: true });
    }
  }, 300_000);


  test("content-root + manifest override combination attack fails closed with zero markers", () => {
    const marked = writeBuildMarkedManifest();
    const altRoot = join(tmpdir(), `authority-combo-root-${process.pid}-${Date.now()}`);
    try {
      mkdirSync(join(altRoot, "generated"), { recursive: true });
      const run = runAuthorityBuild({
        ASTRO_VALIDATE_CONTENT_ROOT: altRoot,
        ASTRO_ASSET_MANIFEST: marked,
      });
      expect(run.status).not.toBe(0);
      expect(run.output).toMatch(/24:manifest-authority|preview-only|canonical/);
      expect(markerHtmlFiles()).toEqual([]);
    } finally {
      rmSync(marked, { force: true });
      rmSync(altRoot, { recursive: true, force: true });
    }
  }, 300_000);

  test("validator content-root fork attack fails closed with zero markers", () => {
    const ROOT_MARK = "/CONTENT_ROOT_FORK_MARKER/";
    // WP-24 regression: canonical Manifest is read-only — adversarial state
    // lives only in the isolated altRoot, so parallel readers never observe
    // the temporary marker.
    const canonicalDoc = JSON.parse(readFileSync(REAL_MANIFEST, "utf8"));
    const altRoot = join(tmpdir(), `authority-content-root-${process.pid}-${Date.now()}`);
    try {
      mkdirSync(join(altRoot, "generated"), { recursive: true });
      symlinkSync(join(REPO_ROOT, "content"), join(altRoot, "content"));
      symlinkSync(join(REPO_ROOT, "media"), join(altRoot, "media"));
      symlinkSync(join(REPO_ROOT, "generated", "media"), join(altRoot, "generated", "media"));
      for (const record of canonicalDoc.manifest.records) {
        record.public_url = `${ROOT_MARK}${String(record.public_url).replace(/^\//, "")}`;
      }
      writeFileSync(join(altRoot, "generated", "asset-manifest.json"), JSON.stringify(canonicalDoc));
      const run = runAuthorityBuild({ ASTRO_VALIDATE_CONTENT_ROOT: altRoot });
      expect(run.status, run.output.slice(-3000)).not.toBe(0);
      expect(run.output).toMatch(/24:manifest-authority|content-root|canonical project root/i);
      const leftover: string[] = [];
      const walk = (dir: string): void => {
        for (const entry of readdirSync(dir)) {
          const full = join(dir, entry);
          if (statSync(full).isDirectory()) walk(full);
          else if (entry.endsWith(".html") && readFileSync(full, "utf8").includes("CONTENT_ROOT_FORK_MARKER"))
            leftover.push(full);
        }
      };
      walk(join(REPO_ROOT, "dist"));
      expect(leftover).toEqual([]);
    } finally {
      rmSync(altRoot, { recursive: true, force: true });
    }
  }, 300_000);
});
