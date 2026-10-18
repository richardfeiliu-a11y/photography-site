// IMP-06 — production /qa-probe route leak fix.
//
// src/pages/qa-probe.astro is a test fixture (token/font/JS-canary probes),
// NOT a canonical content route. BUILD_AND_ROUTING §4 governs the canonical
// route table; /qa-probe is not in it. noindex,nofollow is NOT sufficient —
// the route must not be emitted by production OR preview builds.
//
// Mechanism: an Astro integration whose `astro:build:done` hook removes the
// rendered /qa-probe page from `dist/` unless the build explicitly opts in
// via QA_PROBE=1 (the e2e/a11y test harness does this). Dev server keeps it
// available for interactive debugging. This keeps the probe implementation
// in src/pages (so dev/test wiring is ordinary) while guaranteeing the
// public production/preview surface never contains it.
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

function toPath(dir) {
  try {
    return dir.toString().startsWith("file://")
      ? fileURLToPath(dir.toString())
      : dir.toString();
  } catch {
    return String(dir);
  }
}

export function qaProbeGate() {
  return {
    name: "qa-probe-gate",
    hooks: {
      "astro:build:done"({ dir }) {
        // Opt-in via QA_PROBE=1 (test harness); production + preview default
        // to exclusion.
        if (process.env.QA_PROBE === "1") return;
        const target = join(toPath(dir), "qa-probe", "index.html");
        const dirTarget = join(toPath(dir), "qa-probe");
        if (existsSync(target)) rmSync(target);
        try {
          rmSync(dirTarget, { recursive: true, force: true });
        } catch {
          /* empty dir may already be gone */
        }
        console.log("[qa-probe-gate] removed qa-probe from built output (not a canonical route)");
      },
    },
  };
}
