# Stage 3C — Real-Photo Fixture Manifest (Phase 2)

Status: **frozen fixture contract for Stage 3C implementation and gate evaluation.** Every photo used by the prototype is named here with its fixture role, statistics, and derived-asset path. Nothing in `media/stage3c-fixtures/` is modified; all renderable assets are derived into `prototype-stage3c/assets/derived/`.

Companion Phase 1 artifacts: `SOURCE_INVENTORY.md` / `SOURCE_INVENTORY.json` (113 files, 113 decodable JPEGs + 1 `.DS_Store` recorded as non-image, untouched). Statistics legend: `L` = mean luminance (0–255), `S` = mean HSV saturation (0–255), `C` = grayscale stddev (contrast). Dimensions are EXIF-orientation-normalized.

---

## 1. F01–F10 coverage

| ID | Category | Assigned source photo(s) | Notes |
|---|---|---|---|
| F01 | Bright / high-key | `DSC02071.jpg` (primary; L179.1 S30.2), `DSC02092.jpg`, `DSC02259.jpg`, `DSC02066.jpg` | Bright snow/winter frames whose edges approach canvas `#F6F4EF` — the G2 edge-disappearance test. |
| F02 | Dark | `DSC01889.jpg` (primary; L25.3), `DSC02327.jpg` (L46.7, near-neutral), `DSC01905.jpg`, `DSC02454.jpg`, `DSC01876.jpg` | Deep blacks / low overall luminance. `DSC01889` is the darkest decodable work. |
| F03 | Low-contrast | `DSC02454.jpg` (C19.2, primary), `DSC02466.jpg` (C27.0), `DSC02259.jpg` (C32.5), `DSC02066.jpg` (C32.6) | Flat tonal range. |
| F04 | Highly saturated | `DSC02560.jpg` (S245.9, primary), `DSC02559.jpg`, `DSC02568.jpg`, `DSC02573.jpg`, `DSC01832.jpg`, `DSC01958.jpg` | Strong color against the warm canvas — G2 cast check. |
| F05 | Landscape | nearly all core set; primary `DSC01836.jpg`, `DSC02367.jpg`, `DSC02762.jpg` | Ordinary wide 3:2 frames; panorama-ish extras `DSC02575.jpg`, `DSC01859.jpg`, `DSC01861.jpg`. |
| F06 | Portrait | `DSC02416.jpg` (primary; bright portrait), `DSC02851.jpg`, `DSC01927.jpg`, `DSC02271.jpg`, `DSC02796.jpg`, `DSC02542.jpg`, `DSC02559.jpg`, `DSC02560.jpg` | Tall frames for the 80svh/82svh rules (G03, G5, G6, G7). |
| F07 | Dense composition | `DSC01935.jpg` (primary), `DSC02020.jpg`, `DSC01960.jpg`, `DSC01832.jpg` | Detail throughout, meaningful content near edges (G5 edge-content check, G6 recognition). |
| F08 | Minimal composition | `DSC02233.jpg` (primary), `DSC02339.jpg`, `DSC02335.jpg`, `DSC02362.jpg` | Large negative space; G6 minimal-thumbnail recognition. |
| F09 | Black & white | **SUBSTITUTION** — `DSC02066.jpg` (primary substitute; S28.0, lowest saturation among dark-capable frames), `DSC02055.jpg` (S27.4), `DSC02327.jpg` (near-neutral dark, S49.1) | The archive contains **no true B&W photograph** (minimum measured mean saturation across all 113 JPEGs is 27.4). Per the matrix rule "substitute the closest real work and record the substitution", the near-neutral snow frames stand in for the neutral-palette check. Consequence recorded: G2's "palette must not look colored beside B&W" is evaluated as "beside the most neutral real frames available"; a true zero-saturation stimulus is not testable from this archive. |
| F10 | Color | all core set photos (default state) | Normal color photography — no special assignment needed. |

One photo may (and does) cover multiple fixture IDs; no artificial one-to-one mapping was forced.

## 2. Core stress set (17 photographs)

Selection principle: maximum gate coverage with the fewest photos. Photos outside this set serve only archive-card variety, recent-set variety, and Overview extent — never gate decisions on their own.

