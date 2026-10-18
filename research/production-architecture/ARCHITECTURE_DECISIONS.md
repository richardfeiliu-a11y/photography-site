# Architecture Decision Records -- Quiet Editorial Archive

**Status:** CANONICAL -- engineering authority
**Revision date:** 2026-08-28
**Companion documents:** SOURCE_OF_TRUTH_MATRIX.md, TECHNICAL_API_VERIFICATION.md, CONTENT_MODEL.md, BUILD_AND_ROUTING.md, IMAGE_PIPELINE.md, DEPLOYMENT_ARCHITECTURE.md, BACKUP_AND_RECOVERY.md

---

## ADR Migration Mapping

This table records every change from the pre-rewrite ADR set to this canonical version. ADRs not listed here survived unchanged (subject to typo corrections only).

| Old ADR | Old status | New status | Replacement / revision | Reason |
|---|---|---|---|---|
| ADR-001 (Astro 6+) | ADOPTED | SUPERSEDED | ADR-001 (revised) | Version range was vague; sample used removed legacy API; current stable major is Astro 7. Revised ADR pins exact version at P1. |
| ADR-002 (Content Storage split) | ADOPTED | SUPERSEDED | ADR-002 (revised) + ADR-018 | Original conflated Git/LFS baseline for media with content storage separation. UD-005 establishes media ownership outside Git baseline. Revised ADR-002 retains the authored/generated/built separation principle without Git/LFS-as-baseline. |
| ADR-003 (Photo Identity Layer) | ADOUGHTED (typo) | SUPERSEDED | ADR-017 | Generated photo-identities.json was never a valid identity authority. UD-001 places Photo identity in Gallery YAML. Status typo corrected by replacement. |
| ADR-009 (Next Gallery cycle detection) | ADOPTED | SUPERSEDED | ADR-009 (revised) | Cycle rejection has no product basis. UD-007 allows cycles. Validation requires target exists, published, and not self. |
| ADR-014 (Full Builds) | ADOPTED (date typo 2006-08-28) | ADOPTED | Date corrected to 2026-08-28 | No substance change; date typo fixed. |
| ADR-016 (Alt Text Deferred) | DEFERRED | ADOPTED | ADR-016 (revised) | Schema field adopted; publication enforcement policy remains deferred. Filename fallback rejected. |
| -- | -- | ADOPTED | ADR-017 (new) | UD-001: Photo identity in Gallery YAML |
| -- | -- | ADOPTED | ADR-018 (new) | UD-005: Media ownership outside Git baseline |
| -- | -- | ADOPTED | ADR-019 (new) | UD-004: Home editorial settings file |
| -- | -- | ADOPTED | ADR-020 (new) | UD-009: Status-based draft model |
| -- | -- | ADOPTED | ADR-021 (new) | UD-010: Explicit published cover |
| -- | -- | ADOPTED | ADR-022 (new) | UD-008: Redirects historical-only |
| -- | -- | ADOPTED | ADR-023 (new) | UD-007: Cycles allowed in next_gallery |
| -- | -- | ADOPTED | ADR-024 (new) | UD-011: No authored prev_gallery |
| -- | -- | ADOPTED | ADR-025 (new) | UD-006: RPO/RTO backup target |
| -- | -- | ADOPTED | ADR-026 (new) | Corrected build DAG with manifest-before-Astro |
| -- | -- | ADOPTED | ADR-027 (new) | UD-003: Publication-time integrity |
| -- | -- | ADOPTED | ADR-028 (new) | UD-002: Corrected-master identity semantics |

---

## Adopted Decisions

### ADR-001 -- Astro Static Generation with Content Layer

- **Date:** 2026-08-28 (revised)
- **Status:** ADOPTED
- **Context:** The archive requires zero-JS static HTML output, typed content schemas, fast builds, and simple Nginx deployment. The previous ADR specified "Astro 6+" with a legacy `type: 'data'` collection example that the current Astro Content Layer removed. Official documentation at verification time covers Astro 7.
- **Decision:** Adopt Astro as the static generation framework using the current Content Layer (`src/content.config.ts`, `defineCollection`, `glob` loader). Pin the exact stable major version and Node engine in `package.json`/lockfile during P1. Load authored YAML directly from `content/galleries/` via the glob loader; do not mirror content into `src/content/`.
- **Consequences:** Framework lock-in to Astro's Content Layer contract. No server runtime required. Pure HTML/CSS/JS output. Exact version pin prevents silent drift across majors.

