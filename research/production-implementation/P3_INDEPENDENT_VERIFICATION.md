# P3 Independent Implementation Verification

**Review date:** 2026-08-30  
**Review scope:** WP-15 through WP-24 and directly related P3 Gate evidence only  
**Method:** independent read-only implementation review; no implementation, decision, plan, P4/P5, merge, push, or deployment changes were made  
**Authority applied:** `FINAL_DESIGN_SPECIFICATION.md` → frozen Production Architecture → frozen Production Implementation Plan → implementation/code/tests/generated evidence

## Executive Verdict

> **P3 IMPLEMENTATION VALID — Targeted corrections required before P4/P5.**

The implemented media chain is structurally coherent and the current generated corpus is internally closed: branch/HEAD match the report, WP-15 values are consumed, tagged color conversion precedes metadata loss, hashes are over final served bytes, the 1008-record Manifest resolves exactly to 657 current files, every current file/source hash re-verifies, and Astro enforces producer-before-consumer.

P3 cannot receive a formal PASS yet because the WP-21 scanner has a reproducible supported-format false-negative. A valid EXIF/GPS APP1 segment appended after a JPEG EOI marker is ignored and returns `ok: true`; an AVIF with an added top-level Adobe-XMP UUID box is also accepted without classifying its GPS/serial-bearing XMP payload. This contradicts the Gate's claim that every final byte is exhaustively checked for GPS/XMP/private metadata. The current 657 files were not found to contain leakage, so this is an **IMPORTANT scanner/gate-proof defect**, not evidence of a current CRITICAL leak or a structural P3 failure.

Independent finding counts:

- **CRITICAL: 0**
- **IMPORTANT: 1**
- **MINOR: 2**

## Repository State

| Check | Independent result |
|---|---|
| Worktree | `<repo>/.worktrees/production-dev` |
| Branch | `production-dev` — verified by `git branch --show-current` |
| HEAD | `569e1722bbfaa5e0010f25e57b220fc6937ca014` — reported short SHA `569e172` matches |
| Dirty state before report | Clean (`## production-dev`) |
| WP-15 freeze base | `bf32d9e` |
| P3 commit chain | Linear WP-16 → WP-24 implementation/fix rounds → `569e172` Gate evidence; commit subjects and changed-file set match WP-15–WP-24 scope |
| Remote state | `origin/production-dev` does not exist (`git ls-remote --heads origin production-dev` returned no row); HEAD is 43 commits ahead of `origin/main` (`0 43`); nothing was pushed by this review |
| Main worktree | Remains `main` at `92f7a58c312a9117737b70e34767eb71270923fb` |
| P4/P5 implementation | None found: no WP-25+ implementation commits/files/routes; P4/P5 remain `PENDING`; Astro builds only the existing placeholder `/index.html` |
| Merge/deploy effects | None performed or observed; no merge, push, release assembly, upload, symlink switch, or deployment command was run |

The only repository write in this review is this required report.

## WP-15 Decision Integrity

### Frozen values

`docs/implementation/decisions/BENCHMARK-OQ01-OQ02.md` records and its fenced JSON contract contains exactly:

| Decision | Verified value |
|---|---|
| D1 | Gallery `[480, 800, 1024, 1280, 1600, 2048, 2560]` |
| D2 | AVIF primary + JPEG fallback; no WebP |
| D3 | Sharp/libvips; Gallery/Cover AVIF q65; Overview AVIF q55; JPEG q75 |
| D4 | Overview `[480]`, i.e. max 480 px |
| D5 | Cover `[1280, 1600, 2048, 2560]` |
| D6 | Width-descriptor `srcset`; no fixed @2x, dedicated @3x, or 2880 rung |
| D7 | Progressive JPEG `true` |
| D8 | 16 hexadecimal filename characters; full derivative SHA-256 retained in the Manifest |

