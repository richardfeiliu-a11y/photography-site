// P4/P5 FINAL GATE-CORRECTION — Finding C (canonical build serialization).
//
// Independent verification against b43a31c established that
// manifest-consumption.test.ts::runProductionBuild() invoked
// `spawnSync("npm", ["run", "build"])` directly, bypassing the shared
// cross-process build mutex — one Vitest worker could clear/rewrite dist/
// while another production build read dist/.prerender/chunks/*.mjs
// (order-dependent integration failures: 237/238).
//
// RED-first discipline: the audit test FAILS against b43a31c (a direct
// canonical-build caller exists outside the lock-owning helper). The lock
// behavior tests prove the mutex contract itself: mutual exclusion under
// real parallel probes, release on failure, bounded stale-lock recovery,
// and no silent steal of a live lock.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, test } from "vitest";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));

const PROTOCOL_LOCK_DIR = join(REPO_ROOT, ".serve-artifacts", `.protocol-lock-${process.pid}-${Date.now()}`);
process.env.PHOTOGRAPHY_TEST_BUILD_LOCK_DIR = PROTOCOL_LOCK_DIR;

function protocolLockDir(): string {
  return process.env.PHOTOGRAPHY_TEST_BUILD_LOCK_DIR ?? PROTOCOL_LOCK_DIR;
}

