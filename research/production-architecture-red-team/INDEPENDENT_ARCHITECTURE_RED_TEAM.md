# 0828｜研究｜生产架构红队评审

**Review date:** 2026-08-28  
**Repository:** <repo>  
**Live Git:** main @ 92f7a58c312a9117737b70e34767eb71270923fb  
**Frozen design authority:** research/FINAL_DESIGN_SPECIFICATION.md, status FREEZE  
**Architecture reviewed:** all 16 Markdown files under research/production-architecture/

---

## Executive Verdict

**Final gate: C — MATERIAL ARCHITECTURE REVISION REQUIRED.**

The high-level direction remains valid:

> Astro static generation + file-first YAML + local image pipeline + minimal progressive-enhancement JS + self-hosted Nginx.

The detailed architecture is not yet logically closed. Four CRITICAL contracts would either lose stable state, violate the frozen Home behavior, or make the documented build impossible:

1. Photo ID ↔ source original has no persistent canonical binding.
2. The image/manifest/Astro build order contradicts itself and writes into a directory Astro later clears.
3. content/galleries/ and src/content/galleries/ are unresolved competing boundaries, while the documented Astro 6+ collection example uses an API Astro 6 removed.
4. Home Latest-first/featured behavior lacks a persistent publication timestamp and lacks a featured field.

These are targeted, correctable defects. They do not justify rejecting Astro, static generation, YAML, the image subprocess, or Nginx.

**Severity count:** 4 CRITICAL, 15 IMPORTANT, 10 MINOR. “NO ISSUE” conclusions are stated in the relevant sections so that investigated strengths are not mistaken for omissions.

---

## Architecture Strengths

1. **NO ISSUE — overall product/engineering boundary.** The documents correctly treat the frozen design as WHAT and architecture as HOW. They do not reopen Search, Map, Tags, Visit, dark mode, native vertical progression, G1–G7, or the canonical route family.
2. **NO ISSUE — file-first/static direction.** A small-to-medium personal archive does not need a database or server runtime. YAML plus build-time validation is proportionate.
3. **NO ISSUE — ID-bound editorial metadata.** Captions and rhythms keyed by Photo ID rather than array index correctly survive sequence reordering.
4. **NO ISSUE — custom image subsystem as a boundary.** Color conversion, privacy stripping, responsive derivation, and manifest production justify a separate tool contract; Astro-native image handling need not be the sole architecture.
5. **NO ISSUE — native document flow first.** The long Gallery starts with semantic HTML, native lazy loading, and measurement before virtualization.
6. **NO ISSUE — uncropped image policy.** The image documents preserve aspect ratio for Gallery, cards, cover candidates, and Overview. No square crop is required by the intended derivative model.
7. **NO ISSUE — benchmark-before-freeze principle.** Width, quality, encoder, ICC embedding, and high-DPR settings are correctly marked for measurement rather than treated as universal constants.
8. **NO ISSUE — release-directory deployment direction.** Immutable release directories plus a current pointer are appropriate for a static site; the implementation semantics need repair, not replacement.

---

## Critical Findings

### RT-001 — Photo identity persistence is not logically closed

**Severity:** CRITICAL  
**Required timing:** MUST FIX BEFORE IMPLEMENTATION PLAN  
**Affected documents:** CONTENT_MODEL.md; ARCHITECTURE_OVERVIEW.md; BUILD_AND_ROUTING.md; REPOSITORY_STRUCTURE.md; ARCHITECTURE_DECISIONS.md

**Claim being challenged**

Photo ID is stable and independent of filename/path, while generated/photo-identities.json is disposable generated data that can be deleted and rebuilt from media plus content.

**Evidence**

- **SOURCE DOCUMENT FINDING:** Gallery YAML stores only Photo IDs in photos[]. It does not store the source file beside each ID.
- **SOURCE DOCUMENT FINDING:** PhotoIdentity is the only defined object containing both id and source_file/location.
- **SOURCE DOCUMENT FINDING:** generated/photo-identities.json is explicitly Git-ignored, build-owned, never manually edited, and regenerable.
- **INFERENCE:** Media filenames and folders contain no immutable identifier that can recover the binding after both a rename/move and deletion of generated state.
- **INFERENCE:** SHA-256 cannot be the sole identity rule because a legitimate re-export, ICC correction, or metadata-only change changes bytes without necessarily creating a new editorial Photo.

**Why it matters**

Photo ID is the foreign key for sequence, caption, rhythm, cover, fragment, derivatives, and one-Gallery membership. Losing the binding is equivalent to losing the primary key mapping in a ledger: the values still exist, but their row identity is gone.

**Concrete failure scenario**

DSC02762.jpg is renamed reine-ferry.jpg; generated/ is deleted; a clean build scans the new filename. Nothing proves that the new path corresponds to photo-norway-reine-001. The build either creates a new ID, fails every old reference, or guesses by order/hash and risks attaching captions to the wrong image.

**Minimum required correction**

Choose and document exactly one persistent source-of-record:

| Option | Contract | Advantages | Costs / risks |
|---|---|---|---|
| A. Authored Photo registry | Git-tracked records bind id to source_ref; Gallery sequence references IDs | Clear canonical state; renames are explicit edits; strongest recovery | One additional authored file or richer YAML |
| B. Gallery items bind ID + source | Each sequence item contains id and source_ref | Identity and sequence visible together; simple authoring | Source reference repeats membership context |
| C. Persistent identity manifest | Promote photo-identities.json to Git-tracked state; rename/move is a controlled migration | Minimal Gallery YAML change | “Generated” label must be removed; merge/conflict workflow needed |
| D. Immutable source UUID sidecar | Ingest creates a durable UUID sidecar/xattr-equivalent stored in Git | Source can move/rename | More tooling; sidecars must never be lost |

Content fingerprinting may be a recovery aid, not the canonical identity. The contract must separately define “replace corrected master but keep Photo ID” versus “new photograph/new ID.”

**Whether architectural direction changes:** NO. Static/YAML/Astro remains valid.  
**User decision required:** YES — select the persistent identity representation and corrected-master semantics.

---

### RT-002 — The documented build pipeline has an impossible dependency/order

**Severity:** CRITICAL  
**Required timing:** MUST FIX BEFORE IMPLEMENTATION PLAN  
**Affected documents:** ARCHITECTURE_OVERVIEW.md; IMAGE_PIPELINE.md; BUILD_AND_ROUTING.md; REPOSITORY_STRUCTURE.md

**Claim being challenged**

The image pipeline writes derivatives and AssetManifest, Astro consumes them, and dist/ is safely regenerable.

**Evidence**

- **SOURCE DOCUMENT FINDING:** ARCHITECTURE_OVERVIEW Step 3 says the image pipeline writes AssetManifest; Step 4 says Astro consumes it; Step 5 again says Asset Manifest Generation and calls it consumed “at runtime.”
- **SOURCE DOCUMENT FINDING:** IMAGE_PIPELINE writes derivatives directly to dist/assets/images/.
- **SOURCE DOCUMENT FINDING:** BUILD_AND_ROUTING states npm run build clears dist/ completely before Astro renders.
- **INFERENCE:** Either Astro deletes prebuilt derivatives, or the manifest is generated after the consumer needs it. Both sequences cannot be correct.
- **SOURCE DOCUMENT FINDING:** Asset data is imported into Astro modules, so consumption is build-time, not browser runtime.

**Why it matters**

This is not a stylistic discrepancy. An implementer following the documents produces a build with missing images or a missing/stale manifest.

**Concrete failure scenario**

derive-images writes 600 WebP/JPEG files to dist/assets/images/. astro build then clears dist/. HTML contains manifest URLs, but every image file has been removed.

**Minimum required correction**

Adopt one DAG and one ownership rule:

~~~text
Authored metadata + persistent Photo registry + ingest masters
                            ↓
Schema/reference/source validation
                            ↓
Metadata extraction + identity resolution
                            ↓
Image derivation to generated/derivatives/ or another staging root
                            ↓
Stable AssetManifest generation
                            ↓
Astro static build copies/references staged derivatives into a fresh dist/
                            ↓
Post-build integrity, privacy, route and size checks
                            ↓
Deploy complete release → verify → switch current pointer
~~~

dist/ must have one owner: the Astro/build assembly step. AssetManifest must exist before Astro imports it. “Runtime consumption” must be replaced with “build-time consumption.”

**Whether architectural direction changes:** NO.  
**User decision required:** NO.

---

### RT-003 — Authored content has two unresolved locations and the Astro 6+ example is invalid

**Severity:** CRITICAL  
**Required timing:** MUST FIX BEFORE IMPLEMENTATION PLAN  
**Affected documents:** REPOSITORY_STRUCTURE.md; BUILD_AND_ROUTING.md; CONTENT_MODEL.md; ADR-001; ADR-002

**Claim being challenged**

