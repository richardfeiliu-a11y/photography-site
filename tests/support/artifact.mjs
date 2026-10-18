// IMP-01 — test/preview artifact assembly + static serving.
//
// The frozen production architecture (BUILD_AND_ROUTING §1-2) defines FINAL
// ASSEMBLY as a step that combines Astro output (dist/) with the staged web
// derivatives (generated/media/) into an isolated, self-contained release
// artifact — mutating neither input. `astro preview` serves dist/ only, so
// the browser-facing preview used by E2E/capture never served /media/ (the
// IMP-01 false-green: markup selected an .avif currentSrc that 404'd).
//
// This module is the TEST realization of that same assembly concept:
//   assembleArtifact()  — fresh isolated root: copy of the built HTML
//                         artifact + /media symlink to generated/media.
//                         dist/ and generated/ are never written to.
//   createStaticServer()— deterministic static file server for the assembled
//                         root (real MIME types incl. image/avif; the same
//                         static-404 contract as astro preview: 404 status
//                         + 404.html body).
//   runBuild()          — explicit build invocation; the capture/E2E harness
//                         ALWAYS states its build mode explicitly and always
//                         rebuilds. Stale shared dist/ state must never
//                         determine semantics (IMP-05).
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, cpSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Isolated assembly roots — one per build mode, never shared, never dist/. */
export function artifactRoot(mode) {
  return join(ROOT, ".serve-artifacts", mode);
}

/**
 * Assemble a self-contained served artifact from a built HTML artifact dir.
 * Fresh every call: an existing artifact dir is removed first. /media is a
 * symlink to generated/media (mount/link semantics; 79M of derivatives are
 * not duplicated per run). Returns the artifact root.
 */
export function assembleArtifact(sourceDir, mode, opts = {}) {
  const sourceIndex = join(sourceDir, "index.html");
  if (!existsSync(sourceIndex)) {
    throw new Error(
      `assembleArtifact: source artifact has no index.html at ${sourceDir} — build first (explicit mode contract)`,
    );
  }
  const target = artifactRoot(mode);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(dirname(target), { recursive: true });
  cpSync(sourceDir, target, { recursive: true });
  const mediaTarget = join(target, "media");
  // WP-38: the preview capture serves draft derivatives alongside production
  // media. `extraMediaDirs` (preview-only) replaces the single /media symlink
  // with a real directory of symlinks into each store — production and QA
  // callers pass nothing and keep the exact previous assembly.
  const extraMediaDirs = opts.extraMediaDirs ?? [];
  if (extraMediaDirs.length > 0) {
    rmSync(mediaTarget, { recursive: true, force: true });
    mkdirSync(mediaTarget, { recursive: true });
    const linkStore = (store) => {
      for (const entry of readdirSync(store, { withFileTypes: true })) {
        if (!entry.isFile()) continue;
        const link = join(mediaTarget, entry.name);
        if (!existsSync(link)) symlinkSync(join(store, entry.name), link);
      }
    };
    linkStore(join(ROOT, "generated", "media"));
    for (const dir of extraMediaDirs) linkStore(dir);
  } else if (!existsSync(mediaTarget)) {
    symlinkSync(join(ROOT, "generated", "media"), mediaTarget, "dir");
  }
  return target;
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".avif": "image/avif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

/**
 * Deterministic static server for an assembled artifact root. Mirrors the
 * astro preview contract the tests were written against: directory paths
 * resolve to <path>/index.html, extensionless paths try <path>/index.html,
 * unknown paths serve 404.html with a real 404 status.
 */
export function createStaticServer(root) {
  const server = createServer((req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      let pathname = decodeURIComponent(url.pathname);
      // Traversal guard: the resolved path must stay inside the root.
      const resolved = resolve(root, "." + pathname);
      if (!resolved.startsWith(root)) {
        res.writeHead(403).end("Forbidden");
        return;
      }
      let filePath = resolved;
      if (filePath.endsWith("/") || !existsSync(filePath) || statSync(filePath).isDirectory()) {
        filePath = join(filePath.replace(/\/$/, ""), "index.html");
      }
      if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
        const notFound = join(root, "404.html");
        if (existsSync(notFound)) {
          const body = readFileSync(notFound);
          res.writeHead(404, { "Content-Type": MIME[".html"] }).end(body);
        } else {
          res.writeHead(404).end("Not Found");
        }
        return;
      }
      const type = MIME[extname(filePath).toLowerCase()] ?? "application/octet-stream";
      const body = readFileSync(filePath);
      res.writeHead(200, { "Content-Type": type, "Content-Length": body.byteLength }).end(body);
    } catch (error) {
      res.writeHead(500).end(`artifact server error: ${error?.message ?? error}`);
    }
  });
  return server;
}

