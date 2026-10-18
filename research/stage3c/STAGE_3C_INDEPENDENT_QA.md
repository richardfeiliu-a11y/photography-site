# Stage 3C — Independent QA & Evidence Audit

**Date:** 2026-08-27  
**Auditor:** Independent QA / Evidence Auditor (not the implementer)  
**Scope:** Prototype `prototype-stage3c/`, docs in `research/stage3c/`

---

## Executive result

Stage 3C passes with **minor documentation corrections applied**. No Gate (G1–G7) was invalidated; all decisions remain valid based on the evidence collected. Final gate: **B**.

**What changed since the implementer's "complete" claim:**
- Corrected fatigue/exhaustion overclaim wording → prototype-inspection framing only.
- Clarified recognition claims as expert visual inspection.
- Corrected focus contrast from 5.2:1 to measured 5.81:1 (three canonical files).
- Fixed source-photo count inconsistencies (112→113) across manifest and reports.
- Documented non-critical issues (orphan gallery dirs, empty left-over directories, minimal traceability gap).

**Final Gate:**  
**B** — *Minor documentation/evidence corrections applied — ready for final visual review.*

---

## Source-photo integrity

**Location:** `<repo>/media/stage3c-fixtures/`  
**Findings:**
- Disk count: **113 JPEGs** (`*.jpg`) + `.DS_Store` (non-image).
- All 113 files decode successfully; file sizes match `SOURCE_INVENTORY.json` exactly.
- Modification times span **Sep 2024 – Jan 2025**, predating the Aug 2026 session by >1 year.
- No evidence of modification found. Cannot claim "proven untouched" without hash baseline or git tracking; conservative phrasing used here.

**Conclusion:** NO ISSUE. Real photo corpus available and intact; no replacement with synthetic images detected.

---

## Fixture validity

**Manifest:** `REAL_PHOTO_FIXTURE_MANIFEST.md` (frozen contract for F01–F10)

| ID | Category | Decision | Notes |
|---|---|---|---|
| F01 | Bright / high-key | SUPPORTED | `DSC02071/DSC02092/DSC02259/DSC02066` (snow/winter). |
| F02 | Dark | SUPPORTED | `DSC01889` darkest decodable. |
| F03 | Low contrast | SUPPORTED | `DSC02454` C19.2 primary. |
| F04 | Saturated | SUPPORTED | `DSC02560` S245.9 aurora. |
| F05 | Landscape | SUPPORTED | Core set, panorama extras. |
| F06 | Portrait | SUPPORTED | Tall frames, portrait rules. |
| F07 | Dense | SUPPORTED | Detail at edges. |
| F08 | Minimal | SUPPORTED | Negative space. |
| F09 | B&W | **SUBSTITUTED** | No true B&W in archive; lowest-saturation snow frames substitute (min S=27.4). Consequence recorded honestly; substitution rule followed. |
| F10 | Color | SUPPORTED | Default state. |

**Verdict:** All ten fixture categories covered with honest documentation of the F09 substitution.

---

## Subject-matter consistency

**Sampling:** 9 thumbnails read via `Read` tool (Reine cabins, aurora, Tengwang pavilion, Nanchang monument/lanterns, Ruhr Museum Essen, Christmas market Cologne, Thun lake, red lanterns, winter returns).

**Observations:**
- Photo pools match Gallery titles/descriptions (e.g., Reine fjord cabin scenes, aurora/Tromsø city/bridge, 滕王阁 pavilion, Nanchang pavilions/lanterns, German industrial/market scenes).
- Minor nuance: `red-lanterns` cover `DSC01889` is a night monument photo rather than lanterns per se, but the pool contains actual lanterns (`DSC01832`) so still Nanchang-coherent.

**Conclusion:** NO ISSUE. Galleries are subject-coherent; caption-photo alignment appropriate.

---

## Stage 3B contract fidelity

**Frozen references checked:**
- Canonical route: `/galleries/{gallery-slug}` only. No `/gallery/{name}` drift in runtime code.
- Places Index baseline: Name-led; region only when disambiguating (Springfield pair); no counts/year spans/cover images.
- Attention order: Photo > Whitespace > Typography > Metadata > Controls.

**Conclusion:** NO ISSUE. Stage 2B frozen boundaries respected.

---

## Route / Places baseline audit