| # | Source filename | Fixture IDs | Orientation / size | Visual characteristics (L/S/C) | Why selected | Pages / gates using it | Derived asset path |
|---|---|---|---|---|---|---|---|
| 1 | `DSC02071.jpg` | F01, F05, F10 | landscape 2048×1365 | L179.1 S30.2 C55.6 — brightest frame in archive | Brightest high-key stress: canvas edge disappearance, hero/G5 bright case | Home hero variant; G1, G2, G3, G5 (bright), G7 (bright final); gallery `swiss-winter-quiet` | `assets/derived/DSC02071/{display.jpg,thumb.jpg}` |
| 2 | `DSC02066.jpg` | F01, F03, F09(sub), F05, F10 | landscape 2048×1365 | L168.4 S28.0 C32.6 — near-neutral high-key | F09 substitution anchor + low-contrast + high-key triple coverage | G2 (neutral check), G1; gallery `swiss-winter-quiet` | `assets/derived/DSC02066/{display.jpg,thumb.jpg}` |
| 3 | `DSC02055.jpg` | F09(sub), F01, F05, F10 | landscape 2048×1365 | L159.0 S27.4 C70.2 — most neutral frame measured | Second F09 substitute; carries the Chinese-caption case | G2, G1 (Chinese caption); gallery `swiss-winter-quiet` | `assets/derived/DSC02055/{display.jpg,thumb.jpg}` |
| 4 | `DSC01889.jpg` | F02, F05, F07, F04, F10 | landscape 2048×1365 | L25.3 S192.6 C50.3 — darkest frame, saturated | Darkest edge-visibility stress + dark hero + G7 dark final | Dark hero variant; G1, G2, G3 (dark cover), G5 (dark), G7 (dark final); gallery `red-lanterns` (cover + final) | `assets/derived/DSC01889/{display.jpg,thumb.jpg}` |
| 5 | `DSC02327.jpg` | F02, F03, F09(sub), F05, F10 | landscape 2048×1365 | L46.7 S49.1 C35.0 — near-neutral dark | Neutral-dark palette check; dark sequence without hue | G2, G6 (dark thumb); gallery `tromso-city-nights` | `assets/derived/DSC02327/{display.jpg,thumb.jpg}` |
| 6 | `DSC02466.jpg` | F03, F05, F10 | landscape 2048×1365 | L95.9 S69.3 C27.0 — flat tonal range | Low-contrast legibility on warm canvas | G2 cast/contrast check; synthetic `long-gallery-72` | `assets/derived/DSC02466/{display.jpg,thumb.jpg}` |
| 7 | `DSC02560.jpg` | F04, F06, F10 | portrait 1365×2048 | L93.6 S245.9 C46.6 — most saturated frame | Strongest color-vs-canvas cast test + portrait saturation double coverage | G1, G2; cover of `aurora-nights`; portrait sequence in `long-gallery-72`; Overview saturated thumb | `assets/derived/DSC02560/{display.jpg,thumb.jpg}` |
| 8 | `DSC01832.jpg` | F04, F07, F05, F10 | landscape 2048×1365 | L72.6 S173.0 C60.3 — red lanterns, dense | Saturated + dense double coverage; Archive card variety | G2, G5 (dense edge content); gallery `red-lanterns`; Archive 2024 | `assets/derived/DSC01832/{display.jpg,thumb.jpg}` |
| 9 | `DSC02367.jpg` | F05, F10 | landscape 2048×1365 | L138.9 S96.2 C60.3 — ordinary wide frame | Baseline "normal" landscape for rhythm and scale judgments | G1, G4 (72-gallery), G5; gallery `lofoten-light` | `assets/derived/DSC02367/{display.jpg,thumb.jpg}` |
| 10 | `DSC02762.jpg` | F05, F10 | landscape 2048×1365 | L122.9 S118.9 C60.2 — ordinary wide frame | Second ordinary landscape; Home hero starting cover | Home hero (starting); gallery `lofoten-light` | `assets/derived/DSC02762/{display.jpg,thumb.jpg}` |
| 11 | `DSC01836.jpg` | F05, F10 | landscape 2048×1365 | L126.4 S93.0 C60.6 — ordinary wide frame | Third ordinary landscape; Archive/recent variety | gallery `tengwang-pavilion` (pavilion subject) | `assets/derived/DSC01836/{display.jpg,thumb.jpg}` |
| 12 | `DSC02416.jpg` | F06, F05-adjacent, F10 | portrait 1365×2048 | L148.6 S92.9 C68.7 — bright portrait | Bright portrait cover for G3 portrait-hero cap; portrait sequence anchor | G3 (portrait cover), G5 (portrait ≤82svh); gallery `portrait-studies` | `assets/derived/DSC02416/{display.jpg,thumb.jpg}` |
| 13 | `DSC02851.jpg` | F06, F10 | portrait 1365×2048 | L136.6 S84.1 C62.7 — quiet portrait | Portrait recognition in Overview; portrait→landscape transition | G4 (transition), G6 (portrait-heavy), G7 (final portrait + 3-line caption); gallery `winter-returns` (final) | `assets/derived/DSC02851/{display.jpg,thumb.jpg}` |
| 14 | `DSC01935.jpg` | F07, F05, F10 | landscape 2048×1365 | L74.8 S85.9 C57.2 — detail throughout | Primary dense-composition stress (thumbnail recognition + edge content) | G5, G6 (dense); gallery `christmas-market-light` | `assets/derived/DSC01935/{display.jpg,thumb.jpg}` |
| 15 | `DSC02020.jpg` | F07, F05, F10 | landscape 2048×1365 | L96.7 S56.3 C54.6 — detail throughout | Second dense frame; Archive variety | G6 (dense thumb); gallery `essen-industrial-light` | `assets/derived/DSC02020/{display.jpg,thumb.jpg}` |
| 16 | `DSC02233.jpg` | F08, F05, F10 | landscape 2048×1365 | L141.2 S104.2 C52.0 — large negative space | Primary minimal-composition case | G6 (minimal thumb); gallery `winter-returns` | `assets/derived/DSC02233/{display.jpg,thumb.jpg}` |
| 17 | `DSC02339.jpg` | F08, F05, F10 | landscape 2048×1365 | L151.2 S75.6 C51.3 — large negative space | Second minimal frame; Breathing-pause editorial pair | G11 rhythm captures; gallery `winter-returns` | `assets/derived/DSC02339/{display.jpg,thumb.jpg}` |

