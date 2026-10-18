# Architecture Review Packet -- Quiet Editorial Archive

**Status:** CANONICAL -- supports Focused Independent Re-Review
**Revision date:** 2026-08-28
**Gate context:** Prior Gate C (Material Architecture Revision Required). Canonical rewrite performed per user-issued rewrite brief. This packet summarizes ONLY the rewritten canonical architecture for the upcoming Focused Independent Re-Review.

---

## 1. Scope and authority

This packet summarizes the rewritten canonical production architecture. The reviewer must NOT need to inspect PREVIOUS_CORRECTIONS. That folder is superseded historical evidence only; it is NOT required reading and NOT an implementation authority.

The authoritative document set is:

```
research/production-architecture/
  CANONICAL_REWRITE_TRACEABILITY.md    -- finding-by-finding resolution evidence
  SOURCE_OF_TRUTH_MATRIX.md            -- canonical ownership per concept
  TECHNICAL_API_VERIFICATION.md        -- verified external API facts
  CONTENT_MODEL.md                     -- Gallery/Photo/Place/Home/Redirect schemas
  IMAGE_PIPELINE.md                    -- derivation, manifest, ICC, privacy, determinism
  BUILD_AND_ROUTING.md                 -- build DAG, Astro config, routes, redirects
  DEPLOYMENT_ARCHITECTURE.md           -- atomic release flow, cache, Nginx
  BACKUP_AND_RECOVERY.md               -- RPO/RTO, recovery scenarios
  ARCHITECTURE_DECISIONS.md            -- ADRs including migration mapping
  OPEN_QUESTIONS.md                    -- closed decisions + remaining open items
  RUNTIME_AND_PROGRESSIVE_ENHANCEMENT.md -- JS inventory, frozen compliance
  PERFORMANCE_BUDGET.md                -- budget classification, CJK, benchmarks
  TESTING_AND_VISUAL_REGRESSION.md     -- test categories, visual regression governance
  REPOSITORY_STRUCTURE.md              -- directory tree, ownership, git boundaries
  RISK_REGISTER.md                     -- active risks with canonical mitigations
  IMPLEMENTATION_PHASES.md             -- phase ordering and entry/exit criteria
```

---

## 2. Reviewer reading order

Per the rewrite brief section 58, the recommended reading order for the Focused Independent Re-Review is:

1. `research/FINAL_DESIGN_SPECIFICATION.md` -- frozen product authority
2. This document (`ARCHITECTURE_REVIEW_PACKET.md`) -- architecture summary
3. `SOURCE_OF_TRUTH_MATRIX.md` -- ownership per concept
4. `CONTENT_MODEL.md` -- data model, schemas, validation
5. `IMAGE_PIPELINE.md` -- derivation contract, manifest, determinism
6. `BUILD_AND_ROUTING.md` -- build DAG, Astro content architecture, routing
7. `DEPLOYMENT_ARCHITECTURE.md` + `BACKUP_AND_RECOVERY.md` -- deployment and recovery
8. `ARCHITECTURE_DECISIONS.md` + `OPEN_QUESTIONS.md` -- decisions and remaining open items

Then consult the remaining canonical documents as needed:

- `RUNTIME_AND_PROGRESSIVE_ENHANCEMENT.md` -- frozen design compliance, no-JS contracts
- `PERFORMANCE_BUDGET.md` -- budget classification, CJK strategy
- `TESTING_AND_VISUAL_REGRESSION.md` -- test architecture
- `REPOSITORY_STRUCTURE.md` -- directory layout
- `RISK_REGISTER.md` -- risk catalog
- `IMPLEMENTATION_PHASES.md` -- phase ordering
- `TECHNICAL_API_VERIFICATION.md` -- verified framework/tool APIs
- `CANONICAL_REWRITE_TRACEABILITY.md` -- finding-by-finding evidence

---

## 3. Architecture direction summary

The high-level production direction remains valid and unchanged:

> Astro static generation + file-first YAML + deterministic local image pipeline + minimal progressive-enhancement JS + static deployment to self-hosted Nginx.

The canonical rewrite corrected internal inconsistencies in persistence, authority, data flow, API validity, product drift, and operational closure. It did not change the framework, database decision, or deployment platform.

---

## 4. Adopted user decisions (UD-001 through UD-011)

All 11 user decisions are now authoritative and integrated into the canonical documents. They are not reopenable during this review.

