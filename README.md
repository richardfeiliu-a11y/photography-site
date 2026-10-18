# Photography

Personal photographic archive / online exhibition — a static Astro site, live at **https://gallery.mintnode.de**.

Thirteen curated journeys, 180 photographs and a places index, shown as one continuous body of work: photographs are never cropped and never framed; every page is tinted by the cover it opens with.

## Design

Immersive Viewing (2026-10-18):

- **Ambient fields** — each page's background is derived from the dominant colour of the cover it opens with (computed at build time, OKLCH).
- **Day / Night / System** — two concrete themes resolved from a three-choice control; the first visit follows the system.
- **One plate measure** — a photograph always spans the sequence column; the aspect decides the height. Never cropped.
- **Soft edges** — a 1px rim plus a wide, low-opacity shadow carry every photograph on the field.
- **Mono catalogue metadata** — dates, places, counts, captions and labels speak in a monospaced uppercase voice; titles stay serif.

## Repository layout

| Path | Contents |
| --- | --- |
| `src/` | Astro site: pages, layouts, components, styles, view/data libraries |
| `content/` | Authored YAML: galleries, places, site settings (the content source of truth) |
| `media/ingest-masters/` | Source photographs — **not in Git** (local only, backed up separately) |
| `generated/` | Media derivatives, manifests, atmosphere sidecar — not in Git, regenerated |
| `scripts/` | Media pipeline, content/release validation, regression runner |
| `tests/` | unit · integration · e2e · a11y · capture + governed visual baselines |
| `research/` | Frozen architecture/product corpus — read-only |
| `deploy/` | Environment template for self-hosted drills (production runs on Cloudflare Pages) |

> This public snapshot deliberately excludes the private working docs, session archives and operational notes of the authoring repository. Two data files that the build/tests actually read (`docs/implementation/PERF-BASELINE.json`, `docs/implementation/decisions/BENCHMARK-OQ01-OQ02.md`) are kept for that reason.

## Quick start

Requires Node `>=22.12.0 <23`.

```sh
npm ci
npm run dev            # http://localhost:4321
```

`npm run dev` serves only `public/`, so photographs (built by the media pipeline into `generated/media/`) are missing until you either run the pipeline and expose it locally, or preview an assembled release:

```sh
npm run build:media    # media pipeline + production build (slow on a cold cache)
```

### What works without the photo masters

The source photographs are private, and the content gate is fail-closed: every `source_ref` must resolve to a real ingest master under `media/ingest-masters/`. A fresh clone therefore cannot run the full build.

| Command | Without masters |
| --- | --- |
| `npm run dev` | ✅ pages render (photographs missing) |
| `npm run check` | ✅ |
| `npm run test:unit` | ✅ 482/483 (one test runs a real build and needs the masters) |
| `npm run validate:content` | ❌ source-ref resolution |
| `npm run build` · `build:media` · `capture` | ❌ source-ref resolution / media pipeline |

This is deliberate: the gate that protects the production corpus is the same gate that makes an incomplete clone fail. The repository is a source snapshot, not a self-contained distribution.

## Common commands

| Command | Purpose |
| --- | --- |
| `npm run build` | Production build (four fail-closed gates: content, asset manifest, font coverage, QA probe) |
| `npm run build:media` | Media pipeline + build — the deployable output |
| `npm run validate:content` | Content/schema validation (production mode) |
| `npm run check` | Astro type-check + ESLint |
| `npm run test:unit` · `test:integration` · `test:e2e` · `test:a11y` | Test layers |
| `npm run test:regression` | The full serial gate: check → unit → integration → e2e → a11y → build → preview |
| `npm run capture` · `capture:determinism` · `baseline:update` · `capture:diff` | Governed visual-baseline workflow |

## Media pipeline and privacy

Discover → extract → derive → privacy-check → manifest → atmosphere. The privacy check is **fail-closed**: published bytes may not contain GPS, serial numbers, EXIF/XMP/IPTC or ICC payloads. Derivatives are content-addressed and regenerated deterministically.

## Visual regression governance

`tests/baselines/` holds 14 governed screenshots and is **never updated automatically**; an intentional visual change is an *approved design update* that must go through capture → determinism → approval → `baseline:update` → diff. See `tests/baselines/README.md`.

## Deployment

Production is Cloudflare Pages. Releases build from `main` (never reuse an old package), pass the nine release gates, then deploy with `wrangler pages deploy`; see [`DEPLOYMENT.md`](DEPLOYMENT.md).

## License

No license is granted; all photographs and text are the author's work. Do not reuse without permission. Bundled fonts remain under their own licenses (see `public/fonts/*/LICENSE*`).
