# P4/P5 Closure Verification

## Repository State

- Verification worktree: `<repo>/.worktrees/production-dev`
- Branch: `production-dev`
- Verified HEAD: `7fceaaf92dc7c7210256ad9086863c5e559e17ea`
- Parent: `b43a31c5727619bf2fc37c4e67ba5d0f8c30787d`
- Subject: `fix(test): close final p4-p5 gate integrity gaps`
- The request named full SHA `7fceaaf5a3fa1e48bc8368d4f4ca2b069b124ea3`, but that object does not exist in this repository. The branch, unique short SHA `7fceaaf`, expected parent, and subject all resolve to `7fceaaf92dc7c7210256ad9086863c5e559e17ea`; this report verifies that actual commit and does not silently treat the two full SHAs as identical.
- `production-dev` is three commits ahead of `origin/production-dev`; the remote branch still resolves to `ecfe1fad494f6af4ce0ca6d0a9700a0243ddb495`. No merge, push, PR, or deployment was performed.
- Before this report was created, the only worktree entries were the two pre-existing untracked historical reviewer reports:
  - `research/production-implementation/P4_P5_TARGETED_REVERIFICATION.md`
  - `research/production-implementation/P4_P5_FINAL_TARGETED_REVERIFICATION.md`
  Neither was modified or overwritten.
- All temporary baseline mutations and independent capture/build probes were restored or removed. `git diff --check b43a31c..7fceaaf` passed.

## Diff Scope

The closure commit changes 29 files: 1,344 insertions and 83 deletions. The changes are confined to append-only implementation evidence, package test scripts, governed baseline PNGs/manifests, capture/diff/update tooling, integration tests, and test-side build/artifact helpers.

There is no diff under `src/`, `content/`, `astro.config.mjs`, `vitest.config.ts`, or `playwright.config.ts`, and no WP-39/WP-40/WP-41 implementation change. P6 was not started.

The three evidence documents are append-only and explicitly preserve/acknowledge the previous independent failures: `verifiedBaselines = 0/14`, producer `captures` versus consumer `baselines`, the 4729/4731 capture variation, and incomplete build-lock coverage. They do not claim an independent PASS. Historical claims were not erased. However, their new claim that every `state/group/file/sha256` record field is strictly validated is contradicted by the executable consumer and the missing-`group` probe below.

## Baseline Manifest Schema

**BASELINE-MANIFEST-SCHEMA: FAIL**

Verified facts:

- All three real manifests use exactly one canonical record-array key, `captures`; none contains the legacy `baselines` key.
- Record counts are discovery 6, gallery 7, preview 1, total 14.
- Every current record contains non-empty `state`, `group`, `file`, and `sha256`; all current digests are 64 lowercase hexadecimal characters.
- The consumer reads `parsed.captures` and has no compatibility fallback to `baselines`.
- The consumer's executable required-field loop at `tests/capture/diff.mjs:144` validates only `state`, `file`, and `sha256`; it does not validate `group` at all.

Independent negative proof: removing `group` from the first record of the real discovery manifest still made canonical `npm run capture:diff` exit 0 and report PASS. The manifest was restored byte-for-byte, and the final clean-state diff passed again.

Therefore the current data happens to satisfy the intended schema, but the schema validator does not fail closed on a required field. This distinction is analogous to a spreadsheet whose current rows are complete while its data-validation rule still allows future rows with a blank required column.

Minimum correction: validate `group` as a non-empty string and require it to equal the manifest unit/group; add a real missing/wrong-`group` process-exit negative test.

## Baseline SHA Integrity

**BASELINE-SHA-INTEGRITY: PASS**

The final clean-tree integrity run checked actual PNG bytes, not merely the printed identical count:

| Integrity item | Required | Observed |
|---|---:|---:|
| Governed states | 14 | 14 |
| Manifest records | 14 | 14 |
| Baseline SHAs verified | 14 | 14 |
| Manifest violations | 0 | 0 |
| Missing manifest entries | 0 | 0 |
| Missing manifest files | 0 | 0 |
| Modified baselines | 0 | 0 |
| Missing captures | 0 | 0 |
| No-baseline | 0 | 0 |
| Required failures | 0 | 0 |
| Process exit | 0 | 0 |

An independent digest pass also recomputed SHA-256 directly from all 14 committed PNG byte streams and matched every manifest digest.

## Baseline Negative Probes

**BASELINE-FAIL-CLOSED: FAIL**

