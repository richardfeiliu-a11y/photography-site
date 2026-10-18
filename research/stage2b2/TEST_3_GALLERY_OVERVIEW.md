# Test 3 — Gallery Overview Gate

## Question

Does a secondary Overview materially improve orientation, recall, return-to-position, and long-Gallery navigation without reducing sequence completion or authored-order viewing?

## Recommended default

Variant A — vertical sequence plus Overview. This is a gate: Overview enters MVP only if this test passes.

## Variant A

Vertical ordered sequence with one `Overview` control in Gallery context.

Overview behavior is fixed:

- Opens a full-viewport light-table layer in sequence order.
- Header shows Gallery title, `16 photos` or `72 photos`, and `Close`.
- Thumbnails do not show captions; caption content remains in sequence.
- The Photo most recently centered in sequence receives a restrained current-position indicator.
- Selecting a thumbnail closes Overview and returns to that exact Photo in sequence.
- Closing without selection returns to the exact pre-open scroll position.
- `Escape` closes on desktop; explicit Close works everywhere.
- Overview state does not create a product route or browser-history entry.

## Variant B

The identical vertical sequence and Gallery context with no Overview control or layer. All other behavior, including current Gallery metadata and continuation, remains identical.

## Optional Variant C

None. Grid-first is excluded because sequence-first is frozen.

## Controlled variables

- Same G01 short and G03 long Gallery, Photo order, images, weights, captions, metadata, entry route, start position, continuation, and current-position measurement.
- Same vertical sequence in A/B.
- Same navigation, typography, spacing, image sizes, and responsive rules.
- Only Overview availability changes.

## Desktop spec

Required viewport: `1440 × 1000`.

- Overview control is keyboard-focusable and visible in Gallery context without becoming the primary CTA.
- Light table uses a stable multi-column thumbnail grid sized for whole-Gallery scanning.
- Focus moves into Overview on open, stays trapped within the layer, and returns to the control/target sequence position on close.
- Required captures: A/B short top; A/B long top; A long Overview with `L47` current; A long after jump to `L68`; A/B long end.

## Mobile spec

Required viewport: `390 × 844`.

- Overview opens as a full-screen layer with a persistent Close target.
- Thumbnail grid is touch-scannable without horizontal page overflow.
- Selecting a thumbnail returns to the corresponding Photo with scroll position stable.
- Required captures mirror desktop for A/B long and include Overview top/mid states.

## User tasks

Run all tasks in both Short and Long fixtures; long-fixture evidence governs the gate.

1. Start at the Gallery beginning and view in order.
2. State how large the Gallery feels and, when available, determine exact extent.
3. Find known target `S14` or `L47`.
4. From the middle, open Overview, identify current position, and return without selecting another Photo.
5. Use Overview to jump to `L68`, then return to the preceding sequence area.
6. Find a late Photo without evaluator guidance.
7. Complete the Gallery and reach continuation.

Variant B performs equivalent tasks through sequence scrolling only; task wording must not mention Overview.

Record completion, time-to-known-image, wrong turns, overscroll/recovery, correct return position, Overview usage, sequence start-to-end completion, skipped ranges, and participant explanation of authored order.

## Success criteria

- In the long fixture, A produces clearly more successful/direct target retrieval and return-to-position than B for most participants.
- Participants can identify current position and Gallery extent without losing sequence context.
- Thumbnail selection returns to the intended Photo; close-without-selection restores exact prior position.
- Overview does not become the default entry, produce widespread sequence skipping, or reduce completion relative to B.
- Short Gallery performance does not justify Overview by itself; its purpose must be demonstrated on the realistic long fixture.
- Keyboard and touch interactions complete without traps or inaccessible controls.

## Failure conditions

- Overview is used mainly to bypass authored viewing.
- Sequence completion or comprehension is materially worse in A.
- Return-to-position is unreliable or users cannot tell where they are.
- Overview helps only the 16-Photo fixture or only improves aesthetic preference.
- The layer introduces horizontal overflow, focus loss, history pollution, or content differences.

## Decision rule

Admit Overview to MVP only if the long-fixture evidence shows material orientation/retrieval/return benefit with no meaningful authored-sequence or completion penalty. Otherwise freeze MVP as sequence-only and remove Overview from every Test 4 variant and handoff requirement.

