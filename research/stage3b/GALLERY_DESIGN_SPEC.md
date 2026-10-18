# Stage 3B — Gallery Design Spec

Status: **primary Stage 3B page specification**. This file must be complete enough that the Stage 3C implementation agent never has to “design the Gallery.” Frozen items come from Stage 2B/3A; starting values are Stage 3B's recommended application; gates G4/G5/G7 must be run before freezing those values.

## Role

Gallery is the canonical viewing unit: one authored sequence of Photos in native vertical scroll, with a quiet header, an explicit Overview, an honest authored end, and a text-led continuation. Nothing on this page may compete with the photographs.

## Frozen product behavior

- Native vertical sequence; no swipe-first mode, no slideshow, no internal scroller, no fullscreen assumption.
- Overview: secondary, explicitly invoked, authored order, current marker, exact restore, target jump; no route/history entry; captions live in the sequence.
- Continuation appears only after the true final Photo: `Next Gallery — {title}` primary, `Back to {origin}` secondary; no-next case swaps Back to primary with `Browse Archive` secondary.
- Canonical Gallery URL; stable Photo identity; position restoration on Overview jumps.
- Every Photo keeps its complete frame (no destructive crop).

Viewing hierarchy (Frozen):

```text
Photo > sequence whitespace > title/caption > date/Place > Back/Overview/position > continuation
```

Within the header, before photos load the eye: Title > Date/Place > utility controls. After the first Photo appears: Photo > everything else.

## Visual objective

A carefully edited photobook sequence translated into native vertical viewing. The interface is stable, readable, and forgettable; rhythm — not effects — creates the tactile quality.

## Content order

```text
Global header
Gallery header:
  Back to {origin}
  Gallery title
  photographed date/range · Place(s)
  [optional short description]
  Overview {count}
Photo 1 (+ caption)
  … sequence with n / total annotation …
Photo N (+ caption)
End pause
End label: “End of {Gallery title}”
Next Gallery — {title}
Back to {origin}
Footer (quiet)
```

## Desktop composition

### Gallery header

- In normal document flow on the reading column (max ≈ 680 px), leading edge aligned with captions and continuation; **not sticky** (Frozen).
- Order and gaps:
  - `Back to {origin}` first, small underlined text link (metadata/secondary sans), gap L–XL (24–48) to title;
  - Gallery title, display serif 42–52 px, weight 400–500, line-height 1.08–1.16, tracking −0.01em–0;
  - title → metadata group: M (16);
  - metadata group: photographed date/range and Place(s) in one compact block, metadata sans 12–14 px secondary; Place names are underlined links; multi-place names wrap;
  - optional description: at most 2–3 lines in caption/body sans role (14–16 px), full secondary contrast, capped at caption measure; gap M above; it is authored context, **not** a museum data panel — no label/value grid, no camera data, no facts table;
  - `Overview` entry: below the metadata group (gap L), text control `Overview` optionally followed by photo count `Overview · 72` (count allowed here; not required in title block);
- Header → first Photo: XL–XXL. Starting value: 72 px (composite XL+L). Enough to mark the sequence start; not a ceremonial blank viewport (Frozen range).

### Sequence frame

- Each Photo centers inside the broad media frame (`min(90vw, 1440px)` ceiling); calm neutral outer margins remain; no desktop full-bleed (Frozen).
- Header/captions/continuation stay on the narrower reading column; images are wider than text. One continuous vertical axis; no left/right alternation.

### End and continuation

- End pause: Breathing-plus (Frozen range 144–192 px). Starting value: **168 px** (XXL+XL+L). Gate G7.
- `End of {Gallery title}`: metadata sans, secondary color, on the reading column leading edge; no divider line, no animation.
- End label → Next Gallery: XL (48).
- `Next Gallery — {title}`: display serif, the largest interactive text in the end state, unboxed link; starting size 26–30 px desktop (between card and H1 roles) — Gate G7 finalizes weight. Title wraps to 2–3 lines if long; no truncation.
- Next metadata: **omitted by default** (no date, no Place, no excerpt). A photographed date may be added only if two fixture titles prove genuinely ambiguous.
- Cover: **NO in MVP** (Frozen).
- Next title → `Back to {origin}`: L (24); Back is a standard underlined secondary link.
- No-next state: `Back to {origin}` primary position, `Browse Archive` secondary; same visual roles.
- Continuation → footer: XXL.

## Mobile composition

### Gallery header

- Same order as desktop within 20 px side margins. Back link first; title 32–38 px serif; metadata group below (gap M); optional description capped as desktop; `Overview` below metadata.
- Header → first Photo starting value: 48 px (XL).

