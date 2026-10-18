# 0828｜研究｜最终视觉评审

## Overall verdict

The final canonical prototype is visually ready to be frozen before production development.

Across the supplied Home, Archive, Place, Gallery, Overview and About captures, the system consistently reads as a mature personal photographic archive / online exhibition rather than a commercial portfolio, magazine, travel diary, museum database or application UI. Quiet Editorial Archive is visible as a system: the photographs establish scale and tone; whitespace sets viewing rhythm; typography supplies identity without becoming the subject; metadata and controls remain progressively quieter.

No P0 or P1 visual issue was found. No selected screenshot demonstrates a repeated problem strong enough to reopen G1–G7. The only actionable finding is a P2 implementation/evidence-packaging mismatch in the screenshot selection packet; it does not invalidate the visible design or block design freeze.

## Does Quiet Editorial Archive succeed?

Yes.

The direction succeeds because its identity comes from repeatable relationships rather than decorative branding: warm off-white canvas, restrained serif/sans contrast, large uncropped photographs, deliberate asymmetric compositions, unboxed Gallery representations, small factual metadata and native vertical progression. Those relationships remain recognizable across image-led, index-like and text-only pages.

The result is not generic minimalism. Source Serif 4 gives titles enough editorial character, the warm canvas creates a consistent physical-paper / exhibition-wall association, mixed image orientations introduce tactile rhythm, and the archive vocabulary—years, photographed dates, places, Gallery counts and authored endings—provides a specific archival identity. At the same time, none of those devices competes materially with the photography.

Page-specific variation is controlled and appropriate:

- Home is more composed and invitational.
- Archive and Place pages become denser and more scannable.
- Gallery becomes highly neutral and sequence-led.
- Overview becomes a compact operational light table.
- About becomes typographic and informational.

These are role-appropriate variations inside one system, not visual drift.

## Photography dominance

The intended hierarchy—Photo > Whitespace > Typography > Metadata > Controls—is true in practice.

Photography remains the largest, highest-contrast and most information-rich layer. Bright snow, dark night scenes, saturated aurora imagery, cool landscapes and portrait-oriented frames all retain their own color and compositional authority. The interface does not introduce colored brand competition, overlays, card surfaces, shadows, image treatments or motion chrome.

Whitespace is active but generally not excessive: it separates the Home entrance, Archive year landmarks, Gallery sequence frames and final authored ending without becoming a decorative spectacle. Typography is most prominent at the beginning of a Gallery or page, then recedes. Metadata is visibly subordinate through scale, sans styling and secondary color. Controls remain text-led and low-weight; even Overview, Close, Back and current-position treatments avoid slideshow chrome.

The warm canvas does not visibly wash or tint the photographs. It is most noticeable beside bright snow images, where it reads as a slightly warm exhibition surface rather than a competing color field. Dark and saturated photographs gain clean separation without requiring borders or dark chrome.

## Cross-page coherence

Home, Archive, Place, Gallery, Overview and About belong to the same product.

The strongest recurring system cues are:

- the same restrained site mark and navigation language;
- the same serif role for titles and Gallery names;
- the same neutral sans role for metadata, controls and body copy;
- the same warm canvas and dark neutral text;
- the same unbordered, unshadowed relationship between photographs and text;
- the same left-edge logic and generous outer margins on desktop;
- the same tighter but still calm mobile margins;
- the same factual date/place language;
- the same preference for native document flow over app-like containers.

The change in density between discovery surfaces and Gallery/Overview is appropriate. Discovery pages need multiple entry points; Gallery needs concentration; Overview needs compact navigation. None of those density shifts introduces a different design language.

## Home

Home succeeds as an exhibition entrance.

On desktop, the large hero photograph, offset composition and title relationship feel curated rather than promotional. There is no marketing headline, brand promise, overlay, button treatment or cinematic device. The asymmetric portrait-hero state uses a large quiet field without making the whitespace theatrical; it reads as an editorial layout choice that preserves the photograph's orientation.

