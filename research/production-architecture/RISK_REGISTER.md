# Risk Register — Quiet Archive Production

**Status:** CANONICAL -- engineering authority
**Companion to:** SOURCE_OF_TRUTH_MATRIX.md, CONTENT_MODEL.md, IMAGE_PIPELINE.md, BUILD_AND_ROUTING.md, DEPLOYMENT_ARCHITECTURE.md, BACKUP_AND_RECOVERY.md, PERFORMANCE_BUDGET.md, OPEN_QUESTIONS.md, IMPLEMENTATION_PHASES.md

---

## 1. Purpose and scope

This register documents known risks to the Quiet Editorial Archive architecture, their triggers, impacts, canonical mitigations, and ownership. Mitigations point to actual canonical controls by document name. Risks that contradict the canonical architecture (e.g., Git/LFS-as-backup, cycle-detection tooling for next_gallery, generated identity registry recovery) have been removed.

Severity uses a likelihood/impact model. Owner is the implementation phase (P1-P10 per IMPLEMENTATION_PHASES.md) where the risk is primarily managed. Status indicates whether mitigation is designed, in progress, or deferred to a specific phase.

This register is reviewed at each phase boundary and after any incident.

---

## 2. Active risks

### RISK-001: source_ref drift

| Field | Value |
|---|---|
| **Risk** | A WEB INGEST MASTER file is renamed or moved on disk without updating the corresponding `source_ref` in Gallery YAML, breaking the Photo-to-source binding. |
| **Trigger** | File reorganization outside the authored YAML workflow; bulk rename operations; manual filesystem edits. |
| **Impact** | High. Build fails closed for published content (missing source). If validation were warning-only, captions/rhythms/covers could attach to wrong images or produce missing-image output. |
| **Likelihood** | Medium. Renames are expected during archival curation. |
| **Canonical mitigation** | Fail-closed source validation in production builds: every `source_ref` in every published Gallery must resolve to an existing WEB INGEST MASTER. Build rejects unresolved references. Authoring workflow documents the rename procedure (update `source_ref` when moving files). See CONTENT_MODEL.md (Photo-to-source binding), BUILD_AND_ROUTING.md (validation gate), SOURCE_OF_TRUTH_MATRIX.md (single owner of source binding). |
| **Owner phase** | P2 (content validation), ongoing |
| **Status** | Designed. Implementation deferred to P2. |

**Narrative:** The canonical architecture binds Photo ID to source via `source_ref` in Gallery YAML (UD-001). There is no separate identity registry. If a file moves without a YAML update, the binding breaks. Fail-closed validation catches this at build time. The authoring workflow must treat renames as YAML edits, not just filesystem operations.

---

### RISK-002: Ingest-master loss

| Field | Value |
|---|---|
| **Risk** | WEB INGEST MASTERS are lost due to VPS disk failure, accidental deletion, or corruption, with no off-site backup available. |
| **Trigger** | Hardware failure; accidental `rm -rf`; ransomware; hosting provider data loss. |
| **Impact** | Critical. WEB INGEST MASTERS are non-regenerable pipeline inputs. Loss means permanent loss of the website's image source unless backed up. Derivatives can be regenerated from masters, but masters cannot be regenerated from derivatives. |
| **Likelihood** | Low-Medium. Single-point storage failures are well-understood. |
| **Canonical mitigation** | Encrypted off-site backup of all WEB INGEST MASTERS with RPO no more than 24 hours. VPS is never the sole copy of ingest masters. Backup verification and scheduled restore drills validate recoverability. See BACKUP_AND_RECOVERY.md (RPO/RTO targets, backup scope, restore drill schedule), SOURCE_OF_TRUTH_MATRIX.md section 3 (external non-regenerable state). |
| **Owner phase** | P9 (deployment/recovery verification), ongoing |
| **Status** | Designed. Provider/tool selection deferred to P9. |

