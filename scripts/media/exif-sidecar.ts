// Build-time EXIF sidecar CLI (Monograph spec §6.3 metadata plaque).
//
// Reads non-sensitive capture labels from the ingest masters and writes
// generated/exif-manifest.json. No GPS/serial/MakerNote/timestamps; the
// frozen asset-manifest@1 is untouched (ADR-012 privacy posture preserved).
//
// Run: npm run media:exif
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "../../src/lib/pages/archive-data";
import { buildExifSidecar } from "../../src/lib/exif/build-sidecar";
import {
  EXIF_SIDECAR_RELATIVE_PATH,
} from "../../src/lib/exif/sidecar-contract";

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

async function main(): Promise<void> {
  const root = repoRoot();
  const { sidecar, total, labelled } = await buildExifSidecar(root);
  const outPath = join(root, EXIF_SIDECAR_RELATIVE_PATH);
  mkdirSync(join(root, "generated"), { recursive: true });
  writeFileSync(outPath, stableStringify(sidecar) + "\n", "utf8");
  process.stdout.write(
    `[media:exif] wrote ${total} photos (${labelled} with capture data) → ${EXIF_SIDECAR_RELATIVE_PATH}\n`,
  );
}

main().catch((cause) => {
  process.stderr.write(`[media:exif] ${cause instanceof Error ? cause.stack ?? cause.message : String(cause)}\n`);
  process.exit(1);
});
