# T2 — Place Grouping Decision

## Decision

**KEEP progressive behavior.**

Exact trigger remains **editorial/behavioral**, not numeric.

Decision type: **Prototype-based product decision**, not user-validated.

Isolation: **PASS**.

## Prototype evidence

- [A volume 3](../../prototype/shots/t2-a-3-desktop-top.png) is flat and compact.
- [C volume 3](../../prototype/shots/t2-c-3-desktop-top.png) creates one year section per card, adding structure without aggregation benefit.
- [A volume 8](../../prototype/shots/t2-a-8-desktop-top.png) makes repeated 2026/2024/2023 years explicit and supports year-oriented scanning.
- [B volume 20](../../prototype/shots/t2-b-20-desktop-top.png) remains visually compact and broadly scannable, but provides no year landmarks.
- [A volume 20](../../prototype/shots/t2-a-20-desktop-top.png) adds strong temporal landmarks at the cost of more vertical fragmentation.
- Machine/DOM checks confirm identical Gallery cards/order across A/B/C; only headings differ.

## Strength of evidence

**Medium.** Structural/density effects are directly visible. The exact moment headings improve task completion is not behaviorally validated.

## What is directly observed

- Grouping at volume 3 is redundant when each heading contains one Gallery.
- At volume 8, repeated-year clusters exist and headings communicate them.
- At volume 20, headings improve temporal landmarks but substantially lengthen the page; Always-flat has not obviously “collapsed.”
- Headings remain plain years rather than Visit/Trip cards.
- Multi-year G03 is shown once with `2022–2026`; canonical identity is preserved.

## What is inferred

- Year headings are useful when multiple Galleries share years or when users search by known year.
- Flat presentation remains preferable when each Gallery already carries enough date information and grouping would mostly create one-item sections.

## What is not validated

- User scan time or target-retrieval accuracy at 3/8/20.
- Whether users misread headings as Visits.
- Which metadata—cover, date range, count—real users rely on most.
- A universal or numeric transition threshold.

## Product rationale

Progressive behavior preserves low-volume restraint without discarding a scalable time landmark for repeated-place archives. It matches the product's “complexity must earn its place” principle.

## Trade-offs

- Always-flat is denser and remains credible even at 20 Galleries.
- Grouping consumes vertical space and may over-fragment sparse years.
- Editorial/behavioral triggering requires judgment rather than a simple count rule.

## Prototype defects, if any

No blocking defect. Neutral placeholders make content recognition less realistic, and section spacing is a Stage 3 visual-design variable.

## Final rule entering MVP

Place pages start flat. Add photographed-year headings only when at least one of these conditions is demonstrably present:

- multiple Galleries repeat within years and benefit from aggregation;
- known-year retrieval is an important task;
- the flat list loses temporal orientation or scan clarity.

Do not encode 5/8/10/20 as a product threshold. The editorial/behavioral trigger is frozen; its visual treatment belongs to Stage 3.

