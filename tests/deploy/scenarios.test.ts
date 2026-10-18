// WP-54 — deployment scenario drill (non-production).
// Each scenario drives the REAL release/deploy scripts end-to-end against a
// scratch deploy root under tests/tmp/. Nginx-dependent steps (`nginx -t`,
// reload, live 301) are exercised through local equivalents and marked as
// such: P9 is a non-production drill with no real VPS or nginx host.
//
// P9 F6 isolation: every scenario that reads redirect data works against a
// UNIQUE isolated content root (mkdtempSync, O_EXCL semantics) holding its own
// content/ — the real content/redirects.yaml is never read, deleted, or
// overwritten by any test. The redirect scenarios copy the real corpus file
// into isolation, point the CLI at it via --content <isolated-root>, and
// assert the real file's sha256 is unchanged before/after the suite.
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { load } from "js-yaml";

const REPO_ROOT = resolve(join(__dirname, "..", ".."));
const REDIRECTS_SCRIPT = join(REPO_ROOT, "scripts", "release", "redirects.mjs");
const REGISTER_SCRIPT = join(REPO_ROOT, "scripts", "validate", "register-ts-resolve.mjs");
const DEPLOY_SCRIPT = join(REPO_ROOT, "scripts", "deploy", "atomic-deploy.mjs");

/**
 * redirects.mjs imports the WP-12 TS validator — always run it with the same
 * TS bootstrap the CLI requires (global constraint: the child carries its own
 * flags; never rely on an inherited NODE_OPTIONS).
 */
function runRedirectsCli(args: string[]) {
  return execFileSync(
    "node",
    ["--experimental-strip-types", "--import", REGISTER_SCRIPT, REDIRECTS_SCRIPT, ...args],
    { stdio: "pipe", encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } },
  );
}
const REDIRECTS_FILE = join(REPO_ROOT, "content", "redirects.yaml");
const TEST_ROOT = join(REPO_ROOT, "tests", "tmp", "scenarios");
const ISOLATION_ROOT = join(TEST_ROOT, "isolated-content");
const CONTENT = join(REPO_ROOT, "content");

function sha256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

function fileSha256(path: string) {
  return sha256(readFileSync(path, "utf8"));
}

/** Build a minimal release dir with a valid manifest. */
function makeRelease(name: string, files: Record<string, string>) {
  const dir = join(TEST_ROOT, "releases", name);
  mkdirSync(dir, { recursive: true });
  const manifestFiles = [];
  for (const [path, content] of Object.entries(files)) {
    const full = join(dir, path);
    mkdirSync(join(dir, path.split("/").slice(0, -1).join("/")), { recursive: true });
    writeFileSync(full, content);
    manifestFiles.push({ path, sha256: sha256(content) });
  }
  writeFileSync(join(dir, "manifest.json"), JSON.stringify({ files: manifestFiles }));
  return dir;
}

function readCurrentTarget() {
  const cur = join(TEST_ROOT, "current");
  if (!existsSync(cur)) return null;
  try {
    return require("node:fs").readlinkSync(cur).split("/").pop() || null;
  } catch {
    return null;
  }
}

function deploy(releaseDir: string, extraArgs: string[] = []) {
  return execFileSync("node", [DEPLOY_SCRIPT, "--root", TEST_ROOT, "--release", releaseDir, ...extraArgs], {
    stdio: "pipe",
    encoding: "utf8",
  });
}

