// R2 — mutations must RED through the SAME formal CLI entry (方案 §6.1: cannot
// prove the gate by mirroring a second copy). Each tamper writes a temp
// baseline JSON and runs `node scripts/perf/validate-baseline.mjs --input <path>`
// in a subprocess. The real baseline must pass; the mutations must fail.
import { spawnSync } from "node:child_process";
// R8/I6 — perf CLI spawn chain (see perf-measurements.test.ts): fixed
// --experimental-strip-types + ts-resolve launch, empty NODE_OPTIONS.
const NODE_TS_ARGS = ["--experimental-strip-types", "--import", "./scripts/validate/register-ts-resolve.mjs"];
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { FROZEN_WEB_VITALS } from "../../src/lib/perf/budget";

const BASELINE_FILE = new URL(
  "../../docs/implementation/PERF-BASELINE.json",
  import.meta.url,
).pathname;
const CLI = join(
  import.meta.dirname,
  "..",
  "..",
  "scripts",
  "perf",
  "validate-baseline.mjs",
);

const load = (): any => JSON.parse(readFileSync(BASELINE_FILE, "utf8"));
const clone = (b: any): any => JSON.parse(JSON.stringify(b));

function runCli(baseline: any) {
  const dir = mkdtempSync(join(tmpdir(), "perf-mutation-"));
  const file = join(dir, "mutated.json");
  writeFileSync(file, JSON.stringify(baseline));
  const res = spawnSync("node", [...NODE_TS_ARGS, CLI, "--input", file], {
    encoding: "utf8",
    env: { ...process.env, NODE_OPTIONS: "" },
  });
  rmSync(dir, { recursive: true, force: true });
  let parsed: any = {};
  try {
    parsed = JSON.parse(res.stdout || "{}");
  } catch {
    parsed = { _parseError: true, stdout: res.stdout, stderr: res.stderr };
  }
  return { status: res.status, parsed };
}

describe("perf semantic mutations must RED (through the formal CLI)", () => {
  test("real baseline is reported honestly (LCP misses in the record surface as LCP_OVER_FROZEN)", () => {
    // The real baseline is reported exactly as measured: every cell above the
    // frozen target surfaces as LCP_OVER_FROZEN and nothing is auto-overridden.
    // R4 round4 (2026-09-15, D2 promotion) — the promoted record has NO LCP
    // miss, so the expectation is derived from the record instead of asserting
    // the R3 red slots. If a future run regresses a cell, the derived set grows
    // and the CLI must go back to exit 1, so this stays honest in both states.
    expect(existsSync(BASELINE_FILE), "run npm run perf:measure first").toBe(
      true,
    );
    const baseline = load();
    const { status, parsed } = runCli(baseline);
    const expectedOver = (baseline.pages as Array<any>).flatMap((page) =>
      ["desktop", "mobileLowEnd"]
        .filter((name) => page.profiles[name].lcp.medianMs > FROZEN_WEB_VITALS.lcpMs)
        .map((name) => `${page.path}.profiles.${name}.lcp.medianMs`),
    );
    const codes = new Set((parsed.issues ?? []).map((i: any) => i.code));
    expect(codes.has("LCP_OVER_FROZEN")).toBe(expectedOver.length > 0);
    expect(status).toBe(expectedOver.length > 0 ? 1 : 0);
    expect(parsed.ok).toBe(expectedOver.length === 0);
    expect(parsed.issues.map((i: any) => i.path).filter((p: string) => p.endsWith(".lcp.medianMs")).sort()).toEqual(
      expectedOver.slice().sort(),
    );
  });

  test("LCP all 99999 RED", () => {
    const b = clone(load());
    for (const p of b.pages)
      for (const n of ["desktop", "mobileLowEnd"])
        p.profiles[n].lcp.medianMs = 99999;
    const { status, parsed } = runCli(b);
    expect(status).not.toBe(0);
    expect(parsed.issues.some((i: any) => i.code === "LCP_OVER_FROZEN")).toBe(true);
  });

  test("wall-clock zero runs RED", () => {
    const b = clone(load());
    b.inpMethod = "wall-clock";
    for (const i of b.interactions) {
      if (i.status === "na") continue;
      for (const n of ["desktop", "mobileLowEnd"]) {
        i.profiles[n].attribution = false;
        i.profiles[n].runs = [
          { durationMs: 0, interactionId: 0, targetAction: i.id },
        ];
        i.profiles[n].medianMs = 0;
      }
    }
    const { status } = runCli(b);
    expect(status).not.toBe(0);
  });

  test("wrong-target attributed run RED", () => {
    const b = clone(load());
    const t = b.interactions.find((x: any) => x.id === "overview-close");
    t.profiles.desktop.runs[0] = {
      durationMs: 32,
      interactionId: 7,
      targetAction: "overview-open",
    };
    t.profiles.desktop.attribution = false;
    const { status } = runCli(b);
    expect(status).not.toBe(0);
  });

  test("zero heap/DOM/image RED", () => {
    const b = clone(load());
    const long = b.pages.find((p: any) => p.path === "/galleries/netherlands");
    for (const n of ["desktop", "mobileLowEnd"]) {
      long.profiles[n].memory.jsHeapBytes = 0;
      long.profiles[n].memory.domNodes = 0;
      long.profiles[n].memory.decodedImageEstimateBytes = 0;
    }
    const { status } = runCli(b);
    expect(status).not.toBe(0);
  });
});