`scripts/media/derive.ts` parses the identified fenced JSON block at runtime, validates structure/order/rules, and derives the variant plan from it. Width/quality mutation tests demonstrate that the plan follows the record rather than mirrored test constants. `scripts/media/naming.ts` reads D8 from `record.raw`; it does not hardcode 16 in the publication path. No second divergent production value set was found.

`research/production-implementation/DEFERRED_ENGINEERING_DECISIONS.md` correctly marks D1–D8 CLOSED. D9/D10 status drift is recorded separately as MIN-01.

**Result: PASS.**

## WP-16 ICC Verification

### D9

- The chosen enforcement mode is `assume` and the interpretation is documented assume-sRGB, not a claim about unknown source truth.
- `assume`, `warn`, and `fail` are real branches in `scripts/media/icc-policy.ts`; tests exercise silent proceed, warning, and pre-encode failure.
- `scripts/media/color.ts` imports `DEFAULT_UNTAGGED_ENFORCEMENT_MODE` and routes `icc.present` through `evaluateIccSource`; there is no camera-model inference.
- Untagged and tagged inputs both use `orientedPipeline(source).toColourspace("srgb")`; the measured untagged path is a pixel no-op, while tagged Adobe RGB and Display P3 probes produce non-zero pixel changes.

### D10 and load-bearing pixel interpretation

- The source ICC is present when Sharp decodes and `toColourspace("srgb")` executes; orientation and color conversion occur before output metadata is omitted.
- No `keepIccProfile()`/`withIccProfile()` call exists in the production derivative path. The known `keepIccProfile()`-after-conversion mislabel trap is therefore avoided.
- JPEG and AVIF integration probes confirm that tagged wide-gamut input is transformed to sRGB pixels and the final public derivative intentionally has no embedded ICC.
- WP-19 owns pixel conversion; WP-21 owns final no-ICC/privacy verification. WP-19 does not embed output ICC.

The implementation uses a documented dedicated policy module as the runtime policy surface. The stale D9/D10 status in the deferred ledger does not change runtime behavior but should be synchronized (MIN-01).

**Result: PASS.**

## Pipeline Stage-Order Verification

Implemented chain reconstructed from executable composition:

```text
source bytes
→ extractSourceMetadata (orientation, ICC presence, dimensions, source SHA-256)
→ orientedPipeline(...).rotate()
→ toColourspace('srgb')
→ resize({ withoutEnlargement: true }) + AVIF/JPEG encode
→ Sharp default metadata omission
→ finalizeAndVerify (master checksum + final metadata/privacy/no-ICC scan)
→ publishDerivatives (full SHA-256 of those verified bytes; 16-hex filename; in-place rename only)
→ buildDeterministicCore + canonical Manifest write
→ safe stale pruning
→ coverage validation
→ Astro build-time Manifest gate/consumer
```

`PIPELINE_STAGES` and all WP-19–WP-22 composed plans are canonical increasing subsequences; hashing is last in `HASH_STAGE_PLAN`. The code path after hashing only renames the same inode bytes, records metadata, writes the separate Manifest, and may delete unreferenced files. It does not re-encode or mutate a served derivative. Astro reads `generated/asset-manifest.json` and never writes to `generated/media/`.

The guard proves the declared plan order and the concrete composition matches it. The WP-21 scanner defect does not change the byte/hash ordering; it weakens the trustworthiness of the final verification stage.

**Result: PASS for stage order; privacy proof subject to IMP-01.**

## WP-17–WP-24 Verification