Gallery 21 (`thun-lake-lines`) and the variety-cover galleries 9–20 draw their photos from the variety-eligible pool named in §2 supporting table and the remaining inventory; every assigned photo still gets a derived asset per §3.

**Supporting stress photos (outside the core 17, named because gates depend on them):**

| Source filename | Role | Statistics | Gates / pages |
|---|---|---|---|
| `DSC02542.jpg` | F06 portrait cover for G3 (portrait hero cap) | portrait 1487×2048, L75.9 S204.9 C47.4 | G3 (via `?hero=portrait-studies` cap case); archive reserve |
| `DSC02575.jpg` | Panorama cover for G3 "panorama cover if available" | panorama-ish 2048×871, L133.0 | G3; cover of `lofoten-fjord-lines` |
| `DSC01927.jpg` | Portrait-orientation quiet street (structural variety) | portrait 1365×2048, L88.5 | `springfield-quiet-mornings` (documented substitution, §4.2 note) |
| `DSC02271.jpg` | Portrait harbour view | portrait 1365×2048, L118.6 | Archive reserve (Tromsø) |
| `DSC02796.jpg` | Portrait red-cabin view (Reine) | portrait 1365×2048, L129.8 | `reine-morning-fog`, G6 portrait-heavy |
| `DSC02559.jpg` | F04+F06 saturated portrait aurora | portrait 1365×2048, S236.4 | G2, `reine-night-skies`, `long-gallery-72` |
| `DSC01905.jpg` | Secondary dark night hall (Nanchang) | L41.7 | Archive reserve |
| `DSC02454.jpg` | F03 flattest frame (dark aurora) | C19.2, L42.9 | G2, `aurora-nights` |
| `DSC02092.jpg` | Secondary high-key lake | L170.2 | G2, G5 bright edge-to-edge, `ferry-crossings` |
| `DSC01859.jpg`, `DSC01861.jpg` | Panorama-ish wide frames (edge-to-edge mobile cases) | 2048×1036 / 2048×1018 | G5/G10 edge-to-edge (01859 in `tengwang-pavilion`; 01861 archive reserve) |
| `DSC01876.jpg` | Dark saturated night hall (Nanchang) | L47.1 S169.1 | G2, `red-lanterns` |
| `DSC01958.jpg` | F04 saturated blue ferris wheel | S186.5 | G2, `city-lights-ferris-wheel` |
| `DSC02335.jpg`, `DSC02362.jpg` | Secondary minimal frames | L141.9 / L143.7 | G6 minimal thumbs; `thun-lake-lines` (02335), `winter-returns` (02362) |
| `DSC01960.jpg` | Secondary dense frame | S143.9 | `christmas-market-light`, G6 dense |
| `DSC02568.jpg`, `DSC02573.jpg` | Secondary saturated frames | S232.9 / S215.8 | G2; `reine-night-skies` (02568), `aurora-nights` (02573), `long-gallery-72` |

