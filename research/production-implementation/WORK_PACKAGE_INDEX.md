# Work Package Index — Quiet Editorial Archive

Companion to `PRODUCTION_IMPLEMENTATION_PLAN.md` (execution sequencing authority). ⚑ = user-review gate.

| WP | Phase | Title | Depends on | Complexity | Gate |
|---|---|---|---|---|---|
| WP-01 | P1 | Prototype reuse classification | — | S | P1 |
| WP-02 | P1 | Production project initialization + toolchain pinning | — | M | P1 |
| WP-03 | P1 | Content Layer wiring (glob loaders) | WP-02 | M | P1 |
| WP-04 | P1 | Global styling foundation (frozen tokens) | WP-02 | M | P1 |
| WP-05 | P1 | Font loading plumbing + CJK strategy PoC | WP-04 | M | P1 |
| WP-06 | P1 | Test harness foundation | WP-02 | M | P1 |
| WP-07 | P1 | Benchmark harness scaffold | WP-02 | M | P1 |
| WP-08 | P2 | Authored fixture content corpus | WP-03 | M | P2 |
| WP-09 | P2 | Gallery + Photo schemas and identity validation | WP-08, WP-06 | L | P2 |
| WP-10 | P2 | Place schema (one Place = one file) | WP-08 | S | P2 |
| WP-11 | P2 | Home settings + featured resolution | WP-09 | M | P2 |
| WP-12 | P2 | Redirect schema and validation | WP-09, WP-10 | M | P2 |
| WP-13 | P2 | Production build validator integration | WP-09, WP-10, WP-11, WP-12 | L | P2 |
| WP-14 | P2 | Authoring workflow contract + ops docs | WP-13 | M | P2 |
| WP-15 | P3 | Image format/encoder/width benchmark gate ⚑ | WP-07 | L | P3 |
| WP-16 | P3 | ICC benchmark / policy gate | WP-07 | M | P3 |
| WP-17 | P3 | Source discovery + source validation | WP-13 | M | P3 |
| WP-18 | P3 | Metadata extraction + orientation normalization | WP-17 | M | P3 |
| WP-19 | P3 | Color transform implementation | WP-16, WP-18 | M | P3 |
| WP-20 | P3 | Derivative generation core | WP-15, WP-19 | L | P3 |
| WP-21 | P3 | Privacy stripping + output ICC embedding + final metadata verification | WP-20 | M | P3 |
| WP-22 | P3 | Fingerprint naming + asset manifest generation | WP-21 | M | P3 |
| WP-23 | P3 | Derivative coverage + determinism/regeneration | WP-21, WP-22 | M | P3 |
| WP-24 | P3 | Manifest consumption boundary (Astro build-time) | WP-22, WP-03 | M | P3 |
| WP-25 | P4 | View data assembly layer | WP-13, WP-24 | M | P4 |
| WP-26 | P4 | Site layout + accessible no-JS navigation | WP-04 | M | P4 |
| WP-27 | P4 | Discovery card primitive (bounded reuse) | WP-25 | S | P4 |
| WP-28 | P4 | Home page | WP-25, WP-26, WP-27 | M | P4 |
| WP-29 | P4 | Archive page | WP-25, WP-26, WP-27 | M | P4 |
| WP-30 | P4 | Places index + Place detail | WP-25, WP-26, WP-27 | M | P4 |
| WP-31 | P4 | About + 404 pages | WP-26 | S | P4 |
| WP-32 | P4 | Discovery visual-regression baselines | WP-28, WP-29, WP-30 | M | P4 |
| WP-33 | P5 | Gallery route + GalleryView assembly | WP-24, WP-13 | M | P5 |
| WP-34 | P5 | Gallery header (frozen editorial treatment) | WP-33, WP-26 | M | P5 |
| WP-35 | P5 | Photo sequence renderer (rhythm contract) | WP-33 | L | P5 |
| WP-36 | P5 | Position annotation (progressive enhancement) | WP-35 | S | P5 |
| WP-37 | P5 | Gallery ending (continuation semantics) | WP-33 | M | P5 |
| WP-38 | P5 | Gallery visual-regression baselines | WP-34, WP-35, WP-36, WP-37 | M | P5 |
| WP-39 | P6 | Overview presentation | WP-33 + P5 Gate | M | P6 |
| WP-40 | P6 | Overview behavior + accessibility semantics | WP-39, WP-34 | L | P6 |
| WP-41 | P6 | No-JS completeness verification | WP-40, WP-28, WP-29, WP-30, WP-31 | M | P6 |
| WP-42 | P7 | Alt text policy gate ⚑ | WP-13 | S | P7 pre-entry |
| WP-43 | P7 | Accessibility audit + remediation | WP-41, WP-42 | L | P7 |
| WP-44 | P7 | SEO artifacts | WP-28..WP-31, WP-33 | M | P7 |
| WP-45 | P7 | Performance baseline + budget enforcement | WP-35, WP-40 | L | P7 |
| WP-46 | P7 | CJK implementation gate ⚑ | WP-05, WP-13 | M | P7 |
| WP-47 | P8 | Full VR suite + adjudication ⚑ | WP-32, WP-38, WP-43, WP-46 | L | P8 |
| WP-48 | P8 | Edge-case hardening + cross-browser | WP-45, WP-47 | M | P8 |
| WP-49 | P8 | Frozen-design traceability verification | WP-47 | M | P8 |
| WP-50 | P9 | Environment + Nginx baseline configuration | P8 gate | M | P9 |
| WP-51 | P9 | Release assembly + integrity gate | WP-23, WP-24 | M | P9 |
| WP-52 | P9 | Redirect include generation | WP-12 | M | P9 |
| WP-53 | P9 | Deployment script (atomic flow + coupled rollback) | WP-50, WP-51, WP-52 | L | P9 |
| WP-54 | P9 | Deployment scenario tests (staging rehearsal) | WP-53 | M | P9 |
| WP-55 | P9 | Backup provider/tool selection ⚑ | — | S | P9 pre-entry |
| WP-56 | P9 | Backup implementation | WP-55 | M | P9 |
| WP-57 | P9 | Restore drill (total VPS loss) | WP-56, WP-53 | M | P9 |
| WP-58 | P10 | Pilot content batch ⚑ | WP-14, WP-42, WP-47 | M | P10 |
| WP-59 | P10 | Full archive ingest (resumable batch umbrella) | WP-58 | L | P10 |
| WP-60 | P10 | Production acceptance gate (launch) | ALL prior | L | P10 |

**Totals:** 60 WPs — S: 7, M: 41, L: 12. User-review gates: WP-15 (quality/payload tradeoff), WP-42, WP-46, WP-47, WP-55, WP-58 (+ WP-60 launch sign-off).

**Primary dependency spine:** WP-02 → WP-03 → WP-08 → WP-09 → WP-13 → WP-17 → WP-18 → WP-19 → WP-20 → WP-21 → WP-22 → WP-24 → WP-25 → WP-28 → WP-33 → WP-35 → WP-37 → WP-39 → WP-40 → WP-41 → WP-43 → WP-45 → WP-47 → WP-50 → WP-53 → WP-54 → WP-58 → WP-59 → WP-60.

**Mandatory fan-in blockers:** WP-13, WP-15 (user review), WP-24, the P1–P9 phase gates, WP-42 (P7 pre-entry), WP-47, WP-55 (P9 pre-entry), WP-57.
