// WP-15 campaign runner — ONE measurement pass of the bounded benchmark
// matrix over the 17-photo core stress set (REAL_PHOTO_FIXTURE_MANIFEST.md §2).
//
// Mechanical scope ONLY: measurements + evidence. No format/width/quality
// decision is made here; D1–D7 remain OPEN pending human visual review of the
// crop packets (docs/implementation/wp15-review/).
//
// Usage:
//   node --experimental-strip-types scripts/bench/campaigns/wp15-run.ts --run 1 [--reduced]
//
// Output (gitignored bench-output/wp15/):
//   results-run<N>.json   { run, reduced, startedAt, avifProbe, rows: Wp15Row[] , integrity }
//
// Reproducibility contract: the FULL matrix runs twice; every row's `bytes`
// must be identical across runs (encodeTimeMs may differ). The comparison is
// done by wp15-aggregate.ts.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import {
  runEncodeCandidate,
  probeFormatSupport,
  type MeasurementRow,
} from "../encode-runner.ts";
import { createFixtureRegistry, FIXTURE_ROLES } from "../fixtures.ts";
import { assertSameSnapshot, snapshotFixtureDir } from "../integrity.ts";
import { measureFidelity } from "../measure.ts";
import {
  CORE17,
  MANIFEST_STATS,
  buildCampaignCandidates,
  isReducedCandidate,
} from "./wp15-matrix.ts";

const ROOT = join(import.meta.dirname, "..", "..", "..");
const OUT_DIR = join(ROOT, "bench-output", "wp15");

export interface Wp15Row {
  purpose: string;
  requestedWidth: number;
  actualWidth: number;
  fixture: string;
  fixtureRoles: string[];
  manifest: { l: number; s: number; c: number; note: string };
  /** Frozen WP-07 measurement row — verbatim, never widened. */
  row: MeasurementRow;
  psnr: number | null;
  ssim: number;
  ssimWindows: number;
}

function parseArgs(): { run: number; reduced: boolean } {
  const args = process.argv.slice(2);
  const runIdx = args.indexOf("--run");
  const run = runIdx >= 0 ? Number(args[runIdx + 1]) : NaN;
  if (run !== 1 && run !== 2) {
    throw new Error("[wp15] usage: wp15-run.ts --run 1|2 [--reduced]");
  }
  return { run, reduced: args.includes("--reduced") };
}

async function main(): Promise<void> {
  const { run, reduced } = parseArgs();
  const registry = createFixtureRegistry();
  registry.verifyOnDisk();

  // Integrity guard BEFORE (frozen corpus is read-only).
  const before = await snapshotFixtureDir(registry.dir);

  // Capability probe — recorded honestly, never hacked around.
  const avifProbe = await probeFormatSupport("avif");
  if (!avifProbe) {
    throw new Error("[wp15] AVIF encode capability UNAVAILABLE in this sharp build — campaign cannot run honestly without it");
  }

  const candidates = buildCampaignCandidates();
  const rolesByFile = new Map<string, string[]>();
  for (const role of FIXTURE_ROLES) {
    const list = rolesByFile.get(role.file) ?? [];
    list.push(role.role);
    rolesByFile.set(role.file, list);
  }

  const rows: Wp15Row[] = [];
  const sourceDims: Record<string, { width: number; height: number }> = {};
  const skippedReduced: number[] = [];
  const candidatesDir = join(OUT_DIR, `candidates-run${run}`);

  // Deterministic order: fixture → purpose → width → format → quality.
  const totalPlanned = CORE17.length * candidates.length + CORE17.length; // + progressive probes
  let done = 0;
  const startedAt = new Date().toISOString();
  const t0 = process.hrtime.bigint();

  for (const fixture of CORE17) {
    const sourceAbs = join(registry.dir, fixture);
    const meta = await sharp(sourceAbs).metadata();
    sourceDims[fixture] = { width: meta.width ?? 0, height: meta.height ?? 0 };
    const manifest = MANIFEST_STATS[fixture];
    if (!manifest) throw new Error(`[wp15] fixture ${fixture} missing from MANIFEST_STATS`);
    const fixtureRoles = rolesByFile.get(fixture) ?? [];

    for (const candidate of candidates) {
      if (reduced && isReducedCandidate(candidate, fixture)) {
        skippedReduced.push(1);
        continue;
      }
      const { row, outputPath } = await runEncodeCandidate(
        sourceAbs,
        fixture,
        { format: candidate.format, width: candidate.requestedWidth, quality: candidate.quality },
        candidatesDir,
      );
      const fidelity = await measureFidelity(sourceAbs, outputPath, row.width);
      rows.push({
        purpose: candidate.purpose,
        requestedWidth: candidate.requestedWidth,
        actualWidth: row.width,
        fixture,
        fixtureRoles,
        manifest,
        row,
        psnr: fidelity.psnr,
        ssim: fidelity.ssim,
        ssimWindows: fidelity.ssimWindows,
      });
      done += 1;
      if (done % 100 === 0) {
        const elapsedMin = Number(process.hrtime.bigint() - t0) / 1e9 / 60;
        console.error(`[wp15] run ${run}: ${done}/${totalPlanned} rows (${elapsedMin.toFixed(1)} min)`);
      }
    }

    // Progressive-JPEG probe (D7 stays OPEN — byte/time deltas recorded, no
    // visual judgment): gallery_display 1280, q75, progressive=true.
    const { row: pRow, outputPath: pPath } = await runEncodeCandidate(
      sourceAbs,
      fixture,
      { format: "jpeg", width: 1280, quality: 75, progressive: true },
      candidatesDir,
    );
    const pFid = await measureFidelity(sourceAbs, pPath, pRow.width);
    rows.push({
      purpose: "progressive_probe",
      requestedWidth: 1280,
      actualWidth: pRow.width,
      fixture,
      fixtureRoles,
      manifest,
      row: pRow,
      psnr: pFid.psnr,
      ssim: pFid.ssim,
      ssimWindows: pFid.ssimWindows,
    });
    done += 1;
  }

  const after = await snapshotFixtureDir(registry.dir);
  assertSameSnapshot(before, after);

  const payload = {
    run,
    reduced,
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMin: Number(process.hrtime.bigint() - t0) / 1e9 / 60,
    avifProbe,
    fixtureCount: CORE17.length,
    rowCount: rows.length,
    plannedRowCount: totalPlanned,
    skippedByReduction: reduced ? skippedReduced.length : 0,
    sourceDims,
    integrity: `${before.size} fixtures unchanged (before==after SHA-256)`,
    rows,
  };
  const outPath = join(OUT_DIR, `results-run${run}.json`);
  writeFileSync(outPath, `${JSON.stringify(payload, null, 1)}\n`, "utf8");
  console.log(`[wp15] run ${run} complete: ${rows.length} rows in ${payload.durationMin.toFixed(1)} min → ${outPath}`);
  console.log(`[wp15] integrity: ${payload.integrity}; avifProbe=${avifProbe}; reduced=${reduced}`);
}

main().catch((cause: unknown) => {
  console.error(`[wp15] campaign run FAILED: ${String(cause)}`);
  process.exitCode = 1;
});
