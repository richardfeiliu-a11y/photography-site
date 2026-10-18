# 0828｜研究｜定向复审提示词

You are an independent production architecture reviewer.

Your task is to examine a proposed set of architecture corrections for Quiet Editorial Archive. The correction documents were authored after an earlier red-team review. Treat every statement in both the original architecture and the correction documents as untrusted until verified against the actual text, frozen design contract, repository authority boundaries, and current official technical documentation where necessary.

Do not defend the corrections.

Do not assume a document is correct because it says CORRECTED, ADOPTED, COMPLETE, verified, ready, or PASS.

Do not infer implementation success from document length, checkmarks, code examples, migration examples, or summary reports.

Do not redesign the product.

Do not modify any attached file.

Do not begin an Implementation Plan.

## Required attachments

All files below must be provided to you. If any required file is missing or inaccessible, stop and return a list of missing files. Do not guess their contents.

### Frozen product authority

1. research/FINAL_DESIGN_SPECIFICATION.md

### Original independent red-team contract

2. research/production-architecture-red-team/INDEPENDENT_ARCHITECTURE_RED_TEAM.md

### Current canonical architecture

3. research/production-architecture/README.md
4. research/production-architecture/ARCHITECTURE_OVERVIEW.md
5. research/production-architecture/ARCHITECTURE_DECISIONS.md
6. research/production-architecture/CONTENT_MODEL.md
7. research/production-architecture/IMAGE_PIPELINE.md
8. research/production-architecture/BUILD_AND_ROUTING.md
9. research/production-architecture/RUNTIME_AND_PROGRESSIVE_ENHANCEMENT.md
10. research/production-architecture/PERFORMANCE_BUDGET.md
11. research/production-architecture/TESTING_AND_VISUAL_REGRESSION.md
12. research/production-architecture/DEPLOYMENT_ARCHITECTURE.md
13. research/production-architecture/REPOSITORY_STRUCTURE.md
14. research/production-architecture/RISK_REGISTER.md
15. research/production-architecture/IMPLEMENTATION_PHASES.md
16. research/production-architecture/OPEN_QUESTIONS.md
17. research/production-architecture/PRODUCTION_ARCHITECTURE_SUMMARY.md
18. research/production-architecture/ARCHITECTURE_REVIEW_PACKET.md

### Proposed correction artifacts

19. research/production-architecture/PREVIOUS_CORRECTIONS/photo-identity-registry-corrected.md
20. research/production-architecture/PREVIOUS_CORRECTIONS/corrected-build-dag.md
21. research/production-architecture/PREVIOUS_CORRECTIONS/single-source-of-truth-content.md
22. research/production-architecture/PREVIOUS_CORRECTIONS/home-state-persistence.md
23. research/production-architecture/PREVIOUS_CORRECTIONS/important-findings-corrections.md
24. research/production-architecture/PREVIOUS_CORRECTIONS/minor-fixes-batch.md
25. research/production-architecture/TARGETED_RE_REVIEW_PREPARATION.md
26. research/production-architecture/CORRECTION_SUMMARY_REPORT.md
27. research/production-architecture/EXECUTION_SUMMARY.md

## Contract

The frozen design specification defines WHAT must be built. The architecture defines HOW it will be built.

If a correction document contradicts the frozen design, classify the correction as wrong by default.

The targeted re-review must determine whether the corrections actually close the findings in the original independent red-team report, especially RT-001 through RT-004, without:

- creating new sources of truth;
- leaving the old canonical architecture authoritative and contradictory;
- introducing implementation-order cycles;
- relying on data labeled generated that contains persistent authored state;
- using invalid or imaginary framework/library APIs;
- adding product features or behaviors absent from the frozen design;
- weakening privacy, accessibility, deterministic-build, backup, redirect, or deployment guarantees;
- substituting pseudocode claims for an executable architecture contract;
- claiming verification that cannot be supported by repository evidence.

The high-level direction may remain valid:

Astro static generation + file-first YAML + local image pipeline + minimal progressive-enhancement JavaScript + self-hosted Nginx.

Do not reopen framework selection unless you find a fatal mismatch. Correctable defects inside this direction do not justify rejecting the direction.

## Adversarial review instructions

Find what is wrong with the proposed correction artifacts.

Assume the author may be overconfident.

Look for:

