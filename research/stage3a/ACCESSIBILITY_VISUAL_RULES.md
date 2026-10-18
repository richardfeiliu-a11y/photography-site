# Stage 3A — Accessibility Visual Rules

Status: **visual and interaction constraints for Stage 3B/3C**. This is not a general WCAG tutorial.

## Baseline

Target WCAG 2.2 AA for the visual system. Where the photography context creates an unavoidable ambiguity, protect navigation, captions, focus, and alternative access rather than lowering the standard.

## Contrast

- Normal text and captions: minimum 4.5:1 against the actual rendered surface.
- Large text: minimum 3:1; prefer stronger contrast when it does not overpower images.
- Focus indicators, current markers, and meaningful non-text boundaries: minimum 3:1 against adjacent colors.
- Metadata is quieter through hierarchy and spacing, not by failing contrast.
- Do not place essential text directly on a photograph.
- Test bright, dark, low-contrast, black-and-white, and color-heavy images; a neutral palette that works beside placeholders is not sufficient.

## Focus visibility

- Every link, button, card, thumbnail, Menu item, Close control, Overview entry, and continuation action has a visible `focus-visible` treatment.
- Custom focus perimeter is at least 2 px or an equivalent visible area.
- When focus crosses image and canvas, use a two-color ring or neutral separation gap so it remains visible on both.
- Keyboard focus and “current Photo” are visually distinct and may coexist.
- Forced-colors/high-contrast modes retain system focus styling.

## Target size and spacing

- Absolute Level AA baseline: 24 × 24 CSS px or an allowed spacing exception.
- Aim for 44 × 44 px on touch and approximately 40 × 40 px on desktop where density permits.
- Small text labels may keep their visual size while a non-overlapping pseudo-area extends the hit target.
- Adjacent thumbnail/card/control targets may not overlap.
- Mobile Menu and Overview Close receive safe-area padding.

## No hover-only meaning

- Titles, metadata, control labels, current state, and thumbnail order are visible without hover.
- Hover only reinforces an existing affordance.
- Touch users receive equivalent information and state.
- Hover treatment is gated to hover-capable devices so it does not remain stuck after tap.

## Caption readability

- 14–16 px minimum design range, normal weight, 1.5–1.6 line-height; CJK may require 1.65–1.8.
- Caption sits on the stable neutral canvas, never over the Photo.
- Caption may wrap to multiple lines and is never truncated by default.
- Maximum measure prevents long captions from becoming hard to track.
- Text scaling may increase caption height without covering the next Photo or breaking sequence order.

## Text scaling and reflow

- Support 200% text zoom and reflow at 320 CSS px width without page-level horizontal scrolling.
- No fixed-height text containers for titles, metadata, captions, Menu, or continuation.
- Long bilingual titles and Place names wrap naturally.
- Current-position and Close controls remain reachable after scaling.
- Display type may reduce responsively, but content is never clipped or replaced by ellipsis in Gallery context.

## Reduced motion

- No parallax, scroll-jacking, autoplay, or scroll-triggered image entrances exist in the baseline.
- Under reduced motion, remove Menu/Overview translation and use an instant change or very short opacity transition.
- Focus, active, current, and open/closed states retain static cues when motion is absent.

## Alternative text and editorial description policy

Photography is meaningful content, so accessibility is part of publishing:

- Each canonical Gallery Photo requires a concise editorial alternative description or an explicitly reviewed decision that the image is decorative—which should be rare inside a Gallery.
- Alternative text describes meaningful visible content and composition; it does not repeat the filename, camera metadata, or caption word-for-word.
- A longer description may be linked or associated when the work's meaning cannot be represented concisely.
- Discovery cover images may use empty alt text when the adjacent linked Gallery title already names the destination and the image adds no necessary navigation information. Avoid announcing the same link twice.
- Functional images/icons describe the action; decorative icons are hidden from assistive technology.
- Captions and alt descriptions have different jobs: captions may be interpretive/contextual; alt descriptions provide non-visual access to the Photo.

## Structural visual constraints

- One visible page H1; heading levels descend coherently.
- A skip-to-content link is the first focusable item before repeated global navigation.
- `Back`, `Overview`, Menu, Close, thumbnails, and continuation follow logical visual and keyboard order.
- Overview is a modal/layer visually: background is inert, focus stays inside, Close remains visible, and focus returns on exit.
- Browser Back/origin restoration must not be obscured by animation or visual state.

## Image and current-state access

- Current marker is not color-only and does not cover important image content.
- `n / total` is selectable/announced orientation text but not a fake control.
- Loading placeholders reserve intrinsic dimensions to prevent focus and reading-position jumps.
- Failed images present an accessible textual failure state inside the reserved frame.
- No destructive crop removes meaningful visual information.

## Stage 3B/3C accessibility checks

- Keyboard-only walk through global navigation, Gallery, Overview, all thumbnails, Close, and continuation.
- Screen-reader check of names, roles, current state, count, and focus restoration.
- Measured contrast for every declared text/surface and state pair.
- 200% text zoom and 320 px reflow.
- Touch target inspection at 390 × 844, including safe areas.
- Reduced-motion inspection.
- Forced-colors/high-contrast inspection.
- Real-photo audit for focus/current marker visibility on bright and dark frames.
- Editorial review of alternative descriptions for at least one full representative Gallery.

## Blocking failures

- Essential interaction or metadata is hover-only.
- Focus is missing or disappears on images/surfaces.
- Caption/metadata falls below contrast or readable size requirements.
- Current marker uses color alone.
- Text scaling clips titles, controls, or continuation.
- Overview cannot be closed or navigated by keyboard.
- Gallery Photos are published with filenames/generic placeholders as alt text.
- Motion remains mandatory under reduced-motion preference.

