# Performance Budget — Quiet Editorial Archive

**Status:** CANONICAL — engineering authority
**Companion to:** FINAL_DESIGN_SPECIFICATION.md, RUNTIME_AND_PROGRESSIVE_ENHANCEMENT.md, IMAGE_PIPELINE.md, BUILD_AND_ROUTING.md
**Rule:** This document classifies all performance targets into four categories. Unmeasured aspirations are labeled as engineering budgets and must not be enforced as CI gates until a baseline exists. Image quality must not be sacrificed to arbitrary byte limits.

---

## 1. Budget classification system

All performance values in this document fall into exactly one of four classes:

| Class | Definition | Enforcement |
|---|---|---|
| STANDARD WEB TARGET | Industry-standard metrics with published thresholds (Core Web Vitals). Applicable to all sites. | Lab testing from P7 onward. Field measurement when traffic exists. |
| PROJECT ENGINEERING BUDGET | Aspirational targets specific to this project. Not yet measured against real builds. | Guidance for implementation. Must be validated against a real baseline before becoming CI gates. |
| BENCHMARK REQUIRED | Values that depend on fixture measurements, encoder selection, viewport/DPR analysis, or content-specific data. Cannot be set accurately without running the pipeline. | Must be measured during P3 image benchmark harness. No frozen value until benchmark completes. |
| MEASURED BASELINE | Values recorded from actual production or staging builds under defined conditions. | Authoritative once recorded. Updated when toolchain or content changes materially. None exist yet. |

No value may move from ENGINEERING BUDGET or BENCHMARK REQUIRED to an enforced gate without first being recorded as a MEASURED BASELINE.

---

## 2. Core Web Vitals targets (STANDARD WEB TARGET)

These are standards-based targets applicable to any web page. They do not require project-specific calibration.

| Metric | Target | Scope | Measurement |
|---|---|---|---|
| LCP (Largest Contentful Paint) | <= 2.5s | Home hero, Gallery first Photo, Archive/Places first card | Lab (Lighthouse, DevTools) from P7; field (CrUX) when traffic exists |
| CLS (Cumulative Layout Shift) | <= 0.1 | All pages | Lab + field |
| INP (Interaction to Next Paint) | <= 200ms | Overview open/close, Menu toggle, Overview jump | Lab (interaction recording) |

### 2.1 LCP optimization strategy

- First/LCP image: `loading="eager"`, `fetchpriority="high"`, preloaded via `<link rel="preload">`.
- Below-fold images: `loading="lazy"`, `decoding="async"`.
- Intrinsic `width` and `height` attributes on all `<img>` elements from manifest dimensions to prevent layout shift.
- Critical CSS inlined in `<head>` for above-fold content.
- Font loading: `font-display: optional` per frozen G1. Preload only proven above-fold fonts.

### 2.2 Measurement plan

**Lab testing (P7+):**
- Lighthouse CI against local/staging builds.
- Chrome DevTools Performance tab for manual profiling.
- Simulated network throttling (3G, slow 4G) for LCP stress.

**Field measurement (post-launch, when traffic exists):**
- Chrome UX Report (CrUX) for real-user LCP/CLS/INP.
- Self-hosted analytics only if explicitly decided (see OPEN_QUESTIONS.md). Default: no analytics.

---

## 3. Project engineering budgets (PROJECT ENGINEERING BUDGET)

These are aspirational targets. They guide implementation but are unmeasured. They must not block CI or force quality degradation until a real baseline is established.

| Budget | Aspirational target | Classification rationale |
|---|---|---|
| Total client JS | <= 20KB gzipped | Minimal-JS architecture makes this plausible, but no bundle has been built or measured. Manual chunk splitting is not required; default bundling is the baseline. |
| Total CSS | <= 40KB gzipped | Static site with limited component variety suggests small CSS, but no build output exists to confirm. |
| 72-Photo Gallery memory | < 200MB typical desktop | Reference Gallery size is ~72 Photos. Memory behavior depends on browser, DPR, image sizes, and DOM node count. Must be measured on low-end mobile as well as desktop. |
| Build time (incremental) | < 10s | Hardware/fixture-specific. Record environment when measured. |
| Build time (full clean) | < 60s | Same caveat. Depends on derivative count, encoder speed, and I/O. |

