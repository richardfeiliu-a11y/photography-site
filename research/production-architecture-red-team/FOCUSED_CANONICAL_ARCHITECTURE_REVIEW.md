# 0828｜研究｜正典架构聚焦复审

**Project:** Quiet Editorial Archive  
**Review date:** 2026-08-28  
**Repository:** `<repo>`  
**Live Git evidence:** `main` at `92f7a58c312a9117737b70e34767eb71270923fb`  
**Frozen product authority:** `research/FINAL_DESIGN_SPECIFICATION.md`  
**Active engineering authority reviewed:** all 20 Markdown documents directly under `research/production-architecture/`  
**Historical evidence used only as checklist:** `INDEPENDENT_ARCHITECTURE_RED_TEAM.md`, `TARGETED_INDEPENDENT_ARCHITECTURE_RE_REVIEW.md`, and `CANONICAL_REWRITE_TRACEABILITY.md`  
**Manual external review reconciled:** 2026-08-29; independent output supplied by the user, 92 lines  
**Review boundary:** architecture review only; no production code, Implementation Plan, canonical correction, commit, push, or deployment

---

## Executive Verdict

**Final Gate: B — TARGETED CORRECTION REQUIRED.**

**ARCHITECTURE VALID — Targeted corrections required before freeze.**

The canonical rewrite has closed the former structural Gate C failures. Photo identity is persistent; the source-of-truth matrix has one owner per persistent concept; the manifest is produced before Astro consumes it; media ownership and recovery are closed; the frozen product remains intact; and UD-001 through UD-011 all pass.

Architecture Freeze is not yet justified because three active contracts still permit incompatible implementation plans:

1. Place YAML cardinality conflicts with the specified Astro `glob()` loader and repository layout.
2. Redirect schema, publication validation, and Nginx delivery lifecycle are not one coherent contract.
3. Image format selection is simultaneously declared benchmark-deferred and preselected as WebP plus JPEG.

These are precise canonical-document corrections. They do not require a new architecture rewrite, a framework change, a product decision, or an additional architecture layer. After the named sections are corrected, only targeted verification is required.

| Severity | Count |
|---|---:|
| CRITICAL | 0 |
| IMPORTANT | 3 |
| MINOR | 4 grouped documentation cleanups |
| NOTE | 6 genuinely phase-deferred engineering decisions |

---

## Review Scope and Authority

The review treated `research/production-architecture/` as the only active engineering authority and the frozen Final Design Specification as superior whenever design values were involved.

`PREVIOUS_CORRECTIONS/README.md:1-5` marks the entire correction directory **SUPERSEDED HISTORICAL PROPOSALS — DO NOT IMPLEMENT DIRECTLY**. Its rules at lines 27-31 direct readers back to the rewritten canonical set. No historical proposal was used to fill a missing canonical implementation rule.

The historical red-team reports were used only to identify RT/TRR closure obligations. `CANONICAL_REWRITE_TRACEABILITY.md` was treated as an index, not proof; each material claim was checked against the active detailed documents.

### Evidence boundaries

- Verified facts in this report come from the active files and narrow official API documentation.
- Reviewer inference is explicitly labeled as failure consequence or severity judgment.
- No executable Astro repository exists yet, so no architecture example is described as repository-tested.
- Three attempted V2 fresh-context reviewer runs failed before execution with the platform error `unreadable_encrypted_agent_task`. They returned no review content and made no file changes. Per user direction, no further V2 reviewer was used.
- A separate manual external review was then completed from the neutral Artifact + Contract prompt. Its output was reconciled claim by claim against active source lines; it was treated as review data, not authority.
- The previously supplied Gemini review covered the earlier correction layer, not this canonical rewrite. It was not reused as proof of the rewritten documents.

---

## Manual External Review Reconciliation

The manual external reviewer issued Gate A with 0 CRITICAL, 0 IMPORTANT, all 11 UD rows PASS, and every Core Architecture row PASS. This is useful independent support for the conclusion that the former structural Gate C defects are closed. It does not supply sufficient evidence to overturn the three targeted Important findings in this report.

### Review-quality boundary

The external output says the active engineering authority contains 16 documents (external output line 9), while the live root contains 20 Markdown documents and the supplied attachment manifest listed all 20. It also provides document names but no exact line citations for any material PASS assertion, despite the prompt requiring line-level evidence. These are limitations of the external review, not architecture findings.

