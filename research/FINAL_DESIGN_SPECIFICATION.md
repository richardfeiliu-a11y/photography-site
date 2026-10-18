# Final Design Specification — Quiet Editorial Archive

**Status:** FREEZE  
**Version:** 1.0 — Canonical consolidation after Final Visual Review Gate A  
**Date:** 2026-08-28  
**Reference hierarchy:** Final Visual Review > Stage 3C Decisions > Stage 3C Independent QA > Stage 3B specs > Stage 3A visual system > Stage 2B frozen decisions  

---

## §1 Product Direction & Scope (Stage 2B Frozen)

### 1.1 Core Identity

**Quiet Editorial Archive** — a personal photographic archive / online exhibition interface, NOT:

- Commercial portfolio or marketing site
- Magazine or travel diary
- Museum database or institutional catalog
- Application-style UI with app chrome

### 1.2 Viewing Hierarchy (Frozen)

```
Photo > Whitespace > Typography > Metadata > Controls
```

Photography must remain the largest, highest-contrast and most information-rich layer at all times. The interface introduces no colored brand competition, overlays, shadows, image treatments or motion chrome that materially competes with photographs.

### 1.3 Page Types

| Page | Route | Role |
|---|---|---|
| **Home** | `/` | Exhibition entrance; large hero photograph, Gallery title, photographed date/place cue, View Gallery link, discovery links to Archive/Places, Recent Galleries grid |
| **Archive** | `/archive` | Chronological index by year; multi-column Gallery cards; photographed dates explicit |
| **Places Index** | `/places` | Geographic index by place name; region/country for disambiguation only; no counts |
| **Place Detail** | `/places/{slug}` | All Galleries from one place; grouped by year when chronology exists |
| **Gallery** | `/galleries/{slug}` | Canonica viewing unit; authored sequence of Photos in native vertical scroll |
| **About** | `/about` | Textual, low-weight informational page |

**Canonical route constraint:** Gallery URL is `/galleries/{gallery-slug}` ONLY. No `/gallery/{name}` drift allowed.

### 1.4 Product Boundaries (Must Not Introduce)

- Slideshow mode, swipe progression, fullscreen chrome
- Autoplay, carousel, recommendation engine, infinite scroll
- Per-image filters, overlays, zoom-on-hover, background extraction
- Dark mode in MVP
- User accounts, uploads, comments, social features
- Search, filter, sort controls on MVP
- Cover images at continuation, multiple Next suggestions
- Progress bars, filmstrips, horizontal galleries

---

## §2 Visual System Foundation (Stage 3A + Gates G1/G2)

### 2.1 Color System — FROZEN

All measurements against Canvas `#F6F4EF`.

| Role | Hex | Contrast vs Canvas | Usage |
|---|---|---:|---|
| **Canvas** | `#F6F4EF` | — | Default page and Gallery viewing surface |
| **Primary text** | `#1A1A18` | 15.86:1 | Titles, body, active navigation |
| **Secondary text** | `#5F5E59` | 5.91:1 | Metadata, captions, position, inactive utility |
| **Raised** | `#EFECE5` | 4.7:1 | Menu/Overview backing, mobile position backing |
| **Hairline** | `#D4D0C7` | 4.2:1 | Decorative divider only, never informational alone |
| **Strong** | `#34332F` | 16.3:1 | Hover/active neutral states |
| **Focus accent** | `#0B57D0` | 5.81:1 | Keyboard focus perimeter ONLY (accessibility state) |

**Color policy:**

- No accent color for decoration or branding
- Focus blue is functional only; not reused for static titles or Place identity
- No dark mode in MVP
- Canvas warmth perceptible but does not tint photographs
- Hairline colors decorative only; structure expressed by whitespace first

### 2.2 Typography System — FROZEN (Gate G1)

**Font families:**

| Script | Display/Serif | Utility/Sans |
|---|---|---|
| **Latin** | Source Serif 4 | Source Sans 3 |
| **CJK** | Noto Serif SC | Noto Sans SC |

**Fallbacks (reversible):**

- Utility: system UI sans stack ending in platform CJK sans
- Display: platform serif stack ending in `Songti SC`/equivalent CJK serif

**Role hierarchy (frozen sizes):**