**Narrative:** UD-005 establishes that media ownership lives outside Git. UD-006 sets RPO/RTO targets of 24 hours. The VPS serves derivatives and HTML but must never be the only copy of ingest masters. Off-site encrypted backup (object storage or independent host) is required. Restore drills prove recovery works.

---

### RISK-003: Unknown historical published_at

| Field | Value |
|---|---|
| **Risk** | Historical Galleries lack genuine publication timestamps, and the system fabricates dates from EXIF capture time, file mtime, Git history, or folder names, producing misleading chronology. |
| **Trigger** | Migrating existing archive content where true publication/addition dates are unknown. |
| **Impact** | Medium. Incorrect ordering in Archive and Home Recent Galleries. Misleading chronological narrative. Violates the honest-archive principle. |
| **Likelihood** | High. Historical migration is expected. |
| **Canonical mitigation** | UD-003 honest archive-import timestamp policy: if historical publication time is genuinely known, the author enters it. Otherwise, migrated historical Galleries use an honest archive-import/site-publication timestamp. Unknown history remains unknown rather than being fabricated. Never derive `published_at` from EXIF, photographed date, file mtime, Git timestamp, or folder name. See CONTENT_MODEL.md (published_at semantics), SOURCE_OF_TRUTH_MATRIX.md (published time owner). |
| **Owner phase** | P2 (content model/migration) |
| **Status** | Designed. Policy documented. Migration execution deferred to P2. |

**Narrative:** Photographed dates and publication dates are different concepts. The frozen design separates them. Fabricating publication time from technical metadata produces false precision. The honest policy may result in clusters of identical import timestamps for historical content, which is preferable to invented chronology.

---

### RISK-004: Incomplete derivative coverage

| Field | Value |
|---|---|
| **Risk** | A published Gallery has Photos whose derivatives are missing from the asset manifest or the assembled release, producing broken images in production. |
| **Trigger** | Pipeline failure mid-build; interrupted derivation; manifest generation bug; partial upload. |
| **Impact** | High. Broken images in published content. User-facing defect. |
| **Likelihood** | Medium. Build processes can fail partially. |
| **Canonical mitigation** | Manifest closure check plus integrity gate before deployment switch. Every Photo in every published Gallery must have complete derivative entries in the manifest, and every referenced file must exist in the assembled release. The integrity gate blocks deployment if coverage is incomplete. See IMAGE_PIPELINE.md (manifest contract), BUILD_AND_ROUTING.md (integrity gate), DEPLOYMENT_ARCHITECTURE.md (pre-switch verification), TESTING_AND_VISUAL_REGRESSION.md section 4 (source/manifest closure tests). |
| **Owner phase** | P3 (image pipeline), P5 (build integration), P9 (deployment gate) |
| **Status** | Designed. Implementation deferred to P3/P5. |

**Narrative:** The build DAG requires manifest completeness before Astro consumes it and assembly completeness before deployment. Two gates catch this: build-time validation and pre-deployment integrity verification. Neither allows partial coverage to reach production.

---

### RISK-005: Stale redirect

| Field | Value |
|---|---|
| **Risk** | A redirect in `content/redirects.yaml` points to a Gallery or Place that no longer exists, has been unpublished, or creates a loop, producing broken navigation or infinite redirect chains. |
| **Trigger** | Gallery or Place deletion/unpublish without redirect cleanup; slug change without updating redirects; manual redirect editing errors. |
| **Impact** | Medium. Broken links from external sources or bookmarks. Poor user experience. Potential SEO harm. |
| **Likelihood** | Medium. Slugs change during curation. |
| **Canonical mitigation** | Redirect validation at build time: old path is historical only (not a current canonical route); exactly one target type per entry (`gallery_id` XOR `place_id`); target Gallery or Place exists and resolves to a public/published canonical route; no redirect loops; no route collisions. Build fails on invalid redirects. Delivery is a generated Nginx 301 redirect include with config test, conditional reload, post-switch redirect smoke, and coupled rollback. See BUILD_AND_ROUTING.md (redirect validation rules and delivery), DEPLOYMENT_ARCHITECTURE.md section 3.3 (config lifecycle), CONTENT_MODEL.md (redirect schema), SOURCE_OF_TRUTH_MATRIX.md (historical URLs owner). |
| **Owner phase** | P2 (content validation) |
| **Status** | Designed. Implementation deferred to P2. |

