# Content Model — Product Semantics

This document defines editorial entities and relationships only. It does not define database tables, ORM models, APIs, CMS fields, or filesystem layout.

## Model overview

```text
Place  ← many-to-many →  Gallery  → ordered Photos (one Gallery membership per Photo in MVP)
                             │
                             ├── one cover Photo
                             ├── one photographed date or range
                             └── one published/added timestamp

Visit: not an entity in MVP
Project/Series: not an entity in MVP
```

Gallery is the editorial entity. Place and photographed time are discovery metadata around it. Photo has a stable identity and is shown in an editorial order; Multi-Gallery reuse is not an MVP requirement.

## Gallery

### Purpose

A Gallery is a stable, titled, published set of photos that the photographer intends to be viewed together in a deliberate order. It is the canonical content and viewing unit.

### Necessary characteristics

- A coherent photographic/editorial proposition.
- A public title that distinguishes it in indexes and URLs.
- An explicit ordered set of published Photos.
- A photographed date or date range accurate enough for Archive placement.
- A designated cover Photo.
- A stable canonical identity independent of Home, Archive, or Place entry paths.

### Optional characteristics

- One or multiple Places.
- A short description or framing text.
- Per-photo captions or dates.
- Work spanning multiple shoots, visits, trips, years, or countries.
- A derived photo count and status such as ongoing/completed.
- An optional Home-feature presentation state; at most one published Gallery is featured at a time.

### Not required

- One city or one Place.
- One trip, visit, shoot, or import batch.
- Continuous time.
- A narrative essay or caption on every Photo.
- A fixed number or range of Photos.
- A dedicated Visit, Project, Series, or travel parent.

### Conceptual fields

| Required | Optional / derived |
|---|---|
| stable identity / slug | description |
| title | Place references |
| photographed date or range | ongoing/completed state |
| published/added timestamp | per-Gallery cover treatment |
| cover Photo reference | derived photo count |
| ordered Photo memberships | optional context text |
| publish state | optional multi-year display label |
|  | optional Home-feature override |

### Lightweight editorial self-check

Before publishing, the editor should be able to answer three questions without creating a new approval workflow:

1. Why do these Photos belong in one work unit?
2. Does their order have meaning?
3. Where does this Gallery deliberately end?

## Place

### Purpose

A lightweight persistent geographic concept that lets recurring locations connect Galleries across time. It prevents `Paris`, `Paris 2024`, and spelling variants from becoming unrelated discovery buckets.

### Relationship

- Gallery ↔ Place is many-to-many.
- Place aggregates canonical Gallery references; it does not own or duplicate them.
- Place does not contain Visits in MVP.
- A Gallery with Paris + Brussels appears on both Place pages with one Gallery URL.

### Conceptual fields

| Required | Optional |
|---|---|
| stable identity / slug | country/region disambiguation |
| display name | aliases / alternate spellings |
| publishable state | representative cover derived from a Gallery |
| associated published Galleries | broader location label when useful |

No precise GPS coordinate, deep geographic tree, Visit count, or map behavior is required.

## Photo

### Purpose

The preserved photographic image with a stable identity. Photo is not a top-level public navigation object in MVP.

### Relationship

- A Gallery contains ordered Photos.
- MVP operates as if each Photo belongs to one Gallery.
- Multi-Gallery reuse is allowed later only when a concrete editorial case requires it; enabling reuse must not duplicate the underlying image asset.
- One Photo is selected as the Gallery cover.

### Conceptual fields

| Required | Optional / hidden |
|---|---|
| stable identity | caption |
| image asset reference | exact capture date/time |
| intrinsic orientation/dimensions | Photo-level Place |
| accessibility text or editorial description policy | camera/lens/film/basic EXIF when automatically preserved |
| publishability state | preservation/provenance context available from the source or ingestion process |

Photo-level GPS is not a product field in MVP.

## Visit

### Decision

**Not modeled in MVP.**

Visit has no entity, product field, public page, URL, navigation, grouping rule, or relationship requirement. The model already represents the concrete needs:

- photographed time through Gallery/Photo dates;
- geography through Place;
- editorial grouping through Gallery;
- publication order through date added/published.

Capture date/time and available ingestion/provenance context are preserved at data level; this does not create `visit_id`, `trip_id`, or `shoot_id`. If a future ingestion, rights, diary, or provenance workflow requires a reusable trip/shoot record, it must be introduced through a new explicit decision with a concrete use case—not speculative future-proofing.

## Shoot, Trip, Archive batch, Gallery, Long-term Project

| Concept | MVP semantic role |
|---|---|
| Shoot | Real-world production event; optional source context, not a public entity |
| Trip | Real-world journey; not an IA or product entity |
| Visit | Real-world occurrence; not modeled in MVP; recoverable capture/provenance context is not intentionally discarded |
| Archive batch | Operational ingestion unit; outside the public content model |
| Gallery | Canonical editorial and viewing unit |
| Long-term Project | Editorial scope; represented as one Gallery when it forms one viewing unit. If it later needs multiple persistent child Galleries, a Project/Series entity requires a separate future decision. |

## Date semantics

`date photographed` and `date added/published` are conceptually distinct and both required for a published Gallery.

| Date | Product meaning | Drives | Visibility |
|---|---|---|---|
| **Date photographed / date range** | When the work was made | Archive ordering, year grouping, Place page grouping | Always visible at Gallery level; exact Photo date contextual |
| **Date added / published** | When this Gallery entered the site | Home latest ordering and system history | Stored and used; normally not displayed |

An optional single Home-feature override may replace the default first Gallery. It is presentation metadata only: it does not alter either date, Archive/Place placement, or canonical identity. Without an override, Home uses `date added/published` descending.

Backfilling a 2019 Gallery in 2026 places it under Archive 2019 while allowing it to appear among the latest additions on Home. Publication does not rewrite photographic chronology.

## Repeated-place product rule

> **Physical visit does not determine Gallery boundary. Editorial intent determines Gallery boundary; Place and photographed time connect the resulting Galleries.**

### Scenario validation

| Scenario | Model result |
|---|---|
| **Scenario A — Paris 2024, three days, one complete body of work** | One Gallery, Paris Place, 2024 date/range |
| **Scenario B — One Paris trip, two clearly different themes** | Two Galleries, both reference Paris and may share overlapping photographed dates |
| **Scenario C — Paris 2024 + 2026 later become one long-term work** | One Gallery with Paris and a 2024–2026 range; photos retain their own dates when known |
| **Scenario D — Paris accumulates 20 Galleries** | One persistent Paris page; photographed-year headings appear when they improve scanning; no Visit nodes are introduced |
| **Scenario E — One Gallery covers Paris + Brussels** | One canonical Gallery references both Places and appears on both Place pages |

## Model invariants

1. Every public Gallery has one canonical URL regardless of discovery path.
2. Gallery order is editorial; Home, Archive, and Place ordering do not alter its Photo sequence.
3. Archive and Place pages reference Galleries, not copied Gallery records or raw photo pools.
4. Photographed chronology is never derived from publication date.
5. No rule creates a Gallery automatically from a trip, folder, date bucket, or import batch.
6. No absent Place or exact Photo date blocks publication when the work is otherwise valid.
7. MVP assumes one Gallery membership per Photo while preserving stable Photo identity; reuse requires a later explicit decision and never requires asset duplication.
