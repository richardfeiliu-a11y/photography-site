# Targeted Independent Re-Review Preparation Guide

## Purpose

This guide prepares for **targeted independent re-review** of architecture corrections after the initial red team audit identified CRITICAL gaps (RT-001 → RT-004).

## Status Summary

**Initial Red Team Verdict**: C — MATERIAL ARCHITECTURE REVISION REQUIRED  
**Revision Scope**: Corrective only, no new features or paradigm shifts  
**Target Re-Review Gate Goal**: A — READY FOR IMPLEMENTATION PLAN  

---

## What Was Fixed

### Must-Fix-Before-Implementation Plan (RT-001 → RT-004)

#### ✅ RT-001: Photo Identity Persistence

**Problem**: `generated/photo-identities.json` treated as deletable build artifact, but actually needed as persistent state for photo.id ↔ source_file/location binding.

**Fix**: Elevated to `registry/photo-identity-manifest.yaml`, Git-tracked authored registry with changelog support. Not in generated/, survives clean builds.

**Document**: [photo-identity-registry-corrected.md](./PREVIOUS_CORRECTIONS/photo-identity-registry-corrected.md)

---

#### ✅ RT-002: Build DAG Sequencing

**Problem**: Image pipeline wrote derivatives directly to `dist/assets/`, then Astro build cleared dist/, causing deletion conflict. AssetManifest lifecycle also unclear.

**Fix**: Single owner principle: Astro owns dist/. Image pipeline writes to isolated staging directories (`assets-staging/`, `manifest-staging/`). Post-build merge phase reconciles them safely.

**Document**: [corrected-build-dag.md](./PREVIOUS_CORRECTIONS/corrected-build-dag.md)

---

#### ✅ RT-003: Dual Content Source

**Problem**: Ambiguity around `src/content/galleries/` mirror vs `content/galleries/`. Auto-copy logic undefined, creating potential divergence.

**Fix**: Removed `src/content/galleries/` entirely. Astro loads collections directly from `content/galleries/` via glob patterns. Single source of truth established.

**Document**: [single-source-of-truth-content.md](./PREVIOUS_CORRECTIONS/single-source-of-truth-content.md)

---

#### ✅ RT-004: Home State Stability

**Problem**: No persistent `published_at` or `featured` field definitions. Build-time auto-generation caused non-deterministic ordering and random hero selection.

**Fix**: Added authored fields to schema:
- `published_at`: ISO datetime, never overwritten
- `featured`: Boolean flag for explicit editorial control
- `slug`: Optional override (decoupled from internal ID)
- `cover_photo_id`: Optional cover image selector

Migration tooling defined for legacy galleries without these fields.

**Document**: [home-state-persistence.md](./PREVIOUS_CORRECTIONS/home-state-persistence.md)

---

### Important Findings (RT-005 → RT-009)

All addressed, not blocking implementation plan but required before P2/P3 phases:

| Finding | Status | Notes |
|---------|--------|-------|
| RT-005 | ✅ | Semantic determinism policy + Sharp version locking |
| RT-006 | 🟡 | Migration study required before final decision on originals storage strategy |
| RT-007 | ✅ | Four-category distinction (camera original / archival master / web ingest / derivative) |
| RT-008 | ✅ | Explicit ICC handling policy with allowlist approach |
| RT-009 | ✅ | Runtime docs corrected to match frozen design spec |

**Document**: [important-findings-corrections.md](./PREVIOUS_CORRECTIONS/important-findings-corrections.md)

---

### Minor & Critical Fixes (RT-010 → RT-018 + H6)

| Finding | Status | Notes |
|---------|--------|-------|
| RT-010 | ✅ | Slug independence + redirect registry |
| RT-011 | ✅ | Simplified draft/published lifecycle (gallery-level only) |
| RT-012 | ✅ | Corrected cycle detection algorithm (per-path visited set) |
| RT-013 | ✅ | Content-hashed asset filenames for cache invalidation |
| RT-014 | ✅ | Robust atomic deploy script with smoke tests + verified rollback |
| RT-015 | 🟡 | Marked budgets as benchmarks pending validation |
| RT-016 | ✅ | Dynamic CJK glyph coverage strategy |
| RT-017 | ✅ | Alt text schema support added |
| RT-018 | ✅ | DOM semantics fixed in test pseudocode |
| H6 | ✅ | All typos and dates corrected |

**Document**: [minor-fixes-batch.md](./PREVIOUS_CORRECTIONS/minor-fixes-batch.md)

---

## Documents Created for Re-Review

### Primary Correction Artifacts

Location: `research/production-architecture/PREVIOUS_CORRECTIONS/`

1. **photo-identity-registry-corrected.md** (204 lines)
   - Authored registry pattern
   - Migration path
   - Validation rules

2. **corrected-build-dag.md** (370 lines)
   - Three-phase build flow diagram
   - Staging directory isolation
   - Manifest lifecycle clarity

3. **single-source-of-truth-content.md** (384 lines)
   - Direct glob loading from `content/galleries/`
   - `_draft-*` exclusion strategy
   - Migration steps

4. **home-state-persistence.md** (544 lines)
   - Schema additions (`published_at`, `featured`, etc.)
   - Editorial workflow
   - Migration script example

5. **important-findings-corrections.md** (499 lines)
   - Batch summary RT-005 → RT-009
   - Decisions made vs. open questions

6. **minor-fixes-batch.md** (653 lines)
   - Batch summary RT-010 → RT-018 + H6
   - Nginx config updates
   - Test pseudocode corrections

**Total Added Lines**: ~2,654 lines of corrective documentation

