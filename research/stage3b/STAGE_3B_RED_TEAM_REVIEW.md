# Stage 3B — Red Team Consistency Review

Role: independent Stage 3B consistency reviewer. Scope: verify that Stage 3B faithfully applies the frozen Stage 2B product system and the frozen Stage 3A visual system. No redesign, no aesthetics, no reopening of Stage 2B/3A. Date: 2026-08-27.

## Inputs read

Stage 3B (all 15 files): `STAGE_3B_SUMMARY.md`, `PAGE_SYSTEM.md`, `IMPLEMENTATION_HANDOFF.md`, `STAGE_3B_DECISION_LOG.md`, `HOME_DESIGN_SPEC.md`, `ARCHIVE_DESIGN_SPEC.md`, `PLACES_INDEX_DESIGN_SPEC.md`, `PLACE_PAGE_DESIGN_SPEC.md`, `GALLERY_DESIGN_SPEC.md`, `OVERVIEW_DESIGN_SPEC.md`, `ABOUT_DESIGN_SPEC.md`, `MOBILE_NAV_DESIGN_SPEC.md`, `SHARED_COMPONENT_RULES.md`, `REAL_PHOTO_TEST_MATRIX.md`, `STAGE_3C_VISUAL_GATES.md`.

Frozen boundary: `stage2b3/STAGE_2B_FINAL_DECISIONS.md`, `stage3a/STAGE_3A_SUMMARY.md`, plus detail files opened to verify suspected contradictions: `stage2b/INFORMATION_ARCHITECTURE.md`, `stage2b/DECISION_LOG.md`, `stage2b/CONTENT_MODEL.md`, `stage2b/MVP_SCOPE.md`, `stage2b/STAGE_2B1_SUMMARY.md`, `stage2b/STAGE_2B1_REVIEW_ADJUDICATION.md`, `stage2b2/TEST_2_PLACE.md`, `stage2b2/STAGE_2B2_SUMMARY.md`, `stage2b3/TEST_2_PLACE_DECISION.md`, `stage3a/TYPOGRAPHY_SYSTEM.md`, `stage3a/COLOR_SYSTEM.md`, `stage3a/SPACING_AND_GRID.md`, `stage3a/DISCOVERY_UI_SYSTEM.md`, `stage3a/GALLERY_VISUAL_SYSTEM.md`, `stage3a/OVERVIEW_VISUAL_SYSTEM.md`, `stage3a/IMAGE_PRESENTATION.md`, `stage3a/INTERACTION_VISUAL_RULES.md`, `stage3a/ACCESSIBILITY_VISUAL_RULES.md`.

## Issue A — Canonical Gallery URL drift (independently verified)

**Verdict: real frozen-boundary violation. CRITICAL. Accepted, corrected.**

Frozen evidence (Stage 2B, consistent across six+ files):

- `stage2b/INFORMATION_ARCHITECTURE.md` URL table: Canonical Gallery = `/galleries/{gallery-slug}`.
- `stage2b/DECISION_LOG.md` D14: "Every Gallery has one semantic canonical route `/galleries/{gallery-slug}`."
- `stage2b/STAGE_2B1_SUMMARY.md`: "Every Gallery has one canonical `/galleries/{gallery-slug}` URL."
- `stage2b/STAGE_2B1_REVIEW_ADJUDICATION.md` M4: accepted as already chosen and expensive to reverse.
- `stage2b2/PROTOTYPE_OVERVIEW.md`, `CONTENT_FIXTURES.md`, `STAGE_2B2_SUMMARY.md`: prototype implemented `/galleries/{slug}`.
- `stage2b3/STAGE_2B_FINAL_DECISIONS.md`: "Canonical Gallery URL and stable Photo identity" frozen after B2.

Stage 3B violation: `IMPLEMENTATION_HANDOFF.md` Required routes table listed `/gallery/{gallery}` labeled "canonical Gallery URL". No Stage 2B2/2B3/3A document authorizes any URL change (full-corpus grep confirms `/gallery/` appears nowhere in frozen sources). This is not a naming preference: canonical identity is a frozen IA decision, and Stage 3C would have built the prototype on the wrong identity.

**Correction (smallest possible):** `IMPLEMENTATION_HANDOFF.md` route restored to `/galleries/{gallery-slug}`. No other Stage 3B file carried the drifted URL (verified by grep), so one line suffices.

## Issue B — Places Index metadata promoted without authorization (independently verified)

**Verdict: improper promotion of optional candidates to MVP baseline. IMPORTANT. Accepted, corrected.**

Frozen evidence:

