# Haarkon - Travel, photography and places

## Basic Information

Name: Haarkon (India and James Hobson)
URL: https://www.haarkon.co.uk/
Access date: 2026-08-26
Country / region if known: United Kingdom

Type:
- Mixed (travel journal + photographic archive, personal)

Research relevance:
- High

---

## Verified Structure

Homepage: Grid of recent Place cards (title + country/region label), header with Places / Search / Archive links.

Primary navigation: Places, Search, Archive, Info, About, Shop.

Projects / Galleries: Each entry is a Place page = one location visit with a photo set and short notes.

Archive: /archive - chronological year index. Observed text: "Browse Haarkon chronologically... Browse by year. 430 posts; 2026: 22 posts; 2025: 67 posts; ... 2015: 6 posts."

Places / Locations: /places - filterable place index by country (Australia 4, Cambodia 9, England 133, France 10, Germany 4, Japan 62, Netherlands 13, Scotland 27, Singapore 20, Sweden 6). Each card shows title + city/region + country.

About: Present but low-weight in footer (Info / About).

Other: Search across places, posts and destinations.

---

## Primary Organization

Observed primary organization: Place-first, with parallel Chronology archive.

Evidence: Homepage defaults to Places; Archive exists as separate year-by-year view of the same posts. Same content reachable through both dimensions (verified on homepage, /archive, /places).

---

## Homepage

- First screen: header + grid of place cards with photos.
- Image usage: cover images per place entry.
- Text amount: minimal (title + location line per card).
- Navigation: top-level Places / Search / Archive.
- Featured work: recent entries first.
- Archive access: direct link in header/footer.

---

## Gallery Experience

Gallery URL example: /places/netherlands-flora (structure verified via /places listing; individual pages are photo sets with notes).

Presentation style: Vertical sequence within each place page; site-wide grid for indexes. Lightbox behavior: Unknown.

Approximate photo count: varies per post; not systematically shown.

Captions: short prose notes accompany photos (observed via text extraction).

Mobile behavior: Unknown (not tested in browser).

Ending / next-gallery behavior: Unknown.

---

## Archive / Index

Does an archive exist? Yes.

Organization: Year -> posts (430 posts, 2015-2026, counts per year displayed). Also Places index organized Country -> specific place entries.

Information displayed per item: Year, post count; per-place: title, city/region, country.

How scalable does it appear? Year counts grow linearly (22-72 per year observed); the two-axis model has been maintained since 2015 with no visible structural breakdown.

---

## Place Handling

Does the site explicitly model places? Yes - core organizing entity.

Country level: yes (filter list).
City level: yes, shown on cards (Kyoto Japan, Cornwall England).

Repeated cities: Kyoto appears multiple times as distinct place entries (Kinkaku-Ji Temple, Gio-Ji Temple Garden, Arashiyama etc.) - the unit is the specific visited spot, not the city itself.

Multiple visits to one place: each visit/post is its own Place record; no evidence of a merged per-city page aggregating all visits. City appears only as metadata on cards.

Example: Japan filter shows 62 places including many separate Kyoto entries.

---

## Time Handling

Exposes: Year (archive). Post dates inside entries not verified in detail; month labels not observed at index level.

Chronology is a secondary axis: /archive lists all posts grouped by year with counts; homepage and places do not show dates prominently.

---

## Repeated Visit Problem

Specifically investigated. Evidence found:

Structure observed:

    Country (Japan)
    +-- City metadata (Kyoto) on individual place-visit cards

No Kyoto hub page combining all visits found; every visit to any Kyoto spot becomes an independent Place entry under the country filter.

Interpretation (interpretation): dual-axis access works (country browse + year archive), but repeated cities fragment into sibling cards rather than a unified city history.

---

## Text Usage

Text level: Minimal-to-moderate. Short narrative notes on place pages; near-zero on indexes. Text supports photography; indexes are image-led.

---

## About / Personal Identity

About visibility: Low (footer link). Biography length: short (about page exists, not fully read this session).

Commercial elements: Shop, Substack, Instagram links present but visually secondary.

---

## Metadata

Visible metadata: Title, city, region, country, year (archive only). No camera or EXIF observed at index level.

---

## Mobile / Responsive

Unknown (desktop HTML inspected only).

## Performance Observations

Pages loaded quickly via plain fetch; no heavy animation detected in markup. Layout shifting: unable to assess without browser.

---

## What Works

Facts: Dual-axis navigation (Places + chronological archive) over one content pool; consistent title+location metadata on cards; per-year counts in archive.

Interpretation: One of the closest live examples of the chronological AND geographical requirement, sustained over 11 years and 430 posts.

## What Does Not Work

Facts: No per-city aggregation; repeated Kyoto visits fragment into dozens of sibling entries under Japan.

Interpretation: At larger scale, city-level discovery inside a big country depends entirely on search and filtering.

## Potential Lesson for Our Project (interpretation)

A Place index can be built from visit-records rather than city hubs; whether an intermediate city layer is needed is exactly the open question this case exposes but does not answer.

## Evidence URLs

- https://www.haarkon.co.uk/
- https://www.haarkon.co.uk/archive
- https://www.haarkon.co.uk/places
- https://www.haarkon.co.uk/places?country=japan

## Screenshots

- None captured this session (plain HTTP verification only).

