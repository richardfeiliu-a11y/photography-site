# Repository Structure -- Quiet Editorial Archive

**Status:** CANONICAL -- engineering authority
**Companion documents:** SOURCE_OF_TRUTH_MATRIX.md, BUILD_AND_ROUTING.md, CONTENT_MODEL.md, BACKUP_AND_RECOVERY.md
**Design authority:** research/FINAL_DESIGN_SPECIFICATION.md (frozen)

---

## 1. Canonical Annotated Tree

```text
photography/
|
|-- src/                                    # Astro application source
|   |-- components/                         # UI components (Gallery, Discovery, Layout, shared)
|   |-- layouts/                            # Page layout wrappers
|   |-- pages/                              # Route templates
|   |   |-- index.astro                     # Home (/)
|   |   |-- archive.astro                   # Archive (/archive)
|   |   |-- places.astro                    # Places index (/places)
|   |   |-- places/
|   |   |   +-- [slug].astro                # Place detail (/places/{slug})
|   |   |-- galleries/
|   |   |   +-- [slug].astro                # Gallery (/galleries/{slug})
|   |   |-- about.astro                     # About (/about)
|   |   +-- 404.astro                       # Custom 404
|   |-- styles/                             # Global CSS, design tokens
|   |-- content.config.ts                   # Astro Content Layer collection definitions
|   +-- content-schemas.ts                  # Zod schemas for collections (optional location)
|
|-- content/                                # AUTHORED METADATA (Git-tracked, single source)
|   |-- galleries/                          # Gallery YAML (one directory per Gallery)
|   |   +-- {gallery}/
|   |       +-- meta.yaml                   # Gallery metadata, photo sequence, cover, next
|   |-- places/                             # Place YAML (one file per Place)
|   |   +-- {place}.yaml
|   |-- site/                               # Site-level editorial settings
|   |   +-- home.yaml                       # Featured gallery, Home configuration
|   +-- redirects.yaml                      # Historical path aliases only
|
|-- media/                                  # MEDIA ROOT
|   +-- ingest-masters/                     # WEB INGEST MASTERS (pipeline source)
|       +-- {gallery}/                      # Organized by gallery folder name
|           +-- DSC02762.jpg                # High-quality export; non-regenerable
|
|-- generated/                              # REGENERABLE OUTPUT (not committed)
|   |-- asset-manifest.json                 # Derivative metadata with final public paths
|   +-- media/                              # Web derivatives (staging area)
|       +-- {gallery}/
|           +-- p_reine_001-800w.webp      # Example derivative (format illustrative; production formats decided in P3)
|
|-- tests/                                  # Test definitions and baselines
|   |-- capture/                            # Playwright test scripts
|   +-- baselines/                          # Visual regression reference screenshots
|
|-- public/                                 # Static assets copied verbatim to release
|   |-- fonts/                              # Self-hosted web fonts
|   |   |-- source-serif-4/
|   |   |-- source-sans-3/
|   |   |-- noto-serif-sc/
|   |   +-- noto-sans-sc/
|   |-- favicon.ico
|   +-- robots.txt
|
|-- dist/                                   # ASTRO BUILD OUTPUT (not committed)
|                                           # One owner: the Astro/assembly step
|
|-- research/                               # Design specifications and architecture docs
|   |-- FINAL_DESIGN_SPECIFICATION.md
|   +-- production-architecture/            # This document set
|
|-- scripts/                                # Build tooling (validation, derivation, deploy)
|-- .gitignore
|-- astro.config.mjs                        # Astro framework configuration
|-- package.json                            # Dependencies, exact version pins
|-- tsconfig.json
+-- README.md
```

### Explicit prohibitions

