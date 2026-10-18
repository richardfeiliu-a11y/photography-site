# Stage 3A — Visual Stress Tests

Status: **required Stage 3B/3C validation matrix**. Neutral placeholders alone cannot pass this matrix.

## Test method

For each page/system under test:

1. use real or representative photography;
2. inspect reference desktop, mobile, widest supported, and 320 px reflow states;
3. record the fixture, viewport, expected rule, observed result, and screenshot;
4. distinguish a specification failure from a content-authoring issue;
5. do not “fix” a failure by cropping the Photo, hiding metadata, or adding a new feature.

## Core image matrix

| ID | Fixture | Pages/systems | Pass condition |
|---|---|---|---|
| I01 | Very bright/high-key cover | Home, Archive, Place, card | Image edge remains legible without shadow; text stays on neutral canvas |
| I02 | Very dark cover | Home, Archive, Place | No black mat/shadow required; cover remains dominant but not merged into UI |
| I03 | Low-contrast photograph | Gallery, Overview | UI does not compensate with image processing; frame remains faithful |
| I04 | Color-heavy/saturated photograph | All | Warm canvas does not create an obvious cast or competing accent |
| I05 | Black-and-white photograph | All | Neutral palette does not appear colored; edge/current markers remain visible |
| I06 | Minimal scene with large negative space | Card, Gallery | UI does not invade negative space through overlays or crop |
| I07 | Dense scene | Card, Overview | Thumbnail remains recognizable; focus/current markers remain visible |
| I08 | White border baked into file | Gallery, card | No double frame or mistaken crop |
| I09 | Deep black edge | Gallery, Overview | Edge aid, if enabled, stays subtle and does not resemble a card border |

## Orientation and sequence matrix

| ID | Fixture | Pass condition |
|---|---|---|
| S01 | Landscape-heavy sequence | Broad media scale remains calm; no full-bleed repetition fatigue |
| S02 | Portrait-heavy sequence | Portraits do not become tiny or exceed height path; captions remain reachable |
| S03 | Alternating portrait/landscape | Stable vertical axis, no horizontal overflow or layout-mode switching |
| S04 | Panorama→portrait | Both remain useful at natural ratio; no standard-box crop |
| S05 | Square/diptych file | Treated as one Photo without a special template |
| S06 | Captioned→uncaptioned→captioned | No blank caption reserve; sequence gaps remain intentional |
| S07 | Compact editorial pair | Pair reads related without merging hit/reading areas |
| S08 | Breathing chapter shift | Pause reads as intentional but not a broken/lazy-loading region |
| S09 | 72-Photo Gallery | Native vertical traversal remains legible; whitespace fatigue is acceptable; position and end recognition work |
| S10 | Final Photo is portrait with 3-line caption | End pause and continuation do not attach to or obscure the caption |

## Typography and multilingual matrix

| ID | Fixture | Pass condition |
|---|---|---|
| T01 | 8-character title | Does not become oversized merely because it is short |
| T02 | 70-character Gallery title | Wraps without clipping/truncation; hierarchy remains clear |
| T03 | Chinese Gallery title | Deliberate CJK serif fallback; no baseline or weight mismatch |
| T04 | Mixed Chinese/Latin title | Stable baseline, natural spacing, no arbitrary glyph fallback |
| T05 | Long Place name | Wraps in card, Gallery metadata, Places index, and Menu-adjacent layouts |
| T06 | Multi-place Gallery | Places remain readable links without chips or breadcrumb overload |
| T07 | Single date | Reads as photographed context, not publication time |
| T08 | Multi-year date range | Full `2018–2024` remains visible and files under one year without truncation |
| T09 | 3-line caption | Readable measure/line-height; next Photo spacing begins after text |
| T10 | Chinese 3-line caption | CJK line-height prevents crowding; no forced one-line layout |
| T11 | `1 / 72`, `47 / 72`, `72 / 72` | Tabular numerals do not shift the position annotation |
| T12 | 200% text scaling | No clipping, overlap, or inaccessible controls |

## Discovery and scale matrix

