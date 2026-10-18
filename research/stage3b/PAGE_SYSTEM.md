# Stage 3B — Page System

Status: **shared cross-page visual system**. Every page spec in this stage applies these rules; a page may only narrow them, never contradict them.

Stage 3A is a contract. Where this file says **Frozen**, the value comes from Stage 2B/3A and Stage 3C must not change it. Where it says **Recommended starting specification**, Stage 3C begins there and may calibrate with real photography. Where it says **Prototype-gated**, Stage 3C must run the named comparison before freezing. Where it says **Visual implementation detail**, Stage 3C may adjust without changing design meaning.

## Shared canvas

Frozen (Stage 3A `COLOR_SYSTEM.md`):

- Canvas `#F6F4EF` is the default page and Gallery viewing surface.
- Raised surface `#EFECE5` is reserved for Menu/Overview distinction; it is never a card fill.
- Primary text `#1A1A18`; secondary text `#5F5E59`; hairline `#D4D0C7` (rare); strong neutral state `#34332F`; focus accent `#0B57D0` (accessibility only).
- No decorative/brand accent, no dark mode, no gradient, no blur, no per-image background extraction.

Prototype-gated: exact canvas warmth and focus color after real-photo testing (Gate G2). Values above are the mandatory starting point; adjust lightness first if a pair fails, never introduce a new hue.

Measured at Stage 3A (re-verify in 3C): primary 15.86:1, secondary 5.91:1, focus 5.81:1 against canvas; focus 5.41:1 against raised surface.

## Shared content widths

Reference viewports are design references, not production breakpoints: Desktop ≈ 1440 px, Mobile ≈ 390 px.

| Width role | Recommended starting value | Status |
|---|---|---|
| Discovery/header content frame | max 1400 px, horizontally centered | Recommended (within Frozen 1360–1440 range) |
| Viewport gutters (desktop) | 48 px minimum, growing with viewport | Recommended |
| Gallery media frame | `min(90vw, 1440px)` ceiling for landscape | Recommended (within Frozen 88–92vw / 1360–1440 range) |
| Gallery reading column (header, caption, continuation) | max ≈ 680 px (60–70 Latin chars at body; capped per role) | Recommended |
| About body column | 60–70 Latin / 28–36 CJK characters | Frozen range |
| Mobile side margin (text, controls, captions, cards) | 20 px | Recommended (within Frozen 16–20 range) |

Rules (Frozen):

- Canvas may extend full viewport width; text and controls stay on the content frame.
- Alignment uses a small set of persistent leading edges: site name, page title, grid, body text. No isolated decorative offsets.
- Column count follows content fit, not device labels. Intermediate desktop widths collapse 3 → 2 columns when a card can no longer support its image and untruncated metadata.
- No page-level horizontal scrolling anywhere.

## Shared page header

Applies to Archive, Places Index, Place, About. Gallery has its own photographic context header (see `GALLERY_DESIGN_SPEC.md`).

Anatomy (Recommended starting specification):

```text
[top spacing from global navigation]
H1 — page title (Index/Place serif role)
[optional context line — one quiet secondary-sans line]
[bottom spacing to first content]
```

- Top spacing: 96 px desktop / 48 px mobile (XXL / XL). First content must not appear attached to global navigation.
- Bottom spacing to first grid/content: 48 px desktop / 24–48 px mobile (XL / L–XL).
- Alignment: leading edge, aligned with the content frame; no centered hero treatment.
- Optional context is at most one sentence in secondary sans; never a paragraph.
- One visible H1 per page. Heading levels descend coherently.

## Shared Gallery card

Frozen card anatomy (order never changes, Stage 3A `DISCOVERY_UI_SYSTEM.md`):

```text
Cover (intrinsic ratio, complete frame)
Title (display serif)
Photographed date or range
Place when known
Photo count
```

- Image + text block, not a bordered container. No card background, no border shell, no shadow, no overlay metadata, no hover zoom.
- Cover and text share the same leading edge.
- Title is the semantic link; the whole block is a perceivable interactive region.
- Date/Place/count group into one or two quiet lines in metadata sans. Do not abbreviate dates or Places to force one line.
- Context-controlled variables: card scale, column count, metadata density. Never changed: typography roles, content ordering, interaction affordance.

Context densities:

| Context | Desktop columns | Cover scale | Notes |
|---|---:|---|---|
| Home recent Galleries | 2–3 | Largest after hero | 3 only when cover resolution supports it |
| Archive | 3 | Medium | Year groups span the grid |
| Place page | 3 | Medium | Identical card on every Place page |

Mobile: always one column, normal flow.

## Metadata hierarchy

Frozen relative weights (Stage 3A): Cover > Gallery title > page/Place title (at page entry) > year heading > photographed date/range > Place > photo count > navigation/utility.

