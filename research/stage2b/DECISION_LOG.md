# Stage 2B1 Decision Log

Evidence describes what has been observed; product rationale records an intentional project choice. “Reversible” estimates product/IA cost, not code effort.

## D01 — Latest-first Home

**Decision:** Home is a latest-first hybrid. If one published Gallery is manually featured, show it; otherwise show the latest by `date added/published` descending. Featured is limited to one optional Home-presentation override and does not affect photographed date, Archive/Place order, or canonical URL.  
**Evidence:** Image-led and project-led entries are feasible; Stage 2A shows discovery and viewing are different tasks but does not prove homepage superiority.  
**Product rationale:** The project must first feel like photography while still revealing its durable archive.  
**Trade-off:** Complete archive structure is not the first visual object; a featured override adds one small editorial state to maintain.  
**Confidence:** Medium  
**Reversible:** Easy  
**Prototype needed:** Yes — Test 1

## D02 — Gallery definition

**Decision:** Gallery is a titled, dated, covered, explicitly ordered set of Photos with one coherent photographic/editorial proposition. Trips, Visits, shoots, batches, and photo count do not define it.  
**Evidence:** Both Stage 1 teams independently found Project/Series/Gallery to be a stable viewing unit and strong counterevidence to fixed size/Visit boundaries.  
**Product rationale:** A durable archive needs a public content unit based on what should be viewed together.  
**Trade-off:** Publishing requires editorial judgment; it cannot be fully automated from folders or dates.  
**Confidence:** High  
**Reversible:** Expensive  
**Prototype needed:** No

## D03 — Archive equals Chronology

**Decision:** Archive is a top-level destination organized by photographed year. There is no separate Chronology page; months are not a navigation layer.  
**Evidence:** Chronology has High long-term feasibility, while evidence does not require a separate primary Chronology label.  
**Product rationale:** One clear complete index minimizes navigation and makes historical retrieval predictable.  
**Trade-off:** Users who think first in themes have only Place as a second MVP discovery path.  
**Confidence:** High  
**Reversible:** Moderate  
**Prototype needed:** No

## D04 — Place has four active layers

**Decision:** Place exists as public Gallery metadata, a persistent lightweight entity, a secondary top-level Places destination, and a generated Place landing page.  
**Evidence:** Place metadata/facet feasibility is High; persistent Place and visible navigation applicability are Medium/category-dependent.  
**Product rationale:** Repeated-place discovery is a named long-term goal and cannot be solved by chronology alone. A persistent entity prevents Paris from fragmenting across years.  
**Trade-off:** Adds editorial discipline for naming/aliases and a second index that many artist-project sites omit.  
**Confidence:** Medium  
**Reversible:** Moderate  
**Prototype needed:** Yes — Test 2

## D05 — Place page uses progressive photographed-time organization

**Decision:** `/places/paris` returns Gallery cards. Low-volume pages use a flat reverse-chronological list; year headings appear progressively when repeated years, volume, and scanning clarity justify them. It never shows raw photo pools or Visit groups.  
**Evidence:** Stage 2A found weak precedent for this exact structure, but strong evidence that Gallery is the viewing unit and time/place can reference one object without duplication.  
**Product rationale:** It directly answers “what work did I make in Paris across years?” while preserving authored Galleries.  
**Trade-off:** The transition needs prototype judgment rather than a fixed rule; evidence does not establish superiority. This remains a project-specific product choice.  
**Confidence:** Medium  
**Reversible:** Easy  
**Prototype needed:** Yes — Test 2

## D06 — Do not model Visit in MVP

**Decision:** Visit is not modeled in MVP: no entity, product field, navigation, URL, grouping, or parent. Capture date/time and available ingestion/provenance context remain preserved; no `visit_id`, `trip_id`, or `shoot_id` is introduced.  
**Evidence:** Both research sets found no stable mature public Visit layer; strong counterexamples absorb many real visits into a Project. Stage 2A lacked evidence for an internal entity, so Stage 2B1 resolves the MVP choice through YAGNI.  
**Product rationale:** Gallery dates, Photo dates, Place, and editorial ordering already solve defined needs. An unused entity would add maintenance without user value.  
**Trade-off:** A future workflow may still need a new entity and explicit decision, but recoverable raw context has not been intentionally destroyed.  
**Confidence:** High  
**Reversible:** Moderate  
**Prototype needed:** No

## D07 — Sequence-first Gallery with overview

**Decision:** MVP uses vertical ordered sequence as primary mode. Overview/light table is the recommended MVP default, but inclusion is gated by Test 3; if it fails, MVP is sequence-only. Fullscreen and swipe-first/slideshow-first are not MVP defaults.  
**Evidence:** Sequencing and overview each have multiple precedents; evidence supports complementary tasks but not universal dual-mode superiority.  
**Product rationale:** Sequence protects authorship; overview reduces disorientation in long Galleries without making grid the entry mode.  
**Trade-off:** A second mode increases interaction and testing cost and may encourage skipping.  
**Confidence:** Medium  
**Reversible:** Moderate  
**Prototype needed:** Yes — Tests 3 and 4

