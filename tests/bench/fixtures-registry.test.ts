// WP-07 fixture registry tests (frozen corpus contract, REAL_PHOTO_FIXTURE_MANIFEST.md):
//   1. Every role F01–F10 resolves to an existing file under
//      media/stage3c-fixtures/ (manifest §1 primary-photo column).
//   2. Manifest/disk divergence fails LOUDLY: a registry pointed at a
//      directory that is missing a referenced file must throw.
//
// The real fixture directory is never written to by these tests.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EXPECTED_JPEG_COUNT,
  FIXTURE_ROLES,
  createFixtureRegistry,
} from "../../scripts/bench/fixtures";

describe("fixture registry (F01–F10 role metadata vs disk)", () => {
  it("resolves all ten roles to existing files in the real fixture dir", () => {
    const registry = createFixtureRegistry();
    expect(FIXTURE_ROLES).toHaveLength(10);

    for (const role of FIXTURE_ROLES) {
      const entry = registry.byRole(role.role);
      expect(entry.file).toBe(role.file);
      expect(entry.category.length).toBeGreaterThan(0);
      expect(entry.absolutePath.startsWith(registry.dir)).toBe(true);
    }
  });

  it("verifies the frozen corpus size on the real fixture dir", () => {
    const registry = createFixtureRegistry();
    expect(EXPECTED_JPEG_COUNT).toBe(113); // manifest: 113 decodable JPEGs
    expect(() => registry.verifyOnDisk()).not.toThrow();
  });

  it("fails loudly when the manifest and disk diverge (missing role file)", () => {
    const emptyDir = mkdtempSync(join(tmpdir(), "wp07-registry-"));
    try {
      // One file present, nine roles missing → registry must name the gap.
      writeFileSync(join(emptyDir, "DSC02071.jpg"), "not a real jpeg");
      const registry = createFixtureRegistry(emptyDir);
      expect(() => registry.verifyOnDisk()).toThrow(/DSC01889\.jpg/); // F02 primary
    } finally {
      rmSync(emptyDir, { recursive: true, force: true });
    }
  });
});
