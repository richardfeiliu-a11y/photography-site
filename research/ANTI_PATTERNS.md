# Anti-Patterns

Negative evidence from the verified set, with site references. Each item is a real failure pattern observed, not a hypothetical.

## Brand-first / commerce-first site

Evidence:
- thomaskinkade.com (020): SEO title emphasizes commerce ("Limited Edition Paintings, Wall Art & Decor"); static fetch returns no photography.
- joelmeyerowitz.com (008): commercial items (class, events, press) share equal weight with artwork.
- jamesmaherphotography.com (010): cart, Google reviews, email signup, newsletter around the archive.

Impact: Photography becomes marketing collateral. Visitors cannot reach work without passing through sales/marketing surface.

## Long nav lists that stop scaling

Evidence:
- joelmeyerowitz.com (008): 18-item sidebar already feels dense.
- lisakereszi.com (019): 18 projects alphabetical-flat; works at 18, would be chaotic at 60.

Impact: As the archive grows, the nav list becomes unusable. The only solution seen is to move to hierarchies (Haarkon, Terragalleria) or to add filters.

## JS-only render / not inspectable

Evidence:
- gregorzielke.com (014): 1KB static HTML, all content JS-rendered; static fetch reveals only shell.
- mickrock.com (025): static fetch returns CSS variables only.
- stephenshore.com (021): SSL mismatch prevented verification (different problem, same fragility).

Impact: SEO, accessibility, archive tooling, and long-term resilience are all reduced. Mobile or older devices may fail to render.

## Mobile exclusion by design

Evidence:
- archive.noahkalina.com (004): on-page statement "this site is intended to be viewed on desktop or laptop only".

Impact: Violates our brief'\''s mobile requirement. Useful negative constraint: a "playground archive" may live without mobile; a "primary archive" must not.

## Site under reconstruction with no fallback

Evidence:
- thomassandberg.com (024): homepage text states "The page is being reconstructed at the moment... Until then visit: www.thomassandberg.dk".

Impact: Maintained sites need a non-degrading transition state. Even a minimal "site is being updated, last update date X, link to old content" is better than a near-empty placeholder.

## Inconsistent repeated-visit handling on a single site

Evidence:
- folker.photography (003): five sub-patterns (merge all / split per trip / merge non-adjacent / per-year-cluster / thematic split) co-exist on the same site for different places.

Impact: While pragmatic, this complicates user mental model. The decision rule for "merge vs split" is implicit and per-content. A new visitor must learn the per-place convention by exploration.

## No place aggregation in place-first sites

Evidence:
- haarkon.co.uk (001): repeated Kyoto visits do not aggregate to a Kyoto hub; they appear as many sibling cards.
- logbuch35mm.de (011): place is a tag, not a hub; no "all Hamburg" page beyond the tag list.

Impact: At very high volume, finding all work in a specific city requires search/filter.

## Repeated-visit question entirely unmodeled

Evidence:
- jatenk.net (002) - chronology-only, no place dimension at all.
- rinkokawauchi.com (007), alecsoth.com (006), joelsternfeld.com (015), lisa kereszi (019) - project/series model, no city recurrence.

Impact: Most artist sites never face the repeated-visit question because they don'\''t model place. We cannot borrow from them; we have to design the answer from scratch.

## Map as primary UI

Evidence:
- Tools like Mapstra and SammaPix were evaluated and rejected as products, not personal archives. None of the 25 personal archive sites uses a map as the PRIMARY entry surface.

Impact: A map-first design would be a contrarian choice without community validation in this dataset.

## Burtynsky-style "Photographs vs Books vs Films" split

Evidence:
- edwardburtynsky.com (023): separate sub-buckets for Photographs, Books, Films, The Anthropocene Project, In the Wake of Progress, Public Art.

Impact: Useful only if our archive will ever branch into books/film/public art. For pure photography archive, not applicable - but it shows the medium-split model exists for hybrid practices.