| UD | Decision | Summary |
|---|---|---|
| UD-001 | Photo identity representation | Identity and source binding live persistently in Gallery authored YAML (`photos[].id` + `photos[].source_ref`). No separate global registry. Generated state is derived view only. |
| UD-002 | Corrected master identity semantics | Photo identity is editorial identity. Corrected/re-exported masters retain same Photo ID. New ID only for distinct authored photographs. SHA-256 is integrity metadata, not identity. |
| UD-003 | Publication-time migration | Never derive published_at from EXIF, photographed date, mtime, Git timestamp, or folder name. Use author-supplied historical time or honest archive-import timestamp. Unknown remains unknown. |
| UD-004 | Featured state storage | Single Home editorial settings file `content/site/home.yaml` with `featured_gallery_id`. No per-Gallery featured field. No weekly rotation, is_curated, or curated states. Deterministic fallback to latest published. |
| UD-005 | Media ownership baseline | WEB INGEST MASTERS outside Git baseline at `media/ingest-masters/`. Four media classes defined precisely. Git tracks code/YAML/settings/redirects/tests/docs only. Off-site encrypted backup for ingest masters. |
| UD-006 | Backup RPO/RTO | RPO <= 24 hours, RTO <= 24 hours. Encrypted off-site backup for non-regenerable state. Regenerable state not backed up. Restore drill required before production launch. |
| UD-007 | next_gallery cycle policy | Cycles explicitly allowed. Validation: target exists, published in production, not self, dangling forbidden. No acyclicity test. |
| UD-008 | Slug authority and redirects | Gallery YAML is sole current-slug authority. Historical Gallery/Place aliases in `content/redirects.yaml` only (`gallery_id` XOR `place_id`; targets resolve to published canonical routes). No second slug registry. Build generates the Nginx 301 redirect include with test/reload/rollback lifecycle. |
| UD-009 | Draft authority model | Exactly one mechanism: `status: draft` or `status: published` in Gallery YAML. No directory partition or prefix conventions. Production fail-closed. |
| UD-010 | Cover policy | Explicit `cover_photo_id` required for published status. Must reference Photo in same Gallery. No silent first-Photo default. |
| UD-011 | No authored prev_gallery | Not authored. Derive reverse relationships at build time if needed. Frozen product does not require Previous Gallery at continuation. |

Full traceability: CANONICAL_REWRITE_TRACEABILITY.md.

---

## 5. Rewritten architecture summary

### 5.1 Identity model

Photo identity and source binding are persistent authored state in Gallery YAML. Each Photo item carries `id` (globally unique, stable) and `source_ref` (relative to `media/ingest-masters/`). Rename/move updates `source_ref` without changing `id`. Dimensions, orientation, EXIF, ICC, hashes, and derivatives are generated state. No generated file is the primary identity authority. One Photo belongs to one Gallery in MVP.

### 5.2 Content boundary

Single authored source at `content/galleries/{gallery}/meta.yaml`. Astro loads directly via Content Layer glob loader (`base: './content/galleries'`). No `src/content/galleries/` mirror. Place definitions at `content/places/{place}.yaml` — one Place object per file, loaded with the same glob loader and a singular Place schema. Home settings at `content/site/home.yaml`. Redirects at `content/redirects.yaml`. All authored content is Git-tracked.

### 5.3 Publication time and Home selection

`published_at` is durable authored state, never derived from technical metadata. Latest/Recent ordering uses publication/addition semantics. Home hero resolves from `featured_gallery_id` in Home settings, falling back to latest published by `published_at` DESC with stable Gallery ID tie-break. No curated/weekly/scheduled semantics.

### 5.4 Media and backup

Four canonical media classes: CAMERA ORIGINAL, ARCHIVAL MASTER, WEB INGEST MASTER, WEB DERIVATIVE. Single ingest root: `media/ingest-masters/`. WEB INGEST MASTERS are non-regenerable and require independent off-site encrypted backup. Git is not the photographic archive. RPO/RTO <= 24 hours. Restore drill required.

### 5.5 Build DAG

Producer-before-consumer sequence:

```
AUTHORED PERSISTENT STATE -> REFERENCE/SOURCE VALIDATION
  -> IMAGE ANALYSIS/DERIVATION (outputs to generated/media/)
  -> GENERATED ASSET MANIFEST (generated/asset-manifest.json)
  -> ASTRO BUILD (consumes manifest at build time)
  -> ISOLATED FINAL RELEASE ASSEMBLY
  -> INTEGRITY GATE -> UPLOAD -> PRE-SWITCH VERIFY
  -> ATOMIC POINTER SWITCH -> POST-SWITCH SMOKE
  -> ROLLBACK EXACT PREVIOUS TARGET ON FAILURE
```

Astro never needs a manifest that does not yet exist. dist/ has one owner: the Astro/assembly step. Image derivation does not mutate Astro's build directory.

### 5.6 Deployment

