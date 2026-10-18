# Implementation Phases -- Quiet Editorial Archive

**Status:** CANONICAL -- architecture-level phase ordering
**Revision date:** 2026-08-28
**Companion documents:** ARCHITECTURE_DECISIONS.md, OPEN_QUESTIONS.md, SOURCE_OF_TRUTH_MATRIX.md, CONTENT_MODEL.md, IMAGE_PIPELINE.md, BUILD_AND_ROUTING.md

---

## Document Scope

This document defines architecture-level phase ordering and entry/exit criteria. It is NOT an Implementation Plan. Sprint-week estimates, task breakdowns, and scheduling belong in an Implementation Plan that is produced only after the focused independent re-review of the rewritten canonical architecture passes.

Phase entry criteria reflect dependencies. A phase may not begin until its entry criteria are satisfied. Exit criteria define what must hold before the next phase begins.

---

## Phase Ordering

### P1: Foundation and Canonical Configuration/Test Harness

**Purpose:** Establish the project skeleton, pin toolchain versions, prove CJK font strategy, and initialize the testing harness.

**Entry criteria:**
- Architecture Freeze passed: focused independent re-review issued Gate A (PASS). Gate B explicitly requires targeted corrections before freeze and does not authorize P1.

**Scope:**
- Pin exact Astro stable major version and Node engine in package.json/lockfile.
- Initialize Astro project with TypeScript.
- Configure Content Layer (`src/content.config.ts`) to load authored YAML directly from `content/galleries/` and `content/places/` via glob loaders.
- Set up directory structure per REPOSITORY_STRUCTURE.md.
- Configure font loading for frozen families (Source Serif 4, Source Sans 3, Noto Serif SC, Noto Sans SC).
- CJK font strategy proof of concept (broad static subset vs build-derived subset; see OQ-05).
- Initialize testing harness (unit test framework, content validation scaffold).
- Benchmark harness initialized (fixture corpus identified, measurement infrastructure scaffolded).
- Base layouts and global styles matching G1-G7 frozen values.
- ESLint/Prettier/Git hooks configured.

**Exit criteria:**
- `npm run dev` starts and renders a baseline page with correct fonts and colors.
- Content Layer loads YAML from `content/galleries/` without mirroring into `src/content/`.
- CJK font strategy proof demonstrates viable approach with fallback behavior.
- Testing harness executes at least one passing content validation test.
- Benchmark harness can ingest fixture images and produce measurements.
- Exact Astro and Node versions pinned in lockfile.

---

### P2: Content Model, Validation, and Authoring Contract

**Purpose:** Implement Gallery/Place/Home/Redirect schemas with fail-closed validation and define the authoring workflow.

**Entry criteria:**
- P1 exit criteria met.
- Content model contract finalized (CONTENT_MODEL.md authoritative).

**Scope:**
- Implement Zod schemas for Gallery, Photo item, Place, Home settings, and Redirects.
- Place collection: singular Place schema; exactly one Place object per `content/places/{place}.yaml` file (glob loader; one file = one collection entry). Multi-Place arrays and aggregate loaders are excluded.
- Redirect schema: exactly one target type per entry (`gallery_id` XOR `place_id`); production targets must resolve to public/published canonical routes.
- Fail-closed validation for published builds: missing WEB INGEST MASTER, duplicate IDs/slugs, missing source_ref, invalid cover, missing Place reference, dangling/self-loop next_gallery, draft target from published source, invalid status, missing published_at for published Gallery, invalid redirects, redirect loops, canonical route collisions.
- Alt text schema support (optional field; enforcement policy deferred to P7 per OQ-04).
- One-Photo-one-Gallery membership validation.
- Orphan metadata key validation.
- Authoring workflow contract: ingest, rename, move, replace-master, publish operations documented.
- Test fixture galleries created from Stage 3C set.

**Exit criteria:**
- Validation rejects all documented failure modes for published content.
- Validation distinguishes draft-preview warnings from production failures.
- At least one test fixture gallery passes full validation.
- Authoring workflow contract documented (rename/move/replace/publish).
- Schemas match CONTENT_MODEL.md exactly.

---

### P3: Media/Image Pipeline and Engineering Benchmarks

