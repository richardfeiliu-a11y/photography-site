# Architecture Overview -- Quiet Editorial Archive

**Status:** CANONICAL -- engineering authority
**Companion documents:** All documents in this directory; see README.md for the complete index
**Design authority:** `research/FINAL_DESIGN_SPECIFICATION.md` (frozen v1.0)

---

## 1. System Purpose

The Quiet Editorial Archive is a personal photographic archive website built as a fully static site. It serves authored photograph galleries with editorial sequencing, geographic and chronological discovery, and progressive-enhancement interactions. The system produces static HTML, CSS, JavaScript, and image derivatives through a deterministic build pipeline, deployed atomically to a self-hosted Nginx server.

There is no application server, no database, no CMS admin interface, and no runtime build step on the VPS. All rendering happens at build time. Core content access and navigation work without JavaScript.

---

## 2. High-Level Build DAG

The following diagram shows the canonical producer-before-consumer sequence. Every stage must complete successfully before the next begins. No stage may consume an artifact that has not yet been produced.

```
AUTHORED PERSISTENT STATE
  Gallery YAML        (content/galleries/{gallery}/meta.yaml)
  Place YAML          (content/places/*.yaml)
  Home settings       (content/site/home.yaml)
  Redirects           (content/redirects.yaml)
  WEB INGEST MASTERS  (media/ingest-masters/{gallery}/...)
        |
        v
REFERENCE + SOURCE VALIDATION
  Schema validation, referential integrity, duplicate detection,
  redirect validation, draft/published enforcement.
  Fail closed on any error in production mode.
        |
        v
IMAGE ANALYSIS / DERIVATION
  Decode, orient, color-transform, resize, encode, hash.
  Output: web derivatives staged under generated/media/.
  Source masters are never mutated.
        |
        v
GENERATED ASSET MANIFEST
  generated/asset-manifest.json
  Contains final public URL paths for every derivative.
  Manifest is complete and self-consistent before proceeding.
        |
        v
ASTRO BUILD
  Consumes asset-manifest.json at BUILD TIME via module import.
  Loads authored YAML via Content Layer glob loader (base: './content/galleries').
  Renders static HTML for published content only (production).
  Outputs to dist/.
        |
        v
ISOLATED FINAL RELEASE ASSEMBLY
  Combines Astro output (dist/) with web derivatives (generated/media/)
  into a single, self-contained release candidate directory.
  Assembly is isolated; neither dist/ nor generated/ is mutated after this point.
        |
        v
INTEGRITY GATE
  Verifies closure: every referenced derivative exists; no source masters
  in public root; no draft routes; no GPS leakage; static 404 present;
  sitemap valid; canonical routes intact.
        |
        v
UPLOAD CANDIDATE RELEASE
  Transfer assembled release to deployment target as a new unique
  release directory. Never mutates the live release.
        |
        v
PRE-SWITCH VERIFY
  Filesystem and optional HTTP smoke checks against the candidate
  release directory, before it becomes current.
        |
        v
ATOMIC POINTER SWITCH
  Capture exact current symlink target.
  Atomically rename temporary symlink over current.
  Record previous target for rollback.
        |
        v
POST-SWITCH SMOKE
  Verify live site responds correctly at the public URL.
        |
        v
ROLLBACK EXACT PREVIOUS TARGET ON FAILURE
  If post-switch smoke fails, restore the captured previous target.
```

### Architectural Invariants

- Astro must never need a manifest that does not yet exist. The asset manifest is produced before Astro build begins.
- The browser does not consume the asset manifest at runtime. Astro consumes it during build.
- Image derivation does not depend on mutating Astro's final build directory. Derivatives are staged under `generated/media/` and assembled into the release independently.
- `dist/` has exactly one owner: the Astro/assembly step. No other pipeline stage writes into `dist/`.
- Final assembly is isolated and complete before any deployment action.

See BUILD_AND_ROUTING.md for the full specification and IMAGE_PIPELINE.md for pipeline stage details.

---

## 3. Data Boundaries and Ownership

Every persistent concept has exactly one canonical owner. The four data classes defined in SOURCE_OF_TRUTH_MATRIX.md govern all ownership decisions:

### Authored State (Git-tracked, non-regenerable)