// ---------------------------------------------------------------------------
// Canonical-build mutex. Concurrent canonical builds (e.g. two integration
// test files each invoking `npm run build`) clear and write the SHARED dist/
// concurrently and corrupt each other — dist/ has one owner at a time. A
// mkdir-based advisory lock (atomic on POSIX) serializes them.
//
// IMP-02 ownership protocol (minimal local ownership — not a distributed
// lock): the mkdir gate is atomic, but mtime alone NEVER proves abandonment.
// The holder records owner identity (PID + unique token + acquiredAt) in
// owner.json inside the lock dir. Reclamation of an existing lock requires
// PROOF the owner is dead (local PID liveness via signal 0); a LIVE owner is
// never evicted no matter how stale the timestamp looks. Release removes the
// lock ONLY when the caller holds the matching ownership token — a foreign
// release is refused rather than deleting another process's lock. Residual
// risk errs fail-closed: an unresolvable owner (e.g. recycled PID) makes
// waiters wait, never corrupt dist/.
//
// ROUND-2 fail-closed hardening: UNKNOWN OWNERSHIP IS NEVER PROVEN
// ABANDONMENT. A missing, unreadable, or structurally invalid owner.json is
// classified as unknown — NOT as a reclaimable legacy lock — and is never
// evicted merely because the directory mtime looks stale. A damaged current
// claim is indistinguishable from a pre-protocol leftover, so both wait.
// Recovery of an unknown-ownership lock is explicit and manual ONLY via
// breakBuildLock(), whose caller must first verify no live builder exists.
// ---------------------------------------------------------------------------
function resolveBuildLockDir() {
  // Protocol tests may isolate themselves from the canonical production lock
  // by setting PHOTOGRAPHY_TEST_BUILD_LOCK_DIR. Production/normal builds never
  // set this and still serialize on .serve-artifacts/.build-lock.
  const override = process.env.PHOTOGRAPHY_TEST_BUILD_LOCK_DIR;
  if (typeof override === "string" && override.length > 0) return override;
  return join(ROOT, ".serve-artifacts", ".build-lock");
}
export function currentBuildLockDir() {
  return resolveBuildLockDir();
}
function buildLockDir() {
  return currentBuildLockDir();
}
function buildLockOwnerFile() {
  return join(buildLockDir(), "owner.json");
}

/** Ownership token held by THIS process (set on acquire, cleared on release). */
let heldLockToken = undefined;

function readLockOwner() {
  let raw;
  try {
    raw = readFileSync(buildLockOwnerFile(), "utf8");
  } catch {
    // No owner file at all: ownership is UNKNOWN (a torn write, an external
    // deletion, or a pre-protocol leftover) — never proven abandonment.
    return { state: "unknown" };
  }
  let owner;
  try {
    owner = JSON.parse(raw);
  } catch {
    // Unparseable claim: UNKNOWN, not legacy — a live holder may own it.
    return { state: "unknown" };
  }
  if (
    owner === null ||
    typeof owner !== "object" ||
    typeof owner.pid !== "number" ||
    typeof owner.token !== "string" ||
    owner.token.length === 0
  ) {
    // Structurally invalid claim: UNKNOWN, not legacy.
    return { state: "unknown" };
  }
  return { state: "owned", pid: owner.pid, token: owner.token, acquiredAt: owner.acquiredAt };
}

/** Local liveness check for an owner PID. EPERM (exists, un-signalable) and
 * any unresolvable error count as ALIVE — fail-closed toward waiting. Only
 * ESRCH (no such process) proves death. */
function isOwnerAlive(pid) {
  if (typeof pid !== "number" || !Number.isInteger(pid) || pid <= 0) return false;
  if (pid === process.pid) return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    if (e?.code === "EPERM") return true;
    if (e?.code === "ESRCH") return false;
    return true;
  }
}

/** Acquire the canonical-build mutex. Exported for lock-contract tests and
 * lock-owning helpers ONLY — test-harness build callers must go through
 * spawnNpmUnderBuildLock()/runBuild(). Synchronous; blocks while another
 * owner holds the lock (bounded spin via Atomics.wait). Returns the ownership
 * token for diagnostics; release is token-checked. */
