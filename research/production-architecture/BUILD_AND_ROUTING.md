# Build and Routing Architecture -- Quiet Editorial Archive

**Status:** CANONICAL -- engineering authority
**Companion documents:** SOURCE_OF_TRUTH_MATRIX.md, CONTENT_MODEL.md, IMAGE_PIPELINE.md, DEPLOYMENT_ARCHITECTURE.md, REPOSITORY_STRUCTURE.md, TECHNICAL_API_VERIFICATION.md
**Design authority:** research/FINAL_DESIGN_SPECIFICATION.md (frozen)

---

## 1. Build DAG (Canonical)

The following producer-before-consumer sequence is the single authoritative build order. Every stage must complete successfully before the next begins. No stage may consume an artifact that has not yet been produced.

```text
AUTHORED PERSISTENT STATE
  Gallery YAML        (content/galleries/{gallery}/meta.yaml)
  Place YAML          (content/places/*.yaml)
  Home settings       (content/site/home.yaml)
  Redirects           (content/redirects.yaml)
  WEB INGEST MASTERS  (media/ingest-masters/{gallery}/...)
        |
        v
REFERENCE + SOURCE VALIDATION
  Schema validation, referential integrity, duplicate detection,
  redirect validation, draft/published enforcement.
  Fail closed on any error in production mode.
        |
        v
IMAGE ANALYSIS / DERIVATION
  Decode, orient, color-transform, resize, encode, hash.
  Output: web derivatives staged under generated/media/.
  Source masters are never mutated.
        |
        v
GENERATED ASSET MANIFEST
  generated/asset-manifest.json
  Contains final public URL paths for every derivative.
  Manifest is complete and self-consistent before proceeding.
        |
        v
ASTRO BUILD
  Consumes asset-manifest.json at BUILD TIME.
  Loads authored YAML via Content Layer glob loader.
  Renders static HTML for published content only (production).
  Outputs to dist/.
        |
        v
ISOLATED FINAL RELEASE ASSEMBLY
  Combines Astro output (dist/) with web derivatives (generated/media/)
  into a single, self-contained release candidate directory.
  Assembly is isolated; neither dist/ nor generated/ is mutated after this point.
        |
        v
INTEGRITY GATE
  Verifies closure: every referenced derivative exists; no source masters
  in public root; no draft routes; no GPS leakage; static 404 present;
  sitemap valid; canonical routes intact.
        |
        v
UPLOAD CANDIDATE RELEASE
  Transfer assembled release to deployment target as a new unique
  release directory. Never mutates the live release.
        |
        v
PRE-SWITCH VERIFY
  Filesystem and optional HTTP smoke checks against the candidate
  release directory, before it becomes current.
        |
        v
ATOMIC POINTER SWITCH
  Capture exact current symlink target.
  Atomically rename temporary symlink over current.
  Record previous target for rollback.
        |
        v
POST-SWITCH SMOKE
  Verify live site responds correctly at the public URL.
        |
        v
ROLLBACK EXACT PREVIOUS TARGET ON FAILURE
  If post-switch smoke fails, restore the captured previous target.
```

### Architectural invariants

- Astro must never need a manifest that does not yet exist. The asset manifest is produced before Astro build begins.
- The browser does not consume the asset manifest at runtime. Astro consumes it during build.
- Image derivation does not depend on mutating Astro's final build directory. Derivatives are staged under `generated/media/` and assembled into the release independently.
- `dist/` has exactly one owner: the Astro/assembly step. No other pipeline stage writes into `dist/`.
- Final assembly is isolated and complete before any deployment action.

---

## 2. Dist Ownership Invariant

| Directory | Owner | Writes |
|---|---|---|
| `generated/media/` | Image pipeline | Web derivatives (staging) |
| `generated/asset-manifest.json` | Image pipeline | Derivative metadata with final public paths |
| `dist/` | Astro build | Static HTML, CSS, JS, fonts |
| Release candidate directory | Assembly step | Combined Astro output + web derivatives |
| Live release (`current` symlink target) | Deployment process | Atomic pointer switch only |

