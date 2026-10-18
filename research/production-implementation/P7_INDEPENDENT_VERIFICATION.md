# P7 FINAL INDEPENDENT GATE-A RE-VERIFICATION

**Verification date:** 2026-09-06 (Europe/Berlin)

**Mode:** Pure verification; no implementation, content, baseline, P8/P9/P10, push, merge, or deployment action

**Candidate shorthand:** `2ca7d31`

**Resolved candidate / verified HEAD:** `2ca7d319dfefe391a5b4a8050ef3cd95b2972b95`

**Branch/worktree:** `production-dev` at `<repo>/.worktrees/production-dev`
**Final result:** **P7 IMPLEMENTATION VERIFICATION INCOMPLETE — Targeted correction required before P8.**

## 1. Executive conclusion

Gate A is **not awarded**. The WP-45 v2 correction materially improves the prior candidate: it records throttled five-run LCP/CLS measurements, Event Timing entries, page payloads, DOM counts, desktop/mobile profiles, long-72 heap readings, calibration probes, a synthetic-provision label, and a canonical performance decision record. The prior blocker is nevertheless **not closed**, because the evidence and gates do not yet support the conclusions claimed from those measurements.

The independent review found five Important defects:

1. Two repeatable LCP observations exceed the frozen `<=2.5s` STANDARD WEB TARGET. The generic P7 phrase “budgets met or explicitly adjusted with rationale” does not convert standards-based targets into project engineering budgets, and the candidate records only future P8 work rather than a governed adjustment. The raw evidence is also miscounted: it contains **14/16 PASS and 2 misses**, not 13/16 and 3 misses.
2. The INP/CI evidence is not semantically fail-closed. Overview close and jump include the setup-open interaction in the same observation window, do not group/attribute Event Timing entries by `interactionId` or target action, and take the maximum event duration from the entire window. All three interactions have identical run distributions. Isolated mutations replacing all LCP values with `99999`, all interactions with `wall-clock` zeroes, and long-72 memory with zero all still pass 25/25 performance tests.
3. The low-end-mobile memory and ADR-013 evidence is insufficient for the claimed no-virtualization verdict. The gate compares only `JSHeapUsedSize` to 200MB; the field called `decodedImageBytes` ordinarily sums transferred `encodedBodySize`; no renderer/GPU/decoded-image/process memory is included. No scroll-jank/frame-drop measurement exists, and DOM size is reported but is not a verdict predicate.
4. A fresh inherited build-serialization audit fails directly on the candidate: `scripts/perf/measure.mjs` and `scripts/perf/provision-workspace.mjs` are unguarded canonical-build callers. This is a class-D harness defect and may not remain unresolved under the verification contract.
5. `docs/implementation/P7-GATE.md`, the FINAL internal handoff, was not updated for the v2 correction. It still cites removed v1 stress artifacts, three-run measurements, all budgets passing, and zero P8 candidates; it also says all full-suite failures are A/B while the fresh mutex audit proves one direct D failure.

WP-42 policy/enforcement and current-corpus attribution pass independently. WP-46 mechanism and current authored-corpus coverage pass. WP-43 and final-output WP-44 cannot receive fresh final-candidate PASS because the real corpus correctly fails closed on 50 missing alts and the attempted general synthetic full-suite provision was invalid and discarded. Historical/manual evidence was read but was not substituted for a fresh independent browser run.

## 2. Candidate identity and repository state

The stop precondition was checked before substantive adjudication.

| Check | Result | Fresh evidence |
|---|---|---|
| Shorthand resolution | PASS | `git rev-parse 2ca7d31^{commit}` -> `2ca7d319dfefe391a5b4a8050ef3cd95b2972b95` |
| Exact HEAD | PASS | `git rev-parse HEAD` returned the same full SHA |
| Branch | PASS | `production-dev` |
| Initial candidate tree | PASS | `git status --porcelain=v1` returned no entries |
| Visual baseline drift from P6 Gate-A | PASS | `git diff --name-only f08adde..HEAD -- tests/baselines` returned zero paths |
| Production manifest authority | PASS | SHA-256 `3712ede60c65d0516a9745277cfe8ce24f8ac93b7fe6024798baa893412d1318` |
| Upstream relation | Informational | Local `production-dev` was 36 commits ahead of `origin/production-dev` |

