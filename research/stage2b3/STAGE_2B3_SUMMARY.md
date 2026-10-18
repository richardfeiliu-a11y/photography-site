# Stage 2B3 Summary

## Prototype status

Independent evaluation and the isolated T4 retest checked frozen B2 specs, reports, machine results, regenerated screenshots, updated WebM key frames, live browser states, DOM/source isolation, and Git/workspace state. Prototype integrity is sufficient for all four decisions.

```text
T1 isolation: PASS
T2 isolation: PASS
T3 isolation: PASS
T4 isolation: PASS
```

No B1 structural issue was discovered.

## T1 decision

**KEEP A — Latest-first Home.**

A creates a photography-first first viewport on desktop/mobile while keeping Archive and Places direct. B pushes the authored Gallery below chronology and increases mobile scroll cost. Feature on/off and 2019 backfill mechanics are correct. Evidence strength: **Medium**, prototype-based, not user-validated.

## T2 decision

**KEEP progressive behavior.**

Flat is correct at low volume; headings earn their place when repeated years or known-year retrieval need temporal landmarks. Volume 20 shows both the benefit and vertical cost of grouping, so no numeric trigger is justified. Evidence strength: **Medium**, prototype-based, not user-validated.

## T3 decision

**PASS OVERVIEW — Overview enters MVP.**

The 72-Photo grid establishes extent; restore to L47, jump to L68, history stability, focus, and mobile layer are independently supported. Overview stays secondary to sequence. Mobile current-marker contrast needs Stage 3 refinement. Evidence strength: **Medium**; mechanics verified, sequence-bypass behavior not user-validated.

## T4 decision

**KEEP VERTICAL.**

Retest isolation passes: B continuation is hidden at L01/L47/L71, visible at L72, hidden again after Previous to L71, and byte-identical to A at end. Swipe-first gives larger isolated images and explicit controls, but adds one discrete action per Photo, weakens continuous length/context, and shows no clear advantage across mixed orientation, backward navigation, captions, authored sequence, or end recognition. Close/mixed evidence retains Vertical. Evidence strength: **Medium**, prototype-based, not user-validated.

## Evidence limitations

- No participant sessions; decisions are prototype-based, not user-validated.
- Neutral abstract placeholders limit real-photograph rhythm and recall realism.
- WebM evidence was visually checked through key frames and mechanics were reproduced; continuous timing/audio were not evaluated.
- Retest machine suite is 26/26 PASS and includes six continuation-timing/parity assertions; automation still does not equal user testing.
- Final font/color/branding/motion/card aesthetics are outside B3.

## Participant-testing recommendation

**Recommended but not blocking.** Three to five lightweight sessions—including mobile-primary users—may test backfill clarity, year-heading comprehension, Overview sequence bypass, and mobile fatigue. No formal statistical UX study is required.

## Files

- `PROTOTYPE_EVALUATION.md`
- `TEST_1_HOME_DECISION.md`
- `TEST_2_PLACE_DECISION.md`
- `TEST_3_OVERVIEW_DECISION.md`
- `TEST_4_MOBILE_DECISION.md`
- `IMPLEMENTATION_DEVIATION_REVIEW.md`
- `STAGE_2B_FINAL_DECISIONS.md`
- `STAGE_2B3_SUMMARY.md`

## Final gate

**Stage 2B complete — proceed to Stage 3 Design Specification.**

T1–T4 are frozen. Do not reopen B1/B2 during Stage 3 without a clearly demonstrated product failure.
