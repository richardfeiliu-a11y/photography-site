# Stage 3B — Real-Photo Test Matrix

Status: **mandatory Stage 3C screenshot/inspection matrix**. Neutral placeholders cannot pass it. Every capture records fixture, viewport, expected rule, observed result, and the screenshot path.

## Minimum real-photography fixture set

Stage 3C must assemble at least one real photo per category below. If the user's archive lacks an exact category, substitute the closest real work and record the substitution.

| ID | Category | Required character |
|---|---|---|
| F01 | Bright / high-key | edges approach canvas white |
| F02 | Dark | deep blacks, low overall luminance |
| F03 | Low-contrast | flat tonal range |
| F04 | Highly saturated | strong color against warm canvas |
| F05 | Landscape | ordinary wide frame |
| F06 | Portrait | tall frame |
| F07 | Dense composition | detail throughout |
| F08 | Minimal composition | large negative space |
| F09 | Black & white | neutral palette check |
| F10 | Color | normal color photography |

Content stress fixtures required simultaneously:

```text
Short Gallery (≈3 Photos)
Long Gallery (~72 Photos)
Short English title
Long English title (≈70 chars)
Chinese title
Mixed-script title
Single Place Gallery
Multiple Places Gallery
Single-year date
Multi-year range (e.g. 2018–2024)
No caption
Short caption
2–3 line caption
Chinese caption
```

## Capture conventions

- Desktop reference ≈ 1440 px; mobile reference ≈ 390 px; plus 320 px reflow and 200% text zoom where marked.
- Each row names the gate or spec section it validates.
- A capture result must be PASS, OPEN (feeds a named gate), or FAIL with a recorded conflict — “looks fine” is not a result.

## Home

| ID | Capture | Viewport | Validates |
|---|---|---|---|
| H01 | bright/high-key hero cover | desktop + mobile | G3, edge aid |
| H02 | dark hero cover | desktop + mobile | G3 |
| H03 | long English title hero | desktop + mobile | title wrap, hierarchy |
| H04 | Chinese title hero | desktop + mobile | G1 CJK serif |
| H05 | “Recently added” backfill cue | desktop | cue vs photographed date honesty |
| H06 | recent set, mixed covers | desktop + mobile | shared card at Home scale |

## Archive

| ID | Capture | Viewport | Validates |
|---|---|---|---|
| A01 | mixed covers within one year | desktop + mobile | card rhythm, unequal rows |
| A02 | long metadata (multi-year range + long multi-place) | desktop + mobile | wrapping, no truncation |
| A03 | multiple years (3+) | desktop + mobile | year landmark spacing |
| A04 | ~80 Galleries scale | desktop + mobile | scan endurance (D05) |

## Place

| ID | Capture | Viewport | Validates |
|---|---|---|---|
| P01 | low volume flat (3 Galleries) | desktop + mobile | intentional flat state |
| P02 | grouped (8+ Galleries, 2+ years) | desktop + mobile | progressive headings |
| P03 | multi-year Gallery card | desktop | range display, single placement |
| P04 | multi-place Gallery card | desktop + mobile | Place link wrapping |

## Gallery

| ID | Capture | Viewport | Validates |
|---|---|---|---|
| G01 | bright landscape sequence | desktop + mobile | scale, margins |
| G02 | dark landscape sequence | desktop + mobile | edge visibility, no mat |
| G03 | portrait sequence | desktop + mobile | 80svh/82svh height rules |
| G04 | portrait→landscape transition | desktop + mobile | no automatic rhythm change |
| G05 | captioned (1-line) | desktop + mobile | caption attachment |
| G06 | 3-line caption + Chinese caption | desktop + mobile | measure, CJK line-height |
| G07 | 72-photo long Gallery, top/mid/end | desktop + mobile | G4 Base rhythm fatigue |
| G08 | end pause + continuation | desktop + mobile | G7 |
| G09 | current position L01/L47/L72 | desktop + mobile | G5 |
| G10 | edge-to-edge mobile landscape | mobile | exception rules, inset caption |
| G11 | Compact pair + Breathing pause | desktop | editorial rhythm reads |

## Overview

| ID | Capture | Viewport | Validates |
|---|---|---|---|
| O01 | desktop 6-col grid, mixed ratios | desktop | starting density |
| O02 | mobile 3-col | mobile | G6 |
| O03 | mobile 2-col | mobile | G6 fallback |
| O04 | current marker on bright + dark thumbnails | desktop + mobile | marker survival |
| O05 | focus coexisting with current marker | desktop | state distinction |
| O06 | long Gallery title in layer header | mobile | wrapping, count visible |

## About

| ID | Capture | Viewport | Validates |
|---|---|---|---|
| B01 | desktop statement page | desktop | measure, rhythm |
| B02 | mobile statement page | mobile | margins, link targets |
| B03 | mixed-script (Chinese/English) body | desktop + mobile | CJK body metrics (G1) |

## Cross-page accessibility captures

| ID | Capture | Validates |
|---|---|---|
| X01 | 200% text zoom on Home, Gallery header, Overview | A11/T12 |
| X02 | 320 px reflow on Gallery + Archive | A03 |
| X03 | reduced motion: Menu + Overview open/close | A06 |
| X04 | forced colors/high contrast | A07 |
| X05 | keyboard-only full flow capture sequence | A01 |

## Evidence rule

Each gate in `STAGE_3C_VISUAL_GATES.md` names its required fixtures from this matrix. A gate may not be decided without its listed real-photo captures.