| External assertion | Reconciliation | Source re-check | Effect on this report |
|---|---|---|---|
| All 11 user decisions PASS | CONFIRMED | Each UD was independently rechecked against CONTENT_MODEL, SOT, ADRs, image, backup, and routing contracts | Retain 11 PASS / 0 PARTIAL / 0 FAIL |
| Identity, SOT, build DAG, media, backup, frozen design, no-JS, atomic deployment are structurally closed | CONFIRMED | Active detailed documents contain the required persistent owners, producer-before-consumer DAG, off-site recovery path, and exact rollback | Retain 0 CRITICAL; Gate C remains unwarranted |
| API feasibility PASS because Astro `defineCollection` + `glob()` are valid | PARTIALLY CONFIRMED | The Gallery loader primitives are valid, but the external review discusses only `base: ./content/galleries` (external lines 65-66) and does not reconcile Place array-per-file at `CONTENT_MODEL.md:190-208` with one-file-per-Place at `REPOSITORY_STRUCTURE.md:35-36` and `glob()` one-file/one-entry at `BUILD_AND_ROUTING.md:128-142` | IMPORTANT-01 retained |
| Content lifecycle and redirects PASS | PARTIALLY CONFIRMED | Gallery draft/published lifecycle passes, but the external review does not address Gallery-only redirects versus Gallery+Place redirects, existence-only versus published-target validation, or generated Nginx config activation | IMPORTANT-02 retained |
| Deferred benchmarks PASS | PARTIALLY CONFIRMED | Widths and qualities are properly gated, but the external review does not reconcile `PERFORMANCE_BUDGET.md:163` (WebP primary + JPEG fallback baseline) with `IMAGE_PIPELINE.md:436-445` and `OPEN_QUESTIONS.md:39-43` (format not frozen until P3) | IMPORTANT-03 retained |
| No Important findings; Architecture Freeze PASS | REJECTED AS UNDER-EVIDENCED | Three direct active-document contradictions remain and allow different schema, redirect/deployment, and derivative/template implementations | Final Gate remains B |

### Official fact re-check after external review

- Current official Astro documentation still distinguishes `glob()` for entries stored as separate files from `file()` for multiple entries in one YAML/JSON file. This confirms that the Place file-shape conflict is material rather than stylistic.
- Current official Nginx documentation still requires a configuration reload/HUP for changed configuration to be read. A generated redirect `include` therefore needs explicit activation and rollback semantics if selected.

No new CRITICAL or IMPORTANT issue was introduced by the external review. The doubt cycle stop condition is met: the independent pass added corroboration for structural closure, surfaced no new substantive finding, and did not rebut the three source-proven targeted corrections.

---

## Canonical Authority Check

**Result: PASS, with two non-blocking index/reference cleanups.**

| Check | Result | Evidence |
|---|---|---|
| PREVIOUS_CORRECTIONS clearly superseded | PASS | `PREVIOUS_CORRECTIONS/README.md:1-5,27-31` |
| One active engineering authority | PASS | `README.md:8-13`; `ARCHITECTURE_REVIEW_PACKET.md:7-35` |
| SOT matrix wins on ownership conflict | PASS | `SOURCE_OF_TRUTH_MATRIX.md:1-5` |
| Summaries do not override detailed contracts | PASS | Summaries consistently point to the detailed documents; no summary creates a second persistent owner |
| Traceability is audit history, not implementation authority | PASS | `CANONICAL_REWRITE_TRACEABILITY.md:1-14` |
| No historical proposal is needed to understand a core contract | PASS | All identity, DAG, lifecycle, media, runtime, and deployment contracts exist in active detailed documents |

Non-blocking cleanup: `TESTING_AND_VISUAL_REGRESSION.md:61,136` cites the historical `CANONICAL_REWRITE_BRIEF.md` even though each referenced rule is restated locally and has a canonical owner. Replace those citations with `BUILD_AND_ROUTING.md` and `RUNTIME_AND_PROGRESSIVE_ENHANCEMENT.md`. `README.md:232-254` says there are 19 canonical files and omits `CANONICAL_REWRITE_TRACEABILITY.md`; 20 root-level Markdown files exist.

---

## UD-001–UD-011 Verification

