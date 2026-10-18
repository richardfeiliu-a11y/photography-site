# Deferred Engineering Decisions — Quiet Editorial Archive

Companion to `PRODUCTION_IMPLEMENTATION_PLAN.md`. This file lists ONLY decisions that the frozen architecture legitimately leaves to implementation-phase measurement or policy review. None of these may be preselected before their owning gate runs; all are recorded as MEASURED BASELINE / decision records under `docs/implementation/decisions/` at execution time. Source of the deferrals: `OPEN_QUESTIONS.md`, `IMAGE_PIPELINE.md §12`, `PERFORMANCE_BUDGET.md`, `BACKUP_AND_RECOVERY.md §4.3`, `DEPLOYMENT_ARCHITECTURE.md §6.4`.

| # | Decision | Canonical deferral source | Owning gate | User review? | Status |
|---|---|---|---|---|---|
| D1 | Responsive image width steps (gallery_display) | OQ-01; IMAGE_PIPELINE §12 | WP-15 (P3) | Yes (quality vs payload) | CLOSED (2026-08-29 — [480,800,1024,1280,1600,2048,2560]; record: docs/implementation/decisions/BENCHMARK-OQ01-OQ02.md) |
| D2 | Production image format(s) + fallback strategy (`<picture>` multi-format vs single-format `<img>`) | OQ-02; PERFORMANCE_BUDGET §6.3, §8.2; IC-03 | WP-15 (P3) | Yes | CLOSED (2026-08-29 — AVIF primary, JPEG q75 progressive fallback, no WebP; same record) |
| D3 | Encoder selection + per-purpose quality values | OQ-02; IMAGE_PIPELINE §12 | WP-15 (P3) | Yes | CLOSED (2026-08-29 — Sharp/libvips; Gallery/Cover AVIF q65, Overview AVIF q55, JPEG q75; same record) |
| D4 | Overview thumbnail max dimension | IMAGE_PIPELINE §12 | WP-15 (P3) | Yes | CLOSED (2026-08-29 — 480px; same record) |
| D5 | Cover derivative dimensions | IMAGE_PIPELINE §12 | WP-15 (P3) | Yes | CLOSED (2026-08-29 — [1280,1600,2048,2560], natural source caps, no enlargement; same record) |
| D6 | High-DPR scaling strategy (2x/3x derivatives) | IMAGE_PIPELINE §12; PERFORMANCE_BUDGET §10.3 | WP-15 (P3) | Yes | CLOSED (2026-08-29 — width-descriptor srcset over D1 ladder, no @2x pairs, no 3x; accepted ≈1.125× corner display of 2560; same record + ADDENDUM-HIGH-DPR-PORTRAIT.md) |
| D7 | Progressive JPEG encoding choice | IMAGE_PIPELINE §12 | WP-15 (P3) | Yes | CLOSED (2026-08-29 — YES, all JPEG fallback derivatives progressive; same record) |
| D8 | Exact digest length for content-addressed filenames | IMAGE_PIPELINE §9.1, §12 (no six-hex freeze) | WP-15 (P3) | No | CLOSED (2026-08-29 — 16 hex over final served bytes; same record) |
| D9 | ICC no-profile (untagged source) enforcement policy: silent assume / warn / fail. Frozen interpretation is already closed: untagged pixels follow the canonical sRGB interpretation (ADR-011); only the enforcement mode is deferred, decided during P3 — NOT carried to P7 | OQ-03; ADR-011; IMAGE_PIPELINE §6.2 | WP-16 (P3) | No (technical) | CLOSED (2026-08-29 — assume; record: docs/implementation/decisions/ICC-POLICY.md) |
| D10 | Output ICC embedding in public derivatives | IMAGE_PIPELINE §6.4, §12 | WP-16 (P3) | No | CLOSED (2026-08-29 — no output ICC embedding; record: docs/implementation/decisions/ICC-POLICY.md) |
| D11 | Alt text publication enforcement policy | OQ-04; ADR-016 | WP-42 (P7 pre-entry) | Yes | CLOSED (2026-09-05 — policy (b): authored alt OR explicit decorative alt=""; no filename/caption fallback; hook live; record: docs/implementation/decisions/ALT-POLICY.md) |
| D12 | CJK subsetting implementation (broad static vs build-derived) + exact character corpus | OQ-05; PERFORMANCE_BUDGET §7.4 | PoC WP-05 (P1); finalized WP-46 (P7) | Yes (rendering review) | CLOSED (2026-09-05 — Option A broad static; user rendering review PASS on 5 Chromium captures; record: docs/implementation/decisions/CJK-SUBSETTING.md) |
| D13 | Backup provider + tool + encryption implementation | OQ-06; BACKUP_AND_RECOVERY §4.3 | WP-55 (P9) | Yes | RESCOPED (2026-09-10) — 对象存储备份不做，本机 + Google Drive 为 master 备份；见 `docs/implementation/decisions/BACKUP-SELECTION.md`「2026-09-10 改判」 |
| D14 | Old-page asset availability strategy (carry-forward vs shared content-addressed store); named record `docs/implementation/decisions/OLD-PAGE-ASSETS.md` with path/date/evidence ledger fields at resolution | DEPLOYMENT_ARCHITECTURE §6.4 | WP-51 (P9) — implementation choice, documented | No | OPEN |

## Rules governing these decisions

1. **No preselection.** No work package before the owning gate may hardcode, assume, or scaffold around a deferred value. WP-15's no-preselection grep gate protects D1–D8; the manifest schema stays format-agnostic (IC-03).
2. **Measurement or explicit policy review.** D1–D10, D12, D14 resolve by measured evidence; D11, D13 by recorded policy choice. All produce a decision record naming evidence, alternatives considered, and rationale.
3. **Classification discipline (PERFORMANCE_BUDGET §1).** A value moves to an enforced CI gate only via MEASURED BASELINE. Aspirational budgets (JS ≤20KB, CSS ≤40KB, memory, build times) remain guidance until WP-45 records baselines.
4. **Architecture remains untouched.** Resolving these decisions never reopens frozen architecture; outcomes are recorded as ADR updates/additions per OPEN_QUESTIONS process §5 only where the canonical process requires it.
5. **User-review scope.** D8–D10 are purely technical decisions and require no user review; user review applies only to genuine visual-quality/editorial judgments (the D1–D7 quality/payload tradeoff inside WP-15, D11, D12 rendering review, D13).
6. **Ledger.** At execution time, each resolved row gains: decision record path, date, evidence link. This file is updated at the owning gate, not before.
