# Stage 3B — About Design Spec

## Role

About is a low-weight identity/contact page: a short project statement and how to reach the photographer. It is not a portfolio bio page, not a CV, not a services pitch.

## Frozen product behavior

- Text-led, narrow, quiet.
- No biography portrait required in MVP; a portrait appears only if it belongs to the authored project.
- Contact precedes selected Social links.
- No CV, Press, timeline, client list, equipment, commercial services, newsletter block.

## Visual objective

One calm reading column with the site's only sustained body text. The page should feel like the colophon of a book: present, personal, brief.

## Content order

```text
Global header
Page header: H1 “About”
Project statement (1–3 short paragraphs)
Contact section: heading + email/link
Social section: heading + short text link list
Footer
```

## Desktop composition

- Page header: shared page header (H1 serif 36–44 px, leading edge, top 96 / bottom 48).
- Text column width (Frozen range): 60–70 Latin characters or 28–36 CJK characters per line — starting measure ≈ 640 px. Column aligns to the shared leading edge within the content frame; not centered-on-page typography.
- Project statement first: body sans 17–19 px, line-height 1.55–1.65 (CJK 1.65–1.8); paragraphs separated by spacing (one body line-height, ~M–L), never indentation.
- Contact heading: H2 sans role (20–24 px); email as a standard underlined link, directly visible (no obfuscation that hurts usability).
- Social heading: H2 sans role; a short list of text links (recommended: no more than 3–5), each plainly named; no icons required, no logo strip.
- Vertical rhythm: statement → Contact XL–XXL; Contact → Social XL; last content → footer XXL.
- No sidebar, no portrait column, no pull-quote theatrics.

## Mobile composition

- One column, 20 px side margins; same content order.
- Body 16–18 px (never below 16); measure naturally within margins.
- Headings scale per role table (H1 30–36, H2 18–22).
- Email link gets a comfortable hit area; Social links spaced ≥ L apart.

## Typography roles

- H1 “About”: Index serif role.
- Section headings (Contact / Social): sans H2 role.
- Body: body sans role — the only page with sustained reading.
- Links: graphite with visible underline (non-color cue).

## Image rules

- None by default. If an authored portrait later earns a place (outside MVP), it follows standard image rules: complete frame, no decorative border, sized below the reading column's dominance — recorded as a new decision, not silently added.

## Spacing/rhythm

- Header → statement: XL. Paragraph gap: M–L. Statement → Contact: XL–XXL. Contact → Social: XL. Social → footer: XXL.

## Metadata placement

- None. No dates, counts, or labels beyond the two section headings.

## Interaction states

- Standard inline link states (hover underline clarification, focus perimeter).
- No card-like link blocks; Social links are ordinary links with generous hit areas.

## Accessibility constraints

- One H1; H2 sections descend coherently.
- Body ≥ 4.5:1; email link readable and operable; mixed-script statement (Chinese/English) wraps with correct CJK line-height.
- 200% zoom and 320 px reflow: column stays single, nothing clips.

## Edge cases

- Very short statement (one paragraph): page stays short and honest; no filler modules.
- Bilingual statement: CJK line-height applied; no baseline jumps.
- Long email address: wraps inside the column; remains one link.
- No social presence: Social section omitted entirely; Contact remains.

## Real-photo stress cases

- None (no photography on the MVP page). Typographic stress only: mixed-script body at 200% zoom and 320 px.

## Recommended starting values

| Item | Starting value | Status |
|---|---|---|
| Column measure | ≈640 px (60–70 chars) | Recommended within Frozen range |
| Body size | 18 px desktop / 17 px mobile | Recommended within role range |
| Social links | ≤5, text only | Recommended |
| Section gap | 48–96 px | Recommended |

## Prototype-gated values

- None. No gate targets About; it inherits G1 (fonts incl. CJK body metrics) and G2 (canvas).

## Must not introduce

- Biography portrait by default, CV, press logos, client strip, equipment lists, services/pricing, newsletter signup, social icon sprite row, sticky share bar, timeline of the photographer's life, quotes or testimonials, any accent color.