| ID | Fixture | Pass condition |
|---|---|---|
| D01 | Home featured override present | Featured cue is clear but photographed date/Archive position remains distinct |
| D02 | Home latest fallback | Latest work dominates without a generic hero CTA |
| D03 | Backfilled older work recently published | “Recently added” does not imply recently photographed |
| D04 | Archive: 15 Galleries / 3 years | Year hierarchy is useful without excessive empty space |
| D05 | Archive: 80 Galleries / 8 years | Grid and year landmarks remain scannable without filters/search |
| D06 | Archive: 300 Galleries / 20 years | Visual system reveals retrieval strain without silently adding features |
| D07 | Place: 3 Galleries | Flat stream feels intentional; no unnecessary year headings |
| D08 | Place: 8 Galleries with repeated years | Progressive headings earn space and remain subordinate |
| D09 | Place: 20 Galleries | Grouped grid remains usable on mobile without sticky controls |
| D10 | Places with duplicate city names | Region/country disambiguation is clear without flags/chips |
| D11 | Gallery with zero Place | Metadata layout has no empty slot |
| D12 | Gallery with multiple Places | Links wrap without becoming a taxonomy row |

## Overview matrix

| ID | Fixture | Pass condition |
|---|---|---|
| O01 | Current L01 | Current marker immediately visible without dominating |
| O02 | Current L47 in 72 Photos | Grid opens around current region; marker survives varied images |
| O03 | Current L72 | End position clear; Close remains reachable |
| O04 | Bright current thumbnail | Marker/focus contrast remains visible |
| O05 | Dark current thumbnail | Marker/focus contrast remains visible |
| O06 | Mixed orientations | Contain cells preserve authored frames and reading order |
| O07 | Mobile 3-column attempt | Targets do not overlap and Photos remain recognizable; otherwise use 2 columns |
| O08 | Keyboard focus on current thumbnail | Focus and current states remain distinct |

## Interaction, responsive, and accessibility matrix

| ID | Fixture/state | Pass condition |
|---|---|---|
| A01 | Keyboard-only full flow | Site nav→Gallery→Overview→thumbnail→Close→continuation all operable in logical order |
| A02 | Touch-only at 390 × 844 | Targets are comfortable, no hover-only meaning, no overlap with safe areas |
| A03 | 320 px reflow | No page-level horizontal scroll; titles/metadata/controls wrap |
| A04 | 1024 × 768 sanity | Grid collapses by content fit; Gallery remains usable |
| A05 | Widest intended desktop | Lines/measures remain capped; grid does not become sparse or over-dense |
| A06 | Reduced motion | Menu/Overview remain understandable without translation/animation |
| A07 | Forced colors/high contrast | Focus, current, links, and controls remain perceivable |
| A08 | Very bright Photo behind nearby counter | Position annotation is legible and does not cover meaningful content |
| A09 | Very dark Photo behind nearby counter | Same as A08; no photo-dependent color calculation required |
| A10 | Mobile Menu with long translated labels | No clipping, fixed-height rows, or overlapping targets |
| A11 | Browser text zoom 200% in Overview | Close, title/count, and thumbnails remain reachable |
| A12 | Failed image in middle of sequence | Dimensions, current position, focus order, and failure text remain stable |

## Continuation matrix

| ID | Fixture | Pass condition |
|---|---|---|
| C01 | Next Gallery exists | End label→Next title→Back hierarchy is clear; no cover/feed feel |
| C02 | No next Gallery | Back becomes primary; Browse Archive secondary; no dead end |
| C03 | Origin Home | Exact `Back to Home` label and hierarchy |
| C04 | Origin Archive | Exact `Back to Archive` label and hierarchy |
| C05 | Origin Place | Exact `Back to {Place}` label and long Place wrapping |
| C06 | Direct canonical entry | Archive fallback is clear without inventing origin |
| C07 | Final image at L71 of 72 | No continuation visible before true end |
| C08 | Final image at L72 | End boundary and continuation visible through ordinary vertical progression |

## Release evidence gate

Stage 3B page specs may be considered visually coherent when every relevant test has one of:

- **PASS** with screenshot/measurement evidence;
- **OPEN PROTOTYPE QUESTION** with a bounded A/B comparison for Stage 3C;
- **NOT APPLICABLE** with a reason tied to frozen scope.

“Looks fine on placeholders” is not an accepted result.

