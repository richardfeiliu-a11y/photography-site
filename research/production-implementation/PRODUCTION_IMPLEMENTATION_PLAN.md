# Production Implementation Plan — Quiet Editorial Archive

**Status:** PLAN FREEZE PASS — Ready for P1 Production Development
**Date:** 2026-08-29
**Planning session verdict target:** Section 14 (Plan Review Gate)

| Authority tier | Document | Role |
|---|---|---|
| Tier 1 | `research/FINAL_DESIGN_SPECIFICATION.md` (frozen v1.0) | WHAT must be built. Wins over everything on design values. |
| Tier 2 | `research/production-architecture/` (20 canonical docs) | HOW it must be built. Single engineering authority. |
| Tier 3 | `research/production-architecture-red-team/TARGETED_ARCHITECTURE_FREEZE_VERIFICATION.md` | Evidence that Architecture Freeze passed (Gate A, 2026-08-29). Not a decision source. |
| Tier 4 | **This document + companions** | Execution sequencing authority only. Never overrides Tier 1/2. If conflict appears, this plan is corrected. |

Companion planning documents (same directory):

- `WORK_PACKAGE_INDEX.md` — compact table of all 60 work packages
- `IMPLEMENTATION_TRACEABILITY.md` — frozen requirement → architecture owner → WP → verification
- `PHASE_GATES.md` — P1–P10 exit criteria
- `DEFERRED_ENGINEERING_DECISIONS.md` — legitimate implementation-phase decisions and their owning gates

---

## 1. Repository orientation record (planning-time snapshot)

Live repository state wins over assumptions. Recorded 2026-08-29, unmodified by this planning session:

| Fact | Value |
|---|---|
| Branch | `main` |
| HEAD SHA | `92f7a58c312a9117737b70e34767eb71270923fb` |
| Tracked content | Only `README.md`, `AGENTS.md`, `.gitignore` (2 commits). **No production code exists.** |
| Working tree | Untracked: `research/` (design + architecture corpus), `prototype/`, `prototype-stage3c/`, `media/stage3c-fixtures/` (113 JPEGs), root-level review screenshots (`g*.png`, `o*.png`, `b01-desktop.png`) |
| `package.json` / `src/` / `content/` / `scripts/` / `tests/` | **None exist.** All created by P1/P2 work packages. |
| Production app state | None. No `dist/`, no `generated/`, no deployment. |
| Host toolchain | Node.js v24.18.0, macOS (darwin arm64). Deployment target is a GNU/Linux VPS (deploy procedures are Linux-scoped per DEPLOYMENT_ARCHITECTURE.md). |
| Fixture corpus | `media/stage3c-fixtures/` — 113 real JPEGs, F01–F10 roles defined in `research/stage3c/REAL_PHOTO_FIXTURE_MANIFEST.md`. Manifest contract: nothing in this directory is modified. |
| Prototype tooling | `prototype-stage3c/` (Playwright deterministic capture: `tools/capture.js`; `tools/content_model.py`; pinned viewports 1440×900 / 390×844 @ DSF=1) — design evidence + methodology reference, not production code. `prototype/` — earlier stage evidence. |

Implication: WP-02 is the first production code work package; everything before it is classification/harness groundwork.

---

## 2. Planning boundary (hard rules for every executor)

This plan converts frozen decisions into executable packages. Executors MUST NOT:

- reopen Astro vs any alternative; propose a backend/database; re-design the image architecture;
- change Photo identity, content source-of-truth, Gallery/Place schemas, canonical routes, G1–G7, IA, frozen fonts/colors/rhythm/Overview/continuation;
- invent Search, Map, Visit, Tags, slideshow, dark mode, CMS, admin, analytics;
- create Architecture v3 or new ADRs for already-frozen decisions;
- preselect any deferred benchmark value (Section 11) before its named gate;
- promote prototype code wholesale into production (WP-01 governs reuse).

**Scope-control / YAGNI.** Prohibited from being added at any point without an approved exception: database, API server, authentication, CMS, admin UI, GraphQL, microservices, queues, Redis, search service, telemetry platform, complex state-management framework, client-side router, SPA conversion, image CDN dependency, framework migration. The site is intentionally static-first.

**Change-control classification** for discoveries during implementation:

| Class | Handling |
|---|---|
| Implementation bug | Fix in place. Never reopens architecture. |
| Engineering parameter decision | Resolve only inside its designated benchmark/policy gate (Section 11). Record in `docs/implementation/decisions/`. |
| Architecture exception | Only when frozen contracts cannot be implemented coherently. File an `ARCHITECTURE_EXCEPTION_REQUEST` (conflicting canonical sources, implementation consequence, minimal proposed clarification) and STOP dependent work. None were needed at planning time (Section 13). |
| Design exception | Only when implementation evidence proves a frozen design value physically/systemically unworkable. Implementation difficulty is NOT a design issue. |

---

## 3. Planning conventions

### 3.1 Work package anatomy

Every WP below carries: Phase · Objective · Depends on · Frozen references · Files likely created/modified · Test-first requirement (RED) · Implementation steps · Verification (GREEN/VERIFY) · Acceptance criteria · Stop conditions · Parallelizable with · Complexity (S/M/L). No calendar estimates anywhere; sequencing is expressed via dependencies only.

- **S** = one narrow subsystem/change. **M** = one focused coding-agent session. **L** = substantial but bounded; must still be independently verifiable.
- Every code-bearing WP is test-first: the named failing test/verification exists before implementation.
- RED/GREEN/REFACTOR/VERIFY map onto the fields: Test-first requirement = RED; Implementation steps + Verification = GREEN/VERIFY; cleanup is allowed only without changing frozen behavior (REFACTOR).

### 3.2 Verification command contracts

Exact script names do not exist yet. WP-02/WP-06 create this npm-script contract; all later WPs reference it:

| Contract | Purpose |
|---|---|
| `npm run test:unit` | Schema/validator/pure-logic tests |
| `npm run test:integration` | Build-time validation, pipeline, manifest closure |
| `npm run test:e2e` | Playwright interaction + no-JS tests |
| `npm run test:a11y` | axe-core scans across page types |
| `npm run validate:content` | Standalone content validator (draft + production modes) |
| `npm run media:derive` / `media:verify` | Image pipeline run / closure+privacy verification |
| `npm run build` / `build:preview` | Production (published-only, fail-closed) / local preview (drafts visible) build |
| `npm run capture` / `capture:diff` | Deterministic screenshot capture / pixel-diff against baselines |
| `npm run check` | Typecheck + lint |

### 3.3 Agent handoff model

Each completed WP leaves: code + tests + verification output + a concise implementation note at `docs/implementation/WP-XX.md` (what was built, decisions taken inside frozen boundaries, known limitations, next-WP prerequisites). The next agent needs only: (1) the relevant FINAL_DESIGN_SPECIFICATION section, (2) the relevant canonical architecture section, (3) the WP definition, (4) current repo/tests. No agent is required to reread the research history. Gate results additionally land in `docs/implementation/decisions/` (benchmark records) and phase gates update `PHASE_GATES.md` status.

---

## 4. Phase skeleton, dependency DAG, lanes, primary dependency spine

Canonical P1–P10 names preserved from `IMPLEMENTATION_PHASES.md`:

- **P1** Foundation and Canonical Configuration/Test Harness
- **P2** Content Model, Validation, and Authoring Contract
- **P3** Media/Image Pipeline and Engineering Benchmarks
- **P4** Discovery Pages
- **P5** Gallery Core
- **P6** Overview and Interactions
- **P7** Accessibility, SEO, and Performance
- **P8** Visual Regression and Hardening
- **P9** Deployment and Recovery Verification
- **P10** Final Production Acceptance

### 4.1 Dependency DAG (package level, condensed)

```text
P1  WP-01 (reuse classification) ─────────────────────────────┐
    WP-02 (project init) ─┬─> WP-03 (Content Layer wiring)    │
                          ├─> WP-04 (tokens/styles) ─> WP-05 (fonts+CJK PoC)
                          ├─> WP-06 (test harness) <──────────┘ (consumes WP-01 capture-methodology class)
                          └─> WP-07 (benchmark harness)

P2  WP-03 ─> WP-08 (fixture corpus) ─┬─> WP-09 (Gallery/Photo schema) ─┐
                                     └─> WP-10 (Place schema) ──────────┤
    WP-09 ─> WP-11 (Home/featured)    WP-09+WP-10 ─> WP-12 (redirects)  │
    WP-09..WP-12 ─> WP-13 (production validator) ─> WP-14 (authoring workflow)

P3  WP-07 ─> WP-15 (format/width benchmark GATE, user review)
    WP-07 ─> WP-16 (ICC policy gate)
    WP-13 ─> WP-17 (source discovery/validation) ─> WP-18 (metadata+orientation)
    WP-16+WP-18 ─> WP-19 (color transform)
    WP-15+WP-19 ─> WP-20 (resize/encode) ─> WP-21 (privacy strip + approved output ICC embed + final metadata verification)
    WP-21 ─> WP-22 (fingerprint/naming/derivative hash/manifest on final served bytes) ─> WP-23 (coverage+determinism)
    WP-22+WP-03 ─> WP-24 (manifest consumption boundary)

P4  WP-13+WP-24 ─> WP-25 (view data) ─> WP-27 (card primitive)
    WP-04 ─> WP-26 (layout + accessible nav)
    WP-25..WP-27 ─> WP-28 (Home) / WP-29 (Archive) / WP-30 (Places)
    WP-26 ─> WP-31 (About+404)
    WP-28..WP-30 ─> WP-32 (discovery VR baselines)

P5  WP-24+WP-13 ─> WP-33 (Gallery route/GalleryView) ─> WP-34 (header)
    WP-33 ─> WP-35 (photo sequence) ─> WP-36 (position annotation)
    WP-33 ─> WP-37 (ending)          WP-34..WP-37 ─> WP-38 (gallery VR baselines)

P6  WP-33 + P5 Gate ─> WP-39 (Overview presentation) ─> WP-40 (Overview behavior)
    WP-40 + all pages ─> WP-41 (no-JS completeness verification)

P7  WP-13 ─> WP-42 (alt policy PRE-ENTRY decision gate, user review)
    WP-41+WP-42 ─> WP-43 (accessibility audit)
    all routes ─> WP-44 (SEO artifacts)
    WP-35+WP-40 ─> WP-45 (performance baseline + enforcement)
    WP-05+WP-13 ─> WP-46 (CJK implementation gate, user review)

P8  WP-32+WP-38+WP-43+WP-46 ─> WP-47 (VR suite + adjudication, user review)
    WP-45+WP-47 ─> WP-48 (hardening + cross-browser, sequential after adjudication)
    WP-47 ─> WP-49 (frozen-design traceability verification)

P9  WP-50 (env+Nginx) + WP-23/WP-24 ─> WP-51 (assembly+integrity gate)
    WP-12 ─> WP-52 (redirect include generation)
    WP-50..WP-52 ─> WP-53 (deploy script) ─> WP-54 (deploy scenario tests)
    WP-55 (backup selection PRE-ENTRY decision gate, user review) ─> WP-56 (backup implementation) ─> WP-57 (restore drill)

P10 WP-14+WP-42+WP-47 ─> WP-58 (pilot content batch, user review)
    WP-58 ─> WP-59 (full archive ingest)
    everything ─> WP-60 (production acceptance gate)
```

### 4.2 Sequential dependencies, gates, hard blockers

**Governing phase rule:** A phase may begin when its explicitly defined Entry criteria pass (PHASE_GATES.md). P4 and P5 may proceed in parallel after the P3 Gate. WPs labeled pre-entry decision gates (WP-42 for P7, WP-55 for P9) resolve before that phase begins; they are decision packages, not phase work.

- **Hard blockers:** WP-13 blocks all page data work. WP-15 (benchmark gate) blocks derivative generation and any `<picture>`/format markup — no page WP may freeze format-specific markup before WP-15 records its decision. WP-24 blocks all page rendering (manifest consumption). WP-42 (alt policy) is a pre-entry decision gate for P7. WP-55 (backup provider) is a pre-entry decision gate for P9. Every phase's Entry criteria per `PHASE_GATES.md` gate phase start.
- **Benchmark gates:** WP-15 (formats/widths/quality), WP-16 (ICC), WP-45 (performance budgets → CI thresholds only after MEASURED BASELINE), WP-46 (CJK subset).
- **Safe parallelism:** see 4.3. Unsafe parallelism (same files/same decisions) is not authorized anywhere.

### 4.3 Parallel execution lanes

| Lane | Packages | Merge/dependency gates |
|---|---|---|
| A — Foundation/Data | WP-02 → WP-03 → WP-08..WP-14 | Feeds everyone; WP-13 is the merge gate for content consumers |
| B — Media | WP-07 → WP-15/WP-16 (parallel) → WP-17..WP-24 | WP-15 user-review gate before WP-20; WP-17 needs WP-13 types |
| C — Discovery UI | WP-25..WP-32 | Starts at P4 entry (P3 Gate PASS; WP-24 + WP-13 are the data prerequisites); card primitive (WP-27) merges before WP-28–30 |
| D — Gallery | WP-33..WP-40 | Starts at P5 entry; may run parallel to lane C after the P3 Gate; P6 work (WP-39/40) waits for the P5 Gate |
| E — Quality | WP-06 early; WP-32/WP-38 captures; WP-42..WP-49 | Capture infrastructure runs alongside C/D from P4 onward; WP-47 and WP-48 do not race — WP-48 executes sequentially after WP-47 completes |
| F — Ops | WP-50..WP-57 | VPS/Nginx research may begin earlier; no bypass of P9 gates; WP-55 selection may be researched from P7 onward but is decided as the P9 pre-entry gate |

Example safe overlaps: WP-04 ‖ WP-06 ‖ WP-07 (after WP-02); WP-15 ‖ WP-16; WP-28 ‖ WP-29 ‖ WP-30 (after WP-25/26/27); WP-34 ‖ WP-35 ‖ WP-37 (after WP-33) with WP-36 only after WP-35 completes; WP-44 ‖ WP-45; WP-50 ‖ WP-55-research.

### 4.4 Primary dependency spine

```text
WP-02 → WP-03 → WP-08 → WP-09 → WP-13 → WP-17 → WP-18 → WP-19 → WP-20
→ WP-21 → WP-22 → WP-24 → WP-25 → WP-28 → WP-33 → WP-35 → WP-37 → WP-39 → WP-40
→ WP-41 → WP-43 → WP-45 → WP-47 → WP-50 → WP-53 → WP-54 → WP-58 → WP-59 → WP-60
```

Blocker classes on this path: toolchain pinning (WP-02), schema (WP-09/13), P3 benchmark (WP-15), final-byte ordering (WP-20→WP-21→WP-22), manifest contract (WP-22/24), visual baseline governance (WP-32/38 → WP-47), deployment rehearsal (WP-53/54), real content (WP-58/59).

**Mandatory fan-in blockers** (every lane must clear these independently of its internal ordering): WP-13 (production validator), WP-15 (benchmark gate, user review), WP-24 (manifest consumption), the P1–P9 phase gates per PHASE_GATES.md, WP-42 (P7 pre-entry), WP-47 (visual adjudication, user review), WP-55 (P9 pre-entry), WP-57 (restore drill before launch).

---

## 5. Mandatory questions — answered

1. **First production code WP:** WP-02 (project initialization + toolchain pinning). WP-01 is a classification record, not code.
2. **What blocks P2:** P1 exit criteria — pinned toolchain, Content Layer loading real YAML, harness executing ≥1 passing content test, benchmark harness ingesting fixtures.
3. **What blocks the P3 benchmark:** WP-07 (benchmark harness from P1) + fixture corpus availability (present: 113 JPEGs in `media/stage3c-fixtures/`).
4. **What P3 must decide before P4/P5 proceed:** production format(s) + fallback policy, encoder, quality values, responsive width steps, overview thumbnail ceiling, cover dimensions, high-DPR strategy, progressive-JPEG choice, digest length (WP-15); untagged-ICC policy + output ICC embedding (WP-16); manifest contract realized and consumable (WP-22/WP-24). Until then no `<picture>`/format markup may be frozen.
5. **When Home/Archive/Places may start:** after WP-24 (manifest consumption) + WP-13 (validator) + WP-26 (layout) — i.e., P4 entry.
6. **When Gallery implementation may start:** same gate (WP-24 + WP-13); WP-33 may run in parallel with discovery pages.
7. **When Overview may start:** at P6 entry (P5 Gate PASS). WP-33's Gallery route/data contract is the data prerequisite (overview derivatives + current-position context). WP-39 must not start before the P5 entry/exit contract allows it.
8. **When visual regression captures begin:** harness in P1 (WP-06); first baselines captured during P4 (WP-32) and P5 (WP-38); final adjudication only in P8 (WP-47).
9. **When alt policy is finalized:** WP-42 (P7 entry gate; user review; OQ-04).
10. **When the backup provider is chosen:** WP-55 (P9; user review; OQ-06). Research may start earlier; the decision is P9.
11. **What must be true before the first production deployment:** P1–P9 gates all pass; deployment rehearsal + rollback + restore drill evidenced on a non-production target; integrity gate green; pilot content visually reviewed.
12. **What constitutes launch acceptance:** WP-60's gate list (Section P10) — the full release-gate evidence bundle.
13. **Which tasks may safely run in parallel:** Section 4.3 lanes; explicit per-WP "Parallelizable with" fields.
14. **Which decisions require explicit user review:** WP-15 (image benchmark), WP-42 (alt policy), WP-46 (CJK/typography rendering), WP-47 (Gallery Production Visual Review), WP-55 (backup provider), WP-58 (pilot/pre-launch visual gate), WP-60 (launch acceptance).