| Concept | Owner Location | Backed Up |
|---|---|---|
| Gallery metadata + photos | `content/galleries/{gallery}/meta.yaml` | Yes (Git remote) |
| Place definitions (one Place per file) | `content/places/{place}.yaml` | Yes (Git remote) |
| Home editorial settings | `content/site/home.yaml` | Yes (Git remote) |
| Historical route aliases | `content/redirects.yaml` | Yes (Git remote) |
| Source code, tests, docs | `src/`, `tests/`, `research/`, `scripts/` | Yes (Git remote) |

### External Non-Regenerable State (outside Git, must be backed up)

| Asset | Location | Backed Up |
|---|---|---|
| WEB INGEST MASTERS | `media/ingest-masters/{gallery}/` | Yes (encrypted off-site, required) |
| CAMERA ORIGINALS / ARCHIVAL MASTERS | External archival storage | Yes (archival policy) |

### Generated State (regenerable, no backup needed)

| Artifact | Location | Producer |
|---|---|---|
| Asset manifest | `generated/asset-manifest.json` | Image pipeline |
| Web derivatives | `generated/media/` | Image pipeline |
| Dimensions, orientation, EXIF, ICC, hashes | Extracted during pipeline | Image pipeline |

### Build Output (regenerable, rollback cache)

| Artifact | Location | Owner |
|---|---|---|
| Astro output | `dist/` | Astro build step |
| Release directories | Remote `/srv/.../releases/*` | Deployment process |

Key invariants:

- Photo identity and source binding live in Gallery authored YAML (`photos[].id` + `photos[].source_ref`). Generated state is never the only identity authority.
- Current Gallery slug lives in Gallery YAML. No second slug registry.
- Featured state lives in `content/site/home.yaml`. No per-Gallery featured field.
- Publication state uses `status` field only. No directory partition semantics.
- `published_at` is authored, never derived from file or capture metadata.

See SOURCE_OF_TRUTH_MATRIX.md for the definitive ownership table. This matrix wins on conflict with any other document.

---

## 4. Component Responsibilities

### Astro Pages

Astro generates static HTML for six public routes plus a custom 404 page. Collections are defined in `src/content.config.ts` using the `glob` loader with `base: './content/galleries'` to load authored YAML directly. There is no `src/content/galleries/` mirror. See BUILD_AND_ROUTING.md and TECHNICAL_API_VERIFICATION.md.

### Image Pipeline

A standalone deterministic subsystem that reads WEB INGEST MASTERS and produces WEB DERIVATIVES plus `generated/asset-manifest.json`. Eight canonical stages: decode, read metadata, normalize orientation, color transform, resize/encode, strip privacy metadata, optionally embed output ICC, hash/output. Pipeline runs before Astro build. Source masters are never mutated. See IMAGE_PIPELINE.md.

### Content Validation

Fail-closed validation runs in production mode. Checks include: duplicate IDs/slugs, referential integrity (source_ref, cover_photo_id, places, next_gallery), redirect closure, published requirements (cover, published_at), derivative coverage, route collisions, and privacy verification. Draft content receives warnings in local preview only. See CONTENT_MODEL.md section 13.

### Deployment

Atomic release-directory deployment to self-hosted Nginx. Each deployment creates a new unique release directory. The `current` symlink is switched atomically via `rename()`. Rollback restores the exact previous target captured before the switch. Content switches do not require Nginx reload. See DEPLOYMENT_ARCHITECTURE.md.

### Backup and Recovery

RPO <= 24 hours, RTO <= 24 hours. Non-regenerable state (authored YAML, WEB INGEST MASTERS) backed up to encrypted off-site storage. Regenerable state (derivatives, manifest, dist) is not backed up. Restore drills prove recovery within RTO. See BACKUP_AND_RECOVERY.md.

---

## 5. Key Architectural Decisions

| ADR | Decision | Source |
|---|---|---|
| ADR-001 | Astro static generation with Content Layer; exact version pinned at P1 | Revised |
| ADR-002 | Authored/generated/built separation; media outside Git baseline | Revised |
| ADR-005 | Deterministic local image pipeline; semantic determinism required | Original |
| ADR-006 | Atomic release-directory deployment with exact-target rollback | Original |
| ADR-009 | next_gallery references Gallery ID; cycles allowed | Revised |
| ADR-013 | Measure before virtualization; native lazy loading baseline | Original |
| ADR-017 | Photo identity in Gallery authored YAML | UD-001 |
| ADR-018 | Media ownership outside Git baseline | UD-005 |
| ADR-019 | Home editorial settings file | UD-004 |
| ADR-020 | Status-based draft model | UD-009 |
| ADR-021 | Explicit published cover required | UD-010 |
| ADR-022 | Redirects historical-only | UD-008 |
| ADR-023 | Cycles allowed in next_gallery | UD-007 |
| ADR-024 | No authored prev_gallery | UD-011 |
| ADR-025 | RPO/RTO <= 24h | UD-006 |
| ADR-026 | Corrected build DAG; manifest-before-Astro | Rewrite |
| ADR-027 | Publication-time integrity | UD-003 |
| ADR-028 | Corrected-master identity semantics | UD-002 |

