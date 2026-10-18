# P4/P5 Targeted Re-Verification

Independent targeted re-verification of correction commit `4c4e15a464c2f538ac3c2af84ad1fefba95b6c5c` over `ecfe1fa..4c4e15a`, performed on 2026-09-02. This review is restricted to IMP-01..IMP-06, MIN-01, and directly caused regressions. No implementation fix, P6 work, merge, push, or deployment was performed.

## Repository State

| Check | Independently observed result |
|---|---|
| Worktree | `<repo>/.worktrees/production-dev` |
| Branch | `production-dev` |
| HEAD | `4c4e15a464c2f538ac3c2af84ad1fefba95b6c5c` |
| Parent | `ecfe1fad494f6af4ce0ca6d0a9700a0243ddb495` |
| Initial state | Clean |
| Remote `origin/production-dev` | `ecfe1fad494f6af4ce0ca6d0a9700a0243ddb495`; correction commit is not pushed |
| Main merge/deployment | No evidence of either in the reviewed diff or repository state |
| P6 WP-39..41 | Not started; the only WP-40 match is a comment identifying P6 ownership of future Overview behavior |

The checkout at `<repo>` was not the target branch and already contained unrelated user changes. All verification and the sole new report were confined to the `production-dev` worktree.

## Correction Diff Scope

`git show --stat 4c4e15a` reports 22 files, 1,166 insertions and 68 deletions. The changed files are limited to the targeted Astro components/data binding, Gallery route, QA gate, Playwright/capture/test coverage, and append-only P4/P5 evidence documents. No source file for WP-39, WP-40, or WP-41 behavior was introduced.

The diff is directionally in scope, but the committed evidence does not establish all claimed outcomes. Four IMP items remain open and two directly related evidence defects remain.

## IMP-01 AVIF Consumption

**AVIF-PRIMARY-CONSUMPTION: FAIL**

Static implementation is structurally correct:

- Home hero, GalleryCard, and PhotoFigure use `<picture>` with `source[type="image/avif"]` and JPEG `<img>` fallback.
- AVIF/JPEG width descriptors, `sizes`, and intrinsic dimensions are propagated from WP-24 structured selectors; no filename parsing or WebP path was found.
- Home and first-Gallery loading/fetch-priority attributes remain present.

Browser evidence does not prove successful consumption:

- Chromium selected AVIF as `currentSrc` for Home and the first Gallery image.
- Both selected AVIF URLs returned HTTP 404 under the canonical built preview because `npm run build` emits no `dist/media/` and Astro preview exposes no `/media/` files.
- `naturalWidth` and `naturalHeight` were therefore both zero in the unmodified production preview.
- Resource timing showed both the JPEG preload and the selected AVIF request for the same LCP photo. The page preloads the JPEG fallback while `<picture>` selects AVIF, producing two requests rather than one selected-candidate preload.

The added browser tests are insufficient: the `currentSrc` assertion checks only a `.avif` suffix, not response success, decode, or positive intrinsic dimensions. The preload assertions also compare relative `getAttribute("href")` values with absolute `img.src`, so they fail for the wrong reason and never validate the intended network contract.

Smallest correction:

1. Make the generated media authority available at `/media/` in the canonical production/preview artifact boundary, without reopening D1-D10.
2. Make the single LCP preload responsive and AVIF-aligned (`imagesrcset`/`imagesizes` or an equivalent standards-compliant selected-candidate preload) so Chromium does not fetch both JPEG and AVIF.
3. Assert HTTP 200, successful decode/positive intrinsic dimensions, AVIF `currentSrc`, and exactly one LCP image transfer in fresh browser contexts.

Exact re-verification: clean production build; serve the actual artifact; verify Home, GalleryCard, and first Gallery photo at 1440×900 and 390×844; require successful AVIF responses and no duplicate JPEG LCP transfer; rerun targeted and canonical E2E.

## IMP-02 G3 Hero