---

## 6. P1 — Foundation and Canonical Configuration/Test Harness

### WP-01 — Prototype reuse classification

- **Phase:** P1 · **Complexity:** S · **Depends on:** — · **Parallelizable with:** WP-02..WP-07
- **Objective:** Classify every `prototype/` and `prototype-stage3c/` artifact as A (conceptual/design reference), B (isolated reusable implementation primitive), or C (do not reuse), so no prototype shortcut inherits into production.
- **Frozen references:** FINAL_DESIGN_SPECIFICATION §7.2–7.4; TESTING_AND_VISUAL_REGRESSION §8.1 (Stage 3C capture methodology as reference); REPOSITORY_STRUCTURE (research/ is read-only for implementation).
- **Files likely created/modified:** `docs/implementation/PROTOTYPE_REUSE.md` (classification table); no production files.
- **Test-first requirement:** None (classification record). Verification is review completeness: every directory/tool in both prototypes has an A/B/C row.
- **Implementation steps:** 1) Inventory `prototype/` and `prototype-stage3c/` files. 2) For each: record class + one-line rationale (expected B candidates: deterministic capture methodology/invariants from `tools/capture.js`, viewport/font-readiness protocol, F01–F10 fixture mapping; expected C: prototype build scripts, derived assets, content_model.py as code — its *contract* is superseded by CONTENT_MODEL.md). 3) Record explicit rule: production is implemented against frozen contracts; prototype code is never copied wholesale.
- **Verification:** Document review; grep confirms no later WP imports from prototype directories.
- **Acceptance criteria:** Every prototype artifact classified; reuse rule stated; document committed.
- **Stop conditions:** If a "B" primitive implies a contract that conflicts with canonical architecture, reclassify to A and note the conflict.

### WP-02 — Production project initialization and toolchain pinning

- **Phase:** P1 · **Complexity:** M · **Depends on:** — · **Parallelizable with:** WP-01
- **Objective:** Initialize the Astro production project with exact version pinning and the canonical directory skeleton.
- **Frozen references:** BUILD_AND_ROUTING §3 (version policy: current supported stable major, exact pin; no "Astro 6+" baseline); TECHNICAL_API_VERIFICATION §1 (Astro 7 current at verification time — re-verify at implementation time); IMAGE_PIPELINE §16.3 (toolchain pinning); REPOSITORY_STRUCTURE §1–3; IMPLEMENTATION_PHASES P1 scope (ESLint/Prettier/Git hooks).
- **Files likely created/modified:** `package.json`, `package-lock.json`, `astro.config.mjs`, `tsconfig.json`, `.gitignore` (add `generated/`, `dist/`), `.eslintrc*`/`eslint.config.*`, `.prettierrc*`, `.husky/` or equivalent hooks, directory skeleton (`src/`, `content/{galleries,places,site}/`, `content/redirects.yaml` placeholder, `media/ingest-masters/.gitkeep`, `generated/`, `tests/`, `public/fonts/`, `scripts/`, `docs/implementation/`).
- **Test-first requirement:** A build-smoke test: `astro build` on the empty skeleton exits 0 and produces `dist/index.html` from a minimal placeholder page. Must fail before the project exists.
- **Implementation steps:** 1) Version verification gate: record the current supported stable Astro major and exact latest patch; record Node engine (host v24.18.0 baseline; set `engines`). Any divergence from TECHNICAL_API_VERIFICATION's verified facts must be re-verified against current docs and noted. 2) Pin exact versions in `package.json` + lockfile (Astro, TypeScript, Sharp preview-not-yet — Sharp lands in P3; test tooling lands in WP-06). 3) Create directory skeleton exactly per REPOSITORY_STRUCTURE §1, including the explicit prohibitions (no `src/content/` mirror). 4) Configure TypeScript strict mode, ESLint, Prettier, pre-commit hook (lint + typecheck). 5) Create the npm-script contract skeleton (Section 3.2) with stub implementations. 6) Commit.
- **Verification:** `npm run check` passes; `npm run build` produces placeholder page; lockfile contains exact Astro + Node pins; `node --version` satisfies `engines`.
- **Acceptance criteria:** Pinned versions recorded in `docs/implementation/WP-02.md` with verification-date sources; skeleton matches canonical tree; no prohibited paths exist.
- **Stop conditions:** If current Astro stable major contradicts verified Content Layer APIs (TECHNICAL_API_VERIFICATION §1), file findings and re-verify APIs before proceeding — do not silently adapt contracts.

### WP-03 — Content Layer wiring (glob loaders)

- **Phase:** P1 · **Complexity:** M · **Depends on:** WP-02 · **Parallelizable with:** WP-04, WP-05, WP-06, WP-07
- **Objective:** `src/content.config.ts` loads authored YAML directly from external content roots via glob loaders; no mirror.
- **Frozen references:** BUILD_AND_ROUTING §3; TECHNICAL_API_VERIFICATION §1; CONTENT_MODEL §2, §6; IC-01 verification (one Place = one file, singular schema, `glob()` only).
- **Files likely created/modified:** `src/content.config.ts`, `src/content-schemas.ts` (placeholder permissive schemas, explicitly marked as superseded by P2), sample authored YAML for loading smoke only (`content/galleries/sample/meta.yaml`, `content/places/sample.yaml` — to be replaced by WP-08 fixtures).
- **Test-first requirement:** Integration test fails first: (a) collection `galleries` loads an entry from `content/galleries/*/meta.yaml`; (b) collection `places` yields exactly one entry per `content/places/*.yaml` file; (c) no file under `src/content/` exists (prohibition assertion).
- **Implementation steps:** 1) Define `galleries` collection: `glob({ pattern: '**/meta.yaml', base: './content/galleries' })`. 2) Define `places` collection: `glob({ pattern: '*.yaml', base: './content/places' })` with singular Place schema shape. 3) Home settings + redirects loading mechanism stubbed as direct file reads (final loading belongs to WP-11/WP-12; authored locations are fixed). 4) Wire placeholder schemas with a code comment naming WP-09/WP-10 as owners of the real schemas. 5) Run dev + build.
- **Verification:** `npm run build` renders a debug page listing loaded entries; assertions pass; `astro dev` serves.
- **Acceptance criteria:** Content Layer loads external YAML without mirroring; one-Place-one-entry cardinality proven; legacy syntax (`type: 'content'`, `collections.folder`, `getEntryData`) absent.
- **Stop conditions:** If glob loader behavior differs from verified API facts, stop and re-verify against current Astro docs before any workaround.

### WP-04 — Global styling foundation (frozen tokens)

- **Phase:** P1 · **Complexity:** M · **Depends on:** WP-02 · **Parallelizable with:** WP-03, WP-05, WP-06, WP-07
- **Objective:** Design-token CSS base implementing frozen color, typography scale, spacing scale, canvas, focus styles, skip link, and responsive primitives. No page layouts.
- **Frozen references:** FINAL_DESIGN_SPECIFICATION §2.1 (palette + ratios), §2.2 (role hierarchy, CJK line-height 1.75, tabular numerals, no all-caps), §2.3 (spacing scale XS–XXL, gutters, reading column ≈680px, content max ≈1400px, mobile 20px margins), §5.2 (focus: 2px solid #0B57D0, 3px offset; `main:focus{outline:none}`), §5.1 (skip link → `#main`, `tabindex="-1"`); RUNTIME_AND_PROGRESSIVE_ENHANCEMENT §8.
- **Files likely created/modified:** `src/styles/tokens.css`, `src/styles/global.css`, `src/layouts/Base.astro` (minimal shell: skip link, `<main id="main" tabindex="-1">`).
- **Test-first requirement:** Build test asserting computed styles on a token probe page: canvas `#F6F4EF`; `:focus-visible` outline 2px `#0B57D0` offset 3px; spacing token values (4/8/16/24/48/96). Fails before tokens exist.
- **Implementation steps:** 1) Define CSS custom properties for the 7 color roles with usage-policy comments (focus blue functional only). 2) Typography scale custom properties per §2.2 role table (desktop/mobile magnitudes via custom-property switches at the mobile/desktop boundary — no device-label breakpoints; content-fit philosophy). 3) Spacing scale tokens + composite usage notes. 4) Global focus styles + skip-link styles. 5) Base reset respecting `svh` units availability (support matrix Safari ≥14 — svh fallback note for P4 hero work). 6) Tabular-nums utility. 
- **Verification:** Token probe assertions pass; no hardcoded hex outside tokens; axe scan of probe page zero violations.
- **Acceptance criteria:** Every frozen token present exactly; focus contract verifiable; no decorative accent usage possible by construction (single-purpose token).
- **Stop conditions:** Any token value not literally present in the frozen spec is a stop — do not interpolate design values.

### WP-05 — Font loading plumbing + CJK strategy proof of concept

- **Phase:** P1 · **Complexity:** M · **Depends on:** WP-04 · **Parallelizable with:** WP-03, WP-06, WP-07
- **Objective:** Self-host the four frozen families; prove a viable CJK subsetting approach with working system fallback (OQ-05 PoC; finalization in WP-46).
- **Frozen references:** FINAL_DESIGN_SPECIFICATION §2.2 + G1; PERFORMANCE_BUDGET §7 (font-display: optional; Options A/B; mandatory CJK rules); RISK_REGISTER RISK-007; TECHNICAL_API_VERIFICATION §4.
- **Files likely created/modified:** `public/fonts/{source-serif-4,source-sans-3,noto-serif-sc,noto-sans-sc}/`, `src/styles/fonts.css`, `scripts/fonts/subset-poc.*` (PoC tooling), `docs/implementation/WP-05.md` (PoC evidence incl. fallback behavior).
- **Test-first requirement:** Playwright check fails first: `document.fonts.ready` resolves with the four families usable; a probe string mixing Latin+CJK renders with the intended family stack; a probe character outside any candidate subset falls back to system CJK without layout breakage.
- **Implementation steps:** 1) Download exact upstream releases; record versions + licenses (pin). 2) Latin subsets (weights per typography system) as woff2. 3) PoC Option A (broad static subset) AND Option B (build-derived subset scan) at demonstration scale — measure file sizes, verify `unicode-range` honesty, verify system fallback for missing glyphs. 4) `font-display: optional` everywhere; preload only proven above-fold fonts (none blindly). 5) Record PoC verdict + recommendation; do NOT freeze the final strategy here.
- **Verification:** Font probe tests pass; payload numbers recorded; fallback stack (ending Songti SC/equivalent for serif, platform CJK sans for sans) demonstrated.
- **Acceptance criteria:** P1 exit item "CJK font strategy proof demonstrates viable approach with fallback behavior" satisfied; no third family introduced; no invalid subsetting tool invocations frozen.
- **Stop conditions:** If neither option is viable at acceptable payload, escalate as engineering finding (not a design exception — families are frozen).

### WP-06 — Test harness foundation

- **Phase:** P1 · **Complexity:** M · **Depends on:** WP-02 (consumes WP-01 capture-methodology classification when available) · **Parallelizable with:** WP-03, WP-04, WP-05, WP-07
- **Objective:** Testing infrastructure exists before feature implementation: unit, integration, Playwright e2e, axe, deterministic screenshot capture, build validation scaffold.
- **Frozen references:** TESTING_AND_VISUAL_REGRESSION §2 (seven categories), §8.1 (capture determinism invariants: pinned browser binary, pinned OS+fonts, 1440×900 + 390×844 @ DSF=1, `document.fonts.ready`, network idle, forced lazy images, animation settling; SHA-256 = file integrity only, never cross-environment visual equivalence); IMPLEMENTATION_PHASES P1 exit.
- **Files likely created/modified:** `tests/unit/`, `tests/integration/`, `tests/e2e/`, `tests/capture/` (capture runner implementing the Stage 3C-class invariants), `tests/baselines/` (empty + README), `playwright.config.*`, npm-script implementations for `test:*`, `capture`, `capture:diff`; pinned browser version recorded.
- **Test-first requirement:** The harness self-test: one passing content validation smoke test (per P1 exit criteria) — e.g., a trivially valid YAML fixture loads and passes a placeholder check; and one deliberately failing probe proving RED/GREEN works.
- **Implementation steps:** 1) Unit + integration runner with fixtures directory convention. 2) Playwright with pinned browser; contexts for JS-on and JS-blocked (no-JS) modes; viewport presets matching capture invariants. 3) axe-core integration runnable per page type. 4) Capture runner: font-ready wait, network idle, lazy-image forcing, animation settle, DSF=1, exact viewports; SHA-256 manifest of captured files (integrity only). 5) Pixel-diff runner with configurable thresholds + human-adjudication workflow note (no auto-fail governance until WP-47 process). 6) Build-validation scaffold (hook points for WP-13/WP-23/WP-51).
- **Verification:** `npm run test:unit`, `test:e2e`, `test:a11y`, `capture` all execute; smoke test green; JS-blocked context demonstrably blocks scripts.
- **Acceptance criteria:** P1 exit item satisfied (harness executes ≥1 passing content validation test); capture determinism invariants implemented; baseline governance documented (updates are governed, never automatic).
- **Stop conditions:** If pinned browser capture is unstable after reasonable fixing, record instability and classify per P0/P1/P2 before any baseline is accepted.

### WP-07 — Benchmark harness scaffold

- **Phase:** P1 · **Complexity:** M · **Depends on:** WP-02 · **Parallelizable with:** WP-03, WP-04, WP-05, WP-06
- **Objective:** Measurement infrastructure that ingests real fixture images and produces comparable encode/size/quality evidence for the P3 gates.
- **Frozen references:** IMPLEMENTATION_PHASES P1 scope + P3 entry; PERFORMANCE_BUDGET §4, §11; TESTING_AND_VISUAL_REGRESSION §12 (F01–F10, 113 JPEGs); REAL_PHOTO_FIXTURE_MANIFEST (fixture roles).
- **Files likely created/modified:** `scripts/bench/` (runner + reporting), `tests/bench/` (results convention), `docs/implementation/WP-07.md`.
- **Test-first requirement:** Harness smoke: ingest one fixture JPEG, run one candidate encode, emit one measurement row (format, width, quality, bytes, encode time) — fails before harness exists.
- **Implementation steps:** 1) Fixture registration reading `media/stage3c-fixtures/` (read-only; the frozen manifest forbids modification) with F01–F10 role metadata imported from REAL_PHOTO_FIXTURE_MANIFEST. 2) Encode-runner abstraction over candidate encoders (Sharp baseline; candidate formats jpeg/webp/avif). 3) Measurement outputs: bytes per (format × width × quality), PSNR/SSIM-class fidelity metrics against the decoded source, encode time; side-by-side visual review packet generation (crops at 100%) for human quality judgment. 4) Deterministic output location outside `generated/` (bench artifacts are scratch; `.gitignore`).
- **Verification:** Smoke measurement produced for one fixture; report renders; fixture directory untouched (checksum before/after).
- **Acceptance criteria:** P1 exit item "benchmark harness can ingest fixture images and produce measurements" satisfied.
- **Stop conditions:** None expected; harness is internal tooling.

**P1 GATE — PASS only when all IMPLEMENTATION_PHASES P1 exit criteria hold** (see PHASE_GATES.md): dev server renders baseline with correct fonts/colors; Content Layer loads external YAML; CJK PoC viable; harness passes one content test; benchmark harness measures; exact versions pinned.

---

## 7. P2 — Content Model, Validation, and Authoring Contract

### WP-08 — Authored fixture content corpus

