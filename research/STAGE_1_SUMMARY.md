# STAGE_1_SUMMARY

## Dataset

- Search queries executed: ~25 (Exa web search + direct curl)
- Candidates surfaced: ~70
- Actually verified by direct fetch: 25
- Final retained: 25 (9 High, 10 Medium/Medium-High, 6 Low/Control/Anti-pattern)
- Unable to verify: 1 (Stephen Shore)
- Native browser screenshots: 0
- Exa search coverage: mixed - many queries returned empty; most discovery came from direct curl on known candidates and on Exa'\''s "best match" hits

## Strongest Evidence Areas

1. Place hierarchy as the most-scaled model: Terragalleria (continent->country->region->subject, ~25 years), Haarkon (place cards, 11 years, 430 posts), Highsmith/LOC (state->city->subject, tens of thousands of images), folker.photography (region->place). All four verified; place hierarchy is empirically the model that survives largest volumes.

2. Time-axis as plain year index: Haarkon archive (per-year counts), ICP past exhibitions (700+ since 1974), jatenk (text-only year list). The plain year index scales to 700+ entries when paired with "load more" pagination.

3. Per-item numeric metadata: Joel Sternfeld (photos/books/writings triplet per body), Terragalleria (picture counts per subject), James Maher (total count + date range). This is the highest-leverage information-design move for scannable lists.

4. Minimal About / image-led homepage: Haarkon, jatenk, logbuch35mm, kiichiroyoshimoto, mick-rock all show that personal archives routinely operate with near-zero About page. Photography can stand without biographical text.

5. Gallery presentation: text-free raw galleries (folker), image-led blog posts (logbuch, jatenk), fullscreen slideshow (Todd Hido), vertical sequence (Terragalleria Eiffel Tower). Multiple viable styles; no dominant model.

## Weak Evidence Areas

1. Repeated-visit handling: Five sites touch it (folker, yoshimoto, jatenk, haarkon, terragalleria) but with five different approaches. NO consensus. The Visit entity question from the brief is empirically UNRESOLVED.

2. Place hierarchy vs place tag: Only two sites test the flat-tag model (logbuch, partially haarkon). Long-term scalability of the tag model is unverified beyond a few years.

3. Search-first at personal scale: James Maher is the only verified case of full-text search as a primary axis. Its effect on user behavior is unmeasured.

4. Mobile experience: All cases marked "Unknown" because no browser testing was done. Desktop HTML inspection only.

5. Map-based archive: No personal archive in the 25 uses a map as the primary entry surface. Mapstra/SammaPix are products, not archives. The "map first" idea has no community validation in this dataset.

6. Asian/non-Western sites: Logbuch35mm and Kiichiro Yoshimoto are the only two non-English-language cases verified. Chinese and Korean personal archive sites remain UNVERIFIED in this session.

## Recurring Patterns (2+ cases each)

- Chronological year index with per-year counts: 5 cases (haarkon, jatenk, icp, terragalleria-via-map-link, eugenerichards)
- Place-first / geographic hierarchy: 6 cases (terragalleria, folker, haarkon, laurentdufour, jamesmaher, highsmith)
- Place-tag (flat) alternative: 2 cases (logbuch, haarkon)
- Per-item numeric metadata triplet: 4 cases (joelsternfeld, terragalleria, jamesmaher, haarkon)
- Repeated-visit handled 5 different ways: 5 cases (folker-5-patterns, yoshimoto-pair, jatenk-flat, haarkon-cards, terragalleria-merged)
- Minimal or absent About: 5 cases
- Image-led index pages: 5 cases

## Interesting Outliers

- yoshimoto Tokyo Time Slip: each entry IS a place+year pair (one entry = one visit-pair). A different model from all others; closest to "minimal visit entity".
- archive.noahkalina.com: deliberately random/shuffled; mobile-excluded. A "playground" model that explicitly sacrifices chronology.
- logbuch35mm: per-post map embed + flat tags + per-tag counts. A low-cost stand-in for hierarchical place.
- jamesmaherphotography: full-text search as the only navigation needed for 1163 photos. A "search-first" model.

## Contradictory Evidence

1. Repeat-visit question: 5 sites, 5 different answers. No synthesis possible without making a choice.