### Sequence

- One column, native vertical scroll. Default media width = content width (viewport − 2×20 px).
- Controlled edge-to-edge exception: landscape media may span full viewport width when it materially improves viewing; captions, counters, and controls stay inset 20 px; complete image always visible; never applied to text (Frozen exception rules).
- No fixed-height stage, no swipe progression, no overlays to recover space.

### End and continuation

- End pause starting value: **112 px** (XL+XL+M composite), within Frozen 96–128 range. Gate G7.
- End label, Next title (20–24 px serif starting), Back link: same anatomy and leading-edge alignment as desktop, inset margins.
- `Back to {long Place name}` wraps; no truncation.

## Typography roles

- Gallery title: Display serif role. Desktop max-width: reading column (≈680 px); wraps to 2–3 lines; never truncated (Frozen). Mobile: wraps freely at 32–38 px.
- Long titles: the block grows; line-height 1.08–1.16 keeps multi-line titles calm.
- Chinese titles: deliberate CJK serif fallback; no negative tracking (CJK default 0); line-height may rise toward 1.16–1.2; baseline matched to Latin serif.
- Serif role marks the authored boundary (title, Next title); every utility string (dates, Places, counts, labels, position) is sans.
- Metadata: 12–14 px sans secondary; date first, Place(s) second; tabular numerals.
- Captions: Caption role (see below).

## Image rules

### Desktop landscape

- Width-led: up to the media-frame ceiling `min(90vw, 1440px)`; centered; natural height; neutral margins on both sides.
- Do not force every landscape to the ceiling when source resolution argues smaller; do not letterbox.

### Desktop portrait

- Height-led: max-height starting value **80svh** (Frozen range 78–84svh); width follows intrinsic ratio; centered in the media frame; caption aligns to the image's own leading edge.
- Narrow portraits appear small in area — truthful presentation, not a defect. No width-matching to landscapes.

### Square/panorama

- Square: portrait-height ceiling + landscape-width ceiling together; no special frame.
- Panorama: width-led at natural shallow height; never cropped to a banner.

### Mobile

- Landscape: content width by default; edge-to-edge exception conditional (above).
- Portrait: image area ≤ about 82svh (Frozen target); very tall stitched images may exceed only when the complete image would otherwise be unusably small; native scroll only.
- Side margin: 20 px default; 0 only for the media-only exception; captions inset.
- Caption inset applies even under edge-to-edge media.

### Universal

- No crop, no overlay, no per-image mat, no background extraction, no zoom on interaction. Optional 1 px neutral edge aid for disappearing high-key edges (visual implementation detail, global switch).
- Loading reserves intrinsic aspect; static raised-neutral placeholder; failed image shows accessible text state in reserved frame.

## Spacing/rhythm

Frozen three-state system; **Base is the default; orientation alone never chooses rhythm.**

| Rhythm | Desktop | Mobile | Stage 3B application rule |
|---|---:|---:|---|
| Compact | 64–72 | 40–48 | Only for authored deliberate pairs (diptych, immediate detail/counterpoint). Authored per Gallery in content; never automatic. Starting value inside range: 64 / 40. |
| Base | 96 | 64 | Every ordinary Photo-to-Photo transition. Gate G4 validates against the 72-Photo fixture. |
| Breathing | 144 | 96 | Chapter shift, major tonal break, or clear pause before/after a pivotal Photo. Rare: at most a few per long Gallery; never repeated consecutively. |

Additional rhythm rules:

- Photo → caption: 12–16 px (starting 16, M). Caption gap is independent of rhythm.
- Captioned Photo → next Photo: the rhythm gap starts **after** the caption text.
- Uncaptioned Photo: rhythm gap directly after the image; no reserved caption region.
- 2–3-line captions grow the block naturally; never compress the following gap.
- Gallery beginning: header → first Photo 72 desktop / 48 mobile (above).
- Gallery ending: Breathing-plus pause 168 / 112 starting (Gate G7).
- Orientation changes add nothing automatically; portrait→landscape keeps the authored rhythm.
- Long Gallery: spacing stays constant; no count-based compression (Frozen).

## Metadata placement

- Header metadata group only: date/range first line, Place(s) second line (or one line when short). No photo-by-photo metadata; no camera data; no EXIF.
- `n / total` is orientation, not metadata chrome (see Interaction states).
- Overview count may pair with the Overview label; Photo count does not appear in the title block.

## Interaction states

### Back / Overview / continuation

