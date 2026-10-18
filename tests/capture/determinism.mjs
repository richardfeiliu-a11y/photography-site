// Capture determinism verifier (`npm run capture:determinism`).
//
// FINAL gate-correctness correction — Finding B acceptance contract:
// two FRESH capture runs from INDEPENDENTLY rebuilt artifacts must produce
// byte-identical PNGs (same dimensions, same SHA-256) for EVERY governed
// state — 14/14, no pixel tolerance, no ignored 1-2px delta. This is what
// would have detected the 4729/4731 gallery-desktop-portrait height race.
//
// Each run captures into its own temp directory (independent processes,
// independent builds, independent browser contexts); the verifier then
// compares the two SHA sets. It never compares a capture to itself or to a
// baseline produced in the same process.
//
// Usage: node tests/capture/determinism.mjs [--runs 2] [--keep]
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { CAPTURE_STATES } from "./states.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function captureSet(outDir, label) {
  console.log(`[determinism] ${label}: fresh capture run -> ${outDir}`);
  const r = spawnSync("node", ["tests/capture/capture.mjs", "--out-dir", outDir], {
    cwd: ROOT,
    stdio: "inherit",
    timeout: 30 * 60_000,
  });
  if (r.status !== 0) {
    console.error(`[determinism] ${label}: capture FAILED (exit ${r.status})`);
    process.exit(r.status ?? 1);
  }
  const shas = {};
  for (const state of CAPTURE_STATES) {
    const png = join(outDir, state.id, "index.png");
    if (!existsSync(png)) {
      console.error(`[determinism] ${label}: governed state ${state.id} missing capture — FAIL`);
      process.exit(1);
    }
    shas[state.id] = sha256File(png);
  }
  return shas;
}

function main() {
  const args = process.argv.slice(2);
  const runCount = args.includes("--runs") ? Number(args[args.indexOf("--runs") + 1]) : 2;
  const keep = args.includes("--keep");
  if (runCount < 2) {
    console.error("[determinism] --runs must be >= 2 (independent-run reproducibility)");
    process.exit(1);
  }

  const sets = [];
  const dirs = [];
  for (let i = 0; i < runCount; i++) {
    const dir = mkdtempSync(join(tmpdir(), `capture-determinism-${i}-`));
    dirs.push(dir);
    sets.push(captureSet(dir, `Run ${String.fromCharCode(65 + i)}`));
  }

  const baseline = sets[0];
  const mismatches = [];
  for (let s = 1; s < sets.length; s++) {
    for (const state of CAPTURE_STATES) {
      if (sets[s][state.id] !== baseline[state.id]) {
        mismatches.push({
          state: state.id,
          runA: baseline[state.id],
          [`run${String.fromCharCode(65 + s)}`]: sets[s][state.id],
        });
      }
    }
  }

  console.log(`[determinism] governed states: ${CAPTURE_STATES.length}`);
  console.log(`[determinism] Run A vs Run B: ${CAPTURE_STATES.length - mismatches.length}/${CAPTURE_STATES.length} identical`);
  if (mismatches.length > 0) {
    console.error(JSON.stringify(mismatches, null, 2));
    console.error("[determinism] CAPTURE-DETERMINISM: FAIL");
    if (!keep) dirs.forEach((d) => rmSync(d, { recursive: true, force: true }));
    process.exit(1);
  }
  for (const state of CAPTURE_STATES) {
    console.log(`  identical  ${state.id}  sha256=${baseline[state.id]}`);
  }
  console.log("[determinism] CAPTURE-DETERMINISM: PASS");
  if (!keep) dirs.forEach((d) => rmSync(d, { recursive: true, force: true }));
}

main();