No pipeline stage writes into another stage's directory. The image pipeline produces its outputs entirely under `generated/`. Astro reads from `generated/asset-manifest.json` and `content/` but never writes to `generated/`. The assembly step reads from both `dist/` and `generated/media/` to produce a combined release, but mutates neither.

This invariant prevents the failure mode where Astro clears `dist/` and destroys pre-built derivatives (RT-002, TRR-002).

---

## 3. Astro Content Architecture

### Current Astro Content Layer

Astro collections are defined in `src/content.config.ts` using `defineCollection` with a `glob` loader. The loader's `base` parameter points directly at the authored external content root, so Astro loads YAML from `content/galleries/` without any copy or mirror.

PSEUDOCODE / CONTRACT EXAMPLE -- API names verified against current Astro docs (see TECHNICAL_API_VERIFICATION.md):

```ts
// src/content.config.ts
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { gallerySchema, placeSchema } from './content-schemas';

const galleries = defineCollection({
  loader: glob({ pattern: '**/meta.yaml', base: './content/galleries' }),
  schema: gallerySchema,
});

const places = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './content/places' }),
  schema: placeSchema,
});

export const collections = { galleries, places };
```

Key facts (verified; see TECHNICAL_API_VERIFICATION.md section 1):

- Collection definition file: `src/content.config.ts` (not `src/content/config.ts`).
- Loader: `glob({ pattern, base })` supports YAML from anywhere on the filesystem.
- `base` accepts a relative path; `./content/galleries` is valid.
- Schema: collection-level Zod schema in `defineCollection`.
- Each file becomes one entry with a unique ID within the collection.
- Legacy `type: 'content'` / `type: 'data'` syntax is removed and must not appear.
- `astro.config.mjs` `collections.folder` and `getEntryData` do not exist and must not appear.

Place cardinality is frozen by CONTENT_MODEL.md section 6: **one Place object per `content/places/{place}.yaml` file**. The Place collection therefore uses the same `glob()` loader with a singular Place schema; each file becomes exactly one collection entry. Astro's `file()` aggregate loader, multi-Place YAML arrays, and custom flattening loaders are not used.

Version policy: adopt the current supported stable major. Pin the exact Astro version and Node engine in `package.json` and lockfile during P1. Do not write "Astro 6+" as a baseline.

### Single authored source

Authored Gallery YAML lives in `content/galleries/{gallery}/meta.yaml`. This is the only authored source. There is no `src/content/galleries/` copy, mirror, or auto-copy step. One authored source eliminates divergence between what the author edits and what Astro renders (RT-003).

Home settings (`content/site/home.yaml`) and redirects (`content/redirects.yaml`) are loaded separately, either through additional collections or direct file reads at build time. Their loading mechanism is an implementation choice; their authored location is fixed.

---

## 4. Canonical Route Table

Routes are frozen by FINAL_DESIGN_SPECIFICATION.md section 1.3.

| Route | Page template | Generated by | Notes |
|---|---|---|---|
| `/` | `src/pages/index.astro` | Astro static build | Home: hero + recent galleries |
| `/archive` | `src/pages/archive.astro` | Astro static build | Chronological index by year |
| `/places` | `src/pages/places.astro` | Astro static build | Geographic index by name |
| `/places/{slug}` | `src/pages/places/[slug].astro` | Astro `getStaticPaths` | Place detail; galleries grouped by year |
| `/galleries/{slug}` | `src/pages/galleries/[slug].astro` | Astro `getStaticPaths` | Gallery viewing unit |
| `/about` | `src/pages/about.astro` | Astro static build | Informational text page |
| `/404` | `src/pages/404.astro` | Astro static build | Custom 404 page |

### Route constraints

- Gallery route is `/galleries/{slug}` ONLY. No root-level gallery slugs. No `/archive/galleries`. No `/gallery/{name}` drift.
- Place route is `/places/{slug}` ONLY.
- `getStaticPaths` for Gallery and Place pages generates only published entries in production builds.
- Sitemap includes only published routes.

### Static 404 behavior

The site uses real static 404 behavior. Nginx configuration uses `try_files $uri $uri/ =404`. There is no SPA fallback to `/index.html` for missing routes. The site is not a single-page application.

