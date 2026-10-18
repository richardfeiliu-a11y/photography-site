# GATE G5 — Mobile current-position strategy — DECISION

Status: **FROZEN — persistent form** (Stage 3C Phase 8, per
`research/stage3b/STAGE_3C_VISUAL_GATES.md` §G5)

## Question
Can the persistent mobile `n / total` annotation coexist with real photographs, or must
it fall back inline?

## Starting state tested
Persistent low-weight annotation at the safe trailing edge (bottom-right), minimal
raised-neutral backing, inset from safe areas; utility sans 12.5px, secondary color,
tabular numerals. Comparison: inline fallback (`?pos=inline`).

## Fixtures exercised
Edge-to-edge bright landscape (lofoten-light #3, g10), edge-to-edge dark landscape
(aurora-nights #2, g5-dark-edge), portrait ≤82svh (portrait-studies, g03), dense
composition (ferry/lantern frames), 72-Photo Gallery positions L01/L47/L72 (g09).

## Captures
Persistent: `g09-l01-{desktop,mobile}`, `g09-l47-{desktop,mobile}`, `g09-l72-mobile`,
`g10-edge-mobile`, `g5-dark-edge-mobile`, `g03-portrait-mobile`, `g07-mid-mobile`.
Comparison (rejected): `g5-inline-mobile`.
Desktop parity (not in question): `g09-l01-desktop`, `g09-l47-desktop`.

## Observations against pass criteria
- **Legible on every fixture**: raised backing keeps 12.5px secondary numerals readable
  over bright sky (g10 `4 / 8`), dark aurora (g5-dark-edge `3 / 5`), and mid-image sky
  (g07-mid `37 / 72`).
- **Never obscures meaningful content**: annotation lands in inert sky/water regions on
  edge-to-edge and dense frames; portrait subject (face) never covered (g03 `3 / 6`).
- **Never covers caption or gesture zones**: caption blocks sit in canvas whitespace;
  backing inset 20px from safe edges.
- **Yields correctly**: hidden at header (g09-l01) and at continuation/end (g09-l72).
- **Inline comparison**: legible but position drifts with the active block; no stable
  glance point; not needed since persistent passed cleanly.

## Decision rule applied
Persistent wins only on a clean pass across every fixture — achieved. Inline form is
**removed, not kept as an option** (variant code deleted in Phase 8; `g5-inline-mobile`
retained only as decision evidence).

## Frozen result
Exactly one form ships: persistent bottom-right annotation, raised backing, 12.5px
secondary tabular numerals, yielding at header and continuation. Desktop margin
annotation unchanged (parity).
