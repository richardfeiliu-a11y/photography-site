# Stage 3A — Overview / Light Table Visual System

Status: **MVP visual specification**. Overview is frozen as secondary, explicitly invoked navigation within one Gallery.

## Hierarchy

Overview answers three questions only:

1. How long is this Gallery?
2. Where am I in the authored order?
3. Which Photo do I want to inspect in sequence?

It does not answer metadata, caption, filter, comparison, download, or collection-management questions.

## Overall layer

- Full-viewport in-page layer, not a separate route.
- Use the same neutral family as the site, preferably the raised/overlay surface rather than a dramatic black lightbox.
- Background is opaque enough that the sequence does not create visual noise beneath thumbnails.
- No glass blur, vignette, gradient, or cinematic darkness.
- The layer's scale is visibly subordinate to Gallery: thumbnails are inspection aids, never larger or more dramatic than sequence Photos.

## Header

- Leading side: Gallery title in a compact heading role plus exact count.
- Trailing side: visible `Close` text control.
- The header may remain available while the grid scrolls if Stage 3B can do so without reducing thumbnail space or creating heavy chrome.
- Close is not icon-only. `Escape` remains an additional desktop mechanism.
- No sorting, filters, view toggles, download, share, or slideshow controls.

## Thumbnail grid

### Desktop

- Target **5–6 columns** at the 1440 px reference viewport, chosen by the smallest thumbnail still useful across portraits and landscapes.
- Grid follows authored order in ordinary row-major reading order.
- Gaps are compact but visible, approximately S–M.
- Thumbnails use contain behavior inside consistent cells; empty neutral space is preferable to crop.
- Thumbnail cells have no default border or card background.

### Mobile

- Target **3 columns** at 390 px when real photographs remain recognizable; fall back to 2 if aspect-ratio or target-size testing shows 3 is too dense.
- No horizontal grid scroll.
- Safe-area-aware Close target remains reachable.
- Gaps remain large enough that touch targets do not overlap.

### Density rule

Overview should show enough thumbnails to establish extent immediately, but not so many that the current marker or individual frames become illegible. Column count is chosen from real-image recognition and touch testing, not from a desire to mimic a contact sheet.

## Current Photo marker

- Current thumbnail receives a restrained **2 px outline or inset marker** plus a non-color cue such as `Current` accessible text or a small corner index.
- Indicator must survive bright, dark, and black-and-white thumbnails.
- Do not reduce every non-current thumbnail to near-invisibility; the authored sequence still needs to be scannable.
- The marker uses the neutral/focus system but is not confused with keyboard focus. Focus and current may coexist and remain distinguishable.

## Thumbnail states

- **Default:** complete image, no border.
- **Hover:** subtle neutral outline or slight opacity shift; no crop, zoom, lift, or caption reveal.
- **Focus:** explicit 2 px focus perimeter with adequate contrast.
- **Active/pressed:** brief neutral feedback; no animated enlargement.
- **Current:** persistent outline/marker independent of hover/focus.
- Thumbnail has an accessible name/position; visual caption text does not appear in the grid.

## Spacing and scroll

- Overview header-to-grid: L–XL.
- Grid outer margin follows the standard desktop/mobile content margin.
- Grid continues in normal vertical scroll; no page-level horizontal scrolling.
- Current Photo should be brought into the visible region when Overview opens, but the visual system does not prescribe implementation mechanics.
- Background sequence scroll remains locked while Overview is open.

## Motion

- Open/close may use a short **160–220 ms** opacity transition with at most a small 4–8 px translation.
- No zoom-from-thumbnail, depth blur, long stagger, or spring/bounce.
- Thumbnail selection closes with the same restrained transition; the selected Photo itself does not animate across layouts.
- Reduced-motion mode removes translation and may use an instant state change or a very short opacity change.

## Subordinate-by-design constraints

- Overview has no captions, metadata, Place/date links, filters, alternate ordering, download tools, or share tools.
- It is accessible only through the Gallery context and closes back to the sequence.
- It never becomes the default Gallery entry.
- Thumbnail scale stays materially below sequence scale.
- The neutral surface and compact header avoid the feeling of a second, more visually exciting Gallery.

## Failure conditions

- Overview looks like a photo-management application or stock library.
- Cropped thumbnails change the photographer's framing.
- Current state is visible only through color or disappears on bright/dark images.
- Mobile columns are too dense for 44 px touch targets or image recognition.
- Close is hidden, icon-only, or dependent on clicking outside.
- The grid introduces sorting, filtering, captions, or new routes.
- Motion makes Overview feel more important than the sequence.

