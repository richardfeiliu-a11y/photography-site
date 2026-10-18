# 0902｜研究｜实现消融审计矩阵

**Status:** ANALYSIS COMPLETE — no code modified
**Date:** 2026-09-02
**Audited implementation:** `.worktrees/production-dev` @ `4c4e15a` (branch `production-dev`, P4/P5 integration)
**Accepted specification:** Tier 1 `research/FINAL_DESIGN_SPECIFICATION.md` v1.0 (FROZEN) · Tier 2 `research/production-architecture/` · Tier 3 red-team freeze evidence · Tier 4 `research/production-implementation/PRODUCTION_IMPLEMENTATION_PLAN.md` + companion docs
**Method:** Inventory of every non-trivial fallback / guard / retry / normalization / flag / duplicated validation / duplicated state / abstraction / adapter / special case / defensive branch in `src/` and `scripts/` (~12.6k implementation lines; tests inventoried only as evidence), then classification against evidence classes A–E, then ablation experiment design for every UNPROVEN_COMPLEXITY item.

---

## 0. Evidence classes and verdict rules

| Class | Meaning | Example in this repo |
|---|---|---|
| A | Explicit accepted requirement (FDS §, architecture §, WP acceptance) | §13.1 18 build-blocking rules → fail-closed gate |
| B | Documented invariant inside accepted docs/code contract | IMAGE_PIPELINE §10.4 "srcset never regex-derived" |
| C | Reproduced production failure / measured incident | WP-36 reviewer-measured e2e flake → settleSequence |
| D | Regression test tied to a real requirement | §13.1 invalid-fixture library (one file per failure mode) |
| E | Measurable environmental constraint | node strip-types needs explicit extensions; Safari ≥ 14 |

**Not accepted as justification** (per audit charter): "safer", "future-proof", "best practice", "for compatibility" — unless backed by A–E.

Verification suite (identical for every experiment): `check` · `test:unit` · `test:integration` · `test:e2e` · `test:a11y` · `validate:content` · `validate:sources` · `media:pipeline` (real corpus) · `build` · `build:preview` · `capture:diff` (must remain identical; informational by governance).

**Key gate-timing fact (verified):** the content gate runs at `astro:build:start` (scripts/validate/astro-gate.mjs:106) — *before* page generation. This is the load-bearing fact behind several redundancy verdicts below.

---

## 1. Classification summary

| Class | Count (items / grouped families) | Implementation lines implicated |
|---|---:|---:|
| PROVEN_REQUIRED | 21 families | majority of src/ + scripts/ (the gates, scanners, planners, contracts) |
| EMPIRICALLY_REQUIRED | 8 families | ~700 lines (scanner measured-tolerance, pruning, sentinels, capture discipline) |
| UNPROVEN_COMPLEXITY | 46 items in 13 ablation groups | **~600–680 lines removable** (≈5% of implementation) |
| UNKNOWN | 6 items | ~40 lines (cheap experiments decide) |
| Consolidation debt (not ablatable under rules) | 16 cross-file families | ~350 lines (would require new shared abstractions — out of Phase-1 scope) |

Plus 2 **hazards** found (inverted API default; false code comment) and 1 **negative finding**: no NUL-byte/corruption incident exists anywhere in the corpus — any code justified by such an incident is misjustified (none was found; the zsh NUL memory is host-tooling lore, not a repo incident).

---

## 2. PROVEN_REQUIRED register (do not ablate)

