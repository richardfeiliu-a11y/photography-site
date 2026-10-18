# 0829｜研究｜实施计划独立评审

**Review date:** 2026-08-29  
**Review mode:** Independent, read-only plan review  
**Authority:** Frozen Design → Frozen Production Architecture → Implementation Planning Documents  
**Files changed by this review:** This report only

## Executive Verdict

> **IMPLEMENTATION PLAN VALID — Targeted corrections required before Plan Freeze.**

The implementation strategy is fundamentally sound: it preserves the frozen Quiet Editorial Archive product, uses the frozen Astro/static/YAML/image-pipeline/Nginx architecture, decomposes the work into a mostly executable sequence, starts visual-regression infrastructure early, separates pilot and full content ingest, and does not require material re-planning.

Plan Freeze does not pass yet. One localized but high-consequence P3 dependency error allows final derivative hashing and Manifest generation to run before the derivative bytes are final. Six additional Important planning defects affect phase-entry semantics, declared parallelism, Home fallback behavior, deferred-decision governance, release-integrity verification, and real-content execution boundaries.

| Severity | Count |
|---|---:|
| CRITICAL | 1 |
| IMPORTANT | 6 |
| MINOR | 4 |

After the listed corrections, perform **targeted verification only**. Do not repeat the full plan review and do not reopen Design or Architecture.

### Core plan status

| Area | Result |
|---|---|
| Design fidelity | PASS |
| Architecture fidelity | FAIL |
| WP dependency graph | FAIL |
| Phase gates | FAIL |
| Deferred decisions | FAIL |
| Traceability | FAIL |
| WP sizing | FAIL |
| Parallelism | FAIL |
| User-review gates | FAIL |
| TDD/verification | FAIL |
| Deployment/recovery planning | FAIL |
| Real-content/launch planning | FAIL |

“FAIL” means a targeted plan correction is required; it does not mean the underlying frozen design or architecture is invalid.

## Scope and Authority

The review used the required precedence:

1. `research/FINAL_DESIGN_SPECIFICATION.md` — frozen product and design authority.
2. `research/production-architecture/` — frozen engineering authority.
3. The five documents in `research/production-implementation/` — execution-sequencing authority only.

`research/production-architecture-red-team/TARGETED_ARCHITECTURE_FREEZE_VERIFICATION.md` was read only to confirm Architecture Freeze Gate A. No architecture decision, framework choice, identity model, media boundary, route contract, redirect architecture, or G1–G7 value was reopened.

The report was produced read-only except for this file. No production code, scaffold, dependency installation, commit, push, deployment, or P1 work was performed.

## Cross-Document Consistency

The five planning documents agree on the 60 WP identifiers, phase allocation, most explicit dependency lists, and the general owner map. A mechanical reconstruction of the 60-node index graph found all 60 nodes and no cycle.

Material disagreements remain:

- `PHASE_GATES.md:3` applies a generic predecessor-gate rule, while `PHASE_GATES.md:71` and frozen `IMPLEMENTATION_PHASES.md:315-319` explicitly allow P4 and P5 to start from the P3 exit in parallel.
- `PRODUCTION_IMPLEMENTATION_PLAN.md:421-424`, `PHASE_GATES.md:49`, and `DEFERRED_ENGINEERING_DECISIONS.md:15-16` do not agree on when D9 closes or whether WP-16 requires user approval.
- `PRODUCTION_IMPLEMENTATION_PLAN.md:353,357,1007` instructs a dangling `featured_gallery_id` to fail closed, while `CONTENT_MODEL.md:337-343` and ADR-019 require deterministic fallback.
- `IMPLEMENTATION_TRACEABILITY.md:61-66` claims complete stage-order ownership, but the WP-19–WP-22 sequence has no correct post-strip output-ICC owner and permits hashing before final bytes.
- `WORK_PACKAGE_INDEX.md:68` reports S/M/L totals of 9/37/14; the table actually contains 7/41/12.

## Dependency DAG Audit

### Mechanical graph result