### ADR-002 -- Authored/Generated/Built Separation

- **Date:** 2026-08-28 (revised)
- **Status:** ADOPTED
- **Context:** The original ADR correctly separated authored metadata, generated state, and built output, but tied media ownership to Git/LFS as baseline. UD-005 decouples WEB INGEST MASTERS from Git.
- **Decision:** Maintain strict separation of authored persistent state (Git-tracked YAML, settings, redirects), generated state (derivatives, manifest -- regenerable), and build output (dist/, release directories -- regenerable). WEB INGEST MASTERS live at `media/ingest-masters/` and are backed up off-site independently of Git. Git tracks source code, authored YAML, site settings, redirects, tests, and architecture docs. Git LFS may be discussed as an optional later transport choice, never the canonical baseline.
- **Consequences:** Clear ownership boundaries per SOURCE_OF_TRUTH_MATRIX.md. Backup strategy must cover ingest masters separately. Git repository size remains manageable regardless of media volume.

### ADR-003 -- SUPERSEDED

- **Previous title:** Photo Identity Layer: photo.id !== filename
- **Previous status:** ADOUGHTED (typo for ADOPTED)
- **Superseded by:** ADR-017
- **Reason:** Generated photo-identities.json cannot serve as the persistent identity authority. UD-001 places Photo identity directly in Gallery YAML with authored `id` and `source_ref`.

### ADR-004 -- Captions and Rhythms Bound to Photo IDs

- **Date:** 2026-08-28
- **Status:** ADOPTED
- **Context:** Array-index-bound metadata corrupts on reorder. Photo ID provides stable binding.
- **Decision:** Caption and rhythm_after are properties of each Photo item in `photos[]`, keyed by the Photo's authored `id`. Reordering photos preserves their metadata without separate maps.
- **Consequences:** Robust authoring workflow. Sequence changes require only reordering the array; no external map synchronization.

### ADR-005 -- Deterministic Local Image Pipeline

- **Date:** 2026-08-28
- **Status:** ADOPTED
- **Context:** Color management, privacy stripping, responsive derivation, and manifest production require a dedicated pipeline boundary separate from page rendering.
- **Decision:** Maintain a standalone deterministic image pipeline that reads WEB INGEST MASTERS, produces derivatives into `generated/media/`, and writes `generated/asset-manifest.json` before Astro consumes it. Semantic determinism is required: same source bytes, authored metadata, toolchain versions, and pipeline configuration produce the same logical derivative set. Byte-for-byte determinism is guaranteed only within a pinned build toolchain/environment.
- **Consequences:** Clean separation of concerns. Benchmark-required values (widths, quality, encoder) isolated in P3. Manifest must exist before Astro build (see ADR-026).

### ADR-006 -- Atomic Release-Directory Deployment

- **Date:** 2026-08-28
- **Status:** ADOPTED
- **Context:** Zero-downtime deployment with instant rollback requires atomic pointer switching.
- **Decision:** Deploy complete release candidates to unique release directories. Before switching, capture the exact current symlink target. Create a temporary symlink on the same filesystem and atomically rename it over `current`. Run post-switch HTTP smoke checks. On failure, restore the exact captured previous target. Do not reload Nginx solely for a symlink target change.
- **Consequences:** Rollback restores the exact prior release, not a best-guess. Deployment serialization prevents concurrent switches. Releases are rollback cache, not backup.

### ADR-007 -- Photographed Dates Canonical for Chronology

- **Date:** 2026-08-28
- **Status:** ADOPTED
- **Context:** Archive chronology uses photographed dates, not publication dates. These are distinct concepts.
- **Decision:** `photographed_start` and `photographed_end` in Gallery YAML are the canonical temporal data for archive year-grouping and chronological display. Display labels derive from these values. `published_at` is a separate field governing Latest/Recent ordering and sitemap. Never derive `published_at` from photographed dates.
- **Consequences:** Chronological ordering is stable. Publication ordering is independent. See also ADR-027.

### ADR-008 -- Ingest Formats Defined Separately from Archival Storage

