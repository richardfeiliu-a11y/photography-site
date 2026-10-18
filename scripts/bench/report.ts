// WP-07 report renderer — measurement rows → markdown evidence table + JSON
// for WP-15 packets. Output lives under bench-output/ (gitignored scratch;
// deterministic LOCATION per the WP-07 brief — artifacts never go into
// generated/, which is for derived site media owned by later WPs).
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { MeasurementRow } from "./encode-runner.ts";

/** A measurement row joined with its optional fidelity metrics. */
export type EvidenceRow = MeasurementRow & {
  psnr?: number | null;
  ssim?: number;
  ssimWindows?: number;
};

export interface ReportInput {
  rows: EvidenceRow[];
  /** Free-text context recorded in the report header (campaign notes). */
  notes?: string;
  /** Optional campaign label in filenames, e.g. "smoke". */
  label?: string;
}

function n(value: number, digits: number): string {
  return value.toFixed(digits);
}

function fidelityCells(row: EvidenceRow): string {
  return row.psnr === undefined || row.psnr === null
    ? "— | —"
    : `${n(row.psnr, 2)} | ${row.ssim === undefined ? "—" : n(row.ssim, 4)}`;
}

export function renderMarkdown(input: ReportInput): string {
  const header = [
    `# Bench evidence${input.label ? ` — ${input.label}` : ""}`,
    "",
    input.notes ? `${input.notes}` : null,
    "",
    "Rows: one per (fixture × format × width × quality). `psnr` in dB (`∞` → `—`),",
    "`ssim` mean over 8×8 windows vs the EXIF-normalized source at the candidate width.",
    "",
    "| fixture | format | width | quality | bytes | encodeTimeMs | derivedHeight | psnr | ssim |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|",
  ].filter((line): line is string => line !== null);
  const body = [...input.rows]
    .sort(
      (a, b) =>
        a.fixture.localeCompare(b.fixture) ||
        a.format.localeCompare(b.format) ||
        a.width - b.width ||
        a.quality - b.quality,
    )
    .map(
      (r) =>
        `| ${r.fixture} | ${r.format} | ${r.width} | ${r.quality} | ${r.bytes} | ${n(r.encodeTimeMs, 2)} | ${r.derivedHeight} | ${fidelityCells(r)} |`,
    );
  return [...header, ...body, ""].join("\n");
}

/**
 * Write the evidence packet (markdown + JSON) under `outDir`.
 * Returns the written paths so the CLI can print them.
 */
export async function writeReport(
  outDir: string,
  input: ReportInput,
): Promise<{ markdownPath: string; jsonPath: string }> {
  await mkdir(outDir, { recursive: true });
  const stem = `report${input.label ? `-${input.label}` : ""}`;
  const markdownPath = join(outDir, `${stem}.md`);
  const jsonPath = join(outDir, `${stem}.json`);
  await writeFile(markdownPath, renderMarkdown(input), "utf8");
  await writeFile(jsonPath, `${JSON.stringify(input, null, 2)}\n`, "utf8");
  return { markdownPath, jsonPath };
}
