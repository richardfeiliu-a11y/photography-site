# Information Architecture

## Final recommended MVP IA

```text
Global header
├── Site name / mark → Home
├── Archive
├── Places
└── About

Home  /
├── One featured Gallery if set; otherwise latest by date added/published — visual primary
├── Recent Galleries — short continuation set
├── Browse full Archive — secondary entry
└── Browse Places — secondary entry

Archive  /archive
├── Galleries grouped by photographed year
├── Year heading + Gallery cards
└── Optional semantic year view  /archive/{year}

Places  /places
├── Lightweight Place index
└── Place  /places/{place}
    └── Gallery cards; photographed-year headings appear progressively

Gallery  /galleries/{gallery}
├── Gallery context
├── Primary ordered sequence
├── Recommended Overview default — included only if Test 3 passes
└── End-of-gallery continuation

About  /about
└── Minimal identity + Contact + selected Social links
```

There is no separate Work, Projects, Chronology, Visit, Map, Search, Journal, or Contact destination in MVP. Gallery is a contextual destination reached from Home, Archive, or Places, not a top-level navigation item.

## Navigation hierarchy

The header has **three labeled navigation items**—Archive, Places, About—plus the site name linking Home. This creates four stable destinations while keeping the photography visually dominant.

| Destination | Hierarchy | Reason |
|---|---|---|
| Home | Primary destination via site name | Featured override or latest addition; photography-first identity |
| Archive | Primary navigation | Complete time-based discovery layer |
| Places | Secondary in product priority, but top-level for direct access | Recurring-place discovery without a nested taxonomy |
| About | Low-weight top-level item | Stable identity/contact route without competing on Home |
| Gallery | Contextual content route | Viewing unit, not an index label |

## Homepage role

Home is **not merely a visual rendering of Archive**. It is a latest-first exhibition surface:

- The first screen uses a deterministic rule: if one published Gallery is manually featured, show it; otherwise show the latest published Gallery by `date added/published` descending.
- Featured is an optional Home-presentation override, limited to one Gallery at a time. It changes neither photographed date, Archive/Place ordering, canonical URL, nor Gallery history.
- A short recent-Galleries continuation follows; Home does not become an infinite archive stream.
- Archive and Places are visible secondary actions, but neither dominates the first visual impression.
- The intended first impression is: **“an evolving personal photography exhibition with a durable archive behind it.”**

This is a clear hybrid with Latest Galleries as primary and Archive Discovery as secondary—not an equal split. **Prototype validation required.**

## Archive role

Archive is the complete Gallery index. In MVP:

- `Archive = Chronology`; no duplicate Chronology page or navigation label exists.
- Default order is reverse chronological by **date photographed**, not date published.
- Year headings are directly visible. Month is not a navigation layer.
- Gallery cards show cover, title, photographed date/range, Place when known, and photo count.
- A date range remains within the Gallery card; a multi-year Gallery is filed under its start year with the full range visible. If long-running work makes this misleading in practice, Stage 2B2 must test a separate “ongoing/multi-year” presentation rather than duplicate the Gallery across years.

## Chronology role

Chronology is **archive index organization**, exposed through the top-level Archive destination. It is primary inside Archive but is not an independent global navigation concept.

- Year: visible and navigable.
- Month: metadata only when useful; never a default index layer.
- Exact date/date range: shown on Gallery cards and Gallery context.
- Homepage: ordered by date added/published for “latest,” so it does not duplicate Archive chronology.
- As volume grows, year groups remain stable. Pagination/progressive loading is added only when real pages become materially slow or hard to scan, not at a fixed count.
- Search is added only when representative users can no longer retrieve a known Gallery through Archive/Places at an acceptable interaction cost. The 80/300-Gallery scenarios are review checkpoints, not automatic triggers.

## Places role — four separate decisions

### Layer A — Metadata

**Yes.** A Gallery may reference zero, one, or multiple Places. Place is public context when known; it is not required for non-geographic work.

### Layer B — Persistent entity

**Yes.** A stable Place entity normalizes `Paris` across years, aliases, and multiple Galleries. This is a lightweight semantic entity, not a deep country→region→city taxonomy.

### Layer C — Navigation

**Yes, secondary.** Places is a top-level destination because repeated-place discovery is a core project task, but Home and Gallery remain visually primary. Places must not become a map or database dashboard.

### Layer D — Landing page

**Yes.** Each published Place with associated Galleries has a generated `/places/{place}` page. One Gallery associated with multiple Places appears on each relevant Place page but remains one canonical Gallery object and URL.

## Places index role

The Places index is lightweight:

- MVP requires only Place name and contextual country/region disambiguation when needed.
- Representative cover, Gallery count, and photographed year span are optional presentation candidates, not required Place fields. Stage 2B2 may start from the name-only version.
- No Visit counts, pins, GPS, or mixed camera/theme tags.
- At small scale it may be a simple visual list. At larger scale it may be grouped alphabetically or by country/region, without introducing a multi-level navigation tree.

## Place page role

MVP chooses **progressive time organization of Gallery cards**:

- At low volume, use one flat reverse-chronological list with photographed year/date visible on each card.
- Introduce year headings when repeated years, Gallery volume, and scanning clarity make grouping useful.
- No hard Gallery-count threshold controls the transition; Test 2 validates the behavior with 3, 8, and 20 Gallery fixtures.

```text
Paris
├── 2026
│   ├── Gallery cover · title · date/range · count
│   └── Gallery cover · title · date/range · count
├── 2024
│   └── Gallery cover · title · date/range · count
└── 2019
    └── Gallery cover · title · date/range · count
```

The diagram shows the higher-volume grouped state; the low-volume default remains a flat reverse-chronological card list.

- The page returns Galleries, not a raw photo pool.
- Year remains visible on cards; headings are progressive rather than mandatory. There is no Visit grouping.
- Covers, titles, date/range, and photo counts are visible.
- Individual photos do not appear except as Gallery covers.
- With many Paris Galleries, year headings are the recommended default; pagination/progressive loading remains behavior-triggered and does not change the IA.
- A multi-year Gallery appears once, filed under its start year with its full range visible.

**Evidence does not establish superiority. This is a project-specific product choice** because it directly solves long-term recurring-place discovery while preserving Gallery as the viewing unit. It must be compared with a flat chronological Gallery stream in Stage 2B2.

## Gallery role

Gallery is the canonical editorial and viewing destination. It contains one ordered sequence and may be reached from multiple discovery contexts without being copied.

- Primary mode: vertical, sequence-first scroll.
- Secondary mode: Overview/light table is the recommended MVP default, but its inclusion is gated by Test 3. If it fails, MVP remains sequence-only.
- No Visit breadcrumb or forced travel hierarchy.
- Gallery context links its photographed date/range and Place(s) back to Archive/Place discovery.
- End state prioritizes Next Gallery, then Previous Gallery, Archive, and relevant Place links. Normal browser Back preserves the user's original entry context.

## About role

About is an independent but low-weight page. It contains minimal identity, project purpose, Contact, and selected Social links. It is not featured as a homepage content block and does not include CV/press/commercial layers unless the product direction later changes.

## Homepage / Archive / Gallery relationship

```text
Home        = optional single featured override; otherwise latest by date added/published
Archive     = complete Gallery discovery by photographed time
Places      = complete Gallery discovery by recurring location
Gallery     = canonical authored viewing unit
About       = minimal identity and contact
```

Home and Archive use the same Gallery objects but different ordering and density. Home uses publication/addition recency; Archive uses photographed chronology.

## URL conceptual structure

| Meaning | Semantic URL |
|---|---|
| Home | `/` |
| Full archive | `/archive` |
| Optional year view | `/archive/{year}` |
| Places index | `/places` |
| Place landing | `/places/{place-slug}` |
| Canonical Gallery | `/galleries/{gallery-slug}` |
| About | `/about` |

No `/visits`, `/trips`, `/map`, `/tags`, or separate `/chronology` routes exist in MVP.

## Scale validation

| Scale | Navigation | Chronology | Places | Search / pagination | Secondary discovery |
|---|---|---|---|---|---|
| **Small: 15 Galleries / 5 Places / 3 Years** | Four destinations remain restrained | One Archive page with three year groups | Simple list and small Place pages | Neither needed | Archive and Places are sufficient |
| **Medium checkpoint: 80 / 25 / 8** | Same header; no Gallery names in nav | Year groups remain usable | Alphabetical/country organization and progressive year headings where useful | Review retrieval and scan cost; add neither Search nor pagination automatically | Places complements chronology |
| **Large checkpoint: 300 / 70 / 20** | Same header; no new top-level item required | Year pages or grouped indexes remain | No deep taxonomy or Visit layer | Add Search/pagination only if known-item retrieval or page scanning fails the behavioral criterion | Search may join Time/Place; Map remains absent |

## Mobile IA requirements

- The same four destinations remain available without a desktop-only interaction.
- No horizontal page overflow or hover-only navigation.
- Gallery uses vertical scroll rather than mandatory horizontal swipe.
- Portrait and landscape images retain full-image access without forced crop.
- If Test 3 admits Overview into MVP, Overview, Gallery context, and end continuation must be reachable by touch and keyboard.
- Browser Back must preserve the originating Home/Archive/Place context.
- Long Gallery position and continuation require prototype validation; static screenshots are not acceptance evidence.