The root checkout at `<repo>` was on `main`, but every candidate command and report edit was executed in the specified `production-dev` worktree. Historical memory/checkpoint information was orientation only; live Git and canonical files controlled this verdict.

## 3. Authorities and evidence reviewed

The review read the supplied verification contract and the required current authority/evidence set:

- `research/production-architecture/PERFORMANCE_BUDGET.md`
- `research/production-implementation/PRODUCTION_IMPLEMENTATION_PLAN.md`
- `research/production-implementation/PHASE_GATES.md`
- `research/production-implementation/IMPLEMENTATION_TRACEABILITY.md`
- `docs/implementation/WP-42` evidence via `decisions/ALT-POLICY.md`, implementation, tests, and live validation
- `docs/implementation/WP-43.md` and its structure/behavior/axe evidence
- `docs/implementation/WP-44.md` and SEO/sitemap implementation/tests
- `docs/implementation/WP-45.md`
- `docs/implementation/PERF-BASELINE.json`
- `docs/implementation/decisions/PERFORMANCE-BASELINE.md`
- `scripts/perf/measure.mjs`
- `scripts/perf/provision-workspace.mjs`
- `tests/integration/perf-baseline-contract.test.ts`
- `tests/integration/perf-measurements.test.ts`
- `docs/implementation/WP-46.md`
- `docs/implementation/decisions/CJK-SUBSETTING.md`
- `scripts/fonts/coverage-check.mjs` and its tests
- `docs/implementation/P7-GATE.md`
- the prior version of this independent report

## 4. Fresh command evidence

### 4.1 Static and targeted checks

| Command / probe | Result | Classification |
|---|---:|---|
| `npm run check` | PASS; 0 errors, 3 pre-existing TypeScript hints | PASS |
| WP-42 unit + enforcement tests | 11/11 PASS | PASS |
| WP-45 contract + gate tests | 25/25 PASS | Shape/arithmetic pass only; semantic mutation attacks below invalidate Gate-A reliance |
| WP-44 SEO unit + WP-46 coverage tests | 18/18 PASS (12 SEO + 6 CJK) | PASS for those bounded checks |
| Direct WP-46 production coverage CLI | PASS; 22 YAML files, 31 authored code points, 7,166 served code points | PASS |
| Actual-corpus `npm run validate:content` | exit 1; exactly 50 errors, 0 warnings | Expected class A |
| Unit suite on actual corpus, serial | 365/366 PASS; 1 failure | 1 class B build-gated failure |
| Integration suite on actual corpus, serial | 302/333 PASS; 31 failures | 30 class A/B; 1 direct class D |
| Unit + integration combined | 667/699 PASS; 32 failures | 31 expected A/B; 1 unresolved D |
| Focused build-mutex caller audit | FAIL; 1/1 failed | Direct class D |

The integration failure breakdown was freshly captured: a11y structure 3, build concurrency 2, capture integrity 3, gallery routes 1, manifest authority 1, manifest consumption 2, P4/P5 corrections 1, production validation 7, QA isolation 3, SEO 7, and views 1. All but the static mutex caller-audit failure trace to the expected actual-corpus validation failure or a downstream production build aborted by that failure.

An initial concurrent unit/integration run was rejected as invalid because both suites contend over shared build artifacts. Only the later serial runs above count.

### 4.2 Synthetic verification probes

Two independent synthetic probes were used only in temporary workspaces:

- A general copied-worktree full-suite probe omitted generated media and therefore produced manifest-resolution failures. Its 365/366 unit and 303/333 integration totals are **discarded** and are not used as candidate evidence.
- The repository-supplied `provision-workspace.mjs --build` successfully proved that 125 synthetic alts and the Long-72 publication promotion stay in a temp workspace. Its build-only output warns about Long-72 media because `/media` assembly happens later in `measure.mjs`; inspection confirmed that the actual measurement path explicitly stages both `generated/media` and `generated/preview-media` before serving. The build-only warning therefore is **not** treated as proof that the committed baseline measured missing images.

All temporary workspaces created by this independent review were moved to Trash. Four older `perf-provision-*` workspaces created on 2026-09-05 remain under the macOS temporary directory, each carrying the 125-synthetic-alt marker. They were observed read-only and not removed because they predate this review. This disproves the broader handoff implication that every synthetic provision had been cleaned, but does not by itself prove that the committed baseline run leaked its own workspace: `measure.mjs` has a `finally` cleanup path, while the standalone provision helper intentionally leaves a workspace for explicit cleanup.

## 5. Independent WP-45 data reconciliation

### 5.1 Environment and repetition

The v2 JSON records:

- five runs per page/profile, with min/max/mean/median and raw run arrays;
- a fresh browser/context path per measurement run, which supplies cold-context isolation;
- desktop 1440x900, 1x CPU, CDP network throttling;
- mobile 390x844, 4x CPU slowdown, CDP network throttling;
- a 3-second settle window;
- synthetic-valid-content provenance, production and synthetic manifest hashes, and 125 synthetic alts;
- no physical handset, no enforced heap cap, no thermal/carrier/real-GPU equivalence.

The evidence is materially more reproducible than v1, but it is incomplete in two details: the recorded `latency` values (desktop 40ms, mobile 150ms) do not equal the separately recorded labels (`rttMs` 150/300), and no explicit host hardware, actual Chromium executable version, Playwright version, Node version, or cache policy statement appears in the baseline. Fresh-context behavior can be inferred from code but should be recorded as part of the measurement contract.

### 5.2 Raw metric reconciliation

The eight page rows and two profiles match the supplied medians:

| Page order | Desktop LCP | Mobile LCP | Disposition against 2500ms |
|---:|---:|---:|---|
| 1 | 848 | 3524 | Mobile miss |
| 2 | 484 | 704 | PASS |
| 3 | 916 | 880 | PASS |
| 4 | 3812 | 1192 | Desktop miss |
| 5 | 908 | 872 | PASS |
| 6 | 488 | 708 | PASS |
| 7 | 532 | 724 | PASS |
| 8 | 488 | 700 | PASS |

Therefore the exact result is **14/16 PASS and 2/16 miss**. The committed “13/16, three misses” narrative is arithmetically inconsistent with its own table and raw JSON.

- Home mobile miss: runs `3460, 3496, 3524, 3524, 3532`; median 3524ms; min/max 3460/3532ms.
- Long-72 desktop miss: runs `3808, 3812, 3812, 3816, 3816`; median 3812ms; min/max 3808/3816ms.
- CLS is 0 in all 16 page/profile observations.
- The three Overview interaction medians are desktop/mobile `32/16`, but all three have the exact same distributions: desktop `[24,32,32,32,32]`, mobile `[16,16,16,24,24]`.
- Long-72 recorded `JSHeapUsedSize` is 764,060 bytes desktop and 1,897,836 bytes mobile. Recorded DOM nodes in the memory pass are 1,942/2,268 after the artificial 1.5x clone pressure; page-matrix DOM counts are separate.

The raw LCP miss distributions are tight and repeatable. No threshold was altered and there is no evidence of image-quality reduction. The defect is not dishonesty in the raw numbers; it is the acceptance/governance conclusion drawn from them.

## 6. Findings

### P7-IMP-01 — The two repeatable LCP misses do not satisfy the frozen P7 standard target

**Severity:** Important

**Affected criterion:** WP-45 measurement/budget decision; P7 mandatory performance criterion

**Disposition:** FAIL