The targeted suite did real temporary filesystem mutations and asserted process exits. Its requested A-F cases passed:

| Probe | Observed result |
|---|---|
| A. Mutate governed PNG bytes | Nonzero; `baseline-modified` |
| B. Remove manifest record | Nonzero; required state has no record |
| C. Add governed PNG without record | Nonzero |
| D. Record references nonexistent PNG | Nonzero |
| E. Duplicate the exact record | Nonzero; schema violation |
| F. Malformed manifest / legacy `baselines` | Nonzero |

The high-value manual probe replaced `gallery-desktop-portrait/index.png` temporarily with another tracked governed PNG. `capture:diff` exited 1 with `baseline-modified`; the original portrait baseline SHA `3792b07b272ca95a62b90aef0b390b2986231305d1d87fe325049f0d57cc61ec` was then restored and verified.

Despite those successes, the independently required-field mutation above proves the harness is not fully fail-closed: a missing required `group` field exits 0. A-F therefore establish substantial coverage but cannot support an overall PASS for the stated schema contract.

## Capture Determinism Method

**CAPTURE-FONT-DETERMINISM-METHOD: PASS**

The correction is confined to the capture browser context. `installDeterministicFonts()` intercepts CSS responses and rewrites only `font-display: optional` to `font-display: block`, failing closed if interception fails. The production font files, family declarations, typography tokens, content, viewports, image geometry, and layout code are unchanged by this commit.

The method addresses the diagnosed first-paint choice between authored and fallback fonts instead of masking output with cropping, tolerance, or normalization. Capture still waits for network idle, `document.fonts.ready`, image decode, two animation frames, and a fixed settle interval. This pins the authored-font rendering for test capture while leaving production runtime semantics untouched.

## Fresh Run A vs Run B

**CAPTURE-DETERMINISM: PASS**

`npm run capture:determinism -- --keep` launched two separate capture processes. Each run performed fresh production and preview builds, used fresh browser contexts, and wrote to a separate temporary directory. All 14 governed states were byte-identical by SHA-256, with zero tolerance.

| High-value state | Run A | Run B | Result |
|---|---|---|---|
| `gallery-desktop-portrait` | 1440×4731, `3792b07b272ca95a62b90aef0b390b2986231305d1d87fe325049f0d57cc61ec` | same | PASS |
| `gallery-desktop-ending` | 1440×5482, `49d315ddee229773067ca63b8d10c75b0f66d39c68882f65c1712f9b9672966a` | same | PASS |
| All governed states | 14 SHA matches | 14 SHA matches | PASS |

The temporary Run A/Run B directories were moved to Trash after inspection.

## Baseline Agreement

**CAPTURE-BASELINE-AGREEMENT: PASS**

Canonical `npm run capture` completed 14/14 states with exit 0. The subsequent final `npm run capture:diff` completed with exit 0: 14/14 identical, 14/14 governed SHA records verified, no baseline modification, no missing baseline/capture, and zero required failures.

This is separate from fresh Run A = Run B: both reproducibility and agreement with committed governed baselines were proven.

## Build Mutation Audit

**BUILD-MUTATION-AUDIT: PASS**

Independent search and source inspection, rather than only the structural scanner, found the following caller classes:

| Class | Caller/path | Ownership conclusion |
|---|---|---|
| A — isolated | `manifest-consumption.test.ts` direct `astro build --root <temporary probe>` | Own temporary root and temporary `dist/`; no canonical shared mutation |
| A — isolated | QA build path (`runBuild("qa")`) | Writes `dist-qa/`, not canonical `dist/`; additionally passes through the common helper |
| B — protected shared canonical | `tests/support/artifact.mjs` production/preview `runBuild()`; E2E server and capture call through it | Common `.serve-artifacts/.build-lock` ownership primitive |
| B — protected shared canonical | `tests/support/build-validation.mjs::defaultBuild()` | Calls `spawnNpmUnderBuildLock()` |
| B — protected shared canonical | `manifest-consumption.test.ts::runProductionBuild()` | Calls `spawnNpmUnderBuildLock()` |
| C — unsafe direct canonical mutation | None found | Count = 0 |

Subprocesses inside Astro validation hooks execute validation logic but do not launch another canonical Astro build. `maxWorkers: 3` is resource bounding, not the ownership mechanism.

## Build Lock Safety

**BUILD-LOCK-SAFETY: FAIL**

The lock has several correct properties: atomic POSIX `mkdir` acquisition, one common path, observable second-process waiting, `finally` release around subprocesses, release after a failing npm subprocess, bounded polling, and harness-only usage.

