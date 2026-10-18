# 0828｜研究｜架构修正定向复审

**Review date:** 2026-08-28  
**Repository:** <repo>  
**Live Git at review:** main @ 92f7a58c312a9117737b70e34767eb71270923fb  
**Frozen product authority:** research/FINAL_DESIGN_SPECIFICATION.md  
**Baseline:** research/production-architecture-red-team/INDEPENDENT_ARCHITECTURE_RED_TEAM.md  
**Correction set reviewed:** research/production-architecture/PREVIOUS_CORRECTIONS/ plus the three correction summary/preparation documents  
**Review mode:** local evidence review plus manually supplied Gemini cross-model review, followed by line-by-line reconciliation

---

## Executive Verdict

**Final Gate: C — MATERIAL ARCHITECTURE REVISION STILL REQUIRED.**

The proposed corrections do not close the architecture sufficiently to begin an Implementation Plan.

The principal reason is not merely that several code examples contain errors. The correction set was never integrated into the canonical architecture. The repository now contains three competing layers:

1. the original 16-document architecture, still carrying the original defects;
2. the independent red-team report describing required corrections;
3. a PREVIOUS_CORRECTIONS proposal layer that claims completion while explicitly listing canonical documents that still NEED UPDATE.

The proposal layer also introduces new critical contradictions:

- Astro cannot consume a manifest from dist after Astro has already rendered the HTML;
- the proposed Astro Content Layer configuration uses a non-existent astro.config.mjs API;
- the Home correction imports FreeBuff product language, domain, font naming, and unapproved editorial states;
- the historical publication migration derives published_at from EXIF photographed time;
- the stated coverage check never populates requestedPhotoIds and therefore always passes;
- several proposed file, route, manifest, cache, draft, and deployment contracts disagree with each other.

The high-level Astro/static/YAML/local-image-pipeline/Nginx direction remains valid.

---

## Files and Authority Reviewed

### Frozen authority

- research/FINAL_DESIGN_SPECIFICATION.md

### Baseline red-team contract

- research/production-architecture-red-team/INDEPENDENT_ARCHITECTURE_RED_TEAM.md

### Canonical architecture

All 16 original architecture documents under research/production-architecture/ were checked, including README, overview, ADRs, content, image, build/routing, runtime, performance, testing, deployment, repository, risk, phases, open questions, summary, and review packet.

### Proposed corrections

- PREVIOUS_CORRECTIONS/photo-identity-registry-corrected.md
- PREVIOUS_CORRECTIONS/corrected-build-dag.md
- PREVIOUS_CORRECTIONS/single-source-of-truth-content.md
- PREVIOUS_CORRECTIONS/home-state-persistence.md
- PREVIOUS_CORRECTIONS/important-findings-corrections.md
- PREVIOUS_CORRECTIONS/minor-fixes-batch.md
- TARGETED_RE_REVIEW_PREPARATION.md
- CORRECTION_SUMMARY_REPORT.md
- EXECUTION_SUMMARY.md

### Live repository evidence

At review time, the repository has no package.json, astro.config.mjs, src/content.config.ts, content/galleries/, registry/, assets-staging/, or manifest-staging/. This is expected for an architecture-only stage, but it also means correction claims such as “tested and verified” have no executable repository evidence. The examples must therefore be treated as architecture pseudocode unless separately proven.

---

## Cross-Model Reconciliation

The supplied Gemini review independently reached Gate C. Its findings were treated as review data, not authority.

### Valid and actionable

The following Gemini findings are confirmed against local files:

- canonical architecture was not updated;
- correction files explicitly state that canonical files still NEED UPDATE;
- the corrected DAG consumes AssetManifest after the consumer has already built;
- manifest paths use _assets while assembled derivatives use assets;
- verifyCoverage is a no-op because requestedPhotoIds remains empty;
- the Astro collections example is not a valid current Astro Content Layer configuration;
- the correction set imports FreeBuff identifiers and unrelated editorial concepts;
- EXIF photographed time is used as a publication-time proxy;
- the deployment smoke test does not target the candidate release;
- previous points to current rather than the exact prior release;
- Sharp, Zod, and fontTools examples contain non-existent or invalid APIs;
- HTML receives an inappropriate immutable cache rule and SPA fallback;
- media paths conflict across correction files.

