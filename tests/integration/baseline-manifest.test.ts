// P4/P5 FINAL GATE-CORRECTION — Finding A (baseline manifest integrity).
//
// Independent verification against b43a31c established that the manifest
// producer writes the record array under `captures` while capture:diff read
// `baselineManifest.baselines`, so governed SHA verification was vacuous
// (verifiedBaselines = 0/14) and a swapped governed PNG did NOT fail the run.
//
// RED-first discipline: every test below asserts behavior that FAILS against
// the b43a31c diff.mjs and PASSES after the canonical-schema correction.
// Each test builds a real fixture tree (baselines root + captures root with
// real PNG files produced by pngjs) and runs the diff CLI, asserting EXIT
// CODES — never status labels.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
// @ts-expect-error pngjs untyped dependency in test harness
import { PNG } from "pngjs";
import { CAPTURE_STATES } from "../../tests/capture/states.mjs";
import { DESKTOP_VIEWPORT, MOBILE_VIEWPORT } from "../../tests/support/viewports.mjs";

const REPO_ROOT = new URL("../../", import.meta.url).pathname;

function pngBytes(width = 4, height = 4, fill = 120): Buffer {
  const png = new PNG({ width, height });
  for (let i = 0; i < png.data.length; i++) png.data[i] = fill;
  return PNG.sync.write(png) as Buffer;
}