- unstated assumptions;
- contradictory canonical authorities;
- fields duplicated across Gallery YAML, registries, generated manifests, or directory names;
- producer/consumer ordering errors;
- output paths that do not match manifest paths or server paths;
- build steps that render HTML before required asset data exists;
- invalid Astro, Sharp, Node, Nginx, shell, YAML, JSON, TypeScript, Zod, Playwright, or font-tool examples;
- code examples that cannot execute as written;
- warnings where production must fail closed;
- draft/published leakage;
- wrong route families;
- slug/ID/redirect ambiguity;
- use of build time or photographed time as publication time;
- non-deterministic fields hidden inside supposedly deterministic state;
- cache headers incompatible with filename strategy;
- rollback procedures that do not preserve the exact previous target;
- smoke tests that do not test the candidate release;
- font or CJK strategies that change the frozen families or omit future glyph coverage;
- caption, continuation, Overview, mobile navigation, or alt-text behavior that drifts from the frozen product;
- product names, domains, routes, features, terminology, or editorial concepts imported from a different project;
- “NEEDS UPDATE” statements that show the canonical architecture was not actually revised;
- summaries that claim source files were corrected when the source files still contain the old text;
- user decisions that were silently made by the correction author.

Do not validate or summarize before completing the adversarial pass.

If you cannot find a problem after thorough examination, state that explicitly and list what you checked.

## Required evidence discipline

For every material finding:

1. Cite the exact attached file and line number or smallest useful line range.
2. Quote or closely paraphrase the challenged statement.
3. Identify the conflicting contract, file, field, path, API, or frozen-design rule.
4. Separate:
   - SOURCE DOCUMENT FINDING
   - EXTERNAL VERIFICATION
   - YOUR INFERENCE
5. Explain a concrete failure scenario.
6. State the minimum correction.
7. State whether the high-level architecture direction changes.
8. State whether a user decision is required.

Do not treat a summary report as evidence that underlying files changed. Inspect the underlying files.

Do not treat pseudocode as executable unless it is explicitly labeled pseudocode. If an example is presented as valid or verified, assess whether it can actually run.

## Narrow external verification

Use current official primary sources only when a technical fact materially affects the verdict.

Preferred sources:

- docs.astro.build
- sharp.pixelplumbing.com
- nodejs.org
- vite.dev
- nginx.org
- man7.org or official GNU/Linux manual documentation
- w3.org, whatwg.org, developer.mozilla.org, or web.dev

Do not use blogs, tutorials, generated summaries, forums, or search-result snippets as authority when official documentation exists.

Relevant checks may include:

- whether Astro collections are configured in astro.config.mjs or src/content.config.ts;
- whether the Content Layer glob loader can read YAML outside src/;
- whether the shown Sharp ICC and metadata methods/options exist;
- whether the Nginx include/redirect syntax is valid;
- whether the proposed symlink replacement and rollback preserve the exact prior target;
- whether HTML hidden/dialog assertions match browser semantics.

## Priority review A — Canonical authority and correction integration

Determine:

1. Were the canonical architecture documents actually revised?
2. Or do the correction files merely propose future changes while the old canonical files remain authoritative?
3. If both remain, which one wins?
4. Do any correction files explicitly say that canonical documents still NEED UPDATE?
5. Do the summary documents claim corrections that are absent from underlying canonical files?
6. Has the correction layer created a third source of architectural truth?

This authority question may itself be CRITICAL.

## Priority review B — RT-001 Photo identity persistence

Determine whether the proposed registry:

- is genuinely persistent and Git-tracked;
- contains exactly the state that must persist, without duplicating derived dimensions, orientation, timestamps, or filenames unnecessarily;
- uses one canonical source reference rather than source_file and location values that can diverge;
- survives rename, move, corrected export, generated/ deletion, and restore;
- fails production when a referenced source is missing;
- has a valid path schema;
- is consistently consumed by validation, image derivation, and content rendering;
- reflects a user-approved identity decision rather than an unapproved automatic choice.

Return one verdict:

- CLOSED
- PARTIALLY CLOSED
- NOT CLOSED
- REGRESSED

## Priority review C — RT-002 Build DAG

Trace the corrected flow as a dependency graph.

Explicitly answer:

1. When does AssetManifest exist?
2. When does Astro consume it?
3. How can Astro render final image URLs if assets/manifests are only assembled after Astro finishes?
4. Do manifest URLs match actual dist paths and Nginx paths?
5. Does any build step write to dist before a later step clears it?
6. Is dist owned by one process or modified after its owner declares completion?
7. Does coverage validation actually populate the requested Photo IDs?
8. What happens if post-build assembly fails halfway?
9. Are all shown commands/APIs real and internally consistent?

