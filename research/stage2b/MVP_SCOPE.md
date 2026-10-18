# MVP Scope

## Capability boundary

Each capability has one explicit status. “Gated MVP default” means Stage 2B2 prototypes the recommended default, but it enters MVP only if the named test passes. “Later” means it has a defined behavioral trigger; it is not part of MVP. “Not planned” means the current direction excludes it and adding it requires a new decision.

| Capability | MVP | Later | Not planned | Reason |
|---|:---:|:---:|:---:|---|
| Latest-first Home | ✓ |  |  | Photography-first entry with short recent continuation |
| Gallery | ✓ |  |  | Canonical editorial/viewing unit |
| Chronology through Archive | ✓ |  |  | Complete index grouped by photographed year; no separate Chronology page |
| Places metadata | ✓ |  |  | Recurring-place context and aggregation |
| Persistent Place entity | ✓ |  |  | Normalizes the same Place across years and Galleries |
| Places index + landing pages | ✓ |  |  | Secondary discovery; Place pages return Galleries grouped by year |
| About | ✓ |  |  | Minimal identity and project context |
| Contact | ✓ |  |  | One contact route inside About and/or footer; no separate page |
| Social links | ✓ |  |  | Selected links in About/footer only; no social feed |
| Primary vertical Gallery sequence | ✓ |  |  | Supports authored order and mixed orientations |
| Grid/light-table overview | Gated by Test 3 |  |  | Recommended MVP default; excluded if Test 3 does not demonstrate material orientation value |
| Fullscreen |  | ✓ |  | Add only if Gallery prototype shows meaningful viewing value beyond normal full-width display |
| Search |  | ✓ |  | Activate only when representative users cannot retrieve a known Gallery through Archive/Places at acceptable interaction cost |
| Archive/Place pagination |  | ✓ |  | Add when year or Place pages become materially long; IA remains unchanged |
| Map |  |  | ✓ | Low personal-archive applicability; risks travel/data-first framing |
| Tags |  |  | ✓ | Uncontrolled taxonomy adds maintenance and facet explosion |
| Generic facets / filter dashboard |  |  | ✓ | Time and Place already supply the two intended discovery dimensions |
| Stable Photo identity | ✓ |  |  | Preserves one Photo identity without requiring Multi-Gallery reuse |
| Multi-Gallery Photo reuse |  | ✓ |  | Introduce only for a concrete editorial case; never duplicate the underlying asset |
| Visit / Trip / Shoot entity |  |  | ✓ | Not modeled; capture date/time and available ingestion/provenance context remain preserved |
| Public EXIF |  |  | ✓ | Equipment metadata is not part of the product identity |
| Public camera / lens / film metadata |  |  | ✓ | Avoids equipment-database behavior |
| Public GPS / precise coordinates |  |  | ✓ | No product need; privacy and map implications |
| Likes, comments, accounts, social feed |  |  | ✓ | The product is not a social network |

## MVP metadata visibility

### Always visible

| Metadata | Where |
|---|---|
| Gallery title | Home feature, Archive/Place card, Gallery context |
| Photographed year/date range | Archive/Place card and Gallery context |
| Place name(s), when known | Gallery context and relevant cards; each links to Place |
| Photo count | Archive/Place discovery cards |
| Cover | Home, Archive, Places, and Place pages |

“Always visible” means wherever the Gallery is represented; unknown Place is omitted rather than replaced with a blank label.

### Contextually visible

| Metadata | Rule |
|---|---|
| Gallery description | Only when the work benefits from framing text |
| Photo caption | Only when editorially meaningful; absent captions leave no placeholder |
| Exact Photo capture date/time | Visible only when the sequence or subject requires it |
| Country/region | Shown when needed to disambiguate a Place |
| Ongoing/completed status | Only for genuinely open-ended work |
| Photo count inside Gallery | Only when it aids orientation, such as within an admitted Overview; never required in the viewing header |

### Hidden but stored

| Metadata | Product use |
|---|---|
| Date added/published | Home latest ordering and system history |
| Exact Photo capture date/time, when known | Preservation and possible contextual display |
| Camera, lens, film, and basic EXIF when automatically preserved | Archival preservation only; no MVP interface |
| Original asset identity | Integrity and future reuse without asset duplication |
| Available ingestion/provenance context | Preservation without creating Visit/Trip/Shoot entities |

### Do not store yet as product fields/entities

- Visit, Trip, or Shoot product records/IDs; available source and ingestion context is not intentionally discarded.
- Tags or uncontrolled keyword taxonomy.
- Explicit product-level GPS coordinates.
- Likes, ratings, view counts, comments, accession IDs, rights catalog fields, or institutional collection metadata.

Original image preservation is an implementation concern; “do not store as a product field” does not authorize stripping metadata from source files.

## MVP page/destination boundary

| Included | Excluded |
|---|---|
| Home | Separate Work/Projects page |
| Archive = chronological Gallery index | Separate Chronology page |
| Places index | Visit/Trip index |
| Place landing pages | Map page |
| Canonical Gallery pages; Overview only if Test 3 passes | Photo detail pages |
| Minimal About with Contact/Social | Separate Contact, CV, Press, Shop, Journal, or Search pages |

## Later triggers

| Capability | Trigger |
|---|---|
| Search | Representative users cannot reliably retrieve a known Gallery through Archive/Places at acceptable interaction cost |
| Pagination/progressive loading | A year or Place index becomes materially slow or difficult to scan; this is validated with real content, not a fixed case-count myth |
| Fullscreen | Stage 2B2 Gallery testing shows full-width sequence is insufficient for focused viewing |
| Project/Series entity | Multiple Galleries repeatedly require a stable shared parent that cannot be expressed by title/description alone |

The 80- and 300-Gallery scenarios are **review checkpoints only**, not automatic implementation triggers. Pagination follows the same behavioral rule: actual scan/performance failure, not a count.

## Explicit MVP non-goals

- No framework, database, CMS, API, hosting, image pipeline, SEO, or deployment choice in Stage 2B1.
- No map, location pin, route, trip count, or travel history visualization.
- No generic tag cloud, camera filter, or museum-style metadata panel.
- No automatic Gallery generation from folders or dates.
