# T1 — Home Hierarchy Decision

## Decision

**KEEP A — Latest-first Home.**

Decision type: **Prototype-based product decision**, not user-validated.

Isolation: **PASS**.

## Prototype evidence

- [A desktop top](../../prototype/shots/t1-a-feature-on-desktop-top.png) puts one photograph, Gallery title, date/Place/count, and `View Gallery` in the first viewport; Archive/Places remain direct links.
- [B desktop top](../../prototype/shots/t1-b-feature-on-desktop-top.png) uses the first viewport for Archive/year/card structure; the authored Gallery entry is below that index.
- [A mobile top](../../prototype/shots/t1-a-feature-on-mobile-top.png) keeps Gallery entry and both discovery links within a short initial scroll.
- [B mobile top](../../prototype/shots/t1-b-feature-on-mobile-top.png) begins a long year-by-year archive before the primary Gallery module, increasing scroll cost for “view photography first.”
- Feature-off state correctly selects G02 while displaying `Photographed Feb 2019`; Archive keeps it in 2019.
- Live browser confirms Paris is reachable from Home→Browse Places→Paris.

## Strength of evidence

**Medium.** Hierarchy and responsive consequences are directly visible and mechanically reproducible. No participant data proves comprehension or first-action behavior.

## What is directly observed

- A creates a photography-first first impression; B creates an archive/index-first first impression.
- A's hero is dominant without hiding Archive or Places.
- B exposes more chronology immediately but delays Gallery viewing, especially on mobile.
- Featured/fallback mechanics and photographed/published separation are correct.
- Archive-first's database-like quality comes from hierarchy/density, not final fonts/colors.

## What is inferred

- A better matches the frozen “edited viewing first” product priority.
- B is likely to shift user attention toward retrieval before viewing.
- A is likely to produce earlier Gallery entry while retaining sufficient discovery visibility.

## What is not validated

- Real first-click rates, time-to-Gallery, or time-to-Archive/Places.
- Whether non-expert users understand why a 2019 Gallery leads Home when recently added.
- Whether the featured override becomes stale or is understood as editorial presentation.

## Product rationale

The product is an online photography exhibition with an archive behind it. A expresses that hierarchy directly; B reverses the product priority before evidence of a retrieval-first audience exists.

## Trade-offs

- B provides immediate archive breadth and year orientation.
- A requires the Archive/Places links to remain visually discoverable and not sink below an oversized hero.
- Backfilled work needs a subtle Stage 3 presentation/copy cue such as “Recently added,” while keeping photographed date authoritative.

## Prototype defects, if any

No blocking T1 defect. The implementation report's `/places` “non-clickable” wording is inaccurate: Paris is a live link; other non-fixture Place names are static. This does not block the tested Paris task.

## Final rule entering MVP

Home remains Latest-first:

```text
if one published Gallery is featured:
    show featured
else:
    show latest by date added/published
```

Archive and Places remain direct secondary actions. `date photographed` remains visible and controls Archive/Place placement. Stage 3 must clarify recently-added/featured presentation without changing hierarchy.

