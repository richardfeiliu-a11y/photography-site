# 0828｜研究｜架构重写简报存档

**Status:** AUTHORITATIVE REWRITE INSTRUCTION (user-issued, 2026-08-28)
**Purpose:** Preserved verbatim as audit evidence of the instruction set and the 11 adopted user decisions (UD-001–UD-011) that produced the rewritten canonical architecture in `research/production-architecture/`. This file is an instruction/audit artifact, not an implementation authority.

---

# Canonical Production Architecture Rewrite
## Quiet Editorial Archive — Consolidate, Replace, Freeze

You are performing a CANONICAL ARCHITECTURE REWRITE.

This is NOT:

- another architecture exploration;
- another red-team pass;
- another correction proposal;
- another PREVIOUS_CORRECTIONS layer;
- an implementation task;
- an implementation plan;
- a framework re-selection exercise.

The high-level production direction remains valid:

> Astro static generation
> + file-first YAML
> + deterministic local image pipeline
> + minimal progressive-enhancement JS
> + static deployment to self-hosted Nginx

Your job is:

> Replace the internally inconsistent production architecture with one coherent canonical version.

The rewritten `research/production-architecture/` must become the ONLY engineering authority for the next phase.

---

# 1. Current gate state

Latest independent targeted re-review:

> FINAL GATE C — MATERIAL ARCHITECTURE REVISION STILL REQUIRED

Primary review report:

<repo>/research/production-architecture-red-team/TARGETED_INDEPENDENT_ARCHITECTURE_RE_REVIEW.md

The review found that the repository currently contains three competing architecture authority layers:

1. original canonical architecture;
2. independent red-team findings;
3. PREVIOUS_CORRECTIONS proposals.

This must end now.

After this task:

> Production developers should not need to choose among competing architecture sources.

---

# 2. Highest authorities

Use this precedence:

1. `research/FINAL_DESIGN_SPECIFICATION.md`
2. explicit user architecture decisions in this prompt
3. `TARGETED_INDEPENDENT_ARCHITECTURE_RE_REVIEW.md`
4. original independent architecture red-team report
5. existing canonical production architecture
6. PREVIOUS_CORRECTIONS only as historical proposal/evidence

If a PREVIOUS_CORRECTIONS proposal conflicts with this prompt or targeted re-review:

> DO NOT preserve it.

Do not trust correction-summary claims such as COMPLETE unless the canonical files themselves actually contain the accepted correction.

---

# 3. Read before modifying

Mandatory:

<repo>/research/FINAL_DESIGN_SPECIFICATION.md

<repo>/research/production-architecture-red-team/TARGETED_INDEPENDENT_ARCHITECTURE_RE_REVIEW.md

<repo>/research/production-architecture-red-team/INDEPENDENT_ARCHITECTURE_RED_TEAM.md

Then inspect every canonical architecture file under:

<repo>/research/production-architecture/

including:

README.md
ARCHITECTURE_OVERVIEW.md
ARCHITECTURE_DECISIONS.md
CONTENT_MODEL.md
IMAGE_PIPELINE.md
BUILD_AND_ROUTING.md
RUNTIME_AND_PROGRESSIVE_ENHANCEMENT.md
PERFORMANCE_BUDGET.md
TESTING_AND_VISUAL_REGRESSION.md
DEPLOYMENT_ARCHITECTURE.md
REPOSITORY_STRUCTURE.md
RISK_REGISTER.md
IMPLEMENTATION_PHASES.md
OPEN_QUESTIONS.md
PRODUCTION_ARCHITECTURE_SUMMARY.md
ARCHITECTURE_REVIEW_PACKET.md

Read PREVIOUS_CORRECTIONS only to understand historical attempts.

Do NOT use it as active authority.

---

# 4. No implementation code

Do not create or modify:

src/
scripts/
content/
media/
generated/
dist/
deployment scripts
Astro app code

Do not install packages.

Do not scaffold Astro.

Do not create executable production code.

Architecture examples may be:

- schema examples;
- pseudocode;
- config shape examples.

Any non-executed example must be labeled:

> PSEUDOCODE / CONTRACT EXAMPLE

Do not claim:

> tested
> verified
> working

unless executable repository evidence actually exists.

---

# 5. Frozen product remains untouched

The design authority remains:

`research/FINAL_DESIGN_SPECIFICATION.md`

Do not alter:

- IA;
- canonical routes;
- G1–G7;
- Gallery sequence behavior;
- Overview behavior;
- captions;
- continuation;
- typography;
- color;
- no dark mode;
- no Search;
- no Map;
- no Visit;
- no tags;
- no slideshow;
- no swipe-first Gallery.

Architecture must serve the frozen product.

---

# 6. Explicit user decisions — now ADOPTED