`PERFORMANCE_BUDGET.md` classifies LCP `<=2.5s`, CLS `<=0.1`, and INP `<=200ms` as STANDARD WEB TARGETS. It says they apply to all sites and do not require project-specific calibration. The separate PROJECT ENGINEERING BUDGET section labels JS, CSS, 72-photo memory, and build time as aspirational and supplies the measured-baseline/adjustment policy for them.

`PHASE_GATES.md` uses the generic phrase “budgets met or explicitly adjusted with rationale.” Read in the classification system’s context, that clause permits a measured, documented decision on project engineering budgets; it does not silently reclassify a standard target as presence-only. Even under the broader alternative reading, the candidate has not completed an adjustment procedure: it records future P8/field investigation but no replacement acceptance boundary, scope, owner, expiry/revisit trigger, or Gate-A rationale that explains why a standards miss is accepted now.

Both misses are reproducible. Recording them as P8 candidates is useful, but does not make the mandatory P7 target pass. The related tests deliberately assert only `LCP > 0` and continue to pass with every LCP changed to 99,999ms.

### P7-IMP-02 — INP and promoted performance gates are not semantically fail-closed

**Severity:** Important

**Affected criterion:** WP-45 measurement contract; measured-baseline to CI-gate traceability

**Disposition:** FAIL

The Event Timing capability calibration is real: an injected 60ms handler appears as an 88ms event entry, and the throttle calibration distinguishes 860ms throttled from 44ms open-loop LCP. These prove that the browser exposes Event Timing and that CDP throttling changes load behavior. They do not prove that each production interaction row measures the intended interaction.

For Overview close and jump, the observer starts before the setup-open click. The harness then gathers all pointer/mouse entries from the full window and takes the maximum duration. It does not use `interactionId`, isolate the final target action, or require the expected state transition. Open also swallows a failed visible-layer wait. A no-entry run becomes zero and passes `<=200ms`. The identical open/close/jump distributions are consistent with all three rows reporting the shared setup-open interaction.

Three isolated mutation attacks were run against disposable copies of the candidate baseline:

1. Set every LCP median to 99,999ms: 25/25 tests still passed.
2. Replace every applicable interaction with method `wall-clock`, runs `[0,0,0]`, and zero statistics: 25/25 still passed.
3. Set Long-72 heap, DOM, and image-byte fields to zero: 25/25 still passed.

The tests validate labels, finite values, and favorable arithmetic, but do not fail on the wrong method, impossible zero values, or missing semantic measurements. The implementation record also claims a 16/16 contract + 9/9 gate split, while the fresh files contain 17 and 8 tests respectively (still 25 total).

### P7-IMP-03 — Low-end-mobile memory evidence cannot support ADR-013

**Severity:** Important

**Affected criterion:** Credible low-end-mobile long-gallery memory; ADR-013 no-virtualization verdict

**Disposition:** FAIL

The mobile profile is more than a 390px viewport: it adds 4x CPU slowdown, throttled network, fresh-context discipline, and a detached 1.5x DOM clone. It is credible as a constrained load/CPU laboratory profile. It is not a faithful device-memory measurement for the frozen memory/virtualization decision.

The gate compares only CDP `JSHeapUsedSize` against the 200MB gallery budget. It excludes browser process, renderer/native, decoded image, compositor, and GPU memory. The field named `decodedImageBytes` normally sums `PerformanceResourceTiming.encodedBodySize`—transferred compressed bytes—not decoded resident image memory, and is not included in the verdict. The 150MB mobile “cap” is explicitly read-only and never enforced.

ADR-013 section 5.2 names three evidence triggers: device-capacity memory, scroll jank/frame drops under interaction, and DOM-caused rendering overhead. The candidate predicate uses only JS heap and the Overview event numbers. It runs no scroll/frame measurement, and DOM is interpolated into prose but never affects the decision. Thus LCP misses do not automatically require virtualization, but the current evidence also cannot establish “no virtualization.” The correct disposition is unresolved measurement, not an automatic architecture change.

### P7-IMP-04 — The candidate introduces an unresolved build-harness serialization defect

**Severity:** Important

**Affected criterion:** Inherited P4/P5/P6 regression; verification harness integrity