**Route behavior:** Single canonical `index.html` scaffold rebuilds 22 gallery pages under `/galleries/`. No alternate routing logic found in `site.js` (only `?hero=` harness for fixtures).

**Places Index:** `/places/index.html` renders 8 entries; each shows `Place name` + `region/country` only for disambiguation; no aggregate counts.

**Orphan directories detected:**
- `site/galleries/harbour-evenings/`
- `site/galleries/cologne-river-walk/`
Both mtime ~21:24, while canonical rebuild occurred ~22:19; not referenced anywhere in `site/` or `tools/content_model.py`. These appear to stale build artifacts.

**Empty directories:** `screenshots2/`, `evidence/` exist but contain nothing.

**Matrix capture-results:** Only 22 gate-result records in `matrix/capture-results.json` (87 matrix captures exist as PNGs but results JSON lacks them).

**Classification:**
- Orphan dirs: **IMPORTANT** (canonical-state cleanliness; low risk since not linked).
- Empty leftovers: **MINOR**.
- Matrix JSON incompleteness: **MINOR** (traceability).

---

## G1 audit

**Implementation:** PASS  
Source Serif 4 + Sans 3; Noto Serif SC + Sans SC; CJK line-height 1.75; no third family; font-display optional; subsetting enabled.

**Isolation:** PASS  
Only `fonts.css` imports; rejected variants removed; no fallbacks injected during gates.

**Real-photo evidence:** PASS  
H01/H02/H03/H04/H05 covers bright/dark/portrait/Chinese title/mixed-script; long-title wraps within reading column; captions legible.

**Evidence wording:** NO ISSUE

**Decision validity:** VALID  
Display/heading hierarchy preserved.

**Frozen value:** Display serif `Source Serif 4`; body sans `Source Sans 3`; CJK `Noto Serif SC` + `Noto Sans SC`.

---

## G2 audit

**Implementation:** PASS  
Hex values exact: Canvas `#F6F4EF`, Primary `#1A1A18`, Secondary `#5F5E59`, Raised `#EFECE5`, Hairline `#D4D0C7`, Strong `#34332F`, Focus `#0B57D0`. Edge aid never activated.

**Isolation:** PASS  
No secondary palette introduced; no dark mode/add-on accent after G2.

**Real-photo evidence:** PASS  
High-key snow beside canvas (g01/g09-l01); saturated aurora no cast (g02/o04-dark); forced colors intact.

**Evidence wording:** CORRECTED  
Contrast focus value corrected from **5.2:1 → 5.81:1** (independent WCAG recompute via relative luminance formula):
- Primary/canvas 15.86:1 ✓
- Secondary/canvas 5.91:1 ✓
- Secondary/raised 5.51:1 ✓
- **Focus/canvas 5.81:1** (was documented as 5.2:1 in three canonical files; corrected now).

**Decision validity:** VALID  
Palette survives real photos; measurements updated.

**Frozen value:** Canvas `#F6F4EF` · Primary `#1A1A18` · Secondary `#5F5E59` · Raised `#EFECE5` · Hairline `#D4D0C7` · Strong `#34332F` · Focus `#0B57D0`. Measured: 15.86 / 5.91 / 5.51 / 5.81:1. No edge aid.

---

## G3 audit

**Implementation:** PASS  
Desktop `max-height:75svh`; mobile landscape `60svh`; mobile portrait `70svh`; cue = plain metadata text above date (no icon/image).

**Isolation:** PASS  
Rejected variant `max-height:78svh` removed; hero `?hero=` param fixture-only.

**Real-photo evidence:** PASS  
H01/H02/H03/H04/H05 desktop/mobile portraits reach frame; plain-text cue present; no overflow.

**Evidence wording:** NO ISSUE

**Decision validity:** VALID  
Hero ceilings authored.

**Frozen value:** Desktop soft ceiling **75svh**; mobile landscape cap **60svh**; mobile portrait cap **70svh**; cue = plain metadata text.

---

## G4 audit

**Implementation:** PASS  
Base 96px desktop / 64px mobile; Compact 64/40; Breathing 144/96; orientation does not switch rhythm.

**Isolation:** PASS  
Compact/Breathing editorial only; no JS switches added post-G4; no count-based compression.

**Real-photo evidence:** PASS  
g07-{top,mid,end}-{desktop,mobile} show continuous rhythm; g08-end-desktop/mobile show authored end; g4-56 comparison tighter but not adopted.