The following 11 decisions are now authoritative.

Do not reopen them in this task.

---

## UD-001 — Photo identity representation

DO NOT use a separate global photo identity registry as the primary source of truth.

Photo identity and source binding live persistently in Gallery authored YAML.

Example canonical shape:

```yaml
photos:
  - id: p_reine_001
    source_ref: lofoten-light/DSC02762.jpg
    caption: null
    rhythm_after: base

  - id: p_reine_002
    source_ref: lofoten-light/DSC02367.jpg
    caption: "The ferry leaves at first light."
    rhythm_after: compact
```

Rules:
- photo.id is authored and persistent.
- source_ref is authored and persistent.
- filename/path changes may update source_ref without changing photo.id.
- dimensions, orientation, aspect ratio, EXIF, ICC, hashes and derivatives are generated/derived.
- generated state must never be the only place where stable photo identity exists.
- no duplicate source_file/location fields describing the same binding.
- one Photo belongs to one Gallery in MVP.
Remove generated/photo-identities.json as identity authority.
If a generated photo index is useful, it may exist only as a derived view.

## UD-002 — Corrected master identity semantics

Photo identity is editorial identity, not file-byte identity.

A corrected/re-exported master RETAINS the same Photo ID when it is still the same authored photograph, including:
- filename change;
- path move;
- JPEG re-export;
- compression change;
- ICC correction;
- metadata cleanup;
- higher-quality export;
- technical color/exposure correction;
- dust cleanup.

Create a NEW Photo ID when it becomes a distinct authored photograph, for example:
- different capture/frame;
- materially different editorial crop intended as a separate work;
- composite;
- substantial content alteration;
- both versions intentionally coexist as separate Photos.

SHA-256 is integrity/revision metadata, NOT Photo identity.

## UD-003 — Publication-time migration

photographed_* and published_at are different concepts.

NEVER derive published_at from:
- EXIF capture time;
- photographed date;
- file mtime;
- Git timestamp;
- folder name.

Policy:
- if historical publication time is genuinely known, author may enter it;
- otherwise migrated historical Gallery uses an honest archive-import/site-publication timestamp;
- unknown history remains unknown rather than being fabricated.

Latest/Recent ordering uses publication/addition semantics, NOT photographed time.

## UD-004 — Featured state

Do NOT store a featured: true/false field independently in every Gallery.

Use one Home editorial settings file:

```yaml
# content/site/home.yaml
featured_gallery_id: g_lofoten_light
```

or:

```yaml
featured_gallery_id: null
```

Behavior:
- if valid published featured Gallery exists → use it;
- otherwise fallback to latest published Gallery by published_at;
- deterministic tie-break by stable Gallery ID.

No:
- This Week;
- is_curated;
- Secondary Feature;
- rotation system;
- scheduled weekly semantics.

Recent Galleries remain valid because they are part of frozen Home.

## UD-005 — Media ownership

Do NOT make the long-term photographic asset store a Git/Git-LFS requirement.

Architecture:
Git tracks
- source code;
- authored YAML metadata;
- site settings;
- redirects;
- tests;
- architecture docs.

Media filesystem/storage tracks
- WEB INGEST MASTERS.

External archival storage
- CAMERA ORIGINALS / archival masters when retained.

Do not assume Git/LFS is the photography archive.
Git LFS may be discussed only as an optional later transport choice, not canonical baseline.

## UD-006 — Backup RPO/RTO

Adopt baseline personal-site recovery targets:

RPO ≤ 24 hours
RTO ≤ 24 hours

Must-have backup principle:

VPS is never the only copy of authored metadata or ingest masters.

Back up:
- authored content;
- Home settings;
- redirects;
- WEB INGEST MASTERS;
- any other non-regenerable persistent state.

Do NOT need durable backup for:
- dist;
- generated manifest;
- derivatives;
- caches.

Use an encrypted off-site backup architecture.
Specific provider/tool may remain implementation/deployment choice.

## UD-007 — next_gallery cycle policy

Cycles are allowed.

Validation rules:
- target Gallery exists;
- target is published for production output;
- target != self;
- dangling target forbidden.

Do NOT require graph acyclicity.

Do NOT implement cycle-detection complexity merely to reject:

A → B → C → A

That is an allowed authored continuation structure.

## UD-008 — Slug authority

Gallery YAML is the ONLY authority for current Gallery slug.

Canonical pattern:

```yaml
id: g_lofoten_light
slug: lofoten-light
```

Where:
- id = stable internal identity;
- slug = current public route component.

Historical aliases belong only in:

content/redirects.yaml

Example:

```yaml
/galleries/old-lofoten:
  gallery_id: g_lofoten_light
```

Build resolves redirect target from current Gallery slug.

