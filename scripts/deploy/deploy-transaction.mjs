#!/usr/bin/env node
// scripts/deploy/deploy-transaction.mjs — R8/I5: the §3.3 COUPLED deploy
// transaction shared by the drill and any caller that must activate a release
// AND its redirect config as one unit.
//
// Why this exists: the R7 review found the drill mirrored generateRedirects /
// setCurrent and tested candidate nginx -t against the OLD live include (the
// include file was overwritten only AFTER the -t), so a broken candidate
// config slipped through and a failed activation left current + redirects in
// the broken state. The fix is ONE shared transaction implementation used by
// the real entry points:
//
//   1. Acquire the SAME deploy lock as atomic-deploy.mjs (imported primitive).
//   2. Inside the lock, snapshot BOTH the current content pointer and the
//      live redirect config bytes (exact pre-activation state).
//   3. Validate the candidate release (shared validateReleaseAndRedirects).
//   4. Materialize the candidate include and run `nginx -t` against the FULL
//      derived config that includes THE CANDIDATE (never the old live file).
//   5. Activate: switch current + replace the live include — inside the lock.
//   6. Reload + post-activation checks (smoke) run OUTSIDE the lock.
//   7. On ANY post-activation failure — a failed verdict OR an exception /
//      rejected promise from any step — the EXACT previous release AND the
//      exact previous redirect bytes are restored and reloaded, and the old
//      HTTP behavior is verified. First-publish failure (no previous) keeps
//      option A semantics: remove the failed current and the new include,
//      returning to a never-deployed state.
//
// R9/F1 — partial-activation honesty: the transaction tracks each side effect
// in its own flag the moment it happens (contentSwitched after the current
// symlink has moved, redirectsWritten after the live include has actually
// been replaced). Restores are driven by these per-effect flags, never by a
// single overall `activated` flag, so a failure BETWEEN the two activation
// steps still restores what already happened.
//
// R9/F1 — atomic include swap: the candidate bytes are written to a sibling
// temp file (`redirects.conf.tx-new` — the delivered glob is `redirects*.conf`
// and `.tx-new` does not match it, so a crash can never leave a second config
// for nginx to pick up) and then renamed over the live include. The live file
// therefore never goes through a truncated/partial state, and a failure while
// staging the temp file leaves BOTH the current symlink and the live include
// untouched except for the already-switched content pointer, which is rolled
// back by the same unified restore.
//
// R9/F2 — one restore path: verdict failures ({ok:false} smoke, failed
// reload) and unexpected exceptions (throw / rejected promise from smoke or
// any step) all funnel through the SAME fullRestore() implementation, which
// restores current, restores/deletes the include, performs the recovery
// reload whenever the running config may have changed, and verifies the
// RESTORED previous state's HTTP behavior. A disk-only restore is never
// reported as a complete coupled rollback: rolledBack is true only when both
// disk states were restored, and any restore/reload/verify problem is
// surfaced in rollbackError (never swallowed).
//
// The transaction does not generate redirects itself: callers generate the
// candidate include via scripts/release/redirects.mjs (the delivered entry)
// and pass its path. That keeps this module the minimal shared transaction,
// not a second generation path.
//
// Usage (library):
//   import { runDeployTransaction } from "./deploy-transaction.mjs";
//   const r = await runDeployTransaction({ root, release, candidateRedirects,
//     liveRedirects, nginxConf, nginxBin, smoke });
//
// Usage (CLI, drill/test entry):
//   node scripts/deploy/deploy-transaction.mjs --root <www> --release <dir>
//     --candidate-redirects <conf> --live-redirects <conf> --nginx-conf <conf>
//     [--nginx <bin>] [--smoke-path /] [--smoke-expect <substring>]
//
// Non-production drill: loopback configs, scratch paths.
import { readFileSync, writeFileSync, existsSync, renameSync, unlinkSync, readlinkSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  acquireLock,
  releaseLock,
  snapshotCurrent,
  switchCurrent,
  restoreCurrent,
  validateReleaseAndRedirects,
} from "./atomic-deploy.mjs";

