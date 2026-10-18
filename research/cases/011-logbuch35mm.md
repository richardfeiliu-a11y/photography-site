# Logbuch35mm - Hamburg/Nordheide photoblog

## Basic Information

Name: Logbuch35mm (Michael)
URL: https://logbuch35mm.de/
Access date: 2026-08-26
Country / region if known: Germany (Nordheide near Hamburg; shoots in Hamburg)

Type:
- Personal photo blog (Hugo static site, "Fotoblog" + photo-essays)

Research relevance:
- High

---

## Verified Structure

Homepage: latest posts as card list (entry-cover image + h2 title). No hero. Nav has only two items: categories, tags. About/contact info lives in social-icons (Mastodon, Email, RSS).

Sitemap shows posts use /YYYY/MM/slug/ permalinks and are tagged with place names, themes, cameras, and series.

Archive: NONE in classical sense. Discovery axes are categories (3 total: Fotologbuch 27, Gedanken zur Fotografie 2, Technik 5) and tags (60+ tags with per-tag post counts: Hamburg 10, Hafen 3, Hafen-City 2, Wald 1, Lost-Place 2, Bremerhaven 2, Bremen 1, Dänemark 1, Schnee 3, etc. plus camera tags like Nikon 4, D750 2, Pentax-Me 1).

About: minimal on-page; identity via Mastodon handle and email.

---

## Primary Organization

Observed primary organization: Tag-based faceted browsing of chronologically ordered posts. No place hierarchy; no year index.

Evidence: categories=3, tags=60+ with counts, posts organized only by publish date. Place IS one of many tag dimensions, not a hierarchy.

---

## Homepage

- First screen: latest post covers.
- Image usage: cover image per post (srcset responsive).
- Text amount: short intro line only.
- Navigation: 2 items + socials.
- Featured: newest posts first.

---

## Gallery Experience

Post URL verified: /2026/04/heinschenwalde/ (26 imgs, map embed, ~247 words body).

Presentation style: Markdown post with inline images and a custom shortcode for an OpenStreetMap (osm_map_v3) with markers. Tags appear as a chip list at the bottom.

Captions: minimal; narrative around the photos. Keyboard: unknown. Mobile: unknown.

---

## Archive / Index

No archive, no year index. Sitemap and tag system are the only structured discovery.

Tag page (/tags/hamburg/) shows: "Hamburg | Logbuch35mm ... Home Tags Hamburg Eine Ode an die Masten ... Masten Masten Grüppchen ... faszination Hochspannungsmasten ...". Each tag page is a list of post titles that use the tag.

Scalability: tag-based discovery scales by tag proliferation, not by structural change. As posts grow, the tag cloud grows; categories stay flat.

---

## Place Handling

Place is a tag, not a hierarchy. Observed place tags (with counts): Hamburg 10, Bremen 1, Bremerhaven 2, Dänemark 1, Heinschenwalde 1, Schneeverdingen 1, Lüneburger Heide 1, Nordfriesland 1, Sandbostel 1, Rade 1, Schloss Bückeburg 1.

Country level: implicit (Dänemark tag = Denmark). City level: yes via Hamburg tag. District level: yes via Hafencity, Schanze etc. tags.

Repeated cities: not aggregated; each Hamburg post appears in the Hamburg tag list with chronological title, and there is no separate "all Hamburg" page beyond that list. Same model as Haarkon but as flat tag lists rather than cards.

---

## Time Handling

Posts ordered reverse-chronologically on the homepage. No year/month navigation pages; sitemap is the only chronology listing. Each post shows its publish date in the post header (e.g. 2026-04-12, 247 words, byline).

---

## Repeated Visit Problem

Approach: same as Haarkon - each visit becomes its own post; place is a tag listing. Different visits to Hamburg (e.g. Hafencity, Masten, Hafen) all show up under the same Hamburg tag, with a chronological list and no way to see them on a map together except the per-post OSM embed.

---

## Text Usage

Text level: low-to-moderate. Each post has a short reflective paragraph. Identity is bare-minimum (name, socials, intro line).

---

## About / Personal Identity

About visibility: very low (intro + socials). No biography page. Commercial elements: none.

---

## Metadata

Visible: publish date, post title, tag chips, byline "mike", word count.

Per-photo: no visible EXIF/GPS at post level; map shows post GPS center.

---

## Mobile / Responsive

Hugo PaperMod template; responsive by default. Not browser-tested in this session.

## Performance Observations

Static HTML + responsive srcset images; plain fetch instant.

---

## What Works

Facts: tag-based faceted search gives multi-dimensional discovery (place, theme, camera, time) without structural rewrites; map embed per post shows location; posts have minimal metadata overhead.

Interpretation: a flat tag model can be a very cheap substitute for hierarchical place navigation - and grows with content without new design.

## What Does Not Work

Facts: 60+ tags and 3 categories look chaotic from the outside; no map of all places; no "all Hamburg on one map" view; per-post OSM embeds cannot be combined.

## Potential Lesson for Our Project (interpretation)

Strong reference for the "tag-as-place" model. Worth comparing stage 2 against a hierarchical place model: which gives better long-term discoverability, a place tree or a place tag plus map?

## Evidence URLs

- https://logbuch35mm.de/
- https://logbuch35mm.de/tags/
- https://logbuch35mm.de/categories/
- https://logbuch35mm.de/tags/hamburg/
- https://logbuch35mm.de/2026/04/heinschenwalde/
- https://logbuch35mm.de/sitemap.xml

## Screenshots

- None captured this session.

