# Implementation Traceability — Quiet Editorial Archive

Companion to `PRODUCTION_IMPLEMENTATION_PLAN.md`. Maps frozen requirements → architecture owner → implementation work package → verification owner. Goal: every frozen design requirement has an implementation owner and a verification owner. WP-49 executes this table as a live completeness probe.

Legend: **Impl** = implementation work package; **Verify** = verification owner (test suite / gate).

## 1. Design gates G1–G7

| Frozen requirement | Architecture owner | Impl | Verify |
|---|---|---|---|
| G1 — Four frozen families (Source Serif 4, Source Sans 3, Noto Serif SC, Noto Sans SC); CJK line-height 1.75; font-display optional; no third/mono family; no all-caps labels | PERFORMANCE_BUDGET §7; RUNTIME §8 | WP-04, WP-05, WP-46 | WP-05 PoC tests; WP-46 coverage + user review; WP-47 states |
| G2 — Palette (Canvas #F6F4EF, Primary #1A1A18, Secondary #5F5E59, Raised #EFECE5, Hairline #D4D0C7, Strong #34332F, Focus #0B57D0); focus blue functional only; no dark mode; no decorative accent | FINAL_DESIGN_SPECIFICATION §2.1 | WP-04 | WP-04 token assertions; WP-49 grep/visual audit |
| G3 — Home hero ceilings: 75svh desktop frame-width-bound; 60svh mobile landscape; 70svh mobile portrait; plain metadata cue | FINAL_DESIGN_SPECIFICATION §3.2 | WP-28 | WP-28 scale tests; WP-32 baselines |
| G4 — Rhythm: base 96/64 default; compact 64/40; breathing 144/96; caption gap 16px; orientation never selects rhythm; no count compression | FINAL_DESIGN_SPECIFICATION §3.1; RUNTIME §3 | WP-35 | WP-35 rhythm measurement suite; WP-38 baselines |
| G5 — Position annotation: desktop trailing margin; mobile bottom-right raised #EFECE5 12.5px tabular; yields at header/continuation; aria-hidden; no pill/progress/arrows | RUNTIME §5 | WP-36 | WP-36 e2e; WP-41 no-JS absence |
| G6 — Overview: desktop 6 col (5 ≤1100px); mobile 3 col 8px gaps ≈111px @390; contained uncropped thumbs; marker 2px #0B57D0 + index tag; opaque raised layer; Close text control; no runtime col switch | RUNTIME §6; ADR-015 | WP-39 | WP-39 presentation tests; WP-38/WP-47 states |
| G7 — End pause 168/112; `End of {title}` metadata sans; Next serif 28/22; Back to origin; no-next: Back primary + Browse Archive secondary; no cover/button/arrow/multiple-Next | RUNTIME §4 | WP-37 | WP-37 ending tests; WP-38 baselines |

## 2. Visual system + layout

| Frozen requirement | Architecture owner | Impl | Verify |
|---|---|---|---|
| Spacing scale XS–XXL (4/8/16/24/48/96) + composites | FINAL_DESIGN_SPECIFICATION §2.3 | WP-04 | WP-04 token assertions |
| Reading column ≈680px; content max ≈1400px + 48 gutter; mobile 20px margins | FINAL_DESIGN_SPECIFICATION §2.3 | WP-04, WP-26, WP-34 | WP-35/WP-34 computed assertions |
| Typography role hierarchy (sizes/weights/line-heights per role table) | FINAL_DESIGN_SPECIFICATION §2.2 | WP-04 | WP-04 probes; WP-47 visual states |
| Tabular numerals for years/dates/`n / total` | FINAL_DESIGN_SPECIFICATION §2.2 | WP-04, WP-36 | WP-36 tests; WP-49 audit |
| Breakpoints follow content fit, not device labels | FINAL_DESIGN_SPECIFICATION §4.1 | WP-26..WP-30 | WP-29 grid collapse tests |
| 320px reflow `scrollWidth ≤320`; 200% zoom via 720×450; safe areas | PERFORMANCE_BUDGET §9.2; FINAL_DESIGN_SPECIFICATION §4.3 | WP-26, WP-35, WP-43 | WP-43 audit suite |

## 3. Routes and pages

| Frozen requirement | Architecture owner | Impl | Verify |
|---|---|---|---|
| Routes: `/`, `/archive`, `/places`, `/places/{slug}`, `/galleries/{slug}`, `/about`, `/404`; Gallery route `/galleries/{slug}` ONLY | BUILD_AND_ROUTING §4; CONTENT_MODEL §12 | WP-28..WP-31, WP-33 | WP-33 route tests; WP-44 canonicals; WP-60 audit |
| Home: hero + metadata cue + View Gallery + discovery links + Recent grid | FINAL_DESIGN_SPECIFICATION §3.2 | WP-28 | WP-28 e2e; WP-32 baselines |
| Archive: photographed-year grouping; multi-column content-fit; cards with count; years non-sticky | FINAL_DESIGN_SPECIFICATION §3.3 | WP-29 | WP-29 e2e; WP-32 baselines |
| Places: names-led; region/country disambiguation only; NO counts; no maps/Visit/Trip | FINAL_DESIGN_SPECIFICATION §3.4; CONTENT_MODEL §6.3 | WP-30 | WP-30 e2e incl. no-count grep gate |
| About: body 17–19/16–18; measure 60–70 Latin / 28–36 CJK; paragraph spacing | FINAL_DESIGN_SPECIFICATION §3.5 | WP-31 | WP-31 measure tests |
| Static 404 (no SPA fallback) | DEPLOYMENT_ARCHITECTURE §7 | WP-31, WP-50 | WP-31 preview probe; WP-50/WP-53 live 404 checks |

## 4. Content model and identity

| Frozen requirement | Architecture owner | Impl | Verify |
|---|---|---|---|
| Photo identity + source binding in Gallery YAML; no generated registry | CONTENT_MODEL §5; ADR-017; SOURCE_OF_TRUTH_MATRIX §4 | WP-09 | WP-09 identity tests; WP-14 walkthrough; WP-22 corrected-master test |
| Corrected-master semantics (retain ID; hash = integrity only) | CONTENT_MODEL §5.3; ADR-028 | WP-14, WP-22 | WP-22 URL-invalidation test |
| One Place = one YAML file; singular schema; glob loader | CONTENT_MODEL §6; IC-01 | WP-10, WP-03 | WP-10 cardinality tests |
| `status: draft|published` sole mechanism; fail-closed production; draft exclusion everywhere | CONTENT_MODEL §8; ADR-020; BUILD_AND_ROUTING §6 | WP-09, WP-13 | WP-13 draft-exclusion matrix |
| Explicit cover required; no silent first-photo default | CONTENT_MODEL §8.4; ADR-021 | WP-09, WP-25 | WP-09 cover tests; WP-25 resolution tests |
| next_gallery: ID refs; exists/published/not-self; cycles allowed; no prev authored | CONTENT_MODEL §9; ADR-023/024 | WP-09, WP-13 | WP-13 RED set incl. allowed cycle |
| published_at authored; never derived; ordering semantics | CONTENT_MODEL §7; ADR-027 | WP-09, WP-11, WP-25 | WP-11/WP-25 ordering tests |
| Featured: home.yaml only; fallback latest published + ID tie-break; invalid configured IDs warn, never fail the build | CONTENT_MODEL §10; ADR-019 | WP-11 | WP-11 resolution tests |
| Redirects: historical-only; gallery_id XOR place_id; published targets; no loops/collisions; Nginx 301 include delivery | CONTENT_MODEL §11; ADR-022; IC-02 | WP-12, WP-52 | WP-12 RED set; WP-52 include tests; WP-54 301 smoke |
| Forbidden fields rejected (prev_gallery, featured flags, captions/rhythms maps, title_cjk…) | CONTENT_MODEL §4.3 | WP-09 | WP-09 forbidden-field tests |

## 5. Image pipeline and media

| Frozen requirement | Architecture owner | Impl | Verify |
|---|---|---|---|
| Single media root `media/ingest-masters/`; relative `source_ref`; no absolute paths | IMAGE_PIPELINE §3; REPOSITORY_STRUCTURE §4 | WP-17 | WP-17 resolution tests |
| Stage order: decode → read metadata → orient → color → resize/encode → privacy strip → approved output ICC embed → final metadata verification → hash → manifest (final-byte ordering, linear WP-20→WP-21→WP-22) | IMAGE_PIPELINE §5 | WP-18, WP-19, WP-20, WP-21, WP-22 | WP-18 ordering guard; stage tests |
| ICC: respect valid profile → sRGB; documented no-profile policy; no camera guessing | IMAGE_PIPELINE §6; ADR-011 | WP-16, WP-19 | WP-19 color matrix |
| Privacy: no GPS/serial/private metadata in derivatives; no EXIF by default; masters untouched | IMAGE_PIPELINE §7 | WP-20, WP-21 | WP-21 exhaustive scanner |
| Uncropped, aspect-preserving, no upscale (all purposes) | IMAGE_PIPELINE §15 | WP-20 | WP-20 invariant assertions |
| Semantic determinism; byte-for-byte only within pinned toolchain; regeneration from empty | IMAGE_PIPELINE §8 | WP-23 | WP-23 determinism/regeneration suite |
| Manifest: final public URLs; format-agnostic schema; canonical serialization; browser never consumes | IMAGE_PIPELINE §10; BUILD_AND_ROUTING §10 | WP-22, WP-24 | WP-22/WP-24 contract tests |
| Coverage closure blocks build for published content | IMAGE_PIPELINE §11; BUILD_AND_ROUTING §8 | WP-23, WP-51 | WP-23 coverage; WP-51 integrity gate |
| Content-addressed naming, derivative hash, and manifest computed over final served bytes; provenance (source hash, config, toolchain) recorded in the manifest | IMAGE_PIPELINE §9 | WP-22 | WP-22 naming tests |

## 6. Runtime, accessibility, performance

| Frozen requirement | Architecture owner | Impl | Verify |
|---|---|---|---|
| Core-without-JS guarantee (all pages readable/navigable) | RUNTIME §1–2 | WP-26, WP-35, WP-41 | WP-41 blocked-context matrix |
| Captions always visible; no clamp/hover/reserved block; not auto-alt | RUNTIME §3 | WP-35 | WP-35 caption tests; WP-42 policy |
| Focus: 2px #0B57D0 / 3px offset; skip link → #main; `main:focus{outline:none}` | RUNTIME §8; FINAL_DESIGN_SPECIFICATION §5.2 | WP-04 | WP-43 audit |
| Mobile nav accessible without JS; no checkbox trick; 53px targets | RUNTIME §7 | WP-26 | WP-26 blocked-context tests |
| Overview dialog: aria-modal, focus trap, Escape, focus restore, scroll lock, jump restore, reduced-motion sync close | RUNTIME §6; TESTING_AND_VISUAL_REGRESSION §6.1 | WP-40 | WP-40 canonical-semantics suite |
| Image loading strategy (LCP eager+preload; lazy after; intrinsic dims) | RUNTIME §11; PERFORMANCE_BUDGET §6 | WP-28, WP-35 | WP-28/WP-35 attribute assertions |
| No virtualization baseline; measure before | PERFORMANCE_BUDGET §5; ADR-013 | WP-35 | WP-45/WP-48 long-gallery measurement |
| WCAG 2.2 AA target; one h1; no skipped levels; touch targets | FINAL_DESIGN_SPECIFICATION §5 | WP-43 | WP-43 automated + manual evidence |
| Reduced motion zeroes transitions | FINAL_DESIGN_SPECIFICATION §5.4 | WP-40, WP-26 | WP-40/WP-43 tests |
| CWV targets (LCP ≤2.5s, CLS ≤0.1, INP ≤200ms) lab-verified | PERFORMANCE_BUDGET §2 | WP-45 | WP-45 baseline record |

## 7. Build, deployment, recovery

| Frozen requirement | Architecture owner | Impl | Verify |
|---|---|---|---|
| Build DAG producer-before-consumer; dist single owner; manifest before Astro | BUILD_AND_ROUTING §1–2; ADR-026 | WP-24, WP-51 | WP-24 guard tests; WP-51 assembly guards |
| Integrity gate (canonical nine checks incl. sitemap validity / published-only and redirect integrity) | BUILD_AND_ROUTING §8 | WP-51 | WP-51 nine failing probes |
| Atomic release switch; exact previous capture; rename() atomicity | DEPLOYMENT_ARCHITECTURE §3; ADR-006 | WP-53 | WP-53/WP-54 scenario tests |
| Reload only on config change; redirect lifecycle coupling | DEPLOYMENT_ARCHITECTURE §3.3; IC-02 | WP-52, WP-53 | WP-54 three scenarios |
| Cache policy classes; old-page asset availability | DEPLOYMENT_ARCHITECTURE §6 | WP-50, WP-51 | WP-50 header checks; WP-51 strategy test |
| Deployment serialization lock | DEPLOYMENT_ARCHITECTURE §10 | WP-53 | WP-53 lock-contention test |
| RPO ≤24h / RTO ≤24h; encrypted off-site; VPS never sole copy; restore drill pre-launch | BACKUP_AND_RECOVERY; ADR-025 | WP-56, WP-57 | WP-56 scope/integrity tests; WP-57 timed drill |
| Secrets escrow; no secrets in repo | DEPLOYMENT_ARCHITECTURE §12; BACKUP_AND_RECOVERY §10 | WP-50, WP-56 | WP-50/WP-56 runbook review |

## 8. Visual regression governance

| Frozen requirement | Architecture owner | Impl | Verify |
|---|---|---|---|
| Capture determinism invariants (pinned browser/OS/fonts; 1440×900 + 390×844 DSF=1; fonts.ready; network idle; lazy forcing; animation settle) | TESTING_AND_VISUAL_REGRESSION §8.1 | WP-06 | WP-06/WP-32 reproducibility checks |
| Visual equivalence by pixel-diff + human adjudication; SHA-256 = integrity only | TESTING_AND_VISUAL_REGRESSION §8.2 | WP-32, WP-38, WP-47 | WP-47 adjudication log |
| Frozen regression state list | TESTING_AND_VISUAL_REGRESSION §8.3 | WP-32, WP-38, WP-47 | WP-47 completeness probe |
| Finding classification P0/P1/P2; no G1–G7 redesign to fix drift | User brief §30; TESTING §8.2 | WP-47 | WP-47 governance record |

---

**Coverage statement:** rows above cover G1–G7, all frozen routes, typography/color/spacing systems, identity/lifecycle rules, pipeline invariants, runtime/accessibility contracts, deployment/recovery contracts, and visual regression governance. WP-49 turns every row into executable evidence; orphan rows block P9 entry.
