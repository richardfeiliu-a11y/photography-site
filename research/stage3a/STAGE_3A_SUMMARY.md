# Stage 3A Summary

Status: **Stage 3A visual direction and design system complete.** This summary is the minimum Stage 3B entry document; the linked system files remain authoritative for details.

## Chosen direction

**Quiet Editorial Archive**.

```text
Primary character: Quiet editorial archive
Secondary qualities: Gallery-like, contemporary, tactile through rhythm
Avoid: Institutional cataloguing, magazine theatrics, commercial branding, cinematic chrome
```

Product choice: discovery surfaces may have modest typographic personality; Gallery and Overview remain extremely restrained. Photography keeps the attention order:

```text
Photo > Whitespace > Typography > Metadata > Controls
```

## Typography philosophy

- Restrained **display serif** for Gallery titles, page/Place titles, and card titles.
- Neutral **utility sans** for navigation, metadata, captions, body/About, controls, dates, and `n / total`.
- No font brand is frozen. Test Source/Noto/editorial open-source category pairs before choosing.
- Latin primary with deliberate CJK serif/sans fallbacks; mixed-script baseline, stroke density, title wrapping, and larger CJK line-height are launch constraints.
- Compact seven-level role scale; metadata is never made quiet by illegible size/contrast.

## Color philosophy

- Subtly warm low-chroma canvas with near-black graphite text and readable secondary gray.
- No decorative/brand accent. A restrained focus color exists only for accessibility states.
- Borders are rare; whitespace groups content first.
- No dark mode in MVP because theme changes alter photo perception and double the visual QA surface.
- Prototype target palette is defined in `COLOR_SYSTEM.md`; final values require measured contrast and real-photo validation.

## Image philosophy

- No destructive crop in Gallery, cards, or Overview.
- Covers retain authored frame and dominate an image-plus-text block—no border shell, overlay metadata, shadow, or hover zoom.
- Desktop landscape is width-led; portrait is height-led around 78–84svh.
- Mobile remains native vertical; portrait usually stays at or below about 82svh.
- No Home or desktop Gallery viewport full-bleed. Mobile may use controlled edge-to-edge media only, with complete image and inset text/controls.
- Real dark, bright, low-contrast, portrait, landscape, dense, minimal, B&W, and color-heavy Photos are mandatory for validation.

## Gallery visual rules

- Header in normal flow: Back, title, photographed date/range + Place(s), quiet Overview entry.
- Sequence remains primary; no sticky toolbar or slideshow chrome.
- Three rhythm states:
  - Compact: 64–72 px desktop / 40–48 px mobile.
  - Base: 96 px / 64 px (default).
  - Breathing: 144 px / 96 px.
- Captions attach below Photos, never overlay, and reserve no blank space when absent.
- Current position remains `n / total`, visually persistent as a quiet non-interactive margin annotation. Mobile inline fallback is allowed if real-photo testing shows overlay conflict.
- End uses a clear authored-end label, then text-led `Next Gallery — {title}` and `Back to {origin}`. No continuation cover in MVP.

## Overview visual rules

- Opaque neutral full-viewport light table, not a dark cinematic lightbox.
- Contained, uncropped thumbnails in authored order.
- 5–6 desktop columns; target 3 mobile columns with 2-column fallback if recognition/target tests fail.
- Current marker uses outline plus a non-color cue and stays distinct from keyboard focus.
- No captions, metadata, filters, sorting, route, or visually dramatic motion.

## Discovery visual rules

- Shared Gallery representation across Home, Archive, and Place.
- Home latest/featured Gallery gets emphasis through cover scale, not marketing-hero copy.
- Archive default reference density: 3 desktop columns, 1 mobile; year headings are quiet scan landmarks.
- Place index is name-led; Place pages use shared cards and progressive year headings only when earned.
- No travel UI: maps, pins, flags, itinerary styling, badges, or country chips.

## Navigation, motion, and About

- Text site name; no logo/symbol project in MVP.
- Static compact desktop header. Mobile uses site name + Menu and an opaque neutral layer.
- No card zoom, page transitions, scroll reveals, parallax, scroll-jacking, blur, bounce, or shimmer.
- Only short functional Menu/Overview and state transitions; reduced motion removes translation.
- About is narrow, text-led, and low-weight; no biography portrait is required. Contact precedes selected Social links.

## Accessibility constraints

- WCAG 2.2 AA visual baseline; measured 4.5:1 normal text and 3:1 meaningful non-text/focus targets.
- Visible 2 px minimum focus indicator, 44 px touch aim, no hover-only meaning.
- 200% text zoom, 320 px reflow, CJK wrapping, reduced motion, forced colors, and safe areas are required checks.
- Every Gallery Photo requires an editorial alt/description decision; captions and alt descriptions are separate.

## Remaining visual prototype questions

These do not reopen Stage 2B:

1. Exact serif/sans candidate pair and CJK metric match.
2. Final canvas warmth and focus color after measured real-photo testing.
3. Exact Home hero scale and plain-text `Featured`/`Recently added` cue.
4. 72-Photo Gallery Base spacing and mobile fatigue.
5. Persistent mobile `n / total` versus inline fallback on edge-to-edge images.
6. Overview 3 versus 2 mobile columns and current/focus marker treatment.
7. Exact continuation pause and title weight.

## Stage 3B starting set

- `VISUAL_DIRECTION.md`
- `TYPOGRAPHY_SYSTEM.md`
- `COLOR_SYSTEM.md`
- `SPACING_AND_GRID.md`
- `IMAGE_PRESENTATION.md`
- `DISCOVERY_UI_SYSTEM.md`
- `GALLERY_VISUAL_SYSTEM.md`
- `OVERVIEW_VISUAL_SYSTEM.md`
- `INTERACTION_VISUAL_RULES.md`
- `ACCESSIBILITY_VISUAL_RULES.md`
- `VISUAL_STRESS_TESTS.md`
- `STAGE_3A_DECISION_LOG.md`

## Final gate

No product function, route, entity, navigation item, search/map/tag system, or implementation technology was added. T1–T4 and Stage 2B IA remain frozen.

**Ready for Stage 3B page-by-page design specification.**