- **No `src/content/galleries/` mirror.** Authored YAML lives in `content/galleries/` only. Astro loads it directly via the Content Layer glob loader with `base: './content/galleries'`. No copy, sync, or auto-copy step exists (RT-003).
- **No persistent generated identity registry.** `generated/photo-identities.json` is not an identity authority. Stable Photo identity lives in authored Gallery YAML (`photos[].id` + `photos[].source_ref`). Any generated photo index is a derived view only (UD-001, RT-001).
- **No `media/originals/` as pipeline input.** The canonical WEB INGEST MASTER root is `media/ingest-masters/`. CAMERA ORIGINALS and ARCHIVAL MASTERS live in external archival storage (UD-005).
- **No absolute paths in authored content.** `source_ref` is relative to `media/ingest-masters/`. Host-specific mount points are environment configuration, never embedded in YAML (section 5 below).

---

## 2. Directory Ownership and Authority Table

| Directory / File | Owner (who writes) | Git-tracked? | Regenerable? | Off-site backup? | Notes |
|---|---|---:|---:|---:|---|
| `src/` | Developer | Yes | No | Yes (via Git remote) | Astro application code |
| `content/galleries/` | Content author | Yes | No | Yes (via Git remote) | Single authored Gallery source |
| `content/places/` | Content author | Yes | No | Yes (via Git remote) | Place definitions |
| `content/site/home.yaml` | Content author | Yes | No | Yes (via Git remote) | Featured gallery, Home settings |
| `content/redirects.yaml` | Content author | Yes | No | Yes (via Git remote) | Historical path aliases |
| `media/ingest-masters/` | Photographer / ingest workflow | Not required | No | **Yes (required)** | Pipeline source; VPS never sole copy |
| `generated/` | Image pipeline | No | Yes | No | Deletable; clean build recovers |
| `dist/` | Astro build | No | Yes | No | One owner: Astro/assembly step |
| `public/` | Developer | Yes | No | Yes (via Git remote) | Fonts, favicon, robots.txt |
| `tests/` | Developer / QA | Yes | No | Yes (via Git remote) | Test scripts and baselines |
| `scripts/` | Developer | Yes | No | Yes (via Git remote) | Build/deploy tooling |
| `research/` | Architecture / product | Yes | No | Yes (via Git remote) | Read-only for implementation |

For complete ownership semantics including validation and regeneration rules, see SOURCE_OF_TRUTH_MATRIX.md.

---

## 3. Git-Tracked vs Not-Git-Tracked Boundaries

### Tracked in Git

Everything that is authored, non-regenerable, or defines the application:

- `src/` -- all application source code
- `content/` -- all authored YAML (galleries, places, home settings, redirects)
- `public/` -- static assets (fonts, favicon, robots.txt)
- `tests/` -- test definitions and baselines
- `scripts/` -- build and deployment tooling
- `research/` -- design specs and architecture documentation
- Root configuration files (`package.json`, `astro.config.mjs`, `tsconfig.json`, `.gitignore`)

### Not tracked in Git (regenerable)

- `generated/` -- asset manifest, web derivatives. Entirely regenerable from authored state + ingest masters. Deleting `generated/` must be recoverable by a clean build.
- `dist/` -- Astro build output. Regenerable by running the build.

### Not tracked in Git (non-regenerable, externally backed up)

- `media/ingest-masters/` -- WEB INGEST MASTERS. These are the non-regenerable pipeline source images. They may be present on the build host via filesystem mount, symlink, or direct copy. Their presence in Git is NOT required. Backup architecture covers them independently (see BACKUP_AND_RECOVERY.md).
- CAMERA ORIGINALS / ARCHIVAL MASTERS -- external archival storage, outside this repository entirely.

### `.gitignore` boundaries (contract level)

At minimum, `.gitignore` excludes:

- `generated/` -- regenerable pipeline output
- `dist/` -- regenerable build output
- Release staging directories (if used locally)
- `node_modules/` -- dependency installation artifact
- Environment files containing secrets (`.env.*` with credentials)

`media/ingest-masters/` may be excluded from Git. Its backup is handled by the off-site encrypted backup architecture, not by version control. Whether it is gitignored or simply absent from the working tree on some hosts is an environment choice; the architectural requirement is that it is backed up and available at build time.

---

## 4. Media Root and External Mount Note

