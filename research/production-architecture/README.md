# Quiet Editorial Archive -- Production Architecture

**Status:** CANONICAL REWRITE COMPLETE -- ready for Focused Independent Re-Review
**Gate:** This architecture is NOT ready for an Implementation Plan. No implementation code is authorized.
**Design authority:** `research/FINAL_DESIGN_SPECIFICATION.md` (frozen v1.0)

---

## Overview

This directory contains the single canonical production architecture for the Quiet Editorial Archive -- a personal photographic archive website. All domain documents have been rewritten to adopt 11 user decisions (UD-001 through UD-011) and resolve every finding from the targeted independent re-review. Superseded historical proposals are preserved for audit traceability only; see `PREVIOUS_CORRECTIONS/README.md`.

Production developers should not need to choose among competing architecture sources. This document set is the only engineering authority.

---

## Approved Direction

The production direction is valid and unchanged:

- Astro static generation
- File-first YAML authoring
- Deterministic local image pipeline
- Minimal progressive-enhancement JavaScript
- Atomic static deployment to self-hosted Nginx

No server runtime, no database, no CMS, no CDN platform dependency.

---

## What Is Frozen

The following are frozen by `FINAL_DESIGN_SPECIFICATION.md` and must not be altered by this architecture:

- **Design gates G1-G7**: color system, typography, Gallery rhythm, position annotation, Overview, continuation, accessibility focus
- **Routes**: `/`, `/archive`, `/places`, `/places/{slug}`, `/galleries/{slug}`, `/about`
- **Font families**: Source Serif 4, Source Sans 3, Noto Serif SC, Noto Sans SC (no additions)
- **Viewing hierarchy**: Photo > Whitespace > Typography > Metadata > Controls
- **Product exclusions**: no slideshow/carousel/swipe, no dark mode in MVP, no search/filter/sort, no user accounts, no analytics by default, no cover images at continuation, no multiple Next suggestions

---

## What This Architecture Defines

This architecture specifies the engineering contracts that serve the frozen design:

- Content data model and validation rules
- Image pipeline stages, determinism semantics, and asset manifest contract
- Build DAG with strict producer-before-consumer ordering
- Repository structure and directory ownership
- Runtime progressive enhancement and accessibility targets
- Performance budget classification system
- Deployment flow with atomic release switching and rollback
- Backup and recovery targets (RPO/RTO)
- Testing categories and visual regression governance
- Risk register with canonical mitigations
- Architecture decision records (ADR-001 through ADR-028)
- Open engineering benchmarks and deferred policy decisions
- Implementation phase ordering (P1-P10)

---

## Key Engineering Decisions

The current ADR set includes 28 records. ADR-017 through ADR-028 were added during the canonical rewrite to codify the 11 user decisions. Earlier ADRs that conflicted with the rewrite were revised or superseded. See ARCHITECTURE_DECISIONS.md for the full migration mapping.

| Decision | Summary |
|---|---|
| ADR-001 (revised) | Astro static generation with Content Layer; exact version pinned at P1; load YAML directly from `content/galleries/` via glob loader |
| ADR-002 (revised) | Authored/generated/built separation; media ownership outside Git baseline |
| ADR-003 | SUPERSEDED by ADR-017 |
| ADR-004 | Captions and rhythms inline on Photo items, keyed by Photo ID |
| ADR-005 | Deterministic local image pipeline; semantic determinism required |
| ADR-006 | Atomic release-directory deployment with exact previous-target rollback |
| ADR-007 | Photographed dates canonical for chronology; distinct from publication time |
| ADR-008 | Four media classes defined separately from archival storage |
| ADR-009 (revised) | next_gallery references Gallery ID; cycles allowed; no acyclicity test |
| ADR-010 | Responsive widths and quality values require engineering benchmark |
| ADR-011 | Source ICC to sRGB conversion; assume-sRGB for untagged MVP |
| ADR-012 | Privacy-sensitive metadata stripped from public derivatives |
| ADR-013 | Measure before virtualization; native lazy loading baseline |
| ADR-014 | Full builds as baseline; incremental optional later |
| ADR-015 | Overview thumbnails contained and uncropped |
| ADR-016 (revised) | Alt text schema support adopted; publication enforcement deferred |
| ADR-017 | Photo identity and source binding in Gallery authored YAML (UD-001) |
| ADR-018 | Media ownership outside Git baseline (UD-005) |
| ADR-019 | Home editorial settings file with featured_gallery_id (UD-004) |
| ADR-020 | Status-based draft model; single mechanism (UD-009) |
| ADR-021 | Explicit published cover required; no silent first-Photo default (UD-010) |
| ADR-022 | Redirects historical-only in content/redirects.yaml (UD-008) |
| ADR-023 | Cycles allowed in next_gallery (UD-007) |
| ADR-024 | No authored prev_gallery (UD-011) |
| ADR-025 | RPO <= 24h / RTO <= 24h backup target (UD-006) |
| ADR-026 | Corrected build DAG with manifest-before-Astro invariant |
| ADR-027 | Publication-time integrity; never derive published_at (UD-003) |
| ADR-028 | Corrected-master identity semantics; SHA-256 is metadata not identity (UD-002) |

