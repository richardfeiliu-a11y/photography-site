// WP-07 harness smoke (TDD anchor, PRODUCTION_IMPLEMENTATION_PLAN.md WP-07
// "Test-first requirement"):
//   ingest ONE fixture JPEG → run ONE candidate encode (sharp jpeg width=640
//   quality=80) → emit ONE measurement row with EXACTLY these fields:
//   { fixture, format, width, quality, bytes, encodeTimeMs } (+ a
//   derived-height field is permitted).
//
// The row schema is the contract WP-15 (P3 image-format benchmark) will drive;
// extra fields here would silently widen that contract, hence the exact-keys
// assertion below. The fixture directory is read-only (frozen manifest); the
// encode output goes to a gitignored scratch dir (bench-output/).
import { existsSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createFixtureRegistry } from "../../scripts/bench/fixtures";
import { runEncodeCandidate } from "../../scripts/bench/encode-runner";

const scratchDir = mkdtempSync(join(tmpdir(), "wp07-smoke-"));

afterAll(() => {
  rmSync(scratchDir, { recursive: true, force: true });
});

describe("bench harness smoke (one fixture, one candidate encode)", () => {
  it("emits one measurement row with the exact frozen schema", async () => {
    const registry = createFixtureRegistry();
    const fixture = registry.byRole("F01"); // manifest §1 primary: DSC02071.jpg

    const { row, outputPath } = await runEncodeCandidate(
      fixture.absolutePath,
      fixture.file,
      { format: "jpeg", width: 640, quality: 80 },
      scratchDir,
    );

    // Exact schema: the six frozen fields + derivedHeight (permitted extra).
    expect(Object.keys(row).sort()).toEqual(
      [
        "fixture",
        "format",
        "width",
        "quality",
        "bytes",
        "encodeTimeMs",
        "derivedHeight",
      ].sort(),
    );
    expect(row.fixture).toBe("DSC02071.jpg");
    expect(row.format).toBe("jpeg");
    expect(row.width).toBe(640);
    expect(row.quality).toBe(80);
    expect(row.bytes).toBeGreaterThan(0);
    expect(row.encodeTimeMs).toBeGreaterThan(0);
    expect(row.derivedHeight).toBeGreaterThan(0);

    expect(existsSync(outputPath)).toBe(true);
  });
});