export function acquireBuildLock() {
  for (;;) {
    try {
      mkdirSync(dirname(buildLockDir()), { recursive: true });
      mkdirSync(buildLockDir());
      const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      writeFileSync(
        buildLockOwnerFile(),
        JSON.stringify({ pid: process.pid, token, acquiredAt: new Date().toISOString() }) + "\n",
      );
      heldLockToken = token;
      return token;
    } catch (e) {
      if (e?.code !== "EEXIST") throw e;
      const owner = readLockOwner();
      if (owner.state === "owned") {
        if (isOwnerAlive(owner.pid)) {
          // LIVE OWNER MUST NEVER BE EVICTED solely because the timestamp
          // looks stale — wait regardless of mtime.
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
          continue;
        }
        // Concretely dead owner: safe to reclaim, then retry acquisition.
        try {
          rmSync(buildLockDir(), { recursive: true, force: true });
        } catch {
          // vanished or raced — retry
        }
        continue;
      }
      // Unknown ownership (missing/unreadable/invalid owner.json): FAIL CLOSED.
      // Age alone never proves abandonment — a live holder with a damaged
      // claim looks exactly like a pre-protocol leftover. Wait; recovery is
      // explicit via breakBuildLock() only.
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
    }
  }
}

/** Reclaim an ABANDONED build lock without holding it (test-cleanup path).
 * Removes the lock dir ONLY on PROOF no live owner exists: a concretely dead
 * protocol owner. A LIVE owner's lock is NEVER removed — returns false and
 * leaves it in place — and UNKNOWN ownership (missing/unreadable/invalid
 * owner.json) is likewise NEVER removed here: age alone never proves
 * abandonment. Use breakBuildLock() for explicit manual recovery instead.
 * This is the ONLY sanctioned way for lock-contract tests to clean up: raw
 * `rm -rf` of the lock dir can delete ANOTHER parallel worker's live lock
 * mid-build (shared-dir hazard under maxWorkers parallelism). Returns true
 * when the dir was removed or absent. Exported for lock-contract tests only. */
export function reclaimAbandonedBuildLock() {
  if (!existsSync(buildLockDir())) return true;
  const owner = readLockOwner();
  if (owner.state === "owned") {
    if (isOwnerAlive(owner.pid)) return false;
  } else {
    // Unknown ownership: fail closed — refuse even when the mtime looks stale.
    return false;
  }
  try {
    rmSync(buildLockDir(), { recursive: true, force: true });
  } catch {
    // raced — treat as reclaimed
  }
  return true;
}

/** Explicit MANUAL recovery for an unknown-ownership or orphaned build lock.
 * Removes the lock dir UNCONDITIONALLY — the caller MUST first verify no
 * live builder holds it (e.g. no build process is running), because this
 * deletes even a live owner's lock. Intended for operator/test recovery of
 * damaged claims (malformed or missing owner.json) and pre-protocol
 * leftovers, which NEVER auto-reclaim. Takes a reason string so every manual
 * recovery is auditable at the call site. Exported for lock-contract tests
 * and documented operator recovery only. */
export function breakBuildLock(reason) {
  if (typeof reason !== "string" || reason.length === 0) {
    throw new Error("breakBuildLock: a non-empty reason is required — manual lock recovery must be auditable");
  }
  try {
    rmSync(buildLockDir(), { recursive: true, force: true });
  } catch {
    // vanished under us — treat as recovered
  }
  if (heldLockToken !== undefined && !existsSync(buildLockOwnerFile())) {
    heldLockToken = undefined;
  }
}

/** Release the canonical-build mutex (must pair with acquireBuildLock in a
 * try/finally). Removes the lock ONLY when this process holds the matching
 * ownership token — a foreign release is refused, never a silent deletion of
 * another process's lock. Exported for lock-contract tests only. */
export function releaseBuildLock() {
  const token = heldLockToken;
  if (token === undefined) {
    throw new Error("releaseBuildLock: this process holds no build-lock ownership token — refusing to remove another process's lock");
  }
  const owner = readLockOwner();
  if (owner.state === "unknown") {
    if (!existsSync(buildLockDir())) {
      // Lock dir removed under us (e.g. explicit manual recovery raced the
      // holder) — nothing left to release.
      heldLockToken = undefined;
      return;
    }
    // Our claim is damaged or missing while the dir survives: someone
    // interfered with a live holder. Fail LOUD rather than silently leaking
    // the lock or deleting another owner's dir. Recover explicitly via
    // breakBuildLock() after verifying no live builder exists.
    throw new Error("releaseBuildLock: owned claim is missing or damaged while the lock dir survives — refusing silent release; recover explicitly via breakBuildLock(reason)");
  }
  if (owner.token !== token) {
    throw new Error("releaseBuildLock: ownership token mismatch — refusing to remove another process's lock");
  }
  rmSync(buildLockDir(), { recursive: true, force: true });
  heldLockToken = undefined;
}

