# Runtime & Progressive Enhancement — Quiet Editorial Archive

**Status:** CANONICAL — engineering authority
**Companion to:** FINAL_DESIGN_SPECIFICATION.md, PERFORMANCE_BUDGET.md, IMAGE_PIPELINE.md, BUILD_AND_ROUTING.md
**Rule:** This document governs client-side runtime behavior. Where it and any other architecture document appear to disagree on a frozen design value (color, spacing, typography, interaction), FINAL_DESIGN_SPECIFICATION.md wins.

---

## 1. Progressive enhancement principle

The site is a native HTML document first. JavaScript enhances interaction states but is never required for core content access or navigation.

### 1.1 Core-without-JS guarantee

Every page must be fully readable and navigable with JavaScript disabled or failing. Specifically:

- Gallery Photo sequence scrolls natively via browser document flow.
- All authored captions render inline beneath their Photos.
- Continuation links are native anchors in the document flow.
- Site-wide navigation (Home, Archive, Places, About) uses standard anchor elements.
- Skip link functions as a native HTML feature.
- Semantic heading hierarchy remains intact.

### 1.2 JS-enhanced features

Features that require JavaScript and may disappear without it:

| Feature | JS role | Without-JS fallback |
|---|---|---|
| Overview modal | Opens/closes overlay, focus trap, jump-to-position | Not available; user scrolls sequentially |
| Position annotation (`n / total`) | IntersectionObserver updates current index | Not displayed |
| Mobile menu enhancement | Toggle visibility of nav list | See section 7 (mobile navigation no-JS contract) |
| Focus trap (Overview, Menu) | Constrains Tab cycle within dialog | Native browser tab order applies |
| Reduced motion enforcement | Synchronous close path under `prefers-reduced-motion` | CSS-only transition suppression still applies |

Overview and position annotation are acceptable enhancements. Their absence without JS does not violate the frozen product contract.

---

## 2. JavaScript inventory by page feature

### 2.1 Classification

| Page / feature | No-JS core status | JS enhancement | Verdict |
|---|---|---|---|
| Home hero / recent links | Static HTML with native links | None required | CORE |
| Archive index | Static links and cards | None required | CORE |
| Places index / detail | Static links and cards | None required | CORE |
| Gallery Photo sequence / captions | Native vertical scroll, inline figcaption | None required | CORE |
| Gallery continuation | Native anchor elements | None required | CORE |
| About | Static text | None required | CORE |
| Overview modal | May disappear | Full-viewport overlay, focus trap, jump | ENHANCEMENT |
| Position annotation | May disappear | Persistent overlay updated by observer | ENHANCEMENT |
| Mobile menu toggle | Must remain accessible (see section 7) | Enhanced open/close animation | ENHANCEMENT WITH ACCESSIBLE FALLBACK |
| Focus trap | Native tab order degrades gracefully | Modal/dialog constraint | ENHANCEMENT |
| Scroll restoration | Browser history defaults | Custom only if measured defect | DEFERRED (section 9) |

### 2.2 JS strategy

- Minimal JS; progressive enhancement throughout.
- Native Gallery document flow is the baseline. No virtualization at baseline.
- Default bundling (Astro/Vite defaults) is the acceptable baseline. Manual Vite chunk splitting is not required unless implementation measurement demonstrates a concrete benefit.
- The total client JS target of <=20KB gzipped is an aspirational engineering budget, not an immutable design contract. See PERFORMANCE_BUDGET.md for classification.

---

## 3. Captions contract

Frozen reference: FINAL_DESIGN_SPECIFICATION.md section 3.1.

### 3.1 Authored caption present

When a Photo item contains a non-null `caption`, the caption renders visibly beneath the Photo in the document flow.

- Element: `<figcaption>` inside a `<figure>` wrapping the Photo `<img>`.
- Typography: sans-serif, 14-16px desktop and mobile, weight 400, line-height 1.5-1.6 (Latin) / 1.75 (CJK).
- Color: secondary text `#5F5E59`.
- Width: reading column (~680px max), leading-edge aligned with header.
- Gap: 16px between Photo bottom edge and caption top.
- No line clamp. No truncation. Caption wraps naturally at its full authored length.
- No hover reveal. Captions are always visible when authored, regardless of pointer device, viewport, or interaction state.

