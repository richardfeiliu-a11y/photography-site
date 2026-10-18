# Shared Interaction Specification

This file defines interactions shared by every Variant. A Test file overrides only its named variable.

## Global navigation

### Desktop

- Site name links Home.
- Labeled items, in order: Archive, Places, About.
- Current destination is indicated without changing label or position.
- Gallery is never a top-level navigation item.

### Mobile

- Top row contains site name and one `Menu` control.
- Menu opens an in-page navigation layer containing Archive, Places, About in that order.
- Close and `Escape` dismiss; focus returns to Menu.
- No hover-only interaction and no horizontal navigation strip.

## Prototype harness

- Evaluator mode shows test/variant/fixture state outside the evaluated page canvas.
- Participant mode hides it.
- Switching variants keeps the same route, fixture, feature/volume state, and top/target scroll state whenever the Test comparison requires it.
- The harness never changes product navigation or appears in user tasks.

## Gallery entry

- Gallery cover/card and explicit title/action share one canonical destination.
- Entry records origin context: Home, Archive, Places, or a specific Place page, plus origin scroll position.
- Direct canonical entry without origin defaults continuation/back context to Archive.
- Entering from different discovery paths never changes Gallery Photo order, metadata, or URL.

## Back behavior and origin restoration

- Browser Back returns to the originating discovery route and its prior scroll position.
- Shared `Back to {origin}` uses the same restoration target.
- Origin labels are concrete: `Back to Home`, `Back to Archive`, `Back to Paris`, or `Back to Places`.
- Overview open/close does not create browser history; Back must not unexpectedly close Overview instead of returning to origin.
- Reentering a Gallery after returning to origin begins at Gallery top by default; Test 4 records this behavior rather than inventing a resume feature.

## Gallery sequence

- Photo order is exactly the fixture order.
- Images are fully visible via contain behavior; no editorial crop.
- Caption appears only when fixture data exists; no empty caption block.
- Current position uses `n / total` consistently in T3/T4. In vertical mode, current Photo is the one occupying the largest central viewport area; in swipe mode it is the active stage.
- Photo count is contextual within viewing and may appear in current-position/Overview UI; it is not required in the Gallery title block.

## Overview open/close

Applies only when Overview is enabled for T3 or inherited by T4.

- Entry label: `Overview`.
- Open: remember current Photo ID and exact sequence scroll position; move focus into full-viewport light table.
- Current Photo receives a visible but restrained indicator.
- Select thumbnail: close layer and align selected Photo to the sequence viewport with its caption reachable immediately below.
- Close without selection: restore exact pre-open position.
- Close controls: visible `Close`, desktop `Escape`; clicking outside is not required.
- Focus remains inside the layer while open and returns to the initiating control/selected Photo after close.
- Overview displays thumbnails in authored order and exact photo count; it does not display captions or become a separate route.

## End-of-Gallery continuation baseline

Continuation is fixed across all Gallery Variants and is not a T4 variable.

Use no more than two end actions:

1. **Primary:** a compact `Next Gallery — {title}` card/link when a next Gallery exists.
2. **Secondary:** `Back to {origin}`.

Relevant Place and photographed-date links remain in Gallery context near the title, not repeated as competing end CTAs. Previous Gallery is not an end action; users may return through origin or browser Back. If no next Gallery exists, `Back to {origin}` becomes primary and `Browse Archive` becomes secondary.

Next Gallery order follows the current origin's discovery order. For direct entry, use Archive photographed chronology. The chosen next item is identical between compared Variants.

## Keyboard behavior

- Tab reaches global nav, Gallery actions, Overview, thumbnails, Close, and continuation in logical order.
- Enter/Space activates focused controls.
- Escape closes Menu or Overview; otherwise it does nothing.
- Vertical sequence does not hijack Arrow/PageUp/PageDown/Home/End.
- Swipe-first desktop sanity mode supports Left/Right Arrow as an explicit equivalent of Previous/Next.
- Focus indicators are always visible.

## Mobile touch behavior

- Tap targets are comfortably operable and do not overlap image gestures.
- Vertical Variant uses native page scroll only.
- Swipe Variant supports horizontal swipe plus visible Previous/Next controls.
- Swipe handling leaves browser/OS edge-back gesture regions untouched.
- No pinch/zoom or fullscreen behavior is required.
- Menu/Overview lock background scroll while open; closing restores it.

## Loading and deterministic state

- Preserve layout dimensions while images load so variants do not differ through layout shift.
- Failed fixture asset shows a neutral fixed-ratio placeholder with the same ID; failure must be visible to evaluator and must not silently load a network fallback.
- Initial screenshot state is captured only after required fixture assets for the viewport are settled.
- Every route can be reset to a known top/target/end state without manual data editing.

