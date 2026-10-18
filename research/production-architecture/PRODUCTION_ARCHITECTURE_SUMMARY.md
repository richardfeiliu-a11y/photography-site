# Production Architecture Summary -- Quiet Editorial Archive

**Status:** CANONICAL REWRITE COMPLETE -- ready for Focused Independent Re-Review
**Date:** 2026-08-28
**Design authority:** `research/FINAL_DESIGN_SPECIFICATION.md` (frozen v1.0)

---

## Executive Summary

The canonical production architecture for the Quiet Editorial Archive has been completely rewritten to resolve all findings from the targeted independent re-review and adopt 11 explicit user decisions (UD-001 through UD-011). The rewritten document set in `research/production-architecture/` is now the single engineering authority. Superseded historical proposals are preserved for audit traceability only.

The production direction remains valid: Astro static generation, file-first YAML authoring, deterministic local image pipeline, minimal progressive-enhancement JavaScript, and atomic static deployment to self-hosted Nginx. What changed is the internal consistency of the architecture documents that implement this direction.

This architecture is NOT ready for an Implementation Plan. No implementation code is authorized. The next gate is Focused Independent Re-Review.

---

## What Changed vs Superseded Proposals

The canonical rewrite eliminated three competing authority layers (original architecture, red-team findings, PREVIOUS_CORRECTIONS proposals) and replaced them with one coherent document set. Key corrections:

| Area | Before Rewrite | After Rewrite |
|---|---|---|
| Photo identity | Generated `photo-identities.json` as authority | Authored Gallery YAML (`photos[].id` + `photos[].source_ref`) is the sole identity authority |
| Media root | `media/originals/` referenced as pipeline input | Single canonical root: `media/ingest-masters/` |
| Content loading | `src/content/galleries/` mirror proposed | Astro loads YAML directly via glob loader; no mirror |
| Build order | Contradictory producer/consumer sequences | Strict DAG: validation, derivation, manifest, then Astro |
| Draft model | Directory partition + status field ambiguity | Single mechanism: `status: draft \| published` |
| Home featured | Per-Gallery `featured` field, weekly rotation concepts | Single `content/site/home.yaml` with `featured_gallery_id` |
| Cover policy | Silent first-Photo default | Explicit `cover_photo_id` required for published |
| Publication time | Derived from EXIF/mtime/Git/folder | Authored; never derived |
| next_gallery cycles | Cycle detection required | Cycles explicitly allowed; validation = exists/published/not-self |
| prev_gallery | Authored bidirectional relationship | Not authored; derive reverse at build time if needed |
| Backup targets | Unspecified or Git/LFS-dependent | RPO <= 24h / RTO <= 24h; encrypted off-site; VPS never sole copy |
| Determinism | Byte-for-byte claimed universally | Semantic determinism required; byte-for-byte only within pinned toolchain |
| Asset fingerprint | Six-hex-character digest proposed | Content-addressed with robust truncated cryptographic digest |
| Cache policy | Immutable HTML proposed | Hashed assets immutable; HTML revalidate/no-cache |
| 404 behavior | SPA fallback considered | Static 404 only; `try_files $uri $uri/ =404` |

For full audit trail of superseded proposals, see `PREVIOUS_CORRECTIONS/README.md`.

---

## Adopted User Decisions at a Glance

| UD | Decision | Canonical Documents |
|---|---|---|
| UD-001 | Photo identity and source binding in Gallery authored YAML | CONTENT_MODEL.md, ADR-017, SOURCE_OF_TRUTH_MATRIX.md |
| UD-002 | Corrected-master retains same Photo ID; SHA-256 is metadata not identity | CONTENT_MODEL.md, ADR-028 |
| UD-003 | Never derive published_at from EXIF/mtime/Git/folder | CONTENT_MODEL.md, ADR-027 |
| UD-004 | Featured state in content/site/home.yaml only | CONTENT_MODEL.md, ADR-019 |
| UD-005 | Media ownership outside Git baseline | SOURCE_OF_TRUTH_MATRIX.md, ADR-018, BACKUP_AND_RECOVERY.md |
| UD-006 | RPO <= 24h / RTO <= 24h | BACKUP_AND_RECOVERY.md, ADR-025 |
| UD-007 | Cycles allowed in next_gallery | CONTENT_MODEL.md, ADR-023 |
| UD-008 | Redirects historical-only in content/redirects.yaml | CONTENT_MODEL.md, ADR-022, BUILD_AND_ROUTING.md |
| UD-009 | Status-based draft model; single mechanism | CONTENT_MODEL.md, ADR-020 |
| UD-010 | Explicit cover_photo_id required for published | CONTENT_MODEL.md, ADR-021 |
| UD-011 | No authored prev_gallery | CONTENT_MODEL.md, ADR-024 |

