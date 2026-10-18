# PREVIOUS_CORRECTIONS — SUPERSEDED HISTORICAL PROPOSALS

**Status:** SUPERSEDED HISTORICAL PROPOSALS — DO NOT IMPLEMENT DIRECTLY
**Superseded by:** The rewritten canonical architecture in `research/production-architecture/` (2026-08-28 canonical rewrite)
**Supersession evidence:** `research/production-architecture/CANONICAL_REWRITE_TRACEABILITY.md`

---

## What this folder is

This folder preserves the historical correction proposals written after the independent architecture red-team review (Gate C) and before the canonical rewrite. They are retained as audit evidence of what was attempted, per the targeted re-review's instruction that PREVIOUS_CORRECTIONS be marked superseded rather than deleted.

Contents:

| File | Historical role |
|---|---|
| photo-identity-registry-corrected.md | Proposed a global authored photo identity registry. Superseded by UD-001: photo identity and source binding live in Gallery authored YAML (`photos[].id` + `photos[].source_ref`), not a separate registry. |
| corrected-build-dag.md | Proposed a staged build DAG whose manifest was consumed after its consumer ran. Superseded by the canonical build DAG in BUILD_AND_ROUTING.md (manifest with final public paths exists before Astro build). |
| single-source-of-truth-content.md | Proposed content consolidation plus competing draft mechanisms (`_draft-*`, `drafts/`, `published/`). Superseded by UD-009: one publication-state mechanism, `status: draft|published`. |
| home-state-persistence.md | Proposed Home editorial state including imported FreeBuff identifiers, This Week/is_curated semantics, and EXIF-derived publication time. Superseded by UD-003 and UD-004; product contamination removed. |
| important-findings-corrections.md | Mixed IMPORTANT-finding corrections. Accepted content is integrated into the canonical documents; rejected content is recorded in CANONICAL_REWRITE_TRACEABILITY.md. |
| minor-fixes-batch.md | Minor-fix batch. Accepted content integrated; the rest is historical. |
| CORRECTION_SUMMARY_REPORT.md | Correction-set summary claiming completion before canonical integration. Its completion claims are not authoritative; see the targeted re-review. |
| EXECUTION_SUMMARY.md | Execution summary for the correction pass. Historical only. |
| TARGETED_RE_REVIEW_PREPARATION.md | Preparation notes for the targeted re-review. Historical only. |

## Rules for readers

1. **Do not implement from this folder.** Where a proposal here conflicts with the canonical architecture or the rewrite brief, the canonical architecture wins.
2. Correction-summary claims such as COMPLETE do not constitute evidence; only the canonical files under `research/production-architecture/` are authoritative.
3. The authoritative audit trail is: `research/production-architecture-red-team/INDEPENDENT_ARCHITECTURE_RED_TEAM.md` → `research/production-architecture-red-team/TARGETED_INDEPENDENT_ARCHITECTURE_RE_REVIEW.md` → `research/production-architecture-red-team/CANONICAL_REWRITE_BRIEF.md` → `research/production-architecture/CANONICAL_REWRITE_TRACEABILITY.md`.