| WP | Result | Independent evidence |
|---|---|---|
| WP-17 | PASS | Canonical `media/ingest-masters/` resolution; authored relative refs; published missing/corrupt/rejected sources fail; drafts filtered/relaxed per mode; JPEG primary, PNG/TIFF limited, RAW/HEIC rejected; full decode checks; source checksums unchanged. Live graph: 77 unique masters, 51 published Photo refs, no published miss. |
| WP-18 | PASS | Metadata read precedes `.rotate()`; orientation 6 fixture validates stored 512×768/tag 6 → upright 768×512, no residual orientation, no browser double rotation; the corrected subsequence guard rejects metadata-after-orient ordering. |
| WP-19 | PASS | Profile-aware `toColourspace('srgb')` after orientation; tagged sRGB identity, Adobe RGB/Display P3 transform, untagged D9 matrix; no final ICC embedding responsibility. |
| WP-20 | PASS | Runtime-frozen record consumption; exact ladders/qualities/formats; progressive JPEG; no WebP/2880/@2x/@3x; aspect preserved; no crop; no upscale; deterministic source caps/deduplication. |
| WP-21 | **FAIL** | Current files scan clean, but adversarial final-byte probes produce false clean results after JPEG EOI and in an added AVIF top-level box. See IMP-01. |
| WP-22 | PASS | SHA-256 over final verified file bytes; 16-hex name prefix; full hash in Manifest; source/config/toolchain provenance separate; corrected master preserves Photo ID and changes URLs; quality mutation changes affected URLs; collision branch fails before any rename. |
| WP-23 | PASS with MIN-02 | Empty-state regeneration and pinned-host byte determinism pass; expected denominator is frozen-plan-derived; missing variant fails; drafts excluded; current directory equals closure. Recursive pruning has a basename-only corner case (MIN-02). |
| WP-24 | PASS | Missing/stale Manifest fails production; typed load + width-precise closure gate; WP-13 runs first; selectors use structured entries and verbatim URLs; fallback `src` is widest JPEG; probe build HTML matches Manifest; no browser Manifest reference; no filename regex inference. |

## Final-Byte / Privacy Verification

### Current-corpus checks

- `npm run media:privacy-check`: **657/657 PASS**.
- Independent re-hash/re-stat over all Manifest records: 0 derivative-hash mismatches, 0 byte-count mismatches, 0 filename/digest mismatches.
- Independent source provenance check: 0 source-hash mismatches across 51 published masters.
- Current output set: exactly 657 referenced files, 657 present files, 0 missing, 0 orphan.
- Source fixture checksum and source-validation evidence support masters-untouched behavior.

### Adversarial scanner result

Using a current clean generated derivative entirely in memory:

1. A valid `Exif\0\0` TIFF GPS payload, wrapped as a JPEG APP1 segment and appended **after EOI**, produced `scanBuffer(...).ok === true` with zero findings.
2. A current clean AVIF with an appended well-formed top-level `uuid` box using the Adobe XMP UUID (`be7acfcb-97a9-42e8-9c71-999491e3afac`) and carrying XMP GPS/serial properties also produced `ok === true` with zero findings.

The JPEG probe is sufficient by itself to disprove the stated exhaustive-every-final-byte guarantee. The AVIF probe demonstrates the same policy gap at the top-level container classification boundary. Sharp currently emits only `ftyp`, one `meta`, and `mdat`, so a narrow fail-closed whitelist is feasible without redesigning the pipeline.

The implementation correctly fixed the three previously reported silent-pass paths (truncated TIFF bounds, incomplete nested AVIF child walks, and APPn before EOI after SOS). IMP-01 is a distinct boundary beyond those fixes.

## Manifest Verification

Independent mechanical results over `generated/asset-manifest.json`:

| Property | Result |
|---|---:|
| Schema | `quiet-editorial-archive/asset-manifest@1` |
| Canonical on-disk serialization | PASS — raw bytes equal `canonicalJson(parsedDocument)` |
| Records | 1008 |
| Unique `(photo_id,purpose,format,width)` keys | 1008; duplicates 0 |
| Published Photo IDs | 51 |
| Unique public files | 657 |
| Actual current media files | 657 |
| Hash mismatches | 0 |
| Byte-count mismatches | 0 |
| Filename/first-16-hash mismatches | 0 |
| Source-hash mismatches | 0 |
| Missing/orphan current files | 0 / 0 |

Every record includes Photo ID, purpose, width, height, format, bytes, final public URL, source hash, derivative hash, requested width/cap, quality/progressive state, and toolchain ID. The deterministic core is separated from `envelope.generated_at`.

