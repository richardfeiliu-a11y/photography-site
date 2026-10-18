# Visual Regression Baselines — GOVERNED DIRECTORY

Baselines live in `tests/baselines/<state-id>/*.png` (one directory per state
from `tests/capture/states.mjs`). The directory is tracked in Git but is
**empty at WP-06**: no baseline has been approved yet, and baselines are never
created as a side effect of running tests.

## Governance (TESTING_AND_VISUAL_REGRESSION.md §8.2)

1. **Baselines are never updated automatically.** A `capture:diff` report
   (written to `tests/captures/diff-report.json`, informational only) never
   mutates this directory. Auto-fail governance and the adjudication workflow
   are owned by **WP-47**.
2. **Baseline updates are a controlled process.** A baseline changes only when
   an intentional design change is approved through the frozen design authority
   (FINAL_DESIGN_SPECIFICATION.md). Two difference classifications exist:
   - *IMPLEMENTATION DRIFT* — unauthorized change; the implementation is fixed,
     the baseline is not touched.
   - *APPROVED DESIGN UPDATE* — baseline regenerated through the controlled
     workflow below after approval.
3. **Approved updates use the capture runner.** Baselines are produced by
   `npm run capture` output copied from `tests/captures/<state>/` into
   `tests/baselines/<state>/`, together with a governed
   `tests/baselines/manifest.json` recording the SHA-256 of every baseline
   file. The manifest is integrity metadata *inside this one controlled
   workflow only* (`capture:diff` verifies it before comparing) — per §8.1 it
   is **not** visual-equivalence proof across browsers, operating systems,
   font rasterizers, or machines.
4. **Difference above threshold ≠ automatic failure.** Threshold exceedance
   triggers human review: the diff may be acceptable rendering noise
   (sub-pixel anti-aliasing, font hinting) or real drift. See
   `tests/captures/diff-images/` for the visual diff output.

## Canonical manifest schema (final gate-correctness correction)

The governed manifest is `tests/baselines/<group>/manifest.json` (one per
group: discovery / gallery / preview) and has exactly ONE record-array
field: **`captures`** — the producer (`npm run capture`) and the consumer
(`tests/capture/diff.mjs`) share this single schema; no legacy alias
(`baselines`) is accepted. Each record carries `state`, `group`, `file`
(repo-relative PNG path), and `sha256`. `capture:diff` validates the schema
strictly and verifies EVERY record (file exists + SHA matches) before any
pixel comparison; a manifest that is missing, malformed, incomplete, or
mismatched fails the run (exit nonzero). A governed baseline PNG on disk
without a manifest record also fails the run.

## Controlled update workflow (final gate-correctness correction)

1. `npm run capture` — fresh governed capture set into `tests/captures/`.
2. `npm run capture:determinism` — prove two independent fresh runs are
   14/14 byte-identical (required before any baseline regeneration;
   detects first-paint font-race nondeterminism, see tests/capture/capture.mjs).
3. `npm run baseline:update` — copy the complete fresh set into this
   directory and regenerate the per-group manifests. Refuses an incomplete
   capture set.
4. `npm run capture:diff` — must verify 14/14 SHA records and exit 0.

The capture context rewrites `font-display: optional` → `block` in CSS
responses (capture contract only, no product change): the frozen optional
first-paint race otherwise renders EITHER the authored webfont OR the
system fallback per browser process, producing 2px full-page height
variations (e.g. gallery-desktop-portrait 4729/4731).