It nevertheless fails the required live-owner safety invariant. `tests/support/artifact.mjs:148-151` treats directory mtime older than 15 minutes as sufficient proof of abandonment and recursively removes the lock. It stores no owner PID/token, performs no process-liveness check, and has no heartbeat. `releaseBuildLock()` also removes the common directory without proving ownership.

Independent live-holder probe:

- Process 1 acquired the lock and remained alive.
- While Process 1 was alive, the lock mtime was backdated to 16 minutes.
- Process 2 exited 0 and printed `SECOND_ACQUIRED_WHILE_HOLDER_LIVE`.
- Process 1 was still alive at the moment of the second acquisition.

Thus a legitimate build lasting longer than the fixed stale threshold can lose exclusivity and allow concurrent mutation of canonical `dist/`.

Minimum correction: store an owner PID plus unique token, check local owner liveness before reclamation, maintain a heartbeat or renewal timestamp for long builds, and release only when the token still matches. Add a test with an actually live but old lock; a merely fresh lock is insufficient.

## Parallel Build Probe

**PARALLEL-BUILD-SERIALIZATION: PASS**

An independent two-process probe routed two simultaneous canonical production builds through the helper and recorded lock-critical-section timestamps:

| Process | Requested | Entered | Exited | Wait | Held | Exit |
|---|---:|---:|---:|---:|---:|---:|
| A | 1788434875840 | 1788434875840 | 1788434877436 | 0 ms | 1596 ms | 0 |
| B | 1788434875840 | 1788434877865 | 1788434878981 | 2025 ms | 1116 ms | 0 |

B entered only after A exited, so ordinary-duration critical sections did not overlap. Both builds exited 0; neither output contained a missing `dist/.prerender/chunks`/ENOENT failure. Final `dist/index.html` was present, the production output contained 20 HTML files corresponding to Astro's reported 21 pages, and `dist/qa-probe` was absent. No corrupt partial artifact was observed.

This PASS does not override the separate long-lived-lock failure: normal short contention serializes correctly, while stale-timeout reclamation can still break exclusivity for a live old owner.

## Test-Order Independence

**TEST-ORDER-INDEPENDENCE: FAIL**

The required sequences were run with normal configured parallelism and actual process exit codes. No individual-test retry was used.

| Sequence | Command | Exit | Result |
|---|---|---:|---|
| A | `npm run test:e2e` | 0 | 127/127 |
| A | `npm run test:integration` | 1 | 254/255; `preview mode + missing manifest → warns, never fatal` exceeded Vitest's 5000 ms default timeout |
| B | `npm run test:integration` | 0 | 255/255 |
| B | `npm run test:e2e` | 0 | 127/127 |
| B | `npm run test:integration` | 0 | 255/255 |
| C | `npm run test:integration` | 0 | 255/255 |

Later green full-suite runs do not erase Sequence A's real failure under the requested no-retry-to-green rule. The failing test at `manifest-consumption.test.ts:229` is asynchronous but has no explicit timeout; the required invariant is reproducible full-sequence stability, not eventual success after additional runs.

Minimum correction: diagnose the load/order-dependent delay around `loadGate()` in that full-suite context, make the test contract bounded but realistic, and rerun all A/B/C sequences without any failure. This report does not assume that merely increasing a timeout is sufficient.

## Test Integrity

**TEST-INTEGRITY: FAIL**

Positive evidence:

- `baseline-manifest.test.ts` performs real temporary PNG/manifest mutations and asserts child-process exit codes.
- `capture:determinism` creates independent temporary outputs and launches independent capture processes/builds/browser contexts.
- Build tests exercise real subprocess failure cleanup and real build processes.
- The targeted new suites themselves passed 17/17 on the correction commit.

False-green surfaces found independently:

1. No test removes or corrupts the required `group` field, so the suite remains 17/17 green while the real consumer accepts invalid schema.
2. The stale-lock test distinguishes only fresh versus old mtime; it never combines old mtime with a live owner, so it endorses unsafe reclamation.
3. The nominal mutual-exclusion test writes only `<id>.entered` markers and checks that both eventually exist. Despite comments claiming timestamp proof, it records no enter/exit timestamp or overlap flag. The independent timestamp probe supplied the missing proof for ordinary contention, but the suite itself does not.