| Decision | Result | Evidence |
|---|---|---|
| UD-001 — Photo identity in Gallery YAML | PASS | `CONTENT_MODEL.md:114-170`; `SOURCE_OF_TRUTH_MATRIX.md:43-46,76-86`; no generated registry owns identity |
| UD-002 — Corrected-master semantics | PASS | `CONTENT_MODEL.md:141-170`; `IMAGE_PIPELINE.md:66-97`; hash is revision metadata, not identity |
| UD-003 — Authored publication time | PASS | `CONTENT_MODEL.md:227-246`; `ARCHITECTURE_DECISIONS.md:284-296`; no EXIF/mtime/Git/folder inference |
| UD-004 — Home-only featured state | PASS | `CONTENT_MODEL.md:334-369`; `content/site/home.yaml` is the only owner; deterministic latest fallback exists |
| UD-005 — Media outside Git baseline | PASS | `SOURCE_OF_TRUTH_MATRIX.md:7-24,58-68`; `REPOSITORY_STRUCTURE.md:108-145`; Git/LFS is not the archive |
| UD-006 — RPO/RTO <= 24h | PASS | `BACKUP_AND_RECOVERY.md:9-22,69-96,120-155`; encrypted independent off-site copy and restore sequence exist |
| UD-007 — next_gallery cycles allowed | PASS | `CONTENT_MODEL.md:295-318`; `ARCHITECTURE_DECISIONS.md:219-226`; exists/published/not-self only |
| UD-008 — Gallery slug authority | PASS | `CONTENT_MODEL.md:373-400`; Gallery YAML owns current slug; redirects own history only |
| UD-009 — Status-only draft model | PASS | `CONTENT_MODEL.md:248-286`; `BUILD_AND_ROUTING.md:227-260`; no directory/prefix publication authority |
| UD-010 — Explicit published cover | PASS | `CONTENT_MODEL.md:258-284`; build fails for missing/foreign published cover |
| UD-011 — No authored prev_gallery | PASS | `CONTENT_MODEL.md:319-332`; reverse relations are generated only if needed |

**UD status:** 11 PASS, 0 PARTIAL, 0 FAIL.

---

## Core Architecture Table

| Area | Result |
|---|---|
| Canonical authority | PASS |
| Source of truth | PASS |
| Photo identity | PASS |
| Build DAG | PASS |
| Content lifecycle | PASS for Gallery lifecycle; TARGETED CORRECTION for Place loader cardinality |
| Media ownership | PASS |
| Backup/recovery | PASS |
| Frozen design compliance | PASS |
| Runtime/no-JS | PASS |
| Deployment | TARGETED CORRECTION for redirect delivery/config lifecycle |
| API feasibility | PASS for Gallery Content Layer and Sharp/Nginx primitives; TARGETED CORRECTION for Place collection use of `glob()` |
| Deferred benchmarks | NON-BLOCKING after the format-baseline contradiction is removed |

**Core architecture status:** valid high-level and structural architecture; three targeted contract corrections remain.

---

## Source-of-Truth Audit

The matrix was checked against the detailed documents rather than accepted on its own.

| Concept | Canonical owner | Result |
|---|---|---|
| Gallery ID | Gallery YAML `id` | PASS |
| Gallery slug | Gallery YAML `slug` | PASS |
| Gallery status | Gallery YAML `status` | PASS |
| photographed dates | Gallery YAML `photographed_start/end` | PASS |
| published_at | Gallery YAML `published_at` | PASS |
| Photo ID | Gallery YAML `photos[].id` | PASS |
| Photo source_ref | Gallery YAML `photos[].source_ref` | PASS |
| Photo sequence | Gallery YAML array order | PASS |
| Caption | Gallery YAML Photo item | PASS |
| Rhythm | Gallery YAML Photo item | PASS |
| Cover | Gallery YAML `cover_photo_id` | PASS |
| next_gallery | Gallery YAML `next_gallery_id` | PASS |
| Place ID | Place YAML | PASS as owner; file cardinality contract requires correction |
| Place slug | Place YAML | PASS as owner; file cardinality contract requires correction |
| Featured Gallery | `content/site/home.yaml` | PASS |
| redirect history | `content/redirects.yaml` | PASS as owner; schema/lifecycle requires correction |
| dimensions/orientation | generated pipeline metadata | PASS |
| hashes/derivatives | generated pipeline/manifest | PASS |
| asset manifest | `generated/asset-manifest.json` | PASS |
| HTML | Astro `dist/`, then isolated release assembly | PASS |

