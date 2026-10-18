# Implementation Deviation Review

## Reported deviations

| # | Deviation | Classification | Review |
|---:|---|---|---|
| 1 | 21 metadata-only stub Gallery routes | **Acceptable** | Keeps continuation targets resolvable without inventing full Photo fixtures. G01/G03 evaluation content is unchanged. |
| 2 | T4 `overview=on|off` diagnostic state | **Acceptable** | Required comparisons use identical Overview state. Diagnostic ability is outside participant canvas and does not contaminate required captures. |
| 3 | Three `1024×768` sanity screenshots | **Acceptable** | Explicitly auxiliary and outside the decision matrix. |
| 4 | `shots2/` reproducibility copy | **Acceptable** | Independently confirmed 69/69 SHA-256 identity; it is evidence, not substitution. |
| 5 | `/places` name-only baseline described as non-clickable | **Acceptable with report correction** | Live DOM shows Paris is clickable to `/places/paris`; Brussels/Berlin/Lisbon are static because no Place fixtures exist. T1's tested Paris path works. The report's blanket “non-clickable” wording is inaccurate but non-blocking. |
| 6 | Harness `target` control | **Acceptable** | Evaluator-only deterministic state; participant mode hides it. |

## Independently discovered deviations/defects

| Finding | Classification | Effect |
|---|---|---|
| T4 B continuation is appended after the one-photo swipe stage for every Photo index | **Blocking for T4** | Changes end-state visibility/length awareness in addition to progression direction. T4 isolation FAIL; RETEST required. |
| Mobile Overview current indicator is low-contrast against some thumbnails | **Final visual-design issue / non-blocking** | Mechanics work, but Stage 3 must strengthen current-position differentiation. |
| Home backfill lacks an explicit “recently added” presentation cue | **Final visual/copy issue / non-blocking** | Photographed date is correct; Stage 3 should clarify why 2019 work can lead Home without changing hierarchy. |
| Live in-app browser fixed-layer capture can differ from stored deterministic capture | **Evaluation-surface limitation / non-blocking** | Stored PNGs, DOM/CSS/source, videos, and reproduced mechanics were reconciled before decision. |

## Required T4 retest correction

Do not redesign T4. Make one minimal correction in a separately authorized implementation turn:

1. In Swipe-first B, hide/remove continuation while active index is `1…71`.
2. Show the same continuation baseline only after Photo `72 / 72`, matching A's semantic end state.
3. Keep captions, Overview state, metadata, assets/order, controls, and origin behavior unchanged.
4. Add an automated assertion: continuation not visible at L01 and a middle Photo; visible only at L72.
5. Re-capture required T4 A/B top/mixed/end screenshots and interaction evidence.
6. Re-run T4 isolation and B3 evaluation; do not reopen T1–T3.

The product default remains Vertical during retest because ambiguous/inadmissible evidence retains A.

