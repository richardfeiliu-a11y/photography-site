# Testing and Visual Regression — Quiet Archive Production

**Status:** CANONICAL -- engineering authority
**Companion to:** CONTENT_MODEL.md, BUILD_AND_ROUTING.md, IMAGE_PIPELINE.md, DEPLOYMENT_ARCHITECTURE.md, BACKUP_AND_RECOVERY.md, RUNTIME_AND_PROGRESSIVE_ENHANCEMENT.md, PERFORMANCE_BUDGET.md, FINAL_DESIGN_SPECIFICATION.md

---

## 1. Purpose and scope

This document defines the canonical testing architecture for the Quiet Editorial Archive. It specifies test categories, contract-level semantics, and visual regression governance. It does not contain executable test code. All examples are labeled PSEUDOCODE / CONTRACT EXAMPLE and must not be treated as verified or working assertions.

Testing protects frozen product decisions (FINAL_DESIGN_SPECIFICATION.md G1-G7, Overview behavior, captions, continuation, accessibility) and canonical architecture invariants (SOURCE_OF_TRUTH_MATRIX.md, TECHNICAL_API_VERIFICATION.md).

No claim of tested, verified, or working behavior is made in this document. No executable repository evidence exists at the architecture stage.

---

## 2. Test categories (canonical)

The following seven categories are the complete set. Each is a first-class architectural concern, not an afterthought.

| Category | Protects | Primary phase |
|---|---|---|
| Content/schema validation | Authored YAML correctness, identity integrity, lifecycle rules | P2 |
| Source/manifest closure | Every source resolves; every manifest entry has a physical derivative | P3, P5 |
| Interaction | Overview modal, Menu, navigation, progressive enhancement | P6 |
| Accessibility | WCAG 2.2 AA target, keyboard, focus, screen reader, reduced motion | P7 |
| Visual regression | Frozen design fidelity across implementation changes | P8 |
| Deployment smoke | Atomic release correctness, rollback fidelity, live-target health | P9 |
| Backup restore drill | Recovery from loss scenarios within RPO/RTO targets | P9 |

---

## 3. Content and schema validation

### 3.1 Identity and content contracts

These tests validate authored persistent state per SOURCE_OF_TRUTH_MATRIX.md and CONTENT_MODEL.md. They enforce fail-closed semantics for production builds: published content must never silently skip broken references.

Contract-level requirements:

- **Rename/move preserves Photo ID:** When a WEB INGEST MASTER file is renamed or moved and the corresponding `source_ref` in Gallery YAML is updated, the Photo ID remains unchanged. The binding between Photo ID and source is authoritative in Gallery YAML, not in generated state.
- **Corrected master replacement retains ID:** A corrected/re-exported master that replaces an existing WEB INGEST MASTER (same editorial photograph) retains the same Photo ID per UD-002. SHA-256 changes are integrity metadata, not identity.
- **Generated deletion rebuilds derived state:** Deleting `generated/` and rebuilding produces the same logical derivative set and manifest references from the same authored inputs and ingest masters (semantic determinism per IMAGE_PIPELINE.md).
- **Duplicate ID rejection:** Duplicate Gallery IDs, Photo IDs (globally), and Place IDs are rejected. Build fails closed.
- **Published/draft closure:** Only Galleries with `status: published` generate public routes, enter Archive/Places/Home/sitemap, and appear in discovery. Draft Galleries are excluded from production output per UD-009.
- **Featured resolution determinism:** If `featured_gallery_id` in Home settings (`content/site/home.yaml`) points to a valid published Gallery, that Gallery is featured. Otherwise, fallback is latest published Gallery by `published_at` descending with stable Gallery ID tie-break per UD-004.
- **published_at ordering:** Latest/Recent ordering uses `published_at`, never photographed time, EXIF capture time, file mtime, Git timestamp, or folder name per UD-003.
- **Cover membership:** Published Gallery requires explicit `cover_photo_id` referencing a Photo inside that same Gallery. Silent first-Photo default is forbidden per UD-010.
- **next_gallery validation:** Target Gallery exists; target is published in production output; target is not self. Cycles (A -> B -> C -> A) are allowed per UD-007. No graph acyclicity test. Dangling targets are forbidden.
- **Redirect closure:** Every redirect in `content/redirects.yaml` satisfies: old path is historical only (not a current canonical route); exactly one target type per entry (`gallery_id` XOR `place_id`); target Gallery or Place exists and resolves to a public/published canonical route; no redirect loops; no route collisions. Redirect delivery follows the generated Nginx 301 include lifecycle per BUILD_AND_ROUTING.md section 5 and DEPLOYMENT_ARCHITECTURE.md section 3.3.

