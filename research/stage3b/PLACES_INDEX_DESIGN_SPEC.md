# Stage 3B — Places Index Design Spec

## Role

Places Index is the location entrance: an index of Place names, not a travel directory, city guide, map portal, or taxonomy. It must stay light and name-led.

## Frozen product behavior

- Place entity, navigation, and page are frozen; the index lists Places.
- No map, pin, flag, route, itinerary, country-color coding, or chip system.
- Place names stay in their intended public form; region/country only for disambiguation.

## Visual objective

A calm index page where the name does the work. The page should read like a book's place register: quiet, typographic, with photography implied but not shouted.

## Content order

```text
Global header
Page header: H1 “Places” (+ optional one-line context)
Place list (alphabetical by Place name):
  Place name (link)
  country/region (only when needed to disambiguate)
Footer
```

Gallery count and photographed year span are **optional presentation candidates, not MVP baseline content** (Frozen Stage 2B): they stay unrendered unless evidence-first admission below is met.

## Desktop composition

- Page header: shared page header (H1 serif, leading edge, top 96 / bottom 48).
- List layout (Recommended starting specification): a single typographic list inside a narrower measure than the discovery frame — max ≈ 800 px content width — aligned to the shared leading edge. Each entry is one block:
  - line 1: Place name in card serif role (19–24 px), link;
  - line 2 (metadata sans, secondary): country/region only when disambiguating; omit the line entirely when not needed;
  - entry vertical gap: L–XL (24–48); name → metadata gap S.
- If the list grows long, two side-by-side list columns of equal measure are permitted (visual implementation detail) — still a name list, never a card grid, never grouped into a deep taxonomy.
- Whitespace is the structure: generous top/bottom page spacing; no container, no dividers unless testing proves the list loses grouping.

## Mobile composition

- Single column list, 20 px side margins.
- Same entry anatomy: name (18–22 px serif), metadata line below.
- Entry gap L (24). Long Place names wrap; entries grow.
- Comfortable touch targets via hit-area extension; no crowding between adjacent entries.

## Typography roles

- H1 “Places”: Index serif role 36–44 / 30–36.
- Place name: card serif role.
- Country/region: metadata sans, secondary color. Count/year span, only if ever admitted as candidates, use the same metadata role.
- No all-caps micro-labels; no uppercase transformation of Place names.

## Image rules

- MVP baseline contains no images on this page.
- Representative cover is a prototype candidate only (see below); if ever enabled it follows shared card cover rules and never crops.

## Spacing/rhythm

- Header → list: XL (48). Entry gap: L–XL. Name → metadata: S. List → footer: XXL.

## Metadata placement

- Country/region: secondary styling, present only when genuinely disambiguating (e.g. duplicate city names); otherwise omitted entirely — do not show a country for every Place by reflex.
- Gallery count and year span: **not rendered in the MVP baseline** (Frozen Stage 2B: optional presentation candidates). If ever admitted, they render as plain text with tabular numerals, peers separated by middle dot, on the same secondary metadata line.
- No badges, no chips, no count pills.

## Interaction states

- Place name is the link; the entry may extend its hit area to the block. Hover: underline clarification + strong-neutral color shift; no background fill.
- Focus perimeter encloses the entry's text block.
- No hover-reveal of metadata; everything visible at rest.

## Accessibility constraints

- One H1; the list uses a coherent list structure with each Place a link.
- Long Place and region names wrap at 200% zoom and 320 px without horizontal scroll.
- Metadata passes 4.5:1; tabular numerals for counts/years.

## Edge cases

- Duplicate city names (e.g. two “Springfield”): region/country appears on exactly those entries.
- Place with one Gallery: still listed; the count candidate, if ever admitted, reads “1 Gallery” (honest singular).
- Mixed-script Place name (Chinese): CJK serif fallback, natural spacing.
- Very long Place name: wraps; entry grows; never truncated.
- Unknown year span (single undated Gallery): if the span candidate is ever admitted, omit it; never invent a placeholder.

## Real-photo stress cases

- No photos required for MVP baseline (text index); stress is typographic: long names, CJK names, duplicate-name disambiguation, 20+ Places at desktop and mobile.
- If the cover candidate is tested, use mixed bright/dark/portrait/landscape covers.

## Recommended starting values — MVP baseline

| Item | Starting value | Status |
|---|---|---|
| Layout | name-led text list | Frozen baseline direction |
| List measure | max ≈ 800 px desktop | Recommended |
| Place name size | 20–22 px serif | Recommended (within role range) |
| Metadata line | region only when disambiguating | Frozen MVP baseline; count/year span = optional candidates, not admitted |
| Entry gap | 24–48 px | Recommended |
| Mobile layout | single column | Frozen |

```text
MVP baseline: name + (region when needed). Text only, no covers, no counts, no year spans.
Optional presentation candidates (not admitted, not scheduled): Gallery count, photographed year span, representative cover per Place.
```

Count/year span may be admitted only with evidence-first entry: Stage 3C must demonstrate that the text index loses scanning clarity at actual Place count and that the candidate restores it; they must not be added preemptively. The cover candidate may be A/B compared in Stage 3C only under the same condition; enabling it must not turn the page into a card-grid directory.

## Prototype-gated values

- Representative cover, Gallery count, and photographed year span: not scheduled in the seven gates; enter only as discovered-issue comparisons with evidence, per `STAGE_3B_DECISION_LOG.md` conflict rules.

## Must not introduce

- Maps, pins, flags, route lines, country-color coding, chips/pills/badges, search or filter on the index, grouped deep taxonomy, cover grid by default, hover thumbnails, sorting controls, statistics blocks, preemptive count/year-span fields without evidence-first admission.
