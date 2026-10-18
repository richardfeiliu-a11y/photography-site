# Responsive Prototype Specification

This specification defines behavior at the required prototype viewports. It is not a production breakpoint system or final visual design.

## Required viewports

| Context | Size | Required |
|---|---:|:---:|
| Desktop | `1440 × 1000` | Yes |
| Mobile | `390 × 844` | Yes |
| Auxiliary narrow desktop/tablet | `1024 × 768` | Sanity only |

All deterministic screenshots use exact pixel dimensions and 100% browser zoom.

## Global navigation

| Behavior | Desktop | Mobile |
|---|---|---|
| Header | Site name left; Archive/Places/About right | Site name left; Menu control right |
| Menu state | Inline links | Full-height or full-width in-page layer |
| Current state | Quiet visible indicator | Same indicator inside Menu |
| Overflow | Never horizontally scrolls | Never horizontally scrolls |

Navigation content and order never change by Test or Variant.

## Home

- Desktop latest-first hero media may use a wide two-part composition but must keep title/context/action clear at `1440 × 1000`.
- Mobile hero cover is at most `58svh`; full first action remains reachable without an oversized decorative region.
- Recent Gallery cards: consistent grid on desktop, one column on mobile.
- Archive-first Variant changes hierarchy only; it reuses the exact card layout and responsive rules.
- Archive/Places actions must remain discoverable through ordinary scroll on mobile.

## Discovery cards

- Card content order is fixed: cover, title, photographed date/range, Place when known, photo count.
- Desktop grid/density is identical within a Test.
- Mobile uses one column; metadata wraps without truncating date range or Place identity.
- Covers keep their fixture aspect ratio; no center-crop differences between variants.

## Place page grouping

- Flat and grouped Variants use identical card widths and gaps.
- Year headings span the card grid and scroll normally; no sticky behavior.
- Mobile headings remain visually subordinate to Place title and cannot be mistaken for interactive Visit cards.
- Volume 20 must remain usable without horizontal layout, filters, or map.

## Gallery images

### Desktop

- Landscape: may use up to the main content width while preserving full image.
- Portrait: constrained so the full Photo and access to caption/navigation remain visible through normal scroll; do not crop to force equal heights.
- Sequence spacing is constant between variants.

### Mobile

- Both orientations use available width with `contain` semantics.
- Portrait may approach but not exceed approximately `82svh` for image area, leaving a path to caption/progression controls.
- Landscape must not be artificially enlarged/cropped or reduced by unnecessary side UI.
- Consecutive orientations must not trigger horizontal page overflow or abrupt layout-mode changes.

These dimensions are prototype controls, not final production values.

## Vertical Gallery progression

- One-column sequence at every viewport.
- Native vertical scroll and stable content height.
- Current-position state follows the central Photo.
- Browser Back restoration is tested after long scroll on mobile.

## Swipe-first Gallery progression

- One Photo stage per viewport region.
- Both orientations use the same contain area; letterboxing/empty space is acceptable and preferable to crop.
- Caption and `n / total` remain in a consistent control region.
- Visible Previous/Next controls remain operable without swipe.
- End continuation appears after the final Photo, not as an overlay competing with it.

## Overview

- Desktop: full-viewport layer with a stable multi-column thumbnail grid.
- Mobile: full-screen layer with fewer columns and persistent Close target.
- No horizontal grid scrolling.
- Current indicator, count, thumbnail order, open/close, and selected target remain consistent.
- If Test 3 rejects Overview, remove it from MVP and both T4 variants; responsive requirements then no longer apply.

## Captions

- Same caption content, placement, and typography in compared variants.
- Caption follows its Photo; no detached global caption panel.
- Uncaptioned Photos create no blank vertical reserve.
- Long text wraps; it never overlays the photograph.

## Continuation

- Desktop and mobile use the same hierarchy: Next Gallery primary, Back to origin secondary.
- Mobile actions stack vertically; desktop may place them side-by-side but cannot reverse priority.
- End state is clearly separated from the final caption/image and visible through normal progression.
- No four-CTA cluster, Previous Gallery end action, map, Search, or social recommendation.

## Responsive failure conditions

- Any page-level horizontal scrollbar at required viewports.
- Destructive image crop or orientation-specific missing controls.
- Menu/Overview content unreachable by touch or keyboard.
- Card metadata loss that changes task difficulty between viewports.
- Variant-specific responsive differences unrelated to the tested variable.
- Screenshot output that depends on manual window resizing or non-deterministic loading.

