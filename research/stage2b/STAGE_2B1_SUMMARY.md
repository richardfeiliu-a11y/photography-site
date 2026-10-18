# Stage 2B1 Summary

## Product direction

A long-lived **Personal Photographic Archive / Online Photography Exhibition**: edited viewing first, rediscovery by photographed time or Place second.

## Final recommended MVP IA

```text
Site name → Home
Archive
Places
About

Home      → one optional featured Gallery; otherwise latest by date added/published
Archive   → all Galleries organized by photographed year
Places    → Place → Gallery cards with progressive year headings
Gallery   → vertical sequence + Test-3-gated Overview + continuation
About     → minimal identity + Contact + selected Social links
```

No separate Chronology, Visit, Project, Map, Search, Tags, Contact, or Photo-detail destination. Every Gallery has one canonical `/galleries/{gallery-slug}` URL.

## Eight final decisions

| Decision | Final direction |
|---|---|
| **1. Homepage** | One optional featured published Gallery; otherwise latest by `date added/published`. Feature affects Home only. |
| **2. Gallery** | Titled, dated, covered, ordered Photos with one editorial proposition; not defined by trip, Visit, shoot, batch, city, text, or count. |
| **3. Chronology** | `Archive = Chronology`; photographed-year organization; no month layer or separate page. |
| **4. Place** | Public metadata + persistent entity + secondary navigation + landing page. |
| **5. Place page** | Flat reverse chronology at low volume; year headings appear progressively when useful. No raw photos/Visits. |
| **6. Visit** | Not modeled: no entity/field/navigation/URL/grouping; capture and available provenance context remain. |
| **7. Viewing** | Vertical sequence-first. Overview is the recommended MVP default but enters only if Test 3 passes. Fullscreen Later; no mandatory swipe. |
| **8. Metadata/discovery** | Cards show title, photographed date/range, Place, count, cover; count contextual in Gallery. Search/pagination behavior-triggered Later; Map/tags/facets/public EXIF/GPS not planned. |

## Content and date rules

- Gallery is editorial; Place connects Galleries; Photo has stable identity and one MVP Gallery membership. Multi-Gallery reuse is Later without asset duplication.
- Visits never define Gallery boundaries: one trip may yield several Galleries; one Gallery may span visits, years, or Places.
- `date photographed` drives Archive/Place placement. `date added/published` drives Home latest. Featured changes neither.
- A multi-place Gallery appears on each Place page but remains one object and URL.

## Scale and MVP boundary

| Review checkpoint | Rule |
|---|---|
| **15 Galleries** | One Archive, simple Places, no Search/pagination. |
| **80 Galleries** | Review retrieval and scanning; add nothing automatically. |
| **300 Galleries** | Review again; Search/pagination enter only if behavioral criteria fail. No Visit, deep taxonomy, or Map. |

MVP: Home, Archive, Places, vertical Gallery sequence, minimal About/Contact/Social/metadata, stable Photo identity. **Gated:** Overview via Test 3. Later: Photo reuse, Fullscreen, Search, pagination. Not planned: Map, tags, facets, Visit IDs/entities, public equipment/EXIF/GPS, accounts/comments/social features.

## Prototype questions

1. Latest-first Home with featured/fallback rule vs archive-first.
2. Progressive Place grouping vs always-flat/always-grouped.
3. Gate Overview using short and realistic long fixtures.
4. Mobile vertical vs swipe direction with caption, Overview, continuation held constant.

Tests 3/4 use a roughly 50–100-Photo mixed-orientation fixture with realistic weights; this is not a Gallery-size rule.

## Deferred decisions and major risks

Stage 2B2 decides Home composition, Place headings, Overview, mixed orientations, captions, and continuation. Later capabilities require behavioral evidence. Risks: hidden Archive, stale featured state, noisy grouping, Overview-driven skipping, mobile fatigue, and date conflation.

**Stage 2B1 revised and frozen. Ready for Stage 2B2 prototype specification.**