- Date/range is primary metadata; Place is secondary but remains a visible link where applicable; count is the lowest required metadata.
- Publication cues (“Featured”, “Recently added”) use the metadata role as plain text; they never replace or outweigh the photographed date.
- Separators: middle dot or spatial gap between peers only; never breadcrumb chains.
- Years and `n / total` use tabular numerals.
- Metadata below 14 px stays weight ≥ 400 and passes 4.5:1.

## Desktop layout logic

- Static compact header: site name leading, `Archive · Places · About` trailing; not sticky, never overlays an image.
- Discovery grids: ordinary reading order; no masonry reordering of chronology or authored list order. Year headings span the grid and align with card leading edges; they scroll normally.
- Gallery is not forced into the discovery grid: header/caption follow the reading column; each Photo centers inside the broader media frame at its intrinsic width.
- Rows may have unequal media heights; grid order, not visual equalization, is the rule.

## Mobile layout logic

- One column everywhere for discovery; native vertical progression in Gallery.
- Site name + Menu top row; Menu is an opaque neutral full-viewport layer.
- Captions stay inset even when a Gallery image uses the controlled edge-to-edge exception.
- Safe-area padding for any persistent annotation and for full-screen layer controls.
- Mobile is not a miniaturized desktop: spacing preserves hierarchy while reducing traversal fatigue.

## Shared spacing rules

Frozen six-step scale (Stage 3A `SPACING_AND_GRID.md`): XS 4, S 8, M 16, L 24, XL 48, XXL 96. Beyond XXL, use explicit compositions of existing steps rather than new tokens (e.g. `XXL + XL = 144`, mobile `XL + M = 64`, Gallery end pause `XXL + XL + L = 168` desktop / `XL + XL + M = 112` mobile).

- The gap between groups is at least twice the gap inside a group.
- Section rhythm (Frozen targets): header→first content XL–XXL; title→grid XL; year heading→first row L; cover→title M; title→metadata S; discovery row XL–XXL; major section XXL; last content→page end XXL.
- Gallery sequence rhythm (Frozen system, application rules in `GALLERY_DESIGN_SPEC.md`): Compact 64–72/40–48, Base 96/64, Breathing 144/96. Base is the default; orientation alone never chooses rhythm.
- No page invents its own spacing values outside this scale.

## Link/focus rules

Frozen (Stage 3A `INTERACTION_VISUAL_RULES.md`, `ACCESSIBILITY_VISUAL_RULES.md`):

- Inline links: visible underline or equally explicit non-color cue. Navigation links may omit the resting underline; hover/focus add a clear line or perimeter.
- Gallery metadata links (Place, date) differ from adjacent static metadata by underline, not color.
- Focus-visible: minimum 2 px perimeter in focus accent, optionally separated by a canvas-colored gap so it survives photographs and raised surfaces. Never color-only; never removed.
- Current navigation: persistent underline and/or moderate weight; never accent color alone.
- Touch targets: 24×24 px absolute AA floor; aim 44 px touch / ≈40 px desktop; small labels may extend hit areas without overlapping neighbors.
- No hover-only meaning; hover styling only on hover-capable devices.
- Skip-to-content link is the first focusable element.
- WCAG 2.2 AA visual baseline: 4.5:1 normal text, 3:1 large text and non-text/focus.

## Motion

Frozen: no hover zoom, no scroll reveals, no page transitions, no parallax, no scroll-jacking, no shimmer. Only short functional state transitions: Menu/Overview open/close 160–220 ms opacity with at most 4–8 px translation; hover/focus 100–150 ms or instant. Reduced motion removes translation.

## Frozen vs prototype-gated values

Frozen by Stage 2B/3A (do not reopen):

- Attention order `Photo > Whitespace > Typography > Metadata > Controls`.
- Quiet Editorial Archive direction; discovery modest personality, Gallery extreme restraint.
- Card philosophy; no-destructive-crop; no full-bleed on Home/desktop Gallery; mobile media-only edge-to-edge exception.
- Three-rhythm Gallery system; captions attached below Photos; `n / total` format; Overview structure and subordination; text-led continuation without cover.
- Static header; text site mark; mobile Menu layer; motion limits; accessibility baseline.

Prototype-gated in Stage 3C (the seven gates, see `STAGE_3C_VISUAL_GATES.md`):

1. G1 Font pairing + CJK metrics.
2. G2 Canvas warmth + focus color.
3. G3 Home hero scale + Featured/Recently added cue.
4. G4 Long Gallery Base spacing.
5. G5 Mobile current-position strategy.
6. G6 Overview mobile 3 vs 2 columns.
7. G7 Continuation pause + Next-title weight.

Everything else in Stage 3B is a recommended starting specification or visual implementation detail, labeled per item in the page specs.
