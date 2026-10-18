# GATE G6 — Overview mobile 3 vs 2 columns — DECISION

Status: **FROZEN — 3 columns** (Stage 3C Phase 8, per
`research/stage3b/STAGE_3C_VISUAL_GATES.md` §G6)

## Question
Does the 3-column mobile light table keep frames recognizable and targets operable with
real photography?

## Starting state tested
3 columns, 8px gaps, ≈111px cells at 390 reference. Comparison: 2 columns (≈160px cells).

## Fixtures exercised
Portrait-heavy sequence (portrait-studies / winter-returns), landscape-heavy sequence
(lofoten-light), dark + bright thumbnails (red-lanterns, swiss-winter-quiet), dense
composition thumbnails, saturated thumbnails (aurora-nights), 72-Photo Gallery at
current L47 region (o06 first screens).

## Captures
3-col: `o02-mobile`, `o04-bright-mobile`, `o04-dark-mobile`, `o06-longtitle-mobile`.
2-col (rejected): `o03-2col-mobile`, `g6-2col-dark-mobile`.
Desktop parity: `o01-desktop`, `o04-{bright,dark}-desktop`, `o05-focus-current-desktop`.

## Observations against pass criteria
- **Recognition at 111px** (expert visual inspection of prototype captures; no
  participant testing — thumbnails remained visually distinguishable in expert
  prototype inspection): landscape set — mountain silhouette, red cabins, ferry,
  sunset hues all distinguishable (o02); dark set — lantern glow and illuminated
  monument carry recognition (o04-dark); 72 mixed set — portrait and landscape cells
  contained uncropped, pavilion/aurora/bridge/cat frames identifiable (o06).
- **Targets**: cells ≈111×≥74px ≥ 24×24; a11y `overview-target-size` PASS (min edge
  111px ≥ 44); 8px gaps keep adjacent targets separate; no overlap.
- **Marker system**: current = 2px outline + numbered corner tags legible on raised
  layer; long two-line title does not collide with Close (o06).
- **2-col comparison**: expert-assessed recognition stronger but the light table loses
  map density and
  begins to read as a secondary gallery; not needed since 3-col passed cleanly.

## Decision rule applied
3 columns wins on a clean recognition + target pass — achieved. Exactly one column count
ships: **3**. The 2-col variant is removed from the prototype (captures retained as
evidence).

## Frozen result
Mobile Overview: 3 columns, 8px gaps, ≈111px cells at 390; contained uncropped
thumbnails; authored order; current marker system; opaque raised layer; no captions or
filters; Close text control. Desktop 6-col (5 at ≤1100px) unchanged.