content/galleries/ is the single authored source and Astro Content Collections provide its typed loading contract.

**Evidence**

- **SOURCE DOCUMENT FINDING:** REPOSITORY_STRUCTURE declares content/galleries/ authored and Git-tracked, but also declares src/content/galleries/ as “Published galleries auto-copied? (TBD).”
- **SOURCE DOCUMENT FINDING:** BUILD_AND_ROUTING shows src/content/config.ts with defineCollection({ type: 'data', schema: ... }) and no loader.
- **EXTERNAL VERIFICATION:** Current Astro supports local YAML from anywhere via the Content Layer glob() loader and base path, so a copy is unnecessary. [Astro Content Loader API](https://docs.astro.build/en/reference/content-loader-reference/)
- **EXTERNAL VERIFICATION:** Astro 6 removed legacy type: 'content' / type: 'data' collections and requires src/content.config.ts plus a loader. [Astro v6 migration guide](https://docs.astro.build/en/guides/upgrade-to/v6/)
- **EXTERNAL VERIFICATION:** Current official documentation now includes Astro v7, which uses Vite 8. “Astro 6+” is therefore neither a concrete implementation pin nor current-major guidance. [Astro v7 migration guide](https://docs.astro.build/en/guides/upgrade-to/v7/)

**Why it matters**

A stale copied Gallery can disagree with authored YAML, draft filtering can occur in two places, and the architecture’s sample configuration will not work on its declared Astro 6 baseline.

**Concrete failure scenario**

The author edits content/galleries/reine/meta.yaml. A stale src/content/galleries/reine/meta.yaml remains from yesterday. Local validation reads the former; Astro renders the latter; review passes one representation and deploys another.

**Minimum required correction**

- Keep content/galleries/ as the only authored Gallery source.
- Use a Content Layer glob loader with base pointing directly to content/galleries/ and a concrete src/content.config.ts schema.
- Remove src/content/galleries/ entirely from the baseline architecture; if any generated transform is retained, place it under generated/, never Git-track it, and verify it against source hashes.
- At implementation start, select and lock one supported Astro exact version and Node engine. Given the live official docs, ADR-001 should say “current supported stable major, exact version pinned in package-lock/package.json,” not “6+.”

**Whether architectural direction changes:** NO.  
**User decision required:** NO.

---

### RT-004 — Home Latest-first/featured cannot be reproduced from the content model

**Severity:** CRITICAL  
**Required timing:** MUST FIX BEFORE IMPLEMENTATION PLAN  
**Affected documents:** CONTENT_MODEL.md; BUILD_AND_ROUTING.md; PRODUCTION_ARCHITECTURE_SUMMARY.md; OPEN_QUESTIONS.md

**Claim being challenged**

Home can select one featured published Gallery, otherwise the latest Gallery by added/published timestamp.

**Evidence**

- **SOURCE DOCUMENT FINDING:** The Gallery schema contains no featured field.
- **SOURCE DOCUMENT FINDING:** published_at is optional and “auto-generated by build if omitted.”
- **SOURCE DOCUMENT FINDING:** The Home route says hero is based on latest published Gallery.
- **INFERENCE:** A build timestamp is not publication history. A clean rebuild assigns “now” to old content, makes ordering depend on file traversal/build behavior, and cannot reconstruct when a Gallery first entered the archive.
- **FROZEN DESIGN FINDING:** Photographed date and archive chronology are separate from the Home Latest-first editorial rule; photographed_start cannot substitute for added/published time.

**Why it matters**

The frozen Home behavior is a product contract. Without durable published_at and featured state, repeated builds can select a different hero without any authored editorial change.

**Concrete failure scenario**

Three old Galleries omit published_at. A clean build gives all three the same current time. Home chooses whichever file the loader returns first. A second machine chooses a different hero.

**Minimum required correction**

- Make published_at durable authored/version-controlled state, or establish a Git-tracked publication registry. Never default it to current build time.
- Add featured: boolean (default false) or an equivalent single canonical Home selection record.
- Validate at most one featured published Gallery.
- Define deterministic fallback ordering: published_at descending, then stable Gallery ID as tie-breaker.
- Distinguish photographed_start/end from published_at in schema, tests, authoring workflow, sitemap, and Home selection.

**Whether architectural direction changes:** NO.  
**User decision required:** YES — confirm whether featured is a Gallery field or a separate Home editorial setting; persistence itself is non-optional.

---

## Important Findings

### RT-005 — Determinism promises exceed the specified reproducibility boundary

**Severity:** IMPORTANT  
**Required timing:** MUST FIX BEFORE PHASE P3  
**Affected documents:** IMAGE_PIPELINE.md; CONTENT_MODEL.md; ADR-005; PRODUCTION_ARCHITECTURE_SUMMARY.md

**Claim being challenged:** Delete derivatives and regenerate identically; build reproducibility is guaranteed.

**Evidence:** The document promises bit-identical files only when source, configuration, and “environment” match, but does not define OS/CPU architecture, Sharp/libvips/codec versions, concurrency/order, metadata timestamps, locale, or manifest serialization. AssetManifest itself includes generated_at and a timestamp-based version, so the complete generated layer cannot be byte-identical. **External verification:** Sharp strips metadata and converts to sRGB by default; explicit ICC attachment and metadata choices materially change bytes. [Sharp output metadata](https://sharp.pixelplumbing.com/api-output/) and [Sharp colour API](https://sharp.pixelplumbing.com/api-colour/)

**Why it matters:** CI hash checks can fail across machines even when pixels are equivalent, or pass locally while a tool upgrade changes every derivative.

**Concrete failure scenario:** macOS arm64 and Linux x64 builds use different bundled libvips/codec versions. Pixel output is acceptable but SHA-256 differs, invalidating a promised cross-machine identity.

**Minimum required correction:** Define two guarantees: (A) semantic/pixel equivalence across supported environments; (B) byte identity only inside a pinned build image/toolchain. Pin Node, Sharp, libvips/codec package, lockfile, encoder options, orientation policy, metadata/ICC policy, ordering, and JSON canonicalization. Exclude generated_at from reproducibility comparisons or separate it from the deterministic manifest core.

**Whether architectural direction changes:** NO.  
**User decision required:** NO, unless byte-identical cross-machine output is a product requirement.

---

### RT-006 — Originals-in-Git/LFS is adopted without scale or backup closure

**Severity:** IMPORTANT  
**Required timing:** MUST FIX BEFORE IMPLEMENTATION PLAN  
**Affected documents:** ADR-002; REPOSITORY_STRUCTURE.md; DEPLOYMENT_ARCHITECTURE.md; OPEN_QUESTIONS.md; RISK_REGISTER.md

**Claim being challenged:** Track camera originals in Git; add LFS after roughly 1 GB; Git checkout restores originals and supports sub-30-minute recovery.

**Evidence:** The current 200 MB estimate is extrapolated from 113 JPEGs, but the requested audit includes 1,000–20,000 images. Git/LFS stores versions, not a complete independent backup policy; LFS clone/transfer quotas and history growth are not costed. Q08 remains open while ADR-002 and deployment recovery already assume Git is sufficient.

**Why it matters:** Repository strategy is difficult to reverse after thousands of large objects and historical revisions. Git, deployment releases, and backup serve different control objectives—respectively change history, serving rollback, and disaster recovery.

**Concrete failure scenario:** 5,000 ingest JPEGs average 15 MB (75 GB). A new CI clone/download is slow and costly; a deleted LFS remote object is not recovered from the VPS release because releases contain only derivatives.

**Minimum required correction:** Reopen the originals-storage part of ADR-002 and compare:

| Option | Best fit | Key risk |
|---|---|---|
| A. All archival/ingest masters in Git LFS | Small, tightly curated archive | Clone/transfer/history cost grows quickly |
| B. Masters outside Git + versioned filesystem/object backup | Large archive | Needs explicit source_ref and backup tooling |
| C. Curated web ingest masters in LFS; camera RAW archive outside Git | Strong default for this project | Two storage domains must be documented |

Define RPO (maximum acceptable lost work), RTO, off-site copy, versioning/retention, integrity verification, and restore drill. Git/LFS may be one copy, not the only backup.

**Whether architectural direction changes:** NO.  
**User decision required:** YES — select A/B/C and the backup target.

---

### RT-007 — “Original” conflates camera original, archival master, and web ingest master

**Severity:** IMPORTANT  
**Required timing:** MUST FIX BEFORE PHASE P2  
**Affected documents:** CONTENT_MODEL.md; IMAGE_PIPELINE.md; REPOSITORY_STRUCTURE.md; ADR-008

**Claim being challenged:** media/originals/ contains immutable camera originals, while JPEG is the initial supported ingest.

**Evidence:** REPOSITORY_STRUCTURE labels JPEGs under media/originals/ as “Camera originals,” while IMAGE_PIPELINE correctly says RAW is archival and JPEG is the website ingest. A corrected JPEG export may legitimately replace an ingest master even though documents say originals are never modified.

**Why it matters:** Ownership and recovery rules depend on what is irreplaceable. A RAW camera file, an edited TIFF/JPEG master, and a lossy web derivative have different provenance and replacement semantics.

**Concrete failure scenario:** A color-corrected JPEG is treated as forbidden modification, so the site cannot fix color without creating a new Photo ID or misleading history.

**Minimum required correction:** Define four terms and directories/contracts: CAMERA ORIGINAL, ARCHIVAL MASTER, WEB INGEST MASTER, WEB DERIVATIVE. State which are immutable, which may be superseded while retaining Photo ID, and which are public/regenerable. Rename media/originals if it actually contains only ingest masters.

**Whether architectural direction changes:** NO.  
**User decision required:** YES — confirm what file class is intended to live in the repository.

---

### RT-008 — Color-management fallback and metadata ordering are underspecified

**Severity:** IMPORTANT  
**Required timing:** MUST FIX BEFORE PHASE P3  
**Affected documents:** IMAGE_PIPELINE.md; ADR-011; ADR-012; OPEN_QUESTIONS.md

**Claim being challenged:** If ICC exists, convert to sRGB; otherwise assume sRGB; strip privacy fields but optionally keep exposure/date.

**Evidence:** An untagged AdobeRGB/P3 image interpreted as sRGB renders incorrectly. The documents do not choose warn/fail/accept for untagged masters, and “strip selected fields while keep selected fields” is not the default Sharp behavior. **External verification:** Sharp normally converts to device-independent sRGB and strips all metadata; withMetadata keeps most EXIF/XMP/IPTC and adds sRGB, while withIccProfile explicitly transforms/attaches an ICC profile. Selective privacy preservation therefore requires a deliberately reconstructed metadata allowlist, not a vague strip step. [Sharp output metadata](https://sharp.pixelplumbing.com/api-output/)

**Why it matters:** Color fidelity is the product’s primary content quality, while partial EXIF retention can accidentally leak GPS/serial fields.

**Concrete failure scenario:** An untagged AdobeRGB JPEG is assumed sRGB and appears desaturated. Separately, keepMetadata preserves GPS because the code only intended to preserve exposure.

**Minimum required correction:** Choose untagged policy (recommended: fail or loud warning plus explicit author override); auto-orient before stripping orientation; transform using ICC before metadata removal; default public output to no EXIF/XMP/IPTC; re-add only an explicit safe allowlist if those values are actually displayed; attach the chosen sRGB profile policy explicitly; test AdobeRGB, P3, sRGB, untagged, rotated EXIF, and GPS fixtures.

**Whether architectural direction changes:** NO.  
**User decision required:** YES — fail vs warn/override for untagged ingest.

---

### RT-009 — Progressive enhancement contains frozen-design drift and an unresolved mobile-nav failure

**Severity:** IMPORTANT  
**Required timing:** MUST FIX BEFORE IMPLEMENTATION PLAN  
**Affected documents:** RUNTIME_AND_PROGRESSIVE_ENHANCEMENT.md; IMPLEMENTATION_PHASES.md

**Claim being challenged:** With JS, captions use “Hover reveal,” continuation is a “Styled button,” and without JS desktop nav is visible while mobile “may need CSS-only toggle.”

**Evidence:** The frozen Gallery model renders captions beneath Photos; the Home/continuation language rejects button treatment and app chrome. Mobile core navigation must remain usable without JS, yet its fallback is explicitly TBD.

**Why it matters:** These phrases are likely to become implementation requirements. Hover-only captions fail touch/keyboard parity, button styling changes the frozen editorial hierarchy, and a JS-dependent mobile menu can make Archive/Places/About inaccessible.

**Concrete failure scenario:** The mobile hamburger has hidden nav HTML and requires JS to remove hidden. A script error leaves only the current page accessible.

**Minimum required correction:** Classify “caption hover reveal” and “styled button” as DOCUMENTATION BUG / ARCHITECTURE DRIFT and remove them. Captions remain normally visible. Continuation remains a text link with frozen typography. Define a real no-JS menu: for example, baseline visible/in-flow links with JS upgrading them into a modal, or a native details/summary fallback whose final visual state is validated against the freeze.

**Whether architectural direction changes:** NO.  
**User decision required:** NO if the implementation preserves frozen appearance; otherwise YES for the exact no-JS visual compromise.

---

### RT-010 — Slug stability is enforced by prohibition instead of a durable redirect contract

**Severity:** IMPORTANT  
**Required timing:** MUST FIX BEFORE PHASE P2  
**Affected documents:** BUILD_AND_ROUTING.md; CONTENT_MODEL.md; RISK_REGISTER.md; OPEN_QUESTIONS.md

**Claim being challenged:** Slugs never change; if they do in MVP, old URLs may 404. Gallery slug must match Gallery ID.

**Evidence:** Typo, privacy, transliteration, and editorial corrections are foreseeable in a long-lived archive. Requiring slug=id couples stable internal identity to public URL. The proposed redirect object is future-only and its shape is not integrated with Nginx/static output.

**Why it matters:** A URL is an external reference. “Never correct it” is not a recovery mechanism.

**Concrete failure scenario:** A place name reveals sensitive location or contains a typo. Fixing the slug either changes the stable Gallery ID and all references or intentionally breaks every saved/shared URL.

**Minimum required correction:** Decouple immutable Gallery ID from mutable public slug; add a Git-tracked redirects registry or previous_slugs list; validate no redirect cycles/collisions; generate Nginx map/static redirect responses; test canonical, sitemap, and 301 behavior. Place slugs need the same policy.

**Whether architectural direction changes:** NO.  
**User decision required:** YES — approve redirects as baseline rather than future enhancement.

---

### RT-011 — Draft/published lifecycle is duplicated and incomplete

**Severity:** IMPORTANT  
**Required timing:** MUST FIX BEFORE PHASE P2  
**Affected documents:** CONTENT_MODEL.md; BUILD_AND_ROUTING.md; IMAGE_PIPELINE.md; SEO/deployment passages

**Claim being challenged:** Gallery and Photo both have draft/published status, but deployment will safely include only published content.

**Evidence:** PhotoIdentity has its own status while one Photo belongs to one Gallery; Gallery YAML also owns status. No rule defines whether drafts get derivatives/routes, whether local preview includes them, whether sitemap/OG/Home exclude them, or whether published next_gallery may target draft. Missing derivatives are only warnings even though published HTML may require them.

**Why it matters:** Duplicate status can diverge and draft leakage is a real privacy/publication risk.

**Concrete failure scenario:** A published Gallery links next_gallery to a draft. Local preview works; production omits the draft route; continuation deploys a 404.

**Minimum required correction:** Make Gallery status canonical; derive Photo publication from membership for MVP. Define build modes: preview may render drafts behind a local-only flag; production must fail closed and exclude draft routes/sitemap/Home/Places/Archive/OG. A published Gallery may reference only published Photo assets and a published next target. Missing required derivatives for published content must fail build.

**Whether architectural direction changes:** NO.  
**User decision required:** NO.

---

### RT-012 — next_gallery validation rejects valid graphs and treats cycles as inherently invalid without product basis

**Severity:** IMPORTANT  
**Required timing:** MUST FIX BEFORE PHASE P2  
**Affected documents:** CONTENT_MODEL.md; BUILD_AND_ROUTING.md; ADR-009; RISK_REGISTER.md

**Claim being challenged:** Cycle detection is required; the documented algorithm correctly validates the continuation graph.

**Evidence:** The algorithm uses a global visited set before checking the current chain. A valid converging graph A→C and B→C is rejected when B reaches already visited C. A true cycle is misreported through the visited branch. The frozen product requires a target to exist and continuation semantics to be defined; it does not state that A→B→C→A is harmful.

**Why it matters:** “Rigorous” validation can block valid editorial navigation while failing to express the actual invariant.

**Concrete failure scenario:** Two Galleries intentionally continue to the same final Gallery. The second chain fails build as “points to untraversed node.”

**Minimum required correction:** Decide the product invariant first. Baseline likely needs target exists, target published when source published, no self-loop, and optionally no cycle only if origin-aware Back/continuation truly breaks. If acyclicity is required, implement DFS colors or per-origin chain detection without treating shared tails as errors. Document direct-entry and Back-to-origin behavior separately.

**Whether architectural direction changes:** NO.  
**User decision required:** YES — confirm whether editorial cycles are actually forbidden.

---

### RT-013 — Immutable cache headers conflict with non-hashed derivative filenames

**Severity:** IMPORTANT  
**Required timing:** MUST FIX BEFORE PHASE P3 and P9  
**Affected documents:** IMAGE_PIPELINE.md; CONTENT_MODEL.md; DEPLOYMENT_ARCHITECTURE.md

**Claim being challenged:** SHA-256 fingerprints provide cache busting, while derivative files are named photo-id-width.ext and all /assets/ receive one-year immutable caching.

**Evidence:** Defined file_path examples contain no content/config hash. IMAGE_PIPELINE offers “use SHA in filenames or rely on timestamps” without choosing. Nginx marks the whole assets tree immutable.

**Why it matters:** Corrected images, encoder changes, CSS, JS, or fonts can retain the same URL but new bytes. Browsers are explicitly told never to revalidate them.

**Concrete failure scenario:** A color-corrected master regenerates photo-001-2048w.webp. Returning visitors keep the old image for up to a year.

**Minimum required correction:** Use content-addressed filenames that include a digest of source bytes plus all rendering-affecting config/toolchain inputs. Hash CSS/JS/fonts too, or narrow immutable caching only to hashed paths. Manifest file_path becomes authoritative. Define how old-page lazy image requests remain available across release switches—shared content-addressed asset store or carry-forward of referenced prior assets.

**Whether architectural direction changes:** NO.  
**User decision required:** NO.

---

### RT-014 — Deployment is release-oriented but not yet atomic, verified, or rollback-safe

**Severity:** IMPORTANT  
**Required timing:** MUST FIX BEFORE PHASE P9  
**Affected documents:** DEPLOYMENT_ARCHITECTURE.md; RISK_REGISTER.md; IMPLEMENTATION_PHASES.md

**Claim being challenged:** ln -sfn is a single atomic inode operation; no partial state is possible; post-deploy smoke failure automatically rolls back.

**Evidence:**

- **SOURCE DOCUMENT FINDING:** The script uses ln -sfn directly on current, validates with astro check on source rather than the uploaded release, switches before any production smoke test, and does not invoke rollback.
- **SOURCE DOCUMENT FINDING:** CI uploads into one reusable /tmp/deploy-staging then mv …/*, which can retain dotfiles/stale partial content and is unsafe under overlapping deployments.
- **SOURCE DOCUMENT FINDING:** rollback chooses the second newest directory, not the exact pre-switch current target.
- **SOURCE DOCUMENT FINDING:** Nginx try_files $uri /index.html is SPA fallback behavior for a non-SPA static site, turning unknown routes into Home 200 responses.
- **EXTERNAL VERIFICATION:** Atomic replacement is guaranteed by rename(), not by an unlink-then-create assumption. Create a temporary symlink on the same filesystem and atomically rename it over current. [Linux rename(2)](https://man7.org/linux/man-pages/man2/rename.2.html)

**Why it matters:** A 70% upload, bad release, concurrent deployment, or failed smoke check can produce mixed/incomplete state or rollback to the wrong directory.

**Concrete failure scenario:** Upload fails at 70%, leaving files in shared staging. The next run succeeds but reuses stale files; switch completes; /health still returns 200 because it is an unconditional Nginx endpoint.

**Minimum required correction:** Allocate unique staging/release directories; upload into the final release directory marked incomplete; verify expected manifest/routes/assets/privacy before switch; record previous readlink; create current.next symlink then rename atomically on the same filesystem; do not reload Nginx merely for a symlink change unless config/cache policy requires it; run real HTTP smoke checks after switch; auto-rollback to the recorded previous target on failure; serialize deployments; remove SPA fallback and use static try_files $uri $uri/ =404; validate Nginx config separately.

**Whether architectural direction changes:** NO.  
**User decision required:** NO.

---

### RT-015 — Runtime chunking and byte budgets are premature and partly invalid

**Severity:** IMPORTANT  
**Required timing:** SHOULD FIX BEFORE P1; MUST MEASURE BY P7  
**Affected documents:** RUNTIME_AND_PROGRESSIVE_ENHANCEMENT.md; PERFORMANCE_BUDGET.md; IMPLEMENTATION_PHASES.md

**Claim being challenged:** Manual overview/menu/utils chunks and ≤20 KB JS, ≤40 KB CSS, 150/200/50 KB images are production budgets.

**Evidence:** No baseline bundle or real derivative measurements exist. The manualChunks example treats Astro component paths as manual chunk inputs and assumes config details across Astro/Vite majors. Current official Astro 7 uses Vite 8, making “Astro 6+” plus hand-written Vite internals especially drift-prone. Image byte caps are not linked to viewport/DPR/visual acceptability and could force over-compression.

**Why it matters:** Budget numbers are useful guardrails only when classified. Treating guesses as CI failures can harm photo quality or add bundler complexity that exceeds the site’s JS.

**Concrete failure scenario:** A high-detail Gallery first image needs 260 KB for the accepted quality threshold but CI fails at 200 KB; the team lowers quality instead of improving responsive selection.

**Minimum required correction:** Classify LCP/CLS/INP as WEB STANDARD TARGET; JS/CSS as ENGINEERING BUDGET pending baseline; image bytes and HTML sizes as PLANNING HEURISTICS until benchmarked. Start with Astro/default bundling and plain module scripts; add manual chunking only after bundle analysis proves benefit. Gate quality by benchmark outcomes, not one universal byte maximum.

**Whether architectural direction changes:** NO.  
**User decision required:** NO.

---

### RT-016 — Static CJK subsetting has no sustainable glyph-coverage policy

**Severity:** IMPORTANT  
**Required timing:** MUST FIX BEFORE P1/P4  
**Affected documents:** PERFORMANCE_BUDGET.md; REPOSITORY_STRUCTURE.md; RISK_REGISTER.md

**Claim being challenged:** A roughly 2,500-character Noto Serif/Sans SC subset is sufficient and stays under 1 MB.

**Evidence:** Future Gallery titles/captions can introduce unseen Chinese characters. The CSS example declares the entire U+4E00–9FFF range even if the actual font file contains only a subset, which can suppress correct fallback behavior depending on shaping/coverage. font-subset is not a standard @font-face descriptor.

**Why it matters:** Missing glyphs are silent editorial corruption and may appear only after new content ships.

**Concrete failure scenario:** A new Gallery title contains a rare place-name character excluded from the static subset. Production renders tofu or a mismatched fallback in only that word.

**Minimum required correction:** Choose a sustainable policy: versioned broad language subset with verified coverage; or build-derived glyph subset plus deterministic regeneration, fallback range segmentation, and a pre-deploy glyph coverage test. Content changes must trigger subset rebuild and filename hash change. Define fallback fonts and do not claim the whole CJK range for glyphs the file lacks.

**Whether architectural direction changes:** NO.  
**User decision required:** YES — broad static subset versus build-derived subset.

---

### RT-017 — Alt-text architecture contradicts its own ADR and cannot support the final policy without schema work

**Severity:** IMPORTANT  
**Required timing:** MUST FIX BEFORE PHASE P2 schema; policy MUST FIX BEFORE P7  
**Affected documents:** CONTENT_MODEL.md; BUILD_AND_ROUTING.md; ADR-016; OPEN_QUESTIONS.md; RISK_REGISTER.md

**Claim being challenged:** Architecture already supports optional alt_text, while policy may defer; recommended fallback is EXIF caption → filename.

**Evidence:** Gallery YAML and the shown Astro schema contain no alt_text mapping/Photo authored field. ADR-016 says the field exists and avoids poor automatic text, but Q04 recommends filename fallback. Caption is editorial context, not necessarily an image description; a camera filename is meaningless to assistive technology.

**Why it matters:** Adding per-photo accessibility text later may require a schema migration after content ingest. Bad fallback creates noise rather than access.

**Concrete failure scenario:** Screen reader announces “DSC02762” for every image, or the implementation copies poetic captions that do not describe visible content.

**Minimum required correction:** Add an optional per-Photo authored accessibility field now (registry or Gallery photo metadata), plus an explicit decorative-empty-alt decision where appropriate. Reject filename fallback. Keep content-writing policy deferred only if implementation can safely distinguish authored alt, decorative alt="", and unresolved policy; production publication should fail/warn according to the approved policy.

**Whether architectural direction changes:** NO.  
**User decision required:** YES — production alt/decorative policy before P7.

---

### RT-018 — Test examples contradict the DOM model and visual-baseline semantics

**Severity:** IMPORTANT  
**Required timing:** MUST FIX BEFORE PHASE P6/P8  
**Affected documents:** TESTING_AND_VISUAL_REGRESSION.md; RUNTIME_AND_PROGRESSIVE_ENHANCEMENT.md

**Claim being challenged:** The Playwright examples are implementable tests and Stage 3C SHA-256 baselines can directly gate production screenshots.

**Evidence:** hidden is a boolean HTML attribute: hidden="false" is still present/hidden. The close test waits for #overview-layer[hidden] with state detached even though the model keeps the element in DOM and toggles the attribute. Twenty Tab presses do not prove return to the first element unless focusable count divides twenty. Hashing baseline PNGs verifies file integrity, not visual equality. Production rendering can differ by browser/font rasterizer/platform while remaining visually equivalent.

**Why it matters:** Misleading pseudocode becomes a false acceptance gate or produces flaky CI.

**Concrete failure scenario:** Correct modal code toggles hidden on an attached dialog; the documented test times out and prompts an implementer to remove the dialog from DOM, changing focus/restoration behavior.

**Minimum required correction:** Mark examples as pseudocode or replace with assertions on toBeHidden/toBeVisible, attribute absence, focus containment across first/last boundaries, Escape/focus restoration, and background scroll lock. Keep SHA-256 only for baseline artifact integrity. Visual regression needs a pinned capture image/browser/fonts, pixel-diff threshold/masks, human review for threshold failures, and explicit baseline-update approval.

**Whether architectural direction changes:** NO.  
**User decision required:** NO.

---

### RT-019 — Multiple authored/derived fields can silently diverge

**Severity:** IMPORTANT  
**Required timing:** MUST FIX BEFORE PHASE P2  
**Affected documents:** CONTENT_MODEL.md; BUILD_AND_ROUTING.md

**Claim being challenged:** The content model has one canonical source per concept.

**Evidence:** has_continuation is described as auto-derived from next_gallery but also allows an explicit override; prev_gallery may be authored or auto-derived; Gallery status and Photo status duplicate publication; Gallery ID must match slug; dimensions/orientation appear in identity and derivatives without a declared authority/consistency rule.

**Why it matters:** These are spreadsheet-style duplicate formulas: once one cell is hand-overridden, two “truths” exist and validation no longer knows which wins.

**Concrete failure scenario:** next_gallery is set, has_continuation is false, and prev_gallery on the target points elsewhere. Different components read different fields and render inconsistent navigation.

**Minimum required correction:** Remove has_continuation from authored schema; derive it. Decide whether prev is explicitly authored or derived from a validated inverse relation—never both. Remove Photo status for one-Gallery MVP. Treat decoded source dimensions/orientation as canonical derived metadata; derivative dimensions must validate against transform math. Decouple ID and slug.

**Whether architectural direction changes:** NO.  
**User decision required:** YES only for explicit versus derived prev_gallery.

---

## Minor Findings

1. **RT-M01:** ADR-003 status is misspelled ADOUGHTED.
2. **RT-M02:** ADR-014 date is 2006-08-28 rather than 2026-08-28.
3. **RT-M03:** BUILD_AND_ROUTING schema uses descriptions while authored YAML uses description.
4. **RT-M04:** The rhythms Zod example is malformed/misordered and does not represent a record keyed by Photo ID.
5. **RT-M05:** AssetManifest “JSON” samples contain comments, so they are JSON-like pseudocode rather than valid JSON.
6. **RT-M06:** Runtime image examples use widths instead of srcset and decode instead of the HTML attribute decoding.
7. **RT-M07:** Focus outline offset is documented as 2 px in architecture but frozen specification requires 3 px.
8. **RT-M08:** Deployment overview Nginx example has duplicated closing braces; the detailed config’s X-XSS-Protection header is obsolete and should not be presented as a meaningful modern control.
9. **RT-M09:** P10 lists a zero-photo Gallery edge case although validation explicitly forbids zero-photo Galleries.
10. **RT-M10:** The review packet says “~9 documents” while the mandatory architecture corpus contains 16; this understates review scope.

---

## H1–H6 Hypothesis Verdicts

| Hypothesis | Verdict | Evidence summary |
|---|---|---|
| H1 Photo identity persistence incomplete | **CONFIRMED** | Only disposable generated mapping binds Photo ID to source; rename/move/re-export cannot be recovered |
| H2 AssetManifest/build ordering inconsistent | **CONFIRMED** | Manifest appears both before and after consumer; derivatives written to dist before Astro clears dist |
| H3 content/ and src/content/ create dual source | **CONFIRMED** | “auto-copied? TBD”; no winner/staleness rule; direct Astro glob loader makes copy unnecessary |
| H4 Runtime docs contain frozen-design drift | **CONFIRMED** | Hover captions, styled-button continuation, and unresolved mobile no-JS navigation contradict frozen behavior |
| H5 Originals-in-Git/LFS weakly justified | **CONFIRMED** | Adopted before Q08/scale/cost/RPO/RTO closure; Git and backup are conflated |
| H6 ADR metadata typos/inconsistent dates | **CONFIRMED** | ADOUGHTED and 2006-08-28, plus smaller naming inconsistencies |

---

## Photo Identity Persistence Audit

### Exact current relationship

~~~text
Gallery YAML: photos[] = Photo IDs
             ↓ lookup
generated/photo-identities.json
             ↓ contains source_file + location
media/originals/{gallery}/{file}
~~~

The middle object is not derived in the mathematical sense. It carries the only persistent join key between authored identity and a source path. Removing it destroys information.

### A1–A6 result

| Question | Current answer | Verdict |
|---|---|---|
| A1 canonical id → source binding | generated/photo-identities.json only | CRITICAL: mislabeled disposable |
| A2 rename file + delete generated | Cannot recognize same Photo | CRITICAL |
| A3 move source folder | Stable only while old mapping survives/manual edit | CRITICAL |
| A4 corrected re-export | Hash changes; identity policy undefined | IMPORTANT |
| A5 filename identity | Would violate ADR-003 | Rejected |
| A6 existing mapping required | Yes | Mapping is persistent state |

**Conclusion:** A persistent identity registry or authored source binding is required. Fingerprints should detect duplicates and aid recovery, not define editorial identity alone.

---

## Source-of-Truth Matrix

| Concept | Canonical Source | Generated Copy | Persistence Required | Current Validation | Verdict |
|---|---|---|---:|---|---|
| Gallery ID | Gallery meta.yaml | Content entry/view | Yes | Unique; incorrectly tied to slug | REVISE |
| Gallery slug | Gallery meta.yaml | Routes/canonical/sitemap | Yes | Unique; must equal ID | REVISE: decouple + redirects |
| Photo ID | Unresolved; only ID references + generated mapping | Manifest/view/routes | Yes | Existence after generation | CRITICAL |
| Photo source binding | generated/photo-identities.json | Pipeline inputs | Yes | None across rename/move | CRITICAL |
| Photo sequence | Gallery photos[] | sequence_position | Yes | Non-empty, IDs exist | SOUND after identity fix |
| Caption | Gallery captions[photo_id] | PhotoView.caption | Yes | Key membership not fully stated | ADD orphan-key validation |
| Rhythm | Gallery rhythms[photo_id] | rhythm_after | Yes | Enum; key membership incomplete | ADD orphan-key validation |
| Cover | Gallery cover_photo or implicit first | Card/hero assets | Yes | Missing warns; membership undefined | RESOLVE Q03 + validate |
| Photographed dates | Gallery photographed_start/end | labels/year groups | Yes | ISO only | SOUND; validate range order |
| Publish timestamp | Optional YAML or current build timestamp | Home/sitemap | Yes | None | CRITICAL |
| Featured state | Missing | Home hero selection | Yes | None | CRITICAL |
| Place entity | content/places/places.yaml | Resolved Gallery/Place pages | Yes | Reference existence implied | SOUND; add slug redirects |
| next_gallery | Gallery YAML | resolved GalleryRef | Yes | dangling + flawed cycle rule | REVISE |
| prev_gallery | Authored or auto-derived | GalleryRef | Depends on chosen rule | Ambiguous | REVISE |
| has_continuation | Authored override + derived | GalleryView | No | Can contradict next_gallery | REMOVE authored field |
| Published state | Gallery status plus PhotoIdentity status | route/filter decisions | Yes at Gallery level | Lifecycle incomplete | REVISE |
| Intrinsic dimensions | Decoded ingest master | Identity + manifest + HTML | Recomputable | Decode only | SOUND if cross-validated |
| Orientation | Decoded pixels/EXIF normalization | Identity/view | Recomputable | Policy incomplete | DEFINE auto-orient |
| Derivative filenames | Pipeline/AssetManifest | dist paths/HTML | Recomputable | Missing hash requirement | REVISE |
| Derivative metadata/hash | Pipeline/AssetManifest | dist/manifest copy | Recomputable | Partial | DEFINE deterministic core |
| Redirects | Missing/future YAML sketch | Nginx/static responses | Yes | None | IMPORTANT |

---

## Build DAG Audit

### Current contradictions

1. Validation requires Photo IDs to exist before identity generation.
2. Identity generation claims to derive IDs despite Gallery YAML already referencing them.
3. Image pipeline writes into dist/, then Astro clears dist/.
4. Overview lists AssetManifest generation both before and after Astro.
5. “Astro runtime consumption” is actually module import at build time.
6. Post-build copies fonts/sitemap even though Astro/public/integration ownership is unclear.

### Correct dependency DAG

~~~text
[Git-tracked authored metadata]
             +
[persistent Photo ID/source registry]
             +
[web ingest masters]
             |
             v
1. Schema validation and reference closure
   - Gallery/Place/Photo uniqueness
   - published/draft constraints
   - cover/caption/rhythm/next references
             |
             v
2. Source validation and metadata extraction
   - source exists/decodes
   - auto-orient
   - dimensions/profile/privacy inspection
             |
             v
3. Image derivation into isolated staging/generated root
   - explicit color transform
   - deterministic encoder config
   - content-hashed filenames
             |
             v
4. Canonical deterministic AssetManifest
             |
             v
5. Astro Content Layer sync + static rendering into fresh dist/
   - direct load from content/galleries/
   - assembly/copy of staged derivatives
             |
             v
6. dist integrity gate
   - every HTML reference resolves
   - no originals/GPS/drafts
   - route/SEO/a11y/size checks
             |
             v
7. Unique release upload → target verification
             |
             v
8. Atomic current-pointer rename → smoke → rollback on failure
~~~

This graph has no consumer-before-producer edge and gives dist/ one owner.

---

## Content Model Audit

- **Gallery/Photo membership:** MVP’s one-Photo-one-Gallery rule is compatible with parent_gallery_id but must validate globally that each Photo ID occurs in exactly one Gallery. ADR-003’s “enables multi-gallery reuse” is premature rationale and conflicts with the singular parent model; defer reuse rather than exposing it now.
- **Place:** One places.yaml is reasonable at 100+ Galleries. It is not a bottleneck at expected scale. No Visit/Trip entity is present. Multi-place Gallery references are coherent if every slug exists and public order is defined.
- **Dates:** photographed_start/end are correctly canonical for archive chronology. Validate start ≤ end and date precision policy. published_at is a different fact and must persist.
- **Cover:** Either require cover_photo or define first-in-sequence as a deterministic default. In both cases it must reference a Photo in the Gallery. “Highest resolution” and visual scoring have no product basis.
- **Caption/rhythm maps:** Validate every key belongs to Gallery photos[]; decide whether explicit null caption is materially different from absence.
- **Description:** The architecture respects the 2–3-line frozen limit but must use one field name.
- **Photo reuse:** Do not add global reuse complexity in MVP; the persistent registry can still remain globally unique without permitting multiple memberships.

---

## Image Pipeline Audit

**Input boundary:** “camera originals” and “web ingest masters” are currently conflated; correct the terms before tooling.

**Transform order required:**

1. Read/decode and inspect original metadata/profile.
2. Apply EXIF orientation to pixels; reset/remove orientation.
3. Validate profile or apply explicit untagged override.
4. Convert from source profile to selected sRGB target.
5. Resize without crop/upscale according to purpose.
6. Encode with pinned format settings.
7. Strip all metadata by default.
8. Attach only selected output ICC and explicitly safe metadata, if any.
9. Verify public derivative contains no GPS/serial/XMP/IPTC secrets.

**Frozen-image compliance:** Overview and Gallery derivation preserve aspect ratio. No object-fit: cover or destructive crop is required. This area is NO ISSUE after examples are kept consistent.

**Failure semantics:** Decode errors, missing source, missing published derivative, privacy-verification failure, and color-policy failure must block production. Duplicate content hashes can warn. Draft derivative policy may be configurable for local preview.

---

## Determinism Audit

| Layer | Appropriate guarantee | Current problem | Required evidence |
|---|---|---|---|
| Photo editorial identity | Stable across rename/move/corrected master when explicitly mapped | No persistent mapping | Registry migration tests |
| Pixel result | Equivalent within defined tolerance across supported build hosts | Undefined tolerance/profile pipeline | Fixture pixel comparisons |
| Encoded derivative bytes | Identical only in pinned build image/toolchain | “Same environment” vague | Repeat builds + cross-host result |
| Deterministic manifest core | Canonically ordered/serialized | Timestamp/version makes whole file change | Canonical JSON hash |
| Deployment output | Complete internally coherent release | Old-page asset availability undefined | Release/switch/lazy-load test |

The architecture should not promise global SHA equality unless it owns the complete codec environment. Use hashes primarily for integrity and content-addressed cache keys.

---

## Repository / Originals Ownership Audit

**Current (~100 images):** Git or Git LFS is workable but does not validate long-term fit.

**Recommended default (personal judgment, user decision):** Option C — curated WEB INGEST MASTERS in Git LFS only if their volume remains operationally modest; archival RAW/camera originals in an external versioned photo archive with at least one off-site backup. This resembles financial consolidation: Git contains the reporting ledger inputs used by the site, while the full document vault remains in purpose-built archival storage.

**Industry-standard requirement:** Regardless of A/B/C, maintain at least two independent failure domains, integrity checks, and a tested restore path. Deployment releases do not count as source backup.

---

## Runtime & Progressive Enhancement Audit

| Page/feature | No-JS core status | Verdict |
|---|---|---|
| Home hero/recent links | Static HTML possible | SOUND |
| Archive | Static links/cards | SOUND |
| Places index/detail | Static links/cards | SOUND |
| Gallery sequence/captions | Native flow | SOUND if captions never hover-only |
| Gallery continuation | Native anchor | SOUND if not button/drift |
| About | Static text | SOUND |
| Overview | May disappear | ACCEPTABLE ENHANCEMENT |
| Position annotation | May disappear | ACCEPTABLE ENHANCEMENT |
| Mobile navigation | “may need CSS-only toggle” | IMPORTANT unresolved core access |
| Menu/Overview focus trap | JS enhancement | Must restore focus and support reduced motion |

Scroll restoration should first rely on browser history. The custom sessionStorage/manual mode adds hidden state and should be implemented only if measured navigation behavior fails; otherwise it is PREMATURE.

---

## Frozen Design Compliance Audit

| Occurrence | Classification | Reason |
|---|---|---|
| “Caption Display — Hover reveal” | ARCHITECTURE DRIFT / documentation bug | Frozen captions are visible below Photo; hover cannot be primary |
| “Continuation Link — Styled button” | ARCHITECTURE DRIFT / documentation bug | Frozen editorial text link; button treatment rejected |
| Overview 6 desktop / 3 mobile | NO ISSUE | Matches G6 |
| 2-column Overview fallback | NO ISSUE: absent | Correctly not introduced |
| contained uncropped thumbnails | NO ISSUE | Matches G6 |
| object-fit/crop | NO ISSUE in intended rules | Explicit no crop |
| persistent position annotation | NO ISSUE | Matches G5; can vanish without JS |
| sticky/app controls | NO ISSUE: not required | Header remains non-sticky |
| full-bleed desktop | NO ISSUE: absent | 90vw/1440 ceiling maintained |
| Next cover/recommendation cards | NO ISSUE: absent | Continuation remains single title/link |
| inline position fallback | NO ISSUE: absent | Frozen variant remains removed |
| focus offset 2 px | DOCUMENTATION BUG | Frozen value is 3 px |

---

## Performance Architecture Audit

| Metric/value | Correct classification | Current status |
|---|---|---|
| LCP ≤2.5 s, CLS ≤0.1, INP ≤200 ms | WEB STANDARD TARGET | Appropriate, measure lab + field when traffic exists |
| JS ≤20 KB gzip | ENGINEERING BUDGET | Unmeasured aspiration, not fact |
| CSS ≤40 KB gzip | ENGINEERING BUDGET | Unmeasured aspiration |
| 150 KB hero / 200 KB first Gallery / 50 KB card | PLANNING HEURISTIC | Must not override accepted photo quality |
| HTML 150/500/200/50 KB | PLANNING HEURISTIC | Validate against actual rendered markup |
| Build <10 s / <60 s | PROJECT TARGET | Hardware/fixture-specific; record environment |
| 72-Photo memory <200 MB | ENGINEERING BUDGET | Measure low-end mobile as well as desktop |
| Current measured baseline | MEASURED BASELINE | None yet |

Native lazy loading is appropriate. The first/LCP image must be eager/high-priority while later images remain lazy. IntersectionObserver is justified for position annotation, not for replacing native loading. Virtualization remains OPTIONAL after evidence.

---

## Font / CJK Audit

The frozen font families remain supported; no typography change is recommended.

Required architecture:

- pin font versions and licenses;
- subset by a reproducible tool/config;
- validate every current content code point against actual font cmap coverage;
- rebuild/hash font assets when content glyph set changes;
- preserve system CJK fallback for missing/new glyphs;
- preload only proven above-fold fonts;
- test Latin/CJK mixed titles and new rare place-name characters;
- do not claim a unicode-range broader than the served subset without intentional fallback segmentation.

Broad static versus build-derived subset is a user/operations trade-off, not a visual reopening.

---

## Routing & Redirect Audit

- Canonical Gallery route /galleries/{slug} is consistently defined: NO ISSUE.
- Gallery ID must not be forced to equal slug; internal identity and public address have different lifecycles.
- Redirects should be baseline architecture for Gallery and Place slugs.
- Redirect registry must participate in duplicate/cycle checks and generate 301 responses.
- Nginx must use static 404 behavior, not SPA fallback.
- Origin-aware “Back to {origin}” should derive from navigation context with a safe static fallback; it must not mutate canonical next_gallery semantics.
- next_gallery cycles are a product invariant question, not automatically an error.

---

## Deployment Audit

### Correct deployment sequence

~~~text
build locally/CI
→ verify dist completeness/privacy
→ create unique remote release directory
→ rsync into that directory only
→ verify remote release against manifest
→ record exact current target
→ atomically rename prepared symlink over current
→ HTTP smoke canonical pages + representative image + 404
→ on failure atomically restore recorded target
→ retain releases per capacity policy
~~~

Nginx reload is required when configuration changes, not inherently when a symlink target changes. If open_file_cache or other caching affects path resolution, test/configure it explicitly. The current /health endpoint tests Nginx availability only, not release health.

HTML should use revalidation/no-cache appropriate to editorial updates; hashed assets can be immutable. Release cleanup must not break old HTML that lazily requests old hashes.

---

## Backup / Recovery Audit

| Loss event | Current recovery claim | Adequacy | Required correction |
|---|---|---|---|
| VPS disk dies | Reclone Git, rebuild | Partial | Verify DNS/TLS/Nginx/secrets/bootstrap and source location |
| Authored YAML deleted | Git history | Good if committed/pushed | Add protected branch/remote backup |
| Ingest master deleted | Git/LFS assumed | Unproven at scale | Independent versioned backup + restore test |
| Persistent identity registry lost | Currently “generated” | CRITICAL gap | Git-track/back up canonical registry |
| Generated derivatives lost | Rebuild | Good after deterministic contract | No backup required |
| Git remote/LFS corruption | Not covered | Inadequate | Independent copy and integrity inventory |
| Release history lost | Rebuild | Acceptable | Releases are rollback cache, not backup |
| SSH/TLS secrets lost | Not defined | Incomplete | Secure secrets escrow/reprovision procedure |

RTO <30 minutes is an estimate, not a verified target. A restore drill must prove it with a clean host and documented dependencies.

---

## Testing & Visual Regression Audit

Test categories are appropriate, but acceptance must test contracts rather than examples:

1. **Identity:** rename, move, corrected master, delete generated/, duplicate fingerprint, registry conflict.
2. **Content:** published/draft closure, featured uniqueness, persistent timestamp ordering, cover membership, caption/rhythm orphan keys, one-Gallery membership.
3. **Images:** EXIF orientation, sRGB/AdobeRGB/P3/untagged, GPS/serial/XMP stripping, aspect-ratio preservation, no upscale/crop, deterministic repeat.
4. **Build:** delete generated/, delete dist/, fresh checkout, manifest-before-render, every HTML asset exists.
5. **Runtime:** no-JS navigation/content, modal visibility/focus/restore, position observer, reduced motion.
6. **Routing/SEO:** canonical, sitemap excludes drafts, redirects, real 404.
7. **Deployment:** 70% upload, pre-switch verify failure, post-switch smoke failure, concurrent deploy lock, exact rollback.
8. **Visual:** pinned browser/OS/fonts, thresholded pixel diff, human adjudication, governed baseline update.

Stage 3C PNG SHA-256 remains useful as evidence-integrity metadata, not as the production visual-equivalence algorithm.

---

## Security / Privacy Audit

**Real static-site concerns only:**

- Originals/ingest masters must never be copied under public/dist; add an allowlist assembly and negative test for camera filenames/RAW extensions.
- Production must fail closed on drafts.
- Public derivatives must be inspected after encoding for GPS, serial, XMP/IPTC, and unintended thumbnails/previews.
- Deploy key should be scoped to a non-root deploy user; sudo limited to validated Nginx operations if needed.
- Disable directory listing; serve strict MIME types; use HSTS after HTTPS is proven; define CSP based on actual inline scripts/styles.
- Backups and Git/LFS remotes can contain original EXIF and require private access/encryption.
- Do not add Sentry/analytics by default; if added later, treat it as an explicit privacy/data-flow decision.

No backend/auth/database security architecture is needed: NO ISSUE.

---

## ADR Consistency Audit

| ADR | Current status verdict | Consistency result | Required action |
|---|---|---|---|
| ADR-001 Astro 6+ | REVISE | High-level fit sound; version range vague; sample removed API; official current major is 7 | Express supported stable major and pin exact version/Node at P1 |
| ADR-002 split storage | PARTIALLY SOUND | Separation good; Git/LFS and dual content path unresolved | Reopen originals policy; remove src copy |
| ADR-003 stable Photo ID | OPEN / REVISED REQUIRED | Goal sound; persistence mechanism impossible | Choose registry/binding |
| ADR-004 ID-bound captions/rhythms | ADOPTED | Consistent | Add membership validation |
| ADR-005 deterministic subprocess | REVISE | Subsystem justified; determinism/outdir contract broken | Define guarantee and staging |
| ADR-006 atomic deploy | REVISE | Direction sound; ln/smoke/rollback/cache details incomplete | Define verified atomic rename flow |
| ADR-007 photographed dates canonical | ADOPTED | Sound | Keep published_at separate |
| ADR-008 ingest vs archive | ADOPTED WITH TERMINOLOGY FIX | Principle sound; directories misuse “original” | Define four media classes |
| ADR-009 explicit next | REVISE | Editorial control sound; cycle invariant/algorithm unsound | Decide invariant; correct validation |
| ADR-010 benchmark image values | ADOPTED | Sound | Start harness before P3 |
| ADR-011 ICC→sRGB | REVISE | Direction sound; untagged/metadata semantics missing | Define fail/warn and exact pipeline |
| ADR-012 privacy strip | ADOPTED WITH IMPLEMENTATION CONTRACT | Principle sound | Default strip-all + safe allowlist tests |
| ADR-013 measure before virtualization | ADOPTED | Consistent | Include low-end mobile evidence |
| ADR-014 full builds | ADOPTED | Sound; typo only | Correct date |
| ADR-015 uncropped Overview | ADOPTED | Consistent with freeze | No change |
| ADR-016 alt policy deferred | REVISE | Policy may defer; claimed schema field is absent; filename fallback conflicts | Add schema now; decide policy by P7 |

---

## Open Questions Audit

| Question | Classification | Reason / action |
|---|---|---|
| Q01 image benchmarks | BLOCKS SPECIFIC PHASE P3 | Benchmark harness can start earlier; values must be fixed before derivative contract |
| Q02 ingest formats | BLOCKS IMPLEMENTATION PLAN/P3 | Changes source validation, tooling and test matrix; JPEG-only recommendation is reasonable |
| Q03 cover default | BLOCKS IMPLEMENTATION PLAN/P2 schema | Required versus default affects validation and authoring contract |
| Q04 alt policy | BLOCKS SPECIFIC PHASE P7; schema support blocks P2 | Add field now; content policy can defer |
| Q05 no-next links | SHOULD ALREADY BE RESOLVED | Frozen G7 says Back primary / Browse Archive secondary; architecture’s Places/About alternatives drift |
| Q06 analytics | CAN SAFELY DEFER | Default none preserves static/privacy direction |
| Q07 multi-language | CAN SAFELY DEFER / REMOVE FROM MVP QUESTIONS | Scope expansion not required by frozen product; do not expand schema now |
| Q08 backup | BLOCKS IMPLEMENTATION PLAN | Determines originals/registry repository ownership and recovery |

**Missing questions that must be added:** persistent identity representation; corrected-master identity semantics; persistent published_at/featured source; redirect baseline; untagged ICC policy; hashed asset/old-release availability policy.

---

## Implementation Phase Dependency Audit

The P1–P10 names are usable, but dependencies should be reordered:

1. **P0 Architecture closure (new):** resolve RT-001–RT-004, originals policy, redirects, draft rules, cover/alt schema support.
2. **P1 Foundation:** pin current Astro/Node/toolchain; direct external content loader; baseline build; font strategy proof.
3. **P2 Content + identity:** persistent registry, lifecycle, deterministic Home selection, redirects, validation and authoring CLI/workflow.
4. **P3 Image benchmark harness first:** fixture corpus, ICC/privacy/determinism measurements.
5. **P4 Image pipeline:** staged derivatives + hashed manifest + integration.
6. **P5 Thin vertical slice:** one Home, Archive, Place, Gallery through real build and a non-production release directory.
7. **P6 Full pages + Gallery/Overview interactions.**
8. **P7 A11y/performance/SEO continuously, not as late cleanup.**
9. **P8 Visual regression infrastructure should begin with the first page, then final full adjudication here.**
10. **P9 Deployment:** prototype upload/switch/rollback earlier in a staging path; production gate here.
11. **P10 Final edge cases/documentation.**

Material changes:

- P2 identity cannot begin until persistent binding is decided.
- P3 should not both select an encoder and claim implementation gate determinism before benchmark tooling exists.
- Pages should not depend on an unstable image/manifest contract.
- Deployment and visual capture mechanics should be tested earlier as thin infrastructure, then fully gated later.
- SEO/a11y/performance are acceptance dimensions throughout, not a single late rescue phase.

---

## Failure Scenario Results

| Scenario | Expected behavior after correction | Data lost? | Build result | Recovery / adequacy now |
|---|---|---:|---|---|
| 1. Source filename renamed | Update persistent source_ref; Photo ID unchanged | No | Pass after explicit migration | **Current: inadequate; identity lost if generated deleted** |
| 2. Source moved folders | Update source_ref; Photo ID unchanged | No | Pass | **Current: inadequate** |
| 3. Corrected export replaces master | Explicit replace operation retains ID; source revision/hash changes; derivatives rehash | No | Pass after review | **Current: undefined** |
| 4. generated/ deleted | Recreate only derived metadata/assets from registry + masters | No | Pass | **Current: fails identity closure** |
| 5. dist/ deleted | Full build recreates site from staged/generated inputs | No | Pass | **Current: pipeline ordering may delete images** |
| 6. Gallery slug changes | Stable ID remains; old slug 301 to new | No | Pass only with redirect | **Current: intentional 404** |
| 7. Referenced Photo ID missing | Fail before derivation with exact Gallery/key | No | Fail closed | Mostly adequate, but generator order confused |
| 8. next target is draft | Production fail; preview may warn/render locally | No | Fail production | **Current: undefined** |
| 9. AdobeRGB/P3 image | Detect profile, convert to sRGB, attach selected profile, test | No | Pass | Direction sound, exact contract incomplete |
| 10. New Chinese glyph | Rebuild/validate subset or use covered fallback | No | Fail if coverage missing | **Current: can silently render missing glyph** |
| 11. Upload fails at 70% | Unique incomplete release never switched; safe cleanup/retry | No | Deploy fails | **Current: shared staging can retain partial state** |
| 12. Switch succeeds, smoke fails | Restore recorded previous target atomically; alert | No | Deploy fails/rolled back | **Current: automatic rollback not wired** |
| 13. VPS disk dies | Provision host; restore code/registry/masters/config; rebuild; verify | No if backups work | Recovery workflow | **Current: Git/LFS/RTO assumptions unproven** |

---

## Scale Analysis

Assumptions must be measured with actual master sizes and derivative counts. The table shows the first likely boundary, not guaranteed timings.

| Scale | Architecture behavior | First likely constraint | Required response |
|---|---|---|---|
| ~100 images | Full derivation and Git checkout manageable | Correctness contracts, not speed | Fix identity/build first; benchmark baseline |
| 1,000 images | Roughly 8–12 derivatives each creates 8k–12k files | Full re-encode time, deploy bytes, LFS transfers | Content-hash cache; skip unchanged; rsync hashed assets |
| 5,000 / 100+ Galleries | 40k–60k derivatives; content parsing still modest | Media storage/backup, CI time, inode/release duplication | External archive or hybrid; persistent derivative cache; capacity monitoring |
| 20,000 images | 160k–240k derivatives; repeated full releases expensive | Original ownership, derivative cache/store, deployment and backup | Keep static/YAML pages; add incremental derivation/content-addressed assets based on evidence |

Astro/YAML parsing is unlikely to be the first failure boundary. Media I/O, encoding, Git/LFS transfer, duplicated release assets, and restore cost fail first. A database is still not automatically required.

---

## Architecture Complexity Audit

| Subsystem | Classification | Verdict |
|---|---|---|
| Stable Photo identity registry | ESSENTIAL | Current implementation concept is broken, not unnecessary |
| ID-bound captions/rhythms | JUSTIFIED | Prevents reorder corruption |
| AssetManifest contract | JUSTIFIED | Clean image/render boundary; canonicalize it |
| Custom image pipeline | JUSTIFIED | Color/privacy/derivative requirements warrant it |
| Manual JS chunk splitting | PREMATURE | Start with default bundling |
| Git LFS for all originals | PREMATURE / SCALE-DEPENDENT | Reopen decision |
| Release-directory deployment | JUSTIFIED | Repair atomic verification |
| CJK subsetting | JUSTIFIED | Needs sustainable coverage, not static guess |
| next_gallery cycle prohibition | UNPROVEN | Validate actual product invariant |
| Custom validation | ESSENTIAL | File-first architecture depends on fail-fast closure |
| src/content copied mirror | UNNECESSARY | Astro loader can read authored external YAML directly |
| Photo-level published status | UNNECESSARY for one-Gallery MVP | Derive from Gallery |
| Custom scroll restoration | PREMATURE | Use browser default unless measured defect |
| Virtualization | OPTIONAL | Only with measured long-Gallery evidence |

---

## Required Corrections Before Implementation Plan

### MUST FIX BEFORE IMPLEMENTATION PLAN

1. Select persistent Photo ID ↔ source binding and corrected-master semantics.
2. Replace the build ordering with the single DAG in this report; give dist/ one owner.
3. Remove the dual content source; specify Astro Content Layer loader and version pin policy.
4. Add persistent published_at and featured selection semantics.
5. Decide originals/ingest-master storage and backup boundary.
6. Decouple ID from slug and approve baseline redirects.
7. Resolve draft/published, cover, next/prev, and derived-field canonical rules.
8. Correct runtime prose that violates frozen caption/continuation/mobile-nav behavior.

### MUST FIX BEFORE PHASE P2

1. Add alt-text schema support without filename fallback.
2. Add one-Gallery membership and orphan metadata-key validation.
3. Remove duplicate Photo status and authored has_continuation.
4. Define authoring commands/protocol for ingest, rename, move, replace, validate, preview, publish.

### MUST FIX BEFORE PHASE P3

1. Define semantic versus byte determinism.
2. Pin image toolchain/config and deterministic manifest core.
3. Define ICC/untagged/EXIF allowlist pipeline.
4. Use hashed derivative filenames and isolated staging.
5. Resolve CJK subset regeneration/coverage testing.

### MUST FIX BEFORE PHASE P9

1. Unique release staging, remote verification, atomic rename, exact rollback, deployment lock.
2. Real 404/canonical/cache behavior and old-page asset availability.
3. Proven backup/restore drill, credential recovery, RPO/RTO.

### SHOULD FIX

- Correct all MINOR examples/typos before using documents as implementation instructions.
- Convert pseudocode to explicitly labeled pseudocode or executable validated examples.
- Measure first before enforcing JS/CSS/image/HTML byte caps.

---

## Optional Improvements

- A small authoring CLI can generate IDs, validate source bindings, show intended changes, and require explicit confirmation for master replacement. This reduces YAML error risk without introducing a CMS.
- Generate an ingest report with source hash, profile, dimensions, privacy fields detected, and derivative summary.
- Add a content-addressed derivative cache outside release directories to reduce repeat encoding and preserve old asset hashes.
- Add periodic link/redirect integrity and backup restore drills.
- Add AVIF only after evidence; it is not required for the baseline.
- Keep analytics absent until an explicit measurement question exists.

---

## Questions Requiring User Decision

1. **Photo identity:** authored registry, Gallery-bound id+source items, persistent manifest, or UUID sidecar?
2. **Corrected master:** when should replacement retain Photo ID versus create a new Photo?
3. **Original ownership:** all in Git/LFS, all outside Git with backup, or curated ingest masters in LFS plus archival originals outside?
4. **Backup objective:** acceptable RPO/RTO and off-site target?
5. **Home editorial state:** featured field per Gallery or a separate Home selection file?
6. **Untagged color:** fail ingest or warn with explicit sRGB override?
7. **Slug changes:** approve redirects as baseline?
8. **next_gallery:** are cycles actually forbidden, or only self-loop/dangling/draft targets?
9. **CJK:** broad static subset or build-derived subset?
10. **Alt policy:** authored descriptions, decorative empty alt where appropriate, and publication enforcement level?
11. **Cover:** required explicit selection or deterministic first-Photo default?
12. **prev_gallery:** explicitly authored or derived?

Recommended defaults are stated in the relevant findings; none should be silently selected by implementation.

---

## Final Gate

## C

# MATERIAL ARCHITECTURE REVISION REQUIRED

One or more architectural contracts are logically incomplete or unsafe. Correct and re-review the targeted areas before Implementation Plan.

The architecture direction is **not rejected**. After RT-001–RT-004 and the MUST-FIX source-of-truth/deployment contracts are incorporated, a focused re-review can plausibly move directly to Gate B or A without reopening the frozen product or framework choice.
