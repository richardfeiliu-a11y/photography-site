# Stage 3B — Mobile Navigation Design Spec

## Role

Mobile navigation is the frozen `Site name + Menu` pair plus one opaque menu layer. Its duty is calm wayfinding that never interrupts Gallery viewing. No bottom nav, no tab bar, no persistent chrome.

## Frozen product behavior

- Global destinations only: Archive, Places, About (Gallery is never a global destination; Back/Overview carry Gallery context).
- Menu opens an opaque neutral in-page layer; not glass, not blur, not a floating pill.
- Link order frozen: Archive → Places → About.
- Visible Close; Escape closes for keyboards; focus contained and restored; body scroll locked while open.
- Current destination visibly indicated inside the Menu.

## Visual objective

The lightest possible top bar over photography, and a menu layer that reads as a quiet page of its own — three text links, generous air, nothing else.

## Content order

```text
Top bar: site name (leading)        Menu (trailing)
Menu layer:
  Close (trailing)
  Archive
  Places
  About
```

## Desktop composition

Not applicable — desktop uses the static inline header defined in `PAGE_SYSTEM.md` (site name leading, Archive · Places · About trailing, static, never sticky). Mobile and desktop share labels, order, and current-state treatment.

## Mobile composition

- Header height (Recommended starting specification): 56 px content row plus safe-area top inset; compact enough that the hero/first card dominates, tall enough for comfortable targets. Visual implementation detail within 48–64 px.
- Site-name treatment (Recommended starting specification): display serif at 18–20 px, primary color, natural case; the site mark is text only (Frozen — no logo/symbol/monogram). Serif vs sans for the mark is a G1-adjacent comparison; serif keeps identity consistent with authored titles and is the starting state.
- Menu treatment: trailing text control `Menu`, navigation sans 16 px, hit area ≥ 44×44 via invisible extension.
- Menu layer: full-viewport opaque layer, raised neutral surface `#EFECE5`, side margins 20 px + safe areas. No translucency over content.
- Link layout: vertical list starting below the Close row with XL top spacing; each link 18 px sans weight 500 (top of mobile navigation role), line rows spaced XL (48 px) apart; natural case; no icons.
- Close: visible text control top-trailing, same row height as the top bar; safe-area padded.
- Current state: persistent underline and/or weight 600 on the current destination; never accent color alone.
- Focus: 2 px focus perimeter per link; focus trapped in the layer; focus returns to the `Menu` control on close.
- Background: raised neutral (above); body scroll locked — no visual bleed of the page beneath.
- Spacing: link list vertically biased toward the top third; the rest of the layer stays empty; nothing fills the void (no social links, no copyright, no promo).
- Body scroll lock visual consequence: the page beneath must not jump when lock engages — reserved scrollbar behavior and locked position restore on close (visual implementation detail with accessibility impact).
- Transition: optional 160–220 ms opacity + ≤ 8 px translation; reduced motion = instant (Frozen motion rules).

## Typography roles

- Site name: display serif (starting) or utility sans (alternative under G1 comparison).
- Menu/Close: navigation sans.
- Layer links: navigation sans, 18 px, weight 500; current adds underline/weight.

## Image rules

- None. The menu layer contains no imagery, no texture, no mark.

## Spacing/rhythm

- Top bar content height 56 px starting.
- Layer top: Close row, then XL to first link; link gaps XL; safe-area bottom padding.

## Metadata placement

- None.

## Interaction states

- Menu/Close: hover underline clarification (hover-capable), focus perimeter, active brief feedback.
- Links: default graphite; current = underline/weight; hover = underline; focus = perimeter.
- Tapped links navigate immediately; no stuck hover on touch.

## Accessibility constraints

- Targets ≥ 24×24 floor, aim 44 px; links spaced so targets never overlap.
- Long translated labels wrap; no fixed-height rows, no clipping (A10 stress).
- Focus trap + restore; Escape support; announced open/closed state.
- Reduced motion: layer remains instantly understandable.
- Safe-area padding for Close and list bottom.

## Edge cases

- Very long site name: wraps within the top bar or shortens via authored display name — decided by content authoring, not truncation logic.
- All three destinations fit; there is no “more” overflow by design.
- Menu opened on Gallery page: Back/Overview remain page-local; Menu layer still lists only global destinations.
- Device rotation while open: layer reflows; targets stay comfortable.

## Real-photo stress cases

- None for the layer itself; stress is contextual: open the menu over a bright and a dark Gallery page to verify opaque layer separation, and check scroll-lock with a long Gallery underneath.

## Recommended starting values

| Item | Starting value | Status |
|---|---|---|
| Top bar height | 56 px + safe area | Recommended (48–64 detail range) |
| Site name | serif 18–20 px | Recommended; G1-adjacent |
| Layer links | 18 px sans, 48 px gaps | Recommended |
| Layer surface | raised `#EFECE5` | Frozen family |
| Motion | ≤220 ms opacity + ≤8 px | Frozen |

## Prototype-gated values

- None of the seven gates targets the menu; only long-label density (A10) is a required accessibility capture, not an A/B.

## Must not introduce

- Bottom navigation or tab bar, sticky header, hamburger-to-icon animation as decoration, blur/glass layer, profile/avatar block, social icons in the menu, search entry, notification badges, multi-level submenus, language switcher chrome.