On mobile, the hero photograph, Gallery title, photographed date/place, View Gallery link, Archive/Places discovery links and Recent Galleries establish a clear progression. The experience remains a photography archive rather than collapsing into a carousel or social feed. The smaller viewport increases information density, but the hierarchy remains legible and calm.

Recent Gallery cards use plain image/title/metadata relationships with no SaaS-card language. Photographed dates are stated as metadata rather than promotional freshness signals. The visible system does not style an older photographed date as if it were a recent shooting date; however, the supplied selected crop does not actually show the stated 2019 “Recently added” backfill example, so that exact wording relationship is not independently adjudicated from the selected screenshots.

No page-level correction is required.

## Archive

Archive reads as a photographic archive reading room rather than database UI.

Year headings operate as clear chronology landmarks without becoming oversized section banners. Mixed portrait and landscape covers create a natural archival rhythm while preserving uncropped images. Titles and metadata are subordinate and consistently aligned with their covers. The three-column desktop arrangement supports multi-year scanning without filters, badges, tables or institutional metadata density.

The mobile transition is successful: years remain visible landmarks, Gallery cards become a single vertical sequence, photographed-date wording remains explicit where needed, and the footer arrives with adequate separation. The uneven vertical depth caused by mixed orientations is a valid consequence of the no-destructive-crop rule, not a system failure.

No page-level correction is required.

## Places / Place

The supplied Place-page screenshots succeed as another route into Galleries rather than as travel journalism.

Place names and quiet location context lead the page; Gallery covers, titles, photographed dates and photo counts remain the content. There are no maps, destination descriptions, itineraries, decorative geography devices or Visit-card chrome. Progressive year grouping reads as a chronology landmark in the same visual language as Archive, not as a new entity type.

Multi-place metadata remains compact and factual. It communicates the scope of a Gallery without turning the page into a trip log or taxonomy interface.

The selected visual packet does not contain a correctly identified Places Index capture: the files labeled P01 and P02 in the index visibly show Thun and Reine Place detail pages. Stage 3C QA independently confirms that the canonical `/places/` baseline is name-led with region/country only for disambiguation and no counts, but the final visual composition of that index is not directly visible in the selected packet. This is an evidence-selection implementation bug, classified below, rather than a demonstrated Places visual defect.

No visual correction to the Place design is required.

## Gallery

Gallery is the strongest part of the system and succeeds as an authored photographic sequence translated into native vertical web viewing.

The header establishes origin, Gallery title, photographed date/place and Overview without resembling application chrome. The transition to the first photograph is deliberate and ceremonial but not excessive: the photograph still enters within the initial desktop and mobile viewing context and immediately becomes the dominant layer.

Landscape photographs are large enough to feel exhibition-like without becoming desktop full-bleed. Mobile photographs appropriately use the available width. Portrait and landscape states preserve their aspect ratios and avoid destructive crop. Mixed-orientation rhythm feels authored rather than mechanically normalized.

Base spacing at 96px desktop / 64px mobile creates clear separation without fragmenting the sequence. Captions remain physically connected to their photographs, use subordinate sans typography and do not interrupt the photographic rhythm. The right-margin desktop position marker is quiet; the mobile system does not introduce slideshow controls or a progress bar. In the supplied end state, position chrome yields to the authored conclusion rather than competing with it.

The long-Gallery midpoint remains visually stable: photograph scale, margin geometry, captions and position treatment do not accumulate extra UI. The selected screenshots cannot establish lower fatigue, higher completion or sustained endurance, and this review makes none of those claims; they establish only that no obvious visual-rhythm breakdown is present in the inspected states.

The selected G05/G06 descriptions in the screenshot index do not match their visible content exactly: G05 shows a short English caption rather than the stated three-line mixed-script caption, and G06 shows a Chinese caption within a Gallery frame rather than the stated long CJK Gallery-title wrap. Stage 3C QA confirms the broader matrix coverage, but those two exact stress states are not directly adjudicated from the selected packet. This is part of the P2 evidence-selection bug below, not a visible Gallery failure.