**Classification:** D (harness defect)

**Disposition:** FAIL

The fresh focused regression test fails with:

`unguarded canonical-build callers: scripts/perf/measure.mjs, scripts/perf/provision-workspace.mjs`

The repository’s existing rule requires every test/harness caller that spawns canonical build commands to use the shared cross-process mutex or carry an explicit, justified isolated-output exemption. The two new WP-45 callers satisfy neither condition. This is not caused by the 50-alt corpus debt and remains red when the static audit runs alone. The verification contract forbids unresolved class C/D/E failures.

### P7-IMP-05 — The FINAL internal P7 handoff is materially stale

**Severity:** Important

**Affected criterion:** P7 evidence integrity and traceability

**Disposition:** FAIL

`docs/implementation/P7-GATE.md` still states:

- seven probes x two profiles x three cold runs, while v2 uses five runs and a different matrix;
- all budgets pass and zero P8 candidates, while the committed v2 record has repeatable LCP misses and explicitly lists P8 candidates;
- `PERF-STRESS.json` and `perf:stress` as repeatable evidence, though those artifacts/scripts were removed by the correction;
- every full-suite failure is attributable to content/build gating, while the focused mutex audit proves one direct class-D failure.

Because this file identifies itself as the FINAL implementation-agent handoff and is the canonical P7 evidence packet entry, these are not cosmetic historical notes. They prevent traceable, internally consistent gate evidence.

### P7-MIN-01 — Synthetic workspace cleanup is not operationally complete

**Severity:** Minor

**Affected criterion:** Synthetic provision hygiene

The independent run’s workspaces were cleaned, and `measure.mjs` has a `finally` cleanup. However, four older `perf-provision-*` directories from 2026-09-05 remain in the macOS temporary directory with the synthetic marker and 125-alt count. The standalone helper creates and intentionally leaves a workspace unless the caller separately invokes cleanup. No synthetic text appears in candidate content or the production manifest, so this is hygiene/evidence-bookkeeping rather than candidate content contamination.

### P7-MIN-02 — Policy/readiness and evidence counts are conflated in documentation

**Severity:** Minor

**Affected criterion:** Documentation accuracy

- D11/WP-42 policy decision is APPROVED/CLOSED and its enforcement hook is live. The actual corpus being publication-invalid is separate. WP-45’s phrase “WP-42 stays open” conflates decision closure with content readiness.
- The current live corpus has 50, not 52, missing-alt errors. `ALT-POLICY.md` contains a stale 52-photo activation reference.
- The performance test split is 17 contract + 8 gate, not 16 + 9, though the total remains 25.

## 7. Actual corpus and WP-42 adjudication

Fresh `npm run validate:content` produced exactly **50 errors and 0 warnings**. Every error was `WP-42:alt-missing` with file and `photos[n].alt_text` attribution. No hidden validator rule failed.

Candidate-content inspection found:

- 125 `alt_text: null` entries remain unchanged across all gallery metadata, including draft material;
- no `SYNTHETIC-ALT-PROVISION` marker in candidate content or the production manifest;
- `long-gallery-72` remains `status: draft` in the actual corpus;
- filename-derived fallback and caption-to-alt copying remain prohibited;
- the production hook is fail-closed and preview is warning-only;
- editorial authoring remains owned by WP-58/P10.

Accordingly:

- D11/WP-42 policy decision and enforcement: **PASS/CLOSED**.
- Actual production corpus readiness: **FAIL as expected editorial debt (class A)**.
- Attribution of the 50 failures: **PASS**.
- This verification did not author any alt text and did not bypass D11.

## 8. Fresh suite failure classification

| Class | Meaning in this review | Count / disposition |
|---|---|---|
| A | Expected actual-corpus editorial debt | Included among the 31 A/B failures; exactly 50 live validator errors proven |
| B | Downstream build/test blocked because production correctly fails closed on A | Included among the 31 A/B failures; no independent product regression established |
| C | Product regression | 0 independently established |
| D | Harness/evidence defect | 1 fresh suite failure, plus WP-45 semantic defects documented above; unresolved -> Gate A forbidden |
| E | Uncertain | 0 left unclassified |