### Contract misreads or overstatements corrected in this report

1. **Home Recent Galleries:** Gemini states that the frozen Home contains only a single Hero and forbids any secondary card list. The frozen specification explicitly includes a Recent Galleries grid at FINAL_DESIGN_SPECIFICATION.md:213. The real drift is not the existence of a recent grid; it is the imported “Secondary Feature,” “This Week,” is_curated, arbitrary photos-length filter, and FreeBuff language.
2. **mv -Tf portability:** Gemini treats GNU mv -T incompatibility with macOS as material. The deployment target is a Linux VPS, so this is not a defect if the script is explicitly Linux-only. It remains a documentation/portability issue if the same script is claimed to run on the macOS author workstation.
3. **RT-017:** Gemini marks alt schema closed. It is only a proposal, is not integrated into a canonical storage model, and contradicts itself by calling alt mandatory while missing alt only warns.
4. **RT-018:** Gemini marks DOM test semantics closed. The correction covers modal-open visibility only, does not repair close/focus-restoration assertions, and was not applied to the canonical test document.
5. **RT-012:** Gemini calls cycle validation partially closed. The proposed algorithm does not inspect rootless cycles and fails to report a cycle returning to the start node; it is regressed rather than partially closed.
6. **Correction disposal:** Gemini recommends deleting PREVIOUS_CORRECTIONS. This review recommends marking it superseded and archiving it only after an approved canonical rewrite. No deletion is authorized in this review.

### Noise rejected

Gemini’s NF-M01 says unquoted YAML landscape is invalid for an orientation enum. Plain unquoted landscape is a valid YAML string and is not a defect.

---

## Canonical Integration Verdict

**Verdict: FAILED — CRITICAL**

The canonical architecture still contains the original defects:

| Original issue | Canonical evidence still present |
|---|---|
| Disposable Photo identity mapping | CONTENT_MODEL.md:51; REPOSITORY_STRUCTURE.md:133 |
| Image pipeline writes to dist before Astro build | IMAGE_PIPELINE.md:97-98; ARCHITECTURE_OVERVIEW.md:52 |
| Manifest generation duplicated after rendering | ARCHITECTURE_OVERVIEW.md:62 |
| Dual content boundary | REPOSITORY_STRUCTURE.md:25 |
| Removed Astro legacy collection syntax | BUILD_AND_ROUTING.md:154 |
| Build-generated publication time | CONTENT_MODEL.md:160 |
| Caption hover / styled button drift | RUNTIME_AND_PROGRESSIVE_ENHANCEMENT.md:90-91 |
| Non-atomic deployment baseline | DEPLOYMENT_ARCHITECTURE.md:120,152,268 |
| ADR status typo | ARCHITECTURE_DECISIONS.md:9 |
| ADR date typo | ARCHITECTURE_DECISIONS.md:20 |

The correction artifacts confirm non-integration:

- single-source-of-truth-content.md:353-374 lists canonical files that still need update.
- home-state-persistence.md:522-534 lists canonical files that still need update.
- CORRECTION_SUMMARY_REPORT.md states that original audited architecture artifacts were preserved rather than revised.

An implementation agent cannot determine whether the original architecture or PREVIOUS_CORRECTIONS wins. This is a new source-of-truth defect, not a cosmetic documentation arrangement.

**Minimum correction:** Produce one coherent replacement of the canonical architecture documents, with a revision log mapping each accepted RT finding to changed canonical sections. Mark correction proposals as superseded only after re-review. Do not start an Implementation Plan against mixed authorities.

---

## RT-001 Verdict

**Verdict: PARTIALLY CLOSED AS A DIRECTION; NOT ACTUALLY APPLIED**

The central choice—promoting the Photo ID/source binding to a Git-tracked authored registry—would solve the original information-loss problem. The proposal does not yet form a clean production contract.

### Confirmed improvements

- registry/photo-identity-manifest.yaml is persistent rather than generated.
- rename/move can preserve Photo ID through an explicit registry update.
- corrected-master replacement versus new Photo is recognized as an editorial decision.

### Remaining defects

