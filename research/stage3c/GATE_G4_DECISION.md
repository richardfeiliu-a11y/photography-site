# GATE G4 — Long Gallery Base spacing — DECISION

Status: **FROZEN** (Stage 3C Phase 8, per `research/stage3b/STAGE_3C_VISUAL_GATES.md` §G4)

## Question
Does the Base rhythm hold across a 72-Photo Gallery without blank-scroll fatigue?

## Starting state tested
Base 96px desktop / 64px mobile, constant through the sequence; caption gap 16px;
Compact/Breathing only editorially.

## Fixtures exercised
The 72-Photo mixed-orientation Gallery (long-gallery-72, S09): captioned and uncaptioned
stretches, portrait→landscape transitions (g04 at L47).

## Captures
Baseline: `g07-{top,mid,end}-desktop`, `g07-{top,mid,end}-mobile`.
Comparison (allowed mobile 56–64 window): `g4-56-mobile-{top,mid,end}`.

## Observations against pass criteria
- **Sequence reads continuously** at 64px mobile: gaps read intentional between full-width
  frames; captioned stretches keep the 16px caption gap; no “lazy-loading hole” impression
  (g07-mid-mobile vs g4-56-mobile-mid).
- **Whitespace does not dominate**: at 390px frames are ≈260–290px tall; 64px gaps stay
  subordinate to photographs.
- **End reachable**: g07-end-mobile reaches the end label and continuation cleanly;
  no obvious blank-scroll or rhythm failure observed in prototype inspection.
- **Desktop 96**: mid-gallery read at 1440 shows continuous editorial rhythm with the
  margin annotation beside the frame (g07-mid-desktop).
- **56px comparison**: tighter but the 64px baseline showed no obvious blank-scroll or
  rhythm failure in prototype inspection; per the decision rule the larger value that
  avoids such failure is 64. (Prototype inspection only — no participant evidence.)

## Decision rule applied
PASS at starting values → freeze 96/64. Mobile 56 tested, **not adopted**.
Desktop unchanged (no conflict; desktop changes would require a recorded conflict).

## Frozen result
Base **96px desktop / 64px mobile**; caption gap 16px; Compact 64/40 and Breathing 144/96
editorial states retained; orientation never selects rhythm; no count-based compression.
