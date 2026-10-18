# Pattern Notes

Only patterns supported by 2+ verified cases are listed. Each pattern shows evidence sites and interpretation is marked as interpretation.

## Chronological year index (with counts)

Observed in: haarkon.co.uk (001, 430 posts across 2015-2026, per-year counts), jatenk.net (002, ~11 years, ~30 releases), terragalleria.com (005, no year index but paginated subject pages), icp.org (016, 700+ past exhibitions since 1974, paginated "Load More"), eugenerichards.com (018, two era buckets 1973-1999 and 2000-2025).

Evidence count: 5

Initial interpretation: A simple year index with item counts per year is a strong default for time-axis navigation. ICP shows it scales to 700+ entries. Eugene Richards shows era buckets can replace year lists when count grows past a threshold.

## Place-first / geographic hierarchy

Observed in: terragalleria.com (005, 168+ page paths in continent->country->region->subject hierarchy), folker.photography (003, region->place), haarkon.co.uk (001, country filter + place cards), laurentdufour.eu (013, single-city theme split), jamesmaherphotography.com (010, single-city landmark split), loc.gov/collections/carol-m-highsmith (022, state->city->subject for tens of thousands of images).

Evidence count: 6

Initial interpretation: Place hierarchy is the most-scaled pattern. Terragalleria and Highsmith prove it can hold 10^4 images. The repeated-visit handling is the main open question (see below).

## Place-tag (flat) alternative to place hierarchy

Observed in: logbuch35mm.de (011, 60+ tags including Hamburg 10, Hafen 3, Hafencity 2, etc.), haarkon.co.uk (001, country+city metadata on cards rather than a city tree).

Evidence count: 2

Initial interpretation: A flat tag system is a cheaper alternative to a place tree; it scales but loses city aggregation. Logbuch'\''s per-post OSM embed also provides spatial grounding without a city tree.

## Per-body-of-work numeric metadata triplet

Observed in: joelsternfeld.com (015, photos count + books count + writings count per body of work), terragalleria.com (005, picture counts per subject page), jamesmaherphotography.com (010, total count + date range on archive search), haarkon.co.uk (001, per-year post counts in archive).

Evidence count: 4

Initial interpretation: Showing numeric metadata per index entry is the cheapest way to make a 100+ item list scannable. Joel Sternfeld'\''s photos/books/writings triplet is the most information-dense variant seen.

## Repeated-visit handling - five sub-patterns in one site (folker.photography)

Observed in: folker.photography (003, all 5 patterns in one site):
1. merge all years into one place gallery (Iceland main)
2. separate gallery per special trip (Iceland midnight tour 2022)
3. merge non-adjacent years (Norderney 2021+2023)
4. per-year-cluster galleries (Scotland 2015-17 vs 2023)
5. thematic split of same city (Mumbai re-imagined / Mumbai faces)

Also: yoshimoto (012) uses place+year-pair approach (two photos of same place across decades, side by side).
Also: jatenk.net (002) treats repeated Miniatur Wunderland as two independent dated releases.
Also: haarkon.co.uk (001) treats repeated Kyoto visits as sibling cards (no city aggregation).
Also: terragalleria.com (005) merges all years per subject (merge-only model).

Evidence count: 5

Initial interpretation: There is NO industry consensus for repeated-visit handling. The same site even uses multiple approaches for different places. The "Visit as separate entity" question from the brief is empirically UNRESOLVED across this dataset.

## Search-first archive as third axis

Observed in: jamesmaherphotography.com (010, free-text search over 1163 photos, 2003-present).

Evidence count: 1

Initial interpretation: Only one site in this dataset exposes full-text search as the primary entry. With >1000 images, search becomes legitimate alongside time/place axes.

## Year-range in project title as cheap chronology metadata

Observed in: noahkalina.com (004, "Tiny Flock (2016 - )", "Normal Houses (2020-2024)"), rinkokawauchi.com (007, "M/E 2022", "Halo 2017").