- Work packages found: **60/60**.
- Cycles: **none**.
- Duplicate WP identifiers: **none**.
- Explicit index dependencies generally match each WP's `Depends on` field.

### Material graph defect

The graph is acyclic but not safe as written. Frozen `IMAGE_PIPELINE.md:141-150,153-158` requires optional approved output ICC embedding after privacy stripping and requires hashing only after every pixel and metadata transform. The plan instead:

- places output ICC embedding in WP-19 before resize/encode and privacy stripping (`PRODUCTION_IMPLEMENTATION_PLAN.md:453-458`);
- lets WP-21 privacy finalization and WP-22 hashing/Manifest generation run in parallel (`:477-494`);
- gives WP-22 only WP-20 as a prerequisite (`WORK_PACKAGE_INDEX.md:27-30`).

This is reported as CR-01 below.

The graph also contains non-authoritative shorthand such as `WP-47 start`, `all route WPs`, phase gates, and `ALL prior`. `ALL prior` is acceptable for final acceptance, but `WP-47 start` is not a stable dependency milestone for independent agents.

## Phase Gate Audit

P1, P2, P3, P4, P5, P6, P7, P8, P9, and P10 all contain evidence-bearing exit criteria rather than subjective “phase complete” wording. Tests, benchmark records, capture records, deployment scenarios, and restore-drill evidence are named.

The phase-entry model nevertheless needs correction:

- P4 and P5 are intended siblings after P3, not predecessor/successor phases.
- WP-39 is labeled P6 but is authorized to overlap the WP-34–WP-37 P5 tail (`PRODUCTION_IMPLEMENTATION_PLAN.md:711-724`), contradicting P6 entry after the P5 Gate (`PHASE_GATES.md:84`).
- WP-42 and WP-55 are simultaneously assigned to P7/P9 and declared prerequisites for entering P7/P9 (`PHASE_GATES.md:97,120`). They are legitimate pre-entry decision packages, but the current phase labels and parallel claims obscure that status.

The correct governing principle is:

> A phase may begin when its explicitly defined Entry criteria pass.

This preserves intended P4/P5 parallelism and prevents accidental early P6/P7/P9 work.

## Deferred Decision Audit

### D1–D14 summary

| Decisions | Owner assessment | Result |
|---|---|---|
| D1–D8 | WP-15/P3; downstream WP-20/WP-22 consume the record | PASS, except P3 user-review wording over-includes D8 |
| D9 | WP-16/P3 in the ledger | FAIL — RED wording assumes a path and acceptance permits drift to P7 |
| D10 | WP-16/P3 decision | FAIL — decision exists, but correct post-strip implementation owner is missing |
| D11 | WP-42 before P7 hardening | PASS |
| D12 | WP-05 PoC, WP-46 final implementation | PARTIAL — strategy is deferred correctly, but “pilot content” does not exist at WP-46 time |
| D13 | WP-55 before P9 implementation | PASS in substance; pre-entry phase semantics need clarification |
| D14 | WP-51/P9 implementation choice | PASS in substance; decision-record/ledger path needs bookkeeping cleanup |

The plan correctly keeps JPEG, WebP, and AVIF as candidates until WP-15 and keeps the Manifest format-agnostic. No page WP freezes `<picture>`, format, quality, width ladder, or DPR policy before P3.

WP-16 needs narrower language. Frozen ADR-011 documents an MVP assume-sRGB interpretation for untagged input, while D9 defers the enforcement policy (silent assume, warn, or fail). The RED contract should distinguish those two concepts and test policy control before writing the final chosen-policy assertion.

Deferred engineering decisions should remain implementation records. No new architecture ADR is required merely because D1–D14 resolves; update an architecture ADR only where the frozen `OPEN_QUESTIONS.md` process explicitly requires it.

## Traceability Audit

Sampled material requirements have real owners:

- G1–G7: implementation and verification owners present.
- Routes, static 404, no-JS navigation, no-next Gallery, captions, position annotation, Overview, and exact restore behavior: owners present.
- Photo identity, corrected-master semantics, draft leakage, explicit covers, authored publication time, redirects, source-master privacy, cache classes, total-loss restore, and visual-regression governance: owners present.
- Pilot-first real content and full archive ingest: named in WP-58/WP-59, though WP-59 is not bounded enough.

Two traceability claims are not presently executable:

1. The image stage-order row (`IMPLEMENTATION_TRACEABILITY.md:61-66`) has a phantom completeness claim because no WP correctly owns approved output ICC embedding after stripping and before hash/output.
2. The integrity-gate row (`:89-90`) points to nine WP-51 probes, but WP-51 omits the canonical sitemap-validity probe.

No broad traceability rewrite is needed. Correct the affected rows and owners only.

## Work Package Sizing Audit

The 12 actual L packages were classified by whether one independent agent can implement, test, verify, and hand off the package without absorbing another phase.

| WP | Classification | Reason |
|---|---|---|
| WP-09 | BOUNDED | One schema/identity subsystem with enumerated failures |
| WP-13 | BOUNDED | One archive-level validation merge gate |
| WP-15 | BORDERLINE | Many parameters, but one benchmark campaign and one decision record |
| WP-20 | BOUNDED | One derivative-generation stage after P3 decisions |
| WP-35 | BOUNDED | One Gallery sequence/rhythm renderer |
| WP-40 | BOUNDED | One Overview interaction state machine |
| WP-43 | BORDERLINE | Audit plus remediation may touch several components, but one a11y evidence boundary |
| WP-45 | BORDERLINE | Multi-page measurements and gate promotion, but one performance baseline record |
| WP-47 | BORDERLINE | Full visual adjudication plus P0/P1 remediation; governed by one state matrix |
| WP-53 | BOUNDED | One atomic deploy/rollback transaction |
| WP-59 | **MEGA-WP** | “Entire remaining archive” has no finite batch count or independent handoff boundary |
| WP-60 | BORDERLINE | Evidence aggregation plus first production deploy; stop conditions prevent hidden feature work |

Only WP-59 requires structural bounding. It need not be micro-split into a fixed number today; it should become an umbrella run with explicit per-batch child records, batch acceptance, resumability, and a final aggregate gate.

## TDD / Verification Audit

The sampled substantive WPs across P1–P10 generally include RED → implementation → VERIFY → acceptance → stop conditions. Documentation and decision packages appropriately use review protocols instead of artificial unit tests.

Material exceptions:

- WP-16's RED assertion partially bakes in a still-open enforcement outcome.
- WP-22 can verify hashes against non-final derivative bytes because WP-21 is not a prerequisite.
- WP-51 calls its list the canonical nine checks but omits sitemap validity.
- WP-46 asks to scan pilot content before WP-58 creates it.

These are contract defects, not a reason to require textbook TDD for every documentation task.

## Parallel Execution Audit

The broad lanes are valid: Foundation/Data, Media, Discovery UI, Gallery, Quality, and Ops have sensible merge points. P4 Discovery and P5 Gallery can proceed in parallel after P3. Shared layout WP-26 is correctly a prerequisite for WP-34 and for discovery page composition; WP-33/WP-35/WP-37 can otherwise advance independently.

Three declared overlaps are unsafe or ambiguous:

- WP-08 declares WP-09 parallel even though WP-09 depends on completed WP-08 fixtures.
- The example `WP-34/35/36/37 (after WP-33)` ignores WP-36 → WP-35.
- WP-47 and WP-48 both permit broad P0/P1 remediation while WP-48 depends only on “WP-47 start”; this does not define file ownership or a merge point.

The WP-21/WP-22 overlap is separately CRITICAL because both touch the final derivative contract and byte identity.

## User Review Gate Audit

