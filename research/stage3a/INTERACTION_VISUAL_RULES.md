# Stage 3A — Interaction Visual Rules

Status: **visual and motion language for existing frozen interactions**. It does not add behavior or prescribe implementation code.

## Principle

The interface is quiet, not invisible. Every interactive element must be identifiable before activation, with stable keyboard and touch equivalents, while remaining visually subordinate to photography.

## Link language

- Inline text links use a visible underline with font-aware thickness/offset or an equally explicit non-color cue.
- Navigation links may omit the default underline because their fixed placement and current-state treatment establish affordance; hover/focus still introduces a clear line or perimeter.
- Gallery metadata links such as Place/date are visibly different from adjacent static metadata through underline, not accent color alone.
- Link labels remain concrete: `Archive`, `Places`, `About`, `Overview`, `Back to Paris`, `Next Gallery — {title}`. Avoid vague “View,” “Explore,” or icon-only affordances.
- Links keep expected browser navigation behavior; a large clickable card does not remove the explicit title link.

## Interaction state hierarchy

| State | Visual treatment |
|---|---|
| Default | Stable graphite/secondary text; clear placement and label |
| Hover | Underline/edge clarification and restrained neutral change; never required to reveal meaning |
| Focus-visible | 2 px minimum high-contrast focus perimeter, optionally separated by a neutral gap |
| Active/pressed | Small opacity or 1 px positional response; no large scale effect |
| Current navigation | Persistent underline and/or moderate weight; not accent color alone |
| Current thumbnail | Persistent marker plus non-color cue; distinct from keyboard focus |
| Disabled/unavailable | Prefer omission when action cannot exist; if shown, preserve legibility and explain state |

Hover styling is applied only on devices that genuinely support hover. Tapped controls must not remain visually stuck in hover state.

## Clickable Gallery representations

- Cover, title, and text block form one perceivable interactive region.
- The title remains the semantic link and receives an ordinary link state.
- Focus can outline the entire representation or connect cover and text with a clear shared perimeter.
- Hover may add a subtle image-edge outline or lower-level text change. **No image zoom, crop, lift, shadow, or animated pan.**
- Metadata remains visible without hover.
- Hit area extension may make the block easy to activate, but overlapping cards must never share hit space.

## Desktop navigation

- Header is compact and **static**, not sticky.
- Site name aligns leading; `Archive`, `Places`, `About` align trailing in that order.
- Height and whitespace are sufficient for calm separation without creating a branded masthead.
- Current destination uses a quiet underline/weight change.
- Gallery is not added to global navigation; Gallery-local Back/Overview provide context.
- The header never overlays a Gallery image.

## Mobile navigation

- Top row: text site name leading, `Menu` trailing.
- Menu opens an opaque, full-viewport or full-width in-page layer using the neutral surface—not glass, blur, or a floating pill.
- Links appear in the frozen order `Archive`, `Places`, `About`, with generous touch spacing and restrained typography.
- Visible `Close` control; Escape closes for keyboard users; focus is contained and restored.
- Transition is optional and short. No staggered link choreography.
- Current destination remains visibly indicated inside the Menu.

## Site mark decision

Choose **A — pure text site name** for MVP.

- It may use the display serif or the utility sans after Stage 3B comparison, but it remains readable text rather than a custom wordmark asset.
- No symbol, monogram, camera mark, signature, or logo animation.
- This minimizes long-term brand maintenance and keeps the photographer's name/site identity legible in every script and accessibility mode.

## Overview controls

- `Overview` and `Close` use visible text labels.
- A supporting icon is optional but never substitutes for the label.
- Thumbnails show default, hover, focus, active, and current states as specified in `OVERVIEW_VISUAL_SYSTEM.md`.
- No outside-click-only close, hidden hot corner, or swipe-only behavior.

## Current position

- `n / total` is non-interactive orientation text.
- It uses tabular numerals and a stable location.
- It must not look like a scrubber, pagination control, or slideshow toolbar.
- It yields visually at Gallery header/continuation and never becomes a floating CTA.

## Continuation affordance

- `Next Gallery — {title}` is the largest interactive text in the end state but remains unboxed.
- `Back to {origin}` is a standard secondary text link.
- The authored end label separates the sequence from actions.
- No hover image, animated preview, recommendation carousel, or four-action cluster.

## Motion philosophy

Motion is functional and infrequent.

| Motion | Decision |
|---|---|
| Card hover image zoom | **No** |
| Global fade-in on scroll | **No** |
| Page transitions | **No** in MVP |
| Parallax / scroll-jacking | **No** |
| Menu open/close | Optional short opacity + small translation |
| Overview open/close | 160–220 ms opacity + at most 4–8 px translation |
| Hover/focus color/underline | 100–150 ms or instant |
| Image loading shimmer | **No** |
| Theme transition | Not applicable; no dark mode |

Rules:

- Animate only opacity and small transforms when an animation clarifies a state change.
- No blur, bounce, spring overshoot, long stagger, or cinematic easing.
- High-frequency interactions respond in 150 ms or less.
- Motion is never the only state cue.
- Reduced-motion mode removes translation and non-essential transitions; state changes remain immediately understandable.

## About page visual role

- About remains low-weight and text-led.
- Reading width: about 60–70 Latin characters or 28–36 CJK characters.
- Use utility sans body copy, restrained serif H1, and ordinary underlined links.
- **No biography portrait is required in MVP.** A portrait should appear only if it belongs to the authored project, not as a commercial headshot convention.
- Contact is clearer than Social; selected Social links remain a short text list.
- No CV, client logo strip, press badges, services CTA, newsletter block, or large Home promotion.

## Interaction failure conditions

- A user must hover to discover that an element is clickable.
- Focus is removed, color-only, or indistinguishable over a Photo.
- Menu/Overview uses attention-seeking motion or translucent photographic backdrops.
- Card zoom changes framing or makes the grid move.
- A text control is visually quiet because it is unreadably small or low contrast.
- Site navigation becomes sticky chrome over a long Gallery.
- Mobile and desktop use different labels or destination order.