### 3.1 Policy for engineering budgets

- Implementation should aim for these targets.
- If a budget conflicts with frozen design quality (e.g., image compression degrades visible Photo quality), the budget yields.
- Before enforcing any budget as a CI gate, record a MEASURED BASELINE and evaluate whether the aspirational target is realistic and desirable.
- The JS budget does not mandate manual Vite chunk splitting. Default Astro/Vite bundling is the acceptable baseline. Add manual splitting only after bundle analysis proves benefit.

---

## 4. Benchmark-required values (BENCHMARK REQUIRED)

These values cannot be set accurately at the architecture stage. They depend on the P3 image benchmark harness using real F01-F10 photography fixtures.

### 4.1 Image byte sizes

Previous architecture versions stated hard caps (hero <=150KB, Gallery first Photo <=200KB, card cover <=50KB). These are reclassified as BENCHMARK REQUIRED because:

- Byte size depends on viewport width, DPR, encoder choice, quality setting, image content complexity, and responsive breakpoint selection.
- A high-detail landscape at 2x DPR may legitimately require more bytes than a simple portrait at 1x.
- Enforcing a universal byte cap risks forcing over-compression that violates the product's primary content quality.

Benchmark task: determine optimal width steps, encoder quality, and format (from the JPEG/WebP/AVIF benchmark candidates) that balance visual acceptability against transfer size for each derivative purpose. Record results as MEASURED BASELINE.

### 4.2 Image widths and srcset granularity

Width steps, height ceilings, and srcset breakpoint intervals are deferred to the P3 benchmark. See IMAGE_PIPELINE.md and OPEN_QUESTIONS.md.

### 4.3 Encoder quality settings

WebP quality, JPEG quality, and encoder selection (Sharp/libvips configuration) are benchmark items. No frozen values.

### 4.4 HTML sizes

Previous targets (Home <=150KB, long Gallery <=500KB, Place detail <=200KB, About <=50KB) are reclassified as BENCHMARK REQUIRED. Actual rendered markup size depends on Gallery length, metadata density, inline styles, and Astro output patterns. Validate against real builds.

### 4.5 CJK font subset sizes

Font file sizes depend on the subsetting strategy chosen (broad static vs. build-derived). See section 7. No frozen byte target until subsetting is implemented and measured.

---

## 5. Long Gallery baseline

Frozen reference: validated reference ~72 Photos. Architecture supports larger Galleries reasonably. No 1000-Photo single-Gallery requirement.

### 5.1 Baseline rendering approach

- Full semantic HTML document. Every Photo rendered as a `<figure>` in document order.
- Native browser lazy image loading (`loading="lazy"`).
- Browser-native vertical document flow. No virtualization, no infinite scroll, no pagination.
- Targeted observers only: IntersectionObserver for position annotation update. No custom scroll handler replacing native loading behavior.
- First/LCP image eager and high-priority. Subsequent images lazy.

### 5.2 Virtualization policy

Virtualization is OPTIONAL and evidence-driven. It is considered only if real production measurements demonstrate:

- Memory consumption exceeding device capacity on target low-end mobile devices.
- Scroll performance degradation (jank, frame drops) unacceptable under Core Web Vitals INP.
- DOM node count causing measurable rendering overhead.

Memory behavior on low-end mobile should be measured, not assumed. Desktop-only measurements are insufficient.

### 5.3 Scale expectations

| Gallery size | Expected behavior | Action threshold |
|---|---|---|
| ~72 Photos (reference) | Baseline native flow | Measure and record as MEASURED BASELINE |
| 100-200 Photos | Should remain viable with native lazy loading | Measure; virtualization only if evidence warrants |
| >200 Photos | May require evaluation | Benchmark before deciding |

---

## 6. Image loading strategy

See IMAGE_PIPELINE.md for derivative generation contract and manifest schema. See RUNTIME_AND_PROGRESSIVE_ENHANCEMENT.md section 11 for runtime loading contract.