---

## 5. Redirect Lifecycle

### Authority model (UD-008)

Gallery YAML `slug` is the only current-slug authority. `content/redirects.yaml` stores historical path aliases only. There is no second slug registry.

### Redirect storage

`content/redirects.yaml` maps old paths to their current targets. Each entry carries **exactly one target type: `gallery_id` XOR `place_id`**, covering historical Gallery and Place aliases.

```yaml
# PSEUDOCODE / CONTRACT EXAMPLE
/galleries/old-lofoten:
  gallery_id: g_lofoten_light

/places/old-reine:
  place_id: pl_reine
```

Redirect entries reference stable IDs (Gallery ID, Place ID), not current slugs. At build time, the pipeline resolves each target ID to its current slug to produce the redirect destination.

### Validation rules

The production build validates redirects and fails closed on violations:

- The old path is historical only: it must not equal any current canonical path.
- Exactly one target type per entry (`gallery_id` XOR `place_id`).
- Target Gallery or Place exists.
- Target Gallery or Place resolves to a public/published canonical route in production output.
- No redirect loops (A -> B -> A or longer chains).
- No duplicate entries for the same old path.
- No redirect target that is itself a redirect source.
- No route collision between redirect destinations and canonical routes.

### Output strategy (canonical delivery)

The canonical delivery strategy is a **generated Nginx redirect `include`** containing HTTP 301 (`return 301`) directives, produced from the validated redirect entries. Static meta-refresh HTML pages are NOT a canonical redirect strategy in this architecture; they do not share real 301 status, cache, or rollback semantics.

Redirect configuration lifecycle (deployment-side detail in DEPLOYMENT_ARCHITECTURE.md section 3.3):

```text
content/redirects.yaml
  -> build validation (rules above)
  -> generated redirect config (Nginx include)
  -> candidate config verification alongside the release candidate
  -> nginx -t before activation
  -> activate alongside the candidate release
  -> reload only when the Nginx redirect config changed
  -> post-switch HTTP redirect smoke
  -> rollback the exact previous release AND the exact previous redirect config on failure
```

- Content-only release with no redirect config change: **no Nginx reload required**.
- Redirect config change: **`nginx -t` + reload required**, coupled to candidate release activation.

Place aliases follow the same lifecycle as Gallery aliases.

---

## 6. Draft and Published Build Behavior (UD-009)

### Publication state mechanism

Exactly one mechanism controls publication state:

```yaml
status: draft      # or
status: published
```

No directory-partition semantics (`_draft-*`, `drafts/`, `published/`) are used. No filename-prefix conventions. Status field only.

### Production build (published only)

In production mode, the build includes only published Galleries:

- Public routes generated only for published Galleries and Places.
- Sitemap contains only published routes.
- Archive, Places, and Home indexes include only published Galleries.
- `next_gallery_id` must resolve to a published Gallery. A dangling or draft target in production is a build error.
- Cover photo required for every published Gallery.

### Local preview mode

Local development (`astro dev`) may include draft content for editorial preview. Draft Galleries may temporarily omit `cover_photo_id` and `published_at` in preview mode. Draft routes are clearly distinguished (e.g., visual indicator or local-only prefix) to prevent confusion with production output.

### Mode selection

Build mode is determined by environment configuration, not by content inspection. Production builds fail closed; they do not silently skip broken published content.

---

## 7. Content Validation Summary

The production build performs comprehensive validation and fails closed on any error. The full validation checklist is defined in CONTENT_MODEL.md. Key categories enforced at build time:

**Identity and uniqueness:**
- Duplicate Gallery ID (globally).
- Duplicate Gallery slug (route namespace).
- Duplicate Photo ID (globally across the archive).
- Duplicate Place ID or Place slug.

**Referential integrity:**
- Photo `source_ref` resolves to an existing WEB INGEST MASTER.
- `cover_photo_id` references a Photo within the same Gallery.
- `places[]` references valid Place IDs.
- `next_gallery_id` references an existing Gallery; not self; published in production.
- Redirect targets (`gallery_id` XOR `place_id`) exist and resolve to public/published canonical routes.