- **Phase:** P2 · **Complexity:** M · **Depends on:** WP-03 · **Parallelizable with:** — (WP-09 starts only after WP-08 completes)
- **Objective:** Test fixture galleries/places/home/redirects authored as real YAML under `content/` (derived from the Stage 3C set) plus an invalid-fixture library for fail-first tests.
- **Frozen references:** IMPLEMENTATION_PHASES P2 scope ("Test fixture galleries created from Stage 3C set"); CONTENT_MODEL §4–11; REAL_PHOTO_FIXTURE_MANIFEST (photo assignments incl. `long-gallery-72` synthetic stress set, `tengwang-pavilion` CJK case).
- **Files likely created/modified:** `content/galleries/{lofoten-light,tengwang-pavilion,swiss-winter-quiet,red-lanterns,tromso-city-nights,aurora-nights,portrait-studies,christmas-market-light,essen-industrial-light,winter-returns,thun-lake-lines,long-gallery-72}/meta.yaml`; `content/places/*.yaml` (reine, tengwang/etc. per Stage 3C set); `content/site/home.yaml`; `content/redirects.yaml`; `tests/fixtures/invalid/*.yaml` (one file per documented failure mode, keyed by CONTENT_MODEL §13.1 numbers); test media: `media/ingest-masters/{gallery}/` populated from COPIES of stage3c fixtures (never moves/edits `media/stage3c-fixtures/`).
- **Test-first requirement:** N/A (test data), but the package's own verification is: valid corpus passes placeholder schema load; every invalid fixture is referenced by at least one later test name (cross-reference table in WP-08 note).
- **Implementation steps:** 1) Derive fixture metadata from Stage 3C content model evidence into canonical schema shape (IDs `g_*`/`p_*`/`pl_*`; inline captions/rhythm_after/alt_text; photographed dates; honest `published_at` placeholders marked as test data). 2) Include required edge shapes: multi-place gallery, no-next gallery, next-cycle pair (A→B→A allowed), draft gallery, CJK title/caption gallery, long gallery (~72 photos). 3) Invalid fixtures: one per CONTENT_MODEL §13.1 failure mode + §13.2 warning cases. 4) Copy fixture JPEGs into `media/ingest-masters/` test tree; record that production masters are separate. 5) Verify checksums prove `media/stage3c-fixtures/` untouched.
- **Verification:** Loader smoke enumerates all fixture entries; invalid fixture index complete against §13.1.
- **Acceptance criteria:** Corpus supports every P2 test; fixture derivation documented; no modification of frozen fixture set.
- **Stop conditions:** If a Stage 3C metadata value conflicts with canonical schema, canonical schema wins; record the mapping decision.

### WP-09 — Gallery + Photo schemas and identity validation

- **Phase:** P2 · **Complexity:** L · **Depends on:** WP-08, WP-06 · **Parallelizable with:** WP-10
- **Objective:** Fail-closed Zod schemas for Gallery and inline Photo items, with duplicate/identity/lifecycle validation and draft-vs-production severity modes.
- **Frozen references:** CONTENT_MODEL §3–5, §8, §13; SOURCE_OF_TRUTH_MATRIX §2, §6; UD-001/002/003/009/010; TESTING_AND_VISUAL_REGRESSION §3.
- **Files likely created/modified:** `src/content-schemas.ts` (replace placeholders from WP-03), `src/lib/validate/gallery.*`, `tests/unit/gallery-schema.*`, `tests/integration/gallery-validation.*`.
- **Test-first requirement (RED set, all failing):** duplicate Gallery ID rejected; duplicate Gallery slug rejected; duplicate Photo ID (across galleries) rejected; missing/empty `source_ref` rejected; invalid `status` rejected; `rhythm_after: spacious` rejected; forbidden fields rejected (`prev_gallery*`, `featured`/`is_featured`/`is_curated`, `title_cjk`, `photographed_date_label`, separate `captions`/`rhythms` maps, `has_continuation`); published Gallery missing `published_at` fails; published Gallery missing `cover_photo_id` fails; `cover_photo_id` referencing a Photo outside the Gallery fails; empty `photos[]` fails; `photographed_start > photographed_end` fails; draft Gallery omitting cover/published_at passes in preview mode but fails in production mode when status is published.
- **Implementation steps:** 1) Implement Zod schemas exactly per CONTENT_MODEL §4.1/§5.1 (types, optionality, explicit-null caption semantics). 2) Cross-item validators (duplicates, cover membership, forbidden-field presence incl. unknown/orphan key detection per P2 scope). 3) Mode switch: preview (draft-lenient with warnings per §13.2) vs production (fail-closed per §13.1). 4) Wire schemas into `src/content.config.ts` replacing placeholders. 5) GREEN: make all RED tests pass with minimal validation code; then refactor for clear error messages naming the offending gallery/field.
- **Verification:** `npm run test:unit` + `test:integration` green for the full RED set; valid fixture corpus still loads; production-mode build rejects each invalid fixture with a precise error.
- **Acceptance criteria:** Every CONTENT_MODEL §13.1 Gallery/Photo-related rule has a failing test and passing implementation; warnings can never pass broken published content.
- **Stop conditions:** Any §13.1 rule that appears unimplementable as written → architecture exception request (do not improvise semantics).

### WP-10 — Place schema (one Place = one YAML file)

- **Phase:** P2 · **Complexity:** S · **Depends on:** WP-08 · **Parallelizable with:** WP-09
- **Objective:** Singular Place schema + cardinality enforcement.
- **Frozen references:** CONTENT_MODEL §6; IC-01 verification; SOURCE_OF_TRUTH_MATRIX §2 (Place row).
- **Files likely created/modified:** `src/content-schemas.ts` (placeSchema), `tests/unit/place-schema.*`, `tests/fixtures/invalid/place-*`.
- **Test-first requirement (RED):** duplicate Place ID rejected; duplicate Place slug rejected; a YAML file containing an array of Places rejected (singular object only); required `id`/`slug`/`name` enforced; forbidden concepts rejected (coordinates, counts, Visit/Trip fields → unknown-key rejection).
- **Implementation steps:** 1) Zod singular placeSchema per §6.1. 2) Loader assertion: one entry per file (collection entry count equals file count). 3) GREEN all RED tests.
- **Verification:** Tests green; glob-loader cardinality assertion passes.
- **Acceptance criteria:** One-Place-one-file contract machine-enforced; no aggregate/custom-flattening loader anywhere.
- **Stop conditions:** None expected.

### WP-11 — Home settings and featured resolution

- **Phase:** P2 · **Complexity:** M · **Depends on:** WP-09 · **Parallelizable with:** WP-10, WP-12
- **Objective:** `content/site/home.yaml` loading + deterministic featured/Recent resolution.
- **Frozen references:** CONTENT_MODEL §10; UD-004; ADR-019; TESTING_AND_VISUAL_REGRESSION §3.1 (featured resolution determinism, published_at ordering).
- **Files likely created/modified:** `src/lib/content/home.*`, `tests/unit/home-featured.*`, `tests/integration/home-resolution.*`.
- **Test-first requirement (RED):** featured resolves to the referenced valid published Gallery; `featured_gallery_id: null` falls back to latest published by `published_at` DESC; tie on `published_at` breaks by lexicographic Gallery ID; featured referencing an invalid configured ID (nonexistent, or draft/unpublished in production) falls back deterministically per the frozen algorithm — latest published Gallery by `published_at` DESC with stable Gallery ID tie-break — with a recorded warning; an invalid configured ID warns and never fails the production build; Recent ordering never uses photographed time/EXIF/mtime/Git/folder; per-Gallery `featured` fields anywhere are rejected.
- **Implementation steps:** 1) Home settings loader (direct file read; authored location fixed). 2) Resolution function with pure, unit-testable signature. 3) Recent Galleries ordering function (published_at DESC + ID tie-break; display count left to P4 presentation). 4) GREEN all RED tests.
- **Verification:** Unit + integration tests green; resolution trace logged for the fixture corpus.
- **Acceptance criteria:** Determinism proven (same input → same output across repeated runs); no scheduler/curated concept exists anywhere.
- **Stop conditions:** None expected — CONTENT_MODEL §10.2 is implemented exactly: a valid published `featured_gallery_id` is used; otherwise latest published by `published_at` DESC with stable Gallery ID tie-break; invalid configured IDs warn. No production build failure is introduced for an invalid configured ID.

### WP-12 — Redirect schema and validation

- **Phase:** P2 · **Complexity:** M · **Depends on:** WP-09, WP-10 · **Parallelizable with:** WP-11
- **Objective:** `content/redirects.yaml` schema + full fail-closed production validation.
- **Frozen references:** CONTENT_MODEL §11; UD-008; BUILD_AND_ROUTING §5; IC-02 verification.
- **Files likely created/modified:** `src/lib/content/redirects.*`, `tests/unit/redirects.*`, `tests/fixtures/invalid/redirect-*`.
- **Test-first requirement (RED):** entry with both `gallery_id` and `place_id` rejected; entry with neither rejected; old path equal to a current canonical route rejected; target Gallery/Place missing rejected; target draft/unpublished in production rejected; redirect loop (A→B→A and longer chains) rejected; duplicate old paths rejected; redirect target that is itself a redirect source rejected; route collision between redirect destinations and canonical routes rejected; valid historical alias resolving to published target passes.
- **Implementation steps:** 1) Schema: map of old path → `{ gallery_id }` XOR `{ place_id }`. 2) Resolution: old path → target ID → current slug → canonical route. 3) Graph checks (loops, collisions) as pure functions. 4) GREEN all RED tests. 5) Emit the validated redirect set as structured output consumable by WP-52 (nginx include generation) — format decided there; here only the data contract.
- **Verification:** All RED tests green; second slug registry nowhere (grep).
- **Acceptance criteria:** Every IC-02 validation rule machine-enforced; historical-only semantics proven.
- **Stop conditions:** None expected.

### WP-13 — Production build validator integration

- **Phase:** P2 · **Complexity:** L · **Depends on:** WP-09, WP-10, WP-11, WP-12 · **Parallelizable with:** — (merge gate)
- **Objective:** The single fail-closed production validation pass over the whole archive, wired into both `validate:content` and the Astro production build.
- **Frozen references:** CONTENT_MODEL §13 (full list); BUILD_AND_ROUTING §6–7; UD-003/007/009/010; RISK_REGISTER RISK-001/003/005/006.
- **Files likely created/modified:** `scripts/validate/content.*` (CLI), `src/lib/validate/production.*`, npm `validate:content`, build integration hook, `tests/integration/production-validation.*`.
- **Test-first requirement (RED):** aggregate scenarios across entities: route collision between two Gallery slugs rejected; `next_gallery_id` missing target / self-loop / draft target in production rejected while an allowed cycle A→B→C→A passes; published Gallery with unresolved `source_ref` (missing master file) rejected; draft exclusion verified at every output point (routes, sitemap input set, Archive/Places/Home data sets); one-Photo-one-Gallery membership violation rejected; orphan metadata keys rejected; all §13.1 items 1–18 each demonstrated by at least one integration fixture; preview mode emits §13.2 warnings without failing.
- **Implementation steps:** 1) Compose entity validators into one archive-level pass with deterministic error ordering. 2) Source-resolution check against `media/ingest-masters/` (existence for published content; environment mount documented). 3) Mode selection by environment configuration, never content inspection (BUILD_AND_ROUTING §6). 4) Wire into `astro build` (production) so any failure aborts the build; `build:preview` keeps draft-friendly mode with visible draft indicator. 5) Error output contract: file + field + rule ID (§13.1 numbering).
- **Verification:** Full RED set green; building the fixture corpus in production mode with any single invalid fixture fails with the precise rule ID; valid corpus builds clean; drafts provably absent from all production data sets.
- **Acceptance criteria:** P2's core exit criterion — "validation rejects all documented failure modes for published content" — evidenced by the rule-to-test matrix in the WP note.
- **Stop conditions:** Any §13.1 rule without a clear owner in code → stop and resolve before P3 starts.

### WP-14 — Authoring workflow contract and operations docs

- **Phase:** P2 · **Complexity:** M · **Depends on:** WP-13 · **Parallelizable with:** P3 lane start (WP-15/16)
- **Objective:** Documented author workflows with validation-dry-run command support, preserving frozen identity semantics.
- **Frozen references:** CONTENT_MODEL §14 (all seven workflows); UD-001/002/003/008; RISK_REGISTER RISK-001.
- **Files likely created/modified:** `docs/authoring/*.md` (ingest new gallery; rename/move master; corrected-master replacement; add distinct photograph; publish; slug rename + redirect; change featured; unpublish), `scripts/validate/dry-run.*` (`validate:content --mode preview` wrapper + source existence report).
- **Test-first requirement:** Executable walkthrough verification: a scripted dry-run of "ingest → publish" on a scratch fixture gallery passes preview validation, then production validation, then the same scripted rename flow retains Photo ID while updating `source_ref` (asserted via before/after YAML diff rules in a test).
- **Implementation steps:** 1) Write each workflow as ordered steps with exact file paths and the identity rule that applies (retain-ID vs new-ID lists from CONTENT_MODEL §5.3/§14). 2) Honest-`published_at` guidance (UD-003): never derive; honest import timestamps; unknown remains unknown. 3) Slug-change workflow including redirect entry + loop check. 4) Unpublish workflow: status→draft consequences on next_gallery referrers (production build errors named). 5) Dry-run script + tests.
- **Verification:** Scripted walkthroughs pass; docs reviewed against CONTENT_MODEL §14 for 1:1 coverage.
- **Acceptance criteria:** P2 exit "authoring workflow contract documented (rename/move/replace/publish)" satisfied; every workflow names the identity-preservation rule.
- **Stop conditions:** None expected.

**P2 GATE — PASS only when:** schemas implemented and match CONTENT_MODEL exactly; all invalid fixtures fail; valid fixtures build; rename/move/replace identity tests pass; production draft filtering verified at every output point; authoring contract documented.

---

## 8. P3 — Media/Image Pipeline and Engineering Benchmarks

P3 is the major engineering gate phase. Deferred values are decided here by measurement — never invented. The pipeline is decomposed per IMAGE_PIPELINE §5 stage order; packages below group tightly-coupled stages but keep each independently verifiable.

### WP-15 — Image format / encoder / width benchmark gate ⚑ USER REVIEW

- **Phase:** P3 · **Complexity:** L · **Depends on:** WP-07 · **Parallelizable with:** WP-16
- **Objective:** Decide through measured evidence: production format(s) and fallback strategy, encoder, per-purpose quality values, responsive width steps, overview thumbnail ceiling, cover dimensions, high-DPR strategy, progressive-JPEG choice, and digest length. Output is a recorded engineering decision consumed by WP-20+.
- **Frozen references:** OPEN_QUESTIONS OQ-01/OQ-02; IMAGE_PIPELINE §12, §9; PERFORMANCE_BUDGET §4, §6.3, §10.3, §11; ADR-010; RISK_REGISTER RISK-009; IC-03 verification (manifest stays format-agnostic; no preselection).
- **Files likely created/modified:** `scripts/bench/**` (campaigns), `docs/implementation/decisions/BENCHMARK-OQ01-OQ02.md` (the decision record).
- **Test-first requirement:** Benchmark acceptance harness: for each fixture × candidate, measurements are reproducible (repeat run yields identical byte counts) — fails before harness reliability exists.
- **Implementation steps:** 1) Register benchmark fixtures: the core stress set (17 photos) from REAL_PHOTO_FIXTURE_MANIFEST §2 must cover landscape, portrait, high-detail (F07), low-light/dark (F02), fine texture, sky/gradient, strong color (F04), neutral/B&W-substitute (F09-sub), high-DPR desktop use, mobile use. 2) Run JPEG/WebP/AVIF campaigns across candidate width ladders and quality steps per purpose (gallery_display, overview, cover) at both 1x and 2x DPR consumption scenarios. 3) Record bytes, fidelity metrics, encode time; generate 100% crop review packets. 4) Human visual-quality review against payload (user-review gate — applies to the visual-quality/payload tradeoff, D1–D7; purely technical parameters such as the D8 digest length are recorded in the same decision doc without user approval). 5) Freeze: format(s) + fallback (multi-format `<picture>` vs single-format `<img>` per PERFORMANCE_BUDGET §8.2), encoder, quality per purpose, width steps, overview ceiling, cover dimensions, high-DPR strategy, progressive-JPEG yes/no, digest length (collision-resistant at tens of thousands of files; six-hex NOT frozen). 6) Record all as MEASURED BASELINE in the decision doc; update DEFERRED_ENGINEERING_DECISIONS.md statuses.
- **Verification:** Decision doc complete with evidence tables; repeatability check green; no downstream file references formats before this record exists (grep gate).
- **Acceptance criteria:** P3 exit "benchmark results recorded and values frozen for widths, quality, encoder" satisfied; decision survives user review.
- **Stop conditions:** If quality-vs-payload tradeoff is unacceptable at all candidates (RISK-009 materializes), stop and escalate with evidence — do not force a value.

### WP-16 — ICC benchmark / policy gate