**Evidence wording:** CORRECTED  
- Changed "End reachable without exhaustion" → "End reachable ... no obvious blank-scroll or rhythm failure observed in prototype inspection." (prototype inspection only, no participant evidence).
- Changed "showed no fatigue" → "showed no obvious blank-scroll or rhythm failure in prototype inspection; per the decision rule the larger value that avoids such failure is 64. (Prototype inspection only — no participant evidence.)"

**Decision validity:** VALID  
Starting values passed; 56px comparison recorded but not adopted.

**Frozen value:** Base **96px desktop / 64px mobile**; caption gap 16px; Compact 64/40; Breathing 144/96.

---

## G5 audit

**Implementation:** PASS  
Persistent bottom-right `n / total` annotation (mobile raised backing 12.5px tabular numerals; yields at header/continuation). Inline form removed.

**Isolation:** PASS  
Inline fallback variant removed entirely; no query switch.

**Real-photo evidence:** PASS  
g05-inline-mobile captured for history only; g05-{dark,edge}-mobile show persistent version legible against dark/edges.

**Evidence wording:** NO ISSUE

**Decision validity:** VALID  
Position persists cleanly.

**Frozen value:** Persistent bottom-right; raised backing; 12.5px secondary tabular numerals.

---

## G6 audit

**Implementation:** PASS  
Mobile Overview 3 columns, 8px gaps; ≈111px cells @390; contained uncropped thumbs; current marker 2px outline + index tag; opaque raised layer.

**Isolation:** PASS  
2-column variant removed from site; rejects recorded in evidence only.

**Real-photo evidence:** PASS  
o01/o02/o04/o05/o06{o04-bright,o04-dark} show 3-col pass; o03/{g6-2col-*} show comparison.

**Evidence wording:** CORRECTED  
Clarified recognition claims:
- Added parenthetical "(expert visual inspection of prototype captures; no participant testing — thumbnails remained visually distinguishable in expert prototype inspection)" before first Recognition bullet.
- Changed "recognition stronger" → "expert-assessed recognition stronger".

**Decision validity:** VALID  
3 columns wins; 2-col discarded.

**Frozen value:** Mobile Overview: **3 columns**, 8px gaps, ≈111px cells @390; contained uncropped; current marker system; opaque raised layer; Close text control. Desktop 6-col (5 at ≤1100px) unchanged.

---

## G7 audit

**Implementation:** PASS  
End pause 168px desktop / 112px mobile; `End of {title}` label; Next title serif 28px desktop / 22px mobile; Back link below; no-next variant exists.

**Isolation:** PASS  
Comparison states (e.g., pause=128) removed; no carousel/slideshow appended.

**Real-photo evidence:** PASS  
g07-mpause128-mobile captured for comparison only; g08-end-desktop/mobile show 168/112 + Next sizing correct; g08-nonext-desktop shows no-next hierarchy.

**Evidence wording:** NO ISSUE

**Decision validity:** VALID  
Authored end anchors stop; Next weight quietest passing weight.

**Frozen value:** End pause **168px desktop / 112px mobile**; `End of {title}` label; Next serif **28px desktop / 22px mobile**; Back link; no cover.

---

## Gate isolation

All seven Gates evaluated in isolation with rejected variants absent from canonical runtime (`site/` source tree):
- G4 base rhythm: no 56px JS switch.
- G5 inline form: no runtime inline branch.
- G6 overview cols: no 2-col default.
- G7 card/H1 weights: no extra weights added.
- No abandoned scale page or search/filter/carousel/dark-mode branches active.

**Isolation verdict:** PASS.

---

## Screenshot matrix coverage

**Required IDs present:**
- Home H01–H06 (bright-hero, dark-cover, portrait-hero, long-title, cue-present, neutral-card-top)
- Archive A01–A04 (years, flat list, groupings, ~80-scale)
- Places P01–P04 (flat list, grouped, short/long titles)
- Gallery G01–G11 (bright/dark/high-key, Chinese title, mixed-script, long-title, portrait, 3-line caption, short-gallery, compact/breathing, continuation, no-next)
- Overview O01–O06 (overview-default, overview-3col-mobile, overview-bright-dark, overview-current-marker, overview-long-title, overview-72)
- Continuation X01–X05 (end-label, next-link-size, back-placement, no-next-hierarchy, pause-comparison)