Return CLOSED / PARTIALLY CLOSED / NOT CLOSED / REGRESSED.

## Priority review D — RT-003 Content source and Astro loading

Determine whether:

- content/galleries/ is the only authored source;
- no copy/mirror is required;
- the shown Astro configuration is valid for the declared current version;
- the loader is defined in the correct file;
- draft filtering uses one canonical model;
- correction documents agree on underscore drafts versus published/drafts directories versus a status field;
- Gallery routes remain /galleries/{slug};
- content image placement remains consistent with the media/registry architecture.

Return CLOSED / PARTIALLY CLOSED / NOT CLOSED / REGRESSED.

## Priority review E — RT-004 Home state

Determine whether:

- published_at is persistent authored state and never replaced by build time;
- featured state supports exactly the frozen Home rule;
- at most one published Gallery may be featured;
- deterministic fallback ordering is fully specified;
- photographed dates are never used as a publication-time substitute;
- migration cannot fabricate historical publication dates;
- no extra Home sections, rotations, curation flags, scheduling rules, recommendation behavior, or unrelated product concepts were introduced;
- slug, redirect, cover, sitemap, and cache examples preserve canonical routes and frozen behavior.

Return CLOSED / PARTIALLY CLOSED / NOT CLOSED / REGRESSED.

## Secondary review — RT-005 through RT-018 and H6

Create a table:

| Finding | Status | Evidence | New defect introduced? | Required timing |

Allowed status values:

- CLOSED
- PARTIALLY CLOSED
- OPEN
- REGRESSED
- NOT ACTUALLY APPLIED

At minimum assess:

- RT-005 determinism
- RT-006 originals/LFS/backup
- RT-007 media terminology
- RT-008 ICC/privacy pipeline
- RT-009 progressive enhancement/frozen drift
- RT-010 slug/redirects
- RT-011 draft/published lifecycle
- RT-012 next_gallery validation
- RT-013 hashed assets/cache
- RT-014 deployment/rollback
- RT-015 performance budgets/chunking
- RT-016 CJK coverage
- RT-017 alt-text schema/policy
- RT-018 test semantics
- H6 documentary corrections

## Severity model

Classify every new finding as exactly one:

### CRITICAL

The correction remains logically inconsistent, creates data-loss/publication risk, violates frozen design, uses an impossible build contract, or leaves unresolved canonical authorities.

### IMPORTANT

The correction is implementable in principle but needs correction before the relevant implementation phase.

### MINOR

Documentation error, naming problem, non-authoritative example bug, or cosmetic inconsistency that does not alter the architecture contract.

### NO ISSUE

Investigated and sound.

Do not inflate severity. Do not downgrade a contradiction merely because the intended direction is reasonable.

## Required final output

# Targeted Independent Architecture Re-Review

## Executive Verdict

## Files and Authority Reviewed

## Canonical Integration Verdict

## RT-001 Verdict

## RT-002 Verdict

## RT-003 Verdict

## RT-004 Verdict

## RT-005–RT-018 and H6 Status Matrix

## New Critical Findings

## New Important Findings

## Minor Findings

## Frozen Design Drift

## Build and Data-Flow Trace

## User Decisions Still Required

## Corrections Required Before Implementation Plan

## Corrections Required Before Later Phases

## High-Level Architecture Direction

## Final Gate

Choose exactly one final gate:

### A — TARGETED RE-REVIEW PASS

The corrections are integrated, logically closed, and ready for Implementation Plan.

### B — TARGETED PASS WITH IMPORTANT CORRECTIONS

All critical contracts are closed, but named important corrections must be applied before their specified phases.

### C — MATERIAL ARCHITECTURE REVISION STILL REQUIRED

One or more critical contracts remain open, were not actually integrated, or the corrections introduced new critical defects. Do not begin Implementation Plan.

### D — HIGH-LEVEL ARCHITECTURE DIRECTION REJECTED

Use only if Astro/static/file-first/local-image-pipeline/Nginx is itself fundamentally unsuitable.

Do not output more than one gate.

## Final review discipline

The goal is not to reward effort or document volume.

The goal is to determine whether implementation can follow one coherent, persistent, testable architecture without silently choosing among contradictory documents.

If the corrections are only proposals and canonical files still contradict them, say so plainly.

If a proposed fix introduces a new product behavior, framework error, state duplication, or failure mode, treat that as a regression rather than a completed correction.