### 3.2 Schema enforcement

Build-time schema validation enforces the Zod (or equivalent) schemas defined in CONTENT_MODEL.md. Required fields for published Galleries include: `id`, `slug`, `status`, `title`, `published_at`, `places[]`, `cover_photo_id`, `photos[]` (non-empty). Draft Galleries may temporarily omit `cover_photo_id` and `published_at`.

---

## 4. Source and manifest closure

These tests verify that the build DAG (BUILD_AND_ROUTING.md section 1) produces a complete, consistent assembled release.

Contract-level requirements:

- **Delete generated/ and rebuild:** After deleting `generated/`, a clean build reproduces the asset manifest and all derivatives from authored YAML plus WEB INGEST MASTERS.
- **Delete dist/ and rebuild:** After deleting `dist/`, a clean build reproduces the full site output.
- **Fresh checkout build:** A fresh clone/checkout with access to WEB INGEST MASTERS produces a valid build without stale state.
- **Manifest exists before Astro consumes it:** The asset manifest (`generated/asset-manifest.json`) is produced by the image pipeline before Astro build begins. Astro imports the manifest at build time, not at browser runtime.
- **Every HTML-referenced asset exists in assembled release:** For every `<img src="...">` or `srcset` reference in generated HTML, the referenced file exists in the final assembled release directory. No dangling references.
- **Derivative coverage:** Every Photo in every published Gallery has complete derivative entries in the manifest. Incomplete coverage blocks the integrity gate per BUILD_AND_ROUTING.md and DEPLOYMENT_ARCHITECTURE.md.

---

## 5. Image pipeline tests

These tests protect IMAGE_PIPELINE.md contracts.

Contract-level requirements:

- **EXIF orientation normalization:** Output derivatives have correct visual orientation regardless of source EXIF orientation tag. The pipeline applies auto-rotate before derivation.
- **ICC handling per policy:** If a valid source ICC profile exists, the pipeline converts to sRGB honoring it. If no ICC profile exists, the pipeline treats the source according to the documented no-profile policy (assume sRGB for MVP, clearly documented). Camera-model guessing is not used. See IMAGE_PIPELINE.md and TECHNICAL_API_VERIFICATION.md.
- **Privacy stripping verified on outputs:** Public derivatives contain no GPS coordinates, camera/device serial identifiers, or unnecessary private metadata. Automated sampling or exhaustive checks confirm stripping. Source masters remain untouched.
- **Aspect-ratio preservation:** Derivatives preserve source aspect ratio. No upscale beyond intrinsic dimensions. No destructive crop. `withoutEnlargement` semantics enforced.
- **Semantic determinism:** Repeat build from same source bytes, authored metadata, toolchain versions, and pipeline configuration produces the same logical derivative set and manifest references. Byte-for-byte determinism is only claimed if toolchain/version/environment tests actually prove it; do not assert SHA-256-identical output across arbitrary Sharp/libvips versions or machine environments.

---

## 6. Interaction tests

### 6.1 Overview modal

Overview behavior is frozen in FINAL_DESIGN_SPECIFICATION.md section 3.1. Tests protect these contracts at the semantic level.

Contract-level requirements:

- **Visibility/state, not DOM detachment:** The Overview layer element may remain attached in the DOM when closed. Tests must check visibility state (e.g., presence of the `hidden` attribute, or `toBeHidden`-style semantics), NOT whether the element has been detached from the DOM. Waiting for DOM detachment contradicts the architectural model where the element persists and toggles visibility.
- **Focus restoration on close:** When Overview is closed (by button, Escape key, or any valid close mechanism), focus returns to the element that triggered opening. This MUST be tested. Incorrect focus restoration breaks keyboard navigation flow.
- **Focus trap cycling:** While Overview is open, Tab and Shift+Tab cycle through focusable elements within the modal boundary. Focus does not escape to background content. Cycling across first/last focusable boundaries MUST be tested (e.g., Tab on last element wraps to first; Shift+Tab on first wraps to last).
- **Escape closes:** Pressing Escape while Overview is open closes it and restores focus.
- **Background scroll lock:** While Overview is open, background page scrolling is prevented.
- **Jump-to-photo position restoration:** Selecting a Photo thumbnail in Overview navigates to that Photo in the Gallery sequence and restores the exact scroll position.

PSEUDOCODE / CONTRACT EXAMPLE -- Overview interaction semantics:

```text
// PSEUDOCODE / CONTRACT EXAMPLE
// These describe required test semantics, not executable assertions.

GIVEN Overview is closed
WHEN user activates the Overview trigger
THEN Overview becomes visible (hidden attribute removed or equivalent)
AND focus moves into the Overview layer
AND background scroll is locked

GIVEN Overview is open
WHEN user presses Tab repeatedly
THEN focus cycles through focusable elements within Overview
AND focus never escapes to background content
AND after passing the last focusable element, focus returns to the first

GIVEN Overview is open
WHEN user presses Escape
THEN Overview becomes hidden (hidden attribute present or equivalent)
AND focus returns to the Overview trigger element
AND background scroll is unlocked

GIVEN Overview is open
WHEN user selects a Photo thumbnail
THEN Gallery scrolls to the selected Photo
AND Overview closes
AND focus returns appropriately
```

### 6.2 Menu

Menu follows the same focus-trap, Escape-close, and focus-restoration semantics as Overview. Core site navigation must remain usable without JavaScript per RUNTIME_AND_PROGRESSIVE_ENHANCEMENT.md.

### 6.3 Navigation

Core navigation (site links, Gallery sequence, continuation) works via native HTML links. Progressive enhancement adds interaction layers but does not create inaccessible fallback states.

---

## 7. Accessibility tests

Target: WCAG 2.2 AA (FINAL_DESIGN_SPECIFICATION.md section 5).

### 7.1 Automated

Automated scanning (e.g., axe-core or equivalent) runs against every page type: Home, Archive, Places Index, Place Detail, Gallery, About. Zero violations expected. Incomplete results require manual review.

### 7.2 Manual

Manual testing is required because automated tools cannot verify all WCAG criteria. Contract-level requirements:

- **Keyboard traversal:** Full page navigation via keyboard alone. Skip link targets `#main`. Logical tab order per FINAL_DESIGN_SPECIFICATION.md section 5.1.
- **Visible focus:** 2px solid outline #0B57D0 with 3px offset on all focusable elements per FINAL_DESIGN_SPECIFICATION.md section 5.2. Focus blue is functional only, never decorative.
- **Touch targets:** Minimum 44px for interactive elements. Menu links, close buttons, Overview cells meet sizing requirements per FINAL_DESIGN_SPECIFICATION.md section 5.3.
- **Reduced motion:** `prefers-reduced-motion: reduce` zeroes layer transitions. JS close paths complete synchronously. No sequence entrances under reduced motion per FINAL_DESIGN_SPECIFICATION.md section 5.4.
- **Screen-reader semantics for Overview:** `aria-modal="true"` on Overview dialog. Proper heading hierarchy (exactly one `<h1>` per page, no skipped levels). Position annotation is `aria-hidden` (decorative). Close button has accessible text label.

---

## 8. Visual regression