Immutable release directories with atomic symlink pointer via rename(). Exact previous target captured before switch. Post-switch HTTP smoke checks actual release content. Rollback restores exact captured previous target. Static 404 behavior (no SPA fallback). Cache policy differentiates hashed immutable assets from HTML (short/no-cache/revalidate). Nginx reload only on configuration change. Deployment serialization lock prevents concurrent switches.

### 5.7 Runtime and performance

Core content accessible without JS. Captions always visible when authored (no hover reveal, no line clamp, no reserved empty block). Continuation is editorial text links (no styled button). Mobile navigation has accessible no-JS fallback. Focus outline 2px solid #0B57D0 with 3px offset. Performance budgets classified into four tiers: STANDARD WEB TARGET, PROJECT ENGINEERING BUDGET, BENCHMARK REQUIRED, MEASURED BASELINE. No unmeasured value enforced as CI gate.

### 5.8 Frozen font families

Source Serif 4, Source Sans 3, Noto Serif SC, Noto Sans SC. No additions. CJK subsetting strategy (broad static vs build-derived) deferred to benchmark. System CJK fallback required. Coverage validation against authored content at build time.

---

## 6. Targeted re-review criteria

### 6.1 Corrections Required Before Implementation Plan (from targeted re-review)

The targeted re-review listed 13 corrections required before an Implementation Plan can begin. The rewrite must satisfy each:

| # | Correction required | Where satisfied in canonical architecture |
|---|---|---|
| 1 | Resolve user decisions that change schema/storage/identity | All 11 UD decisions adopted and integrated. See section 4 above and CANONICAL_REWRITE_TRACEABILITY.md. |
| 2 | Rewrite (not append to) canonical documents affected by decisions | All 16 canonical documents rewritten. No "Correction:" appendices. Documents read as coherent replacements. |
| 3 | Publish canonical source-of-truth matrix with one owner per field/path | SOURCE_OF_TRUTH_MATRIX.md defines exactly one owner per persistent concept, with Git/backup/regenerable/validation columns. |
| 4 | Replace corrected DAG with producer-before-consumer graph | BUILD_AND_ROUTING.md section 1 defines the canonical build DAG. ADR-026 records it. Manifest produced before Astro consumes it. |
| 5 | Use current official Astro Content Layer syntax in src/content.config.ts | BUILD_AND_ROUTING.md section 3 and TECHNICAL_API_VERIFICATION.md section 1 use verified `defineCollection` + `glob` loader syntax. Legacy APIs removed. |
| 6 | Remove all FreeBuff and unapproved product concepts | All contamination removed. Frozen routes, fonts, rhythm values, and editorial semantics preserved. Contamination terms appear only in CANONICAL_REWRITE_TRACEABILITY.md as rejected history. |
| 7 | Remove EXIF-to-published_at migration | CONTENT_MODEL.md section 7 and ADR-027 prohibit deriving published_at from any automated source. Honest archive-import timestamp policy. |
| 8 | Correct media category definitions and source_ref | SOURCE_OF_TRUTH_MATRIX.md section 1 defines four media classes. Single root `media/ingest-masters/`. source_ref relative to that root. |
| 9 | Replace unverified API examples or label as pseudocode | TECHNICAL_API_VERIFICATION.md documents verified APIs. All canonical examples either use verified method names or are labeled PSEUDOCODE / CONTRACT EXAMPLE. Invented APIs explicitly forbidden. |
| 10 | Define published/draft/featured/cover/next/prev/redirect lifecycle | CONTENT_MODEL.md sections 7-11 define all lifecycle rules. Fail-closed validation for published builds. |
| 11 | Preserve frozen routes, rhythm, captions, continuation, fonts, and no-JS navigation | RUNTIME_AND_PROGRESSIVE_ENHANCEMENT.md preserves all frozen contracts. Prohibited patterns explicitly listed. |
| 12 | Reclassify correction summaries from COMPLETE to PROPOSED | PREVIOUS_CORRECTIONS marked SUPERSEDED with README explaining historical role. No completion claims treated as authoritative. |
| 13 | Archive or mark PREVIOUS_CORRECTIONS superseded after integration | PREVIOUS_CORRECTIONS/README.md marks all contents as superseded. Accepted content integrated into canonical documents. Rejected content recorded in traceability. |

### 6.2 Completion-audit checklist (brief section 59)

Before claiming the rewrite is complete, verify each item against the canonical documents:

| Audit item | Requirement | Where verified |
|---|---|---|
| Identity | No generated identity authority remains | SOURCE_OF_TRUTH_MATRIX.md sections 4 and 6; CONTENT_MODEL.md section 5; REPOSITORY_STRUCTURE.md section 1 |
| Content | One authored Gallery source | BUILD_AND_ROUTING.md section 3; REPOSITORY_STRUCTURE.md section 1 |
| Slug | One current slug authority | CONTENT_MODEL.md section 11.3; SOURCE_OF_TRUTH_MATRIX.md section 6 |
| Draft | Only status model | CONTENT_MODEL.md section 8; BUILD_AND_ROUTING.md section 6; SOURCE_OF_TRUTH_MATRIX.md section 6 |
| Featured | Only Home settings | CONTENT_MODEL.md section 10; SOURCE_OF_TRUTH_MATRIX.md section 2 |
| Cover | Explicit for published | CONTENT_MODEL.md sections 8.4 and 13 |
| next | ID-based, dangling/self validation, cycles allowed | CONTENT_MODEL.md section 9; ARCHITECTURE_DECISIONS.md ADR-023 |
| prev | Not authored | CONTENT_MODEL.md sections 4.3 and 9.4; ARCHITECTURE_DECISIONS.md ADR-024 |
| Build DAG | Manifest exists before Astro consumes it | BUILD_AND_ROUTING.md section 1; IMAGE_PIPELINE.md section 13; ADR-026 |
| Media | One WEB INGEST MASTER root | SOURCE_OF_TRUTH_MATRIX.md section 1; IMAGE_PIPELINE.md section 3; REPOSITORY_STRUCTURE.md section 4 |
| Git | Masters not required in Git/LFS | SOURCE_OF_TRUTH_MATRIX.md section 3; BACKUP_AND_RECOVERY.md section 5; ADR-018 |
| Backup | RPO/RTO represented | BACKUP_AND_RECOVERY.md sections 1-2; ADR-025 |
| Runtime | No caption/continuation design drift | RUNTIME_AND_PROGRESSIVE_ENHANCEMENT.md sections 3-4 |
| Fonts | Exact frozen families | PERFORMANCE_BUDGET.md section 7.1; TECHNICAL_API_VERIFICATION.md section 4 |
| Routes | /galleries/{slug} | CONTENT_MODEL.md section 12; BUILD_AND_ROUTING.md section 4 |
| Cache | HTML not immutable-long-term | DEPLOYMENT_ARCHITECTURE.md section 6.2 |
| Deployment | Previous target captured before switch | DEPLOYMENT_ARCHITECTURE.md section 3.1 steps 5-8; ADR-006 |
| API | No fictional current API presented as executable | TECHNICAL_API_VERIFICATION.md entire document; all examples labeled |

---

## 7. Deferred engineering benchmarks

The following items are intentionally not frozen in the canonical architecture. They require measurement against real photography fixtures or implementation evidence. Tracked in OPEN_QUESTIONS.md.

| Item | Owner phase | Notes |
|---|---|---|
| Responsive image width steps | P3 | Benchmark harness with F01-F10 fixtures |
| Encoder, format, quality choice | P3 | JPEG/WebP/AVIF comparison |
| ICC no-profile enforcement policy | P3/P7 | MVP assumes sRGB; fail/warn policy deferred |
| Alt text publication enforcement | P7 | Schema support exists; policy decision before accessibility hardening |
| CJK subsetting implementation | P1/P4 | Broad static vs build-derived subset |
| Backup provider/tool selection | P9 | Encrypted off-site required; vendor TBD |
| Output ICC embedding | P3 | Whether to embed sRGB ICC in public derivatives |
| High-DPR scaling strategy | P3 | Whether to generate additional 2x/3x derivatives |
| Exact digest length for asset hashing | P3 | Sufficiently collision-resistant; no six-hex freeze |

These deferrals do not block the Focused Independent Re-Review. They are resolved during named implementation phases.

---

## 8. Traceability evidence

For finding-by-finding proof that every red-team finding, targeted re-review finding, and user decision landed in the canonical documents, see:

`CANONICAL_REWRITE_TRACEABILITY.md`

That document covers: UD-001 through UD-011; RT-001 through RT-019; RT-M01 through RT-M10; H1 through H6; TRR-001 through TRR-004; TRR-I01 through TRR-I09. Each entry names the specific canonical document(s) containing the resolution and uses precise status labels (RESOLVED / DEFERRED TO PHASE / NOT APPLICABLE).

---

## 9. Note on PREVIOUS_CORRECTIONS

PREVIOUS_CORRECTIONS is superseded historical evidence only. It is NOT required reading for this review. It is NOT an implementation authority. Its accepted content has been integrated into the rewritten canonical documents. Its rejected content is recorded in CANONICAL_REWRITE_TRACEABILITY.md.

Do not inspect PREVIOUS_CORRECTIONS to understand the current architecture. Read the canonical documents listed in section 1.

---

**END OF ARCHITECTURE REVIEW PACKET**