**Narrative:** Redirects store historical aliases only. They must never duplicate current slugs. Validation catches stale targets at build time, preventing broken redirects from reaching production. The single slug authority (Gallery YAML) prevents ambiguity about what the current route is.

---

### RISK-006: Draft leakage

| Field | Value |
|---|---|
| **Risk** | Draft Galleries appear in production output (public routes, Archive, Places, Home, sitemap) because the build does not enforce published-only filtering. |
| **Trigger** | Missing status check in build logic; template rendering draft content; sitemap including all Galleries regardless of status. |
| **Impact** | High. Unfinished/private content becomes publicly accessible. Editorial intent violated. |
| **Likelihood** | Medium. Easy to miss a filter in one code path. |
| **Canonical mitigation** | Production fail-closed published-only build. Only Galleries with `status: published` generate public routes, enter discovery pages, appear in sitemaps, or resolve as next_gallery targets. Draft Galleries are excluded at every output point. Local preview may include drafts. See CONTENT_MODEL.md (publication lifecycle), BUILD_AND_ROUTING.md (production build filter), SOURCE_OF_TRUTH_MATRIX.md (status owner). |
| **Owner phase** | P2 (content model), P5 (build/routing) |
| **Status** | Designed. Implementation deferred to P2/P5. |

**Narrative:** UD-009 establishes `status: draft | published` as the single publication-state mechanism. No directory partition (`drafts/`, `published/`) or filename prefix (`_draft-*`). The build enforces this at every output point. Testing validates draft exclusion as part of content/schema validation.

---

### RISK-007: CJK subset missing glyph

| Field | Value |
|---|---|
| **Risk** | A CJK character used in Gallery titles, Place names, or captions is absent from the statically subsetted CJK font, falling back to a system font with different metrics and visual style. |
| **Trigger** | Adding new content with characters outside the subsetted corpus; subsetting corpus too narrow. |
| **Impact** | Medium. Visual inconsistency in typography. Frozen G1 type decisions compromised. |
| **Likelihood** | Medium. CJK character space is large; common subsets may miss rare characters. |
| **Canonical mitigation** | Coverage validation against authored content at build time (scan all CJK characters in YAML and compare against subset). System fallback stack configured per FINAL_DESIGN_SPECIFICATION.md section 2.2 (platform serif/sans fallback ending in Songti SC/equivalent). Benchmark CJK subsetting strategy before freeze. See PERFORMANCE_BUDGET.md (CJK strategy), FINAL_DESIGN_SPECIFICATION.md section 2.2 (frozen font families and fallbacks). |
| **Owner phase** | P1 (font setup), P4 (CJK content testing) |
| **Status** | Designed. Subsetting implementation deferred to benchmark. |

**Narrative:** Frozen families are Source Serif 4, Source Sans 3, Noto Serif SC, Noto Sans SC. No FreeBuffCJK or generic Noto Sans CJK. The subsetting approach (static broad subset vs build-derived subset with safe fallback) is a benchmark decision. Build-time coverage validation catches gaps before deployment. System fallback ensures content remains readable even when glyphs are missing from the web font.

---

### RISK-008: Backup failure