- Plain text controls with visible hover/focus states; hit areas extended invisibly to ≈40 px desktop / 44 px touch without visual growth.
- Neither floats over a Photo. Overview label may gain a minimal grid icon only if user testing proves recognition needs it; text label always present.
- Overview entry appears in the header. A second entry is added only if Stage 3C evidence shows long-sequence access requires it; no sticky toolbar (Frozen).

### Current position (`n / total`)

- Format frozen: `n / total`, tabular numerals, utility sans 12–13 px, secondary color, non-interactive, not focusable, no pill, no progress bar, no arrows.
- **Desktop recommended (starting specification):** persistent margin annotation in the trailing outer margin beside the media frame, vertically tracking the current Photo; quiet text on canvas (no backdrop needed where margins are clear); disappears/yields at the Gallery header and the continuation so end actions never read as another Photo.
- **Mobile recommended starting form (Gate G5):** persistent low-weight annotation at the safe trailing edge with a minimal raised-neutral backing, inset from viewport edges and safe areas; must never cover caption, gesture areas, or meaningful image content. **Fallback (G5 comparison):** inline counter attached to the active Photo block (below the caption region or between Photo and caption area), same styling.
- Both forms are orientation text, never controls. Do not decide between them without the G5 real-photo comparison; do not silently freeze.

### Overview behavior

- Opens as a full-viewport in-page layer (see `OVERVIEW_DESIGN_SPEC.md`); background scroll locked; closes back to exact position; jump to selected Photo.

## Accessibility constraints

- Skip link; one H1 (Gallery title); logical order Back → title → metadata → Overview → sequence → continuation.
- Caption ≥ 4.5:1 on canvas; never over a Photo.
- Position annotation passes contrast on canvas/raised backing; must not rely on photo-derived contrast.
- Keyboard: full sequence scrollable; Overview open/jump/close keyboard-operable; focus restoration on close.
- 200% zoom: title, metadata, caption, position, controls never clip; 320 px reflow without horizontal scroll.
- Reduced motion: no sequence entrances; only functional state transitions remain.
- Every Photo has an editorial alt/description decision at publish; captions ≠ alt text.

## Edge cases

- Short Gallery (3 Photos): same structure; end pause still present; continuation still text-led.
- 72-Photo Gallery: Base rhythm constant; Breathing rare; position and end recognition intact (G4 fixture).
- Zero-Place Gallery: metadata shows date only; no empty slot.
- Multi-place Gallery: Places wrap as links in the metadata group.
- Final Photo is portrait with 3-line caption: end pause starts after caption; continuation never attaches to or covers it.
- No next Gallery: Back primary / Browse Archive secondary variant.
- Very dark final Photo followed by end label: label sits on canvas with normal contrast; no adaptation needed.
- Direct canonical entry (no known origin): Back uses Archive fallback per frozen interaction spec.

## Real-photo stress cases

Bright landscape, dark landscape, low-contrast, saturated, portrait, portrait→landscape alternation, captioned (1-line and 3-line), Chinese caption, uncaptioned stretches, 72-photo long Gallery, end + continuation states, mobile edge-to-edge landscape vs inset, deep-black-edge and high-key-edge photos.

## Recommended starting values

| Item | Starting value | Status |
|---|---|---|
| Reading column | ≈680 px | Recommended |
| Header → first Photo | 72 px desktop / 48 px mobile | Recommended |
| Landscape ceiling | min(90vw, 1440px) | Recommended within Frozen range |
| Portrait max-height | 80svh desktop | Recommended within Frozen 78–84 |
| Mobile portrait area | ≤ 82svh | Frozen target |
| Base rhythm | 96 / 64 | Starting; G4 |
| Compact inside range | 64 / 40 | Recommended |
| Photo → caption | 16 px | Recommended |
| End pause | 168 px desktop / 112 px mobile | Starting; G7 |
| Next title size | 26–30 desktop / 20–24 mobile serif | Starting; G7 |
| Desktop position | trailing margin annotation | Recommended |
| Mobile position | persistent annotation (fallback inline) | Starting; G5 |

## Prototype-gated values

- G4: Base rhythm exact value in a 72-Photo mixed Gallery (blank-scroll fatigue vs stability).
- G5: mobile persistent vs inline current position with real edge-to-edge and inset media.
- G7: end pause distance and Next-title typographic weight.
- G1/G2 outcomes (fonts, canvas) apply to this page as everywhere.

## Must not introduce

- Slideshow mode, swipe progression, fullscreen chrome, sticky toolbar or header, progress bar, filmstrip, autoplay, image overlays of any text, zoom-on-hover, per-orientation templates, equalized image sizes, recommendation styling at the end, cover in continuation, multiple next-Gallery suggestions, previous-Gallery CTA, dark background “immersive” mode, scroll reveals.