The discarded synthetic full-suite probe is not included in these counts. No ambiguous failure was silently classified as A/B.

## 9. Final gate matrix

| Item | Result | Independent basis |
|---|---|---|
| Candidate identity | PASS | Exact SHA and initially clean tree verified |
| Prior P7-IMP-01 closure | **FAIL** | v2 adds measurements, but semantic/gate/memory requirements remain unsatisfied |
| WP-42 decision | PASS | D11 policy (b) APPROVED/CLOSED |
| WP-42 enforcement | PASS | Fresh 11/11 unit/integration tests; production fail-closed; preview warning-only |
| Actual 50-alt attribution | PASS (class A) | Fresh validation: exactly 50 `WP-42:alt-missing`, 0 warnings, no other errors |
| WP-43 automated accessibility | PARTIAL | Actual-corpus structure/browser build path is class A/B gated; no valid fresh synthetic browser suite |
| WP-43 manual/behavior evidence | PARTIAL | Final evidence record inspected; not independently re-executed as a fresh browser pass |
| WP-44 SEO/sitemap | PARTIAL | Fresh unit 12/12; seven final-output integration tests are class B build-gated |
| WP-45 measurement coverage | **FAIL** | Raw page data exists, but INP isolation and memory semantics are insufficient |
| LCP miss disposition | **FAIL** | 14/16 pass, 2 repeatable standard-target misses; no valid Gate-A adjustment |
| Budget/CI governance | **FAIL** | LCP presence-only gate; semantic mutations pass 25/25 |
| ADR-013 verdict | **FAIL** | No causal scroll-jank/DOM gate; JS heap-only memory cannot establish device capacity |
| Low-end-mobile validity | **FAIL for memory verdict** | CPU/network constrained, but no enforced/whole-device memory model |
| WP-46 CJK | PASS | Fresh 6/6 tests + production CLI coverage pass; recorded D12 user review inspected |
| Synthetic provision isolation | PASS | Candidate content unchanged; 125 synthetic alts and Long-72 promotion stayed in temp workspaces |
| Synthetic provision cleanup | PARTIAL | Independent probes cleaned; four older helper workspaces remain |
| Synthetic provision media semantics | PASS for actual measurement path | `measure.mjs` stages production + preview media before serving; standalone build warning not misused |
| P4/P5/P6 regression | **FAIL** | Fresh static build-mutex audit is a direct unresolved D defect |
| Manifest integrity | PASS | Production manifest SHA matches required value |
| Visual baseline integrity | PASS | Zero paths changed under `tests/baselines` from P6 Gate-A |
| Scope / P8 boundary | PASS | No WP-47/48/49 or visual-baseline implementation; no P8 started |
| P9/P10 boundary | PASS | No WP-50..60 implementation or real content authoring |
| Push / merge / deployment | PASS | None performed |

Gate A requires Critical=0, Important=0, and every mandatory P7 criterion PASS. The candidate fails the latter two conditions.

## 10. Severity totals

| Severity | Count |
|---|---:|
| Critical | 0 |
| Important | 5 |
| Minor | 2 |

## 11. Final boundary and result

**P7 IMPLEMENTATION VERIFICATION INCOMPLETE — Targeted correction required before P8.**

P8 entry remains blocked. This report does not authorize a fix, alt authoring, baseline rewrite, threshold change, P8/P9/P10 work, push, merge, or deployment.

## 12. Verification-side repository impact

This independent verification changed only this canonical report. It did not modify implementation code, tests, authored content, generated manifest/media, visual baselines, candidate commits, branch history, upstream refs, or deployment state. Test-created `dist/` was inspected, identified as a non-canonical preview artifact (24 HTML files, no root index, Long-72 present), and moved to Trash to restore the pre-verification no-`dist/` state. No verification-created temp workspace remains.