1. **Duplicate source reference:** source_file and location store the same relationship twice and can diverge (photo-identity-registry-corrected.md:38-39).
2. **Derived state stored as authored state:** capture_datetime, orientation_class, intrinsic_width, and intrinsic_height are physical metadata that should be extracted and validated, not manually maintained in the identity registry (lines 40-43).
3. **Missing source can warn and continue:** line 54 allows WARN/skip. Published content must fail closed; local draft preview may use a separate warning policy.
4. **Invalid path schema:** line 141 applies z.string().url() to a repository-relative path.
5. **Media path disagreement:** the registry uses media/originals; the content correction places JPEGs under content/galleries; the terminology correction points registry data to media/archival, even though the baseline ingest supports JPEG rather than RAW.
6. **Unapproved decision:** the original review required the user to select the identity representation. The correction author unilaterally marks the registry ADOPTED.
7. **Canonical model unchanged:** generated/photo-identities.json remains the official mapping in the canonical content/repository documents.

### Minimum acceptable contract

The persistent registry should contain:

- stable photo_id;
- exactly one repository-relative source_ref to the supported WEB INGEST MASTER;
- optional explicit source revision/replacement record only if needed for audit.

Filename, basename, dimensions, orientation, ICC, and hashes should be derived/validated. Published missing source must fail. The user must approve the registry representation and corrected-master identity rule.

---

## RT-002 Verdict

**Verdict: REGRESSED — CRITICAL**

The staging idea avoids Astro deleting derivatives, but the proposed producer/consumer graph is still impossible.

### Data-flow failure

~~~text
Phase 1: manifest-staging/AssetManifest.json exists
Phase 2: Astro renders HTML
Phase 3: manifest is copied into dist/_assets/manifest/
~~~

The Astro example imports /_assets/manifest/AssetManifest.json from the web-root-style path after stating that the file is copied there only in Phase 3. Static HTML cannot contain resolved derivative URLs, dimensions, or srcset unless Astro consumes the Phase 1 manifest during Phase 2.

### Additional contradictions

- Manifest entries use _assets/... (corrected-build-dag.md:113,233).
- Derivatives are copied to dist/assets/... (lines 170-178).
- Nginx correction matches /assets/, not /_assets/.
- mapping.gallery_slug is used by the pipeline but is absent from the registry schema.
- missing source warns and continues.
- the shown output is PNG despite the architecture’s WebP/JPEG contract.
- srcset is not present in the manifest, although Astro reads entry.srcset.
- entry.src.replace with a digit regex can alter digits inside the Photo ID/year rather than the width.
- requestedPhotoIds is initialized but never populated; coverage always passes.
- partial Phase 3 copying mutates dist in place and has no atomic assembly root.
- the document says post-build overwrite is rejected, while its Phase 3 is precisely a post-build mutation of dist.
- it claims dist/_astro is not needed for deployment; Astro’s generated _astro assets can be required by rendered pages.

### Correct DAG

~~~text
Persistent registry + authored content + ingest masters
    ↓
Reference/source validation
    ↓
Image derivation into an isolated complete staging tree
    ↓
generated/asset-manifest.json with final hashed public URLs
    ↓
Astro build imports the manifest at build time and renders HTML
    ↓
Atomic final assembly root containing Astro output + staged media
    ↓
Integrity check of every HTML/manifest/file reference
    ↓
Release upload
~~~

Whether Astro copies media through public/assembly or a wrapper build command is an implementation choice; the architectural invariant is that final URLs and manifest exist before HTML rendering, while deployment sees only a fully assembled release candidate.

---

## RT-003 Verdict

**Verdict: REGRESSED — CRITICAL**

The intention to load content/galleries directly is correct. The proposed Astro configuration is not.

### Official API verification

Current Astro Content Layer defines collections in src/content.config.ts using defineCollection and a loader such as glob({ pattern, base }). The correction instead invents an astro.config.mjs collections.folder/render structure and a getEntryData hook.

Official sources:

- https://docs.astro.build/en/guides/content-collections/
- https://docs.astro.build/en/reference/content-loader-reference/

### Internal contradictions

- single-source-of-truth-content recommends _draft-*.
- the same document also offers published/drafts directories.
- minor-fixes-batch removes status and mandates published/drafts.
- the Home schema still shows status assumptions from other documents.
- Gallery image files appear under content/galleries in one tree, media/originals in the registry, and media/archival/ingest-masters in another correction.
- rhythms use compact/spacious rather than frozen base/compact/breathing.
- the example route is /lofoten-light rather than /galleries/{slug}.
- next_gallery is alternately described as Gallery ID and slug.