### Canonical media root

The single canonical root for WEB INGEST MASTERS is:

```text
media/ingest-masters/{gallery}/{filename}
```

All architecture documents use this path consistently. Alternate names (`media/originals/`, `media/archival/`, `content/galleries/photos/`, `media/ingest/`, `assets-staging/`) are not used as ingest roots.

### source_ref is relative

Authored Gallery YAML references images via `source_ref`, which is relative to `media/ingest-masters/`:

```yaml
# PSEUDOCODE / CONTRACT EXAMPLE
photos:
  - id: p_reine_001
    source_ref: lofoten-light/DSC02762.jpg
```

Absolute host paths (e.g., `/Volumes/archive/...`) never appear in authored YAML. The mapping from the logical `media/ingest-masters/` path to a physical filesystem location is environment configuration.

### External mount on build hosts

On the VPS or CI build host, `media/ingest-masters/` may be:

- A symlink to an externally mounted filesystem.
- A bind mount or network mount.
- A directory populated by a pre-build sync step.
- Present directly if the repository checkout includes it.

The architecture does not prescribe which mechanism is used. The contract is: at build time, every `source_ref` in published Galleries must resolve to an existing file under `media/ingest-masters/`. If it does not, the production build fails closed.

### External archival storage

CAMERA ORIGINALS and ARCHIVAL MASTERS reside in external archival storage separate from this repository. They are not consumed by the website image pipeline directly. The WEB INGEST MASTER is a high-quality export derived from the archival workflow specifically for website use. See SOURCE_OF_TRUTH_MATRIX.md section 1 for media class definitions.

---

## 5. Generated Directory Semantics

`generated/` contains entirely regenerable artifacts:

| Artifact | Purpose | Producer | Consumer |
|---|---|---|---|
| `asset-manifest.json` | Derivative metadata with final public URLs | Image pipeline | Astro build (build-time) |
| `media/` | Staged web derivatives | Image pipeline | Assembly step (combined into release) |

Key properties:

- **Deletable.** Removing the entire `generated/` directory must be safe. A clean build reproduces everything.
- **Rebuildable.** Running the full build DAG from scratch produces identical logical output (semantic determinism; see IMAGE_PIPELINE.md for determinism policy).
- **Not committed.** `generated/` is excluded from Git. No durable backup is needed.
- **Not an identity authority.** No file under `generated/` is the primary source of record for Photo identity, Gallery slug, or any other persistent concept. Generated state is always a derived view.
- **Single-owner directories.** Each subdirectory and file has exactly one producer. No two pipeline stages write to the same generated path.

---

## 6. Terminology Reference

These four media classes are used precisely across all architecture documents:

| Class | Definition | Location | Regenerable? |
|---|---|---|---:|
| CAMERA ORIGINAL | RAW/JPEG as captured by camera | External archival storage | No |
| ARCHIVAL MASTER | Long-term preservation master | External archival storage | No |
| WEB INGEST MASTER | Non-regenerable pipeline source image | `media/ingest-masters/` | No |
| WEB DERIVATIVE | Regenerable responsive output | `generated/media/`, release dirs | Yes |

Never describe WEB INGEST MASTERS as generated or ephemeral. Never describe WEB DERIVATIVES as source of truth.

---

## 7. Cross-References

- **Source-of-truth ownership matrix:** SOURCE_OF_TRUTH_MATRIX.md
- **Content schema, validation rules, data model:** CONTENT_MODEL.md
- **Build DAG, routing, Astro content architecture:** BUILD_AND_ROUTING.md
- **Image pipeline stages, derivation, hashing:** IMAGE_PIPELINE.md
- **Deployment flow, atomic switch, rollback:** DEPLOYMENT_ARCHITECTURE.md
- **Backup boundaries, RPO/RTO, recovery scenarios:** BACKUP_AND_RECOVERY.md
- **Verified framework/tool APIs:** TECHNICAL_API_VERIFICATION.md

---

**END OF REPOSITORY STRUCTURE**