**Purpose:** Implement the deterministic image pipeline, execute engineering benchmarks, and realize the manifest contract.

**Entry criteria:**
- P2 exit criteria met (content model contract and validation working).
- Benchmark harness initialized from P1.
- Fixture corpus available.

**Scope:**
- Execute engineering benchmarks (OQ-01 responsive widths, OQ-02 encoder/format/quality).
- Implement standalone image derivation pipeline: read/decode, auto-orient, ICC-to-sRGB transform, resize/encode, strip privacy metadata, hash/output.
- ICC handling per ADR-011 (assume-sRGB for MVP; OQ-03 enforcement policy documented).
- Generate `generated/asset-manifest.json` with final public URL paths.
- Content-addressed or fingerprint-based derivative filenames (robust truncated cryptographic digest).
- Privacy verification: no GPS, serial, or private metadata in public derivatives.
- Determinism contract: semantic determinism required; byte-for-byte within pinned toolchain.
- Derivative coverage validation (every published Photo has required derivatives).
- Frozen benchmark values documented.

**Exit criteria:**
- Benchmark results recorded and values frozen for widths, quality, encoder.
- Pipeline produces derivatives into `generated/media/` and manifest into `generated/asset-manifest.json`.
- Manifest contains final public paths; Astro can consume it at build time.
- No GPS/private metadata leakage in automated derivative checks.
- Semantic determinism demonstrated (same inputs produce same logical output).
- Coverage validation catches missing derivatives for published content.

---

### P4: Discovery Pages

**Purpose:** Implement Home, Archive, and Places index pages.

**Entry criteria:**
- P2 exit criteria met (validated content model).
- P3 manifest contract realized (Astro can consume asset manifest at build time).

**Scope:**
- Home page: hero (featured or latest published fallback per ADR-019), Archive/Places discovery links, Recent Galleries grid.
- Archive page: year groupings from photographed dates, multi-column card grid.
- Places index: names-led alphabetical listing, region/country disambiguation, no counts.
- Place detail page: Galleries grouped by year when chronology exists.
- All data bound to validated content model via Content Layer.
- Styles per G1-G7 frozen values.
- Visual regression baseline capture capability initialized (harness/baseline infrastructure; final adjudication in P8).

**Exit criteria:**
- Home hero matches G3 scale (75svh desktop ceiling).
- Featured Gallery selection follows ADR-019 (explicit or latest-published fallback).
- Archive year headings render correctly from photographed dates.
- Places show names-led, no counts anywhere.
- Routes match canonical patterns (`/`, `/archive`, `/places`, `/places/{slug}`).
- Visual regression harness captures baselines for discovery pages.

---

### P5: Gallery Core

**Purpose:** Implement the primary viewing unit -- long-form Gallery rendering.

**Entry criteria:**
- P2 exit criteria met (content model and validation).
- P3 manifest contract realized (derivatives and srcset available at build time).

**Scope:**
- Gallery page at `/galleries/{slug}`.
- Sequential photo rendering with captions (visible whenever authored; no reserved block when absent; no truncation).
- Rhythm system (base/compact/breathing per G4 frozen values).
- Current position annotation (desktop trailing margin, mobile bottom-right per G5).
- Continuation end pause (168px desktop / 112px mobile per G7).
- Next Gallery section (serif title link; no cover image at continuation).
- No-next variant (Back primary / Browse Archive secondary per G7).
- Header on reading column, non-sticky.
- Mobile native vertical progression.
- Visual regression baseline capture for Gallery pages.

**Exit criteria:**
- Base rhythm = 96px desktop / 64px mobile.
- Compact/Breathing applied only at authored positions.
- Captions visible below photos; no hover-only, no empty reserved region.
- Continuation matches G7 frozen typography and spacing.
- Position annotation yields at header and continuation boundaries.
- Visual regression baselines captured for Gallery rendering.

---

### P6: Overview and Interactions

**Purpose:** Implement Overview modal, focus management, keyboard navigation, and reduced motion support.

**Entry criteria:**
- P5 exit criteria met (Gallery core rendering).