- **Date:** 2026-08-28
- **Status:** ADOPTED
- **Context:** Camera originals, archival masters, and web ingest masters have different provenance and replacement semantics.
- **Decision:** Define four canonical media classes: CAMERA ORIGINAL, ARCHIVAL MASTER, WEB INGEST MASTER, WEB DERIVATIVE (see SOURCE_OF_TRUTH_MATRIX.md section 1). Supported ingest format for the website pipeline is JPEG. Archival storage retains whatever formats the photographer workflow requires. Do not conflate these classes.
- **Consequences:** Honest deliverables. Format additions to the pipeline do not affect archival policy. Terminology is consistent across all architecture documents.

### ADR-009 -- Next Gallery Authored by Gallery ID (Cycles Allowed)

- **Date:** 2026-08-28 (revised)
- **Status:** ADOPTED
- **Context:** The previous ADR required cycle detection with no product basis. UD-007 explicitly allows cycles such as A -> B -> C -> A as valid authored continuation structures.
- **Decision:** `next_gallery_id` references a stable Gallery ID (not slug). Validation rules: target Gallery exists; target is published in production; target != self; dangling target forbidden. Do not require graph acyclicity. Do not implement cycle-detection complexity.
- **Consequences:** Simpler validation. Editorial freedom for continuation loops. Self-loops and dangling references still caught at build time.

### ADR-010 -- Responsive Widths and Quality Values Require Engineering Benchmark

- **Date:** 2026-08-28
- **Status:** ADOPTED
- **Context:** Arbitrary byte budgets or width steps risk over-compression or under-delivery. Real fixture measurement is required.
- **Decision:** Mark all responsive width breakpoints, encoder quality values, and high-DPR strategy as ENGINEERING BENCHMARK REQUIRED. Benchmark harness begins in P1/P2; fixture corpus and measurements execute in P3. Values are frozen only after evidence.
- **Consequences:** No premature optimization. Image quality is not sacrificed to unmeasured byte limits.

### ADR-011 -- Color Management: Source ICC to sRGB Conversion

- **Date:** 2026-08-28
- **Status:** ADOPTED
- **Context:** Web color fidelity requires explicit color-space handling. Untagged sources need a documented policy.
- **Decision:** If a valid source ICC profile exists, respect it and convert to sRGB. If no ICC profile exists, treat as an explicit policy limitation documented as assume-sRGB for MVP. Future implementation may support explicit override or fail policy. Do not use camera-model guessing. Output ICC embedding is a benchmark decision (P3). Use verified Sharp API methods only (see TECHNICAL_API_VERIFICATION.md).
- **Consequences:** Color fidelity preserved for tagged sources. MVP ships with documented sRGB assumption for untagged inputs. Policy upgrade path exists without schema migration.

### ADR-012 -- Privacy-Sensitive Metadata Stripped from Public Derivatives

- **Date:** 2026-08-28
- **Status:** ADOPTED
- **Context:** Public derivatives must not expose GPS, camera/device serial identifiers, or unnecessary private metadata.
- **Decision:** Strip all EXIF/XMP/IPTC metadata from public derivatives by default. Extract any required internal metadata before stripping. Source masters remain untouched. Retain only an explicit safe allowlist if metadata is actually displayed. Verify public derivatives contain no GPS, serial, or private fields.
- **Consequences:** Privacy protection by default. Sharp drops metadata by default; deliberate retention requires documented API use. Source masters are never modified.

### ADR-013 -- Measure Before Virtualization

- **Date:** 2026-08-28
- **Status:** ADOPTED
- **Context:** Long Galleries (~72 Photos validated reference) should use native browser capabilities first.
- **Decision:** Baseline architecture uses full semantic HTML, native lazy image loading, browser-native document flow, and targeted observers only. Virtualization is introduced only if real production measurements on low-end mobile and desktop prove it necessary.
- **Consequences:** Simpler initial implementation. No premature optimization. Measurement evidence required before adding complexity.

### ADR-014 -- Full Builds as Baseline

- **Date:** 2026-08-28 (date corrected from 2006-08-28)
- **Status:** ADOPTED
- **Context:** Incremental build features are experimental and add fragile state dependencies.
- **Decision:** Baseline assumes full builds. Incremental optimizations may be added later if scale demands it, but are not part of the canonical architecture.
- **Consequences:** Predictable builds. No fragile cache invalidation. Acceptable at current and near-term scale.

