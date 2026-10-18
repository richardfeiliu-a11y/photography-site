# Stage 2B2 Summary

## Goal

Build a medium-fidelity interactive prototype for four controlled tests. B1 product direction, IA, content model, routes, dates, navigation, Visit exclusion, and feature scope remain frozen. This stage specifies implementation; it does not contain production code or select a stack.

## Prototype matrix

| Test | Recommended default | Comparison | Only tested variable |
|---|---|---|---|
| **T1 Home** | Latest-first | Archive-first | Homepage hierarchy |
| **T2 Place** | Progressive grouping | Always-flat; diagnostic always-grouped | Year-heading presence rule |
| **T3 Overview** | Sequence + Overview | Sequence-only | Overview availability |
| **T4 Mobile** | Vertical | Swipe-first | Progression direction |

T3 is a gate: Overview enters MVP only if it improves long-Gallery orientation/retrieval/return without weakening authored sequence or completion. Ambiguous results mean sequence-only. T4 inherits the T3 Overview state identically in A/B.

## Shared frozen baseline

- Navigation: site name→Home; Archive, Places, About.
- Home: one optional featured Gallery; otherwise latest by `date added/published`. Archive/Place always use `date photographed`.
- Gallery: canonical `/galleries/{slug}`, editorial order, stable Photo identity, one MVP Gallery membership.
- Place page: Gallery cards only; no raw photos/Visits.
- Visit, Search, Map, Tags, Photo detail, Fullscreen, Multi-Gallery reuse, production CMS/database/auth/analytics are out of scope.
- All variants share content, order, captions, metadata, typography, spacing, colors, image treatment, weights, navigation, and continuation except the named variable.

## Content fixtures

- **Short:** G01 Quiet Stations, 16 mixed-orientation Photos.
- **Long:** G03 River Edges, 72 Photos—40 landscape/32 portrait, 12 captions, 6 heavy samples, distinct recall targets.
- **Home:** G01 featured; G02 Winter Courtyard is a 2019 backfill added latest in 2026; feature-off falls back to G02.
- **Paris:** deterministic 3/8/20 Gallery subsets with repeated years, multi-year G03, and one Paris+Brussels canonical Gallery.
- Use local user/project assets or neutral local placeholders only; no network images. Counts are test fixtures, not product rules.

## Routes and viewports

Canonical routes:

```text
/
/archive
/places
/places/paris
/galleries/quiet-stations
/galleries/river-edges
/about
```

Prototype query state selects test/variant/fixture without changing canonical identity. Required viewports: desktop `1440×1000`, mobile `390×844`; `1024×768` is sanity-only.

## Interaction baseline

- Browser Back and `Back to {origin}` restore discovery route/scroll position.
- Overview, when enabled, is a full-viewport light table: close restores position; thumbnail selection jumps to exact Photo; no route/history entry.
- Current position uses `n / total` in T3/T4.
- End continuation has at most two actions: Next Gallery primary, Back to origin secondary. Continuation is never a T4 variable.
- T4 holds captions, Overview state, metadata, assets/order, and continuation constant.

## Required output

- All Test variants, route navigation, responsive desktop/mobile behavior, evaluator/participant mode, local realistic fixtures, and deterministic screenshots.
- No coding-agent product decisions, redesign, added features, deleted variants, or aesthetic variable contamination.
- Use `IMPLEMENTATION_HANDOFF.md` as the execution contract.

## Remaining assumptions

- Actual local photographs may not yet be available; placeholder structure is fully specified.
- Test participant recruitment/sample size is outside implementation scope; record raw task outcomes rather than claim statistical significance.
- Overview final MVP status and the Place heading transition remain outcomes of the specified tests, not implementation-agent choices.

**Ready for prototype implementation.**