### 6.1 Loading priority

| Image role | loading | fetchpriority | decoding | Preload |
|---|---|---|---|---|
| LCP candidate (Home hero / Gallery first Photo) | eager (or omit) | high | sync (or omit) | Yes, via `<link rel="preload">` |
| Above-fold non-LCP | eager (or omit) | auto | async | No |
| Below-fold Gallery Photos | lazy | auto | async | No |
| Card covers (Archive/Places/Home recent) | lazy | auto | async | No |
| Overview thumbnails | lazy | auto | async | No |

### 6.2 Responsive image attributes

- `srcset` populated from the generated asset manifest at build time. Contains width-descriptor entries for each derivative.
- `sizes` computed from layout context: Gallery reading column, card grid column width, hero frame dimensions. Derived from manifest and page template, not hardcoded.
- Intrinsic `width` and `height` attributes from manifest dimensions to reserve layout space and prevent CLS.
- Aspect ratio preserved throughout. No destructive crop. No square crop.

### 6.3 Format strategy

JPEG, WebP, and AVIF are **benchmark candidates**. Production format(s), fallback policy, encoder, quality settings, and responsive widths are decided by the P3 benchmark (OQ-01, OQ-02) before downstream templates and the derivative-consumption contract freeze. No format combination is a frozen baseline before P3 records a MEASURED BASELINE. See IMAGE_PIPELINE.md section 12 and OPEN_QUESTIONS.md.

---

## 7. CJK font strategy

Frozen reference: FINAL_DESIGN_SPECIFICATION.md section 2.2, Gate G1.

### 7.1 Frozen font families

Exactly four families. No additions permitted.

| Script | Display / Serif | Utility / Sans |
|---|---|---|
| Latin | Source Serif 4 | Source Sans 3 |
| CJK | Noto Serif SC | Noto Sans SC |

Prohibited: FreeBuffCJK, generic "Noto Sans CJK", any third family, any monospace family.

### 7.2 font-display policy

`font-display: optional` for all families, per frozen G1. Subsetting enabled.

### 7.3 Latin subsets

Latin subsets for Source Serif 4 and Source Sans 3 include the weights used by the typography system (400, 500, 600 as applicable). File sizes expected to be small (~20KB per weight/style woff2). Subset contents and exact file sizes are BENCHMARK REQUIRED.

### 7.4 CJK subsetting strategy

CJK fonts present a sustainability challenge: future Gallery titles and captions may introduce characters not present in a static subset. Two strategies are available:

**Option A -- Broad static CJK subset:**
- Select a broad character set covering expected usage (e.g., GB2312-level common characters plus known place-name glyphs).
- Pin the subset definition in version control.
- System CJK fallback handles any missing/new glyphs.
- Trade-off: larger initial payload, simpler build, potential missing-glyph risk for rare characters.

**Option B -- Build-derived CJK subset:**
- Scan all authored YAML content at build time to extract the exact glyph set used.
- Generate a minimal subset covering those glyphs plus a safety margin.
- Rebuild and rehash font assets whenever content glyph set changes.
- System CJK fallback handles any glyphs outside the served subset.
- Trade-off: smaller payload, more complex build pipeline, requires glyph-coverage validation.

The exact subsetting implementation remains an implementation benchmark (OPEN_QUESTIONS.md). Both options are architecturally valid. The choice may be made during P1/P4 based on operational preference.

### 7.5 Mandatory CJK font rules

- Pin font versions and licenses. Record the exact source release used.
- Content glyph coverage must be validated pre-deploy. Any character in authored content that falls outside the served subset must have a working system CJK fallback.
- Do not claim a `unicode-range` broader than the actual served subset without intentional fallback segmentation. Mismatched unicode-range can suppress correct fallback behavior.
- Do not preload all CJK font payloads blindly. Preload only fonts proven to be above-fold for the current page.
- Do not freeze invalid fontTools commands or other subsetting tool invocations that have not been verified against current tool documentation.
- Test mixed Latin/CJK titles and new rare place-name characters as part of visual regression.