**Scope:**
- Overview modal (full-viewport overlay, aria-modal=true, background scroll locked).
- Desktop 6 columns (5 at <= 1100px); mobile 3 columns per G6.
- Contained uncropped thumbnails (ADR-015).
- Current marker (2px outline #0B57D0 + index tag).
- Close button text control; Escape closes; focus trap cycles correctly.
- Jump to selected Photo restores exact position.
- Focus restoration on close.
- Reduced motion support (@media prefers-reduced-motion).
- Mobile navigation accessible without JS (core page navigation as native links; progressive enhancement for modal/menu interactions).

**Exit criteria:**
- Modal opens/closes reliably with keyboard and pointer.
- Focus trap cycles across first/last boundaries.
- Escape key closes modal and restores focus.
- Background scroll locked while modal is open.
- Overview thumbnails contained and uncropped.
- Reduced motion zeroes transitions.
- Core navigation usable without JavaScript.

---

### P7: Accessibility, SEO, and Performance

**Purpose:** Achieve WCAG 2.2 AA target, generate SEO artifacts, and verify performance budgets against measurements.

**Entry criteria:**
- P6 exit criteria met (interactions working).
- Alt text enforcement policy decided (OQ-04 resolved).

**Scope:**
- Accessibility audit and remediation (automated axe-core tests, manual keyboard traversal, visible focus, minimum touch targets, reduced motion verification).
- Alt text enforcement per resolved policy.
- Sitemap.xml generation (published only; excludes drafts).
- robots.txt generation.
- Meta tags (title, description, Open Graph) for published content.
- Canonical URLs.
- Performance measurement against real rendered pages.
- Reclassify performance budgets: Core Web Vitals as web standard targets; JS/CSS/image/HTML sizes as engineering budgets pending measurement evidence.
- Font subsetting finalized per OQ-05 resolution.
- Image optimization verified against benchmark values from P3.

**Exit criteria:**
- Automated accessibility tests pass.
- Manual accessibility checks pass (keyboard, focus, touch targets, reduced motion).
- Sitemap validates and excludes drafts.
- Performance measurements recorded; budgets either met or explicitly adjusted with rationale.
- CJK font subsetting operational with verified glyph coverage.

---

### P8: Visual Regression and Hardening

**Purpose:** Final visual regression adjudication, cross-browser verification, and edge-case hardening.

**Entry criteria:**
- P7 exit criteria met.
- Visual regression baselines captured during P4/P5.

**Scope:**
- Full visual regression suite execution against pinned browser/OS/fonts.
- Pixel-diff threshold evaluation and human adjudication for threshold failures.
- Governed baseline update approval process.
- Cross-browser compatibility verification.
- Low-end mobile device testing.
- Edge cases: single-gallery archive, maximum-length Gallery, mixed portrait/landscape sequences.
- Long Gallery memory/DOM measurement (validate ADR-013 no-virtualization assumption).
- SHA-256 used for baseline artifact integrity within controlled workflow; visual equivalence determined by pixel-diff thresholds, not byte identity.

**Exit criteria:**
- Visual regression suite passes with governed baselines.
- No unexplained visual drift from frozen design specification.
- Cross-browser matrix documented.
- Long Gallery measurement confirms no virtualization needed (or triggers measured justification).
- All frozen states (G1-G7) verified against production rendering.

---

### P9: Deployment and Recovery Verification

**Purpose:** Rehearse deployment against a non-production target, prove backup restore, and verify operational readiness.

**Entry criteria:**
- P8 exit criteria met.
- Backup provider/tool selected (OQ-06 resolved).

**Scope:**
- Deployment script implementing atomic release-directory flow (ADR-006, ADR-026).
- Candidate release verification: index exists, canonical routes exist, manifest closure, every referenced derivative exists, no source masters in public root, no draft routes, no GPS leakage, static 404 behavior.
- Pre-switch target capture and post-switch HTTP smoke checks.
- Rollback tested: restore exact previous target on simulated failure.
- Nginx configuration (SSL, gzip, security headers, cache policy, static 404).
- Generated redirect config lifecycle rehearsal: candidate config verification, `nginx -t` before activation, activation alongside the candidate release, reload only when redirect config changed, post-switch HTTP redirect smoke, coupled rollback of release and redirect config (DEPLOYMENT_ARCHITECTURE.md section 3.3).
- Cache policy: hashed assets immutable; HTML short/no-cache/revalidate; redirect/404 appropriate non-immutable.
- Backup setup: encrypted off-site for non-regenerable state.
- Backup restore drill: provision clean host, restore code/authored content (`content/`)/masters/config, rebuild, verify. The canonical architecture has no persistent identity registry to restore; Photo identity lives in Gallery authored YAML.
- Dry-run/staging rehearsal against non-production target.
- Deployment serialization (prevent concurrent switches).

**Exit criteria:**
- Deployment rehearsal succeeds against non-production target.
- Rollback restores exact previous release.
- Backup restore drill completes within RTO target (<= 24 hours).
- Nginx serves correctly with proper cache headers and static 404.
- SSL certificate valid.
- Post-switch smoke checks pass.
- No SPA fallback behavior.

---

### P10: Final Production Acceptance

**Purpose:** Final validation, documentation, and production launch gate.

**Entry criteria:**
- P9 exit criteria met.
- All prior phase exit criteria satisfied.

**Scope:**
- End-to-end acceptance test against frozen design specification.
- Architecture review packet preparation.
- Documentation completeness check.
- Final consistency audit (identity, content, slug, draft, featured, cover, next, prev, build DAG, media, Git, backup, runtime, fonts, routes, cache, deployment, API verification).
- Red team review packet assembled.
- Production deployment executed.

**Exit criteria:**
- All frozen values match FINAL_DESIGN_SPECIFICATION.md.
- No rejected variants present in runtime.
- Consistency audit passes all checks.
- Architecture review packet ready for independent review.
- Production site live and verified.

---

## Phase Dependencies

```
P1 --> P2 --> P3 --> P4 --> P5 --> P6 --> P7 --> P8 --> P9 --> P10
                  |              |
                  +--> P5 -------+
                  |
                  +--> P4 (P3 manifest contract required)
```

Key dependency notes:
- P3 requires the content model contract from P2.
- P4 and P5 require the manifest contract from P3.
- P4 and P5 may proceed in parallel after P3 exit criteria are met.
- Visual regression infrastructure (harness/baseline capture) begins by P4/P5 at latest; final adjudication occurs in P8.
- Image benchmark dependencies (fixture corpus, harness) begin in P1 and execute through P3.
- Deployment architecture can be rehearsed against a non-production target within P9 scope or earlier if useful.

---

## Explicit Constraints

1. **Visual regression infrastructure** must be initialized early enough to prevent drift. Harness and baseline capture capability begins by P4/P5 at latest. Final adjudication occurs in P8.
2. **Deployment architecture** can be tested before final launch without deploying production. Dry-run/staging rehearsal is within P9 scope or earlier.
3. **Image benchmark dependencies** (fixture corpus, harness) should begin before P3 completion. P1 initializes the harness; P2 may contribute fixtures.
4. **No sprint-week estimates** are written as hard commitments in this document. This is architecture-level phase ordering only. Implementation planning happens only after the focused independent re-review passes.
5. **Phase entry criteria** are mandatory. A phase may not begin until its predecessors' exit criteria are satisfied.

---

## Risk Mitigation Per Phase

| Phase | Key risk | Mitigation |
|---|---|---|
| P1 | Toolchain version drift | Pin exact versions in lockfile; CI enforces lockfile integrity |
| P2 | Schema gaps discovered late | Fail-closed validation catches all documented failure modes |
| P3 | Image quality sacrificed to arbitrary budgets | Benchmark-before-freeze (ADR-010); values derived from evidence |
| P4/P5 | Visual drift accumulates unnoticed | Visual regression baselines captured during these phases |
| P6 | Focus trap/accessibility regressions | Keyboard testing throughout; formal verification in P7 |
| P7 | Performance budgets unachievable | Budgets reclassified as engineering targets; measured, not assumed |
| P8 | Baseline churn from unstable capture environment | Pinned browser/OS/fonts; governed baseline update process |
| P9 | Deployment failure in production | Dry-run rehearsal; backup restore drill proven before launch |
| P10 | Late discovery of frozen-spec violations | Consistency audit covers all canonical contracts |

---

**END OF IMPLEMENTATION PHASES**