### Minimum correction

Use one authored root and one publication model:

~~~text
src/content.config.ts
  defineCollection({
    loader: glob({
      pattern: "**/meta.yaml",
      base: "./content/galleries"
    }),
    schema: gallerySchema
  })
~~~

Production filtering should follow one canonical Gallery status rule or one canonical directory rule, not both. Route generation remains /galleries/{slug}. Media remains outside authored metadata.

---

## RT-004 Verdict

**Verdict: REGRESSED — CRITICAL**

Making published_at and featured persistent authored fields is the correct starting direction. The surrounding proposal violates the product and temporal contracts.

### Publication-time failure

home-state-persistence recommends deriving missing published_at from the earliest EXIF photographed time. This creates false history. A Gallery photographed in 2015 but first added in 2026 would be classified as old rather than latest.

No automated method can reconstruct an unknown original publication time from Photo metadata. The migration must use:

- author-supplied historical publication dates; or
- an explicitly labeled archive-import/added baseline if history is unknown, with deterministic tie-breaking.

It must not call photographed time published time.

### Product contamination

Confirmed unrelated identifiers/concepts:

- FreeBuff v1.0;
- freebuff.app;
- FreeBuffCJK;
- is_curated;
- This Week Rotation;
- secondary-feature semantics not present in this project.

The frozen Home does include a Recent Galleries grid. Therefore a three-card recent list is not automatically a violation. It becomes a violation when it is redefined as a separate curated/weekly recommendation system or filtered by unapproved “at least three Photos” logic.

### Additional defects

- rhythms again use compact/spacious.
- redirect examples omit /galleries/.
- sitemap lastmod is populated from published_at, although first publication is not necessarily last modification.
- HTML, CSS, JS, and images are all given one-year immutable cache.
- try_files falls back to /index.html, creating false 200 responses for a static site.
- the example domain is unrelated.
- the migration script contains variable/import errors and writes authored files despite being presented only as architecture.

### Minimum correction

Canonical Gallery state should include persistent published_at, featured default false, status, and cover semantics after user approval. Validate at most one featured published Gallery. Fallback order must be published_at descending plus stable Gallery ID. Do not add curated/weekly/scheduled behavior.

---

## RT-005–RT-018 and H6 Status Matrix

| Finding | Reconciled status | Evidence and reason | Required timing |
|---|---|---|---|
| RT-005 Determinism | PARTIALLY CLOSED AS PROPOSAL; NOT APPLIED | Semantic versus byte distinction is correct; safeStringify and determinism shell examples are not executable/canonical; stable unhashed URL claim conflicts with RT-013 | Before P3 |
| RT-006 Originals/LFS/backup | OPEN; STILL BLOCKS IMPLEMENTATION PLAN | Options are listed but no user choice, RPO/RTO, cost boundary, restore drill, or canonical source_ref exists | Before Implementation Plan |
| RT-007 Media terminology | REGRESSED | WEB INGEST MASTER is incorrectly called pipeline-generated/ephemeral; registry points archival assets although pipeline supports JPEG ingest; three path layouts conflict | Before P2 |
| RT-008 ICC/privacy | REGRESSED | Unsafe camera-model guessing, non-existent Sharp profile API, unsupported withMetadata allowlist, and privacy-sensitive camera/lens/date retention without product need | Before P3 |
| RT-009 Progressive enhancement | REGRESSED | Wrong product name, reserved caption height, mobile line clamp, alt=caption, wrong route, and checkbox hidden with display:none while claimed keyboard accessible | Before P1/P6 |
| RT-010 Slug/redirect | REGRESSED | Slug exists in Gallery and slug registry; computed() is not Zod; redirect paths/domain are wrong; Nginx says import rather than include | Before P2 |
| RT-011 Draft/published | REGRESSED | Photo status removal is good; status vs _draft vs published/drafts remains unresolved and Astro config is invalid | Before P2 |
| RT-012 next_gallery | REGRESSED | Singular next cannot branch; algorithm only scans roots, so rootless cycles are skipped; returning to start is explicitly not reported | Before P2/user decision |
| RT-013 Hashed assets/cache | REGRESSED | Six-hex digest is insufficient at plausible derivative counts; finalName undefined; output/manifest/Nginx paths disagree | Before P3 |
| RT-014 Deployment | REGRESSED | Pre-switch curl tests old/unrelated path; previous points to current after switch; rollback TIMESTAMP undefined; no post-switch smoke/lock; canonical script unchanged | Before P9 |
| RT-015 Budgets/chunking | PARTIALLY CLOSED AS POLICY; NOT APPLIED | Default bundling/benchmark rule is correct, but canonical hard targets remain and are not reclassified | Before P1/P7 |
| RT-016 CJK | REGRESSED | Invalid fontTools script, incomplete character corpus, and FreeBuffCJK/Noto Sans CJK drift from frozen Source/Noto Serif/Sans SC families | Before P1/P4 |
| RT-017 Alt | PARTIALLY CLOSED AS DIRECTION; NOT APPLIED | Rejecting filename fallback is correct; storage model absent; “mandatory” conflicts with warning-only enforcement; user policy still required | Schema before P2; policy before P7 |
| RT-018 Tests | PARTIALLY CLOSED; NOT APPLIED | hidden open-state corrected; close, attached DOM, focus restoration/trap, and visual-diff governance remain unresolved; canonical test unchanged | Before P6/P8 |
| H6 | NOT ACTUALLY APPLIED | ADOUGHTED and 2006 remain in canonical ADR; summary claim is false | Before canonical freeze |