2. "Should time be a primary axis at all?" - Terragalleria and Highsmith say NO (huge place-only archives that survive 20+ years); jatenk says NO (chronology-only, no place); Haarkon says YES (both axes); yoshimoto says YES (place+year pair). The evidence does not converge.

3. "Should the site have an About?" - 5 sites say no/minimal; 4 artist sites (Kawauchi, Soth, Meyerowitz, Burtynsky) have heavy CV. Depends on whether the work needs institutional positioning.

4. "Should the homepage be image-led or text-led?" - 5 sites image-led; 1 (noahkalina main) text-only. Either works.

5. "Map vs list vs search?" - map: no community validation; list: proven at 700+ scale; search: only one large case (James Maher). Cannot conclude.

## Questions for Stage 2

The synthesis model should consider the following:

1. Which "axis combination" is the right default: time+place (Haarkon model), place+visit-pair (Yoshimoto model), tag-facetted (Logbuch model), or search-first (James Maher model)?

2. At what volume should we move from flat lists to hierarchical indexes? Cases suggest ~30-50 entries is a soft threshold.

3. Should our "Gallery" unit ever be split into sub-galleries (folker'\''s per-trip pattern), or always kept atomic?

4. Should we expose a map (per-post or aggregated) - given the lack of community validation, is this a high-risk bet?

5. Should the home page be one giant photo (book-style), a grid (haarkon model), a text list (noahkalina model), or a search box (jamesmaher model)?

6. How visible should counts be (photo count, year, duration) on each list entry?

7. What is the minimum viable About page that satisfies the brief'\''s "克制" criterion without being absent?

8. Should "Visit" be an explicit entity in the data model, or is it implicit per gallery (yoshimoto'\''s implicit-pair model)?

9. Given the five competing sub-patterns at folker alone, do we need a configurable merge/split decision rule, or do we accept inconsistency?

10. What is the right ratio of personal-archive (logbuch-style) to artist-book (kawauchi-style) to institutional (icp-style) in our reference set, given the brief'\''s personal-archive bias?

## Final Statement

Evidence currently suggests the dataset contains competing approaches, not a single best practice. Stage 2 must weigh tradeoffs rather than pick from a clear winner. The 25 verified cases provide raw material for synthesis but explicitly do not converge on the questions the brief asks (especially repeated-visit handling).

Note: this stage did not produce a final design recommendation per the brief'\''s rule that this round stops at evidence.



## Update (end of session, 2026-08-26)

Total cases: 27 (was 25). New additions:
- 026 Christopher Burkett (control: single-medium, zero archive)
- 027 "Under construction" collection (anti-pattern: site dies during upgrade)

Chinese / Korean / interactive-map searches did not yield new candidates this session despite targeted Exa + curl attempts; recorded as a known gap in GAPS.md.

Total Top-level deliverables in <repo>/research/:
- CASE_INDEX.md
- PATTERN_NOTES.md
- ANTI_PATTERNS.md
- RESEARCH_LOG.md
- STAGE_1_SUMMARY.md
- GAPS.md (newly added)
- screenshots/README.md (placeholder explaining the screenshot gap)
- cases/001-027 (27 case files)



## Update (after batch 6 additions)

Total cases: 30 (was 27). New additions:
- 028 Hiroshi Sugimoto (Japan; verified; single-hero legacy artist site)
- 029 Tuchong (China; verified; photo community platform - not personal archive but closes the CN gap)
- 030 Fengniao (China; verified; photo community platform)

Total screenshots: 35 (added hiroshi-sugimoto.png, tuchong.png, fengniao.png, plus 1 010-search-mobile re-capture).

The CN/KR personal-archive gap is now formally documented: 3 attempts via direct curl to known personal-archive photographers (Yanfan, Wengfen, Li Zhan, Yao Lining, Lianjin, Zhu Zhe, Zhuangbin, Lam Wai Kit) all returned blank or were unreachable. The community platforms (Tuchong, Fengniao) succeed where the personal archives do not - this is a real finding worth preserving in PATTERN_NOTES.

Reflections updated: stage 2 must consider that the personal-archive pattern is WEAKER in non-Western contexts, which may affect the final design'\''s portability.

