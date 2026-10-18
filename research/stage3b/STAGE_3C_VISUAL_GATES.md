# Stage 3B — Stage 3C Visual Gates

Status: **the only questions Stage 3C may decide by visual prototype**. Seven gates, all bounded. Stage 3C must not reopen anything else and must not run open-ended exploration. Each gate: run captures → apply decision rule → record the frozen result in the Stage 3C decision log.

Everything not listed here is already specified in the page specs and must be implemented faithfully.

---

## G1 — Font pairing + CJK metrics

**Question:** Which exact display serif + utility sans pair (with CJK companions) carries all roles without metric or mixed-script failure?

**Recommended starting state:** Source-family route — Source Serif–class display + Source Sans–class utility, Source Han Serif/Sans for CJK. System fallback stacks per Stage 3A.

**Comparison if needed:** at most one alternative route (Noto-family route) if the starting pair fails listed cases. Editorial open-source route only if both fail and a conflict is recorded. Font **brands are not frozen until a candidate passes all cases**.

**Frozen variables:** two families only (serif + sans); role table and size ranges; weights; no all-caps labels; CJK line-height ranges; no third/mono family; all-sans fallback is the last-resort reversible option.

**Required real-photo fixtures:** F02 dark, F01 bright, F04 saturated, F09 B&W; short Gallery, 72-Photo Gallery, Chinese title, mixed-script title, 3-line caption, Chinese caption.

**Desktop/mobile captures:** Gallery header (short/long/Chinese/mixed titles), `2018–2024` and `72 / 72` strings, captions 1-line and 3-line, 200% zoom, mobile Menu, Archive card metadata.

**Pass/fail criteria:** PASS = the same candidate renders all cases with stable baselines, no glyph fallback holes, readable small sizes, no theatrical look beside real photos, CJK titles receive the deliberate serif fallback. FAIL = any case clips, jumps baseline, or falls back to arbitrary system glyphs.

**Decision rule:** first candidate passing every case is frozen. If the starting pair fails, test the one allowed alternative. If both fail, record a conflict and apply the all-sans fallback with weight/spacing differentiation; do not improvise per-language font collections.

---

## G2 — Canvas warmth + focus color

**Question:** Do the palette targets survive real photography, and at what exact values?

**Recommended starting state:** Canvas `#F6F4EF`, Primary `#1A1A18`, Secondary `#5F5E59`, Raised `#EFECE5`, Hairline `#D4D0C7`, Strong neutral `#34332F`, Focus `#0B57D0`.

**Comparison if needed:** lightness steps only (e.g. canvas ±1–2 steps toward cooler/warmer neutral) when a listed failure appears; focus adjusted within restrained blues only if contrast fails.

**Frozen variables:** role structure (no new roles), no decorative accent, no dark mode, contrast policy 4.5:1 / 3:1, “adjust lightness first, never add a hue.”

**Required real-photo fixtures:** F01 high-key (edge disappearance), F02 dark, F09 B&W (palette must not look colored), F04 saturated (cast check against warm canvas).

**Desktop/mobile captures:** Gallery with each fixture; card grids with mixed covers; Overview and Menu layers as full neutral surfaces; focus perimeter over canvas, raised surface, and beside images; forced-colors check.

**Pass/fail criteria:** PASS = canvas does not read beige beside neutral-white photos; no visible cast on color-heavy work; edges of high-key images remain legible (with optional 1 px edge aid); all measured pairs meet contrast policy. FAIL = perceptible tinting, merged edges without the permitted aid, or failed contrast.

**Decision rule:** keep starting values unless a capture fails; on failure adjust lightness in minimal steps and re-measure. Freeze final hex values with measurements recorded.

---

## G3 — Home hero scale + Featured/Recently added cue

**Question:** What exact hero proportion works with real covers, and does the plain-text cue read clearly without disturbing date hierarchy?

**Recommended starting state:** hero cover at content-frame width (≤ ≈1400 px) with ≈72–78svh desktop soft ceiling; mobile full-width landscape capped ≈60svh, portrait ≤ ≈70svh; cue as metadata-role plain text first line above the photographed date.

**Comparison if needed:** one step taller or shorter hero (within no-full-bleed bounds) only if first-viewport balance fails with real covers; cue placement unchanged unless unreadable.

**Frozen variables:** no viewport full-bleed, no overlay text, cover complete frame, cue is plain text (no badge/chip/pill), photographed date remains the prominent historical line, hierarchy Photo > title > metadata.

**Required real-photo fixtures:** F01 bright cover, F02 dark cover, F06 portrait cover, panorama cover if available; long English title; Chinese title; backfilled older work (“Recently added” case).

**Desktop/mobile captures:** Home top at 1440 and 390 for each cover class; cue legibility at both sizes; scroll distance from first viewport to title/metadata.

**Pass/fail criteria:** PASS = cover dominates, title/metadata reachable within one short scroll, cue clearly reads as publication state not photographed time, no cover cropped or overlaid. FAIL = hero overwhelms or underwhelms, cue competes with date, or cover reads cropped.

**Decision rule:** keep starting proportions unless a capture fails; then test the single allowed adjacent proportion and choose the one where title reachability and dominance both hold. Freeze the chosen hero ceiling and mobile cap.

---

## G4 — Long Gallery Base spacing

**Question:** Does the Base rhythm hold across a 72-Photo Gallery without blank-scroll fatigue?