Do NOT create a second current-slug registry.

## UD-009 — Draft authority

Use exactly one publication-state mechanism:

```yaml
status: draft
```

or:

```yaml
status: published
```

Do NOT combine this with:
- _draft-*;
- drafts/;
- published/;
- directory partition semantics.

Production:
- only published Galleries generate public routes;
- only published Galleries enter Archive/Places/Home/sitemap;
- next_gallery in production must resolve to published target.

Local preview may include draft content.

## UD-010 — Cover policy

Published Gallery requires explicit:

```yaml
cover_photo_id: p_reine_001
```

Validation:
- required for published Gallery;
- must reference a Photo inside that same Gallery;
- draft Gallery may temporarily omit it.

Do NOT default published cover silently to first Photo.

Reason:
Reordering/inserting sequence Photos must not accidentally change Archive/Home/Place cover.

## UD-011 — prev_gallery

Do NOT author prev_gallery.

The frozen product does not require Previous Gallery at continuation.

Canonical authored relationship:

```yaml
next_gallery_id?
```

No authored prev field.

If reverse relationships are useful internally, derive them at build time.

Do not render Previous Gallery unless Final Design Spec explicitly requires it.

# 7. Canonical authored data model

Rewrite CONTENT_MODEL around these owners.

At minimum define:

Gallery
- id
- slug
- status
- title
- optional description
- photographed_start
- photographed_end
- published_at
- places[]
- cover_photo_id
- next_gallery_id?
- photos[]

next_gallery_id references stable Gallery ID, not slug.

Photo sequence record

Each Photo item contains at least:
- id
- source_ref
- caption?
- rhythm_after?
- alt_text?   # schema support only; policy may remain later-phase

Allowed rhythm_after:
- base
- compact
- breathing

No spacious.

No array-index-bound metadata maps as the canonical form.

Photo ordering = order of photos[].

Place

At minimum:
- id
- slug
- name
- region?
- country?

No Visit.
No Trip.

Home settings

At minimum:
- featured_gallery_id?

No unrelated editorial scheduler.

Redirects

Historical route aliases only.

Do not duplicate current slug.

# 8. Source-of-truth matrix — mandatory

Create a canonical matrix and use it consistently across all docs.

Required concepts:

| Concept | Canonical Owner |
|---|---|
| Gallery ID | Gallery YAML |
| Current Gallery slug | Gallery YAML |
| Gallery status | Gallery YAML |
| Photographed dates | Gallery YAML |
| Published time | Gallery YAML |
| Photo ID | Gallery YAML photo item |
| Photo → source_ref | Gallery YAML photo item |
| Photo sequence | photos[] order |
| Caption | Photo item |
| Rhythm | Photo item |
| Cover | Gallery YAML |
| next_gallery | Gallery YAML by Gallery ID |
| Place current slug | Place YAML |
| Featured Gallery | Home settings |
| Old URLs | redirects.yaml |
| Dimensions | generated |
| Orientation | generated |
| EXIF | generated/read |
| ICC metadata | generated/read |
| Source hash | generated |
| Derivative URLs | generated manifest |
| srcset | generated manifest/build-derived |
| HTML | generated |
| dist | generated |

Exactly one owner per persistent concept.

# 9. Media terminology — canonicalize

Use these terms precisely:

CAMERA ORIGINAL
Camera RAW/JPEG source captured by camera.
May live outside the production website repository/storage.
Not necessarily directly ingestible.

ARCHIVAL MASTER
Long-term preservation master.
May equal camera original or edited master depending on photographer workflow.
Outside public site output.

WEB INGEST MASTER
The non-regenerable image input used by the website image pipeline.
Example:
high-quality JPEG exported from archival workflow.
This is the production pipeline source.
Must be backed up.

WEB DERIVATIVE
Regenerable responsive JPEG/WebP/etc output.
Never source-of-truth.
Never manually edited.

Do not call WEB INGEST MASTER generated/ephemeral.

# 10. Media root

Choose one canonical architectural media root for WEB INGEST MASTERS.

For example:

media/ingest-masters/

Use the same path across all canonical documents.

Do NOT alternate among:
- media/originals/
- media/archival/
- content/galleries/photos/
- media/ingest/
- assets-staging/

unless those paths have clearly distinct purposes.

source_ref is repository/project-relative to the approved WEB INGEST MASTER root.

Example:

source_ref: lofoten-light/DSC02762.jpg

The exact absolute server path belongs to environment configuration, not authored Gallery YAML.

# 11. Build DAG — canonical rewrite

Replace all conflicting producer/consumer sequences.

Required architectural invariant:

```text
AUTHORED PERSISTENT STATE
  Gallery YAML
  Place YAML
  Home settings
  redirects
  WEB INGEST MASTERS
        ↓
REFERENCE + SOURCE VALIDATION
        ↓
IMAGE ANALYSIS / DERIVATION
        ↓
GENERATED ASSET MANIFEST
with FINAL PUBLIC URL paths
        ↓
ASTRO BUILD
consumes manifest at BUILD TIME
        ↓
ISOLATED FINAL RELEASE ASSEMBLY
Astro output + web derivatives
        ↓
INTEGRITY GATE
        ↓
UPLOAD CANDIDATE RELEASE
        ↓
PRE-SWITCH VERIFY
        ↓
ATOMIC POINTER SWITCH
        ↓
POST-SWITCH SMOKE
        ↓
ROLLBACK EXACT PREVIOUS TARGET ON FAILURE
```

Astro must never need a manifest that does not yet exist.

Do NOT describe the browser as consuming the asset manifest at runtime unless that is actually required.

The preferred architecture is:

Astro consumes the manifest during build.

# 12. Dist ownership

Avoid image pipeline writing into a directory that Astro may wipe.

Use conceptual separation:

generated/media/
generated/asset-manifest.json
Astro output staging/
final release assembly/

Exact implementation directory names may remain implementation detail.

Architectural invariant:

image derivation does not depend on mutating Astro's final build directory before Astro build.

Final assembly is isolated and complete before deployment.

# 13. Asset manifest contract

Define the manifest as generated data.

Each Photo may resolve derivatives containing:

photo_id
purpose
format
width
height
public_url
bytes
source_hash
derivative_hash

As appropriate.

For Gallery display include enough data for:
- src;
- srcset;
- sizes logic;
- intrinsic dimensions;
- Overview derivative;
- cover derivative.

Do not compute srcset by regex-replacing digits in filenames.

Manifest paths must already be final public paths.

# 14. Asset hashing

Do NOT freeze a six-hex-character digest.

Use a robust content-addressed or fingerprint strategy.

Architecture should specify:

sufficiently collision-resistant truncated cryptographic digest or full build-managed asset fingerprint.

Exact character length may be implementation benchmark/decision if not needed now.

No undefined finalName/finalFilename examples.

# 15. Determinism semantics

Define two levels.

Semantic determinism — REQUIRED

Same:
- source bytes;
- authored metadata;
- toolchain versions;
- pipeline configuration;

must produce the same logical derivative set and manifest references.

Byte-for-byte determinism

Only claim if toolchain/version/environment tests actually prove it.

Do NOT state SHA-256-identical output across arbitrary Sharp/libvips versions or machine environments.

Pin toolchain versions during implementation.

# 16. Image pipeline order

Canonical conceptual order:

read/decode
→ read orientation + ICC + required metadata
→ normalize orientation
→ color transform to target web color space
→ resize/encode derivatives
→ remove privacy-sensitive metadata from public files
→ optionally embed approved standard output ICC if benchmark selects it
→ hash/output

Do not strip metadata needed for color conversion before conversion.

# 17. ICC policy

Architecture baseline:
- if valid source ICC exists → respect and convert to sRGB;
- if no ICC profile exists → treat as explicit policy/limitation, not as proven truth;
- default no-profile policy may assume sRGB for MVP only if clearly documented;
- future implementation may support explicit override/fail policy.

Do not use camera-model guessing.

Do not claim invalid Sharp APIs.

Keep API examples contract-level unless verified.

# 18. Privacy

Public derivatives must not expose:
- GPS;
- camera/device serial identifiers;
- unnecessary private metadata.

Do not retain camera/lens/date metadata in public derivatives without a product requirement.

Internal extracted metadata may exist only when necessary.

Source masters remain untouched.

# 19. Astro content architecture

Use CURRENT Astro Content Layer concepts.

Canonical architecture:

src/content.config.ts
defineCollection(...)
glob loader
base: authored external content root

Do NOT use invented:
- astro.config.mjs collections.folder
- getEntryData

Architecture should state that authored source remains:

content/galleries/

and Astro loads it directly through the supported Content Layer loader.

Do NOT create an src/content/galleries copy/mirror.

One authored source only.

# 20. Content validation

Published build must fail closed for:
- missing WEB INGEST MASTER;
- duplicate Gallery ID;
- duplicate Gallery slug;
- duplicate Photo ID globally if IDs are required global;
- duplicate Place ID/slug;
- Photo source_ref missing;
- cover missing/invalid;
- Place reference missing;
- next_gallery target missing;
- next_gallery self-loop;
- next_gallery target draft in production;
- invalid status;
- missing published_at for published Gallery;
- invalid redirects;
- redirect target missing;
- canonical route collisions;
- derivative coverage incomplete.

Warnings may exist for drafts/local preview only where explicitly defined.

Do not silently skip broken published content.