### ADR-015 -- Overview Thumbnails Contained and Uncropped

- **Date:** 2026-08-28
- **Status:** ADOPTED
- **Context:** Frozen design G6 requires contained uncropped thumbnails in Overview.
- **Decision:** Overview thumbnails preserve aspect ratio. No destructive crop. No square-crop enforcement. Consistent with the no-destructive-crop rule across Gallery, cards, and covers.
- **Consequences:** Photographic integrity maintained. Slightly variable thumbnail sizes accepted as a consequence of preserving framing.

### ADR-016 -- Alt Text Schema Support with Deferred Publication Policy

- **Date:** 2026-08-28 (revised)
- **Status:** ADOPTED
- **Context:** Schema must support alt_text from the start to avoid migration later. Publication enforcement policy can defer. Filename fallback is rejected.
- **Decision:** Each Photo item in Gallery YAML supports an optional `alt_text` field. Architecture does not use filename fallback or automatically equate caption with alt text. Publication enforcement policy (required, warn, or decorative-empty) is decided before accessibility hardening (P7). The schema exists now so content ingest does not require migration later.
- **Consequences:** Schema stability. Policy flexibility. No poor-quality automatic alt text.

### ADR-017 -- Photo Identity in Gallery YAML

- **Date:** 2026-08-28
- **Status:** ADOPTED
- **Source:** UD-001
- **Context:** Generated photo-identities.json cannot be the persistent identity authority. Rename/move/re-export must preserve Photo ID without depending on regenerable state.
- **Decision:** Photo identity and source binding live persistently in Gallery authored YAML. Each Photo item contains an authored `id` (globally unique, stable) and an authored `source_ref` (relative to `media/ingest-masters/`). Filename/path changes update `source_ref` without changing `id`. Dimensions, orientation, aspect ratio, EXIF, ICC, hashes, and derivatives are generated/derived. Generated state must never be the only place where stable Photo identity exists. One Photo belongs to one Gallery in MVP. No duplicate source_file/location fields.
- **Consequences:** Identity survives rename/move/delete-generated. No external registry required. Identity and sequence visible together in authored YAML.

### ADR-018 -- Media Ownership Outside Git Baseline

- **Date:** 2026-08-28
- **Status:** ADOPTED
- **Source:** UD-005
- **Context:** Git/LFS is not appropriate as the photographic archive baseline. Scale, cost, clone performance, and backup independence argue for separation.
- **Decision:** Git tracks source code, authored YAML metadata, site settings, redirects, tests, and architecture docs. WEB INGEST MASTERS live at `media/ingest-masters/` and are backed up off-site independently. CAMERA ORIGINALS and ARCHIVAL MASTERS live in external archival storage. Git LFS may be discussed as an optional later transport choice, never the canonical baseline. VPS is never the only copy of authored metadata or ingest masters.
- **Consequences:** Repository remains lean. Backup architecture must cover ingest masters separately. Restore procedures address both Git and media domains.

### ADR-019 -- Home Editorial Settings File

- **Date:** 2026-08-28
- **Status:** ADOPTED
- **Source:** UD-004
- **Context:** Featured state should not be stored as a per-Gallery boolean. No weekly rotation, is_curated, This Week, or secondary feature semantics exist in the frozen product.
- **Decision:** Use `content/site/home.yaml` with `featured_gallery_id` (nullable). If valid published featured Gallery exists, use it. Otherwise fall back to latest published Gallery by `published_at` descending, tie-break by stable Gallery ID. No scheduled rotation. No curated states. Recent Galleries remain part of the frozen Home design.
- **Consequences:** Single authoritative location for Home editorial state. Deterministic fallback. No phantom editorial scheduler.

### ADR-020 -- Status-Based Draft Model

- **Date:** 2026-08-28
- **Status:** ADOPTED
- **Source:** UD-009
- **Context:** Multiple draft mechanisms (status field, directory partition, prefix conventions) create ambiguity and divergence.
- **Decision:** Use exactly one publication-state mechanism: `status: draft` or `status: published` in Gallery YAML. Do not combine with `_draft-*` prefixes, `drafts/` directories, or `published/` directories. Production builds include only published Galleries. Only published Galleries generate public routes, enter Archive/Places/Home/sitemap, and serve as next_gallery targets. Local preview may include draft content.
- **Consequences:** Unambiguous publication state. No dual-authority lifecycle. Build modes clearly defined.

