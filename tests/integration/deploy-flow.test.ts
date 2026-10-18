// WP-53 — atomic deploy flow (RED first).
// Verifies: upload → validate → record old target → atomic switch →
// content check → failure rollback; lock covers full flow.
import { existsSync, mkdirSync, readFileSync, readlinkSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";

const REPO_ROOT = resolve(join(__dirname, "..", ".."));
const DEPLOY_SCRIPT = join(REPO_ROOT, "scripts", "deploy", "atomic-deploy.mjs");
const TEST_ROOT = join(REPO_ROOT, "tests", "tmp", "deploy-flow");

function setupTestRoot() {
  rmSync(TEST_ROOT, { recursive: true, force: true });
  mkdirSync(TEST_ROOT, { recursive: true });
  mkdirSync(join(TEST_ROOT, "releases"), { recursive: true });
  mkdirSync(join(TEST_ROOT, "releases", "rel-A"), { recursive: true });
  writeFileSync(join(TEST_ROOT, "releases", "rel-A", "index.html"), "<html>A</html>");
  writeFileSync(join(TEST_ROOT, "releases", "rel-A", "manifest.json"), JSON.stringify({ files: [{ path: "index.html", sha256: sha256("<html>A</html>") }] }));
  // Initial current -> rel-A
  symlinkSync(join(TEST_ROOT, "releases", "rel-A"), join(TEST_ROOT, "current"));
}

function sha256(s: string) {
  return require("node:crypto").createHash("sha256").update(s).digest("hex");
}

function readCurrentTarget() {
  const cur = join(TEST_ROOT, "current");
  if (!existsSync(cur)) return null;
  try {
    const target = require("node:fs").readlinkSync(cur);
    return target.split("/").pop() || null;
  } catch {
    return null;
  }
}

/** Build a minimal release dir with a valid manifest (or given manifest content). */
function makeRelease(name: string, files: Record<string, string>, manifestContent?: string) {
  const dir = join(TEST_ROOT, "releases", name);
  mkdirSync(dir, { recursive: true });
  for (const [path, content] of Object.entries(files)) {
    const full = join(dir, path);
    mkdirSync(join(dir, path.split("/").slice(0, -1).join("/")), { recursive: true });
    writeFileSync(full, content);
  }
  if (manifestContent !== undefined) {
    writeFileSync(join(dir, "manifest.json"), manifestContent);
  } else {
    writeFileSync(join(dir, "manifest.json"), JSON.stringify({ files: Object.entries(files).map(([path, content]) => ({ path, sha256: sha256(content) })) }));
  }
  return dir;
}

/** Run the real deploy script; returns { stdout, exitCode } (expect throws on failure). */
function runDeploy(releaseDir: string, extraArgs: string[] = []) {
  let stdout = "";
  let exitCode = 0;
  try {
    stdout = execFileSync("node", [DEPLOY_SCRIPT, "--root", TEST_ROOT, "--release", releaseDir, ...extraArgs], { stdio: "pipe", encoding: "utf8" });
  } catch (e: any) {
    exitCode = e.status ?? 1;
    stdout = typeof e.stdout === "string" ? e.stdout : "";
    // The script reports failures via console.error (stderr); append it so
    // message-content assertions can see it.
    if (typeof e.stderr === "string" && e.stderr) stdout += e.stderr;
  }
  return { stdout, exitCode };
}

describe("WP-53 atomic deploy flow", () => {
  beforeEach(() => setupTestRoot());
  afterEach(() => {
    try { rmSync(TEST_ROOT, { recursive: true, force: true }); } catch {}
  });

  test("initial current symlink points to rel-A", () => {
    expect(readCurrentTarget()).toBe("rel-A");
  });

  test("atomic deploy switches current to a new release", () => {
    // Prepare rel-B
    mkdirSync(join(TEST_ROOT, "releases", "rel-B"), { recursive: true });
    writeFileSync(join(TEST_ROOT, "releases", "rel-B", "index.html"), "<html>B</html>");
    writeFileSync(join(TEST_ROOT, "releases", "rel-B", "manifest.json"), JSON.stringify({ files: [{ path: "index.html", sha256: sha256("<html>B</html>") }] }));

    // Run deploy
    execFileSync("node", [DEPLOY_SCRIPT, "--root", TEST_ROOT, "--release", join(TEST_ROOT, "releases", "rel-B")], { stdio: "pipe" });

    expect(readCurrentTarget()).toBe("rel-B");
    const index = readFileSync(join(TEST_ROOT, "current", "index.html"), "utf8");
    expect(index).toBe("<html>B</html>");
  });

  test("previous target is recorded after switch", () => {
    mkdirSync(join(TEST_ROOT, "releases", "rel-B"), { recursive: true });
    writeFileSync(join(TEST_ROOT, "releases", "rel-B", "index.html"), "<html>B</html>");
    writeFileSync(join(TEST_ROOT, "releases", "rel-B", "manifest.json"), JSON.stringify({ files: [{ path: "index.html", sha256: sha256("<html>B</html>") }] }));
    execFileSync("node", [DEPLOY_SCRIPT, "--root", TEST_ROOT, "--release", join(TEST_ROOT, "releases", "rel-B")], { stdio: "pipe" });

    const previous = join(TEST_ROOT, "previous");
    expect(existsSync(previous)).toBe(true);
    const prevTarget = require("node:fs").readlinkSync(previous);
    expect(prevTarget.split("/").pop()).toBe("rel-A");
  });

  test("deploy fails (sha256 mismatch) and rolls back", () => {
    mkdirSync(join(TEST_ROOT, "releases", "rel-C"), { recursive: true });
    writeFileSync(join(TEST_ROOT, "releases", "rel-C", "index.html"), "<html>C</html>");
    // Wrong sha256 in manifest — should fail validation
    writeFileSync(join(TEST_ROOT, "releases", "rel-C", "manifest.json"), JSON.stringify({ files: [{ path: "index.html", sha256: "deadbeef" }] }));

    let exitCode = 0;
    try {
      execFileSync("node", [DEPLOY_SCRIPT, "--root", TEST_ROOT, "--release", join(TEST_ROOT, "releases", "rel-C")], { stdio: "pipe" });
    } catch (e: any) {
      exitCode = e.status ?? 1;
    }
    expect(exitCode).not.toBe(0);
    // current should still point to rel-A (rollback)
    expect(readCurrentTarget()).toBe("rel-A");
  });

  test("concurrent deploy is rejected by lock", () => {
    mkdirSync(join(TEST_ROOT, "releases", "rel-B"), { recursive: true });
    writeFileSync(join(TEST_ROOT, "releases", "rel-B", "index.html"), "<html>B</html>");
    writeFileSync(join(TEST_ROOT, "releases", "rel-B", "manifest.json"), JSON.stringify({ files: [{ path: "index.html", sha256: sha256("<html>B</html>") }] }));

    // Acquire lock manually
    const lockDir = join(TEST_ROOT, ".deploy-lock");
    mkdirSync(lockDir, { recursive: true });

    let exitCode = 0;
    try {
      execFileSync("node", [DEPLOY_SCRIPT, "--root", TEST_ROOT, "--release", join(TEST_ROOT, "releases", "rel-B")], { stdio: "pipe" });
    } catch (e: any) {
      exitCode = e.status ?? 1;
    }
    expect(exitCode).not.toBe(0);
    // current should still be rel-A
    expect(readCurrentTarget()).toBe("rel-A");

    // Cleanup lock
    rmSync(lockDir, { recursive: true, force: true });
  });

  test("switch succeeds but content check fails -> rolls back to previous", () => {
    mkdirSync(join(TEST_ROOT, "releases", "rel-B"), { recursive: true });
    writeFileSync(join(TEST_ROOT, "releases", "rel-B", "index.html"), "<html>B</html>");
    writeFileSync(join(TEST_ROOT, "releases", "rel-B", "manifest.json"), JSON.stringify({ files: [{ path: "index.html", sha256: sha256("<html>B</html>") }] }));

    // Manifest validates (index.html present), but --check targets a path
    // that does not exist in the switched target -> content check fails.
    let exitCode = 0;
    try {
      execFileSync("node", [DEPLOY_SCRIPT, "--root", TEST_ROOT, "--release", join(TEST_ROOT, "releases", "rel-B"), "--check", "missing.html"], { stdio: "pipe" });
    } catch (e: any) {
      exitCode = e.status ?? 1;
    }
    expect(exitCode).not.toBe(0);
    // Rollback: current points back to rel-A, previous still recorded.
    expect(readCurrentTarget()).toBe("rel-A");
    const previous = join(TEST_ROOT, "previous");
    expect(existsSync(previous)).toBe(true);
    const prevTarget = require("node:fs").readlinkSync(previous);
    expect(prevTarget.split("/").pop()).toBe("rel-A");
  });

  test("first publish: --check fails after switch -> current removed (option A)", () => {
    // No existing current symlink — first ever deploy.
    unlinkSync(join(TEST_ROOT, "current"));
    const rel = makeRelease("rel-1", { "index.html": "<html>v1</html>" });
    const { exitCode } = runDeploy(rel, ["--check", "missing.html"]);

    expect(exitCode).not.toBe(0);
    expect(readCurrentTarget()).toBe(null);
    expect(existsSync(join(TEST_ROOT, "current"))).toBe(false);
    expect(existsSync(join(TEST_ROOT, "previous"))).toBe(false);
  });

  test("R3 regression: broken candidate manifest never unwinds a healthy current", () => {
    // Setup from scenario B: current=B, previous=A (history leftover).
    const relA = makeRelease("rel-A", { "index.html": "<html>A</html>" });
    runDeploy(relA);
    const relB = makeRelease("rel-B", { "index.html": "<html>B</html>" });
    runDeploy(relB);
    // After rel-B deploy: current=B, previous=A (setup already had lhs A -> B).
    expect(readCurrentTarget()).toBe("rel-B");
    const previous = join(TEST_ROOT, "previous");
    expect(existsSync(previous)).toBe(true);
    const prevTarget = require("node:fs").readlinkSync(previous);
    expect(prevTarget.split("/").pop()).toBe("rel-A");

    // A broken candidate manifest must abort BEFORE touching current.
    makeRelease("rel-C", { "index.html": "<html>C</html>" }, "{ not valid json");
    const { exitCode } = runDeploy(join(TEST_ROOT, "releases", "rel-C"));

    expect(exitCode).not.toBe(0);
    // current still points to rel-B — never rolled back to rel-A.
    expect(readCurrentTarget()).toBe("rel-B");
    // Service content unchanged.
    expect(readFileSync(join(TEST_ROOT, "current", "index.html"), "utf8")).toBe("<html>B</html>");
  });

  test("dangling current link is rejected before any switch", () => {
    const rel = makeRelease("rel-B", { "index.html": "<html>B</html>" });
    // current is a symlink to a path that does not exist.
    unlinkSync(join(TEST_ROOT, "current"));
    symlinkSync(join(TEST_ROOT, "releases", "no-such-release"), join(TEST_ROOT, "current"));
    expect(readlinkSync(join(TEST_ROOT, "current")).split("/").pop()).toBe("no-such-release");

    const { exitCode } = runDeploy(rel);

    expect(exitCode).not.toBe(0);
    // Nothing was switched; current still points at the dangling target.
    expect(readlinkSync(join(TEST_ROOT, "current")).split("/").pop()).toBe("no-such-release");
  });

  test("relative current symlink: snapshot, switch and rollback resolve correctly", () => {
    // current is a RELATIVE symlink to rel-A: "releases/rel-A".
    unlinkSync(join(TEST_ROOT, "current"));
    symlinkSync(join("releases", "rel-A"), join(TEST_ROOT, "current"));
    expect(readCurrentTarget()).toBe("rel-A");

    // First deploy (hadCurrent=true) — switch to rel-B.
    const relB = makeRelease("rel-B", { "index.html": "<html>B</html>" });
    runDeploy(relB);
    expect(readCurrentTarget()).toBe("rel-B");
    const previous = join(TEST_ROOT, "previous");
    expect(existsSync(previous)).toBe(true);
    expect(require("node:fs").readlinkSync(previous)).toBe(join("releases", "rel-A"));

    // Second deploy that switches then fails content check — must roll back
    // to rel-B (the pre-switch target), resolved from the link dir.
    const relC = makeRelease("rel-C", { "index.html": "<html>C</html>" });
    const { exitCode } = runDeploy(relC, ["--check", "missing.html"]);
    expect(exitCode).not.toBe(0);
    expect(readCurrentTarget()).toBe("rel-B");
  });

  // F2: the deploy entry reuses the assembly-side validateManifest (non-empty
  // array, path safety, duplicates, sha256, symlink rejection, exact closure).
  // Each bad manifest must abort with exit != 0 and leave `current` untouched.
  describe("F2: deploy rejects invalid manifests (shared validateManifest)", () => {
    test("empty manifest {} is rejected, current unchanged", () => {
      // A fresh first-publish scenario: no current exists, nothing to keep.
      rmSync(join(TEST_ROOT, "current"), { force: true });
      const rel = makeRelease("rel-empty", { "index.html": "<html>E</html>" }, "{}");
      const { exitCode } = runDeploy(rel);

      expect(exitCode).not.toBe(0);
      expect(readCurrentTarget()).toBe(null);
      expect(existsSync(join(TEST_ROOT, "current"))).toBe(false);
      expect(existsSync(join(TEST_ROOT, "previous"))).toBe(false);
    });

    test("manifest { files: [] } is rejected, current unchanged", () => {
      const rel = makeRelease("rel-nofiles", { "index.html": "<html>N</html>" }, JSON.stringify({ files: [] }));
      const { exitCode } = runDeploy(rel);

      expect(exitCode).not.toBe(0);
      expect(readCurrentTarget()).toBe("rel-A");
    });

    test("path escaping the release dir is rejected, current unchanged", () => {
      const rel = makeRelease(
        "rel-escape",
        { "index.html": "<html>X</html>" },
        JSON.stringify({ files: [{ path: "../evil", sha256: "a".repeat(64) }] }),
      );
      const { exitCode } = runDeploy(rel);

      expect(exitCode).not.toBe(0);
      expect(readCurrentTarget()).toBe("rel-A");
    });

    test("duplicate manifest entries are rejected, current unchanged", () => {
      const rel = makeRelease(
        "rel-dup",
        { "index.html": "<html>D</html>" },
        JSON.stringify({
          files: [
            { path: "index.html", sha256: sha256("<html>D</html>") },
            { path: "index.html", sha256: sha256("<html>D</html>") },
          ],
        }),
      );
      const { exitCode } = runDeploy(rel);

      expect(exitCode).not.toBe(0);
      expect(readCurrentTarget()).toBe("rel-A");
    });

    test("unlisted file on disk (closure) is rejected, current unchanged", () => {
      // Manifest only lists index.html; stray.bin exists in the release dir.
      const rel = makeRelease(
        "rel-closure",
        { "index.html": "<html>C</html>", "stray.bin": "unlisted" },
        JSON.stringify({ files: [{ path: "index.html", sha256: sha256("<html>C</html>") }] }),
      );
      const { exitCode } = runDeploy(rel);

      expect(exitCode).not.toBe(0);
      expect(readCurrentTarget()).toBe("rel-A");
    });

    test("symlink escaping the release dir is rejected, current unchanged", () => {
      // A symlink inside the release pointing OUTSIDE it (to the deploy root).
      const rel = makeRelease("rel-symlink", { "index.html": "<html>S</html>" });
      symlinkSync(join(TEST_ROOT, "current"), join(rel, "escape-link"));
      const { exitCode } = runDeploy(rel);

      expect(exitCode).not.toBe(0);
      expect(readCurrentTarget()).toBe("rel-A");
    });
  });

  // F4: the deployment entry is the fail-closed backstop for the
  // `include /var/www/redirects*.conf;` glob loophole — nginx silently passes
  // when the glob matches nothing, so a missing or empty redirects.conf must
  // abort the deploy BEFORE the switch, leaving `current` untouched.
  describe("F4: deploy rejects missing/empty redirects config (fail-closed)", () => {
    const REDIRECTS = join(TEST_ROOT, "redirects.conf");

    test("--redirects <missing> -> exit != 0, current unchanged", () => {
      const rel = makeRelease("rel-red-missing", { "index.html": "<html>R</html>" });

      const { exitCode, stdout } = runDeploy(rel, ["--redirects", join(TEST_ROOT, "no-such-redirects.conf")]);

      expect(exitCode).not.toBe(0);
      expect(stdout).toContain("redirects config missing");
      expect(readCurrentTarget()).toBe("rel-A");
    });

    test("--redirects <empty file> -> exit != 0, current unchanged", () => {
      const rel = makeRelease("rel-red-empty", { "index.html": "<html>R</html>" });
      writeFileSync(REDIRECTS, "");

      const { exitCode, stdout } = runDeploy(rel, ["--redirects", REDIRECTS]);

      expect(exitCode).not.toBe(0);
      expect(stdout).toContain("redirects config empty");
      expect(readCurrentTarget()).toBe("rel-A");
    });

    test("--redirects <valid non-empty> -> exit 0, switch succeeds", () => {
      const rel = makeRelease("rel-red-ok", { "index.html": "<html>R</html>" });
      writeFileSync(REDIRECTS, "# redirect include\nrewrite ^/old$ /new permanent;\n");

      const { exitCode, stdout } = runDeploy(rel, ["--redirects", REDIRECTS]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("switched current");
      expect(readCurrentTarget()).toBe("rel-red-ok");
    });
  });
});