The structure is format-agnostic: AVIF/JPEG are record values, not alternative schemas. Consumer selectors group/filter the structured fields and place `public_url` verbatim into `src`/`srcset`; no consumer extracts semantics from a filename regex. Full 64-hex `derivative_hash` values in the Manifest and 16-hex filename fingerprints are intentionally different representations of the same SHA-256.

**Result: PASS.**

## Count Reconciliation

> **COUNT MODEL COHERENT**

| Number | Population and derivation |
|---:|---|
| 113 source files | The frozen Stage 3C JPEG fixture corpus used by WP-20 benchmark/corpus derivation. `find` sees 114 filesystem entries only because `.DS_Store` is not an image fixture; checksum authority covers 113 JPEGs. |
| 77 masters | Current unique files under `media/ingest-masters/`: 51 unique published masters + 26 unique draft masters. |
| 126 Photo references | 51 published Photo entries + 75 draft entries. The 75 drafts reuse 26 unique masters (49 repeated refs), hence 126 refs but 77 files. |
| 2224 generated files | WP-20 pre-publication corpus run over all 113 fixture JPEGs, including fixtures not in the published content graph and before cross-purpose byte deduplication: 104 landscape-like sources × 20 variants + 9 portrait/capped sources × 16 = 2224. Both AVIF and JPEG and all three purposes are included. |
| 2224/2224 scanned | Earlier WP-21 scan over those WP-20 intermediate encoded files before WP-22 content-addressed publication/pruning. |
| 1008 required derivatives | Production published set only, derived mechanically from the frozen plan and each master's orientation-normalized width: 48 published 2048-wide sources × 20 records + 3 published 1365-wide capped sources × 16 = 1008. This is not derived from whatever files happen to exist. |
| 657 finals | Physical content-addressed files after byte-identical cross-purpose records collapse: 48 × 13 files + 3 × 11 files = 657. The Manifest retains all 1008 purpose records; 351 redundant intermediates share a final URL/file. |
| 657/657 scanned | Current production final physical-file population after WP-23 replaced/pruned the earlier 2224 benchmark intermediates. |

Current Manifest breakdown: 606 Gallery records, 102 Overview records, 300 Cover records; 504 AVIF + 504 JPEG; 12 records are explicit source-capped rows. There are no current stale/orphan output files. The earlier 2224 population was generated verification output, not unpublished authority, and was pruned after the production Manifest was written.

## Build DAG Verification

`package.json` defines:

```text
npm run build:media
  → npm run media:pipeline
     → derive → final verify → hash/rename → Manifest → prune → coverage
  → npm run build
     → WP-13 production content/source validation
     → WP-24 Manifest existence/load/coverage gate
     → Astro static build
```

A bare `npm run build` does not silently bypass safety: it may reuse already-produced generated state, but the WP-13/WP-24 gates revalidate the existing Manifest, required variant set, referenced files, full derivative hashes, and sampled dimensions before page generation. Missing and incomplete Manifest probes exit non-zero; a current valid Manifest build exits zero. Astro output does not contain `asset-manifest` references and does not modify or clear `generated/media/`.

**Result: PASS.**

## Test Quality Review

Fresh standard-command results:

| Command | Result |
|---|---|
| `npm run check` | exit 0; 0 errors, 0 warnings, 3 pre-existing hints |
| `npm run test:unit` | 256/256 |
| `npm run test:integration` | 202/202; 19/19 files; 232.92 s |
| `npm run test:e2e` | 13/13 |
| `npm run test:a11y` | 1/1 |
| `npm run media:privacy-check` | 657/657 current files green |
| `npm run media:coverage` | 1008/1008; 51 complete, 0 incomplete |
| `npm run build` | exit 0; WP-13 0/0; WP-24/coverage green |
| determinism isolated | 4/4 |
| regeneration isolated | 6/6 |
| manifest-consumption isolated | 14/14 |

Quality assessment:

- ICC tests execute real Sharp operations and compare pixel behavior; they do not merely mirror constants.
- Orientation uses a real EXIF-6 fixture and pixel/dimension assertions.
- Corrected-master invalidation keeps the same Photo ID and checks changed public URLs; quality/config mutation tests change only affected variants.
- Collision handling uses a real, dynamically found 8-hex SHA-256 birthday-prefix collision to exercise the same variable-length collision branch. It is valid branch evidence; it is not represented as a feasible 16-hex collision sample.
- Regeneration deletes an isolated `generated/` tree, performs real AVIF/JPEG runs, compares semantic and pinned-host byte results, plants a missing variant, and tests draft exclusion.
- Manifest-missing/stale negative builds are real Astro subprocess builds and exit non-zero for the intended invariant.
- Coverage denominator is recomputed from content graph + frozen record + extracted display width, not from existing output files.
- The important weakness is WP-21 scanner boundary coverage: existing tests stop at pre-EOI post-SOS markers and nested AVIF child incompleteness; they do not test bytes after JPEG EOI or unclassified top-level AVIF boxes. This allowed IMP-01 despite a green suite.

The first broad targeted run in this review overloaded concurrent AVIF suites and produced timeouts; each affected suite then passed in isolation, and the canonical full `npm run test:integration` passed 202/202. Those overload timeouts are not findings.

## P3 Gate Matrix

| Criterion | Result | Independent evidence |
|---|---|---|
| WP-15 benchmark decisions | PASS | Frozen record and runtime parser verified; D1–D8 exact; user-approved evidence packet/addendum recorded; no divergent runtime values. |
| regeneration/determinism | PASS | Fresh 6/6 regeneration + 4/4 determinism; empty generated state; semantic equality; byte equality only on pinned host/toolchain. |
| Manifest closure | PASS | 1008/1008 plan-derived unique keys; 657 exact files; 0 missing/orphan/hash/byte/source mismatches; current build gate green. |
| privacy/final metadata | **FAIL** | Current corpus green, but supported-format adversarial final bytes can carry GPS/XMP/private payload after JPEG EOI / in an unclassified AVIF Adobe-XMP UUID box while `scanBuffer` returns `ok: true`. |
| representative quality approval | PASS | WP-15 crop packet (114) + DPR/portrait strips (18) and D1–D8 approval are recorded; this review found no implementation drift from those approved values. |
| Astro Manifest consumption | PASS | Missing/stale negative probes; typed load and coverage; real probe HTML byte-equal to structured entries; no runtime/browser Manifest consumption. |

P3 Gate requires all six PASS. With privacy/final metadata FAIL and one IMPORTANT finding, formal P3 PASS is not available.

## Limitations

| Reported limitation | Classification | Adjudication |
|---|---|---|
| Single-host/toolchain byte determinism | **ACCEPTED LIMITATION** | Matches frozen §8 semantics; semantic determinism is the portable requirement and toolchain provenance is recorded. |
| Approximately 19-minute AVIF full 113-fixture encode | **ACCEPTED LIMITATION** | Full-build baseline is frozen; current scale completes; this is an informational performance baseline, not a P3 correctness blocker. Revisit only under WP-45 measured-budget governance. |
| JPEG+AVIF-only final scanner | **ACCEPTED LIMITATION** | Exactly matches frozen D2 output formats; any other format fails closed. This acceptance does not excuse the JPEG/AVIF false-negative in IMP-01. |
| WP-22 one-shot publish / re-derive model | **ACCEPTED LIMITATION** | Two-phase collision checks protect publication; WP-23 owns regeneration and proves empty-state rebuild. |
| Deferred minor findings in SDD ledger | **IMPLEMENTATION FOLLOW-UP** | Non-blocking as a class; retain for whole-branch review. MIN-01/MIN-02 below are specific P3 follow-ups. |

## Critical Findings

None.

## Important Findings

### IMP-01 — WP-21 supported-format scanner can falsely certify metadata-bearing trailing/container bytes