**Completeness:**
- Published Gallery requires `cover_photo_id`, `published_at`, valid status.
- Non-empty `photos[]` array.
- All derivatives present for every Photo in published Galleries.

**Consistency:**
- Canonical route collisions detected.
- Redirect old path does not match any current canonical path.
- No redirect loops.
- Invalid status values rejected.

**Privacy:**
- No GPS data in sampled/automated derivative checks.
- No source masters in public output.

Warnings may exist for drafts and local preview only where explicitly defined. Production builds never warn-and-continue for published content defects.

See CONTENT_MODEL.md for the complete schema and validation specification.

---

## 8. Integrity Gate Checks

After final release assembly and before upload, the integrity gate verifies:

1. **Index existence:** Home page (`index.html`) exists in the assembled release.
2. **Canonical route output:** Every published Gallery and Place has a corresponding HTML file at its canonical path.
3. **Asset manifest closure:** Every derivative URL referenced in the assembled HTML exists as a file in the release.
4. **No source masters:** No WEB INGEST MASTER or CAMERA ORIGINAL files appear in the public release root.
5. **No draft routes:** No HTML pages exist for draft-only Galleries or Places.
6. **No GPS leakage:** Automated sampling confirms no GPS coordinates in public derivative EXIF/metadata.
7. **Static 404:** A 404 page exists; Nginx configuration serves it for unmatched paths.
8. **Sitemap validity:** Sitemap contains only published canonical URLs.
9. **Redirect integrity:** Every redirect target resolves to an existing published page in the release.

Failure of any check blocks deployment. The integrity gate runs against the assembled release candidate, not against intermediate build artifacts.

---

## 9. Local Preview vs Production Modes

| Aspect | Local preview (`astro dev`) | Production build |
|---|---|---|
| Draft Galleries | Included; may lack cover/published_at | Excluded from all output |
| Published Galleries | Included | Included; full validation enforced |
| Validation severity | Warnings for incomplete drafts | Fail closed on any published defect |
| Routes generated | All (draft + published) | Published only |
| Sitemap | May include drafts for testing | Published only |
| next_gallery resolution | May target draft for preview | Must target published; error otherwise |
| Derivative generation | May be partial/lazy | Complete coverage required |
| Asset manifest | May be incomplete | Complete and closure-verified |
| Integrity gate | Not required | Mandatory before deployment |

Both modes share the same build DAG. The difference is filtering strictness and completeness requirements, not pipeline structure.

---

## 10. Asset Manifest Contract

`generated/asset-manifest.json` is produced by the image pipeline before Astro build. It contains, for each Photo, enough data to render responsive images without further computation:

- `photo_id` -- stable authored Photo ID.
- Derivative entries per purpose (display, overview, cover), each containing:
  - `format` (e.g., `jpeg`, `webp`, `avif` — production formats decided by P3 benchmark)
  - `width`, `height` (intrinsic pixel dimensions)
  - `public_url` (final public path, ready for HTML attributes)
  - `bytes` (file size)
  - `source_hash` (integrity fingerprint of source master)
  - `derivative_hash` (content-addressed fingerprint of derivative)

Manifest paths are final public paths. Astro reads them at build time and embeds them directly into HTML `src`, `srcset`, and `sizes` attributes. No runtime path transformation or regex-based width extraction occurs.

For the full manifest schema and derivation rules, see IMAGE_PIPELINE.md.

---

## 11. Cross-References

- **Source-of-truth ownership:** SOURCE_OF_TRUTH_MATRIX.md
- **Content schema and validation details:** CONTENT_MODEL.md
- **Image pipeline stages, ICC policy, privacy stripping:** IMAGE_PIPELINE.md
- **Deployment flow, atomic switch, rollback:** DEPLOYMENT_ARCHITECTURE.md
- **Repository layout and directory ownership:** REPOSITORY_STRUCTURE.md
- **Verified framework/tool APIs:** TECHNICAL_API_VERIFICATION.md
- **Backup boundaries (what requires off-site backup):** BACKUP_AND_RECOVERY.md

---

**END OF BUILD AND ROUTING ARCHITECTURE**