| Family | Items covered | Evidence |
|---|---|---|
| Fail-closed content gate chain: `content-schemas.ts`, `validate/{gallery,place,production}.ts`, `scripts/validate/content.ts`, invalid-fixture library | §13.1 ×18 rules (A); WP-08/09/13 acceptance (A); forbidden-field distinct rule tokens = WP-09 RED set (A) — covers SRC-08/09-core/11/12/13 |
| Build-mode machinery `resolveGatePlan` + `mode.ts` + dual build | BUILD_AND_ROUTING §6 "environment configuration, never content inspection", fail-closed default, exactly-one-mode error (A); UD-009 preview mode (A) |
| Privacy scanner core: exhaustive final-byte scan, TIFF/ISOBMFF walks, `MAX_IFD*` bounds (MP-15), EOI-trailer guard (MP-05), master-untouched double checksum (MP-14/PP-06) | IMAGE_PIPELINE §7/§7.3/§11.1 (A/B); WP-21 "final bytes, never sampled" (A); checksum-before/after mandated by plan WP-21 (A) |
| Stage-order guard `stage-order.ts` (incl. verbose reporting) | WP-18; CR-01 plan-review finding reordered WP-19/21/22 (C) |
| Coverage closure `coverage.ts` core join + fail-closed row direction | §13.1#18 (A); WP-23 (A) |
| Manifest contract: canonical serializer, typed fail-closed `ManifestConsumptionError`, producer-before-consumer gates, §10.4 no-filename-parsing tripwires | §10/§8.3 (B); WP-22/24 RED (A/D) |
| Redirect graph checks (single emission) + canonical include generation posture | §13.1#15/16 (A); BUILD_AND_ROUTING §5 (A) |
| Home featured warn-and-fallback chain (SRC-31) | ADR-019 + IMP-03 plan-review correction (A/C) |
| Deterministic issue ordering `compareProductionIssues` (SRC-20) | UD-003 (A) — the duplication of its sort key (X-04) is debt, not the invariant |
| CJK captionLang detection (SRC-51), `Intl.Collator` ordering (SRC-58), CJK 1.75 | FDS §2.2/G1; RUNTIME §3 (A); misordering cases measured (C) |
| Preview sentinel mechanism: `ViewCover.missing`, `isDraft` threading, render guards SRC-41/49/61/63/69/77 | UD-009 draft-visible preview + honesty rule IMP-03 (A); drafts legitimately lack derivatives (E) |
| Continuation defensive degradation (SRC-52) | REQUIRED in preview: next-gallery may be a draft, so map-miss → frozen no-next variant is the specified behavior; docblock's "defensive" framing only applies to the production branch |
| `/qa-probe` route + `qaProbeGate` + `QA_PROBE=1` (SRC-80, QP-01) | IMP-06 correction after measured production leak (C); suite dependency for token/font e2e probes (D) |
| `window.__qaObserverTargets` (SRC-59) | e2e assertion surface for a §3.1 G5 behavior (D) — removable only with test rewrite (AB-11) |
| `svh` fallbacks (SRC-76) + global.css contract comment | PERFORMANCE_BUDGET.md:227 pins Safari ≥ 14; `svh` needs 15.4 (E) |
| `ts-resolve.mjs` shim (TR-01) | node `--experimental-strip-types` requires explicit extensions; src convention is extensionless (E) |
| Dual-root manifest/repo-root fallbacks (SRC-33/40) | Astro relocating modules into dist chunks — observed environment behavior, documented (E) |
| Derive planner guards: `assertSafePhotoId` (DV-01), duplicate-photoId (DV-02), width/concurrency/mismatch checks (DV-03), width dedupe (DV-11), frozen-record validation (DV-08 core) | deterministic content-addressed naming contract §14/D8 (A/B); duplicate ids would collide filenames (C-class mechanism); no-preselection rule 1 / machine-readable decision contract (A) |
| PhotoId filename-safety `assertSafePhotoId` in naming.ts (NM-03) | photoIds become filenames/public URLs; upstream schema only enforces non-empty (B + structural necessity). The three divergent safety rules (X-06) are debt, not the invariant |
| Prune-after-write + empty-source guard (PP-01/PP-03) | manifest-closure restoration; crash-window rationale documented; regeneration tests (B/D) |
| Naming re-verification of WP-21 report + byte-drift check (NM-04/NM-06) | "fingerprinting unverified bytes is forbidden" — requires-verified-final-bytes boundary enforcement (B) |
| WP-15/16 bench campaigns + fixtures registry + integrity snapshot guard (except BN-03 recovery script) | D1–D9 deferred decisions resolved at gates; no-preselection grep gates (A) |
| Font CSS emission from real cmaps + missing-font fail-fast (FN-05) | "honest unicode-range" mandate (A/B); subset-poc.mjs excluded (UNPROVEN) |
| Rhythm enumeration duplicated TS/CSS (SRC-83) | structural: CSS cannot import TS; not an ablation item |

---

