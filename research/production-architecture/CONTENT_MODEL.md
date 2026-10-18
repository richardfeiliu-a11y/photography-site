# Content Model — Quiet Editorial Archive

**Status:** CANONICAL -- engineering authority
**Companion documents:** SOURCE_OF_TRUTH_MATRIX.md, BUILD_AND_ROUTING.md, IMAGE_PIPELINE.md, REPOSITORY_STRUCTURE.md, TECHNICAL_API_VERIFICATION.md
**Design authority:** research/FINAL_DESIGN_SPECIFICATION.md (frozen; this document serves it, never alters it)

---

## 1. Scope

This document defines the canonical authored data model for the Quiet Editorial Archive: Gallery, Photo, Place, Home settings, and Redirects. It specifies entity schemas, identity and uniqueness policy, publication lifecycle, navigation semantics, validation rules, and authoring workflows at contract level.

Generated/derived state (dimensions, orientation, EXIF, ICC, hashes, derivatives, asset manifest) is defined in IMAGE_PIPELINE.md and SOURCE_OF_TRUTH_MATRIX.md. This document references generated state only where it bears on authored contracts.

---

## 2. Authored content locations

All authored persistent content lives in exactly one location per concept. There is no `src/content/` mirror. Astro loads authored YAML directly through the Content Layer glob loader (see TECHNICAL_API_VERIFICATION.md).

| Content | Location |
|---|---|
| Gallery metadata + photos | `content/galleries/{gallery}/meta.yaml` |
| Place definitions (exactly one Place per file) | `content/places/{place}.yaml` |
| Home editorial settings | `content/site/home.yaml` |
| Historical route aliases | `content/redirects.yaml` |

WEB INGEST MASTERS live at `media/ingest-masters/{gallery}/`. This path is the single canonical media root for pipeline input. Absolute host paths never appear in authored YAML; mount or symlink placement is environment configuration.

---

## 3. Global uniqueness and identity policy

- **Gallery ID**: globally unique across the archive. Stable internal identity. Prefix `g_` recommended for readability.
- **Photo ID**: globally unique across the archive. Stable internal identity. Prefix `p_` recommended.
- **Place ID**: globally unique across the archive. Stable internal identity. Prefix `pl_` recommended.
- **Slug**: unique within its route namespace (`/galleries/{slug}`, `/places/{slug}`). Mutable public route component. Decoupled from ID.

ID is the stable foreign key used by all references (`cover_photo_id`, `next_gallery_id`, `featured_gallery_id`, `places[]`, redirect targets). Slug is the human-readable URL segment and may change without breaking references.

---

## 4. Gallery

### 4.1 Schema

PSEUDOCODE / CONTRACT EXAMPLE -- YAML schema shape:

```yaml
# content/galleries/{gallery}/meta.yaml

id: g_lofoten_light                # required; globally unique; stable
slug: lofoten-light                # required; unique in /galleries/ namespace
status: published                  # required; draft | published
title: "Lofoten Light"             # required; non-empty
description: >                     # optional; <=2-3 lines per frozen design
  Eight frames from a week in Reine,
  photographed at the edge of winter.

photographed_start: "2025-02-01"   # required; ISO date YYYY-MM-DD
photographed_end: "2025-02-07"     # required; ISO date; start <= end
published_at: "2026-08-28T14:31:20Z"  # required for published; ISO-8601

places:                            # required; one or more Place IDs
  - pl_reine

cover_photo_id: p_reine_001        # required for published; Photo in this Gallery
next_gallery_id: g_tengwang        # optional; Gallery ID (not slug)

photos:                            # required; non-empty ordered sequence
  - id: p_reine_001
    source_ref: lofoten-light/DSC02762.jpg
    caption: null
    rhythm_after: base
    alt_text: null

  - id: p_reine_002
    source_ref: lofoten-light/DSC02367.jpg
    caption: "The ferry leaves at first light."
    rhythm_after: compact
    alt_text: null
```

### 4.2 Field contracts