No duplicate persistent authority or non-regenerable field hidden solely in `generated/` was found.

Minor consistency cleanup: `SOURCE_OF_TRUTH_MATRIX.md:34` presents `g_` as a validation requirement, while `CONTENT_MODEL.md:34-36` calls the `g_`, `p_`, and `pl_` prefixes recommendations. Choose “required” or “recommended” once and align the schema contract.

---

## Photo Identity Failure Scenarios

| Scenario | Result | Canonical explanation |
|---|---|---|
| A — rename | PASS | Update `source_ref`; keep Photo ID; rebuild from authored YAML plus master (`CONTENT_MODEL.md:470-478`) |
| B — path move | PASS | Same as rename; path is mutable binding, ID is editorial identity |
| C — corrected master | PASS | Keep Photo ID; source hash changes; content-addressed derivatives regenerate (`CONTENT_MODEL.md:480-488`; `IMAGE_PIPELINE.md:66-97`) |
| D — delete generated/ | PASS | Identity, sequence, captions, rhythm, and source binding remain in Gallery YAML; dimensions/hashes/manifest/derivatives rebuild (`REPOSITORY_STRUCTURE.md:193-207`) |

No persistent identity or publication history is lost in these scenarios.

---

## Build DAG Audit

**Result: PASS.**

The active dependency graph is producer-before-consumer:

```text
authored state + WEB INGEST MASTERS
  -> validation
  -> image analysis/derivation under generated/media/
  -> generated/asset-manifest.json with final public URLs
  -> Astro build-time consumption
  -> isolated release assembly
  -> integrity gate
  -> candidate upload
  -> pre-switch verification
  -> exact-target atomic switch
  -> post-switch smoke
  -> exact rollback
```

Evidence: `BUILD_AND_ROUTING.md:9-89`, `IMAGE_PIPELINE.md:300-405,455-501`, and ADR-026. `dist/` is not written by the image pipeline. Astro does not wait for a manifest produced after rendering. The candidate is complete before deployment.

No consumer-before-producer cycle remains.

---

## Content / Lifecycle Audit

### Gallery publication lifecycle

**Result: PASS.**

Drafts may preview locally but are absent from public routes, sitemap, Home, Archive, and Places. Published Galleries require `published_at`, explicit in-Gallery `cover_photo_id`, valid sources and Place references, derivative coverage, and a valid canonical route. `status` is the only publication mechanism.

Home resolution is deterministic: valid published `featured_gallery_id`, otherwise `published_at DESC` with stable Gallery ID tie-break. Recent Galleries remain present. No weekly/curated/photographed-date recency semantics are active.

### Cover

**Result: PASS.** Published cover is explicit and in-Gallery; draft may omit it; reorder does not change it silently.

### next/prev

**Result: PASS.** `next_gallery_id` uses stable Gallery ID; production target exists, is published, is not self; cycles are allowed. `prev_gallery` is not authored.

### Slug/redirect ownership

**Result: PASS for ownership, TARGETED CORRECTION for redirect contract.** Gallery YAML owns the current slug and `redirects.yaml` owns historical aliases. See IMPORTANT-02 for the remaining schema/deployment ambiguity.

---

## Media Ownership and Backup Audit

**Result: PASS.**

The four media classes are consistent: CAMERA ORIGINAL, ARCHIVAL MASTER, WEB INGEST MASTER, WEB DERIVATIVE. `media/ingest-masters/` is the single pipeline root; `source_ref` is relative; workstation absolute paths are forbidden. WEB INGEST MASTERS are non-regenerable; derivatives are regenerable.

Total VPS failure can be recovered from Git remote plus encrypted off-site ingest-master backup plus credential escrow plus a clean rebuild. Atomic releases are explicitly rollback cache, not backup. RPO and RTO are each <=24 hours, and a pre-launch clean-host restore drill is mandatory.

The deferred backup provider/tool is non-blocking for the Implementation Plan because the ownership/interface/RPO/RTO are already fixed and P9 cannot exit without selecting the tool and passing the restore drill.

---

## Frozen Design Compliance Audit

**Result: PASS.**

Mechanical scans found no active product contamination. Historical/prohibition mentions were correctly excluded. Active contracts preserve:

- `/galleries/{slug}` only;
- Source Serif 4, Source Sans 3, Noto Serif SC, Noto Sans SC;
- base/compact/breathing rhythms;
- visible, unclamped captions with no empty reserved region;
- editorial text continuation with G7 spacing/typography;
- contained uncropped Overview thumbnails and three mobile columns;
- no dark mode, Visit, map, slideshow, carousel, or swipe-first Gallery.

---

## Runtime / Progressive Enhancement Audit

**Result: PASS.**

Home, Archive, Places, Place, Gallery sequence, captions, continuation, About, skip link, and global navigation are native HTML. Overview and position annotation may disappear without JavaScript. Mobile navigation must retain a native accessible fallback; a `display:none` checkbox as the only control is explicitly prohibited. Focus trap, Escape, background scroll lock, focus restoration, reduced motion, and no-JS navigation have test contracts.

---

## Image Pipeline / Determinism Audit

**Result: PASS for geometry, ordering, privacy, identity, and determinism; TARGETED CORRECTION for format deferral language.**

- Orientation and ICC are read before they are consumed/stripped.
- Orientation normalizes before resize.
- Public derivatives strip private metadata.
- All purposes preserve aspect ratio, contain thumbnails, avoid crop, and avoid upscale.
- Semantic determinism is required.
- Byte identity is claimed only within a pinned environment and when proven.
- Manifest serialization excludes volatile timestamps from its deterministic core.

See IMPORTANT-03 for the active WebP/JPEG preselection that contradicts OQ-02.

---

## Astro / Technical API Verification

**Result: PASS for the selected primitives; TARGETED CORRECTION for the Place entry shape.**

Current official Astro documentation confirms `src/content.config.ts`, `defineCollection()`, and `glob({ pattern, base })`, including YAML from outside `src/content/`. It also states that `glob()` treats separate files as entries, while `file()` is the built-in loader for multiple entries inside one YAML/JSON file. The Gallery configuration is feasible. The Place configuration conflicts with the authored file shape; see IMPORTANT-01.

Current official Sharp documentation confirms default metadata removal, `keepExif()`, `withExif()`, `keepIccProfile()`, `withIccProfile()`, and `toColourspace('srgb')`. No invented `profile()` method or Sharp CLI appears as active architecture.

Official Nginx documentation confirms real `try_files ... =404`, configuration `include`, and that changed configuration is applied after a reload. This matters to IMPORTANT-02 if generated `return 301` directives are chosen.

Official sources checked:

- Astro Content Collections: https://docs.astro.build/en/guides/content-collections/
- Astro Content Loader API: https://docs.astro.build/en/reference/content-loader-reference/
- Sharp Output: https://sharp.pixelplumbing.com/api-output/
- Sharp Colour: https://sharp.pixelplumbing.com/api-colour/
- Nginx Core / try_files: https://nginx.org/en/docs/http/ngx_http_core_module.html
- Nginx configuration reload: https://nginx.org/en/docs/control.html

---

## Deployment Audit

**Result: PASS for release atomicity, candidate completeness, exact rollback, cache classes, and static 404; TARGETED CORRECTION for generated redirects.**

The prior target is captured before switch; candidate upload cannot mutate the live release; pointer replacement uses same-filesystem atomic rename; post-switch smoke exercises public content; rollback restores the exact captured target; concurrent deploys are serialized. Content-addressed assets may be immutable; HTML may not.

See IMPORTANT-02: a generated Nginx redirect include is configuration and does not become active through a content symlink switch alone. The active architecture must not simultaneously promise “no content reload” and permit per-release Nginx config without defining test/reload/rollback.

---

## Testing / Visual Regression Audit

**Result: PASS.**

The architecture covers content/schema validation, source closure, derivative coverage, interaction, accessibility, focus restoration/trapping, visual regression, deployment smoke, and backup restore drills. Modal hidden state may remain in the DOM. SHA verifies baseline file integrity only; visual equivalence uses controlled capture, pixel/visual comparison, and human adjudication. Cross-environment PNG byte identity is explicitly rejected.

The two stale `CANONICAL_REWRITE_BRIEF.md` citations are MINOR because the canonical contracts are restated in the same file; replace them to keep authority navigation clean.

---

## Deferred Benchmark Classification

