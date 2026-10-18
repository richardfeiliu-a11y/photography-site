# Stage 2B Final Decisions

Status: **final Stage 2B product decisions**. T1–T4 are frozen.

## Home

**KEEP A — Latest-first.**

```text
if one published Gallery is featured:
    show featured
else:
    show latest by date added/published
```

Photography/Gallery remains the first hierarchy; Archive and Places remain direct secondary actions. `date photographed` controls historical placement. Stage 3 may add a subtle “Featured” or “Recently added” presentation cue but may not change the algorithm or hierarchy without new evidence.

Evidence strength: **Medium prototype evidence**; not user-validated.

## Place grouping

**KEEP progressive behavior.**

- Default low-volume presentation: flat reverse chronology with date visible on cards.
- Add year headings when repeated-year aggregation, known-year retrieval, or lost temporal orientation makes headings earn their space.
- No numeric threshold enters product rules.

Evidence strength: **Medium prototype evidence**; exact trigger remains editorial/behavioral and not user-validated.

## Gallery Overview

**PASS OVERVIEW — Overview enters MVP.**

Overview remains secondary and explicitly invoked. Sequence-first entry, authored order, current marker, exact restore, target jump, no history/route entry, and captions in sequence are frozen requirements.

Evidence strength: **Medium prototype evidence**. Mechanics are independently verified; sequence-bypass behavior is not user-validated.

## Mobile progression

**KEEP VERTICAL.**

```text
Primary mobile progression = Native vertical sequence
Overview = available under the T3 decision
Swipe-first = not the MVP Gallery progression model
Continuation = after the final Photo only
```

The retest independently passes L01/L47/L71 hidden, L72 visible, L72→L71 hidden again, and A/B continuation parity. Swipe-first offers larger isolated images and explicit adjacent controls, but does not demonstrate a clear advantage in mixed orientation, long-sequence navigation, backward traversal, caption flow, authored continuity, or end recognition. Close/mixed evidence retains the frozen Vertical default.

Evidence strength: **Medium prototype evidence**; isolation/mechanics are verified, user fatigue/preference/completion are not.

## Frozen after B2

The following are frozen for Stage 3:

- Product definition and navigation budget.
- Gallery as editorial/viewing unit; no fixed Photo-count rule.
- Archive = Chronology and photographed/published date separation.
- Place entity/navigation/page; progressive grouping concept.
- No Visit entity/field/URL/navigation/grouping.
- Canonical Gallery URL and stable Photo identity.
- Search/pagination Later; Map/Tags/facets excluded.
- Latest-first Home hierarchy and featured/fallback algorithm.
- Overview enters MVP under the T3 rules above.
- Native vertical mobile Gallery progression; Swipe-first is not the MVP model.
- End continuation baseline: Next Gallery primary, Back to origin secondary, shown only at true Gallery end.

## Still requires Stage 3

- Final type, color, branding, motion, card styling, and production responsive system.
- Hero size and “Featured/Recently added” cue.
- Year-heading visual weight, section spacing, and Place-card density.
- Overview thumbnail density and stronger mobile current marker.
- Real-photograph image rhythm, caption styling, and sequence spacing.
- Final visual treatment of continuation and controls.

These are visual/design-specification issues, not reasons to reopen B1.

## Later

- Search and pagination by behavioral need.
- Fullscreen.
- Multi-Gallery Photo reuse.
- Project/Series parent if real content needs it.
- Production CMS/database/auth/analytics/image pipeline/technical architecture.

## Requires user validation

Participant-testing choice: **Recommended but not blocking**.

No formal UX study is required. Lightweight participant validation may run before or during Stage 3 without blocking the design specification.

Suggested minimum:

- 3–5 people who regularly browse photographs but did not participate in B1/B2.
- Include at least two mobile-primary users.
- Run only the existing tasks for T1 clarity, T2 year-heading comprehension, T3 sequence bypass/current-position understanding, and T4 fatigue/end recognition.
- Record raw outcomes and explanations; do not claim statistical significance.

Participant findings may refine visual treatment but do not reopen frozen IA without a clearly demonstrated product failure.

## Final gate

**Stage 2B complete — proceed to Stage 3 Design Specification.**

No major product issue was discovered. Do not reopen Stage 2B1/B2 during Stage 3.