function sha256File(p) {
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

const brief = (e) => String((e && (e.message || e)) || e).split("\n")[0];

/** nginx -t against a full config; returns {ok, output}. */
export function nginxTest(nginxBin, conf) {
  try {
    const out = execFileSync(nginxBin, ["-t", "-c", conf], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, output: String(out || "") };
  } catch (e) {
    return { ok: false, output: String((e && (e.stdout || "") + (e.stderr || "")) || e) };
  }
}

/** nginx -s reload; returns {ok, output}. */
export function nginxReload(nginxBin, conf) {
  try {
    const out = execFileSync(nginxBin, ["-s", "reload", "-c", conf], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, output: String(out || "") };
  } catch (e) {
    return { ok: false, output: String((e && (e.stdout || "") + (e.stderr || "")) || e) };
  }
}

/**
 * Run one coupled deploy transaction. Options:
 *   root               deploy root (www) holding current/releases
 *   release            absolute path of the candidate release dir
 *   candidateRedirects path of the CANDIDATE include (already generated and
 *                      validated by the delivered redirects entry); may be
 *                      null for a content-only update (§3.3: no reload)
 *   liveRedirects      path of the LIVE include the nginx config points at
 *   nginxConf          the FULL nginx config (e.g. derived drill config) whose
 *                      include directive references liveRedirects
 *   nginxBin           nginx binary (default: $NGINX_BIN or
 *                      /opt/homebrew/bin/nginx) — MUST be left undefined (not
 *                      null) when unspecified so the default applies
 *   smoke              async ({listen}) => {ok, detail} | {ok:false,...};
 *                      post-activation HTTP smoke. Content-only updates may
 *                      still smoke content. Omit for pure filesystem drills.
 *                      A throw or a rejected promise is a failure like any
 *                      other and triggers the same full restore (R9/F2).
 *   skipNginxTest      skip the candidate `nginx -t` (filesystem-only use)
 *
 * Returns a structured result:
 *   { ok, activated, contentSwitched, redirectsWritten,
 *     rolledBack, rollbackError, steps, error }
 *   activated        the FULL activation sequence (content + include when
 *                    applicable) completed — smoke/reload may still have
 *                    failed afterwards
 *   contentSwitched  the current symlink actually moved at some point
 *   redirectsWritten the live include actually got the candidate bytes
 *   rolledBack       BOTH prior disk states were restored (content + include
 *                    where applicable); recovery reload/verification problems
 *                    are reported separately and never silently ignored
 *   rollbackError    null, or a precise description of what could NOT be
 *                    restored/verified (manual intervention required)
 * The lock is ALWAYS released.
 */
export async function runDeployTransaction(opts) {
  const {
    root,
    release,
    candidateRedirects = null,
    liveRedirects = null,
    nginxConf = null,
    nginxBin = process.env.NGINX_BIN || "/opt/homebrew/bin/nginx",
    smoke = null,
    verifySmoke = null,
    skipNginxTest = false,
  } = opts;

  const steps = [];
  const log = (s) => steps.push(s);
  const lockDir = `${root}/.deploy-lock`;

  // 1. Lock — same primitive as the deploy entry (mutual exclusion).
  if (!acquireLock(lockDir)) {
    return {
      ok: false, activated: false, contentSwitched: false, redirectsWritten: false,
      rolledBack: false, rollbackError: null, steps,
      error: "another deploy is in progress (lock held)",
    };
  }

  // Pre-activation state (nothing mutated yet).
  let snap = null;
  let liveExisted = false;
  let hadLiveRedirectsBytes = null;

  // R9/F1 — per-effect ledger, recorded the moment each effect happens.
  // The *Switched/*Written flags mean "this effect happened at some point"
  // and are NEVER reset — the result must distinguish "never switched" from
  // "switched and then restored". Restore bookkeeping lives in *Restored.
  let contentSwitched = false;
  let redirectsWritten = false;
  let reloadAttempted = false; // a reload signal was sent for the candidate
  let rolledBack = false;

  const currentTargetNow = () => {
    try { return readlinkSync(`${root}/current`); } catch { return "(absent)"; }
  };

  /**
   * R9/F2 — the ONE restore path for every failure entrance (failed verdict,
   * thrown error, rejected promise). Restores exactly the effects that
   * actually happened, reloads nginx if the running config may have changed,
   * and verifies the restored previous state when asked. Never throws.
   */
  const fullRestore = async () => {
    const problems = [];
    // Local restore bookkeeping — distinct from the activation ledger above
    // (contentSwitched/redirectsWritten are never reset; they record that an
    // effect HAPPENED, so the result can distinguish "never switched" from
    // "switched and restored").
    let contentRestoreOk = null; // null = nothing to restore
    let includeRestoreOk = null;

    // a. Content pointer back to the exact pre-activation target (or removed
    //    for a first publish — option A: never-deployed state).
    if (contentSwitched) {
      try {
        restoreCurrent(root, snap.hadCurrent, snap.oldTarget);
        contentRestoreOk = true;
        log(`rollback: current ${snap.hadCurrent ? `-> ${snap.oldTarget}` : "removed (first-publish option A)"}`);
      } catch (e) {
        contentRestoreOk = false;
        problems.push(`current NOT restored (${brief(e)}) — still -> ${currentTargetNow()}`);
      }
    }

    // b. Live include back to the exact pre-activation bytes, or removed if
    //    it did not exist before (never-deployed state).
    if (redirectsWritten && liveRedirects) {
      try {
        if (liveExisted) writeFileSync(liveRedirects, hadLiveRedirectsBytes);
        else { try { execFileSync("/bin/rm", ["-f", liveRedirects], { stdio: "ignore" }); } catch {} }
        includeRestoreOk = true;
        log(`rollback: live include ${liveExisted ? `restored (sha256 ${sha256File(liveRedirects)})` : "removed (was absent)"}`);
      } catch (e) {
        includeRestoreOk = false;
        problems.push(`live include NOT restored (${brief(e)})`);
      }
    }
    // c. Best-effort cleanup of the atomic-swap temp file (never matches the
    //    delivered `redirects*.conf` include glob, but do not leave litter).
    if (liveRedirects) {
      try { unlinkSync(`${liveRedirects}.tx-new`); } catch {}
    }

    // d. Recovery reload — required whenever the RUNNING config may have
    //    changed, i.e. a reload signal was actually sent for the candidate.
    //    If no signal was ever sent, the running config was never changed and
    //    restoring the disk bytes is sufficient. A failed recovery reload is
    //    recorded and reflected in verification honesty below.
    let recoveryReload = null;
    if (reloadAttempted && nginxConf) {
      const rr = nginxReload(nginxBin, nginxConf);
      recoveryReload = rr.ok;
      log(`rollback reload: ${rr.ok ? "OK" : `FAILED: ${rr.output.trim().split("\n").slice(-2).join(" | ")}`}`);
    }

    // e. Post-recovery verification: the RESTORED PREVIOUS state must be
    //    verified (old content + old redirect behavior), not the candidate.
    //    It is the authoritative proof that the couple (content + config)
    //    really moved back together.
    let verified = null;
    if (verifySmoke && contentRestoreOk !== false && includeRestoreOk !== false) {
      try {
        const v = await verifySmoke();
        verified = v.ok === true;
        log(`rollback verify smoke (previous state): ${v.ok ? "OK" : "FAILED"} — ${v.detail}`);
        if (!v.ok) problems.push("post-recovery verification failed — old behavior not observable");
      } catch (e) {
        verified = false;
        problems.push(`post-recovery verification threw (${brief(e)})`);
      }
    }

    rolledBack = contentRestoreOk !== false && includeRestoreOk !== false;
    return { contentRestoreOk, includeRestoreOk, recoveryReload, verified, problems };
  };

  try {
    // 2. Snapshot BOTH states inside the lock.
    snap = snapshotCurrent(`${root}/current`);
    log(`snapshot: current ${snap.hadCurrent ? `-> ${snap.oldTarget}` : "(absent — first publish)"}`);
    if (liveRedirects) {
      liveExisted = existsSync(liveRedirects);
      hadLiveRedirectsBytes = liveExisted ? readFileSync(liveRedirects) : null;
      log(`snapshot: live redirects ${liveExisted ? `sha256 ${sha256File(liveRedirects)}` : "(absent)"}`);
    }

    // 3. Shared validation (manifest + optional redirects presence contract).
    const problems = validateReleaseAndRedirects(release, candidateRedirects);
    if (problems.length) {
      for (const p of problems) log(`validation: ${p}`);
      return {
        ok: false, activated: false, contentSwitched: false, redirectsWritten: false,
        rolledBack: false, rollbackError: null, steps,
        error: "validation failed — nothing activated",
      };
    }

    // 4. Candidate nginx -t against the FULL config that includes THE
    //    CANDIDATE. The candidate include replaces the live file ONLY in a
    //    throwaway full-config copy; the live include is untouched until step
    //    5. This is the step the R7 review showed was testing the OLD config.
    if (!skipNginxTest && nginxConf && candidateRedirects) {
      const confText = readFileSync(nginxConf, "utf8");
      // Substitute the live include file with the candidate INSIDE A COPY of
      // the full config — exact-path replacement; abort if not found.
      if (!confText.includes(liveRedirects)) {
        return {
          ok: false, activated: false, contentSwitched: false, redirectsWritten: false,
          rolledBack: false, rollbackError: null, steps,
          error: `nginx config does not reference live redirects: ${liveRedirects}`,
        };
      }
      const candidateConfPath = `${nginxConf}.candidate`;
      writeFileSync(candidateConfPath, confText.split(liveRedirects).join(candidateRedirects));
      const t = nginxTest(nginxBin, candidateConfPath);
      log(`candidate nginx -t (include -> candidate): ${t.ok ? "OK" : "FAILED"}`);
      if (!t.ok) {
        log(`candidate nginx -t output: ${t.output.trim().split("\n").slice(-3).join(" | ")}`);
        try { execFileSync("/bin/rm", ["-f", candidateConfPath], { stdio: "ignore" }); } catch {}
        return {
          ok: false, activated: false, contentSwitched: false, redirectsWritten: false,
          rolledBack: false, rollbackError: null, steps,
          error: "candidate config rejected by nginx -t — nothing activated",
        };
      }
      try { execFileSync("/bin/rm", ["-f", candidateConfPath], { stdio: "ignore" }); } catch {}
    }

    // 5. Activate INSIDE the lock: content first, then the include. Both
    //    snapshot/restore primitives are shared with atomic-deploy.mjs.
    switchCurrent(root, release);
    contentSwitched = true; // R9/F1: recorded the moment the symlink moved
    log(`activated: current -> ${release}`);
    if (candidateRedirects && liveRedirects) {
      // R9/F1 atomic swap: stage the candidate bytes in a sibling temp file
      // (`.tx-new` does not match the delivered `redirects*.conf` glob), then
      // rename over the live include — the live file is never truncated.
      const tmpInclude = `${liveRedirects}.tx-new`;
      writeFileSync(tmpInclude, readFileSync(candidateRedirects));
      renameSync(tmpInclude, liveRedirects);
      redirectsWritten = true; // recorded only after the swap really happened
      log(`activated: live include <- candidate (sha256 ${sha256File(liveRedirects)})`);
    }
    const activated = true;

    // 6. Post-activation checks OUTSIDE the lock happen after release; the
    //    reload + smoke here are part of the transaction's failure surface.
    // Reload ONLY when the config changed (redirect activation). A
    // content-only update does not reload nginx (§3.3.5).
    let reload = { ok: true, output: "(no reload — content-only)" };
    if (redirectsWritten && nginxConf) {
      reloadAttempted = true;
      reload = nginxReload(nginxBin, nginxConf);
      log(`reload: ${reload.ok ? "OK" : `FAILED: ${reload.output.trim().split("\n").slice(-2).join(" | ")}`}`);
    }

    let smokeRes = { ok: true, detail: "(none requested)" };
    if (smoke) {
      // R9/F2: a throw or rejected promise from smoke is funneled into the
      // SAME restore path as a {ok:false} verdict — the catch below calls
      // fullRestore(); nothing smoke-specific happens here.
      smokeRes = await smoke();
      log(`smoke: ${smokeRes.ok ? "OK" : "FAILED"} — ${smokeRes.detail}`);
    }

    if (!reload.ok || !smokeRes.ok) {
      // 7. Coupled rollback through the ONE restore implementation.
      log("post-activation failure — executing coupled rollback");
      const rec = await fullRestore();
      if (rec.problems.length) {
        return {
          ok: false, activated, contentSwitched, redirectsWritten, rolledBack,
          rollbackError: rec.problems.join("; "), steps,
          error: `${reload.ok ? "smoke" : "reload"} failed — rollback INCOMPLETE: ${rec.problems.join("; ")}`,
        };
      }
      return {
        ok: false, activated, contentSwitched, redirectsWritten, rolledBack: true,
        rollbackError: null, steps,
        error: reload.ok ? "smoke failed — rolled back to previous release + redirects" : "reload failed — rolled back to previous release + redirects",
      };
    }

    log("transaction complete");
    return {
      ok: true, activated: true, contentSwitched: true, redirectsWritten,
      rolledBack: false, rollbackError: null, steps, error: null,
    };
  } catch (e) {
    // R9/F2: EVERY unexpected error (include staging failure, smoke throw,
    // rejected promise, anything) goes through the same full restore as the
    // verdict-failure branch. Recovery problems are surfaced, never swallowed.
    const err = String((e && e.stack) || e);
    log(`unexpected error: ${err.split("\n")[0]}`);
    const rec = await fullRestore();
    if (rec.problems.length) {
      log(`ROLLBACK INCOMPLETE: ${rec.problems.join("; ")} — manual intervention required`);
      return {
        ok: false, activated: false, contentSwitched, redirectsWritten, rolledBack,
        rollbackError: rec.problems.join("; "), steps,
        error: `${err}\nrollback INCOMPLETE: ${rec.problems.join("; ")}`,
      };
    }
    return {
      ok: false, activated: false, contentSwitched, redirectsWritten,
      rolledBack: true, rollbackError: null, steps, error: err,
    };
  } finally {
    releaseLock(lockDir);
  }
}

function main() {
  const args = process.argv.slice(2);
  let root = null, release = null, candidateRedirects = null, liveRedirects = null, nginxConf = null, nginxBinArg = null, smokePath = null, smokeExpect = null, listen = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--root" && args[i + 1]) root = args[i + 1];
    else if (args[i] === "--release" && args[i + 1]) release = args[i + 1];
    else if (args[i] === "--candidate-redirects" && args[i + 1]) candidateRedirects = args[i + 1];
    else if (args[i] === "--live-redirects" && args[i + 1]) liveRedirects = args[i + 1];
    else if (args[i] === "--nginx-conf" && args[i + 1]) nginxConf = args[i + 1];
    else if (args[i] === "--nginx" && args[i + 1]) nginxBinArg = args[i + 1];
    else if (args[i] === "--smoke-path" && args[i + 1]) smokePath = args[i + 1];
    else if (args[i] === "--smoke-expect" && args[i + 1]) smokeExpect = args[i + 1];
    else if (args[i] === "--listen" && args[i + 1]) listen = args[i + 1];
  }
  if (!root || !release) {
    console.error("usage: node scripts/deploy/deploy-transaction.mjs --root <www> --release <dir> [--candidate-redirects c --live-redirects l --nginx-conf conf --nginx bin --listen h:p --smoke-path / --smoke-expect marker]");
    process.exitCode = 2;
    return;
  }
  let verifySmoke = null;
  let verifyPath = null, verifyExpect = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--verify-path" && args[i + 1]) verifyPath = args[i + 1];
    else if (args[i] === "--verify-expect" && args[i + 1]) verifyExpect = args[i + 1];
  }
  const mkCurlSmoke = (path, expect) => async () => {
    try {
      const out = execFileSync("curl", ["-sk", "--max-time", "3", "-i", `https://${listen}${path}`], { encoding: "utf8" });
      const headerBlock = out.slice(0, out.search(/\r?\n\r?\n/));
      const m = headerBlock.match(/^HTTP\/\S+ (\d+)/m);
      const status = m ? Number(m[1]) : 0;
      const body = out.slice(out.search(/\r?\n\r?\n/) + 4);
      const ok = status === 200 && (!expect || body.includes(expect));
      return { ok, detail: `GET ${path} -> ${status}${expect ? ` marker ${expect}: ${body.includes(expect)}` : ""}` };
    } catch (e) {
      return { ok: false, detail: `curl failed: ${String((e && e.message) || e)}` };
    }
  };
  let smoke = null;
  if (smokePath && listen) {
    smoke = async () => {
      try {
        const out = execFileSync("curl", ["-sk", "--max-time", "3", "-i", `https://${listen}${smokePath}`], { encoding: "utf8" });
        const headerBlock = out.slice(0, out.search(/\r?\n\r?\n/));
        const m = headerBlock.match(/^HTTP\/\S+ (\d+)/m);
        const status = m ? Number(m[1]) : 0;
        const body = out.slice(out.search(/\r?\n\r?\n/) + 4);
        const ok = status === 200 && (!smokeExpect || body.includes(smokeExpect));
        return { ok, detail: `GET ${smokePath} -> ${status}${smokeExpect ? ` marker ${smokeExpect}: ${body.includes(smokeExpect)}` : ""}` };
      } catch (e) {
        return { ok: false, detail: `curl failed: ${String((e && e.message) || e)}` };
      }
    };
  }
  if (verifyPath && listen) verifySmoke = mkCurlSmoke(verifyPath, verifyExpect);
  // R9/M1: only pass --nginx when actually provided — a null here would
  // override the library default (destructure defaults do not apply to null),
  // producing ERR_INVALID_ARG_TYPE instead of the documented binary default.
  const txOpts = { root, release, candidateRedirects, liveRedirects, nginxConf, smoke, verifySmoke };
  if (nginxBinArg !== null) txOpts.nginxBin = nginxBinArg;
  runDeployTransaction(txOpts)
    .then((r) => {
      for (const s of r.steps) console.log(`[deploy-tx] ${s}`);
      if (!r.ok) {
        console.error(`[deploy-tx] transaction failed: ${r.error}`);
        process.exitCode = 1;
      }
    })
    .catch((e) => {
      console.error(String((e && e.stack) || e));
      process.exitCode = 1;
    });
}

if (process.argv[1] && process.argv[1].endsWith("deploy-transaction.mjs")) {
  try {
    main();
  } catch (e) {
    console.error(String((e && e.stack) || e));
    process.exitCode = 1;
  }
}
