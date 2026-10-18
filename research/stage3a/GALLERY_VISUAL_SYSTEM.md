# Stage 3A — Gallery Visual System

Status: **primary Stage 3A viewing specification**. Gallery remains the canonical editorial/viewing unit and native vertical sequence is frozen.

## Viewing hierarchy

```text
Photo
  > sequence whitespace
    > Gallery title and caption
      > photographed date / Place
        > Back / Overview / current position
          > continuation after the true final Photo
```

The hierarchy does not hide controls. It makes them stable, readable, and visually secondary.

## Gallery entry and header

### Composition

- Header is in normal document flow and is **not sticky**.
- `Back to {origin}` appears first or at the leading edge as a small text link.
- Gallery title uses the display serif and is the dominant text.
- Photographed date/range and Place(s) form one compact metadata group below the title.
- `Overview` is a neutral text button/link visually aligned with the Gallery context, not a filled primary CTA.
- Photo count is not required in the title block. Overview may pair its label with count if useful.
- No breadcrumb trail, Visit hierarchy, category tags, description panel, or slideshow controls.

### Header rhythm

- Back-to-title gap: L–XL.
- Title-to-metadata gap: M.
- Metadata-to-Overview relationship: same group or L depending on layout.
- Header-to-first-Photo gap: XL–XXL; enough to mark the start of the sequence, not a blank ceremonial viewport.

## Image scale

### Desktop landscape

- May use up to the broad Gallery media frame, approximately `min(88–92vw, 1360–1440 px)`.
- Retain neutral outer margins; no default full-bleed.
- Do not force every landscape to the same width when source resolution or editorial scale argues for a smaller presentation.

### Desktop portrait

- Height-led constraint around **78–84svh**.
- Intrinsic width follows naturally; no crop and no width matching to landscapes.
- Center within the media frame; caption aligns to the image edge.

### Mobile

- Native vertical one-column sequence.
- Default uses available content width; controlled edge-to-edge is allowed for media-only landscape viewing.
- Portrait image area usually stays at or below about **82svh**.
- No fixed-height slide stage, horizontal swipe progression, or internal scroller.
- Controls/captions never overlay the Photo to recover space.

## Sequence rhythm

### Three-state system

| Rhythm | Desktop | Mobile | Meaning |
|---|---:|---:|---|
| Compact | 64–72 px | 40–48 px | Intentional pair or close visual sentence |
| Base | 96 px | 64 px | Default Photo-to-Photo transition |
| Breathing | 144 px | 96 px | Major editorial pause or chapter change |

### Application rules

- **Base is the default.** Compact and Breathing must be editorial choices, not algorithmic responses to orientation.
- Caption gap is approximately 12–16 px. The next sequence gap begins after caption text.
- Uncaptioned Photos reserve no caption area.
- A two- or three-line caption increases the block height naturally; do not compress the following rhythm to compensate.
- Portrait/landscape alternation does not change the gap automatically.
- In long Galleries, do not use Breathing repeatedly. Continuous authored progression is more important than making every image a separate “room.”
- Stage 3B must test a 72-Photo sequence for blank-scroll fatigue and tune the exact mobile Base value within the stated system.

## Caption

- Attached directly below its Photo, never in a detached global panel.
- Uses 14–16 px utility sans, normal weight, 1.5–1.6 line-height, measured accessible contrast.
- Aligns to the Photo's leading edge where practical and is capped at a readable measure.
- Does not overlay the image.
- May wrap to 2–3 lines. It is not truncated.
- A caption is editorial text, not a substitute for image alternative text.

## Current position

Decision: **persistent during the active sequence, but rendered as a quiet, non-interactive margin annotation rather than a control bar**.

- Format remains `n / total` using tabular numerals.
- Desktop: place in the Gallery's trailing outer margin where it can remain stable without covering the image.
- Mobile: place at the safe trailing edge in a minimal neutral-backed annotation when the image uses the full width; it must not block caption, system gestures, or meaningful image content.
- Use utility size (12–13 px), secondary text color, no pill, no progress bar, no arrows.
- The counter disappears or yields at the Gallery header and continuation so it does not imply that the end actions are another Photo.
- It is orientation, not navigation; it is not focusable or clickable.
- If Stage 3B cannot keep a persistent mobile annotation from obscuring real photographs, the reversible fallback is an inline counter attached to the active Photo block. Do not create a slideshow bar.

This is one of the explicit **needs visual prototype** decisions.

## Back and Overview

- Both are clearly operable text controls with visible hover/focus states.
- `Back to {origin}` communicates context and stays quieter than the title.
- `Overview` may have a minimal grid icon only if the icon improves recognition in user testing; the text label remains.
- Neither control floats over the Photo.
- Overview entry appears in Gallery context and may be repeated only if Stage 3B proves long-sequence access requires it. Stage 3A does not add a sticky toolbar.

## End-of-Gallery continuation

### End signal

- After the final Photo/caption, use a **Breathing-plus** pause: approximately 144–192 px desktop and 96–128 px mobile, tuned to the final image scale.
- Then show a small explicit line such as `End of {Gallery title}` in metadata styling. This makes the authored boundary clear without a divider animation or full-screen interstitial.

### Primary and secondary actions

```text
Primary:   Next Gallery — {title}
Secondary: Back to {origin}
```

- The Next Gallery is a **text-led editorial continuation**, not a recommendation card.
- **No cover image in MVP continuation.** A cover would make the end resemble a recommendation feed and could compete with the final Photo.
- Show the next title prominently enough to identify it. Do not add excerpts, similarity labels, multiple recommendations, or a carousel.
- Additional metadata is omitted by default. A photographed date may appear only if two titles are genuinely ambiguous in Stage 3B fixtures.
- No previous-Gallery CTA and no repeated Place/Archive link cluster. Place/date remain available in Gallery context and Back returns to the origin.
- If no next Gallery exists, `Back to {origin}` becomes primary and `Browse Archive` secondary, following the frozen interaction spec.

## Long Gallery behavior

- Sequence spacing remains stable; no auto-compression based on count.
- Current position provides extent without a progress bar.
- Overview provides explicit non-linear access and exact return/jump behavior; it does not replace the sequence.
- Loading placeholders preserve height so counter and scroll position do not jump.
- No lazy reveal animation tied to every image; photographs appear when loaded without choreographed scroll entrance.

## Mobile visual rules

- Native vertical progression is the only default Gallery mode.
- Touch target size may grow without increasing visual control weight; invisible hit-area extension is preferred for small text controls.
- Back and Overview remain accessible near the header; Menu remains global.
- Caption, position, and continuation use the same role hierarchy as desktop.
- Edge-to-edge media is conditional and never applies to text or controls.
- Safe-area padding is required for any persistent position annotation or full-screen Overview control.

## Gallery failure conditions

- Any destructive crop or orientation-specific template.
- A persistent slideshow/control bar.
- Position indicator visually competes with captions or covers image content.
- Every Photo is isolated by oversized blank space, making a 72-Photo Gallery exhausting.
- Captions appear detached, overlay images, or reserve blanks when absent.
- Overview/Back become bright filled buttons.
- Continuation appears before the final Photo or resembles a recommendation feed.
- Full-bleed, black background, or motion is used as a generic shorthand for “immersive.”