| Gate | Classification | Reason |
|---|---|---|
| WP-15 visible image quality / payload trade-off | REQUIRED | Human photographic judgment materially improves the decision |
| WP-15 digest length and other purely technical sub-decisions | UNNECESSARY | Evidence-backed engineering choice; record, do not require approval |
| WP-16 D9/D10 technical policy record | UNNECESSARY by current ledger | `DEFERRED_ENGINEERING_DECISIONS.md` says No |
| WP-42 alt publication policy | REQUIRED | Editorial/accessibility policy |
| WP-46 CJK/Latin production rendering | REQUIRED | Subjective typography quality plus glyph evidence |
| WP-47 production visual review | REQUIRED | Frozen-design visual adjudication |
| WP-55 backup provider/tool | REQUIRED | Cost, access, custody, and operational preference affect the user |
| WP-58 pilot/pre-launch visual gate | REQUIRED | Real photographs are the product |
| WP-60 launch acceptance | REQUIRED | Production release authorization |

No additional subjective user-review gate is missing. The defect is over-inclusion of WP-16 and D8 in P3's blanket “recorded AND user-reviewed” wording.

## P3 Benchmark Audit

The intended broad order is correct:

`WP-15/WP-16 decisions → WP-19/WP-20 pipeline → WP-22 Manifest → WP-24 Astro consumption → P4/P5`.

WP-15 correctly blocks format-specific generation, and page WPs consume structured Manifest output rather than hardcoding formats. The P3 gate correctly requires regeneration, coverage, privacy, and build-time Manifest consumption.

The final-byte sub-order is not correct. Privacy stripping and approved output ICC embedding must finish before fingerprint naming, derivative hash, Manifest serialization, coverage, and downstream consumption. CR-01 provides the targeted correction.

## Visual Regression Timing Audit

PASS in substance:

- P1/WP-06 creates deterministic capture infrastructure.
- P4/WP-32 captures discovery baselines.
- P5/WP-38 captures Gallery baselines.
- P8/WP-47 performs full human-adjudicated visual regression.

The baselines are governed against frozen design values, not prototype code behavior. SHA-256 is used as artifact integrity evidence, while visual equivalence uses pixel diff plus human adjudication.

## Deployment / Recovery Planning Audit

WP-50–WP-57 correctly separate environment/Nginx, release assembly, redirect include generation, atomic deployment, staging scenarios, backup selection, backup implementation, and a clean-host total-loss restore drill.

The plan correctly preserves:

- deployment rehearsal before production launch;
- content-only no-reload behavior;
- `nginx -t` + reload for redirect config changes;
- coupled rollback of release and redirect configuration;
- backup ≠ rollback;
- RPO ≤24h and RTO ≤24h;
- clean-host restore with generated state rebuilt, not restored.

The blocking omission is WP-51's missing sitemap-validity check from the canonical nine-check integrity gate.

## P10 / Real Content Audit

The pilot-first order is correct: WP-58 precedes WP-59, and WP-60 depends on all prior work. `ALL prior` is acceptable final-acceptance semantics because phase gates and the index provide the underlying enumeration.

WP-60 is primarily evidence aggregation, the first canonical production deploy, and live verification. Its red-item stop condition prevents substantial hidden feature work.

Two corrections are required:

- WP-59 must expose finite batch boundaries, a completion ledger, per-batch validation/handoff, resumability, and an aggregate completion rule.
- WP-46 must not claim to scan “pilot content” before WP-58 creates it. WP-46 should validate the then-current corpus; WP-58 and every WP-59 batch should rerun CJK coverage, and a real-content typography recheck should be recorded when relevant.

Minor placeholder leakage also remains: WP-31 creates About placeholder copy, but no later WP explicitly replaces or approves it before launch.

## H1–H4 Verdicts

| Hypothesis | Verdict | Basis |
|---|---|---|
| H1 Phase predecessor rule vs P4/P5 parallelism | **CONFIRMED** | `PHASE_GATES.md:3` contradicts explicit P5 entry at `:71` and frozen phase graph |
| H2 WP-16 assume-sRGB preselection | **PARTIALLY CONFIRMED** | ADR-011 documents MVP sRGB interpretation, but D9 enforcement remains open; RED wording and P7 carry-forward blur the distinction |
| H3 “Critical path” terminology/incompleteness | **CONFIRMED** | No duration estimates exist, mandatory fan-ins are omitted, and the displayed chain contains multiple non-edges |
| H4 P3 user-review wording vs technical decisions | **CONFIRMED** | P3 gate requires WP-16 user review while D8–D10 are marked `User review? No` where applicable |