All 11 decisions are closed and not reopenable during implementation. See OPEN_QUESTIONS.md for the closure record.

---

## Corrected Contracts

### Identity Contract

Photo identity is editorial identity, not byte identity. Each Photo item in Gallery YAML carries an authored `id` (globally unique, stable) and an authored `source_ref` (relative to `media/ingest-masters/`). Renaming, moving, re-exporting, or technically correcting a master retains the same Photo ID. A new Photo ID is created only for a distinct authored photograph. SHA-256 is integrity and revision metadata, not identity. There is no generated identity registry.

### Build DAG Contract

Authored state flows through validation, image derivation, manifest generation, Astro build, release assembly, integrity gate, upload, pre-switch verify, atomic switch, post-switch smoke, and rollback on failure. Astro consumes the asset manifest at build time; the browser never consumes it at runtime. The manifest is produced before Astro build begins. `dist/` has exactly one owner. Final assembly is isolated.

### Content Boundary Contract

One authored source: `content/galleries/{gallery}/meta.yaml` (plus `content/places/`, `content/site/home.yaml`, `content/redirects.yaml`). Astro loads this directly via the Content Layer glob loader with `base: './content/galleries'`. There is no `src/content/galleries/` mirror. Captions and rhythms are inline on each Photo item, not separate maps. Gallery YAML `slug` is the only current-slug authority. Historical aliases live exclusively in `content/redirects.yaml`.

### Home and Publication Time Contract

Featured Gallery determined by `content/site/home.yaml` `featured_gallery_id` (null allowed); fallback is latest published by `published_at` descending with stable Gallery ID tie-break. No This Week, is_curated, Secondary Feature, or editorial scheduler. `published_at` is authored, never derived from EXIF capture time, photographed date, file mtime, Git timestamp, or folder name. Latest/Recent ordering uses publication semantics, not photographed time.

### Deployment Contract

Atomic release-directory deployment. Each release is a unique directory. The `current` symlink is switched atomically via `rename()` on the same filesystem. Rollback restores the exact previous target captured before the switch. Content switches do not require Nginx reload. Static 404 behavior (`try_files $uri $uri/ =404`); no SPA fallback. Hashed assets receive immutable cache headers; HTML receives revalidate/no-cache.

### Backup Contract

RPO <= 24 hours, RTO <= 24 hours. Non-regenerable state (authored YAML, WEB INGEST MASTERS) backed up to encrypted off-site storage. VPS is never the only copy. Regenerable state (derivatives, manifest, dist) is not backed up. Restore drills prove recovery within RTO. Git tracks code/YAML/settings/redirects/tests/docs; Git/LFS is not the photographic archive.

---

## Remaining Open Items

Seven questions remain open because they require engineering benchmarks or deferred policy decisions:

- Responsive derivative width steps (P3 benchmark)
- Encoder, format, and quality choice (P3 benchmark)
- ICC no-profile enforcement policy (P3/P7)
- Alt text publication enforcement (before P7)
- CJK subsetting implementation (P1/P4)
- Backup provider/tool selection (P9)
- Analytics (default: none; post-launch if needed)

All are tracked in OPEN_QUESTIONS.md with owning phases and blocking dependencies. None block the focused independent re-review.

---

## Current Gate

**Canonical rewrite complete -- ready for Focused Independent Re-Review.**

The 20-document canonical architecture set is internally consistent, adopts all 11 user decisions, and resolves all findings from the targeted independent re-review. The document set serves as the single engineering authority for the Quiet Editorial Archive.

This is NOT ready for an Implementation Plan. Sprint-week estimates, task breakdowns, and scheduling belong in an Implementation Plan produced only after the focused independent re-review passes. No implementation code is authorized.

Architecture-level phase ordering (P1-P10) is defined in IMPLEMENTATION_PHASES.md with entry/exit criteria per phase. Phase P1 entry requires the focused independent re-review to pass.

---

**END OF PRODUCTION ARCHITECTURE SUMMARY**