All remaining decodable JPEGs are eligible **variety-only** material (Archive cards, recent set, Overview extent fill for `long-gallery-72`); none decide any gate.

## 3. Derived-asset rules

- `assets/derived/{STEM}/display.jpg` — EXIF-orientation-normalized, longest edge 2048 px (sources are already ≤2048; most are re-encoded unchanged-size for uniform color profile), JPEG quality 84.
- `assets/derived/{STEM}/thumb.jpg` — 480 px longest edge, JPEG quality 80, for Overview thumbnails and grid covers.
- Generation is a deterministic script (`tools/build_assets.py`, Phase 3); no network images anywhere (§17 of the task).

## 4. Content fixture model (galleries, places, captions)

Real photography is real; gallery sequencing is openly synthetic where marked. Places and galleries below are the fixture content of the prototype; dates/places are plausible constructions for structure testing except where the photo stream genuinely implies them.

### 4.1 Places (8)

| Slug | Name | Region shown | Layout | Note |
|---|---|---|---|---|
| `nanchang` | 南昌 Nanchang | Jiangxi, China | grouped | Mixed-script place name (G1 CJK). |
| `cologne` | Cologne | Germany | flat | |
| `essen` | Essen | Germany | flat | |
| `thun` | Thun | Switzerland | flat | P01 low-volume flat (4 galleries). |
| `tromso` | Tromsø | Norway | flat | Non-ASCII name (ø) rendering check. |
| `reine` | Reine | Lofoten, Norway | grouped | P02 grouped (8 galleries, 2 years 2024/2025). |
| `springfield-il` | Springfield | Illinois, USA | flat | **Disambiguation pair** — region always rendered. |
| `springfield-mo` | Springfield | Missouri, USA | flat | **Disambiguation pair** — region always rendered. |

Places Index renders name only, plus region for the disambiguating pair, per frozen B10/Red-Team B: no counts, no year spans, no covers.

### 4.2 Galleries (22; 21 authored fixtures + 1 marked test construction)

Subject-coherence correction (Phase 4): the first issue of this table assigned stems by statistics only; a labeled contact-sheet audit of all 113 sources then re-assigned every gallery so photographed subject matches place (Nanchang pavilions/lanterns, German markets/industrial, Thun lake, Tromsø city/aurora, Reine fjord). Captions therefore sit under photographs that actually show what they describe (e.g. L03 ferry caption under the red ferry frame `DSC02889`).