# 21. Global uniqueness policy

Choose and document a simple rule:

Gallery IDs globally unique.
Photo IDs globally unique across the archive.
Place IDs globally unique.
Slugs unique in their route namespace.

This makes generated indexes and references unambiguous.

# 22. Home state

Canonical behavior:

```text
featured_gallery_id configured and points to published Gallery
    → Featured Gallery

otherwise
    → latest published Gallery by published_at DESC
       tie-break stable Gallery ID
```

Recent Galleries:
- remain part of Frozen Design;
- define deterministic order;
- exclude current hero if Final Design behavior requires avoiding duplication only if supported by frozen spec;
- do not invent weekly/curated states;
- do not filter by arbitrary minimum Photo count unless frozen design says so.

If exact recent count is not frozen:

do not invent a permanent product rule.

Treat count as implementation/presentation choice consistent with Final Design Spec.

# 23. Publication lifecycle

Rewrite draft/published behavior clearly.

draft
- may preview locally;
- not public production route;
- not sitemap;
- not Archive/Places/Home discovery;
- may temporarily lack cover/published_at depending validation mode.

published

Requires:
- cover_photo_id;
- published_at;
- valid Places;
- all Photo sources;
- complete derivatives;
- valid canonical route.

Production build includes only published Galleries.

# 24. Redirect lifecycle

Long-term archive requires redirect support.

content/redirects.yaml stores historical paths only.

At build/deployment:
- validate old path != current path;
- target Gallery exists;
- no redirect loop;
- output static redirect strategy compatible with self-hosted Nginx.

Do not invent another slug authority.

Do not use unrelated domain names.

# 25. next_gallery semantics

Canonical:

next_gallery_id?: GalleryID

Validation:
- target exists;
- target published in production;
- not self.

Cycles allowed.

No graph acyclicity test.

No impossible branching for a singular field.

No authored prev_gallery.

# 26. Frozen runtime compliance

Rewrite Runtime docs to remove design drift.

Explicitly preserve:
- captions visible whenever authored;
- no empty reserved caption block;
- no caption line clamp;
- no hover-only caption;
- no generic styled button for continuation;
- continuation remains frozen editorial text structure;
- /galleries/{slug};
- mobile native vertical sequence;
- Overview contained/uncropped;
- persistent position annotation only as frozen;
- no full-screen app chrome.

# 27. No-JS navigation

Core site navigation must remain usable if JS fails.

Do not rely on an inaccessible:

display:none checkbox

while claiming keyboard accessibility.

Architecture requirement:
- desktop navigation is native links;
- mobile navigation enhancement must have an accessible fallback;
- exact implementation may use progressive enhancement, but core page navigation cannot become inaccessible without JS.

Do not prescribe fragile CSS hacks as architecture law.

# 28. Alt architecture

Schema should support:

alt_text?

Do NOT:
- use filename fallback;
- automatically equate caption with alt.

Policy may remain later-phase editorial decision.

Architecture must not require schema migration later.

Published enforcement policy can be resolved before accessibility hardening if still open.

# 29. CJK fonts

Frozen families:

Source Serif 4
Source Sans 3
Noto Serif SC
Noto Sans SC

Do not introduce:
- FreeBuffCJK
- generic Noto Sans CJK
- other families.

Architecture should define a sustainable strategy.

Options may include:
- broad static CJK subset covering expected charset;
- build-derived subset with safe fallback.

Do not freeze an invalid fontTools command.

Do not preload all CJK font payloads blindly.

Exact subsetting implementation remains implementation benchmark.

# 30. Performance budgets

Reclassify hard unmeasured byte values appropriately.

Separate:

STANDARD WEB TARGET
PROJECT ENGINEERING BUDGET
BENCHMARK REQUIRED
MEASURED BASELINE

Keep:

Core Web Vitals targets where standards-based.

But image byte sizes/JS/CSS budgets that have not been measured must not be presented as proven values.

Image quality must not be sacrificed to arbitrary byte limits.

# 31. JavaScript strategy

Keep:
- minimal JS;
- progressive enhancement;
- native Gallery document flow;
- no virtualization baseline.

Do NOT require manual Vite chunk splitting unless implementation measurement shows value.

Default bundling is acceptable baseline.

≤20KB gzipped may be an aspirational engineering budget, not an immutable design contract.

# 32. Long Gallery

Validated reference remains ~72 Photos.

Architecture supports larger Galleries reasonably.

No 1000-Photo single-Gallery requirement unless explicitly future-assumed.

Baseline:
- full semantic HTML;
- native lazy image loading;
- browser-native document flow;
- targeted observers only.

Virtualization only if real production measurements prove necessary.

# 33. Deployment architecture

Rewrite atomic deployment correctly.

