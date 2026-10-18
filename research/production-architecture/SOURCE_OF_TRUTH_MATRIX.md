# Source-of-Truth Matrix — Canonical Ownership

**Status:** CANONICAL — engineering authority
**Companion to:** CONTENT_MODEL.md, REPOSITORY_STRUCTURE.md, BACKUP_AND_RECOVERY.md
**Rule:** Exactly one canonical owner per persistent concept. Where this matrix and any other document appear to disagree, this matrix wins and the other document is stale.

This matrix makes implementation ambiguity impossible. Every persistent concept below has exactly one owner, one location, and an explicit answer to: is it in Git, is it backed up off-site, can it be regenerated, and how is it validated.

---

## 1. Media terminology (canonical)

These four classes are used precisely across all architecture documents. Do not collapse them.

| Class | Definition | Location | Regenerable? | Backed up off-site? |
|---|---|---|---:|---:|
| CAMERA ORIGINAL | RAW/JPEG exactly as captured by the camera. May live outside the website repository/storage. Not necessarily directly ingestible. | External archival storage | No | Yes (archival) |
| ARCHIVAL MASTER | Long-term preservation master; equals camera original or edited master per photographer workflow. Outside public site output. | External archival storage | No | Yes (archival) |
| WEB INGEST MASTER | The non-regenerable image input consumed by the website image pipeline (e.g. a high-quality JPEG exported from the archival workflow). Production pipeline source. **Never describe as generated or ephemeral.** | `media/ingest-masters/{gallery}/` | No | **Yes (required)** |
| WEB DERIVATIVE | Regenerable responsive output (JPEG/WebP/etc). Never a source of truth. Never manually edited. | `generated/media/` (build), release dirs | Yes | No |

**Single canonical media root for WEB INGEST MASTERS:** `media/ingest-masters/`. All documents use this path. `media/originals/`, `media/archival/`, `content/galleries/photos/`, `media/ingest/`, and `assets-staging/` are not used as alternate ingest roots.

`source_ref` is relative to `media/ingest-masters/`. Absolute host paths (e.g. `/Volumes/...`) never appear in authored YAML; mount/symlink placement is environment configuration.

---

## 2. Persistent authored state (Git-tracked source of truth)

Everything in this section is authored, version-controlled, and the single owner of its concept.

| Concept | Canonical owner | Location | Git? | Off-site backup? | Regenerable? | Validation |
|---|---|---|---:|---:|---:|---|
| Gallery ID | Gallery YAML | `content/galleries/{gallery}/meta.yaml` `id` | Yes | Yes | No | Globally unique; stable; `g_` prefix recommended |
| Current Gallery slug | Gallery YAML | `meta.yaml` `slug` | Yes | Yes | No | Unique in Gallery route namespace; decoupled from ID |
| Gallery status | Gallery YAML | `meta.yaml` `status` | Yes | Yes | No | Enum `draft` / `published`; only mechanism for publication state |
| Gallery title | Gallery YAML | `meta.yaml` `title` | Yes | Yes | No | Non-empty |
| Gallery description (optional) | Gallery YAML | `meta.yaml` `description` | Yes | Yes | No | ≤ 2–3 lines per frozen design |
| Photographed dates | Gallery YAML | `meta.yaml` `photographed_start` / `photographed_end` | Yes | Yes | No | ISO; `start ≤ end`; distinct from publication time |
| Published time | Gallery YAML | `meta.yaml` `published_at` | Yes | Yes | No | Required for `published`; **never derived** from EXIF/mtime/Git/folder |
| Place references | Gallery YAML | `meta.yaml` `places[]` | Yes | Yes | No | Each references a valid Place ID |
| Cover | Gallery YAML | `meta.yaml` `cover_photo_id` | Yes | Yes | No | Required for published; references Photo in same Gallery |
| next_gallery | Gallery YAML | `meta.yaml` `next_gallery_id` | Yes | Yes | No | References stable Gallery ID (not slug); exists; published in prod; `!= self`; cycles allowed |
| Photo sequence | Gallery YAML | `meta.yaml` `photos[]` order | Yes | Yes | No | Non-empty; ordering = array order |
| Photo ID | Gallery YAML photo item | `photos[].id` | Yes | Yes | No | Globally unique across the archive |
| Photo → source binding | Gallery YAML photo item | `photos[].source_ref` | Yes | Yes | No | Resolves to an existing WEB INGEST MASTER |
| Caption | Gallery YAML photo item | `photos[].caption` | Yes | Yes | No | Optional; explicit `null` allowed |
| Rhythm | Gallery YAML photo item | `photos[].rhythm_after` | Yes | Yes | No | Enum `base` / `compact` / `breathing` (no `spacious`) |
| Alt text (schema support) | Gallery YAML photo item | `photos[].alt_text` | Yes | Yes | No | Optional; not filename; not auto-caption |
| Place ID/slug/name | Place YAML (one Place per file) | `content/places/{place}.yaml` | Yes | Yes | No | ID globally unique; slug unique in Place namespace; one Place object per file |
| Featured Gallery | Home settings | `content/site/home.yaml` `featured_gallery_id` | Yes | Yes | No | Optional; resolves to a published Gallery or `null` |
| Historical URLs | Redirects | `content/redirects.yaml` | Yes | Yes | No | Historical Gallery/Place aliases only; `gallery_id` XOR `place_id`; target exists and resolves to a published canonical route; no loops; not current slug |