| Field | Value |
|---|---|
| **Risk** | Backups appear successful but are corrupted, incomplete, or untested, and recovery fails when actually needed. |
| **Trigger** | Silent backup script errors; encryption key loss; storage quota exceeded; network interruption during backup; never running a restore drill. |
| **Impact** | Critical. Combined with ingest-master loss (RISK-002), this means permanent data loss. |
| **Likelihood** | Medium. Untested backups are a well-known failure mode. |
| **Canonical mitigation** | Backup verification (checksum/integrity check after each backup run) plus scheduled restore drills (at minimum quarterly). Restore drills demonstrate full recovery within RPO/RTO targets. Documented results. See BACKUP_AND_RECOVERY.md (backup verification, restore drill schedule, RPO/RTO targets), TESTING_AND_VISUAL_REGRESSION.md section 10 (backup restore drill category). |
| **Owner phase** | P9 (deployment/recovery), ongoing |
| **Status** | Designed. Drill execution deferred to P9. |

**Narrative:** Backups without verification and restore drills are aspirational, not operational. The architecture requires both automated verification and periodic human-supervised restore drills. Drills are first-class test events, not optional housekeeping.

---

### RISK-009: High-DPR image quality degradation

| Field | Value |
|---|---|
| **Risk** | Aggressive compression or insufficient derivative widths produce visibly degraded images on high-DPR displays, undermining the photography-first product identity. |
| **Trigger** | Applying arbitrary byte budgets without measuring visual impact; choosing derivative widths too small for high-DPR viewports; encoder quality settings optimized for size over fidelity. |
| **Impact** | High. Photography is the primary content layer. Visible compression artifacts or softness directly violate the viewing hierarchy (FINAL_DESIGN_SPECIFICATION.md section 1.2). |
| **Likelihood** | Medium. Performance pressure often leads to quality trade-offs. |
| **Canonical mitigation** | Benchmark before freeze. Image quality must not be sacrificed to arbitrary byte limits. Derivative widths, encoder quality, and DPR scaling are ENGINEERING BENCHMARK REQUIRED items measured against real photography fixtures before values are frozen. See PERFORMANCE_BUDGET.md (benchmark-required classification), IMAGE_PIPELINE.md (quality/width contracts), OPEN_QUESTIONS.md (open benchmark items). |
| **Owner phase** | P3 (image pipeline benchmarks) |
| **Status** | Designed. Benchmark execution deferred to P3. |

**Narrative:** The product is a photographic archive. Performance budgets serve the viewing experience, not the reverse. Width steps and quality values remain open until measured. The architecture explicitly classifies these as benchmark-required, not pre-frozen constants.

---

### RISK-010: Manifest/assembly mismatch

| Field | Value |
|---|---|
| **Risk** | The asset manifest references derivatives that do not exist in the assembled release, or the release contains derivatives not represented in the manifest, causing broken images or inconsistent cache behavior. |
| **Trigger** | Partial pipeline failure; race condition between manifest generation and derivative output; post-manifest mutation of derivative directory; incorrect path prefixes in manifest entries. |
| **Impact** | High. Broken images or stale references in production. |
| **Likelihood** | Medium. Multi-stage build pipelines are susceptible to ordering bugs. |
| **Canonical mitigation** | Integrity gate verifies manifest closure against assembled release before deployment candidate is accepted. Candidate verification checks that every manifest entry has a physical file and every HTML-referenced asset exists. See BUILD_AND_ROUTING.md (integrity gate), DEPLOYMENT_ARCHITECTURE.md (candidate verification), TESTING_AND_VISUAL_REGRESSION.md sections 4 and 11 (closure tests). |
| **Owner phase** | P3 (pipeline), P5 (build integration), P9 (deployment gate) |
| **Status** | Designed. Implementation deferred to P3/P5. |

**Narrative:** The build DAG enforces strict ordering: pipeline produces manifest, Astro consumes manifest, assembly combines outputs, integrity gate verifies closure. No step mutates another step's output. The integrity gate is the last defense before deployment.

---

### RISK-011: Incorrect cache headers