**Recommended starting state:** Base 96 px desktop / 64 px mobile, constant through the sequence; caption gap 16 px; Compact/Breathing only editorially.

**Comparison if needed:** desktop Base stays 96 unless evidence is overwhelming; mobile Base may be tuned within **56–64 px** only.

**Frozen variables:** three-state system; Base is default; orientation never selects rhythm; no count-based compression; no rhythm algorithm.

**Required real-photo fixtures:** the 72-Photo mixed-orientation Gallery (S09), captioned and uncaptioned stretches, portrait→landscape transitions.

**Desktop/mobile captures:** long Gallery top / mid / end at 1440 and 390; full traversal impressions; adjacent-image relationship reads.

**Pass/fail criteria:** PASS = sequence reads continuously, gaps feel intentional, no “lazy-loading hole” impression, end still reachable without exhaustion. FAIL = whitespace dominates photographs (fatigue) or images collide into feed density.

**Decision rule:** if PASS, freeze 96/64. If mobile fatigue is evident, test mobile Base 56 and choose the larger value that still removes the fatigue; record the exact mobile value. Desktop changes require a recorded conflict, not taste.

---

## G5 — Mobile current-position strategy

**Question:** Can the persistent mobile `n / total` annotation coexist with real photographs, or must it fall back inline?

**Recommended starting state:** persistent low-weight annotation at the safe trailing edge, minimal raised-neutral backing, inset from safe areas; utility sans 12–13 px, secondary color, tabular numerals.

**Comparison if needed:** A/B against the inline fallback (counter attached to the active Photo block, same styling).

**Frozen variables:** format `n / total`; non-interactive; no pill/progress bar/arrows/slideshow bar; yields at header and continuation; never covers caption or system gestures.

**Required real-photo fixtures:** edge-to-edge bright landscape (A08), edge-to-edge dark landscape (A09), portrait ≤82svh, dense composition (meaningful content near edges), 72-Photo Gallery positions L01/L47/L72.

**Desktop/mobile captures:** mobile captures only decide this gate; desktop margin annotation is captured for parity but not in question.

**Pass/fail criteria:** PASS (persistent) = annotation legible on canvas/raised backing and never obscures meaningful image content, caption, or gesture zones across all fixtures. FAIL = any fixture where it covers content or becomes illegible.

**Decision rule:** persistent wins only on a clean pass across every fixture; any conflict sends mobile to inline. Freeze exactly one form; the other is removed, not kept as an option.

---

## G6 — Overview mobile 3 vs 2 columns

**Question:** Does the 3-column mobile light table keep frames recognizable and targets operable with real photography?

**Recommended starting state:** 3 columns, 8 px gaps, ≈110 px cells at 390 reference.

**Comparison if needed:** 2 columns (≈160 px cells) as the frozen fallback candidate.

**Frozen variables:** contained uncropped thumbnails; authored order; current marker system; opaque neutral layer; no captions/filters; Close text control; subordination to sequence.

**Required real-photo fixtures:** portrait-heavy sequence, landscape-heavy sequence, dark + bright thumbnails, dense composition thumbnails, 72-Photo Gallery at current L47.

**Desktop/mobile captures:** mobile 3-col and 2-col grids for each fixture class; marker visibility; touch-target spacing; current-at-L47 opening region.

**Pass/fail criteria:** PASS (3) = photographs recognizable at thumbnail scale across fixture classes, adjacent targets never overlap, targets ≥ 24×24 with 44 px aim satisfied by gaps/hit extension. FAIL = recognition collapses or targets conflict.

**Decision rule:** 3 columns wins on a clean recognition + target pass; otherwise freeze 2. Exactly one column count ships.

---

## G7 — Continuation pause + Next-title weight

**Question:** What end-pause distance and Next-title typographic weight make the authored end clear without feed styling?

**Recommended starting state:** end pause 168 px desktop / 112 px mobile; `End of {Gallery title}` metadata styling; Next title serif 26–30 px desktop / 20–24 px mobile; Back link below at L gap; no metadata, no cover.

**Comparison if needed:** pause within Frozen ranges only — desktop 144 vs 168 vs 192, mobile 96 vs 112 vs 128; Next-title weight among card role ↔ between roles ↔ H1-leaning (never boxed, never with cover).

**Frozen variables:** text-led continuation; no cover in MVP; end label exists; hierarchy End label → Next primary → Back secondary; no-next variant; no recommendation styling; appears only after the true final Photo.

**Required real-photo fixtures:** final Photo portrait with 3-line caption (S10), final Photo dark landscape, final Photo bright landscape; next Gallery with long title and Chinese title.

**Desktop/mobile captures:** end state at 1440 and 390 for each final-Photo class; no-next state; direct-entry state.

**Pass/fail criteria:** PASS = end reads authored and final, continuation reads editorial (not recommendation), caption never crowded, pause not mistaken for broken loading. FAIL = continuation attaches to caption, feels like a feed, or the pause reads as an error.

**Decision rule:** keep starting values unless a capture fails; then test the bounded adjacent options and freeze the smallest pause and quietest title weight that still pass end-recognition. Record both frozen numbers.

---

## Gate discipline

- No new gates without a discovered genuine conflict documented per `STAGE_3B_DECISION_LOG.md` rules.
- Every gate result is recorded with fixture list, captures, and decision rule outcome before it counts as frozen.
- Gates decide values; they never reopen Stage 2B behavior or Stage 3A system structure.
