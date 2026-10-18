# Stage 3B — Overview / Light Table Design Spec

## Role

Overview answers exactly three questions: how long is this Gallery, where am I in authored order, and which Photo do I inspect in sequence. It is a subordinate inspection layer inside one Gallery — never the archive's front door, never a photo manager.

## Frozen product behavior

- Secondary, explicitly invoked from Gallery context; closes back to exact sequence position; target jump to selected Photo.
- Authored order, row-major reading order; current marker; no history/route entry.
- No captions, metadata, filters, sorting, view toggles, download, share, or slideshow controls.
- Never the default Gallery entry; thumbnail scale materially below sequence scale.

## Visual objective

A quiet opaque light table: extent and position become obvious in one glance, then it gets out of the way. Neutral, contained, unmistakably less important than the sequence.

## Content order

```text
Header: {Gallery title} · {total count}            Close
Thumbnail grid in authored order (current marker on active Photo)
```

## Desktop composition

- Full-viewport in-page layer (not a route) over the locked sequence. Background: raised neutral surface `#EFECE5`, opaque (Frozen neutral family; no black lightbox, no blur, no gradient).
- Header (Recommended starting specification): one compact row, L–XL top/bottom inset within the layer's outer margin; leading side: Gallery title in a compact heading role (card serif role 19–24 px) plus exact count in metadata sans (`{title} · 72`); trailing side: visible `Close` text control. Header stays available while the grid scrolls; chrome kept to this single row (visual implementation detail: sticky row vs repeated top bar, whichever preserves thumbnail space).
- Grid: **recommended starting count = 6 columns** at the 1440 reference. 5 columns is retained as the Stage 3C stress option if real portrait/dense thumbnails fail recognition at 6 — but only one default ships (Frozen direction 5–6; decision rule in Gate G6 context).
- Thumbnail cells: contain behavior inside consistent near-square cells; empty neutral space preferred over crop; no border, no card background.
- Gaps: **12 px** starting (S–M range). Outer margin: 48 px desktop (aligned with viewport gutter system).
- Title/count/Close hierarchy: title identifies context; count establishes extent; Close is the only persistent action. Nothing else exists.

## Mobile composition

- Same layer anatomy within 20 px side margins and safe areas.
- **Recommended starting spec = 3 columns** (Frozen starting direction). **Prototype gate G6 = 3 vs 2 columns using real photography** — do not freeze 3 early.
- Minimum useful thumbnail size: about 100 px on the short edge for recognition; if 3 columns at 390 px with ≥ 44 px touch targets and recognizable frames fails, fall back to 2 columns (≈160 px cells).
- Gaps: 8 px starting. Close target safe-area padded, top-trailing.
- Current indicator: same marker system as desktop. Focus indicator: 2 px perimeter.
- Count/title share the header row; long titles wrap, count stays visible.

## Typography roles

- Layer title: card serif role, compact — must NOT become more prominent than the Gallery sequence header (Frozen subordination).
- Count: metadata sans, tabular numerals.
- Close: navigation sans role, visible text, never icon-only.
- Current auxiliary cue (if textual): utility sans, 12 px.

## Image rules

- Complete Photos only; contain inside cells; no crop under any state.
- No hover zoom/lift/caption reveal; hover is a subtle neutral outline or slight opacity shift.
- Loading: reserved cell dimensions, static raised-neutral field.

## Spacing/rhythm

- Header → grid: L–XL (24–48).
- Grid gap: 12 px desktop / 8 px mobile starting.
- Outer margin: 48 desktop / 20 mobile (+ safe areas).
- Grid scrolls vertically inside the layer; no horizontal grid scroll; background sequence scroll locked.
- On open, current Photo is brought into the visible region.

## Metadata placement

- Only: title + total count in header. Nothing per thumbnail. No dates, Places, captions, indexes printed under cells.

## Interaction states

- Default: complete image, no border.
- Hover: subtle neutral outline or slight opacity shift (hover-capable devices only).
- Focus-visible: explicit 2 px focus perimeter, canvas-gap separated where needed; distinct from current marker; both may coexist.
- Active/pressed: brief neutral feedback; no enlargement.
- Current: persistent restrained 2 px outline or inset marker plus a non-color cue (accessible `Current` text or small corner index); survives bright, dark, and B&W thumbnails; never dims all non-current thumbnails to near-invisibility.
- Close: text control with hover/focus; `Escape` closes on desktop; focus contained in the layer and restored to the invoking control on exit.
- Motion: open/close 160–220 ms opacity + at most 4–8 px translation; selection closes with the same restraint; reduced motion removes translation (Frozen).

## Accessibility constraints

- Modal behavior: background inert, focus trapped, Close visible, focus restored.
- Every thumbnail has an accessible name/position (`Photo {n} of {total}`); no visual caption text in the grid.
- Marker is never color-only; meets 3:1 against adjacent cells.
- Touch targets ≥ 24×24 floor, aim 44 px; no overlapping adjacent targets.
- 200% zoom: Close, title/count, thumbnails remain reachable; layer remains scrollable.

## Edge cases

- 72-Photo Gallery at current L47: grid opens around current region; marker visible amid mixed images.
- Current at L01 or final Photo: marker immediate; Close reachable.
- All-dark or all-bright sequence: marker/focus survive.
- Mixed orientations: contain cells, authored order preserved.
- Very long Gallery title in layer header: wraps; count remains on final line.

## Real-photo stress cases

Desktop 6-col with dark/bright/dense/B&W thumbnails; current marker on bright and dark cells; mobile 3-col and 2-col comparisons with portrait-heavy and landscape-heavy fixtures; keyboard focus coexisting with current marker.

## Recommended starting values

| Item | Starting value | Status |
|---|---|---|
| Desktop columns | 6 (stress option 5) | Recommended; G6 context |
| Mobile columns | 3 (fallback 2) | Starting; G6 must test |
| Desktop gap | 12 px | Recommended |
| Mobile gap | 8 px | Recommended |
| Outer margin | 48 / 20 px | Recommended |
| Layer surface | raised `#EFECE5` | Frozen family |
| Marker | 2 px outline + non-color cue | Frozen system |
| Motion | 160–220 ms opacity + ≤8 px | Frozen |

## Prototype-gated values

- G6: mobile 3 vs 2 columns (recognition + 44 px targets with real photography).
- Marker detail tuning (outline vs inset; corner index vs accessible text) is a visual implementation detail within the frozen marker system, validated inside G6 captures.

## Must not introduce

- Giant grid or oversized thumbnails; captions or metadata in the layer; filters/sorting/alternate ordering; route/URL entry; dark cinematic lightbox; blur/glass; zoom-from-thumbnail motion; download/share tools; icon-only Close; outside-click-only close; making the layer title more prominent than the sequence header; any treatment suggesting Overview is the “real archive.”