## 3. EMPIRICALLY_REQUIRED register (justified by measurement/incident; do not ablate)

| Item | Evidence |
|---|---|
| MP-03/04 post-SOS marker handling | Measured on frozen toolchain's q75 progressive output (8 DHT + 8 SOS post-SOS) — removal would reclassify real derivatives as malformed (C/E) |
| MP-08 exact producer box contract `ftyp→meta→mdat` (R-01) | Independently verified across generated AVIF outputs (C) |
| MP-06 Exif-item offset fallbacks | libheif measured behavior documented (E) |
| DS-01/02 structured decode-error records, DS-03 mislabel detection | `never-throws` walker contract with §14 matrix tests (D); mislabeled bytes = corrupt-for-pipeline (B) |
| Capture `settleSequence` discipline | Root-caused 20–40% reviewer-measured flake (C) |
| P5-GATE process guards (assert-or-grep scripted edits, ×3 green runs) | WP-35/WP-37 integrity incidents (C) — process, not code |
| CL-04/DV-06 optional-record bypass | avoids duplicate metadata read in pipeline chain (measurable cost, harmless) |
| BN-01 capability probe, BN-14 PSNR→null | measured platform/JSON constraints (E) |

---

## 4. UNPROVEN_COMPLEXITY register + ablation experiments

Each experiment: remove exactly one behavior; no replacement abstraction; run the full suite (§0); state the observable that would prove necessity.

### AB-01 — Dead code sweep (11 items) — **RANK 1**
| Item | Location | Lines |
|---|---|---:|
| `subset-poc.mjs` unwired PoC | scripts/fonts/subset-poc.mjs | 145 |
| `wp15-fill-measure.ts` one-off recovery script | scripts/bench/campaigns/ | 327 |
| `scripts/stub.js` unwired scaffold | scripts/stub.js | 14 |
| `getPhotoVariants` zero-caller export | src/lib/assets/manifest.ts:260-337 | ~12 |
| `namingStagePlan()` zero-caller | scripts/media/naming.ts:156 | 4 |
| `parseManifestRows()` zero-caller | scripts/media/coverage.ts:292 | 9 |
| `classifyIngestFormat` re-export, cited consumer does not exist | scripts/media/validate-sources.ts:495 | 3 |
| `ORIENTATION_NOTE` zero-caller, comment falsely claims "pinned by tests" | scripts/media/orient.ts:28 | 7 |
| `DECODE_CHECK_NOTE` zero-caller | scripts/media/discover.ts:209 | 5 |
| `context` prop dead plumbing (zero CSS/test references, verified by grep) | src/components/GalleryCard.astro:28-35 | ~5 |
| `deriveStagePlan` / `colorStagePlan` / `fingerprintHex` / `loadManifestRows` test-only wrappers | 4 files | ~22 |
**Evidence verdict:** none of A–E. Grep-verified zero production callers. `fill-measure`'s purpose ("a prior session was killed before results JSONs were written") is complete; frozen results live in bench-output.
**Experiment:** delete the items; run suite. **Observable proving necessity:** any test failure (a "dead" export actually load-bearing). For `fill-measure`, no suite reference exists — necessity would have to come from a stated requirement to reproduce WP-15 evidence from a killed run; none exists in WP-15.md.
**Scope ≈ 555 lines · confidence very high · risk minimal**

### AB-02 — Manifest envelope tolerance (2 parsers) — **RANK 2**
`coverage.ts:211-290` (CV-02/03) and `validate/content.ts:165-222` (CT-01) each accept 4+ document shapes (legacy keys `derivatives`/`rows`/`entries`, bare arrays) though the only producer (`writeManifest`, §8.3) emits one canonical shape, and `src/lib/assets/manifest.ts` (the actual build consumer) is strictly schema-validated. Two files each re-implement tolerance with *different* key priority — a compatibility path for formats never produced.
**Experiment:** restrict both loaders to the canonical envelope shape (and canonical `sha256:` handling, CV-08); run suite. Tests that feed legacy shapes fail → those tests exist solely to pin the tolerance; amend only those.
**Observable proving necessity:** a production artifact or accepted doc requiring consumption of a non-canonical manifest shape (none found; IMAGE_PIPELINE §10 defines one).
**Scope ≈ 50 lines ×2 files · confidence high · risk low**

