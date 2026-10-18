# Stage 3B — Implementation Handoff (Stage 3C Execution Contract)

> **DO NOT REDESIGN. Implement Stage 3B faithfully.**

This document is the execution contract for the Stage 3C visual prototype implementation agent. Stage 3B is the design system applied page by page; Stage 3C builds a prototype that proves it with real photography and decides only the seven bounded gates. If a spec seems wrong, record a conflict and stop — do not improvise design.

## Must implement

- All pages in this directory's page specs: Home, Archive, Places Index, Place Page, Gallery, Overview layer, About, Mobile Navigation, shared card/header/footer.
- Shared canvas, content frames, spacing scale, typography roles, link/focus rules exactly as in `PAGE_SYSTEM.md`.
- Gallery exactly per `GALLERY_DESIGN_SPEC.md`: header order, reading column vs media frame, landscape/portrait sizing, three-rhythm system with Base default, captions, `n / total`, Overview entry, end pause, text-led continuation.
- Overview layer per `OVERVIEW_DESIGN_SPEC.md` including current marker and modal behavior.
- All recommended starting values as the deterministic starting point of the prototype.
- Real-photography fixture assembly per `REAL_PHOTO_TEST_MATRIX.md`.

## Must not implement

- Anything in any page spec's “Must not introduce” list.
- No new product features, routes, entities, navigation destinations, or metadata fields.
- No technology-stack opinions leaking into design (stack choice is Stage 3C's execution freedom, but it may never change the design).
- No dark mode, no second theme, no decorative accent, no logo/mark asset.
- No placeholder-only validation; no gate decided without its real-photo captures.

## Frozen rules

From Stage 2B/3A, enforced in Stage 3C without exception:

- Attention order Photo > Whitespace > Typography > Metadata > Controls.
- Native vertical Gallery sequence; no swipe-first/slideshow/fullscreen model.
- No destructive crop anywhere; covers and thumbnails keep authored frames.
- No Home/desktop full-bleed; mobile media-only edge-to-edge exception with inset text.
- Card = image + text block; no border/shadow/overlay/hover zoom.
- `n / total` format; Overview secondary in-page layer; continuation only after true end, text-led, no cover.
- Static header; text site mark; mobile Menu opaque neutral layer; link order Archive → Places → About.
- Motion limits; WCAG 2.2 AA visual baseline; tabular numerals for years and position.

## Prototype-gated rules

Exactly seven gates may be decided, per `STAGE_3C_VISUAL_GATES.md`:

1. G1 font pairing + CJK metrics (brands unfrozen until a candidate passes all cases).
2. G2 canvas warmth + focus color (lightness adjustments only).
3. G3 Home hero scale + Featured/Recently added cue.
4. G4 long Gallery Base spacing (mobile 56–64 bound).
5. G5 mobile current position (persistent vs inline; one ships).
6. G6 Overview mobile 3 vs 2 columns (one ships).
7. G7 continuation pause + Next-title weight (within frozen ranges).

Everything else is specified; deviations require a recorded conflict, never taste.

## Real-photo fixture requirements

- Minimum set F01–F10 per `REAL_PHOTO_TEST_MATRIX.md`; closest real substitutes allowed and recorded when an exact category is unavailable.
- Content stress fixtures: short and ~72-Photo Galleries; short/long/Chinese/mixed titles; single/multi Place; single-year and multi-year ranges; none/short/long/Chinese captions.
- Neutral placeholders are permitted only for layout scaffolding before fixtures exist; no gate or pass/fail verdict may rely on them.

## Required routes/pages

```text
/                      Home
/archive               Archive
/places                Places Index
/places/{place}        Place Page
/galleries/{gallery-slug}     Gallery (canonical Gallery URL, frozen by Stage 2B)
/about                 About
```

Overview and Menu are in-page layers, not routes. No other destinations may be created.

## Required desktop/mobile screenshots

The full matrix in `REAL_PHOTO_TEST_MATRIX.md` (Home H01–H06, Archive A01–A04, Place P01–P04, Gallery G01–G11, Overview O01–O06, About B01–B03, cross-page accessibility X01–X05), each at ≈1440 desktop and ≈390 mobile references where marked, plus 320 px reflow and 200% zoom captures. Evidence must be stored and referenced in the Stage 3C report.

## Required stress states

- 72-Photo Gallery traversal (G4) including mid-position Overview open (L47).
- End/continuation for: next exists, no-next, origins Home/Archive/Place, direct entry.
- Mixed-orientation sequences including portrait→landscape and captioned→uncaptioned.
- Bright/dark/B&W/saturated image classes across Home hero, cards, Gallery, Overview.
- Long/Chinese/mixed titles everywhere titles occur.
- Accessibility states: keyboard-only flow, focus-visible over images/layers, reduced motion, forced colors, 200% zoom, 320 px reflow, touch targets at 390×844 with safe areas.

## Stop conditions

Stage 3C must stop and report a conflict instead of continuing when:

1. A spec item is internally contradictory or unimplementable as written.
2. A real-photo capture reveals a failure the gate rules do not cover.
3. Completing a requirement would require adding a feature, route, or control not in this contract.
4. A frozen rule appears to block a required behavior (it never silently yields — report).

Completion condition: all pages implemented at starting values, full screenshot matrix captured with real photos, all seven gates decided per their decision rules and recorded, accessibility captures pass or are logged as conflicts. Then Stage 3C hands back a frozen visual specification for Stage 4.