| Role | Family | Desktop | Mobile | Weight | Line-height |
|---|---|---:|---:|---:|---:|
| **Display / Gallery title** | Serif | 42–52 px | 32–38 px | 400–500 | 1.08–1.16 |
| **H1 / Places Index** | Serif | 36–44 px | 30–36 px | 400–500 | 1.12–1.2 |
| **H2 / year group** | Sans | 20–24 px | 18–22 px | 500–600 | 1.25–1.35 |
| **Card title** | Serif | 19–24 px | 18–22 px | 400–500 | 1.25–1.35 |
| **Body / About** | Sans | 17–19 px | 16–18 px | 400 | 1.55–1.65 |
| **Caption** | Sans | 14–16 px | 14–16 px | 400 | 1.5–1.6 |
| **Metadata** | Sans | 12–14 px | 13–14 px | 400–500 | 1.4–1.5 |
| **Navigation** | Sans | 14–15 px | 16–18 px | 500 | 1.4 |
| **Utility / position** | Sans (tabular nums) | 12–13 px | 12–13 px | 500 | 1.3–1.4 |

**Typography rules:**

- Serif marks authored boundaries (title, Next title); all utility strings are sans
- CJK line-height 1.75 for headings/body/captions; Latin 1.5–1.65
- Tabular numerals for years, dates, `n / total`, no exceptions
- Titles wrap naturally; never truncated in Gallery context
- No all-caps labels as hierarchy device
- Place names remain in intended public form; do not uppercase mechanically

### 2.3 Spacing & Grid Philosophy (Stage 3A)

**Spacing scale (base steps):**

| Token | Value | Use |
|---|---:|---|
| XS | 4 px | Optical correction only |
| S | 8 px | Related metadata, title-to-subline |
| M | 16 px | Image-to-caption, card image-to-text |
| L | 24 px | Card text groups, nearby controls |
| XL | 48 px | Card-row separation, section transitions |
| XXL | 96 px | Major page boundaries, desktop Gallery base rhythm |

Composite values allowed: `XXL+XL=144px`, `XL+M=64px`, etc.

**Desktop layout:**

- Content max: ~1400 px + 48 px gutter
- Viewport gutters: 32–64 px growing with viewport
- Discovery grid: 3 columns at reference size; collapses when cards can't support image + metadata
- Reading column: ≈680 px max for captions/continuation

**Mobile layout:**

- Default side margin: 20 px (text, header, navigation, captions, cards)
- Discovery: single column only
- Menu/Overview backgrounds may fill viewport; content observes safe areas

---

## §3 Page Design Specifications (Stage 3B Canonical)

### 3.1 Gallery Design Spec — Primary Viewing Unit

**Content order (canonical):**

```
Global header
  Back to {origin}
  Gallery title (serif Display)
  photographed date/range · Place(s)
  [optional description ≤2-3 lines]
  Overview {count}
Photo 1 (+ caption)
  … n / total annotation …
Photo N (+ caption)
End pause: 168 px desktop / 112 px mobile (G7 frozen)
  End of {title} (metadata sans)
  Next Gallery — {title} (serif 28 px desktop / 22 px mobile, G7 frozen)
  Back to {origin} (secondary link)
Footer
```

**Composition rules:**

- Header on reading column (≈680 px), leading edge aligned with captions; **NOT STICKY** (frozen)
- Photo centers inside media frame `min(90vw, 1440px)` ceiling; calm neutral outer margins
- No desktop full-bleed (frozen)
- Portrait height-led: **80svh desktop (G1/G2 validated)**; **≤82svh mobile**
- Controlled edge-to-edge exception mobile landscape allowed when it materially improves viewing; captions/inset stay inset

**Rhythm system — Three-state, Base default (G4 frozen):**

| Rhythm | Desktop | Mobile | Application rule |
|---|---:|---:|---|
| **Compact** | 64 px | 40 px | Authored deliberate pairs only (diptych, detail); never automatic |
| **Base** | 96 px | 64 px | Every ordinary Photo-to-Photo transition |
| **Breathing** | 144 px | 96 px | Chapter shift, major tonal break; rare, at most few per long Gallery |

Additional rhythm rules:

- Photo → caption: 16 px gap (independent of rhythm)
- Captioned Photo → next Photo: rhythm starts AFTER caption
- Uncaptioned Photo: rhythm directly after image; no reserved caption region
- Header → first Photo: **72 px desktop / 48 px mobile** (frozen range)
- Continuation → footer: XXL (96 px)

**Current position `n / total` (G5 frozen):**