### ADR-021 -- Explicit Published Cover Required

- **Date:** 2026-08-28
- **Status:** ADOPTED
- **Source:** UD-010
- **Context:** Silently defaulting cover to the first Photo causes accidental cover changes when sequence is reordered or photos inserted.
- **Decision:** Published Gallery requires explicit `cover_photo_id` referencing a Photo inside that same Gallery. Validation enforces this for published status. Draft Gallery may temporarily omit it. Do not default published cover silently to first Photo.
- **Consequences:** Reordering and insertion are safe. Cover is always an intentional editorial choice. Validation catches missing covers before production.

### ADR-022 -- Redirects Historical-Only in content/redirects.yaml

- **Date:** 2026-08-28
- **Status:** ADOPTED
- **Source:** UD-008
- **Context:** Slug changes in a long-lived archive require redirect support. Current slug authority must remain singular.
- **Decision:** Gallery YAML is the only authority for current Gallery slug (`slug` field). Historical route aliases for Galleries and Places belong only in `content/redirects.yaml`. Each entry carries exactly one target type: `gallery_id` XOR `place_id`. The build resolves redirect targets from current slugs and validates: old path is historical only (!= any current canonical path); target exists; target resolves to a public/published canonical route; no redirect loops; no route collisions. Delivery is a generated Nginx HTTP 301 redirect `include` with the complete config lifecycle (candidate verification, `nginx -t`, activation with the candidate release, reload only when redirect config changed, post-switch redirect smoke, coupled rollback of release and redirect config; see DEPLOYMENT_ARCHITECTURE.md section 3.3). Do not create a second current-slug authority.
- **Consequences:** Stable internal identity decoupled from mutable public URL. Single slug authority. Long-lived archive preserves external references.

### ADR-023 -- Cycles Allowed in next_gallery

- **Date:** 2026-08-28
- **Status:** ADOPTED
- **Source:** UD-007
- **Context:** Cycle rejection has no product basis. A -> B -> C -> A is a valid authored continuation structure.
- **Decision:** Cycles are allowed. Validation requires: target Gallery exists; target is published for production output; target != self; dangling target forbidden. Do not require graph acyclicity. Do not implement cycle-detection complexity merely to reject loops.
- **Consequences:** Editorial freedom for continuation structures. Simpler validation logic. Self-loops and dangling references still prevented.

### ADR-024 -- No Authored prev_gallery

- **Date:** 2026-08-28
- **Status:** ADOPTED
- **Source:** UD-011
- **Context:** The frozen product does not require Previous Gallery at continuation. Dual-authored next/prev creates divergence risk.
- **Decision:** Do not author `prev_gallery`. The canonical authored relationship is `next_gallery_id?` only. If reverse relationships are useful internally, derive them at build time. Do not render Previous Gallery unless Final Design Spec explicitly requires it.
- **Consequences:** Single directional authored relationship. No divergence between forward and backward links. Derived reverse is always consistent.

### ADR-025 -- RPO and RTO Backup Target

- **Date:** 2026-08-28
- **Status:** ADOPTED
- **Source:** UD-006
- **Context:** Personal site recovery targets must be explicit. VPS is never the only copy of non-regenerable state.
- **Decision:** Adopt RPO <= 24 hours and RTO <= 24 hours as baseline recovery targets. Back up authored content, Home settings, redirects, WEB INGEST MASTERS, and any other non-regenerable persistent state to encrypted off-site storage. Do not back up dist, generated manifest, derivatives, or caches (all regenerable). Specific provider/tool is an implementation/deployment choice.
- **Consequences:** Recovery capability defined. Non-regenerable state always has an off-site copy. Regenerable state does not consume backup resources.

### ADR-026 -- Corrected Build DAG with Manifest Before Astro

- **Date:** 2026-08-28
- **Status:** ADOPTED
- **Context:** Previous architecture had contradictory producer/consumer sequences where Astro consumed manifests that did not yet exist or wrote derivatives into directories Astro would clear.
- **Decision:** The canonical build dependency graph is:

```
AUTHORED PERSISTENT STATE
  Gallery YAML, Place YAML, Home settings, redirects, WEB INGEST MASTERS
        |
REFERENCE AND SOURCE VALIDATION
        |
IMAGE ANALYSIS AND DERIVATION
        |
GENERATED ASSET MANIFEST (with final public URL paths)
        |
ASTRO BUILD (consumes manifest at build time)
        |
ISOLATED FINAL RELEASE ASSEMBLY (Astro output + web derivatives)
        |
INTEGRITY GATE
        |
UPLOAD CANDIDATE RELEASE
        |
PRE-SWITCH VERIFY
        |
ATOMIC POINTER SWITCH
        |
POST-SWITCH SMOKE
        |
ROLLBACK EXACT PREVIOUS TARGET ON FAILURE
```

Astro must never need a manifest that does not yet exist. Image derivation does not depend on mutating Astro's final build directory. Final assembly is isolated and complete before deployment.

- **Consequences:** No consumer-before-producer edges. dist/ has one owner (the Astro/assembly step). Manifest paths are final public paths.

### ADR-027 -- Publication-Time Integrity

- **Date:** 2026-08-28
- **Status:** ADOPTED
- **Source:** UD-003
- **Context:** `photographed_*` and `published_at` are different concepts. Deriving published_at from EXIF, photographed date, file mtime, Git timestamp, or folder name fabricates history.
- **Decision:** Never derive `published_at` from any automated source. If historical publication time is genuinely known, the author enters it. Otherwise, migrated historical Gallery uses an honest archive-import/site-publication timestamp. Unknown history remains unknown. Latest/Recent ordering uses publication/addition semantics, not photographed time.
- **Consequences:** Honest temporal record. Repeated builds produce the same ordering. Migration policy does not fabricate dates.

### ADR-028 -- Corrected-Master Identity Semantics

- **Date:** 2026-08-28
- **Status:** ADOPTED
- **Source:** UD-002
- **Context:** Photo identity is editorial identity, not file-byte identity. Legitimate master corrections must not force new Photo IDs.
- **Decision:** A corrected or re-exported master retains the same Photo ID when it is still the same authored photograph. This includes filename change, path move, JPEG re-export, compression change, ICC correction, metadata cleanup, higher-quality export, technical color/exposure correction, and dust cleanup. Create a new Photo ID only when it becomes a distinct authored photograph: different capture/frame, materially different editorial crop intended as a separate work, composite, substantial content alteration, or both versions intentionally coexist. SHA-256 is integrity/revision metadata, not Photo identity.
- **Consequences:** Editorial identity survives technical corrections. Hash changes signal revision, not identity change. Authoring workflow distinguishes replace-master from new-photo operations.

---

## Decision Context

### Product Constraints Shaping These Decisions

1. Design frozen at G1-G7 visual gates; Final Design Specification v1.0 FREEZE
2. Self-hosted Nginx deployment; no CDN platform, no server runtime
3. File-first YAML authoring; no CMS in MVP
4. Photography is the largest, highest-contrast layer at all times
5. Progressive enhancement required; core navigation usable without JS

### Intentionally Excluded

- Database layer (content in YAML)
- CMS/admin interface (file-first authoring)
- Server-side runtime (static generation only)
- API layer (direct file consumption at build time)
- Authentication system (public archive)
- Search, filter, sort controls (excluded per Final Design Spec)
- User accounts or social features
- Dark mode in MVP
- Visit/Trip concept (only Place entity exists)
- Slideshow, carousel, swipe-first Gallery
- Map integration

---

## Related Documents

- SOURCE_OF_TRUTH_MATRIX.md -- canonical ownership per concept
- TECHNICAL_API_VERIFICATION.md -- verified external API facts
- CONTENT_MODEL.md -- Gallery/Photo/Place/Home/Redirect schemas
- IMAGE_PIPELINE.md -- derivation rules and manifest contract
- BUILD_AND_ROUTING.md -- build DAG and routing
- DEPLOYMENT_ARCHITECTURE.md -- atomic deploy strategy
- BACKUP_AND_RECOVERY.md -- RPO/RTO and recovery scenarios

---

**END OF ARCHITECTURE DECISION RECORDS**
