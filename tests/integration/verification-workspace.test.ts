// R1 — verification workspace isolation (RED first).
// A verification workspace must never symlink writable output dirs back to the
// candidate, must refuse a cwd inside the candidate ROOT, and must leave the
// candidate zero-polluted after a build.
import {
  existsSync,
  readlinkSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { assertIsolatedBuildRoot } from "../../scripts/perf/build-isolated.mjs";
import { provisionWorkspace } from "../../scripts/perf/provision-workspace.mjs";

const REPO_ROOT = resolve(join(__dirname, "..", ".."));

describe("verification workspace isolation (R1)", () => {
  test("provisionWorkspace does not symlink bench-output back to the candidate", () => {
    // Force a bench-output to exist in the candidate so the production code
    // path (which only symlinks if source exists) is exercised.
    const candBench = join(REPO_ROOT, "bench-output");
    const hadBench = existsSync(candBench);
    if (!hadBench) mkdirSync(candBench, { recursive: true });
    try {
      const { ws } = provisionWorkspace();
      try {
        const link = join(ws, "bench-output");
        // The workspace must have its OWN bench-output (a directory, not a
        // symlink pointing into the candidate).
        const lst = lstatSync(link);
        expect(lst.isDirectory()).toBe(true);
        expect(lst.isSymbolicLink()).toBe(false);
        // If a symlink exists pointing back to the candidate, that's a leak.
        // Also assert the workspace's bench-output resolves to a path NOT
        // inside the candidate.
        if (lst.isSymbolicLink()) {
          const target = resolve(join(link, "..", readlinkSync(link)));
          expect(target.startsWith(REPO_ROOT)).toBe(false);
        }
      } finally {
        rmSync(ws, { recursive: true, force: true });
      }
    } finally {
      if (!hadBench) rmSync(candBench, { recursive: true, force: true });
    }
  });

  test("isolated build root refuses the candidate ROOT and non-tmpdir cwd", () => {
    expect(() => assertIsolatedBuildRoot(REPO_ROOT)).toThrow();
    expect(() => assertIsolatedBuildRoot("/not/a/tmp/dir")).toThrow();
    expect(() => assertIsolatedBuildRoot(mkdtempSync(join(tmpdir(), "iso-")))).not.toThrow();
  });

  test("two independent workspaces never overwrite each other", () => {
    const a = provisionWorkspace();
    const b = provisionWorkspace();
    try {
      expect(a.ws).not.toBe(b.ws);
      writeFileSync(join(a.ws, "marker-a.txt"), "a");
      writeFileSync(join(b.ws, "marker-b.txt"), "b");
      expect(existsSync(join(a.ws, "marker-b.txt"))).toBe(false);
      expect(existsSync(join(b.ws, "marker-a.txt"))).toBe(false);
    } finally {
      rmSync(a.ws, { recursive: true, force: true });
      rmSync(b.ws, { recursive: true, force: true });
    }
  });

  test("synthetic marker never leaks into the candidate", () => {
    const { ws } = provisionWorkspace();
    try {
      expect(existsSync(join(REPO_ROOT, "SYNTHETIC-PROVISION-MARKER.txt"))).toBe(false);
    } finally {
      rmSync(ws, { recursive: true, force: true });
    }
  });
});