### 3.2 Caption absent

When a Photo item has `caption: null` or omits the field:

- No `<figcaption>` element is rendered.
- No empty reserved caption block, placeholder, min-height region, or whitespace reservation occupies the caption position.
- Rhythm spacing begins directly after the Photo image bottom edge.

### 3.3 Prohibited patterns

The following are explicitly forbidden and represent documentation drift from earlier architecture versions:

- Hover-only caption reveal.
- Caption line clamp or overflow ellipsis.
- Reserved min-height caption region for uncaptioned Photos.
- Caption used as automatic alt text (alt policy is separate; see OPEN_QUESTIONS.md).

---

## 4. Continuation contract

Frozen reference: FINAL_DESIGN_SPECIFICATION.md section 3.1, Gate G7.

### 4.1 Standard continuation (next_gallery_id present and resolved)

Rendered at the end of the Gallery Photo sequence, on the reading column leading edge:

```
[End pause: 168px desktop / 112px mobile]

End of {Gallery title}          ← metadata sans, secondary color
Next Gallery -- {target title}  ← serif, 28px desktop / 22px mobile
Back to {origin}                ← secondary link, sans
```

Contract details:

- **End pause**: 168px desktop, 112px mobile. Whitespace between last Photo (or its caption) and the "End of" label.
- **"End of {title}"**: Sans-serif metadata role, secondary text color `#5F5E59`.
- **"Next Gallery -- {title}"**: Serif family, 28px desktop / 22px mobile, primary text color `#1A1A18`. This is a native `<a>` element linking to `/galleries/{target-slug}`.
- **"Back to {origin}"**: Secondary link, sans-serif, smaller size. Links back to the origin page (Archive, Place, Home) derived from navigation context with a safe static fallback.
- No cover image at Next. No thumbnail, no preview card.
- No generic styled button. No button treatment, no pill shape, no background fill. Continuation is editorial text links with frozen typography.
- No multiple Next suggestions. Exactly one next_gallery.

### 4.2 No-next variant (next_gallery_id absent or null)

When the Gallery has no next_gallery_id:

```
[End pause: 168px desktop / 112px mobile]

End of {Gallery title}          ← metadata sans
Back to {origin}                ← primary link
Browse Archive                  ← secondary link
```

- "Back to {origin}" becomes the primary action.
- "Browse Archive" is the secondary link pointing to `/archive`.

### 4.3 Continuation to footer spacing

XXL (96px) between the continuation block and the page footer.

### 4.4 Prohibited patterns

- Styled button or button component for continuation.
- Cover image, thumbnail, or visual preview at Next.
- Arrow icon or directional glyph replacing the text label.
- Multiple Next suggestions or recommendation cards.

---

## 5. Position annotation contract

Frozen reference: FINAL_DESIGN_SPECIFICATION.md section 3.1, Gate G5.

### 5.1 Behavior

Persistent display of the current Photo index within the Gallery sequence. Format: `n / total` using tabular numerals.

- Non-interactive. `aria-hidden="true"`. Not keyboard-focusable. Not clickable.
- Decorative repetition of Overview state. May disappear without JS (acceptable enhancement).
- Yields (hides or repositions) at header and continuation regions to avoid overlap.

### 5.2 Desktop presentation

- Persistent trailing margin annotation.
- Quiet text on canvas background.
- Utility/position role: sans-serif, 12-13px, weight 500, tabular numerals.
- Positioned in the trailing margin outside the reading column.

### 5.3 Mobile presentation

- Persistent bottom-right annotation.
- Raised backing: `#EFECE5`.
- 12.5px secondary tabular numerals.
- Inset from safe areas.
- No progress bar, no pill shape, no arrows, no interactive controls.

### 5.4 Implementation approach

PSEUDOCODE / CONTRACT EXAMPLE:

```
On scroll, use IntersectionObserver to determine which Photo
is most visible in the viewport. Update the annotation text
to "{currentIndex} / {totalCount}". Observer targets only
Photo figure elements, not all DOM nodes.
```

No virtualization. No custom scroll handler replacing native loading. The observer exists solely to update the annotation text.

---

## 6. Overview contract