| Field | Required | Type | Contract |
|---|---|---|---|
| `id` | Yes | string | Globally unique. Stable internal identity. Never changes for the lifetime of the Gallery. |
| `slug` | Yes | string | Unique in `/galleries/` namespace. Valid URL-safe segment. May be renamed; old slug moves to `content/redirects.yaml`. |
| `status` | Yes | enum | `draft` or `published`. The only publication-state mechanism. No directory partition (`_draft-*`, `drafts/`, `published/`). |
| `title` | Yes | string | Non-empty display title. |
| `description` | No | string | Optional. At most 2-3 lines per frozen design spec. |
| `photographed_start` | Yes | ISO date | When photography began. Archive chronology concept, distinct from publication time. |
| `photographed_end` | Yes | ISO date | When photography ended. `start <= end`. |
| `published_at` | Conditional | ISO-8601 | Required when `status: published`. See section 7 for semantics. |
| `places` | Yes | list[PlaceID] | One or more valid Place IDs. |
| `cover_photo_id` | Conditional | PhotoID | Required when `status: published`. Must reference a Photo in this Gallery's `photos[]`. Draft may omit. Never silently defaults to first Photo. |
| `next_gallery_id` | No | GalleryID | References a stable Gallery ID (not slug). See section 9 for validation and cycle semantics. |
| `photos` | Yes | list[Photo] | Non-empty ordered sequence. Ordering = array order. Each item carries its own caption, rhythm, and alt_text inline. |

### 4.3 Forbidden fields

The following fields must NOT appear in Gallery YAML:

- `prev_gallery` / `prev_gallery_id` -- reverse relations are derived at build time if needed; never authored (UD-011).
- `has_continuation` -- derived from presence of `next_gallery_id`; not an independent authored field.
- `featured` / `is_featured` / `is_curated` -- featured state lives in `content/site/home.yaml` only (UD-004).
- `title_cjk` -- not part of the canonical schema; CJK rendering handled by font system.
- `photographed_date_label` -- display label derived from `photographed_start`/`photographed_end`; override not supported.
- Separate `captions` map or `rhythms` map -- captions and rhythms live inline on each photo item, not as parallel maps keyed by Photo ID.

---

## 5. Photo

### 5.1 Schema

Photos are defined inline within the Gallery `photos[]` array. There is no separate Photo file or external identity registry. One Photo belongs to exactly one Gallery (MVP constraint).

PSEUDOCODE / CONTRACT EXAMPLE -- Photo item shape:

```yaml
- id: p_reine_001                  # required; globally unique
  source_ref: lofoten-light/DSC02762.jpg  # required; relative to media/ingest-masters/
  caption: null                    # optional; explicit null = no caption
  rhythm_after: base               # optional; base | compact | breathing (default: base)
  alt_text: null                   # optional; schema support now, enforcement policy later
```

### 5.2 Field contracts

| Field | Required | Type | Contract |
|---|---|---|---|
| `id` | Yes | string | Globally unique across the entire archive. Stable editorial identity. Persists across filename changes, path moves, re-exports, compression changes, ICC corrections, metadata cleanup, dust cleanup, and technical color/exposure corrections (UD-002). |
| `source_ref` | Yes | string | Relative path from `media/ingest-masters/` root. Example: `lofoten-light/DSC02762.jpg`. Never an absolute path. Must resolve to an existing WEB INGEST MASTER file. |
| `caption` | No | string or null | Optional editorial caption. Explicit `null` means no caption. When absent, no reserved caption space is rendered. Caption is not automatically reused as alt text. |
| `rhythm_after` | No | enum | Spacing after this Photo. Values: `base` (default), `compact`, `breathing`. The value `spacious` does not exist. Default is `base` when omitted. Orientation alone never selects rhythm. Compact requires editorial reason (diptych, detail pair). Breathing is rare (chapter shift, major tonal break). |
| `alt_text` | No | string or null | Schema support exists now so that no future migration is needed. Publication enforcement policy remains an open editorial decision. No filename fallback. Caption is not automatically equated with alt text. |

### 5.3 Photo identity and corrected-master semantics (UD-001, UD-002)

Photo identity is **editorial identity**, not byte identity. The same Photo ID is retained when the underlying WEB INGEST MASTER changes in ways that do not create a distinct authored photograph:

**Retain same Photo ID:**
- Filename change
- Path move within `media/ingest-masters/`
- JPEG re-export (same frame, different export settings)
- Compression change
- ICC profile correction
- Metadata cleanup
- Higher-quality export of the same image
- Technical color or exposure correction
- Dust spot cleanup

**Create new Photo ID:**
- Different capture or frame
- Materially different editorial crop intended as a separate work
- Composite image
- Substantial content alteration
- Both versions intentionally coexisting as separate Photos in the archive