| Deferred item | Classification | Reason |
|---|---|---|
| Responsive widths | NON-BLOCKING FOR IMPLEMENTATION PLAN | P3 freezes values before P4/P5 consume manifest derivatives |
| Encoder/format/quality | NON-BLOCKING after IMPORTANT-03 correction | P3 benchmark gate is correctly placed; active baseline wording must stop preselecting the answer |
| ICC no-profile enforcement | NON-BLOCKING | MVP default is documented; stricter policy may close in P3/P7 without schema change |
| Alt publication enforcement | NON-BLOCKING | `alt_text` schema already exists; P7 cannot enter before policy resolution |
| Exact CJK subsetting | NON-BLOCKING | Frozen families/fallbacks are fixed; P1 proof precedes P4 content rendering |
| Backup provider/tool | NON-BLOCKING | RPO/RTO/interface fixed; P9 selection and restore drill precede launch |

Analytics defaults to none and is post-launch; it is not an implementation-plan blocker.

---

## RT/TRR Closure Verification

Only items not fully closed are listed.

| Historical item | Status | Remaining active issue |
|---|---|---|
| RT-003 / TRR-003 | PARTIAL | The Gallery Content Layer API is corrected, but Place YAML cardinality conflicts with `glob()` one-file/one-entry semantics and the stated `placeSchema` |
| RT-010 | PARTIAL | Slug authority is closed, but redirect entity scope and published-target validation disagree across active documents |
| RT-014 | PARTIAL | Atomic release rollback is closed; the optional generated Nginx redirect include lacks the required config test/reload/rollback branch |
| RT-015 | PARTIAL | Budget classification is closed, but `PERFORMANCE_BUDGET.md` preselects WebP+JPEG while format remains a P3 benchmark decision |

All other previously material RT/TRR findings are closed in the active canonical architecture.

---

## Remaining Critical Findings

**None.**

Identity, persistence, source-of-truth ownership, build ordering, non-regenerable media ownership, and disaster recovery are structurally closed. Gate C is not warranted.

---

## Remaining Important Findings

### IMPORTANT-01 — Place file cardinality conflicts with the Astro loader contract

**Affected documents:** `CONTENT_MODEL.md`, `REPOSITORY_STRUCTURE.md`, `BUILD_AND_ROUTING.md`, `IMPLEMENTATION_PHASES.md`, optionally `TECHNICAL_API_VERIFICATION.md`.

**Evidence:**

- `CONTENT_MODEL.md:190-208` says a Place YAML file may contain one or more Place entries and shows a YAML array with two Places.
- `REPOSITORY_STRUCTURE.md:35-36` says one file per Place.
- `BUILD_AND_ROUTING.md:128-142` uses `glob({ pattern: '*.yaml' })`, a singular `placeSchema`, and explicitly says each file becomes one collection entry.
- Official Astro docs distinguish `glob()` for separate-file entries from `file()` for multiple entries in one YAML/JSON file.

**Why IMPORTANT:** A planner must guess between `z.object(place)`, `z.array(place)`, flattening, or a custom loader. Those choices change collection entry IDs, reference resolution, duplicate detection, and Place route generation.

**Minimum targeted correction:** Select one normative model. The smallest correction is one Place object per `content/places/{place}.yaml` file with the existing `glob()` loader and singular `placeSchema`; update the array example and “one or more” wording. If multi-entry files are intentionally retained, specify a custom/aggregate loader and exact flattened entry-ID contract instead.

### IMPORTANT-02 — Redirect schema and Nginx lifecycle are not one implementable contract

**Affected documents:** `CONTENT_MODEL.md`, `BUILD_AND_ROUTING.md`, `TESTING_AND_VISUAL_REGRESSION.md`, `RISK_REGISTER.md`, `DEPLOYMENT_ARCHITECTURE.md`, and ADR-022.

**Evidence:**

- `CONTENT_MODEL.md:379-396,441-442` defines Gallery-only `gallery_id` redirects and requires only target existence.
- `BUILD_AND_ROUTING.md:191-223` adds Place redirects (`place_id`) and says target Gallery or Place need only exist.
- `TESTING_AND_VISUAL_REGRESSION.md:51` and `RISK_REGISTER.md:88-96` require redirect targets to be published.
- `BUILD_AND_ROUTING.md:216-221` permits either a generated Nginx `include` containing `return 301` directives or static meta-refresh HTML.
- `DEPLOYMENT_ARCHITECTURE.md:13,134-138` says content releases require no Nginx reload and configuration changes do require reload.