---

## 8. Browser compatibility targets

### 8.1 Baseline support matrix

| Browser | Minimum version | Notes |
|---|---|---|
| Chrome | >= 90 (2021+) | Evergreen desktop/mobile |
| Safari | >= 14 (2019+) | iOS 13+ included |
| Firefox | >= 88 (2021+) | Desktop |
| Edge | >= 90 (2021+) | Chromium-based |

Policy: modern evergreen browsers only. No IE11, no legacy Safari (<iOS 13).

### 8.2 Graceful degradation

- CSS Grid: Flexbox fallback for older browsers within the support matrix.
- Image formats: exact production format(s) and fallback strategy are P3 benchmark decisions (OQ-02). If multi-format output is adopted, serve via `<picture>` with a widely supported fallback `<img>`; if a single format is adopted, serve plain `<img>`.
- Intersection Observer: progressive enhancement for position annotation; core content unaffected.

---

## 9. Mobile optimization targets

### 9.1 Touch targets (frozen)

- Menu links: >= 44x44px (actual prototype: 53px height with padding-block 12px).
- Overview cells: >= 111px edge at 390px viewport width (3 columns, 8px gaps).
- Close buttons: >= 44x44px via invisible padding/margin extension.

### 9.2 Viewport constraints (frozen)

- 320px minimum width with `scrollWidth <= 320` everywhere.
- 200% zoom verification via 720x450 layout-equivalent viewport.
- Safe-area insets respected on iOS.

---

## 10. Performance regression detection

### 10.1 Automated checks

- Lighthouse CI score thresholds (configured during P7).
- Build-time size reporting for HTML, CSS, JS bundles (informational until baselines exist).
- Visual regression screenshot diffs (TESTING_AND_VISUAL_REGRESSION.md).
- Automated accessibility tests (axe-core or equivalent).

### 10.2 Manual smoke tests

- Per-phase validation checklist (IMPLEMENTATION_PHASES.md).
- Cross-browser compatibility verification against the support matrix.
- Real-device testing on low-end Android for Gallery scroll performance and memory.

### 10.3 High-DPR testing

- Retina displays (2x pixel ratio) and Surface-class devices.
- Benchmark whether 2x width steps provide meaningful quality improvement versus byte cost.
- Results feed into BENCHMARK REQUIRED image-width decisions.

---

## 11. Measurement plan summary

| Phase | What to measure | Output |
|---|---|---|
| P3 | Image fixture corpus: encoder quality, width steps, format comparison, byte sizes, visual acceptability | MEASURED BASELINE for image budgets |
| P4 | CJK subset size, glyph coverage validation, load time impact | MEASURED BASELINE for font budgets |
| P5 | HTML size per page type, CSS/JS bundle sizes with real Astro output | MEASURED BASELINE for HTML/CSS/JS budgets |
| P7 | Core Web Vitals (lab): LCP, CLS, INP on staging builds | Validated STANDARD WEB TARGET compliance |
| Post-launch | Core Web Vitals (field) via CrUX when traffic exists | Production validation |
| Ongoing | Long Gallery memory and scroll performance on low-end mobile | Evidence for virtualization decision |

No budget transitions from aspirational to enforced without passing through MEASURED BASELINE.

---

## 12. Cross-references

- IMAGE_PIPELINE.md -- derivative generation, manifest contract, ICC policy, privacy stripping.
- BUILD_AND_ROUTING.md -- build-time rendering, route generation, Astro configuration.
- RUNTIME_AND_PROGRESSIVE_ENHANCEMENT.md -- JS inventory, loading strategy, progressive enhancement contracts.
- TESTING_AND_VISUAL_REGRESSION.md -- test categories, visual regression protocol, screenshot determinism.
- OPEN_QUESTIONS.md -- deferred benchmarks including exact responsive widths, encoder quality, CJK subsetting implementation, ICC embedding policy.
- IMPLEMENTATION_PHASES.md -- phase ordering for benchmark execution and performance validation.

---

**END OF PERFORMANCE BUDGET**
