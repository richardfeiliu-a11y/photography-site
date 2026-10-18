// WP-24 — astro build integration: the producer-before-consumer manifest
// consumption gate (BUILD_AND_ROUTING §1 DAG: GENERATED ASSET MANIFEST must
// precede ASTRO BUILD; IMAGE_PIPELINE §10.1/§13.3; ADR-026).
//
// Wiring (identical env-mode pattern to WP-13's contentValidationGate —
// scripts/validate/astro-gate.mjs, whose resolveGatePlan this gate REUSES
// for the exact same mode semantics):
//   npm run build         → ASTRO_PRODUCTION_VALIDATE=1 astro build
//                           (PRODUCTION: the manifest must exist, load
//                           through the WP-24 typed contract, and pass the
//                           WP-23 coverage closure for published content —
//                           any defect aborts the build BEFORE page
//                           generation with a clear producer-before-consumer
//                           error)
//   npm run build:preview → ASTRO_PREVIEW_MODE=1 astro build
//                           (PREVIEW: the manifest may be missing or
//                           incomplete (BUILD_AND_ROUTING §9 "may be
//                           incomplete") — WARNINGS, never fatal)
//   neither variable set  → PRODUCTION (fail-closed default)
//   both variables set    → configuration error (ambiguous mode)
//
// The gate spawns scripts/validate/manifest-gate.ts (the SAME code path the
// docs describe — one source of truth for gate semantics), which checks:
//   1. existence        (11.1:manifest-missing)
//   2. typed loadability (24:manifest-unloadable — the WP-24 Zod contract)
//   3. coverage closure  (WP-23 validateCoverage: 13.1#18 width-precise,
//                        11.1:* record resolution/identity — reused, not
//                        re-implemented; BOUNDARY: scripts/ → src/lib is the
//                        permitted import direction, src/lib never imports
//                        the pipeline)
//
// Preview-only environment overrides (production uses one shared authority):
//   ASTRO_VALIDATE_CONTENT_ROOT   preview content root; rejected in production if it
//                                 would diverge from the canonical project root
//   ASTRO_VALIDATE_ASSET_MANIFEST preview manifest path; rejected in production
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolveGatePlan } from "./astro-gate.mjs";
import { resolveAssetAuthority } from "../../src/lib/assets/manifest-authority.mjs";

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const REGISTER_SCRIPT = pathToFileURL(join(SCRIPTS_DIR, "register-ts-resolve.mjs")).href;
const GATE_CLI = join(SCRIPTS_DIR, "manifest-gate.ts");
// Enforceable child bound (ROUND-2 IMP-03): a Vitest-local timeout cannot
// interrupt a BLOCKING child — it only fires after the child returns — so
// the child process timeout itself is the real bound. Isolated gate cost is
// 0.2–0.5s and normal e2e about 1.4s; one historical full-suite contention
// spike passed 5s, so 20s is the explicit engineering bound (40x isolated
// cost, far below any 300s-class hang). The awaiting test timeout (30s
// local) always exceeds this with margin for worker reporting.
export const GATE_CHILD_TIMEOUT_MS = 20_000;

/**
 * Cancellable child execution (ROUND-2 IMP-03): the timeout TERMINATES the
 * child (SIGKILL) instead of merely racing a blocked worker, so the
 * caller's declared bound actually bounds the operation. Resolves
 * { status, signal, timedOut, stdout, stderr, elapsedMs, pid } — stdout and
 * stderr are always captured for diagnostics, including on timeout. The
 * close event fires only after the process terminates, so a resolved run
 * never leaves an orphan.
 */
export function runWithTimeout(command, args, { timeoutMs = GATE_CHILD_TIMEOUT_MS, cwd } = {}) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawn(command, args, { cwd });
    let stdout = "";
    let stderr = "";
    if (child.stdout) child.stdout.on("data", (d) => { stdout += String(d); });
    if (child.stderr) child.stderr.on("data", (d) => { stderr += String(d); });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill("SIGKILL");
      } catch {
        // already exited — close below reports the real status
      }
    }, timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ status: code, signal, timedOut, stdout, stderr, elapsedMs: Date.now() - started, pid: child.pid });
    });
  });
}

/**
 * Run the manifest gate CLI (scripts/validate/manifest-gate.ts — the SAME
 * code path the docs describe) as a cancellable async child with the
 * enforceable GATE_CHILD_TIMEOUT_MS bound.
 */
export function runManifestGate({ mode, contentRoot, assetManifest, timeoutMs = GATE_CHILD_TIMEOUT_MS }) {
  const args = [
    "--experimental-strip-types",
    "--import",
    REGISTER_SCRIPT,
    GATE_CLI,
    "--mode",
    mode,
    "--content-root",
    contentRoot,
  ];
  if (assetManifest) {
    args.push("--asset-manifest", assetManifest);
  }
  return runWithTimeout(process.execPath, args, { timeoutMs });
}

/**
 * The Astro integration. Runs the manifest consumption gate at
 * `astro:build:start` — after WP-13's content validation gate (integration
 * array order in astro.config.mjs mirrors the §1 DAG: reference + source
 * validation, then the manifest boundary), before any page generation.
 * The hook is async and AWAITS the cancellable gate child, so a hung gate
 * fails the build at the enforceable bound instead of blocking silently.
 */
export function assetManifestGate() {
  let configRootUrl;
  return {
    name: "wp24-manifest-consumption-gate",
    hooks: {
      "astro:config:done"({ config }) {
        configRootUrl = config.root;
      },
      async "astro:build:start"() {
        const plan = resolveGatePlan(process.env);
        if (plan.error || plan.mode === null) {
          throw new Error(`[wp24-manifest-consumption-gate] ${plan.error ?? "invalid mode"}`);
        }
        for (const warning of plan.warnings ?? []) {
          process.stderr.write(`[wp24-manifest-consumption-gate] WARNING: ${warning}\n`);
        }
        let authority;
        try {
          authority = resolveAssetAuthority({
            env: process.env,
            configRoot: configRootUrl ? fileURLToPath(configRootUrl) : process.cwd(),
          });
        } catch (error) {
          throw new Error(
            `[wp24-manifest-consumption-gate] ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        const run = await runManifestGate({
          mode: plan.mode,
          contentRoot: authority.projectRoot,
          assetManifest: plan.mode === "preview" ? process.env.ASTRO_VALIDATE_ASSET_MANIFEST : authority.validatorManifestPath,
        });
        if (run.stdout) process.stdout.write(run.stdout);
        if (run.stderr) process.stderr.write(run.stderr);
        if (run.timedOut) {
          throw new Error(
            `[wp24-manifest-consumption-gate] manifest gate TIMED OUT after ${run.elapsedMs}ms ` +
              `(bound ${GATE_CHILD_TIMEOUT_MS}ms, mode=${plan.mode}); aborting build — ` +
              `the gate child was SIGKILLed, never silently awaited.`,
          );
        }
        if (run.status !== 0) {
          const errorLines = `${run.stdout ?? ""}\n${run.stderr ?? ""}`
            .split("\n")
            .filter((line) => line.startsWith("ERROR"))
            .slice(0, 20)
            .join("\n");
          throw new Error(
            `[wp24-manifest-consumption-gate] producer-before-consumer violation: the asset manifest ` +
              `is missing, unloadable, or does not cover the published content (mode=${plan.mode}); ` +
              `aborting build. The manifest is a BUILD-TIME INPUT produced by media:pipeline before ` +
              `astro build (BUILD_AND_ROUTING §1; ADR-026) — run \`npm run build:media\`. Findings:\n` +
              errorLines,
          );
        }
      },
    },
  };
}