Evidence count: 2

Initial interpretation: Inline year ranges communicate duration and status (ongoing) without a date field. A useful pattern when projects are large units.

## Minimal About / no About

Observed in: jatenk.net (002, no about visible), logbuch35mm.de (011, intro line + socials only), kiichiroyoshimoto.jp (012, prominent profile but on the home, not separate), mickrock.com (025, brand site), haarkon.co.uk (001, footer link only).

Evidence count: 5

Initial interpretation: Many personal archive sites operate with near-zero About page. The About can be a footer link or a single home-page paragraph. Commercial projects (Magnum, Burtynsky) and artists with CV density (Kawauchi, Soth, Soth, Joel Meyerowitz) are the exception, not the rule.

## Image-led index pages

Observed in: haarkon.co.uk (001, cover-image grid of places), terragalleria.com (005, small random images on home), kiichiroyoshimoto.jp (012, comparison pair hero), jamesmaherphotography.com (010, search-first), joelsternfeld.com (015, bodies-of-work cards).

Evidence count: 5

Initial interpretation: Text-only landing pages are rare (only Noah Kalina'\''s main site uses one). Image-led indexes remain the default for personal archives.

## Text/photo relationship - text-free raw galleries

Observed in: folker.photography (003, raw galleries explicitly text-free), jatenk.net (002, caption-less photo sequences), noahkalina.com (004, caption slot exists but body is images only).

Evidence count: 3

Initial interpretation: When a site'\''s intent is archival sequencing rather than essay, captions are often dropped. The "viewer experience" competes with the "documentation experience"; sites that emphasize sequence omit text.

## Per-post map embed (OSM shortcode)

Observed in: logbuch35mm.de (011, custom Hugo shortcode `osm_map_v3` for per-post map).

Evidence count: 1

Initial interpretation: A clever compromise - every post carries a tiny map of its exact location; combined with a place-tag list, this gives spatial context without building a city-aggregated map.

## Place-based single long-term project (paired revisit)

Observed in: kiichiroyoshimoto.jp (012, Tokyo Time Slip 1984-2026, each entry = two photos of the same place decades apart).

Evidence count: 1

Initial interpretation: Unique model - the "Visit" entity is not needed at all if the conceptual frame is "place across time". Each entry IS a visit-pair. The simplest possible model for the repeated-visit problem.

## Era-bucket alternative to single year list

Observed in: eugenerichards.com (018, 1973-1999 and 2000-2025), kiichiroyoshimoto.jp (012, 1984-2026 as single project).

Evidence count: 2

Initial interpretation: When a career exceeds a threshold (unclear exact number, but ~20+ years seems to trigger era thinking), era buckets may communicate meaning better than a year list. Not yet evidence-supported beyond personal practice.

## Counter-pattern: photographer-as-primary (commercial)

Observed in: joelmeyerowitz.com (008, sidebar of 18+ body-of-work entries with commercial items inline), alecsoth.com (006, flat project list).

Evidence count: 2

Initial interpretation: The classic mature-artist pattern names every body of work; nav stops scaling around 15-20 items. Reasonable for ~12 projects, not for hundreds.

## Competing/contrasting models observed for "what to do with 100+ galleries"

Observed in:
- Time-only (jatenk, 002) - text-only index, no place dimension
- Place-only (terragalleria, 005; Highsmith, 022) - no time axis
- Time + Place dual (haarkon, 001) - explicit dual navigation
- Tag faceted (logbuch, 011) - flat tags, multiple dimensions
- Body-of-work (joelsternfeld, 015; lisakereszi, 019) - works as units, no time/place
- Search-first (jamesmaher, 010) - search is primary

Evidence count: 6 distinct strategies

Initial interpretation: There is no single proven model for 100+ galleries. The dataset contains competing approaches, not a single best practice. This is the most important finding for stage 2: do NOT pick a single model without weighing tradeoffs.