SHA-256 is integrity and revision metadata, not Photo identity. A hash change does not by itself require a new Photo ID.

### 5.4 Derived/generated Photo properties

The following are generated at build time from the WEB INGEST MASTER and must never be authored in YAML:

- Dimensions (intrinsic width, height)
- Orientation (landscape, portrait)
- Aspect ratio
- EXIF metadata (read then stripped from public output)
- ICC profile metadata
- Source hash (SHA-256 for integrity tracking)
- Derivative URLs, srcset entries, file sizes

These belong to the asset manifest (`generated/asset-manifest.json`) and the image pipeline contract (IMAGE_PIPELINE.md).

### 5.5 Photo ordering

Photo ordering equals the order of items in the `photos[]` array. There is no separate sequence index, position field, or sort key. Reordering Photos is accomplished by reordering the array.

Captions and rhythms are bound inline to each Photo item, not to array indices. Reordering the array preserves all metadata associations.

---

## 6. Place

### 6.1 Schema

**Canonical cardinality: ONE PLACE = ONE YAML FILE.** Each Place is defined by exactly one Place object in its own YAML file under `content/places/` (for example `content/places/reine.yaml`, `content/places/paris.yaml`). A single YAML file never contains multiple Place entries. Arrays of Places, aggregate loaders (Astro `file()`), and custom flattening loaders are not part of this architecture. Astro loads the Place collection with the glob loader and a singular Place schema, so each file becomes exactly one collection entry (BUILD_AND_ROUTING.md section 3).

PSEUDOCODE / CONTRACT EXAMPLE:

```yaml
# content/places/reine.yaml

id: pl_reine
slug: reine
name: "Reine"
region: "Lofoten, Norway"
country: "Norway"
```

### 6.2 Field contracts

| Field | Required | Type | Contract |
|---|---|---|---|
| `id` | Yes | string | Globally unique. Stable internal identity. |
| `slug` | Yes | string | Unique in `/places/` namespace. Valid URL-safe segment. |
| `name` | Yes | string | Public display name. |
| `region` | No | string | Geographic context for disambiguation. Displayed per frozen design spec. |
| `country` | No | string | Country context. |

### 6.3 Constraints

- No Visit concept. No Trip concept. No geographic coordinates exposed publicly. No counts.
- Region and country serve disambiguation only, consistent with the frozen Places Index design.

---

## 7. Publication-time semantics (UD-003)

`photographed_start`/`photographed_end` and `published_at` are fundamentally different concepts.

- `photographed_start`/`photographed_end` record **when the photography happened**. They represent archive chronology.
- `published_at` records **when the Gallery entered the public site**. It represents publication/addition time.

**Rules for `published_at`:**

1. Never derive `published_at` from EXIF capture time, photographed date, file modification time, Git commit timestamp, or folder name.
2. If historical publication time is genuinely known (e.g., the photographer knows when a body of work was first exhibited or published), the author may enter it manually.
3. For migrated historical Galleries where true publication time is unknown, use an honest archive-import or site-publication timestamp. Do not fabricate a date.
4. Unknown history remains unknown rather than being falsely backdated.

**Ordering consequence:** Latest/Recent ordering on Home and Archive uses `published_at` semantics (publication/addition order), not photographed time. Archive page groups by photographed year for chronological browsing, but Home Recent reflects what was added to the site most recently.

---

## 8. Publication lifecycle (UD-009, UD-010)

### 8.1 Status values

Exactly one mechanism controls publication state: the `status` field on Gallery.

| Status | Behavior |
|---|---|
| `draft` | Local preview allowed. No public production route. Not included in sitemap, Archive, Places, or Home discovery. May temporarily omit `cover_photo_id` and `published_at` in local validation mode. |
| `published` | Full production inclusion. Requires all fields listed below. Generates public route, sitemap entry, Archive/Places/Home presence. |

No directory-partition draft semantics (`_draft-*` prefix, `drafts/` directory, `published/` directory) exist alongside `status`.

### 8.2 Published requirements

A Gallery with `status: published` must satisfy all of the following before production build succeeds:

1. `cover_photo_id` present and references a Photo in this Gallery's `photos[]`.
2. `published_at` present and valid ISO-8601.
3. All `places[]` entries reference valid Place IDs.
4. All Photo `source_ref` values resolve to existing WEB INGEST MASTER files.
5. Complete derivative coverage for all Photos (image pipeline produced all expected outputs).
6. Valid canonical route (`/galleries/{slug}` does not collide with another Gallery or reserved route).
7. If `next_gallery_id` is set, target Gallery exists and is published in production output.

### 8.3 Draft behavior

- Draft Galleries may be rendered in local preview/development mode.
- Draft Galleries produce no public routes in production builds.
- Draft Galleries are excluded from sitemap, Archive listing, Places listing, Home hero, and Home Recent grid.
- Draft Galleries may omit `cover_photo_id` and `published_at` during local development; these become hard errors only when `status: published`.
- A published Gallery's `next_gallery_id` must not reference a draft Gallery in production builds.

### 8.4 Cover policy (UD-010)

- `cover_photo_id` is required for every published Gallery.
- It must reference a Photo ID that exists in the same Gallery's `photos[]`.
- Draft Galleries may omit `cover_photo_id`.
- There is NEVER a silent first-Photo default. Reordering or inserting Photos must not accidentally change the cover displayed on Archive, Home, or Places pages.
- If `cover_photo_id` is missing or invalid for a published Gallery, the build fails.

### 8.5 Photo-level status

There is no Photo-level `status` field for the MVP. Photo publication derives from Gallery membership: if the Gallery is published, its Photos are published. One Photo belongs to one Gallery.

---

## 9. Navigation: next_gallery (UD-007, UD-011)

### 9.1 Authored field

```yaml
next_gallery_id: g_tengwang    # optional; references stable Gallery ID
```

`next_gallery_id` references a Gallery by its stable ID, never by slug. This ensures renames do not break continuation links.

### 9.2 Validation rules

For any Gallery with `next_gallery_id` set:

1. **Target exists**: the referenced Gallery ID must exist in the archive.
2. **Target is published** (production): in production builds, the target must have `status: published`. Draft targets are forbidden in production output.
3. **Not self**: `next_gallery_id` must not equal the Gallery's own `id`.
4. **Dangling forbidden**: a `next_gallery_id` that cannot be resolved is a build error, not a warning.

### 9.3 Cycle policy

Cycles are explicitly allowed. The graph A -> B -> C -> A is a valid authored continuation structure.

- No acyclicity test is performed.
- No cycle-detection algorithm is required.
- No branching logic exists for a singular field.

### 9.4 prev_gallery

There is no authored `prev_gallery` or `prev_gallery_id` field. The frozen product does not require Previous Gallery rendering at continuation.

If reverse relationships are useful internally (e.g., for build-time analysis), they may be derived from `next_gallery_id` at build time. Derived reverse relations are generated state, not authored state.

### 9.5 has_continuation

There is no authored `has_continuation` field. The presence of continuation is derived from whether `next_gallery_id` is set and resolves to a valid published target.

---

## 10. Home editorial settings (UD-004)

### 10.1 Schema

PSEUDOCODE / CONTRACT EXAMPLE:

```yaml
# content/site/home.yaml

featured_gallery_id: g_lofoten_light   # Gallery ID or null
```

### 10.2 Featured resolution

The Home hero Gallery is determined by this algorithm:

1. If `featured_gallery_id` is set and references a valid published Gallery, use that Gallery.
2. Otherwise, select the latest published Gallery by `published_at` descending.
3. Tie-break by stable Gallery ID (lexicographic ascending) when two Galleries share the same `published_at`.

### 10.3 Forbidden concepts

The following do not exist in this architecture:

- Per-Gallery `featured` or `is_featured` field
- `is_curated` flag
- This Week / weekly rotation / scheduled feature
- Secondary Feature slot
- Any editorial scheduler or cron-based rotation

Featured state has exactly one owner: `content/site/home.yaml`.

### 10.4 Recent Galleries

Recent Galleries are part of the frozen Home design. They appear as a grid on the Home page below the hero section.

- Deterministic order: `published_at` descending, tie-break by stable Gallery ID.
- Display count is an implementation/presentation choice consistent with the frozen design spec. No permanent product rule or minimum-photo filter is defined here unless the frozen design explicitly requires one.
- The current hero Gallery may or may not be excluded from the Recent grid depending on frozen design behavior; this is a presentation concern, not a content-model concern.

---

## 11. Redirects (UD-008)

### 11.1 Schema