**Global uniqueness policy:** Gallery IDs, Photo IDs, and Place IDs are each globally unique. Slugs are unique within their route namespace (`/galleries/{slug}`, `/places/{slug}`). This keeps generated indexes and references unambiguous.

---

## 3. External non-regenerable state (outside Git, must be backed up)

| Asset | Location | Git? | Off-site backup? | Regenerable? | Notes |
|---|---|---:|---:|---:|---|
| WEB INGEST MASTERS | `media/ingest-masters/{gallery}/` | No (not required) | **Yes — required** | No | Pipeline source; VPS must never be the only copy |
| CAMERA ORIGINALS / ARCHIVAL MASTERS | External archival storage | No | **Yes — required** | No | Retained per photographer workflow |
| Git repository + remote | Hosted remote | — | Yes (remote) | No | Source code, authored YAML, settings, redirects, tests, docs |

Git tracks source code, authored YAML, site settings, redirects, tests, and architecture docs. Git/Git-LFS is **not** the photographic archive. Git LFS may be discussed only as an optional later transport choice, never the canonical baseline.

---

## 4. Generated state (regenerable, no durable backup needed)

Derived from authored state + ingest masters. Deleting `generated/` must be recoverable by a clean build.

| Concept | Canonical owner | Location | Git? | Backup? | Regenerable? | Validation |
|---|---|---|---:|---:|---:|---|
| Dimensions / intrinsic size | generated | pipeline extraction | No | No | Yes | Decoded from WEB INGEST MASTER |
| Orientation | generated | pipeline extraction | No | No | Yes | Auto-orient applied before derivation |
| EXIF metadata | generated/read | pipeline extraction | No | No | Yes | Read then stripped from public output |
| ICC metadata | generated/read | pipeline extraction | No | No | Yes | Drives sRGB transform decision |
| Source hash | generated | pipeline hash | No | No | Yes | Integrity/revision metadata, **not** Photo identity |
| Derivative URLs / srcset | generated manifest | `generated/asset-manifest.json` | No | No | Yes | Final public paths; closure checked |
| Photo index (if any) | derived view only | generated | No | No | Yes | **Not** an identity authority |
| Reverse relationships / prev | derived at build | build | No | No | Yes | Derived from `next_gallery_id`; **never authored** |
| Asset manifest | generated | `generated/asset-manifest.json` | No | No | Yes | Produced before Astro consumes it |

**Identity invariant:** Stable photo identity lives in authored Gallery YAML (`photos[].id` + `photos[].source_ref`). Generated state must never be the only place a stable identity exists. `generated/photo-identities.json` is not an identity authority.

---

## 5. Build output (regenerable, rollback cache)

| Artifact | Location | Git? | Backup? | Regenerable? | Notes |
|---|---|---:|---:|---:|---|
| Astro `dist/` | `dist/` | No | No | Yes | One owner: the Astro/assembly step |
| HTML / routes | `dist/` | No | No | Yes | Generated from authored state + manifest |
| Final release directories | remote `/srv/.../releases/*` | No | No | Yes | Atomic rollback cache, **not** a backup |

---

## 6. Forbidden duplicate authorities

The following duplicate-source patterns are prohibited. Any document that reintroduces them is stale.

- A generated registry (e.g. `generated/photo-identities.json`) as the primary Photo identity/source-of-record.
- A second current-slug registry alongside Gallery YAML `slug`.
- Both a Gallery `status` field **and** directory-partition draft semantics (`_draft-*`, `drafts/`, `published/`).
- A per-Gallery `featured: true/false` field alongside `content/site/home.yaml`.
- Duplicate `source_file` + `location` fields describing the same Photo→source binding.
- An authored `prev_gallery` field alongside `next_gallery_id`.
- Deriving `published_at` from EXIF capture time, photographed date, file mtime, Git timestamp, or folder name.
- A silent first-Photo default for a published Gallery cover.
