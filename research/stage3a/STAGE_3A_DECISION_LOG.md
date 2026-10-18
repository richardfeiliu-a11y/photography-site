# Stage 3A — Decision Log

Status: **visual decisions frozen for Stage 3B unless explicitly marked as prototype-tunable**.

Confidence describes evidence strength for this project, not universal design truth.

## D01 — Visual direction

**Decision:** Quiet Editorial Archive.

**Reason:** Preserves the neutrality and durability required by a long-lived archive while giving authored Gallery titles and discovery pages a restrained identity.

**Trade-off:** More font-pairing and mixed-script QA than a pure institutional sans system.

**Confidence:** High as a system direction; medium for exact visual tuning.

**Reversible:** Yes, through typography/spacing roles without IA change.

**Needs visual prototype:** Yes—real photography and mixed-script screens.

## D02 — Neutral versus expressive

**Decision:** Discovery has modest personality; Gallery is extremely restrained.

**Reason:** Discovery needs retrieval landmarks and identity, while sequence viewing must minimize interface attention.

**Trade-off:** Requires discipline so Home/Archive do not drift into magazine styling.

**Confidence:** High.

**Reversible:** Partially; degree can be tuned without behavior change.

**Needs visual prototype:** Yes.

## D03 — Serif/sans system

**Decision:** Restrained display serif + utility sans; no required mono family.

**Reason:** Serif marks authored/editorial boundaries; sans protects mobile, metadata, body, caption, and multilingual utility readability.

**Trade-off:** Two-family loading/maintenance and CJK pairing complexity.

**Confidence:** Medium-high.

**Reversible:** Yes; fallback is all-sans with preserved role hierarchy.

**Needs visual prototype:** Yes—font brands are not frozen.

## D04 — Background tone

**Decision:** Subtly warm, low-chroma neutral canvas with graphite text.

**Reason:** Softer than pure white while remaining stable across photographic styles and long viewing sessions.

**Trade-off:** Excess warmth can affect perceived image color and white borders.

**Confidence:** Medium-high.

**Reversible:** Yes through semantic color roles.

**Needs visual prototype:** Yes—high-key, B&W, and color-heavy Photos.

## D05 — Accent color

**Decision:** No decorative brand accent; color accent exists only for focus/accessibility states.

**Reason:** Photographs already supply expressive color; a brand accent would create a second attention system.

**Trade-off:** Identity must come from typography, proportion, and rhythm.

**Confidence:** High.

**Reversible:** Yes.

**Needs visual prototype:** Focus color must be measured across all surfaces and real images.

## D06 — Dark mode

**Decision:** No dark mode in MVP.

**Reason:** Theme changes materially affect photo perception and double visual QA/maintenance without a frozen user task.

**Trade-off:** No system-preference night theme at launch.

**Confidence:** High.

**Reversible:** Yes because roles remain semantic; not by mechanical inversion.

**Needs visual prototype:** No for MVP decision; yes before any later dark theme.

## D07 — Card philosophy

**Decision:** Image + text block; no border shell, filled background, overlay metadata, shadow, or hover zoom.

**Reason:** Keeps covers dominant and avoids SaaS/feed styling while preserving complete frames.

**Trade-off:** Mixed intrinsic ratios create less mechanically uniform grids.

**Confidence:** High.

**Reversible:** Yes at visual layer.

**Needs visual prototype:** Yes—mixed cover ratios at 15/80/300 Gallery scale.

## D08 — Full-bleed

**Decision:** No Home or desktop Gallery viewport full-bleed; mobile allows a controlled media-only edge-to-edge exception.

**Reason:** Stable margins support an authored sequence and mixed orientations; mobile landscape may benefit materially from width.

**Trade-off:** Less cinematic first impression and some mobile cases need explicit safe-area/caption handling.

**Confidence:** Medium-high.

**Reversible:** Yes per page/media slot.

**Needs visual prototype:** Yes—mobile bright/dark landscape and portrait transitions.

## D09 — Gallery spacing

**Decision:** Three editorial rhythm states: Compact 64–72/40–48, Base 96/64, Breathing 144/96 (desktop/mobile reference values).

**Reason:** One fixed large gap cannot express pair, normal transition, and chapter pause; three states are enough without token sprawl.

**Trade-off:** Compact/Breathing require editorial judgment and can be misused.

**Confidence:** Medium.

**Reversible:** Yes within the named system.

**Needs visual prototype:** Yes—especially a 72-Photo mixed-orientation Gallery.

## D10 — Current position

**Decision:** Persistent `n / total` as a quiet non-interactive margin annotation; inline fallback if mobile overlay cannot be photo-safe.

**Reason:** Provides orientation without a slideshow control bar.

**Trade-off:** A persistent mobile counter may conflict with edge-to-edge media or meaningful image content.

**Confidence:** Medium.

**Reversible:** Yes between persistent margin and inline presentation; format remains frozen.

**Needs visual prototype:** **Yes—priority question for Stage 3B/3C.**

## D11 — Overview styling

**Decision:** Opaque neutral full-viewport light table; contained thumbnails; 5–6 desktop columns, 3 mobile with 2-column fallback; restrained current marker.

**Reason:** Establishes extent and position while remaining subordinate to sequence.

**Trade-off:** Neutral cells may show empty space around mixed ratios; denser grids need target/recognition testing.

**Confidence:** Medium-high.

**Reversible:** Column density and marker details are tunable; hierarchy is not.

**Needs visual prototype:** Yes—mobile current/focus states.

## D12 — Continuation

**Decision:** Text-led end colophon with explicit end label, Next Gallery title, and Back to origin; no cover in MVP.

**Reason:** Clearly marks the authored end and avoids recommendation-feed styling.

**Trade-off:** Less visual preview of the next work.

**Confidence:** High.

**Reversible:** A small cover could be tested later without IA change, but is outside current direction.

**Needs visual prototype:** Yes for final spacing/typographic weight.

## D13 — Navigation and site mark

**Decision:** Static compact header; text site name; desktop inline links; mobile opaque neutral Menu layer.

**Reason:** Lowest brand/control maintenance and no competition with long Gallery viewing.

**Trade-off:** Global navigation is not continuously available deep in a Gallery; Back/Overview and browser controls carry that context.

**Confidence:** High.

**Reversible:** Sticky behavior or a custom mark could be added later only with evidence.

**Needs visual prototype:** Mobile Menu density and long labels only.

## D14 — Motion

**Decision:** No hover zoom, scroll reveals, page transitions, parallax, or scroll-jacking; only short functional state transitions.

**Reason:** Motion should clarify Menu/Overview state, not become a parallel exhibition.

**Trade-off:** Less theatrical polish.

**Confidence:** High.

**Reversible:** Yes.

**Needs visual prototype:** Only Menu/Overview timing and reduced-motion behavior.

## D15 — About visual role

**Decision:** Narrow text-led page, no required biography portrait, Contact above selected Social links.

**Reason:** About is frozen as low-weight identity/contact, not commercial proof.

**Trade-off:** Less immediate personal portrait branding.

**Confidence:** High.

**Reversible:** Yes if an authored portrait later earns a place.

**Needs visual prototype:** No blocking question.

