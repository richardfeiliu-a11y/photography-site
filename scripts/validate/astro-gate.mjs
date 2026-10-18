// WP-13 — astro build integration: the fail-closed content validation gate.
//
// Wiring (BUILD_AND_ROUTING §6 — mode selection is ENVIRONMENT CONFIGURATION,
// never content inspection):
//   npm run build        → ASTRO_PRODUCTION_VALIDATE=1 astro build
//                          (gate runs in PRODUCTION mode; any error aborts
//                          the build BEFORE page generation)
//   npm run build:preview → ASTRO_PREVIEW_MODE=1 astro build
//                          (gate runs in PREVIEW mode: draft-friendly —
//                          §13.2 warnings are listed, never fatal; draft
//                          galleries stay in the preview data set so P4/P5
//                          can render the visible draft indicator)
//   neither variable set → PRODUCTION (the fail-closed default; a bare
//                          `astro build` must never silently skip the gate)
//   both variables set   → configuration error (ambiguous mode)
//
// The gate spawns scripts/validate/content.ts (the SAME code path as
// `npm run validate:content` — one source of truth for gate semantics) and
// aborts the build on a non-zero exit.
//
// Preview-only / test-isolation notes (production uses one shared authority):
//   ASTRO_VALIDATE_CONTENT_ROOT   preview content root; rejected in production if it
//                                 would diverge from the canonical project root
//   ASTRO_VALIDATE_INGEST_ROOT    WEB INGEST MASTER root (§13.1#1)
//   ASTRO_VALIDATE_ASSET_MANIFEST preview manifest path; rejected in production
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolveAssetAuthority } from "../../src/lib/assets/manifest-authority.mjs";

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const REGISTER_SCRIPT = pathToFileURL(join(SCRIPTS_DIR, "register-ts-resolve.mjs")).href;
const CLI_SCRIPT = join(SCRIPTS_DIR, "content.ts");
const SPAWN_TIMEOUT_MS = 300_000;

/**
 * Pure mode selection from an environment record. Returns { mode, error,
 * warnings } — error is non-null when the configuration is ambiguous (both
 * mode vars set); warnings lists set-but-unrecognized variable values (e.g.
 * ASTRO_PREVIEW_MODE=true) so a near-miss configuration is never silent
 * ("1" enables; "0" or unset disables).
 */
export function resolveGatePlan(env) {
  const warnings = [];
  for (const name of ["ASTRO_PRODUCTION_VALIDATE", "ASTRO_PREVIEW_MODE"]) {
    const value = env[name];
    if (value !== undefined && value !== "" && value !== "1" && value !== "0") {
      warnings.push(
        `${name}='${value}' is not recognized — only '1' enables and '0'/unset disables; the variable is treated as UNSET (fail-closed default still applies)`,
      );
    }
  }
  const production = env.ASTRO_PRODUCTION_VALIDATE === "1";
  const preview = env.ASTRO_PREVIEW_MODE === "1";
  if (production && preview) {
    return {
      mode: null,
      warnings,
      error:
        "ambiguous mode configuration: both ASTRO_PRODUCTION_VALIDATE=1 and ASTRO_PREVIEW_MODE=1 are set (BUILD_AND_ROUTING §6 requires exactly one environment configuration)",
    };
  }
  // Fail-closed default: no environment configuration at all means the
  // production gate — a bare `astro build` never silently skips validation.
  return { mode: preview ? "preview" : "production", error: null, warnings };
}

/**
 * Runs the content validation CLI synchronously. Returns { status, stdout,
 * stderr } without throwing (the caller decides how to fail).
 */
export function runContentValidation({ mode, contentRoot, ingestRoot, assetManifest }) {
  const args = [
    "--experimental-strip-types",
    "--import",
    REGISTER_SCRIPT,
    CLI_SCRIPT,
    "--mode",
    mode,
    "--content-root",
    contentRoot,
  ];
  if (ingestRoot) args.push("--ingest-root", ingestRoot);
  if (assetManifest) args.push("--asset-manifest", assetManifest);
  const result = spawnSync(process.execPath, args, {
    encoding: "utf8",
    timeout: SPAWN_TIMEOUT_MS,
  });
  return {
    status: result.status ?? -1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

/**
 * The Astro integration. Validates content at `astro:build:start` — before
 * any page generation — and throws (aborting the build) on validation failure.
 */
export function contentValidationGate() {
  let configRootUrl;
  return {
    name: "wp13-content-validation-gate",
    hooks: {
      "astro:config:done"({ config }) {
        configRootUrl = config.root;
      },
      "astro:build:start"() {
        const env = process.env;
        const plan = resolveGatePlan(env);
        if (plan.error || plan.mode === null) {
          throw new Error(`[wp13-content-validation-gate] ${plan.error ?? "invalid mode"}`);
        }
        for (const warning of plan.warnings ?? []) {
          process.stderr.write(`[wp13-content-validation-gate] WARNING: ${warning}\n`);
        }
        let authority;
        try {
          authority = resolveAssetAuthority({
            env,
            configRoot: configRootUrl ? fileURLToPath(configRootUrl) : process.cwd(),
          });
        } catch (error) {
          throw new Error(
            `[wp13-content-validation-gate] ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        const run = runContentValidation({
          mode: plan.mode,
          contentRoot: authority.projectRoot,
          ingestRoot: env.ASTRO_VALIDATE_INGEST_ROOT,
          assetManifest: plan.mode === "preview" ? env.ASTRO_VALIDATE_ASSET_MANIFEST : authority.validatorManifestPath,
        });
        if (run.stdout) process.stdout.write(run.stdout);
        if (run.stderr) process.stderr.write(run.stderr);
        if (run.status !== 0) {
          // Errors are printed to stderr by the CLI; scan both streams.
          const errorLines = `${run.stdout}\n${run.stderr}`
            .split("\n")
            .filter((line) => line.startsWith("ERROR"))
            .slice(0, 20)
            .join("\n");
          throw new Error(
            `[wp13-content-validation-gate] content validation FAILED (mode=${plan.mode}); aborting build. Findings:\n${errorLines}`,
          );
        }
      },
    },
  };
}