---

## New Critical Findings

### TRR-001 — Correction layer creates a third architecture authority

**SOURCE DOCUMENT FINDING:** Canonical files retain original defects; correction artifacts list NEEDS UPDATE; summaries claim all fixes complete.

**FAILURE:** Different implementers follow different layers and produce incompatible registry, media, build, and routing behavior.

**MINIMUM CORRECTION:** Rewrite the canonical architecture as one coherent version; include a correction traceability table; mark proposal documents superseded only after approval.

**Direction impact:** No high-level change.  
**User decision required:** No, except approval of the final canonical replacement.

### TRR-002 — Corrected build still consumes data after its consumer

**SOURCE DOCUMENT FINDING:** AssetManifest is copied into dist in Phase 3, while Astro needs it in Phase 2.

**FAILURE:** Astro cannot import the stated file or render final hashed image URLs.

**MINIMUM CORRECTION:** Manifest with final public paths must exist before Astro build; final assembly must be isolated and verified before deployment.

**Direction impact:** No.  
**User decision required:** No.

### TRR-003 — Correction relies on invalid framework/tool APIs while claiming verification

**SOURCE DOCUMENT FINDING:** astro.config collections API, getEntryData, Sharp profile/metadata options, Zod computed, Sharp CLI, and fontTools examples are presented as usable.

**EXTERNAL VERIFICATION:** Official Astro and Sharp documentation contradicts the examples.

**FAILURE:** The first implementation cannot configure content or execute the image/color pipeline.

**MINIMUM CORRECTION:** Either use verified current API examples or clearly label non-executable pseudocode and define only contracts. No example may be called tested without an executable repository check.

**Direction impact:** No.  
**User decision required:** No.

### TRR-004 — Corrections contaminate the frozen product and temporal record

**SOURCE DOCUMENT FINDING:** FreeBuff identifiers, This Week, is_curated, wrong routes/fonts, and EXIF-derived published_at appear in proposed corrections.

**FAILURE:** Implementation encodes a different product and falsifies Latest-first history.

**MINIMUM CORRECTION:** Remove all unrelated product concepts; use the frozen Home/route/font/caption contracts; obtain publication state through authored data.

**Direction impact:** No.  
**User decision required:** Yes for publication migration policy and exact featured storage.

---

## New Important Findings