**G3-NO-CROP: PASS**

Because the canonical preview currently returns image 404s (IMP-01), geometry was independently measured a second time with Playwright fulfilling the exact selected filenames from `generated/media/`, without changing page HTML or CSS.

| Viewport | Intrinsic | Rendered | Cap | Ratio delta | Clipping ancestors | Center delta | Full photograph visible |
|---|---:|---:|---:|---:|---|---:|---|
| 1440×900 | 1440×959 | 1013.125×675 | 675 | 0.00064 | none | 0 px | YES |
| 390×844 | 390×259 | 389.984×259.891 | 590.8 | 0.00522 | none | 0.008 px | YES |
| 844×390 | 843×562 | 351.125×234 | 234 | 0.00053 | none | 0 px | YES |

The frame remains width-bound and centered, has no `overflow:hidden`/`clip` ancestor, and the image box is contained under the relevant 75/70/60svh cap. No source edge is clipped. No separate portrait featured hero exists in the current Home resolution; the available gallery portrait regression remains green.

The corrected ancestor walk uses `parentElement`. The old `ecfe1fa` HomeHero explicitly set `.home-hero-frame { overflow: hidden; }`, so the corrected clipping check would find the frame and fail. However, the new desktop test also incorrectly expects `getComputedStyle(img).width` to equal the literal string `auto`; browsers return the used pixel width. That assertion fails on the corrected implementation and is recorded under Test Integrity rather than as a product G3 failure.

## IMP-03 Preview Gallery Routing

**PREVIEW-DRAFT-ROUTING: PASS**

Observed build outputs:

- Production: exactly 10 published Gallery directories; `long-gallery-72` and `essen-industrial-light` absent; published Gallery pages present.
- Preview: both draft Gallery routes present in addition to published routes.
- All Gallery hrefs emitted by preview Archive and Place pages resolved to an emitted preview route; no dead link was found.
- `long-gallery-72` rendered 72 figures and the JS-gated Overview trigger. With the current production-only 1008-record manifest it rendered honest missing-media compositions (0 `<picture>`, 0 `<img>`), not fabricated or unrelated URLs.
- Production still propagates selector failure and remains fail-closed.
- The committed route passes `allGalleries: galleries` explicitly in `getStaticPaths`; it no longer destructures a nonexistent PageDataSet field. Runtime Gallery collections were defined.

Preview Archive and Places index HTML is materially different from production because it includes drafts. That is valid preview routing, but it invalidates the IMP-05 claim that the entire preview capture suite is byte-identical to production.

## IMP-04 Back-to-Origin

**BACK-TO-ORIGIN: FAIL**

Real-link-click browser results:

| Entry path | Header result | Ending result | Verdict |
|---|---|---|---|
| Home → Gallery | `/`, `Back to Home` | `/`, but text remains `Back to Archive` | FAIL: unsynchronized visible label |
| Archive → Gallery | `/archive`, `Back to Archive` | `/archive`, `Back to Archive` | PASS |
| `/places/reine` → Gallery | `/places/reine`, `Back to Place` | `/places/reine`, but text remains `Back to Archive` | FAIL: unsynchronized visible label |
| Direct entry | `/archive` | `/archive` | PASS |
| JavaScript disabled | static `/archive` | static `/archive` | PASS |
| Reload/direct reload | safe `/archive` fallback | safe `/archive` fallback | PASS |
| External referrer | safe `/archive` fallback | safe `/archive` fallback | PASS |
| Same-origin `/about` | safe `/archive` fallback | safe `/archive` fallback | PASS |
| Another Gallery | safe `/archive` fallback | safe `/archive` fallback | PASS |
| Same-origin `/places/not-real` | accepted as `/places/not-real` | accepted as `/places/not-real` | FAIL: unsupported Place accepted |

There is no open redirect and no client router/Previous relation. The defect is narrower: the script accepts any nonempty `/places/{segment}` without checking it against the valid Place collection, and updates ending hrefs without updating ending labels.