**Why IMPORTANT:** Implementers can produce incompatible redirect schemas, allow redirects to unpublished 404 targets, or generate Nginx directives that are never activated by the content-only switch. Meta-refresh HTML also does not have the same HTTP status/cache/rollback semantics as a true 301.

**Minimum targeted correction:**

1. Freeze one redirect value union (Gallery-only, or explicit discriminated `gallery_id | place_id`) and align all validators/examples.
2. Require production redirect targets to resolve to a public/published canonical route.
3. Select or fully specify the delivery branch. If using Nginx `return 301`, define candidate config generation, `nginx -t`, reload, exact config rollback, and coupling to the release switch. If using static pages, document the actual HTTP status and accept that it is not a server-side 301.

### IMPORTANT-03 — Image format is both benchmark-deferred and already frozen

**Affected documents:** `PERFORMANCE_BUDGET.md`, `IMAGE_PIPELINE.md`, `OPEN_QUESTIONS.md`, and optionally `ARCHITECTURE_REVIEW_PACKET.md`.

**Evidence:**

- `PERFORMANCE_BUDGET.md:161-163` declares “Baseline: WebP primary, JPEG fallback”.
- `IMAGE_PIPELINE.md:434-451` says format selection (JPEG vs WebP vs both) is intentionally not frozen until P3.
- `OPEN_QUESTIONS.md:39-43` says JPEG vs WebP vs AVIF has no universal default and blocks the P3 derivative contract.

**Why IMPORTANT:** One planner can implement `<picture>` and two-format derivatives before the benchmark; another can keep format open until P3. That changes the manifest schema, derivative count, assembly paths, cache surface, and page templates.

**Minimum targeted correction:** Replace the WebP/JPEG “Baseline” with a clearly labeled benchmark candidate/hypothesis, or remove it. Preserve one rule: P3 selects format(s) and quality from measured fixtures before P4/P5 implement dependent templates.

---

## Minor Findings

1. `IMPLEMENTATION_PHASES.md:23-25` allows P1 after “architecture gate A or B.” Under this review's gate meanings, B explicitly requires correction before freeze. Change the entry criterion to Architecture Freeze PASS / Gate A only.
2. `TESTING_AND_VISUAL_REGRESSION.md:61,136` points to historical `CANONICAL_REWRITE_BRIEF.md`; replace with active canonical owners.
3. `SOURCE_OF_TRUTH_MATRIX.md:34` makes `g_` look mandatory while `CONTENT_MODEL.md:34-36` says ID prefixes are recommendations.
4. `README.md:232-254` says 19 canonical files and omits the traceability document from the index; `IMPLEMENTATION_PHASES.md:263` also says restore “registry” although the canonical architecture has no persistent identity registry. Correct both as metadata/terminology cleanup.

None of these four changes requires architecture redesign. They should be included in the same targeted correction pass.

---

## Required Actions

Before Architecture Freeze:

1. **Place contract:** choose one-Place-per-file with `glob()` and singular schema, or specify the exact alternative loader/flattening contract; align `CONTENT_MODEL.md`, `REPOSITORY_STRUCTURE.md`, `BUILD_AND_ROUTING.md`, and P2.
2. **Redirect contract:** align Gallery/Place scope, require a public/published production target, and close the chosen Nginx/static delivery lifecycle including status, reload, verification, and rollback semantics.
3. **Format deferral:** remove the active WebP+JPEG preselection so OQ-02 remains genuinely benchmark-driven through P3.
4. Apply the four minor reference/gate/prefix/index terminology cleanups above.
5. Run a targeted re-verification only of the changed sections plus their direct cross-references. Do not create Architecture v3, another correction directory, an Implementation Plan, or production code.

---

## Final Gate

### B — TARGETED CORRECTION REQUIRED

**ARCHITECTURE VALID — Targeted corrections required before freeze.**

The high-level architecture and all structural persistence/build/recovery contracts are valid. There are 0 CRITICAL findings and 3 IMPORTANT findings. After the exact sections above are corrected, only focused verification is needed.

Do not begin the Implementation Plan until the targeted corrections pass focused verification and a later review explicitly issues Gate A.
