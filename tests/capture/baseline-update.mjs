// Controlled baseline-update workflow (`npm run baseline:update`).
//
// GOVERNANCE (TESTING_AND_VISUAL_REGRESSION.md §8.2): baselines are never
// updated automatically by a test run. This tool IS the controlled workflow:
// an explicitly human-invoked command that copies fresh `npm run capture`
// output into tests/baselines/ and regenerates the per-group governed
// manifests (canonical schema: records under `captures`, one record per
// governed state with state/group/file/bytes/sha256 — verified fail-closed
// by tests/capture/diff.mjs).
//
// It refuses to run unless tests/captures/ contains a COMPLETE fresh capture
// set (every state in tests/capture/states.mjs) so a partial run can never
// silently narrow baseline coverage.
//
// Usage: node tests/capture/baseline-update.mjs [--captures <dir>]
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { CAPTURE_STATES, BASELINE_GROUPS } from "./states.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DEFAULT_CAPTURES = join(ROOT, "tests", "captures");
const DEFAULT_BASELINES = join(ROOT, "tests", "baselines");

function parseArgs(argv) {
  const args = { captures: DEFAULT_CAPTURES, baselines: DEFAULT_BASELINES };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--captures") args.captures = resolve(argv[++i]);
  }
  return args;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function main() {
  const { captures } = parseArgs(process.argv.slice(2));
  const baselines = DEFAULT_BASELINES;

  // Completeness gate: every governed state must have a fresh capture.
  const missing = [];
  for (const state of CAPTURE_STATES) {
    const png = join(captures, state.id, "index.png");
    if (!existsSync(png)) missing.push(`${state.id} (expected ${relative(ROOT, png)})`);
  }
  if (missing.length > 0) {
    console.error(
      `[baseline:update] REFUSED: tests/captures/ is not a complete governed capture set — ` +
        `run \`npm run capture\` first. Missing:\n  ${missing.join("\n  ")}`,
    );
    process.exit(1);
  }

  // The capture run's own manifest must be present and complete (it is the
  // producer of the governed baseline manifest schema).
  const captureManifestPath = join(captures, "manifest.json");
  if (!existsSync(captureManifestPath)) {
    console.error("[baseline:update] REFUSED: tests/captures/manifest.json missing — run `npm run capture`.");
    process.exit(1);
  }
  const captureManifest = JSON.parse(readFileSync(captureManifestPath, "utf8"));
  const captured = new Set((captureManifest.captures ?? []).map((c) => c.state));
  const manifestMissing = CAPTURE_STATES.filter((s) => !captured.has(s.id));
  if (manifestMissing.length > 0) {
    console.error(
      `[baseline:update] REFUSED: capture manifest does not cover every governed state: ` +
        manifestMissing.map((s) => s.id).join(", "),
    );
    process.exit(1);
  }

  // Copy captures -> baselines and regenerate per-group manifests.
  const byGroup = new Map(BASELINE_GROUPS.map((g) => [g, []]));
  let updated = 0;
  for (const state of CAPTURE_STATES) {
    const group = state.baselineGroup;
    const srcStateDir = join(captures, state.id);
    const dstStateDir = join(baselines, group, state.id);
    rmSync(dstStateDir, { recursive: true, force: true });
    mkdirSync(dirname(dstStateDir), { recursive: true });
    for (const entry of readdirSync(srcStateDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".png")) {
        cpSync(join(srcStateDir, entry.name), join(dstStateDir, entry.name));
      }
    }
    const pngPath = join(dstStateDir, "index.png");
    const bytes = readFileSync(pngPath);
    byGroup.get(group).push({
      state: state.id,
      path: state.path,
      group,
      buildMode: captureManifest.captures.find((c) => c.state === state.id)?.buildMode ?? state.group,
      viewport: `${state.viewport === "mobile" ? "390x844" : "1440x900"}`,
      deviceScaleFactor: captureManifest.captures.find((c) => c.state === state.id)?.deviceScaleFactor ?? 1,
      fullPage: state.fullPage ?? false,
      gates: captureManifest.captures.find((c) => c.state === state.id)?.gates ?? {},
      file: `tests/baselines/${group}/${state.id}/index.png`,
      bytes: bytes.byteLength,
      sha256: sha256(bytes),
    });
    updated++;
  }

  const chromiumVersion = captureManifest.chromiumVersion;
  for (const [group, records] of byGroup) {
    if (records.length === 0) continue;
    const manifest = {
      generatedAt: new Date().toISOString(),
      tool: "tests/capture/capture.mjs (copied by tests/capture/baseline-update.mjs)",
      chromiumVersion,
      note:
        "SHA-256 values are file-integrity metadata inside one controlled " +
        "baseline workflow only. They are NOT visual-equivalence proof across " +
        "browsers, operating systems, font rasterizers, or machines " +
        "(TESTING_AND_VISUAL_REGRESSION.md §8.1).",
      captures: records,
    };
    writeFileSync(join(baselines, group, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
    console.log(`[baseline:update] group ${group}: ${records.length} governed baseline record(s)`);
  }
  console.log(`[baseline:update] ${updated}/${CAPTURE_STATES.length} governed baselines updated under ${relative(ROOT, baselines)}`);
  console.log("[baseline:update] Review the diff before committing — this is the APPROVED DESIGN UPDATE path (WP-47 governance), not an automatic process.");
}

main();
