# Stage 3B — Archive Design Spec

## Role

Archive is Chronology: the complete body of work ordered by photographed time, grouped by year. It is a reading room, not a feed, not a database console.

## Frozen product behavior

- Archive = Chronology; ordering by photographed date (photographed/published separation is frozen product logic).
- Year groups are scan landmarks, not pages or filters.
- No filter, search, sort control, sticky year navigation, or pagination in MVP.
- Cards show only frozen retrieval context: photographed date/range, Place, count. No added/published timestamp, camera, tags, Visit, GPS, or excerpt.

## Visual objective

A long page that stays scannable: year headings as quiet landmarks, shared cards at steady density, chronology perceivable at a glance. Density is higher than Gallery viewing, lower than a feed.

## Content order

```text
Global header
Page header: H1 “Archive” (+ optional one-line context)
Year group (latest first):
  year heading (e.g. 2026)
  cards in photographed order
Year group …
Footer
```

## Desktop composition

- Page header follows the shared page header: H1 serif “Archive”, leading edge, optional one-line context in secondary sans, top 96 / bottom 48.
- First year group begins immediately after the header gap; the most recent year is first and positioned as the entry point.
- Year heading (Frozen role): sans H2 role 20–24 px, weight 500–600, tabular numerals, natural case (just the number), spanning the grid and aligned with card leading edges; scrolls normally; not sticky; no oversized background numeral, no vertical type, no timeline line.
- Gallery grid: 3 columns at 1440 reference (Frozen default). A fourth column only on genuinely wide canvases if covers and untruncated metadata stay readable. Column gap L–XL (24–48); row gap XL–XXL (48–64) depending on cover height.
- Card aspect handling: intrinsic cover ratio; rows may have unequal heights; grid order preserved; no masonry.
- Year-group spacing (Recommended starting specification):
  - year heading → first card row: L (24);
  - last card row of a year → next year heading: XXL (96) so the landmark reads;
  - inside a year, rows stay denser than Gallery sequence spacing.
- A subtle hairline above a year heading is permitted only if whitespace alone fails in testing; starting spec is no hairline.
- Footer after final year with XXL separation.

## Mobile composition

- One column (Frozen). Year heading, then cards in normal flow.
- Year heading: 18–22 px sans; top spacing XL (48) from previous card, bottom M–L (16–24) to first card.
- Card internal spacing: cover → title M (16); title → metadata S (8). Between cards: XL (48).
- Metadata wrapping: date/range and Place may take two lines; count may share the Place line with a middle dot or gap. Never truncate to force one line.
- No horizontal year tabs, no carousels, no sticky year bar, no collapsed/accordion groups. The page may be long; consistent landmarks carry the scan.

## Typography roles

- H1 “Archive”: Index serif role 36–44 desktop / 30–36 mobile.
- Year heading: sans H2 role.
- Card titles: card serif role. Metadata: metadata sans. Optional context line: metadata/secondary sans.

## Image rules

- Shared card rules: complete cover frame, intrinsic ratio, no crop, no overlay, no card border/background/shadow; optional 1 px edge aid for high-key covers disappearing into canvas.
- Cover scale is smaller than Home hero, larger than Overview thumbnails (Frozen relative scale).

## Spacing/rhythm

- Uses the shared section rhythm table: title→grid XL; year heading→first row L; row gaps XL–XXL desktop / XL mobile; last content→footer XXL.
- Card internal: cover→title M, title→metadata S (Frozen tightest group).

## Metadata placement

- Inside each card, below title, in frozen order: photographed date/range; Place when known (link); photo count.
- One or two lines; peers separated by middle dot or spatial gap.
- No publication timestamp in Archive. “Recently added” cue does not appear here (it belongs to Home).

## Interaction states

- Cards: shared card states. Entire block perceivable; title is the semantic link; hover = underline + subtle edge/opacity clarification; no zoom/lift/shadow.
- Year headings are not links and must not imply a year view.
- Place metadata remains a visible underlined link.

## Accessibility constraints

- One H1; year headings are H2 in coherent order.
- Tabular numerals for years and counts.
- 200% zoom / 320 px: grid collapses to fewer columns then one; no horizontal scroll.
- Focus perimeter encloses or connects cover and text per card.
- Covers may use empty alt where the linked title already names the destination.

## Edge cases

- Single Gallery in a year: heading still appears; no special-casing.
- Multi-year range Gallery (`2018–2024`): files under one year (authored grouping year); full range remains visible on the card, never truncated.
- 300-Gallery scale: system reveals strain honestly; no silent filters. Row rhythm stays constant; do not compress spacing by count.
- Gallery with no known Place: metadata layout has no empty slot; count simply follows date.
- Very long Place name on card: wraps within the card; card grows.

## Real-photo stress cases

- Mixed covers: bright, dark, B&W, saturated, portrait, landscape, panorama covers in the same year grid.
- Long metadata: multi-year range + long multi-place names.
- Multiple years (3+): landmark legibility and spacing.
- Mobile: full-year scroll with mixed ratios.

## Recommended starting values

| Item | Starting value | Status |
|---|---|---|
| Desktop columns | 3 (at 1440 reference) | Frozen default |
| Column gap | 32 px (L–XL) | Recommended |
| Row gap | 48 px (XL), 64 where covers are tall | Recommended |
| Year heading → first row | 24 px | Recommended |
| Year → year separation | 96 px | Recommended |
| Card title size | 20–22 px serif | Recommended (within role range) |
| Mobile card gap | 48 px | Recommended |

## Prototype-gated values

- None of the seven gates targets Archive directly; Archive inherits G1 (fonts) and G2 (canvas) outcomes. If real 80/300-Gallery fixtures reveal scan failure, record a conflict rather than adding features.

## Must not introduce

- Filters, facets, search, sort dropdowns, sticky year navigation or sidebar, year chips/tabs, pagination, load-more feeds, card borders/shadows/badges, publication timestamps, camera/EXIF metadata, masonry reordering, hover-reveal metadata.