## D08 — Minimal public metadata

**Decision:** Discovery cards show title, photographed date/range, Place when known, photo count, and cover. Inside Gallery viewing, photo count is contextual/optional, normally appearing only when it aids orientation such as within an admitted Overview. Description, captions, exact Photo dates, and country/region are contextual; publication/equipment/EXIF data remain hidden.  
**Evidence:** Both sets repeatedly show title/date/place/count as high-value visible metadata; rich equipment/institutional fields are exceptional and context-specific.  
**Product rationale:** The minimum context supports discovery without turning viewing into a database interface.  
**Trade-off:** Technical-practice or research-oriented visitors cannot browse by camera, film, or exact coordinates.  
**Confidence:** High  
**Reversible:** Easy  
**Prototype needed:** No

## D09 — Separate photographed and published dates

**Decision:** Photographed date/range drives Archive and Place grouping; added/published timestamp drives Home latest ordering and remains normally hidden.  
**Evidence:** Stage 1 directly observed capture date differing from publication date in backfilled archives.  
**Product rationale:** Historical truth and editorial recency are both preserved without conflation.  
**Trade-off:** Every Gallery needs two date concepts and clear editorial handling of approximate/multi-year work.  
**Confidence:** High  
**Reversible:** Expensive  
**Prototype needed:** No

## D10 — Navigation budget

**Decision:** The site name links Home; the three labeled top-level items are Archive, Places, About. Gallery remains contextual.  
**Evidence:** Long flat navigation is a repeated risk; the project requires time, place, viewing, and minimal identity but not symmetric page labels for every concept.  
**Product rationale:** Four stable destinations survive growth without adding Work/Projects/Chronology/Map/Search/Contact labels.  
**Trade-off:** Contact is one level inside About/footer, and Gallery has no permanent navigation label.  
**Confidence:** High  
**Reversible:** Easy  
**Prototype needed:** No

## D11 — Minimal independent About

**Decision:** Keep a low-weight About page with project purpose, minimal identity, Contact, and selected Social links; no homepage biography block or separate Contact page.  
**Evidence:** Minimal About feasibility is High, but research does not show it is universally superior.  
**Product rationale:** The archive needs authorship and a contact route without becoming a career brochure.  
**Trade-off:** Less institutional/CV context for visitors seeking professional credentials.  
**Confidence:** High  
**Reversible:** Easy  
**Prototype needed:** No

## D12 — Progressive discovery capability

**Decision:** Search and pagination are behavior-triggered Later capabilities. The formal trigger is failed known-Gallery retrieval or materially poor page scanning/performance; 80/300 Gallery scenarios are review checkpoints only. Map, tags, generic facets, and filter dashboards are Not planned.  
**Evidence:** Search has limited personal precedent but credible scale utility; Map strength comes mainly from large institutions; tags directly show facet-explosion risk.  
**Product rationale:** Archive and Places solve current discovery with less UI and maintenance. Search can be added without changing canonical entities or navigation.  
**Trade-off:** At Medium scale, some known-item searches may remain slower until evidence justifies Search.  
**Confidence:** Medium  
**Reversible:** Easy  
**Prototype needed:** No for MVP; retrieval validation at review checkpoints

## D13 — Stable Photo identity; Multi-Gallery reuse deferred

**Decision:** Photo has stable identity. MVP operates as if each Photo belongs to one Gallery; Multi-Gallery reuse is not an MVP requirement and may be introduced later for a concrete editorial case without duplicating the underlying asset.  
**Evidence:** Stage 1 proves reuse can occur in long-term practice, but no Stage 2B1 scenario or MVP capability requires it now.  
**Product rationale:** Preserve future editorial freedom without paying the membership/caption-ownership complexity before a real case exists.  
**Trade-off:** The first concrete reuse case requires a new semantic decision rather than working immediately.  
**Confidence:** High  
**Reversible:** Moderate  
**Prototype needed:** No

## D14 — Canonical Gallery URL

**Decision:** Every Gallery has one semantic canonical route `/galleries/{gallery-slug}`. Home, Archive, and every Place page reference that same URL; optional `/archive/{year}` views do not create alternate Gallery identities.  
**Evidence:** Stage 2A strongly supports one content object through multiple Time/Place discovery paths without duplication.  
**Product rationale:** Stable identity prevents navigation context from fragmenting one editorial work and makes later discovery changes reversible.  
**Trade-off:** Slug and redirect policy will require care in later technical design; the semantic route is costly to reverse after publication.  
**Confidence:** High  
**Reversible:** Expensive  
**Prototype needed:** No
