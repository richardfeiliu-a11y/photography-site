# GATE G1 — Font pairing + CJK metrics — DECISION

Status: **FROZEN** (Stage 3C Phase 8, per `research/stage3b/STAGE_3C_VISUAL_GATES.md` §G1)

## Question
Which exact display serif + utility sans pair (with CJK companions) carries all roles
without metric or mixed-script failure?

## Starting state tested
Source-family route: `Source Serif 4` display + `Source Sans 3` utility, CJK companions
`Noto Serif SC` / `Noto Sans SC`, system fallback stacks per Stage 3A.

## Fixtures exercised
- F02 dark (`DSC01889`, red-lanterns), F01 bright (`DSC02071`/`DSC02066`), F04 saturated
  (`DSC02560`, aurora-nights), F09-sub near-neutral (`DSC02066`/`DSC02055`).
- Short Gallery (lofoten-light), 72-Photo Gallery (long-gallery-72), Chinese title
  (极光之夜), mixed-script title (滕王阁 · Tengwang Pavilion), 3-line caption
  (lofoten-light #5), Chinese caption (swiss-winter-quiet #2), `2018–2024` year strings
  (Archive), `72 / 72` strings, 200% zoom, mobile Menu, Archive card metadata.

## Captures
`h04-chinese-title-hero-{desktop,mobile}`, `b03-cjk-{desktop,mobile}`,
`g06-zh-{desktop,mobile}`, `g05-caption-{desktop,mobile}`, `g06-3line-{desktop,mobile}`,
`g07-top-desktop`, `a01-mixed-year-{desktop,mobile}`, `a02-long-meta-{desktop,mobile}`,
`x01-zoom-home`, `x01-zoom-gallery-header`, `x05-kbd-menu-mobile`,
`h01-bright-hero-*`, `h02-dark-hero-*`.

## Observations against pass criteria
- **Stable baselines**: 1-line and 3-line captions hold the 1.6 sans baseline; `[lang="zh"]`
  blocks at 1.75 with no clipping (a11y `long-title-wrap`, `cjk-wrap` PASS).
- **No glyph fallback holes**: 极光之夜 renders in the deliberate Noto Serif SC serif;
  mixed-script 滕王阁 · Tengwang Pavilion keeps serif continuity across the script boundary
  in H1, Next-link and card roles (h04, g8-next-zh, g08-end).
- **Readable small sizes**: 13px secondary metadata, 12.5px position annotation, 11px
  overview index all legible; tabular numerals keep `72 / 72` and `2018–2024` stable.
- **No theatrical look beside real photos**: serif stays weight 400, display sizes only.
- **200% zoom**: equivalent 720×450 layout reflows with no clipping (a11y `zoom-200` PASS).

## Decision rule applied
First candidate passing every case is frozen. No alternative route was needed.

## Frozen result
- Display serif `Source Serif 4` + CJK `Noto Serif SC`; utility sans `Source Sans 3` +
  CJK `Noto Sans SC`; Stage 3A fallback stacks unchanged.
- Role table, size ranges, weights, no all-caps labels, CJK line-height 1.75,
  no third/mono family — all retained exactly as specified.