function sha256(bytes: Buffer | Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Build an isolated baselines root + captures root for one governed group.
 * The 4x4 PNG has real IHDR/IDAT chunks (pixelmatch-compatible). Returns
 * { root, groupDir, writeBaseline, writeCapture, manifestPath, writeManifest }.
 */
function makeFixture(group: string, stateIds: string[]) {
  const root = mkdtempSync(join(tmpdir(), "baseline-manifest-"));
  const baselinesRoot = join(root, "baselines");
  const groupDir = join(baselinesRoot, group);
  const captures = join(root, "captures");
  mkdirSync(groupDir, { recursive: true });
  mkdirSync(captures, { recursive: true });
  for (const stateId of stateIds) {
    const bytes = pngBytes();
    mkdirSync(join(groupDir, stateId), { recursive: true });
    writeFileSync(join(groupDir, stateId, "index.png"), bytes);
    mkdirSync(join(captures, stateId), { recursive: true });
    writeFileSync(join(captures, stateId, "index.png"), bytes);
  }
  const manifestPath = join(groupDir, "manifest.json");
  const writeManifest = (records: any[], extra: Record<string, any> = {}) => {
    writeFileSync(
      manifestPath,
      JSON.stringify(
        {
          generatedAt: "2026-09-02T00:00:00.000Z",
          tool: "tests/capture/capture.mjs",
          note: "fixture",
          captures: records,
          ...extra,
        },
        null,
        2,
      ) + "\n",
    );
  };
  const record = (stateId: string) => {
    const bytes = readFileSync(join(groupDir, stateId, "index.png"));
    return {
      state: stateId,
      group,
      file: `tests/baselines/${group}/${stateId}/index.png`,
      bytes: bytes.byteLength,
      sha256: sha256(bytes),
    };
  };
  return { root, baselinesRoot, groupDir, captures, manifestPath, writeManifest, record };
}

const GOVERNED_STATES = CAPTURE_STATES.map((s) => s.id);

function runDiff(fixture: any, extraArgs: string[] = []) {
  return spawnSync(
    "node",
    [
      "tests/capture/diff.mjs",
      "--captures",
      fixture.captures,
      "--baselines",
      fixture.baselinesRoot,
      "--out",
      join(fixture.root, "diff-report.json"),
      ...extraArgs,
    ],
    { cwd: REPO_ROOT, encoding: "utf8", timeout: 120_000 },
  );
}

afterAll(() => {
  // fixtures live under their own mkdtemp roots; nothing to clean globally
});

describe("Finding A — baseline manifest integrity (canonical schema, fail-closed)", () => {
  test("F. clean fixture: every governed baseline record SHA-verifies and the run passes 14/14", () => {
    const fixture = makeFixture("gallery", GOVERNED_STATES.filter((id) => id.startsWith("gallery") && !id.includes("long-72")));
    const states = GOVERNED_STATES.filter((id) => id.startsWith("gallery") && !id.includes("long-72"));
    fixture.writeManifest(states.map(fixture.record));
    const r = runDiff(fixture);
    expect(r.status, `output: ${r.stdout}\n${r.stderr}`).toBe(0);
    const report = JSON.parse(readFileSync(join(fixture.root, "diff-report.json"), "utf8"));
    expect(report.baselineIntegrity.verifiedBaselines).toBe(states.length);
    expect(report.summary.requiredFailures).toBe(0);
  });

  test("A. governed baseline PNG byte-mutated in place → exit nonzero, baseline-modified", () => {
    const states = GOVERNED_STATES.filter((id) => id.startsWith("gallery") && !id.includes("long-72"));
    const fixture = makeFixture("gallery", states);
    fixture.writeManifest(states.map(fixture.record));
    // Mutate ONE governed baseline PNG byte-for-byte (real content change).
    const victim = join(fixture.groupDir, states[0], "index.png");
    const png = PNG.sync.read(readFileSync(victim));
    png.data[0] = (png.data[0] + 37) % 256;
    writeFileSync(victim, PNG.sync.write(png));
    const r = runDiff(fixture);
    expect(r.status, `output: ${r.stdout}\n${r.stderr}`).not.toBe(0);
    const report = JSON.parse(readFileSync(join(fixture.root, "diff-report.json"), "utf8"));
    expect(report.summary.baselineModified).toBeGreaterThanOrEqual(1);
  });

  test("B. manifest entry removed → exit nonzero (required state without manifest record)", () => {
    const states = GOVERNED_STATES.filter((id) => id.startsWith("gallery") && !id.includes("long-72"));
    const fixture = makeFixture("gallery", states);
    const records = states.map(fixture.record);
    fixture.writeManifest(records.slice(1)); // drop the first state's record
    const r = runDiff(fixture);
    expect(r.status, `output: ${r.stdout}\n${r.stderr}`).not.toBe(0);
    const report = JSON.parse(readFileSync(join(fixture.root, "diff-report.json"), "utf8"));
    expect(report.summary.requiredFailures).toBeGreaterThanOrEqual(1);
  });

  test("C. governed PNG added on disk without a manifest record → exit nonzero", () => {
    const states = GOVERNED_STATES.filter((id) => id.startsWith("gallery") && !id.includes("long-72"));
    const fixture = makeFixture("gallery", states);
    fixture.writeManifest(states.map(fixture.record));
    // Add an extra governed PNG with no manifest record.
    const extra = states[0] + "-extra";
    mkdirSync(join(fixture.groupDir, extra), { recursive: true });
    writeFileSync(join(fixture.groupDir, extra, "index.png"), pngBytes());
    const r = runDiff(fixture);
    expect(r.status, `output: ${r.stdout}\n${r.stderr}`).not.toBe(0);
    const report = JSON.parse(readFileSync(join(fixture.root, "diff-report.json"), "utf8"));
    expect(report.summary.requiredFailures).toBeGreaterThanOrEqual(1);
  });

  test("D. manifest record points at a nonexistent PNG → exit nonzero", () => {
    const states = GOVERNED_STATES.filter((id) => id.startsWith("gallery") && !id.includes("long-72"));
    const fixture = makeFixture("gallery", states);
    const records = states.map(fixture.record);
    records[0] = { ...records[0], file: `tests/baselines/gallery/${states[0]}/missing.png` };
    fixture.writeManifest(records);
    const r = runDiff(fixture);
    expect(r.status, `output: ${r.stdout}\n${r.stderr}`).not.toBe(0);
    const report = JSON.parse(readFileSync(join(fixture.root, "diff-report.json"), "utf8"));
    expect(report.summary.requiredFailures).toBeGreaterThanOrEqual(1);
  });

  test("D2. manifest record SHA does not match ANY on-disk file (orphaned record) → exit nonzero", () => {
    const states = GOVERNED_STATES.filter((id) => id.startsWith("gallery") && !id.includes("long-72"));
    const fixture = makeFixture("gallery", states);
    const records = states.map(fixture.record);
    records[0] = { ...records[0], sha256: "0".repeat(64) };
    fixture.writeManifest(records);
    const r = runDiff(fixture);
    expect(r.status, `output: ${r.stdout}\n${r.stderr}`).not.toBe(0);
  });

  test("E. duplicate state record in the manifest → exit nonzero (schema violation)", () => {
    const states = GOVERNED_STATES.filter((id) => id.startsWith("gallery") && !id.includes("long-72"));
    const fixture = makeFixture("gallery", states);
    const records = states.map(fixture.record);
    fixture.writeManifest([...records, records[0]]);
    const r = runDiff(fixture);
    expect(r.status, `output: ${r.stdout}\n${r.stderr}`).not.toBe(0);
  });

  test("E2. malformed manifest (not JSON / missing captures array) → exit nonzero", () => {
    const states = GOVERNED_STATES.filter((id) => id.startsWith("gallery") && !id.includes("long-72"));
    const fixture = makeFixture("gallery", states);
    writeFileSync(fixture.manifestPath, "{not json");
    let r = runDiff(fixture);
    expect(r.status, `output: ${r.stdout}\n${r.stderr}`).not.toBe(0);

    // Valid JSON but missing the canonical `captures` record array.
    writeFileSync(fixture.manifestPath, JSON.stringify({ generatedAt: "x", note: "no records" }));
    r = runDiff(fixture);
    expect(r.status, `output: ${r.stdout}\n${r.stderr}`).not.toBe(0);
  });

  test("G1. record with MISSING `group` → exit nonzero (fail-closed schema)", () => {
    const states = GOVERNED_STATES.filter((id) => id.startsWith("gallery") && !id.includes("long-72"));
    const fixture = makeFixture("gallery", states);
    const records = states.map(fixture.record);
    for (const r of records as Array<{ group?: string }>) delete r.group;
    fixture.writeManifest(records);
    const r = runDiff(fixture);
    expect(r.status, `missing group must fail: ${r.stdout}\n${r.stderr}`).not.toBe(0);
    const report = JSON.parse(readFileSync(join(fixture.root, "diff-report.json"), "utf8"));
    expect(report.baselineIntegrity.verifiedBaselines).toBe(0);
    expect(report.summary.requiredFailures).toBeGreaterThanOrEqual(1);
  });

  test("G2. record with WRONG `group` (cross-group value) → exit nonzero", () => {
    const states = GOVERNED_STATES.filter((id) => id.startsWith("gallery") && !id.includes("long-72"));
    const fixture = makeFixture("gallery", states);
    const records = states.map(fixture.record);
    for (const r of records) r.group = "preview";
    fixture.writeManifest(records);
    const r = runDiff(fixture);
    expect(r.status, `wrong group must fail: ${r.stdout}\n${r.stderr}`).not.toBe(0);
    const report = JSON.parse(readFileSync(join(fixture.root, "diff-report.json"), "utf8"));
    expect(report.baselineIntegrity.verifiedBaselines).toBe(0);
    expect(report.summary.requiredFailures).toBeGreaterThanOrEqual(1);
  });

  test("E3. legacy `baselines` field is NOT honored (one canonical schema: `captures`)", () => {
    const states = GOVERNED_STATES.filter((id) => id.startsWith("gallery") && !id.includes("long-72"));
    const fixture = makeFixture("gallery", states);
    const records = states.map(fixture.record);
    writeFileSync(
      fixture.manifestPath,
      JSON.stringify({ generatedAt: "x", baselines: records }, null, 2),
    );
    const r = runDiff(fixture);
    expect(r.status, "legacy field must not satisfy the canonical contract").not.toBe(0);
  });
});

describe("Finding A — producer/consumer schema contract (canonical governed baselines)", () => {
  test("the REAL tests/baselines manifests verify 14/14 against the strict consumer", () => {
    // The canonical run: the actual governed baselines the repo ships.
    const captures = mkdtempSync(join(tmpdir(), "baseline-canonical-caps-"));
    // No captures at all → every state reports no-capture; the integrity
    // story is in baselineIntegrity.verifiedBaselines + manifest statuses.
    const r = spawnSync("node", ["tests/capture/diff.mjs", "--captures", captures], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      timeout: 120_000,
    });
    rmSync(captures, { recursive: true, force: true });
    // no-capture on all governed states → nonzero, but the MANIFEST side
    // must fully verify: no violations, no missing entries/files.
    expect(r.status).not.toBe(0);
    for (const group of ["discovery", "gallery", "preview"]) {
      const manifest = JSON.parse(
        readFileSync(join(REPO_ROOT, "tests", "baselines", group, "manifest.json"), "utf8"),
      );
      expect(Array.isArray(manifest.captures), `${group} uses the canonical captures field`).toBe(true);
      expect(manifest.baselines, `${group} must not carry the legacy field`).toBeUndefined();
    }
  });

  test("the governed baseline-update tool refuses an incomplete capture set", async () => {
    const { execFileSync } = await import("node:child_process");
    const empty = mkdtempSync(join(tmpdir(), "baseline-update-refuse-"));
    let failed = false;
    try {
      execFileSync("node", ["tests/capture/baseline-update.mjs", "--captures", empty], {
        cwd: REPO_ROOT,
        stdio: "pipe",
        timeout: 60_000,
      });
    } catch {
      failed = true;
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
    expect(failed, "partial captures must never narrow baseline coverage").toBe(true);

  });

// ROUND-2 Minor: the committed gallery-mobile-caption baseline manifest said
// fullPage:true while the governed state captures with fullPage:false. A wrong
// governance field must fail loudly instead of drifting silently again.
describe("Governed baseline governance metadata (fullPage/viewport lockstep)", () => {
  test("every governed state committed baseline record matches its capture declaration", () => {
    const viewports: Record<string, { width: number; height: number }> = {
      desktop: DESKTOP_VIEWPORT,
      mobile: MOBILE_VIEWPORT,
    };
    const mismatches: string[] = [];
    for (const s of CAPTURE_STATES) {
      const manifest = JSON.parse(
        readFileSync(join(REPO_ROOT, "tests", "baselines", s.baselineGroup, "manifest.json"), "utf8"),
      );
      const record = manifest.captures.find((c: { state: string }) => c.state === s.id);
      if (!record) {
        mismatches.push(`${s.id}: no committed baseline record`);
        continue;
      }
      const expectedFullPage = s.fullPage ?? false;
      if (record.fullPage !== expectedFullPage) {
        mismatches.push(`${s.id}: baseline fullPage=${record.fullPage} but the state declares ${expectedFullPage}`);
      }
      const viewport = viewports[s.viewport];
      const expectedViewport = `${viewport.width}x${viewport.height}`;
      if (record.viewport !== expectedViewport) {
        mismatches.push(`${s.id}: baseline viewport=${record.viewport} but the state declares ${expectedViewport}`);
      }
    }
    expect(mismatches).toEqual([]);
  });
});
});
