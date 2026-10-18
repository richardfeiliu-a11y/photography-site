// WP-06 build-validation scaffold — hook points that later work packages call.
//
// Purpose (WP-06 brief, step 6): a minimal, stable orchestration seam for build
// validation so feature WPs never ad-hoc glue build steps into tests:
//   - WP-13: registers `beforeBuild` content validation (fail-closed draft /
//     published gate) and gives `build:preview` real draft semantics.
//   - WP-23: registers `afterBuild` source/manifest closure checks (asset
//     manifest exists before Astro consumes it; derivatives complete).
//   - WP-51: registers `validateRelease` assembled-release verification
//     (every HTML-referenced asset exists; no source masters in output).
//
// Fail-closed semantics (TESTING_AND_VISUAL_REGRESSION.md §3.1): the first
// failing stage stops the run; later stages are reported as `skipped`, never
// silently passed. The `build` stage defaults to a real `npm run build` and
// may be overridden via hooks for unit testing or alternative pipelines.
import process from "node:process";
// IMP-06 final gate correction: the default build stage mutates the shared
// canonical dist/ — it must hold the same cross-process build mutex as every
// other test-harness canonical-build caller (spawnNpmUnderBuildLock).
import { spawnNpmUnderBuildLock } from "./artifact.mjs";

/** Frozen lifecycle stage order for build validation. */
export const BUILD_VALIDATION_STAGES = Object.freeze([
  "beforeBuild",
  "build",
  "afterBuild",
  "validateRelease",
]);

/** Default build stage: a real production build in the validated directory,
 * under the canonical-build mutex (shared dist/ has one owner at a time). */
async function defaultBuild(ctx) {
  const r = spawnNpmUnderBuildLock(["run", "build"], { cwd: ctx.cwd });
  if (r.status !== 0) {
    throw new Error(`defaultBuild: npm run build failed (exit ${r.status})`);
  }
}

/**
 * Run the build-validation lifecycle.
 *
 * @param {Record<string, (ctx: {cwd: string}) => Promise<void>>} [hooks]
 *   Optional async hooks keyed by stage name. Unknown stage names are rejected
 *   up front. `build` falls back to `npm run build` when not provided.
 * @param {{cwd?: string}} [options]
 * @returns {Promise<{ok: boolean, results: Array<{stage: string, status: "passed"|"failed"|"skipped", error?: string, reason?: string}>}>}
 */
export async function runBuildValidation(hooks = {}, options = {}) {
  const unknown = Object.keys(hooks).filter((stage) => !BUILD_VALIDATION_STAGES.includes(stage));
  if (unknown.length > 0) {
    throw new TypeError(
      `runBuildValidation: unknown hook stage(s): ${unknown.join(", ")}. ` +
        `Valid stages: ${BUILD_VALIDATION_STAGES.join(", ")}.`,
    );
  }

  const ctx = { cwd: options.cwd ?? process.cwd() };
  const results = [];
  let ok = true;

  for (const stage of BUILD_VALIDATION_STAGES) {
    if (!ok) {
      results.push({ stage, status: "skipped", reason: "fail-closed: earlier stage failed" });
      continue;
    }
    if (stage === "build") {
      const hook = hooks.build ?? defaultBuild;
      try {
        await hook(ctx);
        results.push({ stage, status: "passed" });
      } catch (error) {
        ok = false;
        results.push({ stage, status: "failed", error: String(error?.message ?? error) });
      }
      continue;
    }
    const hook = hooks[stage];
    if (!hook) {
      results.push({ stage, status: "skipped", reason: "no hook provided" });
      continue;
    }
    try {
      await hook(ctx);
      results.push({ stage, status: "passed" });
    } catch (error) {
      ok = false;
      results.push({ stage, status: "failed", error: String(error?.message ?? error) });
    }
  }

  return { ok, results };
}