| # | Slug | Title | Date | Place(s) | Photos | Cover | Content-stress role |
|---|---|---|---|---|---|---|---|
| 1 | `lofoten-light` | Lofoten Light | Feb 2025 | Reine | 8 | `DSC02762` | Home hero (starting); bright landscape sequence G01 |
| 2 | `tengwang-pavilion` | 滕王阁 · Tengwang Pavilion | Nov 2024 | Nanchang | 6 | `DSC01836` | **Mixed-script title** (G1); dense sequence |
| 3 | `aurora-nights` | 极光之夜 | Dec 2024 | Tromsø | 5 | `DSC02560` | **Chinese title** (G1/H04); dark sequence G02 |
| 4 | `portrait-studies` | Portrait Studies | Mar 2024 | Reine, Tromsø | 6 | `DSC02416` | Portrait sequence G03; portrait-heavy Overview |
| 5 | `winter-returns` | Winter Returns | 2018–2024 | Tromsø, Reine | 7 | `DSC02233` | **Multi-year + multi-place** (A02, P03, P04); minimal + low-contrast; G7 final portrait + 3-line caption |
| 6 | `lofoten-fjord-lines` | Where the Road Gives Way to Water and the Mountains Take Back the Light | Jun 2025 | Reine | 6 | `DSC02575` | **Long English title ≈70 chars** (H03, O06); panorama-ish frames |
| 7 | `swiss-winter-quiet` | Swiss Winter Quiet | Photographed Feb 2019 · Recently added | Thun | 4 | `DSC02071` | **Backfill cue** (H05, G3 cue); high-key + F09-substitute set; bright G7 final |
| 8 | `ferry-crossings` | Ferry Crossings | Mar 2024 | Thun | 3 | `DSC02082` | **Short gallery (3 photos)**; no-next variant available |
| 9 | `essen-industrial-light` | Essen Industrial Light | Jul 2023 | Essen | 3 | `DSC02020` | Archive 2023 variety; dense industrial halls |
| 10 | `christmas-market-light` | Christmas Market Light | Dec 2023 | Cologne | 3 | `DSC01935` | Archive 2023; dense market covers |
| 11 | `red-lanterns` | Red Lanterns | Feb 2024 | Nanchang | 4 | `DSC01889` | Saturated + darkest cover vs warm canvas (G2, G3 dark cover, G7 dark final) |
| 12 | `city-lights-ferris-wheel` | City Lights, Ferris Wheel | Aug 2023 | Essen | 3 | `DSC01958` | Short gallery; saturated |
| 13 | `springfield-quiet-mornings` | Springfield Quiet Mornings | Apr 2020 | Springfield (IL) + Springfield (MO) | 5 | `DSC01927` | Archive 2020; **short English title**; multi-place gives `springfield-mo` its single-gallery place page. **Documented substitution**: the archive contains no American photographs; quiet-street/quiet-figure frames stand in so the disambiguation-pair stress (B10) stays testable. |
| 14 | `old-town-rooftops` | Old Town Rooftops | Oct 2023 | Thun | 4 | `DSC02097` | P01 flat set (galleries 7, 8, 14, 21); lakeside village frames |
| 15 | `reine-morning-fog` | Reine Morning Fog | May 2025 | Reine | 5 | `DSC02794` | Reine grouped 2025; overcast/mist set |
| 16 | `reine-harbour-days` | Reine Harbour Days | May 2025 | Reine | 4 | `DSC02343` | Reine grouped 2025; harbour/boat set |
| 17 | `reine-winter-roads` | Reine Winter Roads | Jan 2024 | Reine | 5 | `DSC02340` | Reine grouped 2024; road/dusk set |
| 18 | `reine-night-skies` | Reine Night Skies | Jan 2024 | Reine | 4 | `DSC02568` | Reine grouped 2024; aurora set |
| 19 | `tromso-winter-shore` | Tromsø Winter Shore | Dec 2024 | Tromsø | 4 | `DSC02230` | Tromsø flat; harbour/shore set |
| 20 | `tromso-city-nights` | Tromsø City Nights | Nov 2023 | Tromsø | 4 | `DSC02327` | Archive 2023; dark city-light set (F09-sub neutral dark) |
| 21 | `thun-lake-lines` | Thun Lake Lines | May 2018 | Thun | 4 | `DSC02589` | Archive **2018** landmark; earliest photographed year; water-line set |
| 22 | `long-gallery-72` | Long Gallery — Seventy-Two Frames | May 2025 | Reine | 72 | `DSC02367` | **TEST FIXTURE ONLY — NOT AN AUTHORED REAL GALLERY.** Synthetic sequence built by repeating/combining core-set real photographs (mixed orientations, captioned and uncaptioned stretches, portrait→landscape transitions) solely to exercise G4/G5/G6 at 72-photo scale. Its position annotation runs `1 / 72` … `72 / 72`. |

Stems not assigned to any authored gallery (e.g. `DSC01861`, `DSC01880`, `DSC01887`, `DSC01905`, `DSC02271`, `DSC02542`) remain an archive reserve: eligible variety-only material that may appear in `long-gallery-72` or future captures, never gate-deciding on their own.

Archive years present: 2025, 2024, 2023, 2020, 2019, 2018 (6 year landmarks → A03; `winter-returns` spans 2018–2024 and is placed under its most recent photographed year, 2024). A04 (~80 galleries) is **not built** — recorded here as a documented matrix gap: real fixture material (113 photos) cannot honestly sustain 80 authored galleries; scan-endurance behavior at that scale is out of Stage 3C scope and noted in `IMPLEMENTATION_DEVIATIONS.md`.

### 4.3 Caption fixtures

| Case | Placement | Text |
|---|---|---|
| No caption | default across most sequences | — |
| Short caption (1 line) | `lofoten-light` L03 | "The ferry leaves Reine at first light." |
| 3-line caption | `lofoten-light` L05 (also the G7 final-photo case in `winter-returns` last photo) | "We waited two hours for the fog to lift. When it finally did, the mountain kept the light for itself, and we understood why the road stops here — not because it cannot go further, but because there is nothing it needs to reach." |
| Chinese caption | `swiss-winter-quiet` L02 | "清晨的湖面几乎不动，只有雪在慢慢亮起来。" |
| Gallery optional description (B03, ≤3 lines) | `lofoten-light` header | "Eight frames from a week in Reine, photographed at the edge of winter when the light returns for only a few hours a day." |

