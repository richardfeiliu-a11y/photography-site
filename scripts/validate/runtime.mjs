// scripts/validate/runtime.mjs — R1: precise acceptance runtime check.
// The declared engines range is the contract (package.json engines); the
// acceptance process must match it. We never silently widen the range to the
// current environment — a mismatch is a blocker to record, not a number to edit.
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(join(fileURLToPath(import.meta.url), "..", "..", ".."));

export function checkRuntime(env) {
  const issues = [];
  const nodeVersion = env.nodeVersion || process.version;
  const declaredRange =
    env.declaredRange ||
    (JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).engines?.node ?? ">=22.12.0 <23");
  // semver range check — minimal: parse ">=X <Y" and compare major/minor/patch.
  const inRange = rangeIncludes(declaredRange, nodeVersion);
  if (!inRange) {
    issues.push({
      code: "NODE_VERSION_OUT_OF_RANGE",
      field: "node",
      actual: nodeVersion,
      required: declaredRange,
    });
  }
  const nodeModulesExists = env.nodeModulesExists ?? existsSync(join(ROOT, "node_modules"));
  if (!nodeModulesExists) {
    issues.push({ code: "DEPS_NOT_INSTALLED", field: "node_modules", actual: "missing" });
  }
  const pm = env.packageManager || "npm";
  const lock = existsSync(join(ROOT, "package-lock.json"));
  if (pm === "npm" && !lock) {
    issues.push({ code: "LOCKFILE_MISSING", field: "package-lock.json", actual: "missing" });
  }
  return { ok: issues.length === 0, issues };
}

function rangeIncludes(range, version) {
  // Supports the project's engines range grammar: ">=a.b.c <d.e" or ">=a.b.c <d.e.f".
  // The Node engines convention is "<MAJOR" (which means "<MAJOR.0.0"), so the
  // upper bound may omit minor and patch.
  const m = String(range).match(
    /^>=(\d+)\.(\d+)\.(\d+)\s*<\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?$/,
  );
  if (!m) return false; // malformed contract surfaces as out-of-range
  const minMaj = +m[1];
  const minMin = +m[2];
  const minPat = +m[3];
  const maxMaj = +m[4];
  const maxMin = m[5] === undefined ? 0 : +m[5];
  const maxPat = m[6] === undefined ? 0 : +m[6];
  const v = String(version).replace(/^v/, "").split(".").map(Number);
  const maj = v[0] ?? 0;
  const min = v[1] ?? 0;
  const pat = v[2] ?? 0;
  const belowMax =
    maj < maxMaj || (maj === maxMaj && (min < maxMin || (min === maxMin && pat < maxPat)));
  const atLeastMin =
    maj > minMaj ||
    (maj === minMaj && (min > minMin || (min === minMin && pat >= minPat)));
  return atLeastMin && belowMax;
}

if (process.argv[1] && process.argv[1].endsWith("runtime.mjs")) {
  const result = checkRuntime({});
  if (!result.ok) {
    for (const i of result.issues) console.error(`[runtime] FAIL ${i.code}: ${i.field} = ${i.actual} (required ${i.required ?? "present"})`);
    process.exitCode = 1;
  } else {
    console.log(`[runtime] OK node=${process.version} range=${JSON.parse(readFileSync(join(ROOT,"package.json"),"utf8")).engines?.node}`);
  }
}