### AB-03 — Speculative ICC enforcement modes `warn`/`fail` — **RANK 3**
`icc-policy.ts:20-93` + `color.ts:200-212` keep three selectable modes; frozen decision D9 chose `assume` **and the decision record explicitly rejects `fail`/`warn` as adding machinery for a measured no-op condition** (pixel delta 0.0000). The code comment ("remain selectable modes for a future policy hardening") is precisely the "might be useful" justification the charter excludes — contradicted by its own acceptance document.
**Experiment:** hard-code `assume`; delete the branches and the tests that exist solely to pin the unused modes (`tests/unit/icc-policy.test.ts` mode-matrix cases, `tests/integration/icc-policy.test.ts` partial); run suite.
**Observable proving necessity:** an accepted doc requiring a selectable enforcement mode (D9 explicitly does the opposite).
**Scope ≈ 45 lines + pinning tests · confidence high · risk low**

### AB-04 — redirects.ts belt-and-braces (4 items) — **RANK 4**
- SRC-01/02: two structured errors for one physical condition (docblock: "fail-closed, belt-and-braces — both gates fire") — duplicated error emission.
- SRC-03: duplicate-old-path check **admittedly unreachable** through the loader (YAML parser rejects duplicate keys at parse time; comment in code concedes it).
- SRC-04: preview warning token `13.1#16-warn-draft-target` self-described as "documented extrapolation… §13.2 defines no warning token for this condition" — a fabricated rule ID.
**Experiment:** remove the second emission of each pair, the unreachable loop, and the extrapolated warning; run suite. Fixtures `13.16-*`/`redirect-target-is-redirect-source.yaml` must still fail production validation via the surviving gate; `redirect-draft-target.yaml` no longer warns (expected — it is an error elsewhere if it matters).
**Observable proving necessity:** an accepted §13.2 token for draft redirect targets (does not exist), or a data path that reaches `validateRedirects` with non-YAML-parsed duplicate entries (only the test-facing pure helper).
**Scope ≈ 58 lines · confidence high · risk low** (fixture assertions may pin error *counts* — adjust only count-pinning assertions)

### AB-05 — Triple validation of redirects + composer defense-in-depth — **RANK 5**
SRC-05: per-entry schema validation runs 3× per build and cross-entry validation 2× (`resolveRedirects` internally re-validates; composer validates first, then resolves). SRC-16: composer hand-filters "the schema-valid subset" with "same criteria the validator used" — a second definition of parsed. SRC-17: composer re-filters resolved redirects against published places/galleries, acknowledged to overlap WP-12's §13.1#16.
**Experiment:** have `resolveRedirects` consume the already-validated entries; drop the composer's place-side re-filter; run suite. **Observable proving necessity:** a published-dataset composition path that can receive unvalidated entries (the only loader is gate-wired).
**Scope ≈ 55 lines · confidence medium-high · risk medium** (build gate is the safety net; seeded-defect integration tests already prove the gate fires first — gate runs at `astro:build:start`)

### AB-06 — Inert/uniformity mode parameters — **RANK 6**
SRC-27 (`place.ts` accepts `mode`, never reads it; empty warnings "for interface parity"), SRC-29 (`home.ts` `_options` ignored), plus the same pattern's call-site threading.
**Experiment:** make the parameters real or remove them from the three signatures + call sites; run suite.
**Observable proving necessity:** a composer that requires uniform signatures for generic dispatch (WP-13 composes the four validators explicitly — no generic dispatch exists).
**Scope ≈ 20 lines · confidence high · risk low**

### AB-07 — `sizes` constant drift repair (uses existing owner) — **RANK 7**
`"(min-width: 900px) 33vw, 90vw"` hard-coded in `archive-data.ts:76` and `GalleryCard.astro` default while `src/lib/media.ts` exists as the anti-drift owner (SRC-43/46/70-second-part).
**Experiment:** point both at `MEDIA_FRAME_SIZES_VALUE`; run suite + `capture:diff` (must stay identical).
**Observable proving necessity:** none — this is a documented-intent module rendered ineffective.
**Scope ≈ 3 lines · confidence very high · risk minimal**