No Gallery correction and no G4/G5 retest are required.

## Typography

Source Serif 4 and Source Sans 3 form an effective restrained editorial system beside real photographs.

The serif has enough character to distinguish the archive from a generic utility interface, but its weight and scale remain controlled. It is used where identity is useful—site mark, page titles and Gallery titles—rather than throughout all metadata and controls. The sans is neutral and legible without creating SaaS-like density.

Latin and Chinese scripts coexist without a visible shift into a second product. CJK titles and captions retain appropriate line-height and optical weight, while mixed-script titles remain coherent. The serif does not become overly literary or theatrical; the sans does not become visually dominant. Long English titles wrap naturally within their card columns.

The selected packet does not directly show the indexed long-CJK-title stress capture, so this review relies on the visible Chinese title/caption states plus the already-established Stage 3C prototype-level typography verification for that boundary. No font or scale change is justified.

## Color

The adopted palette succeeds.

`#F6F4EF` behaves as a neutral exhibition surface across high-key snow, dark night photography, saturated aurora greens, cool blue landscapes and neutral scenes. Its warmth is perceptible but not dominant. It provides a stable physical-surface character and prevents the archive from feeling like a default pure-white template.

Primary and secondary neutrals maintain a clear hierarchy. Raised and hairline colors appear only where operational distinction is needed, most visibly in Overview and the current marker. Focus blue remains outside the static brand impression and should continue to be treated as an accessibility state, not as a visual accent.

No reproducible photograph/palette conflict is visible. G2 remains frozen.

## Mobile

Mobile remains unmistakably the same photographic archive.

The text-only site mark and Menu preserve the desktop identity without compressing desktop navigation into app chrome. Gallery progression is native and vertical; images gain width, sequence spacing tightens proportionally, and captions/metadata remain calm. There are no horizontal controls, swiping affordances, pagination dots or overlay counters competing with the images.

The 3-column Overview remains compact but legible as a light table. The current marker is clear without being ornamental. The ending state preserves the 112px pause, low-weight End label and text-led navigation. It feels conclusive rather than like a recommendation feed.

Persistent `n / total` is sufficiently quiet in the inspected Gallery states and does not visually reframe the sequence as a slideshow. No G5 or G6 change is justified.

## Overview

Overview succeeds as a subordinate light table.

It is visually flatter and more operational than the sequence: small contained thumbnails, plain numbering, a single current marker, a concise Gallery title/count and a text Close control. It does not reproduce captions, metadata richness, card titles or continuation content. That reduction keeps it subordinate even though it is the densest surface in the product.

Desktop six-column and mobile three-column layouts preserve the same cell logic. Mixed aspect ratios remain contained and uncropped. At the inspected fixture sizes, thumbnails remain visually distinguishable in expert inspection; this is not a claim about representative-user recognition.

The current marker is intentionally the strongest graphic line in the light table. A thinner or softer marker could also look good, but the current treatment is valid because location must be immediately recoverable. This is a subjective alternative, not a required change.

## Continuation

Continuation clearly communicates that the authored Gallery has ended and then offers one intentional path.

The true final photograph is followed by a visible pause before the low-weight End label. The Next Gallery title uses restrained serif hierarchy without a cover image, badge, button or promotional treatment. Back remains visibly subordinate. Where no Next Gallery is supplied, the mobile state ends with Back/Browse paths rather than fabricating recommendation content.

The ending does not resemble infinite scroll, a recommendation feed or a marketing call to action. The 168px desktop / 112px mobile pauses are visibly purposeful and proportional to their viewports. G7 remains frozen.

## System-level issues

No SYSTEM-LEVEL P0, P1 or P2 issue was found.

No repeated typography, color, spacing, hierarchy or control problem is visible across the selected states. No G1–G7 value meets the standard for reopening.

## Page-level issues

No PAGE-LEVEL P0, P1 or P2 issue was found.

Several compositions could be tuned differently by taste, but none produces a meaningful localized failure before production.

## Implementation bugs

