# Prototype Overview

## Goal

Produce a medium-fidelity, interactive, stack-neutral prototype that validates four frozen Stage 2B1 defaults without reopening product direction, IA, or content model. The prototype must be deterministic enough for repeatable desktop/mobile screenshots and controlled enough that each test changes only its named variable.

## What is frozen

- Product: Personal Photographic Archive / Online Photography Exhibition.
- Global destinations: site name→Home, Archive, Places, About.
- Gallery is the canonical editorial/viewing unit at `/galleries/{gallery-slug}`.
- Archive uses `date photographed`; Home fallback uses `date added/published`.
- One optional featured Gallery overrides Home fallback and affects Home presentation only.
- Place metadata/entity/navigation/page exist; only Place-page grouping presentation is under test.
- Visit is not modeled; Search, Map, Tags, Photo detail, and Multi-Gallery Photo reuse are outside prototype scope.
- Vertical sequence is the recommended Gallery default.
- Overview is a recommended MVP default whose inclusion is gated by Test 3.

## What is under test

### Test matrix

| Test | Recommended default | Comparison | Only primary variable |
|---|---|---|---|
| **T1 Home** | Latest-first Home | Archive-first Home | Homepage hierarchy |
| **T2 Place** | Progressive time grouping | Always-flat; optional always-grouped | Presence rule for year headings |
| **T3 Overview** | Sequence + Overview | Sequence-only | Overview availability |
| **T4 Mobile** | Vertical progression | Swipe-first progression | Mobile progression direction |

Tests validate chosen defaults; they do not solicit a new IA.

## Shared baseline

All tests share:

- identical global navigation labels, order, and routes;
- identical Gallery objects, Photo order, covers, metadata, captions, image assets, and weights;
- identical prototype-only typography, spacing, colors, card treatment, and image fit rules;
- identical Home featured/fallback algorithm;
- identical Gallery continuation baseline;
- identical desktop and mobile viewports;
- identical visible metadata rules;
- no production features beyond what a test requires.

Prototype-only neutral visual constants are fixed so the implementation agent does not make aesthetic product decisions:

| Constant | Prototype value | Status |
|---|---|---|
| Typeface | Platform system sans | Test control only; not final branding |
| Background | warm off-white `#F7F7F3` | Test control only |
| Primary text | near-black `#181816` | Test control only |
| Muted text | gray `#6C6C66` | Test control only |
| Border | light gray `#D8D8D1` | Test control only |
| Focus indication | clearly visible blue outline | Accessibility control, not brand color |
| Shape | restrained square/low-radius surfaces | Prevent style preference from driving results |
| Motion | none except immediate state changes | Animation is not under test |

## Fidelity

Medium fidelity means the prototype must show real hierarchy, image rhythm, navigation, scrolling, touch/keyboard behavior, responsive adaptation, position restoration, and continuation. It must not freeze final font, brand, detailed animation, production transition, image pipeline, or design system.

## Prototype routes

Canonical semantic routes remain:

```text
/
/archive
/places
/places/paris
/galleries/quiet-stations
/galleries/river-edges
/about
```

Prototype-only query state selects a controlled variant without creating a new product route:

```text
?test=1&variant=A&feature=on
?test=1&variant=A&feature=off
?test=1&variant=B&feature=on

?test=2&variant=A&volume=3|8|20
?test=2&variant=B&volume=3|8|20
?test=2&variant=C&volume=3|8|20

?test=3&variant=A&fixture=short|long
?test=3&variant=B&fixture=short|long

?test=4&variant=A&fixture=long
?test=4&variant=B&fixture=long
```

Query state is prototype harness state only. It must not alter canonical Gallery identity, dates, Photo order, or content.

## Viewports

| Viewport | Required size | Purpose |
|---|---:|---|
| Desktop | `1440 × 1000` | Primary desktop comparison and screenshots |
| Mobile | `390 × 844` | Primary mobile comparison and screenshots |
| Auxiliary narrow desktop/tablet | `1024 × 768` | Responsive sanity check only; not a third test matrix |

Screenshots must use the exact viewport, route, query state, fixture state, and top/target/end scroll position named by each Test spec.

## Prototype harness and labeling

- Evaluator mode shows a compact external harness bar labeled `T{n} · Variant {A/B/C} · fixture/volume · viewport` and direct variant links.
- Participant mode hides the harness bar so labels do not prime users.
- Variant switching must preserve fixture and viewport state where meaningful.
- Every deterministic screenshot filename includes test, variant, fixture/volume, viewport, and position.
- The evaluated page itself must not contain “recommended,” “control,” or variant labels.

## Variables that must remain constant

Within a Test, do not vary:

- Gallery/Place data or Photo order;
- content quantity except the explicit T2 volume fixture;
- captions or metadata;
- navigation, header, card design, typography, spacing, colors, image treatment, or continuation;
- viewport or image weight;
- Overview state in T4: it inherits the current T3 state and is identical in A/B.

If implementation constraints force any additional difference, stop and update the specification before building; do not silently contaminate the comparison.

## Evaluation baseline

- Use the same task wording and starting route for every participant in a comparison.
- Record task completion, first action, time-to-target, wrong turns/backtracks, entry/exit path, and participant explanation.
- Use qualitative evidence to interpret metrics; this is directional prototype validation, not a statistically powered experiment.
- “Looks better” is never a decision criterion.
