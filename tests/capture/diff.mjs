// WP-06 pixel-diff runner (`npm run capture:diff`).
//
// Compares current captures (tests/captures/ by default) against approved
// baselines with pixelmatch at a configurable threshold and writes a JSON
// report. Difference adjudication is a human process (WP-47,
// TESTING_AND_VISUAL_REGRESSION.md §8.2) — pixel differences above threshold
// do NOT auto-fail.
//
// IMP-05 (final targeted correction) — REQUIRED GOVERNED STATE enforcement:
// every state in tests/capture/states.mjs is a governed baseline state.
// For a required governed state, ANY of the following FAILS the run
// (exit nonzero) — silence is never approval:
//   - "no-baseline"    the governed state has no approved baseline;
//   - "no-capture"     the governed state has a baseline but no fresh capture;
//   - "baseline-modified" the baseline file fails its governed SHA-256
//                      integrity manifest.
// Unmanaged directories (not in states.mjs) are reported informationally.
//
// Baselines are grouped (tests/baselines/<group>/<state-id>/index.png with a
// per-group manifest.json — see tests/baselines/README.md). By default every
// governed baseline group is diffed against tests/captures/. A single group
// can be diffed via --group <name>; --captures/--baselines still support
// ad-hoc roots (a baselines root that directly contains state dirs).
//
// Integrity hook (FINAL gate-correctness correction): each governed group's
// manifest.json (produced by `npm run capture`, which writes the record array
// under `captures`) is the ONE canonical schema — strictly validated and
// fully verified before any comparison. §8.1 allows SHA-256 as file-integrity
// check inside one controlled workflow only. The manifest must represent every
// governed baseline state: for each required state exactly one record with
// state id, baseline group, relative PNG path and SHA-256. Fail-closed
// (exit nonzero) on ANY of:
//   - manifest missing / malformed / schema violation;
//   - a required governed state with no manifest entry;
//   - a manifest record whose PNG file does not exist;
//   - a governed baseline PNG on disk but absent from the manifest;
//   - duplicate state/path records;
//   - recorded SHA-256 != actual baseline PNG SHA-256 ("baseline-modified");
// in addition to the required-state gates (no-baseline / no-capture). A run
// that verifies fewer than ALL governed baseline records is never a PASS.
//
// Usage:
//   node tests/capture/diff.mjs [--captures <dir>] [--baselines <dir>]
//                               [--group <name>] [--threshold <0..1>] [--out <report.json>]
// Defaults: captures=tests/captures baselines=tests/baselines group=all
//           threshold=0.1 out=<captures-dir>/diff-report.json
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { CAPTURE_STATES, BASELINE_GROUPS } from "./states.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

function parseArgs(argv) {
  const args = {
    captures: join(ROOT, "tests", "captures"),
    baselines: join(ROOT, "tests", "baselines"),
    group: "all",
    threshold: 0.1,
    out: undefined,
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--captures") args.captures = resolve(argv[++i]);
    else if (flag === "--baselines") args.baselines = resolve(argv[++i]);
    else if (flag === "--group") args.group = argv[++i];
    else if (flag === "--threshold") args.threshold = Number(argv[++i]);
    else if (flag === "--out") args.out = resolve(argv[++i]);
  }
  if (!Number.isFinite(args.threshold) || args.threshold < 0 || args.threshold > 1) {
    throw new Error(`--threshold must be a number in [0, 1], got: ${args.threshold}`);
  }
  if (args.group !== "all" && !BASELINE_GROUPS.includes(args.group)) {
    throw new Error(`--group must be all|${BASELINE_GROUPS.join("|")}, got: ${args.group}`);
  }
  if (!args.out) args.out = join(args.captures, "diff-report.json");
  return args;
}

function exists(path) {
  return existsSync(path);
}