| Severity | Classification | Finding | Impact on freeze |
|---|---|---|---|
| P2 | IMPLEMENTATION BUG | The screenshot selection/index is not fully traceable to the visible files: P01/P02 are described as Places Index states but visibly show Place detail pages; H05 does not expose the stated cue within the selected crop; G05/G06 do not show the stated three-line caption / long CJK Gallery-title states; G11 is listed but absent from the selected screenshot directory; and the category counts in `SCREENSHOT_SELECTION.md` sum to 21 while the stated and actual selected-file total is 20. | This weakens auditability of several named stress states but does not demonstrate a visual-system defect. Stage 3C QA confirms the full matrix and canonical runtime. Correct the packet before treating it as the long-term evidence index; design freeze itself is not blocked. |

The orphan Gallery directories already documented by Stage 3C QA are repository/build hygiene, not a visible design issue in the canonical screenshots, and therefore are not reclassified as a visual finding here.

## Subjective preferences explicitly NOT requiring change

- The large right-side quiet field in the desktop portrait Home hero could be filled or centered in another valid design, but the current asymmetry is coherent with the editorial direction.
- The Gallery header-to-first-photo pause could be made tighter in another valid system, but the current composition does not cross into excessive ceremonial whitespace.
- The warm canvas could be marginally cooler or whiter by taste, but the current value is visibly compatible with the inspected photo range.
- The Overview current marker could be optically lighter, but its present strength is justified by current-position recovery and remains subordinate to the sequence outside the modal.
- Mixed-orientation Archive/Place grids could be normalized by crop in another product, but preserving the photographs is the correct priority here; the resulting uneven rows are valid.
- The Source Serif title voice could be quieter or more literary in another archive, but the adopted balance is valid and does not warrant reopening G1.

## Evidence limitations

- No participant UX study was performed. This review does not claim user preference, lower fatigue, better comprehension, higher completion or representative-user thumbnail recognition.
- The true B&W fixture was unavailable; the documented low-saturation substitute cannot establish behavior beside true monochrome work.
- Source photographs lack a pre-session hash baseline; “no evidence of modification” is the valid boundary, not proof of untouched provenance.
- Accessibility evidence is prototype-level automated/mechanical verification, not WCAG certification.
- Screenshot review samples deterministic browser captures rather than exhaustive physical-device rendering.
- The selected packet's Places Index, long-CJK-title and three-line-caption references are not visually traceable to the supplied selected files, as described in the P2 implementation bug. Stage 3C QA establishes that the full matrix exists, but this final review does not pretend to have visually inspected missing selected states.
- Remote `vision` skill providers did not return usable results in this session (SenseNova and Google timed out; StepFun returned empty content). The original local PNG files were therefore inspected through the Codex local read-only image viewer; failed remote descriptions were not used as evidence.

These limitations do not invalidate the visible design or require a new prototype.

## Required corrections before design freeze

None.

There is no visual correction required before Final Design Spec Freeze. In particular, do not change G1–G7, typography, palette, Gallery rhythm, mobile progression, Overview density or continuation based on this review.

## Optional later refinements

1. Repair `SCREENSHOT_SELECTION.md` and the selected screenshot folder so every description points to the visible state it claims to demonstrate. Add/copy the actual Places Index, three-line-caption and long-CJK-title captures; either include G11 and report 21 total files, or remove G11 from the list and retain the correct total of 20.
2. Preserve the current deterministic capture approach when production implementation begins, then recapture the frozen states against production code to detect implementation drift.
3. If future participant research is commissioned, test long-sequence endurance and thumbnail recognition as open empirical questions without treating that research as a prerequisite for the current design freeze.
4. Clean the two orphan Gallery build directories already recorded by Stage 3C QA during normal prototype/repository housekeeping; this is not a visual-design correction.

## Final gate

### A

**PASS — proceed to Final Design Spec Freeze**

The visual system is coherent and production-ready as designed. No critical or pre-freeze visual problem was identified. The P2 screenshot-packet traceability bug should be corrected for durable auditability, but it does not justify Gate B, a visual retest or reopening any frozen value.