**Contract:** IMAGE_PIPELINE §7/§11.1; WP-21 exhaustive final-byte verification; P3 privacy/final-metadata criterion.

**Files:** `scripts/media/privacy-check.ts`; regression coverage in `tests/unit/privacy-check.test.ts` and/or `tests/integration/privacy.test.ts`; Gate evidence after correction.

**Reproduction:** append a valid GPS EXIF APP1 segment after EOI of a clean generated JPEG → `scanBuffer` returns `ok: true`, findings `[]`. Append a top-level Adobe-XMP UUID box carrying GPS/serial XMP properties to a clean generated AVIF → `ok: true`, findings `[]`.

**Execution consequence:** a derivative containing accessible private bytes can pass WP-21, be hashed/published by WP-22, enter the Manifest, and satisfy current coverage/hash gates. The present 657 files are clean under both current scanner and independent structural/hash checks, so there is no evidence of active leakage; the proof boundary is unsafe.

**Severity:** IMPORTANT — materially unsafe scanner gap; must be fixed before P3 Gate PASS.

**Minimum correction:**

1. JPEG: require EOI to terminate the final byte stream; any trailing byte/segment after EOI must produce a fail-closed `malformed`/`segment` finding (or be fully parsed and rejected). Add the exact GPS APP1-after-EOI regression test.
2. AVIF: make top-level coverage fail closed for boxes outside the pinned/verified public-output structure, including the Adobe-XMP `uuid` path and other opaque `uuid`/`free` additions; reject duplicate/unexamined metadata containers. A narrow whitelist matching current Sharp output (`ftyp`, exactly one verified `meta`, `mdat`) is sufficient if documented. Add the Adobe-XMP UUID GPS/serial regression test.
3. Re-run scanner unit/integration tests, full 657-file privacy scan, full integration suite, coverage, and production build. Refresh P3 Gate evidence only after both adversarial probes fail closed and the clean corpus stays green.

No architecture, D9, D10, format, pipeline-order, or Manifest redesign is required.

## Minor Findings

### MIN-01 — D9/D10 deferred-decision ledger status is stale

`ICC-POLICY.md`, WP-16, runtime code, and P3 Gate evidence say D9/D10 are CLOSED, but `research/production-implementation/DEFERRED_ENGINEERING_DECISIONS.md` still marks both `OPEN`. There is no divergent value and runtime consumption is correct, so this is non-blocking documentation/status drift. Minimum correction: change only those two status cells to CLOSED with date, selected values, and `ICC-POLICY.md` pointer.

### MIN-02 — Recursive stale pruning compares basenames, not manifest-relative paths

`pruneStaleDerivatives` recursively walks `generated/media` but reduces both Manifest URLs and discovered files to basenames. A nested orphan `nested/kept.avif` survives when `/media/kept.avif` is referenced; the independent temp probe returned `pruned: []`. The current pipeline emits a flat directory, current output has zero orphans, and the nested file would not become Manifest authority, so this is non-blocking. Minimum correction: either enforce/clean a strictly flat output directory or compare validated relative paths; add a nested same-basename orphan test.

## Required Corrections

Blocking correction before P4/P5:

1. Fix IMP-01 in WP-21 with the two exact supported-format regression probes and refresh only the privacy-related P3 evidence.

Non-blocking follow-ups suitable for the same targeted patch:

2. Synchronize D9/D10 CLOSED status in the deferred-decision ledger (MIN-01).
3. Close the basename-only nested-orphan pruning corner case (MIN-02), or explicitly defer it with the flat-output invariant test strengthened.

Follow-up verification should be targeted to WP-21/privacy plus the standard P3 regression commands; no broad P3 redesign or P4/P5 work is authorized.

## Final Gate

> **P3 IMPLEMENTATION VALID — Targeted corrections required before P4/P5.**

**Next authorized phase:** targeted P3 correction and independent re-verification of IMP-01 only. P4/P5 production development remains **not authorized** until privacy/final metadata changes from FAIL to PASS, Important count reaches 0, and all six P3 criteria independently PASS.