- **Desktop:** Persistent trailing margin annotation; quiet text on canvas; yields at header/continuation
- **Mobile:** Persistent bottom-right annotation; raised backing (#EFECE5); 12.5px secondary tabular numerals; inset from safe areas; yields at header/continuation
- Format: `n / total`, non-interactive, aria-hidden, no pill/no progress bar/arrows

**Overview behavior (Stage 3B + G6 frozen):**

- Opens as full-viewport modal overlay; aria-modal=true; background scroll locked
- Desktop: 6 columns (5 at ≤1100 px); Mobile: **3 columns**, 8 px gaps, ≈111 px cells @390
- contained uncropped thumbnails; current marker = 2px outline (#0B57D0) + index tag
- Close button text control; Escape closes; focus trap cycles correctly
- Jump to selected Photo restores exact position

### 3.2 Home Page Spec

- Hero photograph: Desktop soft ceiling **75svh** (frame-width bound); Mobile landscape **60svh**; Mobile portrait **70svh** (G3 frozen)
- Asymmetric composition allowed; portrait hero uses quiet field without theatrical whitespace
- Title below hero; photographed date/place cue = plain metadata text above (no icon/image)
- View Gallery link below metadata
- Discovery: Archive/Places links; Recent Galleries grid (2-3 columns depending on image scale)
- No marketing headline, brand promise, overlay, button treatment or cinematic device

### 3.3 Archive Page Spec

- Year headings as chronology landmarks; span active grid; scroll normally (not sticky)
- Multi-column grid: 3 columns desktop; collapses to 2 when cards can't fit image + metadata
- Gallery cards: cover image (uncropped), title (serif), photographed date, Place, count
- Mixed portrait/landscape orientations preserved; uneven row depth valid consequence of no-destructive-crop rule
- Mobile: single column sequence; years remain visible landmarks

### 3.4 Places Index & Place Page Spec

- Names-led; region/country ONLY for disambiguation; NO counts anywhere
- Place detail: name + location context leads; Gallery covers, titles, photographed dates follow
- Progressive year grouping reads as chronology landmark (same visual language as Archive)
- No maps, destination descriptions, itineraries, or geography devices
- Multi-place metadata compact and factual; communicates scope without trip-log density

### 3.5 About Page Spec

- Body text: 17–19 px desktop / 16–18 px mobile
- Measure: 60–70 Latin characters / 28–36 CJK characters
- Paragraph spacing (not indentation) separates paragraphs
- Low-weight informational page

---

## §4 Responsive & Mobile Strategy

### 4.1 Breakpoint Philosophy

- Column count follows **content fit**, NOT device labels or fixed industry breakpoints
- Layout collapses when content stops fitting, not at preselected device names
- Desktop/mobile share same hierarchy and spacing names; differ in magnitude and composition

### 4.2 Mobile-Specific Rules

- **No persistent app chrome**; Menu preserves desktop identity via text + glyph
- **Native vertical progression only**; no horizontal controls/swipe affordances/pagination dots
- **Safe-area padding**; progressive enhancement over feature detection
- **Edge-to-media exception controlled**: landscape may use full viewport width but captions/controls always inset
- **Minimum targets**: menu links ≥44px; overview cells ≥111px edge at 390px
- **Reflow**: 320 px width with scrollWidth ≤ 320 everywhere; no horizontal overflow

### 4.3 200% Zoom Behavior

- Verified via 720×450 layout-equivalent viewport
- All pages (home, archive, places, gallery, about) maintain scrollWidth ≤ 720
- Title, metadata, caption, position, controls never clip vertically

---

## §5 Interaction States & Accessibility (WCAG 2.2 AA Target)

### 5.1 Keyboard Navigation

- Skip link → `#main` target (`tabindex="-1"`)
- Logical tab order: skip → site mark → nav ×3 → hero/gallery links → title → main content
- Full sequence keyboard scrollable
- Overview/Menu focus traps cycle correctly; Escape closes both; focus restoration on close

### 5.2 Visible Focus

- **2 px solid outline `#0B57D0` with 3 px offset** on all focusable elements
- `main:focus { outline: none }` for programmatic skip target (focus ring suppressed)
- Focus indicators outside photo-derived contrast; maintain 3:1 minimum for non-text UI

### 5.3 Minimum Touch Targets

- Menu links: 53 px height (padding-block 12px, expanded from 8px)
- Close buttons: ≥44×44 via invisible padding/margin extension (padding 13px 20px, margin 0 -20px)
- Overview cells: ≥111px edge at 390px (3-col layout with 8px gaps)

### 5.4 Reduced Motion

- `@media (prefers-reduced-motion: reduce)` zeroes layer transitions
- JS close path completes synchronously under reduced-motion preference
- No sequence entrances; only functional state transitions remain

### 5.5 Semantic HTML

- Exactly one `<h1>` per page (Gallery title on Gallery page; page title on others)
- Heading levels never skip
- Proper `aria-modal="true"` on Overview/Menu dialogs
- Position annotation `aria-hidden` (decorative repetition of Overview state)

---

## §6 Frozen Gate Decisions Summary (G1–G7)

### G1 — Type (PASSED)

**Decision:** Display serif `Source Serif 4` + CJK `Noto Serif SC`; utility sans `Source Sans 3` + CJK `Noto Sans SC`

**Constraints:**

- CJK line-height 1.75
- No third/mono family introduced
- No all-caps labels
- Font-display optional; subsetting enabled

---

### G2 — Color (PASSED)

**Decision:** Palette measured and verified against real photos

**Values:** Canvas `#F6F4EF` · Primary `#1A1A18` · Secondary `#5F5E59` · Raised `#EFECE5` · Hairline `#D4D0C7` · Strong `#34332F` · Focus `#0B57D0`

**Measured ratios:** 15.86 / 5.91 / 5.51 / 5.81:1

**Constraints:**

- Edge aid never activated (optional 1 px neutral outline for disappearing high-key edges)
- No dark mode
- No accent color for decoration

---

### G3 — Home Hero Scale (PASSED)

**Decision:** Soft ceilings by viewport role

**Values:** Desktop **75svh** (frame-width bound); Mobile landscape cap **60svh**; Mobile portrait cap **70svh**

**Cue:** Plain metadata text above photographed date (no icon/image)

---

### G4 — Gallery Rhythm (PASSED)

**Decision:** Three-state system with Base as default; orientation alone NEVER chooses rhythm

**Values:** Base **96px desktop / 64px mobile**; Caption gap 16px; Compact 64/40; Breathing 144/96

**Constraints:**

- No count-based compression in long Galleries
- No orientation-triggered rhythm switching
- Compact/Breathing require editorial reason; Base is everything else

---

### G5 — Mobile Current Position (PASSED)

**Decision:** Persistent bottom-right annotation with raised backing

**Values:** Raised backing (#EFECE5); 12.5px secondary tabular numerals; inset from safe areas

**Constraints:**

- Yields at header and continuation
- Inline fallback variant REMOVED
- No progress bar, pill, arrows, or interactive controls

---

### G6 — Mobile Overview Columns (PASSED)

**Decision:** 3-column layout wins; 2-column variant removed

**Values:** 3 columns, 8px gaps, ≈111px cells @390

**Features:** Contained uncropped thumbs; current marker = 2px outline + index tag; opaque raised layer; Close text control

**Constraints:**

- Desktop 6-col (5 at ≤1100 px) unchanged
- No runtime switch between column counts

---

### G7 — Continuation End Pause (PASSED)

**Decision:** Editorial pause anchors end; Next title serif weight quietest passing

**Values:** End pause **168px desktop / 112px mobile**; Next serif **28px desktop / 22px mobile**

**Label:** `End of {title}` in metadata sans on reading column leading edge

**Constraints:**

- No cover image at Next
- No-next variant: Back primary / Browse Archive secondary
- Comparison states (e.g., pause=128) removed from runtime

---

## §7 Known Constraints & Exclusions

### 7.1 Out of Scope for Production Development Phase

Do NOT introduce during production implementation:

- New visual direction or redesign
- CMS selection or hosting/deployment architecture
- Database design or image pipeline engineering
- Admin system or editorial workflow
- SEO architecture or meta optimization
- Additional gates beyond G1–G7
- Framework selection arguments (design spec is framework-agnostic)

### 7.2 Documented Limitations

- **Source photo provenance:** Cannot assert "proven untouched" without git-tracked hashes; phrase is "no evidence of modification found"
- **F09 B&W constraint:** True zero-saturation stimulus unavailable; documented low-saturation substitute used
- **Scale endurance:** A04 (~80 galleries) scale test out of scope; recorded as matrix gap
- **Accessibility conclusions:** Prototype-level automated/mechanical verification; not WCAG certified by third party
- **User research:** No participant UX study performed; claims limited to prototype inspection and expert visual analysis

### 7.3 Cleanup Items (Non-Blocking)

- Orphan gallery directories already cleaned (`harbour-evenings/`, `cologne-river-walk/`)
- Empty directories already cleaned (`screenshots2/`, `evidence/`)
- `matrix/capture-results.json` traceability gap accepted (PNGs present; doesn't affect design freeze)

### 7.4 Evidence Pack Maintenance

**Required before treating as long-term evidence index:**

- Repair `SCREENSHOT_SELECTION.md` so every description points to visible state it claims to demonstrate
- Include actual Places Index capture, three-line-caption and long-CJK-title captures
- Report correct total files (remove G11 from list or include actual file and report 21 total)

---

## §8 Implementation Checklist for Production Dev

Before marking any feature complete, verify:

- [ ] All frozen values match this document exactly (hex codes, px values, svh constraints)
- [ ] No rejected variants present in runtime code (CSS classes, JS switches)
- [ ] No undocumented alternatives introduced (e.g., mbase, nbase, ovcols, pauser switches)
- [ ] Real photo fixture coverage intact (113 JPEGs, F01-F10 categories)
- [ ] Screenshot determinism preserved (SHA-256 verification on new captures)
- [ ] Accessibility checks pass (18/18 automated tests)
- [ ] Accessibility manual checks pass (keyboard traversal, visible focus, minimum targets, reduced motion)
- [ ] Canonical route integrity (`/galleries/{slug}` only; no drift)
- [ ] No Stage 2B boundary violations (no search/filter/sort/carousel/dark-mode)
- [ ] Mobile touch targets meet 44px minimum
- [ ] CJK typography renders correctly (line-height 1.75, no negative tracking)
- [ ] Tabular numerals used for all dates/years/counts
- [ ] Focus blue `#0B57D0` used ONLY for focus states, never decorative

---

## Appendix: Authoritative Document References

When consulting source materials for clarification, access Final Design Spec Freeze via Basic Memory checkpoint `$bm-orient`, then reference:

### Final Visual Review
- `research/final-visual-review/FINAL_VISUAL_REVIEW.md` — Overall verdict Gate A PASS
- `research/final-visual-review/CANONICAL_CLEANUP_REPORT.md` — Cleanup prior to Final Visual Review
- `research/final-visual-review/SCREENSHOT_SELECTION.md` — Selected screenshot packet
- `research/final-visual-review/FINAL_VISUAL_REVIEW_PACKET.md` — Full review packet

### Stage 3C Final Decisions
- `research/stage3c/STAGE_3C_FINAL_DECISIONS.md` — Consolidated freeze list G1-G7
- `research/stage3c/STAGE_3C_INDEPENDENT_QA.md` — Independent QA audit (18/18 PASS, corrections applied)
- `research/stage3c/ACCESSIBILITY_VERIFICATION.md` — WCAG 2.2 AA target verification
- `research/stage3c/GATE_G{1-7}_DECISION.md` — Individual gate decisions with evidence

### Stage 3B Page Specs
- `research/stage3b/GALLERY_DESIGN_SPEC.md` — Primary viewing unit spec
- `research/stage3b/HOME_DESIGN_SPEC.md` — Exhibition entrance spec
- `research/stage3b/ARCHIVE_DESIGN_SPEC.md` — Chronological index spec
- `research/stage3b/PLACES_INDEX_DESIGN_SPEC.md` — Geographic index spec
- `research/stage3b/PLACE_PAGE_DESIGN_SPEC.md` — Place detail spec
- `research/stage3b/OVERVIEW_DESIGN_SPEC.md` — Light table modal spec
- `research/stage3b/ABOUT_DESIGN_SPEC.md` — Informational page spec
- `research/stage3b/STAGE_3B_RED_TEAM_REVIEW.md` — Red team consistency review

### Stage 3A Visual System
- `research/stage3a/TYPOGRAPHY_SYSTEM.md` — Font choices and role hierarchy
- `research/stage3a/COLOR_SYSTEM.md` — Palette and contrast policy
- `research/stage3a/SPACING_AND_GRID.md` — Spacing scale and layout philosophy
- `research/stage3a/GALLERY_VISUAL_SYSTEM.md` — Gallery-specific visual rules
- `research/stage3a/IMAGE_PRESENTATION.md` — Image rendering and aspect ratio rules
- `research/stage3a/DISCOVERY_UI_SYSTEM.md` — Home/Archive/Places UI patterns
- `research/stage3a/ACCESSIBILITY_VISUAL_RULES.md` — Accessibility-integrated visual rules
- `research/stage3a/INTERACTION_VISUAL_RULES.md` — Interaction and animation rules

### Supporting Evidence
- `research/stage3c/REAL_PHOTO_FIXTURE_MANIFEST.md` — 113 JPEG inventory
- `research/stage3c/REAL_PHOTO_EVALUATION_RESULTS.md` — Gate evaluation results
- `research/stage3c/IMPLEMENTATION_DEVIATIONS.md` — Deviations from stage 3B specs
- `prototype-stage3c/package.json` — Playwright-based deterministic capture tooling
- `prototype-stage3c/tools/content_model.py` — Content model source

---

**END OF FINAL DESIGN SPECIFICATION v1.0**

**Next phase:** Production Development — direct implementation against this canonical spec.  
**Gate discipline:** Do not introduce new gates (G8+), do not reopen G1-G7, do not redesign based on taste preferences.
