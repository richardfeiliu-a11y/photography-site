# Stage 3A — Discovery UI System

Status: **shared visual language for Home, Archive, Places, and Gallery representations**. It does not define final page-by-page composition.

## Discovery versus viewing

Discovery may be denser than viewing. Its purpose is to compare and retrieve Galleries without demoting them to records.

```text
Discovery: cover → title → photographed context → supporting metadata
Viewing:   Photo → sequence space → caption → quiet orientation controls
```

The same Gallery object appears through Home, Archive, and Places, using one shared card philosophy. Ordering and surrounding headings may differ; the visual identity of the Gallery representation does not.

## Shared Gallery representation

### Card philosophy

- The “card” is an **image + text block**, not a bordered container.
- Cover dominates the block.
- Title sits below the cover in the restrained display serif.
- Metadata sits below the title in utility sans.
- No metadata overlays, category badges, colored chips, shadows, filled backgrounds, or default border.
- The complete block is clickable, with an explicit title link and a focus indicator that encloses or clearly connects the block.
- Hover does not crop or zoom the image. A subtle image-edge/opacity response and link underline are sufficient.
- No destructive crop. Intrinsic cover ratio is preserved.

### Metadata order

Keep the frozen order:

```text
Cover
Title
Photographed date or range
Place when known
Photo count
```

Visual grouping may put date, Place, and count on one or two lines, but it may not hide or reorder information differently between Home/Archive/Place without a documented reason.

Publication cues such as “Featured” or “Recently added” use the metadata role as plain text. They do not become filled badges and do not replace the photographed date.

## Home

- The featured override/latest Gallery owns the first visual emphasis through image scale, not headline size or a CTA panel.
- Site identity and Gallery title remain readable but do not occupy a campaign-style hero block.
- “Featured” or “Recently added” is a small metadata cue near the title/context.
- Home hero cover may use the broad content frame but is not viewport full-bleed.
- A short recent-Galleries continuation is visually quieter and uses the shared card representation.
- Archive and Places appear as clear text destinations after the main work; they do not compete as equal hero buttons.
- Home must never resemble an endless social feed. Section spacing and a visible end to the recent set preserve its exhibition role.

## Archive density

### Desktop

- Default at the reference desktop: **3 columns**.
- A fourth column is allowed only when covers remain useful and full titles/metadata remain legible.
- Year headings span the grid, use a medium sans role, and are clearly subordinate to the Archive H1.
- Year-to-year separation uses a major section gap; card rows remain denser than Gallery sequence spacing.
- Cover is still the dominant element, but relative image scale is smaller than Home hero and larger than Overview thumbnails.

### Mobile

- One column.
- Year heading, cover, title, date/range, Place, and count remain in normal flow.
- No horizontal year tabs, carousels, sticky filter bars, or collapsed groups.
- The page can be long; clear year landmarks and consistent card rhythm reduce scan cost.

### Metadata density

- Show only frozen retrieval context: photographed date/range, Place, count.
- No added/published timestamp in Archive unless needed to explain a special Home cue.
- No camera, tags, Visit, GPS, or editorial excerpt.
- Do not abbreviate date ranges or Places merely to force a single line.

## Places index

The Places index expresses location through naming and associated photography, not travel iconography.

- Place name is the primary element.
- Country/region appears only for disambiguation and uses metadata styling.
- Optional representative cover, Gallery count, or photographed year span may be used only if Stage 3B demonstrates that it improves scanning at actual scale. They are not mandatory fields.
- A name-led list is the baseline and lowest-maintenance treatment.
- At larger scale, alphabetical or light country/region grouping may structure the list; the grouping must not become a deep taxonomy.
- Prohibited: pins, flags, maps, route lines, itinerary dates, travel badges, country-color systems, and chip overload.

## Place page

- Page title is the Place name in the H1 serif role.
- Optional region/country disambiguation is a quiet sans line, not a breadcrumb hierarchy.
- The content returns Galleries, not a Photo pool.
- At low volume, use a flat reverse-chronological card grid with photographed dates visible.
- When progressive year headings are earned, they use the same visual role and spacing as Archive year headings.
- Headings never resemble Visit cards or interactive filters.
- A Gallery linked to multiple Places still looks identical on each Place page and points to one canonical Gallery.

## Year heading language

- Natural numeric year using tabular numerals.
- No oversized background numeral, vertical typography, timeline line, or sticky label.
- Weight and whitespace provide the landmark.
- A subtle hairline may be added only if a long grid cannot visually retain year grouping through whitespace alone.
- Year headings do not imply a clickable year view unless they are actual links; linked state must be visibly indicated.

## Discovery hierarchy

| Element | Relative visual weight |
|---|---|
| Cover | Highest |
| Gallery title | High but clearly below cover |
| Page/Place title | High at page entry; does not repeat per card |
| Year heading | Medium landmark |
| Photographed date/range | Primary metadata |
| Place | Secondary metadata but still a visible link where applicable |
| Photo count | Lowest required metadata |
| Navigation/utility | Stable, quiet |

## Discovery interaction states

- Entire Gallery representation has a perceivable hover/focus state.
- Title remains an ordinary link supporting expected browser behavior.
- No hover-only reveal of metadata or actions.
- Touch users receive the same information before activation.
- Selected/current states are uncommon in discovery. Current global destination is shown in navigation; Gallery cards do not behave like selectable dashboard rows.

## Density failure conditions

- A card looks like a boxed SaaS component.
- Cover no longer dominates title/metadata.
- Archive resembles a Photo feed with no year orientation.
- Places reads as travel planning or taxonomy management.
- Metadata is hidden until hover, truncated, or reduced below readable contrast.
- Four-column density is chosen because space exists, even though cover or title recognition suffers.
- Home's recent set becomes an unbounded replacement for Archive.

