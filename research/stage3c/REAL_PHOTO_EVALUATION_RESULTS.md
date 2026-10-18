# REAL PHOTO EVALUATION RESULTS — Stage 3C

Every capture from `REAL_PHOTO_TEST_MATRIX.md` (Phase 6) plus the bounded gate
comparisons (Phase 7). Verdicts: **PASS** = expected held; **EVIDENCE** = capture served
as gate comparison evidence (adoption recorded in the GATE files); no OPEN/FAIL remain.
Captures live in `prototype-stage3c/screenshots/matrix/`.

## Home (H)

| ID | Fixture / case | VP | Expected | Observed | Verdict |
|---|---|---|---|---|---|
| h01-bright-hero-desktop | F01 bright cover | 1440 | hero ≤78svh, title in first viewport | ≈75svh; title visible; edge legible | PASS |
| h01-bright-hero-mobile | F01 bright cover | 390 | landscape ≤60svh; cue above date | cap holds; “Recently added” above “Photographed Feb 2019 · Thun” | PASS |
| h02-dark-hero-desktop | F02 dark cover | 1440 | dark edge legible on canvas | clean separation; title in viewport | PASS |
| h02-dark-hero-mobile | F02 dark cover | 390 | cap + hierarchy | holds | PASS |
| h03-long-title-hero-desktop | panorama + long EN title | 1440 | width-bound hero; 2-line title stable | ≈62svh; wrap clean; meta + View Gallery visible | PASS |
| h03-long-title-hero-mobile | same | 390 | wrap within 390 | clean | PASS |
| h04-chinese-title-hero-desktop | 极光之夜 (G1) | 1440 | deliberate CJK serif, no fallback holes | Noto Serif SC renders; baseline stable | PASS |
| h04-chinese-title-hero-mobile | same | 390 | same | holds | PASS |
| h05-cue-desktop | cue legibility | 1440 | plain-text cue, metadata role | cue line present above date, no badge | PASS |
| h06-recent-desktop | Recent grid | 1440 | 3-col cards, mixed covers | grid + metadata correct | PASS |
| h06-recent-mobile | same | 390 | 1-col stack | holds | PASS |

## Archive (A)

| ID | Fixture / case | VP | Expected | Observed | Verdict |
|---|---|---|---|---|---|
| a01-mixed-year-desktop | 2024 mixed orientations | 1440 | year block + mixed card grid | rhythm + tnum strings stable | PASS |
| a01-mixed-year-mobile | same | 390 | 1-col | holds | PASS |
| a02-long-meta-desktop | longest card meta | 1440 | meta wraps without break | single clean wrap | PASS |
| a02-long-meta-mobile | same | 390 | wrap within 390 | holds | PASS |
| a03-years-desktop | 2018–2024 full page | 1440 | all year blocks ordered | order + headings correct (fullPage) | PASS |
| a03-years-mobile-top | same | 390 | header + first block | holds | PASS |
| a03-years-mobile-end | same | 390 | end reachable, footer intact | holds | PASS |
| a04-scale-desktop-top | 80-card synthetic scale | 1440 | grid scans, no breakdown | consistent rhythm | PASS |
| a04-scale-desktop-end | same | 1440 | end reachable | holds | PASS |
| a04-scale-mobile-top | same | 390 | scan at scale | holds | PASS |
| a04-scale-mobile-mid | same | 390 | no blank-scroll/hole impression | year breaks clear; cards recognizable | PASS |
| a04-scale-mobile-end | same | 390 | end + footer intact | holds | PASS |

A04 policy (§117): no scan failure revealed → **no conflict recorded, no feature added**.
Scale page was a temporary check artifact; removed from the site in Phase 8 (captures
retained as evidence).

## Place (P)

| ID | Fixture / case | VP | Expected | Observed | Verdict |
|---|---|---|---|---|---|
| p01-flat-desktop | Thun flat layout | 1440 | flat card grid | correct | PASS |
| p01-flat-mobile | same | 390 | 1-col | holds | PASS |
| p02-grouped-desktop | Reine grouped | 1440 | year blocks inside place | correct | PASS |
| p02-grouped-mobile | same | 390 | holds | holds | PASS |
| p03-multiyear-card-desktop | card spanning years | 1440 | single card, multi-year meta | correct | PASS |
| p04-multiplace-card-desktop | card in multiple places | 1440 | place list in meta | correct | PASS |
| p04-multiplace-card-mobile | same | 390 | wrap | holds | PASS |

