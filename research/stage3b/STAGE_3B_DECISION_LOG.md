# Stage 3B — Decision Log

Status: **Stage 3B application decisions**. These apply the frozen Stage 3A system to pages; they do not reopen Stage 2B or Stage 3A. Confidence describes evidence strength for this project, not universal design truth. Newly discovered issues must record: the visual issue, reason, why Stage 3A does not already resolve it, and whether it blocks Stage 3C — none were added beyond the inherited seven gates.

## B01 — Home hero starting proportion

**Decision:** Hero cover at content-frame width (≤ ≈1400 px) with ≈72–78svh desktop soft ceiling; mobile landscape capped ≈60svh, portrait ≤ ≈70svh; text below image, leading-edge aligned.

**Status:** Recommended starting specification → Gate G3.

**Source from Stage 3A:** no-full-bleed decision (D08); landscape width-led / portrait height-led philosophy; Home emphasis through cover scale.

**Reason:** Dominates the first viewport inside the frame while keeping title/metadata one short scroll away; works for landscape, portrait, and panorama covers.

**Trade-off:** Less cinematic impact than full-bleed; portrait heroes leave lateral canvas.

**Confidence:** Medium-high.

**Reversible:** Yes per media slot.

**Needs Stage 3C validation:** Yes — G3 with real covers.

## B02 — Archive grid density

**Decision:** 3 columns at 1440 reference; column gap 32 px; row gap 48–64 px; year heading → row 24 px; year → year 96 px; no hairline by default.

**Status:** Recommended starting specification (column count is the Frozen Stage 3A default).

**Source from Stage 3A:** Archive 3-column default; section rhythm table; year-heading language.

**Reason:** Keeps covers useful and metadata untruncated while year landmarks stay legible across long archives.

**Trade-off:** Longer page than denser grids; accepted — scanning cost is carried by landmarks.

**Confidence:** High.

**Reversible:** Yes within content-fit collapse rules.

**Needs Stage 3C validation:** Only via G1/G2 inheritance and scale fixtures (D05/D06), not as an A/B.

## B03 — Gallery header composition

**Decision:** On a ≈680 px reading column, leading edge: Back link → title (42–52 px serif) → metadata group (date, Place links) → optional short description (≤3 lines, caption/body role) → `Overview {count}`; header → first Photo 72 px desktop / 48 px mobile; header not sticky.

**Status:** Recommended starting specification; description treatment is the bounded application of the task's optional-description requirement.

**Source from Stage 3A:** Gallery entry/header composition and rhythm; reading-column philosophy.

**Reason:** Keeps the frozen order and hierarchy while giving authored context (when present) one disciplined home instead of a panel.

**Trade-off:** Optional description risks museum-panel drift; mitigated by 3-line cap and caption-role styling.

**Confidence:** High for order/gaps; medium for description cap.

**Reversible:** Yes.

**Needs Stage 3C validation:** Indirectly through G1 captures of header states.

## B04 — Desktop current-position placement

**Decision:** Persistent quiet annotation in the trailing outer margin beside the media frame, tracking the current Photo; utility sans 12–13 px secondary, tabular numerals; yields at header and continuation.

**Status:** Recommended starting specification.

**Source from Stage 3A:** D10 persistent margin annotation for desktop.

**Reason:** Desktop media frame leaves genuine outer margin; the annotation reads as a margin note, not chrome.

**Trade-off:** Narrow desktop widths reduce margin room; annotation may sit close to image edges.

**Confidence:** Medium-high.

**Reversible:** Yes; placement detail only.

**Needs Stage 3C validation:** Captured in G5 fixtures for parity, but desktop form is not the gated question.

## B05 — Mobile current-position starting mode

**Decision:** Recommended starting form = persistent low-weight trailing annotation with minimal raised-neutral backing and safe-area inset; fallback = inline counter attached to the active Photo block. Exactly one ships.

**Status:** Prototype-gated (G5) — not frozen.

**Source from Stage 3A:** D10 persistent-first with inline fallback.

**Reason:** Persistent orientation is the Stage 3A intent; backing solves legibility over bright/dark media if placement stays photo-safe.

**Trade-off:** Persistent annotation can conflict with edge-to-edge media or meaningful edge content — that is precisely what G5 tests.

**Confidence:** Medium.

**Reversible:** Yes between the two forms; format frozen.

**Needs Stage 3C validation:** Yes — G5 is decisive.

## B06 — Overview desktop column starting value

**Decision:** 6 columns at the 1440 reference with 12 px gaps and 48 px outer margin; 5 columns retained as the single stress option.

**Status:** Recommended starting specification.

**Source from Stage 3A:** D11 5–6 desktop columns chosen by smallest useful thumbnail.

**Reason:** Extent-establishment is Overview's first job; ≈214 px cells at 1440 remain recognizable for mixed orientations while keeping thumbnails clearly below sequence scale.

**Trade-off:** Portrait/dense thumbnails are smaller than at 5 columns; recognition must be verified.

**Confidence:** Medium.

**Reversible:** Yes within the frozen 5–6 range.

**Needs Stage 3C validation:** Yes — O01 capture; switch to 5 only on demonstrated recognition failure.

## B07 — Continuation starting pause and Next-title weight