Frozen reference: FINAL_DESIGN_SPECIFICATION.md section 3.1, Gate G6.

### 6.1 Opening

- Triggered by the "Overview {count}" control in the Gallery header.
- Opens as a full-viewport modal overlay.
- `aria-modal="true"` set on the overlay container.
- Background scroll locked (body overflow hidden or equivalent).
- Focus moves into the Overview upon opening.

### 6.2 Grid layout

- Desktop: 6 columns. At viewport width <=1100px: 5 columns.
- Mobile: 3 columns, 8px gaps, approximately 111px cells at 390px viewport width.
- Thumbnails: contained (uncropped), preserving aspect ratio. No `object-fit: cover`. No square crop.

### 6.3 Current marker

- The currently viewed Photo receives a 2px solid outline in focus accent `#0B57D0`.
- An index tag accompanies the marker.

### 6.4 Closing

- Close control: text-based ("Close"), not icon-only. Minimum touch target 44x44px via padding extension.
- Escape key closes the Overview.
- Focus returns to the trigger element that opened the Overview.
- Under `prefers-reduced-motion: reduce`, the close path completes synchronously with no transition.

### 6.5 Focus trap

- Tab and Shift+Tab cycle through focusable elements within the Overview.
- Focus does not escape to background content while the Overview is open.
- First focusable element receives focus on open.

### 6.6 Jump to position

- Selecting a thumbnail jumps the Gallery to the corresponding Photo.
- Exact scroll position is restored so the selected Photo is visible.
- The Overview closes after selection.
- Focus management: after closing, focus returns to the appropriate position in the Gallery document flow.

### 6.7 Without JS

Overview is an acceptable enhancement. Without JS, the Overview control and overlay do not render. Users navigate the Gallery sequentially via native scroll.

---

## 7. Mobile navigation no-JS contract

Frozen reference: FINAL_DESIGN_SPECIFICATION.md sections 4.2, 5.1.

### 7.1 Architecture requirement

Core page navigation must remain usable if JavaScript fails. This is a non-negotiable accessibility and progressive-enhancement requirement.

### 7.2 Desktop navigation

Desktop navigation uses native `<a>` elements in the document flow. No JS is involved. No enhancement needed.

### 7.3 Mobile navigation

Mobile navigation may be enhanced with JS (e.g., a toggle-controlled menu layer), but the architecture requires an accessible fallback when JS is unavailable or fails.

Acceptable strategies:

- Baseline visible/in-flow navigation links that JS upgrades into a compact menu layer.
- A `<details>`/`<summary>` element providing native expand/collapse without JS, enhanced visually by CSS and optionally by JS for animation or focus management.
- Any other approach where the navigation links remain reachable by keyboard and assistive technology without JS execution.

Prohibited strategies:

- A checkbox input hidden with `display: none` as the sole toggle mechanism while claiming keyboard accessibility. A `display: none` element is not focusable and cannot be operated by keyboard.
- Navigation links hidden behind a JS-only toggle with no server-rendered accessible fallback.
- Fragile CSS-only hacks presented as architecture law. The exact implementation technique is an implementation choice, but it must satisfy the accessibility requirement.

### 7.4 Frozen mobile constraints

- No persistent app chrome.
- Menu preserves desktop identity via text and glyph.
- Menu links minimum touch target: 53px height (padding-block 12px).

---

## 8. Focus and reduced-motion contracts

### 8.1 Visible focus

Frozen reference: FINAL_DESIGN_SPECIFICATION.md section 5.2.

- **2px solid outline `#0B57D0` with 3px offset** on all focusable elements.
- Applied universally via `:focus-visible` (or equivalent selector).
- Focus accent `#0B57D0` is used exclusively for keyboard focus indication. Never reused for decorative purposes, active states, titles, or Place identity.
- `main:focus { outline: none }` suppresses the focus ring on the programmatic skip-link target.

PSEUDOCODE / CONTRACT EXAMPLE:

```css
:focus-visible {
  outline: 2px solid #0B57D0;
  outline-offset: 3px;
}

main:focus {
  outline: none;
}
```

### 8.2 Skip link

- Link text: "Skip to content" (or equivalent).
- Target: `<main id="main" tabindex="-1">`.
- Visually hidden until focused.
- Functions as native HTML regardless of JS availability.