The added Home/Place tests use consecutive `page.goto()` calls instead of clicking an actual Gallery link, so they do not reliably generate the intended referrer and failed in the canonical run. They also assert only ending href synchronization, not ending text, and omit invalid/external/reload/another-Gallery cases.

Smallest correction: serialize the finite valid Place-origin allowlist into the page script (or an equivalently bounded data attribute), accept only Home, Archive, and known Place routes, and update the shared visible label as well as href for every origin link.

Exact re-verification: click real links from Home, Archive, and `/places/reine`; exercise both header and ending links and assert destination plus visible text; repeat direct, no-JS, reload, external, irrelevant, another-Gallery, malformed and nonexistent-Place cases.

## IMP-05 WP-38 Baseline

**WP38-LONG-GALLERY-BASELINE: FAIL**

The state definition exists and targets `/galleries/long-gallery-72`. A preview build emits the route, renders 72 figures without count-based compression, exposes the Overview trigger with JS, and contains no Overview modal/dialog behavior. Those product/state prerequisites are correct.

The normal baseline workflow is not valid:

- `capture.mjs` runs `build:preview` only when `dist/index.html` is absent. If a production `dist/` already exists, it reuses it.
- This exact sequence occurred: after a production build, `npm run capture` reported `14/14 states captured`, but visual inspection of `tests/captures/gallery-desktop-long-72/index.png` showed a full 404 page, not a long Gallery.
- The runner does not reject non-2xx navigation, does not assert 72 figures/Overview trigger, and treats broken-image decode errors as deterministic success.
- No governed `tests/baselines/.../gallery-desktop-long-72/index.png` exists.
- `npm run capture:diff` exited 0 while reporting every capture, including `gallery-desktop-long-72`, as `no-baseline`; it is explicitly informational only.
- Preview Archive and Places index hashes differ from production because draft content is included. Running every published baseline from preview therefore contaminates production-representative discovery semantics.

Smallest correction: make capture build the required mode unconditionally into a fresh/isolated output, fail on non-2xx or state-contract mismatch, separate preview-only long-gallery capture from production baseline captures, and add the long state to the governed baseline layout/diff mapping.

Exact re-verification: start from both absent and pre-existing production `dist/`; require the long capture to show 72 figures and Overview trigger; require production states to be captured from production output; require `capture:diff` to match governed baselines rather than `no-baseline` or a 404 screenshot.

## IMP-06 QA Probe Boundary

**QA-PROBE-PRODUCTION-EXCLUSION: FAIL**

The post-build gate does remove `dist/qa-probe/` after a normal `npm run build`; final normal production `dist/` contained no QA page and `/qa-probe` returned 404. No alternate hidden QA route was found.

The mechanism is not fail-safe across the canonical production path:

- `QA_PROBE=1 npm run build` still runs the canonical `ASTRO_PRODUCTION_VALIDATE=1 astro build`, exits 0, and leaves `dist/qa-probe/index.html` present.
- `playwright.config.ts` always sets `QA_PROBE=1` while describing the result as the production build, then the correction E2E simultaneously expects `/qa-probe` to be 404. The canonical E2E run therefore received 200 and failed.
- The integration check scans whatever `dist/` already contains. It failed in the full integration run after QA-enabled output was present, then passed 11/11 after a normal build removed the route. This is shared-output ordering/environment leakage, not a cold-cache timeout.
- `QA_PROBE=1` has no additional test-only guard. An ordinary production invocation with that environment variable silently ships the route rather than failing closed.

Smallest correction: separate the canary fixture from canonical production output, or require an explicit test-build mode that cannot coexist with production validation; make a production build fail if `QA_PROBE=1` would retain the route; make integration assertions build/inspect an isolated fresh artifact.