**Decision:** End pause 168 px desktop (XXL+XL+L) / 112 px mobile (XL+XL+M); `End of {Gallery title}` in metadata styling; Next title serif 26–30 px desktop / 20–24 px mobile; Back link at L below; no metadata, no cover.

**Status:** Recommended starting specification → Gate G7.

**Source from Stage 3A:** Breathing-plus end pause ranges (144–192 / 96–128); text-led continuation; D12.

**Reason:** Composite values sit inside frozen ranges and are composed from the existing spacing scale, avoiding pseudo-precision; title weight sits between card and H1 roles so the end stays editorial, not a new hero.

**Trade-off:** A larger pause risks reading as empty space; G7 verifies against real final photos.

**Confidence:** Medium.

**Reversible:** Yes within frozen ranges.

**Needs Stage 3C validation:** Yes — G7.

## B08 — Mobile media edge exception application

**Decision:** Controlled edge-to-edge applies to Gallery landscape media (and optionally the Home hero cover) only when it materially improves viewing; captions, counters, controls always inset 20 px; complete frame always visible; never applied to cards or text.

**Status:** Recommended application of a Frozen exception.

**Source from Stage 3A:** D08 mobile media-only exception; SPACING_AND_GRID full-bleed boundaries.

**Reason:** Real landscape viewing benefits from width; the inset rule keeps every frozen text/contrast guarantee.

**Trade-off:** Two media widths coexist on mobile (default vs exception); must stay conditional, not a layout mode.

**Confidence:** Medium-high.

**Reversible:** Yes per media slot.

**Needs Stage 3C validation:** Yes — G10 capture inside G5 fixtures.

## B09 — Gallery reading column

**Decision:** Header/caption/continuation share one reading column of ≈680 px, leading-edge aligned; images center in the broader media frame.

**Status:** Recommended starting specification.

**Source from Stage 3A:** reading-width targets (caption 48–60 chars; body 60–70); Gallery frame philosophy.

**Reason:** One persistent text edge across header/caption/end keeps the sequence axis calm while images breathe wider.

**Trade-off:** Captions sit far from wide landscape edges on very wide frames; alignment to the image leading edge (Stage 3A rule) applies per image where practical.

**Confidence:** High.

**Reversible:** Yes within role-based measure limits.

**Needs Stage 3C validation:** No gate; covered by caption captures.

## B10 — Places Index baseline

**Decision:** MVP = name-led text list: Place name (serif link) + region only when disambiguating; ≈800 px measure; no covers. Gallery count, photographed year span, and representative cover remain optional presentation candidates per the Frozen Stage 2B baseline: not rendered, not admitted, not scheduled.

**Status:** Recommended starting specification (baseline scope corrected by the Stage 3B Red Team review: the original wording promoted count/year span into the MVP baseline without the evidence-first admission required by Stage 2B `INFORMATION_ARCHITECTURE.md` and Stage 3A `DISCOVERY_UI_SYSTEM.md`).

**Source from Stage 3A:** name-led baseline; optional decorations allowed only if demonstrated useful.

**Reason:** Text-only keeps the page light and maintenance-free; Stage 2B froze name + disambiguation as the only required baseline, and no Stage 3B evidence demonstrates that count/span improves scanning at actual scale.

**Trade-off:** Less visual scanning than a cover grid; deliberate per direction. Count/span lose their scanning aid until admitted; accepted, because admission requires evidence, not assumption.

**Confidence:** High.

**Reversible:** Yes; count/span/cover candidates require evidence-first entry.

**Needs Stage 3C validation:** Typographic captures only.

## B11 — Home recent set and cue placement

**Decision:** Recent set = up to 6 cards (excluding hero), 3 desktop columns; cue is metadata-role plain text placed as first line above the photographed date in the hero metadata group.

**Status:** Recommended starting specification → cue verified in G3.

**Source from Stage 3A:** shared card; plain-text cue; finite recent set; D02/D07.

**Reason:** Keeps Home finite and honest; cue position binds it to publication state so backfilled work cannot misread as recently photographed.

**Trade-off:** Cue above date adds a line to the metadata group.

**Confidence:** High.

**Reversible:** Yes.

**Needs Stage 3C validation:** Cue clarity inside G3.

## B12 — Site name starting family and mobile top bar

**Decision:** Site name starts in display serif (18–20 px mobile, equivalent desktop role); mobile top bar 56 px + safe area; Menu layer on raised `#EFECE5`.

**Status:** Recommended starting specification (serif vs sans for the mark is open to G1-adjacent comparison).

**Source from Stage 3A:** text-only mark decision (D13); mark may be serif or sans after comparison; neutral layer.

**Reason:** Serif aligns the mark with authored identity at zero brand-maintenance cost.

**Trade-off:** Serif at small sizes needs G1-quality rendering; sans is the safe alternative.

**Confidence:** Medium-high.

**Reversible:** Yes trivially.

**Needs Stage 3C validation:** Inside G1 captures.

## New-issue record

No new Stage 3C questions were added. One application interpretation is noted for transparency: the task's Gallery-header “optional description” is implemented as a capped ≤3-line authored text block (B03), because Stage 3A forbids a description *panel*; this is a scope clarification, not a new visual issue, and does not block Stage 3C.