- `stage2b/INFORMATION_ARCHITECTURE.md` (Places index role): "MVP requires only Place name and contextual country/region disambiguation when needed. Representative cover, Gallery count, and photographed year span are optional presentation candidates, not required Place fields."
- `stage2b/STAGE_2B1_REVIEW_ADJUDICATION.md` M7: "Cover/count/year span remain optional B2 presentation candidates rather than mandatory fields."
- `stage2b2/TEST_2_PLACE.md`: "Places index outside this page is name-only in the prototype baseline; optional cover/count/year-span decorations are not added."
- `stage2b3/TEST_2_PLACE_DECISION.md`: "Which metadata—cover, date range, count—real users rely on most" is explicitly **not validated**.
- `stage3a/DISCOVERY_UI_SYSTEM.md`: "Optional representative cover, Gallery count, or photographed year span may be used **only if Stage 3B demonstrates that it improves scanning at actual scale**. They are not mandatory fields."

Stage 3B violation: `PLACES_INDEX_DESIGN_SPEC.md` put count + year span into the default content order, the default metadata line, and declared "MVP baseline: name + region + Gallery count + year span"; decision B10 did the same. No evidence record demonstrates scanning improvement at actual scale, and no gate or discovered-issue entry was opened. The representative cover was correctly kept as candidate — count/span were not.

**Classification rationale:** IMPORTANT rather than CRITICAL because it does not alter IA, entities, routes, or mandatory fields' existence — it silently converts presentation candidates into default shipped content against an explicit evidence gate.

**Correction (smallest possible):** `PLACES_INDEX_DESIGN_SPEC.md` restored to the frozen baseline — MVP = name + region (when disambiguating); count/year span returned to optional presentation candidates, not rendered, evidence-first admission only (styling kept conditionally so admission stays cheap); decision B10 rewritten with an explicit correction note; `STAGE_3B_SUMMARY.md` line updated. `REAL_PHOTO_TEST_MATRIX.md` and `STAGE_3C_VISUAL_GATES.md` contain no Places Index count/span dependencies (verified), so no further files required changes.

## Issue C — Spacing composite wording contradicted its own page specs (found by this review)

**Verdict: internal Stage 3B inconsistency. MINOR. Accepted, corrected.**

`PAGE_SYSTEM.md` stated: "composites `XXL + XL = 144` and mobile `XL + M = 64` are allowed" — an exhaustive-looking list. But `GALLERY_DESIGN_SPEC.md`, Gate G7, and the SUMMARY use end pauses 168 px (XXL+XL+L) and 112 px (XL+XL+M), which the wording appeared to forbid ("No page invents its own spacing values outside this scale"). Stage 3A `SPACING_AND_GRID.md` actually allows any "explicit composition of existing steps" (its examples are illustrative: "such as"). Both 168 and 112 sit inside the frozen Breathing-plus ranges (144–192 / 96–128).

**Correction:** `PAGE_SYSTEM.md` now states compositions of existing steps are allowed beyond XXL, citing 144, 64, 168, and 112. No value changed anywhere.

## Twelve-dimension audit results

| # | Dimension | Verdict | Evidence |
|---|---|---|---|
| 1 | Frozen product/IA drift | NO ISSUE (except A/B above) | No new entities/routes/nav items; Visit absent everywhere; Home algorithm, Overview-as-layer, continuation rules, Archive chronology all match frozen sources |
| 2 | Canonical URL drift | **CRITICAL → corrected** | Issue A |
| 3 | New mandatory metadata without authorization | **IMPORTANT → corrected** (Issue B); Gallery optional description (B03) verified lawful: `stage2b/CONTENT_MODEL.md` and `MVP_SCOPE.md` freeze a Gallery description field |
| 4 | New components/features | NO ISSUE | Overview grid icon pre-authorized (3A `GALLERY_VISUAL_SYSTEM.md`); 1 px edge aid authorized (3A `COLOR_SYSTEM.md`/`IMAGE_PRESENTATION.md`); `View Gallery` frozen from Stage 2B2 T1 prototype; two-column Places list marked visual implementation detail within "simple visual list" |
| 5 | Typography-role drift | NO ISSUE | Every page spec's sizes map onto the Stage 3A role table (Display 42–52/32–38; Index 36–44/30–36; H2 20–24/18–22; Card 19–24/18–22; Nav 16–18 menu; Meta 12–14/13–14; Caption 14–16; Body 17–19/16–18; Utility 12–13); site mark serif-vs-sans kept as G1-adjacent per 3A D13 |
| 6 | Card anatomy drift | NO ISSUE | `SHARED_COMPONENT_RULES.md` reproduces the frozen Cover→Title→Date→Place→Count order verbatim; Home/Archive/Place all reference the shared card with no variant |
| 7 | Color/accent/dark-mode drift | NO ISSUE | Palette hex values identical to 3A `COLOR_SYSTEM.md`; focus accent accessibility-only; dark mode prohibited in every spec; exact warmth correctly labeled G2-gated |
| 8 | Spacing-system drift | **MINOR → corrected** (Issue C); all section/rhythm values otherwise trace to the 3A scale and rhythm tables |
| 9 | Gallery/Overview/mobile behavior drift | NO ISSUE | Native vertical, `n / total` format, desktop margin annotation (3A decision), mobile persistent-first with G5 gate, three-rhythm system with Base default and orientation never selecting, Overview mechanics (authored order, marker, no route), edge-to-edge exception rules, portrait 80svh∈78–84 / mobile ≤82svh, end pause inside frozen ranges |
| 10 | Prototype-gated values mislabeled Frozen | NO ISSUE | All "Frozen" labels trace to Stage 2B/3A sources; gated items (G1–G7, canvas exact hex, hero scale, cue, mobile position form, Overview mobile columns, continuation pause/weight) all correctly labeled Recommended/starting |
| 11 | Optional candidates promoted to MVP requirements | **IMPORTANT → corrected** (Issue B); Home cue verified authorized (Stage 2B final decisions allow the cue; G3 gates it); representative cover correctly stays candidate |
| 12 | Page rules contradicting PAGE_SYSTEM.md | NO ISSUE after Issue C fix | Page header spacing, leading-edge alignment, frame widths, mobile margins, link/focus and motion rules consistent across all eight page specs |