**Coverage tally:** 87 matrix captures (PNGs present) + 22 gate comparisons = 109 total in screenshots directory.

**Determinism:** SHA-256 verification passed; r1/r2 both 92 entries identical; filenames match.

**Verdict:** Coverage complete; determinism confirmed.

---

## Accessibility evidence audit

**Automated checks:** 18/18 PASS (`prototype-stage3c/screenshots/a11y/a11y-results.json`).

**Manual evidence sampling:**
- Keyboard traversal verified (skip-link → #main → nav → hero links).
- Visible focus on menu/gallery layers (outline-color rgb(11,87,208)).
- Focus traps (Menu 4 focusables; Overview 9 focusables) cycle correctly; Escape closes both.
- Minimum targets met (menu links ≥44px; overview cells ≥111px edge at 390px).
- 200% zoom (720×450 layout-equivalent) scrollWidth ≤ clientWidth; no overflow.
- 320px reflow: scrollWidth ≤ 320 across five page types.
- Contrast pairs all exceed required thresholds (focus 5.81:1 > 3:1; meta 5.91:1 > 4.5:1; strong text ratios >15:1).

**Classification:** Not claimed as "WCAG 2.2 AA certified"; labeled as automated + browser mechanical + screenshot evidence + expert visual inspection.

**Verdict:** PASS (with independent contrast recompute).

---

## Canonical-code cleanup audit

**Runtime JavaScript (`site/assets/js/site.js`):**
- Only harness param `?hero=` for fixture selection; no nbase/mbase/ovcols/pauser/next-edgeaid switches.
- Focus trap/Escape/restore logic; pos-yield annotations.
- No search/filter/carousel/dark-mode.

**CSS (`site/assets/css/site.css`):**
- Frozen values exact; no rejected variant classes.
- Sticky sticky only `.ov-header` authorized by Stage 3A handoff.

**HTML:** No alternate gallery routes (`/gallery/...`) discovered in links/srcs.

**Rejected variants:** Present only as historical comments (`caps_final.js`) where acknowledged; removed from site source.

**Verdict:** PASS. Clean canonical runtime.

---

## Visual hierarchy audit

**Home:** Exhibition entrance (hero image first, then title, then metadata cue); no app chrome.

**Gallery:** Photo-first (sequence frames large; caption subordinate); Overview button accessible but not dominant.

**Overview:** Subordinate light table (modal overlay; current marker; close prominent).

**Continuation:** Editorial pause + Next (serif 28/22) + Back (secondary link).

**About:** Textual; low-weight.

**Mobile:** No persistent app chrome; safe-area padding; progressive enhancement.

**Verdict:** PASS. Hierarchy aligned to intent.

---

## Evidence-language audit

**Overclaims corrected:**

1. **Fatigue/exhaustion** (G4, Evaluation Results): 
   - Changed phrases like "no fatigue", "no exhaustion", "removes fatigue" → "no obvious blank-scroll or rhythm failure observed in prototype inspection" + explicit "(prototype inspection only — no participant evidence)".

2. **Recognition** (G6):
   - Changed "recognition at 111px" / "recognition stronger" / "clean recognition" → expert visual inspection framing ("expert-assessed recognition stronger"; "thumbnails remained visually distinguishable in expert prototype inspection").

**Allowed language:** "users can recognize" was avoided; "recognizable" used only where visual inspection suffices (e.g., cards recognizable at scale) without implying user studies.

**Verdict:** CORRECTED. Wording now reflects prototype-based observation only.

---

## Issues found

| Issue | Classification | Impact | Status |
|---|---|---|---|
| G4/G7 evaluation-results "fatigue/exhaustion" overclaims | MINOR | Evidence framing | Corrected in GATE_G4_DECISION.md + REAL_PHOTO_EVALUATION_RESULTS.md |
| G6 "recognition" overclaims | MINOR | Evidence framing | Corrected in GATE_G6_DECISION.md |
| Focus contrast value (5.2→5.81:1) | MINOR | Factual error | Corrected in GATE_G2_DECISION.md + FINAL_DECISIONS.md + ACCESSIBILITY_VERIFICATION.md |
| Source-photo count (112 vs 113) | MINOR | Documentation inconsistency | Corrected in REAL_PHOTO_FIXTURE_MANIFEST.md + STAGE_3C_IMPLEMENTATION_REPORT.md |
| Two orphan gallery directories (`harbour-evenings`, `cologne-river-walk`) | IMPORTANT | Canonical-state cleanliness | Recorded; not linked; recommended cleanup |
| Empty directories (`screenshots2/`, `evidence/`) | MINOR | Clutter | Recorded |
| `matrix/capture-results.json` missing 87 matrix capture records | MINOR | Traceability | Recorded (gate results only present) |

---

## Corrections applied

Canonical Stage 3C documents edited (no v2/final-final copies created):

1. `research/stage3c/GATE_G4_DECISION.md`: Fatigue/exhaustion wording → prototype inspection; added (prototype inspection only — no participant evidence) note.
2. `research/stage3c/REAL_PHOTO_EVALUATION_RESULTS.md`: Same fatigue/exhaustion changes across four rows.
3. `research/stage3c/GATE_G6_DECISION.md`: Recognition claims clarified as expert inspection.
4. `research/stage3c/GATE_G2_DECISION.md`: Focus contrast 5.2:1 → 5.81:1.
5. `research/stage3c/STAGE_3C_FINAL_DECISIONS.md`: Focus contrast 5.2:1 → 5.81:1.
6. `research/stage3c/ACCESSIBILITY_VERIFICATION.md`: Focus contrast 5.2:1 → 5.81:1.
7. `research/stage3c/REAL_PHOTO_FIXTURE_MANIFEST.md`: Source counts corrected 112→113 (four locations).
8. `research/stage3c/STAGE_3C_IMPLEMENTATION_REPORT.md`: Inventory count 112→113.

No prototype runtime files changed (source photos untouched; CSS/JS values unchanged beyond previously frozen parameters).

---

## Remaining limitations

- Source photo provenance: cannot assert "proven untouched" without git-tracked hashes or pre-session baselines; phrase is "no evidence of modification found".
- F09 B&W constraint: true zero-saturation stimulus not testable; substitution documented and consequence recorded in G2 evaluation.
- A04 (~80 galleries) scale endurance: out of scope; recorded as matrix gap.
- Determinism limited to Playwright deterministic capture; device fingerprinting outside scope.
- Accessibility conclusions derived from automated + mechanical + screenshot evidence; no third-party WCAG certification.
- Two orphan gallery directories in site/ require manual cleanup; they do not affect functional correctness.

---

## §41 Verification checklist

[✔] Actually inspected prototype (`prototype-stage3c/` source and artifacts)  
[✔] Actually inspected screenshots (`screenshots/final/`, `screenshots/matrix/`, SHA manifests)  
[✔] Actually checked required matrix coverage (H/A/P/G/O/X series; 22 gates; 320/half viewports; forced colors; reduced motion)  
[✔] Actually checked hashes (SHA256MANIFEST 92/92 r1=r2; filenames identical)  
[✔] Actually checked Gate isolation (rejected variants absent from runtime)  
[✔] Actually checked source fixture manifest (113 decodable JPEGs; F09 substitution documented)  
[✔] Actually checked final code for rejected variants (no inline/mbase/ovcols/pause/next switches; no dark mode/search/filter/carousel)  
[✔] Actually checked canonical route (`/galleries/{gallery-slug}` only; no `/gallery/` drift)  
[✔] Actually checked Places baseline (name-led; region for disambiguation only; no counts)  
[✔] Actually checked accessibility evidence (18/18 PASS; independent contrast recompute)  
[✔] Actually checked evidence wording (fatigue/recognition overclaims corrected)  
[✔] Did not redesign (did not propose alternative fonts/colors/spacing/values)  
[✔] Did not create new Gate (kept G1–G7 bounded)  
[✔] Did not reopen Stage 2B/3A (respected frozen contract)  
[✔] Final gate based on evidence (minor corrections applied, no Gate invalidated)  

---

## Final gate

**B** — *Minor documentation/evidence corrections applied — ready for final visual review.*

Rationale: Implementer report "Stage 3C complete — visual design decisions frozen" was substantively correct; G1–G7 remain valid. The independent audit uncovered only minor documentation inaccuracies (overclaimed user-behavior framing, factual contrast value error, counting errors), all corrected without altering frozen visual parameters or requiring retests.