/** Hold the canonical-build mutex for a critical section. Use this when a
 * test must mutate shared canonical inputs (dist/ or generated/asset-manifest.json)
 * across more than a single npm spawn. Nested acquires are forbidden; callers
 * already holding the lock must spawn directly. */
export function withBuildLock(fn) {
  acquireBuildLock();
  try {
    return fn();
  } finally {
    releaseBuildLock();
  }
}

/** Spawn npm under the canonical-build mutex. Synchronous (blocks this
 * process until the lock is free); returns the spawnSync result. Default
 * stdio is "pipe" so callers can capture output; pass stdio: "inherit" to
 * stream the build live. */
export function spawnNpmUnderBuildLock(args, opts = {}) {
  const run = () => spawnSync("npm", args, { cwd: ROOT, stdio: "pipe", ...opts });
  if (heldLockToken !== undefined) return run();
  return withBuildLock(run);
}

/** Isolated WP-38 preview-media paths (generated/, gitignored; never read by
 * production builds or the production gate). */
export function previewMediaDir() {
  return join(ROOT, "generated", "preview-media");
}
export function previewAssetManifest() {
  return join(ROOT, "generated", "preview-asset-manifest.json");
}

/** Ensure the isolated draft derivatives + merged preview manifest exist
 * (idempotent fast path inside scripts/media/preview-media.mjs). Runs outside
 * the build lock: it touches only generated/preview-* paths. */
export function ensurePreviewMedia() {
  const r = spawnSync("node", [join(ROOT, "scripts", "media", "preview-media.mjs")], {
    cwd: ROOT,
    stdio: "inherit",
    timeout: 30 * 60_000,
  });
  if (r.status !== 0) throw new Error(`preview-media derivation failed (exit ${r.status})`);
}

/** Explicit build invocation. Always builds; never infers from dist state. */
export function runBuild(kind) {
  if (kind === "production") {
    // Canonical production build. The npm script guards against QA-mode env
    // leakage (IMP-06 fail-closed contract).
    const r = spawnNpmUnderBuildLock(["run", "build"], { stdio: "inherit" });
    if (r.status !== 0) throw new Error(`production build failed (exit ${r.status})`);
    return join(ROOT, "dist");
  }
  if (kind === "preview") {
    // WP-38: the preview capture depicts the draft long-gallery-72 stress
    // state with RENDERED media. Derivation runs OUTSIDE the build lock (it
    // writes only the isolated generated/preview-* paths, never canonical
    // dist/), then the build consumes the merged preview manifest via the
    // ASTRO_ASSET_MANIFEST override. Production builds never set it.
    // 2026-09-12 real-archive swap: the corpus is published-only, so there is
    // no draft gallery left to derive. Skip the draft-media step and build
    // preview without the merged-manifest override.
    const r = spawnNpmUnderBuildLock(["run", "build:preview"], { stdio: "inherit" });
    if (r.status !== 0) throw new Error(`preview build failed (exit ${r.status})`);
    return join(ROOT, "dist");
  }
  if (kind === "qa") {
    // Test-only QA harness build (IMP-06): QA_PROBE selects the separate
    // test-only output directory (dist-qa/) — the canonical production
    // dist/ is never written by a QA build.
    const r = spawnNpmUnderBuildLock(["run", "build:qa"], { stdio: "inherit" });
    if (r.status !== 0) throw new Error(`qa build failed (exit ${r.status})`);
    return join(ROOT, "dist-qa");
  }
  throw new Error(`runBuild: unknown build kind ${kind}`);
}

/** Wait until a URL answers 2xx (server readiness probe). */
export async function waitForServer(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`server did not become ready at ${url}`);
}

/** SHA-256 of one file (integrity metadata inside this workflow only). */
export function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** List immediate subdirectories of a dir (state-id discovery). */
export function listStateDirs(rootDir) {
  if (!existsSync(rootDir)) return [];
  return readdirSync(rootDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}