## Critical Findings

### CR-01 — Final derivative bytes can be hashed before privacy/ICC finalization

- **Affected documents:** `PRODUCTION_IMPLEMENTATION_PLAN.md`; `WORK_PACKAGE_INDEX.md`; `IMPLEMENTATION_TRACEABILITY.md`; `PHASE_GATES.md` P3 evidence wording.
- **Affected WPs:** WP-19, WP-21, WP-22, WP-23, WP-24.
- **Conflict:** Frozen pipeline order is transform → resize/encode → strip → optionally embed approved output ICC → hash/output. The plan embeds ICC in WP-19, permits WP-21 and WP-22 in parallel, and lets WP-22 depend only on WP-20.
- **Execution consequence:** WP-22 can hash or name a file that WP-21 later changes; Manifest hashes/URLs may not identify served bytes; optional output ICC has no correct post-strip owner; concurrent agents may write/read the same derivative set.
- **Minimum correction:** Keep WP-19 to source→sRGB transform only. Make WP-21 own privacy stripping, then approved output ICC embedding, then final metadata verification. Make WP-22 depend on completed WP-21 and remove WP-21 ‖ WP-22. Update DAG, index, traceability, P3 tests, and downstream transitive dependencies.
- **Architecture affected?** NO.
- **Design affected?** NO.
- **Targeted re-verification scope:** WP-19–WP-24 edges; IMAGE_PIPELINE stage 4–8 trace; final-byte/hash test; Manifest closure; no parallel final-derivative ownership.

## Important Findings

### IMP-01 — Phase-entry semantics are contradictory

- **Affected documents:** `PHASE_GATES.md`; `PRODUCTION_IMPLEMENTATION_PLAN.md`; `WORK_PACKAGE_INDEX.md`.
- **Affected WPs:** WP-39, WP-42, WP-50, WP-55 and phase entries P4–P9.
- **Conflict:** Generic predecessor sequencing contradicts P4/P5 siblings; WP-39 overlaps P5 despite P6 entry; WP-42/WP-55 are both in-phase packages and pre-entry requirements.
- **Execution consequence:** An executor can either serialize safe P4/P5 work unnecessarily or start P6/P7/P9 before an explicit entry contract passes.
- **Minimum correction:** Replace the generic predecessor sentence with explicit-entry authority. Preserve P4/P5 parallelism. Remove WP-39's P5-tail overlap unless it is explicitly reclassified as bounded P5 prep. Mark WP-42 and WP-55 as pre-entry decision gates completed before P7/P9 packages start; align index and parallel claims.
- **Architecture affected?** NO.
- **Design affected?** NO.
- **Targeted re-verification scope:** P4–P9 Entry lines, corresponding WP phase labels, and lane start rules.

### IMP-02 — Declared safe parallelism violates dependencies or lacks shared-file ownership

- **Affected documents:** `PRODUCTION_IMPLEMENTATION_PLAN.md`; `WORK_PACKAGE_INDEX.md`.
- **Affected WPs:** WP-08/WP-09; WP-35/WP-36; WP-47/WP-48.
- **Conflict:** WP-09 is declared parallel with the fixture package it depends on; the four-way Gallery overlap ignores WP-36 → WP-35; `WP-47 start` is not an independently verifiable milestone while both WP-47 and WP-48 may remediate the same components.
- **Execution consequence:** Agents can start against incomplete fixtures, implement position behavior before its renderer exists, or race broad hardening edits without a merge gate.
- **Minimum correction:** Remove contradictory overlap claims. Require WP-08 complete before WP-09 execution; keep WP-36 after WP-35; define WP-48 as either read-only/prep until WP-47 adjudication completes or give WP-47/WP-48 exclusive file/finding ownership plus an explicit merge gate.
- **Architecture affected?** NO.
- **Design affected?** NO.
- **Targeted re-verification scope:** all Section 4.3 examples and per-WP `Parallelizable with` fields against the index dependencies.