---

## Core Data Model

Photo identity and source binding live in Gallery authored YAML. There is no generated identity registry, no separate captions map, no separate rhythms map, and no `generated/photo-identities.json` as authority.

```yaml
# PSEUDOCODE / CONTRACT EXAMPLE -- see CONTENT_MODEL.md
# content/galleries/{gallery}/meta.yaml

id: g_lofoten_light
slug: lofoten-light
status: published
title: "Lofoten Light"
photographed_start: "2025-02-01"
photographed_end: "2025-02-07"
published_at: "2026-08-28T14:31:20Z"
places: [pl_reine]
cover_photo_id: p_reine_001
next_gallery_id: g_tengwang

photos:
  - id: p_reine_001
    source_ref: lofoten-light/DSC02762.jpg
    caption: null
    rhythm_after: base
    alt_text: null
```

Key contracts:

- `photos[].id` is globally unique, stable editorial identity
- `photos[].source_ref` is relative to `media/ingest-masters/`
- Caption and rhythm_after are inline on each Photo item, not parallel maps
- `cover_photo_id` required for published; no silent first-Photo default
- `next_gallery_id` references Gallery ID (not slug); cycles allowed
- `published_at` is authored; never derived from EXIF/mtime/Git/folder
- `status: draft | published` is the only publication-state mechanism
- Featured state lives in `content/site/home.yaml`, not per-Gallery

See CONTENT_MODEL.md and SOURCE_OF_TRUTH_MATRIX.md for the complete schema and ownership matrix.

---

## Corrected Build DAG

The following producer-before-consumer sequence is the single authoritative build order:

```
AUTHORED PERSISTENT STATE
  Gallery YAML, Place YAML, Home settings, redirects, WEB INGEST MASTERS
        |
        v
REFERENCE + SOURCE VALIDATION
        |
        v
IMAGE ANALYSIS / DERIVATION
  Output: generated/media/ + generated/asset-manifest.json
        |
        v
ASTRO BUILD
  Consumes asset-manifest.json at BUILD TIME
  Loads authored YAML via Content Layer glob loader
        |
        v
ISOLATED FINAL RELEASE ASSEMBLY
        |
        v
INTEGRITY GATE
        |
        v
UPLOAD CANDIDATE RELEASE
        |
        v
PRE-SWITCH VERIFY
        |
        v
ATOMIC POINTER SWITCH
        |
        v
POST-SWITCH SMOKE
        |
        v
ROLLBACK EXACT PREVIOUS TARGET ON FAILURE
```

Architectural invariants:

- Astro never needs a manifest that does not yet exist
- The browser does not consume the asset manifest at runtime
- Image derivation does not mutate Astro's build directory
- `dist/` has exactly one owner: the Astro/assembly step
- Final assembly is isolated and complete before deployment

See BUILD_AND_ROUTING.md for the full specification.

---

## Corrected Repository Structure

