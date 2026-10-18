# Technical API Verification

**Status:** CANONICAL — external verification record
**Purpose:** Prevents fictional API contracts from re-entering the architecture (TRR-003). Contains only facts necessary to keep examples honest.
**Verification date:** 2026-08-28
**Method:** Current official documentation review. Facts below were checked against docs.astro.build and sharp.pixelplumbing.com at verification time.

Verification policy for all canonical documents:

1. Prefer contract language over code snippets.
2. Any code/config example is either verified against current official docs (then sourced) or explicitly labeled `PSEUDOCODE / CONTRACT EXAMPLE`.
3. No example may be called "tested", "verified against the repository", or "working" — no executable repository evidence exists at the architecture stage.

---

## 1. Astro Content Layer (verified)

Verified against https://docs.astro.build/en/guides/content-collections/ and https://docs.astro.build/en/reference/content-loader-reference/.

| Fact | Verified result |
|---|---|
| Current supported major at verification time | Astro 7 (`astro@7.0.0` marker present in current docs; content collections added in `astro@2.0.0`) |
| Collection definition file | `src/content.config.ts` (build-time collections). The legacy `src/content/config.ts` location is not the current contract. |
| Loader for local YAML | `glob({ pattern, base })` loader. Supports Markdown, MDX, Markdoc, JSON, YAML, TOML sources. |
| `base` location | A relative path or URL to the directory from which the pattern resolves; glob reads "from anywhere on the filesystem". Loading authored YAML directly from `./content/galleries` is supported; no copy into `src/content/` is required. |
| Schema | Optional Zod schema; a collection-level `schema` in `defineCollection` is authoritative over loader-supplied schemas. |
| Entry identity | Each file becomes an entry with an ID unique within the collection; an `id` generator returns a unique string per entry. |
| Loader cardinality | `glob()` treats each matched file as one entry; `file()` is the built-in loader for multiple entries inside one YAML/JSON file. Places are stored one Place object per file, so `glob()` with a singular Place schema is the correct loader; no aggregate or custom flattening loader is used. |
| Legacy `type: 'content'` / `type: 'data'` collections | Not part of the current Content Layer contract; treated as removed legacy syntax. |
| Invented APIs | `astro.config.mjs` `collections.folder` and `getEntryData` do **not** exist. They must not appear except as rejected history. |

Canonical configuration shape (CONTRACT EXAMPLE, API names verified):

```ts
// PSEUDOCODE / CONTRACT EXAMPLE — API names verified against current Astro docs;
// exact version pinned in package.json during P1.
// src/content.config.ts
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';

const galleries = defineCollection({
  loader: glob({ pattern: '**/meta.yaml', base: './content/galleries' }),
  schema: gallerySchema, // Zod schema; see CONTENT_MODEL.md
});

// ONE PLACE = ONE YAML FILE: singular Place schema, one entry per file.
const places = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './content/places' }),
  schema: placeSchema, // singular Place Zod schema; see CONTENT_MODEL.md section 6
});

export const collections = { galleries, places };
```

Version policy: adopt the current supported stable major and pin the exact Astro version plus Node engine in `package.json`/lockfile during P1. Do not write "Astro 6+" as a baseline.

---

## 2. Sharp image API (verified)

Verified against https://sharp.pixelplumbing.com/api-output and https://sharp.pixelplumbing.com/api-colour.

| Fact | Verified result |
|---|---|
| EXIF control | `keepExif()` and `withExif(exif)` exist. `keepMetadata()` and `withMetadata([options])` exist; documented `withMetadata` options include `orientation` and `density` — not a free-form EXIF allowlist. |
| ICC control | `keepIccProfile()` and `withIccProfile(icc, [options])` exist. |
| Color-space conversion | `toColourspace([colourspace])` / `toColorspace([colorspace])` exist; `'srgb'` is a valid target. Default output is web-friendly sRGB. Working space via `pipelineColourspace(...)`. |
| Non-existent APIs | There is **no** `profile()` method. There is **no** Sharp CLI. `z.string().url()` is inappropriate for repository-relative paths, and Zod has no `computed()`. These must not appear except as rejected history. |
| Metadata default | Sharp output drops metadata by default; selective retention requires deliberate, documented use of the methods above. |

Canonical pipeline contract (CONTRACT EXAMPLE, method names verified):

```js
// PSEUDOCODE / CONTRACT EXAMPLE — method names verified against current Sharp docs.
// Conceptual order; exact chaining/config is an implementation benchmark.
sharp(inputPath)
  .rotate()                    // normalize EXIF orientation into pixels
  .toColourspace('srgb')       // transform to target web color space
  .resize({ width, withoutEnlargement: true })
  .jpeg({ quality })           // or webp(...) per encoder benchmark
  // no keepExif()/keepMetadata(): public derivatives carry no EXIF by default
  .toFile(derivativePath);
```

ICC handling at contract level: if a valid source ICC exists, convert to sRGB honoring it; output ICC embedding is a benchmark decision (see IMAGE_PIPELINE.md §ICC policy). Do not claim an API shape beyond the verified names above.

---

## 3. Nginx (contract level)

| Fact | Contract |
|---|---|
| Config composition | Nginx composes config with `include`, not an "import" directive. |
| Static 404 | A static site uses real 404 behavior (`try_files $uri $uri/ =404`), never SPA fallback to `/index.html`. |
| Reload semantics | A symlink target change does not by itself require a reload/restart; reload only when Nginx configuration changes. Verify during implementation. |
| Symlink atomicity | Atomic pointer switch is achieved by creating a temporary symlink and `rename()`-ing it over `current` on the same filesystem. |

---

## 4. Fonts (frozen, no API verification needed)

Frozen families: Source Serif 4, Source Sans 3, Noto Serif SC, Noto Sans SC. No FreeBuffCJK, no generic "Noto Sans CJK", no third family. Subsetting tooling/strategy is an implementation benchmark (see PERFORMANCE_BUDGET.md); invalid `fontTools` command examples must not appear.

---

## 5. Items intentionally not over-researched

- Exact derivative widths, encoder qualities, ICC embedding choice → implementation benchmark (P3).
- Exact CJK subset tooling → implementation benchmark (P1/P4).
- Backup provider/tool → deployment choice (P9).

These are recorded as deferred engineering benchmarks in OPEN_QUESTIONS.md and IMPLEMENTATION_PHASES.md, not as verified APIs.