Exact re-verification: clean normal production build (route absent); deliberate `QA_PROBE=1` production invocation (must fail or still exclude); isolated E2E/a11y canary run; canonical E2E must simultaneously prove canary semantics and production route exclusion without contradictory server modes; full integration must be order-independent.

## MIN-01 G7 Punctuation

**G7-PUNCTUATION: PASS**

Rendered continuation text and active test expectations use `Next Gallery — {title}` with U+2014. The active component has no visible ASCII `Next Gallery --`. Desktop/mobile end pauses remain 168/112, serif title sizes remain 28/22, and the no-next variant remained green. Historical gate/report text still contains the old wording as append-only history or a stale code comment; neither is visible product copy.

## Test Integrity Review

**Result: FAIL — material false/insufficient assertions remain.**

| Sample | Would it reliably fail against `ecfe1fa`? | Result |
|---|---|---|
| Home ancestor overflow | Yes for the `parentElement` clipping scan; old frame had `overflow:hidden` | Product-sensitive, but current desktop test also falsely expects computed width `auto` and fails green implementation |
| AVIF browser selection | No for successful consumption; suffix-only `currentSrc` passes even when response is 404 | Inadequate |
| Preview route | Yes for route emission and explicit collection; missing-media sentinel remains honest | Adequate for routing |
| Back-to-origin | No as written for real navigation; uses `page.goto`, omits labels/invalid origins | Inadequate |
| QA production exclusion | State-dependent and contradicted by the QA-enabled server configuration | Inadequate |
| Long-gallery capture | No; a 404 screenshot is counted as success and no governed baseline is required | Inadequate |

Additional direct defects:

- AVIF preload assertions compare relative `getAttribute("href")` to absolute `img.src`.
- The new integration regex intended to reject literal width placeholders is ineffective for ordinary numeric width descriptors.
- The historical correction report claims all states matched governed baselines and that published pages are byte-identical between modes; both are contradicted by current capture/diff and build hashes.

## Integration Timeout Adjudication

**Disposition: C — IMPORTANT REGRESSION.**

Canonical `npm run test:integration` exited 1 after 149.76 seconds: 21 files passed, 1 failed; 224 tests passed, 1 failed. The sole failure was IMP-06 finding `dist/qa-probe/index.html`.

This is not one of the previously disclosed cold-cache timeout areas. The targeted integration file passed 11/11 after a normal production build removed the QA route. The different outcome proves shared `dist/` state/order dependence introduced by the correction boundary. Canonical full integration is not PASS.

## Preview Media Boundary

**PREVIEW-MEDIA-BOUNDARY: PASS**

- The pipeline defaults to published-only selection; drafts require explicit `--include-drafts`.
- Current production closure is 1008/1008 for 51 published photos.
- Draft derivatives are temporary generated output, not source authority; a subsequent normal production pipeline manifest/prune restores the production set.
- No WEB INGEST MASTER, content corpus, frozen D1-D10 decision, or P3 architecture file changed in `ecfe1fa..4c4e15a`.
- Privacy scan passed on the current production generated set.

The expensive draft derivation was not rerun because routing/sentinel/capture defects were already deterministically testable and the request explicitly avoided unnecessary full media derivation.

## Regression Results

