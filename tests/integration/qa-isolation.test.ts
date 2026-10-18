// P4/P5 FINAL TARGETED CORRECTION — IMP-06 integration evidence.
//
// Previous defect: `QA_PROBE=1 npm run build` executed a CANONICAL production
// validation build (exit 0) while retaining /qa-probe in the shared dist/.
// The Playwright harness used that mode, so an E2E run left an unauthorized
// route inside the artifact later consumed by integration assertions — an
// execution-order-dependent contamination (the recorded 224/1 integration
// failure was stale dist/qa-probe/index.html).
//
// Corrected contract (TEST-ONLY QA HARNESS, not production-with-a-flag):
//   1. Canonical production build FAILS CLOSED against QA-mode env leakage:
//      QA_PROBE=1 npm run build refuses explicitly (nonzero exit) and never
//      writes dist/.
//   2. The QA canary build is a separate test-only invocation
//      (`npm run build:qa`) writing a separate test-only output directory
//      (dist-qa/). The canonical production dist/ is never written by it.
//   3. The assembled QA serving artifact is isolated (.serve-artifacts/qa/)
//      and mounts /media from generated/ — no test run mutates dist/.
//
// RED-first (against 4c4e15a + IMP-01 harness): (1) exits 0 and leaves
// /qa-probe in dist (the defect), (2) build:qa does not exist, (3) dist-qa
// does not exist.
import { existsSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { acquireBuildLock, releaseBuildLock, spawnNpmUnderBuildLock } from "../../tests/support/artifact.mjs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const REPO_ROOT = new URL("../../", import.meta.url).pathname;

// Canonical-build mutex: concurrent npm run build invocations from parallel
// test files corrupt the shared dist/ (single-owner rule). Serialize.
// `lockHeld` skips the inner acquire for tests that already hold the lock
// across a measurement window (the mutex is NOT reentrant — acquiring it
// twice in one process self-deadlocks).
function npm(args: string[], env: Record<string, string> = {}, lockHeld = false) {
  if (lockHeld) {
    return spawnSync("npm", args, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      env: { ...process.env, ...env },
    });
  }
  return spawnNpmUnderBuildLock(args, {
    encoding: "utf8",
    stdio: "pipe", // capture stdout/stderr for assertion evidence
    env: { ...process.env, ...env },
  });
}

describe("IMP-06 QA probe / production fail-closed", () => {
  test("QA_PROBE=1 canonical production build refuses explicitly (exit nonzero, dist untouched)", () => {
    // Remediate any stale contamination left by a pre-correction build (the
    // defect itself left dist/qa-probe behind): the assertions below must
    // measure what THIS invocation does, not inherited state.
    // Hold the build lock across the before/after measurement: parallel test
    // files legitimately run canonical builds under the same mutex, and a
    // build landing inside the measurement window would invalidate the
    // "dist untouched" observation (the lock, not worker luck, is the
    // ownership contract — IMP-06).
    acquireBuildLock();
    try {
      rmSync(join(REPO_ROOT, "dist", "qa-probe"), { recursive: true, force: true });
      const before = existsSync(join(REPO_ROOT, "dist", "index.html"));
      const r = npm(["run", "build"], { QA_PROBE: "1" }, true);
      expect(
        r.status,
        `canonical production build must refuse QA-mode env leakage (stderr: ${r.stderr?.slice(-500)})`,
      ).not.toBe(0);
      expect(r.stderr ?? "").toMatch(/QA_PROBE/i);
      // The refusal must happen before any build output is produced: dist/
      // state is unchanged.
      expect(existsSync(join(REPO_ROOT, "dist", "index.html"))).toBe(before);
      expect(existsSync(join(REPO_ROOT, "dist", "qa-probe"))).toBe(false);
    } finally {
      releaseBuildLock();
    }
  }, 240_000);

  test("npm run build (canonical) does not emit /qa-probe", () => {
    const r = npm(["run", "build"]);
    expect(r.status, `production build must succeed (stderr: ${r.stderr?.slice(-500)})`).toBe(0);
    expect(existsSync(join(REPO_ROOT, "dist", "qa-probe"))).toBe(false);
  }, 240_000);
});

describe("IMP-06 test-only QA harness", () => {
  test("npm run build:qa emits the canary into the SEPARATE test-only output directory", () => {
    const r = npm(["run", "build:qa"]);
    expect(r.status, `qa harness build must succeed (stderr: ${r.stderr?.slice(-500)})`).toBe(0);
    expect(existsSync(join(REPO_ROOT, "dist-qa", "qa-probe", "index.html"))).toBe(true);
    // The QA build must never write (or leave a canary in) the canonical
    // production artifact.
    expect(existsSync(join(REPO_ROOT, "dist", "qa-probe"))).toBe(false);
  }, 240_000);

  test("assembled QA serving artifact is isolated; production dist stays clean", async () => {
    const { runBuild, assembleArtifact } = await import("../../tests/support/artifact.mjs");
    const source = runBuild("qa");
    expect(source).toMatch(/dist-qa$/);
    const artifact = assembleArtifact(source, "qa");
    expect(artifact).not.toMatch(new RegExp(`${join(REPO_ROOT, "dist")}$`));
    expect(existsSync(join(artifact, "qa-probe", "index.html"))).toBe(true);
    expect(existsSync(join(artifact, "media"))).toBe(true);
    // Production artifact remains production: no canary, regardless of QA
    // harness activity above.
    expect(existsSync(join(REPO_ROOT, "dist", "qa-probe"))).toBe(false);
  }, 240_000);
});
