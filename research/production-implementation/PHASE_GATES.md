# Phase Gates — Quiet Editorial Archive

Companion to `PRODUCTION_IMPLEMENTATION_PLAN.md`. One compact definition of P1–P10 exit criteria, adapted from canonical `IMPLEMENTATION_PHASES.md` entry/exit criteria and bound to work-package IDs. **Governing rule:** a phase may begin when its explicitly defined Entry criteria below pass. P4 and P5 may proceed in parallel after the P3 Gate. WP-42 (alt policy) and WP-55 (backup provider) are pre-entry decision gates for P7 and P9 respectively — they resolve before that phase begins. Status column is the execution ledger (all PENDING at planning time).

| Phase | Gate | Status |
|---|---|---|
| P1 | Foundation Gate | PASS (2026-08-29 — evidence: `docs/implementation/P1-GATE.md` + `P1-GATE-evidence.txt`, branch `production-dev`) |
| P2 | Content Contract Gate | PASS (2026-08-29 — evidence: `docs/implementation/P2-GATE.md` + `P2-GATE-evidence.txt`, branch `production-dev`) |
| P3 | Media/Benchmark Gate | PASS (2026-08-30 — formal independent verification `research/production-implementation/P3_FINAL_TARGETED_REVERIFICATION.md`: "P3 IMPLEMENTATION VERIFICATION PASS — Ready for P4/P5 Production Development"; evidence: `docs/implementation/P3-GATE.md` + `P3-GATE-evidence.txt`) |
| P4 | Discovery Gate | EVIDENCE COMPLETE (2026-08-31 — lanes merged to production-dev at 9524eb5; criterion map + live evidence: `docs/implementation/P4-GATE.md`; formal PASS pends independent user verification) |
| P5 | Gallery Core Gate | EVIDENCE COMPLETE (2026-08-31 — lanes merged to production-dev at 9524eb5; criterion map + live evidence: `docs/implementation/P5-GATE.md`; formal PASS pends independent user verification) |
| P6 | Interaction Gate | PENDING |
| P7 | A11y/SEO/Performance Gate | PENDING |
| P8 | Visual Regression Gate | PENDING |
| P9 | Deployment/Recovery Gate | PENDING |
| P10 | Launch Acceptance Gate | PENDING |

---

## P1 — Foundation Gate

**Entry:** Architecture Freeze Gate A passed (evidenced by `TARGETED_ARCHITECTURE_FREEZE_VERIFICATION.md`).

**PASS only when:**
- `npm run dev` starts and renders a baseline page with correct frozen fonts and colors (WP-02, WP-04, WP-05).
- Content Layer loads YAML from `content/galleries/` without any `src/content/` mirror (WP-03).
- CJK font strategy proof demonstrates a viable approach with working system fallback (WP-05).
- Test harness executes at least one passing content validation test (WP-06).
- Benchmark harness ingests fixture images and produces measurements (WP-07).
- Exact Astro + Node versions pinned in lockfile; ESLint/Prettier/hooks live (WP-02).
- Prototype artifacts classified A/B/C with the no-wholesale-reuse rule recorded (WP-01).

## P2 — Content Contract Gate

**Entry:** P1 Gate PASS.

**PASS only when:**
- Zod schemas implemented and match CONTENT_MODEL.md exactly (WP-09, WP-10, WP-11, WP-12).
- Every invalid fixture fails; every valid fixture builds (WP-08 corpus; WP-13 integration).
- Identity semantics proven: rename/move updates `source_ref` retaining Photo ID; corrected-master replacement retains ID with changed hash (WP-09 tests; WP-14 walkthrough).
- Production draft filtering verified at every output point: routes, sitemap input, Archive/Places/Home data (WP-13).
- Authoring workflow contract documented: ingest, rename, move, replace-master, publish, slug-change, featured, unpublish (WP-14).

## P3 — Media/Benchmark Gate

**Entry:** P2 Gate PASS.

**PASS only when:**
- Benchmark decisions recorded: formats, fallback, encoder, quality, widths, overview/cover dimensions, high-DPR strategy, progressive-JPEG, digest length (WP-15 — user review applies to the quality/payload tradeoff only); untagged-ICC policy (D9) + output ICC embedding (D10) resolved technically during P3 (WP-16).
- Pipeline regenerates from empty `generated/` with semantic determinism (WP-23).
- Manifest closure tests pass: every published Photo has every required derivative per the frozen P3 format contract (WP-23).
- Privacy stripping + approved output ICC embedding verified on final served derivatives: no GPS/serial/private metadata; masters untouched (WP-21).
- Representative photo quality approved by the user (WP-15 evidence).
- Astro consumes the manifest at build time with producer-before-consumer enforcement (WP-24).

## P4 — Discovery Gate

**Entry:** P3 Gate PASS.

**PASS only when:**
- Home hero matches G3 scale (75svh desktop ceiling; 60/70svh mobile caps) (WP-28).
- Featured selection follows ADR-019: explicit featured or latest-published fallback with ID tie-break (WP-11, WP-25, WP-28).
- Archive year headings render from photographed dates; content-fit grid; no sticky landmarks (WP-29).
- Places names-led with region/country disambiguation and zero counts anywhere (WP-30).
- Routes match canonical patterns: `/`, `/archive`, `/places`, `/places/{slug}` (WP-28..WP-31).
- Accessible no-JS navigation proven in JS-blocked context (WP-26).
- Visual regression baselines captured for discovery pages (WP-32).