| Command / check | Exit / result | Adjudication |
|---|---:|---|
| `npx vitest run tests/integration/p4p5-corrections.test.ts` after clean production build | 0; 11/11 | PASS in isolation; demonstrates order dependence versus full integration |
| `npm run test:unit` | 0; 19 files, 317/317 | PASS |
| `npm run test:integration` | 1; 21 files pass, 1 fail; 224/225 | IMPORTANT regression: shared `dist/qa-probe` state |
| `npm run test:e2e` first clean startup | 1; webServer exited early and left daemon | Harness instability |
| `npm run test:e2e` against the produced server | 1; 107/114 | Seven failures: G3 false assertion, two URL-comparison errors/one interrupted AVIF check, two fake-referrer tests, QA route contradiction |
| `npm run test:a11y` | 0; 6/6 | PASS |
| `npm run check` | 0; 0 errors, 0 warnings, 3 unchanged hints | PASS |
| `npm run validate:content` | 0; 0 errors, 0 warnings | PASS |
| `npm run build` | 0; 21 generated then QA stripped; final 20 canonical pages | PASS for normal build only |
| `npm run build:preview` | 0; 26 generated then QA stripped; final 25 pages | PASS |
| Preview emitted-card link closure | 0; 12 unique Gallery links, 0 missing routes | PASS |
| `npm run media:coverage` | 0; 1008/1008, 51 complete | PASS |
| `npm run media:privacy-check` | 0; 657 files scanned | PASS |
| `npm run capture` with occupied preview singleton | 1; server not ready | Harness instability |
| `npm run capture` after stopping singleton | 0; 14/14 reported | FALSE GREEN: long state captured 404 page |
| `npm run capture:diff` | 0; all listed as `no-baseline` | Informational, not valid baseline proof |

## P4 Gate Matrix

| P4 criterion | Result |
|---|---|
| G3 Home hero | PASS |
| Featured ADR-019 | PASS |
| Archive photographed-year | PASS |
| Places names-led/no-count | PASS |
| Canonical production routes | FAIL — QA-enabled canonical production invocation can retain `/qa-probe` |
| Accessible no-JS navigation | PASS |
| Discovery VR baselines | FAIL — capture mode/state and `no-baseline` governance regression |

## P5 Gate Matrix

| P5 criterion | Result |
|---|---|
| Base rhythm 96/64 | PASS |
| Authored Compact/Breathing only | PASS |
| Caption contract | PASS |
| G7 continuation/no-next | PASS for G7/no-next; Back-to-origin label synchronization FAIL is recorded under IMP-04 |
| Position annotation | PASS |
| Non-sticky frozen header | PASS |
| Gallery VR baselines | FAIL — long-gallery capture can be a 404 and is not governed |

## Remaining Findings

### Important (4)

1. **IMP-01:** AVIF `currentSrc` points to an unavailable production asset and LCP performs JPEG preload plus AVIF request. Correct the served media boundary and selected-candidate preload; reverify successful decode/HTTP status and transfer count.
2. **IMP-04:** ending labels are not synchronized for Home/Place and arbitrary `/places/{segment}` referrers are accepted. Bound origin selection to known discovery routes and update href plus text; reverify with real clicks and hostile/invalid referrers.
3. **IMP-05:** capture can reuse production `dist/`, count a 404 long-gallery screenshot as success, and has no governed long baseline; preview also contaminates production discovery states. Isolate modes, validate state/HTTP, and govern the baseline; reverify from clean and pre-existing outputs.
4. **IMP-06:** `QA_PROBE=1 npm run build` is a successful canonical production build that retains the QA route; test configuration and route expectation contradict each other, and full integration is state-dependent. Separate test fixture mode and make production fail closed; reverify all build orders.

### Minor (2)

1. Correction tests contain false/insufficient assertions: computed `width:auto`, relative-vs-absolute preload comparison, suffix-only AVIF success, fake referrer navigation, and ineffective width-placeholder check. Replace only those assertions with observable product/network/state contracts.
2. Gate evidence omits the disclosed pre-commit `allGalleries`/`img.parents` defects and makes contradicted byte-identical/all-baselines-green claims. Append a factual correction addendum after implementation is fixed; do not rewrite historical failures.

### Critical (0)

No broad unsafe or material structural regression was found.

## Final Gate

> P4/P5 IMPLEMENTATION VALID — Targeted correction still required before P6.

Counts: Critical 0; Important 4; Minor 2.

P6 WP-39..41 is not authorized. The next authorized phase is another narrowly scoped P4/P5 correction implementing only the four Important closures and the directly related test/evidence repairs above, followed by the exact targeted re-verification listed for each item.