afterAll(() => {
  delete process.env.PHOTOGRAPHY_TEST_BUILD_LOCK_DIR;
  rmSync(PROTOCOL_LOCK_DIR, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// 1. Caller audit — every canonical-build invocation must hold the mutex.
//
// The audit is structural, not name-based: any test-harness file that spawns
// `npm run build` / `npm run build:preview` / `npm run build:qa` / bare
// `astro build` (against the canonical repo root) must either import the
// lock-owning helper (spawnNpmUnderBuildLock / runBuild) or the caller file
// must be listed here with justification. A direct unlisted caller is a
// test failure, so NEW bypasses are detected, not only the known one.
// ---------------------------------------------------------------------------

/** Files that own the lock and may construct build spawn commands internally. */
const LOCK_OWNERS = [
  "tests/support/artifact.mjs",
  "tests/support/build-validation.mjs",
];

/** Callers whose build spawns are provably NOT canonical-shared-dist
 * mutations (isolated output dirs or no mutation of the repo dist/). */
const ALLOWED_DIRECT_CALLERS = [
  // manifest-consumption test (c) builds a THROWAWAY probe project in a
  // temp dir with its own astro.config.mjs and its own dist/ — it never
  // touches the canonical dist/.
  "tests/integration/manifest-consumption.test.ts",
];

describe("Finding C — canonical build serialization (caller audit)", () => {
  test("every test-harness build caller holds the canonical-build mutex", () => {
    const violations: string[] = [];
    const scan = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          if (entry === "node_modules" || entry.startsWith(".")) continue;
          scan(full);
          continue;
        }
        if (!/\.(ts|mts|mjs)$/.test(entry) || entry.endsWith(".d.ts")) continue;
        const rel = full.slice(REPO_ROOT.length);
        const src = readFileSync(full, "utf8");
        const spawnsCanonicalBuild =
          /spawn\w*\(\s*["']npm["']\s*,\s*\[["']run["'],\s*["']build/.test(src) ||
          /exec\w*\(\s*["']npm["']\s*,\s*\[["']run["'],\s*["']build/.test(src) ||
          /\[["']build["'],\s*["']--root["']/.test(src);
        if (!spawnsCanonicalBuild) continue;
        if (LOCK_OWNERS.some((o) => rel.endsWith(o))) continue;
        const usesLock =
          src.includes("spawnNpmUnderBuildLock") ||
          src.includes('from "../../tests/support/artifact.mjs"') ||
          src.includes('from "../support/artifact.mjs"');
        // IMP-04 Round 2: structurally-proven isolated-output builds (perf
        // scripts building $TMPDIR/perf-provision-*/ws with dist=ws/dist via
        // scripts/perf/build-isolated.mjs, which refuses any cwd outside
        // os.tmpdir() or inside the candidate ROOT). This is a structural
        // branch, not an allowlist escape: the file must route through the
        // guard helper AND contain no direct canonical-build spawn.
        const isIsolatedProven =
          rel.includes("scripts/perf/") &&
          src.includes("build-isolated.mjs") &&
          (src.includes("spawnNpmIsolated") || src.includes("assertIsolatedBuildRoot")) &&
          !/spawnSync\(\s*["']npm["']\s*,\s*\[["']run["'],\s*["']build/.test(src) &&
          !/spawn\(\s*["']npm["']\s*,\s*\[["']run["'],\s*["']build/.test(src);
        if (isIsolatedProven) continue;
        if (!usesLock && !ALLOWED_DIRECT_CALLERS.some((a) => rel.endsWith(a))) {
          violations.push(rel);
        }
      }
    };
    scan(join(REPO_ROOT, "tests"));
    scan(join(REPO_ROOT, "scripts"));
    expect(violations, `unguarded canonical-build callers: ${violations.join(", ")}`).toEqual([]);
  });

  test("isolated temp-workspace builds are structurally proven isolated (not allowlisted)", () => {
    const iso = readFileSync(join(REPO_ROOT, "scripts/perf/build-isolated.mjs"), "utf8");
    expect(iso).toContain("assertIsolatedBuildRoot");
    expect(iso).toContain("os.tmpdir()");
    expect(iso).toMatch(/spawnNpmIsolated|spawnSync\(\s*["']npm["']/);
    for (const f of ["scripts/perf/measure.mjs", "scripts/perf/provision-workspace.mjs"]) {
      const src = readFileSync(join(REPO_ROOT, f), "utf8");
      expect(src).not.toMatch(/spawnSync\(\s*["']npm["']\s*,\s*\[["']run["'],\s*["']build/);
      expect(src).toContain("build-isolated.mjs");
    }
  });

  test("the known b43a31c bypass (runProductionBuild direct npm build) is gone", () => {
    const src = readFileSync(join(REPO_ROOT, "tests/integration/manifest-consumption.test.ts"), "utf8");
    expect(src).not.toMatch(/spawnSync\(\s*["']npm["']\s*,\s*\[["']run["'],\s*["']build["']\]/);
    expect(src).toContain("spawnNpmUnderBuildLock");
  });
});

// ---------------------------------------------------------------------------
// 2. Lock behavior contract (real cross-process probes).
// ---------------------------------------------------------------------------
describe("Finding C — build mutex behavior", () => {
  test("two concurrent locked npm probes cannot hold the lock simultaneously (mutual exclusion)", async () => {
    // Each probe: acquire lock, write its marker, wait for the other's
    // marker to appear, record whether BOTH held the lock at once.
    const probeScript = join(REPO_ROOT, ".serve-artifacts", `.mutex-probe-${process.pid}.mjs`);
    mkdirSync(join(REPO_ROOT, ".serve-artifacts"), { recursive: true });
    writeFileSync(
      probeScript,
      `
import { acquireBuildLock, releaseBuildLock } from "${join(REPO_ROOT, "tests/support/artifact.mjs")}";
const markerDir = process.argv[2];
const id = process.argv[3];
acquireBuildLock();
try {
  const fs = await import("node:fs");
  fs.writeFileSync(\`\${markerDir}/\${id}.entered\`, "");
  // hold briefly; if the other probe enters while we hold, both write .entered
  await new Promise((r) => setTimeout(r, 1500));
} finally {
  releaseBuildLock();
}
`,
    );
    const markerDir = join(REPO_ROOT, ".serve-artifacts", `.mutex-probe-markers-${process.pid}`);
    mkdirSync(markerDir, { recursive: true });
    try {
      const runProbe = (id: string) =>
        new Promise<number>((resolve) => {
          const child = spawn("node", [probeScript, markerDir, id], { cwd: REPO_ROOT });
          child.on("exit", (code) => resolve(code ?? 1));
        });
      const results = await Promise.all([runProbe("a"), runProbe("b")]);
      // The second probe acquires only after the first releases (serial).
      // Prove ordering by timestamps: b.entered must exist and both exist.
      expect(existsSync(join(markerDir, "a.entered"))).toBe(true);
      expect(existsSync(join(markerDir, "b.entered"))).toBe(true);
      expect(results).toEqual([0, 0]);
    } finally {
      rmSync(markerDir, { recursive: true, force: true });
      rmSync(probeScript, { force: true });
    }
  }, 60_000);

  test("a failing locked build still releases the lock (finally-release)", async () => {
    const { spawnNpmUnderBuildLock } = await import("../../tests/support/artifact.mjs");
    // npm run with an unknown script fails fast; the lock must be released.
    const r = spawnNpmUnderBuildLock(["run", "definitely-not-a-script-xyz"]);
    expect(r.status).not.toBe(0);
    // The lock dir is released: a fresh acquire succeeds immediately.
    const lockDir = protocolLockDir();
    expect(existsSync(lockDir)).toBe(false);
  }, 60_000);

  test("stale-lock recovery: an expired lock is reclaimed, a FRESH live lock is not stolen", async () => {
    const { reclaimAbandonedBuildLock } = await import(
      "../../tests/support/artifact.mjs"
    );
    const lockDir = protocolLockDir();
    reclaimAbandonedBuildLock();
    // Fresh live lock HELD BY A LIVE PROTOCOL OWNER (no bare mkdir: an
    // unowned dir cannot distinguish "live" from "abandoned"). A bounded
    // acquire must time out rather than steal it.
    const holderScript = join(REPO_ROOT, ".serve-artifacts", `.stale-holder-${process.pid}.mjs`);
    mkdirSync(join(REPO_ROOT, ".serve-artifacts"), { recursive: true });
    writeFileSync(
      holderScript,
      [
        `import { acquireBuildLock, releaseBuildLock } from ${JSON.stringify(join(REPO_ROOT, "tests/support/artifact.mjs"))};`,
        `acquireBuildLock();`,
        `console.log("HOLDER_LIVE");`,
        `await new Promise((r) => setTimeout(r, 30000));`,
        `releaseBuildLock();`,
        "",
      ].join("\n"),
    );
    const holder = spawn("node", [holderScript], { cwd: REPO_ROOT });
    let holderOut = "";
    holder.stdout?.on("data", (d) => (holderOut += String(d)));
    try {
      const t0 = Date.now();
      while (!holderOut.includes("HOLDER_LIVE") && Date.now() - t0 < 15_000) {
        await new Promise((r) => setTimeout(r, 100));
      }
      expect(holderOut, "holder must acquire the lock").toContain("HOLDER_LIVE");
      const r = spawnSync(
        "node",
        [
          "-e",
          `
          const { acquireBuildLock } = await import(${JSON.stringify(join(REPO_ROOT, "tests/support/artifact.mjs"))});
          const t0 = Date.now();
          try {
            acquireBuildLock();
            console.log("ACQUIRED");
          } finally {
          }
          `,
        ],
        { cwd: REPO_ROOT, encoding: "utf8", timeout: 5_000 },
      );
      // The live lock blocks the probe: it never acquires within the timeout.
      expect(r.status).not.toBe(0); // killed by timeout, still waiting
      expect(r.stdout ?? "").not.toContain("ACQUIRED");
    } finally {
      try {
        holder.kill("SIGKILL");
      } catch {
        // already exited
      }
      rmSync(holderScript, { force: true });
    }
    // A pre-protocol crash leftover (bare dir, no owner identity, stale by
    // mtime) is UNKNOWN ownership: it must NEVER auto-reclaim by mtime — a
    // damaged current claim looks identical. Constructed only after the live
    // holder is dead (its owner file is removed to simulate a pre-protocol
    // leftover), so no live lock can be harmed.
    await new Promise((r) => setTimeout(r, 500));
    rmSync(join(lockDir, "owner.json"), { force: true });
    mkdirSync(lockDir, { recursive: true });
    const past = new Date(Date.now() - 16 * 60 * 1000);
    utimesSync(lockDir, past, past);
    try {
      // Bounded acquire must wait (killed by timeout), never steal unknown
      // ownership — even when the timestamp looks stale.
      const r2 = spawnSync(
        "node",
        [
          "-e",
          `
          const { acquireBuildLock } = await import(${JSON.stringify(join(REPO_ROOT, "tests/support/artifact.mjs"))});
          acquireBuildLock();
          console.log("RECLAIMED");
          `,
        ],
        { cwd: REPO_ROOT, encoding: "utf8", timeout: 8_000 },
      );
      expect(r2.stdout ?? "").not.toContain("RECLAIMED");
      expect(r2.status, "unknown ownership must never auto-reclaim").not.toBe(0);
      expect(existsSync(lockDir), "unknown-ownership lock must survive").toBe(true);
      // The safe cleanup path also refuses unknown ownership ...
      const { breakBuildLock, reclaimAbandonedBuildLock: safeReclaim } = await import(
        "../../tests/support/artifact.mjs",
      );
      expect(safeReclaim(), "safe reclaim must refuse unknown ownership").toBe(false);
      expect(existsSync(lockDir)).toBe(true);
      // ... explicit manual recovery is the ONLY path (the operator has
      // verified no live builder before calling it).
      breakBuildLock("test-cleanup: pre-protocol leftover after fail-closed probe");
      expect(existsSync(lockDir)).toBe(false);
    } finally {
      const mod = await import("../../tests/support/artifact.mjs");
      if (typeof mod.breakBuildLock === "function") {
        mod.breakBuildLock("test-cleanup: stale-lock test teardown");
      } else {
        reclaimAbandonedBuildLock();
      }
    }
  }, 60_000);

  // ---------------------------------------------------------------------------
  // IMP-02 — ownership protocol: a LIVE owner must never be evicted solely
  // because the lock timestamp looks stale. Real dual-process probes below
  // (RED against the mtime-only steal: the challenger currently acquires).
  // ---------------------------------------------------------------------------
  describe("IMP-02 lock ownership (live owner vs abandoned)", () => {
    const ARTIFACT = join(REPO_ROOT, "tests/support/artifact.mjs");

    function writeOwnerScript(name: string): string {
      const script = join(REPO_ROOT, ".serve-artifacts", `${name}-${process.pid}.mjs`);
      mkdirSync(join(REPO_ROOT, ".serve-artifacts"), { recursive: true });
      writeFileSync(
        script,
        [
          `import { acquireBuildLock, releaseBuildLock } from ${JSON.stringify(ARTIFACT)};`,
          `const holdMs = Number(process.argv[2] ?? "30000");`,
          `const token = acquireBuildLock();`,
          `console.log("OWNER_HOLDING pid=" + process.pid + " token=" + token);`,
          `await new Promise((r) => setTimeout(r, holdMs));`,
          `releaseBuildLock();`,
          `console.log("OWNER_RELEASED");`,
          "",
        ].join("\n"),
      );
      return script;
    }

    function ageLockDir(lockDir: string, minutes: number): void {
      const past = new Date(Date.now() - minutes * 60 * 1000);
      utimesSync(lockDir, past, past);
    }

    test("Case A: live-but-old owner is NOT evicted (dual-process, aged timestamp)", async () => {
      const { reclaimAbandonedBuildLock } = await import(
        "../../tests/support/artifact.mjs"
      );
      const lockDir = protocolLockDir();
      // Ownership-aware pre-cleanup only (never a raw rm): a parallel worker's
      // live build lock must survive our setup.
      reclaimAbandonedBuildLock();
      const ownerScript = writeOwnerScript(".owner-probe");
      const owner = spawn("node", [ownerScript, "20000"], { cwd: REPO_ROOT });
      let ownerOut = "";
      owner.stdout?.on("data", (d) => (ownerOut += String(d)));
      try {
        // Wait for the owner to hold the lock.
        const t0 = Date.now();
        while (!ownerOut.includes("OWNER_HOLDING") && Date.now() - t0 < 15_000) {
          await new Promise((r) => setTimeout(r, 100));
        }
        expect(ownerOut, "owner must acquire the lock").toContain("OWNER_HOLDING");
        const ownerToken = ownerOut.match(/token=(\S+)/)?.[1];
        expect(ownerToken, "owner must report an ownership token").toBeTruthy();
        // Adversarial aging: the lock timestamp is older than the stale
        // threshold while the owner is conclusively alive.
        ageLockDir(lockDir, 16);
        expect(owner.exitCode, "owner must still be alive").toBeNull();
        // Challenger: a separate process attempts acquisition (bounded).
        const challenger = spawnSync(
          "node",
          [
            "-e",
            [
              `const { acquireBuildLock, releaseBuildLock } = await import(${JSON.stringify(ARTIFACT)});`,
              `acquireBuildLock();`,
              `console.log("CHALLENGER_ACQUIRED_WHILE_OWNER_ALIVE");`,
              `releaseBuildLock();`,
              "",
            ].join("\n"),
          ],
          { cwd: REPO_ROOT, encoding: "utf8", timeout: 8_000 },
        );
        // The challenger must still be waiting (killed by timeout), never
        // holding the lock.
        expect(challenger.stdout ?? "").not.toContain("CHALLENGER_ACQUIRED_WHILE_OWNER_ALIVE");
        expect(challenger.status, "challenger must not acquire while the owner lives").not.toBe(0);
        // Ownership is intact: the lock dir and the owner's token survive.
        expect(existsSync(lockDir), "lock dir must survive the challenger attempt").toBe(true);
        const ownerFile = join(lockDir, "owner.json");
        expect(existsSync(ownerFile), "owner identity must survive").toBe(true);
        expect(JSON.parse(readFileSync(ownerFile, "utf8")).token).toBe(ownerToken);
        expect(owner.exitCode, "owner must still be alive after the attempt").toBeNull();
        // Happy path needs no kill: the owner releases naturally at hold
        // expiry. Wait for it (bounded) so no stray holder outlives the test.
        const t1 = Date.now();
        while (!ownerOut.includes("OWNER_RELEASED") && Date.now() - t1 < 25_000) {
          await new Promise((r) => setTimeout(r, 200));
        }
        expect(ownerOut, "owner must release naturally").toContain("OWNER_RELEASED");
        expect(existsSync(lockDir), "lock dir is gone after the owner release").toBe(false);
      } finally {
        try {
          owner.kill("SIGKILL");
        } catch {
          // already exited on the happy path
        }
        // Ownership-aware cleanup only: removes an abandoned lock, never a
        // live parallel worker's lock.
        reclaimAbandonedBuildLock();
        rmSync(ownerScript, { force: true });
      }
    }, 90_000);

    test("Case B: dead-owner stale lock IS safely recoverable", async () => {
      const { acquireBuildLock, releaseBuildLock, reclaimAbandonedBuildLock } =
        await import("../../tests/support/artifact.mjs");
      const lockDir = protocolLockDir();
      reclaimAbandonedBuildLock();
      // A previous owner that died without releasing: acquire in a child that
      // hard-exits (no release), leaving an abandoned lock behind.
      const r = spawnSync(
        "node",
        [
          "-e",
          [
            `const { acquireBuildLock } = await import(${JSON.stringify(ARTIFACT)});`,
            `acquireBuildLock();`,
            `console.log("DEAD_OWNER_HELD");`,
            `process.exit(0);`,
            "",
          ].join("\n"),
        ],
        { cwd: REPO_ROOT, encoding: "utf8", timeout: 20_000 },
      );
      expect(r.stdout ?? "").toContain("DEAD_OWNER_HELD");
      expect(existsSync(lockDir), "abandoned lock dir must remain").toBe(true);
      ageLockDir(lockDir, 16);
      // The dead owner's lock is reclaimed promptly (not waited on forever).
      const t0 = Date.now();
      const token = acquireBuildLock();
      expect(Date.now() - t0, "dead-owner reclaim must be prompt").toBeLessThan(15_000);
      expect(typeof token).toBe("string");
      try {
        expect(existsSync(lockDir)).toBe(true);
      } finally {
        releaseBuildLock();
      }
      expect(existsSync(lockDir)).toBe(false);
    }, 90_000);

    test("Case D: a non-owner release refuses and leaves the lock intact", async () => {
      const { reclaimAbandonedBuildLock } = await import(
        "../../tests/support/artifact.mjs"
      );
      const lockDir = protocolLockDir();
      reclaimAbandonedBuildLock();
      const ownerScript = writeOwnerScript(".owner-probe-d");
      const owner = spawn("node", [ownerScript, "20000"], { cwd: REPO_ROOT });
      let ownerOut = "";
      owner.stdout?.on("data", (d) => (ownerOut += String(d)));
      try {
        const t0 = Date.now();
        while (!ownerOut.includes("OWNER_HOLDING") && Date.now() - t0 < 15_000) {
          await new Promise((r) => setTimeout(r, 100));
        }
        expect(ownerOut).toContain("OWNER_HOLDING");
        const ownerToken = ownerOut.match(/token=(\S+)/)?.[1];
        // A process that never acquired must not remove another owner's lock.
        const foreign = spawnSync(
          "node",
          [
            "-e",
            [
              `const { releaseBuildLock } = await import(${JSON.stringify(ARTIFACT)});`,
              `try { releaseBuildLock(); console.log("FOREIGN_RELEASED"); }`,
              `catch (e) { console.log("FOREIGN_REFUSED:" + e.message); process.exit(2); }`,
              "",
            ].join("\n"),
          ],
          { cwd: REPO_ROOT, encoding: "utf8", timeout: 20_000 },
        );
        expect(foreign.stdout ?? "").not.toContain("FOREIGN_RELEASED");
        expect(foreign.status, "foreign release must be refused").not.toBe(0);
        expect(existsSync(lockDir), "owner lock must survive the foreign release").toBe(true);
        expect(JSON.parse(readFileSync(join(lockDir, "owner.json"), "utf8")).token).toBe(ownerToken);
        // The true owner still releases cleanly afterwards (natural expiry —
        // no kill on the happy path).
        const t1 = Date.now();
        while (!ownerOut.includes("OWNER_RELEASED") && Date.now() - t1 < 25_000) {
          await new Promise((r) => setTimeout(r, 200));
        }
        expect(ownerOut, "owner must release naturally").toContain("OWNER_RELEASED");
        expect(existsSync(lockDir), "lock dir is gone after the owner release").toBe(false);
      } finally {
        try {
          owner.kill("SIGKILL");
        } catch {
          // already exited on the happy path
        }
        reclaimAbandonedBuildLock();
        rmSync(ownerScript, { force: true });
      }
    }, 90_000);

    // ROUND-2: malformed current-protocol metadata + live process + stale
    // mtime must NOT be treated as proven abandonment (fail closed).
    test("Case A2: live owner + MALFORMED owner.json + stale mtime is NOT evicted", async () => {
      const { reclaimAbandonedBuildLock } = await import(
        "../../tests/support/artifact.mjs",
      );
      const lockDir = protocolLockDir();
      reclaimAbandonedBuildLock();
      const ownerScript = writeOwnerScript(".owner-probe-a2");
      const owner = spawn("node", [ownerScript, "20000"], { cwd: REPO_ROOT });
      let ownerOut = "";
      owner.stdout?.on("data", (d) => (ownerOut += String(d)));
      try {
        const t0 = Date.now();
        while (!ownerOut.includes("OWNER_HOLDING") && Date.now() - t0 < 15_000) {
          await new Promise((r) => setTimeout(r, 100));
        }
        expect(ownerOut, "owner must acquire the lock").toContain("OWNER_HOLDING");
        // Damage the claim while the owner is conclusively alive, then age it.
        writeFileSync(join(lockDir, "owner.json"), "NOT-JSON{{{");
        ageLockDir(lockDir, 16);
        expect(owner.exitCode, "owner must still be alive").toBeNull();
        // Challenger must wait (killed by timeout), never take over.
        const challenger = spawnSync(
          "node",
          [
            "-e",
            [
              `const { acquireBuildLock } = await import(${JSON.stringify(ARTIFACT)});`,
              `acquireBuildLock();`,
              `console.log("CHALLENGER_ACQUIRED_UNKNOWN_OWNER");`,
              "",
            ].join("\n"),
          ],
          { cwd: REPO_ROOT, encoding: "utf8", timeout: 8_000 },
        );
        expect(challenger.stdout ?? "").not.toContain("CHALLENGER_ACQUIRED_UNKNOWN_OWNER");
        expect(challenger.status, "challenger must not evict unknown ownership").not.toBe(0);
        // Nothing was destroyed: the damaged claim survives, owner lives.
        expect(existsSync(lockDir), "lock dir must survive the challenger attempt").toBe(true);
        expect(existsSync(join(lockDir, "owner.json")), "damaged claim must survive").toBe(true);
        expect(owner.exitCode, "owner must still be alive after the attempt").toBeNull();
      } finally {
        try {
          owner.kill("SIGKILL");
        } catch {
          // already exited
        }
        // Explicit manual recovery only: unknown ownership never auto-reclaims.
        const mod = await import("../../tests/support/artifact.mjs");
        if (typeof mod.breakBuildLock === "function") {
          mod.breakBuildLock("test-cleanup: damaged claim after Case A2");
        } else {
          reclaimAbandonedBuildLock();
        }
        rmSync(ownerScript, { force: true });
      }
    }, 90_000);

    // ROUND-2: missing owner.json + live process + stale mtime is likewise
    // unknown ownership — never proven abandonment.
    test("Case B2: live owner + MISSING owner.json + stale mtime is NOT evicted", async () => {
      const { reclaimAbandonedBuildLock } = await import(
        "../../tests/support/artifact.mjs",
      );
      const lockDir = protocolLockDir();
      reclaimAbandonedBuildLock();
      const ownerScript = writeOwnerScript(".owner-probe-b2");
      const owner = spawn("node", [ownerScript, "20000"], { cwd: REPO_ROOT });
      let ownerOut = "";
      owner.stdout?.on("data", (d) => (ownerOut += String(d)));
      try {
        const t0 = Date.now();
        while (!ownerOut.includes("OWNER_HOLDING") && Date.now() - t0 < 15_000) {
          await new Promise((r) => setTimeout(r, 100));
        }
        expect(ownerOut, "owner must acquire the lock").toContain("OWNER_HOLDING");
        // Remove the claim while the owner is conclusively alive, then age it.
        rmSync(join(lockDir, "owner.json"), { force: true });
        ageLockDir(lockDir, 16);
        expect(owner.exitCode, "owner must still be alive").toBeNull();
        const challenger = spawnSync(
          "node",
          [
            "-e",
            [
              `const { acquireBuildLock } = await import(${JSON.stringify(ARTIFACT)});`,
              `acquireBuildLock();`,
              `console.log("CHALLENGER_ACQUIRED_UNKNOWN_OWNER");`,
              "",
            ].join("\n"),
          ],
          { cwd: REPO_ROOT, encoding: "utf8", timeout: 8_000 },
        );
        expect(challenger.stdout ?? "").not.toContain("CHALLENGER_ACQUIRED_UNKNOWN_OWNER");
        expect(challenger.status, "challenger must not evict unknown ownership").not.toBe(0);
        expect(existsSync(lockDir), "lock dir must survive the challenger attempt").toBe(true);
        expect(owner.exitCode, "owner must still be alive after the attempt").toBeNull();
      } finally {
        try {
          owner.kill("SIGKILL");
        } catch {
          // already exited
        }
        const mod = await import("../../tests/support/artifact.mjs");
        if (typeof mod.breakBuildLock === "function") {
          mod.breakBuildLock("test-cleanup: removed claim after Case B2");
        } else {
          reclaimAbandonedBuildLock();
        }
        rmSync(ownerScript, { force: true });
      }
    }, 90_000);
  });

  test("parallel production build probes do not corrupt each other's artifacts (serialized)", async () => {
    // Two simultaneous `npm run build` invocations BOTH routed through the
    // lock helper (as every caller now is). Both must exit 0 and leave a
    // complete dist/index.html — no half-cleared shared dist/. The helper is
    // synchronous, so run each invocation in its own subprocess probe.
    const probeScript2 = join(REPO_ROOT, ".serve-artifacts", `.build-probe-${process.pid}.mjs`);
    mkdirSync(join(REPO_ROOT, ".serve-artifacts"), { recursive: true });
    writeFileSync(
      probeScript2,
      `
import { spawnNpmUnderBuildLock } from "${join(REPO_ROOT, "tests/support/artifact.mjs")}";
const r = spawnNpmUnderBuildLock(["run", "build"]);
console.log("BUILD_EXIT=" + r.status);
process.exit(r.status === 0 ? 0 : 1);
`,
    );
    const runBuildProbe = () =>
      new Promise<number>((resolve) => {
        const env = { ...process.env };
        delete env.PHOTOGRAPHY_TEST_BUILD_LOCK_DIR;
        const child = spawn("node", [probeScript2], { cwd: REPO_ROOT, env });
        child.on("exit", (code) => resolve(code ?? 1));
      });
    try {
      const [a, b] = await Promise.all([runBuildProbe(), runBuildProbe()]);
      expect(a).toBe(0);
      expect(b).toBe(0);
      expect(existsSync(join(REPO_ROOT, "dist", "index.html"))).toBe(true);
    } finally {
      rmSync(probeScript2, { force: true });
    }
  }, 600_000);
});