| Field | Value |
|---|---|
| **Risk** | HTML receives long-lived immutable cache headers, causing browsers to serve stale content after deployments. Or hashed assets receive short cache headers, wasting bandwidth. |
| **Trigger** | Blanket cache policy applied without distinguishing content types; misconfigured Nginx cache directives; copying CDN-oriented cache rules to a self-hosted static server. |
| **Impact** | Medium-High. Users see stale content after updates (HTML cached too long) or unnecessary bandwidth consumption (assets re-downloaded). |
| **Likelihood** | Medium. Cache misconfiguration is common in static deployments. |
| **Canonical mitigation** | Differentiated cache policy: hashed-immutable assets receive long cache with immutable flag; HTML receives short/no-cache/revalidate policy appropriate for static content updates; redirects and 404 pages receive appropriate non-immutable policy. See DEPLOYMENT_ARCHITECTURE.md (cache policy section), TECHNICAL_API_VERIFICATION.md section 3 (Nginx contract). |
| **Owner phase** | P9 (deployment configuration) |
| **Status** | Designed. Nginx configuration deferred to P9. |

**Narrative:** Static sites have two distinct caching classes: content-addressed assets (safe to cache forever because filename changes when content changes) and HTML (must revalidate because routes are stable but content changes). Applying one policy to both is always wrong.

---

## 3. Deferred engineering benchmark risks

These risks are acknowledged but cannot be fully mitigated until implementation benchmarks are executed. They are tracked in OPEN_QUESTIONS.md and resolved during the indicated phases.

| Risk | Phase | Dependency |
|---|---|---|
| Responsive derivative width steps not yet measured | P3 | Real photography fixture benchmark |
| Encoder quality/compression not yet benchmarked | P3 | Sharp/libvips comparison |
| ICC embedding policy not yet decided | P3 | Visual quality assessment |
| CJK subset character corpus not yet finalized | P1/P4 | Content corpus analysis |
| Backup provider/tool not yet selected | P9 | Cost/accessibility evaluation |
| High-DPR scaling factor not yet measured | P3 | Device/display benchmark |

---

## 4. Resolved risks (historical)

These risks were raised during earlier architecture exploration and have been resolved by canonical decisions. They are retained for audit traceability.

| ID | Risk | Resolution | Decision |
|---|---|---|---|
| HIST-001 | Database needed for scalability | Rejected. File-first YAML sufficient for personal archive scale. | ARCHITECTURE_DECISIONS.md |
| HIST-002 | CMS admin interface mandatory | Rejected. File-first authoring preferred. Admin may be added later if needed. | ARCHITECTURE_DECISIONS.md |
| HIST-003 | CDN platform lock-in unavoidable | Mitigated. Self-hosted Nginx with atomic deployment provides zero vendor lock-in. | DEPLOYMENT_ARCHITECTURE.md |
| HIST-004 | Git/LFS required as photographic archive | Rejected. UD-005 establishes media ownership outside Git. Git tracks code/YAML/settings/tests/docs only. | SOURCE_OF_TRUTH_MATRIX.md |
| HIST-005 | next_gallery cycles must be prevented | Rejected. UD-007 allows cycles. Validation requires target exists, published, not-self. No acyclicity test. | CONTENT_MODEL.md |
| HIST-006 | Generated photo-identities.json as identity authority | Rejected. UD-001 places Photo identity in Gallery YAML. Generated state is derived view only. | SOURCE_OF_TRUTH_MATRIX.md |

---

## 5. Risk review cadence

- **Per phase gate:** All active risks reviewed for status changes.
- **Post-incident:** New risks logged from root cause analysis.
- **Quarterly:** Full register review; probability/impact reassessment.
- **Pre-deployment:** Deployment smoke and backup risks verified.

---

## 6. Risk acceptance criteria

A risk may be accepted without further mitigation when:

1. Likelihood times impact is low enough that mitigation cost exceeds potential loss.
2. The risk is outside project control (e.g., browser vendor changes).
3. Stakeholder explicitly accepts and documents the residual risk.
4. Canonical architecture already addresses the risk through existing controls.

Accepted risks remain in the register with explicit acceptance rationale.

---

**END OF RISK REGISTER**
