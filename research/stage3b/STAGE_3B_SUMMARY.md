# Stage 3B — Summary

Status: **Complete.** Stage 3B applied the frozen Stage 3A visual system (Quiet Editorial Archive) page by page without reinterpretation. This is the only file the next stage needs to locate everything; details live in the sibling files of this directory.

## How each page is composed

- **PAGE_SYSTEM.md** — shared contract: canvas `#F6F4EF`, role palette, content frame ≤1400 px with 48 px gutters, media frame `min(90vw, 1440px)`, reading column ≈680 px, mobile 20 px margins, spacing scale 4/8/16/24/48/96, shared page header, shared card, link/focus rules, motion limits.
- **HOME_DESIGN_SPEC.md** — latest-first: hero cover (content-frame width, ≈72–78svh desktop ceiling) → title/metadata below → finite recent set of up to 6 cards; Featured/Recently-added cue as plain metadata text above the photographed date (G3).
- **ARCHIVE_DESIGN_SPEC.md** — year-headed latest-first grid, 3 columns at 1440, 32 px column gap, 48–64 px row gap, 96 px year-to-year; shared card unchanged.
- **PLACES_INDEX_DESIGN_SPEC.md** — name-led text list (serif Place link + region only when disambiguating), ≈800 px measure, no covers, no travel cues. Gallery count / year span / representative cover remain optional presentation candidates, not admitted (Frozen Stage 2B baseline; red-team correction).
- **PLACE_PAGE_DESIGN_SPEC.md** — shared page header + Place metadata, then that Place's Galleries as a card list/grid reusing the shared card; no map, no region decoration.
- **GALLERY_DESIGN_SPEC.md** — the heart of the site (see below).
- **OVERVIEW_DESIGN_SPEC.md** — opaque neutral full-viewport light table layer, not a route (see below).
- **ABOUT_DESIGN_SPEC.md** — reading column text page; portrait optional, complete frame, caption role; contact as plain text links.
- **MOBILE_NAV_DESIGN_SPEC.md** — 56 px top bar + safe area, text mark + Menu control; Menu = opaque raised-neutral full layer, link order Archive → Places → About, 44 px targets.

## Shared components

`SHARED_COMPONENT_RULES.md` unifies: page header (title + metadata, never sticky), card (image + text block; Cover/Title/Date/Place/Count order frozen; no border/shadow/overlay/hover zoom), discovery states (same card, no restyling), Gallery states (header, Photo block, caption, `n / total`, end/continuation), footer (minimal text, hairline optional), focus and reduced-motion rules.

## Key desktop / mobile rules

Desktop ≈1440 reference: framed content, generous outer margin carrying quiet annotations; portrait images height-led (78–84svh), landscape width-led. Mobile ≈390 reference: single column, native vertical progression, media-only edge-to-edge exception for landscape viewing with all text inset 20 px, portrait ≤82svh. No full-bleed desktop anywhere; no dark mode; no decorative accent.

## Gallery exact visual model

Reading column ≈680 px for header/caption/continuation, leading-edge aligned; images center in the wider media frame. Header: Back link → serif title 42–52 px → metadata → optional ≤3-line description → `Overview {count}`; 72 px (desktop) / 48 px (mobile) to first Photo. Three rhythms — Compact 64–72/40–48, Base 96/64 (default), Breathing 144/96; orientation never selects rhythm. Photo → caption 16 px; captions ≤3 lines. Current position `n / total`, tabular numerals, non-interactive: desktop margin annotation; mobile persistent-first with inline fallback (G5). End: pause 168 px desktop / 112 px mobile, `End of {Gallery title}`, text-led continuation — Next title serif 26–30 / 20–24 px, Back below, no cover, no metadata (G7).

## Overview model

Opaque neutral layer over the Gallery; contained uncropped thumbnails in authored order; desktop 6 columns (5 as stress option) 12 px gaps, mobile 3 columns (2 fallback, G6) 8 px gaps; current Photo marked by 2 px outline + non-color cue; opens at current position; Close text control; no captions, filters, or drag-reorder; secondary to the sequence.

## Real-photo test requirement

`REAL_PHOTO_TEST_MATRIX.md` defines the minimum fixture set F01–F10 (bright/dark/low-contrast/saturated/landscape/portrait/dense/minimal/B&W/color) plus content-stress fixtures (short and 72-Photo Galleries; long/Chinese/mixed titles; caption variants) and the full capture matrix (H/A/P/G/O/B/X series) at 1440 and 390, plus 320 px reflow and 200% zoom. No gate or pass/fail verdict may rely on placeholders.

## The seven Stage 3C gates

`STAGE_3C_VISUAL_GATES.md`: G1 font pairing + CJK · G2 canvas warmth + focus · G3 Home hero scale + cue · G4 long-Gallery Base spacing (mobile 56–64 bound) · G5 mobile current position · G6 Overview mobile 3 vs 2 columns · G7 continuation pause + Next-title weight. Each has starting state, frozen variables, fixtures, captures, pass/fail criteria, decision rule.

## Red-team consistency review (2026-08-27)

An independent Stage 3B consistency review (`STAGE_3B_RED_TEAM_REVIEW.md`) audited all specs against the frozen Stage 2B/3A boundaries. Three corrections were applied in place:

1. **CRITICAL — canonical URL restored.** `IMPLEMENTATION_HANDOFF.md` drifted to `/gallery/{gallery}`; the frozen Stage 2B canonical route `/galleries/{gallery-slug}` is restored.
2. **IMPORTANT — Places Index baseline restored.** Gallery count and year span had been promoted into the MVP baseline; they are returned to optional presentation candidates (not rendered, evidence-first admission only), per Stage 2B `INFORMATION_ARCHITECTURE.md` and Stage 3A `DISCOVERY_UI_SYSTEM.md`. Affected: `PLACES_INDEX_DESIGN_SPEC.md`, decision B10.
3. **MINOR — spacing composite wording aligned.** `PAGE_SYSTEM.md` now states compositions of existing steps are allowed beyond XXL (per Stage 3A), covering the Gallery end pauses 168/112 already used by `GALLERY_DESIGN_SPEC.md` and Gate G7.

All other audited dimensions (IA, typography roles, card anatomy, palette, spacing, Gallery/Overview/mobile behavior, gate labeling, candidate-vs-baseline boundaries) were found consistent with the frozen system.

## Frozen vs still-open

Frozen: all Stage 2B behavior; the entire Stage 3A system (direction, attention order, palette roles, two-family typography, spacing scale, image rules, card, `n / total`, Overview structure, continuation model, no-full-bleed, no dark mode, accessibility baseline). Open only to the seven gates above; nothing else may be reopened.

**Final status: Minor corrections applied by red-team review — Ready for Stage 3C visual prototype implementation.**