### AB-08 — Page-level re-validation (checking aspect) — **RANK 8**
`archive-data.ts:50-69` (SRC-42): every page module re-runs the full `composeArchiveValidation` "because the astro build gate has already run it". The gate fires at `astro:build:start`, before rendering; the in-process run is needed only for **data composition**, not for checking.
**Experiment:** keep composition, drop the throw-on-findings re-check (single behavior: the page-side refusal); run suite. Targeted addition: one build with seeded invalid content must still fail at the gate (existing `production-validation.test.ts` already proves this; confirm no page-render failure surface appears).
**Observable proving necessity:** a render path that executes without the gate (e.g. `astro dev` used as a verification surface — it is not in the accepted suite).
**Scope ≈ 20 lines · confidence medium · risk medium** (touches every page's data path)

### AB-09 — Scanner generality beyond the pinned producer — **RANK 9**
MP-07 (`largesize`/size==0 ISOBMFF), MP-10 (full `iloc` v0-2 variable sizes), MP-08's Adobe-XMP UUID special case — tolerance for box layouts the frozen toolchain (verified R-01: `ftyp→meta→mdat`, fixed iloc layout) never emits. Fail direction stays closed either way (unknown → finding).
**Experiment:** remove one tolerance at a time; run suite **plus** `media:pipeline` over the real corpus and the AVIF/JPEG fixture matrix.
**Observable proving necessity:** a real corpus derivative that only scans successfully with the tolerance present (if suite+corpus pass, the tolerance never fired).
**Scope ≈ 50 lines total · confidence medium-high · risk moderate** (privacy control — every removal must preserve the fail-closed default; revert on any corpus failure)

### AB-10 — Micro-redundancy batch (cosmetic/self-admitted) — **RANK 10**
BN-04 dead conditional (aggregate), DV-09 double truthiness, NM-08 `capped` computed twice, MP-13 mirrored `filesScanned`, CV-06 identity `finding()`, VS-02 type-impossible guard + VS-05 `emptyResult` (only reachable from it), MF-04 `MAX_SAFE_INTEGER` fallbacks for impossible values, NM-09 triple self-validation, SRC-08/10 doubled whitespace guards, SO-01 subsumed comment block, correction of D-04's false "pinned by tests" claim.
**Experiment:** batch remove; suite. **Observable:** any failure (none expected — all self-admitted or provably unreachable).
**Scope ≈ 70 lines · confidence high · risk minimal**

### AB-11 — Test artifact out of runtime — **RANK 11**
`window.__qaObserverTargets` (SRC-59): e2e could observe the same fact via DOM/`data-` attributes.
**Experiment:** rewrite the two assertions in `tests/e2e/position-annotation.spec.ts` to DOM queries; delete the global; run `test:e2e`.
**Observable proving necessity:** none — the global is an implementation convenience.
**Scope ≈ 3 prod lines (+ test edits) · confidence medium · risk low-medium** (e2e determinism discipline must be preserved)

### AB-12 — `--no-prune` pipeline toggle — **RANK 12**
F-05: `--no-coverage` is required (documented P5-GATE command); `--include-drafts` is required (same); `--no-prune` has no found usage.
**Experiment:** grep docs/tests/history for `--no-prune`; if unused, remove the flag branch only; suite.
**Observable proving necessity:** a documented workflow pruning-skip (none found).
**Scope ≈ 4 lines · confidence medium · risk minimal**

### Not ablated, flagged
- **MP-12 (hazard):** `verifyPrivacy` defaults to *not* throwing; `finalizeAndVerify` defaults to *throwing* — same flag name, inverted defaults in one module. Not a scope item; recommend alignment with a call-site audit (behavior change, not ablation).
- **SRC-11:** rhythm error message names the rejected variant `'spacious'` — 1 line of message text; harmless but strictly the only "rejected variant" text in runtime; cosmetic.
- **UNKNOWN (cheap experiments decide):** MF-01 `source_hash` mirror (artifact-contract question — changing it alters the frozen manifest shape; leave unless §10 says otherwise), BN-05 `--reduced` (check whether the frozen results JSON used it before removing), CL-02 `defaultOnLog`, MP-09 `infe` version gating (fail direction already closed), BN-13/BN-02-class null handling.

---

## 5. Consolidation debt — observed duplication NOT ablatable under Phase-1 rules

Removing these requires introducing a shared abstraction (forbidden by experiment rule 3). Recorded for a future consolidation pass, not for ablation:

X-01 four plan-validator wrappers (~40) · X-02 seven parallel error classes (~30) · X-05 five directory walkers (~80) · X-09 ten CLI arg-parsers/direct-invocation detectors (~200) · X-10/X-MG-01 three findings printers (~20) · X-11/AG-03 duplicated gate spawn scaffolding (~30) · X-14 four file-hash helpers (~30) · SRC-23/27/28/30 four `issueFromZod` copies (~110) · SRC-41/SRC-61 twin preview sentinel adapters (~28) · SRC-66/67/68 country-in-region heuristic ×2 + double year parsing (~20) · SRC-54 `toPlaceRef` copy · CV-09/CT-03/PP-02 content walkers · X-06 three divergent photoId safety rules · SRC-55 two year-grouping implementations · SRC-43-class literal drift (fixed by AB-07) · FN-02/03 duplicated unicode-range formatters and fallback ranges.

---

## 6. Ranked ablation matrix (scope × confidence ÷ risk)

| Rank | Experiment | Scope (lines) | Confidence of redundancy | Regression risk | Score verdict |
|---:|---|---:|---|---|---|
| 1 | AB-01 dead code | ~555 | very high (grep-proven) | minimal | **Execute first** |
| 2 | AB-02 envelope tolerance | ~50 | high | low | Execute |
| 3 | AB-03 ICC unused modes | ~45 | high (contradicted by its own D9 record) | low | Execute |
| 4 | AB-04 redirects belt-and-braces | ~58 | high (self-admitted) | low | Execute |
| 5 | AB-06 inert mode params | ~20 | high | low | Execute |
| 6 | AB-07 sizes drift | ~3 | very high | minimal | Execute |
| 7 | AB-10 micro batch | ~70 | high | minimal | Execute |
| 8 | AB-05 triple redirect validation | ~55 | medium-high | medium | Execute with care |
| 9 | AB-08 page re-validation check | ~20 | medium | medium | Execute with seeded-defect proof |
| 10 | AB-09 scanner generality | ~50 | medium-high | moderate | Execute one tolerance at a time; revert on any corpus failure |
| 11 | AB-11 QA global out of runtime | ~3+tests | medium | low-medium | Optional |
| 12 | AB-12 `--no-prune` | ~4 | medium | minimal | Optional |

**Total expected scope reduction if all ablations pass: ~600–680 lines (~5% of implementation), with zero mandated-behavior loss.** Any single test failure in an experiment is the observable that proves the removed behavior necessary — record it, revert, reclassify the item EMPIRICALLY_REQUIRED with the failing test as class-D evidence.

---

## 7. Audit-level findings (beyond the matrix)

1. **The dominant complexity theme is layered validation** (schema → validator → composer filter → page re-run → defense-in-depth). Roughly 150 lines of it is provably redundant (AB-02/04/05/08) because the gate at `astro:build:start` is the single accepted enforcement point; the rest is cheap enough to be defensible.
2. **Two self-incriminating comment patterns** mark the most reliable ablation targets: "belt-and-braces" (SRC-01/02, MP-01) and "documented extrapolation" (SRC-04). Where the implementer wrote these, no external evidence exists.
3. **One comment makes a false claim** (orient.ts `ORIENTATION_NOTE` "pinned by tests" — zero test references). This is exactly the integrity-guard class (WP-35/WP-37) the project itself polices.
4. **The speculative ICC modes contradict their own acceptance document** — D9 rejected them; the code kept them "selectable". Strongest non-dead-code finding.
5. **Preview-mode machinery is mostly PROVEN** (UD-009), but the audit confirms the *inert* parts of the mode thread (place/home `_options`) are pure uniformity.
6. **Negative finding:** no NUL-byte or byte-corruption incident exists in the research corpus; nothing in the implementation may cite one as justification (and nothing does).
7. **Hazards:** MP-12 inverted throw defaults (recommend alignment, out of ablation scope); X-04/X-06 divergent duplicated invariants (debt register).