These gaps concern proof surfaces explicitly required by this closure verification. Therefore the new tests would detect much of the exact `b43a31c` failure set, but they are not sufficiently fail-closed to support `TEST-INTEGRITY: PASS` at this commit. The implementation's self-reported historical 13-fail/2-pass RED count was not used as a substitute for current independent behavior.

## Canonical Regression Battery

**Canonical regression battery: FAIL**

| Command | Exit | Observed result |
|---|---:|---|
| `npm run test:unit` | 0 | 332/332 |
| `npm run test:integration` | 1 in required Sequence A | 254/255; three later required full-suite runs were 255/255, but no retry-to-green credit is given |
| `npm run test:e2e` | 0 | 127/127 |
| `npm run test:a11y` | 0 | 6/6 |
| `npm run check` | 0 | 0 errors, 0 warnings, 3 informational hints |
| `npm run validate:content` | 0 | 0 errors, 0 warnings |
| `npm run build` | 0 | 21 pages; post-build `qa-probe` absent |
| `npm run build:preview` | 0 | 26 pages; 13 contract-allowed draft warnings |
| `npm run media:coverage` | 0 | 1008/1008 variants; 51/51 photos complete |
| `npm run media:privacy-check` | 0 | 657 files exhaustively scanned; PASS |
| `npm run capture` | 0 | 14/14 governed states captured |
| `npm run capture:diff` | 0 | 14/14 identical; 14 SHAs verified; 0 required failures |

All non-integration commands passed. The overall battery is still FAIL because one prescribed full integration invocation exited nonzero.

## P4 Gate Matrix

| P4 criterion | Result |
|---|---|
| G3 Home hero | PASS |
| Featured ADR-019 | PASS |
| Archive photographed-year | PASS |
| Places names-led/no-count | PASS |
| Canonical production routes | PASS |
| Accessible no-JS navigation | PASS |
| Discovery VR baselines | PASS |

Rationale: the closure commit has no product-surface diff; the narrow E2E carry-forward battery passed 127/127; production routes built successfully; the current discovery baselines' bytes are SHA-verified; fresh captures are deterministic; and governed capture/diff succeeds. The manifest-validator defect remains a closure-governance blocker, but it does not make the current discovery PNG bytes or the observed P4 behavior regress.

## P5 Gate Matrix

| P5 criterion | Result |
|---|---|
| Base rhythm 96/64 | PASS |
| Authored Compact/Breathing only | PASS |
| Caption contract | PASS |
| G7 continuation/no-next | PASS |
| Position annotation | PASS |
| Non-sticky frozen header | PASS |
| Gallery VR baselines | PASS |

Rationale: there is no product-surface diff; all narrow Gallery E2E behavior remained green; current Gallery SHA governance verifies 7/7 records; fresh Run A/Run B capture is exact; and current governed captures match committed Gallery baselines. As with P4, the incomplete manifest schema enforcement blocks closure without constituting an observed Gallery product regression.

## Remaining Findings

Critical: 0  
Important: 3  
Minor: 0

| ID | Severity | Exact failed closure invariant | Minimum correction |
|---|---|---|---|
| IMP-01 | Important | Baseline manifest schema/fail-closed: missing required `group` is accepted with exit 0 | Validate non-empty and group-consistent `group`; add missing/wrong-group process test |
| IMP-02 | Important | Build-lock safety: a confirmed live owner can have its lock stolen after the fixed 15-minute mtime threshold | Owner identity/token, liveness-aware recovery, heartbeat/renewal, owner-only release, live-old-owner test |
| IMP-03 | Important | Build/test order independence: Sequence A integration exited 1 at 254/255 due a 5000 ms timeout | Diagnose and eliminate the order/load-dependent delay; rerun A/B/C fully green without retries |

No broad/material product regression was found. The schema and lock-test false-green surfaces make `TEST-INTEGRITY` fail, and the integration exit makes the canonical regression battery fail; these are consequences of the three findings above, not additional double-counted findings.

## Final Gate

> P4/P5 IMPLEMENTATION VALID — Closure verification still blocked before P6.

Gate B is required. Gate A is unavailable because `BASELINE-MANIFEST-SCHEMA`, `BASELINE-FAIL-CLOSED`, `BUILD-LOCK-SAFETY`, `TEST-ORDER-INDEPENDENCE`, `TEST-INTEGRITY`, and the canonical regression battery are not all PASS. Gate C is not warranted because no broad structural or product regression was found.

The next authorized phase is a narrowly scoped P4/P5 closure correction and independent re-verification of only IMP-01 through IMP-03. P6 production development is not authorized by this result.