/** List state directories under a captures/baselines root. */
function listStateDirs(root) {
  if (!exists(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

/** List PNG files (relative to the state dir) under one state directory. */
function listPngs(stateDir) {
  if (!exists(stateDir)) return [];
  return readdirSync(stateDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".png"))
    .map((e) => e.name)
    .sort();
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

// ---------------------------------------------------------------------------
// Governed baseline manifest — ONE canonical schema, strictly validated.
//
// Producer: `npm run capture` (tests/capture/capture.mjs) writes the record
// array under `captures`. Consumer: this file. No legacy alias (the former
// consumer-only `baselines` field is a schema violation, not a fallback).
// Record contract: { state, group, file (repo-relative PNG path), sha256 }.
// ---------------------------------------------------------------------------
function readAndValidateManifest(group, baselinesDir, stateIds) {
  const manifestPath = join(baselinesDir, "manifest.json");
  if (!exists(manifestPath)) {
    return { violation: `missing manifest.json for governed baseline group "${group}" (${manifestPath})` };
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    return { violation: `malformed manifest JSON for group "${group}": ${error.message}` };
  }
  if (!Array.isArray(parsed.captures)) {
    return {
      violation:
        `manifest schema violation for group "${group}": the canonical record ` +
        `array field is "captures" (array); found ${parsed.captures === undefined ? "no field" : typeof parsed.captures}.`,
    };
  }
  const records = parsed.captures;
  const seen = new Map();
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const at = `captures[${i}]`;
    if (r === null || typeof r !== "object" || Array.isArray(r)) {
      return { violation: `manifest schema violation for group "${group}": ${at} is not a record object` };
    }
    for (const field of ["state", "group", "file", "sha256"]) {
      if (typeof r[field] !== "string" || r[field].length === 0) {
        return { violation: `manifest schema violation for group "${group}": ${at}.${field} must be a non-empty string` };
      }
    }
    // IMP-01: the record's group must equal the governed baseline group being
    // verified — a missing or cross-group value is a schema violation, never
    // a silently accepted record.
    if (r.group !== group) {
      return { violation: `manifest schema violation for group "${group}": ${at}.group must equal ${JSON.stringify(group)}, got ${JSON.stringify(r.group)}` };
    }
    if (!/^[0-9a-f]{64}$/.test(r.sha256)) {
      return { violation: `manifest schema violation for group "${group}": ${at}.sha256 is not a hex SHA-256` };
    }
    const key = `${r.state}\u0000${r.file}`;
    if (seen.has(key)) {
      return { violation: `manifest schema violation for group "${group}": duplicate record for state ${r.state} file ${r.file}` };
    }
    seen.set(key, r);
  }
  // Every required governed state of this group must be represented.
  for (const stateId of stateIds) {
    if (![...seen.values()].some((r) => r.state === stateId)) {
      return { violation: `required governed state "${stateId}" has no manifest record in group "${group}"` };
    }
  }
  return { records: [...seen.values()], manifestPath };
}

/** Determine the diff units. Multi-group mode: tests/baselines/<group>/…
 * with a per-group manifest. Single-root mode (ad-hoc --baselines): the
 * given root directly contains state dirs. Returns
 * [{ group, baselinesDir, stateIds }]. */
function diffUnits(baselinesRoot, group) {
  const groupNames = group === "all" ? BASELINE_GROUPS : [group];
  const direct = listStateDirs(baselinesRoot);
  const isGroupLayout = direct.length > 0 && direct.every((d) => BASELINE_GROUPS.includes(d));
  if (isGroupLayout) {
    return groupNames
      .filter((g) => exists(join(baselinesRoot, g)))
      .map((g) => ({
        group: g,
        baselinesDir: join(baselinesRoot, g),
        // Required governed states of this baseline group.
        stateIds: CAPTURE_STATES.filter((s) => s.baselineGroup === g).map((s) => s.id),
      }));
  }
  // Ad-hoc single root: every governed state is required against it.
  return [{ group: "(root)", baselinesDir: baselinesRoot, stateIds: CAPTURE_STATES.map((s) => s.id) }];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { captures, baselines, threshold, out } = args;

  const results = [];
  let verifiedBaselines = 0;
  let requiredFailures = 0;

  for (const unit of diffUnits(baselines, args.group)) {
    // Governed baseline integrity manifest for this group — canonical schema,
    // strict validation, fail-closed. No manifest, a malformed manifest, or
    // a manifest that does not cover every required governed state fails the
    // run BEFORE any pixel comparison happens.
    const manifestCheck = readAndValidateManifest(unit.group, unit.baselinesDir, unit.stateIds);
    if (manifestCheck.violation) {
      requiredFailures++;
      results.push({
        state: "(manifest)",
        group: unit.group,
        file: "manifest.json",
        status: "manifest-violation",
        required: true,
        detail: manifestCheck.violation,
      });
      console.error(`[capture:diff] manifest violation in group ${unit.group}: ${manifestCheck.violation}`);
      continue;
    }
    const manifestByState = new Map();
    for (const r of manifestCheck.records) {
      // One record per (state, file); the canonical layout is index.png.
      if (!manifestByState.has(r.state) || manifestByState.get(r.state).file.endsWith("index.png") === false) {
        manifestByState.set(r.state, r);
      }
    }
    const baselineManifest = { records: manifestCheck.records, byState: manifestByState };

    // Governed baseline files on disk that are absent from the manifest:
    // an untracked governed baseline is a governance violation (the manifest
    // must represent every governed baseline state).
    for (const stateDirName of listStateDirs(unit.baselinesDir)) {
      if (stateDirName === "manifest.json") continue;
      const manifestStates = new Set(baselineManifest.records.map((r) => r.state));
      if (!manifestStates.has(stateDirName)) {
        requiredFailures++;
        results.push({
          state: stateDirName,
          group: unit.group,
          file: "index.png",
          status: "manifest-missing-entry",
          required: true,
          detail: `governed baseline directory exists but has no manifest record`,
        });
      }
    }

    // Verify EVERY manifest record: file existence + SHA-256 (all governed
    // baseline states, not only those with a fresh capture). Record paths
    // are repo-relative (canonical producer). Ad-hoc roots (fixture tests)
    // mirror the governed layout: a "tests/baselines/<group>/…" record
    // resolves inside the ad-hoc baselines root.
    const resolveRecordPath = (file) => {
      const prefix = "tests/baselines/";
      if (file.startsWith(prefix)) {
        // Ad-hoc root (fixture tests) mirrors the governed layout first;
        // the canonical run resolves the same relative path to ROOT.
        const mirrored = resolve(unit.baselinesDir, "..", file.slice(prefix.length));
        if (exists(mirrored)) return mirrored;
      }
      return resolve(ROOT, file);
    };
    for (const record of baselineManifest.records) {
      const recordPath = resolveRecordPath(record.file);
      if (!exists(recordPath)) {
        requiredFailures++;
        results.push({
          state: record.state,
          group: unit.group,
          file: record.file,
          status: "manifest-file-missing",
          required: true,
          detail: `manifest record points at a nonexistent baseline PNG: ${record.file}`,
        });
        continue;
      }
      const actual = sha256(readFileSync(recordPath));
      if (actual !== record.sha256) {
        requiredFailures++;
        results.push({
          state: record.state,
          group: unit.group,
          file: record.file,
          status: "baseline-modified",
          required: true,
          detail: `baseline sha256 ${actual} does not match governed manifest ${record.sha256}`,
        });
        continue;
      }
      verifiedBaselines++;
    }

    // REQUIRED GOVERNED STATES first: silence about a missing baseline or a
    // missing capture is never success.
    for (const stateId of unit.stateIds) {
      const baselinePath = join(unit.baselinesDir, stateId);
      const capturePath = join(captures, stateId);
      if (!exists(baselinePath)) {
        requiredFailures++;
        results.push({ state: stateId, group: unit.group, file: "index.png", status: "no-baseline", required: true });
        continue;
      }
      if (!exists(capturePath)) {
        requiredFailures++;
        results.push({ state: stateId, group: unit.group, file: "index.png", status: "no-capture", required: true });
        continue;
      }
    }

    // Pixel comparison — SCOPED TO THIS GROUP: the group's required states
    // plus any unmanaged extra dirs inside the group's baseline dir. States
    // belonging to OTHER groups are compared by their own unit; comparing
    // them here would fabricate cross-group "no-baseline" noise.
    const baselineStates = listStateDirs(unit.baselinesDir);
    const states = [...new Set([...unit.stateIds, ...baselineStates])].sort();

    for (const state of states) {
      const captureStateDir = join(captures, state);
      const baselineStateDir = join(unit.baselinesDir, state);
      const captureFiles = listPngs(captureStateDir);
      const baselineFiles = listPngs(baselineStateDir);
      const files = [...new Set([...captureFiles, ...baselineFiles])].sort();
      const governed = unit.stateIds.includes(state);

      for (const file of files) {
        const entry = { state, group: unit.group, file, required: governed };
        const capturePath = join(captureStateDir, file);
        const baselinePath = join(baselineStateDir, file);

        if (!exists(baselinePath)) {
          if (!governed) results.push({ ...entry, status: "no-baseline" });
          continue; // governed no-baseline already recorded above
        }
        if (!exists(capturePath)) {
          if (!governed) results.push({ ...entry, status: "no-capture" });
          continue; // governed no-capture already recorded above
        }

        const baselineBytes = readFileSync(baselinePath);
        // The full-manifest SHA verification (including this file) already
        // ran above; a baseline-modified record has already failed the run.
        // Here we only skip double-reporting: if this state/file was flagged
        // baseline-modified, do not pixel-compare a tampered baseline.
        const flagged = results.some(
          (r) => r.state === state && r.file === file && r.status === "baseline-modified",
        );
        if (flagged) continue;
        const manifestEntry = baselineManifest.byState.get(state);
        if (!manifestEntry) {
          // Governed state without a manifest record: already failed above
          // (manifest-missing-entry). Never pixel-compare an untracked
          // baseline — silence is never approval.
          if (governed) continue;
        }

        const baselinePng = PNG.sync.read(baselineBytes);
        const capturePng = PNG.sync.read(readFileSync(capturePath));
        if (baselinePng.width !== capturePng.width || baselinePng.height !== capturePng.height) {
          results.push({
            ...entry,
            status: "size-mismatch",
            baseline: { width: baselinePng.width, height: baselinePng.height },
            capture: { width: capturePng.width, height: capturePng.height },
          });
          continue;
        }

        const { width, height } = baselinePng;
        const diff = new PNG({ width, height });
        const diffPixels = pixelmatch(
          new Uint8ClampedArray(capturePng.data),
          new Uint8ClampedArray(baselinePng.data),
          new Uint8ClampedArray(diff.data),
          width,
          height,
          { threshold },
        );
        const totalPixels = width * height;
        const status = diffPixels === 0 ? "identical" : "diff";
        if (diffPixels > 0) {
          const diffDir = join(dirname(out), "diff-images", state);
          mkdirSync(diffDir, { recursive: true });
          writeFileSync(join(diffDir, file), PNG.sync.write(diff));
        }
        results.push({
          ...entry,
          status,
          diffPixels,
          totalPixels,
          diffRatio: Number((diffPixels / totalPixels).toFixed(6)),
          threshold,
        });
      }
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    capturesDir: relative(ROOT, captures) || captures,
    baselinesDir: relative(ROOT, baselines) || baselines,
    group: args.group,
    threshold,
    informationalOnly:
      "Pixel differences do not gate. Difference adjudication " +
      "(IMPLEMENTATION DRIFT vs APPROVED DESIGN UPDATE) is owned by WP-47 " +
      "(TESTING_AND_VISUAL_REGRESSION.md §8.2). REQUIRED GOVERNED STATE " +
      "failures (no-baseline / no-capture / baseline-modified on a state in " +
      "tests/capture/states.mjs) DO fail this command (IMP-05).",
    baselineIntegrity: {
      // Canonical-schema manifest verification: every governed baseline
      // record found, its file present, and its SHA-256 matching on disk.
      verifiedBaselines,
      manifestViolations: results.filter((r) => r.status === "manifest-violation").length,
      manifestMissingEntries: results.filter((r) => r.status === "manifest-missing-entry").length,
      manifestFilesMissing: results.filter((r) => r.status === "manifest-file-missing").length,
    },
    summary: {
      states: new Set(results.map((r) => r.state)).size,
      identical: results.filter((r) => r.status === "identical").length,
      diff: results.filter((r) => r.status === "diff").length,
      noBaseline: results.filter((r) => r.status === "no-baseline").length,
      noCapture: results.filter((r) => r.status === "no-capture").length,
      sizeMismatch: results.filter((r) => r.status === "size-mismatch").length,
      baselineModified: results.filter((r) => r.status === "baseline-modified").length,
      requiredFailures,
    },
    results,
  };

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(report, null, 2) + "\n");

  console.log(`[capture:diff] threshold=${threshold}`);
  for (const r of results) {
    const detail =
      r.status === "diff"
        ? ` ${r.diffPixels}/${r.totalPixels} px (${(r.diffRatio * 100).toFixed(3)}%)`
        : "";
    console.log(`  ${r.status.padEnd(15)} ${r.state}/${r.file}${detail}`);
  }
  console.log(`[capture:diff] report -> ${out}`);
  if (requiredFailures > 0) {
    console.error(
      `[capture:diff] FAILED: ${requiredFailures} required governed state violation(s) ` +
        `(no-baseline / no-capture / baseline-modified). Governed baselines are never ` +
        `auto-approved — see tests/baselines/README.md.`,
    );
    process.exit(1);
  }
  console.log("[capture:diff] PASS (pixel differences, if any, await WP-47 adjudication)");
}

main().catch((error) => {
  console.error(`[capture:diff] FAILED: ${error?.message ?? error}`);
  process.exit(1);
});
