# Test 1 — Home Hierarchy

## Question

Does the frozen latest-first Home better serve “view photography first” than an archive-first Home without materially hiding Archive or Places?

## Recommended default

Variant A — latest-first. This test validates D01; it does not reopen navigation or Gallery IA.

## Variant A

```text
Global header
Hero / primary Home Gallery
Browse Archive · Browse Places
Recent additions — four Gallery cards
Minimal footer
```

- Hero selection uses the frozen algorithm: one optional featured published Gallery; otherwise latest by `date added/published` descending.
- `date photographed` remains the only historical date shown on Gallery context/cards and continues to determine Archive/Place placement.
- `feature=on`: G01 Quiet Stations is hero.
- `feature=off`: G02 Winter Courtyard is hero because it is the latest addition, while its visible photographed date remains 2019.
- Entire hero cover and explicit `View Gallery` action enter the canonical Gallery.
- Recent additions show four cards ordered by date added/published, excluding the hero.

## Variant B

```text
Global header
Archive preview — photographed-year headings and the same Gallery cards
Browse full Archive · Browse Places
Primary Home Gallery module
Recent additions — same four Gallery cards
Minimal footer
```

Only hierarchy changes. The same hero selection algorithm, Gallery card component, content, metadata, navigation, and Gallery destination remain.

## Optional Variant C

None. An equal-weight Home would evade the frozen direction rather than test it.

## Controlled variables

- Same global header and routes.
- Same G01–G06 content, covers, card design, metadata, and four-card recent set.
- Same featured/fallback state for A and B in a comparison session.
- Same typography, colors, spacing system, footer, and Gallery behavior.
- Same Archive/Places link labels and destinations.
- Only the vertical hierarchy of primary Gallery vs Archive preview changes.

## Desktop spec

Required viewport: `1440 × 1000`.

Variant A first viewport contains the full header, dominant hero cover/context, and `View Gallery`; hero media occupies no more than roughly two-thirds of viewport height so Archive/Places actions are visible at or immediately below the fold. Recent cards begin after the discovery actions.

Variant B first viewport contains the full header, Archive title/context, at least two photographed-year labels, and the beginning of the same Gallery-card set. The primary Home Gallery module begins below this archive preview.

Required deterministic captures:

```text
t1-a-feature-on-desktop-top.png
t1-a-feature-off-desktop-top.png
t1-b-feature-on-desktop-top.png
t1-a-feature-on-desktop-discovery.png
t1-b-feature-on-desktop-discovery.png
```

## Mobile spec

Required viewport: `390 × 844`.

- Global navigation uses the shared mobile pattern from `RESPONSIVE_SPEC.md`.
- Variant A hero cover is at most `58svh`; title/date/Place and primary action remain within the first viewport or immediately at its bottom edge.
- Archive and Places actions must be reachable within approximately one additional viewport of normal vertical scroll.
- Recent cards are one column and preserve the same order/content as desktop.
- Variant B shows the Archive preview first without changing card design or navigation.
- No horizontal overflow.

Required captures:

```text
t1-a-feature-on-mobile-top.png
t1-a-feature-off-mobile-top.png
t1-b-feature-on-mobile-top.png
t1-a-feature-on-mobile-discovery.png
t1-b-feature-on-mobile-discovery.png
```

## User tasks

Start each comparison from `/` at top scroll position.

1. Without explanation, state what kind of site this appears to be.
2. Open the work the Home page is asking you to view first.
3. Find the complete Archive.
4. Find work associated with Paris.
5. In `feature=off`, explain why a Gallery marked photographed in 2019 is presented first.
6. Return Home and identify whether the first Gallery is latest or manually featured.

Record first action, task completion, time-to-first-Gallery, time-to-Archive, time-to-Places, wrong turns, scroll depth, and explanation of the 2019 backfill.

## Success criteria

- Participants identify a photography/archive/exhibition rather than a service, travel tracker, or database.
- The primary Gallery is entered without instruction or detour.
- Archive and Places are found without using browser search or evaluator hints.
- In fallback state, participants can understand “recently added, photographed in 2019”; no one reports that the work was photographed recently because it appears first.
- Featured state is understood as editorial presentation and does not imply altered photographed chronology.
- Variant A produces earlier/more direct Gallery entry than B without a meaningful increase in Archive/Places failures or backtracking.

## Failure conditions

- Variant A hides Archive or Places enough to cause repeated failures or evaluator prompting.
- Users interpret G02's Home priority as proof it was photographed in 2026.
- Featured looks like a new content type, category, or permanent historical status.
- Variant B changes anything beyond hierarchy.
- Mobile hero prevents discovery actions from being found through normal scrolling.

## Decision rule

Keep Variant A unless it materially worsens Archive/Places discovery or repeatedly confuses publication recency with photographed time. If the featured override itself causes confusion, simplify or remove the override without replacing the latest-first hierarchy. Visual preference alone cannot reverse D01.