### 4.4 Mobile Menu

Opaque `#EFECE5` full layer, link order Archive → Places → About, serif site mark, 56 px top bar + safe area — captured inside G1 (B-captures of the matrix) and accessibility X-captures.

## 5. Gate → fixture mapping

| Gate | Fixtures used (matrix IDs) | Concrete material |
|---|---|---|
| G1 | F01, F02, F04, F09-sub; short gallery, 72-photo gallery, Chinese title, mixed-script title, 3-line caption, Chinese caption; `2018–2024`; `72 / 72`; 200% zoom; mobile Menu; Archive card metadata | `DSC02071/DSC01889/DSC02560/DSC02066`; galleries 8/22/3/2; captions §4.3; gallery 5 date string; Menu layer |
| G2 | F01 edge disappearance, F02, F09-sub, F04 cast check | `DSC02071/DSC02092`, `DSC01889/DSC02327`, `DSC02066/DSC02055`, `DSC02560/DSC01832/DSC01958`; mixed cover grids (Home recent, Archive); Overview + Menu as neutral surfaces; focus perimeter checks |
| G3 | bright cover, dark cover, portrait cover, panorama cover, long English title, Chinese title, backfill cue | covers `DSC02762/DSC02071` (bright), `DSC01889` (dark), `DSC02416` (portrait), `DSC02575` (panorama); titles galleries 6/3; cue gallery 7; hero variants `?hero=swiss-winter-quiet` / `red-lanterns` / `portrait-studies` / `lofoten-fjord-lines` |
| G4 | 72-photo mixed gallery (top/mid/end), captioned + uncaptioned stretches, portrait→landscape transitions | `long-gallery-72` with core-set mix incl. `DSC02851`→`DSC02367` transition |
| G5 | edge-to-edge bright landscape, edge-to-edge dark landscape, portrait ≤82svh, dense composition, positions L01/L47/L72 | `DSC02071` (gallery 7) / `DSC01859` (gallery 2) bright, `DSC01889` (gallery 11) dark, `DSC02416` (gallery 4) portrait, `DSC01935` (gallery 10) dense; gallery 22 |
| G6 | portrait-heavy, landscape-heavy, dark + bright, dense, minimal thumbnails; L47 current | `portrait-studies` thumbs; `lofoten-light` thumbs; `DSC01889/DSC02071` pair; `DSC01935/DSC02020`; `DSC02233/DSC02339`; gallery 22 @ L47 |
| G7 | final photo portrait + 3-line caption; final photo dark landscape; final photo bright landscape; next gallery long title + Chinese title | finals `DSC02851` (+3-line caption, gallery 5), `DSC01889` (gallery 11), `DSC02071` (gallery 7); next targets galleries 6/3; no-next state via gallery 8 |

## 6. Content-stress coverage checklist (matrix §Content stress fixtures)

| Required fixture | Realized as |
|---|---|
| Short Gallery (≈3 Photos) | galleries 8, 12 |
| Long Gallery (~72 Photos) | gallery 22 (TEST FIXTURE ONLY) |
| Short English title | gallery 13 |
| Long English title (≈70 chars) | gallery 6 |
| Chinese title | gallery 3 |
| Mixed-script title | gallery 2 |
| Single Place Gallery | majority (e.g. 1, 2, 3) |
| Multiple Places Gallery | gallery 5 |
| Single-year date | majority |
| Multi-year range (2018–2024) | gallery 5 |
| No caption | default |
| Short caption | §4.3 |
| 2–3 line caption | §4.3 |
| Chinese caption | §4.3 |

## 7. Determinism declarations

- All photographs are local derivatives of `media/stage3c-fixtures/`; no remote image service (§17).
- Typography: self-hosted webfonts via @fontsource (Source Serif 4 + Source Sans 3 + Noto Serif SC + Noto Sans SC; Noto SC ≡ Source Han SC metrics family), installed into the prototype and loaded before every capture — no fallback→webfont layout shift (§18). If self-hosting fails for any family, the deterministic fallback is recorded in the implementation report before captures run.
- Sources remain read-only; derived assets are regenerated only by `tools/build_assets.py`.
