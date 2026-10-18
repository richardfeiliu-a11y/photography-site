// WP-15 aggregate + reproducibility verification — consumes the TWO result
// passes written by wp15-run.ts and produces:
//
//   bench-output/wp15/summary.json     machine-readable aggregates (all tables)
//   bench-output/wp15/report.md        human-readable pivot tables
//
// Checks (hard-fail exit 1 on violation):
//   1. Both passes present, same row count, same row keys.
//   2. REPRODUCIBILITY: every row's `bytes` identical across runs
//      (encodeTimeMs may differ — wall-clock on a shared host).
//
// NO decision lives in this output: pivot tables, Pareto marks and tradeoff
// notes are MEASUREMENTS for the human review packet; D1–D7 stay OPEN.
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Wp15Row } from "./wp15-run.ts";
import { CORE17, MANIFEST_STATS, PURPOSE_WIDTHS, QUALITIES, buildDprScenarios } from "./wp15-matrix.ts";

const ROOT = join(import.meta.dirname, "..", "..", "..");
const OUT_DIR = join(ROOT, "bench-output", "wp15");

interface RunPayload {
  run: number;
  reduced: boolean;
  durationMin: number;
  avifProbe: boolean;
  rowCount: number;
  skippedByReduction: number;
  sourceDims: Record<string, { width: number; height: number }>;
  integrity: string;
  rows: Wp15Row[];
}

interface Agg {
  purpose: string;
  requestedWidth: number;
  format: string;
  quality: number;
  n: number;
  meanBytes: number;
  medianBytes: number;
  meanPsnr: number | null;
  meanSsim: number;
  minSsim: number;
}