See ARCHITECTURE_DECISIONS.md for the complete set including migration mapping from superseded ADRs.

---

## 6. Performance Considerations

### Rendering Baseline

- Full semantic HTML document with native browser lazy image loading (`loading="lazy"`)
- First/LCP image eager with `fetchpriority="high"` and preload
- Intrinsic `width` and `height` attributes from manifest to prevent CLS
- No virtualization at baseline; validated reference Gallery size is approximately 72 Photos
- Virtualization considered only if real production measurements prove necessity on low-end mobile

### Budget Classification

Performance targets are classified into four categories (see PERFORMANCE_BUDGET.md):

| Class | Example | Enforcement |
|---|---|---|
| Standard Web Target | LCP <= 2.5s, CLS <= 0.1, INP <= 200ms | Lab testing from P7 |
| Engineering Budget | JS <= 20KB gzipped, CSS <= 40KB gzipped | Aspirational until measured |
| Benchmark Required | Derivative widths, encoder quality, image byte sizes | Measured in P3 against fixtures |
| Measured Baseline | None yet | Authoritative once recorded |

No value moves from aspirational to enforced without first being recorded as a measured baseline. Image quality must not be sacrificed to arbitrary byte limits.

### Font Strategy

Frozen families: Source Serif 4, Source Sans 3, Noto Serif SC, Noto Sans SC. `font-display: optional`. Latin subsets expected small. CJK subsetting strategy (broad static vs build-derived) is an implementation benchmark (OQ-05).

---

## 7. Accessibility Targets

WCAG 2.2 AA is the compliance target. Key runtime requirements:

- **Visible focus**: 2px solid outline `#0B57D0` with 3px offset on all focusable elements
- **Skip link**: "Skip to content" targeting `<main id="main" tabindex="-1">`
- **Heading hierarchy**: Exactly one `<h1>` per page; levels never skip
- **Touch targets**: Menu links >= 44px (actual 53px), close buttons >= 44x44px, Overview cells >= 111px edge at 390px viewport
- **Reflow**: 320px minimum width with `scrollWidth <= 320` everywhere
- **Zoom**: 200% zoom verification via 720x450 layout-equivalent viewport
- **Reduced motion**: `prefers-reduced-motion: reduce` zeroes all layer transitions; JS close paths complete synchronously
- **Progressive enhancement**: Core navigation works without JavaScript; Overview and position annotation are acceptable enhancements
- **Mobile navigation**: Accessible without JS; `<details>`/`<summary>` or equivalent native fallback required

See RUNTIME_AND_PROGRESSIVE_ENHANCEMENT.md and FINAL_DESIGN_SPECIFICATION.md section 5.

---

## 8. Testing Strategy Summary

Seven test categories form the complete testing architecture:

| Category | Protects | Primary Phase |
|---|---|---|
| Content/schema validation | YAML correctness, identity integrity, lifecycle rules | P2 |
| Source/manifest closure | Every source resolves; every manifest entry has a physical derivative | P3, P5 |
| Interaction | Overview modal, menu, navigation, progressive enhancement | P6 |
| Accessibility | WCAG 2.2 AA, keyboard, focus, screen reader, reduced motion | P7 |
| Visual regression | Frozen design fidelity across implementation changes | P8 |
| Deployment smoke | Atomic release correctness, rollback fidelity | P9 |
| Backup restore drill | Recovery within RPO/RTO targets | P9 |

Visual regression separates screenshot capture determinism (pinned browser/OS/fonts, fixed viewport, font readiness) from visual equivalence judgment (pixel-diff thresholds with human adjudication). SHA-256 verifies baseline file integrity within a controlled workflow; it is not universal visual-equivalence proof across environments.

All examples in testing documents are labeled PSEUDOCODE / CONTRACT EXAMPLE. No claim of tested, verified, or working behavior is made at the architecture stage.