Visual regression testing separates two distinct concerns that the previous architecture conflated.

### 8.1 Screenshot capture determinism

The goal is that the same controlled environment yields stable screenshots as reasonably possible. This is an infrastructure property, not a universal guarantee.

Requirements:

- **Pinned browser version:** The capture tool uses a specific, pinned browser binary (not "latest"). Stage 3C-style deterministic capture tooling (`prototype-stage3c/tools/capture.js`) is the reference methodology.
- **Pinned OS and fonts:** Capture runs on a consistent OS with installed font files matching the frozen families (Source Serif 4, Source Sans 3, Noto Serif SC, Noto Sans SC).
- **Fixed viewport dimensions:** Desktop 1440x900, mobile 390x844 (logical pixels, deviceScaleFactor = 1), matching Stage 3C protocol.
- **Font readiness:** Wait for `document.fonts.ready` before capture.
- **Network idle:** Wait for network quiescence to ensure all assets loaded.
- **Lazy image forcing:** Force loaded state on lazy images before capture.
- **Animation settling:** Wait for CSS transitions/animations to complete.
- **Deterministic capture tooling:** Stage 3C Playwright-based capture methodology is the reference. Exact tooling choice may evolve but must maintain these invariants.

SHA-256 may verify that baseline files have not been modified inside one controlled baseline workflow (file integrity check). It is NOT universal visual-equivalence proof across different browsers, operating systems, font rasterizers, or machines.

### 8.2 Visual equivalence

Visual equivalence determines whether a new capture is acceptably similar to an approved baseline. This is a judgment process, not a byte comparison.

Requirements:

- **Image diff with thresholds:** Use pixel-diff tooling with configurable thresholds. Small rendering differences from sub-pixel anti-aliasing, font hinting, or compositing are expected noise, not drift.
- **Human adjudication:** Threshold failures require human review. A diff above threshold may be acceptable (rendering variation) or unacceptable (implementation drift). Automated pass/fail alone is insufficient.
- **Governed baseline updates:** When an intentional design change is approved through the frozen design authority (FINAL_DESIGN_SPECIFICATION.md), baselines are updated through a controlled process. Baseline updates are not automatic. Difference classification: IMPLEMENTATION DRIFT (unauthorized change, must be fixed) versus APPROVED DESIGN UPDATE (baseline updated per design freeze authority).
- **Masking:** Dynamic regions (timestamps, non-deterministic content) may be masked from comparison.
- **Do NOT require SHA-256-identical PNG bytes across arbitrary environments.** Different browser versions, operating systems, font rasterizers, and GPU compositors produce visually equivalent but byte-different renders. Requiring byte identity across these contexts produces false failures and encourages implementers to game the test rather than fix real problems.

### 8.3 Frozen regression states

Inherit canonical states from FINAL_DESIGN_SPECIFICATION.md and Stage 3C evidence. At minimum:

| View | Description |
|---|---|
| Home desktop | Hero, Recent Galleries grid, discovery links |
| Home mobile portrait | Responsive hero, single-column recent grid |
| Gallery desktop (base rhythm) | Standard photo-to-photo spacing |
| Gallery desktop (breathing rhythm) | Chapter-shift spacing |
| Gallery desktop end pause | Continuation with 168px end pause, Next title serif |
| Gallery mobile caption | Caption visibility, mobile position annotation |
| Overview desktop open | 6-column grid, current marker, focus trap |
| Overview mobile open | 3-column grid, contained uncropped thumbnails |
| Menu mobile expanded | Accessible menu overlay |
| Archive desktop | Year headings, multi-column card grid |
| Places index desktop | Geographic listing |

Full screenshot selection: `research/final-visual-review/SCREENSHOT_SELECTION.md`.

---

## 9. Deployment smoke tests

Deployment smoke tests are a first-class category, not an afterthought. They verify DEPLOYMENT_ARCHITECTURE.md contracts.

Contract-level requirements:

- **Interrupted upload never switches:** If upload to the candidate release directory is incomplete or interrupted, the current symlink is not changed. The live site continues serving the previous release.
- **Pre-switch verify failure blocks switch:** Before the atomic pointer switch, candidate verification (index exists, canonical routes exist, asset manifest closure, no source masters in public root, no draft routes, no GPS leakage in sampled derivatives, static 404 behavior) must pass. Any failure blocks the switch entirely.
- **Post-switch smoke failure triggers rollback:** After switching the current symlink to the candidate, HTTP smoke tests run against the live target. If smoke fails, the system rolls back to the exact captured previous target (the symlink target recorded BEFORE the switch, not a newly computed value).
- **Deployment lock:** Concurrent deployments are prevented. Only one deployment process may execute the switch sequence at a time.
- **Previous target captured before switch:** The exact current symlink target is read and stored before any mutation occurs. Rollback restores this exact target. The previous pointer is never set to point at current after the switch.
- **Redirect config lifecycle:** When a release changes redirect config, the deployment verifies the generated Nginx redirect include against validated redirects, passes `nginx -t` before activation, reloads only when redirect config changed, smoke-tests HTTP 301 behavior after the switch, and on failure rolls back BOTH the exact previous release and the exact previous redirect config (BUILD_AND_ROUTING.md section 5, DEPLOYMENT_ARCHITECTURE.md section 3.3).

---

## 10. Backup restore drill

Backup restore drills verify BACKUP_AND_RECOVERY.md contracts. They are scheduled exercises, not theoretical plans.

Contract-level requirements:

- **Restore from off-site backup:** Demonstrate recovery of authored YAML, Home settings, redirects, and WEB INGEST MASTERS from encrypted off-site backup to a clean environment.
- **RPO validation:** Verify that backup recency meets the RPO target (no more than 24 hours of data loss).
- **RTO validation:** Measure time from restore initiation to a functioning site. Must meet the RTO target (no more than 24 hours).
- **Rebuild after restore:** After restoring authored state and ingest masters, a clean build produces a valid site. Generated state (manifest, derivatives, dist) is regenerated, not restored from backup.
- **Drill frequency:** Restore drills occur on a regular schedule (at minimum quarterly, recommended monthly during active development). Results are documented.

---

## 11. Build integrity tests

These tests verify the build DAG produces a correct assembled release. They bridge content validation and deployment.

Contract-level requirements:

- **Delete generated/ then build:** Validates regenerability of derived state.
- **Delete dist/ then build:** Validates full output regenerability.
- **Fresh checkout build:** Validates no dependency on uncommitted local state.
- **Manifest-before-Astro invariant:** The asset manifest exists and is populated before Astro build consumes it. This is an architectural invariant, not an implementation detail.
- **Assembled release closure:** Every asset referenced in HTML exists in the assembled release directory. No orphaned derivatives. No missing manifest entries.

---

## 12. Benchmark-required items

The following values are ENGINEERING BENCHMARK REQUIRED. Tests must not hardcode these until measured against real photography fixtures (F01-F10 categories, 113 JPEGs):

- Responsive derivative width steps
- Encoder quality values for benchmark candidate formats (JPEG/WebP/AVIF)
- Encoder choice (Sharp vs libvips direct)
- sRGB ICC embedding policy for output derivatives
- High-DPR desktop optimization strategy
- Exact CJK subset character corpus

Measure using real photography fixtures on target devices before freezing values. Record results in OPEN_QUESTIONS.md and update this document when benchmarks complete.

---

## 13. What this document does not contain

- Executable test code. All examples are PSEUDOCODE / CONTRACT EXAMPLE.
- Selector strings or assertion library calls presented as canonical API. Implementation chooses testing libraries.
- Claims of tested, verified, or working behavior. No executable repository evidence exists at the architecture stage.
- CI pipeline configuration as architecture. CI is implementation infrastructure.
- Performance budget values that have not been measured. See PERFORMANCE_BUDGET.md for benchmark-required classification.

---

**END OF TESTING AND VISUAL REGRESSION**
