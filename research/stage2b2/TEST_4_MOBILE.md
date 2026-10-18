# Test 4 — Mobile Progression

## Question

Does vertical progression outperform swipe-first progression for a realistic mixed-orientation Gallery when captions, Overview state, metadata, continuation, assets, and sequence order remain identical?

## Recommended default

Variant A — native vertical progression.

## Variant A

- One continuous vertical sequence in authored order.
- Native page scroll; no horizontal gesture required.
- Full photograph always available without destructive crop.
- Current-position indicator updates from the Photo occupying the largest central viewport area.
- Portrait and landscape images use their shared responsive contain rules.

## Variant B

- One Photo stage at a time in the same authored order.
- Horizontal swipe advances/returns on mobile; explicit Previous/Next controls remain discoverable.
- Full photograph uses contain behavior; no crop.
- Same current-position indicator and captions as A.
- After the final Photo, the identical continuation baseline appears.

## Optional Variant C

None. Caption, Overview, and continuation are fixed conditions, not variants.

## Controlled variables

- G03 River Edges: identical 72 Photos, order, intrinsic dimensions, realistic weights, recall targets, and captions.
- Same Gallery metadata, current-position format, Overview state, continuation, entry route, and origin context.
- Same navigation, typography, colors, spacing intent, and focus visibility.
- Overview state is inherited from Test 3: on in both A/B if admitted, absent in both if rejected.
- Only progression direction and the minimum controls inherently required by that direction may differ.

## Desktop spec

Required sanity viewport: `1440 × 1000`.

- Variant A uses native vertical scroll.
- Variant B uses Previous/Next controls and Left/Right Arrow; desktop drag is optional and not evaluated.
- Desktop captures verify content parity, first Photo, mixed-orientation fit, and identical continuation; desktop is not the decision-driving environment.

## Mobile spec

Required decision viewport: `390 × 844`.

- Test `L01`–`L72`, including consecutive portraits, consecutive landscapes, mixed transitions, captioned/uncaptioned Photos, heavy samples, and recall targets.
- A landscape must remain legible; a portrait must not block access to caption/navigation or force accidental horizontal movement.
- Variant A must have zero page-level horizontal overflow.
- Variant B must not capture the operating-system/browser edge-back gesture region; visible Previous/Next controls provide a non-gesture fallback.
- Rotation is a sanity check only; return to portrait must preserve current Photo.
- Browser Back returns to origin and its prior list scroll position.

Required captures:

```text
t4-a-long-mobile-l01.png
t4-b-long-mobile-l01.png
t4-a-long-mobile-mixed.png
t4-b-long-mobile-mixed.png
t4-a-long-mobile-caption.png
t4-b-long-mobile-caption.png
t4-a-long-mobile-end.png
t4-b-long-mobile-end.png
```

## User tasks

1. Begin at L01 and explain how to move forward/back.
2. Move through a landscape→portrait→portrait→landscape transition.
3. Find `L18`, then return to an earlier Photo.
4. Continue through a captioned and uncaptioned Photo.
5. Reach `L47`, leave to origin using browser Back, then reopen and verify restoration behavior.
6. Reach the Gallery end and choose the next action.
7. State perceived Gallery length/orientation at the end.

Record completion, accidental gestures, wrong-direction moves, progression rate, fatigue comments, time/steps to return, current-position comprehension, back restoration, image-fit problems, and end recognition.

## Success criteria

- Both orientations remain legible and uncropped.
- Users can move forward/back without hidden knowledge or precision gestures.
- No horizontal overflow in A and no browser-back gesture conflict in B.
- Back restoration returns to origin appropriately; reentry behavior is consistent.
- Users recognize the Gallery end and the fixed continuation.
- A preserves authored order with equal or lower fatigue/errors than B; B may replace A only with clearly better observed performance and no discoverability/navigation penalty.

## Failure conditions

- A produces unreadably small landscapes, overpowering portraits, excessive fatigue, or unreliable return.
- B obscures Gallery extent, conflicts with browser navigation, hides controls, or increases swipe fatigue/errors.
- Caption, Overview, continuation, current-position metadata, or assets differ between A/B.
- The 72-Photo fixture is replaced with a short/light fixture for acceptance.
- Decision is based on visual novelty rather than observed tasks.

## Decision rule

Keep vertical progression unless swipe-first produces clearly more successful, less fatiguing navigation across the realistic long fixture without browser conflict, hidden controls, orientation loss, or weaker authored-sequence comprehension. Ambiguous results retain the frozen vertical default.

