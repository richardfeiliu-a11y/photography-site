# QT Luong - terragalleria.com

## Basic Information

Name: QT Luong / Terra Galleria
URL: https://www.terragalleria.com/
Access date: 2026-08-26
Country / region if known: USA (Vietnamese-French photographer)

Type:
- Archive (place-based personal photography archive, very large scale)

Research relevance:
- High

---

## Verified Structure

Homepage: text-heavy index page titled "QT Luong'\''s place-based photography archive" with random small images per section (JS arrays of image paths observed in source). Navigation: Contact / About / Blog / Prints / Licenses plus Project Portfolios.

Archive: hierarchical URL structure verified from homepage links: continent -> country -> region/city -> sub-area. Examples: /europe/france/ile-de-france/, /europe/paris/eiffel-tower/eiffel-tower.html. Also national parks and other continents linked.

Places / Locations: THE organizing principle - entire archive is a geographic tree: Europe -> France -> Paris -> Eiffel Tower etc.

About: present; commercial elements present (prints, licensing, books) but the archive itself is the core.

---

## Primary Organization

Observed primary organization: Place (deep hierarchy), with thematic secondary groupings.

Evidence: URL taxonomy and homepage link list (168+ internal page paths extracted).

---

## Homepage

- First screen: title + description + category link lists + small rotating images.
- Image usage: small thumbnails per category.
- Text amount: moderate.
- Navigation: geographic directory style.
- Featured work: books/promotions at top (commercial).
- Archive access: immediate (the whole site is an archive).

---

## Gallery Experience

Gallery URL verified: /europe/paris/eiffel-tower/eiffel-tower.html

Observed: paginated thumbnail grid ([page 1 of 2], 20 color pictures on this page out of 37), Color/Black-and-White toggle, click for larger image and details. Breadcrumb: Home / Europe / France / Paris / Eiffel Tower.

Presentation style: Grid -> detail page. Photo count explicitly displayed per section. Captions/details on larger-image pages (not fully sampled). Mobile behavior: Unknown (1990s-style fixed layout likely; not tested).

Ending behavior: pagination between pages.

---

## Archive / Index

Does an archive exist? The site IS an archive: thousands of images organized by place hierarchy, maintained since the late 1990s.

Organization: Continent -> Country -> Region/City -> Subject; also theme pages (mountains etc.) and a Map link observed on Paris page.

Information displayed per item: place name, picture count, color/BW split, page position.

Scalability: proven over ~25 years and tens of thousands of photos; deep hierarchy still navigable because each level lists only its children. This is the strongest long-term-scale evidence found so far.

---

## Place Handling

Explicit place modeling: Yes - deepest case in this dataset so far.

Country level: yes. City level: yes. Sub-city level: yes (Paris split into 13 districts/subjects: Eiffel Tower, Montmartre, Marais, Metro...).

Repeated cities: Paris is ONE persistent place entity containing many subject galleries; multiple visits across years merge into the same subject pages rather than separate visit records (inferred from structure: no year labels observed in Paris sections).

---

## Time Handling

Dates essentially absent from navigation; some date info inside blog only. Chronology is not an axis at all here - pure geography/theme. Old work stays equally discoverable as new work because organization is spatial, not temporal.

---

## Repeated Visit Problem

Approach observed: merge-by-subject. All Paris Eiffel Tower photos from all years live on one paginated page set. No per-visit separation. This is the opposite pole from jatenk (chronology-only): place-only, time erased.

Structure:

    Europe
    +-- France
        +-- Paris
            +-- Eiffel Tower   (all years merged)
            +-- Montmartre     (all years merged)
            ...

---

## Text Usage

Text level: Moderate (descriptive intros per place). Text supports discovery/navigation rather than narrative.

---

## About / Personal Identity

About visibility: standard footer/nav link. Biography length: moderate. Commercial elements: prints/licensing/books prominent but separated from browsing flow.

---

## Metadata

Visible: place names, picture counts, color/BW format. EXIF/GPS not observed on listing level.

---

## Mobile / Responsive

Unknown (not tested; legacy layout suggests poor mobile experience - marked uncertain).

## Performance Observations

Plain HTML, fast fetch, no animation. Layout shifting: none detected in markup.

---

## What Works

Facts: 25-year-old place-hierarchy archive still coherent; explicit counts; color/BW toggle; pagination keeps pages light; map link on city page.

Interpretation: deep geographic hierarchy scales far better than flat lists when volume is huge; time can be safely omitted if the archive'\''s identity is spatial.

## What Does Not Work

Facts: no chronology anywhere; commercial promos sit on top of the archive homepage.

Interpretation: without any time axis, "recent work vs old work" distinction disappears - acceptable for a legacy archive but contrary to our diary-like intent.

## Potential Lesson for Our Project (interpretation)

Upper bound proof: a pure place-tree survives hundreds of galleries. But our project wants BOTH axes, so the open question is whether time metadata can be layered onto a place-first tree without breaking it.

## Evidence URLs

- https://www.terragalleria.com/
- https://www.terragalleria.com/europe/paris/paris.html
- https://www.terragalleria.com/europe/paris/eiffel-tower/eiffel-tower.html

## Screenshots

- None captured this session.