### 8.3 Reduced motion

Frozen reference: FINAL_DESIGN_SPECIFICATION.md section 5.4.

- `@media (prefers-reduced-motion: reduce)` zeroes all layer transitions and entrance animations.
- Only functional state transitions remain (e.g., modal open/close, menu toggle).
- Under reduced motion, JS-driven close paths complete synchronously with no animation frame delay.
- No sequence entrance animations exist in the baseline design.

---

## 9. Scroll restoration stance

### 9.1 Baseline

Rely on browser-native scroll restoration via the history API. Modern browsers restore scroll position on back/forward navigation by default.

### 9.2 Custom scroll restoration

Custom sessionStorage-based scroll restoration is premature at the architecture stage. It adds hidden state and complexity without evidence of a problem.

Policy: implement custom scroll restoration only if measured navigation behavior on production builds demonstrates that browser defaults fail for this specific site's navigation patterns. If implemented, it must respect `prefers-reduced-motion` and not interfere with Overview jump-to-position behavior.

---

## 10. Canonical route and header contracts

### 10.1 Gallery route

Canonical Gallery URL: `/galleries/{slug}`.

No alternative routes. No `/gallery/{name}`, no root-level slug, no `/archive/galleries/{slug}`.

### 10.2 Header

- Header sits on the reading column (~680px), leading-edge aligned with captions.
- Header is NOT sticky. It scrolls with the document.
- Contains: Back to {origin}, Gallery title (serif Display), photographed date/range and Place(s), optional description, Overview {count} control.

### 10.3 Mobile native vertical progression

- Mobile Gallery uses native vertical scroll only.
- No horizontal swipe affordances, pagination dots, carousel, or filmstrip.
- No full-screen app chrome.
- Safe-area padding respected.

---

## 11. Image loading strategy (runtime contract)

See IMAGE_PIPELINE.md for derivative generation and manifest contract.

### 11.1 First / LCP image

- `loading="eager"` (or omit the loading attribute).
- `fetchpriority="high"`.
- `decoding="sync"` or omit decoding for fastest paint.
- Preload via `<link rel="preload">` for the LCP candidate only.

### 11.2 Subsequent images

- `loading="lazy"`.
- `decoding="async"`.
- No fetchpriority override.

### 11.3 Responsive attributes

- `srcset` and `sizes` populated from the generated asset manifest at build time.
- Intrinsic `width` and `height` attributes set from manifest dimensions to prevent CLS.
- Aspect ratio preserved; no destructive crop.

### 11.4 Virtualization

Not part of the baseline. Virtualization is considered only if real production measurements prove that native lazy loading causes unacceptable memory consumption or scroll performance degradation on target devices. See PERFORMANCE_BUDGET.md section 5.

---

## 12. Accessibility compliance target

WCAG 2.2 AA is the compliance target. Key runtime requirements:

- Exactly one `<h1>` per page (Gallery title on Gallery page; page title on others).
- Heading levels never skip.
- Proper `aria-modal="true"` on Overview and Menu dialogs.
- Position annotation is `aria-hidden="true"`.
- Minimum touch targets: menu links >=44px (actual: 53px), close buttons >=44x44px, Overview cells >=111px edge at 390px.
- 320px reflow: `scrollWidth <= 320` everywhere.
- 200% zoom verification via 720x450 layout-equivalent viewport.

Full accessibility specification: FINAL_DESIGN_SPECIFICATION.md section 5.
Testing approach: TESTING_AND_VISUAL_REGRESSION.md.

---

## 13. Cross-references

- IMAGE_PIPELINE.md -- derivative generation, manifest contract, srcset/sizes population.
- BUILD_AND_ROUTING.md -- build-time rendering, canonical routes, redirect generation.
- PERFORMANCE_BUDGET.md -- JS/CSS/image budget classification, Core Web Vitals targets.
- TESTING_AND_VISUAL_REGRESSION.md -- runtime test categories, focus trap testing, visual regression.
- OPEN_QUESTIONS.md -- deferred items including alt-text publication policy, CJK subsetting implementation.
- IMPLEMENTATION_PHASES.md -- phase ordering for runtime feature delivery.

---

**END OF RUNTIME AND PROGRESSIVE ENHANCEMENT**
