# Stage 3B — Place Page Design Spec

## Role

A Place page gathers every Gallery photographed at one Place. Frozen behavior: progressive grouping — flat reverse chronology at low volume, year headings only when earned. It is a shelf of work, not a Visit page, not a trip summary, not a timeline.

## Frozen product behavior

- Default low-volume: flat reverse chronology with photographed dates visible on cards.
- Year headings appear only when repeated-year aggregation, known-year retrieval, or lost temporal orientation makes them earn their space. No numeric threshold in product rules; the trigger is editorial/behavioral.
- Content returns Galleries, never a Photo pool.
- A Gallery linked to multiple Places looks identical on each Place page and points to one canonical Gallery.
- No Visit entity/field/count anywhere.

## Visual objective

The Place name opens the page; the Galleries read as one coherent body. Year headings, when present, are the same quiet landmarks as Archive — the page never becomes a different product state between flat and grouped.

## Content order

```text
Global header
Page header: H1 {Place name} + optional region/country line
[flat state] cards in reverse chronological order
[grouped state] year heading → cards, latest year first
Footer
```

## Desktop composition

### Low-volume flat state

```text
Paris
Gallery  Gallery  Gallery
```

- Page header: shared page header; H1 serif Place name (36–44 px); optional region/country as one quiet secondary-sans line below the H1 (gap S), not a breadcrumb.
- Cards: shared card, 3 columns at 1440 reference (collapses by content fit), identical to Archive cards.
- Because no year headings exist, photographed date on each card stays mandatory and visible — chronology must remain perceivable.
- Flat → grouped visual continuity: cards, grid, and spacing are identical; only the headings are added.

### Grouped state

```text
Paris

2026
Gallery  Gallery

2024
Gallery
```

- Year headings use exactly the Archive year-heading treatment: sans H2 role 20–24 px, weight 500–600, tabular numerals, grid-spanning, aligned to card leading edges, scrolling normally (Frozen parity with Archive).
- Year-to-grid spacing (Recommended starting specification, same as Archive): heading → first row L (24); previous year's last row → next heading XXL (96).
- Multi-year Gallery display: a Gallery spanning `2018–2024` appears once, under its authored grouping year, with the full range visible on the card — never duplicated under each year, never truncated.
- Multi-place Gallery display: identical card; its Place metadata lists Places per shared card order; no special marker for “this is the page you are on.”

## Mobile composition

- One column in both states.
- Flat state: cards with XL (48) gaps; dates visible.
- Grouped state: year heading 18–22 px sans; top XL (48) from previous card, bottom M–L (16–24) to first card — identical to Archive mobile.
- Region/country line wraps under the Place H1.

## Typography roles

- H1 Place name: Index serif role.
- Region/country: metadata/secondary sans.
- Year heading: sans H2 role (Frozen parity with Archive).
- Cards: card serif title + metadata sans.

## Image rules

- Shared card image rules only; covers complete and uncropped. No Place-specific image treatment, no hero image for the Place, no map imagery.

## Spacing/rhythm

- Header → first content: XL (48). Card internals: cover→title M, title→metadata S. Row gaps XL–XXL desktop / XL mobile. Year spacing as above. Last content → footer XXL.

## Metadata placement

- Card metadata keeps frozen order: date/range, Place, count. On a Place page the Place field remains (it may name additional Places for multi-place Galleries); it is not removed just because the page context is known — multi-place Galleries need it.
- No Visit count, no “× visits”, no trip duration, no distance/coordinates.

## Interaction states

- Shared card states. Year headings are section labels, not links, not filters, not expandable.
- Place metadata links inside cards still navigate (to that Place's page), including the current one; no special disabled styling needed — a link to the current page is acceptable and honest.

## Accessibility constraints

- One H1; year headings H2 in order.
- Long Place names (and CJK Place names) wrap at 200% zoom / 320 px.
- Grouped and flat states both keep logical reading/keyboard order.

## Edge cases

- 3 Galleries, single year: flat; no headings; dates visible.
- 8 Galleries with repeated years: grouped; headings earn space.
- 20 Galleries: grouped grid usable on mobile without sticky controls.
- Gallery spanning multiple years: single appearance, full range shown.
- Gallery at 3+ Places: same card everywhere; Places wrap.
- Place with unknown region (no disambiguation needed): no region line; no empty slot.

## Real-photo stress cases

- Low-volume flat (3 cards, mixed ratios) — must feel intentional, not empty.
- Grouped (8+ cards, 2–3 years) — landmark legibility.
- Multi-year Gallery card inside grouped state.
- Multi-place Gallery card on this Place page.
- Mobile grouped scroll.

## Recommended starting values

| Item | Starting value | Status |
|---|---|---|
| Desktop columns | 3 (parity with Archive) | Frozen default |
| Year heading → row | 24 px | Recommended (Archive parity) |
| Year → year | 96 px | Recommended (Archive parity) |
| Region line | secondary sans below H1, gap 8 px | Recommended |
| Grouping trigger | editorial judgment, no numeric threshold | Frozen product rule |

## Prototype-gated values

- None new; inherits G1/G2. Progressive grouping trigger is product behavior, not a visual A/B.

## Must not introduce

- Maps, flags, pins, routes, itinerary styling, Visit counts or Visit cards, country badges/chips, sticky year controls, per-Place hero image, different card style from Archive/Home, Photo pools or filmstrips, sortable/filterable Place content.