1. **TRR-I01 — Identity registry over-stores derived state.** Keep only stable identity/source binding; extract physical metadata.
2. **TRR-I02 — Media ownership is less coherent after correction.** CAMERA ORIGINAL, ARCHIVAL MASTER, WEB INGEST MASTER, and WEB DERIVATIVE must map to one consistent set of directories and replacement rules.
3. **TRR-I03 — Runtime correction creates accessibility regressions.** display:none checkbox is not keyboard focusable, captions reserve empty space and are clamped, caption is reused as alt.
4. **TRR-I04 — Slug correction adds another source of truth.** Gallery YAML and slug registry both store current slug.
5. **TRR-I05 — Cycle algorithm is non-functional.** It cannot detect a rootless A→B→C→A cycle and lists impossible branching for a singular next field.
6. **TRR-I06 — Hash implementation is unsafe/incomplete.** Undefined variables, mismatched path prefixes, and a six-hex digest do not provide a robust asset namespace at scale.
7. **TRR-I07 — Deployment rollback does not preserve previous state.** Previous must record readlink current before switching; candidate and post-switch smoke tests are separate.
8. **TRR-I08 — Correction summaries contain unverified completion claims.** No Astro project or executable scripts exist in the repository; claims must be proposal status.
9. **TRR-I09 — Open user decisions were silently adopted.** Registry form, draft model, alt policy, cover default, storage, cycle policy, and font strategy require explicit approval or remain OPEN.

---

## Minor Findings

1. TARGETED_RE_REVIEW_PREPARATION.md is in the architecture root, not PREVIOUS_CORRECTIONS as claimed in the supplied summary.
2. The correction artifact total is 3,210 lines for the six proposals plus two summaries, not the claimed 3,249; line count does not affect verdict.
3. Nginx uses include, not an “import directive.”
4. The hash code defines finalFilename but then uses undefined finalName.
5. Rollback uses TIMESTAMP without defining it.
6. parseYAML/stringifyYAML examples do not match the common yaml package API as shown.
7. Unquoted YAML landscape is valid; Gemini’s contrary minor finding is rejected.
8. Linux-only mv -T is acceptable only if the deployment document explicitly scopes the script to GNU/Linux VPS execution.

---

## Frozen Design Drift

| Area | Frozen contract | Correction drift | Verdict |
|---|---|---|---|
| Product identity | Quiet Editorial Archive | FreeBuff v1.0 / freebuff.app | CRITICAL contamination |
| Home | Hero + Archive/Places discovery + Recent Galleries | This Week, is_curated, secondary-feature semantics | Remove unapproved semantics; Recent Galleries itself remains valid |
| Gallery routes | /galleries/{slug} only | /{slug}, /archive/galleries/{slug}, root redirects | CRITICAL route drift |
| Rhythm | base / compact / breathing | compact / spacious | IMPORTANT schema drift |
| Captions | visible, no reserved region when absent, no truncation requirement | min-height and mobile line clamp | IMPORTANT drift |
| Continuation | End label + Next Gallery title + Back link | generic Next Gallery arrow/wrong route | IMPORTANT drift |
| Fonts | Source Serif 4, Source Sans 3, Noto Serif SC, Noto Sans SC | FreeBuffCJK / generic Noto Sans CJK | IMPORTANT drift |
| Alt | Separate editorial policy; caption not automatically alt | alt={caption} in runtime example | IMPORTANT accessibility drift |
| Mobile nav | Core navigation accessible without JS | hidden checkbox input claimed keyboard accessible | IMPORTANT accessibility defect |

---

## Build and Data-Flow Trace

The correction set’s executable target should be reduced to this dependency contract:

~~~text
AUTHORED, PERSISTENT
  content/galleries/**/meta.yaml
  content/places/places.yaml
  registry/photo-identity-manifest.yaml
  WEB INGEST MASTERS at one approved media root
           |
           v
REFERENCE AND SOURCE VALIDATION
  identity/source exists
  Gallery/Place/Photo/cover/next closure
  publication and draft fail-closed rules
           |
           v
IMAGE PIPELINE
  auto-orient → ICC decision → sRGB transform
  resize/encode → strip privacy metadata
  final content-hashed public paths
  generated/asset-manifest.json
           |
           v
ASTRO BUILD
  src/content.config.ts glob-loads authored YAML
  templates import generated manifest at build time
  render canonical /galleries/{slug}
           |
           v
ISOLATED FINAL ASSEMBLY
  complete Astro output + derivative files
  no mutation of a live/release directory
           |
           v
INTEGRITY GATE
  every requested Photo has required derivatives
  every manifest/HTML path exists
  no drafts/originals/GPS leakage
           |
           v
