# T4 — Mobile Progression Decision

## Decision

**KEEP VERTICAL.**

Decision type: **Prototype-based product decision**, not user-validated.

Isolation: **PASS**.

## Isolation re-check

The original blocker is independently closed:

```text
B L01: continuation hidden
B L47: continuation hidden
B L71: continuation hidden
B L72: continuation visible
B L72 → Previous → L71: continuation hidden again
A/B continuation content at end: identical
```

Live browser checks also confirm A/B parity for Gallery title, photographed metadata, Overview state, origin/Back behavior, 72-Photo fixture, canonical route, and image treatment. Machine results independently cover caption count/order/assets, focusability while hidden, no overflow, controls, and Back restoration.

The regenerated screenshots and updated `mobile-progression.webm` key frames support the same timing sequence. Full continuous video playback could not be reliably reviewed in this environment; timestamped key frames plus live browser reproduction were used.

## Prototype evidence

### Mixed orientation

- A preserves natural vertical rhythm: landscape and portrait Photos occupy different heights and transitions expose adjacent sequence context.
- B gives one Photo a stable stage and stronger single-image focus, but landscape Photos produce more vertical letterbox/empty space inside the fixed stage.
- Neither variant destructively crops the fixture.
- B's larger isolated image presentation is visible, but it is not evidence of a better 72-Photo Gallery model.

### Authored sequence

- A makes sequence continuity spatially explicit: the next/previous Photos remain part of one continuous authored flow.
- B preserves exact authored order and gives clear Previous/Next controls, but each Photo becomes a separate discrete stage.
- Both show `n / 72` and share the same Overview, so Overview utility cannot be credited to either variant.

### Gallery length awareness

- A communicates length through physical scroll plus `n / 72` and Overview.
- B communicates length mainly through `n / 72` and Overview; only the active Photo is visible.
- B does not demonstrate a clearer sense of remaining extent than A.

### Navigation cost

- B requires one explicit swipe/tap per adjacent Photo; traversing or returning several Photos requires repeated discrete actions unless Overview is opened.
- A supports inertial continuous scrolling, rapid multi-Photo backward movement, and local visual context.
- B's controls are more explicit for one-step navigation, but this does not produce a clear long-sequence advantage.

### Mobile ergonomics

- B's visible controls and non-edge swipe implementation reduce gesture ambiguity.
- A avoids horizontal gesture/browser-back competition altogether.
- The prototype provides no participant evidence that repeated swipe is less fatiguing than repeated scroll.
- Mechanically, Swipe-first adds up to 71 explicit forward gestures/taps for a complete Gallery; no prototype evidence shows a compensating advantage.

### Captions

- A keeps caption immediately after its Photo within the sequence flow, followed by the next image.
- B preserves the same caption but places it after the fixed stage/control region; in the required viewport it can fall below the initial image/control view.
- This can be visually refined in Stage 3, but the retest does not show a caption-rhythm advantage for B.

### End recognition

- Both variants now reach the same continuation only after L72.
- B disables Next at `72 / 72`; Previous returns to `71 / 72` and hides continuation again.
- A and B use byte-identical continuation content/hierarchy at true Gallery end.
- No premature exit opportunity remains.

## Strength of evidence

**Medium.** Isolation and mechanics are strongly verified, but there are no real participant sessions for fatigue, preference, comprehension, or completion.

## What is directly observed

- Isolation fix passes all five required state checks and A/B end parity.
- Both variants preserve content, order, captions, Overview, metadata, origin, and continuation.
- Swipe-first provides larger single-image focus and explicit adjacent controls.
- Vertical provides continuous sequence context and lower-cost multi-Photo traversal.
- Mixed orientations remain legible in both; B uses more fixed-stage empty space.
- Captions and end state are mechanically consistent after the fix.

## What is inferred

- Vertical better matches the archive's sequence-first viewing contract because continuity remains visible without requiring 71 discrete stage transitions.
- Swipe-first's advantages are local to single-image focus and one-step control clarity, not the complete long-Gallery task.
- The comparison is close/mixed rather than a clear Swipe-first win, so the frozen conservative rule applies.

## What is not validated

- Actual user fatigue from repeated scroll or swipe.
- Real-device browser edge gestures beyond prototype mechanics.
- Participant understanding of authored sequence and remaining extent.
- Real-photograph portrait/landscape rhythm and caption reading behavior.
- User preference or completion rate.

## Product rationale

Swipe-first may be suitable for a single-image viewer, but this product's primary contract is an authored Gallery sequence. The prototype does not demonstrate the clear multi-criterion advantage required to replace the frozen Vertical default.

## Trade-offs

- Vertical accepts longer physical pages and occasional portrait dominance.
- Swipe-first offers larger isolated Photos and explicit one-step controls.
- Vertical has lower structural interaction cost for rapid backward/forward movement across several Photos.
- Overview remains available for non-adjacent navigation in either model.

## Prototype defects, if any

No remaining blocking T4 implementation defect was found after the retest.

Possible Stage 3 visual refinements—not product defects—include current-position typography, portrait/landscape sizing rhythm, caption spacing, control placement, and continuation styling.

## Final rule entering MVP

Mobile Gallery progression is frozen as:

```text
Primary progression = Native vertical sequence
Overview = available as frozen by T3
Horizontal swipe-first = not the MVP progression model
Current position = n / total
Captions = follow their Photos in sequence
Continuation = shown only after the final Photo
```

Swipe-first may be reconsidered only for a future distinct single-image viewer requirement, not as the default Gallery progression without new evidence.