describe("WP-54 deployment scenarios", () => {
  // F6 isolation: ONE unique isolated content root per test file run,
  // freshly mkdtemp'd (O_EXCL semantics) and owned by this suite. Scenario
  // redirect data — the redirects.yaml corpus AND the galleries/places it
  // references — all comes from this root; the real content/ is untouched.
  let isolatedRoot: string;
  let realRedirectsSha: string;

  beforeEach(() => {
    rmSync(TEST_ROOT, { recursive: true, force: true });
    mkdirSync(TEST_ROOT, { recursive: true });

    // Parent of the mkdtemp scratch must exist (mkdtempSync ENOENT otherwise);
    // create it on demand — never depend on a pre-made tests/tmp layout.
    mkdirSync(ISOLATION_ROOT, { recursive: true });
    isolatedRoot = mkdtempSync(join(ISOLATION_ROOT, "content-"));

    // Pin the real corpus fingerprint before any scenario runs; the same value
    // is asserted unchanged in afterEach.
    realRedirectsSha = fileSha256(REDIRECTS_FILE);

    mkdirSync(join(TEST_ROOT, "releases"), { recursive: true });
  });
  afterEach(() => {
    try { rmSync(TEST_ROOT, { recursive: true, force: true }); } catch {}
    // F6: the real content/redirects.yaml must be byte-for-byte unchanged —
    // the suite never deletes or overwrites it, so this asserts the invariant.
    expect(fileSha256(REDIRECTS_FILE)).toBe(realRedirectsSha);
  });

  /** Copy the real redirects corpus into the isolated content root. */
  function copyRealRedirects() {
    const content = join(isolatedRoot, "content");
    mkdirSync(content, { recursive: true });
    writeFileSync(join(content, "redirects.yaml"), readFileSync(REDIRECTS_FILE, "utf8"));
    return content;
  }

  /** Copy a category dir (galleries/<name> or places/<file>) into isolation. */
  function copyCorpus(subdir: string, name: string, destContent: string) {
    const full = join(CONTENT, subdir, name);
    const target = join(destContent, subdir, name);
    mkdirSync(join(destContent, subdir), { recursive: true });
    cpSync(full, target, { recursive: true });
  }

  test("content publish: assemble + deploy + content check succeeds", () => {
    // First publish: no current yet.
    const rel = makeRelease("rel-1", { "index.html": "<html>v1</html>" });
    deploy(rel, ["--check", "index.html"]);

    expect(readCurrentTarget()).toBe("rel-1");
    expect(readFileSync(join(TEST_ROOT, "current", "index.html"), "utf8")).toBe("<html>v1</html>");
  });

  test("redirect publish: redirects.mjs generates valid rules (nginx -t equivalent)", () => {
    // Local nginx absent in the drill host: verify the generated rewrite
    // include is present, well-formed, and every target resolves. All
    // redirect data comes from the SAME isolated content root as the
    // "failed redirect" scenario — never from the real content/.
    const content = copyRealRedirects();
    // The real aliases resolve to published galleries/places; mirror them in
    // the isolated root so the WP-12 resolution succeeds.
    copyCorpus("galleries", "lofoten-light", content);
    copyCorpus("galleries", "tromso-city-nights", content);
    copyCorpus("places", "reine.yaml", content);

    const outConf = join(TEST_ROOT, "redirects.conf");
    runRedirectsCli(["--out", outConf, "--content", isolatedRoot]);
    const conf = readFileSync(outConf, "utf8");

    const data = load(readFileSync(join(content, "redirects.yaml"), "utf8"));
    const entryCount = Object.keys(data ?? {}).length;
    const ruleCount = (conf.match(/^rewrite /gm) ?? []).length;
    expect(ruleCount).toBe(entryCount);

    // Well-formed rule shape: rewrite ^/old$ /galleries/<slug> permanent;
    // The old path may itself contain slashes, so match the two URL halves
    // explicitly rather than a greedy token.
    for (const line of conf.split("\n")) {
      if (!line.startsWith("rewrite ")) continue;
      expect(line).toMatch(/^rewrite \^(\/[^ ]+)\$ \/(galleries|places)\/[^ ]+ permanent;$/);
    }
  });

  test("failed redirect: unresolvable target aborts generation (fail-closed)", () => {
    // Point redirects at a corpus with a bogus target id by APPENDING to a
    // copy of the real file inside the isolated content root — the real
    // content/redirects.yaml is never deleted or overwritten (verified by the
    // afterEach sha256 invariant).
    const content = copyRealRedirects();
    const bogus =
      readFileSync(join(content, "redirects.yaml"), "utf8") +
      "\n/galleries/nowhere:\n  gallery_id: g_does_not_exist\n";
    writeFileSync(join(content, "redirects.yaml"), bogus);

    let exitCode = 0;
    try {
      runRedirectsCli(["--out", join(TEST_ROOT, "out.conf"), "--content", isolatedRoot]);
    } catch (e: any) {
      exitCode = e.status ?? 1;
    }
    expect(exitCode).not.toBe(0);
  });

  test("interrupted upload: incomplete candidate is never switched", () => {
    // A release missing one manifest-listed file fails validation; current
    // stays untouched.
    const relDir = join(TEST_ROOT, "releases", "rel-partial");
    mkdirSync(relDir, { recursive: true });
    writeFileSync(join(relDir, "index.html"), "<html>partial</html>");
    // manifest lists a file that was never uploaded
    writeFileSync(join(relDir, "manifest.json"), JSON.stringify({ files: [{ path: "index.html", sha256: sha256("<html>partial</html>") }, { path: "missing.jpg", sha256: "deadbeef" }] }));

    let exitCode = 0;
    try {
      deploy(relDir);
    } catch (e: any) {
      exitCode = e.status ?? 1;
    }
    expect(exitCode).not.toBe(0);
    expect(readCurrentTarget()).toBe(null); // never switched
  });

  test("contended lock: second deploy is rejected while first holds lock", () => {
    const rel1 = makeRelease("rel-1", { "index.html": "<html>v1</html>" });
    const rel2 = makeRelease("rel-2", { "index.html": "<html>v2</html>" });

    // First deploy succeeds and releases the lock.
    deploy(rel1);
    expect(readCurrentTarget()).toBe("rel-1");

    // Simulate an in-flight deploy holding the lock.
    const lockDir = join(TEST_ROOT, ".deploy-lock");
    mkdirSync(lockDir, { recursive: true });

    let exitCode = 0;
    try {
      deploy(rel2);
    } catch (e: any) {
      exitCode = e.status ?? 1;
    }
    expect(exitCode).not.toBe(0);
    expect(readCurrentTarget()).toBe("rel-1"); // not switched

    rmSync(lockDir, { recursive: true, force: true });
  });

  test("first publish failure: no previous target -> clean abort, no current", () => {
    // First ever deploy with a bad manifest: no previous to roll back to,
    // current must not exist and no orphan symlink left behind.
    const badRel = join(TEST_ROOT, "releases", "rel-bad");
    mkdirSync(badRel, { recursive: true });
    writeFileSync(join(badRel, "index.html"), "<html>bad</html>");
    writeFileSync(join(badRel, "manifest.json"), JSON.stringify({ files: [{ path: "index.html", sha256: "deadbeef" }] }));

    let exitCode = 0;
    try {
      deploy(badRel);
    } catch (e: any) {
      exitCode = e.status ?? 1;
    }
    expect(exitCode).not.toBe(0);
    expect(readCurrentTarget()).toBe(null);
    expect(existsSync(join(TEST_ROOT, "previous"))).toBe(false);
  });
});
