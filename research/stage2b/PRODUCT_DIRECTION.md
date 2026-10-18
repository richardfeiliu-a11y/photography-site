# Product Direction

Status: Stage 2B1 product decision. Evidence base: [`STAGE_2_EVIDENCE_SYNTHESIS.md`](../STAGE_2_EVIDENCE_SYNTHESIS.md) and [`STAGE_2_EVIDENCE_LEDGER.md`](../STAGE_2_EVIDENCE_LEDGER.md).

## What this product is

A long-lived **Personal Photographic Archive / Online Photography Exhibition**. It has two equally necessary capabilities but one clear priority:

1. **Primary:** let a visitor seriously view an edited Gallery as photography.
2. **Secondary:** let a visitor rediscover older Galleries by photographed time or place.

The archive is not a raw dump. Publishing means turning selected photos into an authored Gallery with a stable title, photographed date or range, cover, and order.

## What this product is not

- A commercial photographer portfolio or service funnel.
- A chronological blog, travel tracker, social feed, equipment database, or institutional collection system.
- A map-, search-, tag-, or filter-first interface.
- A system in which every trip, visit, shoot, or import batch becomes public content.

## Primary user tasks

1. Open the Home Gallery—normally the latest addition, or one optional manually featured override—and view it in the photographer's order.
2. Continue to another Gallery without losing orientation.
3. Find older work by photographed year.
4. Find all published Galleries associated with a recurring Place.
5. Understand the minimum context—title, photographed date/range, Place, count, optional text—without the metadata competing with the images.

## Design priorities

1. Photography before archive controls.
2. Editorial Gallery boundaries before travel or storage boundaries.
3. Low cognitive and maintenance cost.
4. A small stable navigation that survives 15, 80, and 300 Galleries.
5. Progressive complexity: add retrieval tools only when content scale creates a demonstrated need.
6. Mobile is a primary constraint, not a reduced desktop mode.
7. Decisions remain reversible through stable entities and semantic URLs, without exposing speculative entities.

## Long-term objective

Grow from tens to 300+ Galleries without changing the product's identity. The site should still feel like an evolving photography exhibition while Archive and Places quietly make the full body of work retrievable.

## Success criteria

- A first-time visitor identifies the site as photography-first, not database- or travel-first.
- Recent work is immediately visible; the complete archive is never hidden behind an endless homepage stream.
- A Gallery can span visits or places, and one trip can produce multiple Galleries, without breaking the model.
- The same Gallery appears through Home, Archive, and Places without duplicated content.
- Backfilled work is filed by when it was photographed, while “latest addition” remains accurate.
- Publishing a new Gallery requires content metadata, not manual navigation restructuring.
- Mobile users can view mixed orientations, reach the end, and choose a clear continuation without horizontal overflow.

## Decision snapshot

| Decision | Recommended direction | Nature |
|---|---|---|
| Homepage | Latest by `date added/published`; one optional featured override; archive entry secondary | Product decision; prototype validation required |
| Gallery | Editorial, titled, ordered viewing unit | Evidence-supported fact + product definition |
| Chronology | Archive index organization; no separate Chronology page | Product decision supported by strong feasibility evidence |
| Place | Metadata + persistent entity + secondary navigation + landing page | Project-specific product decision |
| Place page | Gallery cards with progressive photographed-time grouping | Product decision; evidence does not establish superiority |
| Visit | Not modeled in MVP; capture/provenance context preserved | Product decision supported by strong evidence against a required public layer |
| Viewing | Vertical sequence-first; Overview is a recommended default gated by Test 3 | Recommended default; prototype-gated |
| Discovery/metadata | Minimal visible metadata; Search later; Map/tags/facets not planned | Progressive-complexity product decision |
