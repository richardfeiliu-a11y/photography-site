// WP-07 integrity guard tests (frozen-corpus protection):
//   Every harness run snapshots SHA-256 checksums of media/stage3c-fixtures/
//   BEFORE the run and verifies AFTER the run that nothing changed; any
//   mismatch is a hard failure.
//
// The tamper probe below runs against a temp COPY of one fixture in a tmpdir —
// the real fixtures are never touched.
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createFixtureRegistry } from "../../scripts/bench/fixtures";
import {
  assertSameSnapshot,
  snapshotFixtureDir,
} from "../../scripts/bench/integrity";

const scratchDir = mkdtempSync(join(tmpdir(), "wp07-guard-"));

afterAll(() => {
  rmSync(scratchDir, { recursive: true, force: true });
});

describe("fixture integrity guard", () => {
  it("passes over the untouched real fixture dir (before == after)", async () => {
    const before = await snapshotFixtureDir(createFixtureRegistry().dir);
    const after = await snapshotFixtureDir(createFixtureRegistry().dir);
    expect(before.size).toBe(113);
    expect(() => assertSameSnapshot(before, after)).not.toThrow();
  });

  it("tamper probe: a single flipped byte in a COPY is detected as a hard failure", async () => {
    // Copy one real fixture into the scratch tmpdir (source stays read-only).
    const fixture = createFixtureRegistry().byRole("F02"); // DSC01889.jpg
    const copyPath = join(scratchDir, "DSC01889.jpg");
    copyFileSync(fixture.absolutePath, copyPath);

    const before = await snapshotFixtureDir(scratchDir);
    expect(before.get("DSC01889.jpg")).toMatch(/^[0-9a-f]{64}$/);

    // Flip one byte in the middle of the copy.
    const buf = readFileSync(copyPath);
    buf[Math.floor(buf.length / 2)] ^= 0x01;
    writeFileSync(copyPath, buf);

    const after = await snapshotFixtureDir(scratchDir);
    expect(() => assertSameSnapshot(before, after)).toThrow(
      /DSC01889\.jpg/,
    );
  });

  it("detects a removed file in the guarded directory", async () => {
    const dir = mkdtempSync(join(tmpdir(), "wp07-guard2-"));
    try {
      const fixture = createFixtureRegistry().byRole("F08"); // DSC02233.jpg
      const copyPath = join(dir, "DSC02233.jpg");
      copyFileSync(fixture.absolutePath, copyPath);
      const before = await snapshotFixtureDir(dir);
      rmSync(copyPath);
      const after = await snapshotFixtureDir(dir);
      expect(() => assertSameSnapshot(before, after)).toThrow(
        /DSC02233\.jpg/,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