- **Phase:** P3 · **Complexity:** M · **Depends on:** WP-07 · **Parallelizable with:** WP-15
- **Objective:** Resolve the untagged-source policy (OQ-03) and output ICC embedding decision with measured color behavior.
- **Frozen references:** IMAGE_PIPELINE §6; ADR-011; OPEN_QUESTIONS OQ-03; TECHNICAL_API_VERIFICATION §2 (verified Sharp APIs only: `toColourspace`, `withIccProfile`, `keepIccProfile`, `pipelineColourspace`; no `profile()`, no Sharp CLI).
- **Files likely created/modified:** `scripts/bench/icc/*`, ICC fixtures (tagged sRGB; Adobe RGB or P3 sample — create from real fixtures with known profiles; untagged variant), `docs/implementation/decisions/ICC-POLICY.md`.
- **Test-first requirement:** Color round-trip probe fails first: converting a tagged Adobe-RGB fixture to sRGB via verified APIs yields measurably different (correct) pixels vs naive passthrough; untagged fixture follows the documented assume-sRGB path.
- **Implementation steps:** 1) Assemble fixtures for the three classes (tagged sRGB, wide-gamut tagged, untagged). 2) Measure conversion behavior with verified Sharp APIs. 3) Record the frozen interpretation: untagged pixels follow the canonical sRGB interpretation (ADR-011) — this part is not deferred. 4) Test all three candidate enforcement modes for untagged sources (silent assume / warn / fail) as recorded behaviors, select one, and record D9 during P3 (D9 is NOT carried to P7); wire the selected mode as the final behavior assertion consumed by WP-19. 5) Decide output ICC embedding (embed sRGB or not) from rendering evidence; the embedding itself is applied later, in WP-21. 6) Record decision; no camera-model guessing anywhere.
- **Verification:** Probe tests pass under the chosen policy; decision doc references only verified API names.
- **Acceptance criteria:** OQ-03/D9 closed in P3: frozen interpretation recorded (untagged pixels follow the canonical sRGB interpretation) and the selected enforcement mode wired as the final behavior assertion; embedding decision recorded for WP-21 consumption.
- **Stop conditions:** If wide-gamut fixtures cannot be sourced honestly, record the limitation and decide on sRGB-tagged + untagged evidence only.

### WP-17 — Source discovery + source validation module

- **Phase:** P3 · **Complexity:** M · **Depends on:** WP-13 · **Parallelizable with:** WP-15, WP-16
- **Objective:** Pipeline stages 1–2 (read/decode contract + source resolution): discover `media/ingest-masters/` content, resolve every authored `source_ref`, and fail closed per IMAGE_PIPELINE §11.1.
- **Frozen references:** IMAGE_PIPELINE §3, §5 stages 1–2, §11; CONTENT_MODEL §13.1 rule 1; REPOSITORY_STRUCTURE §4 (mount/symlink is environment config).
- **Files likely created/modified:** `scripts/media/discover.*`, `scripts/media/validate-sources.*`, `tests/integration/source-validation.*`.
- **Test-first requirement (RED):** missing master for a published Photo fails the build; decode-corrupt file fails (build-blocking decode error); draft missing master does not block production (drafts excluded); duplicate content fingerprints (two files identical bytes) produce a warning, not a failure.
- **Implementation steps:** 1) Discovery walker over the canonical root (environment-configurable mount point; authored YAML never carries absolute paths). 2) Decode check per supported ingest format (JPEG primary; PNG limited; RAW/HEIC rejected per IMAGE_PIPELINE §14). 3) Referential pass joining WP-13's content graph with discovered files. 4) GREEN all RED tests.
- **Verification:** RED set green; a removed fixture master reproducibly fails production build with rule ID.
- **Acceptance criteria:** Fail-closed source resolution proven; warning channel proven for duplicate fingerprints.
- **Stop conditions:** None expected.

### WP-18 — Metadata extraction + orientation normalization

- **Phase:** P3 · **Complexity:** M · **Depends on:** WP-17 · **Parallelizable with:** WP-15/16 outcomes landing
- **Objective:** Pipeline stages 2–3: extract orientation/ICC/dimensions before any strip, then normalize orientation into pixels before any resize.
- **Frozen references:** IMAGE_PIPELINE §5 stages 2–3 + stage ordering invariants; TESTING_AND_VISUAL_REGRESSION §5 (EXIF orientation normalization); TECHNICAL_API_VERIFICATION §2 (`rotate()`).
- **Files likely created/modified:** `scripts/media/extract.*`, `scripts/media/orient.*`, `tests/integration/orientation.*`, fixtures with non-trivial EXIF orientation tags (created from fixture copies).
- **Test-first requirement (RED):** a source with EXIF orientation 6 produces an upright derivative with swapped intrinsic dimensions and no residual orientation tag; extraction output includes ICC presence flag + intrinsic dimensions; stripping never happens before ICC read (ordering test: simulate a strip-first path and assert the guard rejects it).
- **Implementation steps:** 1) Metadata extractor (dimensions, orientation, ICC presence, source SHA-256). 2) Orientation normalization via `rotate()` semantics before resize. 3) Internal metadata lifetime rules: retained only as long as needed for color conversion. 4) GREEN all RED tests.
- **Verification:** Orientation fixture set renders upright in derivatives; extracted record complete for the fixture corpus.
- **Acceptance criteria:** Stage-ordering invariant machine-guarded; orientation-agnostic downstream processing proven.
- **Stop conditions:** None expected.

### WP-19 — Color transform implementation

- **Phase:** P3 · **Complexity:** M · **Depends on:** WP-16, WP-18 · **Parallelizable with:** —
- **Objective:** Pipeline stage 4: convert valid source ICC → sRGB; apply the recorded no-profile policy; only verified Sharp APIs.
- **Frozen references:** IMAGE_PIPELINE §6; WP-16 decision record; TECHNICAL_API_VERIFICATION §2.
- **Files likely created/modified:** `scripts/media/color.*`, `tests/integration/color-transform.*`.
- **Test-first requirement (RED):** tagged wide-gamut fixture converts per policy (measured pixel delta vs source consistent with a real transform); tagged sRGB passes through without double-conversion artifacts; untagged fixture follows WP-16 policy (assume/warn/fail exactly as recorded); no camera-model-guessing code path exists (grep).
- **Implementation steps:** 1) Implement transform using `toColourspace('srgb')` / `withIccProfile(...)` per decision record. 2) Policy enforcement hook emitting build-blocking errors or warnings exactly as WP-16 froze. 3) GREEN all RED tests. Output ICC embedding is deliberately NOT performed here — it is applied in WP-21 after privacy stripping, per the final-byte ordering (CR-01).
- **Verification:** Color fixture matrix passes; policy log shows the recorded decision in action.
- **Acceptance criteria:** Stage 4 correct for all three fixture classes; policy deviations impossible without code change.
- **Stop conditions:** If measured conversion contradicts the recorded policy's premise, return to WP-16 decision record with evidence (do not patch silently).

### WP-20 — Derivative generation core

- **Phase:** P3 · **Complexity:** L · **Depends on:** WP-15, WP-19 · **Parallelizable with:** —
- **Objective:** Pipeline stage 5: generate all purposes (gallery_display, overview, cover) at the benchmark-frozen widths/qualities/formats — uncropped, aspect-preserving, never upscaled.
- **Frozen references:** IMAGE_PIPELINE §5 stage 5, §10.3, §15 (uncropped/no-upscale invariants); WP-15 decision record; PERFORMANCE_BUDGET §6.2.
- **Files likely created/modified:** `scripts/media/derive.*`, `tests/integration/derivation.*`.
- **Test-first requirement (RED):** derivative aspect ratio equals source aspect ratio (within 1px rounding) for landscape + portrait fixtures; a source smaller than a requested width yields a derivative at source width (`withoutEnlargement` proven); overview derivatives contained/uncropped; cover derivatives uncropped; formats/widths/qualities exactly match the WP-15 record (assertion reads the decision doc's machine-readable section); parallel derivation with configurable concurrency yields the same logical set as sequential.
- **Implementation steps:** 1) Derivation planner: per Photo × purpose → variant list from decision record. 2) Sharp resize/encode chain with `withoutEnlargement: true`; no crop anywhere. 3) Concurrency control (configurable workers). 4) Stage outputs to `generated/media/` only (dist/ ownership invariant). 5) GREEN all RED tests.
- **Verification:** Full fixture corpus derived; invariant assertions green; variant matrix equals decision record.
- **Acceptance criteria:** Stage 5 produces the complete planned variant set; frozen-design invariants (uncropped, no upscale, contained overview) machine-asserted.
- **Stop conditions:** Any temptation to crop for uniform grids is a hard stop — frozen design forbids it.

### WP-21 — Privacy stripping + approved output ICC embedding + final metadata verification

- **Phase:** P3 · **Complexity:** M · **Depends on:** WP-20 · **Parallelizable with:** — (WP-22 consumes WP-21's final bytes; no overlap)
- **Objective:** Pipeline stages 6–7 + final metadata verification: strip privacy metadata from public derivatives, embed the approved output ICC per the WP-16 decision, and verify the final served bytes before any fingerprinting; source masters untouched.
- **Frozen references:** IMAGE_PIPELINE §5 stages 6–7 (+ stage ordering invariants), §7; WP-16 decision record; BUILD_AND_ROUTING §8 check 6; TESTING_AND_VISUAL_REGRESSION §5.
- **Files likely created/modified:** `scripts/media/privacy-check.*`, `tests/integration/privacy.*`, fixture with embedded GPS/serial EXIF (from fixture copy).
- **Test-first requirement (RED):** a derivative regenerated from the GPS-tagged fixture contains zero GPS tags after the full stage sequence (exhaustive metadata scan on final bytes, not sampling only); pipeline code contains no `keepExif`/`keepMetadata` call (static assertion); output ICC embedding matches the WP-16 recorded decision (embedded if and only if selected; nothing else); final metadata verification on final served bytes passes with no disallowed field; source master bytes identical before/after pipeline run (checksum).
- **Implementation steps:** 1) Privacy stripping (default full strip; no keepExif/keepMetadata). 2) Approved output ICC embedding per the WP-16 decision record (stage 7). 3) Final metadata verification gate over final derivative bytes — exhaustive scanner, fail-closed per IMAGE_PIPELINE §11.1. 4) Master-untouched checksum guard integrated into pipeline run. 5) GREEN all RED tests.
- **Verification:** Privacy suite green on the full corpus; deliberately-leaking regression probe (temporary test flag) is caught by the scanner.
- **Acceptance criteria:** No GPS/serial/private metadata in any final served derivative; stage order preserved (strip after color conversion, embedding after strip, verification last); masters provably untouched.
- **Stop conditions:** None expected.

### WP-22 — Fingerprint naming + asset manifest generation

- **Phase:** P3 · **Complexity:** M · **Depends on:** WP-21 · **Parallelizable with:** —
- **Objective:** Pipeline stage 8: fingerprint, content-addressed filename, derivative hash, and `generated/asset-manifest.json` with final public URLs and canonical serialization. Fingerprint/name/hash/manifest operate only on FINAL SERVED BYTES (after WP-21 stripping, embedding, and final metadata verification).
- **Frozen references:** IMAGE_PIPELINE §9 (digest length per WP-15 record; provenance semantics), §10 (manifest contract; format-agnostic schema), §8.3 (canonical JSON order, timestamp envelope separation); BUILD_AND_ROUTING §10.
- **Files likely created/modified:** `scripts/media/manifest.*`, `scripts/media/naming.*`, `tests/integration/manifest.*`, `tests/unit/naming.*`.
- **Test-first requirement (RED):** fingerprint/derivative hash computed over final served bytes — changing any upstream stage (source, config, approved embedding) changes final bytes and therefore the URL; corrected-master scenario — replacing a fixture master's bytes under the same Photo ID changes derivative filenames/URLs while Photo ID is unchanged; encoder/config change changes URLs (toolchain-identifier influence proven by unit test); manifest JSON body hash stable across two identical runs (timestamps excluded from deterministic core); every record carries `photo_id, purpose, format, width, height, public_url, bytes, source_hash, derivative_hash` plus provenance fields (source hash, rendering config, toolchain ID); `public_url` paths are final (no later transformation stage exists).
- **Implementation steps:** 1) Digest function over final derivative bytes at the WP-15-frozen length — final bytes embody source bytes + rendering-affecting config + toolchain, satisfying IMAGE_PIPELINE §9.2 hash-input semantics; source_hash/config/toolchain ID are recorded alongside in the manifest for provenance audit. 2) Naming scheme fully determined by the manifest (no placeholder variables, no filename parsing downstream). 3) Manifest writer with sorted keys/stable formatting + metadata envelope. 4) GREEN all RED tests.
- **Verification:** RED set green; manifest validated against its schema; srcset consumers (later WPs) will read structured entries only.
- **Acceptance criteria:** Content addressing proven (corrected masters invalidate cached URLs automatically); manifest determinism proven; no regex-width-extraction path exists anywhere.
- **Stop conditions:** None expected.

### WP-23 — Derivative coverage validation + determinism/regeneration

- **Phase:** P3 · **Complexity:** M · **Depends on:** WP-21, WP-22 · **Parallelizable with:** WP-24
- **Objective:** Closure + determinism guarantees: every published Photo has every required derivative selected by the frozen P3 format contract; semantic determinism; regeneration from empty `generated/`.
- **Frozen references:** IMAGE_PIPELINE §8, §11; TESTING_AND_VISUAL_REGRESSION §4–5; BUILD_AND_ROUTING §8 (integrity gate inputs).
- **Files likely created/modified:** `scripts/media/coverage.*`, `tests/integration/determinism.*`, `tests/integration/coverage.*`.
- **Test-first requirement (RED):** deleting `generated/` then rebuilding reproduces the same logical manifest (photo → purposes → formats → dimensions → URLs set equality) and derivative set; a deliberately missing variant for a published Photo fails coverage validation (build-blocking); draft content with missing derivatives does not block production; coverage report enumerates per-purpose completeness.
- **Implementation steps:** 1) Coverage validator joining the content graph × variant plan from the WP-15 record. 2) Determinism harness: double-run comparison at semantic level (byte-for-byte claimed only within pinned toolchain, documented as such). 3) Empty-state regeneration test wired into `test:integration`. 4) GREEN all RED tests.
- **Verification:** RED set green on the fixture corpus including the ~72-photo gallery (build-time budget observed, informational only — budgets not enforced yet per PERFORMANCE_BUDGET §3.1).
- **Acceptance criteria:** P3 exit items on regeneration, semantic determinism, and coverage validation satisfied.
- **Stop conditions:** Non-determinism root-caused and fixed, never tolerated via retries.

### WP-24 — Manifest consumption boundary (Astro build-time)

- **Phase:** P3 · **Complexity:** M · **Depends on:** WP-22, WP-03 · **Parallelizable with:** WP-23
- **Objective:** Astro consumes `generated/asset-manifest.json` at build time through a typed import boundary; browser never sees the manifest; producer-before-consumer invariant enforced.
- **Frozen references:** IMAGE_PIPELINE §10.1, §13.3; BUILD_AND_ROUTING §1 (DAG), §10; ADR-026.
- **Files likely created/modified:** `src/lib/assets/manifest.*` (typed loader + variant selectors: src/srcset/sizes/intrinsic dimensions/overview/cover per IMAGE_PIPELINE §10.4), `astro.config.mjs` build orchestration note/hook, `tests/integration/manifest-consumption.*`.
- **Test-first requirement (RED):** building with missing manifest fails with a clear producer-before-consumer error (not a runtime crash); building with a stale/incomplete manifest for published content fails closure; a built page's `src`/`srcset` attributes equal manifest entries verbatim; no `<script>`/fetch of the manifest exists in output HTML (browser-consumption prohibition asserted).
- **Implementation steps:** 1) Typed manifest reader with per-purpose selectors (explicit URLs; width descriptors from entries; sizes logic hook accepting layout context — templates supply, never filename parsing). 2) Build orchestration: `media:derive` must precede `astro build` (documented composite script + guard). 3) GREEN all RED tests.
- **Verification:** RED set green; P3 exit "Astro can consume manifest at build time" evidenced.
- **Acceptance criteria:** Manifest contract realized end-to-end; P4/P5 may now start.
- **Stop conditions:** None expected.

**P3 GATE — PASS only when:** benchmark decisions recorded (WP-15 with user review for the quality/payload tradeoff; WP-16 closes D9/D10 technically during P3); pipeline regenerates from empty `generated/`; manifest closure tests pass; privacy stripping + approved output ICC embedding verified on final served derivatives; representative photo quality approved by the user.

---

## 9. P4 — Discovery Pages

### WP-25 — View data assembly layer