### IMP-03 — WP-11 overrides the frozen Home fallback algorithm

- **Affected documents:** `PRODUCTION_IMPLEMENTATION_PLAN.md`; optionally traceability wording if changed.
- **Affected WPs:** WP-11, WP-25, WP-28.
- **Conflict:** Frozen `CONTENT_MODEL.md:337-343` and ADR-019 say an invalid/non-published feature target falls back to latest published. WP-11 makes a nonexistent target fail closed and calls this a planning clarification.
- **Execution consequence:** The implementation agent receives a Tier-3 instruction that changes Tier-2 behavior and may stop valid production builds instead of applying the frozen deterministic fallback.
- **Minimum correction:** Remove the fail-closed-for-nonexistent variation. Implement the frozen algorithm exactly: valid published target wins; otherwise latest published by `published_at` DESC + ID tie-break. A warning for invalid configured ID may be recorded only if it does not replace the fallback.
- **Architecture affected?** NO.
- **Design affected?** NO.
- **Targeted re-verification scope:** WP-11 RED/acceptance/stop text, Section 16 clarification, Home trace row, and downstream HomeView tests.

### IMP-04 — D9 closure and P3 user-review rules disagree

- **Affected documents:** `PRODUCTION_IMPLEMENTATION_PLAN.md`; `PHASE_GATES.md`; `DEFERRED_ENGINEERING_DECISIONS.md`.
- **Affected WPs:** WP-15, WP-16, WP-19, WP-20.
- **Conflict:** WP-16 RED assumes a documented path and permits the enforcement decision to drift to P7; D9 assigns closure to WP-16/P3. P3 then requires WP-16 user review although D8–D10 are technical decisions marked no user review where applicable.
- **Execution consequence:** An agent may hardcode before measurement, leave D9 unresolved while downstream WP-19 starts, or wait for unnecessary user approval on a technical parameter.
- **Minimum correction:** Distinguish untagged pixel interpretation from enforcement policy. Make candidate enforcement modes testable, record D9 at WP-16/P3, then add the final assertion. Remove blanket user-review wording from WP-16/D8–D10; retain user review for visible quality/payload decisions and representative photo quality.
- **Architecture affected?** NO.
- **Design affected?** NO.
- **Targeted re-verification scope:** D8–D10 rows, WP-15/WP-16 RED and acceptance, P3 Gate wording, WP-19 dependency on the final record.

### IMP-05 — WP-51 omits sitemap validity from the canonical integrity gate

- **Affected documents:** `PRODUCTION_IMPLEMENTATION_PLAN.md`; `IMPLEMENTATION_TRACEABILITY.md`; P9 evidence references as needed.
- **Affected WPs:** WP-44, WP-51, WP-53, WP-60.
- **Conflict:** Frozen `BUILD_AND_ROUTING.md:315-329` requires nine integrity checks including sitemap validity. WP-51 splits asset closure into two probes and omits sitemap validity while still claiming nine canonical checks.
- **Execution consequence:** A release candidate can pass assembly with an invalid or draft-leaking sitemap and reach deployment.
- **Minimum correction:** Add sitemap validity/published-only verification to WP-51's blocking integrity gate. Keep both asset checks if useful, but do not count them as a replacement for sitemap validity. Align traceability and evidence bundle.
- **Architecture affected?** NO.
- **Design affected?** NO.
- **Targeted re-verification scope:** canonical nine checks → WP-51 probes → P9 evidence → WP-60 current-evidence reference.

### IMP-06 — Real-content execution is unbounded and references content before it exists

