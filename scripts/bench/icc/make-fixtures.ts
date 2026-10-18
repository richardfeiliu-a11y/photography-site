// WP-16 provenance fixture generator — writes the ICC fixture classes into
// media/wp16-icc-fixtures/ as reproducible documentation copies and prints
// their provenance (sizes, SHA-256, recipes).
//
// The frozen corpus (media/stage3c-fixtures/, 113 files) is NEVER mutated:
// sources are opened read-only and every output is a fresh re-encode. Run:
//   npm run bench:wp16:fixtures
// The output directory is gitignored (worktree /media rule); the committed
// evidence lives in docs/implementation/decisions/ICC-POLICY.md and the tests
// regenerate fixtures at runtime in a tmpdir via the same factory.
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createIccFixtures } from "./fixtures.ts";

const CORPUS = join(import.meta.dirname, "..", "..", "..", "media", "stage3c-fixtures");
const OUT_DIR = join(import.meta.dirname, "..", "..", "..", "media", "wp16-icc-fixtures");

// F04 "most saturated" (color-transform stress) and F10 baseline "normal"
// landscape (scripts/bench/fixtures.ts FIXTURE_ROLES, citing the frozen
// REAL_PHOTO_FIXTURE_MANIFEST.md §1 primary photos).
const SOURCES = ["DSC02560.jpg", "DSC02367.jpg"];

const sha256 = (buffer: Buffer): string =>
  createHash("sha256").update(buffer).digest("hex");

for (const file of SOURCES) {
  const sourcePath = join(CORPUS, file);
  const set = await createIccFixtures({ sourcePath, outDir: OUT_DIR });
  console.log(`source: media/stage3c-fixtures/${file} (read-only; unmodified)`);
  for (const fixtureClass of ["tagged-srgb", "tagged-adobe-rgb", "tagged-display-p3", "untagged"] as const) {
    const buffer = await readFile(set.paths[fixtureClass]);
    console.log(
      `  ${fixtureClass.padEnd(18)} ${String(set.bytes[fixtureClass]).padStart(7)}B  icc=${String(set.iccBytes[fixtureClass]).padStart(4)}B  sha256=${sha256(buffer)}`,
    );
  }
}
console.log(`\ncorpus JPEG count still frozen at 113: ${
  (await readdir(CORPUS)).filter((n) => n.toLowerCase().endsWith(".jpg")).length
}`);
console.log(`provenance copies written under: media/wp16-icc-fixtures/ (gitignored)`);
