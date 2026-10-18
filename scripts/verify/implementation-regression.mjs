// scripts/verify/implementation-regression.mjs — R1: serial full engineering
// regression on the CURRENT candidate, from THIS workspace cwd.
//
// Contract (方案 §5.3): serial coverage of check/unit/integration/e2e/a11y/
// build, plus a B-class preview workspace run of test:e2e:preview. Known
// performance-red items are LISTED SEPARATELY (方案 §5.3 "R1 时已知性能红项可
// 明确单列") and never hidden; every exit code is recorded even when an earlier
// step fails (方案 §5.2 "不得通过忽略退出码或删除断言得到成功").
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(join(fileURLToPath(import.meta.url), "..", "..", ".."));

export function planSteps({ includePreview = true } = {}) {
  const steps = [
    { name: "check", cmd: "npm", args: ["run", "check"] },
    { name: "test:unit", cmd: "npm", args: ["run", "test:unit"] },
    { name: "test:integration", cmd: "npm", args: ["run", "test:integration"] },
    { name: "test:e2e", cmd: "npm", args: ["run", "test:e2e"] },
    { name: "test:a11y", cmd: "npm", args: ["run", "test:a11y"] },
    { name: "build", cmd: "npm", args: ["run", "build"] },
  ];
  if (includePreview) {
    steps.push({
      name: "test:e2e:preview",
      cmd: "npm",
      args: ["run", "test:e2e:preview"],
      preview: true,
    });
  }
  return steps;
}

export function summarize(results) {
  const failed = results.filter((r) => r.code !== 0).map((r) => r.name);
  const byName = Object.fromEntries(results.map((r) => [r.name, r.code]));
  const perfRed = results.flatMap((r) => r.perfRed ?? []);
  return { ok: failed.length === 0, failed, byName, perfRed };
}

// Perf-red detection: the perf integration tests fail on LCP/INP/CLS
// thresholds; we report them as known performance-red, not hidden. Real
// implementation regressions must be located and fixed — perf-red is ONLY the
// documented threshold misses.
function collectPerfRed(res) {
  const out = `${res.stdout ?? ""}\n${res.stderr ?? ""}`;
  const hits = [];
  if (/PERF|LCP|INP|CLS/i.test(out)) hits.push("perf-integration-thresholds");
  return hits;
}

async function main() {
  const steps = planSteps({ includePreview: true });
  const results = [];
  console.log(
    `[regression] serial suite: ${steps.map((s) => s.name).join(" → ")}`,
  );
  for (const step of steps) {
    console.log(`[regression] → ${step.name} …`);
    const res = spawnSync(step.cmd, step.args, {
      cwd: ROOT,
      stdio: "inherit",
      encoding: "utf8",
    });
    results.push({
      name: step.name,
      code: res.status ?? (res.error ? 1 : 0),
      perfRed:
        step.name === "test:integration" ? collectPerfRed(res) : [],
    });
    // Keep going even on failure to preserve diagnostics for later steps.
    console.log(
      `[regression] ${step.name} exit=${results[results.length - 1].code}`,
    );
  }
  const summary = summarize(results);
  console.log(
    `[regression] ${summary.ok ? "PASS" : "FAIL"} failed=${summary.failed.join(",") || "none"} perfRed=${summary.perfRed.join(",") || "none"}`,
  );
  process.exitCode = summary.ok ? 0 : 1;
}

const isMain = process.argv[1] && process.argv[1].endsWith("implementation-regression.mjs");
if (isMain) {
  main().catch((e) => {
    console.error(String((e && e.stack) || e));
    process.exitCode = 1;
  });
}