- **Phase:** P4 · **Complexity:** M · **Depends on:** WP-13, WP-24 · **Parallelizable with:** WP-26
- **Objective:** Pure data builders producing HomeView / ArchiveView / PlacesView / PlaceView from validated collections + manifest: published-only, deterministic ordering, cover resolution, counts from `photos[]` length.
- **Frozen references:** CONTENT_MODEL §7 (ordering semantics), §10.4 (Recent); FINAL_DESIGN_SPECIFICATION §3.2–3.4 (what each page shows); BUILD_AND_ROUTING §4 (published-only `getStaticPaths` inputs).
- **Files likely created/modified:** `src/lib/views/{home,archive,places,place}.*`, `tests/unit/views.*`.
- **Test-first requirement (RED):** HomeView hero follows WP-11 resolution; Recent uses published_at DESC + ID tie-break; ArchiveView groups by photographed year with stable intra-year ordering; PlacesView alphabetical names-led with region/country and NO counts; PlaceView lists that Place's published Galleries with photographed dates; drafts absent from every view; photo counts derived from array length (Archive cards show counts per frozen design §3.3; Places index shows none per §3.4).
- **Implementation steps:** 1) View builder signatures returning plain serializable data (no template concerns). 2) Cover resolution via `cover_photo_id` → manifest cover purpose (never first-photo). 3) Year grouping from photographed dates (Archive/Place chronology) vs published_at (Home/Recent) — both concepts kept distinct with named tests. 4) GREEN all RED tests.
- **Verification:** View unit tests green; fixture corpus views snapshot-stable across runs.
- **Acceptance criteria:** All discovery data needs met by pure builders; ordering semantics proven against UD-003/UD-004.
- **Stop conditions:** None expected.

### WP-26 — Site layout + accessible no-JS navigation

- **Phase:** P4 · **Complexity:** M · **Depends on:** WP-04 · **Parallelizable with:** WP-25
- **Objective:** Base layout shell (header/nav/footer/skip link) with accessible no-JS mobile navigation; JS may enhance, never gate.
- **Frozen references:** RUNTIME_AND_PROGRESSIVE_ENHANCEMENT §7 (no-JS contract; prohibited checkbox trick; `<details>`/`<summary>` acceptable; baseline-visible-links acceptable), §7.4 (53px menu targets; no persistent app chrome; identity preserved); FINAL_DESIGN_SPECIFICATION §4.2, §5.1, §5.3.
- **Files likely created/modified:** `src/layouts/Base.astro`, `src/components/SiteHeader.astro`, `src/components/SiteNav.astro`, `src/components/SiteFooter.astro`, `tests/e2e/navigation.*`.
- **Test-first requirement (RED, in JS-blocked context):** all four nav destinations reachable by keyboard with scripts disabled; menu links ≥53px height (padding-block 12px); no `display:none`-only toggle exists (DOM assertion); with JS enabled, enhanced toggle (if implemented) keeps Escape-close + focus-restoration semantics (full dialog semantics land with Overview patterns; nav enhancement stays minimal); 320px scrollWidth ≤320.
- **Implementation steps:** 1) Desktop nav: native anchors in flow. 2) Mobile: baseline visible/in-flow links OR `<details>/<summary>`; CSS-enhanced; optional JS animation layer. 3) Focus styles + skip link wired from WP-04. 4) Footer per frozen pages (continuation→footer spacing handled by Gallery WP-37). 5) GREEN all RED tests in both JS modes.
- **Verification:** e2e navigation suite green (JS on + JS blocked); touch-target measurements recorded.
- **Acceptance criteria:** Core navigation works with JS failing; no prohibited strategy present; mobile constraints (no app chrome, safe areas) honored.
- **Stop conditions:** Any inaccessible fallback is P0 — fix before page work proceeds.

### WP-27 — Discovery card primitive (bounded reuse decision)

- **Phase:** P4 · **Complexity:** S · **Depends on:** WP-25 · **Parallelizable with:** WP-26
- **Objective:** One shared Gallery card component for Home/Archive/Place with frozen metadata hierarchy — and an explicit decision log rejecting a universal card framework.
- **Frozen references:** FINAL_DESIGN_SPECIFICATION §3.2–3.4 (card content: uncropped cover, serif title, photographed date, Place, count on Archive cards; no counts on Places index); IMAGE_PIPELINE §15 (uncropped covers).
- **Files likely created/modified:** `src/components/GalleryCard.astro`, `docs/implementation/WP-27.md` (reuse decision: genuine shared component vs page-specific composition).
- **Test-first requirement (RED):** card renders cover uncropped with intrinsic dimensions from manifest (CLS-preventing width/height attrs); metadata hierarchy order matches frozen spec; a variant probe proving Home/Archive/Place differences are prop-level, not fork-level.
- **Implementation steps:** 1) Implement single component with explicit props (showCount, context). 2) Cover via manifest cover purpose; lazy loading per PERFORMANCE_BUDGET §6.1 card row. 3) Decision log: why one component suffices; what would trigger a split later (none anticipated). 
- **Verification:** Card tests green in all three contexts; no second card abstraction exists (grep).
- **Acceptance criteria:** Bounded reuse achieved; no premature framework.
- **Stop conditions:** If a page needs a materially different composition, create a page-specific composition and record it — do not generalize.

### WP-28 — Home page

- **Phase:** P4 · **Complexity:** M · **Depends on:** WP-25, WP-26, WP-27 · **Parallelizable with:** WP-29, WP-30
- **Objective:** `/` implementing the frozen Home spec: featured-or-latest hero, metadata cue, View Gallery link, Archive/Places discovery, Recent grid.
- **Frozen references:** FINAL_DESIGN_SPECIFICATION §3.2 + G3 (75svh desktop frame-width-bound; 60svh mobile landscape; 70svh mobile portrait); CONTENT_MODEL §10; RUNTIME §11.1 (LCP image: eager, fetchpriority high, preload).
- **Files likely created/modified:** `src/pages/index.astro`, `src/components/HomeHero.astro`, `tests/e2e/home.*`, `tests/unit/home-hero-scale.*`.
- **Test-first requirement (RED):** hero selection equals HomeView resolution (featured explicit / latest fallback); hero frame respects the three svh ceilings at the capture viewports (computed-style assertions); LCP candidate preload link present exactly once; Recent grid deterministic; no marketing/overlay/button-treatment elements (DOM inventory assertion against §3.2 prohibitions).
- **Implementation steps:** 1) Hero from cover derivative (manifest) with intrinsic dimensions + preload. 2) Metadata cue: plain text photographed date/place above title; View Gallery link to `/galleries/{slug}`. 3) Discovery links (Archive/Places). 4) Recent grid (2–3 columns by content fit). 5) GREEN all RED tests.
- **Verification:** e2e + capture baselines recorded (feeds WP-32); axe zero violations.
- **Acceptance criteria:** G3 ceilings honored; featured logic per ADR-019; no weekly/curated concepts.
- **Stop conditions:** None expected.

### WP-29 — Archive page

- **Phase:** P4 · **Complexity:** M · **Depends on:** WP-25, WP-26, WP-27 · **Parallelizable with:** WP-28, WP-30
- **Objective:** `/archive` with photographed-year grouping, non-sticky year landmarks, content-fit multi-column grid.
- **Frozen references:** FINAL_DESIGN_SPECIFICATION §3.3; CONTENT_MODEL §7 ordering consequence; WP-25 ArchiveView.
- **Files likely created/modified:** `src/pages/archive.astro`, `src/components/YearHeading.astro`, `tests/e2e/archive.*`.
- **Test-first requirement (RED):** year headings derive from photographed dates (not published_at); grid is 3 columns at reference width and collapses to 2 by content fit (not device labels); mixed portrait/landscape rows preserve aspect (no crop; uneven row depth accepted); mobile single column with years visible; single-gallery archive edge case renders sanely (one year, one card).
- **Implementation steps:** 1) Year sections from ArchiveView. 2) Grid with content-fit collapse. 3) Cards via WP-27 (showCount=true). 4) GREEN all RED tests.
- **Verification:** e2e green; baselines captured for WP-32.
- **Acceptance criteria:** Chronology uses photographed time; counts visible on cards; no sticky landmarks.
- **Stop conditions:** None expected.

### WP-30 — Places index + Place detail

- **Phase:** P4 · **Complexity:** M · **Depends on:** WP-25, WP-26, WP-27 · **Parallelizable with:** WP-28, WP-29
- **Objective:** `/places` names-led index (no counts anywhere) and `/places/{slug}` detail with flat Gallery list at low volume + progressive year grouping.
- **Frozen references:** FINAL_DESIGN_SPECIFICATION §3.4; CONTENT_MODEL §6.3 (no Visit/Trip/coordinates/counts); BUILD_AND_ROUTING §4 (Place route published-only).
- **Files likely created/modified:** `src/pages/places.astro`, `src/pages/places/[slug].astro`, `tests/e2e/places.*`.
- **Test-first requirement (RED):** index alphabetical by name with region/country disambiguation only; zero count strings in index DOM; detail shows name + location context leading, then Gallery covers/titles/photographed dates; year grouping appears only when chronology is useful (multi-year presence) per frozen "progressive" rule — threshold kept contextual, no invented hard volume threshold; place with unpublished-only Galleries produces no public route.
- **Implementation steps:** 1) Index from PlacesView. 2) Detail `getStaticPaths` published-only. 3) Progressive year grouping function with documented contextual trigger. 4) GREEN all RED tests.
- **Verification:** e2e green; baselines captured; no-count grep gate green.
- **Acceptance criteria:** Names-led, disambiguation-only metadata, no counts, no geography devices.
- **Stop conditions:** None expected.

### WP-31 — About + 404 pages

- **Phase:** P4 · **Complexity:** S · **Depends on:** WP-26 · **Parallelizable with:** WP-28, WP-29, WP-30
- **Objective:** `/about` typography contract and the static 404 page.
- **Frozen references:** FINAL_DESIGN_SPECIFICATION §3.5 (About measure 60–70 Latin / 28–36 CJK chars, paragraph spacing); DEPLOYMENT_ARCHITECTURE §7 (static 404, no SPA fallback); BUILD_AND_ROUTING §4 route table.
- **Files likely created/modified:** `src/pages/about.astro`, `src/pages/404.astro`, `tests/e2e/static-pages.*`.
- **Test-first requirement (RED):** About body measure within frozen ranges at desktop/mobile capture viewports (computed line-length assertions); 404 page exists in build output at `404.html`; preview-server request to an unknown path returns status 404 with the page body.
- **Implementation steps:** 1) About page with placeholder editorial text slot (real copy is authoring, not code). 2) 404 page consistent with frozen visual system (canvas, primary/secondary text only). 3) GREEN all RED tests.
- **Verification:** Tests green; later Nginx contract (WP-50) will serve it via `error_page`.
- **Acceptance criteria:** Both routes match canonical route table; 404 is real HTTP 404 behavior end-to-end (verified at P9). Final About copy is owned by the WP-60 content-readiness gate — placeholder copy must not silently launch.
- **Stop conditions:** None expected.

### WP-32 — Discovery visual-regression baseline capture

- **Phase:** P4 · **Complexity:** M · **Depends on:** WP-28, WP-29, WP-30 · **Parallelizable with:** P5 lane start
- **Objective:** Governed baselines for discovery states using the deterministic capture environment; drift prevention begins here, adjudication stays in P8.
- **Frozen references:** TESTING_AND_VISUAL_REGRESSION §8 (capture determinism invariants; state list; governance); IMPLEMENTATION_PHASES P4 exit; WP-06 harness.
- **Files likely created/modified:** `tests/capture/states/discovery.*`, `tests/baselines/discovery/` (+ SHA-256 integrity manifest), baseline governance record.
- **Test-first requirement:** Capture-state definitions exist and run reproducibly: two consecutive capture runs produce pixel-identical screenshots in the pinned environment (infrastructure property check) — fails before the environment is stable.
- **Implementation steps:** 1) States: Home desktop, Home mobile portrait, Archive desktop, Places index desktop, Place detail desktop (+ mobile where frozen states list requires). 2) Run capture per WP-06 invariants; record SHA-256 integrity manifest (integrity only, never cross-environment equivalence). 3) Baseline review note: what each baseline proves. 4) Wire `capture:diff` thresholds (informational until WP-47 governance).
- **Verification:** Reproducibility check green; baselines committed with governance record.
- **Acceptance criteria:** P4 exit "visual regression harness captures baselines for discovery pages" satisfied.
- **Stop conditions:** Environment instability (font/network/animation) must be fixed before any baseline is accepted.

**P4 GATE — PASS only when:** hero matches G3; featured selection per ADR-019; Archive years correct; Places names-led with no counts; canonical routes match; discovery baselines captured.

---

## 10. P5 — Gallery Core

### WP-33 — Gallery route + GalleryView data assembly

- **Phase:** P5 · **Complexity:** M · **Depends on:** WP-24, WP-13 · **Parallelizable with:** WP-28..WP-30 (after WP-26)
- **Objective:** `/galleries/{slug}` published-only static paths + GalleryView: header data, photo sequence with full manifest resolution, continuation data, back-to-origin context contract.
- **Frozen references:** BUILD_AND_ROUTING §4 (route constraints; published-only `getStaticPaths`); CONTENT_MODEL §8, §9; IMAGE_PIPELINE §10.4; RUNTIME §10.
- **Files likely created/modified:** `src/pages/galleries/[slug].astro` (route skeleton), `src/lib/views/gallery.*`, `tests/unit/gallery-view.*`, `tests/integration/gallery-routes.*`.
- **Test-first requirement (RED):** production `getStaticPaths` emits published slugs only (draft probe absent); GalleryView resolves per-photo `src`/`srcset`/sizes-input/intrinsic dimensions from manifest without filename parsing; continuation data resolves next target title+slug via ID; missing manifest entry for a published photo fails the build (closure); direct-entry origin context has a defined safe static fallback value.
- **Implementation steps:** 1) GalleryView builder (sequence entries, header fields, continuation, origin contract: referring discovery context when derivable at build time, safe static fallback otherwise — per RUNTIME §4.1 "derived from navigation context with a safe static fallback"). 2) Route wiring with manifest selectors from WP-24. 3) GREEN all RED tests.
- **Verification:** RED set green; draft gallery unreachable in production build output (404 probe).
- **Acceptance criteria:** Route + data contracts ready for rendering WPs; closure fail-closed proven.
- **Stop conditions:** None expected.

### WP-34 — Gallery header (frozen editorial treatment)

- **Phase:** P5 · **Complexity:** M · **Depends on:** WP-33, WP-26 · **Parallelizable with:** WP-35
- **Objective:** Non-sticky header on the reading column: Back to origin, serif Display title, photographed date/range + Place(s), optional description, Overview {count} control (rendered; behavior lands in P6).
- **Frozen references:** FINAL_DESIGN_SPECIFICATION §3.1 content order + composition (header ≈680px leading-edge aligned, NOT STICKY); RUNTIME §10.2; §5.5 (exactly one `<h1>` — Gallery title).
- **Files likely created/modified:** `src/components/GalleryHeader.astro`, `tests/e2e/gallery-header.*`.
- **Test-first requirement (RED):** header not sticky (computed position assertion after scroll); title is the page's only `<h1>`; date range + Place(s) render as metadata sans with tabular numerals; description absent when null (no reserved block); Overview control shows the exact photo count and is a real button/trigger (JS-off: control absent or inert per RUNTIME §6.7 — Overview does not render without JS).
- **Implementation steps:** 1) Header layout on reading column leading edge. 2) Overview trigger rendered only where JS enhancement loads (progressive pattern decided here: control exists in DOM only with JS, avoiding a dead control without JS). 3) GREEN all RED tests.
- **Verification:** e2e green in JS-on/JS-blocked modes; baseline capture of header state.
- **Acceptance criteria:** Frozen content order exactly; no sticky; no app chrome.
- **Stop conditions:** None expected.

### WP-35 — Photo sequence renderer (rhythm contract)