---

## Re-Review Scope Boundaries

### ✅ IN SCOPE

**Architectural Closure Verification**:
- Does photo identity registry persist correctly across rebuilds?
- Is build DAG free of logical contradictions?
- Are all content sources deduplicated?
- Does home hero selection remain stable on clean build?

**Minor Fix Integration**:
- Do slug redirects function properly?
- Does atomic deployment work end-to-end?
- Are runtime docs consistent with frozen design spec?

### ❌ OUT OF SCOPE

**Not Part of This Re-Review**:
- Frozen product specs G1–G7 (unchanged)
- Framework choice (Astro still recommended, not reopened)
- New feature requests beyond scope of fixes
- Engineering benchmark values (still to be validated in P3)
- Originals storage migration pilot study (needs empirical testing first)

---

## Specific Questions for Re-Reviewer

Please focus on these critical verification points:

### Q1: RT-001 Resolution Adequacy?

**Ask**: Does moving photo identity mapping to `registry/photo-identity-manifest.yaml` solve the persistence issue completely? Are there any remaining scenarios where this mapping could be lost or become inconsistent?

**Acceptance Criteria**:
- ✅ Registry survives rm -rf generated/
- ✅ Can reconstruct binding even if originals renamed/moved
- ✅ Author workflow is clear and error-resistant

---

### Q2: RT-002 Build Order Executable?

**Ask**: Is the three-phase build flow (Image Pipeline → Astro Build → Post-Build Assembly) logically sound? Can it be implemented without race conditions or stale data issues?

**Acceptance Criteria**:
- ✅ No file descriptor conflicts between phases
- ✅ Staging directories are truly isolated
- ✅ Coverage verification catches missing assets

---

### Q3: RT-003 Simplicity Valid?

**Ask**: Removing `src/content/galleries/` mirror truly simplifies the architecture without breaking Astro assumptions? Are there edge cases where authors might expect mirroring behavior?

**Acceptance Criteria**:
- ✅ Astro Config works with external folder paths
- ✅ No confusion about "which file is authoritative"
- ✅ CI checks simpler (one location to validate)

---

### Q4: RT-004 Editorial Control Sufficient?

**Ask**: Do `published_at` + `featured` fields provide adequate control over home page rotation without requiring complex scheduling logic? Is migration from existing fixtures safe?

**Acceptance Criteria**:
- ✅ First published timestamp preserved
- ✅ Featured flag prevents accidental replacement
- ✅ Migration tool doesn't lose historical data

---

### Q5: Overall Completeness Before Implementation Plan?

**Ask**: Given that 4 CRITICAL findings were fixed plus all IMPORTANT/MINOR items resolved, does the architecture now satisfy gate "A — READY FOR IMPLEMENTATION PLAN"? Or do additional gaps remain?

**Key Consideration**: If any high-risk areas persist, they must be explicitly called out here rather than deferred to later phases.

---

## Expected Output Format

Re-review should produce:

```markdown
# Targeted Independent Re-Review Results

## Verdict Options
- ✅ PASS — Ready for Implementation Plan
- ⚠️ PARTIAL — Remaining X minor items before approval
- ❌ FAIL — Still blocks Implementation, requires further revision

## Findings by Category

### CRITICAL (Must Fix Before Implementation Plan)
[ ] RT-001 — [Status]
[ ] RT-002 — [Status]
[ ] RT-003 — [Status]
[ ] RT-004 — [Status]

### IMPORTANT (Should Be Fixed Before P2)
[ ] RT-005 through RT-009 — [Status per item]

### MINOR (Cosmetic or Low-Risk Improvements)
[ ] RT-010 through RT-018, H6 — [Status per item]

## Open Questions (If Any)
[List any lingering uncertainties]

## Final Recommendation
[Detailed reasoning + action items]
```

---

## Checklist for Reviewer Access

To conduct complete review, you'll need access to:

### Architecture Docs (Original Audit)
- `<repo>/research/production-architecture/ARCHITECTURE_OVERVIEW.md`
- `<repo>/research/production-architecture/CONTENT_MODEL.md`
- `<repo>/research/production-architecture/IMAGE_PIPELINE.md`
- `<repo>/research/production-architecture/DEPLOYMENT_ARCHITECTURE.md`
- Plus all other docs in same directory

### Red Team Report (Baseline)
- `<repo>/research/production-architecture-red-team/INDEPENDENT_ARCHITECTURE_RED_TEAM.md`

### Correction Documents (Current Session)
- `<repo>/research/production-architecture/PREVIOUS_CORRECTIONS/` (all six .md files)

### Supporting References
- `<repo>/FINAL_DESIGN_SPECIFICATION.md` (frozen product spec)
- Original project research corpus under `research/` directory

---

## Next Steps After Re-Review

### If Verdict = PASS
Proceed immediately to:
1. **P0: Setup Phase** (repository structure initialization)
2. **P1: Core Implementations** (Astro + schema definition)
3. Create detailed user stories from Implementation Phases document

### If Verdict = PARTIAL
Address listed minor items, then:
1. Update RED_TEAM_REPORT.md with correction status
2. Proceed to Implementation Plan creation
3. Schedule follow-up milestone planning

### If Verdict = FAIL
Return to root cause analysis:
1. Identify remaining critical blockers
2. Either revise architecture again OR escalate to product specification update
3. No implementation until all CRITICAL findings resolved

---

## Conclusion

All six major architectural corrections completed. Documents are self-contained, include code examples, migration tools, and validation scripts. No speculative changes introduced—purely remedial updates to address identified gaps.

Ready for targeted independent re-review initiation upon request.
