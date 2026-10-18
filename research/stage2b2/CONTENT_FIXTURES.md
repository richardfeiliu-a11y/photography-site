# Content Fixtures

## Fixture policy

- All variants use the same local assets and metadata.
- Do not use network images.
- Preferred sources, in order: local user-provided photos, existing project assets, neutral locally generated placeholders.
- If neutral placeholders are used, they must have stable IDs, clearly different compositions/tones for recall tasks, defined aspect ratios, and realistic encoded weights.
- Fixture counts are test instruments, never Gallery-size product rules.

## Home fixture set

| ID | Title | Date photographed | Date added/published | Place | Count | Featured in feature-on state | Role |
|---|---|---|---|---|---:|:---:|---|
| `G01` | Quiet Stations | 2026-04-12–2026-04-15 | 2026-08-18 | Paris | 16 | Yes | Short Gallery / featured override |
| `G02` | Winter Courtyard | 2019-02-10–2019-02-14 | 2026-08-26 | Paris | 24 | No | Latest addition / deliberate backfill case |
| `G03` | River Edges | 2022-05-01–2026-06-30 | 2026-08-10 | Paris | 72 | No | Long Gallery |
| `G04` | North Window | 2025-11-03–2025-11-06 | 2026-07-20 | Brussels | 18 | No | Recent Gallery |
| `G05` | Late Tram | 2025-08-21 | 2026-06-18 | Berlin | 28 | No | Recent Gallery |
| `G06` | Low Tide | 2024-09-02–2024-09-08 | 2026-05-12 | Lisbon | 22 | No | Recent Gallery |

Home selection states are deterministic:

```text
feature=on  → hero = G01 Quiet Stations
feature=off → hero = G02 Winter Courtyard (latest date added/published)
```

The Recent additions set is ordered by `date added/published` descending, excludes the current hero, and shows the first four remaining Galleries. Archive placement remains based on `date photographed`; G02 stays in 2019.

## Short Gallery fixture — G01 Quiet Stations

| Attribute | Value |
|---|---|
| Canonical route | `/galleries/quiet-stations` |
| Title | Quiet Stations |
| Place | Paris, France |
| Date photographed | 2026-04-12–2026-04-15 |
| Date added | 2026-08-18 |
| Photo count | 16 |
| Cover | `S01` |
| Captions | `S03`, `S08`, `S14`, `S16` only |
| Known-image task target | `S14` — visually distinctive red bench / equivalent neutral placeholder |

Ordered orientation manifest:

```text
S01 L, S02 P, S03 L, S04 L,
S05 P, S06 P, S07 L, S08 P,
S09 L, S10 L, S11 P, S12 L,
S13 P, S14 L, S15 L, S16 P
```

Captions are one short sentence maximum. Uncaptioned Photos render no empty caption container.

## Long Gallery fixture — G03 River Edges

The B1-required long-fixture range is roughly **50–100 Photos**; this deterministic fixture uses 72. It must retain realistic image weights so fatigue, memory, restoration, navigation, and loading checks are meaningful.

| Attribute | Value |
|---|---|
| Canonical route | `/galleries/river-edges` |
| Title | River Edges |
| Place | Paris, France |
| Date photographed | 2022-05-01–2026-06-30 |
| Date added | 2026-08-10 |
| Photo count | 72 |
| Cover | `L01` |
| Captioned Photos | Every sixth Photo: `L06`, `L12` … `L72` |
| Recall targets | `L18`, `L47`, `L68` |

Photo IDs are `L01`–`L72`. Orientation follows this nine-item cycle repeated eight times:

```text
L, L, P, L, P, P, L, L, P
```

This produces 40 landscape and 32 portrait Photos with repeated and mixed-orientation runs. Recall targets must remain visually distinctive across all variants:

- `L18`: red umbrella / red geometric equivalent;
- `L47`: blue wall / blue geometric equivalent;
- `L68`: isolated tree / high-contrast single-subject equivalent.

### Realistic image weights

- Standard landscape: approximately 0.9–1.8 MB encoded.
- Standard portrait: approximately 0.8–1.6 MB encoded.
- Heavy samples `L11`, `L22`, `L33`, `L44`, `L55`, `L66`: approximately 2.5–3.5 MB encoded.
- Intrinsic dimensions/aspect ratios must be realistic and stable between variants.
- Do not replace heavy samples with tiny files during performance/memory checks.

## Repeated Paris fixture

Every row is a canonical Gallery card with cover, title, date/range, Place, and photo count. `G20` is the multi-Place identity check and appears on both Paris and Brussels pages with one URL.

| ID | Title | Photographed year/range | Places | Count | Cover ID |
|---|---|---|---|---:|---|
| `G01` | Quiet Stations | 2026 | Paris | 16 | `S01` |
| `P02` | After Rain | 2026 | Paris | 14 | `P02-C` |
| `P03` | Pale Afternoon | 2025 | Paris | 21 | `P03-C` |
| `P04` | Corner Light | 2024 | Paris | 18 | `P04-C` |
| `P05` | River Steps | 2024 | Paris | 26 | `P05-C` |
| `P06` | Underpass Blue | 2023 | Paris | 12 | `P06-C` |
| `P07` | Sunday Glass | 2023 | Paris | 30 | `P07-C` |
| `G02` | Winter Courtyard | 2019 | Paris | 24 | `G02-C` |
| `G03` | River Edges | 2022–2026 | Paris | 72 | `L01` |
| `P10` | Morning Platforms | 2022 | Paris | 20 | `P10-C` |
| `P11` | Empty Chairs | 2021 | Paris | 17 | `P11-C` |
| `P12` | Canal Dust | 2021 | Paris | 25 | `P12-C` |
| `P13` | Small Departures | 2020 | Paris | 15 | `P13-C` |
| `P15` | Stone and Steam | 2018 | Paris | 19 | `P15-C` |
| `P16` | Yellow Rooms | 2017 | Paris | 23 | `P16-C` |
| `P17` | Southbound | 2016 | Paris | 16 | `P17-C` |
| `P18` | After Closing | 2015 | Paris | 27 | `P18-C` |
| `P19` | Rue des Fleurs | 2014 | Paris | 13 | `P19-C` |
| `G20` | Between Cities | 2013 | Paris + Brussels | 20 | `G20-C` |
| `P21` | Northern Gate | 2012 | Paris | 18 | `P21-C` |

Deterministic volume subsets:

```text
volume=3  → G01, P04, G02
volume=8  → volume=3 + P02, P03, P05, P06, P07
volume=20 → all table rows
```

Within every volume, display order is reverse chronological by date photographed. Multi-year `G03` is filed under its start year 2022 with `2022–2026` visible, matching frozen B1 semantics.

## Shared captions and metadata

- Gallery card: cover, title, photographed year/date range, Place, photo count.
- Gallery header: title, photographed date/range, Place; count is hidden unless Overview is admitted or the task explicitly asks for extent.
- Photo captions: identical text and presence across variants.
- Date added/published never appears as photographed date. The Home backfill task may explain “recently added” in task debrief, but the displayed historical date remains 2019.

## Asset acceptance checklist

- Stable asset ID and orientation for every Photo.
- Same exact file used in every Variant.
- No remote URL or network dependency.
- No destructive crop; `contain` behavior must preserve the full photograph.
- Alternative text/fixture label exists for deterministic task instructions.
- Short and long fixtures load at their specified realistic weight class.