Additional checks that passed: Overview header availability while grid scrolls (authorized by 3A `OVERVIEW_VISUAL_SYSTEM.md`); visited-state suppression marked Recommended with conflict-revisit path (no frozen rule contradicted); Menu current-destination indication (frozen by 3A `INTERACTION_VISUAL_RULES.md`); alphabetical Places ordering (permitted by Stage 2B IA at scale, framed as starting value); Overview desktop 6-with-5-stress (inside frozen 5–6 range, B06 recorded); G4 mobile bound 56–64 treated as a gated comparison bound within Stage 3A's "about 64 px" latitude (no correction needed).

## Corrections applied (files changed)

| File | Change |
|---|---|
| `IMPLEMENTATION_HANDOFF.md` | Route restored: `/gallery/{gallery}` → `/galleries/{gallery-slug}` (frozen Stage 2B) |
| `PLACES_INDEX_DESIGN_SPEC.md` | Count/year span removed from content order, metadata line, typography line, edge cases, starting-values table, and baseline statement; returned to optional candidates with evidence-first admission; prohibition list updated |
| `STAGE_3B_DECISION_LOG.md` | Decision B10 rewritten to the frozen baseline with an explicit red-team correction note |
| `PAGE_SYSTEM.md` | Spacing composite rule aligned with Stage 3A (compositions of existing steps allowed beyond XXL; 168/112 cited) |
| `STAGE_3B_SUMMARY.md` | Places Index line corrected; red-team review section added; final status updated |

No v2/final copies created; all corrections are in-place edits of canonical files. No design alternatives proposed.

## Cross-file consistency check (post-correction)

- Canonical URL: grep confirms `/galleries/{gallery-slug}` is now the only Gallery route in Stage 3B; matches Stage 2B IA table, decision D14, 2B2 fixtures/summary, and 2B3 final decisions. PASS.
- Places Index baseline: content order, desktop anatomy, typography, metadata placement, edge cases, starting-values table, baseline block, gated-values section, prohibition list, decision B10, and SUMMARY now all state name + region-only baseline with count/span/cover as unadmitted candidates; matches Stage 2B IA L107–108, M7 adjudication, 2B2 T2 name-only prototype, and 3A DISCOVERY rule. PASS.
- Spacing composites: PAGE_SYSTEM, GALLERY_DESIGN_SPEC (168/112), Gate G7 (144/168/192 · 96/112/128), and SUMMARY now agree; all within Stage 3A Breathing-plus frozen ranges. PASS.
- No stale references: no remaining "count · year span" default-order text anywhere in `research/stage3b/` (grep-verified); no remaining `/gallery/` route reference (grep-verified).
- Gate set unchanged: exactly seven gates; no gate gained or lost scope. PASS.
- No new routes/entities/metadata introduced by the corrections; corrections only remove unauthorized additions. PASS.

## Final canonical states

- Gallery canonical route: `/galleries/{gallery-slug}` (frozen, Stage 2B).
- Places Index MVP baseline: Place name + contextual disambiguation when needed; text only; Gallery count, year span, representative cover = optional presentation candidates, not rendered, evidence-first admission only.
- Gallery end pause: 168 px desktop / 112 px mobile starting values, explicit compositions of the frozen scale, inside frozen Breathing-plus ranges, gated by G7.
- Everything else: unchanged from the Stage 3B checkpoint state.

## Final gate

**B. Minor corrections applied — Ready for Stage 3C.**

All three accepted issues received smallest-possible corrections in canonical files; the post-correction cross-file consistency check passes; no frozen boundary remains violated.
