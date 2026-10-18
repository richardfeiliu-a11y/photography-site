#!/usr/bin/env node
// scripts/deploy/atomic-deploy.mjs — WP-53: atomic deploy with rollback.
//
// Usage:
//   node scripts/deploy/atomic-deploy.mjs --root <deploy-root> --release <release-dir> [--check <path>] [--redirects <path>]
//
// The script:
//   1. Acquires an exclusive lock (mkdir atomicity).
//   2. Snapshots the pre-switch state of the `current` symlink (inside the
//      lock, before any operation): absent / symbolic-link / abnormal.
//   3. Validates the release manifest (sha256).
//   3b. Validates the redirects config (--redirects, optional but fail-closed):
//       the file must exist and be non-empty, otherwise the deploy aborts
//       before anything is switched. This closes the F4 glob loophole — nginx
//       `include /var/www/redirects*.conf;` silently passes when the glob
//       matches nothing, so without this check a missing/empty redirects.conf
//       would deploy a release that has lost all its 301s with no detection.
//   4. Records the previous target as "previous".
//   5. Atomically switches the "current" symlink to the new release.
//   6. Performs a content check (optional /health probe).
//   7. On failure, rolls back ONLY if the switch actually happened; a failure
//      before the switch never touches `current`. First-publish failure
//      (nothing to roll back to) removes the failed `current` (option A).
//   8. Releases the lock.
//
// Shared primitives (R8/I5): the lock, current-symlink snapshot/switch/restore
// and the release+redirects validation are EXPORTED here and reused by
// scripts/deploy/deploy-transaction.mjs — the §3.3 coupled deploy transaction
// runs the SAME primitives, not a second implementation. This file stays the
// single source for those semantics.
//
// Non-production drill: operates on a local --root directory.
import { existsSync, lstatSync, mkdirSync, readlinkSync, renameSync, rmSync, statSync, symlinkSync, unlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
// F2: reuse the assembly-side manifest validator (path safety, duplicates,
// sha256, symlink rejection, full-closure coverage) instead of duplicating
// it — the deploy entry must run the SAME validation as assembly. The CLI
// guard in assemble-release.mjs means importing it has no side effects.
import { validateManifest } from "../release/assemble-release.mjs";

export function acquireLock(lockDir) {
  try {
    mkdirSync(lockDir, { recursive: false });
    return true;
  } catch {
    return false;
  }
}

export function releaseLock(lockDir) {
  try { rmSync(lockDir, { recursive: true, force: true }); } catch {}
}

/**
 * Snapshot the pre-switch state of the `current` symlink. MUST be called
 * inside the lock, before any operation. ENOENT -> { hadCurrent: false };
 * symlink -> target captured (dangling target rejected); dir/file ->
 * abnormal state, rejected before anything is touched.
 */
export function snapshotCurrent(current) {
  try {
    const st = lstatSync(current);
    if (st.isSymbolicLink()) {
      const oldTarget = readlinkSync(current);
      // oldTarget may be relative or absolute; resolve it relative to the
      // link's own directory (resolve(dirname, target)), never against cwd.
      const targetReal = resolve(dirname(current), oldTarget);
      if (!existsSync(targetReal)) {
        throw new Error(`current points to non-existent target: ${oldTarget}`);
      }
      return { hadCurrent: true, oldTarget };
    } else if (st.isDirectory() || st.isFile()) {
      throw new Error(`current exists but is not a symlink (type: ${st.isDirectory() ? "dir" : "file"})`);
    }
  } catch (e) {
    if (e && e.code === "ENOENT") return { hadCurrent: false, oldTarget: null };
    throw e;
  }
  return { hadCurrent: false, oldTarget: null };
}

/** Atomic switch: temp symlink + rename over current. Caller holds the lock. */
export function switchCurrent(root, release) {
  const newCurrent = join(root, ".current-new");
  const current = join(root, "current");
  try { unlinkSync(newCurrent); } catch {}
  symlinkSync(release, newCurrent);
  renameSync(newCurrent, current);
}

/**
 * Restore the pre-switch state of `current` (caller holds the lock):
 * re-point to oldTarget, or — first-publish failure (option A) — remove the
 * failed current, returning to a clean never-deployed state.
 */
export function restoreCurrent(root, hadCurrent, oldTarget) {
  const current = join(root, "current");
  const rollbackLink = join(root, ".current-rollback");
  if (hadCurrent) {
    const rollbackTarget = resolve(dirname(current), oldTarget);
    try { unlinkSync(rollbackLink); } catch {}
    symlinkSync(rollbackTarget, rollbackLink);
    renameSync(rollbackLink, current);
  } else {
    unlinkSync(current);
  }
}

/**
 * Shared release/redirects validation (same for this CLI and the coupled
 * transaction): the release manifest must validate fully, and a redirects
 * config passed for activation must exist and be non-empty (the nginx glob
 * include is otherwise a silent no-op). Returns a list of problems; empty
 * means the deploy may proceed.
 */
export function validateReleaseAndRedirects(release, redirects) {
  const problems = [];
  const manifestPath = join(release, "manifest.json");
  if (!existsSync(manifestPath)) {
    problems.push("release missing manifest.json");
    return problems;
  }
  const manifestErrors = validateManifest(manifestPath, release);
  for (const e of manifestErrors) problems.push(`release manifest invalid: ${e}`);
  if (redirects) {
    if (!existsSync(redirects)) {
      problems.push(`redirects config missing: ${redirects}`);
    } else if (statSync(redirects).size === 0) {
      problems.push(`redirects config empty: ${redirects}`);
    }
  }
  return problems;
}

function main() {
  const args = process.argv.slice(2);
  let root = null;
  let release = null;
  let check = null;
  let redirects = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--root" && args[i + 1]) root = resolve(args[i + 1]);
    if (args[i] === "--release" && args[i + 1]) release = resolve(args[i + 1]);
    if (args[i] === "--check" && args[i + 1]) check = args[i + 1];
    if (args[i] === "--redirects" && args[i + 1]) redirects = resolve(args[i + 1]);
  }
  if (!root || !release) {
    console.error("usage: node scripts/deploy/atomic-deploy.mjs --root <deploy-root> --release <release-dir> [--check <path>] [--redirects <path>]");
    process.exitCode = 2;
    return;
  }

  const lockDir = join(root, ".deploy-lock");
  const current = join(root, "current");
  const previous = join(root, "previous");

  // 1. Acquire lock.
  if (!acquireLock(lockDir)) {
    console.error("[atomic-deploy] another deploy is in progress (lock held)");
    process.exitCode = 1;
    return;
  }

  // State snapshot variables: captured inside the lock, before any operation.
  let hadCurrent = false;
  let oldTarget = null;
  let switched = false;

  try {
    // 2. Snapshot the pre-switch state of `current`.
    ({ hadCurrent, oldTarget } = snapshotCurrent(current));

    // 3. Validate release manifest + (optional) redirects config — shared
    //    implementation, identical to the coupled deploy transaction.
    const problems = validateReleaseAndRedirects(release, redirects);
    if (problems.length > 0) {
      console.error("[atomic-deploy] deploy validation failed:");
      for (const p of problems) console.error(`  - ${p}`);
      process.exitCode = 1;
      return;
    }

    // 4. Record current target as previous (only when a current existed).
    if (hadCurrent) {
      try { unlinkSync(previous); } catch {}
      symlinkSync(oldTarget, previous);
    }

    // 5. Atomic switch: create new symlink then rename over current.
    switchCurrent(root, release);
    switched = true; // settled immediately after the rename succeeded.

    // 6. Content check: verify a required file exists in the switched target.
    //    Local-drill equivalent of an HTTP /health probe; failure throws so
    //    the catch below rolls back to the previous target.
    if (check) {
      const probe = join(current, check);
      if (!existsSync(probe)) {
        throw new Error(`content check failed: ${check} missing in switched target`);
      }
    }

    console.log(`[atomic-deploy] switched current -> ${release.split("/").pop()}`);
    console.log(`[atomic-deploy] previous recorded`);
  } catch (e) {
    const err = e;
    console.error(`[atomic-deploy] failed: ${String(err && err.stack || err)}`);
    // Rollback: only if the switch actually happened. A failure before the
    // switch (manifest parse/validation, snapshot rejection) left `current`
    // untouched — doing nothing here is correct.
    if (switched) {
      try {
        restoreCurrent(root, hadCurrent, oldTarget);
        if (hadCurrent) {
          console.error(`[atomic-deploy] rolled back to previous target: ${oldTarget.split("/").pop()}`);
        } else {
          console.error("[atomic-deploy] first publish failed; current removed");
        }
      } catch (rollbackErr) {
        // Rollback itself failed: re-read the actual state and report it,
        // plus the rollback error itself for diagnosis.
        const curState = (() => {
          try { return `current -> ${readlinkSync(current)}`; } catch { return "current state unreadable"; }
        })();
        console.error(`[atomic-deploy] recovery incomplete: ${curState}; manual intervention required`);
        console.error(`[atomic-deploy] rollback error: ${String(rollbackErr && rollbackErr.stack || rollbackErr)}`);
        // Exit code stays 1 (set by the original failure); stderr already
        // distinguishes "original failure" from "recovery failure".
      }
    }
    process.exitCode = 1;
  } finally {
    // 8. Release lock.
    releaseLock(lockDir);
  }
}

if (process.argv[1] && process.argv[1].endsWith("atomic-deploy.mjs")) {
  try {
    main();
  } catch (e) {
    console.error(String((e && e.stack) || e));
    process.exitCode = 1;
  }
}