Required flow:

```text
build complete release candidate
↓
upload to NEW unique release directory
↓
verify candidate filesystem contents
↓
pre-switch candidate HTTP/file smoke if practical
↓
capture exact current symlink target
↓
atomically switch current → candidate
↓
post-switch HTTP smoke
↓
if failure:
    restore exact captured previous target
```

Do NOT create previous after switching by pointing it to current.

If a previous symlink exists:

it must point to the exact old release target captured BEFORE switch.

An explicit previous symlink is optional if rollback records the old target directly.

# 34. Nginx reload

Do not claim reload is required solely because a symlink target changed.

Architecture may state:
- content release switch should not require Nginx config reload;
- reload only when Nginx configuration changes.

Verify at implementation stage.

# 35. Candidate release integrity

Before switch, verify at least:
- index exists;
- canonical route output exists;
- asset manifest closure;
- every referenced derivative exists;
- no source masters in public root;
- no draft routes;
- no GPS leakage in sampled/automated derivative checks;
- static 404 behavior.

Post-switch smoke checks actual public/current target.

# 36. Cache policy

Do NOT apply one-year immutable cache to HTML.

Canonical policy:

Hashed immutable assets
Long cache, immutable.

HTML
Short/no-cache/revalidate policy appropriate for static content updates.

Redirect/404
Appropriate non-immutable policy.

Exact max-age values may remain deployment implementation choice.

# 37. Static 404

Do not use SPA fallback:

try_files ... /index.html

for missing routes.

Use real static 404 behavior.

Frozen site is not an SPA.

# 38. Backup architecture

Write a real recovery section.

Non-regenerable:
- Git repository / remote;
- authored YAML/settings/redirects;
- WEB INGEST MASTERS.

Regenerable:
- generated manifest;
- derivatives;
- dist;
- caches.

Architecture target:

RPO ≤24h
RTO ≤24h

Off-site encrypted backup required for non-regenerable media/content.

Atomic releases are rollback, NOT backup.

# 39. Recovery scenarios

Canonical architecture must describe recovery at a high level for:
- VPS disk failure;
- accidental ingest-master deletion;
- corrupted authored YAML;
- bad deployment;
- derivative corruption;
- generated/ deletion;
- dist deletion.

No need for production commands yet.

# 40. Repository structure

Rewrite one canonical tree.

Example conceptual structure:

```text
photography/
├── src/
│   ├── components/
│   ├── layouts/
│   ├── pages/
│   ├── styles/
│   └── content.config.ts
│
├── content/
│   ├── galleries/
│   │   └── {gallery}/meta.yaml
│   ├── places/
│   ├── site/
│   │   └── home.yaml
│   └── redirects.yaml
│
├── media/
│   └── ingest-masters/
│       └── {gallery}/...
│
├── generated/
│   └── asset-manifest.json
│
├── tests/
├── public/
├── research/
└── ...
```

No src/content/galleries mirror.

No persistent generated identity registry.

# 41. WEB INGEST MASTER filesystem location

Architecture may keep media/ingest-masters/ logically inside project root while clarifying that production deployments/build hosts may mount or symlink an external server-backed filesystem at that path.

Do not encode absolute /Volumes/... paths into authored content.

source_ref remains relative.

# 42. Tool/API examples

The red team found invalid examples involving:
- Astro Content API;
- Sharp profile/metadata API;
- Zod computed();
- sharp CLI;
- fontTools examples.

Therefore:

Prefer CONTRACT LANGUAGE over code snippets.

If including a code/config example:
- verify it against current official docs;
- otherwise label it PSEUDOCODE;
- do not claim tested.

Do not create executable-looking fake APIs.

# 43. Testing architecture

Correct conceptual testing semantics.

Categories:
- content/schema validation;
- source/manifest closure;
- interaction;
- accessibility;
- visual regression;
- deployment smoke;
- backup restore drill.

Do not freeze misleading selector/assertion pseudocode.

For Overview:
- hidden element may remain attached;
- test visibility/state, not necessarily DOM detachment;
- focus restoration must be tested;
- focus trap semantics must be tested.

# 44. Visual regression

Separate:

Screenshot capture determinism

Same controlled environment should yield stable screenshots as reasonably possible.

Visual equivalence

Use image diff/review thresholds.

Do NOT require SHA-256-identical PNG bytes across arbitrary:
- browser versions;
- OS;
- font rasterizers;
- machines.

SHA may be used to verify unchanged files inside one controlled baseline workflow, not as universal visual-equivalence proof.

# 45. Architecture ADR rewrite

Rewrite ADRs so statuses match actual canonical decisions.

Remove:
- ADOUGHTED typo;
- 2006 date typo;
- obsolete generated identity ADR;
- obsolete cycle rejection;
- Git/LFS-as-baseline originals decision.