```
photography/
  src/                  # Astro application source
    content.config.ts   # Content Layer collection definitions
  content/              # AUTHORED METADATA (Git-tracked, single source)
    galleries/          # Gallery YAML (one directory per Gallery)
    places/             # Place YAML
    site/home.yaml      # Featured gallery, Home settings
    redirects.yaml      # Historical path aliases only
  media/
    ingest-masters/     # WEB INGEST MASTERS (pipeline source, non-regenerable)
  generated/            # REGENERABLE OUTPUT (not committed)
    asset-manifest.json
    media/              # Web derivatives staging
  tests/                # Test definitions and baselines
  public/fonts/         # Self-hosted web fonts
  dist/                 # ASTRO BUILD OUTPUT (not committed)
  research/             # Design specs and architecture docs
  scripts/              # Build tooling
```

Explicit prohibitions:

- No `src/content/galleries/` mirror -- Astro loads YAML directly via glob loader
- No `generated/photo-identities.json` as identity authority
- No `media/originals/` as pipeline input root
- No absolute paths in authored YAML

See REPOSITORY_STRUCTURE.md for the full annotated tree and ownership table.

---

## Document Index

All 20 canonical files in this directory:

| Document | Purpose |
|---|---|
| README.md | Front door; overview, approved direction, key decisions, document index |
| ARCHITECTURE_OVERVIEW.md | System purpose, build DAG diagram, component responsibilities, testing and risk summary |
| PRODUCTION_ARCHITECTURE_SUMMARY.md | Executive summary of the canonical architecture and rewrite outcome |
| SOURCE_OF_TRUTH_MATRIX.md | Definitive ownership table for every persistent concept; wins on conflict |
| TECHNICAL_API_VERIFICATION.md | Verified Astro Content Layer, Sharp, Nginx, and font API facts |
| CONTENT_MODEL.md | Gallery, Photo, Place, Home, Redirect schemas; validation rules; authoring workflows |
| IMAGE_PIPELINE.md | Derivation stages, ICC policy, privacy stripping, determinism, manifest contract |
| BUILD_AND_ROUTING.md | Build DAG, Astro content architecture, route table, redirect lifecycle, integrity gate |
| REPOSITORY_STRUCTURE.md | Canonical directory tree, ownership table, Git boundaries, media root |
| RUNTIME_AND_PROGRESSIVE_ENHANCEMENT.md | JS inventory, captions/continuation/Overview contracts, mobile nav, focus, accessibility |
| PERFORMANCE_BUDGET.md | Budget classification system, Core Web Vitals targets, benchmark-required values |
| DEPLOYMENT_ARCHITECTURE.md | Atomic release-directory deployment, redirect config lifecycle, cache policy, static 404, health endpoint |
| BACKUP_AND_RECOVERY.md | RPO/RTO targets, asset classification, off-site backup, restore scenarios |
| TESTING_AND_VISUAL_REGRESSION.md | Seven test categories, visual regression governance, screenshot determinism |
| RISK_REGISTER.md | Active risks with canonical mitigations, deferred benchmark risks, resolved risks |
| ARCHITECTURE_DECISIONS.md | Full ADR set (ADR-001 through ADR-028) with migration mapping |
| OPEN_QUESTIONS.md | Closed questions (UD-001-UD-011), remaining open benchmarks and policy decisions |
| IMPLEMENTATION_PHASES.md | Phase ordering P1-P10 with entry/exit criteria; NOT an Implementation Plan |
| ARCHITECTURE_REVIEW_PACKET.md | Review packet for focused independent re-review |
| CANONICAL_REWRITE_TRACEABILITY.md | Finding-by-finding resolution evidence; audit history, not an implementation authority |

External authority:

| Document | Location | Role |
|---|---|---|
| FINAL_DESIGN_SPECIFICATION.md | `research/FINAL_DESIGN_SPECIFICATION.md` | Frozen product design authority; wins over all architecture documents on design values |

---

## Gate Status

**Canonical rewrite complete -- ready for Focused Independent Re-Review.**

This architecture has been rewritten to resolve all findings from the targeted independent re-review and adopt all 11 user decisions. The document set is internally consistent and serves as the single engineering authority.

This is NOT ready for an Implementation Plan. Sprint-week estimates, task breakdowns, and scheduling belong in an Implementation Plan produced only after the focused independent re-review passes. No implementation code is authorized.

See IMPLEMENTATION_PHASES.md for architecture-level phase ordering and entry/exit criteria.
