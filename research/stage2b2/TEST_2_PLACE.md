# Test 2 — Place Page Progressive Grouping

## Question

Does progressive photographed-time grouping preserve low-volume simplicity while improving scan and retrieval at repeated-year/higher volume, compared with always-flat and always-grouped presentation?

## Recommended default

Variant A — progressive behavior. Place, Place page, Gallery cards, canonical identity, and photographed chronology are frozen; only year-heading presentation is tested.

## Variant A

Deterministic fixture behavior:

```text
volume=3  → flat reverse-chronological Gallery cards; year remains on each card
volume=8  → photographed-year headings because repeated years are present
volume=20 → photographed-year headings
```

This mapping is a prototype fixture, not a product threshold. The product rule remains: headings appear when repeated years, content volume, and scanning clarity make them useful.

## Variant B

Always-flat reverse-chronological Gallery-card list for volume 3, 8, and 20. Each card retains photographed year/date range.

## Optional Variant C

Always-grouped photographed-year headings for volume 3, 8, and 20. This diagnostic control tests premature structure; it is not a recommended product direction.

## Controlled variables

- Same `/places/paris` route, Place title/context, G01/P02…P21 objects, order, card component, covers, dates, Places, counts, and links.
- Same reverse photographed chronology.
- Same multi-year filing rule: G03 appears once under start year 2022 with `2022–2026` visible.
- Same multi-Place canonical identity: G20 links to one Gallery URL from Paris and Brussels.
- Same typography, spacing, navigation, responsive behavior, and scroll start.
- Only presence/absence rule for year headings changes.

## Desktop spec

Required viewport: `1440 × 1000`.

- Place title and optional country disambiguation precede the list.
- Gallery cards use the shared discovery-card baseline: cover, title, photographed year/range, Place, count.
- Year heading, when present, is a section label—not a link, Visit, or content parent.
- Card grid/density stays identical across A/B/C at the same volume.
- Places index outside this page is name-only in the prototype baseline; optional cover/count/year-span decorations are not added.

Required top and mid-page captures for A/B/C at `volume=3` and `volume=20`, plus A/B at `volume=8`.

## Mobile spec

Required viewport: `390 × 844`.

- One-column cards.
- Year headings scroll naturally; they are not sticky.
- Place title remains concise; no map, filters, Visit labels, or index decoration.
- Back to Places uses the shared origin/back behavior.
- Required captures mirror desktop for volume 3 and 20; A/B volume 8 requires one mid-page capture.

## User tasks

Run tasks separately at volume 3, 8, and 20; counterbalance variant order.

1. Explain what “Paris” represents and whether year headings represent Visits.
2. Find Quiet Stations (2026).
3. Find Corner Light (2024).
4. At volume 8, find the second Gallery photographed in 2023.
5. At volume 20, find Winter Courtyard (2019) and River Edges (2022–2026).
6. Open Between Cities and confirm it is one Gallery associated with both Paris and Brussels.
7. Describe which card metadata was actually used to find the target.

Record task completion, time-to-target, wrong-year entries, backtracks, heading interpretation, scroll distance, and metadata used.

## Success criteria

- Paris is understood as one persistent Place across years.
- Year headings are not interpreted as trips, Visits, or separate Paris entities.
- Variant A at volume 3 is as quiet/direct as B and avoids C's one-heading-per-card noise.
- Variant A at volume 8/20 improves or matches known-Gallery retrieval and orientation relative to B.
- G03's date range and G20's canonical multi-Place identity are understood without duplicate Gallery assumptions.
- Cover, date/range, and count remain readable; observed metadata use is recorded without changing those fields during this test.

## Failure conditions

- Progressive headings add noise at low volume or appear as mandatory content parents.
- Users infer that a year group equals one trip/Visit.
- Always-flat B is consistently faster/clearer at volume 20 with no orientation cost.
- Variant A changes card design/density along with grouping.
- Multi-year G03 is duplicated across year groups or G20 receives different Gallery URLs.

## Decision rule

Retain progressive grouping if it avoids low-volume noise and improves or preserves scan/retrieval at repeated-year/higher volume. Do not derive a permanent numeric threshold from 3/8/20. If year headings do not produce observable orientation value at volume 20, keep Place pages flat until a future behavioral trigger appears.