Add/revise ADRs for:
- Photo identity in Gallery YAML;
- media ownership outside Git baseline;
- Home settings file;
- status-based draft model;
- explicit published cover;
- redirects historical-only;
- cycle-allowed next_gallery;
- no authored prev_gallery;
- RPO/RTO backup target;
- corrected build DAG.

Use consistent IDs.

You may renumber ADRs if necessary, but provide migration mapping if renumbering.

# 46. Open questions cleanup

After this rewrite, remove from OPEN_QUESTIONS any item explicitly decided by user.

The following are CLOSED:
- Photo identity representation;
- corrected-master identity;
- publication migration;
- featured storage;
- media ownership baseline;
- RPO/RTO;
- next cycle policy;
- slug authority;
- draft authority;
- cover policy;
- prev_gallery.

Remaining items may include:
- exact responsive image widths;
- encoder/quality;
- ICC no-profile enforcement;
- alt publication enforcement;
- exact CJK subsetting implementation;
- backup provider/tool;
- analytics if still genuinely open.

Do not keep resolved decisions labeled OPEN.

# 47. Implementation phases rewrite

Reorder phases based on corrected dependencies.

Preferred architecture-level order:

P1 Foundation + canonical config/test harness
P2 Content model + validation + authoring contract
P3 Media/image pipeline + engineering benchmarks
P4 Discovery pages
P5 Gallery core
P6 Overview/interactions
P7 Accessibility/SEO/performance
P8 Visual regression/hardening
P9 Deployment + recovery verification
P10 Final production acceptance

But improve ordering if necessary.

Important:
- visual regression infrastructure should be initialized early enough to prevent drift;
- deployment architecture can be tested before final launch without deploying production;
- image benchmark dependencies should begin before P3 completion.

Do not write sprint-week estimates as hard commitments.

# 48. Risk register rewrite

Remove mitigations that contradict canonical architecture.

Add/update risks for:
- source_ref drift;
- ingest-master loss;
- unknown historical published_at;
- incomplete derivative coverage;
- stale redirect;
- draft leakage;
- CJK subset missing glyph;
- backup failure;
- high-DPR image quality;
- manifest/assembly mismatch;
- incorrect cache headers.

Risk mitigation must point to actual canonical controls.

# 49. Authority cleanup

After rewrite:

research/production-architecture/

is canonical engineering authority.

PREVIOUS_CORRECTIONS becomes:

SUPERSEDED HISTORICAL PROPOSALS — DO NOT IMPLEMENT DIRECTLY

Do not delete PREVIOUS_CORRECTIONS.

Add a clear README inside that folder or equivalent marker if appropriate.

Targeted red-team reports remain audit evidence, not implementation authority.

# 50. Correction traceability

Create:

CANONICAL_REWRITE_TRACEABILITY.md

Include:

| Finding/Decision | Old problem | Canonical resolution | Files changed | Status |

At minimum map:

RT-001–RT-018
H6
TRR-001–TRR-004
TRR-I01–I09
UD-001–UD-011

Status:

RESOLVED
DEFERRED TO PHASE
NOT APPLICABLE

No vague "handled".

# 51. Rewrite, do not append

Do not leave contradictory old sections followed by:

Correction:

Replace the incorrect canonical text.

The finished document should read as if the bad architecture was never canonical.

History belongs in:
- Git diff;
- traceability doc;
- red-team reports;
- PREVIOUS_CORRECTIONS.

Not inside active implementation sections.

# 52. Remove product contamination

Search the entire canonical architecture for:

FreeBuff
freebuff.app
FreeBuffCJK
This Week
is_curated
secondary feature
spacious
/archive/galleries
root-level Gallery slug route

All positive/product occurrences must be removed.

Historical traceability may mention them as rejected contamination.

# 53. Frozen contract consistency search

Search canonical architecture for:

hover reveal
styled button
line clamp
caption min-height
square crop
2-column fallback
inline position fallback
dark mode
Visit
Map
Search
carousel
slideshow
swipe-first

Each hit must be:
- prohibition;
- historical traceability;
- legitimate discussion consistent with Final Design Spec.

No active drift.

# 54. Current API verification

For framework/tool claims that materially affect architecture, verify against current official documentation.

At minimum:

Astro current stable Content Collections / Content Layer configuration.

If referencing Sharp behavior:

use current official Sharp documentation.

Do not over-research.

Document external verification succinctly in:

TECHNICAL_API_VERIFICATION.md

Only include facts necessary to prevent fictional API contracts.

# 55. Canonical documents after rewrite

Maintain the existing canonical set where useful:

README.md
ARCHITECTURE_OVERVIEW.md
ARCHITECTURE_DECISIONS.md
CONTENT_MODEL.md
IMAGE_PIPELINE.md
BUILD_AND_ROUTING.md
RUNTIME_AND_PROGRESSIVE_ENHANCEMENT.md
PERFORMANCE_BUDGET.md
TESTING_AND_VISUAL_REGRESSION.md
DEPLOYMENT_ARCHITECTURE.md
REPOSITORY_STRUCTURE.md
RISK_REGISTER.md
IMPLEMENTATION_PHASES.md
OPEN_QUESTIONS.md
PRODUCTION_ARCHITECTURE_SUMMARY.md
ARCHITECTURE_REVIEW_PACKET.md

Add:

CANONICAL_REWRITE_TRACEABILITY.md
SOURCE_OF_TRUTH_MATRIX.md
TECHNICAL_API_VERIFICATION.md
BACKUP_AND_RECOVERY.md

Do not create dozens of new overlapping docs.

# 56. SOURCE_OF_TRUTH_MATRIX.md

This is mandatory.

It must make implementation ambiguity impossible.

Include:

Persistent authored state
Generated state
External non-regenerable state
Build output

For every concept:

Owner
Location
Git?
Backup?
Can regenerate?
Validation

# 57. BACKUP_AND_RECOVERY.md

Define:
- RPO/RTO;
- what is non-regenerable;
- what gets off-site backup;
- what is regenerable;
- restore sequence;
- backup verification;
- restore drill expectation.

Do not choose a paid provider unless user already did.

Architecture may say:

encrypted off-site object storage or independent host.

# 58. ARCHITECTURE_REVIEW_PACKET rewrite

Update it to summarize ONLY the rewritten canonical architecture.

Do not make reviewer inspect PREVIOUS_CORRECTIONS.

Reviewer reading order:

1. FINAL_DESIGN_SPECIFICATION
2. ARCHITECTURE_REVIEW_PACKET
3. SOURCE_OF_TRUTH_MATRIX
4. CONTENT_MODEL
5. IMAGE_PIPELINE
6. BUILD_AND_ROUTING
7. DEPLOYMENT/BACKUP
8. ADRs/open questions

Include exact targeted re-review criteria.

# 59. Completion audit

Before claiming rewrite complete, run a mechanical/internal consistency audit.

At minimum verify:

Identity
No generated identity authority remains.

Content
One authored Gallery source.

Slug
One current slug authority.

Draft
Only status model.

Featured
Only Home settings.

Cover
Explicit for published.

next
ID-based, dangling/self validation, cycles allowed.

prev
Not authored.

Build DAG
Manifest exists before Astro consumes it.

Media
One WEB INGEST MASTER root.

Git
Masters not required in Git/LFS.

Backup
RPO/RTO represented.

Runtime
No caption/continuation design drift.

Fonts
Exact frozen families.

Routes
/galleries/{slug}.

Cache
HTML not immutable-long-term.

Deployment
Previous target captured before switch.

API
No fictional current API presented as executable.

# 60. Mechanical searches

Search all canonical architecture files for stale terms:

generated/photo-identities
src/content/galleries
ADOUGHTED
2006-08-28
FreeBuff
This Week
is_curated
spacious
z.string().url()  # if used for source_ref
computed()
profile()
sharp CLI
/archive/galleries
caption hover
styled button
one-year immutable HTML
SPA fallback
cycle detection

Every hit must be reviewed.

Some may appear in traceability as rejected history.

They must not appear as active architecture.

# 61. No premature implementation

Even after successful rewrite:

DO NOT begin:
- Astro project setup;
- P1 implementation;
- image benchmark code;
- deployment script;
- Implementation Plan.

The next step is:

Focused Independent Re-Review of rewritten canonical architecture.

# 62. Canonical rewrite final gate

Choose exactly one:

A
CANONICAL ARCHITECTURE REWRITE COMPLETE
Ready for Focused Independent Re-Review

B
CANONICAL ARCHITECTURE REWRITE COMPLETE WITH NON-BLOCKING DEFERRED ENGINEERING BENCHMARKS
Ready for Focused Independent Re-Review

C
CANONICAL REWRITE BLOCKED
A user decision or unresolved architecture contradiction remains

Do NOT claim:

Ready for Implementation Plan

until focused independent re-review passes.

# 63. Final response

Report only:

Canonical files rewritten
User decisions integrated
RT/TRR findings resolved
Source-of-truth result
Final build DAG
Media ownership result
Publication/featured/draft/cover/navigation lifecycle
Deployment/backup result
Technical API verification
Remaining deferred engineering benchmarks
Consistency audit result
Git status
Final gate

Success wording:

CANONICAL ARCHITECTURE REWRITE COMPLETE — Ready for Focused Independent Re-Review.
