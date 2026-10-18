// WP-07 smoke run — the one-fixture end-to-end proof behind `npm run bench:smoke`
// (P1 exit criterion: "benchmark harness can ingest fixture images and produce
// measurements").
//
// Pipeline: integrity guard (BEFORE) → registry verify → one candidate encode
// (F01 primary DSC02071.jpg → sharp jpeg width=640 quality=80) → PSNR/SSIM
// fidelity → 100% crop side-by-side packet → markdown/JSON report → integrity
// guard (AFTER). Any checksum mismatch is a hard failure.
//
// Run: npm run bench:smoke   (output under gitignored bench-output/)
import { join } from "node:path";
import { generateCropPacket } from "./crops.ts";
import { runEncodeCandidate, probeFormatSupport } from "./encode-runner.ts";
import { createFixtureRegistry } from "./fixtures.ts";
import { assertSameSnapshot, snapshotFixtureDir } from "./integrity.ts";
import { measureFidelity } from "./measure.ts";
import { writeReport } from "./report.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const BENCH_OUTPUT_DIR = join(ROOT, "bench-output");

async function main(): Promise<void> {
  const registry = createFixtureRegistry();

  // 1. Integrity guard BEFORE the run (fresh scan; frozen corpus is read-only).
  const before = await snapshotFixtureDir(registry.dir);
  registry.verifyOnDisk();

  // 2. Capability check — record it honestly, never hack around a gap (WP-15
  //    owns the format decision; see scripts/bench/encode-runner.ts AVIF note).
  const avifSupported = await probeFormatSupport("avif");

  // 3. One fixture, one candidate encode, one measurement row.
  const fixture = registry.byRole("F01"); // DSC02071.jpg — manifest §1 primary
  const { row, outputPath } = await runEncodeCandidate(
    fixture.absolutePath,
    fixture.file,
    { format: "jpeg", width: 640, quality: 80 },
    BENCH_OUTPUT_DIR,
  );

  // 4. Fidelity metrics against the decoded source at the same dimensions.
  const fidelity = await measureFidelity(fixture.absolutePath, outputPath, row.width);

  // 5. 100% crop side-by-side packet for human quality review.
  const cropPacket = await generateCropPacket({
    sourceAbsPath: fixture.absolutePath,
    candidateAbsPath: outputPath,
    candidateWidth: row.width,
    outDir: BENCH_OUTPUT_DIR,
    label: `${fixture.file.replace(/\.[^.]+$/, "")}-jpeg-w640-q80`,
  });

  // 6. Evidence packet (markdown + JSON).
  const report = await writeReport(BENCH_OUTPUT_DIR, {
    rows: [{ ...row, psnr: fidelity.psnr, ssim: fidelity.ssim, ssimWindows: fidelity.ssimWindows }],
    notes: `WP-07 smoke. Fixture corpus: ${before.size} JPEGs, integrity verified before/after. AVIF encode capability: ${avifSupported ? "available" : "UNAVAILABLE in this sharp build (recorded; WP-15 decides)"}.`,
    label: "smoke",
  });

  // 7. Integrity guard AFTER the run — hard failure on any drift.
  const after = await snapshotFixtureDir(registry.dir);
  assertSameSnapshot(before, after);

  console.log(JSON.stringify(row));
  console.log(`fidelity: psnr=${fidelity.psnr === null ? "∞" : fidelity.psnr.toFixed(2)}dB ssim=${fidelity.ssim.toFixed(4)} (${fidelity.ssimWindows} windows)`);
  console.log(`candidate: ${outputPath}`);
  console.log(`crops: ${cropPacket.sideBySidePath}`);
  console.log(`report: ${report.markdownPath}`);
  console.log(`integrity: ${before.size} fixtures unchanged`);
}

main().catch((cause: unknown) => {
  console.error(`[bench] smoke FAILED: ${String(cause)}`);
  process.exitCode = 1;
});