## P5 — Gallery Core Gate

**Entry:** P3 Gate PASS (P4 may proceed in parallel).

**PASS only when:**
- Base rhythm = 96px desktop / 64px mobile, measured (WP-35).
- Compact/Breathing applied only at authored positions; orientation never selects rhythm (WP-35).
- Captions visible below photos when authored; no hover-only; no empty reserved region when absent (WP-35).
- Continuation matches G7 frozen typography and spacing (168/112 pause; 28/22 Next serif; no-cover/no-button) incl. no-next variant (WP-37).
- Position annotation yields at header and continuation boundaries; aria-hidden; absent without JS (WP-36).
- Header non-sticky on reading column with frozen content order (WP-34).
- Visual regression baselines captured for Gallery rendering (WP-38).

## P6 — Interaction Gate

**Entry:** P5 Gate PASS.

**PASS only when:**
- Overview opens/closes reliably with keyboard and pointer (WP-40).
- Focus trap cycles across first/last boundaries; Escape closes and restores focus to trigger (WP-40).
- Background scroll locked while open (WP-40).
- Overview thumbnails contained and uncropped; grid contracts 6/5 desktop, 3 mobile (WP-39).
- Jump-to-photo restores exact position (WP-40).
- Reduced motion zeroes transitions; JS close path synchronous (WP-40).
- Core navigation and full Gallery usable without JavaScript (WP-41).

## P7 — A11y/SEO/Performance Gate

**Entry:** P6 Gate PASS; alt policy resolved as the pre-entry decision gate (WP-42, user review).

**PASS only when:**
- Automated accessibility tests pass (zero axe violations per page type) AND manual checks evidenced: keyboard, focus, touch targets, reduced motion (WP-43). Automated tooling alone does not certify.
- Alt policy enforced in publication validation per recorded decision; no filename fallback; no caption-to-alt auto-copy (WP-42).
- Sitemap validates and excludes drafts; canonical URLs exact; robots present; no visible UI changed for SEO (WP-44).
- Performance measurements recorded on representative pages (Home, Place, normal Gallery, long Gallery, Overview interaction); budgets met or explicitly adjusted with rationale; no unmeasured value enforced as a CI gate (WP-45).
- CJK font subsetting operational with verified build-time glyph coverage; user typography review passed (WP-46).

## P8 — Visual Regression Gate

**Entry:** P7 Gate PASS; baselines captured during P4/P5.

**PASS only when:**
- Full visual regression suite passes with governed baselines across all canonical states (WP-47).
- No unexplained visual drift from frozen design; P0/P1 findings fixed without redesigning G1–G7 (WP-47).
- Cross-browser matrix documented; low-end mobile tested (WP-48).
- Long Gallery measurement confirms no virtualization needed or provides measured justification (WP-45/WP-48, ADR-013).
- All frozen states (G1–G7) verified against production rendering row-by-row (WP-49).
- Gallery Production Visual Review sign-off recorded (WP-47 user gate).

## P9 — Deployment/Recovery Gate

**Entry:** P8 Gate PASS; backup provider selected as the pre-entry decision gate (WP-55, user review).

**PASS only when:**
- Deployment rehearsal succeeds against the non-production target (WP-53, WP-54).
- Rollback restores the exact previous release (captured before switch, never derived) (WP-53, WP-54).
- Redirect lifecycle proven: content-only = no reload; redirect-change = `nginx -t` + reload + 301 smoke; failure = exact coupled rollback of release AND redirect config (WP-52..WP-54).
- Release integrity gate includes sitemap validity (published-only; no draft leakage) (WP-51).
- Backup restore drill completes within RTO ≤24h from total VPS loss on a clean host; RPO ≤24h operationally satisfied (WP-56, WP-57).
- Nginx serves correctly with differentiated cache headers and real static 404; TLS valid; `/health` live (WP-50).
- Post-switch smoke checks pass against actual release content (WP-53).
- No SPA fallback behavior anywhere (WP-50).

## P10 — Launch Acceptance Gate

**Entry:** P9 Gate PASS; all prior gates PASS.

**PASS only when:**
- Production build clean; content validation clean; derivative closure clean (WP-60 bundle).
- No drafts leaked (route, sitemap, discovery probes) (WP-60).
- Routes/canonical URLs correct; redirect 301 smoke live (WP-60).
- Accessibility gate evidence current; performance within recorded baselines (WP-60).
- Visual regression P0/P1 clear; backup restore drill evidence current; rollback tested fresh (WP-60).
- Pilot content visually reviewed (WP-58); all declared ingest batches PASS with aggregate completeness reconciliation (WP-59).
- FINAL_DESIGN_SPECIFICATION §8 checklist and P10 consistency audit pass (WP-60).
- Production deployment executed via canonical flow; post-switch live smoke green; About final copy in place (placeholder must not silently launch); documentation current (WP-60).

---

**Gate discipline:** gate evidence is recorded in `docs/implementation/` at execution time; this file's Status column is updated only with evidence links. A failed gate reopens its phase, never a frozen decision.