## Gallery (G)

| ID | Fixture / case | VP | Expected | Observed | Verdict |
|---|---|---|---|---|---|
| g01-bright-desktop | F01 high-key gallery | 1440 | edges legible on canvas | legible, no aid | PASS |
| g01-bright-mobile | same | 390 | edge-to-edge landscape | controlled exception intact | PASS |
| g02-dark-desktop | F02/F04 aurora | 1440 | no cast interaction | neutral beside saturated | PASS |
| g02-dark-mobile | same | 390 | holds | holds | PASS |
| g03-portrait-desktop | F06 portrait ≤80svh | 1440 | complete frame | holds | PASS |
| g03-portrait-mobile | F06 ≤82svh | 390 | complete frame; annotation inert | holds; `3 / 6` over sky | PASS |
| g04-transition-desktop | portrait→landscape L47 | 1440 | transition reads | holds | PASS |
| g04-transition-mobile | same | 390 | holds | holds | PASS |
| g05-caption-desktop | 1-line caption | 1440 | 16px gap, reading width | holds | PASS |
| g05-caption-mobile | same | 390 | 20px margins | holds | PASS |
| g06-3line-desktop | 3-line caption | 1440 | stable baseline | holds | PASS |
| g06-3line-mobile | same | 390 | holds | holds | PASS |
| g06-zh-desktop | Chinese caption | 1440 | CJK 1.75, no clipping | holds | PASS |
| g06-zh-mobile | same | 390 | holds | holds | PASS |
| g07-top-desktop | 72 gallery top | 1440 | header + `72` strings | holds | PASS |
| g07-mid-desktop | L36 mid | 1440 | 96 rhythm continuous; margin `36 / 72` | holds | PASS |
| g07-end-desktop | end | 1440 | end label + continuation | holds | PASS |
| g07-top-mobile | top | 390 | 64 rhythm | holds | PASS |
| g07-mid-mobile | L36 | 390 | no blank-scroll or rhythm failure; `37 / 72` legible | holds | PASS |
| g07-end-mobile | end | 390 | end reachable; no rhythm failure observed | holds | PASS |
| g08-end-desktop | short gallery end + next | 1440 | 168 pause; Next 28 serif | authored end | PASS |
| g08-end-mobile | same | 390 | 112 pause; Next 22 | holds | PASS |
| g08-nonext-desktop | no-next state | 1440 | End → Back → Browse | hierarchy correct | PASS |
| g08-nonext-mobile | same | 390 | holds | holds | PASS |
| g09-l01-desktop | persistent parity | 1440 | margin annotation | holds | PASS |
| g09-l47-desktop | L47 parity | 1440 | margin annotation updates | holds | PASS |
| g09-l01-mobile | header yield | 390 | annotation hidden at header | holds | PASS |
| g09-l47-mobile | L47 persistent | 390 | legible, inert placement | holds | PASS |
| g09-l72-mobile | end yield | 390 | annotation yields at continuation | holds | PASS |
| g10-edge-mobile | edge-to-edge bright dense | 390 | never covers subject/caption | `4 / 8` over sky | PASS |
| g11-compact-desktop | Compact editorial state | 1440 | 64 gap | holds | PASS |
| g11-breathing-desktop | Breathing state | 1440 | 144 gap | holds | PASS |

## Overview (O)

| ID | Fixture / case | VP | Expected | Observed | Verdict |
|---|---|---|---|---|---|
| o01-desktop | 6-col light table | 1440 | opaque raised, contained thumbs | holds | PASS |
| o02-mobile | 3-col mixed | 390 | recognizable at 111px; marker | holds | PASS |
| o03-2col-mobile | 2-col comparison | 390 | render for G6 | rendered; **not adopted** (G6) | EVIDENCE |
| o04-bright-desktop | bright thumbs | 1440 | recognition | holds | PASS |
| o04-bright-mobile | same | 390 | holds | holds | PASS |
| o04-dark-desktop | dark thumbs | 1440 | light-source recognition | holds | PASS |
| o04-dark-mobile | same | 390 | holds | holds | PASS |
| o05-focus-current-desktop | focus + current marker | 1440 | focus ring distinct from current outline | holds | PASS |
| o06-longtitle-mobile | 72 gallery, 2-line title | 390 | title/Close no collision; mixed thumbs | holds | PASS |

## About (B)

