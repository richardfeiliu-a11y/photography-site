# Prototype Implementation Handoff

> **DO NOT REDESIGN.** Implement the frozen prototype specifications faithfully. Do not reopen B1 decisions or optimize variants toward a preferred outcome.

## Objective

Build a disposable medium-fidelity interactive prototype for four controlled comparisons. The result must support deterministic routes, desktop/mobile interaction, participant/evaluator modes, and reproducible screenshots. It is not production website implementation.

## Read in this order

1. `STAGE_2B2_SUMMARY.md`
2. `PROTOTYPE_OVERVIEW.md`
3. `CONTENT_FIXTURES.md`
4. `INTERACTION_SPEC.md`
5. `RESPONSIVE_SPEC.md`
6. `TEST_1_HOME.md`
7. `TEST_2_PLACE.md`
8. `TEST_3_GALLERY_OVERVIEW.md`
9. `TEST_4_MOBILE.md`
10. Frozen B1 `STAGE_2B1_SUMMARY.md` only if a product boundary needs confirmation.

## Must implement

- All required A/B Variants and optional T2 C diagnostic.
- Semantic routes and prototype-only query-state matrix from `PROTOTYPE_OVERVIEW.md`.
- G01–G06 Home data, G01 short Gallery, G03 72-Photo long Gallery, and 3/8/20 Paris subsets.
- One optional Home featured state and deterministic latest fallback.
- Global navigation, Gallery entry, origin-aware Back/restoration, current position, fixed continuation, and Overview behavior exactly as specified.
- Required desktop `1440×1000` and mobile `390×844` responsive behavior; auxiliary `1024×768` sanity view.
- Evaluator/participant harness modes with clear variant labeling outside evaluated page content.
- Deterministic reset, route state, fixture state, scroll targets, and screenshot capture.
- Same local assets and metadata in every compared Variant.

## Must not implement

- Production CMS, database, auth, real Search, Map, Tags, analytics, SEO, image CDN/pipeline, final animations, or deployment.
- Visit entity/field/URL/navigation/grouping.
- Multi-Gallery Photo reuse.
- Photo-detail routes, likes/comments/accounts, fullscreen, or new features.
- Final brand, font, color, motion, or design system choices.
- Network image retrieval.

## Variant isolation rules

| Test | Permitted difference | Forbidden differences |
|---|---|---|
| T1 | Home hierarchy | Cards, content, nav, Gallery behavior, feature/fallback algorithm |
| T2 | Year-heading presence rule | Cards, order, content, metadata, routes, density |
| T3 | Overview availability | Sequence, assets, captions, continuation, responsive image rules |
| T4 | Progression direction and its minimum native controls | Captions, Overview state, metadata, continuation, content/order |

If a requested behavior cannot be implemented without changing another variable, stop and report the conflict. Do not improvise.

## Asset handling

- Inventory local user/project images before implementation.
- If insufficient, create neutral local placeholders matching `CONTENT_FIXTURES.md`; do not search the Web.
- Preserve stable IDs, orientation manifest, recall targets, caption presence, and realistic weight classes.
- Never use different image files or compression weights between variants.

## Screenshotability

- Every test route opens directly into a deterministic state.
- Provide evaluator controls for top/target/end positions without exposing them in participant mode.
- Filename format:

```text
t{test}-{variant}-{fixture_or_volume}-{viewport}-{position}.png
```

- Capture only after required assets settle and layout is stable.
- Minimum capture set is the union of screenshots explicitly named in each Test file; additional diagnostic captures are allowed but must not replace required ones.

## Interaction acceptance

- Global nav labels/order and semantic destinations match B1.
- Home feature-on/off produces the specified G01/G02 hero without changing Archive dates.
- Place volumes and ordering match fixture subsets; canonical G20 URL remains one object.
- Overview opens/closes, restores position, jumps to selected Photo, traps/returns focus, and does not alter browser history.
- T4 A/B share captions, Overview state, continuation, assets, and order.
- Back returns to originating discovery route and scroll position.
- End continuation presents no more than two actions.
- Keyboard and touch behaviors match `INTERACTION_SPEC.md`.
- No horizontal page overflow at required viewports.

## Completion artifacts for the implementation phase

- Runnable prototype in the later-authorized workspace location.
- Route/variant inventory.
- Required screenshot set.
- Short interaction recording or evidence for Overview restoration and mobile progression, if the environment supports it.
- Verification report mapping each Test's success/failure conditions to observed prototype behavior.
- Explicit list of deviations; zero silent substitutions.

## Stop conditions

Stop and request direction if:

- frozen B1 and a B2 file appear contradictory;
- local asset constraints prevent the same fixtures/weights across variants;
- deterministic screenshot state cannot be reproduced;
- implementation would require a new product/IA decision;
- a requested Variant would require contaminating another test variable.

Missing final visual direction or a preferred framework is not a blocker: this prototype is deliberately stack-neutral and uses the neutral controls in `PROTOTYPE_OVERVIEW.md`. Technical stack selection belongs to the later implementation plan, not this specification.