- **Phase:** P5 · **Complexity:** L · **Depends on:** WP-33 · **Parallelizable with:** WP-34
- **Objective:** The authored sequence in native document flow with the frozen rhythm system, caption contract, image geometry, and loading strategy.
- **Frozen references:** FINAL_DESIGN_SPECIFICATION §3.1 (rhythm table: compact 64/40, base 96/64, breathing 144/96; caption gap 16px; header→first 72/48; media frame `min(90vw,1440px)`; portrait 80svh desktop / ≤82svh mobile; no desktop full-bleed), G4 constraints (orientation never chooses rhythm; no count-based compression); RUNTIME §3 (captions), §11 (loading strategy); PERFORMANCE_BUDGET §5 (no virtualization baseline), §6.1.
- **Files likely created/modified:** `src/components/PhotoFigure.astro`, `src/components/GallerySequence.astro`, `src/styles/gallery.css`, `tests/e2e/gallery-sequence.*`, `tests/e2e/gallery-rhythm.*`.
- **Test-first requirement (RED):** spacing measurements at capture viewports: base 96/64, compact 64/40, breathing 144/96 between figures per authored `rhythm_after`; captioned photo rhythm starts after caption; uncaptioned photo has no figcaption AND no reserved region (DOM + spacing assertion); photo→caption gap 16px; header→first-photo 72/48; figure image centered inside `min(90vw,1440px)`; portrait height ceiling assertions (80svh desktop, ≤82svh mobile); first image eager + fetchpriority high + single preload; subsequent lazy + decoding async; width/height attributes equal manifest intrinsic dimensions; captions wrap without clamp/truncation at full authored length (3-line CJK caption fixture); no virtualization/pagination/swipe elements exist (DOM inventory).
- **Implementation steps:** 1) `<figure>/<img>/<figcaption>` sequence from GalleryView. 2) Rhythm via authored class tokens only (base default when omitted). 3) Responsive `srcset`/`sizes` from manifest selectors (sizes from layout context: reading/media column). 4) Caption styling per RUNTIME §3.1 (sans 14–16/400/1.5–1.6, CJK 1.75, #5F5E59, reading-column width, leading-edge aligned). 5) Mobile native vertical progression; safe areas. 6) GREEN all RED tests.
- **Verification:** Rhythm measurement suite green at both capture viewports; long-gallery-72 fixture renders with no count-based compression (spacing spot-checks along the sequence).
- **Acceptance criteria:** G4 frozen values machine-measured; caption contract exact; loading strategy per table; CLS-prevented layout.
- **Stop conditions:** Any spacing value not in the frozen table is P0 implementation drift — fix, do not negotiate.

### WP-36 — Position annotation (progressive enhancement)

- **Phase:** P5 · **Complexity:** S · **Depends on:** WP-35 (must be complete) · **Parallelizable with:** WP-37
- **Objective:** `n / total` annotation: IntersectionObserver-driven, non-interactive, aria-hidden, yielding at header/continuation boundaries.
- **Frozen references:** FINAL_DESIGN_SPECIFICATION §3.1 G5 + §5.5 (aria-hidden); RUNTIME §5 (desktop trailing margin; mobile bottom-right raised #EFECE5, 12.5px secondary tabular; no pill/progress/arrows); §1.2 (acceptable enhancement; absent without JS).
- **Files likely created/modified:** `src/components/PositionAnnotation.astro`, `src/lib/js/position-observer.*`, `tests/e2e/position-annotation.*`.
- **Test-first requirement (RED):** with JS blocked the annotation element is absent; with JS it updates `n / total` (tabular numerals) when scrolling between figures; observer targets photo figures only; annotation hidden/repositioned at header and continuation regions; `aria-hidden="true"` and not focusable; mobile variant shows raised backing inset from safe areas.
- **Implementation steps:** 1) Observer module (most-visible photo strategy per RUNTIME §5.4 pseudocode). 2) Desktop trailing-margin placement; mobile bottom-right backing. 3) Boundary-yield logic keyed to header/continuation intersection. 4) GREEN all RED tests.
- **Verification:** e2e green; no custom scroll handler replacing native loading (code review assertion).
- **Acceptance criteria:** G5 contract exact; enhancement-only semantics preserved.
- **Stop conditions:** None expected.

### WP-37 — Gallery ending (continuation semantics)

- **Phase:** P5 · **Complexity:** M · **Depends on:** WP-33 · **Parallelizable with:** WP-35, WP-36
- **Objective:** Exact frozen ending: end pause → End label → Next Gallery title → Back to origin; no-next variant; continuation→footer spacing; direct-entry/back-origin behavior.
- **Frozen references:** FINAL_DESIGN_SPECIFICATION §3.1 + G7 (pause 168/112; Next serif 28/22; `End of {title}` metadata sans; no-next: Back primary / Browse Archive secondary); RUNTIME §4 (full continuation contract incl. prohibitions: no cover image, no styled button, no arrow glyph, no multiple Nexts; continuation→footer XXL 96px).
- **Files likely created/modified:** `src/components/GalleryContinuation.astro`, `tests/e2e/gallery-ending.*`.
- **Test-first requirement (RED):** end pause measured 168 desktop / 112 mobile between last photo (or caption) and End label; standard variant renders exactly the three-line structure with Next as native `<a>` to `/galleries/{target-slug}`; no-next variant renders Back-primary + Browse-Archive-secondary; no cover/thumbnail/button/pill/arrow in continuation DOM (inventory assertion); continuation→footer gap 96px; cycle fixture (A→B→A) renders continuation on both; direct entry (no referrer context) uses the safe static fallback origin without breaking.
- **Implementation steps:** 1) Continuation component consuming GalleryView continuation data. 2) Variant switch strictly on `next_gallery_id` resolution. 3) Origin fallback logic per RUNTIME §4.1. 4) GREEN all RED tests.
- **Verification:** Ending measurements green at both viewports; baselines for end states (feeds WP-38).
- **Acceptance criteria:** G7 exact; every prohibited pattern absent by construction.
- **Stop conditions:** None expected.

### WP-38 — Gallery visual-regression baseline capture

- **Phase:** P5 · **Complexity:** M · **Depends on:** WP-34, WP-35, WP-36, WP-37 · **Parallelizable with:** P6 lane
- **Objective:** Governed Gallery baselines across the frozen states, per the Stage 3C-derived state list.
- **Frozen references:** TESTING_AND_VISUAL_REGRESSION §8.3 (state list); FINAL_DESIGN_SPECIFICATION §8 (screenshot determinism expectations); IMPLEMENTATION_PHASES P5 exit.
- **Files likely created/modified:** `tests/capture/states/gallery.*`, `tests/baselines/gallery/`.
- **Test-first requirement:** Reproducibility check (double-capture pixel identity in pinned environment) green for Gallery states before any baseline is accepted.
- **Implementation steps:** 1) States: Gallery desktop base rhythm; breathing rhythm; end pause/continuation; no-next ending; mobile caption + mobile position annotation; landscape-oriented gallery; portrait-oriented gallery; long gallery (long-gallery-72: representative sections + overview-trigger state). 2) Capture + integrity manifest + governance note. 3) Feeds WP-47 adjudication set.
- **Verification:** Baselines committed; governance record updated; reproducibility green.
- **Acceptance criteria:** P5 exit "visual regression baselines captured for Gallery rendering" satisfied.
- **Stop conditions:** Drift discovered during capture (vs frozen values) is a P0/P1 implementation finding — route to fix, not to baseline update.

**P5 GATE — PASS only when:** base rhythm 96/64; compact/breathing authored-only; captions visible/no-reserved-region; continuation matches G7 typography/spacing; annotation yields at boundaries; baselines captured.

---

## 11. P6 — Overview and Interactions

### WP-39 — Overview presentation

- **Phase:** P6 · **Complexity:** M · **Depends on:** WP-33 (data contract) + P5 Gate PASS (P6 entry) · **Parallelizable with:** — (must not start before the P5 entry/exit contract allows it)
- **Objective:** Full-viewport Overview layer with frozen grid contracts and contained uncropped thumbnails.
- **Frozen references:** FINAL_DESIGN_SPECIFICATION §3.1 Overview + G6; RUNTIME §6; ADR-015; PERFORMANCE_BUDGET §9.1 (cells ≥111px @390).
- **Files likely created/modified:** `src/components/OverviewLayer.astro`, `src/styles/overview.css`, `tests/e2e/overview-presentation.*`.
- **Test-first requirement (RED):** desktop 6 columns; 5 columns at ≤1100px; mobile 3 columns with 8px gaps and ≈111px cells at 390 viewport; thumbnails contained/uncropped with aspect preserved (computed box vs intrinsic ratio assertion); current-photo marker 2px solid #0B57D0 + index tag on the active item; layer uses raised opaque backing per frozen G6 features; Close is a text control with ≥44×44 target via padding extension; no runtime column-count switch exists.
- **Implementation steps:** 1) Grid markup consuming overview-purpose derivatives (lazy). 2) Marker + index tag bound to current position state (from WP-36 observer source of truth). 3) Close control. 4) GREEN all RED tests.
- **Verification:** Presentation suite green at capture viewports incl. the 1100px boundary.
- **Acceptance criteria:** G6 geometry exact; contained thumbs proven; no square crop anywhere.
- **Stop conditions:** None expected.

### WP-40 — Overview behavior + accessibility semantics

- **Phase:** P6 · **Complexity:** L · **Depends on:** WP-39, WP-34 · **Parallelizable with:** —
- **Objective:** Dialog behavior: open at current sequence context, focus management, Escape, jump-to-photo with exact position restore, scroll lock, reduced-motion synchronous close — with visibility-state (not DOM-detachment) semantics.
- **Frozen references:** RUNTIME §6 (full Overview contract), §8.3 (reduced motion); TESTING_AND_VISUAL_REGRESSION §6.1 (mandatory test semantics incl. visibility-not-detachment, focus restoration, trap cycling across boundaries); FINAL_DESIGN_SPECIFICATION §5.1, §5.4.
- **Files likely created/modified:** `src/lib/js/overview.*`, `src/components/OverviewLayer.astro` (behavior wiring), `tests/e2e/overview-behavior.*`.
- **Test-first requirement (RED, exactly the canonical test semantics):** opening moves focus into the layer; `aria-modal="true"` present; background scroll locked while open; Tab/Shift+Tab cycle within the layer including wrap across first/last boundaries; Escape closes and restores focus to the trigger; close via button restores focus to trigger; visibility toggles via hidden-state semantics (element may remain attached — tests assert visibility, never detachment); jump-to-thumbnail scrolls the gallery so the selected photo is visible, closes the Overview, and restores focus appropriately into the document flow; opening positions/marks the currently viewed photo; under `prefers-reduced-motion: reduce` the close path completes synchronously (no transition frame waits).
- **Implementation steps:** 1) Dialog state machine (open/close/jump) with trigger capture + focus restoration. 2) Focus trap cycling. 3) Scroll lock (body-level) with restore. 4) Jump: close first or scroll-then-close per measured UX, but exact position restore is mandatory either way. 5) Reduced-motion synchronous path. 6) GREEN all RED tests.
- **Verification:** Full behavior suite green (keyboard + pointer); INP-relevant interactions snappy (informative timing log for WP-45).
- **Acceptance criteria:** Every canonical interaction test from TESTING_AND_VISUAL_REGRESSION §6.1 passes with the specified semantics.
- **Stop conditions:** Focus-restore defects are P0 — no downstream a11y work until fixed.

### WP-41 — No-JS completeness verification

- **Phase:** P6 · **Complexity:** M · **Depends on:** WP-40, WP-28, WP-29, WP-30, WP-31 · **Parallelizable with:** —
- **Objective:** Prove every page is fully readable/navigable with JavaScript disabled or failing; Gallery remains complete without Overview.
- **Frozen references:** RUNTIME §1–2 (core-without-JS guarantee + JS inventory table); TESTING_AND_VISUAL_REGRESSION §6.3.
- **Files likely created/modified:** `tests/e2e/no-js.*` (JS-blocked context suite across all six page types + 404).
- **Test-first requirement (RED by nature):** the suite itself — asserting with scripts blocked: Gallery sequence scrolls natively and fully; captions inline; continuation links native and functional; nav usable (WP-26 fallback); skip link works; Overview control/layer absent (not dead); position annotation absent; no console-blocking errors when JS re-enabled (failure-tolerance probe: broken-JS simulation leaves core content readable).
- **Implementation steps:** 1) Run the matrix across all routes in the blocked context. 2) Fix any discovered dependency as a P0 regression in its owning WP's component (not by adding JS requirements). 3) Document the verified CORE/ENHANCEMENT table against RUNTIME §2.1.
- **Verification:** Suite green; enhancement-absence matches the frozen acceptable-enhancement list exactly.
- **Acceptance criteria:** Core-without-JS guarantee evidenced for every route; P6 exit "core navigation usable without JavaScript" satisfied.
- **Stop conditions:** Any core content gated on JS is an architecture violation — stop and fix at the source.

**P6 GATE — PASS only when:** modal opens/closes reliably (keyboard + pointer); trap cycles across boundaries; Escape closes + restores focus; scroll locked; thumbnails contained/uncropped; reduced motion zeroes transitions; core navigation no-JS.

---

## 12. P7 — Accessibility, SEO, and Performance

### WP-42 — Alt text policy gate ⚑ USER REVIEW

- **Phase:** P7 pre-entry decision gate (resolves before P7 begins; P7 a11y hardening requires this resolved) · **Complexity:** S · **Depends on:** WP-13 · **Parallelizable with:** WP-44 prep
- **Objective:** Resolve OQ-04 as a recorded editorial/accessibility policy and wire it into publication validation.
- **Frozen references:** OPEN_QUESTIONS OQ-04; CONTENT_MODEL §5.2 (`alt_text` semantics: no filename fallback; caption ≠ alt); ADR-016; RUNTIME §3.3.
- **Files likely created/modified:** `docs/implementation/decisions/ALT-POLICY.md`, `src/lib/validate/alt.*`, `tests/unit/alt-policy.*`.
- **Test-first requirement (RED, after policy recording):** the decided rule is machine-enforced — e.g., if policy requires authored alt for meaningful published Photos: missing alt fails production validation; decorative Photos pass with explicit `alt=""`; filename-derived alt always fails; caption-to-alt auto-copy never happens (assertion on emitted HTML).
- **Implementation steps:** 1) Present the decision surface to the user: (a) require meaningful alt for all published Photos; (b) require alt OR explicit decorative `alt=""`; (c) warn-only MVP. 2) Record decision + rationale. 3) Implement validation hook per decision. 4) Ensure rendering: authored alt used; `alt=""` for decorative; no fallback generation. 5) GREEN tests.
- **Verification:** Policy tests green; decision doc recorded; DEFERRED_ENGINEERING_DECISIONS.md updated.
- **Acceptance criteria:** OQ-04 resolved with user sign-off; enforcement live in production validation.
- **Stop conditions:** None — this is a decision package, not an engineering unknown.

### WP-43 — Accessibility audit + remediation

- **Phase:** P7 · **Complexity:** L · **Depends on:** WP-41, WP-42 · **Parallelizable with:** WP-44
- **Objective:** Systematic WCAG 2.2 AA verification: automated + manual, across all page types, with remediation inside frozen design.
- **Frozen references:** FINAL_DESIGN_SPECIFICATION §5 (full); RUNTIME §8, §12; TESTING_AND_VISUAL_REGRESSION §7; PERFORMANCE_BUDGET §9.2 (320px reflow, 200% zoom via 720×450).
- **Files likely created/modified:** `tests/e2e/a11y/**` (keyboard traversal scripts, focus audits), axe suite expansion, remediation edits wherever they land, `docs/implementation/WP-43.md` (audit evidence incl. manual checklist results).
- **Test-first requirement (RED where applicable):** axe zero-violation runs per page type (Home, Archive, Places Index, Place Detail, Gallery, About); keyboard-only full traversal incl. skip link → `#main`; visible focus 2px #0B57D0/3px offset on every focusable; exactly one `<h1>` per page with no skipped levels; landmarks present; touch targets ≥44px (menu 53px); 320px reflow `scrollWidth ≤ 320` everywhere; 200% zoom at 720×450 with no vertical clipping of title/metadata/caption/position/controls; reduced-motion verification incl. synchronous JS close paths.
- **Implementation steps:** 1) Automated axe matrix + manual traversal protocol (documented, repeatable). 2) Remediate findings WITHOUT altering frozen values (contrast, focus, semantics fixes only). 3) Record manual-check evidence: keyboard, focus, targets, reduced motion — automated tooling alone never certifies. 4) GREEN all.
- **Verification:** Axe zero violations; manual checklist complete with evidence; no WCAG certification claim beyond evidence (per FINAL_DESIGN_SPECIFICATION §7.2 limitation language).
- **Acceptance criteria:** P7 exit a11y items satisfied; evidence packet recorded.
- **Stop conditions:** A conflict between WCAG and a frozen value would be a design exception — escalate, do not improvise.

### WP-44 — SEO artifacts

- **Phase:** P7 · **Complexity:** M · **Depends on:** all route WPs (WP-28..WP-31, WP-33) · **Parallelizable with:** WP-43, WP-45
- **Objective:** Title/meta/canonical/OG + sitemap + robots with published-only guarantees; no visible UI change for SEO.
- **Frozen references:** BUILD_AND_ROUTING §4 (routes; sitemap published-only); CONTENT_MODEL §8.3 (draft exclusion); DEPLOYMENT_ARCHITECTURE §6.2 (HTML/sitemap cache class).
- **Files likely created/modified:** `src/lib/seo/*`, sitemap build step, `public/robots.txt`, `tests/integration/seo.*`.
- **Test-first requirement (RED):** sitemap contains only published canonical routes (draft probe excluded); canonical URLs match route table exactly (`/galleries/{slug}` only); OG/title/description present per published page with deterministic values; robots.txt valid; redirect targets not duplicated as canonical entries; no UI element added/changed by SEO work (DOM diff against pre-SEO baselines).
- **Implementation steps:** 1) Per-page metadata pipeline from view data. 2) Sitemap generator (published-only, canonical URLs). 3) robots.txt. 4) Stable-URL validation (slug changes produce redirect entries, not broken canonicals — cross-check with WP-12 data). 5) GREEN all RED tests.
- **Verification:** SEO suite green; DOM-diff gate green.
- **Acceptance criteria:** P7 exit "sitemap validates and excludes drafts" satisfied; no visible drift.
- **Stop conditions:** None expected.