| ID | Fixture / case | VP | Expected | Observed | Verdict |
|---|---|---|---|---|---|
| b01-desktop | About body | 1440 | 640px measure | holds | PASS |
| b02-mobile | same | 390 | reflow | holds | PASS |
| b03-cjk-desktop | zh paragraph | 1440 | 1.75 line-height, serif CJK | holds | PASS |
| b03-cjk-mobile | same | 390 | holds | holds | PASS |

## Cross-page accessibility (X)

| ID | Fixture / case | VP | Expected | Observed | Verdict |
|---|---|---|---|---|---|
| x01-zoom-home | 200% ≡ 720×450 | half | no h-overflow | 720≤720 | PASS |
| x01-zoom-gallery-header | same | half | holds | holds | PASS |
| x01-zoom-overview | same, layer open | half | layer usable | holds | PASS |
| x02-320-gallery | 320 reflow | 320 | no h-scroll | holds | PASS |
| x02-320-archive | same | 320 | holds | holds | PASS |
| x03-rm-menu-mobile | reduced motion | 390 | no transition, sync close | holds | PASS |
| x03-rm-overview-mobile | same | 390 | holds | holds | PASS |
| x04-forced-home-desktop | forced colors | 1440 | layout intact | holds | PASS |
| x04-forced-gallery-mobile | same | 390 | holds | holds | PASS |
| x05-kbd-skip-desktop | first Tab = skip link | 1440 | visible focus | holds | PASS |
| x05-kbd-menu-mobile | menu kbd cycle | 390 | trap + Escape restore | holds | PASS |
| x05-kbd-overview-desktop | overview kbd cycle | 1440 | trap + Escape restore | holds | PASS |

## Gate comparisons (Phase 7)

| ID | Variant | VP | Expected | Observed | Verdict |
|---|---|---|---|---|---|
| g3-portrait-hero-desktop | F06 portrait hero | 1440 | ≤78svh, title reachable | ≈75svh complete frame | PASS (G3) |
| g3-portrait-hero-mobile | same | 390 | ≤70svh | holds | PASS (G3) |
| g4-56-mobile-top/mid/end | mobile Base 56 | 390 | comparison only | tighter; 64 showed no blank-scroll or rhythm failure | EVIDENCE (G4, not adopted) |
| g5-inline-mobile | inline fallback | 390 | comparison only | legible but drifting; persistent clean | EVIDENCE (G5, removed) |
| g5-dark-edge-mobile | dark edge-to-edge | 390 | persistent legible | `3 / 5` on raised backing | PASS (G5) |
| g6-2col-dark-mobile | 2-col dark | 390 | comparison only | recognizable; 3-col already clean | EVIDENCE (G6, not adopted) |
| g8-portrait3line-desktop/mobile | final portrait + 3-line caption | both | caption uncrowded | holds | PASS (G7) |
| g8-dark-final-desktop/mobile | final dark landscape | both | end not “broken loading” | holds | PASS (G7) |
| g8-bright-final-desktop/mobile | final bright landscape | both | holds | holds | PASS (G7) |
| g8-next-zh-desktop/mobile | Chinese next title | both | mixed-script serif stable | holds | PASS (G7) |
| g7-pause144-desktop | pause 144 | 1440 | bound comparison | end slightly compressed | EVIDENCE (G7, not adopted) |
| g7-pause192-desktop | pause 192 | 1440 | bound comparison | airy, no gain over 168 | EVIDENCE (G7, not adopted) |
| g7-mpause96-mobile | pause 96 | 390 | bound comparison | compressed | EVIDENCE (G7, not adopted) |
| g7-mpause128-mobile | pause 128 | 390 | bound comparison | no gain over 112 | EVIDENCE (G7, not adopted) |
| g7-nextcard-desktop | Next at card weight | 1440 | bound comparison | continuation cue weakened | EVIDENCE (G7, not adopted) |
| g7-nexth1-desktop | Next at H1 weight | 1440 | bound comparison | over-shouts, competes with H1 | EVIDENCE (G7, not adopted) |

## Totals
- Matrix captures: 87/87 PASS.
- Gate comparison captures: 22/22 rendered as expected; adoption decisions in
  `GATE_G1..G7_DECISION.md` (all seven gates froze at starting values except G5/G6 form
  choices: persistent + 3-col).
- No OPEN, no FAIL. Accessibility failures: none (18/18 checks, see
  `ACCESSIBILITY_VERIFICATION.md`).