function keyOf(r: Wp15Row): string {
  return `${r.fixture}|${r.purpose}|${r.requestedWidth}|${r.row.format}|${r.row.quality}`;
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function loadRun(run: number): RunPayload {
  return JSON.parse(readFileSync(join(OUT_DIR, `results-run${run}.json`), "utf8")) as RunPayload;
}

function verifyReproducibility(a: RunPayload, b: RunPayload): { ok: boolean; mismatches: string[] } {
  const mismatches: string[] = [];
  if (a.rows.length !== b.rows.length) {
    mismatches.push(`row count differs: run1=${a.rows.length} run2=${b.rows.length}`);
  }
  const mapB = new Map(b.rows.map((r) => [keyOf(r), r]));
  for (const ra of a.rows) {
    const rb = mapB.get(keyOf(ra));
    if (!rb) {
      mismatches.push(`missing in run2: ${keyOf(ra)}`);
      continue;
    }
    if (ra.row.bytes !== rb.row.bytes) {
      mismatches.push(`bytes differ: ${keyOf(ra)} run1=${ra.row.bytes} run2=${rb.row.bytes}`);
    }
    if (ra.actualWidth !== rb.actualWidth || ra.row.derivedHeight !== rb.row.derivedHeight) {
      mismatches.push(`dimensions differ: ${keyOf(ra)}`);
    }
  }
  return { ok: mismatches.length === 0, mismatches };
}

function aggregate(rows: Wp15Row[]): Agg[] {
  const groups = new Map<string, Wp15Row[]>();
  for (const r of rows) {
    if (r.purpose === "progressive_probe") continue;
    const k = `${r.purpose}|${r.requestedWidth}|${r.row.format}|${r.row.quality}`;
    const g = groups.get(k) ?? [];
    g.push(r);
    groups.set(k, g);
  }
  const out: Agg[] = [];
  for (const [k, g] of groups) {
    const [purpose, widthStr, format, qualityStr] = k.split("|");
    const psnrs = g.map((r) => r.psnr).filter((p): p is number => p !== null);
    out.push({
      purpose,
      requestedWidth: Number(widthStr),
      format,
      quality: Number(qualityStr),
      n: g.length,
      meanBytes: mean(g.map((r) => r.row.bytes)),
      medianBytes: median(g.map((r) => r.row.bytes)),
      meanPsnr: psnrs.length === g.length ? mean(psnrs) : psnrs.length > 0 ? mean(psnrs) : null,
      meanSsim: mean(g.map((r) => r.ssim)),
      minSsim: Math.min(...g.map((r) => r.ssim)),
    });
  }
  return out.sort(
    (x, y) =>
      x.purpose.localeCompare(y.purpose) || x.requestedWidth - y.requestedWidth ||
      x.format.localeCompare(y.format) || x.quality - y.quality,
  );
}

function paretoNondominated(aggs: Agg[]): Set<Agg> {
  // Nondominated on (bytes ↓, ssim ↑) WITHIN a (purpose, requestedWidth) cell —
  // a mechanical marking for the review packet, not a decision.
  const marked = new Set<Agg>();
  const cells = new Map<string, Agg[]>();
  for (const a of aggs) {
    const k = `${a.purpose}|${a.requestedWidth}`;
    (cells.get(k) ?? cells.set(k, []).get(k)!).push(a);
  }
  for (const group of cells.values()) {
    for (const a of group) {
      const dominated = group.some(
        (b) =>
          b !== a &&
          b.meanBytes <= a.meanBytes &&
          b.meanSsim >= a.meanSsim &&
          (b.meanBytes < a.meanBytes || b.meanSsim > a.meanSsim),
      );
      if (!dominated) marked.add(a);
    }
  }
  return marked;
}

function kb(bytes: number): string {
  return (bytes / 1024).toFixed(1) + "K";
}

function main(): void {
  const run1 = loadRun(1);
  const run2 = loadRun(2);

  // 1. Reproducibility gate.
  const repro = verifyReproducibility(run1, run2);
  console.log(`[wp15] reproducibility: rows run1=${run1.rows.length} run2=${run2.rows.length}; identical bytes: ${repro.ok}`);
  if (!repro.ok) {
    console.error(`[wp15] REPRODUCIBILITY FAILURE (${repro.mismatches.length} rows):\n  ${repro.mismatches.slice(0, 20).join("\n  ")}`);
    process.exitCode = 1;
  }

  // 2. Aggregates over run1 (byte-identical to run2 when the gate passed).
  const aggs = aggregate(run1.rows);
  const pareto = paretoNondominated(aggs);

  // 3. Per-fixture extremes at gallery_display 1280 (mid qualities).
  const extremes = CORE17.map((fixture) => {
    const stat = MANIFEST_STATS[fixture];
    const dims = run1.sourceDims[fixture];
    const sourceBytes = statSync(join(ROOT, "media", "stage3c-fixtures", fixture)).size;
    const pickRow = (format: string, quality: number) =>
      run1.rows.find(
        (r) => r.fixture === fixture && r.purpose === "gallery_display" && r.requestedWidth === 1280 && r.row.format === format && r.row.quality === quality,
      );
    const j = pickRow("jpeg", 75);
    const w = pickRow("webp", 70);
    const a = pickRow("avif", 55);
    return {
      fixture,
      l: stat.l,
      s: stat.s,
      c: stat.c,
      note: stat.note,
      sourceBytesPerPixel: sourceBytes / (dims.width * dims.height),
      jpegQ75Bytes: j?.row.bytes ?? null,
      webpQ70Bytes: w?.row.bytes ?? null,
      avifQ55Bytes: a?.row.bytes ?? null,
      jpegQ75Ssim: j?.ssim ?? null,
      webpQ70Ssim: w?.ssim ?? null,
      avifQ55Ssim: a?.ssim ?? null,
    };
  });
  const darkest = [...extremes].sort((a, b) => a.l - b.l)[0];
  const brightest = [...extremes].sort((a, b) => b.l - a.l)[0];
  const densest = [...extremes].sort((a, b) => b.sourceBytesPerPixel - a.sourceBytesPerPixel)[0];

  // 4. DPR scenario byte table (computed, not encoded — see wp15-matrix.ts).
  const sourceMaxWidth = Math.max(...Object.values(run1.sourceDims).map((d) => d.width));
  const scenarios = buildDprScenarios(sourceMaxWidth);
  const dprTable = scenarios.map((sc) => {
    const perFormat: Record<string, { quality: number; meanBytes: number; widthServed: number | null }[]> = {};
    if (sc.servedPx !== null) {
      for (const format of Object.keys(QUALITIES) as Array<keyof typeof QUALITIES>) {
        perFormat[format] = QUALITIES[format].map((quality) => {
          const rows = run1.rows.filter(
            (r) => r.purpose === sc.purpose && r.requestedWidth === sc.servedPx && r.row.format === format && r.row.quality === quality,
          );
          return { quality, meanBytes: rows.length > 0 ? mean(rows.map((r) => r.row.bytes)) : NaN, widthServed: rows[0]?.actualWidth ?? null };
        });
      }
    }
    return { ...sc, perFormat };
  });

  // 5. Progressive-JPEG probe deltas (D7 OPEN — bytes/time only).
  const progressive = CORE17.map((fixture) => {
    const base = run1.rows.find((r) => r.fixture === fixture && r.purpose === "gallery_display" && r.requestedWidth === 1280 && r.row.format === "jpeg" && r.row.quality === 75);
    const prog = run1.rows.find((r) => r.fixture === fixture && r.purpose === "progressive_probe");
    if (!base || !prog) return null;
    return {
      fixture,
      baselineBytes: base.row.bytes,
      progressiveBytes: prog.row.bytes,
      byteDeltaPct: ((prog.row.bytes - base.row.bytes) / base.row.bytes) * 100,
      baselineMs: base.row.encodeTimeMs,
      progressiveMs: prog.row.encodeTimeMs,
      timeDeltaPct: ((prog.row.encodeTimeMs - base.row.encodeTimeMs) / base.row.encodeTimeMs) * 100,
      ssimIdentical: base.ssim === prog.ssim,
    };
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  // 6. Named tradeoff comparisons (measurements, NOT decisions).
  const tradeoffs = [
    { purpose: "gallery_display", width: 1280, pairs: [["avif", 55, "jpeg", 75], ["webp", 70, "jpeg", 75], ["avif", 45, "webp", 60]] },
    { purpose: "overview", width: 320, pairs: [["avif", 55, "jpeg", 75], ["webp", 70, "jpeg", 75]] },
    { purpose: "cover", width: 1600, pairs: [["avif", 55, "jpeg", 75], ["webp", 70, "jpeg", 75]] },
  ].map((t) => ({
    ...t,
    comparisons: t.pairs.map(([f1, q1, f2, q2]) => {
      const a1 = aggs.find((a) => a.purpose === t.purpose && a.requestedWidth === t.width && a.format === f1 && a.quality === q1);
      const a2 = aggs.find((a) => a.purpose === t.purpose && a.requestedWidth === t.width && a.format === f2 && a.quality === q2);
      if (!a1 || !a2) return null;
      return {
        candidate: `${f1} q${q1}`, bytes: a1.meanBytes, ssim: a1.meanSsim,
        versus: `${f2} q${q2}`, bytes2: a2.meanBytes, ssim2: a2.meanSsim,
        byteRatio: a1.meanBytes / a2.meanBytes,
      };
    }).filter((x): x is NonNullable<typeof x> => x !== null),
  }));

  const summary = {
    generatedAt: new Date().toISOString(),
    reproducibility: {
      ok: repro.ok,
      mismatchCount: repro.mismatches.length,
      mismatches: repro.mismatches.slice(0, 50),
      rowsPerRun: run1.rows.length,
      runDurationsMin: [run1.durationMin, run2.durationMin],
      reductionApplied: run1.reduced,
      skippedByReduction: run1.skippedByReduction,
    },
    avifProbe: run1.avifProbe,
    sourceDims: run1.sourceDims,
    integrity: run1.integrity,
    aggregates: aggs,
    paretoNondominated: [...pareto].map((a) => `${a.purpose}/w${a.requestedWidth}/${a.format}/q${a.quality}`),
    perFixtureExtremes: {
      at: "gallery_display 1280, mid qualities (jpeg q75 / webp q70 / avif q55)",
      darkest: darkest.fixture,
      brightest: brightest.fixture,
      densestBySourceBitrate: densest.fixture,
      rows: extremes,
    },
    dprScenarios: dprTable,
    progressiveProbe: {
      note: "byte/time deltas only — visual tradeoff explicitly NOT judged here (D7 OPEN)",
      rows: progressive,
      meanByteDeltaPct: mean(progressive.map((p) => p.byteDeltaPct)),
      meanTimeDeltaPct: mean(progressive.map((p) => p.timeDeltaPct)),
      ssimIdenticalAll: progressive.every((p) => p.ssimIdentical),
    },
    tradeoffs,
  };
  writeFileSync(join(OUT_DIR, "summary.json"), `${JSON.stringify(summary, null, 1)}\n`, "utf8");

  // 7. Markdown report.
  const lines: string[] = [
    "# WP-15 campaign measurements (mechanical output — no decisions)",
    "",
    `Rows: ${run1.rows.length} per run (17 fixtures × matrix + progressive probes).`,
    `Reproducibility: ${repro.ok ? "PASS — every row byte-identical across the two full runs" : `FAIL (${repro.mismatches.length} mismatches)`}.`,
    `Run durations: ${run1.durationMin.toFixed(1)} / ${run2.durationMin.toFixed(1)} min. Reduction applied: ${run1.reduced} (skipped ${run1.skippedByReduction}).`,
    `Integrity: ${run1.integrity}. AVIF probe: ${run1.avifProbe}.`,
    "",
    "## Pivot: purpose × width × format × quality → mean bytes / PSNR / SSIM (n=17 fixtures)",
    "",
    "| purpose | req width | format | q | mean bytes | median bytes | mean psnr dB | mean ssim | min ssim | pareto |",
    "|---|---:|---|---:|---:|---:|---:|---:|---:|---|",
  ];
  for (const a of aggs) {
    lines.push(
      `| ${a.purpose} | ${a.requestedWidth} | ${a.format} | ${a.quality} | ${a.meanBytes.toFixed(0)} | ${a.medianBytes.toFixed(0)} | ${a.meanPsnr === null ? "—" : a.meanPsnr.toFixed(2)} | ${a.meanSsim.toFixed(4)} | ${a.minSsim.toFixed(4)} | ${pareto.has(a) ? "✓" : ""} |`,
    );
  }
  lines.push(
    "",
    "## Per-fixture extremes (gallery_display 1280; jpeg q75 / webp q70 / avif q55)",
    "",
    `Darkest: ${darkest.fixture} (L ${darkest.l}); Brightest: ${brightest.fixture} (L ${brightest.l}); Densest by source bitrate: ${densest.fixture} (${(densest.sourceBytesPerPixel * 1e6).toFixed(0)} B/MP).`,
    "",
    "| fixture | L | S | C | note | src B/MP | jpeg75 B | webp70 B | avif55 B | jpeg75 ssim | webp70 ssim | avif55 ssim |",
    "|---|---:|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|",
  );
  for (const e of extremes) {
    lines.push(
      `| ${e.fixture} | ${e.l} | ${e.s} | ${e.c} | ${e.note} | ${(e.sourceBytesPerPixel * 1e6).toFixed(0)} | ${e.jpegQ75Bytes} | ${e.webpQ70Bytes} | ${e.avifQ55Bytes} | ${e.jpegQ75Ssim?.toFixed(4)} | ${e.webpQ70Ssim?.toFixed(4)} | ${e.avifQ55Ssim?.toFixed(4)} |`,
    );
  }
  lines.push(
    "",
    "## DPR scenarios (computed from the ladder — not encoded; consumption model in wp15-matrix.ts)",
    "",
    "| scenario | purpose | context | CSS px | DPR | required px | served px | cap note |",
    "|---|---|---|---:|---:|---:|---:|---|",
  );
  for (const s of dprTable) {
    lines.push(`| ${s.scenario} | ${s.purpose} | ${s.context} | ${s.cssPx} | ${s.dpr} | ${s.requiredPx} | ${s.servedPx ?? "—"} | ${s.capNote ?? ""} |`);
  }
  lines.push("", "Per-scenario mean bytes per format/quality are in `summary.json` (`dprScenarios`).", "",
    "## Progressive-JPEG probe (gallery_display 1280, q75 — D7 OPEN, no visual judgment)",
    "",
    `Mean byte delta vs baseline JPEG: ${summary.progressiveProbe.meanByteDeltaPct.toFixed(1)}%; mean encode-time delta: ${summary.progressiveProbe.meanTimeDeltaPct.toFixed(1)}%; SSIM unchanged for all fixtures: ${summary.progressiveProbe.ssimIdenticalAll}.`,
    "",
    "| fixture | baseline B | progressive B | Δ bytes % |",
    "|---|---:|---:|---:|",
  );
  for (const p of progressive) {
    lines.push(`| ${p.fixture} | ${p.baselineBytes} | ${p.progressiveBytes} | ${p.byteDeltaPct.toFixed(1)} |`);
  }
  lines.push("", "## Named tradeoff comparisons (measurements — NOT decisions)", "");
  for (const t of tradeoffs) {
    lines.push(`### ${t.purpose} @ ${t.width}px`, "");
    for (const c of t.comparisons) {
      lines.push(
        `- ${c.candidate}: ${kb(c.bytes)} mean, SSIM ${c.ssim.toFixed(4)} — vs ${c.versus}: ${kb(c.bytes2)} mean, SSIM ${c.ssim2.toFixed(4)} (byte ratio ${c.byteRatio.toFixed(2)}×)`,
      );
    }
    lines.push("");
  }
  lines.push(
    `Pareto-nondominated candidates per (purpose, width) cell: ${summary.paretoNondominated.length} of ${aggs.length} — see \`summary.json\`.`,
    "",
    "USER REVIEW PENDING — no format, fallback, quality, width-ladder, overview-ceiling,",
    "cover-dimension, high-DPR or progressive-JPEG decision is made by this output (D1–D7 OPEN).",
    "",
  );
  writeFileSync(join(OUT_DIR, "report.md"), lines.join("\n"), "utf8");
  console.log(`[wp15] summary → ${join(OUT_DIR, "summary.json")}`);
  console.log(`[wp15] report  → ${join(OUT_DIR, "report.md")}`);
}

main();