### WP-45 — Performance measurement baseline + budget enforcement decisions

- **Phase:** P7 · **Complexity:** L · **Depends on:** WP-35, WP-40 (representative real pages incl. long gallery + Overview) · **Parallelizable with:** WP-44
- **Objective:** Measure representative pages under defined conditions; record MEASURED BASELINES; decide which budgets become CI gates. No unmeasured value becomes a gate.
- **Frozen references:** PERFORMANCE_BUDGET §1–5, §10–11 (classification rules; CWV targets LCP ≤2.5s / CLS ≤0.1 / INP ≤200ms; engineering budgets; measurement plan); ADR-013 (measure before virtualization).
- **Files likely created/modified:** `scripts/perf/*` (Lighthouse/lab runner, payload accounting), `docs/implementation/decisions/PERFORMANCE-BASELINE.md`, CI gate config (only for approved thresholds).
- **Test-first requirement:** Measurement reproducibility probe: repeated lab runs of the same build produce metric values within recorded variance bands — fails before the measurement environment is stable.
- **Implementation steps:** 1) Measure Home, Place detail, normal Gallery, long Gallery (long-gallery-72), Overview interaction: LCP/CLS/INP lab (throttled), HTML/CSS/JS/image/font payload per page type, DOM size, long-gallery memory on desktop AND low-end mobile (real device or faithful emulation, recorded). 2) Record MEASURED BASELINE tables with environment metadata. 3) Compare against aspirational budgets (§3): keep/adjust with rationale — budgets yield to frozen design quality, never the reverse. 4) Promote selected values to CI gates (e.g., size-report thresholds) ONLY where baseline evidence supports; document the promotion per classification rules. 5) Virtualization verdict per §5.2 (baseline native flow confirmed or measured justification required).
- **Verification:** Baseline doc complete; CI gates (if any) trace to MEASURED BASELINE entries; long-gallery measurement recorded for ADR-013.
- **Acceptance criteria:** P7 exit "performance measurements recorded; budgets met or explicitly adjusted with rationale" satisfied.
- **Stop conditions:** If an aspirational budget forces image-quality degradation, the budget yields — record the adjustment, do not compress below visual acceptability.

### WP-46 — CJK implementation gate ⚑ USER REVIEW

- **Phase:** P7 · **Complexity:** M · **Depends on:** WP-05 (PoC), WP-13 (content scanning) · **Parallelizable with:** WP-43..WP-45
- **Objective:** Finalize the CJK subsetting implementation (OQ-05), prove glyph coverage against authored content, and review real Chinese/Latin rendering with the user.
- **Frozen references:** PERFORMANCE_BUDGET §7 (Options A/B; mandatory rules); RISK_REGISTER RISK-007; FINAL_DESIGN_SPECIFICATION §2.2/G1; IMPLEMENTATION_PHASES P7 exit.
- **Files likely created/modified:** `scripts/fonts/subset.*` (build integration per chosen option), `scripts/fonts/coverage-check.*`, `tests/integration/cjk-coverage.*`, updated font assets, `docs/implementation/decisions/CJK-SUBSETTING.md`.
- **Test-first requirement (RED):** missing-glyph regression — a fixture introducing a character outside the served subset is detected by build-time coverage validation AND renders via the system CJK fallback without layout breakage (capture probe); `unicode-range` declarations match the actual served subset (mismatch probe fails); preload limited to proven above-fold fonts.
- **Implementation steps:** 1) Character corpus discovery scanning the then-current authored YAML corpus only (test fixtures at this point) — do not assume future pilot/full-ingest content. 2) Install a repeatable build-time CJK coverage check that re-runs automatically on every later content change (WP-58 pilot, WP-59 batches). 3) Finalize Option A or B per WP-05 evidence + operational preference; record decision. 4) Build-time coverage validation wired fail-closed pre-deploy. 5) Mixed Latin/CJK title + rare place-name glyph captures added to the visual state list. 6) User typography rendering review (CJK line-height 1.75, no negative tracking, family identity).
- **Verification:** Coverage suite green; cache behavior verified (hashed font assets); decision doc recorded.
- **Acceptance criteria:** P7 exit "CJK font subsetting operational with verified glyph coverage" satisfied; user review passed.
- **Stop conditions:** Glyph-missing risk beyond fallback tolerance → revisit subset corpus breadth (Option choice may flip; families never change).

**P7 GATE — PASS only when:** automated a11y zero violations + manual checks evidenced; sitemap valid and draft-free; performance baselines recorded with gate decisions; CJK coverage proven; alt policy enforced.

---

## 13. P8 — Visual Regression and Hardening

### WP-47 — Full visual-regression suite + adjudication ⚑ USER REVIEW (Gallery Production Visual Review)

- **Phase:** P8 · **Complexity:** L · **Depends on:** WP-32, WP-38, WP-43, WP-46 · **Parallelizable with:** WP-48 prep
- **Objective:** Final adjudication of the production implementation against frozen design across all canonical states, under the governed baseline process.
- **Frozen references:** TESTING_AND_VISUAL_REGRESSION §8 (entire governance model); FINAL_DESIGN_SPECIFICATION §6 (G1–G7), §8 (implementation checklist); IMPLEMENTATION_PHASES P8.
- **Files likely created/modified:** full state suite in `tests/capture/states/**`, governance records, P0/P1 remediation edits, `docs/implementation/WP-47.md` (adjudication log).
- **Test-first requirement:** Suite completeness probe: every frozen state in TESTING_AND_VISUAL_REGRESSION §8.3 + this plan's additions (Home desktop/mobile; Archive; Places; Place; Gallery landscape; Gallery portrait; long Gallery; Overview desktop/mobile; ending state; no-next state; menu mobile expanded; caption mobile; breathing rhythm; CJK title/caption states) has a capture definition — the probe fails on any missing state.
- **Implementation steps:** 1) Execute full suite against pinned browser/OS/fonts (WP-06 invariants). 2) Pixel-diff threshold evaluation. 3) Human adjudication of every threshold failure — classify: IMPLEMENTATION DRIFT (fix) vs APPROVED DESIGN UPDATE (impossible here — design is frozen; any such claim escalates as a design exception). 4) Fix P0 (core interaction/data/page broken) and P1 (material mismatch with frozen design); P2 (minor polish) logged with disposition. 5) Governed baseline updates only for approved fixes, never automatic. 6) User review: production implementation vs frozen design evidence packet.
- **Verification:** Suite passes with governed baselines; adjudication log complete; no unexplained drift.
- **Acceptance criteria:** P8 exit "visual regression suite passes with governed baselines; no unexplained visual drift" satisfied; user sign-off recorded.
- **Stop conditions:** Agents must NOT redesign G1–G7 to resolve an implementation mismatch — fix the implementation.

### WP-48 — Edge-case hardening + cross-browser verification

- **Phase:** P8 · **Complexity:** M · **Depends on:** WP-45, WP-47 (complete) · **Parallelizable with:** — (smallest-safe contract: sequential execution — broad remediation ownership belongs exclusively to WP-47; WP-48 does not race adjudication)
- **Objective:** Edge cases, cross-browser matrix, low-end mobile, and the long-gallery virtualization verdict evidence.
- **Frozen references:** IMPLEMENTATION_PHASES P8 scope; PERFORMANCE_BUDGET §5.2–5.3, §8.1 (browser matrix); ADR-013.
- **Files likely created/modified:** `tests/e2e/edge-cases.*`, cross-browser run records, `docs/implementation/WP-48.md`.
- **Test-first requirement (RED):** single-gallery archive renders (one year, one card, valid continuation-less ending); maximum-length gallery (long-gallery-72 + extension probe) renders with native lazy loading; mixed portrait/landscape sequences preserve geometry; browser matrix (Chrome ≥90, Safari ≥14, Firefox ≥88, Edge ≥90) passes core interaction smoke; low-end mobile scroll/memory recorded.
- **Implementation steps:** 1) Edge-case suite. 2) Matrix execution + documented results. 3) Low-end mobile Gallery scroll performance + memory measurement (final input to ADR-013 verdict from WP-45). 4) Fix discovered P0/P1s.
- **Verification:** All suites green; matrix documented; virtualization assumption validated or measured justification recorded.
- **Acceptance criteria:** P8 exit items on cross-browser + long-gallery measurement satisfied.
- **Stop conditions:** None expected.

### WP-49 — Frozen-design traceability verification

- **Phase:** P8 · **Complexity:** M · **Depends on:** WP-47 · **Parallelizable with:** —
- **Objective:** Verify live that every frozen requirement has an implementation owner and a verification owner — the traceability table made executable.
- **Frozen references:** IMPLEMENTATION_TRACEABILITY.md (this plan's companion); FINAL_DESIGN_SPECIFICATION §8 checklist.
- **Files likely created/modified:** `scripts/verify/traceability.*` (maps table rows to test IDs and runs them), updated traceability doc statuses.
- **Test-first requirement:** Traceability completeness probe: every G1–G7 value, route, caption/continuation/Overview/nav/focus/reduced-motion contract has ≥1 automated test or recorded manual evidence row — fails on any orphan row.
- **Implementation steps:** 1) Generate the requirement→test map from IMPLEMENTATION_TRACEABILITY.md. 2) Execute; collect evidence links. 3) Close gaps (add missing verifications). 4) Run FINAL_DESIGN_SPECIFICATION §8 checklist line-by-line with evidence.
- **Verification:** Map 100% covered; checklist evidence recorded.
- **Acceptance criteria:** P8 exit "all frozen states (G1–G7) verified against production rendering" evidenced row-by-row.
- **Stop conditions:** Any orphan requirement blocks P9 entry.

**P8 GATE — PASS only when:** suite green with governed baselines; no unexplained drift; cross-browser documented; long-gallery measurement confirms no virtualization (or measured justification); traceability complete.

---

## 14. P9 — Deployment and Recovery Verification

All deployment work is GNU/Linux VPS-scoped. Rehearsal targets a NON-production environment; production switch happens only at P10 acceptance.

### WP-50 — Environment + Nginx baseline configuration

- **Phase:** P9 · **Complexity:** M · **Depends on:** — (P8 gate passed) · **Parallelizable with:** WP-51, WP-52, WP-55 research
- **Objective:** VPS environment structure + Nginx server configuration satisfying all architectural contracts, incl. a staging target for rehearsal.
- **Frozen references:** DEPLOYMENT_ARCHITECTURE §2 (release dirs + current symlink), §7 (static 404; forbidden SPA fallback), §8 (/health), §9 (Nginx contract), §12 (secrets), §3.2 (reload policy; open_file_cache verification); TECHNICAL_API_VERIFICATION §3.
- **Files likely created/modified:** `deploy/nginx/*` (server block, cache-policy includes, health, 404 wiring), `deploy/env/*` (paths, users), `docs/implementation/WP-50.md` (environment record: paths, deploy user, key escrow references).
- **Test-first requirement (RED, against staging):** `try_files $uri $uri/ =404` returns real 404 (never index fallback); `/health` returns 200 plain text; hashed-asset location serves immutable long-cache headers; HTML location serves short/no-cache/revalidate; `autoindex off`; MIME strict; gzip on text types; security headers present (no obsolete-header theater); symlink resolution verified with `open_file_cache` explicitly configured/disabled per §3.2; TLS valid (certbot automated renewal).
- **Implementation steps:** 1) Provision/record VPS baseline (dedicated deploy user, minimal-privilege SSH key, escrow references — no secrets in repo). 2) Release directory skeleton (`releases/`, `current`). 3) Nginx config composed via `include`. 4) Cache policy classes per §6. 5) Staging host/location for rehearsal. 6) GREEN all RED checks.
- **Verification:** Contract checks green on staging; reload-policy behavior demonstrated (symlink change serves new content without reload).
- **Acceptance criteria:** Nginx contract fully satisfied; staging rehearsal target live.
- **Stop conditions:** Any reload-on-symlink anomaly root-caused (open_file_cache etc.) before deploy scripting.

### WP-51 — Release assembly + integrity gate

- **Phase:** P9 · **Complexity:** M · **Depends on:** WP-23, WP-24 · **Parallelizable with:** WP-50, WP-52
- **Objective:** The isolated final-release-assembly step + the build-side integrity gate (nine checks).
- **Frozen references:** BUILD_AND_ROUTING §1 (assembly stage), §2 (dist ownership), §8 (nine integrity checks); IMAGE_PIPELINE §13.
- **Files likely created/modified:** `scripts/release/assemble.*`, `scripts/release/integrity.*`, `tests/integration/release-assembly.*`.
- **Test-first requirement (RED):** assembly combines `dist/` + `generated/media/` without mutating either (mtime/hash guard); each of the canonical nine integrity checks (BUILD_AND_ROUTING §8) has a failing probe: (1) index exists; (2) canonical route outputs exist; (3) asset manifest closure — every derivative URL referenced in the manifest exists as a file in the candidate; (4) no source masters or camera filenames in the candidate; (5) no draft-route HTML; (6) no GPS leakage (sampled derivative scan); (7) static 404 present; (8) sitemap validity — sitemap exists and contains only published canonical URLs (published-only verification; no draft leakage); (9) redirect integrity — every redirect target resolves to an existing published page in the release. Deploy-side transfer-completeness checks (every HTML src/srcset-referenced derivative exists on the VPS; redirect config integrity against WP-52 output) belong to WP-53 candidate verification and are not double-counted here.
- **Implementation steps:** 1) Assembly into a unique candidate directory (timestamp scheme per DEPLOYMENT_ARCHITECTURE §2.1). 2) Nine-check gate as one blocking pass with machine-readable report. 3) Old-page asset availability strategy chosen and documented: carry-forward vs shared content-addressed store (DEPLOYMENT_ARCHITECTURE §6.4) — D14 recorded in `docs/implementation/decisions/OLD-PAGE-ASSETS.md` with path/date/evidence ledger fields. 4) GREEN all RED tests.
- **Verification:** RED set green; a deliberately-broken probe candidate is rejected for each check.
- **Acceptance criteria:** Candidate production is isolated, complete, and integrity-gated before any upload exists.
- **Stop conditions:** None expected.

### WP-52 — Redirect include generation

- **Phase:** P9 · **Complexity:** M · **Depends on:** WP-12 · **Parallelizable with:** WP-50, WP-51
- **Objective:** Generate the Nginx 301 redirect include from validated redirects; candidate verification artifact for the deploy flow.
- **Frozen references:** BUILD_AND_ROUTING §5 (lifecycle; meta-refresh NOT canonical); DEPLOYMENT_ARCHITECTURE §3.3; IC-02 verification.
- **Files likely created/modified:** `scripts/release/redirects.*`, `tests/integration/redirect-include.*`.
- **Test-first requirement (RED):** include contains exactly one `return 301` per validated entry to the current canonical route; gallery and place aliases both covered; include derives ONLY from validated data (tampered-source probe rejected); stable ordering/determinism (identical input → identical bytes); empty redirect set produces a valid empty include; include passes `nginx -t` in a harness config.
- **Implementation steps:** 1) Generator from WP-12's validated redirect set. 2) Candidate-config artifact + checksum for deploy-side verification. 3) `nginx -t` harness test. 4) GREEN all RED tests.
- **Verification:** RED set green; no meta-refresh or alternative delivery exists anywhere (grep).
- **Acceptance criteria:** One canonical delivery strategy realized; lifecycle-ready artifact produced.
- **Stop conditions:** None expected.

### WP-53 — Deployment script (atomic flow + coupled rollback)

