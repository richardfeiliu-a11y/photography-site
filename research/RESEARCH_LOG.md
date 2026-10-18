# Research Log

## 2026-08-26

### Search queries executed (Exa web search)
1. personal photography archive website chronological years minimal -> found: rgallery (tool, rejected), jatenk.net/archive (ACCEPTED), Haarkon (ACCEPTED), YearlyPhotos (product, rejected)
2. famous photographer official website archive chronology years -> Irving Penn Foundation chronology (institutional, candidate for batch 4)
3. photographer website places index city archive -> James Maher NYC archive search (ACCEPTED)
4. personal photo diary website minimal -> Moments.im (product, rejected)
5. long-term photography project website same city revisited -> New York Changing / Douglas Levere (candidate, rephotography - pending)
6. photography website archive by year minimalist personal site -> lingzikong.com yearly-albums (verified reachable; low quality fit - rejected as template portfolio)
7. japanese photographer portfolio website minimal archive -> kiyokari43.com (Wix site, weak fit - rejected)
8. Yesterdays MapRVA (map+history project, candidate for map research - pending verification)
9. QT Luong place-based photography archive (ACCEPTED via direct fetch)
10. minimal photographer website archive years -> Noah Kalina archive (ACCEPTED), folker.photography (ACCEPTED), minimal-photography Framer template (rejected - demo template)

### Direct verifications batch 1 (curl + HTML inspection, no screenshots)
- haarkon.co.uk (home, /archive, /places, /places?country=japan) - ACCEPTED 001
- jatenk.net (/archive/, /october_2025/) - ACCEPTED 002
- folker.photography (home, /locations/the-north/iceland/) - ACCEPTED 003
- noahkalina.com (+/info, archive.noahkalina.com) - ACCEPTED 004
- terragalleria.com (home link-tree extraction, paris.html, eiffel-tower.html) - ACCEPTED 005
- alecsoth.com (projects, songbook, about) - ACCEPTED 006
- rinkokawauchi.com (works, works/213 Cui Cui, biography) - ACCEPTED 007
- joelmeyerowitz.com (home, street-photography) - ACCEPTED 008
- toddhido.com (home, /homes, homes.js mapping ~60 images) - ACCEPTED 009
- jamesmaherphotography.com/images (archive search page, nav extraction) - ACCEPTED 010

### Rejected candidates and reasons
- rgallery.app / YearlyPhotos / Moments.im / Mapstra / SammaPix: products/tools, not personal archives
- kiyokari43.com: Wix builder site, thin structure
- lingzikong.com: WordPress theme portfolio, year albums present but generic commercial template
- stephenshore.org / stephenshore.com: unreachable/empty responses this session - Status: Unable to verify
- masao-yamamoto.co.jp, daidomoriyama.com: unreachable/empty - Unable to verify
- hans-eijkelboom.nl: main page loads but /en/ 404; site structure unclear - deferred

### Notes on tooling
- Exa search sometimes returns empty for quoted/multi-word queries; single natural phrases work better.
- Screenshots not captured this session; plain HTTP + HTML structure inspection used as evidence. Mobile behavior remains Unknown across cases unless later browser testing is added.



### Search queries executed (continued, Exa web search + direct curl)

Batch 2 (independent archives, repeat-visit cases):
- "famous photographer official website archive chronology years" -> Irving Penn Foundation, RGallery (rejected tool)
- "photographer website places index city archive" -> jamesmaherphotography (ACCEPTED 010)
- "long-term photography project website same city revisited" -> Douglas Levere New York Changing (pending direct verify)
- "photography website archive by year minimalist personal site" -> lingzikong (rejected template)
- "japanese photographer portfolio website minimal archive" -> kiyokari43 (rejected Wix builder)
- "QT Luong place-based photography archive" direct verify -> ACCEPTED 005
- "minimal photographer website archive years" direct verify -> ACCEPTED 004

Batch 3 (multi-anchor search):
- "photographer revisiting same city project" (Exa returned 1 weak hit: newyorkchanging)
- "photo diary travel blog archive" (Exa empty)
- "photography portfolio places map interactive" (Exa empty)
- "european photographer minimalist website archive projects" (Exa empty)
- "magnum photographers list archive" (Exa empty)
- "ICP museum photography collection archive" (Exa empty)
- "New York Times Lens photo essay sequence" (Exa empty)

Batch 4 (curated known photographers, direct curl):
- Aaron Hobika sites, Mick Rock, Eugene Richards (ACCEPTED 018), Edward Burtynsky (ACCEPTED 023)
- Lisa Kereszi (ACCEPTED 019), Thomas Sandberg (ACCEPTED 024 anti-pattern)
- Wolfgang Tillmans, Trent Parke, Matt Stuart, ShibaNYC, Yutaka Sone, Sergio Larrain, Gregory Crewdson - mostly empty or JS-only; documented in CASE_INDEX
- Joel Sternfeld (ACCEPTED 015) - high signal: photos/books/writings triplet per body
- Carol M. Highsmith (ACCEPTED 022) - LOC institutional reference
- Stephen Shore (021) - Unable to verify (SSL mismatch)
- Kiichiro Yoshimoto (ACCEPTED 012) - Tokyo Time Slip 1984-2026, paired revisit model
- Logbuch35mm (ACCEPTED 011) - tag + per-post map embed
- Laurent Dufour (ACCEPTED 013) - single-city theme split

### Sites rejected this round (reasons)
- thomas-munro.com: title only, no archive structure
- mick-rock: opaque JS shell
- robertdavidsonphoto.com: empty response
- garycalton.com: "PORTFOLIOS / Stories / Gallery / VIDEO / BIO / CONTACT" - six-tab standard, not archive; documented but not in final 25
- kahn.gallery, mattblackphoto.com, simonroberts.com, alexprattphoto.com, yasuhiroisimoto.com, ruthbarnard.com, gregorycrewdsontest, adamschlesinger.com, bokeh.photo, joelsternfeld.com (ACCEPTED 015, but JS-rendered), kirsty-mitchell (NewRelic shell), rorybain (placeholder), mjstone.photo (placeholder), trentparke minimal Saigon (empty), shibanyc (empty) - mostly empty/unreachable

### Status
- 25 cases written, end of session 2026-08-26
- Next stages should: (1) capture browser screenshots for high-relevance cases; (2) re-verify Stephen Shore and any case marked Unable; (3) consider 3-5 more cases in 25-40 target if scope warrants


### Archive note (2026-09-19, index-line only)
- `research/screenshots/` and `research/final-visual-review/screenshots/` were moved out of the Git tree to `<archive>/research/` — see `docs/archive/research-screenshots-POINTER.md` for the SHA-256 snapshot and restore instructions.