- **Affected documents:** `PRODUCTION_IMPLEMENTATION_PLAN.md`; `WORK_PACKAGE_INDEX.md`; `PHASE_GATES.md`; `DEFERRED_ENGINEERING_DECISIONS.md` D12.
- **Affected WPs:** WP-46, WP-58, WP-59, WP-60.
- **Conflict:** WP-46 scans “fixtures + pilot content,” but pilot content is created only in WP-58. WP-59 defines completion as the entire remaining archive without a finite batch ledger or handoff boundary.
- **Execution consequence:** WP-46 cannot execute its stated corpus scan; later content can invalidate glyph assumptions; one coding/content agent inherits an undefined manual migration project and cannot leave an independently verifiable handoff.
- **Minimum correction:** At WP-46 scan the then-current authored corpus and install a repeatable coverage gate. Require WP-58 and every WP-59 batch to rerun it, with user typography review on representative real CJK content when present. Convert WP-59 into an umbrella run with named batches, per-batch validation/coverage/visual evidence, resumable status, and a final aggregate completion rule.
- **Architecture affected?** NO.
- **Design affected?** NO.
- **Targeted re-verification scope:** D12 lifecycle, WP-46 corpus language, WP-58 pilot checklist, WP-59 batching/handoff/aggregate acceptance, WP-60 evidence references.

## Minor Findings

1. **MIN-01 — “Critical Path” is not a project-management critical path.** With no duration estimates, and with eight displayed hops that are not WP dependency edges, it is a Primary Dependency Spine. Rename it and list mandatory fan-ins such as WP-15 → WP-20, WP-16 → WP-19, WP-21 → corrected WP-22, WP-32/WP-38/WP-43/WP-46 → WP-47, WP-45/WP-47 → WP-48, WP-47 → WP-49, and WP-56/WP-53 → WP-57. This is terminology/representation cleanup because the per-WP graph remains authoritative.
2. **MIN-02 — Complexity totals are incorrect.** `WORK_PACKAGE_INDEX.md:68` says S=9/M=37/L=14; the actual table contains S=7/M=41/L=12.
3. **MIN-03 — About placeholder has no explicit removal owner.** WP-31 creates placeholder editorial text, but WP-58/WP-59/WP-60 do not explicitly replace or approve it. Assign final About copy/readiness to WP-58 or the WP-60 content-readiness checklist.
4. **MIN-04 — D14 record placement is inconsistent.** The ledger says decisions land under `docs/implementation/decisions/`; WP-51 currently records D14 only in its WP note. Name the decision record and require the D14 ledger row to gain path/date/evidence.

## Required Plan Corrections

Before Plan Freeze, apply exactly these targeted corrections:

1. Reorder WP-19–WP-22 so final privacy/ICC metadata state precedes hash/name/Manifest; remove WP-21 ‖ WP-22.
2. Make explicit phase Entry criteria authoritative; preserve P4/P5 parallelism; correct WP-39/WP-42/WP-55 phase semantics.
3. Remove contradictory/unsafe parallel claims for WP-08/09, WP-35/36, and WP-47/48.
4. Restore the frozen ADR-019 Home fallback in WP-11 and remove the Tier-3 override.
5. Close D9 at the declared WP-16/P3 gate, make policy candidates testable, and narrow user-review wording to actual user-judgment decisions.
6. Restore sitemap validity to WP-51's canonical release-integrity probes.
7. Bound WP-59 as a resumable batch umbrella and re-run CJK coverage on pilot/full-ingest batches.
8. Apply the four Minor bookkeeping/placeholder corrections.

All corrections are to planning documents only.

- **Architecture change required:** NO.
- **Design change required:** NO.
- **New Architecture Exception Request:** NO.
- **Full re-review after correction:** NO.
- **Required follow-up:** Targeted verification of CR-01, IMP-01 through IMP-06, and the four Minor cleanups.

## Final Gate

### B — TARGETED PLAN CORRECTIONS REQUIRED

> **IMPLEMENTATION PLAN VALID — Targeted corrections required before Plan Freeze.**

Do not begin P1 yet. After the corrections above, perform targeted verification only. The implementation strategy, frozen Design, and frozen Architecture do not require re-planning.