`content/redirects.yaml` supports historical Gallery and Place aliases. Each entry carries **exactly one target type: `gallery_id` XOR `place_id`**.

PSEUDOCODE / CONTRACT EXAMPLE:

```yaml
# content/redirects.yaml

/galleries/old-lofoten:
  gallery_id: g_lofoten_light

/galleries/reine-winter-2024:
  gallery_id: g_lofoten_light

/places/old-reine:
  place_id: pl_reine
```

### 11.2 Contracts

- `content/redirects.yaml` stores **historical route aliases only**. It never duplicates a current Gallery or Place slug.
- Each redirect maps an old path to a stable ID (not a slug): `gallery_id` for Gallery aliases, `place_id` for Place aliases. Exactly one target type per entry. The build resolves the redirect target from the target's current slug.
- Production validation (fail-closed):
  - The old path is historical only; it must not equal any current canonical route.
  - The target exists (the referenced Gallery ID or Place ID is present in the archive).
  - The target resolves to a public/published canonical route in production output.
  - No redirect loops (A -> B -> A or longer chains).
  - No route collision (no duplicate old paths; redirect targets are not themselves redirect sources).
- Delivery: redirects are served as **Nginx HTTP 301 responses** via a generated Nginx redirect `include`. The complete redirect-config lifecycle (generation, candidate verification, `nginx -t`, activation with the candidate release, conditional reload, post-switch smoke, coupled rollback) is defined in BUILD_AND_ROUTING.md section 5 and DEPLOYMENT_ARCHITECTURE.md section 3.3.

### 11.3 Slug authority

Gallery YAML `slug` is the **only** current-slug authority. There is no second slug registry, no generated slug index, and no separate mapping file for current slugs. Historical aliases live exclusively in `content/redirects.yaml`.

---

## 12. Canonical routes

The complete set of public routes:

| Route | Content |
|---|---|
| `/` | Home |
| `/archive` | Archive (chronological index) |
| `/places` | Places Index (geographic index) |
| `/places/{slug}` | Place Detail |
| `/galleries/{slug}` | Gallery (primary viewing unit) |
| `/about` | About |

Gallery route is `/galleries/{slug}` ONLY. No `/gallery/{name}`, no `/archive/galleries/{slug}`, no root-level Gallery slug route.

---

## 13. Validation rules

### 13.1 Fail-closed errors (block production build)

The production build must fail for any of the following conditions. These are never silently skipped for published content:

1. Missing WEB INGEST MASTER (a Photo `source_ref` does not resolve to an existing file under `media/ingest-masters/`).
2. Duplicate Gallery ID (two Galleries share the same `id`).
3. Duplicate Gallery slug (two Galleries share the same `slug`).
4. Duplicate Photo ID (two Photos anywhere in the archive share the same `id`).
5. Duplicate Place ID (two Places share the same `id`).
6. Duplicate Place slug (two Places share the same `slug`).
7. Photo `source_ref` missing or empty.
8. Cover missing or invalid for a published Gallery (`cover_photo_id` absent, or references a Photo not in this Gallery's `photos[]`).
9. Place reference missing (a Gallery `places[]` entry references a Place ID that does not exist).
10. `next_gallery_id` target missing (references a Gallery ID that does not exist).
11. `next_gallery_id` self-loop (equals the Gallery's own `id`).
12. `next_gallery_id` targets a draft Gallery in production build.
13. Invalid `status` value (not `draft` or `published`).
14. Missing `published_at` for a published Gallery.
15. Invalid redirect entry (malformed path, missing target field, both or neither of `gallery_id` / `place_id`, target Gallery or Place does not exist, or old path equals a current canonical route).
16. Redirect target unresolved in production (referenced Gallery or Place does not resolve to a public/published canonical route), or redirect loop / route collision.
17. Canonical route collision (two Galleries would produce the same `/galleries/{slug}` route).
18. Derivative coverage incomplete (image pipeline did not produce all expected derivatives for published Photos).

### 13.2 Warnings (local preview / draft only)

Warnings may be emitted for draft Galleries or local preview mode where explicitly defined:

- Missing `cover_photo_id` on a draft Gallery.
- Missing `published_at` on a draft Gallery.
- Missing `description`.
- Single-photo Gallery.

Warnings must never allow broken published content to pass a production build.

---

## 14. Authoring workflows (contract level)

### 14.1 Ingest a new Gallery

1. Create `content/galleries/{gallery}/meta.yaml` with `status: draft`.
2. Assign a globally unique Gallery ID and a URL-safe slug.
3. Place WEB INGEST MASTERS under `media/ingest-masters/{gallery}/`.
4. Define Photos in `photos[]` with unique IDs and `source_ref` paths relative to `media/ingest-masters/`.
5. Set `places[]` referencing valid Place IDs.
6. Run local preview to verify rendering.
7. When ready: set `status: published`, add `cover_photo_id`, add `published_at`, ensure all sources exist and derivatives are generated.

### 14.2 Rename or move a WEB INGEST MASTER

1. Move or rename the file under `media/ingest-masters/`.
2. Update the corresponding Photo's `source_ref` in the Gallery YAML.
3. Retain the same Photo ID. Do not create a new Photo.
4. Regenerate derivatives for the affected Photo.

### 14.3 Replace a corrected master

When the same photograph receives a technical correction (ICC fix, dust cleanup, better export, etc.):

1. Replace the WEB INGEST MASTER file at the same or updated path.
2. If the path changed, update `source_ref`.
3. Retain the same Photo ID.
4. Regenerate derivatives. The source hash will change; this is expected and does not indicate a new photograph.

### 14.4 Add a new photograph (distinct work)

When adding a genuinely different photograph:

1. Place the new WEB INGEST MASTER under `media/ingest-masters/{gallery}/`.
2. Add a new Photo item with a new globally unique Photo ID.
3. Insert it at the desired position in `photos[]`.
4. Set caption, rhythm_after, and alt_text as appropriate.

### 14.5 Publish a Gallery

1. Verify all published requirements (section 8.2).
2. Change `status` from `draft` to `published`.
3. Ensure `cover_photo_id` references a Photo in this Gallery.
4. Ensure `published_at` is set to the genuine publication time.
5. Run the build. Production validation must pass.

### 14.6 Rename a Gallery slug

1. Update `slug` in the Gallery YAML.
2. Add the old path to `content/redirects.yaml` mapping to the Gallery ID.
3. Verify no redirect loop or collision with current slugs.
4. All references using Gallery ID (`next_gallery_id`, `featured_gallery_id`, `cover_photo_id`, redirect targets) remain valid without change.

### 14.7 Set or change featured Gallery

1. Edit `content/site/home.yaml`.
2. Set `featured_gallery_id` to a published Gallery ID, or `null` to use automatic latest-published selection.
3. No per-Gallery field is modified.

---

## 15. Source-of-truth cross-reference

For the complete ownership matrix covering every authored and generated concept, see SOURCE_OF_TRUTH_MATRIX.md. Key invariants enforced by this content model:

- Photo identity and source binding live in Gallery authored YAML, not in any generated registry.
- Current Gallery slug lives in Gallery YAML, not in a secondary index.
- Featured state lives in Home settings, not per-Gallery.
- Publication state uses `status` only, not directory partitions.
- `published_at` is authored, never derived from file or capture metadata.
- Captions and rhythms are inline on Photo items, not in separate maps.
- `next_gallery_id` references Gallery ID, not slug.
- Reverse navigation (`prev`) is never authored.
- `has_continuation` is never authored.

---

## 16. Relationship to other documents

| Document | Relationship |
|---|---|
| SOURCE_OF_TRUTH_MATRIX.md | Definitive ownership table for every concept referenced here. Wins on conflict. |
| IMAGE_PIPELINE.md | Defines how WEB INGEST MASTERS become WEB DERIVATIVES and the asset manifest. This document defines what the pipeline consumes (source_ref) and what it produces (derivatives referenced by Photo ID). |
| BUILD_AND_ROUTING.md | Defines how Astro loads authored YAML, generates routes, and consumes the asset manifest at build time. |
| REPOSITORY_STRUCTURE.md | Defines the canonical directory tree including `content/`, `media/ingest-masters/`, and `generated/`. |
| TECHNICAL_API_VERIFICATION.md | Verified Astro Content Layer and Sharp API facts. All schema/loader examples in this document conform to those verified APIs. |
| BACKUP_AND_RECOVERY.md | Defines RPO/RTO targets and backup scope for authored content and WEB INGEST MASTERS. |
| FINAL_DESIGN_SPECIFICATION.md | Frozen product authority. This content model serves it; nothing here alters page types, routes, visual system, or interaction design. |
