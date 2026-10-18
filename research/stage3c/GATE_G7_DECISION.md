# GATE G7 — Continuation pause + Next-title weight — DECISION

Status: **FROZEN** (Stage 3C Phase 8, per `research/stage3b/STAGE_3C_VISUAL_GATES.md` §G7)

## Question
What end-pause distance and Next-title typographic weight make the authored end clear
without feed styling?

## Starting state tested
End pause 168px desktop / 112px mobile; `End of {Gallery title}` metadata styling;
Next title serif 28px desktop / 22px mobile; Back link below; no metadata, no cover.
Bounded comparisons: pause 144/192 desktop, 96/128 mobile; Next weight card (21/19px)
vs H1-leaning (34/26px).

## Fixtures exercised
Final Photo portrait with 3-line caption (winter-returns, g8-portrait3line), final Photo
dark landscape (red-lanterns, g8-dark-final), final Photo bright landscape
(swiss-winter-quiet, g8-bright-final), next Gallery with long title (lofoten-fjord-lines
as next) and Chinese title (tengwang-pavilion as next), no-next state (ferry-crossings).

## Captures
Baseline: `g08-end-{desktop,mobile}`, `g08-nonext-{desktop,mobile}`,
`g8-portrait3line-{desktop,mobile}`, `g8-dark-final-{desktop,mobile}`,
`g8-bright-final-{desktop,mobile}`, `g8-next-zh-{desktop,mobile}`.
Comparisons (rejected): `g7-pause144-desktop`, `g7-pause192-desktop`,
`g7-mpause96-mobile`, `g7-mpause128-mobile`, `g7-nextcard-desktop`, `g7-nexth1-desktop`.

## Observations against pass criteria
- **End reads authored and final**: 168/112 pause + end label anchors the stop on every
  final-Photo class, including dark final (no “broken loading” read) and no-next state
  (End label → Back primary → Browse Archive).
- **Continuation reads editorial**: text-led Next serif title, no cover, no box, no
  recommendation styling; mixed-script 滕王阁 · Tengwang Pavilion next-title stable.
- **Caption never crowded**: 3-line caption keeps full whitespace before the pause
  (g8-portrait3line); long next-title wraps to 3 lines at mobile 22px without colliding
  with Back link.
- **Weight bounds**: card variant weakens Next toward metadata (continuation cue lost);
  H1 variant over-shouts and competes with the page H1 role. Baseline 28/22 sits exactly
  between roles — the quietest weight that still passes end-recognition.

## Decision rule applied
Keep starting values unless a capture fails. No capture failed at baseline; comparisons
confirm the bounds. Freeze the starting numbers.

## Frozen result
End pause **168px desktop / 112px mobile**; Next title serif **28px desktop / 22px
mobile**; hierarchy End label → Next primary → Back secondary; no cover in MVP;
no-next variant as implemented; appears only after the true final Photo.