See TESTING_AND_VISUAL_REGRESSION.md.

---

## 9. Open Engineering Benchmarks

The following values remain open because they require measurement against real photography fixtures:

| Question | Owner Phase | Dependency |
|---|---|---|
| Responsive derivative width steps (OQ-01) | P3 | Real fixture benchmark |
| Encoder, format, and quality choice (OQ-02) | P3 | Sharp/libvips comparison |
| ICC no-profile enforcement policy (OQ-03) | P3/P7 | Policy decision |
| Alt text publication enforcement (OQ-04) | Before P7 | Editorial/accessibility policy |
| CJK subsetting implementation (OQ-05) | P1/P4 | Content corpus analysis |
| Backup provider/tool selection (OQ-06) | P9 | Cost/accessibility evaluation |
| Analytics (OQ-07) | Post-launch | Default: none |

See OPEN_QUESTIONS.md for the full list including 11 questions closed by user decisions.

---

## 10. Risk Summary

Eleven active risks are tracked in RISK_REGISTER.md. The highest-severity risks and their canonical mitigations:

| Risk | Severity | Mitigation |
|---|---|---|
| RISK-002: Ingest-master loss | Critical | Encrypted off-site backup; VPS never sole copy |
| RISK-008: Backup failure | Critical | Verification + scheduled restore drills |
| RISK-001: source_ref drift | High | Fail-closed source validation at build time |
| RISK-004: Incomplete derivative coverage | High | Manifest closure check + integrity gate |
| RISK-006: Draft leakage | High | Published-only production build |
| RISK-009: High-DPR quality degradation | High | Benchmark-before-freeze; quality over byte limits |
| RISK-010: Manifest/assembly mismatch | High | Integrity gate verifies closure before deployment |
| RISK-011: Incorrect cache headers | Medium-High | Differentiated policy: hashed immutable, HTML revalidate |

Six historical risks have been resolved by canonical decisions and are retained for audit traceability.

---

## 11. Implementation Phase Overview

Ten phases define the architecture-level ordering. This is NOT an Implementation Plan. Sprint-week estimates and task breakdowns are produced only after the focused independent re-review passes.

| Phase | Purpose | Key Dependencies |
|---|---|---|
| P1 | Foundation, toolchain pinning, CJK font proof, test harness init | Canonical rewrite approved |
| P2 | Content model, validation, authoring contract | P1 exit |
| P3 | Image pipeline, engineering benchmarks, manifest contract | P2 exit |
| P4 | Discovery pages (Home, Archive, Places) | P2 + P3 manifest |
| P5 | Gallery core rendering | P2 + P3 manifest |
| P6 | Overview modal, interactions, focus management | P5 exit |
| P7 | Accessibility, SEO, performance measurement | P6 exit, OQ-04 resolved |
| P8 | Visual regression adjudication, cross-browser hardening | P7 exit |
| P9 | Deployment rehearsal, backup restore drill | P8 exit, OQ-06 resolved |
| P10 | Final production acceptance | All prior exits |

P4 and P5 may proceed in parallel after P3 exit criteria are met.

See IMPLEMENTATION_PHASES.md for entry/exit criteria per phase.

---

## Cross-References

- **Source-of-truth ownership:** SOURCE_OF_TRUTH_MATRIX.md
- **Content schema and validation:** CONTENT_MODEL.md
- **Image pipeline stages and manifest:** IMAGE_PIPELINE.md
- **Build DAG and routing:** BUILD_AND_ROUTING.md
- **Repository layout:** REPOSITORY_STRUCTURE.md
- **Runtime and progressive enhancement:** RUNTIME_AND_PROGRESSIVE_ENHANCEMENT.md
- **Performance budgets:** PERFORMANCE_BUDGET.md
- **Deployment flow:** DEPLOYMENT_ARCHITECTURE.md
- **Backup and recovery:** BACKUP_AND_RECOVERY.md
- **Testing architecture:** TESTING_AND_VISUAL_REGRESSION.md
- **Risk register:** RISK_REGISTER.md
- **Architecture decisions:** ARCHITECTURE_DECISIONS.md
- **Open questions:** OPEN_QUESTIONS.md
- **Implementation phases:** IMPLEMENTATION_PHASES.md
- **Verified APIs:** TECHNICAL_API_VERIFICATION.md
- **Frozen design authority:** `research/FINAL_DESIGN_SPECIFICATION.md`

---

**END OF ARCHITECTURE OVERVIEW**
