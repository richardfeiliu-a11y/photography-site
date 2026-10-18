# Stage 3C — Accessibility Verification

Status: **18/18 automated checks PASS** (Playwright, `prototype-stage3c/tools/a11y_check.js`, results in `prototype-stage3c/screenshots/a11y/a11y-results.json`). Evidence screenshots in `prototype-stage3c/screenshots/a11y/`. All checks run against the canonical site served at 127.0.0.1:8137; viewports: desktop 1440×900, mobile 390×844, narrow 320×740, zoom-equivalent 720×450.

Covers task item 44 in full. Accessibility failure is not overridden by visual preference (§44); the three implementation adjustments below were made *because* of this verification.

## 1. Results matrix

| # | Check (task §44) | Result | Measured evidence |
|---|---|---|---|
| 1 | Keyboard traversal | PASS | First Tab stop = skip link (`href="#main"`, visible at 8px/8px on focus); Enter moves focus to `#main` (`tabindex="-1"`). 8 consecutive Tab stops on Home traverse skip → site mark → nav ×3 → hero link → title link → View Gallery in DOM order. |
| 2 | Visible focus | PASS | `:focus-visible { outline: 2px solid #0B57D0; outline-offset: 3px }` — 8/8 consecutive tab stops measured `outline: 2px solid rgb(11,87,208)`. Evidence: `x-skip-focus-desktop.png`, `x-menu-open-mobile.png` (focus ring on "Places"). |
| 3 | Menu focus trap | PASS | 4 focusables (Close + Archive/Places/About); Tab cycles back to first; 6 additional Tabs never leave the layer (`aria-modal` dialog). |
| 4 | Overview focus trap | PASS | 9 focusables (Close + 8 ov-cells) cycle to first; no Tab leak across 9 presses. |
| 5 | Escape | PASS | Escape closes both layers from any focus position. |
| 6 | Focus restoration | PASS | After Escape, `document.activeElement` = invoker (`menu-btn` / `overview-btn`). Programmatic cell-jump closes without stealing focus (`close(false)`). |
| 7 | Minimum targets | PASS | Mobile: menu links 53px, Close 52px, Menu button 53px (≥44px, WCAG 2.5.5). Overview cells ≥111px edge at 390px (3-col gap 8). |
| 8 | 200% zoom | PASS | 200% browser zoom ≡ 720×450 CSS layout viewport; gallery, home, long-title pages all `scrollWidth 720 ≤ 720` — vertical scroll only. Evidence: `x-home-zoom-200.png`, `x-gallery-zoom-200.png`, `x-long-title-zoom-200.png` (+ 1440 baselines). |
| 9 | 320 px reflow | PASS | 5 page types (home, archive, gallery, long-title gallery, about) reflow at 320×740 with `scrollWidth ≤ 320`. Evidence: `x-home-narrow-320.png`, `x-long-title-narrow-320.png`. |
| 10 | No horizontal overflow | PASS | Desktop 1440 (gallery), mobile 390 across 10 page types (home, archive, places index, Reine, Springfield-IL, 3 galleries incl. 72-frame, about): `scrollWidth ≤ clientWidth` everywhere. |
| 11 | Long titles | PASS | "Where the Road Gives Way to Water and the Mountains Take Back the Light" wraps to 3 lines within the 680px reading column at 1440, 390, 320, and 720 (zoom-equivalent). No clipping. Evidence: `x-long-title-desktop.png` + narrow/zoom shots. |
| 12 | CJK wrapping | PASS | Mixed-script h1 "滕王阁 · Tengwang Pavilion" 350px ≤ 390px; Chinese caption (`lang="zh"`, line-height 1.75) within mobile margins. Evidence: `x-cjk-mobile.png`. |
| 13 | Contrast | PASS | All measured pairs ≥ 4.5:1 (table §2). |
| 14 | Reduced motion | PASS | `@media (prefers-reduced-motion: reduce)` zeroes layer transitions; JS close path completes synchronously under `reducedMotion: 'reduce'` (verified: layer hidden within 30ms of Escape). |

Structural bonus check: exactly one `<h1>` per page across all 7 page types; heading levels do not skip.

## 2. Contrast (measured computed colors, WCAG ratios)

| Pair | Foreground | Background | Ratio | Required | Result |
|---|---|---|---|---|---|
| Site mark / body text (primary) | `#1A1A18` | `#F6F4EF` canvas | 15.86:1 | 4.5 | PASS |
| Secondary meta (13px) on canvas | `#5F5E59` | `#F6F4EF` | 5.91:1 | 4.5 | PASS |
| Secondary on raised backing (mobile position) | `#5F5E59` | `#EFECE5` | 5.51:1 | 4.5 | PASS |
| Place region (14px) on canvas | `#5F5E59` | `#F6F4EF` | 5.91:1 | 4.5 | PASS |

Focus color `#0B57D0` on canvas = 5.81:1 (non-text UI indicator, ≥3:1 required — PASS). Hairline `#D4D0C7` is decorative only (rules, underline decoration) and carries no information alone.

## 3. Adjustments made during this verification

All are accessibility-driven, recorded here and in `IMPLEMENTATION_DEVIATIONS.md`; none alter frozen visual parameters:

1. `<main id="main" tabindex="-1">` + `main:focus { outline: none }` — programmatic skip-link target must be focusable without rendering a focus ring.
2. `.menu-links a` padding-block 8px → 12px — raises link hit height to ≥44px; visual gap unchanged (48px grid gap dominates).
3. `.close-btn` hit area: `padding: 13px 20px; margin: 0 -20px` — ≥44×44 target while glyph position stays at the frozen 20px frame edge.

## 4. Known non-issues (documented)

- Skip link is the only element before the header in tab order; footer links are reachable and visible.
- Overview/Menu use `role="dialog" aria-modal="true"` with a manual focus trap (no `inert` on background); background scroll locked while open.
- Position annotation `n / total` is `aria-hidden` (decorative repetition of Overview state).
- 200% zoom verified via layout-equivalent 720×450 viewport (CSS pixels halved); true pinch-zoom not applicable to a desktop prototype.