- **Phase:** P9 · **Complexity:** L · **Depends on:** WP-50, WP-51, WP-52 · **Parallelizable with:** —
- **Objective:** The complete canonical release flow: upload → verify → capture previous → atomic switch → smoke → coupled rollback, with locking and retention.
- **Frozen references:** DEPLOYMENT_ARCHITECTURE §3 (flow steps 1–8; exact pseudocode contracts), §3.3 (redirect lifecycle coupling), §4 (candidate checks), §5 (smoke checks), §10 (serialization); ADR-006; TESTING_AND_VISUAL_REGRESSION §9.
- **Files likely created/modified:** `scripts/deploy/deploy.*`, `scripts/deploy/smoke.*`, `scripts/deploy/rollback.*`, `scripts/deploy/lock.*`, `tests/integration/deploy-flow.*` (staging-targeted).
- **Test-first requirement (RED, staging):** interrupted upload leaves `current` unchanged and the partial candidate unswitchable/marked; candidate verification failure blocks the switch; previous target captured BEFORE mutation (rollback never derives "second-newest"); atomic switch via temp symlink + `mv -Tf` rename on same filesystem; post-switch smoke checks home marker content, representative gallery, representative image content-type/bytes, 404 status, /health; smoke failure triggers restore of the exact captured previous target; concurrent deploy attempt fails fast (lock); content-only release performs NO Nginx reload; redirect-change release runs `nginx -t` → activate → reload → 301 smoke; failed redirect deploy restores BOTH exact previous release AND exact previous redirect config (+ reload when config changed); retention cleanup preserves old-page asset availability per the WP-51 strategy.
- **Implementation steps:** 1) Lock acquisition (flock or equivalent) wrapping the whole flow. 2) Upload to unique release dir; integrity verification on the VPS (section-4 checks). 3) Previous-target capture (`readlink` per §3.1 step 5 pseudocode; first-deployment case recorded explicitly). 4) Atomic switch per §3.1 step 6 pseudocode. 5) Smoke suite per §5. 6) Rollback path restoring exact captured target (and redirect config coupling). 7) Retention/cleanup honoring §6.4. 8) GREEN all RED tests on staging.
- **Verification:** Full flow rehearsed end-to-end on staging twice (content-only + redirect-change), rollback rehearsed once; logs recorded.
- **Acceptance criteria:** Every §3.1 step present, ordered, and evidenced; no step skippable by configuration.
- **Stop conditions:** Any non-atomic behavior (observable partial state) is P0 — fix before any production use.

### WP-54 — Deployment scenario tests (staging rehearsal)

- **Phase:** P9 · **Complexity:** M · **Depends on:** WP-53 · **Parallelizable with:** WP-56 prep
- **Objective:** The three mandated deployment test scenarios + interruption/lock scenarios, executed as repeatable automated rehearsal.
- **Frozen references:** User brief §32 (content-only / redirect-change / failed-redirect scenarios); TESTING_AND_VISUAL_REGRESSION §9; DEPLOYMENT_ARCHITECTURE §3.3.
- **Files likely created/modified:** `tests/deploy/scenarios.*`, rehearsal evidence records.
- **Test-first requirement (scenario assertions):** content-only release: pointer switches, zero Nginx reloads observed; redirect-change release: candidate config verified, `nginx -t` pass, activation, exactly one reload, 301 smoke to current canonical routes; failed redirect deployment: exact previous content release restored AND exact previous redirect config restored, Nginx tested/reloaded appropriately, live site verified serving previous state; interrupted upload and lock-contention behaviors per WP-53 RED set.
- **Implementation steps:** 1) Automate scenario execution against staging with before/after state capture (readlink targets, config checksums, reload counts, HTTP probes). 2) Run all scenarios; record evidence. 3) Wire as P9 gate evidence.
- **Verification:** All scenario assertions green; evidence bundle committed.
- **Acceptance criteria:** P9 rehearsal exit evidence complete; no scenario may pass on Nginx-availability-only checks (content checks authoritative).
- **Stop conditions:** Any scenario failure blocks P10 deployment.

### WP-55 — Backup provider/tool selection ⚑ USER REVIEW

- **Phase:** P9 pre-entry decision gate (research may begin earlier; the decision gates P9 entry) · **Complexity:** S · **Depends on:** — · **Parallelizable with:** WP-50..WP-54
- **Objective:** Resolve OQ-06: choose the encrypted off-site backup provider + tooling against the architectural contract.
- **Frozen references:** BACKUP_AND_RECOVERY §4 (requirements: encrypted at rest before leaving source; independent of VPS; restorable within RTO; integrity-verifiable; acceptable architectures); OPEN_QUESTIONS OQ-06.
- **Files likely created/modified:** `docs/implementation/decisions/BACKUP-SELECTION.md` (options compared against §4 contract; user decision recorded).
- **Test-first requirement:** N/A (decision package) — but the decision record must answer: encryption-at-rest mechanism, independence from VPS, restore path within RTO, integrity verification method, cost/access.
- **Implementation steps:** 1) Shortlist within acceptable architectures (S3-compatible object storage; independent host via rclone/restic/borg-class tools; encrypted archive snapshots). 2) Evaluate against contract + user constraints. 3) User decides. 4) Record; secrets escrow requirements restated (backup keys escrowed separately from storage).
- **Verification:** Decision doc complete with user sign-off.
- **Acceptance criteria:** OQ-06 resolved; WP-56 unblocked.
- **Stop conditions:** None.

### WP-56 — Backup implementation

- **Phase:** P9 · **Complexity:** M · **Depends on:** WP-55 · **Parallelizable with:** WP-54
- **Objective:** Operational encrypted off-site backup for all non-regenerable state at RPO ≤24h; regenerable state excluded.
- **Frozen references:** BACKUP_AND_RECOVERY §3–4, §8 (verification: checksums, integrity scans, alerting); UD-005/UD-006; RISK_REGISTER RISK-002/008.
- **Files likely created/modified:** `scripts/backup/*` (run + verify + alert hooks), schedule definition (cron/systemd per environment), `docs/implementation/WP-56.md` (runbook: schedule, retention, secret handling).
- **Test-first requirement (RED):** backup run produces checksum/manifest of backed-up content; integrity scan verifies stored checksums against backup contents; a deliberately truncated restore probe fails verification (not silent); backup scope includes `media/ingest-masters/` + authored content (via Git remote verification) + secrets-escrow references, and EXCLUDES `generated/`, `dist/`, releases (scope assertion); missed/failed run triggers alert (silent failure is a contract violation).
- **Implementation steps:** 1) Implement per WP-55 selection: client-side encryption before transfer. 2) Schedule ≥ daily + on-ingest for masters; retention policy. 3) Integrity verification after every run. 4) Alerting on failure. 5) Git-remote integrity check (clone/fetch verification) on schedule. 6) GREEN all RED tests.
- **Verification:** Two consecutive scheduled runs evidenced; integrity scan green; scope assertion green.
- **Acceptance criteria:** RPO ≤24h operationally satisfied; must-have principle (VPS never sole copy) proven.
- **Stop conditions:** Any silent-failure path is P0.

### WP-57 — Restore drill (total VPS loss)

- **Phase:** P9 · **Complexity:** M · **Depends on:** WP-56, WP-53 · **Parallelizable with:** —
- **Objective:** Prove recovery from COMPLETE VPS loss on a clean host within RTO ≤24h, per the canonical restore sequence.
- **Frozen references:** BACKUP_AND_RECOVERY §6 (11-step restore sequence), §7.1 (disk failure scenario), §9 (drill requirements); TESTING_AND_VISUAL_REGRESSION §10; UD-006.
- **Files likely created/modified:** `docs/runbooks/RESTORE-DRILL.md` (timed step-by-step record), drill evidence.
- **Test-first requirement:** Drill protocol defined before execution: clean host (no prior site state), timed from failure declaration to verified public site, covering all 11 canonical steps incl. secrets-from-escrow, masters-from-off-site, pinned toolchain install, clean rebuild (generated state regenerated, never restored), deploy via canonical flow, full smoke (routes, images, 404, redirects).
- **Implementation steps:** 1) Execute drill on clean host; record per-step durations. 2) Verify restored masters against source hashes. 3) Rebuild + deploy + smoke. 4) Record pass/fail, elapsed time, issues, corrective actions. 5) If >24h: revise backup architecture/procedure and re-drill. 6) Schedule statement: at least quarterly; monthly recommended during active development.
- **Verification:** Drill record complete; RTO met; rebuilt site passes deployment smoke.
- **Acceptance criteria:** P9 exit "backup restore drill completes within RTO target" evidenced; this is recovery from total loss, not merely bad-deployment rollback.
- **Stop conditions:** RTO breach → fix-and-redrill loop until met; P10 launch is blocked otherwise.

**P9 GATE — PASS only when:** rehearsal succeeds on non-production target; rollback restores exact previous release; restore drill ≤ RTO evidenced; Nginx serves with correct cache headers + static 404; TLS valid; post-switch smoke green; no SPA fallback anywhere.

---

## 15. P10 — Final Production Acceptance

### WP-58 — Pilot content batch ⚑ USER REVIEW (Pre-launch Visual Gate input)

- **Phase:** P10 · **Complexity:** M · **Depends on:** WP-14, WP-42, WP-47 · **Parallelizable with:** —
- **Objective:** Small real-archive pilot end-to-end through the authoring workflow, proving the system against real content before full ingest.
- **Frozen references:** CONTENT_MODEL §14 workflows; UD-001/002/003/010; user brief §35 (pilot before full import).
- **Files likely created/modified:** real `content/galleries/*` (2–3 galleries), real `media/ingest-masters/*`, redirects/home updates if editorially needed, pilot evidence note.
- **Test-first requirement:** Pilot acceptance script: ingest → identity assignment → source_ref resolution → places mapping → cover assignment → captions/alt per policy → draft preview → validation → publish → build → visual review packet; every step asserted (validation green, derivative coverage green, published page renders with real derivatives).
- **Implementation steps:** 1) Select 2–3 representative real galleries (mix: landscape, portrait, CJK if available, one with continuation). 2) Execute WP-14 workflows exactly. 3) Honest `published_at` handling per UD-003 (record basis for each). 4) Editorial caption/alt pass per WP-42 policy. 5) Build + capture real-content visual states. 6) Rerun the WP-46 CJK coverage check against the corpus including pilot content. 7) User visual/typography review of representative real content, incl. CJK rendering where relevant (Pre-launch Visual Gate).
- **Verification:** Pilot script green; user review sign-off recorded.
- **Acceptance criteria:** Real content flows through every production mechanism without exception; any workflow friction fixed in WP-14 docs before full ingest.
- **Stop conditions:** Systemic friction (e.g., workflow step unclear) → fix workflow contract, do not push through.

### WP-59 — Full archive ingest (resumable batch umbrella)

- **Phase:** P10 · **Complexity:** L · **Depends on:** WP-58 · **Parallelizable with:** —
- **Objective:** Ingest the remaining archive as tracked, resumable batches. The number of batches is decided at execution time — not fixed here.
- **Frozen references:** CONTENT_MODEL §14; UD-003 (honest publication time at scale); user brief §35.
- **Files likely created/modified:** full `content/` + `media/ingest-masters/` population; `docs/implementation/ingest-batches.md` (batch ledger); per-batch evidence records.
- **Test-first requirement:** Batch record contract test: every batch must carry a stable batch ID/name, defined input set (galleries + masters), validation result, derivative closure result, CJK coverage result, visual evidence reference, status (pending/in-flight/pass/fail), and a clean handoff note — the ledger schema test fails before the umbrella exists.
- **Implementation steps:** 1) Define the batch record contract + status ledger. 2) Declare batches as execution proceeds (each sized for one focused session). 3) Per batch: validation dry-run → identity assignment per UD-001/002 → place mapping + metadata + covers + caption/alt editorial work → publication timestamps per UD-003 with recorded basis → derivative closure → CJK coverage rerun → visual evidence → status PASS + handoff note. 4) Resumability: a completed (PASS) batch is never redone; a failed batch halts itself, not the program. 5) Aggregate completeness reconciliation at the end.
- **Verification:** Every declared batch carries a complete record; full-archive production build green with zero §13.1 violations; ledger committed.
- **Acceptance criteria:** ALL declared batches PASS + aggregate reconciliation proves every archive item intended for launch is covered by a PASS batch or explicitly recorded as draft/deferred.
- **Stop conditions:** Batch-level validation failures halt that batch until resolved (no skip-and-continue).

### WP-60 — Production acceptance gate (launch)

- **Phase:** P10 · **Complexity:** L · **Depends on:** ALL prior WPs · **Parallelizable with:** —
- **Objective:** The final release gate: full evidence bundle, production deployment, and launch verification.
- **Frozen references:** IMPLEMENTATION_PHASES P10; FINAL_DESIGN_SPECIFICATION §8 (complete checklist); consistency audit list (P10 scope).
- **Files likely created/modified:** `docs/implementation/ACCEPTANCE-EVIDENCE.md` (the bundle), production deployment record.
- **Test-first requirement:** Gate checklist as executable assertions where possible: production build clean; content validation clean; derivative closure clean; no drafts leaked (route + sitemap + discovery probes); sitemap validity (published-only) verified; routes/canonical URLs correct; redirect 301 smoke live; accessibility gate evidence current; performance measurements within recorded baselines; visual regression P0/P1 clear; backup restore drill evidence current; rollback tested on staging within this phase's freshness; About final copy in place (placeholder copy must not silently launch — content-readiness gate); documentation current (authoring, runbooks, restore).
- **Implementation steps:** 1) Assemble evidence bundle referencing each gate's artifacts. 2) Run FINAL_DESIGN_SPECIFICATION §8 checklist line-by-line. 3) Consistency audit per P10 scope (identity, content, slug, draft, featured, cover, next, prev, build DAG, media, Git, backup, runtime, fonts, routes, cache, deployment, API verification). 4) Production deployment via WP-53 flow (first real release). 5) Post-switch live smoke + live redirect smoke + backup monitoring confirmed active. 6) Launch acceptance sign-off.
- **Verification:** Every bundle item green or explicitly waived with recorded rationale (waivers only for documented limitations per FINAL_DESIGN_SPECIFICATION §7.2).
- **Acceptance criteria:** Production site live and verified; all frozen values match FINAL_DESIGN_SPECIFICATION.md; no rejected variants in runtime.
- **Stop conditions:** Any red item blocks launch; rollback path is the immediate remedy for a failed first release.

**P10 GATE — PASS only when:** all frozen values match; consistency audit passes; production site live and verified; evidence bundle complete.

---

## 16. Architecture exception requests

**None.** No implementation-blocking contradictions were found in the frozen architecture during planning. Two planning-level clarifications were recorded (not exceptions, no architecture change):

1. **Featured-target semantics (WP-11):** resolved — WP-11 implements the frozen CONTENT_MODEL §10.2 algorithm exactly: a valid published `featured_gallery_id` is used; otherwise the latest published Gallery by `published_at` DESC with stable Gallery ID tie-break. Invalid configured IDs may warn; they never fail the production build. (An earlier planning draft's fail-closed interpretation for nonexistent IDs was withdrawn per review finding IMP-03.)
2. **Place-detail year grouping (WP-30):** frozen design says progressive grouping "when chronology exists/useful" without a threshold; this plan keeps the trigger contextual and documented rather than inventing a hard volume threshold.

---

## 17. Planning self-review

Audited before completion, per the planning brief §51:

| Check | Result |
|---|---|
| Dependency correctness | PASS — no WP consumes an interface before its provider WP/gate (final-byte ordering linear WP-20→WP-21→WP-22; manifest before Astro: WP-22→WP-24→WP-25/33; formats before markup: WP-15→WP-20→pages; policy gates before enforcement: WP-42→WP-43, WP-55→WP-56). |
| Architecture fidelity | PASS — no WP redefines frozen architecture; all WPs cite canonical owners; PREVIOUS_CORRECTIONS untouched. |
| Design fidelity | PASS — no new UI invented; every page WP binds to frozen spec sections; prohibited-product concepts asserted absent by tests. |
| Benchmark fidelity | PASS — no deferred value preselected; WP-15/16/42/45/46/55 own their decisions with user-review flags; grep-style gates protect the no-preselection rule. |
| Testability | PASS — every substantive WP names RED conditions and observable acceptance criteria; verification uses the shared command contract. |
| Size | PASS — largest packages (WP-09, WP-13, WP-15, WP-20, WP-35, WP-40, WP-43, WP-45, WP-47, WP-53, WP-59, WP-60) are bounded by single completion conditions; pipeline split into 10 packages per brief §16. |
| Parallelism | PASS — lanes defined with explicit merge gates; no two parallel WPs own the same files/decisions. |
| Deployment | PASS — 14 deployment/recovery concerns each owned (WP-50..WP-57 cover environment, assembly, redirects, atomic flow, scenarios, selection, backup, drill); no vague "deploy site" package. |
| Real content | PASS — pilot-first strategy (WP-58) before full ingest (WP-59) with validation dry-runs and identity rules. |
| Mandatory questions (§52) | Answered in Section 5. |
| Scope guardrails | Section 2 prohibitions carried into every WP's stop conditions. |

---

## 18. Plan review gate

### Verdict: A — IMPLEMENTATION PLAN READY FOR INDEPENDENT REVIEW

- Complete: 60 work packages across canonical P1–P10, all 18 open items from OPEN_QUESTIONS owned by named gates, every phase gate defined in PHASE_GATES.md.
- Dependencies coherent: explicit DAG, primary dependency spine, lanes, and merge gates; no consumer precedes its producer.
- Frozen architecture respected: zero reopened decisions, zero architecture exceptions, zero preselected benchmark values.
- No implementation started: this session created planning documents only (verified against the brief §50 list).

**Next step:** Independent plan review. After approval, execution begins at WP-01/WP-02 under the handoff model in Section 3.3, with PHASE_GATES.md as the gate ledger.

**END OF PRODUCTION IMPLEMENTATION PLAN**


