// scripts/validate/font-coverage-gate.mjs - astro build integration (WP-46).
// Runs the CJK coverage CLI at astro build start.
// Production fails closed on uncovered characters; preview warns.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveGatePlan } from "./astro-gate.mjs";
import { GATE_CHILD_TIMEOUT_MS, runWithTimeout } from "./asset-gate.mjs";

const GATE_DIR = dirname(fileURLToPath(import.meta.url));
const PARENT = "..";
const FONTSDIR = "fonts";
const CLIFILE = "coverage-check.mjs";
const PVMODE = "preview";
const CONTENTDIR = "content";
const SRCDIR = "src";
const STYLESDIR = "styles";
const CSSFILE = "fonts.css";
const SCRIPTSDIR = "scripts";
const ALLOWFILE = "fallback-accepted.txt";
const GATE_CLI = join(GATE_DIR, PARENT, FONTSDIR, CLIFILE);

// The Astro integration. Runs after content validation and the manifest
// boundary, before any page generation. Awaits the child so a hung gate
// fails the build at the enforceable bound.
export function fontCoverageGate() {
  let configRootUrl;
  return {
    name: "wp46-font-coverage-gate",
    hooks: {
      "astro:config:done": function (config) {
        configRootUrl = config.root;
      },
      "astro:build:start": async function () {
        const plan = resolveGatePlan(process.env);
        if (plan.error || plan.mode === null) {
          throw new Error("[wp46-font-coverage-gate] " + (plan.error || "invalid mode"));
        }
        const warns = plan.warnings || [];
        for (const warning of warns) {
          process.stderr.write(
            "[wp46-font-coverage-gate] WARNING: " + String(warning) + String.fromCharCode(10),
          );
        }
        const projectRoot = configRootUrl ? fileURLToPath(configRootUrl) : process.cwd();
        const overrideRoot = process.env.ASTRO_VALIDATE_CONTENT_ROOT;
        const contentDir =
          plan.mode === PVMODE && overrideRoot ? overrideRoot : join(projectRoot, CONTENTDIR);
        const run = await runWithTimeout(
          process.execPath,
          [
            GATE_CLI,
            "--content",
            contentDir,
            "--css",
            join(projectRoot, SRCDIR, STYLESDIR, CSSFILE),
            "--allowlist",
            join(projectRoot, SCRIPTSDIR, FONTSDIR, ALLOWFILE),
            "--mode",
            plan.mode,
          ],
          { timeoutMs: GATE_CHILD_TIMEOUT_MS, cwd: projectRoot },
        );
        if (run.stdout) process.stdout.write(run.stdout);
        if (run.stderr) process.stderr.write(run.stderr);
        if (run.timedOut) {
          throw new Error(
            "[wp46-font-coverage-gate] gate TIMED OUT after " +
              run.elapsedMs +
              "ms; aborting build.",
          );
        }
        if (run.status !== 0) {
          throw new Error(
            "[wp46-font-coverage-gate] authored characters outside the served subset (mode=" +
              plan.mode +
              "); aborting build. Extend the subset or record a reviewed fallback acceptance in scripts/fonts/fallback-accepted.txt.",
          );
        }
      },
    },
  };
}
