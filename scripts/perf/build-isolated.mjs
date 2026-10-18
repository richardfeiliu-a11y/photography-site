#!/usr/bin/env node
// scripts/perf/build-isolated.mjs — isolated-build ownership for WP-45 perf scripts.
//
// WHY: the canonical-build mutex (tests/support/artifact.mjs) serializes
// mutations of the CANONICAL dist/. Perf builds run in an isolated temp
// workspace ($TMPDIR/perf-provision-<ts>-<pid>) with dist=ws/dist and never
// touch the canonical dist/. This helper makes that isolation STRUCTURAL: it
// refuses any cwd outside os.tmpdir() or inside the candidate ROOT, so the
// caller audit can distinguish isolated-output builds from canonical builds
// without an allowlist escape.
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(join(dirname(fileURLToPath(import.meta.url)), "..", ".."));

export function assertIsolatedBuildRoot(cwd) {
  const abs = resolve(cwd);
  const tmp = resolve(tmpdir());
  if (abs !== tmp && !abs.startsWith(tmp + sep)) {
    throw new Error(`[isolated-build] refusing: cwd not under os.tmpdir(): ${abs}`);
  }
  if (abs === ROOT || abs.startsWith(ROOT + sep)) {
    throw new Error(`[isolated-build] refusing: cwd inside candidate ROOT: ${abs}`);
  }
  return abs;
}

export function spawnNpmIsolated({ cwd, args, env }) {
  const root = assertIsolatedBuildRoot(cwd);
  const result = spawnSync("npm", args, {
    cwd: root,
    stdio: "pipe",
    encoding: "utf8",
    env,
  });
  if (result.status !== 0) {
    throw new Error(`[isolated-build] npm ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  }
  return result;
}