UNIQUE RELEASE → PRE-SWITCH VERIFY → ATOMIC POINTER
  record exact previous target before switch
  post-switch HTTP smoke
  exact rollback on failure
~~~

---

## User Decisions Still Required

### MUST decide before canonical architecture rewrite

1. **Photo identity representation:** approve a Git-tracked global registry or choose another persistent representation.
2. **Corrected master semantics:** when a replacement retains Photo ID versus creates a new Photo.
3. **Existing Gallery publication migration:** author-supplied historical time, honest archive-import time, or another explicit policy; never EXIF photographed time.
4. **Current featured state:** field in each Gallery or a separate Home editorial settings file.
5. **Media ownership:** all masters in Git/LFS, external versioned storage, or curated ingest masters in LFS plus archival originals externally.
6. **Backup RPO/RTO and off-site target.**
7. **next_gallery cycle policy:** target/self-loop only versus acyclic graph.
8. **Current slug authority:** Gallery field plus redirect history, or one registry; not both.
9. **Draft authority:** Gallery status or directory partition; not multiple conventions.
10. **Cover:** explicit required Photo or first-Photo default.
11. **prev_gallery:** authored or derived.

### Can defer to named phase after schema support exists

- untagged ICC fail versus explicit override;
- CJK broad static versus build-derived subset;
- alt publication enforcement;
- benchmark values for images, JS, CSS, and fonts.

---

## Corrections Required Before Implementation Plan

1. Resolve the user decisions above that change schema/storage/identity.
2. Rewrite—not append to—the canonical content, repository, build, image, runtime, deployment, ADR, risk, open-question, phase, summary, README, and review-packet sections affected by the decisions.
3. Publish a canonical source-of-truth matrix with exactly one owner per field/path.
4. Replace the corrected DAG with a producer-before-consumer graph.
5. Use current official Astro Content Layer syntax in src/content.config.ts.
6. Remove all FreeBuff and unapproved product concepts.
7. Remove EXIF-to-published_at migration.
8. Correct media category definitions and source_ref.
9. Replace unverified API examples or label them explicitly as non-executable pseudocode.
10. Define published/draft/featured/cover/next/prev/redirect lifecycle.
11. Preserve frozen routes, rhythm, captions, continuation, fonts, and no-JS navigation.
12. Reclassify correction summaries from COMPLETE to PROPOSED until the canonical re-review passes.
13. Archive or mark PREVIOUS_CORRECTIONS superseded only after its accepted content is integrated; do not delete it during this review.

---

## Corrections Required Before Later Phases

### Before P2

- persistent registry validator;
- one publication model;
- slug/redirect closure;
- one-Photo-one-Gallery and orphan metadata checks;
- alt schema support;
- authoring workflow for rename/move/replace/publish.

### Before P3

- valid Sharp color/privacy pipeline;
- toolchain pinning;
- deterministic core manifest;
- robust content hash/path convention;
- full derivative coverage validation;
- originals/ingest storage decision and restore evidence.

### Before P6/P8

- accessible no-JS mobile navigation;
- correct dialog hidden/focus/restore tests;
- screenshot integrity separated from visual equivalence.

### Before P9

- unique release staging;
- candidate release verification;
- exact pre-switch target capture;
- atomic same-filesystem pointer update;
- post-switch smoke and automatic exact rollback;
- deployment serialization;
- HTML versus hashed-asset cache rules;
- real static 404 behavior.

---

## High-Level Architecture Direction

**Verdict: VALID.**

Astro static generation, file-first YAML, a separate local image pipeline, minimal progressive enhancement, and Nginx remain proportionate to the archive.

The defects are in persistence, authority, data flow, API validity, product drift, and operational closure. They do not require a framework/database/backend redesign.

---

## Final Gate

### C — MATERIAL ARCHITECTURE REVISION STILL REQUIRED

The corrections are proposals, not integrated canonical architecture. RT-001 is only partially closed in concept; RT-002 through RT-004 regress or remain impossible; multiple IMPORTANT findings remain open or were worsened.

Do not begin an Implementation Plan.

The next authorized architecture action is a user-approved canonical rewrite based on this report and the original red-team report, followed by another focused re-review of the rewritten canonical documents. This review does not authorize implementation code, deletion, commit, push, deployment, or production changes.
